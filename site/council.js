/* ==========================================================================
   BOAT · 00b council — seven personas, one verdict
   --------------------------------------------------------------------------
   The deliberation layer. Six voters each read the SAME computed facts
   through their own lens, a devil's advocate argues the dissent, and the
   captain aggregates. Stances and conviction are computed from public
   thresholds (printed in the note block) — never from the model. When a
   brain is attached, each persona delivers its speech through a real
   language-model call with its own role prompt, under the same rule as
   everything else on this page: no number that did not come back from an
   instrument.
   ========================================================================== */
(function () {
  "use strict";

  function eng() { return window.HJ_ENGINES; }
  function t(en, zh) {
    try {
      var s = localStorage.getItem("hj-lang");
      if (s === "zh") return zh;
      if (s === "en") return en;
    } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : en;
  }
  function num(x, d) {
    d = d == null ? 2 : d;
    if (x == null || !isFinite(x)) return "—";
    var p = Math.pow(10, d);
    return (Math.round(x * p) / p).toFixed(d);
  }

  /* ---------------------------------------------------------- personas */
  var PERSONAS = [
    { id: "captain", ac: "#5ec9a8", weight: 0,
      name: { en: "Captain", zh: "舰长" },
      role: { en: "adjudicates · aggregates the votes", zh: "综合裁决 · 汇总投票" } },
    { id: "stat", ac: "#38bdf8", weight: 1.3,
      name: { en: "Statistician", zh: "统计官" },
      role: { en: "t, π, the dilution identity", zh: "t、π、稀释恒等式" } },
    { id: "phys", ac: "#a78bfa", weight: 1.0,
      name: { en: "Physics engine", zh: "物理引擎" },
      role: { en: "the walls · q² · the phase", zh: "两道墙 · q² · 相变" } },
    { id: "factor", ac: "#22d3ee", weight: 1.1,
      name: { en: "Factor analyst", zh: "因子分析师" },
      role: { en: "IC, block-t, the tape's own read", zh: "IC、区块 t、胶带自己的读数" } },
    { id: "risk", ac: "#fb7185", weight: 0.9,
      name: { en: "Risk officer", zh: "风控官" },
      role: { en: "drawdown · the cost of the kill", zh: "回撤 · 误杀的代价" } },
    { id: "exec", ac: "#fbbf24", weight: 0.9,
      name: { en: "Execution officer", zh: "执行官" },
      role: { en: "sample · placebo · sufficiency", zh: "样本 · 置换 · 充分性" } },
    { id: "devil", ac: "#f0997b", weight: 0,
      name: { en: "Devil's advocate", zh: "辩手" },
      role: { en: "argues the dissent · does not vote", zh: "专职反调 · 不参与投票" } }
  ];
  var VOTERS = PERSONAS.filter(function (p) { return p.weight > 0; });

  /* ------------------------------------------------------ fact gathering */
  function gather(slots) {
    var E = eng();
    var C = E.constants;
    var f = {
      mode: "stat", expr: null, name: null,
      t: (slots.t != null && isFinite(slots.t)) ? slots.t : null,
      pi: (slots.pi != null && isFinite(slots.pi) && slots.pi > 0 && slots.pi <= 1) ? slots.pi : 0.25,
      piDeclared: !!(slots.pi != null && isFinite(slots.pi)),
      N: (slots.N && slots.N >= 20) ? Math.floor(slots.N) : 6960,
      series: null, st: null, n: null, placeboP: null
    };
    if (slots.expr) {
      var sig = E.helpers.evalExpr(slots.expr);
      if (sig) {
        var M0 = E.helpers.market();
        f.mode = "tape";
        f.expr = slots.expr;
        f.series = sig;
        f.st = window.HJ_ML.stats(sig, M0.fwd);
        f.n = Math.min(sig.length, M0.fwd.length);
        f.t = f.st.icT;
        f.pi = f.st.pi;                 /* measured on the tape, not assumed */
        f.piDeclared = false;
        try {
          f.placeboP = window.HJ_ML.placebo(sig, M0.fwd, 200, C.SEED).p;
        } catch (e) { f.placeboP = null; }
      }
    } else if (slots.series && slots.series.length >= 8) {
      f.mode = "series";
      f.series = slots.series;
      f.st = E.helpers.seriesStats(slots.series);
      f.n = f.st.n;
      if (f.t == null) f.t = f.st.t;
    } else if (slots.lib) {
      var rows = E.helpers.parseLib(slots.lib);
      if (rows.length) {
        f.mode = "library";
        f.rows = rows;
        var mis = rows.filter(function (r) {
          var pi = r.pi != null ? r.pi : 0.25;
          return r.t >= C.ALLOC && r.t * Math.sqrt(pi) < C.SCREEN;
        });
        f.libMis = mis.length;
        f.libRows = rows.length;
        var pool = function (list) {
          if (!list.length) return null;
          var s = 0;
          list.forEach(function (r) { s += r.t; });
          return (s / list.length) * Math.sqrt(list.length);
        };
        f.pooledMis = pool(mis);
        f.pooledAll = pool(rows);
        f.t = f.pooledMis != null ? f.pooledMis : f.pooledAll;
        var piSum = 0, piN = 0;
        rows.forEach(function (r) { if (r.pi != null) { piSum += r.pi; piN++; } });
        f.pi = piN ? piSum / piN : 0.25;
      }
    }
    f.tg = (f.t != null) ? f.t * Math.sqrt(f.pi) : null;
    f.wall = Math.sqrt(2 * Math.log(f.N));
    return f;
  }

  /* ------------------------------------------------------------ the reads */
  function readStat(f) {
    var C = eng().constants;
    if (f.t == null) return { stance: "abstain", score: null, why: "no t" };
    var mis = f.t >= C.ALLOC && f.tg < C.SCREEN;
    if (mis) {
      return {
        stance: "revive", score: 88,
        reason: t(
          "t = " + num(f.t, 2) + " clears the allocation bar √(2 ln 17) = " + num(C.ALLOC, 4) +
          " but t_g = " + num(f.t, 2) + "·√" + num(f.pi, 3) + " = " + num(f.tg, 2) +
          " falls under the " + num(C.SCREEN, 2) + " screen. That is the mis-kill geometry, exactly — Prop. 2 in one line.",
          "t = " + num(f.t, 2) + " 过了配置线 √(2 ln 17) = " + num(C.ALLOC, 4) +
          "，但 t_g = " + num(f.t, 2) + "·√" + num(f.pi, 3) + " = " + num(f.tg, 2) +
          " 低于 " + num(C.SCREEN, 2) + " 筛选线。这正是误杀几何——命题 2 一行说完。")
      };
    }
    if (f.tg >= C.SCREEN) {
      return {
        stance: "admit", score: Math.min(96, 70 + (f.tg - C.SCREEN) * 18),
        reason: t(
          "t_g = " + num(f.tg, 2) + " survives dilution (t = " + num(f.t, 2) + ", π = " + num(f.pi, 3) +
          ") and clears the " + num(C.SCREEN, 2) + " screen.",
          "t_g = " + num(f.tg, 2) + " 在稀释后存活（t = " + num(f.t, 2) + "，π = " + num(f.pi, 3) +
          "），且过 " + num(C.SCREEN, 2) + " 筛选线。")
      };
    }
    if (f.tg >= 1.5) {
      return {
        stance: "watch", score: 45 + (f.tg - 1.5) * 30,
        reason: t(
          "t_g = " + num(f.tg, 2) + " is close to the screen but under it, and t = " + num(f.t, 2) +
          " does not reach the allocation bar — no mis-kill claim available.",
          "t_g = " + num(f.tg, 2) + " 贴近筛选线但在其下，且 t = " + num(f.t, 2) +
          " 未到配置线——提不出误杀主张。")
      };
    }
    return {
      stance: "reject", score: Math.max(0, 12 + f.tg * 10),
      reason: t(
        "t_g = " + num(f.tg, 2) + " is far under the screen. The honest reading is “no evidence”, not “weak evidence”.",
        "t_g = " + num(f.tg, 2) + " 远低于筛选线。诚实的读法是「没有证据」，不是「证据较弱」。")
    };
  }

  function readPhys(f) {
    var C = eng().constants;
    if (f.t == null) return { stance: "abstain", score: null, why: "no t" };
    var gap = f.wall - C.ALLOC;
    var base = t(
      "N = " + f.N.toLocaleString("en-US") + " → discovery wall √(2 ln N) = " + num(f.wall, 2) +
      ", allocation wall √(2 ln 17) = " + num(C.ALLOC, 4) + ", gap " + num(gap, 2) +
      ". q²(τ) = τ/(1+τ): half-recovery at m* ≈ 1.3, so the correction itself has a ceiling.",
      "N = " + f.N.toLocaleString("en-US") + " → 发现墙 √(2 ln N) = " + num(f.wall, 2) +
      "，配置墙 √(2 ln 17) = " + num(C.ALLOC, 4) + "，差距 " + num(gap, 2) +
      "。q²(τ) = τ/(1+τ)：m* ≈ 1.3 处半恢复，修正本身有天花板。");
    if (f.tg >= f.wall) {
      return { stance: "admit", score: 82, reason: t(
        "t_g = " + num(f.tg, 2) + " clears even the discovery wall. " + base,
        "t_g = " + num(f.tg, 2) + " 连发现墙都过了。" + base) };
    }
    if (f.tg >= C.ALLOC) {
      return { stance: "watch", score: 56, reason: t(
        "t_g = " + num(f.tg, 2) + " sits between the two walls — home-venue territory, below the universal bar. " + base,
        "t_g = " + num(f.tg, 2) + " 落在两墙之间——主场 territory，在通用线之下。" + base) };
    }
    if (f.tg >= C.SCREEN) {
      return { stance: "watch", score: 48, reason: t(
        "t_g = " + num(f.tg, 2) + " clears the screen but not the allocation wall: it pays at home, not everywhere. " + base,
        "t_g = " + num(f.tg, 2) + " 过筛但不过配置墙：它在主场兑现，不是到处兑现。" + base) };
    }
    return { stance: "reject", score: 18, reason: t(
      "t_g = " + num(f.tg, 2) + " is below every wall on this page. " + base,
      "t_g = " + num(f.tg, 2) + " 低于本页每一道墙。" + base) };
  }

  function readFactor(f) {
    if (!f.st || f.st.ic == null) {
      return { stance: "abstain", score: null,
        reason: t("No tape: IC is not computable from a bare t-stat. Paste a series or an expression and I vote.",
          "没有胶带：光凭 t 值算不出 IC。粘贴序列或表达式，我才投票。") };
    }
    var at = Math.abs(f.st.icT);
    var C = eng().constants;
    if (at >= C.ALLOC) {
      return { stance: "admit", score: Math.min(96, 76 + (at - C.ALLOC) * 8),
        reason: t(
          "IC = " + num(f.st.ic, 4) + " with block-t " + num(at, 2) + " across " + f.st.blocks +
          " non-overlapping blocks, Sharpe " + num(f.st.sharpe, 2) + " — clears the allocation bar on the tape's own read.",
          "IC = " + num(f.st.ic, 4) + "，区块 t " + num(at, 2) + "，跨 " + f.st.blocks +
          " 个不重叠区块，Sharpe " + num(f.st.sharpe, 2) + "——按胶带自己的读数过了配置线。") };
    }
    if (at >= C.SCREEN) {
      return { stance: "watch", score: 55,
        reason: t(
          "IC = " + num(f.st.ic, 4) + " with block-t " + num(at, 2) + " — over the screen, under the allocation bar.",
          "IC = " + num(f.st.ic, 4) + "，区块 t " + num(at, 2) + "——过筛，未过配置线。") };
    }
    return { stance: "reject", score: 16,
      reason: t(
        "IC = " + num(f.st.ic, 4) + " with block-t " + num(at, 2) + " — indistinguishable from zero on this tape.",
        "IC = " + num(f.st.ic, 4) + "，区块 t " + num(at, 2) + "——在这条胶带上与零区分不开。") };
  }

  function readRisk(f) {
    var C = eng().constants;
    var mis = f.t != null && f.t >= C.ALLOC && f.tg < C.SCREEN;
    if (f.st && f.st.maxDD != null) {
      var vol = f.st.sd != null ? f.st.sd * Math.sqrt(252) : 0;
      var ratio = vol > 1e-9 ? f.st.maxDD / vol : null;
      if (mis) {
        return { stance: "revive", score: 85,
          reason: t(
            "The risk is not the factor — it is the kill. max DD " + num(f.st.maxDD * 100, 1) +
            "% against " + num(vol * 100, 1) + "% annual vol (ratio " + num(ratio, 2) +
            "), and the screen is about to bin a t = " + num(f.t, 2) + " factor on dilution alone.",
            "风险不在因子——在误杀。最大回撤 " + num(f.st.maxDD * 100, 1) + "% 对年化波动 " + num(vol * 100, 1) +
            "%（比值 " + num(ratio, 2) + "），而筛选线正准备仅因稀释就扔掉一个 t = " + num(f.t, 2) + " 的因子。") };
      }
      if (ratio != null && ratio <= 0.5) {
        return { stance: "admit", score: 74,
          reason: t("max DD " + num(f.st.maxDD * 100, 1) + "% against " + num(vol * 100, 1) +
            "% annual vol (ratio " + num(ratio, 2) + ") — shallow for what it is.",
            "最大回撤 " + num(f.st.maxDD * 100, 1) + "% 对年化波动 " + num(vol * 100, 1) +
            "%（比值 " + num(ratio, 2) + "）——就它而言很浅。") };
      }
      if (ratio != null && ratio <= 1) {
        return { stance: "watch", score: 50,
          reason: t("max DD " + num(f.st.maxDD * 100, 1) + "% against " + num(vol * 100, 1) +
            "% annual vol (ratio " + num(ratio, 2) + ") — ordinary, not alarming.",
            "最大回撤 " + num(f.st.maxDD * 100, 1) + "% 对年化波动 " + num(vol * 100, 1) +
            "%（比值 " + num(ratio, 2) + "）——寻常，不警报。") };
      }
      return { stance: "reject", score: 24,
        reason: t("max DD " + num(f.st.maxDD * 100, 1) + "% against " + num(vol * 100, 1) +
          "% annual vol (ratio " + num(ratio, 2) + ") — the tail is doing the talking.",
          "最大回撤 " + num(f.st.maxDD * 100, 1) + "% 对年化波动 " + num(vol * 100, 1) +
          "%（比值 " + num(ratio, 2) + "）——尾部在说话。") };
    }
    if (mis) {
      return { stance: "revive", score: 85,
        reason: t("No series, so no drawdown — but the mis-kill geometry is itself the risk: a t = " + num(f.t, 2) +
          " factor binned for dilution alone.", "没有序列，就没有回撤——但误杀几何本身就是风险：一个 t = " + num(f.t, 2) + " 的因子仅因稀释被扔。") };
    }
    return { stance: "abstain", score: null,
      reason: t("No series: drawdown is not computable from a t-stat alone.", "没有序列：光凭 t 值算不出回撤。") };
  }

  function readExec(f) {
    var n = f.n != null ? f.n : (f.series ? f.series.length : null);
    if (n == null) return { stance: "abstain", score: null, why: "no n" };
    var ns = n >= 250 ? 68 : (n >= 60 ? 50 : 20);
    var parts = [t("n = " + n + " bars", "n = " + n + " 根")];
    if (f.placeboP != null) {
      var ps = f.placeboP > 0.05 ? 25 : 70;
      parts.push(t("placebo p = " + num(f.placeboP, 3), "置换 p = " + num(f.placeboP, 3)));
      return {
        stance: Math.min(ns, ps) >= 60 ? "admit" : (Math.min(ns, ps) >= 40 ? "watch" : "reject"),
        score: Math.min(ns, ps),
        reason: t(parts.join(" · ") + " — the weaker of sample size and placebo sets the score.",
          parts.join(" · ") + "——样本量与置换检验里较弱的那个定分。")
      };
    }
    return {
      stance: ns >= 60 ? "watch" : "reject", score: ns,
      reason: t(parts.join(" · ") + (n >= 250 ? " — enough structure to study." : " — thin structure; treat every number as provisional."),
        parts.join(" · ") + (n >= 250 ? "——结构足够，可以研究。" : "——结构单薄；每个数字都只当临时值看。"))
    };
  }

  /* -------------------------------------------------------- deliberation */
  function deliberate(f) {
    var reads = {
      stat: readStat(f), phys: readPhys(f), factor: readFactor(f),
      risk: readRisk(f), exec: readExec(f)
    };
    var wsum = 0, wden = 0;
    VOTERS.forEach(function (p) {
      var r = reads[p.id];
      if (r.score != null) { wsum += p.weight * r.score; wden += p.weight; }
    });
    var score = wden > 0 ? wsum / wden : null;

    /* the devil argues the dissent and does not vote — declared */
    var weakest = null;
    VOTERS.forEach(function (p) {
      var r = reads[p.id];
      if (r.score != null && (!weakest || r.score < weakest.r.score)) weakest = { p: p, r: r };
    });
    var devilScore = score == null ? null : Math.max(0, Math.min(100, 100 - score));
    var devilStance = devilScore == null ? "abstain" : (devilScore >= 70 ? "admit" : (devilScore >= 45 ? "watch" : "reject"));
    var devilReason = t(
      "The dissent, argued on the record: " + (weakest
        ? "the weakest link is the " + weakest.p.name.en + " at " + num(weakest.r.score, 0) +
          " — “" + weakest.r.reason + "”. Everything else is arithmetic around that soft spot."
        : "every voter abstained, so the council has nothing to argue about."),
      "唱反调，按记录唱：" + (weakest
        ? "最弱的一环是" + weakest.p.name.zh + "，" + num(weakest.r.score, 0) +
          " 分——「" + weakest.r.reason + "」。其余一切都是围绕这个软点的算术。"
        : "所有投票者都弃权了，议会无可争辩。"));

    var personas = PERSONAS.map(function (p) {
      if (p.id === "captain") {
        return {
          id: p.id, ac: p.ac, name: p.name, role: p.role, weight: p.weight,
          stance: "adjudicates", score: score, abstain: false,
          reason: t(
            "Weighted over " + VOTERS.length + " voters (weights printed in the note): " +
            VOTERS.map(function (v) { return v.name.en + " " + v.weight + "×" + (reads[v.id].score == null ? "—" : num(reads[v.id].score, 0)); }).join(", ") +
            " → " + (score == null ? "no vote" : num(score, 1)) + " / 100.",
            "在 " + VOTERS.length + " 个投票者上加权（权重印在注释里）：" +
            VOTERS.map(function (v) { return v.name.zh + " " + v.weight + "×" + (reads[v.id].score == null ? "—" : num(reads[v.id].score, 0)); }).join("、") +
            " → " + (score == null ? "无票" : num(score, 1)) + " / 100。")
        };
      }
      if (p.id === "devil") {
        return {
          id: p.id, ac: p.ac, name: p.name, role: p.role, weight: p.weight,
          stance: devilStance, score: devilScore, abstain: devilScore == null, reason: devilReason
        };
      }
      var r = reads[p.id];
      return {
        id: p.id, ac: p.ac, name: p.name, role: p.role, weight: p.weight,
        stance: r.stance, score: r.score, abstain: r.score == null, reason: r.reason
      };
    });

    /* verdict: bands are declared; the mis-kill override is the paper's move */
    var key = "reject", tone = "no";
    if (score != null) {
      if (score >= 70) { key = "admit"; tone = "ok"; }
      else if (score >= 45) { key = "watch"; tone = "warn"; }
    }
    var revived = false;
    if (reads.stat.stance === "revive" && (score == null || score < 70)) {
      key = "revive"; tone = "warn"; revived = true;
    }
    return { personas: personas, score: score, key: key, tone: tone, revived: revived, reads: reads };
  }

  /* ------------------------------------------------------------- verdict */
  function verdictText(f, d) {
    var C = eng().constants;
    var s = d.score == null ? "—" : num(d.score, 1);
    var heads = {
      admit: t("the council admits it", "议会裁定：准入"),
      watch: t("the council watches it", "议会裁定：观望"),
      reject: t("the council rejects it", "议会裁定：拒绝"),
      revive: t("mis-killed — the council revives it", "误杀——议会裁定：翻案复活")
    };
    var plains = {
      admit: t("Six lenses, one answer: this factor earns its seat.", "六种视角，一个答案：这个因子配得上它的座位。"),
      watch: t("Six lenses, no consensus: worth watching, not worth a bet.", "六种视角，没有共识：值得看，不值得下注。"),
      reject: t("Six lenses, one answer: the evidence is not there.", "六种视角，一个答案：证据不在。"),
      revive: t("The screen would bin a factor that is alive in its own home — the council overrules the screen.",
        "筛选线会扔掉一个在自己主场活着的因子——议会推翻筛选线。")
    };
    var body = d.revived
      ? t(
        "The statistician's geometry is decisive: t = " + num(f.t, 2) + " clears the allocation bar while t_g = " +
        num(f.tg, 2) + " falls under the screen — the mis-kill the paper is named after. Composite " + s +
        "/100 would have said “watch”; the mis-kill rule overrides, because the cost of the kill is the paper's whole subject.",
        "统计官的几何是决定性的：t = " + num(f.t, 2) + " 过配置线，而 t_g = " + num(f.tg, 2) +
        " 低于筛选线——这正是论文得名的那个误杀。综合分 " + s +
        "/100 本来只会说「观望」；误杀规则推翻它，因为误杀的代价就是这篇论文的全部主题。")
      : t(
        "Composite " + s + "/100 over five weighted voters, the devil's dissent recorded but not counted. " +
        "Every number above came back from an instrument in this tab; the stance thresholds are printed below.",
        "综合分 " + s + "/100，五个加权投票者得出，辩手的异议记录在案但不计票。上面每个数字都来自本页仪器的一次返回；立场阈值印在下面。");
    return { h: heads[d.key], b: body, plain: plains[d.key] };
  }

  /* ---------------------------------------------------------------- run */
  function run(slots) {
    var steps = [], blocks = [];
    var E = eng();
    if (!E || !window.HJ_ML) return { steps: [{ name: "instruments", args: "engines", status: "fail" }], blocks: [] };
    var C = E.constants;

    var f = gather(slots);
    steps.push({ name: "route", args: "council · " + f.mode, status: "ok",
      detail: f.expr ? ("expr = " + f.expr) : (f.mode === "library" ? ("library · " + f.libRows + " rows") : (f.series ? ("series · " + f.n + " bars") : "t / π / N")) });

    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var d = deliberate(f);
    var ms = Math.max(0, Math.round((((window.performance && performance.now) ? performance.now() : 0) - t0) * 100) / 100);
    steps.push({ name: "council.deliberate", args: "(" + VOTERS.length + " voters + devil)", status: "ok", ms: ms });

    var v = verdictText(f, d);
    var question = f.expr ? f.expr
      : (f.mode === "library" ? t("a pasted factor library", "一个粘贴进来的因子库")
      : (f.series ? t("a pasted return series", "一段粘贴进来的收益序列")
      : t("t = " + num(f.t, 2) + " · π = " + num(f.pi, 2) + " · N = " + f.N, "t = " + num(f.t, 2) + " · π = " + num(f.pi, 2) + " · N = " + f.N)));

    blocks.push({ k: "prose", text: t(
      "The council on " + question + ". Six voters read the same computed facts through their own lenses; the devil argues the dissent and does not vote; the captain aggregates. Stances and conviction are computed from the thresholds printed below — the model, when attached, only writes the speeches.",
      "议会审议：" + question + "。六个投票者透过自己的视角读同一批算出来的事实；辩手唱反调且不投票；舰长汇总。立场与信念度由下面印出的阈值计算——接上模型时，它只写发言。") });

    blocks.push({ k: "council", council: { question: question, mode: f.mode, facts: f, personas: d.personas, verdict: { score: d.score, key: d.key, tone: d.tone, h: v.h, b: v.b, plain: v.plain } } });

    blocks.push({ k: "kv", items: [
      { k: "t", v: num(f.t, 2), tone: f.t != null && Math.abs(f.t) >= C.ALLOC ? "ok" : "" },
      { k: "π", v: num(f.pi, 3) + (f.piDeclared ? "" : " *") },
      { k: "t_g = t·√π", v: num(f.tg, 2), tone: f.tg != null && f.tg >= C.SCREEN ? "ok" : "no" },
      { k: "N", v: f.N.toLocaleString("en-US") },
      { k: "discovery wall", v: num(f.wall, 2) },
      { k: "IC", v: f.st && f.st.ic != null ? num(f.st.ic, 4) : "—" },
      { k: "placebo p", v: f.placeboP != null ? num(f.placeboP, 3) : "—" }
    ] });

    blocks.push({ k: "table",
      head: [{ t: "persona" }, { t: "stance" }, { t: "conviction", num: true }, { t: "weight", num: true }],
      rows: d.personas.map(function (p) {
        return [
          { t: t(p.name.en, p.name.zh) },
          { t: p.stance, tone: p.stance === "admit" || p.stance === "revive" ? "ok" : (p.stance === "reject" ? "no" : (p.stance === "abstain" ? "" : "warn")) },
          { t: p.score == null ? "—" : num(p.score, 0), num: true },
          { t: p.weight ? num(p.weight, 1) + "×" : "—", num: true }
        ];
      }) });

    blocks.push({ k: "verdict", tone: d.tone, h: v.h, b: v.b, plain: v.plain });

    blocks.push({ k: "note", text: t(
      "Declared policy: weights stat 1.3 · factor 1.1 · phys 1.0 · risk 0.9 · exec 0.9; bands ≥70 admit, 45–70 watch, <45 reject; " +
      "the devil's advocate advises but never votes; the mis-kill rule (t ≥ 2.3803 with t_g < 1.96) overrides the composite. " +
      "π marked * is measured on the declared tape, not assumed. One tape, one seed, one generative process.",
      "声明策略：权重 统计 1.3 · 因子 1.1 · 物理 1.0 · 风控 0.9 · 执行 0.9；≥70 准入，45–70 观望，<45 拒绝；" +
      "辩手只建议不投票；误杀规则（t ≥ 2.3803 且 t_g < 1.96）推翻综合分。标 * 的 π 是声明胶带上的实测值，不是假设。一条胶带、一个种子、一个生成过程。") });

    blocks.push({ k: "actions", items: [
      { label: t("placebo-test the evidence", "对证据做置换检验"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask(f.expr ? ("placebo test " + f.expr) : "placebo test the imbalance factor");
      } },
      { label: t("find its home venue", "找它的主场"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask(f.expr ? ("find the venue for " + f.expr) : "find the venue for the imbalance factor");
      } },
      { label: t("run the resurrection bench", "跑复活台"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("resurrect the shipped sample library");
      } }
    ] });

    return {
      steps: steps,
      blocks: blocks,
      council: {
        question: question, mode: f.mode, facts: f,
        personas: d.personas,
        verdict: { score: d.score, key: d.key, tone: d.tone, h: v.h, b: v.b, plain: v.plain }
      }
    };
  }

  /* ------------------------------------------------------------- render */
  var STANCE_LABEL = {
    admit: { en: "admit", zh: "准入" },
    revive: { en: "revive", zh: "翻案" },
    watch: { en: "watch", zh: "观望" },
    reject: { en: "reject", zh: "拒绝" },
    abstain: { en: "abstain", zh: "弃权" },
    adjudicates: { en: "adjudicates", zh: "裁决" }
  };
  function div(cls, text) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function stanceLabel(s) {
    var l = STANCE_LABEL[s] || STANCE_LABEL.abstain;
    return t(l.en, l.zh);
  }

  function renderCouncil(host, data) {
    var wrap = div("ag-council");
    var head = div("ag-council-h");
    head.appendChild(div("ag-council-t", t("council · 议会", "议会 · council")));
    head.appendChild(div("ag-council-q", data.question));
    head.appendChild(div("ag-council-n", t("7 personas · stances computed from printed thresholds", "7 个智体 · 立场由印出的阈值计算")));
    wrap.appendChild(head);

    var rows = div("ag-council-rows");
    data._slots = {};
    var captain = null;
    data.personas.forEach(function (p) {
      if (p.id === "captain") { captain = p; return; }
      var row = div("ag-c-persona");
      row.style.setProperty("--ac", p.ac);
      var top = div("ag-c-p-top");
      top.appendChild(div("ag-c-p-name", t(p.name.en, p.name.zh)));
      top.appendChild(div("ag-c-p-role", t(p.role.en, p.role.zh)));
      top.appendChild(div("ag-c-p-chip is-" + p.stance, stanceLabel(p.stance)));
      top.appendChild(div("ag-c-p-score", p.score == null ? "—" : num(p.score, 0)));
      row.appendChild(top);
      var bar = div("ag-c-p-bar");
      var fill = div("ag-c-p-fill");
      bar.appendChild(fill);
      row.appendChild(bar);
      setTimeout(function () { fill.style.width = (p.score == null ? 0 : Math.max(2, p.score)) + "%"; }, 30);
      var reason = div("ag-c-p-reason");
      reason.textContent = p.reason;
      row.appendChild(reason);
      var speech = div("ag-c-p-speech");
      speech.hidden = true;
      speech.appendChild(div("ag-c-p-tag", t("model", "模型")));
      var body = div("ag-c-p-speech-b");
      speech.appendChild(body);
      row.appendChild(speech);
      data._slots[p.id] = { host: speech, body: body };
      rows.appendChild(row);
    });
    wrap.appendChild(rows);

    var v = data.verdict;
    var vb = div("ag-c-verdict is-" + v.key);
    vb.appendChild(div("ag-c-v-score", v.score == null ? "—" : num(v.score, 0)));
    var vt = div("ag-c-v-text");
    vt.appendChild(div("ag-c-v-h", v.h));
    vt.appendChild(div("ag-c-v-b", v.b));
    if (v.plain && window.HJ_PLAIN !== false) vt.appendChild(div("ag-c-v-plain", v.plain));
    if (captain) vt.appendChild(div("ag-c-v-cap", captain.reason));
    /* the captain speaks last, into the verdict bar itself */
    var cspeech = div("ag-c-v-speech");
    cspeech.hidden = true;
    cspeech.appendChild(div("ag-c-p-tag", t("model", "模型")));
    var cbody = div("ag-c-p-speech-b");
    cspeech.appendChild(cbody);
    vt.appendChild(cspeech);
    data._slots.captain = { host: cspeech, body: cbody };
    vb.appendChild(vt);
    wrap.appendChild(vb);
    host.appendChild(wrap);
  }

  /* ------------------------------------------------- model-facing digest */
  function digestOf(data) {
    var f = data.facts;
    function r4(x) { return x == null ? null : +num(x, 4); }
    var out = {
      question: data.question,
      facts: {
        t: r4(f.t), pi: r4(f.pi), tg: r4(f.tg), N: f.N,
        ic: r4(f.st && f.st.ic), icT: r4(f.st && f.st.icT),
        sharpe: r4(f.st && f.st.sharpe), maxDD: r4(f.st && f.st.maxDD),
        placeboP: r4(f.placeboP), pooledMis: r4(f.pooledMis)
      },
      votes: data.personas.map(function (p) {
        return { persona: p.id, stance: p.stance, score: p.score == null ? null : Math.round(p.score) };
      }),
      verdict: { key: data.verdict.key, score: data.verdict.score == null ? null : Math.round(data.verdict.score) }
    };
    return JSON.stringify(out);
  }

  /* ------------------------------------------------------- the speeches */
  function personaSystem(p, data, digest) {
    var langName = t("English", "Chinese");
    return t(
      "You are " + p.name.en + ", " + p.role.en + " on boat-1's research council. GROUND RULES — not suggestions:\n" +
      "1. You may not state, estimate, round or imply any number that is not in the DIGEST below.\n" +
      "2. Argue your computed stance (" + p.stance + ", conviction " + (p.score == null ? "abstain" : Math.round(p.score)) +
      "/100). If you are the devil's advocate, attack the weakest link on the record.\n" +
      "3. One paragraph, at most 70 words, in character, in " + langName + ". No headers, no lists.\n" +
      "4. Your listener is a researcher evaluating this portfolio. Be specific, be brief, be honest about uncertainty.\n\n" +
      "DIGEST (the only numbers you may use): " + digest,
      "你是 boat-1 研究议会上的" + p.name.zh + "，" + p.role.zh + "。基本规则——不是建议：\n" +
      "1. 凡是下方 DIGEST 里没有的数字，你一律不许说、不许估、不许四舍五入、不许暗示。\n" +
      "2. 论证你的计算立场（" + p.stance + "，信念度 " + (p.score == null ? "弃权" : Math.round(p.score)) +
      "/100）。如果你是辩手，就攻击记录上最弱的那一环。\n" +
      "3. 一段话，最多 70 字，用角色口吻，用中文。不要标题，不要列表。\n" +
      "4. 你的听众是评估这个作品集的研究者。具体、简短、对不确定性诚实。\n\n" +
      "DIGEST（唯一可用的数字）：" + digest);
  }
  function speechPrompt(data) {
    return t("Deliver your read on: " + data.question, "就以下议题发表你的读数：" + data.question);
  }

  /* Sequential, one real model call per persona, in deliberation order:
     the five voters, then the devil, then the captain last. A failure in
     any seat leaves that seat's computed reason in place — the council
     never breaks.                                                        */
  function speakAll(data) {
    var L = window.HJ_LLM;
    if (!L || !L.active || !L.active()) return;
    var order = ["stat", "phys", "factor", "risk", "exec", "devil", "captain"];
    var digest = digestOf(data);
    var i = 0;
    function next() {
      if (i >= order.length) return;
      var id = order[i++];
      var p = null;
      data.personas.forEach(function (x) { if (x.id === id) p = x; });
      var slot = data._slots && data._slots[id];
      if (!p || !slot) { next(); return; }
      slot.host.hidden = false;
      slot.host.classList.add("is-live");
      L.chat({ system: personaSystem(p, data, digest), text: speechPrompt(data), tools: [] })
        .then(function (res) {
          slot.host.classList.remove("is-live");
          slot.host.classList.add("is-model");
          slot.body.textContent = String(res.text || "").trim();
          next();
        })
        .catch(function () {
          slot.host.classList.remove("is-live");
          slot.host.hidden = true;
          next();
        });
    }
    next();
  }

  /* ------------------------------------------------------------- export */
  window.HJ_COUNCIL = {
    version: "v1.0",
    run: run,
    personas: PERSONAS,
    renderCouncil: renderCouncil,
    speakAll: speakAll,
    digestOf: digestOf
  };
})();
