/* ==========================================================================
   BOAT · 00b whatif — the counterfactual engine and the validation bench
   --------------------------------------------------------------------------
   The paper's theory as knobs. Every question of the form "what if ..."
   — pi were 0.1, N were 5000, the screen were 2.38, only Q1 traded —
   re-runs the measurement with that one parameter changed and reports
   what changes, before/after, with the parliament adjudicating.

   And the visitor's own numbers meet our method: a pasted factor library
   or their own strategy metrics, run through the same double path (the
   universal screen against home-venue routing plus pooling), with an
   explicit verdict on where each way wins and why.

   One tape, one seed, one generative process — a mechanism reproduction,
   never a market conclusion.
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

  var SCREEN = 1.96, ALLOC = Math.sqrt(2 * Math.log(17));
  var SEGMENTS = 4, PAY_T = 1.5, SPLIT = 0.7;

  /* ------------------------------------------------------------ measuring */
  function measure(expr) {
    var E = window.HJ_ENGINES;
    var sig = E.helpers.evalExpr(expr);
    if (!sig) return null;
    var M0 = E.helpers.market();
    var st = window.HJ_ML.stats(sig, M0.fwd);
    var n = Math.min(sig.length, M0.fwd.length);
    var segLen = Math.floor(n / SEGMENTS), segs = [], s;
    for (s = 0; s < SEGMENTS; s++) {
      var a = s * segLen, b = (s === SEGMENTS - 1) ? n : a + segLen;
      var bt = E.helpers.blockT(sig.slice(a, b), M0.fwd.slice(a, b));
      segs.push({ i: s + 1, t: bt.t, pays: bt.t >= PAY_T });
    }
    var home = null;
    segs.forEach(function (g) { if (g.pays && (!home || Math.abs(g.t) > Math.abs(home.t))) home = g; });
    return { t: st.icT, pi: st.pi, ic: st.ic, sharpe: st.sharpe, maxDD: st.maxDD, segs: segs, home: home };
  }

  /* the verdict, under any screen line: mis-killed means the unconditional
     edge clears the allocation line yet the diluted one misses the screen */
  function verdictOf(tStat, tg, screen) {
    screen = screen || SCREEN;
    if (tg >= screen) return "pass";
    if (tStat >= ALLOC) return "miskill";
    return "weak";
  }
  function verdictLabel(k) {
    return k === "pass" ? t("pass", "过筛") : k === "miskill" ? t("mis-killed", "误杀") : t("weak", "偏弱");
  }
  function verdictTone(k) {
    return k === "miskill" ? "no" : (k === "pass" ? "ok" : "");
  }

  /* ------------------------------------------------------------- what-if */
  function whatIf(opts) {
    var steps = [], blocks = [];
    var E = window.HJ_ENGINES, Z = window.HJ_ZOO, C = window.HJ_COUNCIL;
    if (!E || !window.HJ_ML || !C) {
      return { steps: [{ name: "instruments", args: "whatif", status: "fail" }], blocks: [] };
    }
    opts = opts || {};
    var knobs = [];
    if (opts.pi != null && isFinite(opts.pi)) knobs.push({ k: "pi", v: opts.pi });
    if (opts.N != null && isFinite(opts.N)) knobs.push({ k: "N", v: opts.N });
    if (opts.screen != null && isFinite(opts.screen)) knobs.push({ k: "screen", v: opts.screen });
    if (opts.venue != null) knobs.push({ k: "venue", v: opts.venue });
    if (!knobs.length) {
      return {
        steps: [{ name: "route", args: "whatif", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The what-if engine needs one knob", "反事实引擎需要一个旋钮"),
          b: t("Say which parameter to change: pi (the paying-state frequency), N (the candidate count), the screen line, or the venue (Q1-Q4). For example: what if pi were 0.1.",
            "说要改哪个参数：π（兑现状态频率）、N（候选数）、筛线、或主场（Q1–Q4）。例如：「如果 π 只有 0.1 会怎样」。") }]
      };
    }
    var expr = opts.expr || null;
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var out, head;
    if (expr) {
      var P = null;
      try { window.HJ_GATE.parse(expr); P = expr; } catch (e) {}
      if (!P) {
        return {
          steps: [{ name: "gate.parse", args: '("' + expr + '")', status: "fail" }],
          blocks: [{ k: "verdict", tone: "no",
            h: t("the factor does not parse", "这个因子无法解析"),
            b: t("The grammar rejected the expression, so there is nothing to re-run. Fix the factor and ask again.",
              "文法不接受这个表达式，没有可重跑的东西。修好因子再问。") }]
        };
      }
      var m = measure(expr);
      if (!m) {
        return { steps: [{ name: "route", args: "whatif", status: "fail" }],
          blocks: [{ k: "verdict", tone: "no", h: t("the factor could not be measured", "这个因子无法测量"), b: "" }] };
      }
      var rows = [];
      knobs.forEach(function (kb) {
        var before, after, why;
        if (kb.k === "pi") {
          before = { tg: m.t * Math.sqrt(m.pi), v: verdictOf(m.t, m.t * Math.sqrt(m.pi)) };
          after = { tg: m.t * Math.sqrt(kb.v), v: verdictOf(m.t, m.t * Math.sqrt(kb.v)) };
          why = t("t_g = t*sqrt(pi): " + num(m.t, 2) + "*sqrt(" + num(m.pi, 3) + ") = " + num(before.tg, 2) +
            " becomes " + num(m.t, 2) + "*sqrt(" + num(kb.v, 3) + ") = " + num(after.tg, 2),
            "t_g = t*√π：" + num(m.t, 2) + "*√" + num(m.pi, 3) + " = " + num(before.tg, 2) +
            " 变成 " + num(m.t, 2) + "*√" + num(kb.v, 3) + " = " + num(after.tg, 2));
        } else if (kb.k === "N") {
          var h0 = Math.sqrt(2 * Math.log(17)), h1 = Math.sqrt(2 * Math.log(kb.v));
          var tg0 = m.t * Math.sqrt(m.pi);
          before = { tg: tg0, v: verdictOf(m.t, tg0), wall: h0 };
          after = { tg: tg0, v: before.v, wall: h1 };
          why = t("the discovery wall moves from sqrt(2 ln 17) = " + num(h0, 3) + " to sqrt(2 ln " + kb.v + ") = " + num(h1, 3) +
            "; t_g = " + num(tg0, 2) + (tg0 >= h1 ? " still clears it" : " no longer clears it"),
            "发现之墙从 √(2 ln 17) = " + num(h0, 3) + " 移到 √(2 ln " + kb.v + ") = " + num(h1, 3) +
            "；t_g = " + num(tg0, 2) + (tg0 >= h1 ? " 仍然过墙" : " 过不了墙了"));
        } else if (kb.k === "screen") {
          before = { tg: m.t * Math.sqrt(m.pi), v: verdictOf(m.t, m.t * Math.sqrt(m.pi)) };
          after = { tg: m.t * Math.sqrt(m.pi), v: verdictOf(m.t, m.t * Math.sqrt(m.pi), kb.v) };
          why = t("the screen line moves from |t_g| >= " + num(SCREEN, 2) + " to |t_g| >= " + num(kb.v, 2) +
            "; t_g = " + num(after.tg, 2),
            "筛线从 |t_g| ≥ " + num(SCREEN, 2) + " 移到 |t_g| ≥ " + num(kb.v, 2) +
            "；t_g = " + num(after.tg, 2));
        } else {
          var seg = m.segs[Math.max(0, Math.min(SEGMENTS - 1, (kb.v | 0) - 1))];
          var pays = !!(seg && seg.pays);
          before = { tg: m.t * Math.sqrt(m.pi), v: verdictOf(m.t, m.t * Math.sqrt(m.pi)) };
          after = pays ? { tg: m.t, v: verdictOf(m.t, m.t) } : { tg: 0, v: "weak" };
          why = pays
            ? t("Q" + kb.v + " pays (block t = " + num(seg.t, 2) + " >= " + num(PAY_T, 1) + "), so the factor trades there with its full conditional edge, t_g = t = " + num(m.t, 2),
              "Q" + kb.v + " 段兑现（区块 t = " + num(seg.t, 2) + " ≥ " + num(PAY_T, 1) + "），因子带着完整条件边缘在那里交易，t_g = t = " + num(m.t, 2))
            : t("Q" + kb.v + " does not pay (block t = " + num(seg ? seg.t : 0, 2) + " < " + num(PAY_T, 1) + "), so traded only there, the factor has no edge to measure",
              "Q" + kb.v + " 段不兑现（区块 t = " + num(seg ? seg.t : 0, 2) + " < " + num(PAY_T, 1) + "），只在那里交易，这个因子没有可测量的边缘");
        }
        rows.push({ knob: kb, before: before, after: after, why: why });
      });
      steps.push({ name: "whatif.measure", args: '("' + expr + '", ' + knobs.map(function (k) { return k.k + "=" + k.v; }).join(", ") + ")",
        status: "ok", detail: "measured on the declared tape, seed 20261105" });
      blocks.push({ k: "prose", text: t(
        "The counterfactual run on " + expr + ". One factor, one tape, one knob at a time — each row below is the same measurement re-derived with a single parameter changed. IC = " + num(m.ic, 4) + ", t = " + num(m.t, 2) + ", measured pi = " + num(m.pi, 3) + ".",
        "对 " + expr + " 的反事实运行。一个因子、一条胶带、一次只拧一个旋钮——下面每一行都是同一个测量在单个参数改变后的重新推导。IC = " + num(m.ic, 4) + "，t = " + num(m.t, 2) + "，实测 π = " + num(m.pi, 3) + "。") });
      blocks.push({ k: "table",
        head: [{ t: "knob" }, { t: "t_g before", num: true }, { t: "verdict" }, { t: "t_g after", num: true }, { t: "verdict" }],
        rows: rows.map(function (r) {
          return [
            { t: r.knob.k + " = " + r.knob.v },
            { t: num(r.before.tg, 2), num: true },
            { t: verdictLabel(r.before.v), tone: verdictTone(r.before.v) },
            { t: num(r.after.tg, 2), num: true },
            { t: verdictLabel(r.after.v), tone: verdictTone(r.after.v) }
          ];
        }) });
      blocks.push({ k: "kv", items: rows.map(function (r) {
        return { k: r.knob.k + " = " + r.knob.v, v: r.why };
      }) });
      var maxG = 0.0001;
      rows.forEach(function (r) { maxG = Math.max(maxG, Math.abs(r.before.tg), Math.abs(r.after.tg)); });
      blocks.push({ k: "bars", items: rows.map(function (r) {
        return { label: r.knob.k + " = " + r.knob.v, value: Math.abs(r.after.tg), max: maxG * 1.2,
          tone: r.after.v === "pass" ? "" : (r.after.v === "miskill" ? "cut" : ""), delta: "before " + num(r.before.tg, 2) };
      }) });
      var flipped = rows.filter(function (r) { return r.before.v !== r.after.v; });
      blocks.push({ k: "verdict",
        tone: flipped.length ? "warn" : "ok",
        h: flipped.length
          ? t((flipped.length === 1 ? "one knob changes" : flipped.length + " knobs change") + " the verdict", (flipped.length === 1 ? "一个旋钮" : flipped.length + " 个旋钮") + "改变了裁决")
          : t("no knob changes the verdict — the geometry is stable", "没有旋钮改变裁决——几何是稳定的"),
        b: flipped.length
          ? t("Before: " + verdictLabel(rows[0].before.v) + ". After: " + flipped.map(function (r) { return r.knob.k + "=" + r.knob.v + " -> " + verdictLabel(r.after.v); }).join("; ") + ". The paper's law is why a pi knob bites hardest: t_g = t*sqrt(pi), so a factor with a strong conditional edge can be diluted below any screen by a small paying share — and the correction has a ceiling, q2(tau) = tau/(1+tau).",
            "之前：" + verdictLabel(rows[0].before.v) + "。之后：" + flipped.map(function (r) { return r.knob.k + "=" + r.knob.v + " → " + verdictLabel(r.after.v); }).join("; ") + "。论文的定律解释了为什么 π 这个旋钮最咬人：t_g = t·√π，条件边缘很强的因子可以被很小的兑现占比稀释到任何筛线之下——而修正有上限，q²(τ) = τ/(1+τ)。")
          : t("t_g = " + num(rows[0].after.tg, 2) + " sits " + (rows[0].after.v === "pass" ? "above" : "below") + " the screen under every knob you turned. That stability is itself a result.",
            "t_g = " + num(rows[0].after.tg, 2) + " 在你拧的每个旋钮下都" + (rows[0].after.v === "pass" ? "在筛线之上" : "在筛线之下") + "。这种稳定本身就是一个结果。"),
        plain: flipped.length
          ? t("Change the paying share and the same factor changes its fate.", "改变兑现占比，同一个因子改变命运。")
          : t("This factor's verdict survives every knob you turned.", "这个因子的裁决在你拧的所有旋钮下都活下来了。") });
      var co = C.run({ expr: expr });
      blocks.push({ k: "council", council: co.council });
      blocks.push({ k: "note", text: t(
        "Declared: t is the IC block-t over 60-bar non-overlapping blocks; pi is the measured active share; a segment pays at block t >= " + PAY_T +
        "; t_g = t*sqrt(pi); the screen is |t_g| >= " + SCREEN + " and the allocation line is t >= " + num(ALLOC, 4) +
        ". One tape, one seed, one generative process — a mechanism reproduction, not a market conclusion.",
        "声明：t 是 60 根不重叠区块的 IC 区块 t；π 是实测活跃占比；段 t ≥ " + PAY_T + " 记为兑现；t_g = t·√π；筛线 |t_g| ≥ " +
        SCREEN + "，配置线 t ≥ " + num(ALLOC, 4) + "。一条胶带、一个种子、一个生成过程——是机制复现，不是市场结论。") });
      blocks.push({ k: "actions", items: [
        { label: t("validate my own factors", "检验我自己的因子"), fn: function () {
          if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("validate my factors");
        } },
        { label: t("run the full experiment", "跑完整双路实验"), fn: function () {
          if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("run the experiment");
        } },
        { label: t("guide me through a strategy", "带我分步建策略"), fn: function () {
          if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("guide me through building a strategy");
        } }
      ] });
      out = { steps: steps, blocks: blocks };
      head = "single factor";
    } else {
      out = whatIfZoo(knobs, opts);
      head = "the builtin zoo";
    }
    out.steps.unshift({ name: "whatif.run", args: "(" + head + ", " + knobs.map(function (k) { return k.k + "=" + k.v; }).join(", ") + ")",
      status: "ok",
      ms: Math.max(0, Math.round((((window.performance && performance.now) ? performance.now() : 0) - t0) * 100) / 100) });
    return out;
  }

  /* --------------------------------------------------- the zoo-level run */
  /* No single factor named: run the 22-factor builtin zoo under the default
     constants and under the knob, and report what moved. */
  function whatIfZoo(knobs, opts) {
    var Z = window.HJ_ZOO, C = window.HJ_COUNCIL;
    var steps = [], blocks = [];
    var lib = Z.builtin;
    var base = lib.map(function (f) { return measure(f.expr); }).filter(function (m) { return m; });
    var screen = knobs.filter(function (k) { return k.k === "screen"; })[0];
    var line = screen ? screen.v : SCREEN;
    var hurdle = null;
    var nk = knobs.filter(function (k) { return k.k === "N"; })[0];
    if (nk) hurdle = Math.sqrt(2 * Math.log(nk.v));
    function counts(list, scr) {
      var c = { pass: 0, miskill: 0, weak: 0 };
      list.forEach(function (m) {
        var v = verdictOf(m.t, m.t * Math.sqrt(m.pi), scr);
        c[v] += 1;
      });
      return c;
    }
    var c0 = counts(base, SCREEN), c1 = counts(base, line);
    var flips = [];
    lib.forEach(function (f, i) {
      var m = base[i];
      if (!m) return;
      var v0 = verdictOf(m.t, m.t * Math.sqrt(m.pi), SCREEN);
      var v1 = verdictOf(m.t, m.t * Math.sqrt(m.pi), line);
      if (v0 !== v1) flips.push({ name: f.id, from: v0, to: v1, t: m.t, tg: m.t * Math.sqrt(m.pi) });
    });
    steps.push({ name: "whatif.zoo", args: "(" + lib.length + " public factors)", status: "ok",
      detail: "every factor re-screened at the new line" });
    blocks.push({ k: "prose", text: t(
      "The counterfactual run on the builtin zoo — " + lib.length + " public factors, each measured once and then re-screened at the changed line. Default screen |t_g| ≥ " + num(SCREEN, 2) + "; your line |t_g| ≥ " + num(line, 2) + (hurdle ? "; discovery wall √(2 ln " + nk.v + ") = " + num(hurdle, 3) : "") + ".",
      "对内置动物园的反事实运行——" + lib.length + " 个公开因子，每个先测一次，再按改动的筛线重筛。默认筛线 |t_g| ≥ " + num(SCREEN, 2) + "；你的筛线 |t_g| ≥ " + num(line, 2) + (hurdle ? "；发现之墙 √(2 ln " + nk.v + ") = " + num(hurdle, 3) : "") + "。") });
    blocks.push({ k: "kv", items: [
      { k: "factors measured", v: String(base.length) },
      { k: "pass · default line", v: String(c0.pass) },
      { k: "pass · your line", v: String(c1.pass), tone: c1.pass < c0.pass ? "no" : "ok" },
      { k: "mis-killed · default line", v: String(c0.miskill) },
      { k: "mis-killed · your line", v: String(c1.miskill), tone: c1.miskill > c0.miskill ? "no" : "" },
      { k: "weak · default line", v: String(c0.weak) },
      { k: "weak · your line", v: String(c1.weak) },
      { k: "verdicts changed", v: String(flips.length), tone: flips.length ? "warn" : "ok" }
    ] });
    if (flips.length) {
      blocks.push({ k: "table",
        head: [{ t: "factor" }, { t: "t", num: true }, { t: "t_g", num: true }, { t: "was" }, { t: "becomes" }],
        rows: flips.slice(0, 16).map(function (f) {
          return [
            { t: f.name },
            { t: num(f.t, 2), num: true },
            { t: num(f.tg, 2), num: true },
            { t: verdictLabel(f.from), tone: verdictTone(f.from) },
            { t: verdictLabel(f.to), tone: verdictTone(f.to) }
          ];
        }) });
    }
    blocks.push({ k: "verdict",
      tone: flips.length ? "warn" : "ok",
      h: flips.length
        ? t("the line change moves " + flips.length + " of " + base.length + " verdicts", "筛线改动移动了 " + base.length + " 个中的 " + flips.length + " 个裁决")
        : t("the line change moves nothing", "筛线改动没有移动任何裁决"),
      b: flips.length
        ? t("Pass " + c0.pass + " → " + c1.pass + ", mis-killed " + c0.miskill + " → " + c1.miskill + ". Every mis-killed factor here pays only in part of the tape — that is what the screen cannot see, and what pooling recovers.",
          "过筛 " + c0.pass + " → " + c1.pass + "，误杀 " + c0.miskill + " → " + c1.miskill + "。这里每个被误杀的因子只在部分胶带上兑现——那是筛子看不见的，也正是池化能捞回来的。")
        : t("Under both lines the zoo settles the same way — the screen is not the binding constraint for this set.",
          "两条线下动物园的归宿相同——对这个集合，筛线不是紧约束。"),
      plain: flips.length ? t("Move the line, move the bodies.", "挪动筛线，挪动尸体。") : t("The line does not matter for this zoo.", "这条线对这个动物园无关紧要。") });
    var co = C.run({ rows: base.map(function (m, i) { return { name: lib[i].id, t: m.t, pi: m.pi }; }) });
    blocks.push({ k: "council", council: co.council });
    blocks.push({ k: "note", text: t(
      "Declared: the zoo is the site's builtin public library with literature citations; each factor measured once on the declared tape under seed 20261105; the screen line is the only thing changed. One tape, one seed — a mechanism reproduction, not a market conclusion.",
      "声明：动物园是本站内置的、带文献引用的公开因子库；每个因子在声明胶带上测一次，种子 20261105；唯一改变的是筛线。一条胶带、一个种子——是机制复现，不是市场结论。") });
    blocks.push({ k: "actions", items: [
      { label: t("run the full experiment", "跑完整双路实验"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("run the experiment");
      } },
      { label: t("validate my own factors", "检验我自己的因子"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("validate my factors");
      } }
    ] });
    return { steps: steps, blocks: blocks };
  }

  /* ----------------------------------------------------- the validation bench */
  /* The visitor's own numbers meet our method: a pasted library, or their
     own strategy metrics beside the same factor rebuilt under our rules. */
  function validate(opts) {
    opts = opts || {};
    var steps = [], blocks = [];
    var Z = window.HJ_ZOO, E = window.HJ_ENGINES, C = window.HJ_COUNCIL;
    if (!Z || !E || !C) {
      return { steps: [{ name: "instruments", args: "validate", status: "fail" }], blocks: [] };
    }
    var lib = (opts.lib || "").trim();
    var rows = lib ? Z.parseLibraryText(lib) : [];
    var withExpr = rows.filter(function (r) { return /[A-Za-z]/.test(r.expr || ""); });
    var hasStrategy = opts.sharpe != null || opts.maxDD != null || opts.turnover != null;

    if (!rows.length && !hasStrategy) {
      return {
        steps: [{ name: "route", args: "validate", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("the validation bench needs your numbers", "检验台需要你的数字"),
          b: t("Paste a factor library (one “name, t” or “name :: formula” per line), or your strategy's Sharpe / max drawdown / turnover — then our method runs on the same tape and the two answers sit side by side.",
            "粘贴因子库（每行「名称, t」或「名称 :: 公式」），或者你策略的 Sharpe / 最大回撤 / 换手——然后我们的方法在同一条胶带上跑，两个答案并排放。") }]
      };
    }

    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    steps.push({ name: "validate.run", args: "(" + (rows.length ? rows.length + " pasted rows" : "strategy metrics") + ")",
      status: "ok" });

    if (withExpr.length) {
      /* formulas: measure them and run the double path through the zoo engine */
      var ex = Z.experiment({ rows: withExpr.map(function (r) { return { id: r.name, name: r.name, expr: r.expr, cite: t("yours", "你的"), family: "own" }; }), builtin: false });
      blocks.push({ k: "prose", text: t(
        "Your " + withExpr.length + " factor" + (withExpr.length === 1 ? "" : "s") + ", measured on the declared tape, then the double path: the normal way (universal screen, survivors equal-weighted) against our way (home-venue routing plus pooling of the mis-killed). Every number below is computed in this tab.",
        "你的 " + withExpr.length + " 个因子，先在声明胶带上测，然后走双路：正常方式（通用筛+等权）对我们的方式（主场路由+误杀集池化）。下面每个数字都在本页计算。") });
      blocks = blocks.concat(ex.blocks);
    } else if (rows.length) {
      /* t-stat library: the resurrection bench, then the same framing */
      var trows = rows.map(function (r) { return { name: r.name, t: parseFloat(r.expr) }; })
        .filter(function (r) { return isFinite(r.t); });
      if (!trows.length) {
        return {
          steps: steps,
          blocks: [{ k: "verdict", tone: "no",
            h: t("no t-statistics found in the paste", "粘贴里没有找到 t 值"),
            b: t("The rows carried no parseable numbers. Paste one 'name, t' per line (or 'name :: formula' for factors we can measure), or your strategy's Sharpe.",
              "这些行里没有可解析的数字。每行粘贴「名称, t」（或「名称 :: 公式」让我们能测量），或者你策略的 Sharpe。") }]
        };
      }
      var mis = trows.filter(function (r) { return r.t >= ALLOC && r.t * Math.sqrt(0.25) < SCREEN; });
      var weak = trows.filter(function (r) { return !(r.t >= ALLOC && r.t * Math.sqrt(0.25) < SCREEN) && Math.abs(r.t) < SCREEN; });
      var pass = trows.filter(function (r) { return Math.abs(r.t) >= SCREEN; });
      var pooled = mis.length ? (mis.reduce(function (a, r) { return a + r.t; }, 0) / mis.length) * Math.sqrt(mis.length) : null;
      blocks.push({ k: "prose", text: t(
        "Your " + trows.length + "-row library through the universal screen at π = 0.25: " + pass.length + " pass, " + mis.length + " mis-killed, " + weak.length + " weak. The mis-killed set is pooled with Stouffer below.",
        "你的 " + rows.length + " 行库过 π = 0.25 的通用筛：" + pass.length + " 个过筛，" + mis.length + " 个误杀，" + weak.length + " 个偏弱。误杀集用 Stouffer 池化在下面。") });
      blocks.push({ k: "table",
        head: [{ t: "factor" }, { t: "t", num: true }, { t: "t_g = t*sqrt(0.25)", num: true }, { t: "screen" }],
        rows: trows.map(function (r) {
          var tg = r.t * Math.sqrt(0.25);
          var v = verdictOf(r.t, tg);
          return [
            { t: r.name },
            { t: num(r.t, 2), num: true },
            { t: num(tg, 2), num: true },
            { t: verdictLabel(v), tone: verdictTone(v) }
          ];
        }) });
      blocks.push({ k: "kv", items: [
        { k: "pass", v: String(pass.length) },
        { k: "mis-killed", v: String(mis.length), tone: mis.length ? "no" : "" },
        { k: "weak", v: String(weak.length) },
        { k: "pooled t of the mis-killed", v: pooled == null ? "—" : num(pooled, 2),
          tone: pooled != null && pooled >= SCREEN ? "ok" : "" },
        { k: t("where our way wins", "我们强在哪"),
          v: t("the screen judges each factor alone; the pool judges the mis-killed together — " +
            (pooled != null && pooled >= SCREEN
              ? "here they pool back to t = " + num(pooled, 2) + ", significant as a group though each alone was discarded"
              : "here they do not pool back on this tape, and the bench says so plainly"),
            "筛子单独审判每个因子；池子把误杀者放在一起审——" +
            (pooled != null && pooled >= SCREEN
              ? "在这里它们池化回 t = " + num(pooled, 2) + "，作为一组显著，尽管每个单独都被丢弃"
              : "在这里它们在这条胶带上池化不回来，检验台直说")) }
      ] });
      blocks.push({ k: "verdict",
        tone: pooled != null && pooled >= SCREEN ? "ok" : "warn",
        h: pooled != null && pooled >= SCREEN
          ? t("the discards pool back to significance", "废弃集池化后恢复显著")
          : t("the discards do not pool back on this tape", "在这条胶带上废弃集池化不回来"),
        b: t("Pooled t = mean(t)*sqrt(n) = " + (pooled == null ? "—" : num(pooled, 2)) + " over the " + mis.length + " mis-killed. The screen judged each one alone; the pool judges them together — that is the paper's move, and it is reproducible here in one call.",
          "池化 t = mean(t)*√n = " + (pooled == null ? "—" : num(pooled, 2)) + "，跨 " + mis.length + " 个误杀者。筛子单独审判每一个；池子把它们放在一起审——这就是论文的解法，在这里一次调用就能复现。"),
        plain: t("One by one they failed; together they may not have.", "单独看它们都失败了；放在一起未必。") });
      var co = C.run({ rows: trows.map(function (r) { return { name: r.name, t: r.t, pi: 0.25 }; }) });
      blocks.push({ k: "council", council: co.council });
    }

    if (hasStrategy && opts.expr) {
      var st = E.strategyBuild({ expr: opts.expr });
      var s = st.strategy;
      blocks.push({ k: "prose", text: t(
        "Your strategy's numbers beside the same factor rebuilt under our rules — z-clipped positions, vol target calibrated on the train block only, and the home-venue router as the paper's move.",
        "你的策略数字，旁边是同一个因子按我们的规则重建的——z 分数裁剪仓位、波动目标只在训练段校准、以及论文的解法：主场路由。") });
      blocks.push({ k: "table",
        head: [{ t: "metric" }, { t: "yours", num: true }, { t: "ours · always-on", num: true }, { t: "ours · home-routed", num: true }],
        rows: [
          [{ t: "Sharpe (holdout)" },
            { t: opts.sharpe != null ? num(opts.sharpe, 2) : "—", num: true },
            { t: num(s.always.sharpe, 2), num: true },
            { t: num(s.routed.sharpe, 2), num: true, tone: s.routed.sharpe > s.always.sharpe ? "ok" : "" }],
          [{ t: "max drawdown" },
            { t: opts.maxDD != null ? num(opts.maxDD * 100, 1) + "%" : "—", num: true },
            { t: num(s.always.maxDD * 100, 1) + "%", num: true },
            { t: num(s.routed.maxDD * 100, 1) + "%", num: true }],
          [{ t: "turnover" },
            { t: opts.turnover != null ? num(opts.turnover, 3) : "—", num: true },
            { t: num(s.always.turnover, 3), num: true },
            { t: num(s.routed.turnover, 3), num: true }]
        ] });
      var ours = s.routed.sharpe > s.always.sharpe;
      blocks.push({ k: "verdict",
        tone: ours ? "ok" : "warn",
        h: ours ? t("on this tape, home-routing beats always-on", "在这条胶带上，主场路由胜过常开")
          : t("on this tape, always-on holds up", "在这条胶带上，常开守住了"),
        b: t("Holdout Sharpe: always-on " + num(s.always.sharpe, 2) + " versus home-routed " + num(s.routed.sharpe, 2) +
          (opts.sharpe != null ? "; yours " + num(opts.sharpe, 2) + "." : ".") +
          " A backtest is a backtest — this one is at least fully declared and re-runnable under a fixed seed.",
          "留出集 Sharpe：常开 " + num(s.always.sharpe, 2) + " versus 主场路由 " + num(s.routed.sharpe, 2) +
          (opts.sharpe != null ? "；你的 " + num(opts.sharpe, 2) + "。" : "。") +
          "回测就是回测——这个回测至少完全声明、固定种子下可重跑。"),
        plain: ours ? t("Trading it only where it pays beat trading it everywhere.", "只在兑现处交易，胜过到处交易。")
          : t("On this tape, everywhere was simply better.", "在这条胶带上，到处交易反而更好。") });
    }

    blocks.push({ k: "note", text: t(
      "Declared: the validation bench measures what you pasted on the same declared tape as everything else — seed 20261105, 60-bar blocks, screen |t_g| >= 1.96, allocation line t >= " + num(ALLOC, 4) +
      ". Your numbers are echoed as given, never adjusted. One tape, one seed — a mechanism reproduction, not a market conclusion.",
      "声明：检验台把你粘贴的内容测在与其他一切相同的声明胶带上——种子 20261105、60 根区块、筛线 |t_g| ≥ 1.96、配置线 t ≥ " + num(ALLOC, 4) +
      "。你的数字按原样回显，从不调整。一条胶带、一个种子——是机制复现，不是市场结论。") });
    steps[0].ms = Math.max(0, Math.round((((window.performance && performance.now) ? performance.now() : 0) - t0) * 100) / 100);
    return { steps: steps, blocks: blocks };
  }

  /* ------------------------------------------------------------- export */
  window.HJ_WHATIF = {
    version: "v1.0",
    whatIf: whatIf,
    validate: validate,
    constants: { SCREEN: SCREEN, ALLOC: ALLOC, SEGMENTS: SEGMENTS, PAY_T: PAY_T, SPLIT: SPLIT },
    helpers: { t: t, num: num }
  };
})();

