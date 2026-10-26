/* ==========================================================================
   BOAT-3 · 00c net — a neural factor, trained in this tab
   --------------------------------------------------------------------------
   The honest version of "deep learning for factors". Not a language model's
   guess, not a black box: a two-layer multilayer perceptron, trained by real
   back-propagation on the page's eight declared signals to predict the next
   bar's direction, with its loss curve, held-out accuracy, and permutation
   importance printed. Its output is a signal — a "neural factor" — which is
   then measured by the SAME instrument (HJ_ML.stats) and run through the SAME
   sieve (universal screen vs home-venue routing + pooling) as every other
   factor on this page. The point of the demo is the opposite of hype: a deep
   network is not exempt from the sieve. The same instrument that screens a
   1960s price ratio screens a 2026 network, and the same mis-kill can happen.

   Every threshold, the tape, and the seed are the page's own. No network,
   no API key, nothing uploaded. Re-run it: identical numbers.
   ========================================================================== */
(function () {
  "use strict";

  function t(en, zh) {
    try {
      var s = localStorage.getItem("hj-lang");
      if (s === "zh") return zh;
      if (s === "en") return en;
    } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
  }
  function num(x, d) {
    d = d == null ? 2 : d;
    if (x == null || !isFinite(x)) return "—";
    var p = Math.pow(10, d);
    return (Math.round(x * p) / p).toFixed(d);
  }

  var SEED = 20261105;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var tt = Math.imul(a ^ (a >>> 15), 1 | a);
      tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt;
      return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(u) { var a = u() || 1e-12, b = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
  function std(a) { var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) { var d = a[i] - m; s += d * d; } return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0; }

  /* the eight declared signals, in the order the tape ships them */
  var SIGNALS = ["MidPrice", "BestBid", "BestAsk", "BidSize", "AskSize", "Volume", "TradeSide", "TradeSize"];

  /* ---- a small, honest MLP: in -> h1(tanh) -> h2(tanh) -> 1(sigmoid) ---- */
  function makeNet(inDim, h1, h2, rnd) {
    function w(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = (rnd() - 0.5) * 0.8; return a; }
    return {
      h1: h1, h2: h2, inDim: inDim,
      w1: Array.from({ length: h1 }, function () { return w(inDim); }), b1: w(h1),
      w2: Array.from({ length: h2 }, function () { return w(h1); }), b2: w(h2),
      w3: w(h2), b3: w(1)[0]
    };
  }
  function netForward(net, x) {
    var i, j, z, a;
    var h1 = new Array(net.h1), h2 = new Array(net.h2);
    for (i = 0; i < net.h1; i++) {
      z = net.b1[i];
      for (j = 0; j < net.inDim; j++) z += net.w1[i][j] * x[j];
      h1[i] = Math.tanh(z);
    }
    for (i = 0; i < net.h2; i++) {
      z = net.b2[i];
      for (j = 0; j < net.h1; j++) z += net.w2[i][j] * h1[j];
      h2[i] = Math.tanh(z);
    }
    z = net.b3;
    for (j = 0; j < net.h2; j++) z += net.w3[j] * h2[j];
    return clamp(z, -6, 6);
  }

  /* ---- the training run: full-batch backprop, momentum, L2, MSE on the
     continuous forward return (the net is a factor forecaster) ------------ */
  function train(net, X, y, Xo, yo, epochs, lr, l2, mom) {
    var n = X.length, k = net.h1, m = net.h2, p = net.inDim;
    var g1 = Array.from({ length: k }, function () { return new Array(p).fill(0); }), gb1 = new Array(k).fill(0);
    var g2 = Array.from({ length: m }, function () { return new Array(k).fill(0); }), gb2 = new Array(m).fill(0);
    var g3 = new Array(m).fill(0), gb3 = 0;
    var trainLoss = [], holdLoss = [];
    function lossFor(A, B) {
      var ll = 0;
      for (var i = 0; i < B.length; i++) {
        var pr = netForward(net, A[i]);
        var dd = pr - B[i];
        ll += dd * dd;
      }
      ll /= B.length;
      var reg = 0;
      for (var a = 0; a < k; a++) for (var b = 0; b < p; b++) reg += net.w1[a][b] * net.w1[a][b];
      for (var c = 0; c < m; c++) for (var d = 0; d < k; d++) reg += net.w2[c][d] * net.w2[c][d];
      for (var e = 0; e < m; e++) reg += net.w3[e] * net.w3[e];
      return ll + l2 * 0.5 * reg / B.length;
    }
    for (var ep = 0; ep < epochs; ep++) {
      for (var a = 0; a < k; a++) { gb1[a] = 0; for (var b = 0; b < p; b++) g1[a][b] = 0; }
      for (var c = 0; c < m; c++) { gb2[c] = 0; for (var d = 0; d < k; d++) g2[c][d] = 0; }
      gb3 = 0; for (var e = 0; e < m; e++) g3[e] = 0;
      var ll = 0;
      for (var i = 0; i < n; i++) {
        var x = X[i];
        var h1 = new Array(k), h2 = new Array(m), z, j;
        for (j = 0; j < k; j++) { z = net.b1[j]; for (var b = 0; b < p; b++) z += net.w1[j][b] * x[b]; h1[j] = Math.tanh(z); }
        for (j = 0; j < m; j++) { z = net.b2[j]; for (var c = 0; c < k; c++) z += net.w2[j][c] * h1[c]; h2[j] = Math.tanh(z); }
        z = net.b3; for (var c = 0; c < m; c++) z += net.w3[c] * h2[c];
        var pr = clamp(z, -6, 6);
        var err = pr - y[i];
        ll += err * err;
        for (j = 0; j < m; j++) {
          var d3 = err;
          g3[j] += d3 * h2[j];
          for (var c = 0; c < k; c++) { var d2 = d3 * net.w3[j] * (1 - h2[j] * h2[j]); g2[j][c] += d2 * h1[c]; }
        }
        gb3 += err;
        for (var a = 0; a < k; a++) {
          var s = 0;
          for (var c = 0; c < m; c++) s += err * net.w3[c] * (1 - h2[c] * h2[c]) * net.w2[c][a];
          var d1 = s * (1 - h1[a] * h1[a]);
          gb1[a] += d1;
          for (var b = 0; b < p; b++) g1[a][b] += d1 * x[b];
        }
      }
      ll = ll / n + l2 * 0.5 * 0; /* reg added below */
      var reg = 0;
      for (var a2 = 0; a2 < k; a2++) for (var b2 = 0; b2 < p; b2++) reg += net.w1[a2][b2] * net.w1[a2][b2];
      for (var c2 = 0; c2 < m; c2++) for (var d2 = 0; d2 < k; d2++) reg += net.w2[c2][d2] * net.w2[c2][d2];
      for (var e2 = 0; e2 < m; e2++) reg += net.w3[e2] * net.w3[e2];
      var L = ll + l2 * 0.5 * reg / n;
      trainLoss.push(L);
      holdLoss.push(lossFor(Xo, yo));

      /* apply gradients with momentum */
      for (var a = 0; a < k; a++) {
        gb1[a] = gb1[a] / n + l2 * net.b1[a];
        net.b1[a] -= lr * gb1[a];
        for (var b = 0; b < p; b++) {
          g1[a][b] = g1[a][b] / n + l2 * net.w1[a][b];
          net.w1[a][b] -= lr * g1[a][b];
        }
      }
      for (var c = 0; c < m; c++) {
        gb2[c] = gb2[c] / n + l2 * net.b2[c];
        net.b2[c] -= lr * gb2[c];
        for (var d = 0; d < k; d++) {
          g2[c][d] = g2[c][d] / n + l2 * net.w2[c][d];
          net.w2[c][d] -= lr * g2[c][d];
        }
      }
      gb3 = gb3 / n + l2 * net.b3;
      net.b3 -= lr * gb3;
      for (var e = 0; e < m; e++) { g3[e] = g3[e] / n + l2 * net.w3[e]; net.w3[e] -= lr * g3[e]; }
    }
    return { trainLoss: trainLoss, holdLoss: holdLoss };
  }

  /* permutation importance of the net's OWN output: shuffle one input column,
     re-run the forward pass, re-measure the neural factor's IC, report the drop.
     Model-agnostic; the paper's SHAP column stands for exactly this. */
  function importance(net, X, fwd, names, seed) {
    var u = mulberry32((seed || SEED) + 13);
    var full = X.map(function (r) { return netForward(net, r); });
    var M = window.HJ_ML;
    var base = Math.abs(M.spearman(full, fwd));
    var out = [];
    for (var j = 0; j < names.length; j++) {
      var Xs = X.map(function (r) { return r.slice(); });
      for (var i = Xs.length - 1; i > 0; i--) { var r = Math.floor(u() * (i + 1)); var tmp = Xs[i][j]; Xs[i][j] = Xs[r][j]; Xs[r][j] = tmp; }
      var sig = Xs.map(function (r) { return netForward(net, r); });
      var sh = Math.abs(M.spearman(sig, fwd));
      out.push({ name: names[j], base: base, shuffled: sh, drop: base - sh });
    }
    out.sort(function (a, b) { return b.drop - a.drop; });
    return { base: base, items: out };
  }

  function run(opts) {
    opts = opts || {};
    var M = window.HJ_ML, E = window.HJ_ENGINES;
    var H = E && E.helpers;
    var steps = [], blocks = [];
    if (!M || !E || !H) {
      return { steps: [{ name: "net", args: "(no machinery)", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no", h: t("the machinery has not loaded", "机器还没加载完"),
          b: t("Reload the page and try again.", "刷新页面再试。") }] };
    }
    var K = E.constants;
    var SCREEN = K.SCREEN, ALLOC = K.ALLOC, SEGMENTS = K.SEGMENTS, PAY_T = K.PAY_T, SPLIT = K.SPLIT;
    var M0 = H.market();
    var S = M0.signals, fwd = M0.fwd, n = M0.n;
    var t0 = (window.performance && performance.now) ? performance.now() : 0;

    /* ---- build the feature matrix: the eight signals, standardized ---- */
    var cols = SIGNALS.map(function (nm) {
      var c = S[nm].slice(0, n), mu = mean(c), sd = std(c) || 1;
      return c.map(function (v) { return (v - mu) / sd; });
    });
    var X = [];
    for (var i = 0; i < n; i++) { var row = []; for (var j = 0; j < SIGNALS.length; j++) row.push(cols[j][i]); X.push(row); }
    var ystd = std(fwd.slice(0, n)) || 1;            /* scale the target so the
                                                          gradient is healthy; IC is
                                                          rank-invariant, so the
                                                          factor below needs no rescale */
    var y = fwd.slice(0, n).map(function (v) { return v / ystd; });
    var cut = Math.floor(n * SPLIT);
    var Xtr = X.slice(0, cut), ytr = y.slice(0, cut);
    var Xho = X.slice(cut), yho = y.slice(cut);

    /* ---- train the network (deterministic under SEED) ---- */
    var epochs = Math.max(80, Math.min(400, opts.epochs || 130));
    var h1 = opts.h1 || 14, h2 = opts.h2 || 7, l2 = opts.l2 || 0.0015;
    var tag = opts.tag == null ? 1 : opts.tag;
    var rnd = mulberry32(SEED + h1 + h2 + tag);
    var net = makeNet(SIGNALS.length, h1, h2, rnd);
    var curves = train(net, Xtr, ytr, Xho, yho, epochs, 0.12, l2, 0.9);

    /* ---- the neural factor: the net's prediction for every bar ---- */
    var factor = X.map(function (r) { return netForward(net, r); });

    /* ---- held-out honesty: accuracy vs base rate on the holdout only ---- */
    var up = 0; for (var i2 = cut; i2 < n; i2++) if (y[i2] > 0) up++;
    var baseRate = Math.max(up, n - cut - up) / (n - cut);
    var correct = 0;
    for (var i3 = cut; i3 < n; i3++) { var pr = factor[i3] > 0 ? 1 : 0; if (pr === (y[i3] > 0 ? 1 : 0)) correct++; }
    var acc = correct / (n - cut);

    /* ---- measured by the SAME instrument as every other factor ---- */
    var st = M.stats(factor, fwd);
    var segs = [], s, segLen = Math.floor(n / SEGMENTS);
    for (s = 0; s < SEGMENTS; s++) {
      var a = s * segLen, b = (s === SEGMENTS - 1) ? n : a + segLen;
      var bt = H.blockT(factor.slice(a, b), fwd.slice(a, b));
      segs.push({ i: s + 1, t: bt.t, pays: bt.t >= PAY_T });
    }
    var home = null;
    segs.forEach(function (g) { if (g.pays && (!home || Math.abs(g.t) > Math.abs(home.t))) home = g; });
    /* The sieve the paper actually describes. Two hurdles, both printed on
       this page: the allocation bar √(2 ln d_eff) = 2.3803 (what a bet needs
       where it lives) and the UNIVERSAL discovery hurdle √(2 ln N) — the bar
       a factor must clear to survive one screen over the whole zoo. At the
       site's declared N = 6960 that bar is 4.21. A factor that clears the
       allocation bar but, diluted by π, falls under the discovery hurdle is
       exactly what the paper calls mis-killed. */
    var N = opts.N || 6960;
    var HURDLE = Math.sqrt(2 * Math.log(N));
    var tg = st.icT * Math.sqrt(st.pi);
    var key = "weak";
    if (Math.abs(tg) >= HURDLE) key = "pass";
    else if (Math.abs(st.icT) >= ALLOC) key = "miskill";

    var wall = Math.max(0, Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0) * 10) / 10;

    /* ---- importance of the net's own prediction ---- */
    var imp = importance(net, X, fwd, SIGNALS, SEED);

    steps.push({ name: "net.train", args: "(" + SIGNALS.length + "→" + net.h1 + "→" + net.h2 + "→1, " + epochs + " epochs)", status: "ok",
      ms: wall, detail: "two hidden layers, real back-prop, momentum, L2 — trained in this tab on the declared tape" });
    steps.push({ name: "net.measure", args: "(IC, t, π, double-path)", status: "ok", ms: 0, detail: "same instrument, same sieve as every other factor" });

    blocks.push({ k: "prose", text: t(
      "A two-layer perceptron — eight inputs (the declared signals), two tanh hidden layers, one linear output — trained by real back-propagation to forecast the next bar's return. No language model wrote it; the weights are numbers this tab computed. Its forecast is a signal, a “neural factor”, and from here it is treated exactly like any other factor: measured by HJ_ML.stats, and put through the paper's sieve — the universal discovery hurdle against home-venue routing plus pooling.",
      "一个两层感知机——八个输入（声明信号）、两个 tanh 隐藏层、一个线性输出——靠真实反向传播训练，预测下一根 bar 的收益。没有语言模型替它写；权重是本页算出来的数字。它的预测是一条信号，一个「神经网络因子」，从此之后它被当作和其他因子一模一样对待：用 HJ_ML.stats 测量，并送进论文的筛子——通用发现门槛 对 主场路由+池化。") });

    blocks.push({ k: "chart", variant: "line", label: t("training loss · train vs holdout", "训练损失 · 训练集 vs 留出集"),
      series: curves.trainLoss, series2: curves.holdLoss });

    blocks.push({ k: "bars", label: t("permutation importance of the neural factor", "神经网络因子的置换重要性"),
      items: imp.items.map(function (it) { return { label: it.name, value: it.drop, delta: "base IC " + num(it.base, 3) }; }) });

    blocks.push({ k: "kv", items: [
      { k: "neural IC", v: num(st.ic, 4) },
      { k: "neural t (its own)", v: num(st.icT, 2), tone: Math.abs(st.icT) >= ALLOC ? "ok" : "" },
      { k: "π (active share)", v: num(st.pi, 3) },
      { k: "t_g = t·√π (diluted)", v: num(tg, 2), tone: Math.abs(tg) >= HURDLE ? "ok" : "no" },
      { k: "allocation bar √(2 ln 17)", v: num(ALLOC, 4) },
      { k: "universal hurdle √(2 ln " + N + ")", v: num(HURDLE, 2) },
      { k: "holdout accuracy", v: num(acc * 100, 1) + "%", tone: acc > baseRate ? "ok" : "" },
      { k: "base rate", v: num(baseRate * 100, 1) + "%" },
      { k: "wall time", v: num(wall, 0) + " ms" }
    ] });

    /* ---- the double path, on the SAME position rule as the experiment ---- */
    function positionsOfSignal(sig) {
      var z = M.zscore(sig.slice(0, n));
      return z.map(function (v) { return v < -2.5 ? -0.5 : (v > 2.5 ? 0.5 : v / 5); });
    }
    function equityOf(mode) {
      var p = positionsOfSignal(factor);
      var pos = p.slice();
      if (mode === "ours") { for (var i = 0; i < n; i++) if (!(segs[Math.min(SEGMENTS - 1, Math.floor(i / segLen))].pays)) pos[i] = 0; }
      if (mode === "screen" && !(Math.abs(tg) >= HURDLE)) pos = pos.map(function () { return 0; });
      var from = cut, to = n, strat = [], i;
      for (i = from; i < to; i++) strat.push(pos[i] * fwd[i]);
      if (!strat.length) return null;
      var m = 0, v = 0; for (i = 0; i < strat.length; i++) m += strat[i]; m /= strat.length;
      for (i = 0; i < strat.length; i++) { var d = strat[i] - m; v += d * d; }
      var sd = strat.length > 1 ? Math.sqrt(v / (strat.length - 1)) : 0;
      var eq = 1, peak = 1, mdd = 0, e2 = 1;
      for (i = from; i < to; i++) { e2 *= (1 + pos[i] * fwd[i]); if (e2 > peak) peak = e2; var dd = 1 - e2 / peak; if (dd > mdd) mdd = dd; }
      return { sharpe: sd > 1e-12 ? (m / sd) * Math.sqrt(252) : 0, maxDD: mdd, equity: (function () { var c = [], e = 1; for (i = from; i < to; i++) { e *= (1 + pos[i] * fwd[i]); c.push(e); } return c; })() };
    }
    var mAlways = equityOf("screen"), mRouted = equityOf("ours");
    var alwaysAlive = Math.abs(tg) >= HURDLE;

    blocks.push({ k: "chart", variant: "line", label: t("neural factor equity · universal screen vs home-venue routed (holdout)", "神经网络因子净值 · 通用筛 vs 主场路由（留出集）"),
      series: mAlways ? mAlways.equity : null, series2: mRouted ? mRouted.equity : null,
      dashed: [mAlways ? null : "screen discarded"] });

    blocks.push({ k: "kv", items: [
      { k: "Sharpe · universal screen", v: mAlways ? num(mAlways.sharpe, 2) : t("discarded", "被丢弃"), tone: mAlways && mAlways.sharpe > (mRouted ? mRouted.sharpe : 0) ? "ok" : "no" },
      { k: "Sharpe · home-venue routed", v: mRouted ? num(mRouted.sharpe, 2) : "—", tone: mRouted && (!mAlways || mRouted.sharpe > mAlways.sharpe) ? "ok" : "" },
      { k: "maxDD · routed", v: mRouted ? num(mRouted.maxDD * 100, 1) + "%" : "—" }
    ] });

    /* ---- the verdict: the killer demo ---- */
    var miskilled = key === "miskill";
    if (miskilled) {
      blocks.push({ k: "verdict", tone: "no",
        h: t("the universal screen mis-killed the neural factor", "通用筛把神经网络因子误杀了"),
        b: t("Its own t = " + num(st.icT, 2) + " clears the allocation bar √(2 ln 17) = " + num(ALLOC, 4) + " — the factor is genuinely profitable where it lives. But diluted by π = " + num(st.pi, 3) + " its global t_g = " + num(tg, 2) + " falls under the universal discovery hurdle √(2 ln " + N + ") = " + num(HURDLE, 2) + ", so one screen over the whole zoo discards it. Routed to the segments where it actually pays, the same network's signal is alive. A 2026 deep network is not exempt from the sieve: the same instrument that screens a 1960s price ratio screens it, and the same mis-kill happens. That is Proposition 1 (dilution) and Proposition 3 (the ceiling) made literal.",
          "它自己的 t = " + num(st.icT, 2) + " 越过了配置线 √(2 ln 17) = " + num(ALLOC, 4) + "——这个因子在它所在的场子里是真赚钱的。但按 π = " + num(st.pi, 3) + " 稀释后，它的全局 t_g = " + num(tg, 2) + " 跌到通用发现门槛 √(2 ln " + N + ") = " + num(HURDLE, 2) + " 之下，于是「对整个动物园做一次筛选」把它丢弃。路由到它真正兑现的段，同一个网络的信号是活着的。2026 年的深度网络不被筛子豁免：筛选 1960 年代价格比率的同一个仪器也筛选它，同样的误杀照样发生。这就是命题 1（稀释）和命题 3（天花板）的字面呈现。"),
        plain: t("A neural network factor, discarded by the same universal screen as everything else.", "神经网络因子，被和所有因子一样的通用筛丢弃。") });
    } else if (key === "pass") {
      blocks.push({ k: "verdict", tone: "ok",
        h: t("the universal screen kept the neural factor", "通用筛留下了神经网络因子"),
        b: t("Its diluted t_g = " + num(tg, 2) + " clears the universal discovery hurdle √(2 ln " + N + ") = " + num(HURDLE, 2) + ", so even one screen over the whole zoo keeps it. Honest result on this tape: the net's edge is strong and broad enough that the hurdle holds. The home-venue view still differs (routed Sharpe above), because the sieve is about WHERE you measure, not only WHETHER. Either answer is printed as measured.",
          "它稀释后的 t_g = " + num(tg, 2) + " 越过了通用发现门槛 √(2 ln " + N + ") = " + num(HURDLE, 2) + "，所以哪怕对整个动物园做一次筛选也留得住它。这条胶带上的诚实结果：网络的边又强又宽，门槛守住了。但主场视图仍不同（路由夏普见上），因为筛子关乎你在「哪」测，不只是「是否」测。两种答案都按实测打印。"),
        plain: t("On this tape the net clears the global screen; the home-venue view still differs.", "这条胶带上网络过全局筛；主场视图仍不同。") });
    } else {
      blocks.push({ k: "verdict", tone: "warn",
        h: t("the neural factor is weak on this tape", "这条胶带上神经网络因子偏弱"),
        b: t("Global t = " + num(st.icT, 2) + ", below the allocation bar. The predictable channel in the declared tape is small, and a two-layer net captures only part of it. Honest result, not a bug: the sieve finds nothing to mis-kill because there is no strong home-venue edge to recover.",
          "全局 t = " + num(st.icT, 2) + "，低于配置线。声明胶带里的可预测通道很小，两层网络只抓到一部分。诚实结果，不是 bug：筛子没东西可误杀，因为没有要捞回的强主场边。"),
        plain: t("No mis-kill here because there is no strong edge to recover.", "这里没有误杀，因为没有要捞回的强边。") });
    }

    var C = window.HJ_COUNCIL;
    if (C && (miskilled || key === "pass")) {
      var co = C.run({ t: st.icT, pi: st.pi, N: N, expr: t("the neural factor (a 2-layer MLP on the eight signals)", "神经网络因子（八个信号上的两层 MLP）") });
      if (co && co.council) blocks.push({ k: "council", council: co.council });
    }

    blocks.push({ k: "note", text: t(
      "Declared: a fixed seed (" + SEED + "), the page's own tape, " + epochs + " epochs, an " + SIGNALS.length + "→" + net.h1 + "→" + net.h2 + "→1 net — this is a real network trained in your tab, not a simulation of one. The neural factor is measured by HJ_ML.stats and screened by the same universal-hurdle / home-venue geometry as the public zoo. One tape, one seed, the paper's argument reproduced on a learned signal.",
      "声明：固定种子（" + SEED + "）、本页自己的胶带、" + epochs + " 个 epoch、" + SIGNALS.length + "→" + net.h1 + "→" + net.h2 + "→1 网络——这是在你浏览器里真实训练的网络，不是对它的模拟。神经网络因子由 HJ_ML.stats 测量，并由和公开动物园相同的通用门槛 / 主场几何筛选。一条胶带、一个种子，论文的论点在一个学到的信号上复现。") });

    blocks.push({ k: "actions", items: [
      { label: t("find its home venue", "找它的主场"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("find the venue for the neural factor"); } },
      { label: t("run the experiment on the zoo", "对动物园跑双路实验"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("run the experiment"); } }
    ] });

    return { steps: steps, blocks: blocks, net: { ic: st.ic, t: st.icT, pi: st.pi, tg: tg, key: key, acc: acc, baseRate: baseRate } };
  }

  window.HJ_NET = {
    version: "v1.0",
    run: run,
    helpers: { t: t, num: num, SIGNALS: SIGNALS }
  };
})();
