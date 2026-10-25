/* ==========================================================================
   BOAT · 00b guide — the step-by-step strategy builder
   --------------------------------------------------------------------------
   Six steps, each decided out loud: factor -> signal -> position rule ->
   risk -> home-venue routing -> backtest with the council's verdict. With
   a brain attached the model narrates each step; without one the defaults
   are deterministic and every number is still computed here. The last
   step always shows the contrast the paper is about: the same strategy
   with and without home-venue routing.
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

  var SPLIT = 0.7, SEGMENTS = 4, PAY_T = 1.5, SCREEN = 1.96;
  var state = null;

  var CHOICES = {
    factor: [
      { label: { en: "order-book imbalance (the declared tape's real channel)", zh: "盘口失衡（声明胶带上唯一真实通道）" }, expr: "(BidSize - AskSize) / (BidSize + AskSize)" },
      { label: { en: "20-bar momentum", zh: "20 根动量" }, expr: "Rank(MidPrice - Mean[20](MidPrice))" },
      { label: { en: "short-term reversal", zh: "短期反转" }, expr: "Rank(Mean[5](MidPrice) - MidPrice)" },
      { label: { en: "realized volatility", zh: "已实现波动" }, expr: "Std[20](MidPrice)" }
    ],
    signal: [
      { label: { en: "z-score, clipped ±2.5, ÷2.5 (the page's convention)", zh: "z 分数，裁剪 ±2.5，÷2.5（页面自己的约定）" }, v: "zclip" },
      { label: { en: "raw factor, clipped", zh: "原始因子，裁剪" }, v: "raw" },
      { label: { en: "sign only (±1)", zh: "只取符号（±1）" }, v: "sign" }
    ],
    position: [
      { label: { en: "continuous position", zh: "连续仓位" }, v: "continuous" },
      { label: { en: "binary: full size or flat", zh: "二元：满仓或空仓" }, v: "binary" }
    ],
    risk: [
      { label: { en: "no vol overlay", zh: "无波动叠加" }, v: 0 },
      { label: { en: "10% annual vol target", zh: "10% 年化波动目标" }, v: 0.10 },
      { label: { en: "15% annual vol target", zh: "15% 年化波动目标" }, v: 0.15 },
      { label: { en: "20% annual vol target", zh: "20% 年化波动目标" }, v: 0.20 }
    ],
    routing: [
      { label: { en: "always-on — trade it everywhere", zh: "常开——到处交易" }, v: "always" },
      { label: { en: "home-venue routing — trade it only where it pays (the paper's move)", zh: "主场路由——只在它兑现的地方交易（论文的解法）" }, v: "home" }
    ]
  };

  function ask(text) {
    if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask(text);
  }
  function prefill(text) {
    if (window.BoatAgent && window.BoatAgent.prefill) window.BoatAgent.prefill(text);
  }

  /* ------------------------------------------------ the portfolio builder */
  function positions(sig, n, mode) {
    var M = window.HJ_ML;
    var z = M.zscore(sig.slice(0, n));
    var out = [], i;
    for (i = 0; i < n; i++) {
      var v;
      if (mode === "raw") v = Math.max(-2.5, Math.min(2.5, sig[i])) / 2.5;
      else if (mode === "sign") v = z[i] > 0 ? 1 : (z[i] < 0 ? -1 : 0);
      else v = Math.max(-2.5, Math.min(2.5, z[i])) / 2.5;
      out.push(v);
    }
    return out;
  }

  function runStrategy(routing) {
    var E = window.HJ_ENGINES;
    var M0 = E.helpers.market();
    var fwd = M0.fwd;
    var n = Math.min(fwd.length, 4000);
    var sig = E.helpers.evalExpr(state.expr);
    if (!sig) return null;
    var pos = positions(sig, n, state.signal);
    if (state.position === "binary") pos = pos.map(function (p) { return p > 0 ? 1 : (p < 0 ? -1 : 0); });
    /* vol target calibrated on the train block only */
    var cut = Math.floor(n * SPLIT);
    var trainStrat = [];
    for (var i = 0; i < cut; i++) trainStrat.push(pos[i] * fwd[i]);
    var m = 0, v = 0;
    for (i = 0; i < trainStrat.length; i++) m += trainStrat[i];
    m /= trainStrat.length || 1;
    for (i = 0; i < trainStrat.length; i++) { var d = trainStrat[i] - m; v += d * d; }
    var trainVol = trainStrat.length > 1 ? Math.sqrt(v / (trainStrat.length - 1)) * Math.sqrt(252) : 0;
    var scale = (state.vol > 0 && trainVol > 1e-9) ? Math.min(2, state.vol / trainVol) : 1;
    pos = pos.map(function (p) { return p * scale; });
    /* home-venue mask from the same declared policy as venue.find */
    var segLen = Math.floor(n / SEGMENTS);
    if (routing === "home") {
      var mask = [];
      for (var s = 0; s < SEGMENTS; s++) {
        var a = s * segLen, b = (s === SEGMENTS - 1) ? n : a + segLen;
        var bt = E.helpers.blockT(sig.slice(a, b), fwd.slice(a, b));
        for (i = a; i < b; i++) mask.push(bt.t >= PAY_T);
      }
      for (i = 0; i < n; i++) if (!mask[i]) pos[i] = 0;
    }
    function metrics(from, to) {
      var strat = [], e2 = 1, peak = 1, mdd = 0, mm = 0, vv = 0;
      for (i = from; i < to; i++) strat.push(pos[i] * fwd[i]);
      if (!strat.length) return null;
      for (i = 0; i < strat.length; i++) mm += strat[i];
      mm /= strat.length;
      for (i = 0; i < strat.length; i++) { var dd = strat[i] - mm; vv += dd * dd; }
      var sd = strat.length > 1 ? Math.sqrt(vv / (strat.length - 1)) : 0;
      var eq = [], turn = 0;
      for (i = from; i < to; i++) {
        e2 *= (1 + pos[i] * fwd[i]);
        if (e2 > peak) peak = e2;
        var ddd = 1 - e2 / peak;
        if (ddd > mdd) mdd = ddd;
        eq.push(e2);
      }
      for (i = Math.max(from, 1); i < to; i++) turn += Math.abs(pos[i] - pos[i - 1]);
      turn = to - from > 1 ? turn / (to - from - 1) : 0;
      var hit = 0;
      for (i = from; i < to; i++) if ((pos[i] > 0 ? 1 : -1) === (fwd[i] > 0 ? 1 : -1)) hit++;
      return { sharpe: sd > 1e-12 ? (mm / sd) * Math.sqrt(252) : 0, maxDD: mdd, turnover: turn, hit: hit / strat.length, equity: eq };
    }
    return { trainVol: trainVol, scale: scale, oos: metrics(cut, n), is: metrics(0, cut) };
  }

  /* --------------------------------------------------------- the six steps */
  function start(slots) {
    state = {
      step: 0,
      expr: (slots && slots.expr) || CHOICES.factor[0].expr,
      signal: "zclip", position: "continuous", vol: 0.15, routing: "home"
    };
    return renderStep();
  }

  function answer(choice) {
    if (!state) return start({});
    var s = state.step;
    if (s === 0) state.expr = choice;
    else if (s === 1) state.signal = choice;
    else if (s === 2) state.position = choice;
    else if (s === 3) state.vol = choice;
    else if (s === 4) state.routing = choice;
    state.step = Math.min(5, s + 1);
    return renderStep();
  }

  function renderStep() {
    var steps = [], blocks = [];
    var heads = [
      { en: "Step 1 of 6 · the factor", zh: "第 1 / 6 步 · 选因子" },
      { en: "Step 2 of 6 · the signal", zh: "第 2 / 6 步 · 信号处理" },
      { en: "Step 3 of 6 · the position rule", zh: "第 3 / 6 步 · 仓位规则" },
      { en: "Step 4 of 6 · risk", zh: "第 4 / 6 步 · 风控" },
      { en: "Step 5 of 6 · routing", zh: "第 5 / 6 步 · 路由" },
      { en: "Step 6 of 6 · the backtest", zh: "第 6 / 6 步 · 回测" }
    ];
    var s = state.step;

    if (s < 5) {
      var keys = ["factor", "signal", "position", "risk", "routing"];
      var key = keys[s];
      steps.push({ name: "guide.step", args: "(" + (s + 1) + "/6 · " + key + ")", status: "ok" });
      blocks.push({ k: "prose", text: t(
        heads[s].en + ". Every choice is declared before it runs — the defaults are the page's own conventions, and nothing here is fitted.",
        heads[s].zh + "。每个选择先声明再运行——默认值就是页面自己的约定，这里没有任何拟合。") });
      blocks.push({ k: "kv", items: [
        { k: "factor", v: state.expr },
        { k: "signal", v: state.signal },
        { k: "position", v: state.position },
        { k: "vol target", v: state.vol ? num(state.vol * 100, 0) + "%" : "none" },
        { k: "routing", v: state.routing }
      ] });
      blocks.push({ k: "actions", items: CHOICES[key].map(function (c) {
        return { label: t(c.label.en, c.label.zh), fn: function () { window.BoatAgent.render(answer(key === "factor" ? c.expr : c.v)); } };
      }).concat([{ label: t("use my own factor — paste it", "用我自己的因子——粘贴它"), fn: function () {
        prefill("guide with my own factor: ");
      } }]) });
      return { steps: steps, blocks: blocks };
    }

    /* step 6: the run, with the contrast the paper is about */
    var home = runStrategy("home");
    var always = runStrategy("always");
    steps.push({ name: "guide.backtest", args: "(both routings, holdout)", status: "ok" });
    blocks.push({ k: "prose", text: t(
      "The strategy you built: " + state.expr + " · signal " + state.signal + " · position " + state.position +
      " · vol target " + (state.vol ? num(state.vol * 100, 0) + "%" : "none") +
      ". Below: the same strategy with and without home-venue routing — the paper's move, measured on this tape.",
      "你构建的策略：" + state.expr + " · 信号 " + state.signal + " · 仓位 " + state.position +
      " · 波动目标 " + (state.vol ? num(state.vol * 100, 0) + "%" : "无") +
      "。下面：同一个策略，开与不开主场路由——论文的解法，在这条胶带上实测。") });
    blocks.push({ k: "kv", items: [
      { k: "train vol (ann)", v: home ? num(home.trainVol * 100, 1) + "%" : "—" },
      { k: "vol scale", v: home ? "×" + num(home.scale, 3) : "—" },
      { k: "Sharpe OOS · always-on", v: always && always.oos ? num(always.oos.sharpe, 2) : "—" },
      { k: "Sharpe OOS · home-routed", v: home && home.oos ? num(home.oos.sharpe, 2) : "—", tone: home && always && home.oos.sharpe > always.oos.sharpe ? "ok" : "" },
      { k: "max DD · home-routed", v: home && home.oos ? num(home.oos.maxDD * 100, 1) + "%" : "—" },
      { k: "turnover · home-routed", v: home && home.oos ? num(home.oos.turnover, 3) : "—" }
    ] });
    function dec(arr) {
      var k = Math.max(1, Math.floor(arr.length / 240));
      var out = [];
      for (var q = 0; q < arr.length; q += k) out.push(arr[q]);
      if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
      return out;
    }
    if (always && always.oos) blocks.push({ k: "chart", variant: "line", log: true,
      label: t("equity · always-on (holdout)", "净值 · 常开（留出集）"), series: dec(always.oos.equity) });
    if (home && home.oos) blocks.push({ k: "chart", variant: "line", log: true,
      label: t("equity · home-venue routed (holdout)", "净值 · 主场路由（留出集）"), series: dec(home.oos.equity) });
    var aS = (always && always.oos) ? always.oos.sharpe : null;
    var hS = (home && home.oos) ? home.oos.sharpe : null;
    var ours = aS != null && hS != null && hS > aS;
    blocks.push({ k: "verdict",
      tone: ours ? "ok" : (aS == null && hS == null ? "no" : "warn"),
      h: (aS == null && hS == null)
        ? t("the factor could not be evaluated", "这个因子无法求值")
        : ours ? t("routing home beats always-on on this tape", "本胶带上主场路由胜过常开")
        : t("always-on wins on this tape", "本胶带上常开更强"),
      b: (aS == null && hS == null)
        ? t("The grammar rejected the expression, so there is no strategy to backtest. Fix the factor and run the guide again.",
          "文法不接受这个表达式，没有可回测的策略。修好因子再跑一次向导。")
        : t("Holdout Sharpe " + num(aS, 2) + " always-on versus " + num(hS, 2) +
        " home-routed. Either answer is printed as measured — the paper's resolution law is a claim about pools with home-venue factors.",
        "留出集 Sharpe：常开 " + num(aS, 2) + " versus 主场路由 " + num(hS, 2) +
        "。两种答案都按实测印出——论文的解法定律是关于含有主场因子的池子的断言。"),
      plain: (aS == null && hS == null) ? t("This factor does not parse — nothing to backtest.", "这个因子无法解析——无可回测。")
        : ours ? t("Trading it only where it pays beat trading it everywhere.", "只在兑现处交易，胜过到处交易。")
        : t("On this tape, everywhere was simply better.", "在这条胶带上，到处交易反而更好。") });
    var co = window.HJ_COUNCIL.run({ expr: state.expr });
    blocks.push({ k: "council", council: co.council });
    blocks.push({ k: "note", text: t(
      "Declared: positions from the z-scored factor (a transform, not a fit); vol target calibrated on the train block only, scale capped ×2; " +
      "home mask from " + SEGMENTS + " segments paying at block t ≥ " + PAY_T + "; both routings scored on the same " +
      Math.round(SPLIT * 100) + "/" + Math.round((1 - SPLIT) * 100) + " split, holdout only. One tape, one seed. A backtest is a backtest.",
      "声明：仓位来自 z 分数化的因子（变换非拟合）；波动目标只在训练段校准，缩放上限 ×2；主场掩码来自 " + SEGMENTS +
      " 个段、段 t ≥ " + PAY_T + " 记为兑现；两种路由同一套 " + Math.round(SPLIT * 100) + "/" + Math.round((1 - SPLIT) * 100) +
      " 分割，只报留出集。一条胶带、一个种子。回测就是回测。") });
    blocks.push({ k: "actions", items: [
      { label: t("build another strategy", "再建一个策略"), fn: function () { window.BoatAgent.render(start({})); } },
      { label: t("run the zoo experiment", "跑动物园实验"), fn: function () { ask("run the experiment"); } },
      { label: t("open the bench", "打开解剖台"), fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.focus("series"); } }
    ] });
    return { steps: steps, blocks: blocks };
  }

  window.HJ_GUIDE = {
    version: "v1.0",
    start: start,
    answer: answer,
    state: function () { return state; }
  };
})();
