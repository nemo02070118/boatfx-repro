/* ==========================================================================
   BOAT-3 · 00b paper — the paper's four propositions, as instruments
   --------------------------------------------------------------------------
   "Discarded but Alive: What Factor Screening Throws Away, and What It
   Cannot Recover" (SSRN 7607684). Every instrument on this page already
   runs on the paper's logic; this module makes the logic itself callable:

     P1  dilution       t_g = t * sqrt(pi)      — why the screen misses it
     P2  allocation     t >= sqrt(2 ln N)       — the discovery wall
     P3  ceiling        q2(tau) = tau / (1+tau) — how much is recoverable
     P4  pooling        pooled t = mean(t)*sqrt(n) — the group test

   The ceiling is the honest half of the paper: the correction cannot
   recover everything, and at half-recovery it stops paying (m* ~ 1.3).
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

  var ALLOC = Math.sqrt(2 * Math.log(17)), SCREEN = 1.96;
  var CITE = "SSRN 7607684 · ORCID 0009-0006-9124-9152";

  var PROPS = [
    { id: "P1", name: { en: "dilution", zh: "稀释" },
      formula: "t_g = t · √π",
      claim: { en: "A factor that pays only in part of the tape is diluted by √π before the screen sees it — so a strong conditional edge can be invisible to a universal |t| test.",
        zh: "只在部分胶带上兑现的因子，在筛子看见它之前先被 √π 稀释——所以很强的条件边缘也可能对一个通用 |t| 检验完全不可见。" },
      where: { en: "every measurement (π, diluted t), the workbench, the what-if engine",
        zh: "每次测量（π、稀释 t）、工作台、反事实引擎" } },
    { id: "P2", name: { en: "allocation", zh: "配置线" },
      formula: "t ≥ √(2 ln N)",
      claim: { en: "Testing N candidates raises the bar for any one of them: the discovery wall grows as √(2 ln N). The screen's 1.96 is below the wall for any real N.",
        zh: "检验 N 个候选会把其中任何一个的门槛抬高：发现之墙按 √(2 ln N) 增长。对任何真实的 N，筛线的 1.96 都低于这堵墙。" },
      where: { en: "the hurdle instrument, the gate's receipt, the zoo",
        zh: "发现之墙仪器、闸门回执、动物园" } },
    { id: "P3", name: { en: "ceiling", zh: "上限" },
      formula: "q²(τ) = τ / (1 + τ)",
      claim: { en: "The correction has a ceiling: the recoverable share of the discarded edge is q²(τ) = τ/(1+τ). Half-recovery arrives at m* ≈ 1.3 — beyond it, reallocation stops paying for itself.",
        zh: "修正有上限：被丢弃边缘中可回收的份额是 q²(τ) = τ/(1+τ)。半回收出现在 m* ≈ 1.3——再往前，再分配就不划算。" },
      where: { en: "the ceiling instrument (this module), every pooling verdict",
        zh: "上限仪器（本模块）、每次池化裁决" } },
    { id: "P4", name: { en: "pooling", zh: "池化" },
      formula: "pooled t = mean(t) · √n",
      claim: { en: "Judged one by one the discards fail; judged together they can clear the screen — Stouffer pooling is the group test the universal screen never runs.",
        zh: "一个一个审，废弃者全都不合格；放在一起审，它们能过筛——Stouffer 池化是通用筛从不做的那次组检验。" },
      where: { en: "the workbench, the experiment, the resurrection bench, the council",
        zh: "工作台、实验、复活台、议会" } }
  ];

  /* the ceiling curve, sampled for the chart */
  function curve(n) {
    n = n || 40;
    var out = [];
    for (var i = 1; i <= n; i++) {
      var tau = i / n;
      out.push(tau / (1 + tau));
    }
    return out;
  }

  function ceiling(tau) {
    if (tau == null || !isFinite(tau) || tau <= 0) tau = 0.25;
    if (tau > 1) tau = 1;
    var q2 = tau / (1 + tau);
    return { tau: tau, q2: q2, recoverable: q2, mStar: 1.3 };
  }

  /* the ceiling instrument — the paper's honest half, as a device */
  function ceilingRun(slots) {
    slots = slots || {};
    var E = window.HJ_ENGINES;
    var steps = [], blocks = [];
    var tau = slots.tau != null && isFinite(slots.tau) ? slots.tau : null;
    var expr = slots.expr || null;
    var measured = null;
    if (expr && E && window.HJ_ML) {
      var sig = E.helpers.evalExpr(expr);
      if (sig) {
        var M0 = E.helpers.market();
        var st = window.HJ_ML.stats(sig, M0.fwd);
        measured = st;
        if (tau == null) tau = st.pi;
      }
    }
    var c = ceiling(tau);
    steps.push({ name: "paper.ceiling", args: "(τ = " + num(c.tau, 3) + ")", status: "ok",
      detail: expr ? "τ measured on the declared tape" : "τ taken from the input" });

    blocks.push({ k: "prose", text: t(
      "The paper's third proposition is the honest one: the correction has a ceiling. If a factor pays in a share τ of the tape, the recoverable part of the discarded edge is q²(τ) = τ/(1+τ) — never all of it. At your τ, that ceiling is " + num(c.q2 * 100, 1) + "%.",
      "论文的第三个命题是诚实的那一半：修正有上限。如果一个因子只在胶带的 τ 比例上兑现，被丢弃边缘中可回收的部分是 q²(τ) = τ/(1+τ)——永远不是全部。按你的 τ，这个上限是 " + num(c.q2 * 100, 1) + "%。") });

    blocks.push({ k: "chart", variant: "line", label: "q²(τ) = τ/(1+τ)", series: curve(40) });

    blocks.push({ k: "kv", items: [
      { k: "τ (paying share)", v: num(c.tau, 3) + (measured ? " · " + t("measured here", "本页实测") : "") },
      { k: "q²(τ) — the ceiling", v: num(c.q2 * 100, 1) + "%", tone: "ok" },
      { k: "half-recovery", v: "m* ≈ " + num(c.mStar, 1) + " — " + t("the paper's stated point", "论文给出的点") },
      { k: "what it means", v: t("at most " + num(c.q2 * 100, 1) + "% of the discarded edge is recoverable; the rest is gone",
        "被丢弃的边缘最多可回收 " + num(c.q2 * 100, 1) + "%，其余就是没了") }
    ] });

    if (measured) {
      blocks.push({ k: "kv", items: [
        { k: "this factor's t", v: num(measured.icT, 2) },
        { k: "diluted t = t·√τ", v: num(measured.dilutedT, 2), tone: Math.abs(measured.dilutedT) >= SCREEN ? "ok" : "no" },
        { k: "screen", v: Math.abs(measured.dilutedT) >= SCREEN ? t("passes", "过筛") : t("killed", "被杀") }
      ] });
    }

    blocks.push({ k: "verdict", tone: "warn",
      h: t("the ceiling at τ = " + num(c.tau, 2) + " is " + num(c.q2 * 100, 1) + "% — that is the honest bound",
          "τ = " + num(c.tau, 2) + " 时的上限是 " + num(c.q2 * 100, 1) + "%——这就是诚实的边界"),
      b: t("Half-recovery arrives at m* ≈ 1.3: past that point the reallocation stops paying for itself. This is the part of the paper that keeps the rest of it credible — a correction that claimed to recover everything would be a sales pitch.",
        "半回收出现在 m* ≈ 1.3：过了这个点，再分配就不划算。这是论文里让其余部分可信的那一块——一个声称能全部回收的修正只会是推销话术。"),
      plain: t("You can recover part of what the screen threw away — never all of it.", "筛子扔掉的东西，你能捞回一部分——永远不是全部。") });

    blocks.push({ k: "note", text: t(
      "Source: the paper's proposition 3, " + CITE + ". The curve above is the law itself; the τ is measured on this page's declared tape when a factor is given. One tape, one seed — a mechanism reproduction, not a market conclusion.",
      "来源：论文命题 3，" + CITE + "。上图就是这条定律本身；给定因子时，τ 在本页声明胶带上实测。一条胶带、一个种子——是机制复现，不是市场结论。") });

    blocks.push({ k: "actions", items: [
      { label: t("run the what-if engine", "跑反事实引擎"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("what if pi = 0.1");
      } },
      { label: t("measure a factor's π first", "先测一个因子的 π"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("evaluate Rank(Mean[10](BestAsk - BestBid) / MidPrice)");
      } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* the four propositions, listed — the paper's skeleton as a card */
  function propsRun() {
    var blocks = [];
    blocks.push({ k: "prose", text: t(
      "The paper, as four propositions. Every instrument on this page runs on at least one of them — the mapping is printed so you can check it yourself.",
      "论文就是四个命题。本页每件仪器都跑在其中至少一个之上——映射印在下面，你可以自己核对。") });
    blocks.push({ k: "table",
      head: [{ t: "prop" }, { t: "name" }, { t: "formula" }, { t: "where it runs here" }],
      rows: PROPS.map(function (p) {
        return [{ t: p.id }, { t: p.name.en + " · " + p.name.zh }, { t: p.formula }, { t: p.where.en }];
      }) });
    blocks.push({ k: "note", text: t(
      "Source: “Discarded but Alive: What Factor Screening Throws Away, and What It Cannot Recover”, " + CITE +
      ". The paper's real-world anchors (179 anomalies; 94 rejected in large caps earning OOS Sharpe 0.85 as-is and 1.30 reallocated, FF6 α 3.8%/yr, t = 8.3; China +0.95, p = 0) are the paper's numbers, not this tape's.",
      "来源：《Discarded but Alive: What Factor Screening Throws Away, and What It Cannot Recover》，" + CITE +
      "。论文的真实世界锚点（179 个异象；94 个在大盘被拒，原样 OOS Sharpe 0.85、重新分配后 1.30，FF6 α 3.8%/年，t = 8.3；中国复现 +0.95，p = 0）是论文的数字，不是这条胶带的。") });
    return { steps: [{ name: "paper.props", args: "(4)", status: "ok" }], blocks: blocks };
  }

  window.HJ_PAPER = {
    version: "v1.0",
    props: PROPS,
    ceiling: ceiling,
    curve: curve,
    ceilingRun: ceilingRun,
    propsRun: propsRun,
    cite: CITE
  };
})();
