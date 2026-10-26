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
    /* B1 — a bare numeric series, or a date,value table (a factor's own daily
       values). This must be detected BEFORE the "name, t" parser, or a date
       in column 0 would be read as a factor name. */
    var seriesVals = [], dateHits = 0, numericHits = 0;
    lines.forEach(function (ln) {
      var c = ln.split(/[,;\t]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
      if (c.length === 2 && /^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/.test(c[0]) && isFinite(parseFloat(c[1]))) {
        seriesVals.push(parseFloat(c[1])); dateHits++; return;
      }
      if (c.length === 1 && /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(c[0])) {
        seriesVals.push(parseFloat(c[0])); numericHits++;
      }
    });
    if (dateHits >= 3) return { kind: "series", values: seriesVals };
    if (numericHits >= 8 && numericHits >= lines.length * 0.8) return { kind: "series", values: seriesVals };

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

  /* ------------------------------------------------------- B1: own series */
  /* A pasted factor series (date,value rows, or one number per line) is a
     signal. It is resampled onto the declared tape, measured by HJ_ML.stats,
     and put through the same sieve as every other factor. Nothing is fitted;
     the series is taken as given. */
  function resample(v, n) {
    var m = v.length, o = [], i;
    if (m === 1) { for (i = 0; i < n; i++) o.push(v[0]); return o; }
    for (i = 0; i < n; i++) {
      var x = i * (m - 1) / (n - 1), j = Math.floor(x), f = x - j;
      o.push(j + 1 < m ? v[j] * (1 - f) + v[j + 1] * f : v[m - 1]);
    }
    return o;
  }
  function runSeries(values, steps) {
    var M = window.HJ_ML, E = window.HJ_ENGINES, C = window.HJ_COUNCIL;
    var blocks = [];
    if (!M || !E) return { steps: steps, blocks: [{ k: "verdict", tone: "no", h: t("machinery not loaded", "机器没加载完"), b: t("Reload and try again.", "刷新再试。") }] };
    var H = E.helpers, K = E.constants;
    var M0 = H.market(), n = M0.n, fwd = M0.fwd;
    var sig = resample(values, n);
    var st = M.stats(sig, fwd);
    var segs = [], s, segLen = Math.floor(n / K.SEGMENTS);
    for (s = 0; s < K.SEGMENTS; s++) {
      var a = s * segLen, b = (s === K.SEGMENTS - 1) ? n : a + segLen;
      var bt = H.blockT(sig.slice(a, b), fwd.slice(a, b));
      segs.push({ i: s + 1, t: bt.t, pays: bt.t >= K.PAY_T });
    }
    var home = null;
    segs.forEach(function (g) { if (g.pays && (!home || Math.abs(g.t) > Math.abs(home.t))) home = g; });
    var tg = st.icT * Math.sqrt(st.pi);
    var key = Math.abs(tg) >= K.SCREEN ? "pass" : (Math.abs(st.icT) >= K.ALLOC ? "miskill" : "weak");

    steps.push({ name: "workbench.series", args: "(" + values.length + " → " + n + " bars)", status: "ok",
      detail: "resampled onto the declared tape · measured by HJ_ML.stats" });

    blocks.push({ k: "prose", text: t(
      "Your " + values.length + "-point series, resampled onto the " + n + "-bar declared tape and measured by the same instrument as every factor here. It is taken as given — nothing is fitted, nothing is smoothed away.",
      "你的 " + values.length + " 点序列，重采样到 " + n + " 根 bar 的声明胶带上，用和这里每个因子相同的仪器测量。按原样使用——不拟合、不抹平。") });
    var dec = []; for (var i = 0; i < sig.length; i += 4) dec.push(sig[i]);
    blocks.push({ k: "chart", variant: "line", label: t("your series (resampled)", "你的序列（重采样后）"), series: dec });
    blocks.push({ k: "kv", items: [
      { k: "IC (Spearman)", v: num(st.ic, 4) },
      { k: "t (non-overlapping blocks)", v: num(st.icT, 2), tone: Math.abs(st.icT) >= K.ALLOC ? "ok" : "" },
      { k: "π (active share)", v: num(st.pi, 3) },
      { k: "t_g = t·√π", v: num(tg, 2), tone: Math.abs(tg) >= K.SCREEN ? "ok" : "no" },
      { k: "Sharpe", v: num(st.sharpe, 2) },
      { k: "max drawdown", v: num(st.maxDD * 100, 1) + "%" },
      { k: "turnover", v: num(st.turnover, 3) }
    ] });
    blocks.push({ k: "table",
      head: [{ t: "segment" }, { t: "block t", num: true }, { t: "pays (≥ " + K.PAY_T + ")" }],
      rows: segs.map(function (g) {
        return [{ t: "Q" + g.i }, { t: num(g.t, 2), num: true },
          { t: g.pays ? t("pays", "兑现") : t("quiet", "安静"), tone: g.pays ? "ok" : "" }];
      }) });
    var miskilled = key === "miskill";
    blocks.push({ k: "verdict",
      tone: key === "pass" ? "ok" : (miskilled ? "no" : "warn"),
      h: key === "pass"
        ? t("your series clears the universal screen: t_g = " + num(tg, 2) + " ≥ 1.96", "你的序列过通用筛：t_g = " + num(tg, 2) + " ≥ 1.96")
        : miskilled
          ? t("the universal screen mis-kills your series", "通用筛误杀了你的序列")
          : t("your series is weak on this tape: |t| = " + num(Math.abs(st.icT), 2), "你的序列在这条胶带上偏弱：|t| = " + num(Math.abs(st.icT), 2)),
      b: t("Own t = " + num(st.icT, 2) + ", diluted t_g = " + num(tg, 2) + ", π = " + num(st.pi, 3) +
        (home ? ". Its home venue is Q" + home.i + " (block t = " + num(home.t, 2) + ")." : ". No segment reaches the declared " + K.PAY_T + " bar.") +
        (miskilled ? " It clears the allocation bar but not the screen after dilution — exactly the paper's mis-kill." : ""),
        "自身 t = " + num(st.icT, 2) + "，稀释后 t_g = " + num(tg, 2) + "，π = " + num(st.pi, 3) +
        (home ? "。它的主场是 Q" + home.i + "（段 t = " + num(home.t, 2) + "）。" : "。没有段达到声明的 " + K.PAY_T + " 门槛。") +
        (miskilled ? " 它过了配置线、稀释后却过不了筛线——正是论文说的误杀。" : "")),
      plain: key === "pass" ? t("It survives the screen.", "它过了筛。")
        : miskilled ? t("It is strong where it lives, but the single screen discards it.", "它在自己的场子里很强，但单一筛子把它扔了。")
          : t("No edge on this tape.", "这条胶带上没有边。") });
    if (C) { var co = C.run({ t: st.icT, pi: st.pi, N: 6960 }); if (co && co.council) blocks.push({ k: "council", council: co.council }); }
    blocks.push({ k: "note", text: t(
      "Declared: your series is echoed as given, resampled by linear interpolation onto the " + n + "-bar tape, and measured once — no fitting, no tuning, no look-ahead. One tape, one seed. This says how your series relates to this declared market, not to the real one.",
      "声明：你的序列按原样使用，线性插值重采样到 " + n + " 根 bar 的胶带，只测一次——不拟合、不调参、不偷看未来。一条胶带、一个种子。这说的是你的序列与这个声明市场的关系，不是与真实市场的关系。") });
    return { steps: steps, blocks: blocks };
  }

  /* ------------------------------------------------ B2: the combined factor */
  /* Two or more of your factors, combined into ONE signal two ways —
     equal-weight, and IC-weighted (each factor weighted by its own measured
     IC). The composite is then measured by the same instrument, so you can
     see whether combining beat the best single factor on this tape. */
  function combine(rows) {
    var M = window.HJ_ML, E = window.HJ_ENGINES;
    if (!M || !E || rows.length < 2) return null;
    var H = E.helpers, M0 = H.market(), n = M0.n, fwd = M0.fwd, i, j;
    var sigs = [], names = [];
    rows.forEach(function (r) {
      var s = H.evalExpr(r.expr);
      if (s) { sigs.push(s); names.push(r.name); }
    });
    if (sigs.length < 2) return null;
    var zs = sigs.map(function (s) { return M.zscore(s.slice(0, n)); });
    var ics = sigs.map(function (s) { return M.spearman(s.slice(0, n), fwd); });
    var eq = [], iw = [];
    for (i = 0; i < n; i++) {
      var a = 0, b = 0;
      for (j = 0; j < zs.length; j++) { a += zs[j][i]; b += ics[j] * zs[j][i]; }
      eq.push(a / zs.length);
      iw.push(b);
    }
    var wsum = ics.reduce(function (x, y) { return x + Math.abs(y); }, 0) || 1;
    iw = iw.map(function (v) { return v / wsum; });
    var stEq = M.stats(eq, fwd), stIw = M.stats(iw, fwd);
    var indT = sigs.map(function (s) { return Math.abs(M.stats(s, fwd).icT); });
    var bestT = Math.max.apply(null, indT);
    var bestI = indT.indexOf(bestT);
    var win = stIw.icT > stEq.icT ? "ic" : "eq";
    var best = Math.max(Math.abs(stEq.icT), Math.abs(stIw.icT));
    return [
      { k: "prose", text: t(
        "The same " + sigs.length + " factors, combined into one signal two ways: equal-weight (each z-scored, averaged) and IC-weighted (each weighted by its own measured IC). Both composites are then measured by the same instrument — a portfolio factor, judged like any other.",
        "同样这 " + sigs.length + " 个因子，用两种方式合成一条信号：等权（各自 z 分数后平均）与 IC 加权（按各自实测 IC 加权）。两条合成信号再用同一仪器测量——一个组合因子，像其他因子一样被审判。") },
      { k: "table",
        head: [{ t: "signal" }, { t: "IC", num: true }, { t: "t", num: true }, { t: "Sharpe", num: true }],
        rows: [
          [{ t: t("equal-weight composite", "等权合成") }, { t: num(stEq.ic, 4), num: true }, { t: num(stEq.icT, 2), num: true }, { t: num(stEq.sharpe, 2), num: true }],
          [{ t: t("IC-weighted composite", "IC 加权合成") }, { t: num(stIw.ic, 4), num: true }, { t: num(stIw.icT, 2), num: true }, { t: num(stIw.sharpe, 2), num: true }],
          [{ t: t("best single (" + names[bestI] + ")", "最佳单因子（" + names[bestI] + "）") }, { t: "—" }, { t: num(bestT, 2), num: true }, { t: "—" }]
        ] },
      { k: "verdict", tone: best >= Math.max(Math.abs(stEq.icT), Math.abs(stIw.icT)) ? "ok" : "warn",
        h: t("combining " + sigs.length + " factors: " + (win === "ic" ? "IC-weighted" : "equal-weight") + " is stronger, |t| = " + num(best, 2) + " vs best single " + num(bestT, 2),
            "合成 " + sigs.length + " 个因子：" + (win === "ic" ? "IC 加权" : "等权") + "更强，|t| = " + num(best, 2) + "，最佳单因子 " + num(bestT, 2)),
        b: t("Equal-weight t = " + num(stEq.icT, 2) + ", IC-weighted t = " + num(stIw.icT, 2) + ", best single |t| = " + num(bestT, 2) +
          ". A composite is not automatically better — combining diversifying signals can raise t, combining redundant ones cannot. The numbers say which happened here.",
          "等权 t = " + num(stEq.icT, 2) + "，IC 加权 t = " + num(stIw.icT, 2) + "，最佳单因子 |t| = " + num(bestT, 2) +
          "。合成不会自动更好——合成互补的信号能抬高 t，合成冗余的不能。数字说明这里发生了哪种。"),
        plain: t("Two ways to combine, measured side by side.", "两种合成方式，并排测量。") }
    ];
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

    if (d.kind === "series") return runSeries(d.values, steps);

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
    try { localStorage.setItem("hj-wb-lib", JSON.stringify(d.rows)); } catch (e) {}
    var ex = Z.experiment({ rows: d.rows.map(function (r) {
      return { id: r.name, name: r.name, expr: r.expr, cite: t("yours", "你的"), family: "own" };
    }), builtin: false });
    blocks.push({ k: "prose", text: t(
      "Your " + d.rows.length + " factor" + (d.rows.length === 1 ? "" : "s") + ", measured on the declared tape, then the double path: the normal way (universal screen, survivors equal-weighted) against our way (home-venue routing plus pooling of the mis-killed). Every number is computed in this tab.",
      "你的 " + d.rows.length + " 个因子，先在声明胶带上测，然后走双路：正常方式（通用筛+等权）对我们的方式（主场路由+误杀集池化）。每个数字都在本页计算。") });
    /* the experiment brings its own verdict and action bar; this module
       writes its own aggressive verdict below, so drop the duplicates */
    (ex.blocks || []).forEach(function (b) {
      if (b.k === "verdict" || b.k === "actions") return;
      blocks.push(b);
    });
    if (d.rows.length >= 2) {
      var cb = combine(d.rows);
      if (cb) cb.forEach(function (b) { blocks.push(b); });
    }
    var e = ex.experiment || {};
    var ag = d.rows.length === 1
      ? { tone: "warn",
          h: t("one factor — the table above is its measurement", "只有一个因子——上面的表就是它的测量"),
          b: t("The double path needs at least two factors: one to keep, one to discard, so both portfolios can be built. Add rows and run it again.",
              "双路对比至少需要两个因子：一个被留下、一个被丢弃，两条组合才建得起来。多加几行再跑。"),
          plain: t("One factor is a measurement, not a comparison.", "一个因子是测量，不是对比。") }
      : aggressive(e.sharpeA, e.sharpeB);
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

  /* B3 — one click, the whole answer as a markdown file: table, charts,
     verdict, council, the declared note. A reviewer can read it offline. */
  function markdown(out, title) {
    var L = [];
    L.push("# " + (title || t("BOAT-2 factor workbench report", "BOAT-2 因子工作台报告")));
    L.push("");
    L.push("> " + t("declared tape · seed 20261105 · computed in the browser · SSRN 7607684",
      "声明胶带 · 种子 20261105 · 浏览器内计算 · SSRN 7607684"));
    L.push("");
    (out.blocks || []).forEach(function (b) {
      if (b.k === "prose" || b.k === "note") L.push(b.text, "");
      else if (b.k === "table") {
        L.push("| " + (b.head || []).map(function (h) { return h.t; }).join(" | ") + " |");
        L.push("|" + (b.head || []).map(function () { return "---"; }).join("|") + "|");
        (b.rows || []).forEach(function (r) { L.push("| " + r.map(function (c) { return String(c.t).replace(/\|/g, "/"); }).join(" | ") + " |"); });
        L.push("");
      } else if (b.k === "kv") {
        (b.items || []).forEach(function (it) { L.push("- **" + it.k + "** — " + it.v); });
        L.push("");
      } else if (b.k === "verdict") {
        L.push("## " + b.h, "", b.b, "", "> " + (b.plain || ""), "");
      } else if (b.k === "chart") {
        L.push("_chart: " + (b.label || "") + " (" + (b.series || []).length + " points)_", "");
      } else if (b.k === "bars") {
        L.push("_bars: " + (b.items || []).map(function (x) { return x.label + " " + num(x.value, 2); }).join(" · "), "");
      } else if (b.k === "council") {
        var c = b.council || {};
        L.push("_council: " + ((c.verdict && c.verdict.h) || "") + "_", "");
      }
    });
    return L.join("\n");
  }

  window.HJ_WORKBENCH = {
    version: "v1.0", run: run, detect: detect, markdown: markdown, helpers: { t: t, num: num }
  };
})();
