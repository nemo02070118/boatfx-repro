/* ==========================================================================
   BOAT · 00b engines — the new compute layer
   --------------------------------------------------------------------------
   Four new engines, all deterministic, all computed in this tab:

     venue.find(slots)      the paper's WHERE decision, made computable:
                           cut the declared tape into segments, measure IC/t
                           per segment, find where the factor actually pays,
                           and measure pi instead of assuming it.
     resurrect(slots)       the paper's headline as a device: a pasted factor
                           library goes through the universal screen, the
                           mis-killed set is pooled (Stouffer), and the
                           revival is printed with the paper's own numbers
                           labelled as the paper's.
     strategy.build(slots)  factor -> strategy: positions from the factor,
                           vol targeting calibrated on train only, and the
                           paper's resolution (venue routing) compared
                           against always-on on the same tape.
     foundry(slots)         plain language -> a legal factor expression
                           (templates offline, the model compiles when a
                           brain is attached — it still cannot invent a
                           number, everything is re-measured here).
     about(question)        the author, from the record only. Every fact
                           carries its source; unknown questions are
                           refused, not guessed.

   Every threshold used here is either one this page already prints
   (1.96 / sqrt(2 ln 17) = 2.3803) or declared in the note block of the
   instrument that uses it.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- i18n */
  function lang() {
    try {
      var s = localStorage.getItem("hj-lang");
      if (s === "zh" || s === "en") return s;
    } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
  }
  function t(en, zh) { return lang() === "zh" ? zh : en; }

  /* ------------------------------------------------------------- helpers */
  function num(x, d) {
    d = d == null ? 2 : d;
    if (x == null || !isFinite(x)) return "—";
    var p = Math.pow(10, d);
    return (Math.round(x * p) / p).toFixed(d);
  }
  function meanOf(a) {
    var s = 0, i;
    for (i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : 0;
  }
  function stdOf(a) {
    var n = a.length;
    if (n < 2) return 0;
    var m = meanOf(a), v = 0, i;
    for (i = 0; i < n; i++) { var d = a[i] - m; v += d * d; }
    return Math.sqrt(v / (n - 1));
  }
  function spear(a, b) {
    var M = window.HJ_ML;
    return (M && M.spearman) ? M.spearman(a, b) : 0;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function ask(text) {
    if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask(text);
  }

  /* --------------------------------------------------------- constants */
  var SCREEN = 1.96;                          /* §04, printed on this page */
  var D_EFF = 17;                             /* §04                       */
  var ALLOC = Math.sqrt(2 * Math.log(D_EFF)); /* 2.3803                    */
  var BLK = 60;                               /* the page's own block size */
  var SEGMENTS = 4;                           /* declared: tape in quarters */
  var PAY_T = 1.5;                            /* declared: a segment pays  */
  var TARGET_VOL = 0.15;                      /* declared vol target, annual */
  var SPLIT = 0.7;                            /* declared train fraction   */
  var SEED = (window.HJ_ML && window.HJ_ML.constants && window.HJ_ML.constants.SEED) || 20261105;
  var VERSION = "v1.0";

  /* ------------------------------------------------------- the market */
  var MKT = null;
  function market() {
    var M = window.HJ_ML;
    if (!M || !M.market) return null;
    if (!MKT) MKT = M.market(SEED);
    return MKT;
  }
  function mlMissing() {
    return {
      steps: [{ name: "instruments", args: "HJ_ML", status: "fail",
        detail: t("ml.js has not loaded — reload the page and ask again",
          "ml.js 还没加载——刷新页面后再问一次") }],
      blocks: [
        { k: "verdict", tone: "no",
          h: t("The learning bench is not up yet", "学习台还没就绪"),
          b: t("ml.js loads before this file, so this should not happen. Reload the page and ask again.",
            "ml.js 按顺序在本文件之前加载，正常不该出现。刷新页面再问一次。") }
      ]
    };
  }

  /* the gate's own grammar: returns the AST directly and THROWS on error */
  function parseExpr(expr) {
    var G = window.HJ_GATE;
    if (!G || !G.parse) return { err: "grammar unavailable" };
    try {
      var ast = G.parse(String(expr || ""));
      if (!ast) return { err: "empty expression" };
      return { ast: ast };
    } catch (e) {
      return { err: String((e && e.message) || e) };
    }
  }

  /* evaluate an expression on the declared tape -> series or null */
  function evalExpr(expr) {
    var P = parseExpr(expr);
    if (P.err) return null;
    var M = market();
    if (!M) return null;
    try {
      var sig = window.HJ_ML.evalAST(P.ast, M.signals, M.n);
      if (!sig || !sig.length) return null;
      return sig;
    } catch (e) { return null; }
  }

  /* the page's own non-overlapping-block t, unchanged */
  function blockT(sig, fwd) {
    var n = Math.min(sig.length, fwd.length);
    var blocks = [], b;
    for (b = 0; b + BLK <= n; b += BLK) {
      blocks.push(spear(sig.slice(b, b + BLK), fwd.slice(b, b + BLK)));
    }
    var tt = 0;
    if (blocks.length > 2 && stdOf(blocks) > 1e-12) {
      tt = meanOf(blocks) * Math.sqrt(blocks.length) / stdOf(blocks);
    }
    return { t: tt, blocks: blocks.length, n: n };
  }

  /* bench math for a raw return series (mean / sd / t / sharpe / dd) */
  function seriesStats(xs) {
    var n = xs.length;
    if (!n) return null;
    var m = meanOf(xs), sd = stdOf(xs);
    var eq = 1, peak = 1, mdd = 0, i;
    for (i = 0; i < n; i++) {
      eq *= (1 + xs[i]);
      if (eq > peak) peak = eq;
      var dd = 1 - eq / peak;
      if (dd > mdd) mdd = dd;
    }
    var hit = 0;
    for (i = 0; i < n; i++) if (xs[i] > 0) hit++;
    return {
      n: n, mean: m, sd: sd,
      t: sd > 0 ? m / (sd / Math.sqrt(n)) : 0,
      sharpe: sd > 0 ? (m / sd) * Math.sqrt(252) : 0,
      maxDD: mdd, hit: hit / n
    };
  }

  /* parse a factor library: "name, t" or "name, t, pi" per line */
  function parseLib(text) {
    var lines = String(text || "").split(/\r?\n/);
    var rows = [];
    lines.forEach(function (ln) {
      ln = ln.trim();
      if (!ln || ln.charAt(0) === "#") return;
      var parts = ln.split(/[,;\t]+/).filter(function (s) { return s.trim() !== ""; });
      var val = null, name = "", pi = null;
      if (parts.length >= 3) {
        var lastN = parseFloat(parts[parts.length - 1]);
        var prevN = parseFloat(parts[parts.length - 2]);
        if (isFinite(lastN) && lastN > 0 && lastN <= 1 && isFinite(prevN)) {
          pi = lastN;
          val = prevN;
          name = parts.slice(0, parts.length - 2).join(" ").trim();
        }
      }
      if (val == null) {
        if (parts.length >= 2) {
          val = parseFloat(parts[parts.length - 1]);
          name = parts.slice(0, parts.length - 1).join(" ").trim();
        } else {
          var bits = ln.split(/\s+/);
          val = parseFloat(bits[bits.length - 1]);
          name = bits.slice(0, bits.length - 1).join(" ");
        }
      }
      if (isFinite(val)) {
        rows.push({ name: name || ("factor " + (rows.length + 1)), t: val, pi: pi });
      }
    });
    return rows;
  }

  /* ============================================================ venue.find */
  /* The paper's WHERE decision as a device. The declared tape is cut into
     SEGMENTS contiguous segments; each segment gets the page's own
     non-overlapping-block IC t. A segment "pays" when its block t reaches
     PAY_T (declared here, weaker than the 1.96 screen because segments are
     short — the policy is printed, not hidden). pi is then MEASURED as the
     share of bars inside paying segments, and the dilution identity runs on
     the measured pi instead of a slider assumption.                     */
  function venueFind(slots) {
    var steps = [], blocks = [];
    var M = window.HJ_ML;
    if (!M || !M.market) return mlMissing();

    var expr = slots.expr || null;
    if (!expr) {
      return {
        steps: [{ name: "route", args: "venue.find", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The venue finder needs a factor expression", "主场寻找器需要一个因子表达式"),
          b: t("Paste a legal expression (or say “find the venue for …”). It is measured against the declared tape bar by bar.",
            "粘贴一个合法表达式（或者说「找 … 的主场」）。它会在声明胶带上逐根测量。") }]
      };
    }
    var sig = evalExpr(expr);
    if (!sig) {
      var bad = parseExpr(expr);
      return {
        steps: [{ name: "route", args: "expr = " + expr, status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The grammar rejected the expression", "文法不接受这个表达式"),
          b: t("The gate's parser said: " + (bad.err || "no parse") + ". Fix the expression, or ask the foundry to compile one from a sentence.",
            "闸门文法返回：" + (bad.err || "无法解析") + "。修好表达式，或者让造因子器用一句话编译一个。") }]
      };
    }

    var M0 = market();
    var fwd = M0.fwd;
    var n = Math.min(sig.length, fwd.length);
    steps.push({ name: "route", args: "expr = " + expr, status: "ok",
      detail: "market = declared · seed " + SEED + " · " + n + " bars" });

    var t1 = (window.performance && performance.now) ? performance.now() : 0;
    var segLen = Math.floor(n / SEGMENTS);
    var segs = [], s;
    for (s = 0; s < SEGMENTS; s++) {
      var a = s * segLen;
      var b = (s === SEGMENTS - 1) ? n : a + segLen;
      var ss = sig.slice(a, b), ff = fwd.slice(a, b);
      var ic = spear(ss, ff);
      var bt = blockT(ss, ff);
      segs.push({
        i: s + 1, from: a, to: b, n: b - a, ic: ic,
        t: bt.t, blocks: bt.blocks, pays: bt.t >= PAY_T
      });
    }
    var whole = blockT(sig.slice(0, n), fwd.slice(0, n));
    steps.push({ name: "venue.segments", args: "(" + SEGMENTS + " × " + segLen + " bars)", status: "ok",
      ms: Math.max(0, Math.round((((window.performance && performance.now) ? performance.now() : 0) - t1) * 100) / 100),
      detail: SEGMENTS + " segments · " + BLK + "-bar blocks inside each" });

    var paying = segs.filter(function (g) { return g.pays; });
    var payingBars = paying.reduce(function (acc, g) { return acc + g.n; }, 0);
    var pi = n ? payingBars / n : 0;
    var home = null;
    paying.forEach(function (g) {
      if (!home || Math.abs(g.t) > Math.abs(home.t)) home = g;
    });
    var tg = whole.t * Math.sqrt(pi);

    blocks.push({ k: "prose", text: t(
      "The WHERE decision, measured instead of assumed: the declared tape is cut into " + SEGMENTS +
      " contiguous segments, each gets its own non-overlapping-block IC t, and a segment counts as paying when that t reaches " +
      PAY_T + ". π is then the measured share of bars inside paying segments — not a slider guess.",
      "WHERE 决策，实测而不是假设：声明胶带被切成 " + SEGMENTS + " 个连续段，每段各算自己的不重叠区块 IC t，段内 t 达到 " +
      PAY_T + " 记为兑现段。π 就是兑现段内 bar 的实测占比——不是滑块猜的。") });

    var maxT = Math.max.apply(null, segs.map(function (g) { return Math.abs(g.t); }).concat([PAY_T, 1]));
    blocks.push({ k: "bars", items: segs.map(function (g) {
      return {
        label: "Q" + g.i + " · |t| " + num(Math.abs(g.t), 2) + (g.pays ? " · pays" : ""),
        value: Math.abs(g.t), max: maxT * 1.15,
        tone: g.pays ? "" : "cut"
      };
    }).concat([{ label: "pays if t ≥ " + PAY_T, value: PAY_T, max: maxT * 1.15 }]) });

    blocks.push({ k: "kv", items: [
      { k: "t on the whole tape", v: num(whole.t, 2), tone: Math.abs(whole.t) >= ALLOC ? "ok" : (Math.abs(whole.t) >= SCREEN ? "warn" : "no") },
      { k: "π measured", v: num(pi * 100, 1) + "%" },
      { k: "t_g = t·√π", v: num(tg, 2), tone: tg >= SCREEN ? "ok" : (tg >= 1.5 ? "warn" : "no") },
      { k: "home venue", v: home ? ("Q" + home.i + " · t " + num(home.t, 2)) : t("none on this tape", "本胶带上没有") },
      { k: "paying segments", v: paying.length + " / " + SEGMENTS },
      { k: "screen / allocation", v: num(SCREEN, 2) + " / " + num(ALLOC, 4) }
    ] });

    var head, body, tone;
    if (home) {
      tone = tg >= SCREEN ? "ok" : "warn";
      head = home
        ? t("its home venue is Q" + home.i, "它的主场是第 Q" + home.i + " 段")
        : t("no home venue on this tape", "本胶带上没有主场");
      body = t(
        "Paying in " + paying.length + " of " + SEGMENTS + " segments (" + num(pi * 100, 1) +
        "% of bars). Diluted: t_g = " + num(whole.t, 2) + "·√" + num(pi, 3) + " = " + num(tg, 2) +
        (tg >= SCREEN
          ? " — survives the universal screen even after dilution."
          : " — under the 1.96 screen. This is the exact geometry the paper calls a mis-kill when t itself clears the allocation bar."),
        "在 " + SEGMENTS + " 个段里有 " + paying.length + " 个兑现（占 " + num(pi * 100, 1) +
        "% 的 bar）。稀释后 t_g = " + num(whole.t, 2) + "·√" + num(pi, 3) + " = " + num(tg, 2) +
        (tg >= SCREEN
          ? "——稀释后仍然过通用筛。"
          : "——低于 1.96 筛选线。当 t 本身已过配置线时，这正是论文说的误杀几何。"));
    } else {
      tone = "no";
      head = t("no paying segment on this tape", "本胶带上没有兑现段");
      body = t(
        "Across " + SEGMENTS + " segments, none reaches the declared " + PAY_T + " block-t bar. The honest reading is “no evidence here”, not “weak evidence” — π measures 0 and dilution has nothing to dilute.",
        "在 " + SEGMENTS + " 个段里，没有一个达到声明的 " + PAY_T + " 区块 t 门槛。诚实的读法是「这里没有证据」，不是「证据较弱」——π 实测为 0，稀释无从稀释。");
    }
    blocks.push({ k: "verdict", tone: tone, h: head, b: body,
      plain: home
        ? t("This factor does not pay everywhere — it pays in one part of the tape. The screen averages that away.",
          "这个因子不是到处都兑现——它只在胶带的一段里兑现。通用筛把这段平均没了。")
        : t("On this tape the factor pays nowhere, so there is nothing to revive.",
          "在这条胶带上这个因子哪儿都不兑现，没有什么可复活的。") });

    blocks.push({ k: "note", text: t(
      "Declared policy: " + SEGMENTS + " contiguous segments, " + BLK + "-bar non-overlapping blocks inside each, a segment pays at block t ≥ " +
      PAY_T + " (weaker than the 1.96 screen because segments are short — printed so you can disagree). π is measured, never assumed. " +
      "One tape, one seed, one generative process.",
      "声明策略：" + SEGMENTS + " 个连续段，段内 " + BLK + " 根不重叠区块，段 t ≥ " + PAY_T +
      " 记为兑现（比 1.96 筛选线松，因为段更短——印出来供你反对）。π 是实测的，永不是假设的。一条胶带、一个种子、一个生成过程。") });

    blocks.push({ k: "actions", items: [
      { label: t("run the council on this factor", "让议会裁决这个因子"), fn: function () { ask("council " + expr); } },
      { label: t("build a strategy on it, venue-routed", "以它建策略，按主场路由"), fn: function () { ask("build a strategy on " + expr); } },
      { label: t("permutation-test it", "对它做置换检验"), fn: function () { ask("placebo test " + expr); } }
    ] });

    return {
      steps: steps,
      blocks: blocks,
      venue: {
        expr: expr, segments: segs, whole: whole, pi: pi, tg: tg,
        home: home, paying: paying.length, n: n
      }
    };
  }

  /* ============================================================ resurrect */
  /* The paper's headline as a device. A factor library goes through the
     universal screen; the mis-killed set (t itself clears the allocation
     bar 2.3803 but t_g = t·sqrt(pi) falls under 1.96) is pooled with
     Stouffer's equal-weight method, and the revival is printed. The paper's
     own US-pool numbers are labelled as the paper's — this device never
     borrows them for the visitor's data.                                */
  function resurrect(slots) {
    var steps = [], blocks = [];
    var rows = null;
    if (slots.rows && slots.rows.length) {
      rows = slots.rows.map(function (r) {
        return { name: r.name || "factor", t: Number(r.t), pi: (r.pi != null && isFinite(r.pi)) ? r.pi : null };
      });
    } else if (slots.lib) {
      rows = parseLib(slots.lib);
    } else if (slots.t && slots.t.length) {
      rows = slots.t.map(function (v, i) { return { name: "factor " + (i + 1), t: Number(v), pi: null }; });
    }
    if (!rows || !rows.length) {
      return {
        steps: [{ name: "route", args: "resurrect", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The resurrection bench needs a library", "复活台需要一个因子库"),
          b: t("Paste one factor per line — “name, t” or “name, t, π”. The shipped sample library is one click away in §04b.",
            "每行一个因子——「名称, t」或「名称, t, π」。§04b 里一键可以载入站点自带样本库。") }]
      };
    }

    var DEFAULT_PI = 0.25;   /* the page's own slider default, declared */
    var judged = rows.map(function (r) {
      var pi = r.pi != null ? r.pi : DEFAULT_PI;
      var tg = r.t * Math.sqrt(pi);
      var key = "weak";
      if (isFinite(r.t)) {
        if (tg >= SCREEN) key = "pass";
        else if (r.t >= ALLOC) key = "miskill";
      }
      return { name: r.name, t: r.t, pi: pi, piOwn: r.pi != null, tg: tg, key: key };
    });
    var pass = judged.filter(function (r) { return r.key === "pass"; });
    var mis = judged.filter(function (r) { return r.key === "miskill"; });
    var weak = judged.filter(function (r) { return r.key === "weak"; });

    steps.push({ name: "route", args: "library · " + judged.length + " factors", status: "ok",
      detail: "π default " + DEFAULT_PI + " where a row carries none · gate " + num(SCREEN, 2) +
        " · allocation " + num(ALLOC, 4) });

    function pooled(list) {
      if (!list.length) return null;
      return meanOf(list.map(function (r) { return r.t; })) * Math.sqrt(list.length);
    }
    var pooledMis = pooled(mis);
    var pooledAll = pooled(judged);

    blocks.push({ k: "prose", text: t(
      "Your library through the universal screen. A factor is mis-killed when its own t clears the allocation bar (√(2 ln 17) = " +
      num(ALLOC, 4) + ") but the diluted t_g = t·√π falls under the screen (" + num(SCREEN, 2) +
      "). The mis-killed set is then pooled — Stouffer's equal-weight method, mean(t)·√n — the paper's one WHERE decision applied to the discards.",
      "你的因子库过通用筛。当一个因子自己的 t 过了配置线（√(2 ln 17) = " + num(ALLOC, 4) +
      "）而稀释后的 t_g = t·√π 低于筛选线（" + num(SCREEN, 2) + "）时，它被误杀。误杀集随后被池化——Stouffer 等权法，mean(t)·√n——论文那一个 WHERE 决策，施加在废弃集上。") });

    blocks.push({ k: "bars", items: [
      { label: t("pass", "过筛"), value: pass.length, max: judged.length, tone: "" },
      { label: t("mis-killed", "误杀"), value: mis.length, max: judged.length, tone: "cut" },
      { label: t("weak", "偏弱"), value: weak.length, max: judged.length }
    ] });

    blocks.push({ k: "table",
      head: [{ t: "factor" }, { t: "t", num: true }, { t: "π", num: true },
        { t: "t_g", num: true }, { t: "screen verdict" }],
      rows: judged.map(function (r) {
        return [
          { t: r.name },
          { t: num(r.t, 2), num: true },
          { t: num(r.pi, 2) + (r.piOwn ? "" : " *"), num: true },
          { t: num(r.tg, 2), num: true },
          { t: r.key === "pass" ? t("pass", "过筛") : r.key === "miskill" ? t("mis-killed", "误杀") : t("weak", "偏弱"),
            tone: r.key === "miskill" ? "no" : (r.key === "pass" ? "ok" : "") }
        ];
      }) });

    blocks.push({ k: "kv", items: [
      { k: "mis-killed", v: mis.length + " / " + judged.length, tone: mis.length ? "no" : "" },
      { k: "pooled t (mis-killed)", v: pooledMis == null ? "—" : num(pooledMis, 2), tone: pooledMis != null && pooledMis >= SCREEN ? "ok" : "" },
      { k: "pooled t (all rows)", v: pooledAll == null ? "—" : num(pooledAll, 2) },
      { k: "screen", v: num(SCREEN, 2) },
      { k: "allocation bar", v: num(ALLOC, 4) }
    ] });

    var tone = mis.length ? (pooledMis != null && pooledMis >= SCREEN ? "ok" : "warn") : "no";
    var head = mis.length
      ? t(mis.length + " mis-killed · pooled t " + num(pooledMis, 2), mis.length + " 个被误杀 · 池化 t " + num(pooledMis, 2))
      : t("no mis-kills in this library", "这个库里没有误杀");
    var body = mis.length
      ? t(
        "The discards, pooled, reach t = " + num(pooledMis, 2) + " — " +
        (pooledMis >= SCREEN
          ? "over the screen the individual factors could not clear. That is the paper's move: stop routing, pool the discards."
          : "still under the screen on this library. The mechanism is real either way; the verdict follows the arithmetic.") +
        " The paper's own US-pool measurement — 94 discards, sample-out Sharpe 0.85 alone, 1.30 reallocated as a group (FF6 α 3.8%/yr, t = 8.3) — is the paper's, not this library's.",
        "废弃集池化后达到 t = " + num(pooledMis, 2) + "——" +
        (pooledMis >= SCREEN
          ? "超过了个体因子过不了的筛选线。这就是论文的动作：停止路由，把废弃集池化起来。"
          : "仍在这个库的筛选线之下。机制是真的，裁决跟算术走。") +
        " 论文自己在美股池上的实测——94 个废弃因子、单独样本外 Sharpe 0.85、分组再配置 1.30（FF6 α 3.8%/yr，t = 8.3）——是论文的数字，不是这个库的。")
      : t(
        "Every factor either passes the screen outright or sits under the allocation bar — the mis-kill geometry (t ≥ 2.3803 with t_g < 1.96) never appears. Paste a library with home-venue factors, or load the shipped sample in §04b.",
        "每个因子要么直接过筛，要么连配置线都没到——误杀几何（t ≥ 2.3803 且 t_g < 1.96）没有出现。粘贴一个带主场因子的库，或者去 §04b 载入站点自带样本库。");
    blocks.push({ k: "verdict", tone: tone, h: head, b: body,
      plain: mis.length
        ? t("Some factors your screen threw away were alive — they just paid somewhere else. Pooled, they are hard to ignore.",
          "有些被筛掉的因子其实活着——它们只是在别的地方兑现。池化之后，很难再无视它们。")
        : t("Nothing here was wrongly thrown away.", "这里没有被错杀的东西。") });

    blocks.push({ k: "note", text: t(
      "π is taken from the row's own third column when present, otherwise the page default " + DEFAULT_PI +
      " (marked *). Stouffer pooling is equal-weight and assumes independence across factors — a strong assumption, printed so you can discount it. " +
      "Source: §04 the factor zoo · Proposition 2 · the paper's US-pool numbers are quoted, not recomputed.",
      "π 取自每行自带的第三列，没有则用页面默认 " + DEFAULT_PI + "（标 *）。Stouffer 池化是等权的，并假设因子间独立——这是个强假设，印出来供你打折。来源：§04 因子动物园 · 命题 2 · 论文美股池的数字是引用，不是重算。") });

    blocks.push({ k: "actions", items: [
      { label: t("council the mis-killed set", "让议会裁决误杀集"), fn: function () {
        ask("council library " + mis.map(function (r) { return r.name + ", " + num(r.t, 2); }).join("\n"));
      } },
      { label: t("open the autopsy bench", "打开误杀解剖台"), fn: function () {
        if (window.HJ_BENCH && window.HJ_BENCH.focus) window.HJ_BENCH.focus("batch");
      } },
      { label: t("find each one's home venue", "逐个找主场"), fn: function () {
        ask("find the venue for " + (window.HJ_ML && window.HJ_ML.market ? "(BidSize - AskSize) / (BidSize + AskSize)" : ""));
      } }
    ] });

    return {
      steps: steps,
      blocks: blocks,
      resurrect: {
        rows: judged, pass: pass.length, mis: mis.length, weak: weak.length,
        pooledMis: pooledMis, pooledAll: pooledAll, defaultPi: DEFAULT_PI
      }
    };
  }

  /* ======================================================== strategy.build */
  /* Factor -> strategy. Positions are the page's own convention (the factor
     z-scored, clipped to ±2.5, divided by 2.5). Vol targeting is calibrated
     on the TRAIN block only and applied out of sample. The paper's
     resolution is then run as an experiment on the same tape: always-on
     versus venue-routed (positions live only inside paying segments). No
     fitted parameters anywhere, no costs, one declared tape.            */
  function strategyBuild(slots) {
    var steps = [], blocks = [];
    var M = window.HJ_ML;
    if (!M || !M.market) return mlMissing();

    var expr = slots.expr || null;
    if (!expr) {
      return {
        steps: [{ name: "route", args: "strategy.build", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The strategy builder needs a factor expression", "策略构建器需要一个因子表达式"),
          b: t("Paste a legal expression — or say “build a strategy on …”. The foundry can compile one from a sentence.",
            "粘贴一个合法表达式——或者说「以…建策略」。造因子器可以用一句话编译一个。") }]
      };
    }
    var sig = evalExpr(expr);
    if (!sig) {
      var bad = parseExpr(expr);
      return {
        steps: [{ name: "route", args: "expr = " + expr, status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The grammar rejected the expression", "文法不接受这个表达式"),
          b: t("The gate's parser said: " + (bad.err || "no parse") + ".", "闸门文法返回：" + (bad.err || "无法解析") + "。") }]
      };
    }

    var M0 = market();
    var fwd = M0.fwd;
    var n = Math.min(sig.length, fwd.length);
    steps.push({ name: "route", args: "expr = " + expr, status: "ok",
      detail: "market = declared · seed " + SEED + " · " + n + " bars" });

    var t1 = (window.performance && performance.now) ? performance.now() : 0;
    var z = M.zscore(sig.slice(0, n));
    var pos = z.map(function (v) { return clamp(v, -2.5, 2.5) / 2.5; });
    steps.push({ name: "strategy.positions", args: "(z clipped ±2.5, ÷2.5)", status: "ok",
      ms: Math.max(0, Math.round((((window.performance && performance.now) ? performance.now() : 0) - t1) * 100) / 100),
      detail: t("the page's own position convention — no fitted parameters",
        "页面自己的仓位约定——没有任何拟合参数") });

    /* venue mask from the same declared policy as venue.find */
    var segLen = Math.floor(n / SEGMENTS);
    var mask = [], s, g;
    for (s = 0; s < SEGMENTS; s++) {
      var a = s * segLen;
      var b = (s === SEGMENTS - 1) ? n : a + segLen;
      var bt = blockT(sig.slice(a, b), fwd.slice(a, b));
      for (g = a; g < b; g++) mask.push(bt.t >= PAY_T);
    }

    var cut = Math.floor(n * SPLIT);
    function metrics(posArr, from, to) {
      var strat = [], i;
      for (i = from; i < to; i++) strat.push(posArr[i] * fwd[i]);
      if (!strat.length) return null;
      var sd = stdOf(strat), m = meanOf(strat);
      var eq = 1, peak = 1, mdd = 0;
      for (i = 0; i < strat.length; i++) {
        eq *= (1 + strat[i]);
        if (eq > peak) peak = eq;
        var dd = 1 - eq / peak;
        if (dd > mdd) mdd = dd;
      }
      var turn = 0;
      for (i = Math.max(from, 1); i < to; i++) turn += Math.abs(posArr[i] - posArr[i - 1]);
      turn = to - from > 1 ? turn / (to - from - 1) : 0;
      var hit = 0;
      for (i = from; i < to; i++) if ((posArr[i] > 0 ? 1 : -1) === (fwd[i] > 0 ? 1 : -1)) hit++;
      return {
        sharpe: sd > 1e-12 ? (m / sd) * Math.sqrt(252) : 0,
        maxDD: mdd, turnover: turn, hit: hit / strat.length,
        equity: (function () {
          var e = [], eqq = 1;
          for (i = from; i < to; i++) { eqq *= (1 + posArr[i] * fwd[i]); e.push(eqq); }
          return e;
        })()
      };
    }

    /* vol targeting: scale from TRAIN vol only, capped (declared) */
    var trainStrat = [];
    for (var i2 = 0; i2 < cut; i2++) trainStrat.push(pos[i2] * fwd[i2]);
    var trainVol = stdOf(trainStrat) * Math.sqrt(252);
    var scale = trainVol > 1e-9 ? Math.min(2, TARGET_VOL / trainVol) : 1;
    var posV = pos.map(function (p) { return p * scale; });
    var posRouted = [];
    for (i2 = 0; i2 < n; i2++) posRouted.push(mask[i2] ? posV[i2] : 0);

    var mAlways = metrics(posV, cut, n);
    var mRouted = metrics(posRouted, cut, n);
    var mRaw = metrics(pos, cut, n);
    steps.push({ name: "strategy.metrics", args: "(train " + cut + " · holdout " + (n - cut) + ")", status: "ok",
      detail: "train vol " + num(trainVol * 100, 1) + "% → scale ×" + num(scale, 3) +
        " (target " + num(TARGET_VOL * 100, 0) + "% ann, capped ×2)" });

    blocks.push({ k: "prose", text: t(
      "A strategy, not a factor score: positions are the factor z-scored and clipped to ±2.5 (the page's own convention), scaled to a " +
      num(TARGET_VOL * 100, 0) + "% annual vol target calibrated on the train block only. The paper's resolution is then run as an experiment on the same tape — " +
      "always-on versus venue-routed, where positions live only inside segments that pay.",
      "一个策略，而不只是因子打分：仓位是因子 z 分数裁剪到 ±2.5（页面自己的约定），再缩放到 " + num(TARGET_VOL * 100, 0) +
      "% 年化波动目标（只在训练段上校准）。论文的解法随后在同一胶带上作为实验运行——常开 versus 主场路由，后者只在兑现段里持仓。") });

    function decimate(arr) {
      var k = Math.max(1, Math.floor(arr.length / 240));
      var out = [];
      for (var q = 0; q < arr.length; q += k) out.push(arr[q]);
      if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
      return out;
    }
    blocks.push({ k: "chart", variant: "line", log: true,
      label: t("equity · always-on, vol-targeted (holdout)", "净值 · 常开 + 波动目标（留出集）"),
      series: decimate(mAlways.equity) });
    blocks.push({ k: "chart", variant: "line", log: true,
      label: t("equity · venue-routed (holdout)", "净值 · 主场路由（留出集）"),
      series: decimate(mRouted.equity) });

    blocks.push({ k: "kv", items: [
      { k: "train vol (ann)", v: num(trainVol * 100, 1) + "%" },
      { k: "vol scale", v: "×" + num(scale, 3) },
      { k: "Sharpe · always-on", v: num(mAlways.sharpe, 2), tone: mAlways.sharpe > 1 ? "ok" : "" },
      { k: "Sharpe · venue-routed", v: num(mRouted.sharpe, 2), tone: mRouted.sharpe > mAlways.sharpe ? "ok" : "" },
      { k: "max DD · routed", v: num(mRouted.maxDD * 100, 1) + "%" },
      { k: "turnover · routed", v: num(mRouted.turnover, 3) }
    ] });

    blocks.push({ k: "table",
      head: [{ t: "mode" }, { t: "Sharpe", num: true }, { t: "max DD", num: true },
        { t: "turnover", num: true }, { t: "hit", num: true }],
      rows: [
        [{ t: t("always-on (raw)", "常开（原始）") }, { t: num(mRaw.sharpe, 2), num: true },
          { t: num(mRaw.maxDD * 100, 1) + "%", num: true }, { t: num(mRaw.turnover, 3), num: true },
          { t: num(mRaw.hit * 100, 1) + "%", num: true }],
        [{ t: t("always-on (vol-targeted)", "常开（波动目标）") }, { t: num(mAlways.sharpe, 2), num: true },
          { t: num(mAlways.maxDD * 100, 1) + "%", num: true }, { t: num(mAlways.turnover, 3), num: true },
          { t: num(mAlways.hit * 100, 1) + "%", num: true }],
        [{ t: t("venue-routed", "主场路由") }, { t: num(mRouted.sharpe, 2), num: true, tone: mRouted.sharpe > mAlways.sharpe ? "ok" : "" },
          { t: num(mRouted.maxDD * 100, 1) + "%", num: true }, { t: num(mRouted.turnover, 3), num: true },
          { t: num(mRouted.hit * 100, 1) + "%", num: true }]
      ] });

    var better = mRouted.sharpe > mAlways.sharpe;
    blocks.push({ k: "verdict",
      tone: better ? "ok" : "warn",
      h: better
        ? t("venue routing beats always-on on this tape", "本胶带上主场路由胜过常开")
        : t("always-on wins on this tape — the resolution is not free", "本胶带上常开更强——解法不是免费的"),
      b: t(
        "Holdout Sharpe " + num(mAlways.sharpe, 2) + " always-on versus " + num(mRouted.sharpe, 2) +
        " venue-routed. The paper's resolution law is a claim about pools where home-profitable factors were discarded — here you can watch it hold or fail on one declared tape, and either answer is printed as measured.",
        "留出集 Sharpe：常开 " + num(mAlways.sharpe, 2) + " versus 主场路由 " + num(mRouted.sharpe, 2) +
        "。论文的解法定律是关于「有主场因子的池子」的断言——在这里你可以看它在一条声明胶带上成立还是失败，两种答案都按实测印出。"),
      plain: better
        ? t("Trading this factor only where it pays beats trading it everywhere.", "只在这个因子兑现的地方交易它，胜过到处交易它。")
        : t("On this tape, trading it everywhere was simply better.", "在这条胶带上，到处交易它反而更好。") });

    blocks.push({ k: "note", text: t(
      "Declared: positions = clip(z, ±2.5)/2.5 with no fitted parameters; vol target " + num(TARGET_VOL * 100, 0) +
      "% annual calibrated on the train block only, scale capped at ×2; venue mask from " + SEGMENTS +
      " segments paying at block t ≥ " + PAY_T + ". No costs, no slippage, one tape, one seed. A backtest is a backtest — this one is labelled declared-synthetic.",
      "声明：仓位 = clip(z, ±2.5)/2.5，无拟合参数；波动目标 " + num(TARGET_VOL * 100, 0) +
      "% 年化，只在训练段校准，缩放上限 ×2；主场掩码来自 " + SEGMENTS + " 个段、段 t ≥ " + PAY_T +
      " 记为兑现。无成本、无滑点、一条胶带、一个种子。回测就是回测——这一个标注为声明合成数据。") });

    blocks.push({ k: "actions", items: [
      { label: t("council this factor", "让议会裁决这个因子"), fn: function () { ask("council " + expr); } },
      { label: t("permutation-test it", "对它做置换检验"), fn: function () { ask("placebo test " + expr); } },
      { label: t("show its venue map", "看它的主场地图"), fn: function () { ask("find the venue for " + expr); } }
    ] });

    return {
      steps: steps,
      blocks: blocks,
      strategy: {
        expr: expr, trainVol: trainVol, scale: scale,
        always: { sharpe: mAlways.sharpe, maxDD: mAlways.maxDD, turnover: mAlways.turnover, hit: mAlways.hit },
        routed: { sharpe: mRouted.sharpe, maxDD: mRouted.maxDD, turnover: mRouted.turnover, hit: mRouted.hit },
        raw: { sharpe: mRaw.sharpe }, cut: cut, n: n
      }
    };
  }

  /* ============================================================== foundry */
  /* Plain language -> a legal factor expression. Offline: a template table
     matched on keywords. With a brain: the model compiles an expression
     from the gate's DSL (tool compose_factor) — and either way the result
     is re-parsed and re-measured here, so the model cannot invent a number. */
  var TEMPLATES = [
    { id: "imbalance", keys: ["imbalance", "order book", "盘口", "失衡", "挂单"],
      expr: "(BidSize - AskSize) / (BidSize + AskSize)",
      name: { en: "order-book imbalance", zh: "盘口失衡" } },
    { id: "momentum", keys: ["momentum", "trend", "动量", "趋势"],
      expr: "Rank(MidPrice - Mean[20](MidPrice))",
      name: { en: "price momentum", zh: "价格动量" } },
    { id: "reversal", keys: ["reversal", "mean reversion", "反转", "回归"],
      expr: "Rank(Mean[5](MidPrice) - MidPrice)",
      name: { en: "short-term reversal", zh: "短期反转" } },
    { id: "volatility", keys: ["volatility", "vol", "波动"],
      expr: "Std[20](MidPrice)",
      name: { en: "realized volatility", zh: "已实现波动" } },
    { id: "volume", keys: ["volume", "放量", "成交量"],
      expr: "Rank(Volume / Mean[20](Volume))",
      name: { en: "volume surge", zh: "放量" } },
    { id: "spread", keys: ["spread", "价差", "买卖价差"],
      expr: "Rank(BestAsk - BestBid)",
      name: { en: "quoted spread", zh: "报价价差" } },
    { id: "trade", keys: ["trade", "成交", "主动成交"],
      expr: "Rank(TradeSize / Mean[20](TradeSize))",
      name: { en: "trade intensity", zh: "成交强度" } },
    { id: "range", keys: ["range", "位置", "区间"],
      expr: "Rank(MidPrice / Mean[20](MidPrice))",
      name: { en: "price against its own mean", zh: "价格对自身均值" } },
    { id: "slope", keys: ["slope", "斜率", "趋势强度"],
      expr: "Slope[20](MidPrice)",
      name: { en: "trend slope", zh: "趋势斜率" } },
    { id: "zscore", keys: ["zscore", "z-score", "标准化", "z 分数"],
      expr: "Zscore[20](MidPrice)",
      name: { en: "price z-score", zh: "价格 z 分数" } },
    { id: "logret", keys: ["return", "收益", "对数"],
      expr: "Log(MidPrice / Mean[20](MidPrice))",
      name: { en: "log deviation from mean", zh: "对均值的对数偏离" } }
  ];

  function foundry(slots) {
    var steps = [], blocks = [];
    var idea = String(slots.idea || slots.text || "").trim();
    var expr = slots.expr ? String(slots.expr).trim() : null;
    var matched = null;

    if (!expr && idea) {
      var low = idea.toLowerCase();
      var best = null, bestHits = 0;
      TEMPLATES.forEach(function (tp) {
        var hits = 0;
        tp.keys.forEach(function (k) { if (low.indexOf(k.toLowerCase()) !== -1) hits++; });
        if (hits > bestHits) { bestHits = hits; best = tp; }
      });
      if (best) { matched = best; expr = best.expr; }
    }

    if (!expr) {
      return {
        steps: [{ name: "route", args: "foundry", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The foundry needs an idea", "造因子器需要一个想法"),
          b: t("Say it in plain words — “order-book imbalance”, “momentum”, “volume surge”, “where price sits in its range”… " +
              TEMPLATES.length + " templates are built in; with a brain attached the model compiles from the gate's full DSL instead.",
            "用大白话说——「盘口失衡」「动量」「放量」「价格在区间里的位置」……内置 " + TEMPLATES.length +
            " 个模板；接上大脑后，模型按闸门文法全量编译。") }],
        foundry: { expr: null, matched: null, ok: false }
      };
    }

    var P = parseExpr(expr);
    steps.push({ name: "foundry.compile", args: expr, status: P.err ? "fail" : "ok",
      detail: P.err ? ("gate grammar: " + P.err) : "the gate's own parser accepted it" });

    var st = null;
    if (!P.err) {
      var sig = evalExpr(expr);
      if (sig) {
        var M0 = market();
        st = window.HJ_ML.stats(sig, M0.fwd);
        steps.push({ name: "ml.stats", args: "(sig, fwd)", status: "ok",
          detail: "IC = " + num(st.ic, 4) + " · t = " + num(st.icT, 2) });
      }
    }

    blocks.push({ k: "prose", text: matched
      ? t("“" + idea + "” → " + matched.name.en + ", compiled to a legal expression and re-measured on the declared tape:",
        "「" + idea + "」→ " + matched.name.zh + "，编译为合法表达式，并在声明胶带上重新测量：")
      : t("Compiled from the model's DSL draft, then re-parsed and re-measured here — the compiler never grades its own homework:",
        "由模型的 DSL 草稿编译，然后在这里重新解析、重新测量——编译者从不给自己的作业打分：") });

    blocks.push({ k: "kv", items: [
      { k: "expression", v: expr },
      { k: "grammar", v: P.err ? ("rejected · " + P.err) : "accepted", tone: P.err ? "no" : "ok" },
      { k: "IC", v: st ? num(st.ic, 4) : "—" },
      { k: "t", v: st ? num(st.icT, 2) : "—", tone: st && Math.abs(st.icT) >= SCREEN ? "ok" : "" },
      { k: "Sharpe", v: st ? num(st.sharpe, 2) : "—" },
      { k: "π measured", v: st ? num(st.pi * 100, 1) + "%" : "—" }
    ] });

    blocks.push({ k: "verdict",
      tone: P.err ? "no" : (st && Math.abs(st.icT) >= SCREEN ? "ok" : "warn"),
      h: P.err
        ? t("the grammar rejected it", "文法不接受它")
        : t("compiled and measured", "编译并测量完成"),
      b: P.err
        ? t("The gate's parser said: " + P.err + ". A factor that cannot parse cannot be judged — that is the first of the nine gates.",
          "闸门文法返回：" + P.err + "。无法解析的因子无法被评判——这是九道闸的第一道。")
        : t("IC " + num(st.ic, 4) + " · t " + num(st.icT, 2) + " on the declared tape. Now send it through the full judgement — the gate, the council, the placebo.",
          "声明胶带上 IC " + num(st.ic, 4) + " · t " + num(st.icT, 2) + "。现在送它去完整审判——闸门、议会、置换检验。"),
      plain: P.err ? t("This one does not even parse.", "这个连解析都过不了。")
        : t("It compiles, and here is what it measures on the declared tape.", "它编译通过，这是它在声明胶带上的测量值。") });

    blocks.push({ k: "actions", items: [
      { label: t("judge it at the gate", "送它过闸门"), fn: function () { ask("judge " + expr); } },
      { label: t("council it", "让议会裁决它"), fn: function () { ask("council " + expr); } },
      { label: t("build a strategy on it", "以它建策略"), fn: function () { ask("build a strategy on " + expr); } }
    ] });

    return { steps: steps, blocks: blocks, foundry: { expr: expr, matched: matched && matched.id, ok: !P.err, st: st } };
  }

  /* =============================================================== about */
  /* The author, from the record only. Every fact carries its source; a
     question the record cannot answer is refused, not guessed.          */
  var FACTS = [
    { id: "who", keys: ["who are you", "who built", "author", "huannian", "jin", "金宦年", "你是谁", "作者", "介绍一下你"],
      en: "Huannian Jin (金宦年) — independent researcher and builder. This site is the work sample: every instrument on it was built to argue one paper.",
      zh: "金宦年（Huannian Jin）——独立研究者兼 builder。这个站点就是作品样本：上面的每件仪器都是为了论证一篇论文而造的。",
      source: "this site · the application" },
    { id: "born", keys: ["born", "age", "出生", "年龄", "多大"],
      en: "Born April 2006.",
      zh: "2006 年 4 月出生。",
      source: "the applicant" },
    { id: "haa", keys: ["haa", "a16z", "andreessen", "academy", "fellowship", "申请", "学院"],
      en: "Applying to the a16z Horowitz Andreessen Academy (HAA) 2027 Founding Class Fellowship — one year in San Francisco, no degree, about fifty people; early deadline 2026-11-05. Admission is weighted on proof of work, and the portfolio link is the centrepiece of Stage 1.",
      zh: "正在申请 a16z Horowitz Andreessen Academy（HAA）2027 创始班级奖学金——一年、旧金山线下、不授学位、约五十人；提前批截止 2026-11-05。录取高度看 proof of work，作品集链接是 Stage 1 的核心材料。",
      source: "theacademysf.com/admissions" },
    { id: "paper", keys: ["paper", "thesis", "discarded", "alive", "ssrn", "7607684", "proposition", "论文", "命题"],
      en: "“Discarded but Alive: What Factor Screening Throws Away, and What It Cannot Recover” — working paper, SSRN abstract 7607684, ORCID 0009-0006-9124-9152. A universal |t|<1.96 screen discards factors that pay only in their home venue; of 179 anomalies, the 94 rejected in large caps earn out-of-sample Sharpe 0.85 as-is and 1.30 reallocated as a group (FF6 α 3.8%/yr, t = 8.3); reproduced out of sample in China (+0.95, p = 0). The correction has a ceiling: q²(τ) = τ/(1+τ), half-recovery at m* ≈ 1.3.",
      zh: "《Discarded but Alive: What Factor Screening Throws Away, and What It Cannot Recover》——工作论文，SSRN 摘要 7607684，ORCID 0009-0006-9124-9152。通用 |t|<1.96 筛选会丢掉只在自己主场兑现的因子；179 个异常里，大盘股中被拒的 94 个单独样本外 Sharpe 0.85，按组再配置后 1.30（FF6 α 3.8%/yr，t = 8.3）；在中国样本外复现（+0.95，p = 0）。修正有天花板：q²(τ) = τ/(1+τ)，m* ≈ 1.3 处半恢复。",
      source: "SSRN 7607684 · §04 / §06 of this site" },
    { id: "stack", keys: ["stack", "rust", "python", "flutter", "技术栈", "架构", "zheshang"],
      en: "Rust for the compute core, Python for strategies and AI, Flutter for the desk UI; 56 modules shipped at Zheshang systems; the AI factor factory is the paper's own machinery.",
      zh: "Rust 做计算内核，Python 跑策略与 AI，Flutter 画桌面端；在浙商系统交付 56 个模块；AI 因子工厂就是论文自己的机器。",
      source: "§00 desk section" },
    { id: "book", keys: ["book", "account", "账户", "实盘", "moutai", "茅台", "600519"],
      en: "A personal A-share book of roughly ¥1.00M, with 600519.SH (Moutai) as the walkthrough lens — labelled separately from the paper track, and never mixed into its numbers.",
      zh: "个人 A 股账户约 ¥1.00M，以 600519.SH（贵州茅台）为走读标的——与论文轨道分开标注，数字从不混入。",
      source: "§00 desk figures" },
    { id: "site", keys: ["site", "seed", "reproducible", "复现", "种子", "诚实"],
      en: "Every number on this site is recomputed in your browser from frozen runs, under a fixed seed (20261105); the deterministic path makes zero network requests; backtests are labelled as backtests.",
      zh: "这个站点上的每个数字都在你的浏览器里从冻结运行重算，固定种子 20261105；确定性路径零网络请求；回测一律标注为回测。",
      source: "this site" },
    { id: "goals", keys: ["goal", "aim", "plan", "phd", "目标", "计划", "博士"],
      en: "Stated aims: the HAA 2027 founding class; the paper's next stop is journal review, with the WFA Trefftz Award as the declared target; a PhD-track research seat after the fellowship year.",
      zh: "公开的目标：HAA 2027 创始班；论文的下一站是期刊评审，WFA Trefftz Award 是宣示的目标；奖学金年之后走博士研究轨道。",
      source: "the applicant" },
    { id: "contact", keys: ["contact", "reach", "email", "github", "联系"],
      en: "SSRN page (abstract 7607684), ORCID 0009-0006-9124-9152, and the public repro repository at github.com/nemo02070118/boatfx-repro.",
      zh: "SSRN 页面（摘要 7607684）、ORCID 0009-0006-9124-9152，以及公开复现仓库 github.com/nemo02070118/boatfx-repro。",
      source: "this site's links" }
  ];

  function about(question) {
    var steps = [], blocks = [];
    var q = String(question || "").toLowerCase();
    var scored = FACTS.map(function (f) {
      var hits = 0;
      f.keys.forEach(function (k) { if (q.indexOf(k.toLowerCase()) !== -1) hits++; });
      return { f: f, hits: hits };
    }).filter(function (r) { return r.hits > 0; });
    scored.sort(function (a, b) { return b.hits - a.hits; });
    var top = scored.slice(0, 3).map(function (r) { return r.f; });

    steps.push({ name: "about.match", args: "record · " + FACTS.length + " facts", status: "ok",
      detail: top.length ? ("matched: " + top.map(function (f) { return f.id; }).join(", ")) : "no fact matched" });

    if (!top.length) {
      blocks.push({ k: "verdict", tone: "no",
        h: t("Not in the record", "记录里没有"),
        b: t("I only answer about the author from facts this site can source — the biography, the paper, the stack, the desk, the goals, how to reach him. " +
            "Ask one of those, or attach a brain (top right) and a real language model will answer freely — still without inventing a number from the instruments.",
          "关于作者，我只回答这个站点能给出来源的事实——生平、论文、技术栈、桌面、目标、联系方式。问这些里的一个，或者接上大脑（右上角），" +
          "让真语言模型自由回答——但仪器返回的数字它照样不许编。"),
        plain: t("That one is outside what the record can source.", "这个超出了记录能给出来源的范围。") });
      blocks.push({ k: "note", text: t(
        "Try: “who built this?” · “what is the paper's claim?” · “what is the stack?” · “what are the goals?” · “how do I reach him?”",
        "可以问：「这是谁做的？」「论文的核心主张是什么？」「技术栈是什么？」「目标是什么？」「怎么联系他？」") });
      return { steps: steps, blocks: blocks, about: { matched: [] } };
    }

    blocks.push({ k: "prose", text: t(
      "From the record — every line below carries its source:",
      "来自记录——下面每一行都带来源：") });
    top.forEach(function (f) {
      blocks.push({ k: "prose", text: t(f.en, f.zh) });
    });
    blocks.push({ k: "note", text: t(
      "Sources: " + top.map(function (f) { return f.id + " — " + f.source; }).join(" · ") +
      " · everything here is on the public record; nothing is inferred.",
      "来源：" + top.map(function (f) { return f.id + " — " + f.source; }).join(" · ") + "· 全部来自公开记录，没有推断。") });
    blocks.push({ k: "verdict", tone: "ok",
      h: t("Answered from the record", "已按记录回答"),
      b: t("Every sentence above is sourced on this site. Attach a brain and the model answers freely about the author too — under the same rule: no number that did not come back from an instrument.",
        "上面每句都在本站有来源。接上大脑后模型也可以自由回答作者相关问题——同一条规则：不是仪器返回的数字，不许说。"),
      plain: t("Straight from the public record.", "直接来自公开记录。") });

    blocks.push({ k: "actions", items: [
      { label: t("what is the paper's claim?", "论文的核心主张是什么？"), fn: function () { ask("what is the paper's claim?"); } },
      { label: t("how do I reach him?", "怎么联系他？"), fn: function () { ask("how do I reach him?"); } },
      { label: t("what is the stack?", "技术栈是什么？"), fn: function () { ask("what is the stack?"); } }
    ] });

    return { steps: steps, blocks: blocks, about: { matched: top.map(function (f) { return f.id; }) } };
  }

  /* ------------------------------------------------------------- export */
  window.HJ_ENGINES = {
    version: VERSION,
    venueFind: venueFind,
    resurrect: resurrect,
    strategyBuild: strategyBuild,
    foundry: foundry,
    about: about,
    facts: FACTS,
    templates: TEMPLATES,
    helpers: {
      blockT: blockT, seriesStats: seriesStats, parseLib: parseLib,
      parseExpr: parseExpr, evalExpr: evalExpr, market: market, spear: spear,
      meanOf: meanOf, stdOf: stdOf, num: num, t: t
    },
    constants: {
      SCREEN: SCREEN, ALLOC: ALLOC, D_EFF: D_EFF, BLK: BLK,
      SEGMENTS: SEGMENTS, PAY_T: PAY_T, TARGET_VOL: TARGET_VOL,
      SPLIT: SPLIT, SEED: SEED
    }
  };
})();
