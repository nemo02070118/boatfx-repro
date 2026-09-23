"""One-command reproduction entry point.

Runs the self-contained factor-language evaluator on a fixed synthetic panel (seed 0),
confirms every shipped sample AST is well-formed and executable, and prints a short
provenance report. This is the minimal reproducible artifact: it establishes that the
factor language, the operator/signal inventory, and the sample factors are real and
runnable end to end. The regime router and the selection policy are described in the
paper and the Internet Appendix; this package deliberately exposes the factor engine
rather than the proprietary routing weights.

Usage:
    python repro.py                 # fixed-seed synthetic panel self-test
    python repro.py PRICES.csv      # your own daily OHLCV panel (date,name,open,high,low,close,volume)
"""
import json
import sys
from pathlib import Path

import numpy as np

import evaluate_factors as E

HERE = Path(__file__).resolve().parent
SEED = 0


def main() -> int:
    print("=" * 68)
    print("Global Weakness, Local Strength -- reproducibility self-test")
    print("=" * 68)
    inv = json.loads((HERE / "operator_inventory.json").read_text(encoding="utf-8"))
    factors = json.loads((HERE / "sample_factors.json").read_text(encoding="utf-8"))
    n_ops = sum(len(v) for v in inv.values() if isinstance(v, list)) if isinstance(inv, dict) else len(inv)
    print(f"operator/signal inventory : {n_ops} named tokens")
    print(f"sample factors     : {len(factors)} ASTs")
    print(f"random seed        : {SEED}")

    if len(sys.argv) > 1:
        import pandas as pd
        raw = pd.read_csv(sys.argv[1], parse_dates=["date"])
        name0 = raw["name"].iloc[0]
        df = raw[raw["name"] == name0].set_index("date").sort_index()
        print(f"panel              : {sys.argv[1]} (name={name0}, {len(df)} rows)")
    else:
        df = E.synthetic_panel(seed=SEED)
        print(f"panel              : synthetic, {len(df)} business days")

    env = E.signal_proxies(df)
    ok, fail = 0, []
    for f in factors:
        try:
            s = E.evaluate(f["expr"], env)
            assert s is not None and np.isfinite(s.dropna()).all()
            ok += 1
        except Exception as exc:
            fail.append((f.get("name", "?"), str(exc)))
    print("-" * 68)
    print(f"RESULT: {ok}/{len(factors)} sample factors evaluated cleanly")
    for nm, exc in fail:
        print(f"  FAILED {nm}: {exc}")
    print("=" * 68)
    return 0 if not fail else 1


if __name__ == "__main__":
    sys.exit(main())
