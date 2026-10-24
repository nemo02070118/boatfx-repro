/* ==========================================================================
   BOAT · 04c learning bench
   --------------------------------------------------------------------------
   The half of the site that LEARNS. Everything here runs in this tab:

     market()      a declared, seeded synthetic order book — the generative
                   process is printed in the UI, the seed is 20261105, and
                   every visitor gets the same series
     evaluate()    the gate's own grammar, evaluated as a time series
     stats()       real IC (Spearman), its t-stat, Sharpe, turnover, drawdown
     train()       logistic regression by real gradient descent, and ridge by
                   real normal equations — weights, loss curve, held-out score
     importance()  permutation importance on the held-out block: the model-
                   agnostic attribution the paper's SHAP column stands for

   Two data sources, both honest:
     · the declared seeded market (no network, reproducible)
     · whatever the visitor pastes in (their numbers, their machine)
   ========================================================================== */
(function () {
  "use strict";

  var SCREEN = 1.96;                       /* the unconditional screen, §04 */
  var D_EFF = 17;                          /* effective dimension, §04      */
  var ALLOC = Math.sqrt(2 * Math.log(D_EFF)); /* 2.3803                     */
  var SEED = 20261105;
  var BARS = 1200;
  var RANK_WIN = 250;                      /* time-series rank lookback     */
  var SPLIT = 0.7;                         /* train / holdout fraction      */
  var EPOCHS = 240;
  var LR = 0.35;
  var L2 = 0.004;

  /* ------------------------------------------------------------- helpers */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(u) {
    var a = u() || 1e-12, b = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
  }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
  function std(a) {
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - m; s += d * d; }
    return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ------------------------------------------------- the declared market */
  /* Printed in the UI, verbatim:
       mid        AR(1) latent -> small drift + 1.1% daily noise
       spread     mean-reverting, widens with volume
       queue      log-normal sizes; imbalance co-moves with the latent
       flow       signed trade size co-moves with the latent
     The latent is the ONLY predictable part, and it is small: a factor that
     can see it earns; a factor that cannot, cannot. That asymmetry is the
     point — it is what makes the IC numbers below mean something.          */
  function market(seed) {
    var u = rng(seed == null ? SEED : seed);
    var n = BARS, L = 0, m = 100, s = 0.02, v = 1e6;
    var S = { MidPrice: [], BestBid: [], BestAsk: [], BidSize: [], AskSize: [],
              Volume: [], TradeSide: [], TradeSize: [] };
    var imbNow = 0.5, flowNow = 0;
    for (var t = 0; t < n; t++) {
      L = 0.94 * L + gauss(u) * 0.6;                       /* the latent      */
      imbNow = clamp(0.5 + 0.16 * L + gauss(u) * 0.10, 0.02, 0.98);
      flowNow = 0.35 * L + gauss(u);
      /* the ONLY predictable channel, stated so it can be argued with:
         next-bar return = 0.0006 * imbalance + 0.0004 * signed flow + noise */
      var ret = 0.0006 * imbNow + 0.0004 * flowNow + gauss(u) * 0.011;
      m = m * Math.exp(ret);
      s = Math.max(0.0008, 0.985 * s + 0.0004 + Math.abs(gauss(u)) * 0.0006);
      v = Math.max(5e4, v * Math.exp(0.05 * gauss(u)));
      S.MidPrice.push(m);
      S.BestBid.push(m - s / 2);
      S.BestAsk.push(m + s / 2);
      S.BidSize.push(Math.max(1, v * imbNow / m));
      S.AskSize.push(Math.max(1, v * (1 - imbNow) / m));
      S.Volume.push(v);
      S.TradeSide.push(flowNow > 0 ? 1 : -1);
      S.TradeSize.push(Math.max(1, Math.abs(gauss(u)) * v * 0.002 / m));
    }
    var fwd = [];
    for (var i = 0; i < n - 1; i++) fwd.push(Math.log(S.MidPrice[i + 1] / S.MidPrice[i]));
    fwd.push(0);
    return { n: n, signals: S, fwd: fwd, seed: seed == null ? SEED : seed, source: "declared" };
  }

  /* --------------------------------------------- the grammar, evaluated */
  function fill(v, n) { var a = [], i; for (i = 0; i < n; i++) a.push(v); return a; }
  function op(a, b, f, n) {
    var o = [], i;
    for (i = 0; i < n; i++) o.push(f(a[i], b[i]));
    return o;
  }
  /* rolling window helpers: value at t uses bars [t-w+1, t] */
  function roll(x, w, f, n) {
    var o = [], i, j, buf;
    for (i = 0; i < n; i++) {
      buf = [];
      for (j = Math.max(0, i - w + 1); j <= i; j++) buf.push(x[j]);
      o.push(f(buf));
    }
    return o;
  }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function slope(a) {
    var n = a.length; if (n < 2) return 0;
    var mx = (n - 1) / 2, my = sum(a) / n, num = 0, den = 0;
    for (var i = 0; i < n; i++) { var dx = i - mx; num += dx * (a[i] - my); den += dx * dx; }
    return den ? num / den : 0;
  }
  /* time-series percentile rank of the last value inside its own history */
  function tsRank(x, w, n) {
    var o = [], i, j, c, v;
    for (i = 0; i < n; i++) {
      v = x[i]; c = 0;
      for (j = Math.max(0, i - w + 1); j <= i; j++) if (x[j] <= v) c++;
      o.push((c - 1) / Math.max(1, Math.min(w, i + 1) - 1) * 2 - 1); /* [-1, 1] */
    }
    return o;
  }

  function evalAST(ast, S, n) {
    if (!ast) return fill(0, n);
    switch (ast.kind) {
      case "input":
        return (S[ast.signal] || fill(0, n)).slice(0, n);
      case "const":
        return fill(ast.value, n);
      case "unary":
        var a = evalAST(ast.inner, S, n), i;
        switch (ast.op) {
          case "Abs":  return a.map(function (v) { return Math.abs(v); });
          case "Sign":  return a.map(function (v) { return v > 0 ? 1 : v < 0 ? -1 : 0; });
          case "Neg":   return a.map(function (v) { return -v; });
          case "Log":   return a.map(function (v) { return Math.log(Math.max(1e-12, v)); });
          case "Sqrt":  return a.map(function (v) { return Math.sqrt(Math.max(0, v)); });
          case "Diff":  { var d = [0]; for (i = 1; i < n; i++) d.push(a[i] - a[i - 1]); return d; }
          case "Rank":  return tsRank(a, RANK_WIN, n);
        }
        return a;
      case "binary":
        var l = evalAST(ast.left, S, n), r = evalAST(ast.right, S, n);
        switch (ast.op) {
          case "Add": return op(l, r, function (x, y) { return x + y; }, n);
          case "Sub": return op(l, r, function (x, y) { return x - y; }, n);
          case "Mul": return op(l, r, function (x, y) { return x * y; }, n);
          case "Div": return op(l, r, function (x, y) { return y === 0 ? 0 : x / y; }, n);
          case "Min": return op(l, r, function (x, y) { return Math.min(x, y); }, n);
          case "Max": return op(l, r, function (x, y) { return Math.max(x, y); }, n);
          case "Pow": return op(l, r, function (x, y) { return Math.pow(x, y); }, n);
        }
        return op(l, r, function (x, y) { return x + y; }, n);
      case "rolling":
        var b = evalAST(ast.inner, S, n);
        var w = Math.max(2, Math.min(ast.window || 20, n));
        switch (ast.op) {
          case "Mean":   return roll(b, w, mean, n);
          case "Std":    return roll(b, w, std, n);
          case "Zscore": {
            var mu = roll(b, w, mean, n), sd = roll(b, w, std, n), z = [], k;
            for (k = 0; k < n; k++) z.push(sd[k] > 1e-12 ? (b[k] - mu[k]) / sd[k] : 0);
            return z;
          }
          case "Slope":  return roll(b, w, slope, n);
        }
        return b;
    }
    return fill(0, n);
  }

  /* --------------------------------------------------------- statistics */
  function rank_(a) {
    var idx = a.map(function (v, i) { return [v, i]; }).sort(function (x, y) { return x[0] - y[0]; });
    var r = new Array(a.length), i;
    for (i = 0; i < idx.length; i++) r[idx[i][1]] = i + 1;
    return r;
  }
  function pearson(a, b) {
    var n = Math.min(a.length, b.length); if (n < 3) return 0;
    var ma = 0, mb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var num = 0, da = 0, db = 0;
    for (i = 0; i < n; i++) {
      var x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    return (da > 0 && db > 0) ? num / Math.sqrt(da * db) : 0;
  }
  function spearman(a, b) { return pearson(rank_(a), rank_(b)); }

  function zscore(a) {
    var m = mean(a), s = std(a) || 1, o = [], i;
    for (i = 0; i < a.length; i++) o.push((a[i] - m) / s);
    return o;
  }

  /* Real factor statistics on a signal series against forward returns.
     The IC t-stat uses NON-OVERLAPPING blocks on purpose: overlapping windows
     are autocorrelated and inflate t by roughly sqrt(window) — the exact
     error this site's paper is about. Block count is reported so the reader
     can see how much evidence there actually is.                          */
  function stats(sig, fwd) {
    var n = Math.min(sig.length, fwd.length);
    var z = zscore(sig.slice(0, n));
    var pos = z.map(function (v) { return clamp(v, -2.5, 2.5) / 2.5; });
    var strat = [], i;
    for (i = 0; i < n; i++) strat.push(pos[i] * fwd[i]);
    var ic = spearman(sig.slice(0, n), fwd.slice(0, n));
    var BLK = 60, blocks = [], b;
    for (b = 0; b + BLK <= n; b += BLK) {
      blocks.push(spearman(sig.slice(b, b + BLK), fwd.slice(b, b + BLK)));
    }
    var icT = blocks.length > 2 && std(blocks) > 1e-12
      ? mean(blocks) * Math.sqrt(blocks.length) / std(blocks) : 0;
    var sd = std(strat);
    var sharpe = sd > 1e-12 ? mean(strat) / sd * Math.sqrt(252) : 0;
    var turn = 0;
    for (i = 1; i < n; i++) turn += Math.abs(pos[i] - pos[i - 1]);
    turn = n > 1 ? turn / (n - 1) : 0;
    var eq = 1, peak = 1, mdd = 0;
    for (i = 0; i < n; i++) { eq *= (1 + strat[i]); if (eq > peak) peak = eq; mdd = Math.max(mdd, 1 - eq / peak); }
    var active = 0;
    for (i = 0; i < n; i++) if (Math.abs(z[i]) > 1) active++;
    var pi = active / n;
    return {
      n: n, ic: ic, icT: icT, blocks: blocks.length,
      sharpe: sharpe, turnover: turn, maxDD: mdd,
      pi: pi, dilutedT: icT * Math.sqrt(Math.max(pi, 1e-9)),
      passesScreen: Math.abs(icT) >= SCREEN,
      passesAlloc: Math.abs(icT) >= ALLOC,
      equity: eq - 1
    };
  }

  /* ------------------------------------------------------ real learning */
  /* standardize columns; returns {X, mu, sd} with a bias column appended */
  function design(cols, target) {
    var n = target.length, k = cols.length, mu = [], sd = [], i, j;
    for (j = 0; j < k; j++) { mu.push(mean(cols[j])); sd.push(std(cols[j]) || 1); }
    var X = [];
    for (i = 0; i < n; i++) {
      var row = [1];
      for (j = 0; j < k; j++) row.push((cols[j][i] - mu[j]) / sd[j]);
      X.push(row);
    }
    return { X: X, mu: mu, sd: sd, k: k, n: n };
  }

  /* logistic regression, full-batch gradient descent, L2 — every epoch real */
  function logistic(X, y, opts) {
    var o = opts || {}, epochs = o.epochs || EPOCHS, lr = o.lr || LR, l2 = o.l2 == null ? L2 : o.l2;
    var n = X.length, k = X[0].length, w = new Array(k).fill(0), i, j, e;
    var loss = [], g, p, d;
    for (e = 0; e < epochs; e++) {
      g = new Array(k).fill(0);
      var ll = 0;
      for (i = 0; i < n; i++) {
        var z = 0;
        for (j = 0; j < k; j++) z += w[j] * X[i][j];
        p = 1 / (1 + Math.exp(-clamp(z, -30, 30)));
        d = p - y[i];
        ll += -(y[i] * Math.log(p + 1e-12) + (1 - y[i]) * Math.log(1 - p + 1e-12));
        for (j = 0; j < k; j++) g[j] += d * X[i][j];
      }
      for (j = 0; j < k; j++) {
        g[j] = g[j] / n + (j === 0 ? 0 : l2 * w[j]);
        w[j] -= lr * g[j];
      }
      loss.push(ll / n + l2 * 0.5 * w.reduce(function (a, b) { return a + b * b; }, 0) / n);
    }
    return { w: w, loss: loss, epochs: epochs };
  }

  function predictLogistic(model, X) {
    return X.map(function (row) {
      var z = 0;
      for (var j = 0; j < row.length; j++) z += model.w[j] * row[j];
      return 1 / (1 + Math.exp(-clamp(z, -30, 30)));
    });
  }

  /* ridge regression by normal equations + Gaussian elimination — no library */
  function ridge(X, y, lam) {
    var n = X.length, k = X[0].length, A = [], b = [], i, j, m;
    for (i = 0; i < k; i++) {
      A.push(new Array(k).fill(0)); b.push(0);
      for (j = 0; j < k; j++) {
        var s = 0;
        for (m = 0; m < n; m++) s += X[m][i] * X[m][j];
        A[i][j] = s + (i === j && i > 0 ? lam * n : 0);
      }
      for (m = 0; m < n; m++) b[i] += X[m][i] * y[m];
    }
    for (i = 0; i < k; i++) {
      var p = i;
      for (m = i + 1; m < k; m++) if (Math.abs(A[m][i]) > Math.abs(A[p][i])) p = m;
      if (Math.abs(A[p][i]) < 1e-12) continue;
      var t = A[i]; A[i] = A[p]; A[p] = t;
      var tb = b[i]; b[i] = b[p]; b[p] = tb;
      for (m = i + 1; m < k; m++) {
        var f = A[m][i] / A[i][i];
        for (j = i; j < k; j++) A[m][j] -= f * A[i][j];
        b[m] -= f * b[i];
      }
    }
    var w = new Array(k).fill(0);
    for (i = k - 1; i >= 0; i--) {
      var s2 = b[i];
      for (j = i + 1; j < k; j++) s2 -= A[i][j] * w[j];
      w[i] = Math.abs(A[i][i]) < 1e-12 ? 0 : s2 / A[i][i];
    }
    return { w: w, k: k, n: n };
  }

  /* effect of a one-sigma move in feature j, on the target's own scale.
     The design matrix already carries each column's sigma, so the raw
     coefficient becomes something a reader can interpret.               */
  function effects(model, d, targetSD) {
    var sy = targetSD || 1, out = [], j;
    for (j = 0; j < d.k; j++) out.push(model.w[j + 1] * d.sd[j] / sy);
    return out;
  }

  function predictLinear(model, X) {
    return X.map(function (row) {
      var z = 0;
      for (var j = 0; j < row.length; j++) z += model.w[j] * row[j];
      return z;
    });
  }

  /* permutation importance, signal level: shuffle one column, re-measure THAT
     column's own IC against the forward return, and report the drop. What it
     measures is how much of a channel's rank correlation is time alignment
     rather than noise — a column that carries no aligned signal drops to ~0.
     Model-agnostic: it never looks at a fitted weight.                    */
  function importance(cols, names, fwd, seed) {
    var u = rng(seed == null ? SEED + 7 : seed);
    var out = [];
    for (var j = 0; j < cols.length; j++) {
      var base = spearman(cols[j], fwd);
      var c = cols[j].slice(), k = c.length, i, tmp;
      for (i = k - 1; i > 0; i--) {
        var r = Math.floor(u() * (i + 1));
        tmp = c[i]; c[i] = c[r]; c[r] = tmp;
      }
      var sh = spearman(c, fwd);
      out.push({ name: names[j], base: base, shuffled: sh, drop: base - sh });
    }
    return out;
  }

  /* ------------------------------------------------------ placebo test */
  /* Permutation test for one factor: destroy the signal–return pairing by
     shuffling the signal, re-measure the SAME statistic, and report where the
     real number falls in that null distribution. This is the honest answer to
     "is that t-stat real?" and it is the paper's multiple-testing argument
     turned into a device.                                                 */
  function placebo(sig, fwd, reps, seed) {
    var R = reps || 200;
    var u = rng((seed == null ? SEED : seed) + 7);
    var real = stats(sig, fwd);
    var nulls = [], i, c, k;
    for (i = 0; i < R; i++) {
      c = sig.slice();
      for (k = c.length - 1; k > 0; k--) {
        var r = Math.floor(u() * (k + 1));
        var tmp = c[k]; c[k] = c[r]; c[r] = tmp;
      }
      nulls.push(stats(c, fwd).icT);
    }
    nulls.sort(function (a, b) { return a - b; });
    var extreme = 0;
    for (i = 0; i < nulls.length; i++) if (Math.abs(nulls[i]) >= Math.abs(real.icT)) extreme++;
    return {
      real: real.icT,
      nulls: nulls,
      reps: R,
      p: (extreme + 1) / (R + 1),
      nullMedian: nulls[Math.floor(R / 2)],
      nullP95: nulls[Math.floor(R * 0.95)],
      stats: real
    };
  }

  /* ------------------------------------------------------------- exports */
  window.HJ_ML = {
    version: "v1.0",
    constants: { SCREEN: SCREEN, D_EFF: D_EFF, ALLOC: ALLOC, SEED: SEED, BARS: BARS, RANK_WIN: RANK_WIN, SPLIT: SPLIT, EPOCHS: EPOCHS, LR: LR, L2: L2 },
    market: market,
    evalAST: evalAST,
    stats: stats,
    spearman: spearman,
    pearson: pearson,
    zscore: zscore,
    design: design,
    logistic: logistic,
    predictLogistic: predictLogistic,
    ridge: ridge,
    predictLinear: predictLinear,
    effects: effects,
    importance: importance,
    placebo: placebo
  };
})();
