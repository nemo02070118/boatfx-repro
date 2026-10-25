/* ==========================================================================
   BOAT-3 · 00b evolve — a genetic factor factory over the legal grammar
   --------------------------------------------------------------------------
   A language model asked to write factors writes Close-Close[1] and MACD,
   which the grammar rejects. The honest generator is a search: a population
   of legal expressions, each one compiled by the gate and scored on the
   declared tape, bred by crossover and mutation for a few generations.

   The genome is deliberately simple — two rolling operators, two windows,
   two signals and one binary operator — so EVERY individual is legal by
   construction, and the gate still parses it before it is scored. What
   evolves is the choice, not the syntax.
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

  var ROLL = ["Mean", "Std", "Zscore", "Rank", "Slope"];
  var WIN = [5, 10, 20, 60];
  var SIG = ["MidPrice", "BestBid", "BestAsk", "BidSize", "AskSize", "Volume", "TradeSize", "TradeSide"];
  var BIN = ["-", "+", "*", "/"];

  /* genome: [roll1, win1, roll2, win2, sigA, sigB, bin] — always legal */
  function randGenome(rnd) {
    return [
      ROLL[Math.floor(rnd() * ROLL.length)], WIN[Math.floor(rnd() * WIN.length)],
      ROLL[Math.floor(rnd() * ROLL.length)], WIN[Math.floor(rnd() * WIN.length)],
      SIG[Math.floor(rnd() * SIG.length)], SIG[Math.floor(rnd() * SIG.length)],
      BIN[Math.floor(rnd() * BIN.length)]
    ];
  }
  function render(g) {
    return g[0] + "[" + g[1] + "](" + g[2] + "[" + g[3] + "](" + g[4] + ") " + g[6] + " " + g[5] + ")";
  }
  function crossover(a, b, rnd) {
    var cut = 1 + Math.floor(rnd() * 5);   /* 1..5 genes from a */
    return a.slice(0, cut).concat(b.slice(cut));
  }
  function mutate(g, rnd) {
    var h = g.slice();
    var k = Math.floor(rnd() * 7);
    if (k === 0) h[0] = ROLL[Math.floor(rnd() * ROLL.length)];
    else if (k === 1) h[1] = WIN[Math.floor(rnd() * WIN.length)];
    else if (k === 2) h[2] = ROLL[Math.floor(rnd() * ROLL.length)];
    else if (k === 3) h[3] = WIN[Math.floor(rnd() * WIN.length)];
    else if (k === 4) h[4] = SIG[Math.floor(rnd() * SIG.length)];
    else if (k === 5) h[5] = SIG[Math.floor(rnd() * SIG.length)];
    else h[6] = BIN[Math.floor(rnd() * BIN.length)];
    return h;
  }

  function run(opts) {
    opts = opts || {};
    var E = window.HJ_ENGINES, M = window.HJ_ML, G = window.HJ_GATE, C = window.HJ_COUNCIL;
    var steps = [], blocks = [];
    if (!E || !M || !G) {
      return { steps: [{ name: "evolve", args: "(no machinery)", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no", h: t("the machinery has not loaded", "机器还没加载完"),
          b: t("Reload the page and try again.", "刷新页面再试。") }] };
    }
    var gens = Math.max(1, Math.min(8, opts.generations || 5));
    var pop = Math.max(20, Math.min(120, opts.pop || 60));
    var rnd = mulberry32(SEED + gens * 31 + pop);
    var M0 = E.helpers.market();
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var evals = 0;

    function score(g) {
      var expr = render(g);
      try { G.parse(expr); } catch (e) { return null; }        /* the gate still decides */
      var sig = E.helpers.evalExpr(expr);
      if (!sig) return null;
      evals++;
      var st = M.stats(sig, M0.fwd);
      if (!st || !isFinite(st.icT)) return null;
      return { g: g, expr: expr, ic: st.ic, t: st.icT, pi: st.pi, key: st.key };
    }

    /* generation 0 */
    var pool = [];
    while (pool.length < pop) {
      var s0 = score(randGenome(rnd));
      if (s0) pool.push(s0);
      if (evals > 900) break;
    }
    pool.sort(function (a, b) { return Math.abs(b.t) - Math.abs(a.t); });

    var curve = [Math.abs(pool.length ? pool[0].t : 0)];
    var perGen = [{ gen: 0, best: pool[0] }];
    for (var gen = 1; gen <= gens; gen++) {
      var keep = pool.slice(0, Math.max(2, Math.floor(pool.length * 0.4)));
      var next = keep.slice();
      while (next.length < pop && evals < 900) {
        var pa = keep[Math.floor(rnd() * keep.length)], pb = keep[Math.floor(rnd() * keep.length)];
        var child = crossover(pa.g, pb.g, rnd);
        if (rnd() < 0.35) child = mutate(child, rnd);
        var sc = score(child);
        if (sc) next.push(sc);
      }
      next.sort(function (a, b) { return Math.abs(b.t) - Math.abs(a.t); });
      pool = next;
      curve.push(Math.abs(pool.length ? pool[0].t : 0));
      perGen.push({ gen: gen, best: pool[0] });
      if ((performance.now() - t0) > 4000) break;             /* the time budget is declared */
    }
    var best = pool[0] || null;
    var wall = Math.max(0, Math.round(((window.performance && performance.now) ? performance.now() : 0) - t0) * 10) / 10;

    /* the honest yardstick: the builtin zoo's median |t| */
    var zooT = [];
    try {
      (window.HJ_ZOO.builtin || []).forEach(function (f) {
        var m = window.HJ_ZOO.measureOne(f);
        if (m && !m.err) zooT.push(Math.abs(m.t));
      });
    } catch (e) {}
    zooT.sort(function (a, b) { return a - b; });
    var zooMed = zooT.length ? zooT[Math.floor(zooT.length / 2)] : null;

    steps.push({ name: "evolve.run", args: "(" + gens + " gens × " + pop + " pop)", status: best ? "ok" : "fail",
      ms: wall, detail: evals + " legal expressions evaluated · every one parsed by the gate" });

    blocks.push({ k: "prose", text: t(
      "A genetic search over the site's legal grammar — not a language model's guesses. Generation 0 is random, each generation keeps the top 40% by |t| and breeds the rest by crossover and mutation, and the gate parses every candidate before it is scored. The grammar decides what is legal; the search only chooses.",
      "在站点合法文法上跑遗传搜索——不是语言模型的猜测。第 0 代随机生成，每一代按 |t| 保留前 40%、其余由交叉变异繁育，每个候选都先过闸门文法才计分。文法决定什么合法，搜索只做选择。") });

    blocks.push({ k: "chart", variant: "line", label: t("best |t| by generation", "每代最佳 |t|"), series: curve });

    blocks.push({ k: "table",
      head: [{ t: "gen" }, { t: "expression" }, { t: "IC", num: true }, { t: "t", num: true }, { t: "verdict" }],
      rows: perGen.map(function (p) {
        return [
          { t: String(p.gen) },
          { t: p.best ? p.best.expr : "—" },
          { t: p.best ? num(p.best.ic, 4) : "—", num: true },
          { t: p.best ? num(p.best.t, 2) : "—", num: true },
          { t: p.best ? (p.best.key === "miskill" ? t("mis-killed", "误杀") : p.best.key === "weak" ? t("weak", "偏弱") : t("pass", "过筛")) : "—",
            tone: p.best && p.best.key === "miskill" ? "no" : (p.best && p.best.key === "weak" ? "" : "ok") }
        ];
      }) });

    blocks.push({ k: "kv", items: [
      { k: "generations", v: String(perGen.length - 1) },
      { k: "population", v: String(pop) },
      { k: "expressions evaluated", v: String(evals) },
      { k: "wall time", v: num(wall, 0) + " ms" },
      { k: "builtin zoo median |t|", v: zooMed == null ? "—" : num(zooMed, 2) }
    ] });

    if (best) {
      var beats = zooMed != null && Math.abs(best.t) > zooMed;
      blocks.push({ k: "verdict",
        tone: beats ? "ok" : "warn",
        h: beats
          ? t("the search beats the public zoo: |t| = " + num(Math.abs(best.t), 2) + " versus median " + num(zooMed, 2),
              "搜索赢了公开动物园：|t| = " + num(Math.abs(best.t), 2) + "，中位数 " + num(zooMed, 2))
          : t("the search's best is |t| = " + num(Math.abs(best.t), 2) + " — the public zoo's median is " + (zooMed == null ? "—" : num(zooMed, 2)),
              "搜索最佳 |t| = " + num(Math.abs(best.t), 2) + "——公开动物园中位数 " + (zooMed == null ? "—" : num(zooMed, 2))),
        b: t("Winner: " + best.expr + " — IC " + num(best.ic, 4) + ", t " + num(best.t, 2) + ", pi " + num(best.pi, 2) +
          ". " + (beats ? "A search over a declared grammar beats a curated library on this tape; that is a statement about the search and this tape, not about the market."
            : "On this tape the curated library still holds up — the search found nothing the published factors had missed."),
          "胜者：" + best.expr + " —— IC " + num(best.ic, 4) + "，t " + num(best.t, 2) + "，π " + num(best.pi, 2) +
          "。" + (beats ? "在声明文法上的搜索赢了精选库；这是关于这条胶带和这个搜索的陈述，不是关于市场的。"
            : "在这条胶带上精选库守住了——搜索没找到已发表因子漏掉的东西。")),
        plain: beats
          ? t("The machine found a stronger expression than the published zoo, on this tape.", "在这条胶带上，机器找到了比已发表动物园更强的表达式。")
          : t("The published zoo is not accidentally strong.", "已发表的动物园不是偶然强的。") });
      var co = C ? C.run({ expr: best.expr }) : null;
      if (co && co.council) blocks.push({ k: "council", council: co.council });
    }

    blocks.push({ k: "note", text: t(
      "Declared: a fixed seed (" + SEED + "), the declared tape, " + evals + " evaluations, a " +
      "two-rolling-op family — this is a search inside a declared grammar, not a claim about all factor spaces. One tape, one seed, a mechanism reproduction.",
      "声明：固定种子（" + SEED + "）、声明胶带、" + evals + " 次评估、双滚动算子族——这是在声明文法内部的搜索，不是关于全部因子空间的断言。一条胶带、一个种子，是机制复现。") });

    blocks.push({ k: "actions", items: [
      { label: t("build a strategy on the winner", "以胜者建策略"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask && best) window.BoatAgent.ask("build a strategy on " + best.expr);
      } },
      { label: t("run the experiment on the zoo", "对动物园跑双路实验"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("run the experiment");
      } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  window.HJ_EVOLVE = {
    version: "v1.0",
    run: run,
    render: render,
    helpers: { t: t, num: num }
  };
})();
