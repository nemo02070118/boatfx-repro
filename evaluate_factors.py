"""Self-contained reference evaluator for the machine-generated factor language.

Given a daily OHLCV panel, it maps the nine microstructure input signals to daily
proxies and evaluates any factor AST in `sample_factors.json` to a per-name daily
series. This lets a third party confirm that every published sample formula is a
well-formed, executable expression and reproduce its factor values.

It intentionally does NOT include the regime router or the selection policy: the paper
takes factors as given and routes them with the method described in the text. This file
establishes that the factor *language* and *sample* are real and runnable.

Usage:
    python evaluate_factors.py            # runs on a synthetic panel (self-test)
    python evaluate_factors.py PRICES.csv # PRICES.csv: columns date,name,open,high,low,close,volume
"""
import json, sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent


def signal_proxies(df):
    """Map the 9 microstructure signals to daily-OHLCV proxies (documented mapping).
    df has a DatetimeIndex and columns open/high/low/close/volume for one name."""
    close = df['close'].astype(float)
    high, low, openp = df['high'].astype(float), df['low'].astype(float), df['open'].astype(float)
    vol = df['volume'].astype(float)
    rng = (high - low).replace(0, np.nan)
    mid = (high + low) / 2.0
    # signed pressure from where close sits in the day's range: proxy for order imbalance
    press = ((close - low) - (high - close)) / rng
    return {
        'BestBid': low, 'BestAsk': high, 'MidPrice': mid,
        'TradePrice': close, 'TradeSize': vol, 'Volume': vol,
        'TradeSide': np.sign(close - openp),
        'BidSize': vol * (0.5 + 0.5 * press.clip(-1, 1)),
        'AskSize': vol * (0.5 - 0.5 * press.clip(-1, 1)),
    }


def evaluate(node, env):
    k = node.get('kind')
    if k == 'input':
        return env[node['signal']]
    if k == 'const':
        base = next(iter(env.values()))
        return pd.Series(float(node.get('value', node.get('val', 0.0))), index=base.index)
    if k == 'unary':
        x = evaluate(node['inner'], env); op = node['op']
        if op == 'Abs':  return x.abs()
        if op == 'Neg':  return -x
        if op == 'Sign': return np.sign(x)
        if op == 'Sqrt': return np.sqrt(x.abs())
        if op == 'Log':  return np.log(x.abs().clip(lower=1e-12))
        if op == 'Diff': return x.diff()
        if op == 'Rank': return x.rank(pct=True) - 0.5
        raise ValueError(f'unary {op}')
    if k == 'binary':
        a = evaluate(node['left'], env); b = evaluate(node['right'], env); op = node['op']
        if op == 'Add': return a + b
        if op == 'Sub': return a - b
        if op == 'Mul': return a * b
        if op == 'Div': return a / b.replace(0, np.nan)
        if op == 'Max': return pd.concat([a, b], axis=1).max(axis=1)
        if op == 'Min': return pd.concat([a, b], axis=1).min(axis=1)
        if op == 'Pow': return np.sign(a) * (a.abs().clip(upper=1e6)) ** np.clip(b, -3, 3)
        if op == 'Gt':  return (a > b).astype(float)
        if op == 'Lt':  return (a < b).astype(float)
        raise ValueError(f'binary {op}')
    if k == 'rolling':
        x = evaluate(node['inner'], env); op = node['op']; w = int(node['window'])
        mp = max(2, w // 2); r = x.rolling(w, min_periods=mp)
        if op == 'Mean': return r.mean()
        if op == 'Std':  return r.std()
        if op == 'Sum':  return r.sum()
        if op == 'Max':  return r.max()
        if op == 'Min':  return r.min()
        if op == 'Skew': return r.skew()
        if op == 'Kurt': return r.kurt()
        if op == 'Zscore': return (x - r.mean()) / r.std()
        if op == 'Rank': return x.rolling(w, min_periods=mp).apply(
            lambda s: pd.Series(s).rank(pct=True).iloc[-1], raw=False)
        if op == 'Quantile': return r.quantile(0.5)
        if op == 'Slope': return x.rolling(w, min_periods=mp).apply(
            lambda s: np.polyfit(np.arange(len(s)), s, 1)[0], raw=True)
        if op == 'Corr': return x.rolling(w, min_periods=mp).corr(x.shift(1))
        raise ValueError(f'rolling {op}')
    if k == 'if_then_else':
        c = evaluate(node['cond'], env)
        t = evaluate(node['then_'], env); e = evaluate(node['else_'], env)
        return t.where(c > 0, e)
    raise ValueError(f'unknown kind {k}')


def synthetic_panel(n_days=500, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range('2015-01-01', periods=n_days)
    ret = rng.normal(0, 0.02, n_days)
    close = pd.Series(100 * np.exp(np.cumsum(ret)), index=idx)
    high = close * (1 + rng.uniform(0, 0.02, n_days))
    low = close * (1 - rng.uniform(0, 0.02, n_days))
    openp = close.shift(1).fillna(close.iloc[0])
    vol = pd.Series(rng.lognormal(12, 0.5, n_days), index=idx)
    return pd.DataFrame({'open': openp, 'high': high, 'low': low,
                         'close': close, 'volume': vol}, index=idx)


def main():
    factors = json.loads((HERE / 'sample_factors.json').read_text(encoding='utf-8'))
    if len(sys.argv) > 1:
        raw = pd.read_csv(sys.argv[1], parse_dates=['date'])
        name0 = raw['name'].iloc[0]
        df = raw[raw['name'] == name0].set_index('date').sort_index()
    else:
        df = synthetic_panel()
    env = signal_proxies(df)
    ok, fail = 0, []
    for f in factors:
        try:
            s = evaluate(f['expr'], env)
            assert isinstance(s, pd.Series) and np.isfinite(s.dropna()).all()
            ok += 1
        except Exception as e:
            fail.append((f['name'], str(e)))
    print(f'{ok}/{len(factors)} sample factors evaluated successfully on the panel')
    for nm, e in fail:
        print(f'  FAILED {nm}: {e}')


if __name__ == '__main__':
    main()
