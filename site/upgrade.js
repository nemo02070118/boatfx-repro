/* ==========================================================================
   BOAT · in-place upgrade layer  (v1)
   --------------------------------------------------------------------------
   Runs BEFORE app.js on purpose: it takes over the #proof terminal block, so
   the original typewriter (app.js: initTerminal) finds nothing to type into and
   bows out cleanly. Everything else is additive: one ribbon, one modal, one
   bridge line. No existing markup, class or number is replaced.

   Ground rules kept from the project AGENTS.md:
     - every figure printed by the console is either (a) computed here, in the
       tab, from a formula, or (b) quoted from the shipped paper / repro pack.
     - no invented data, no fake live feeds, no implied returns.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- i18n */
  function lang() {
    try {
      var saved = localStorage.getItem("hj-lang");
      if (saved === "zh" || saved === "en") return saved;
    } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
  }
  function t(en, zh) {
    return lang() === "zh" ? zh : en;
  }

  /* ------------------------------------------------------------- helpers */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function fmt(x, d) {
    return Number(x).toFixed(d == null ? 2 : d);
  }
  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += " ";
    return s;
  }
  /* display width — a CJK glyph occupies two terminal columns, so `pad` alone
     leaves every Chinese column one space short. */
  function dw(s) {
    s = String(s);
    var w = 0, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      w += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) ||
        (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
        (c >= 0xffe0 && c <= 0xffe6))) ? 2 : 1;
    }
    return w;
  }
  function padw(s, n) {
    s = String(s);
    var w = dw(s);
    while (w < n) { s += " "; w++; }
    return s;
  }

  /* Acklam inverse normal CDF — used by the curse command */
  function invNorm(p) {
    var a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
      1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
    var b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
      6.680131188771972e1, -1.328068155288572e1];
    var c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
      -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
    var d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
      3.754408661907416e0];
    var pl = 0.02425, q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) return -invNorm(1 - p);
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  /* seeded uniform — mulberry32 */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function boxMuller(u) {
    var r = Math.sqrt(-2 * Math.log(u() || 1e-12));
    return r * Math.cos(2 * Math.PI * u());
  }
  /* one-sample t of a vector — the estimator §04b runs on visitor data */
  function tstat(xs) {
    var n = xs.length, i, s = 0;
    if (n < 2) return 0;
    for (i = 0; i < n; i++) s += xs[i];
    var m = s / n, v = 0;
    for (i = 0; i < n; i++) { var d = xs[i] - m; v += d * d; }
    var sd = Math.sqrt(v / (n - 1));
    return sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
  }
  /* ------------------------------------------------------- paper constants */
  var SCREEN = 1.96;
  var D_EFF = 17;
  var ALLOC = Math.sqrt(2 * Math.log(D_EFF)); /* 2.3803 */
  function q2m(m) { var tau = m / 1.29; return tau / (1 + tau); }
  function sp(n) { var s = ""; while (s.length < n) s += " "; return s; }

  /* a curve, drawn with block characters — the terminal is a canvas too.
     Width adapts: 50 columns on a desk, 30 on a phone, so it never wraps. */
  function plotCurve(title, x0, x1, ymax, f, xlab, mark) {
    var narrow = (window.innerWidth || 1200) < 620;
    var W = narrow ? 30 : 50, H = narrow ? 7 : 9, grid = [], i, j;
    for (i = 0; i < H; i++) { grid.push(new Array(W)); for (j = 0; j < W; j++) grid[i][j] = " "; }
    /* the marker goes down first, so the curve is drawn on top of it */
    var mcol = -1;
    if (mark != null && isFinite(mark) && x1 > x0) {
      mcol = Math.round(((mark - x0) / (x1 - x0)) * (W - 1));
      if (mcol >= 0 && mcol < W) for (i = 0; i < H; i++) grid[i][mcol] = "┊";
    }
    var N = W * 6;
    for (i = 0; i <= N; i++) {
      var x = x0 + (x1 - x0) * (i / N);
      var y = f(x);
      if (!isFinite(y)) continue;
      var col = Math.round((i / N) * (W - 1));
      var row = Math.round((1 - Math.min(Math.max(y / ymax, 0), 1)) * (H - 1));
      if (grid[row] && grid[row][col] != null && grid[row][col] === " ") grid[row][col] = "█";
    }
    line(title, "head");
    gap();
    for (i = 0; i < H; i++) {
      /* one decimal at least, so nine rows never round onto the same tick */
      var lab = fmt(ymax * (1 - i / (H - 1)), ymax >= 10 ? 1 : 2);
      line(" " + pad(lab, 5) + "┤" + grid[i].join(""), "dim");
    }
    line(" " + sp(5) + "┼" + new Array(W + 1).join("─"), "dim");
    var left = fmt(x0, 2), right = fmt(x1, 2);
    line(" " + sp(5) + " " + left + sp(Math.max(1, W - left.length - right.length)) + right, "dim");
    if (xlab) line(" " + sp(6) + xlab, "dim");
  }

  /* a button inside the output — the console is allowed to hand you the next
     move instead of only describing it */
  function termButton(label, fn) {
    var b = el("button", "term-act", label);
    b.type = "button";
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      fn();
      if (inEl) inEl.focus({ preventScroll: true });
    });
    return b;
  }
  function actLine(prefix, label, fn, cls) {
    var p = line(prefix, cls || "dim");
    if (p && p.appendChild) p.appendChild(termButton(label, fn));
    return p;
  }
  /* staggered reveal — CSS only, so the text is in the DOM the moment it is
     printed. A JS timer chain would make the run untestable and unquotable. */
  var STAGE_I = 0;
  function stageLine(text, cls) {
    var p = line(text, cls);
    if (p) {
      p.classList.add("term-stage");
      p.style.setProperty("--d", (STAGE_I++ * 65) + "ms");
    }
    return p;
  }
  /* a long run ends scrolled to its last line, which is the least informative
     line to land on. Put the reader at the top of the run instead. */
  function scrollOutTo(node) {
    if (!outEl || !node || !node.getBoundingClientRect) return;
    var a = node.getBoundingClientRect(), b = outEl.getBoundingClientRect();
    outEl.scrollTop = Math.max(0, outEl.scrollTop + (a.top - b.top) - 6);
  }
  /* if a command arrives before the deferred welcome fires, the welcome is
     stale — printing it after the answer reads like a bug. */
  var SKIP_WELCOME = false;

  function copyText(txt, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    done(ok);
  }

  /* ------------------------------------------------------------ 1. ribbon */
  function buildGate() {
    var main = document.getElementById("top");
    if (!main || document.getElementById("haa-gate")) return;
    var gate = el("div", "haa-gate");
    gate.id = "haa-gate";
    gate.appendChild(el("span", "haa-dot"));
    gate.appendChild(el("b", null, "HAA 2027"));
    gate.appendChild(el("span", "haa-sep", "·"));
    gate.appendChild(el("span", "haa-note", t("Founding Class applicant · Early deadline 5 Nov 2026 · rolling review", "Founding Class 申请人 · Early 截止 2026-11-05 · 滚动审核")));
    gate.appendChild(el("span", "haa-note-short", t("Founding Class · Early 5 Nov", "Founding Class · Early 11-05")));
    var acts = el("span", "haa-actions");
    var pathBtn = el("button", "haa-primary", t("60-second path →", "60 秒路径 →"));
    pathBtn.type = "button";
    pathBtn.id = "haa-path";
    var why = el("a", null, t("Why HAA →", "为什么是 HAA →"));
    why.href = "#agency";
    acts.appendChild(pathBtn);
    acts.appendChild(why);
    gate.appendChild(acts);
    main.insertBefore(gate, main.firstChild);
  }

  /* ------------------------------------------------------ 2. the console */
  var CMD = {};      /* name -> {desc, run} */
  var HISTORY = [];
  var CMD_COUNT = 0;
  var REPLAY = [];   /* commands carried in on ?run=… */
  var outEl, inEl, shellEl, chipsEl;

  function line(text, cls) {
    if (!outEl) return null;
    var p = el("p", "term-line" + (cls ? " " + cls : ""), text);
    outEl.appendChild(p);
    outEl.scrollTop = outEl.scrollHeight;
    return p;
  }
  function gap() {
    if (outEl) outEl.appendChild(el("p", "term-line gap"));
  }

  var SECTIONS = ["terminal", "idea", "tour", "venues", "paper", "atlas", "math",
    "limit", "results", "machine", "factory", "letter", "edge", "fusion", "craft",
    "scale", "proof", "field", "hkex", "camp", "stack", "agency", "links"];

  var USAGE = {
    q2: "q2 1.29     |     q2 --m 94",
    diagnose: "diagnose --t 2.40 --pi 0.25",
    resurrect: "resurrect 3     |     resurrect --compare 12",
    curse: "curse --n 500 --seed 42",
    tournament: "tournament --leak",
    zoo: "zoo 6960",
    autopsy: "autopsy     |     autopsy lib",
    open: "open math",
    lang: "lang zh",
    theme: "theme light",
    cite: "cite --bibtex",
    help: "help diagnose",
    plot: "plot q2   |   plot dilution 2.40   |   plot pool 1.0   |   plot curse",
    gate: "gate \"Rank(BidSize / AskSize)\" --why \"queue asymmetry\"   |   gate --sweep   |   gate --sample 400",
    agent: "agent   |   agent --n 1200",
    sim: "sim --n 40 --alive 70 --mu 2.4",
    man: "man gate"
  };

  /* The long form. `help <cmd>` answers "how do I type it"; `man` answers
     "what is it actually doing to my number" — the question a reviewer asks. */
  var MAN = {
    gate: {
      syn: "gate \"<expression>\" [--why \"<sentence>\"]  ·  gate --sweep  ·  gate --sample <n>",
      body: [
        "The site claims a factor only enters if it is executable, non-constant,",
        "dispersed and argued. This runs that claim as code: a tokenizer, a Pratt",
        "parser over the shipped grammar, four front gates and four constitution",
        "checks. With no argument it reads whatever is in the §05b panel, so the",
        "terminal and the panel can never disagree.",
        "",
        "  G1 executability   parses · integer window in [2, 250] · Log needs a",
        "                     provably positive inner · Sqrt needs non-negative",
        "  G2 non-constancy   reads at least one signal",
        "  G3 dispersion      does not cancel itself (Sub/Div/Pow of x with x)",
        "  G4 rationale       at least a sentence, printed on the receipt",
        "  C1 look-ahead      unrepresentable in this grammar — no forward index",
        "  C2 numerical       flags a denominator that can reach zero",
        "  C3 turnover        flags a window under 5 days",
        "  C4 complexity      24 nodes · 5 signals · window ≤ 250",
        "  C5 novelty         not a duplicate of an admitted factor (canonical form)"
      ],
      does: "parses your string and reports properties of the program. It never reports a performance claim.",
      see: "agent · plot · gate --sample 400"
    },
    agent: {
      syn: "agent [--n 400]",
      body: [
        "One autonomous pass over a proposal stream, with nothing sent anywhere.",
        "It proposes, compiles, filters, judges, and then says out loud what it",
        "cannot decide. The proposal stream is a seeded grammar sampler inside",
        "gate.js — deliberately defective, because a generator that only emits",
        "good proposals is lying about what generators do.",
        "",
        "The pass ends by checking its own arithmetic: survivors after the budget",
        "stage must equal admitted + flagged. If that does not close, the funnel",
        "is wrong and it says so."
      ],
      does: "runs the whole gate over n proposals and closes the funnel arithmetic.",
      see: "gate · gate --sample 400 · autopsy"
    },
    plot: {
      syn: "plot q2 | plot dilution [t] | plot pool [mean|t] | plot curse",
      body: [
        "Four closed forms from the paper, drawn in the terminal with block",
        "characters. Each one is the same function the site quotes, evaluated",
        "here — there is no lookup table anywhere in this build.",
        "",
        "  q2         q²(τ) = τ/(1+τ), marked at the half-recovery point τ = 1.29",
        "  dilution   t_g = t·√π, Proposition 2, marked at π = 0.25",
        "  pool       pooled t = mean·√n, marked at the n* where it clears 2.3803",
        "  curse      E[max|t|] ≈ Φ⁻¹(1 − 1/2N), marked at N = 200"
      ],
      does: "evaluates and rasterises a curve; the ┊ is the marker, the █ is the function.",
      see: "q2 · curse · resurrect --compare"
    },
    sim: {
      syn: "sim --n 40 --alive 70 --mu 2.4",
      body: [
        "Generates a seeded synthetic factor library on the §04b bench, then",
        "pools it. Each row gets a t inside its own paying state and a π; the",
        "alive share decides how many rows are drawn from the state that pays.",
        "",
        "This exists so the bench can be exercised with no data at all. It is",
        "synthetic and labelled as such — paste your own library to replace it."
      ],
      does: "writes rows to the bench, runs the batch, and reports the pooled t and m*.",
      see: "resurrect --compare · autopsy lib"
    }
  };

  /* the gate's receipt, in the site's own prettyExpr format */
  function printGate(r, fromPanel) {
    var label = r.verdict === "admit" ? t("admit", "准入")
      : r.verdict === "flag" ? t("admit with flags", "带标记准入")
        : t("reject", "拒绝");
    line("gate · " + label + (fromPanel ? t("   (read from the §05b panel)", "   （取自 §05b 面板）") : ""),
      r.verdict === "reject" ? "warn" : "ok");
    gap();
    line("  " + r.src, "head");
    if (r.rationale) line("  " + t("why", "理由") + "  " + r.rationale, "dim");
    gap();
    var narrow = window.innerWidth < 620;
    r.gates.forEach(function (g) {
      var mark = !g.ok ? "✗" : (/flag|标记/.test(g.note) ? "!" : "✓");
      line("  " + mark + " " + g.id + " " + (narrow ? "" : padw(g.name, 19)) + g.note,
        !g.ok ? "warn" : (mark === "!" ? "dim" : ""));
    });
    gap();
    if (r.ast) {
      var txt = window.HJ_GATE.toText(r.ast);
      line("  " + t("AST", "AST") + "  " + txt, "dim");
      line("  " + r.nodes + " " + t("nodes", "节点") + " · " + r.signals.length + " " +
        t("signals", "信号") + " · " + t("window", "窗口") + " " + (r.maxWindow || "—") + " · " +
        t("rationale", "理由") + " " + r.rationale.trim().length + " " + t("chars", "字符"), "dim");
    } else {
      line("  " + t("nothing to compile — G1 stopped it at the parser.",
        "无从编译——G1 在解析器处就拦下了。"), "dim");
    }
    if (r.verdict === "reject" && r.gates.some(function (g) { return g.id === "G4" && !g.ok; })) {
      gap();
      line("  " + t("hint: a bare expression is not a proposal. Add --why \"your sentence\".",
        "提示：裸表达式不算提案。加上 --why \"你那句话\"。"), "dim");
    }
  }

  function registerConsole() {
    /* --- help */
    CMD.help = {
      desc: t("list every command", "列出全部命令"),
      run: function (a) {
        if (a && a[0] && CMD[a[0]]) {
          var c = CMD[a[0]];
          line(a[0], "head");
          line("  " + c.desc);
          if (USAGE[a[0]]) {
            gap();
            line("  usage   " + USAGE[a[0]], "dim");
          }
          return;
        }
        line(t("BOAT console · static build · every number is computed here or quoted from the shipped paper.",
          "BOAT 控制台 · 静态构建 · 每个数字都在此计算，或引自论文。"), "dim");
        gap();
        var groups = [
          [t("THE PAPER", "论文"), ["prove", "stats", "q2", "plot", "diagnose", "resurrect", "curse", "tournament", "zoo", "compare", "cite"]],
          [t("THE PIPELINE · run it yourself", "流水线 · 自己跑一遍"), ["agent", "gate", "sim"]],
          [t("YOUR OWN FACTOR", "你自己的因子"), ["autopsy"]],
          [t("CHECK ME", "验算我"), ["selftest", "share"]]
        ];
        groups.forEach(function (g) {
          line(g[0], "ok");
          g[1].forEach(function (name) {
            var c = CMD[name];
            if (!c) return;
            line("  " + pad(name, 14) + c.desc);
          });
        });
        line(pad(t("NAVIGATE", "导航"), 10) + "help · man · open · paper · ls · lang · theme · clear", "ok");
        line(pad(t("ABOUT", "关于"), 10) + "apply · whoami · honest · contact · factor", "ok");
        line(t("  help <command> for usage · man <command> for the long form · ↑ history · Tab completes",
          "  help <命令> 看用法 · man <命令> 看长说明 · ↑ 历史 · Tab 补全"), "dim");
      }
    };

    /* --- paper */
    CMD.paper = {
      desc: t("paper status", "论文状态"),
      run: function () {
        line("PAPER   Discarded but Alive: What Factor Screening Throws Away,", "head");
        line("        and What It Cannot Recover.", "head");
        line("  status    JF MS 2026-0738 · desk passed · external review", "ok");
        line("  venue     EFA submitted · SSRN abstract 7607684 · Oct 2026");
        line("  claim     94 |t|<1.96 rejects in large caps earn OOS Sharpe 0.85;");
        line("            1.30 reallocated as a group to their small-cap segment.");
        line("  limit     q²(τ)=τ/(1+τ) · half-recovery at m* ≈ 1.29");
        gap();
        line(t("  walk the claim tiers in §01c  →  type `open paper`", "  按论断层级走一遍 §01c  →  输入 `open paper`"), "dim");
      }
    };

    /* --- q2 */
    CMD.q2 = {
      desc: t("resolution law", "分辨率定律"),
      run: function (a) {
        var tau = 1, m = null;
        var i;
        for (i = 0; i < a.length; i++) {
          if (a[i] === "--m" && a[i + 1]) m = parseFloat(a[i + 1]);
          else if (!isNaN(parseFloat(a[i])) && a[i].indexOf("--") !== 0) tau = parseFloat(a[i]);
        }
        if (m != null) tau = m / 1.29;
        if (!isFinite(tau) || tau <= 0) { line("usage: q2 [tau]   or   q2 --m <pooled size>", "warn"); return; }
        var q2 = tau / (1 + tau);
        line("q²(τ) = τ / (1 + τ)", "head");
        gap();
        line("  τ (resolution scale)      " + fmt(tau, 3) + (m != null ? "   [m = " + fmt(m, 0) + "]" : ""));
        line("  q²                        " + fmt(q2, 4));
        line("  recoverable share of δ    " + fmt(q2 * 100, 1) + "%");
        gap();
        line("  anchors   m* ≈ 1.29 half-recovery   ·   pooled m=94 → q² ≈ 0.99", "dim");
        line("            per-factor m=1 → q² ≈ 0.43   ·   6 of 94 clear τ>1", "dim");
        line("  source    §04 Resolution Dial · Appendix IA.2, matched to Monte Carlo to 3 decimals", "dim");
      }
    };

    /* --- diagnose */
    CMD.diagnose = {
      desc: t("is a factor killed by the universal screen?", "因子是否被通用门槛误杀？"),
      run: function (a) {
        var tt = null, pi = null, i;
        for (i = 0; i < a.length; i++) {
          if (a[i] === "--t" && a[i + 1]) tt = parseFloat(a[i + 1]);
          if (a[i] === "--pi" && a[i + 1]) pi = parseFloat(a[i + 1]);
        }
        if (tt == null || pi == null) {
          line("usage: diagnose --t <state t-stat> --pi <home share 0-1>", "warn");
          line("  example: diagnose --t 2.40 --pi 0.25", "dim");
          return;
        }
        if (pi <= 0 || pi > 1) { line("--pi must be in (0, 1]", "warn"); return; }
        var tg = tt * Math.sqrt(pi);
        var need = Math.pow(1.96 / tt, 2);
        line("dilution identity   t_g ≈ t_state · √π", "head");
        gap();
        line("  t_state (inside the paying state)   " + fmt(tt, 2));
        line("  π (share of the panel in that state) " + fmt(pi, 3));
        line("  t_g (global, what the screen sees)   " + fmt(tt, 2) + " × √" + fmt(pi, 3) + " = " + fmt(tg, 3));
        gap();
        if (tg >= 1.96) {
          line("  VERDICT  survives the |t| ≥ 1.96 gate", "ok");
        } else {
          line("  VERDICT  KILLED by the |t| ≥ 1.96 gate", "warn");
          line("           the factor is alive at t=" + fmt(tt, 2) + " inside its state —");
          line("           the gate is measuring exposure, not signal.");
        }
        gap();
        line("  to survive at this t you would need π ≥ " + fmt(need, 3) +
          (need > 1 ? "  (unreachable)" : ""), "dim");
        line("  source   Proposition 2 · §03 blind-spot identity", "dim");
        if (tg < 1.96 && tt >= 2.38) {
          gap();
          line(t("  → this is a mis-kill. type `autopsy` to run the full report on your own data.",
            "  → 这就是误杀。输入 `autopsy` 用你自己的数据跑完整报告。"), "ok");
        }
      }
    };

    /* --- resurrect */
    CMD.resurrect = {
      desc: t("sample a discard · --compare pools a library", "抽样被丢弃的因子 · --compare 合并因子库"),
      run: function (a) {
        if (a.indexOf("--compare") >= 0) { poolCompare(a); return; }
        var n = parseInt(a[0], 10);
        if (!(n > 0)) n = 1;
        n = Math.min(n, 5);
        line(t("resurrection board · draw " + n + " of 94 discards", "复活板 · 抽取 " + n + " / 94"), "head");
        gap();
        var i;
        for (i = 0; i < n; i++) {
          var id = String(Math.floor(Math.random() * 94) + 1);
          while (id.length < 3) id = "0" + id;
          line("  #F-" + id + "   unconditional t < 1.96 → killed in large caps");
          line("          home-venue OOS Sharpe    0.85   (where tested)");
          line("          pooled reallocation      1.30   (+0.45 vs practice)");
          line("          FF6 alpha                +3.8%/yr   t = 8.3 · GRS F = 51");
          line("          China A-share replicate  +0.95   5,441 stocks · p = 0");
          if (i < n - 1) gap();
        }
        gap();
        line("  the ladder is the study's aggregate across the 94, not a per-factor estimate.", "dim");
        line("  source   §05 Resurrection Board · frozen run 2026-10", "dim");
      }
    };

    /* --- curse */
    CMD.curse = {
      desc: t("winner's curse", "赢家诅咒"),
      run: function (a) {
        var n = 200, seed = 42, i;
        for (i = 0; i < a.length; i++) {
          if (a[i] === "--n" && a[i + 1]) n = parseInt(a[i + 1], 10);
          if (a[i] === "--seed" && a[i + 1]) seed = parseInt(a[i + 1], 10);
        }
        if (!(n > 1)) n = 200;
        n = Math.min(n, 50000);
        var u = rng(seed), mx = 0, k;
        for (k = 0; k < n; k++) {
          var z = Math.abs(boxMuller(u));
          if (z > mx) mx = z;
        }
        var expected = invNorm(1 - 1 / (2 * n));
        line("zero-advantage null · N = " + n + " factors · seed " + seed, "head");
        gap();
        line("  max |t| in this draw            " + fmt(mx, 2));
        line("  expected max |t| ≈ Φ⁻¹(1−1/2N)  " + fmt(expected, 2));
        line("  selection inflation            " + fmt(mx / 1.96, 2) + "×  vs one honest test");
        gap();
        line("  read it this way: with " + n + " coin-flip factors, the best one looks");
        line("  like a discovery before any of them has an edge.");
        gap();
        line("  paper anchor   in the zero-advantage null the oracle manufactures", "dim");
        line("                 5.9× the real gain — the ceiling is a curse, not a router.", "dim");
      }
    };

    /* --- tournament */
    CMD.tournament = {
      desc: t("router tournament", "路由器锦标赛"),
      run: function (a) {
        var leak = a.indexOf("--leak") >= 0;
        line("five learned routers vs the coarse baseline · honest tuning", "head");
        gap();
        line("  coarse baseline (pooled, m = 94)     Sharpe 1.30");
        line("  oracle (hindsight routing)           Sharpe 1.45");
        line("  five routers, tuned without leakage  Δ vs coarse ≤ 0.05");
        gap();
        line("  verdict   routing does not beat pooling. The ceiling is a winner's");
        line("            curse, so the paper reports the bound instead of a strategy.", "ok");
        if (leak) {
          gap();
          line("  --leak   tune on the test window: in-sample Δ rises, the router looks", "warn");
          line("           brilliant, then returns to ≤ 0.05 out of sample. The demo is", "warn");
          line("           the failure mode, not a result.", "warn");
        }
        gap();
        line("  source   Theorem 3 converse · §06 Tournament", "dim");
      }
    };

    /* --- prove */
    CMD.prove = {
      desc: t("headline arithmetic", "头条数字验算"),
      run: function () {
        line("claim   94 |t|<1.96 rejects earn OOS Sharpe 0.85 → 1.30 as a pool", "head");
        gap();
        line("  step 1  screen 179 anomalies at |t| ≥ 1.96 in large caps");
        line("          → 94 rejected, 85 kept");
        line("  step 2  reallocate the 94 as a group to their small-cap home segment");
        line("  step 3  OOS Sharpe   0.85 (tested)  →  1.30 (pooled)     Δ = +0.45");
        line("  step 4  FF6 alpha    +3.8%/yr   t = 8.3   GRS F(2,417) = 51");
        line("  step 5  China A-share panel, 5,441 stocks   +0.95   p = 0");
        gap();
        line("  ceiling q²(τ) = τ/(1+τ) · half-recovery m* ≈ 1.29 · 6 of 94 clear τ>1");
        gap();
        line("  source   shipped tilt OUTPUT · frozen run 2026-10 · not a live book", "dim");
        line("           python reproduce_headline.py → ~172 bps/yr · IR ≈ 1.99", "dim");
      }
    };

    /* --- repro */
    CMD.repro = {
      desc: t("reproduction pack", "复现包"),
      run: function () {
        line("git clone https://github.com/nemo02070118/boatfx-repro", "cmd");
        line("python repro.py                # 60/60 sample factors evaluated");
        line("python reproduce_headline.py   # ~172 bps/yr · IR ≈ 1.99");
        gap();
        line("  public    grammar + 60 sample factors + tilt OUTPUT");
        line("  withheld  full pool and the ranking policy — on purpose", "dim");
        line("  note      output shipped, router source is not. Backtest ≠ live book.", "dim");
      }
    };

    /* --- the council and the new engines, in the terminal */
    /* the agent stack loads dynamically (see index.html) — commands that
       need it wait for it instead of failing on a cold page */
    function whenAgent(fn) {
      var ready = function () {
        return window.HJ_COUNCIL && window.HJ_ENGINES && window.BoatAgent;
      };
      if (ready()) { fn(); return; }
      var n = 0;
      (function poll() {
        if (ready()) { fn(); return; }
        if (++n > 160) {
          line(t("the agent stack is still loading — give it a second and run it again",
            "智能体栈还在加载——稍等一秒再跑一次"), "warn");
          return;
        }
        setTimeout(poll, 50);
      })();
    }
    function agentAsk(text, note) {
      line(note, "ok");
      var node = document.getElementById("boat-agent");
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask(text);
    }
    CMD.council = {
      desc: t("convene the council on a factor", "召集议会裁决一个因子"),
      run: function (a) {
        var C = window.HJ_COUNCIL;
        if (!C) { line("council.js has not loaded", "warn"); return; }
        var raw = a.join(" ").trim() || "(BidSize - AskSize) / (BidSize + AskSize)";
        var out = C.run({ expr: raw });
        var co = out.council;
        if (!co) { line("the council could not convene", "warn"); return; }
        line("council · " + co.question, "head");
        gap();
        co.personas.forEach(function (p) {
          line("  " + pad(t(p.name.en, p.name.zh), 12) +
            (p.score == null ? " —" : String(Math.round(p.score)).padStart(3, " ")) + "  " + p.stance);
        });
        gap();
        line("  " + co.verdict.h, "ok");
        line("  " + co.verdict.b, "dim");
        gap();
        line("  open the agent panel for the full card →", "dim");
      }
    };
    CMD.ask = {
      desc: t("ask about the author — record only", "问作者的事——只按记录"),
      run: function (a) {
        var E = window.HJ_ENGINES;
        if (!E) { line("engines.js has not loaded", "warn"); return; }
        var q = a.join(" ").trim();
        if (!q) {
          line("usage: ask <question> — e.g. `ask what is the paper's claim`", "dim");
          return;
        }
        var out = E.about(q);
        out.blocks.forEach(function (b) {
          if (b.k === "prose") { line(b.text); gap(); }
          else if (b.k === "verdict") { line(b.h, "ok"); line(b.b, "dim"); }
          else if (b.k === "note") { line(b.text, "dim"); }
        });
      }
    };
    CMD.agents = {
      desc: t("the council roster", "议会花名册"),
      run: function () {
        var C = window.HJ_COUNCIL;
        if (!C) { line("council.js has not loaded", "warn"); return; }
        line("boat-1 council · 7 personas", "head");
        gap();
        C.personas.forEach(function (p) {
          line("  " + pad(t(p.name.en, p.name.zh), 14) + t(p.role.en, p.role.zh), "dim");
        });
        gap();
        line("  stances computed from printed thresholds · the model only writes speeches", "dim");
      }
    };
    CMD.venue = {
      desc: t("find a factor's home venue", "找因子的主场"),
      run: function (a) {
        var raw = a.join(" ").trim() || "(BidSize - AskSize) / (BidSize + AskSize)";
        agentAsk("find the venue for " + raw, t("sending to the venue finder →", "送入主场寻找器 →"));
      }
    };
    CMD.strategy = {
      desc: t("build a strategy on a factor", "以因子建策略"),
      run: function (a) {
        var raw = a.join(" ").trim() || "(BidSize - AskSize) / (BidSize + AskSize)";
        agentAsk("build a strategy on " + raw, t("sending to the strategy builder →", "送入策略构建器 →"));
      }
    };
    CMD.resurrect = {
      desc: t("run the resurrection bench on the sample library", "对样本库跑复活台"),
      run: function () {
        agentAsk("resurrect", t("sending to the resurrection bench →", "送入复活台 →"));
      }
    };
    CMD.research = {
      desc: t("run the full pipeline on a factor", "对因子跑完整流水线"),
      run: function (a) {
        var raw = a.join(" ").trim() || "(BidSize - AskSize) / (BidSize + AskSize)";
        agentAsk("research " + raw, t("sending to the pipeline →", "送入完整流水线 →"));
      }
    };

    /* wrap the agent-dependent commands so they wait for the dynamic stack */
    ["council", "ask", "agents", "venue", "strategy", "resurrect", "research", "evolve",
     "zoo", "experiment", "guide", "whatif", "validate"].forEach(function (name) {
      var inner = CMD[name];
      if (!inner) return;
      CMD[name] = {
        desc: inner.desc,
        run: function (a) { whenAgent(function () { inner.run(a); }); }
      };
    });
    CMD.zoo = {
      desc: t("the public factor library", "公开因子库"),
      run: function () {
        whenAgent(function () { agentAsk("what factors are public", t("sending to the zoo →", "送入动物园 →")); });
      }
    };
    CMD.experiment = {
      desc: t("the paper's experiment: the screen against home-venue pooling", "论文实验：通用筛 对 主场+池化"),
      run: function () {
        whenAgent(function () { agentAsk("run the experiment", t("sending to the experiment →", "送入实验 →")); });
      }
    };
    CMD.guide = {
      desc: t("the step-by-step strategy builder", "分步策略构建向导"),
      run: function () {
        whenAgent(function () { agentAsk("guide me through building a strategy", t("sending to the guide →", "送入向导 →")); });
      }
    };
    CMD.evolve = {
      desc: t("a genetic search for factors — crossover, mutation, all legal", "遗传搜索因子——交叉变异，全部合法"),
      run: function (a) {
        var m = /(\d+)\s*(代|gens?|generations?)/i.exec(a.join(" "));
        whenAgent(function () { agentAsk("evolve factors" + (m ? " " + m[1] + " generations" : ""), t("searching the grammar →", "搜索文法 →")); });
      }
    };
    CMD.whatif = {
      desc: t("the counterfactual engine — change one parameter, re-run everything", "反事实引擎——改一个参数，全部重跑"),
      run: function (a) {
        var raw = a.join(" ").trim();
        whenAgent(function () { agentAsk("what if " + (raw || "pi = 0.1"), t("sending to the counterfactual engine →", "送入反事实引擎 →")); });
      }
    };
    CMD.validate = {
      desc: t("validate your own factors or strategy with our method", "用我们的方法检验你自己的因子或策略"),
      run: function (a) {
        var raw = a.join(" ").trim();
        whenAgent(function () { agentAsk("validate " + (raw || "my factors"), t("sending to the validation bench →", "送入检验台 →")); });
      }
    };

    /* --- autopsy */
    CMD.autopsy = {
      desc: t("open the bench on your own factor", "打开解剖台，测你自己的因子"),
      run: function (a) {
        var m = (a[0] || "").toLowerCase();
        var mode = (m === "lib" || m === "library" || m === "batch") ? "batch"
          : (m === "t" || m === "stat") ? "stat" : "series";
        if (window.HJ_BENCH && window.HJ_BENCH.focus) {
          line(mode === "batch"
            ? t("opening 04b · Autopsy bench — paste your library, one factor per line", "正在打开 04b · 误杀解剖台——粘贴你的因子库，每行一个")
            : mode === "stat"
              ? t("opening 04b · Autopsy bench — type the t-stat you already have", "正在打开 04b · 误杀解剖台——直接输入你已有的 t 值")
              : t("opening 04b · Autopsy bench — paste a return series", "正在打开 04b · 误杀解剖台——粘贴一段收益序列"), "ok");
          window.HJ_BENCH.focus(mode);
        } else {
          whenLibs(function () {
            line(mode === "batch"
              ? t("opening 04b · Autopsy bench — paste your library, one factor per line", "正在打开 04b · 误杀解剖台——粘贴你的因子库，每行一个")
              : mode === "stat"
                ? t("opening 04b · Autopsy bench — type the t-stat you already have", "正在打开 04b · 误杀解剖台——直接输入你已有的 t 值")
                : t("opening 04b · Autopsy bench — paste a return series", "正在打开 04b · 误杀解剖台——粘贴一段收益序列"), "ok");
            window.HJ_BENCH.focus(mode);
          });
        }
      }
    };

    /* --- zoo */
    CMD.zoo = {
      desc: t("two hurdles as the zoo grows", "因子动物园变大时的两道门槛"),
      run: function (a) {
        var N = parseInt(a[0], 10);
        if (!(N > 1)) N = 6960;
        N = Math.min(N, 1e7);
        var univ = Math.sqrt(2 * Math.log(N));
        var alloc = Math.sqrt(2 * Math.log(17));
        line("hurdles · N = " + N.toLocaleString("en-US") + " candidates · d_eff = 17", "head");
        gap();
        line("  discovery  √(2 ln N)        " + fmt(univ, 2) + "   what a universal screen demands");
        line("  allocation √(2 ln d_eff)    " + fmt(alloc, 2) + "   what a home-venue bet needs");
        line("  gap                         " + fmt(univ - alloc, 2));
        gap();
        line("  the gap widens with N: every extra candidate raises the bar for all of them,");
        line("  including the ones that only pay inside one state.");
        gap();
        line("  measured on the 6,960 pool: ~94% of home-profitable factors are discarded.", "dim");
        line("  source   §04 The factor zoo · N=6,960, d_eff=17", "dim");
      }
    };

    /* --- compare */
    CMD.compare = {
      desc: t("pooled vs per-factor routing", "粗池 vs 逐因子路由"),
      run: function () {
        line("one WHERE decision vs many WHERE decisions", "head");
        gap();
        line("  pooled (m = 94, τ ≈ 72)      q² ≈ 0.99    Sharpe 0.85 → 1.30");
        line("  per-factor (m = 1, τ ≈ 0.77) q² ≈ 0.43    below half-recovery");
        line("  oracle (hindsight)           Sharpe 1.45   not implementable");
        gap();
        line("  the paper's move is the boring one: stop routing, pool the discards.", "ok");
        line("  source   §03 identification · §04 resolution law", "dim");
      }
    };

    /* --- factor */
    CMD.factor = {
      desc: t("draw a machine-emitted factor", "抽一个机器生成的因子"),
      run: function () {
        if (typeof SAMPLE_FACTORS === "undefined" || !SAMPLE_FACTORS.length) {
          line("factor pool not loaded", "warn");
          return;
        }
        var f = SAMPLE_FACTORS[Math.floor(Math.random() * SAMPLE_FACTORS.length)];
        line(f.name, "head");
        line("  " + f.rationale);
        if (typeof prettyExpr === "function") {
          gap();
          line(prettyExpr(f.expr), "dim");
        }
        gap();
        line("  one of 60 sample factors shipped in the public grammar.", "dim");
      }
    };

    /* --- stats */
    CMD.stats = {
      desc: t("the headline numbers in one screen", "一屏看完头条数字"),
      run: function () {
        line("headline tape", "head");
        gap();
        line("  discards revived            94 of 179 anomalies");
        line("  out-of-sample Sharpe        0.85 → 1.30   (+0.45)");
        line("  FF6 alpha                   +3.8%/yr   t = 8.3   GRS F = 51");
        line("  China replication           +0.95   p = 0   5,441 stocks");
        line("  pooled tilt                 172 bps/yr   IR ≈ 1.99");
        line("  same-base increments        24 / 24 positive");
        line("  machine pool                6,881 factors · 0 clear the screen");
        line("  falsification excess        6.4×");
        line("  oracle phantom gain         5.9× the real gain");
        line("  resolution ceiling          q²(τ)=τ/(1+τ) · m* ≈ 1.29");
        gap();
        line("  every line above is quoted from the paper or the shipped repro pack.", "dim");
      }
    };

    /* --- honest */
    CMD.honest = {
      desc: t("what this site does not claim", "这个站点不主张什么"),
      run: function () {
        line("limits, stated on purpose", "head");
        gap();
        line("  · backtests are not a live book, and not the JF claim under review.");
        line("  · the 94-factor ladder is an aggregate, not a per-factor forecast.");
        line("  · the router code is withheld; only the tilt OUTPUT ships.");
        line("  · the parliament is a seeded, deterministic simulation — it is a");
        line("    mechanism demo, not a live desk.");
        line("  · the winner's curse is shown as a failure, not buried.");
        gap();
        line("  if a number here is not reproducible, it is a bug — tell me.", "dim");
      }
    };

    /* --- cite */
    CMD.cite = {
      desc: t("how to cite the paper", "如何引用这篇论文"),
      run: function (a) {
        if (a && a[0] === "--bibtex") {
          var bib = [
            "@techreport{jin2026discarded,",
            "  author      = {Jin, Huannian},",
            "  title       = {Discarded but Alive: What Factor Screening Throws Away,",
            "                 and What It Cannot Recover},",
            "  year        = {2026},",
            "  month       = {October},",
            "  type        = {SSRN Working Paper},",
            "  number      = {7607684},",
            "  note        = {JF MS 2026-0738; EFA submitted}"
          ].join("\n");
          line("bibtex · select and copy", "head");
          gap();
          bib.split("\n").forEach(function (s) { line(s); });
          gap();
          copyText(bib, function (ok) {
            line(ok ? t("  copied to clipboard", "  已复制到剪贴板") : t("  select the block above and copy it", "  选中上面整段复制"), ok ? "ok" : "dim");
          });
          return;
        }
        line("Jin, H. (2026). Discarded but Alive: What Factor Screening Throws Away,", "head");
        line("and What It Cannot Recover. Working paper, Oct 2026. SSRN 7607684.", "head");
        gap();
        line("  JF manuscript   MS 2026-0738 · external review");
        line("  venues          EFA submitted · WFA · SFS");
        line("  repro           github.com/nemo02070118/boatfx-repro");
        gap();
        line("  cite --bibtex   for the entry, already formatted", "dim");
      }
    };

    /* --- apply / contact */
    CMD.apply = {
      desc: t("what this site is for", "这个站点是干什么的"),
      run: function () {
        line("applying   a16z Horowitz Andreessen Academy · Founding Class 2027", "head");
        line("  early deadline   5 Nov 2026 · rolling review");
        line("  program          Sep 2027 – Aug 2028 · San Francisco · one year");
        line("  status           on academic leave · ≤ 1 year college · SF-ready");
        gap();
        line("  the reviewer path in the top ribbon is the 60-second version of this site.", "dim");
      }
    };
    CMD.contact = {
      desc: t("email and links", "邮箱与链接"),
      run: function () {
        line("  email     huanian.jin@outlook.com");
        line("  github    github.com/nemo02070118/boatfx-repro");
        line("  ssrn      papers.ssrn.com/sol3/papers.cfm?abstract_id=7607684");
        line("  video     youtu.be/tVHLUQy93rg");
      }
    };

    /* --- selftest / share */
    CMD.selftest = {
      desc: t("re-derive this site's own thresholds", "重新推导本站自己的阈值"),
      run: function () {
        var q2m = function (m) { var tau = m / 1.29; return tau / (1 + tau); };
        var rows = [], fails = 0;
        function ck(label, got, want, tol) {
          var good = isFinite(got) && Math.abs(got - want) <= tol;
          if (!good) fails++;
          rows.push([label, got, want, good]);
        }
        /* the two anchors of the resolution law must agree with each other */
        ck("q² at m* = 1.29", q2m(1.29), 0.500, 5e-3);
        ck("q² at pooled m = 94", q2m(94), 0.986, 5e-3);
        /* the two hurdles printed in §04 */
        ck("√(2 ln 17) alloc", Math.sqrt(2 * Math.log(17)), 2.380, 5e-3);
        ck("√(2 ln 6960) discovery", Math.sqrt(2 * Math.log(6960)), 4.207, 5e-3);
        /* Proposition 2, on the example the quickstart prints */
        ck("2.40 · √0.25 dilution", 2.40 * Math.sqrt(0.25), 1.200, 5e-3);
        /* the curse: expected max |t| of 200 coin flips */
        ck("Φ⁻¹(1 − 1/400) curse", invNorm(1 - 1 / 400), 2.807, 5e-3);
        /* the estimator §04b runs on visitor data, on a series anyone can check */
        ck("t of 1,2,3,4,5", tstat([1, 2, 3, 4, 5]), 4.243, 2e-3);

        line("selftest · " + rows.length + " checks · every one computed in this tab", "head");
        gap();
        var narrow = window.innerWidth < 600;
        rows.forEach(function (r) {
          line("  " + (r[3] ? "✓" : "✗") + " " +
            (narrow ? r[0] + "  " + fmt(r[1], 4) + " = " + fmt(r[2], 3)
              : pad(r[0], 24) + pad(fmt(r[1], 4), 9) + "= " + fmt(r[2], 3)),
            r[3] ? "" : "warn");
        });
        gap();
        if (fails) {
          line(fails + " failed — that is a bug, and I would like to know about it.", "warn");
        } else {
          line("all " + rows.length + " passed · 0 failed", "ok");
          line(t("  the thresholds are the ones printed in §04; the estimator is the one §04b runs on your data.",
            "  阈值就是 §04 上印的那些；估计量就是 §04b 在你数据上跑的那个。"), "dim");
        }
      }
    };

    CMD.share = {
      desc: t("turn this run into a link anyone can replay", "把这次运行变成任何人可回放的链接"),
      run: function () {
        var cmds = HISTORY.filter(function (c) {
          var n = c.split(/\s+/)[0].toLowerCase();
          return CMD[n] && n !== "clear" && n !== "share";
        }).slice(-8);
        if (!cmds.length) {
          line(t("nothing to share yet — run a command first, then `share`", "还没有可分享的——先跑一条命令，再输入 `share`"), "warn");
          return;
        }
        var url = location.origin + location.pathname + "?run=" +
          cmds.map(function (c) { return encodeURIComponent(c.slice(0, 60)); }).join("|");
        line("shared run · " + cmds.length + " command" + (cmds.length === 1 ? "" : "s") + " · no server involved", "head");
        gap();
        var urlLine = line(url, "cmd");
        if (urlLine) {
          urlLine.textContent = "";
          var a = el("a", "term-link", url);
          a.href = url;
          a.rel = "noopener";
          urlLine.appendChild(a);
        }
        gap();
        line(t("  whoever opens it gets the same commands replayed in their own tab, on their own machine.",
          "  打开的人会在自己的浏览器里看到同样的命令被回放。"), "dim");
        copyText(url, function (ok) {
          line(ok ? t("  copied to clipboard", "  已复制到剪贴板")
            : t("  select the line above and copy it", "  选中上面那行复制"), ok ? "ok" : "warn");
        });
      }
    };

    /* ------------------------------------------- the paper as an instrument */

    /* gate.js, bench.js and factors.js are separate files. A slow network — or
       any future reordering — can mean the console is asked to run before they
       exist. Wait instead of printing a misleading "not on this page": the
       command re-enters itself the moment they land. */
    function haveFactors() {
      /* SAMPLE_FACTORS is a script-scoped const, so a plain typeof would throw
         while it is still in its temporal dead zone. */
      try {
        return typeof SAMPLE_FACTORS !== "undefined" && SAMPLE_FACTORS && SAMPLE_FACTORS.length > 0;
      } catch (e) { return false; }
    }
    function whenLibs(fn, withFactors) {
      var ready = function () {
        return window.HJ_GATE && window.HJ_BENCH && (!withFactors || haveFactors());
      };
      if (ready()) { fn(); return; }
      var n = 0;
      (function poll() {
        if (ready()) { fn(); return; }
        if (++n > 160) {
          line(t("the gate library did not load — reload the page and run it again",
            "闸门库没有加载成功——刷新页面后再跑一次"), "warn");
          return;
        }
        setTimeout(poll, 50);
      })();
    }
    function needsLibs(a, self, withFactors) {
      var ready = window.HJ_GATE && window.HJ_BENCH && (!withFactors || haveFactors());
      if (ready) return false;
      line(t("  waiting for the gate library…", "  正在等待闸门库加载…"), "dim");
      whenLibs(function () { self.run(a); }, withFactors);
      return true;
    }

    CMD.plot = {
      desc: t("draw the paper's curves", "画出论文的曲线"),
      run: function (a) {
        var what = (a[0] || "q2").toLowerCase();
        var arg = parseFloat(a[1]);
        if (what === "q2" || what === "law" || what === "resolution") {
          plotCurve("q²(τ) = τ / (1 + τ)", 0, 4, 1,
            function (x) { return x / (1 + x); },
            t("τ · resolution scale", "τ · 分辨率尺度"), 1.29);
          gap();
          line("  ┊ " + t("τ = 1.29 → q² = 0.50 · the half-recovery point m*",
            "τ = 1.29 → q² = 0.50 · 半恢复点 m*"), "dim");
          line("  " + t("read it as a share: the screen keeps part of δ, and how much is a function of how long you look.",
            "读成一个比例：筛选留下了 δ 的一部分，留下多少取决于你看多久。"), "dim");
          line("  q²(1) = 0.43   ·   q²(4) = 0.80   ·   q²(72.9) = 0.99   [pooled m = 94]", "dim");
        } else if (what === "dilution" || what === "prop2") {
          var t0 = isFinite(arg) && arg > 0 ? arg : 2.40;
          plotCurve("t_g = t · √π   [t = " + fmt(t0, 2) + "]", 0, 1, t0,
            function (x) { return t0 * Math.sqrt(x); },
            t("π · share of the panel in the paying state", "π · 兑现状态占面板的比例"), 0.25);
          gap();
          line("  ┊ " + t("at π = 0.25 the same factor reads t_g = " + fmt(t0 * 0.5, 2),
            "在 π = 0.25 处，同一个因子读作 t_g = " + fmt(t0 * 0.5, 2)), "dim");
          line("  " + t("measured on the whole panel, the state's signal is diluted by √π — Proposition 2.",
            "在整块面板上测，状态里的信号被 √π 稀释——命题 2。"), "dim");
          line("  t_g ≥ 1.96 " + t("needs π ≥ ", "需要 π ≥ ") + fmt(Math.pow(1.96 / t0, 2), 3), "dim");
        } else if (what === "pool" || what === "pooling") {
          var mean = isFinite(arg) && arg > 0 ? arg : 1.0;
          var ymax = Math.max(2.6, mean * Math.sqrt(94) * 1.04);
          var nStar = Math.pow(ALLOC / mean, 2);
          plotCurve("pooled t = mean · √n   [mean |t| = " + fmt(mean, 2) + "]", 1, 94, ymax,
            function (x) { return mean * Math.sqrt(x); },
            t("n · factors pooled, equal weight", "n · 合并的因子数，等权"),
            nStar <= 94 ? nStar : 94);
          gap();
          if (nStar <= 94) {
            line("  ┊ " + t("n* = " + fmt(nStar, 1) + " — the pool first clears " + fmt(ALLOC, 3) + " there",
              "n* = " + fmt(nStar, 1) + " —— 合并值在此首次越过 " + fmt(ALLOC, 3)), "dim");
            line("  " + t("below n* no amount of averaging helps; above it, every extra factor buys √n.",
              "n* 以下，再平均也没用；n* 以上，每多一个因子就多买一份 √n。"), "dim");
          } else {
            line("  ┊ " + t("n* = " + fmt(nStar, 0) + ", outside the panel — this mean never clears alone",
              "n* = " + fmt(nStar, 0) + "，超出面板范围——这个均值单独永远越不过去"), "dim");
          }
          line("  " + t("assumes independent tests; correlation lowers it, which is why the paper reports GRS F = 51 instead.",
            "假设检验独立；相关性会把它拉低，所以论文报的是 GRS F = 51。"), "dim");
        } else if (what === "curse") {
          plotCurve("E[max |t|] ≈ Φ⁻¹(1 − 1/2N)", 2, 200, 3.1,
            function (x) { return invNorm(1 - 1 / (2 * x)); },
            t("N · candidates screened", "N · 一起被筛的候选数"), 200);
          gap();
          line("  ┊ " + t("N = 200 → " + fmt(invNorm(1 - 1 / 400), 2) + " · the best of 200 coin flips already looks significant",
            "N = 200 → " + fmt(invNorm(1 - 1 / 400), 2) + " · 200 次抛硬币里最好的那个，看着就已经显著了"), "dim");
          line("  " + t("this is why a 1.96 screen on a wide search is not a 5% error rate.",
            "这就是为什么在宽搜索上，1.96 这道筛不是 5% 的错误率。"), "dim");
        } else {
          line("usage: plot q2 | plot dilution [t] | plot pool [mean|t] | plot curse", "warn");
          line("  " + t("all four are drawn from the closed forms printed in §04, not from a table.",
            "四条曲线都按 §04 印出的闭式画，不是查表。"), "dim");
        }
      }
    };

    CMD.gate = {
      desc: t("compile a factor through the constitution gate", "把因子送进宪章闸门编译"),
      run: function (a) {
        var G = window.HJ_GATE;
        if (!G) { if (needsLibs(a, CMD.gate, true)) return; G = window.HJ_GATE; }

        if (a[0] === "--sweep") {
          var rows = G.sweep();
          var bad = rows.filter(function (x) { return x.verdict === "reject"; }).length;
          line("gate --sweep · " + rows.length + " " + t("shipped factors re-run through the gate",
            "个自带因子重跑闸门"), bad ? "warn" : "ok");
          gap();
          rows.forEach(function (x) {
            line("  " + (x.verdict === "reject" ? "✗" : x.verdict === "flag" ? "!" : "✓") + " " +
              pad(x.name, 22) + fmt(x.nodes, 0) + " " + t("nodes", "节点") + "   " +
              (x.verdict === "reject" ? x.gates.filter(function (g) { return !g.ok; })[0].note : x.verdict),
              x.verdict === "reject" ? "warn" : "dim");
          });
          gap();
          line("  " + (rows.length - bad) + " / " + rows.length + " " + t(
            "pass the gate that is supposed to have admitted them. A gate nobody can fail is decoration.",
            "通过了那道本该准入它们的闸门。一道没人能失败的闸门，是装饰。"), "dim");
          return;
        }

        if (a[0] === "--sample" || a[0] === "--funnel") {
          var n = parseInt(a[1], 10) || 400;
          n = Math.min(Math.max(n, 20), 2000);
          var f = G.funnel(n, 20261105);
          var pct = function (x) { return fmt((x / f.proposed) * 100, 1) + "%"; };
          line("gate --sample " + n + " · " + t("seeded grammar sampler · not a model",
            "带种子的文法采样器 · 不是模型"), "head");
          gap();
          line("  " + padw(t("admitted", "准入"), 12) + pad(String(f.admit), 5) + pct(f.admit), "ok");
          line("  " + padw(t("flagged", "带标记"), 12) + pad(String(f.flag), 5) + pct(f.flag));
          line("  " + padw(t("rejected", "拒绝"), 12) + pad(String(f.reject), 5) + pct(f.reject), "warn");
          gap();
          var keys = Object.keys(f.reasons).filter(function (k) { return k !== "admit"; })
            .sort(function (x, y) { return f.reasons[y] - f.reasons[x]; }).slice(0, 6);
          line("  " + t("first gate to stop each proposal", "拦住每个提案的第一道闸"), "dim");
          keys.forEach(function (k) {
            var w = Math.round((f.reasons[k] / f.proposed) * 22);
            line("  " + padw(k, 26) + pad(String(f.reasons[k]), 5) +
              new Array(Math.max(1, w) + 1).join("▪"), "dim");
          });
          gap();
          line("  " + t("the sampler is in gate.js; the seed is fixed, so everyone sees the same stream.",
            "采样器就在 gate.js 里；种子固定，所以每个人看到的是同一条流。"), "dim");
          actLine("  ", t("open the gate panel →", "打开闸门面板 →"), function () { G.focus(); });
          return;
        }

        /* a single expression: `gate "Rank(BidSize/AskSize)" --why "..."` */
        var expr = "", why = "", i;
        for (i = 0; i < a.length; i++) {
          if (a[i] === "--why") { why = a.slice(i + 1).join(" "); break; }
          expr += (expr ? " " : "") + a[i];
        }
        expr = expr.replace(/^["']|["']$/g, "");
        why = why.replace(/^["']|["']$/g, "");
        var fromPanel = !expr;
        if (fromPanel) {
          var pe = document.getElementById("gate-expr");
          var pw = document.getElementById("gate-why");
          expr = pe ? pe.value : "";
          why = pw ? pw.value : "";
        }
        if (!expr) {
          line("usage: gate \"<expression>\" [--why \"<sentence>\"]   |   gate --sweep   |   gate --sample 400", "warn");
          return;
        }
        printGate(G.check(expr, why), fromPanel);
      }
    };

    CMD.agent = {
      desc: t("let the pipeline run on its own and report what it decided", "让流水线自己跑，并报告它决定了什么"),
      run: function (a) {
        var G = window.HJ_GATE;
        if (!G) { if (needsLibs(a, CMD.agent, true)) return; G = window.HJ_GATE; }
        var n = 400, i;
        for (i = 0; i < a.length; i++) if (a[i] === "--n" && a[i + 1]) n = parseInt(a[i + 1], 10);
        n = Math.min(Math.max(n || 400, 20), 2000);

        var f = G.funnel(n, 20261105);
        var GROUPS = [
          ["compile", "G1", ["G1 · executability"]],
          ["variance", "G2 + G3", ["G2 · non-constancy", "G3 · dispersion"]],
          ["reason", "G4", ["G4 · economic rationale"]],
          ["budget", "C4 + C5", ["C4 · complexity", "C5 · novelty"]]
        ];
        STAGE_I = 0;
        var nar = window.innerWidth < 620;
        var firstLine = line(nar
          ? "agent · " + t("autonomous", "自主") + " · seed 20261105"
          : "agent · " + t("autonomous pass", "自主运行") + " · seed 20261105 · 0 " + t("network calls", "次网络请求"),
          "head");
        stageLine("  " + padw(t("goal", "目标"), nar ? 7 : 12) + (nar
          ? t(n + " proposals → an admitted set · and what it cannot judge",
            n + " 提案 → 准入集合 · 以及它判不了什么")
          : t("turn " + n + " proposals into an admitted set, then say what it cannot judge",
            "把 " + n + " 个提案变成一份准入集合，然后说出它判不了的是什么")), "dim");
        stageLine("  " + padw(t("plan", "计划"), nar ? 7 : 12) + (nar
          ? t("propose → … → verdict → route", "提案 → … → 判决 → 转交")
          : t("propose → compile → variance → reason → budget → verdict → route",
            "提案 → 编译 → 方差 → 理由 → 预算 → 判决 → 转交")), "dim");
        gap();

        var alive = n;
        stageLine("  [1/7] " + (nar ? t("propose", "提案") + " " : padw(t("propose", "提案"), 10)) + n + " " +
          t("candidates", "个候选") + (nar ? "" : t(" · defects deliberately included", " · 故意含缺陷")), "dim");
        GROUPS.forEach(function (g, k) {
          var cut = 0;
          g[2].forEach(function (key) { cut += f.reasons[key] || 0; });
          alive -= cut;
          var delta = (cut ? "−" + cut : "—");
          stageLine(nar
            ? "  [" + (k + 2) + "/7] " + g[0] + " " + g[1].replace(/ \+ /g, "+") +
              " → " + alive + " (" + delta + ")"
            : "  [" + (k + 2) + "/7] " + padw(g[0], 10) + padw(g[1], 9) +
              padw(alive + " " + t("alive", "存活"), 12) + delta,
            cut ? "" : "dim");
        });
        gap();
        stageLine(nar
          ? "  [6/7] " + f.admit + " " + t("admitted", "准入") + " · " + f.flag + " " +
            t("flagged", "带标记") + " · " + f.reject + " " + t("rejected", "拒绝")
          : "  [6/7] " + padw(t("verdict", "判决"), 10) +
            f.admit + " " + t("admitted", "准入") + " · " + f.flag + " " + t("flagged", "带标记") + " · " +
            f.reject + " " + t("rejected", "拒绝"), "ok");
        stageLine(nar
          ? "  [7/7] " + t("surviving is not earning", "存活不等于赚钱")
          : "  [7/7] " + padw(t("route", "转交"), 10) +
            t("what survives is not yet a factor", "活下来的还不算因子"), "dim");
        gap();

        /* the funnel has to close: alive after the budget stage is exactly the
           set that got a verdict. If it does not, the arithmetic is wrong. */
        var closes = (alive === f.admit + f.flag);
        line("  " + (closes ? "✓" : "✗") + " " + (nar
          ? t("alive = admitted + flagged = " + alive, "存活 = 准入 + 带标记 = " + alive)
          : t("consistency   alive after budget = admitted + flagged = " + alive,
            "一致性   预算关后存活 = 准入 + 带标记 = " + alive)) +
          (closes ? "" : "   (" + (f.admit + f.flag) + ")"), closes ? "dim" : "warn");
        gap();

        var ex = f.examples.admit[0];
        if (ex) {
          line("  " + padw(t("kept", "留下"), 10) + ex + (nar
            ? t("  +" + Math.max(0, f.admit - 1) + " more", "  另有 " + Math.max(0, f.admit - 1) + " 个")
            : t("   …and " + Math.max(0, f.admit - 1) + " more — a grammar sampler writes simple programs",
              "   ……另有 " + Math.max(0, f.admit - 1) + " 个——文法采样器写不出复杂程序")), "dim");
        }
        f.examples.reject.slice(0, 2).forEach(function (x, i) {
          line("  " + (i ? "        " : padw(t("dropped", "丢掉"), 10)) + x.text, i ? "dim" : "warn");
          line("        ↳ " + x.why, "dim");
        });
        gap();
        line("  " + t("decision", "决定") + "  " + t("the gate is a filter, not an oracle.",
          "闸门是筛子，不是神谕。"), "head");
        line("            " + t(f.admit + " survivors is not " + f.admit + " factors. Admission says the",
          f.admit + " 个存活不等于 " + f.admit + " 个因子。准入说的是"));
        line("            " + t("program is executable, dispersed and argued — never that it earns.",
          "这个程序可执行、有离散、有理由——从不说它能赚钱。"));
        line("            " + t("What this pass cannot decide is exactly what §04b decides.",
          "这一趟判不了的，正是 §04b 判的那件事。"));
        gap();
        var hp = line("  " + t("handoff", "转交") + "  ", "dim");
        if (hp) {
          hp.appendChild(termButton(t("§04b · test a survivor →", "§04b · 测一个存活者 →"), function () {
            if (window.HJ_BENCH) window.HJ_BENCH.focus("stat");
          }));
          hp.appendChild(termButton(t("§05b · the panel →", "§05b · 面板 →"), function () { G.focus(); }));
        }
        /* land the reader on [1/7], not on the last line */
        scrollOutTo(firstLine);
      }
    };

    CMD.sim = {
      desc: t("generate a factor library and pool it", "生成一个因子库并做合并"),
      run: function (a) {
        var B = window.HJ_BENCH;
        if (!B || !B.generate) { if (needsLibs(a, CMD.sim)) return; B = window.HJ_BENCH; }
        var n = 40, alive = 70, mu = 2.4, i;
        for (i = 0; i < a.length; i++) {
          if (a[i] === "--n" && a[i + 1]) n = parseInt(a[i + 1], 10);
          if (a[i] === "--alive" && a[i + 1]) alive = parseFloat(a[i + 1]);
          if (a[i] === "--mu" && a[i + 1]) mu = parseFloat(a[i + 1]);
        }
        n = Math.min(Math.max(n || 40, 4), 400);
        B.generate(n, alive, mu);
        var s = B.stats();
        if (!s) { line("the bench did not return a result", "warn"); return; }
        var mean = s.mean || 0, pooled = s.pooledT || 0;
        var mStar = mean > 0 ? Math.pow(ALLOC / mean, 2) : Infinity;
        line("sim · " + t("library generated and pooled · seed 20261105", "生成因子库并合并 · 种子 20261105"), "head");
        gap();
        line("  " + t("rows", "行数") + "            " + s.n);
        line("  " + t("paying state", "兑现状态") + "    " + fmt(alive, 0) + "% · μ = " + fmt(mu, 2));
        line("  " + t("mean |t|", "平均 |t|") + "        " + fmt(mean, 2));
        line("  " + t("mis-killed", "被误杀") + "      " + (s.mis || 0) + " " + t("of", "／") + " " + s.n, (s.mis ? "warn" : ""));
        gap();
        line("  pooled t          " + fmt(mean, 2) + " × √" + s.n + " = " + fmt(pooled, 2),
          pooled >= ALLOC ? "ok" : "warn");
        line("  " + t("allocation hurdle", "配置门槛") + "  " + fmt(ALLOC, 3), "dim");
        line("  m* " + t("for this mean", "对应这个均值") + "     " + (isFinite(mStar) ? fmt(mStar, 1) : "—"), "dim");
        gap();
        if (pooled >= ALLOC && (s.mis || 0) > 0) {
          line("  " + t("VERDICT  the group clears a hurdle that " + s.mis + " of its members clear alone —",
            "判决  合并值越过了一道门槛，而组里有 " + s.mis + " 个成员单独也越得过——"), "ok");
          line("           " + t("and the screen throws them away anyway.", "而筛选照样把它们扔了。"));
        } else if (pooled >= ALLOC) {
          line("  " + t("VERDICT  the group clears it, and so do its members.", "判决  合并值越过了，成员单独也越过了。"), "ok");
        } else {
          line("  " + t("VERDICT  the group does not clear it either.", "判决  合并值同样没越过。"), "warn");
        }
        gap();
        line("  " + t("this library is synthetic and seeded; replace it with your own on the bench.",
          "这个库是合成的、带种子的；在解剖台上换成你自己的。"), "dim");
        actLine("  ", t("open §04b with this library loaded →", "带着这个库打开 §04b →"), function () { B.focus("batch"); });
      }
    };

    CMD.man = {
      desc: t("the long form of a command", "某条命令的完整说明"),
      run: function (a) {
        var name = (a[0] || "").toLowerCase();
        if (!name || !CMD[name]) {
          line("usage: man <command>   ·   " + t("try man gate, man agent, man plot", "试试 man gate、man agent、man plot"), "warn");
          return;
        }
        var M = MAN[name];
        line(name.toUpperCase() + " · " + CMD[name].desc, "head");
        gap();
        line("  " + t("synopsis", "用法") + "   " + (M ? M.syn : (USAGE[name] || name)));
        if (M) {
          gap();
          M.body.forEach(function (s) { line("  " + s); });
          gap();
          line("  " + t("computes", "计算什么") + "  " + M.does, "dim");
          line("  " + t("see also", "另见") + "     " + M.see, "dim");
        } else {
          gap();
          line("  " + t("no longer form written for this one — `help " + name + "` has the usage.",
            "这条还没有长说明——`help " + name + "` 里有用法。"), "dim");
        }
      }
    };

    CMD.open = {
      desc: t("jump to a section", "跳转到区块"),
      run: function (a) {
        var id = (a[0] || "").replace("#", "");
        if (!id || SECTIONS.indexOf(id) < 0) {
          line("usage: open <" + SECTIONS.slice(0, 8).join("|") + "|…>", "warn");
          return;
        }
        var node = document.getElementById(id);
        if (!node) { line("no such section: " + id, "warn"); return; }
        line("→ #" + id, "ok");
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    /* --- misc */
    CMD.whoami = {
      desc: t("who is behind this", "站点主人"),
      run: function () {
        line("huannian jin · independent researcher · builder", "head");
        line("  20 · on academic leave · Shanghai ⇄ San Francisco");
        line("  applying: a16z Horowitz Andreessen Academy 2027 · Founding Class");
        line("  stack: Rust core · Python research · Flutter desk · 6-agent parliament");
      }
    };
    CMD.lang = {
      desc: t("switch language", "切换语言"),
      run: function (a) {
        var v = (a[0] || "").toLowerCase();
        if (v !== "en" && v !== "zh") { line("usage: lang en|zh", "warn"); return; }
        if (window.applyI18n) window.applyI18n(v);
        line(v === "zh" ? "语言：中文" : "language: english", "ok");
      }
    };
    CMD.theme = {
      desc: t("switch theme", "切换主题"),
      run: function (a) {
        var v = (a[0] || "").toLowerCase();
        if (v !== "light" && v !== "dark") { line("usage: theme light|dark", "warn"); return; }
        var btn = document.querySelector('#theme-switch button[data-theme="' + v + '"]');
        if (btn) btn.click();
        line("theme: " + v, "ok");
      }
    };
    CMD.clear = {
      desc: t("clear the screen", "清屏"),
      run: function () { if (outEl) outEl.innerHTML = ""; }
    };
    CMD.ls = {
      desc: t("list sections", "列出章节"),
      run: function () {
        line(SECTIONS.join("  "), "dim");
      }
    };
    CMD.sudo = {
      desc: "",
      run: function () { line("nice try — the router source is not in this build.", "warn"); }
    };
  }

  /* `resurrect --compare` — the pooling arithmetic, on the visitor's library if
     they have one on the bench, otherwise on a seeded draw. Equal weight,
     independent tests: pooled t = mean |t| · √n (Stouffer). */
  function poolCompare(args) {
    var nArg = 12, i;
    for (i = 0; i < args.length; i++) {
      if (args[i] === "--compare" && args[i + 1] && isFinite(parseFloat(args[i + 1]))) {
        nArg = parseInt(args[i + 1], 10);
      }
    }
    var ts = [], src, bs = window.HJ_BENCH && window.HJ_BENCH.stats ? window.HJ_BENCH.stats() : null;
    if (bs && bs.source === "library" && bs.rows && bs.rows.length >= 2) {
      ts = bs.rows.map(function (r) { return Math.abs(r.t); });
      src = t("§04b library · " + ts.length + " rows", "§04b 因子库 · " + ts.length + " 行");
    } else {
      var n = Math.min(Math.max(nArg, 2), 94);
      var u = rng(20261105);
      for (i = 0; i < n; i++) ts.push(u() * 1.96);
      src = t("synthetic draw · U(0, 1.96) · seed 20261105 · paste a library on the bench for your own",
        "合成抽样 · U(0, 1.96) · 种子 20261105 · 在解剖台粘贴因子库可换成你自己的");
    }
    var n2 = ts.length, s = 0, best = 0, pass = 0, alloc = 0;
    for (i = 0; i < n2; i++) {
      s += ts[i];
      if (ts[i] > best) best = ts[i];
      if (ts[i] >= 1.96) pass++;
      if (ts[i] >= 2.3803) alloc++;
    }
    var mean = s / n2, pooled = mean * Math.sqrt(n2), clears = pooled >= 2.3803;

    line("pooling arithmetic · n = " + n2 + " · equal weight, independent (Stouffer)", "head");
    gap();
    line("  source                     " + src, "dim");
    line("  mean |t|                   " + fmt(mean, 2));
    line("  best |t|                   " + fmt(best, 2));
    line("  clear the 1.96 screen      " + pass + " of " + n2);
    line("  clear the 2.38 allocation  " + alloc + " of " + n2);
    gap();
    line("  pooled t = mean · √n       " + fmt(mean, 2) + " × " + fmt(Math.sqrt(n2), 2) + " = " + fmt(pooled, 2),
      clears ? "ok" : "warn");
    line("  allocation hurdle          " + fmt(2.3803, 2), "dim");
    gap();
    if (clears && alloc < n2) {
      line("  VERDICT  the group clears the hurdle that the members do not.", "ok");
      line("           one WHERE decision on the pool, not one per factor.");
    } else if (clears) {
      line("  VERDICT  the group clears it — and so do some members individually.", "ok");
    } else {
      line("  VERDICT  the group does not clear it either. Pooling buys √n, and √n", "warn");
      line("           is not free money.", "warn");
    }
    gap();
    line("  assumes independent tests; correlation lowers the pooled t, which is why the", "dim");
    line("  paper reports GRS F = 51 for the correlated version instead of a pooled t.", "dim");
  }

  function runCommand(raw) {
    var text = String(raw || "").trim();
    if (!text) return;
    line("huannian@boatfx:~$ " + text, "cmd");
    var parts = text.split(/\s+/);
    var name = parts[0].toLowerCase();
    if (name === "?") name = "help";
    var args = parts.slice(1);
    SKIP_WELCOME = true;
    var badge = document.getElementById("term-badge");
    if (badge) {
      CMD_COUNT++;
      badge.textContent = "LIVE · " + CMD_COUNT + (CMD_COUNT === 1 ? " cmd" : " cmds") + " · 0 requests";
    }
    if (!CMD[name]) {
      var near = Object.keys(CMD).filter(function (k) {
        return k.indexOf(name.slice(0, 3)) === 0 || name.indexOf(k.slice(0, 3)) === 0;
      })[0];
      line("command not found: " + name + (near ? "   did you mean `" + near + "`?" : "   type `help`"), "warn");
      return;
    }
    try {
      CMD[name].run(args);
    } catch (e) {
      line("error: " + (e && e.message ? e.message : "command failed"), "warn");
    }
  }

  /* ?run=cmd|cmd|… — a shared run. Only known commands survive, so a link can
     never inject anything that is not already part of this console. */
  function parseRun() {
    var m = /[?&]run=([^&#]*)/.exec(location.search || "");
    if (!m) return [];
    var raw = "";
    try { raw = decodeURIComponent(m[1]); } catch (e) { return []; }
    return raw.split("|").map(function (s) { return s.trim(); }).filter(function (s) {
      if (!s) return false;
      var n = s.split(/\s+/)[0].toLowerCase();
      return CMD[n] && n !== "clear" && n !== "share";
    }).slice(0, 12);
  }

  function bootConsole() {
    var block = document.querySelector("#proof .terminal-block");
    if (!block) return;

    try {
      var saved = JSON.parse(localStorage.getItem("hj-term-history") || "[]");
      if (saved && saved.length) HISTORY = saved.slice(-60);
      HIST_AT = HISTORY.length;
    } catch (e) {}

    block.innerHTML = "";
    var bar = el("div", "terminal-bar");
    bar.appendChild(el("span"));
    bar.appendChild(el("span"));
    bar.appendChild(el("span"));
    bar.appendChild(el("i", null, "boatfx-repro · live console"));
    var badge = el("b", "term-badge", "LIVE · 0 cmds");
    badge.id = "term-badge";
    bar.appendChild(badge);
    block.appendChild(bar);

    shellEl = el("div", "term-shell");
    outEl = el("div", "term-out");
    outEl.id = "term-out";
    outEl.setAttribute("role", "log");
    outEl.setAttribute("aria-live", "polite");
    shellEl.appendChild(outEl);

    var form = el("form", "term-form");
    form.id = "term-form";
    form.setAttribute("autocomplete", "off");
    var ps = el("label", "term-ps", "huannian@boatfx:~$");
    ps.setAttribute("for", "term-in");
    inEl = el("input", "term-in");
    inEl.id = "term-in";
    inEl.type = "text";
    inEl.spellcheck = false;
    inEl.autocomplete = "off";
    inEl.autocapitalize = "off";
    inEl.setAttribute("aria-label", t("Terminal input — type help", "终端输入 — 输入 help"));
    inEl.placeholder = "";
    form.appendChild(ps);
    form.appendChild(inEl);
    shellEl.appendChild(form);

    chipsEl = el("div", "term-chips");
    ["agent", "gate", "plot q2", "diagnose --t 2.40 --pi 0.25", "autopsy", "council", "ask", "help"].forEach(function (c) {
      var b = el("button", null, c);
      b.type = "button";
      b.addEventListener("click", function () {
        runCommand(c);
        inEl.focus();
      });
      chipsEl.appendChild(b);
    });
    shellEl.appendChild(chipsEl);

    var foot = el("div", "term-foot");
    var ftxt = el("span", "tf-text", t(
      "↑ history · Tab completes · Esc clears · every number is computed here or quoted from the paper",
      "↑ 历史 · Tab 补全 · Esc 清空 · 所有数字在此计算或引自论文"
    ));
    foot.appendChild(ftxt);
    var shareBtn = el("button", "tf-share", t("share this run ↗", "分享这次运行 ↗"));
    shareBtn.type = "button";
    shareBtn.addEventListener("click", function () {
      runCommand("share");
      inEl.focus({ preventScroll: true });
    });
    foot.appendChild(shareBtn);
    shellEl.appendChild(foot);

    block.appendChild(shellEl);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = inEl.value;
      inEl.value = "";
      if (v.trim()) {
        HISTORY.push(v.trim());
        if (HISTORY.length > 60) HISTORY = HISTORY.slice(-60);
        try { localStorage.setItem("hj-term-history", JSON.stringify(HISTORY)); } catch (err) {}
      }
      HIST_AT = HISTORY.length;
      runCommand(v);
    });
    inEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp") {
        if (!HISTORY.length) return;
        e.preventDefault();
        HIST_AT = Math.max(0, HIST_AT - 1);
        inEl.value = HISTORY[HIST_AT] || "";
        setTimeout(function () { inEl.setSelectionRange(inEl.value.length, inEl.value.length); }, 0);
      } else if (e.key === "ArrowDown") {
        if (!HISTORY.length) return;
        e.preventDefault();
        HIST_AT = Math.min(HISTORY.length, HIST_AT + 1);
        inEl.value = HISTORY[HIST_AT] || "";
      } else if (e.key === "Tab") {
        var v = inEl.value.trim();
        if (!v) return;
        e.preventDefault();
        var names = Object.keys(CMD);
        var hit = names.filter(function (n) { return n.indexOf(v.split(/\s+/)[0]) === 0; });
        if (hit.length === 1) inEl.value = hit[0] + " ";
        else if (hit.length > 1) line("  " + hit.join("  "), "dim");
      } else if (e.key === "Escape") {
        inEl.value = "";
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        outEl.innerHTML = "";
      }
    });
    block.addEventListener("click", function (e) {
      if (e.target.closest("button") || e.target.closest("a")) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      inEl.focus({ preventScroll: true });
    });

    /* boot — deferred until the block is actually on screen, so the sequence is
       never spent above the fold. The first paint ends with `help` already run,
       so a visitor sees the command surface instead of an empty prompt. */
    var booted = false;
    function boot() {
      if (booted) return;
      booted = true;
      var lines = [
        [t("BOAT console · static build · no backend", "BOAT 控制台 · 静态构建 · 无后端"), "dim"],
        [t("data: frozen run 2026-10 · all arithmetic runs in this tab", "数据：2026-10 冻结运行 · 全部算术在本页运行"), "dim"]
      ];
      lines.forEach(function (b, i) {
        setTimeout(function () { if (!SKIP_WELCOME) line(b[0], b[1]); }, 90 + i * 120);
      });
      setTimeout(function () {
        if (REPLAY.length) { replayRun(); return; }
        if (HISTORY.length || SKIP_WELCOME) return;
        gap();
        line(t("most useful first", "最常用的先来"), "ok");
        line("  " + pad("agent", 32) + t("watch the pipeline run itself", "看流水线自己跑一遍"));
        line("  " + pad("gate", 32) + t("compile a factor, get a receipt", "编译一个因子，拿到回执"));
        line("  " + pad("diagnose --t 2.40 --pi 0.25", 32) + t("is this factor killed?", "这个因子会被杀掉吗？"));
        line("  " + pad("autopsy", 32) + t("test your own data", "测你自己的数据"));
        line("  " + pad("council", 32) + t("convene the seven-persona council", "召集七智体议会"));
        line("  " + pad("resurrect", 32) + t("revival bench on the sample library", "对样本库跑复活台"));
        line("  " + pad("venue", 32) + t("find a factor's home venue", "找因子的主场"));
        line("  " + pad("strategy", 32) + t("build a strategy on a factor", "以因子建策略"));
        line("  " + pad("research", 32) + t("the full pipeline on one factor", "对单因子跑完整流水线"));
        line("  " + pad("zoo", 32) + t("the public factor library", "公开因子库"));
        line("  " + pad("experiment", 32) + t("the paper's experiment, both ways", "论文实验，双路对比"));
        line("  " + pad("guide", 32) + t("the step-by-step strategy builder", "分步策略构建向导"));
        line("  " + pad("evolve", 32) + t("a genetic search for factors — crossover, mutation", "遗传搜索因子——交叉变异"));
        line("  " + pad("whatif", 32) + t("the counterfactual engine — change one parameter", "反事实引擎——改一个参数全部重跑"));
        line("  " + pad("validate", 32) + t("validate your own factors or strategy, our way", "用我们的方法检验你自己的因子或策略"));
        line("  " + pad("agents", 32) + t("the council roster", "议会花名册"));
        line("  " + pad("ask", 32) + t("ask about the author — record only", "问作者的事——只按记录"));
        line("  " + pad("help", 32) + t("full command list", "全部命令"));
      }, 380);
    }

    function replayRun() {
      gap();
      line(t("shared run · " + REPLAY.length + " commands · replayed in this tab",
        "分享的运行 · " + REPLAY.length + " 条命令 · 在本页回放"), "ok");
      line(t("  nothing is fetched — every number is recomputed on your machine",
        "  没有请求任何数据——每个数字都在你的机器上重新算出来"), "dim");
      REPLAY.forEach(function (c, i) {
        setTimeout(function () {
          if (HISTORY.indexOf(c) < 0) HISTORY.push(c);
          HIST_AT = HISTORY.length;
          runCommand(c);
        }, 240 + i * 300);
      });
    }

    if (REPLAY.length) {
      /* A shared link is a request to watch — but the section is .reveal, and
         styles.css keeps .reveal at opacity 0 until the IntersectionObserver
         adds .in (then a further 0.7s transition). On an instant jump the run
         would print into an invisible box: a link click, a screenshot, or any
         capture faster than the observer never sees it. Force the reveal on
         the block's own section, synchronously, so the shared run is always
         readable the moment it lands. */
      var host = (block.closest && block.closest(".reveal")) || null;
      if (host) {
        host.classList.add("in");
        var hostTr = host.style.transition;
        host.style.transition = "none";
        host.style.opacity = "1";
        host.style.transform = "none";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            host.style.transition = hostTr;
          });
        });
      }
      boot();
      /* the page is still growing (lazy vizzes, images), so a single scroll can
         clamp to a short document. Jump the instant the link lands — a shared
         run is a request to watch, and a capture 300ms in must already show
         the console, not the hero — then retry while the layout settles, and
         stop the moment the block is actually on screen. */
      var tries = 0;
      function ensureVisible() {
        var r = block.getBoundingClientRect();
        if (r.top >= 0 && r.bottom <= window.innerHeight) return;
        var y = (window.pageYOffset || document.documentElement.scrollTop || 0) + r.top -
          Math.max(0, (window.innerHeight - block.offsetHeight) / 2);
        /* styles.css sets html{scroll-behavior:smooth}; override it for this one
           jump, otherwise the call animates and reads back a stale position */
        var root = document.documentElement;
        var prev = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, Math.max(0, y));
        root.style.scrollBehavior = prev;
        if (++tries < 6) setTimeout(ensureVisible, 500 + tries * 250);
      }
      ensureVisible();
      setTimeout(ensureVisible, 650);
    } else if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { boot(); io.disconnect(); }
      }, { threshold: 0.25 });
      io.observe(block);
    } else {
      boot();
    }
    /* safety net: if the observer is starved (some embedded webviews), a plain
       scroll check still starts the console the first time it comes into view */
    function nearView() {
      if (booted) return;
      var r = block.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
        boot();
        window.removeEventListener("scroll", nearView);
      }
    }
    window.addEventListener("scroll", nearView, { passive: true });
    setTimeout(nearView, 2600);
  }

  var HIST_AT = 0;

  /* --------------------------------------------------- 3. bridge in #terminal */
  function buildBridge() {
    var meta = document.querySelector("#terminal .term-meta");
    if (!meta || document.getElementById("term-bridge")) return;
    var bar = el("div", "term-bridge");
    bar.id = "term-bridge";
    bar.appendChild(el("span", "tb-prompt", "$ boatfx --verify"));
    bar.appendChild(el("span", null, t("the console in §07 runs on real arithmetic — type agent and watch the whole pipeline decide",
      "§07 的控制台跑的是真算术——输入 agent，看整条流水线自己做决定")));
    var a = el("a", null, t("Open live console →", "打开实时控制台 →"));
    a.href = "#proof";
    a.addEventListener("click", function () {
      setTimeout(function () {
        var i = document.getElementById("term-in");
        if (i) i.focus({ preventScroll: true });
      }, 700);
    });
    bar.appendChild(a);
    meta.parentNode.insertBefore(bar, meta.nextSibling);
  }

  /* ------------------------------------------------- 4. reviewer 60s path */
  var PATH = [
    {
      k: t("01 · who", "01 · 是谁"),
      title: t("20, on leave, shipping", "20 岁，休学，在交付"),
      body: t("Independent researcher and builder. Left a full-time degree to run this as a job, not a hobby. Applying to the HAA 2027 Founding Class.",
        "独立研究者与建造者。休学，把这件事当职业而不是爱好。正在申请 HAA 2027 Founding Class。"),
      metric: "Huannian Jin · Shanghai ⇄ San Francisco",
      jump: "top"
    },
    {
      k: t("02 · the question", "02 · 问题"),
      title: t("One screen, one venue, one verdict", "一块屏幕、一个市场、一个判决"),
      body: t("Unconditional screens ask whether a factor pays on average. A premium that only pays inside a market state averages to zero — and gets deleted as noise.",
        "无条件筛选问的是因子平均是否兑现。只在某个市场状态里兑现的溢价，全局平均为零——于是被当作噪声删掉。"),
      metric: t("Proposition 2 · the blind spot", "命题 2 · 盲区"),
      jump: "idea"
    },
    {
      k: t("03 · the law", "03 · 定律"),
      title: "q²(τ) = τ / (1 + τ)",
      body: t("The resolution law of factor discovery, matched to Monte Carlo to three decimals. Half-recovery at m* ≈ 1.29. A screen is an instrument with an aperture.",
        "因子发现的分辨率定律，与蒙特卡洛匹配到三位小数。半恢复点在 m* ≈ 1.29。筛选是一台有孔径的仪器。"),
      metric: t("§04 Resolution Dial · drag the pool size", "§04 分辨率仪表 · 拖动池子规模"),
      jump: "limit"
    },
    {
      k: t("04 · the money", "04 · 钱"),
      title: t("94 discards · Sharpe 0.85 → 1.30", "94 个被丢弃 · Sharpe 0.85 → 1.30"),
      body: t("One WHERE decision revives them as a pool: +0.45 Sharpe, FF6 alpha 3.8%/yr (t = 8.3), GRS F = 51. Reproduced out of sample in China on 5,441 stocks (+0.95, p = 0).",
        "一个 WHERE 决策把它们的池子救回来：+0.45 Sharpe，FF6 alpha 3.8%/年（t = 8.3），GRS F = 51。中国 5,441 只股票的样本外独立复制（+0.95，p = 0）。"),
      metric: "172 bps/yr · IR ≈ 1.99 · 24/24 same-base increments",
      jump: "results"
    },
    {
      k: t("05 · the honesty", "05 · 诚实"),
      title: t("The ceiling is a curse, not a router", "天花板是诅咒，不是路由器"),
      body: t("Per-factor routing does not survive. In a zero-advantage null the oracle manufactures 5.9× the real gain. The site shows the failure next to the win.",
        "逐因子路由站不住。在零优势零假设下，oracle 会凭空造出真实增益的 5.9 倍。站点把失败和胜利并排放。"),
      metric: t("Theorem 3 converse · router ≤ 0.05 over coarse", "定理 3 逆命题 · 路由器相对粗池 ≤ 0.05"),
      jump: "limit"
    },
    {
      k: t("06 · your turn", "06 · 轮到你了"),
      title: t("Put your own factor on the bench", "把你的因子放上解剖台"),
      body: t("Paste a return series, a t-stat, or a whole library. The bench applies the paper's dilution identity to your numbers and tells you whether the screen would have killed it — computed in your browser, nothing uploaded.",
        "粘贴一段收益序列、一个 t 值，或整个因子库。解剖台把论文的稀释恒等式套到你的数字上，告诉你筛选会不会把它杀掉——全部在你浏览器里算，不上传。"),
      metric: t("§04b Autopsy bench · paste and run", "§04b 误杀解剖台 · 粘贴即算"),
      jump: "bench"
    },
    {
      k: t("07 · the gate", "07 · 闸门"),
      title: t("The gate is real. Try to fail it.", "闸门是真的。试着让它失败。"),
      body: t("670k lines, 12 Rust crates, 56 modules at Zheshang. The part you can test is the admission gate: AI proposes factors, a constitution gate admits them, and that gate is running in this tab. Write an expression, watch it get judged.",
        "67 万行、12 个 Rust crate、浙商上线 56 个模块。你能亲手测的是那道准入闸门：AI 提案因子，宪章闸门准入，而这道闸门正在本页运行。写一个表达式，看它被判。"),
      metric: t("§05b Constitution gate · type gate in §07", "§05b 宪章闸门 · 在 §07 输入 gate"),
      jump: "factory"
    },
    {
      k: t("08 · the fit", "08 · 契合"),
      title: t("Eligible, and already in motion", "符合资格，且已在行动"),
      body: t("On academic leave, no more than one year of college through Aug 2027, international, SF-ready. JF external review, EFA submitted, terminal in daily use.",
        "休学中，截至 2027-08 大学未满一年，国际申请者，可全职赴 SF。JF 外审中，EFA 已投，终端每日在用。"),
      metric: t("§08 Academy fit · eligibility tab", "§08 Academy 契合 · 资格标签"),
      jump: "agency"
    },
    {
      k: t("09 · the receipt", "09 · 收据"),
      title: t("Don't take the numbers on faith", "这些数字不必信我"),
      body: t("Every figure above has a command behind it. selftest re-derives the thresholds, prove walks the headline, share turns your own run into a link. The site is the receipt.",
        "上面每个数字背后都有一条命令。selftest 重新推导阈值，prove 走一遍头条，share 把你的运行变成一条链接。站点本身就是收据。"),
      metric: t("§07 console · type selftest", "§07 控制台 · 输入 selftest"),
      jump: "proof"
    }
  ];

  var pathIdx = 0;
  var modal, bodyEl, countEl, dotsEl;

  function paintPath() {
    if (!bodyEl) return;
    var s = PATH[pathIdx];
    bodyEl.innerHTML = "";
    bodyEl.appendChild(el("span", "path-k", s.k));
    bodyEl.appendChild(el("h3", null, s.title));
    bodyEl.appendChild(el("p", null, s.body));
    bodyEl.appendChild(el("div", "path-metric", s.metric));
    var b = el("button", "path-jump", t("Open this section →", "打开该区块 →"));
    b.type = "button";
    b.addEventListener("click", function () {
      closePath();
      var node = document.getElementById(s.jump);
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    bodyEl.appendChild(b);
    if (countEl) countEl.textContent = (pathIdx + 1) + " / " + PATH.length;
    if (dotsEl) {
      Array.prototype.forEach.call(dotsEl.children, function (d, i) {
        d.className = i === pathIdx ? "on" : "";
      });
    }
  }

  function openPath() {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    paintPath();
    var btn = modal.querySelector(".path-close");
    if (btn) btn.focus();
  }
  function closePath() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    var p = document.getElementById("haa-path");
    if (p) p.focus();
  }

  function buildPath() {
    modal = el("div", "path-modal");
    modal.id = "path-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", t("Reviewer path, 60 seconds", "评审路径，60 秒"));

    var shell = el("div", "path-shell");
    var head = el("div", "path-head");
    head.appendChild(el("span", null, t("For reviewers · 60 seconds", "给评审 · 60 秒")));
    countEl = el("span", "ph-count", "1 / " + PATH.length);
    head.appendChild(countEl);
    var x = el("button", "path-close", "×");
    x.type = "button";
    x.setAttribute("aria-label", t("Close", "关闭"));
    x.addEventListener("click", closePath);
    head.appendChild(x);
    shell.appendChild(head);

    bodyEl = el("div", "path-body");
    shell.appendChild(bodyEl);

    var foot = el("div", "path-foot");
    var prev = el("button", null, t("← Prev", "← 上一步"));
    prev.type = "button";
    prev.addEventListener("click", function () {
      pathIdx = (pathIdx - 1 + PATH.length) % PATH.length;
      paintPath();
    });
    var next = el("button", null, t("Next →", "下一步 →"));
    next.type = "button";
    next.addEventListener("click", function () {
      pathIdx = (pathIdx + 1) % PATH.length;
      paintPath();
    });
    dotsEl = el("div", "path-dots");
    PATH.forEach(function () { dotsEl.appendChild(el("i")); });
    foot.appendChild(prev);
    foot.appendChild(dotsEl);
    foot.appendChild(next);
    shell.appendChild(foot);

    modal.appendChild(shell);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closePath();
    });
    document.body.appendChild(modal);

    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closePath(); }
      if (e.key === "ArrowRight") { pathIdx = (pathIdx + 1) % PATH.length; paintPath(); }
      if (e.key === "ArrowLeft") { pathIdx = (pathIdx - 1 + PATH.length) % PATH.length; paintPath(); }
    });
  }

  /* ------------------------------------------------------------- language */
  function onLang() {
    var g = document.querySelector(".haa-gate .haa-note");
    if (g) g.textContent = t("Founding Class applicant · Early deadline 5 Nov 2026 · rolling review", "Founding Class 申请人 · Early 截止 2026-11-05 · 滚动审核");
    var gs = document.querySelector(".haa-gate .haa-note-short");
    if (gs) gs.textContent = t("Founding Class · Early 5 Nov", "Founding Class · Early 11-05");
    var pb = document.getElementById("haa-path");
    if (pb) pb.textContent = t("60-second path →", "60 秒路径 →");
    var wa = document.querySelector(".haa-gate a");
    if (wa) wa.textContent = t("Why HAA →", "为什么是 HAA →");
    var br = document.querySelector("#term-bridge span:not(.tb-prompt)");
    if (br) br.textContent = t("the console in §07 runs on real arithmetic — type agent and watch the whole pipeline decide",
      "§07 的控制台跑的是真算术——输入 agent，看整条流水线自己做决定");
    var ba = document.querySelector("#term-bridge a");
    if (ba) ba.textContent = t("Open live console →", "打开实时控制台 →");
    var fi = document.getElementById("term-in");
    if (fi) fi.setAttribute("aria-label", t("Terminal input — type help", "终端输入 — 输入 help"));
    var ft = document.querySelector(".term-foot .tf-text");
    if (ft) ft.textContent = t("↑ history · Tab completes · Esc clears · every number is computed here or quoted from the paper", "↑ 历史 · Tab 补全 · Esc 清空 · 所有数字在此计算或引自论文");
    var fs = document.querySelector(".term-foot .tf-share");
    if (fs) fs.textContent = t("share this run ↗", "分享这次运行 ↗");
    if (modal && !modal.hidden) paintPath();
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    registerConsole();
    REPLAY = parseRun();
    buildGate();
    bootConsole();
    buildBridge();
    buildPath();
    var p = document.getElementById("haa-path");
    if (p) p.addEventListener("click", openPath);
    document.addEventListener("hj:lang", onLang);
  }

  /* Runs synchronously on purpose. The <script> tag sits at the end of <body>,
     so the DOM above it is parsed — and it must claim the terminal block before
     app.js (loaded next) calls initTerminal(). */
  init();
})();
