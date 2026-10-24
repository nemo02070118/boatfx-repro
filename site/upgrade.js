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
    help: "help diagnose"
  };

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
          [t("THE PAPER", "论文"), ["prove", "stats", "q2", "diagnose", "resurrect", "curse", "tournament", "zoo", "compare", "cite"]],
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
        line(pad(t("NAVIGATE", "导航"), 10) + "help · open · paper · ls · lang · theme · clear", "ok");
        line(pad(t("ABOUT", "关于"), 10) + "apply · whoami · honest · contact · factor", "ok");
        line(t("  help <command> for usage · ↑ history · Tab completes · Ctrl+L clears",
          "  help <命令> 看用法 · ↑ 历史 · Tab 补全 · Ctrl+L 清屏"), "dim");
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
          line("bench not loaded", "warn");
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
        rows.forEach(function (r) {
          line("  " + (r[3] ? "✓" : "✗") + " " + pad(r[0], 24) + pad(fmt(r[1], 4), 9) + "= " + fmt(r[2], 3),
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
    ["help", "diagnose --t 2.40 --pi 0.25", "q2 1.29", "resurrect", "curse", "prove"].forEach(function (c) {
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
        setTimeout(function () { line(b[0], b[1]); }, 90 + i * 120);
      });
      setTimeout(function () {
        if (REPLAY.length) { replayRun(); return; }
        if (HISTORY.length) return;
        gap();
        line(t("most useful first", "最常用的先来"), "ok");
        line("  " + pad("diagnose --t 2.40 --pi 0.25", 32) + t("is this factor killed?", "这个因子会被杀掉吗？"));
        line("  " + pad("autopsy", 32) + t("test your own data", "测你自己的数据"));
        line("  " + pad("prove", 32) + t("headline arithmetic", "头条数字验算"));
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
      /* a shared link is a request to watch: start at once, and bring the block
         into view only if it is not already on screen. Instant, not smooth —
         the run is already printing and a glide just delays it. */
      boot();
      /* the page is still growing (lazy vizzes, images), so a single scroll can
         clamp to a short document. Retry a few times, and stop the moment the
         block is actually on screen. */
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
        if (++tries < 4) setTimeout(ensureVisible, 500 + tries * 250);
      }
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
    bar.appendChild(el("span", null, t("the console in §07 runs on real arithmetic — type a command and watch it answer", "§07 的控制台跑的是真算术——敲一条命令，看它回答")));
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
      k: t("07 · the build", "07 · 工程"),
      title: t("670k lines behind the claim", "论断背后是 67 万行"),
      body: t("12 Rust crates, ~2.3k source files, 56 modules shipped at Zheshang with >95% coverage. AI proposes factors; a constitution gate admits them.",
        "12 个 Rust crate、约 2.3k 源文件、浙商上线 56 个模块、覆盖率 >95%。AI 提案因子，宪章闸门准入。"),
      metric: t("§06d Engineering mass · §06c AI factory", "§06d 工程体量 · §06c AI 工厂"),
      jump: "scale"
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
      body: t("Every figure above has a command behind it. `selftest` re-derives the thresholds, `prove` walks the headline, `share` turns your own run into a link. The site is the receipt.",
        "上面每个数字背后都有一条命令。`selftest` 重新推导阈值，`prove` 走一遍头条，`share` 把你的运行变成一条链接。站点本身就是收据。"),
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
    if (br) br.textContent = t("the console in §07 runs on real arithmetic — type a command and watch it answer", "§07 的控制台跑的是真算术——敲一条命令，看它回答");
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
