/* ==========================================================================
   BOAT-2 · 00b workbench — your factors, measured by this site's machinery
   --------------------------------------------------------------------------
   One box. Paste or drop your own factor library — "name, t" rows,
   "name :: formula" rows, bare expressions, or your strategy's Sharpe —
   and this module runs the same machinery the rest of the page runs:
   every factor measured on the declared tape, then the double path —
   the universal |t| < 1.96 screen against home-venue routing plus
   Stouffer pooling of the mis-killed.

   The verdict is written the way the author asked for it: when our way
   wins, it leads with the multiple ("our method's holdout Sharpe is N x
   the universal screen's"); when it loses, it says so just as plainly.
   The numbers are the numbers — aggression lives in the sentence, never
   in the arithmetic.
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

  /* ------------------------------------------------------------- detect */
  function detect(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); })
      .filter(function (l) { return l && l.charAt(0) !== "#"; });
    if (!lines.length) return { kind: "empty" };
    var formulas = [], tstats = [], bare = [], strategy = null;
    lines.forEach(function (ln) {
      if (/sharpe/i.test(ln) && /=/.test(ln)) {
        strategy = strategy || {};
        var sm = /sharpe\s*[=:]\s*(-?\d+(?:\.\d+)?)/i.exec(ln);
        var dm = /(maxdd|drawdown|回撤)\s*[=:]\s*(-?\d+(?:\.\d+)?)/i.exec(ln);
        var tm = /turnover\s*[=:]\s*(-?\d+(?:\.\d+)?)/i.exec(ln);
        if (sm) strategy.sharpe = parseFloat(sm[1]);
        if (dm) strategy.maxDD = parseFloat(dm[2]);
        if (tm) strategy.turnover = parseFloat(tm[1]);
        var em = /([A-Za-z][\w\[\]().*/+-]*\([^)]*\))/.exec(ln);
        if (em) strategy.expr = em[1];
        return;
      }
      if (ln.indexOf("::") >= 0) {
        var p = ln.split("::");
        formulas.push({ name: p[0].trim(), expr: p.slice(1).join("::").trim() });
        return;
      }
      /* tab (an Excel copy), colon, or whitespace separated; a header row
         ("name, t") simply fails the numeric test and is ignored */
      var sep = null;
      if (ln.indexOf("\t") >= 0) sep = ln.split("\t");
      else if (/[:：]\s*-?\d/.test(ln)) sep = ln.split(/[:：]/);
      else {
        var m2 = /^(.+?)\s+(-?\d+(?:\.\d+)?)(?:\s+(\d*\.?\d+))?$/.exec(ln);
        if (m2) sep = [m2[1], m2[2], m2[3]];
      }
      if (sep) {
        var s1 = sep[1] != null ? sep[1].trim() : "";
        if (/^-?\d+(\.\d+)?$/.test(s1)) {
          tstats.push({ name: sep[0].trim(), t: parseFloat(s1),
            pi: sep[2] != null && /^\d*\.?\d+$/.test(sep[2].trim()) ? parseFloat(sep[2]) : 0.25 });
          return;
        }
      }
      var c = ln.split(",");
      if (c.length >= 2 && /^-?\d+(\.\d+)?$/.test(c[1].trim())) {
        tstats.push({ name: c[0].trim(), t: parseFloat(c[1]), pi: c[2] != null && /^\d/.test(c[2].trim()) ? parseFloat(c[2]) : 0.25 });
        return;
      }
      if (/[A-Za-z]\s*\(/.test(ln) && /[A-Za-z]/.test(ln)) {
        bare.push({ name: "f" + (bare.length + 1), expr: ln });
        return;
      }
      /* "name, formula" where the formula has parens */
      if (c.length >= 2 && /[A-Za-z]\s*\(/.test(c.slice(1).join(","))) {
        formulas.push({ name: c[0].trim(), expr: c.slice(1).join(",").trim() });
      }
    });
    if (formulas.length) return { kind: "formulas", rows: formulas };
    if (bare.length) return { kind: "formulas", rows: bare };
    if (tstats.length) return { kind: "tstats", rows: tstats };
    if (strategy) return { kind: "strategy", strategy: strategy };
    return { kind: "none" };
  }

  /* ------------------------------------------------------------- verdict */
  function aggressive(sharpeA, sharpeB) {
    if (sharpeA == null || sharpeB == null) {
      return { tone: "warn", h: t("the double path could not be scored", "双路无法打分"),
        b: t("One of the two portfolios came back empty — the library may be too small to build both.", "两条组合之一为空——库可能太小，两条路都建不起来。"),
        plain: t("No comparison without two portfolios.", "没有两条组合就没有对比。") };
    }
    var wins = sharpeB > sharpeA;
    var mult = sharpeA > 0.05 ? sharpeB / sharpeA : null;
    return {
      tone: wins ? "ok" : "warn",
      h: wins
        ? (mult
          ? t("our way wins: holdout Sharpe " + num(sharpeB, 2) + " — " + num(mult, 1) + "x the universal screen's " + num(sharpeA, 2),
              "我们的方法赢：留出集 Sharpe " + num(sharpeB, 2) + " —— 是通用筛（" + num(sharpeA, 2) + "）的 " + num(mult, 1) + " 倍")
          : t("our way wins: holdout Sharpe " + num(sharpeB, 2) + " versus " + num(sharpeA, 2) + " — the screen's pool was negative",
              "我们的方法赢：留出集 Sharpe " + num(sharpeB, 2) + " 对 " + num(sharpeA, 2) + " —— 通用筛那条是负的"))
        : t("on this tape the universal screen is stronger: " + num(sharpeA, 2) + " versus " + num(sharpeB, 2),
            "在这条胶带上通用筛更强：" + num(sharpeA, 2) + " 对 " + num(sharpeB, 2)),
      b: wins
        ? t("The mechanism: each factor's conditional edge is diluted by sqrt(pi) when it trades everywhere, so the screen discards it; routed to its home venue and pooled with the other discards, the edge is back. Same tape, same seed, both portfolios scored on the same holdout.",
            "机制：因子到处交易时条件边缘被 √π 稀释，于是被筛掉；路由回主场、与其他废弃者池化，边缘回来了。同一条胶带、同一个种子、两条组合同一个留出集打分。")
        : t("That is a real result, not a bug: the mechanism only pays when enough of the discards are genuine home-venue factors. The numbers above say how much of that this library has.",
            "这是真结果，不是 bug：只有当足够多的废弃者真的是主场因子时，机制才兑现。上面的数字说明了这个库有多少。"),
      plain: wins
        ? t("The screen threw them away; routed home and pooled, they beat what it kept.", "筛子把它们扔了；路由回主场再池化，它们赢了筛子留下的。")
        : t("Here the screen's survivors were simply better.", "这里筛子的幸存者就是更强。")
    };
  }

  /* ----------------------------------------------------------------- run */
  function run(input) {
    var text = typeof input === "string" ? input : (input && input.text) || "";
    var Z = window.HJ_ZOO, W = window.HJ_WHATIF, C = window.HJ_COUNCIL;
    var steps = [], blocks = [];
    if (!Z || !C) {
      return { steps: [{ name: "workbench", args: "(no machinery)", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no", h: t("the machinery has not loaded", "机器还没加载完"),
          b: t("Reload the page and try again.", "刷新页面再试。") }] };
    }
    var d = detect(text);
    steps.push({ name: "workbench.detect", args: "(" + d.kind + ")", status: d.kind === "none" || d.kind === "empty" ? "fail" : "ok" });

    if (d.kind === "empty" || d.kind === "none") {
      return { steps: steps, blocks: [{ k: "verdict", tone: "no",
        h: t("nothing recognizable in that paste", "粘贴里没有可识别的内容"),
        b: t("Accepted: one “name, t” per line (e.g. alpha, 2.60); one “name :: formula” per line (e.g. mom :: Rank(MidPrice - Mean[20](MidPrice))); bare expressions, one per line; or a line with sharpe= for your own strategy.",
          "接受：每行「名称, t」（如 alpha, 2.60）；每行「名称 :: 公式」（如 mom :: Rank(MidPrice - Mean[20](MidPrice))）；纯表达式每行一个；或者一行带 sharpe= 的你自己策略数字。"),
        plain: t("Give it factors or numbers — it will do the rest.", "给它因子或数字——剩下的它来做。") }] };
    }

    if (d.kind === "strategy") {
      var s = d.strategy;
      var st = s.expr && window.HJ_ENGINES ? window.HJ_ENGINES.strategyBuild({ expr: s.expr }) : null;
      if (!st) {
        return { steps: steps, blocks: [{ k: "verdict", tone: "warn",
          h: t("your strategy numbers need a factor to compare against", "你的策略数字需要一个因子来对照"),
          b: t("Add the factor expression, e.g. “sharpe=1.2 maxDD=0.18 expr=Rank((BidSize - AskSize) / (BidSize + AskSize))”.",
            "加上因子表达式，例如「sharpe=1.2 maxDD=0.18 expr=Rank((BidSize - AskSize) / (BidSize + AskSize))」。") }] };
      }
      blocks.push({ k: "prose", text: t(
        "Your numbers beside the same factor rebuilt under our rules — z-clipped positions, vol target calibrated on the train block only, and the home-venue router as the paper's move.",
        "你的数字，旁边是同一个因子按我们的规则重建——z 分数裁剪仓位、波动目标只在训练段校准、以及论文的解法：主场路由。") });
      blocks.push({ k: "table",
        head: [{ t: "metric" }, { t: "yours", num: true }, { t: "ours · always-on", num: true }, { t: "ours · home-routed", num: true }],
        rows: [
          [{ t: "Sharpe (holdout)" }, { t: s.sharpe != null ? num(s.sharpe, 2) : "—", num: true },
            { t: num(st.strategy.always.sharpe, 2), num: true }, { t: num(st.strategy.routed.sharpe, 2), num: true }],
          [{ t: "max drawdown" }, { t: s.maxDD != null ? num(s.maxDD * 100, 1) + "%" : "—", num: true },
            { t: num(st.strategy.always.maxDD * 100, 1) + "%", num: true }, { t: num(st.strategy.routed.maxDD * 100, 1) + "%", num: true }],
          [{ t: "turnover" }, { t: s.turnover != null ? num(s.turnover, 3) : "—", num: true },
            { t: num(st.strategy.always.turnover, 3), num: true }, { t: num(st.strategy.routed.turnover, 3), num: true }]
        ] });
      var v = aggressive(st.strategy.always.sharpe, st.strategy.routed.sharpe);
      blocks.push({ k: "verdict", tone: v.tone, h: v.h, b: v.b, plain: v.plain });
      var co = C.run({ expr: s.expr });
      blocks.push({ k: "council", council: co.council });
      blocks.push({ k: "note", text: t(
        "Declared: your numbers are echoed as given, never adjusted; ours are rebuilt on the declared tape under seed 20261105. A backtest is a backtest.",
        "声明：你的数字按原样回显，从不调整；我们的数字在声明胶带上按种子 20261105 重建。回测就是回测。") });
      return { steps: steps, blocks: blocks };
    }

    if (d.kind === "tstats") {
      var rows = d.rows;
      var mis = rows.filter(function (r) { return r.t >= ALLOC && r.t * Math.sqrt(r.pi) < SCREEN; });
      var pass = rows.filter(function (r) { return Math.abs(r.t) >= SCREEN; });
      var weak = rows.filter(function (r) { return mis.indexOf(r) < 0 && pass.indexOf(r) < 0; });
      var pooled = mis.length ? (mis.reduce(function (a, r) { return a + r.t; }, 0) / mis.length) * Math.sqrt(mis.length) : null;
      blocks.push({ k: "prose", text: t(
        "Your " + rows.length + "-row library through the universal screen: " + pass.length + " pass, " + mis.length + " mis-killed, " + weak.length + " weak. The mis-killed set is pooled below.",
        "你的 " + rows.length + " 行库过通用筛：" + pass.length + " 个过筛，" + mis.length + " 个误杀，" + weak.length + " 个偏弱。误杀集在下面池化。") });
      blocks.push({ k: "table",
        head: [{ t: "factor" }, { t: "t", num: true }, { t: "t_g", num: true }, { t: "screen" }],
        rows: rows.map(function (r) {
          var tg = r.t * Math.sqrt(r.pi);
          var k = tg >= SCREEN ? "pass" : (r.t >= ALLOC ? "miskill" : "weak");
          return [{ t: r.name }, { t: num(r.t, 2), num: true }, { t: num(tg, 2), num: true },
            { t: k === "pass" ? t("pass", "过筛") : k === "miskill" ? t("mis-killed", "误杀") : t("weak", "偏弱"),
              tone: k === "miskill" ? "no" : (k === "pass" ? "ok" : "") }];
        }) });
      blocks.push({ k: "kv", items: [
        { k: "pass", v: String(pass.length) },
        { k: "mis-killed", v: String(mis.length), tone: mis.length ? "no" : "" },
        { k: "weak", v: String(weak.length) },
        { k: "pooled t of the mis-killed", v: pooled == null ? "—" : num(pooled, 2), tone: pooled != null && pooled >= SCREEN ? "ok" : "" }
      ] });
      blocks.push({ k: "verdict",
        tone: pooled != null && pooled >= SCREEN ? "ok" : "warn",
        h: pooled != null && pooled >= SCREEN
          ? t("the discards pool back: " + mis.length + " mis-killed, pooled t = " + num(pooled, 2) + " — significant as a group",
              "废弃集池化回来了：" + mis.length + " 个误杀，池化 t = " + num(pooled, 2) + "——作为一组显著")
          : t("the discards do not pool back on this tape", "在这条胶带上废弃集池化不回来"),
        b: t("The screen judged each factor alone and threw these away; the pool judges them together. mean(t)*sqrt(n) = " + (pooled == null ? "—" : num(pooled, 2)) + ".",
            "筛子单独审判每个因子、把它们扔了；池子把它们放在一起审。mean(t)*√n = " + (pooled == null ? "—" : num(pooled, 2)) + "。"),
        plain: t("One by one they failed; together they may not have.", "单独看它们都失败了；放在一起未必。") });
      var co2 = C.run({ rows: rows.map(function (r) { return { name: r.name, t: r.t, pi: r.pi }; }) });
      blocks.push({ k: "council", council: co2.council });
      blocks.push({ k: "note", text: t(
        "Declared: t-stats are yours, echoed as given; the screen is |t_g| >= 1.96 with t_g = t*sqrt(pi) and the allocation line t >= " + num(ALLOC, 4) + ". One tape, one seed — a mechanism reproduction, not a market conclusion.",
        "声明：t 值是你的，按原样回显；筛线 |t_g| ≥ 1.96，t_g = t·√π，配置线 t ≥ " + num(ALLOC, 4) + "。一条胶带、一个种子——是机制复现，不是市场结论。") });
      return { steps: steps, blocks: blocks };
    }

    /* formulas — the full double path through the experiment engine */
    var ex = Z.experiment({ rows: d.rows.map(function (r) {
      return { id: r.name, name: r.name, expr: r.expr, cite: t("yours", "你的"), family: "own" };
    }), builtin: false });
    blocks.push({ k: "prose", text: t(
      "Your " + d.rows.length + " factor" + (d.rows.length === 1 ? "" : "s") + ", measured on the declared tape, then the double path: the normal way (universal screen, survivors equal-weighted) against our way (home-venue routing plus pooling of the mis-killed). Every number is computed in this tab.",
      "你的 " + d.rows.length + " 个因子，先在声明胶带上测，然后走双路：正常方式（通用筛+等权）对我们的方式（主场路由+误杀集池化）。每个数字都在本页计算。") });
    blocks = blocks.concat(ex.blocks || []);
    var e = ex.experiment || {};
    var ag = aggressive(e.sharpeA, e.sharpeB);
    blocks.push({ k: "verdict", tone: ag.tone, h: ag.h, b: ag.b, plain: ag.plain });
    blocks.push({ k: "actions", items: [
      { label: t("run the what-if engine", "跑反事实引擎"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("what if pi = 0.1");
      } },
      { label: t("guide me through a strategy", "带我分步建策略"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("guide me through building a strategy");
      } }
    ] });
    return { steps: steps, blocks: blocks };
  }

  window.HJ_WORKBENCH = { version: "v1.0", run: run, detect: detect, helpers: { t: t, num: num } };
})();
