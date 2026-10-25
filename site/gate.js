/* ==========================================================================
   BOAT · 05b Constitution gate
   --------------------------------------------------------------------------
   §05 says: "Agents emit typed ASTs over nine microstructure signals.
   Admission requires executability, non-constancy, dispersion, and an
   economic rationale." This file is that sentence, compiled.

   It parses the factor language the site already ships (the AST shape in
   app.js: input / const / unary / binary / rolling), runs the four front
   gates G1–G4 plus four constitution checks, and prints the receipt.

   Nothing here claims a performance number. Admission is a statement about
   the *program*, not about its edge — which is exactly the paper's point:
   the admitted population is studied without performance pre-screening.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------- vocabulary */
  var SIGNALS = ["BidSize", "AskSize", "BestBid", "BestAsk", "MidPrice",
    "Volume", "TradeSide", "TradeSize"];

  var UNARY = { Rank: 1, Abs: 1, Sign: 1, Diff: 1, Neg: 1, Log: 1, Sqrt: 1 };
  var BINARY = { Add: 1, Sub: 1, Mul: 1, Div: 1, Min: 1, Max: 1, Pow: 1 };
  var ROLLING = { Mean: 1, Zscore: 1, Slope: 1, Std: 1 };

  /* the gate's own policy numbers — stated, not hidden */
  var BUDGET = { nodes: 24, signals: 5, maxWindow: 250, minWindow: 2 };
  var TURNOVER_WINDOW = 5;

  /* ---------------------------------------------------------------- i18n */
  function lang() {
    try {
      var s = localStorage.getItem("hj-lang");
      if (s === "zh" || s === "en") return s;
    } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
  }
  function t(en, zh) { return lang() === "zh" ? zh : en; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ------------------------------------------------------------- tokenizer */
  function tokenize(src) {
    var s = String(src == null ? "" : src), out = [], i = 0;
    while (i < s.length) {
      var c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s.charAt(i + 1)))) {
        var j = i;
        while (j < s.length && /[0-9.]/.test(s.charAt(j))) j++;
        out.push({ t: "num", v: parseFloat(s.slice(i, j)), at: i });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var k = i;
        while (k < s.length && /[A-Za-z0-9_]/.test(s.charAt(k))) k++;
        out.push({ t: "id", v: s.slice(i, k), at: i });
        i = k;
        continue;
      }
      if ("()[],+-*/^".indexOf(c) >= 0) { out.push({ t: c, at: i }); i++; continue; }
      throw new Error(t("unexpected character '" + c + "'", "无法识别的字符 '" + c + "'") + " @" + i);
    }
    return out;
  }

  /* ---------------------------------------------------------------- parser */
  /* Pratt parser over the shipped grammar. Produces the same AST shape app.js
     renders with prettyExpr(), so the receipt shows the site's own format. */
  var PREC = { "+": 10, "-": 10, "*": 20, "/": 20, "^": 30 };
  var OPNAME = { "+": "Add", "-": "Sub", "*": "Mul", "/": "Div", "^": "Pow" };

  function parse(src) {
    var toks = tokenize(src), p = 0;

    function peek(o) { return toks[p + (o || 0)]; }
    function eat(type) {
      var tk = toks[p];
      if (!tk || tk.t !== type) {
        throw new Error(t("expected '" + type + "'", "缺少 '" + type + "'") +
          (tk ? " @" + tk.at : " @" + String(src).length));
      }
      p++;
      return tk;
    }
    function done() { return p >= toks.length; }

    function parseExpr(minPrec) {
      var left = parseUnary();
      for (;;) {
        var tk = peek();
        if (!tk || tk.t === ")" || tk.t === "]" || tk.t === ",") break;
        var prec = PREC[tk.t];
        if (prec == null || prec < minPrec) break;
        p++;
        var right = parseExpr(tk.t === "^" ? prec : prec + 1);
        left = { kind: "binary", op: OPNAME[tk.t], left: left, right: right };
      }
      return left;
    }

    function parseUnary() {
      var tk = peek();
      if (tk && tk.t === "-") {
        p++;
        return { kind: "unary", op: "Neg", inner: parseUnary() };
      }
      if (tk && tk.t === "+") { p++; return parseUnary(); }
      return parsePrimary();
    }

    function parseArgs() {
      eat("(");
      var args = [];
      if (peek() && peek().t !== ")") {
        args.push(parseExpr(0));
        while (peek() && peek().t === ",") { p++; args.push(parseExpr(0)); }
      }
      eat(")");
      return args;
    }

    function parsePrimary() {
      var tk = peek();
      if (!tk) throw new Error(t("expression ended early", "表达式意外结束"));
      if (tk.t === "num") { p++; return { kind: "const", value: tk.v }; }
      if (tk.t === "(") {
        p++;
        var inner = parseExpr(0);
        eat(")");
        return inner;
      }
      if (tk.t === "id") {
        p++;
        var name = tk.v, win = null;
        if (peek() && peek().t === "[") {
          p++;
          var w = eat("num");
          eat("]");
          win = w.v;
        }
        if (peek() && peek().t === "(") {
          var args = parseArgs();
          return makeCall(name, win, args);
        }
        if (win != null) {
          throw new Error(t(name + " needs a body: " + name + "[w](x)", name + " 需要主体：" + name + "[w](x)"));
        }
        if (SIGNALS.indexOf(name) < 0) {
          throw new Error(t("unknown signal '" + name + "'", "未知信号 '" + name + "'"));
        }
        return { kind: "input", signal: name };
      }
      throw new Error(t("unexpected token '" + tk.t + "'", "意外符号 '" + tk.t + "'") + " @" + tk.at);
    }

    function makeCall(name, win, args) {
      if (UNARY[name]) {
        if (args.length !== 1) throw new Error(name + " takes 1 argument, got " + args.length);
        if (win != null) throw new Error(name + " is not a rolling operator");
        return { kind: "unary", op: name, inner: args[0] };
      }
      if (BINARY[name]) {
        if (args.length !== 2) throw new Error(name + " takes 2 arguments, got " + args.length);
        if (win != null) throw new Error(name + " is not a rolling operator");
        return { kind: "binary", op: name, left: args[0], right: args[1] };
      }
      if (ROLLING[name]) {
        if (args.length !== 1) throw new Error(name + " takes 1 argument, got " + args.length);
        if (win == null) throw new Error(t(name + " needs a window: " + name + "[20](x)", name + " 需要窗口：" + name + "[20](x)"));
        return { kind: "rolling", op: name, window: win, inner: args[0] };
      }
      throw new Error(t("unknown operator '" + name + "'", "未知算子 '" + name + "'"));
    }

    if (!toks.length) throw new Error(t("empty expression", "空表达式"));
    var ast = parseExpr(0);
    if (!done()) {
      throw new Error(t("trailing input at " + peek().at, "多余输入 @" + peek().at));
    }
    return ast;
  }

  /* ------------------------------------------------------------- analysis */
  function walk(node, fn) {
    if (!node || typeof node !== "object") return;
    fn(node);
    if (node.kind === "unary" || node.kind === "rolling") walk(node.inner, fn);
    if (node.kind === "binary") { walk(node.left, fn); walk(node.right, fn); }
  }

  /* canonical form — commutative ops sorted, so Mul(a,b) == Mul(b,a) */
  function canon(node) {
    if (!node) return "";
    if (node.kind === "input") return node.signal;
    if (node.kind === "const") return "#" + node.value;
    if (node.kind === "unary") return node.op + "(" + canon(node.inner) + ")";
    if (node.kind === "rolling") return node.op + "[" + node.window + "](" + canon(node.inner) + ")";
    if (node.kind === "binary") {
      var a = canon(node.left), b = canon(node.right);
      if (node.op === "Add" || node.op === "Mul" || node.op === "Min" || node.op === "Max") {
        if (b < a) { var tmp = a; a = b; b = tmp; }
      }
      return node.op + "(" + a + "," + b + ")";
    }
    return "?";
  }

  function hasSignal(node) {
    var hit = false;
    walk(node, function (n) { if (n.kind === "input") hit = true; });
    return hit;
  }

  function signalSet(node) {
    var s = {};
    walk(node, function (n) { if (n.kind === "input") s[n.signal] = 1; });
    return Object.keys(s);
  }

  /* conservative sign analysis — enough to catch the real hazards without
     pretending to be a proof assistant */
  var POSITIVE = { BestBid: 1, BestAsk: 1, MidPrice: 1 };
  var NONNEG = { BidSize: 1, AskSize: 1, Volume: 1, TradeSize: 1 };

  function isPositive(n) {
    if (!n) return false;
    if (n.kind === "const") return n.value > 0;
    if (n.kind === "input") return !!POSITIVE[n.signal];
    if (n.kind === "unary") return n.op === "Rank";
    if (n.kind === "binary") {
      if (n.op === "Mul" || n.op === "Add" || n.op === "Max") {
        return isPositive(n.left) && isPositive(n.right);
      }
      if (n.op === "Div") return isPositive(n.left) && isPositive(n.right);
      return false;
    }
    return false;
  }

  function isNonNeg(n) {
    if (!n) return false;
    if (n.kind === "const") return n.value >= 0;
    if (n.kind === "input") return !!(POSITIVE[n.signal] || NONNEG[n.signal]);
    if (n.kind === "unary") return n.op === "Abs" || n.op === "Sqrt" || n.op === "Rank";
    if (n.kind === "rolling") return n.op === "Std";
    if (n.kind === "binary") {
      if (n.op === "Mul") return isNonNeg(n.left) && isNonNeg(n.right);
      if (n.op === "Div") return isNonNeg(n.left) && isPositive(n.right);
      if (n.op === "Add" || n.op === "Max" || n.op === "Min") {
        return isNonNeg(n.left) && isNonNeg(n.right);
      }
      return false;
    }
    return false;
  }

  function budgetOf(node) {
    var nodes = 0, maxW = 0, minW = Infinity;
    walk(node, function (n) {
      nodes++;
      if (n.kind === "rolling") {
        if (n.window > maxW) maxW = n.window;
        if (n.window < minW) minW = n.window;
      }
    });
    return { nodes: nodes, maxWindow: maxW, minWindow: minW === Infinity ? 0 : minW };
  }

  function shipped() {
    /* app.js runs after this file, so read it lazily — never at init */
    try {
      if (typeof SAMPLE_FACTORS !== "undefined" && SAMPLE_FACTORS && SAMPLE_FACTORS.length) {
        return SAMPLE_FACTORS;
      }
    } catch (e) {}
    return [];
  }

  /* --------------------------------------------------------------- the gate */
  function check(src, rationale, opts) {
    opts = opts || {};
    var out = {
      src: String(src == null ? "" : src),
      rationale: String(rationale == null ? "" : rationale),
      verdict: "reject",
      ast: null,
      gates: [],
      notes: [],
      nodes: 0,
      signals: [],
      maxWindow: 0,
      minWindow: 0,
      dup: null,
      canon: ""
    };
    function gate(id, name, ok, note) {
      out.gates.push({ id: id, name: name, ok: ok, note: note || "" });
    }

    /* ---- G1 executability: parse + type + window range ---- */
    var ast = null, err = null;
    try {
      ast = parse(out.src);
    } catch (e) {
      err = e.message;
    }
    if (err) {
      gate("G1", "executability", false, err);
      out.verdict = "reject";
      return out;
    }
    out.ast = ast;
    out.canon = canon(ast);

    var b = budgetOf(ast);
    out.nodes = b.nodes;
    out.maxWindow = b.maxWindow;
    out.minWindow = b.minWindow;
    out.signals = signalSet(ast);

    var badWin = null;
    walk(ast, function (n) {
      if (n.kind === "rolling") {
        if (!isFinite(n.window) || Math.round(n.window) !== n.window) badWin = "window must be an integer";
        else if (n.window < BUDGET.minWindow) badWin = "window " + n.window + " < " + BUDGET.minWindow + " — a one-day window has no dispersion";
        else if (n.window > BUDGET.maxWindow) badWin = "window " + n.window + " > " + BUDGET.maxWindow + " — outside the data budget";
      }
    });
    var badLog = null;
    walk(ast, function (n) {
      if (n.kind === "unary" && n.op === "Log" && !isPositive(n.inner)) {
        badLog = "Log() over a quantity that is not provably positive";
      }
      if (n.kind === "unary" && n.op === "Sqrt" && !isNonNeg(n.inner)) {
        badLog = "Sqrt() over a quantity that can be negative";
      }
    });
    if (badWin) gate("G1", "executability", false, badWin);
    else if (badLog) gate("G1", "executability", false, badLog);
    else gate("G1", "executability", true,
      t("parsed · " + b.nodes + " nodes · " + out.signals.length + " signals",
        "解析通过 · " + b.nodes + " 个节点 · " + out.signals.length + " 个信号"));

    /* ---- G2 non-constancy ---- */
    if (!hasSignal(ast)) {
      gate("G2", "non-constancy", false, t("no signal — this is a constant", "没有信号——这是常数"));
    } else {
      gate("G2", "non-constancy", true, t("reads at least one signal", "至少读取一个信号"));
    }

    /* ---- G3 dispersion ---- */
    var degenerate = false;
    walk(ast, function (n) {
      if (n.kind === "binary" && (n.op === "Sub" || n.op === "Div" || n.op === "Pow")) {
        if (canon(n.left) === canon(n.right)) degenerate = true;
      }
      if (n.kind === "binary" && n.op === "Mul") {
        var z = function (x) { return x.kind === "const" && x.value === 0; };
        if (z(n.left) || z(n.right)) degenerate = true;
      }
    });
    if (degenerate) {
      gate("G3", "dispersion", false, t("the expression cancels itself — zero variance by construction",
        "表达式自我抵消——构造上零方差"));
    } else {
      gate("G3", "dispersion", true, t("varies with the panel", "随面板变化"));
    }

    /* ---- G4 rationale ---- */
    var rlen = out.rationale.trim().length;
    if (rlen < 12) {
      gate("G4", "economic rationale", false,
        rlen ? t("too short — the gate wants a sentence", "太短——闸门要一句话")
          : t("empty — add the rationale after a dash: judge Rank(...) — why it should pay",
              "为空——在破折号后补上理由：judge Rank(...) — 它为什么该兑现"));
    } else {
      gate("G4", "economic rationale", true, t("stated, and printed on the receipt", "已陈述，并会印在回执上"));
    }

    /* ---- C1 look-ahead ---- */
    gate("C1", "look-ahead", true,
      t("unrepresentable in this grammar — no forward index exists",
        "本文法无法表达——不存在前向索引"));

    /* ---- C2 numerical safety ---- */
    var divRisk = null;
    walk(ast, function (n) {
      if (n.kind === "binary" && n.op === "Div" && !isPositive(n.right)) divRisk = true;
    });
    if (divRisk) {
      gate("C2", "numerical safety", true,
        t("flag · denominator can reach zero; the sandbox masks, never imputes",
          "标记 · 分母可能为零；沙箱只做屏蔽，绝不做插补"));
    } else {
      gate("C2", "numerical safety", true, t("no unbounded division", "无无界除法"));
    }

    /* ---- C3 turnover ---- */
    if (b.minWindow && b.minWindow < TURNOVER_WINDOW) {
      gate("C3", "turnover", true,
        t("flag · window " + b.minWindow + " < " + TURNOVER_WINDOW + " days — expect a cost problem",
          "标记 · 窗口 " + b.minWindow + " < " + TURNOVER_WINDOW + " 天——成本上会有问题"));
    } else {
      gate("C3", "turnover", true, t("window inside the budget", "窗口在预算内"));
    }

    /* ---- C4 complexity budget ---- */
    if (b.nodes > BUDGET.nodes || out.signals.length > BUDGET.signals || b.maxWindow > BUDGET.maxWindow) {
      gate("C4", "complexity", false,
        t("over budget: " + b.nodes + "/" + BUDGET.nodes + " nodes · " +
          out.signals.length + "/" + BUDGET.signals + " signals",
          "超出预算：" + b.nodes + "/" + BUDGET.nodes + " 节点 · " +
          out.signals.length + "/" + BUDGET.signals + " 信号"));
    } else {
      gate("C4", "complexity", true,
        t(b.nodes + "/" + BUDGET.nodes + " nodes · " + out.signals.length + "/" + BUDGET.signals + " signals",
          b.nodes + "/" + BUDGET.nodes + " 节点 · " + out.signals.length + "/" + BUDGET.signals + " 信号"));
    }

    /* ---- C5 duplicate ---- */
    var dup = null;
    if (opts.admitted) {
      gate("C5", "novelty", true,
        t("already in the admitted set — this is the re-run", "已在准入集合中——这是复跑"));
    } else {
      shipped().forEach(function (f) {
        if (canon(f.expr) === out.canon) dup = f.name;
      });
      if (dup) {
        gate("C5", "novelty", false, t("duplicate of the admitted factor " + dup,
          "与已准入因子 " + dup + " 重复"));
      } else {
        gate("C5", "novelty", true, t("not in the admitted set", "不在已准入集合中"));
      }
    }
    out.dup = dup;

    /* ---- verdict ---- */
    var hard = out.gates.filter(function (g) { return !g.ok; });
    var flags = out.gates.filter(function (g) { return g.ok && /flag|标记/.test(g.note); });
    out.verdict = hard.length ? "reject" : (flags.length ? "flag" : "admit");
    return out;
  }

  /* -------------------------------------------------------------- sampler */
  /* "Proposals are cheap." This is a seeded grammar sampler, not a model —
     labelled as such wherever it is shown. It deliberately emits a share of
     defective proposals, because a proposal stream with no defects would be
     a lie about what a generator actually produces. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sampler(seed) {
    var u = rng(seed);
    function pick(a) { return a[Math.floor(u() * a.length) % a.length]; }
    var UN = Object.keys(UNARY), BI = Object.keys(BINARY), RO = Object.keys(ROLLING);

    function leaf() {
      return u() < 0.82
        ? { kind: "input", signal: pick(SIGNALS) }
        : { kind: "const", value: pick([1, 2, 5, 10]) };
    }
    function grow(depth) {
      if (depth <= 0 || u() < 0.28) return leaf();
      var r = u();
      if (r < 0.34) return { kind: "unary", op: pick(UN), inner: grow(depth - 1) };
      if (r < 0.66) return { kind: "rolling", op: pick(RO), window: pick([5, 10, 20, 60]), inner: grow(depth - 1) };
      return { kind: "binary", op: pick(BI), left: grow(depth - 1), right: grow(depth - 1) };
    }

    function toText(n) {
      if (!n) return "?";
      if (n.kind === "input") return n.signal;
      if (n.kind === "const") return String(n.value);
      if (n.kind === "unary") return n.op + "(" + toText(n.inner) + ")";
      if (n.kind === "rolling") return n.op + "[" + n.window + "](" + toText(n.inner) + ")";
      return "(" + toText(n.left) + " " + ({ Add: "+", Sub: "-", Mul: "*", Div: "/", Min: "min", Max: "max", Pow: "^" }[n.op] || "+") + " " + toText(n.right) + ")";
    }

    return function propose() {
      var ast = grow(3);
      /* inject the defect mix a real proposal stream carries */
      var r = u();
      if (r < 0.09) {
        /* bad window */
        var done = false;
        (function fix(n) {
          if (done) return;
          if (n.kind === "rolling") { n.window = u() < 0.5 ? 1 : 300; done = true; return; }
          if (n.inner) fix(n.inner);
          if (n.left) fix(n.left);
          if (n.right) fix(n.right);
        })(ast);
      } else if (r < 0.15) {
        ast = { kind: "const", value: pick([1, 2, 5]) };
      } else if (r < 0.21) {
        var x = grow(1);
        ast = { kind: "binary", op: "Sub", left: x, right: x };
      } else if (r < 0.27) {
        var f = shipped();
        if (f.length) ast = f[Math.floor(u() * f.length) % f.length].expr;
      }
      return { text: toText(ast), rationale: u() < 0.88 ? "proposal from the sampler" : "" };
    };
  }

  function funnel(n, seed) {
    var propose = sampler(seed), res = {
      proposed: n, admit: 0, flag: 0, reject: 0,
      reasons: {}, examples: { admit: [], reject: [] }
    };
    for (var i = 0; i < n; i++) {
      var p = propose();
      var r = check(p.text, p.rationale);
      res[r.verdict] = (res[r.verdict] || 0) + 1;
      var why = r.gates.filter(function (g) { return !g.ok; })[0];
      var key = why ? why.id + " · " + why.name : "admit";
      res.reasons[key] = (res.reasons[key] || 0) + 1;
      if (r.verdict === "admit" && res.examples.admit.length < 3) res.examples.admit.push(p.text);
      if (why && res.examples.reject.length < 3) res.examples.reject.push({ text: p.text, why: why.id + " " + why.note });
    }
    return res;
  }

  /* ------------------------------------------------------------------ copy */
  function GATES() {
    return [
      ["G1", "executability", "可执行"],
      ["G2", "non-constancy", "非常数"],
      ["G3", "dispersion", "离散度"],
      ["G4", "economic rationale", "经济理由"],
      ["C1", "look-ahead", "前视"],
      ["C2", "numerical safety", "数值安全"],
      ["C3", "turnover", "换手"],
      ["C4", "complexity", "复杂度"],
      ["C5", "novelty", "新颖性"]
    ];
  }

  /* -------------------------------------------------------------------- UI */
  var root, exprEl, whyEl, outEl, verdictEl, listEl, astEl, funnelEl, astLabel;

  function mount() {
    var sec = document.getElementById("factory");
    if (!sec || document.getElementById("gate")) return;
    var host = sec.querySelector(".factor-panel") || sec;

    root = el("div", "gate");
    root.id = "gate";

    var head = el("div", "gate-head");
    head.appendChild(el("p", "gate-kicker", t("05b · Constitution gate · running in this tab", "05b · 宪章闸门 · 在本页运行")));
    head.appendChild(el("h3", "gate-title", t("The gate is real. Write a factor and watch it get judged.",
      "闸门是真的。写一个因子，看它被判。")));
    head.appendChild(el("p", "gate-lede", t(
      "The shipped grammar, compiled here: a tokenizer, a parser, four front gates and four constitution checks. Every number it prints is a property of your program — never a performance claim.",
      "本页把站点自带的文法编译了一遍：分词器、语法分析器、四道前门闸、四项宪章检查。它印出的每一个数都是关于你这个程序的属性——从来不是业绩主张。")));
    root.appendChild(head);

    var grid = el("div", "gate-grid");

    /* inputs */
    var inp = el("div", "gate-in");
    var l1 = el("label", "gate-label", t("Factor expression", "因子表达式"));
    l1.setAttribute("for", "gate-expr");
    inp.appendChild(l1);
    exprEl = el("input", "gate-input");
    exprEl.id = "gate-expr";
    exprEl.type = "text";
    exprEl.spellcheck = false;
    exprEl.value = "Rank(Mean[10](BestAsk - BestBid) / MidPrice)";
    inp.appendChild(exprEl);
    inp.appendChild(el("p", "gate-vocab",
      t("signals  BidSize · AskSize · BestBid · BestAsk · MidPrice · Volume · TradeSide · TradeSize",
        "信号  BidSize · AskSize · BestBid · BestAsk · MidPrice · Volume · TradeSide · TradeSize")));
    inp.appendChild(el("p", "gate-vocab",
      t("rolling  Mean[w] · Zscore[w] · Slope[w] · Std[w]     unary  Rank · Abs · Sign · Diff · Log · Sqrt",
        "滚动  Mean[w] · Zscore[w] · Slope[w] · Std[w]     一元  Rank · Abs · Sign · Diff · Log · Sqrt")));

    var l2 = el("label", "gate-label", t("Economic rationale — G4 asks for a sentence, not a number", "经济理由 —— G4 要一句话，不要一个数字"));
    l2.setAttribute("for", "gate-why");
    inp.appendChild(l2);
    whyEl = el("input", "gate-input");
    whyEl.id = "gate-why";
    whyEl.type = "text";
    whyEl.spellcheck = false;
    whyEl.placeholder = t("queue asymmetry makes the bid side informative", "队列不对称让买盘一侧更有信息");
    whyEl.value = t("quoted spread relative to price ranks names under temporary liquidity stress",
      "报价价差相对价格，给流动性紧张下的标的排序");
    inp.appendChild(whyEl);

    var row = el("div", "gate-row");
    var runBtn = el("button", "gate-btn primary", t("Run the gate", "运行闸门"));
    runBtn.type = "button";
    runBtn.id = "gate-run";
    runBtn.addEventListener("click", function () { paint(check(exprEl.value, whyEl.value)); });
    row.appendChild(runBtn);

    var sweepBtn = el("button", "gate-btn", t("Sweep the shipped factors", "扫描站点自带因子"));
    sweepBtn.type = "button";
    sweepBtn.id = "gate-sweep";
    sweepBtn.addEventListener("click", sweep);
    row.appendChild(sweepBtn);

    var sampleBtn = el("button", "gate-btn", t("Propose 400 candidates", "生成 400 个提案"));
    sampleBtn.type = "button";
    sampleBtn.id = "gate-sample";
    sampleBtn.addEventListener("click", function () { paintFunnel(funnel(400, 20261105)); });
    row.appendChild(sampleBtn);
    inp.appendChild(row);
    grid.appendChild(inp);

    /* output */
    outEl = el("div", "gate-out");
    verdictEl = el("div", "gate-verdict");
    verdictEl.dataset.v = "reject";
    verdictEl.setAttribute("role", "status");
    verdictEl.setAttribute("aria-live", "polite");
    verdictEl.innerHTML = '<span class="gv-k">' + t("verdict", "判决") + '</span><b>—</b><p></p>';
    outEl.appendChild(verdictEl);

    listEl = el("ol", "gate-checks");
    outEl.appendChild(listEl);

    astLabel = el("p", "gate-astlabel", t("typed AST — the site's own format", "类型化 AST —— 站点自己的格式"));
    outEl.appendChild(astLabel);
    astEl = el("pre", "gate-ast");
    outEl.appendChild(astEl);

    funnelEl = el("div", "gate-funnel");
    funnelEl.hidden = true;
    outEl.appendChild(funnelEl);

    grid.appendChild(outEl);
    root.appendChild(grid);
    host.parentNode.insertBefore(root, host.nextSibling);

    exprEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); paint(check(exprEl.value, whyEl.value)); }
    });
    whyEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); paint(check(exprEl.value, whyEl.value)); }
    });
    document.addEventListener("hj:lang", relabel);

    paint(check(exprEl.value, whyEl.value));
  }

  function paint(r) {
    if (!verdictEl) return;
    var K = {
      admit: [t("ADMITTED", "准入"), t("every gate passes. Admission is a statement about the program — not about its edge.",
        "所有闸门通过。准入是关于程序的陈述——不是关于它的收益。")],
      flag: [t("ADMITTED WITH FLAGS", "准入·带标记"), t("it runs, but the flags are the part you would have to defend.",
        "能跑，但标记部分是你需要辩护的。")],
      reject: [t("REJECTED", "拒绝"), t("the gate stops here. Proposals are cheap; admission is not.",
        "闸门到此为止。提案便宜，准入不便宜。")]
    }[r.verdict];

    verdictEl.dataset.v = r.verdict;
    verdictEl.querySelector("b").textContent = K[0];
    verdictEl.querySelector("p").textContent = K[1];

    listEl.innerHTML = "";
    r.gates.forEach(function (g) {
      var li = el("li");
      li.dataset.ok = g.ok ? "1" : "0";
      li.dataset.flag = g.ok && /flag|标记/.test(g.note) ? "1" : "0";
      li.appendChild(el("span", "gc-id", g.id));
      li.appendChild(el("span", "gc-name", g.name));
      li.appendChild(el("span", "gc-note", g.note));
      listEl.appendChild(li);
    });

    astEl.textContent = r.ast
      ? (typeof prettyExpr === "function" ? prettyExpr(r.ast) : JSON.stringify(r.ast, null, 2))
      : "—";
    funnelEl.hidden = true;
  }

  function sweep() {
    var fs = shipped();
    if (!fs.length) return;
    var rows = fs.map(function (f) {
      var r = check(canonToText(f.expr), "shipped sample factor: " + f.name, { admitted: true });
      return { name: f.name, r: r };
    });
    var admitted = rows.filter(function (x) { return x.r.verdict !== "reject"; }).length;
    verdictEl.dataset.v = admitted === rows.length ? "admit" : "flag";
    verdictEl.querySelector("b").textContent = admitted + " / " + rows.length + " " + t("admitted", "准入");
    verdictEl.querySelector("p").textContent = t(
      "the six factors this page ships, run back through the gate that is supposed to have admitted them.",
      "站点自带的六个因子，用那道本该准入它们的闸门重跑一遍。");
    listEl.innerHTML = "";
    rows.forEach(function (x) {
      var li = el("li");
      li.dataset.ok = x.r.verdict === "reject" ? "0" : "1";
      li.dataset.flag = x.r.verdict === "flag" ? "1" : "0";
      li.appendChild(el("span", "gc-id", x.r.verdict === "reject" ? "✗" : "✓"));
      li.appendChild(el("span", "gc-name", x.name));
      li.appendChild(el("span", "gc-note", x.r.verdict === "reject"
        ? x.r.gates.filter(function (g) { return !g.ok; })[0].note
        : t(x.r.nodes + " nodes · " + x.r.signals.length + " signals", x.r.nodes + " 节点 · " + x.r.signals.length + " 信号")));
      listEl.appendChild(li);
    });
    astEl.textContent = "—";
    funnelEl.hidden = true;
  }

  /* AST -> text, for re-running the shipped factors through the parser */
  function canonToText(n) {
    if (!n) return "";
    if (n.kind === "input") return n.signal;
    if (n.kind === "const") return String(n.value);
    if (n.kind === "unary") return n.op + "(" + canonToText(n.inner) + ")";
    if (n.kind === "rolling") return n.op + "[" + n.window + "](" + canonToText(n.inner) + ")";
    var sym = { Add: "+", Sub: "-", Mul: "*", Div: "/", Pow: "^" }[n.op];
    if (sym) return "(" + canonToText(n.left) + " " + sym + " " + canonToText(n.right) + ")";
    return n.op + "(" + canonToText(n.left) + ", " + canonToText(n.right) + ")";
  }

  function paintFunnel(f) {
    if (!funnelEl) return;
    var pct = function (x) { return (x / f.proposed) * 100; };
    verdictEl.dataset.v = "flag";
    verdictEl.querySelector("b").textContent = f.admit + " / " + f.proposed + " " + t("admitted", "准入");
    verdictEl.querySelector("p").textContent = t(
      "a seeded grammar sampler, not a model: " + f.reject + " rejected, " + f.flag + " admitted with flags. Proposals are cheap.",
      "带种子的文法采样器，不是模型：" + f.reject + " 个被拒，" + f.flag + " 个带标记准入。提案是便宜的。");

    var rows = Object.keys(f.reasons)
      .filter(function (k) { return k !== "admit"; })
      .sort(function (a, b) { return f.reasons[b] - f.reasons[a]; })
      .slice(0, 6);

    funnelEl.hidden = false;
    funnelEl.innerHTML =
      '<div class="gf-bar">' +
      '<i class="s-admit" style="width:' + pct(f.admit) + '%"></i>' +
      '<i class="s-flag" style="width:' + pct(f.flag) + '%"></i>' +
      '<i class="s-reject" style="width:' + pct(f.reject) + '%"></i>' +
      '</div>' +
      '<div class="gf-legend">' +
      '<span><b>' + f.admit + '</b> ' + t("admitted", "准入") + '</span>' +
      '<span><b>' + f.flag + '</b> ' + t("flagged", "带标记") + '</span>' +
      '<span><b>' + f.reject + '</b> ' + t("rejected", "拒绝") + '</span>' +
      '</div>' +
      '<div class="gf-reasons">' + rows.map(function (k) {
        return '<div><span>' + k + '</span><b>' + f.reasons[k] + '</b></div>';
      }).join("") + '</div>' +
      '<p class="gf-note">' + t("the sampler is in this file; the seed is fixed so the numbers are the same for everyone. It is a proposal stream, not a language model.",
        "采样器就在这个文件里；种子固定，所以每个人看到的数字一样。它是提案流，不是语言模型。") + '</p>';
    listEl.innerHTML = "";
    astEl.textContent = "—";
  }

  function relabel() {
    if (!root) return;
    root.querySelector(".gate-kicker").textContent = t("05b · Constitution gate · running in this tab", "05b · 宪章闸门 · 在本页运行");
    root.querySelector(".gate-title").textContent = t("The gate is real. Write a factor and watch it get judged.",
      "闸门是真的。写一个因子，看它被判。");
    root.querySelector(".gate-lede").textContent = t(
      "The shipped grammar, compiled here: a tokenizer, a parser, four front gates and four constitution checks. Every number it prints is a property of your program — never a performance claim.",
      "本页把站点自带的文法编译了一遍：分词器、语法分析器、四道前门闸、四项宪章检查。它印出的每一个数都是关于你这个程序的属性——从来不是业绩主张。");
    var labs = root.querySelectorAll(".gate-label");
    if (labs[0]) labs[0].textContent = t("Factor expression", "因子表达式");
    if (labs[1]) labs[1].textContent = t("Economic rationale — G4 asks for a sentence, not a number", "经济理由 —— G4 要一句话，不要一个数字");
    var vocab = root.querySelectorAll(".gate-vocab");
    if (vocab[0]) vocab[0].textContent = t("signals  BidSize · AskSize · BestBid · BestAsk · MidPrice · Volume · TradeSide · TradeSize",
      "信号  BidSize · AskSize · BestBid · BestAsk · MidPrice · Volume · TradeSide · TradeSize");
    if (vocab[1]) vocab[1].textContent = t("rolling  Mean[w] · Zscore[w] · Slope[w] · Std[w]     unary  Rank · Abs · Sign · Diff · Log · Sqrt",
      "滚动  Mean[w] · Zscore[w] · Slope[w] · Std[w]     一元  Rank · Abs · Sign · Diff · Log · Sqrt");
    var bs = root.querySelectorAll(".gate-btn");
    if (bs[0]) bs[0].textContent = t("Run the gate", "运行闸门");
    if (bs[1]) bs[1].textContent = t("Sweep the shipped factors", "扫描站点自带因子");
    if (bs[2]) bs[2].textContent = t("Propose 400 candidates", "生成 400 个提案");
    if (whyEl) whyEl.placeholder = t("queue asymmetry makes the bid side informative", "队列不对称让买盘一侧更有信息");
    if (astLabel) astLabel.textContent = t("typed AST — the site's own format", "类型化 AST —— 站点自己的格式");
    paint(check(exprEl.value, whyEl.value));
  }

  /* ------------------------------------------------------------------ api */
  function init() {
    mount();
    window.HJ_GATE = {
      check: check,
      funnel: funnel,
      /* the gate's own parser, exposed so the learning bench can evaluate a
         factor as a time series instead of judging it as a proposal */
      parse: function (src) { return parse(src); },
      signals: SIGNALS.slice(),
      sweep: function () {
        return shipped().map(function (f) {
          var r = check(canonToText(f.expr), "shipped sample factor: " + f.name, { admitted: true });
          return { name: f.name, verdict: r.verdict, gates: r.gates, nodes: r.nodes };
        });
      },
      toText: canonToText,
      focus: function () {
        if (!root) return;
        root.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function () { if (exprEl) exprEl.focus({ preventScroll: true }); }, 520);
      }
    };
  }

  /* This is a classic script at the end of <body>, so #factory is already in
     the DOM by the time it runs. Initialise now instead of on DOMContentLoaded:
     upgrade.js loads immediately after this file and hands HJ_GATE to the
     console, and a shared ?run= link starts printing before that event fires.
     Language resolution reads localStorage, so the labels are the same either
     way, and hj:lang still relabels on toggle. */
  if (document.readyState === "loading" && !document.getElementById("factory")) {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
