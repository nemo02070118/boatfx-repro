/* ==========================================================================
   BOAT-3 · 00b research agent — author: 金宦年
   --------------------------------------------------------------------------
   Not a replay. A free-text router extracts parameters from whatever you
   type, then calls the instruments this page already ships:

     gate.check(expr, why)     -> HJ_GATE      (§05b constitution gate)
     gate.funnel(n, seed)      -> HJ_GATE      (seeded proposal stream)
     gate.sweep()              -> HJ_GATE      (the shipped sample factors)
     gate.parse(src)           -> HJ_GATE      (the gate's own grammar, as an AST)
     bench.stats()             -> HJ_BENCH     (§04b autopsy bench)
     ml.market / evalAST       -> HJ_ML        (§04c declared market + grammar)
     ml.stats / logistic / ridge / placebo    (real learning, no library)
     paper.dilute / hurdle / pool             (this page's own math)

   Deterministic: the same question always produces the same answer, the same
   seed (20261105) the rest of the site uses. No network request is made at
   any point — open DevTools and watch.
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

  var AG_I18N = {
    en: {
      "brand": "BOAT-3",
      "ver": "engine v1.0 · local",
      "ctx": "Moutai · daily",
      "m.auto": "Auto", "m.gate": "Gate", "m.paper": "Paper",
      "m.desk": "Desk", "m.library": "Library", "m.learn": "Learn",
      "think.on": "Think · on", "think.off": "Think · off",
      "status.ready": "ready", "status.busy": "computing…",
      "roster.h": "Instruments",
      "t.gate.d": "judge a factor expression · 9 gates",
      "t.dilute.d": "Prop. 2 · t_g = t·√π",
      "t.hurdle.d": "discovery wall · √(2 ln N)",
      "t.pool.d": "Stouffer · pooled t",
      "t.autopsy.d": "last autopsy-bench numbers",
      "t.library.d": "seeded proposal funnel",
      "t.mleval.d": "a factor on the declared market · IC, t, Sharpe",
      "t.mltrain.d": "logistic + ridge · real gradient descent",
      "t.mlplacebo.d": "permutation test · null distribution + p",
      "t.mlmarket.d": "the declared generative process",
      "roster.f": "Every call runs in this tab.",
      "empty.k": "00b · research agent",
      "empty.t": "Ask BOAT-3.",
      "empty.s": "It judges factor expressions, evaluates them on a declared market, trains real models on the eight signals and permutation-tests the answer — all computed in this tab. No model call, no network, no API key. Attach a brain (top right) and a real language model answers instead — with the same instruments as its tools, and still no invented numbers.",
      "send": "Send", "stop": "Stop",
      "note": "computed in this tab · 0 network requests · open DevTools and watch",
      "brain.off": "Brain · off",
      "brain.title": "The brain",
      "brain.lead": "Two ways to give this page a real language model. Either way the model cannot compute anything itself: the ten instruments stay its tools, and the system prompt forbids stating a number that did not come back from one.",
      "brain.p.none": "no brain — the deterministic router answers",
      "brain.p.deepseek": "DeepSeek · your key",
      "brain.p.openai": "OpenAI · your key",
      "brain.p.custom": "any OpenAI-compatible endpoint",
      "brain.p.local": "in this browser · WebLLM + WebGPU",
      "brain.key": "API key",
      "brain.keyph": "sk-…",
      "brain.base": "base URL",
      "brain.baseph": "https://…/v1",
      "brain.model": "model",
      "brain.load": "load the model",
      "brain.clear": "clear the brain",
      "brain.note": "The key is written to this browser's localStorage and is sent to nobody except the provider you chose. The tape stays declared-synthetic either way: admission at the gate never means a program earns.",
      "brain.close": "close",
      "wb.h": "Factor workbench — your factors, our machinery",
      "wb.p": "Paste a library — one “name, t” per line, or “name :: formula”, or bare expressions, or sharpe= for your own strategy — or load a .txt/.csv file. It is measured here, then run through both ways: the universal screen against home-venue routing plus pooling.",
      "wb.upload": "load a file",
      "wb.run": "run it",
      "wb.note": "computed in this tab · nothing leaves the page",
      "brain.weights": "The model file itself (~1.1–2 GB) downloads from huggingface.co the first time — if that host is unreachable on your network, use your own key instead.",
      "brain.lna": "Local endpoints (Ollama, LM Studio) work only when this page is opened over http — over https, Chrome's private-network policy refuses the loopback call, and no header can lift it. On the live https site, use a public endpoint.",
      "brain.own": "Your own machine as the server (16 GB card): install LM Studio, pull Qwen3.5-9B GGUF from ModelScope — pip install modelscope, then modelscope download --model Qwen/Qwen3.5-9B-Instruct-GGUF --local_dir ./qwen35-9b — load the Q4/Q6 file in LM Studio, start its local server (port 1234), open this page over http, and put http://localhost:1234/v1 below with model qwen3.5-9b. Native tool calling, all 24 instruments, no download from huggingface at all.",
      "brain.net.byok": "model via your key · the instruments are its tools · it may not invent a number",
      "brain.net.local": "local model in this tab · the instruments are its tools · it may not invent a number",
      "rail.session": "Session",
      "rail.canon": "§05b canonical funnel",
      "rail.jump": "Jump",
      "aria.modes": "Answer mode",
      "aria.roster": "Instruments",
      "aria.rail": "Session rail",
      "ph.0": "judge Rank(Mean[10](BestAsk - BestBid) / MidPrice) — order-book imbalance…",
      "ph.1": "evaluate Rank(Mean[10](BestAsk - BestBid) / MidPrice) on the market…",
      "ph.2": "train logistic + ridge on the eight signals…",
      "ph.3": "placebo test the imbalance factor…",
      "ph.4": "show me the market's generative process…",
      "ph.5": "t = 2.40 · π = 0.25 — does it survive?",
      "ph.6": "pool 1.8, 2.2, 0.9, 1.4",
      "ph.7": "N = 6960 — what is the discovery wall?",
      "ph.8": "run the funnel on 400 proposals",
      "ph.9": "what can't you answer?",
      "ph.10": "let the council rule on t = 2.40 · π = 0.25",
      "ph.11": "resurrect the sample library",
      "ph.12": "build a strategy on the order-book imbalance",
      "ph.13": "find the home venue of the imbalance factor",
      "ph.14": "who built this?",
      "plain.on": "Plain · on", "plain.off": "Plain · off",
      "plain.aria": "Plain language mode"
    },
    zh: {
      "brand": "BOAT-3",
      "ver": "引擎 v1.0 · 本地",
      "ctx": "茅台 · 日线",
      "m.auto": "自动", "m.gate": "闸门", "m.paper": "论文",
      "m.desk": "桌面", "m.library": "因子库", "m.learn": "学习",
      "think.on": "思考链 · 开", "think.off": "思考链 · 关",
      "status.ready": "就绪", "status.busy": "计算中…",
      "roster.h": "仪器",
      "t.gate.d": "评判因子表达式 · 9 道闸门",
      "t.dilute.d": "命题 2 · t_g = t·√π",
      "t.hurdle.d": "发现之墙 · √(2 ln N)",
      "t.pool.d": "Stouffer · 合并 t",
      "t.autopsy.d": "解剖台最近一次的数字",
      "t.library.d": "定种提案漏斗",
      "t.mleval.d": "在声明市场上评估因子 · IC、t、夏普",
      "t.mltrain.d": "逻辑回归 + 岭回归 · 真实梯度下降",
      "t.mlplacebo.d": "置换检验 · 零分布 + p 值",
      "t.mlmarket.d": "声明的生成过程",
      "roster.f": "每次调用都在本页运行。",
      "empty.k": "00b · 研究代理",
      "empty.t": "问 BOAT-3。",
      "empty.s": "它评判因子表达式、在声明市场上评估它们、在八个信号上训练真实模型、再对答案做置换检验——全部在这个页面里算完。没有模型调用、没有网络、没有 API 密钥。接上大脑（右上角）后，由真实的大语言模型回答——仪器还是它的工具，数字照样不许编。",
      "send": "发送", "stop": "停止",
      "note": "本页计算 · 0 次网络请求 · 可以打开 DevTools 看",
      "brain.off": "大脑 · 关",
      "brain.title": "大脑",
      "brain.lead": "有两种方式给这个页面接上真实的大语言模型。两种方式下模型自己都算不了任何东西：十件仪器仍然是它的工具，系统提示词禁止它陈述任何没从仪器调用回来的数字。",
      "brain.p.none": "无大脑——确定性路由器回答",
      "brain.p.deepseek": "DeepSeek · 你的密钥",
      "brain.p.openai": "OpenAI · 你的密钥",
      "brain.p.custom": "任何 OpenAI 兼容端点",
      "brain.p.local": "在本浏览器里 · WebLLM + WebGPU",
      "brain.key": "API 密钥",
      "brain.keyph": "sk-…",
      "brain.base": "接口地址",
      "brain.baseph": "https://…/v1",
      "brain.model": "模型",
      "brain.load": "加载模型",
      "brain.clear": "清除大脑",
      "brain.note": "密钥只写进这个浏览器的 localStorage，除了你选择的提供方之外不发给任何人。胶带无论如何都是声明的合成数据：闸门准入从来不代表一个程序能赚钱。",
      "brain.close": "关闭",
      "wb.h": "因子工作台——你的因子，我们的机器",
      "wb.p": "粘贴一个库——每行「名称, t」，或「名称 :: 公式」，或纯表达式，或你自己策略的 sharpe=——也可以加载 .txt/.csv 文件。在这里测量，然后跑双路：通用筛 对 主场路由+池化。",
      "wb.upload": "加载文件",
      "wb.run": "运行",
      "wb.note": "本页计算 · 数据不出页面",
      "brain.weights": "模型文件本身（约 1.1–2 GB）首次加载时从 huggingface.co 下载——如果那个主机在你的网络不可达，请改用你自己的密钥。",
      "brain.lna": "本地端点（Ollama、LM Studio）只在以 http 打开本页时可用——https 下 Chrome 的私有网络策略会拒绝回环调用，任何响应头都解不了。在线上 https 站点请用公网端点。",
      "brain.own": "用你自己的电脑当服务器（16GB 显卡）：装 LM Studio，从 ModelScope 拉 Qwen3.5-9B GGUF——pip install modelscope，然后 modelscope download --model Qwen/Qwen3.5-9B-Instruct-GGUF --local_dir ./qwen35-9b——在 LM Studio 加载 Q4/Q6 文件，开本地服务（1234 端口），用 http 打开本页，下面填 http://localhost:1234/v1，模型名 qwen3.5-9b。原生 tool calling、全部 24 件仪器、完全不碰 huggingface。",
      "brain.net.byok": "模型经由你的密钥 · 仪器是它的工具 · 它不许编造数字",
      "brain.net.local": "本页运行本地模型 · 仪器是它的工具 · 它不许编造数字",
      "rail.session": "本次会话",
      "rail.canon": "§05b 标准漏斗",
      "rail.jump": "跳转",
      "aria.modes": "回答模式",
      "aria.roster": "仪器",
      "aria.rail": "会话栏",
      "ph.0": "评判 Rank(Mean[10](BestAsk - BestBid) / MidPrice)——盘口失衡……",
      "ph.1": "在市场上评估 Rank(Mean[10](BestAsk - BestBid) / MidPrice)……",
      "ph.2": "在八个信号上训练逻辑回归 + 岭回归……",
      "ph.3": "对失衡因子做置换检验……",
      "ph.4": "给我看市场的生成过程……",
      "ph.5": "t = 2.40 · π = 0.25——能过筛吗？",
      "ph.6": "合并 1.8, 2.2, 0.9, 1.4",
      "ph.7": "N = 6960——发现之墙有多高？",
      "ph.8": "跑 400 个提案的漏斗",
      "ph.9": "有什么你答不了？",
      "ph.10": "让议会裁决 t = 2.40 · π = 0.25",
      "ph.11": "复活样本因子库",
      "ph.12": "以盘口失衡建策略",
      "ph.13": "找盘口失衡的主场",
      "ph.14": "这是谁做的？",
      "plain.on": "说人话 · 开", "plain.off": "说人话 · 关",
      "plain.aria": "通俗语言模式"
    }
  };

  function applyAgI18n() {
    var dict = AG_I18N[lang()] || AG_I18N.en;
    document.querySelectorAll("[data-ag-i18n]").forEach(function (n) {
      var k = n.getAttribute("data-ag-i18n");
      if (dict[k] != null) n.textContent = dict[k];
    });
    document.querySelectorAll("[data-ag-i18n-ph]").forEach(function (n) {
      var k = n.getAttribute("data-ag-i18n-ph");
      if (dict[k] != null && document.activeElement !== n) n.setAttribute("placeholder", dict[k]);
    });
    document.querySelectorAll("[data-ag-aria]").forEach(function (n) {
      var k = n.getAttribute("data-ag-aria");
      if (dict[k] != null) n.setAttribute("aria-label", dict[k]);
    });
    var th = document.getElementById("ag-think");
    if (th) th.textContent = dict[th.classList.contains("is-on") ? "think.on" : "think.off"];
  }

  /* ------------------------------------------------------------- helpers */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function num(x, d) {
    if (!isFinite(x)) return "—";
    return Number(x).toFixed(d == null ? 2 : d);
  }
  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------- paper constants
     Every one of these is already printed elsewhere on this page. */
  var SCREEN = 1.96;                    /* single-test screen               */
  var D_EFF = 17;                       /* effective independent trials      */
  var ALLOC = Math.sqrt(2 * Math.log(D_EFF)); /* 2.3803 allocation bar      */
  var SEED = 20261105;                  /* the site's fixed seed            */
  var VERSION = "v3.0";

  /* The §05b canonical funnel for the same seed — shown in the rail so a
     reader can check the agent's answer against the panel. */
  var CANON = {
    proposed: 400, g1: 305, g2: 240, g3: 215, g4: 188,
    admit: 176, flag: 12, reject: 212
  };

  /* ------------------------------------------------------------- the math */
  function dilute(tStat, pi) { return tStat * Math.sqrt(pi); }

  function hurdle(N) { return Math.sqrt(2 * Math.log(N)); }

  function pool(vals) {
    var n = vals.length;
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / n;
    return { n: n, mean: mean, pooled: mean * Math.sqrt(n) };
  }

  /* numbers the agent is allowed to quote — all already on this page */
  var DESK = [
    { k: "Ising T", v: "2.075", s: "HIGH · Tc ≈ 2.269" },
    { k: "LPPLS", v: "35%", s: "safe band" },
    { k: "V12 SR", v: "2.595", s: "ann ≈ 54.1% · max DD ≈ 11.6%" },
    { k: "SHAP pos", v: "−76%", s: "drag" },
    { k: "Book", v: "¥50k → ~¥1.00M", s: "personal" },
    { k: "Last", v: "1413.64", s: "+1.55%" }
  ];

  /* ======================================================================
     ROUTER — free text in, intent + slots out. Deterministic: the same
     question always yields the same intent and the same parameters.
     ====================================================================== */
  var GRAMMAR = ["Mean", "Zscore", "Slope", "Std", "Rank", "Abs", "Sign", "Diff",
    "Neg", "Log", "Sqrt", "BidSize", "AskSize", "BestBid", "BestAsk", "MidPrice",
    "Volume", "TradeSide", "TradeSize", "Add", "Sub", "Mul", "Div", "Min", "Max", "Pow"];


  function normalize(s) {
    return String(s == null ? "" : s)
      .replace(/[\uFF01-\uFF5E]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
      })
      .replace(/\u3000/g, " ")
      .replace(/[\r\n]+/g, " ")
      .trim();
  }

  function hasGrammar(s) {
    return GRAMMAR.some(function (g) {
      return new RegExp("(^|[^A-Za-z0-9_])" + g + "([^A-Za-z0-9_]|$)").test(s);
    });
  }

  /* the longest grammar-token-bearing run in the text — the candidate factor */
  /* the index of the bracket that closes the one at k, or -1 */
  function matchBracket(s, k) {
    var d = 0;
    for (var m = k; m < s.length; m++) {
      var c = s.charAt(m);
      if (c === "(" || c === "[") d++;
      else if (c === ")" || c === "]") { d--; if (d === 0) return m; }
    }
    return -1;
  }

  function balancedRun(s, i, j) {
    var d = 0;
    for (var k = i; k < j; k++) {
      var c = s.charAt(k);
      if (c === "(" || c === "[") d++;
      else if (c === ")" || c === "]") { d--; if (d < 0) return false; }
    }
    return d === 0;
  }

  /* one identifier, read backwards from i */
  function leftIdent(s, i) {
    var k = i, e = k;
    while (k > 0 && /[A-Za-z0-9_]/.test(s.charAt(k - 1))) k--;
    return k === e ? null : k;
  }

  /* an operator with an atom on its left: " - Mean" */
  function leftAtom(s, i) {
    var k = i;
    while (k > 0 && /\s/.test(s.charAt(k - 1))) k--;
    if (k === 0 || "-+*/^".indexOf(s.charAt(k - 1)) < 0) return null;
    k--;
    while (k > 0 && /\s/.test(s.charAt(k - 1))) k--;
    var st = leftIdent(s, k);
    return st == null ? null : st;
  }

  /* an operator with an atom on its right: "- Mean[10](x)" */
  function rightAtom(s, j) {
    var k = j;
    while (k < s.length && /\s/.test(s.charAt(k))) k++;
    if (k >= s.length || "-+*/^".indexOf(s.charAt(k)) < 0) return null;
    k++;
    while (k < s.length && /\s/.test(s.charAt(k))) k++;
    var m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(k));
    if (!m) return null;
    var e = k + m[0].length;
    for (;;) {
      var t = e;
      while (t < s.length && /\s/.test(s.charAt(t))) t++;
      if (t < s.length && (s.charAt(t) === "[" || s.charAt(t) === "(")) {
        var close = matchBracket(s, t);
        if (close < 0) break;
        e = close + 1;
        continue;
      }
      break;
    }
    return e;
  }

  /* The longest grammar-token-bearing run, brackets balanced: starting from a
     known operator, swallow its call/window groups, then reach left and right
     across operators. "judge Rank(Mean[10](BestAsk - BestBid) / MidPrice) —
     order-book imbalance" yields the whole expression, not a fragment. */
  function extractExpr(s) {
    var best = "";
    var re = /[A-Za-z_][A-Za-z0-9_]*/g, m;
    while ((m = re.exec(s))) {
      if (GRAMMAR.indexOf(m[0]) < 0) continue;
      var i = m.index, j = m.index + m[0].length;
      for (;;) {
        var t = j;
        while (t < s.length && /\s/.test(s.charAt(t))) t++;
        if (t < s.length && (s.charAt(t) === "[" || s.charAt(t) === "(")) {
          var close = matchBracket(s, t);
          if (close < 0) break;
          j = close + 1;
          continue;
        }
        break;
      }
      for (;;) { var l = leftAtom(s, i); if (l == null || l >= i) break; i = l; }
      for (;;) { var r = rightAtom(s, j); if (r == null || r <= j) break; j = r; }
      while (j > i && !balancedRun(s, i, j)) j--;
      var cand = s.slice(i, j).trim();
      if (cand.length > best.length && hasGrammar(cand)) best = cand;
    }
    return best;
  }

  function extractWhy(s, expr) {
    var m = /\b(?:because|since|reason(?:ale)?|rationale)\b\s*([\s\S]+)$/i.exec(s) ||
      /(?:因为|由于|理由)[：,:，]?\s*([\s\S]+)$/.exec(s);
    if (m) return m[1].trim().replace(/^[\s\-—–:：,，]+/, "").replace(/[.。?？!！\s]+$/, "");
    if (!expr) return s.trim();
    var rest = s.replace(expr, " ");
    rest = rest
      .replace(/^(?:please|kindly|can you|could you|would you|what about|how about|show me|tell me|is|are|does|do|did|will)\b[\s,，:：-]*/i, "")
      .replace(/^(?:judge|check|evaluate|test|run|gate|compile|analyse|analyze|评判|检查|跑一下|跑|看看|看一下|闸门|判一下)\b[\s,，:：-]*/i, "")
      .replace(/^any\s+good\b[\s?？.。,，]*/i, "")
      .replace(/[.。?？!！\s]+$/, "")
      .replace(/^[\s\-—–:：,，]+/, "")
      .trim();
    /* a rationale that is only filler words is no rationale at all */
    if (/^(?:is|are|does|do|what|how|any\s+good|please|it|this|that|the|a|an|怎么样|好不好|行不行|如何|怎么)\b[\s?？.。]*$/i.test(rest)) return "";
    return rest.length > 2 ? rest : "";
  }

  function pickN(nums) {
    var n = 400;
    nums.forEach(function (v) {
      if (v >= 20 && v <= 2000 && Math.round(v) === v) n = v;
    });
    return n;
  }

  function route(raw, forced) {
    var s = normalize(raw);
    var low = s.toLowerCase();
    var nums = (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    var F = forced && forced !== "auto" ? forced : null;

    /* ---- help / capability boundary ---- */
    if (!F && /(who are you|what can you do|what do you do|help|capabilit|boundar|how do i use|how to use|你能做什么|你是谁|帮助|怎么用|能力|边界|能干嘛|会什么)/.test(low)) {
      return { intent: "help" };
    }

    /* ---- a factor expression anywhere means the gate ---- */
    var expr = extractExpr(s);

    /* ---- the learning bench (§04c). These run BEFORE the gate branch so
       that "evaluate Rank(...)" lands on the learning bench while
       "judge Rank(...)" still lands on the constitution gate. ---- */
    if (F === "learn") {
      return { intent: expr ? "mleval" : "train", slots: { expr: expr } };
    }
    if (/(placebo|permutation|置换|零分布|null distribution|shuffle|安慰剂)/i.test(low)) {
      return { intent: "placebo", slots: { expr: expr } };
    }
    if (/(train|learn|logistic|ridge|regression|gradient descent|weights?|loss curve|模型|训练|学习|逻辑回归|岭回归|梯度下降|损失曲线|权重)/i.test(low)) {
      return { intent: "train" };
    }
    if (/(\bic\b|information coefficient|spearman|sharpe|turnover|drawdown|evaluate|backtest|回测|评估|评价|信息系数|测一下|算一下)/i.test(low) && expr) {
      return { intent: "mleval", slots: { expr: expr } };
    }
    if (/(market|tape|generative|synthetic|declared|合成|生成过程|生成器|盘口|数据源)/i.test(low)) {
      return { intent: "market" };
    }

    if (expr || F === "gate") {
      return { intent: "gate", slots: { expr: expr, why: extractWhy(s, expr) } };
    }

    /* ---- dilution: lowercase t (never the uppercase T of "Ising T") ---- */
    var tm = /\bt\s*(?:-\s*stat|-\s*value|值)?\s*[=:≈>]?\s*(-?\d+(?:\.\d+)?)/.exec(s);
    var tStat = tm && Math.abs(Number(tm[1])) <= 40 ? Number(tm[1]) : null;
    var pm = /(?:π|pi|state|状态)\s*[=:≈>]?\s*(\d+(?:\.\d+)?)\s*(%?)/i.exec(s);
    var pi = null;
    if (pm) {
      var pv = Number(pm[1]);
      pi = (pm[2] === "%" || pv > 1) ? pv / 100 : pv;
      if (pi > 1) pi = 1;
    }
    /* ---- the council and the new engines. These sit after the t/pi/N
       extraction (they use it) but BEFORE dilute/pool/hurdle, which would
       otherwise swallow any question that happens to carry a number. ---- */
    function libSlots(s) {
      if (/\n/.test(s) && window.HJ_ENGINES) {
        try { if (window.HJ_ENGINES.helpers.parseLib(s).length >= 2) return { lib: s }; } catch (e) {}
      }
      return {};
    }
    if (/(council|parliament|议会|智体|deliberat|jury)/i.test(low)) {
      var cs = { expr: expr, t: tStat, pi: pi, N: N };
      var cl = libSlots(s);
      if (cl.lib) cs.lib = cl.lib;
      return { intent: "council", slots: cs };
    }
    if (/(resurrect|复活|revive|mis-?kill|误杀)/i.test(low)) {
      var rs = libSlots(s);
      return { intent: "resurrect", slots: rs };
    }
    if (/(guide|向导|一步步|分步|step by step|walk me through)/i.test(low)) {
      return { intent: "guide", slots: { expr: expr } };
    }
    if (/(strategy|策略|仓位规则|建仓|build a (strategy|book)|trade it)/i.test(low)) {
      return { intent: "strategy", slots: { expr: expr } };
    }
    if (/(venue|主场|在哪兑现|哪个段|where does it pay|home state)/i.test(low)) {
      return { intent: "venue", slots: { expr: expr } };
    }
    if (/(foundry|造因子|compile|编译|写一个因子|make me a factor|一句话)/i.test(low)) {
      return { intent: "foundry", slots: { idea: s } };
    }
    if (/(about (you|the author|him|huannian|jin)|who (is|built)|金宦年|作者|这是谁|介绍一下|论文主张|contact|联系|reach him)/i.test(low)) {
      return { intent: "about", slots: { question: s } };
    }
    if (/(research|full pipeline|全流程|跑全程|完整审判|跑一遍)/i.test(low)) {
      return { intent: "research", slots: { expr: expr } };
    }
    if (/(生成|产出|造|挑|选|generate|create|suggest|propose|recommend)/i.test(low) &&
        /(因子|factor|alpha|信号)/i.test(low)) {
      var famM = /(动量|momentum|反转|reversal|波动|volatility|量|volume|订单流|order.?flow|偏度|skew|趋势|trend)/i.exec(low);
      var famMap = { "动量": "momentum", "反转": "reversal", "波动": "volatility", "量": "volume",
        "订单流": "orderflow", "偏度": "skew", "趋势": "trend" };
      var fam = famM ? (famMap[famM[1]] || famM[1].toLowerCase()) : null;
      var nM = /(\d+)\s*(个|条|只|factors?|alphas?)/i.exec(s);
      return { intent: "generate", slots: { family: fam, count: nM ? parseInt(nM[1], 10) : 5 } };
    }
    if (/(zoo|动物园|因子库|public factor|公开因子|有哪些因子|what factors)/i.test(low)) {
      return { intent: "zoo", slots: {} };
    }
    if (/(what.?if|如果|要是|反事实|假如|suppose|换成|改成)/i.test(low)) {
      return { intent: "whatif", slots: parseWhatIf(s) };
    }
    if (/(validate|检验|验一下|我的因子|我的策略|verify my|check my|对赌)/i.test(low)) {
      return { intent: "validate", slots: { text: s } };
    }
    if (/(fetch|拉取|加载.*url|from a url)/i.test(low) || /https?:\/\//.test(s)) {
      var um = /(https?:\/\/\S+)/.exec(s);
      return { intent: "fetch", slots: { url: um ? um[1] : null } };
    }
    if (/(mine|挖掘|枚举|机器生成因子|machine.?mined)/i.test(low)) {
      return { intent: "experiment", slots: { mined: true } };
    }
    if (/(experiment|对比|双路|normal way|我们的方式|筛.*池化|run the zoo)/i.test(low)) {
      var es = libSlots(s);
      return { intent: "experiment", slots: { lib: es.lib } };
    }

    if (tStat != null || (F === "paper" && /(π|pi|dilut|稀释|命题|prop)/i.test(low))) {
      return { intent: "dilute", slots: { t: tStat, pi: pi } };
    }

    /* ---- pooling: a list of t-stats ---- */
    var ts = nums.filter(function (v) { return Math.abs(v) <= 40; });
    if (/(pool|combine|merge|stouffer|合并|合并证据|平均|叠加)/i.test(low) && ts.length >= 2) {
      return { intent: "pool", slots: { vals: ts } };
    }

    /* ---- discovery wall: N candidates ---- */
    var nm = /(?:\bN\b|\bcandidates?\b|\bscreen(?:ing|ed)?\b|\bdiscovery\b|\bwall\b|\bmultiple testing\b|筛选|候选|发现|多重检验|多重测试)\D{0,14}(\d{2,7})/.exec(s);
    var N = nm ? Number(nm[1]) : null;
    if ((N && N >= 20 && N <= 1e7) || (F === "paper" && /\bN\b|候选|筛选|discovery|wall|墙/.test(low))) {
      if (!N && F === "paper") N = 6960;
      return { intent: "hurdle", slots: { N: N, t: tStat } };
    }

    /* ---- the §04b autopsy bench ---- */
    if (/(autopsy|解剖台|解剖|bench|回测|monte carlo|walk.?forward|mc\b|sharp[e]? ratio|复权|复利)/i.test(low)) {
      return { intent: "autopsy" };
    }

    /* ---- the seeded library ---- */
    if (/(funnel|propos|generate|sweep|scan|shipped|library|漏斗|提案|生成|扫描|因子库|流水线|跑一批)/i.test(low) || F === "library") {
      var sweep = /(sweep|scan|shipped|扫描|自带|站点|全部)/i.test(low);
      return { intent: "library", slots: { n: pickN(nums), sweep: sweep } };
    }

    /* ---- desk readings ---- */
    if (/(ising|lppls|tda|chanlun|缠论|v12|sharpe|回撤|drawdown|600519|moutai|茅台|desk|book|账户|实盘|position|仓位|b1|s1|中枢|买点|卖点)/i.test(low) || F === "desk") {
      return { intent: "desk" };
    }

    /* ---- gate words with no expression: a real, structured rejection ---- */
    if (/(gate|judge|check|闸门|评判|检查|判一下)/.test(low)) {
      return { intent: "gate", slots: { expr: "", why: "" } };
    }

    /* ---- the paper's own claims ---- */
    if (/(proposition|prop\.?\s*2|命题|blind spot|盲点|m\s*\*|allocation|router|converse|winner.?s curse|赢家诅咒|paper|论文|sharpe ceiling|天花板)/i.test(low) || F === "paper") {
      return { intent: "paper" };
    }

    /* ---- the stack ---- */
    if (/(rust|python|flutter|crate|monorepo|stack|技术栈|架构|6881|代码库)/i.test(low)) {
      return { intent: "stack" };
    }

    return { intent: "unknown" };
  }

  /* ======================================================================
     INSTRUMENTS — each one is a real call. Nothing here is canned copy:
     the verdicts, tables and bars are computed from the arguments.
     ====================================================================== */
  function now() {
    return (window.performance && performance.now) ? performance.now() : 0;
  }
  function msOf(t0) { return Math.max(0, Math.round((now() - t0) * 100) / 100); }

  function libMissing() {
    return {
      steps: [{ name: "instruments", args: "HJ_GATE / HJ_BENCH", status: "fail",
        detail: t("the instrument libraries are still loading — reload the page and ask again",
          "仪器库还在加载——刷新页面后再问一次") }],
      blocks: [
        { k: "verdict", tone: "no", h: t("The instruments are not up yet", "仪器还没就绪"),
          b: t("gate.js and bench.js load before this file, so this should not happen. Reload the page and ask again.",
            "gate.js 和 bench.js 按顺序在本文件之前加载，正常不该出现。刷新页面再问一次。") }
      ]
    };
  }

  var GATE_VOCAB = t(
    "rolling  Mean[w] · Zscore[w] · Slope[w] · Std[w]\n" +
    "unary    Rank · Abs · Sign · Diff · Neg · Log · Sqrt\n" +
    "binary   Add · Sub · Mul · Div · Min · Max · Pow\n" +
    "signals  BidSize · AskSize · BestBid · BestAsk · MidPrice · Volume · TradeSide · TradeSize",
    "滚动    Mean[w] · Zscore[w] · Slope[w] · Std[w]\n" +
    "一元    Rank · Abs · Sign · Diff · Neg · Log · Sqrt\n" +
    "二元    Add · Sub · Mul · Div · Min · Max · Pow\n" +
    "信号    BidSize · AskSize · BestBid · BestAsk · MidPrice · Volume · TradeSide · TradeSize");

  /* ------------------------------------------------------------- gate.check */
  function instGate(slots) {
    var steps = [], blocks = [];
    var G = window.HJ_GATE;
    if (!G || !G.check) return libMissing();

    var expr = slots.expr, why = slots.why;
    if (!expr) {
      steps.push({ name: "route", args: "no factor expression in the text", status: "fail",
        detail: GATE_VOCAB });
      blocks.push({
        k: "verdict", tone: "no",
        h: t("I need a factor expression to judge", "我需要一个因子表达式来评判"),
        b: t("Write one in the site's grammar and I will run it through all nine gates. Example: Rank(Mean[10](BestAsk - BestBid) / MidPrice) — order-book imbalance.",
          "用站点自带的文法写一个，我会把它跑完九道闸门。例如：Rank(Mean[10](BestAsk - BestBid) / MidPrice)——盘口失衡。")
      });
      blocks.push({ k: "math", lines: [{ t: GATE_VOCAB, hi: false }] });
      blocks.push({ k: "actions", items: [
        { label: t("open §05b · the gate panel", "打开 §05b · 闸门面板"), fn: function () { G.focus(); } }
      ] });
      return { steps: steps, blocks: blocks };
    }

    var t0 = now();
    steps.push({ name: "route", args: "expr = " + expr, status: "ok",
      detail: why ? ("rationale = " + why) : t("no economic rationale supplied", "没有提供经济理由") });

    var t1 = now();
    var res = G.check(expr, why);
    var ms = msOf(t1);
    var verdict = res.verdict;

    steps.push({
      name: "gate.check", args: '("' + expr + '", "' + why + '")',
      ms: ms, status: verdict === "reject" ? "fail" : "ok",
      detail: "verdict = " + verdict + "\n" +
        "nodes = " + res.nodes + " · signals = " + (res.signals || []).length + "\n" +
        "windows = " + res.minWindow + "…" + res.maxWindow + "\n" +
        (res.dup ? ("duplicate of shipped factor: " + res.dup) : "not a duplicate of a shipped factor")
    });

    var tone = verdict === "admit" ? "ok" : (verdict === "flag" ? "warn" : "no");
    var head = verdict === "admit"
      ? t("admitted", "准入")
      : (verdict === "flag" ? t("admitted with flags", "带标记准入") : t("rejected", "拒绝"));
    var failed = (res.gates || []).filter(function (g) { return !g.ok; })[0];
    var body = failed
      ? (failed.id + " · " + failed.name + " — " + failed.note)
      : t("Every gate passed: the program is executable, dispersed and argued.",
        "九道闸门全过：可执行、有离散、有理由。");

    blocks.push({ k: "verdict", tone: tone, h: head, b: body });

    var rows = (res.gates || []).map(function (g) {
      return [
        { t: g.id },
        { t: g.name },
        { t: g.ok ? "✓" : "✕", tone: g.ok ? "ok" : "no" },
        { t: g.note || "" }
      ];
    });
    blocks.push({
      k: "table",
      head: [{ t: "gate" }, { t: "check" }, { t: "" }, { t: "note" }],
      rows: rows
    });

    blocks.push({ k: "kv", items: [
      { k: "nodes", v: String(res.nodes) },
      { k: "signals", v: String((res.signals || []).length) },
      { k: "windows", v: res.minWindow + "…" + res.maxWindow },
      { k: "verdict", v: verdict, tone: tone }
    ] });

    blocks.push({ k: "note", text: t(
      "Admission is a statement about your program — executable, dispersed, argued. It is never a statement that it earns. What it cannot decide is exactly what §04b decides.",
      "准入是关于你这个程序的陈述——可执行、有离散、有理由。它从来不是在说这个程序能赚钱。它判不了的，正是 §04b 判的那件事。") });

    blocks.push({ k: "actions", items: [
      { label: t("open §05b · the gate panel", "打开 §05b · 闸门面板"), fn: function () { G.focus(); } },
      { label: t("run the seeded funnel", "跑定种漏斗"), fn: function () { run("run the funnel on 400 proposals"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ---------------------------------------------------------- paper.dilute */
  function instDilute(slots) {
    var steps = [], blocks = [];
    var tv = slots.t, pi = slots.pi;

    if (tv == null) {
      steps.push({ name: "route", args: "no t-stat in the text", status: "fail",
        detail: t("expected something like  t = 2.40", "期望类似  t = 2.40") });
      blocks.push({
        k: "verdict", tone: "no",
        h: t("Give me a t-stat", "给我一个 t 值"),
        b: t("Proposition 2 needs the t-stat inside the paying state. Example: t = 2.40, π = 0.25.",
          "命题 2 需要兑现状态内的 t 值。例如：t = 2.40，π = 0.25。")
      });
      return { steps: steps, blocks: blocks };
    }

    var t0 = now();
    steps.push({ name: "route", args: "t = " + tv + (pi != null ? " · π = " + pi : " · π not given"),
      status: "ok", detail: t("Proposition 2 · t_g = t·√π", "命题 2 · t_g = t·√π") });

    var t1 = now();
    var lines = [];
    if (pi != null) {
      var g = dilute(tv, pi);
      steps.push({ name: "paper.dilute", args: "(t = " + tv + ", π = " + pi + ")",
        ms: msOf(t1), status: "ok",
        detail: "t_g = " + num(g) + "\nscreen = " + SCREEN + "\nallocation = " + num(ALLOC) });

      lines.push({ t: "t_g = t · √π", hi: true });
      lines.push({ t: "    = " + num(tv) + " · √" + num(pi) + "   = " + num(tv) + " · " + num(Math.sqrt(pi)), hi: false });
      lines.push({ t: "    = " + num(g), hi: true });
      lines.push({ t: "", hi: false });
      lines.push({ t: "screen " + SCREEN + " · allocation " + num(ALLOC) + " · D_eff " + D_EFF, hi: false });

      var tone = g < SCREEN ? "no" : (g < ALLOC ? "warn" : "ok");
      var head = g < SCREEN
        ? t("screened out", "被筛掉")
        : (g < ALLOC ? t("clears the screen, not the allocation bar", "过了筛，没过配置线") : t("clears both", "两条线都过"));
      var body = g < SCREEN
        ? t("The unconditional t falls below the 1.96 screen. The conditional edge never changed — the window shrank. That is the blind spot, computed on your numbers.",
          "无条件 t 掉到 1.96 筛选线以下。条件优势一点没变——变的是窗口。这就是用你的数字算出来的盲点。")
        : (g < ALLOC
          ? t("It survives the single-test screen but sits under the √(2 ln 17) = 2.3803 allocation bar this page prints.",
            "它活过了单检验筛选线，但还压在本页印着的 √(2 ln 17) = 2.3803 配置线之下。")
          : t("It clears both the screen and the allocation bar.", "筛选线和配置线它都过了。"));

      blocks.push({ k: "math", lines: lines });
      blocks.push({ k: "verdict", tone: tone, h: head, b: body });
      blocks.push({ k: "actions", items: [
        { label: t("open §04b with these numbers", "带着这些数字打开 §04b"),
          fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.prefill(tv, pi); } }
      ] });
    } else {
      var sweep = [0.5, 0.25, 0.1, 0.05];
      var rows = sweep.map(function (p) {
        var gg = dilute(tv, p);
        return [
          { t: num(p) },
          { t: num(Math.sqrt(p)) },
          { t: num(gg), tone: gg < SCREEN ? "no" : (gg < ALLOC ? "flag" : "ok") },
          { t: gg < SCREEN ? "screened out" : (gg < ALLOC ? "under allocation" : "clears"), tone: gg < SCREEN ? "no" : (gg < ALLOC ? "flag" : "ok") }
        ];
      });
      steps.push({ name: "paper.dilute", args: "(t = " + tv + ", π swept)",
        ms: msOf(t1), status: "ok",
        detail: sweep.map(function (p) {
          return "π=" + num(p) + " → t_g=" + num(dilute(tv, p));
        }).join("\n") });

      lines.push({ t: "t_g = t · √π        t = " + num(tv), hi: true });
      lines.push({ t: "π not given — sweeping the states this page marks", hi: false });
      blocks.push({ k: "math", lines: lines });
      blocks.push({
        k: "table",
        head: [{ t: "π" }, { t: "√π", num: true }, { t: "t_g", num: true }, { t: "verdict" }],
        rows: rows
      });
      blocks.push({
        k: "bars",
        items: sweep.map(function (p) {
          var gg = dilute(tv, p);
          return { label: "π=" + num(p), value: gg, max: Math.max(ALLOC, tv), tone: gg < SCREEN ? "cut" : "" };
        })
      });
      blocks.push({ k: "note", text: t(
        "The conditional edge is the same number in every row. Only the state frequency moves — and that alone decides whether a screen keeps the factor.",
        "每一行的条件优势是同一个数。变的只有状态频率——而单是这一点就决定了筛子留不留这个因子。") });
      blocks.push({ k: "actions", items: [
        { label: t("open §04b with t = " + num(tv), "带着 t = " + num(tv) + " 打开 §04b"),
          fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.prefill(tv, 0.25); } }
      ] });
    }

    blocks.push({ k: "note", text: t(
      "Proposition 2: a premium confined to a paying state of frequency π is diluted by √π in the unconditional mean. Drag the π control in §04 to watch a screen discard a factor whose conditional edge never changed.",
      "命题 2：只在一个频率为 π 的兑现状态里存在的溢价，在无条件均值里被 √π 稀释。拖动 §04 的 π 滑块，看筛子如何丢掉一个条件优势从未变过的因子。") });

    return { steps: steps, blocks: blocks };
  }

  /* ---------------------------------------------------------- paper.hurdle */
  function instHurdle(slots) {
    var steps = [], blocks = [];
    var N = slots.N;
    if (!N || N < 20 || N > 1e7) {
      steps.push({ name: "route", args: "no candidate count in the text", status: "fail",
        detail: t("expected something like  N = 6960", "期望类似  N = 6960") });
      blocks.push({
        k: "verdict", tone: "no",
        h: t("How many candidates were screened?", "一起被筛的候选有多少个？"),
        b: t("The discovery wall is a function of N. Example: N = 6960.",
          "发现之墙是 N 的函数。例如：N = 6960。")
      });
      return { steps: steps, blocks: blocks };
    }

    var t1 = now();
    var wall = hurdle(N);
    steps.push({ name: "paper.hurdle", args: "(N = " + N + ")", ms: msOf(t1), status: "ok",
      detail: "√(2 ln " + N + ") = " + num(wall, 4) });

    var lines = [
      { t: "hurdle(N) = √(2 ln N)", hi: true },
      { t: "          = √(2 ln " + N + ")", hi: false },
      { t: "          = " + num(wall, 4), hi: true },
      { t: "", hi: false },
      { t: "single test  " + SCREEN + "   ·   allocation  " + num(ALLOC) + "  (D_eff " + D_EFF + ")", hi: false }
    ];
    blocks.push({ k: "math", lines: lines });
    blocks.push({ k: "kv", items: [
      { k: "N", v: String(N) },
      { k: "single test", v: String(SCREEN) },
      { k: "allocation", v: num(ALLOC) },
      { k: "joint bar", v: num(wall, 4), tone: "warn" }
    ] });

    var body = t(
      "One test clears at 1.96. Screened jointly against " + N + " candidates the bar rises to " + num(wall, 4) + " — and the largest of " + N + " pure-noise draws is already sitting near it.",
      "单检验 1.96 就过。和 " + N + " 个候选一起被联合筛选，线就升到 " + num(wall, 4) + "——而 " + N + " 个纯噪声抽样里最大的那个，本来就已经趴在这附近了。");
    blocks.push({ k: "verdict", tone: "warn", h: t("the discovery wall", "发现之墙"), b: body });

    if (slots.t != null) {
      var ok = Math.abs(slots.t) >= wall;
      blocks.push({ k: "kv", items: [
        { k: "your t", v: num(slots.t) },
        { k: "wall", v: num(wall, 4) },
        { k: "clears", v: ok ? "yes" : "no", tone: ok ? "ok" : "no" }
      ] });
    }

    blocks.push({ k: "note", text: t(
      "On this site's own panel, 6 of 94 candidates clear the wall. That is the multiple-testing problem the paper is built around.",
      "就在本站自己的面板上，94 个候选里只有 6 个过墙。这就是这篇论文要处理的多重检验问题。") });
    blocks.push({ k: "actions", items: [
      { label: t("open §04b · autopsy bench", "打开 §04b · 解剖台"),
        fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.focus("stat"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ------------------------------------------------------------ paper.pool */
  function instPool(slots) {
    var steps = [], blocks = [];
    var vals = slots.vals || [];
    if (vals.length < 2) {
      steps.push({ name: "route", args: "fewer than two t-stats", status: "fail",
        detail: t("expected something like  pool 1.8, 2.2, 0.9, 1.4", "期望类似  合并 1.8, 2.2, 0.9, 1.4") });
      blocks.push({
        k: "verdict", tone: "no",
        h: t("Pooling needs at least two t-stats", "合并至少需要两个 t 值"),
        b: t("Give me a list. Example: pool 1.8, 2.2, 0.9, 1.4.",
          "给我一串数。例如：合并 1.8, 2.2, 0.9, 1.4。")
      });
      return { steps: steps, blocks: blocks };
    }

    var t1 = now();
    var p = pool(vals);
    steps.push({ name: "paper.pool", args: "(" + vals.join(", ") + ")", ms: msOf(t1), status: "ok",
      detail: "n = " + p.n + "\nmean|t| = " + num(p.mean) + "\npooled t = " + num(p.pooled) });

    var lines = [
      { t: "pooled t = mean|t| · √n", hi: true },
      { t: "         = " + num(p.mean) + " · √" + p.n, hi: false },
      { t: "         = " + num(p.pooled), hi: true },
      { t: "", hi: false },
      { t: "screen " + SCREEN + " · allocation " + num(ALLOC), hi: false }
    ];
    blocks.push({ k: "math", lines: lines });

    var nStar = p.mean > 0 ? Math.ceil(Math.pow(ALLOC / p.mean, 2)) : 0;
    var tone = p.pooled >= ALLOC ? "ok" : (p.pooled >= SCREEN ? "warn" : "no");
    blocks.push({ k: "kv", items: [
      { k: "n", v: String(p.n) },
      { k: "mean|t|", v: num(p.mean) },
      { k: "pooled t", v: num(p.pooled), tone: tone },
      { k: "n* for " + num(ALLOC), v: String(nStar) }
    ] });

    var head = p.pooled >= ALLOC
      ? t("clears the allocation bar", "过了配置线")
      : (p.pooled >= SCREEN ? t("clears the screen", "过了筛选线") : t("below the screen", "低于筛选线"));
    var body = p.pooled >= SCREEN
      ? t("Equal weight, independent — Stouffer. Positive correlation between the tests pulls the pooled t back toward the single-test value, so read this as the optimistic case.",
        "等权、独立——Stouffer。检验之间若正相关，合并 t 会被拉回单检验附近，所以把这当作乐观情形来读。")
      : t("Even pooled, the evidence does not clear the screen.", "就算合并起来，证据也过不了筛选线。");
    blocks.push({ k: "verdict", tone: tone, h: head, b: body });

    blocks.push({ k: "actions", items: [
      { label: t("open §04b · autopsy bench", "打开 §04b · 解剖台"),
        fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.focus("batch"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ----------------------------------------------------------- bench.stats */
  function instAutopsy() {
    var steps = [], blocks = [];
    var B = window.HJ_BENCH;
    if (!B || !B.stats) return libMissing();

    var t1 = now();
    var s = B.stats();
    if (!s) {
      steps.push({ name: "bench.stats", args: "()", ms: msOf(t1), status: "fail",
        detail: t("the bench holds no run yet", "解剖台还没有跑过任何数据") });
      blocks.push({
        k: "verdict", tone: "no",
        h: t("The bench has no numbers yet", "解剖台还没有数字"),
        b: t("Paste a return series, a t-stat or a whole factor library into §04b and it will compute. Then ask me again and I will report what it found.",
          "往 §04b 里粘贴一段收益序列、一个 t 值或者整个因子库，它就会算。然后你再问我一次，我把它算出来的东西报给你。")
      });
      blocks.push({ k: "actions", items: [
        { label: t("open §04b · autopsy bench", "打开 §04b · 解剖台"),
          fn: function () { B.focus("series"); } }
      ] });
      return { steps: steps, blocks: blocks };
    }

    steps.push({ name: "bench.stats", args: "()", ms: msOf(t1), status: "ok",
      detail: "source = " + s.source + "\nn = " + s.n +
        (s.mean != null ? "\nmean|t| = " + num(s.mean) : "") +
        (s.pooledT != null ? "\npooled t = " + num(s.pooledT) : "") +
        (s.pi != null ? "\nπ = " + num(s.pi) : "") +
        (s.N != null ? "\nN = " + s.N : "") });

    blocks.push({ k: "prose", text: t(
      "The last thing the autopsy bench computed in this tab:",
      "解剖台在这个页面里最近算出来的一次结果：") });

    var items = [{ k: "source", v: s.source }, { k: "n", v: String(s.n) }];
    if (s.mean != null) items.push({ k: "mean|t|", v: num(s.mean) });
    if (s.best != null && s.best !== s.mean) items.push({ k: "best t", v: num(s.best) });
    if (s.pooledT != null) items.push({ k: "pooled t", v: num(s.pooledT) });
    if (s.pi != null) items.push({ k: "π", v: num(s.pi) });
    if (s.N != null) items.push({ k: "N", v: String(s.N) });
    if (s.pass != null) items.push({ k: "pass", v: String(s.pass), tone: "ok" });
    if (s.weak != null) items.push({ k: "weak", v: String(s.weak), tone: "warn" });
    blocks.push({ k: "kv", items: items });

    blocks.push({ k: "note", text: t(
      "These are the bench's numbers, not mine. It applies the dilution identity to whatever you paste — nothing leaves the tab.",
      "这些是解剖台的数字，不是我的。它把稀释恒等式用在你粘贴的东西上——没有任何东西离开这个页面。") });
    blocks.push({ k: "actions", items: [
      { label: t("open §04b · autopsy bench", "打开 §04b · 解剖台"),
        fn: function () { B.focus(s.source === "library" ? "batch" : "stat"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ----------------------------------------------------------- gate.funnel */
  var FUNNEL_GROUPS = [
    ["compile", "G1", ["G1 · executability"]],
    ["variance", "G2 + G3", ["G2 · non-constancy", "G3 · dispersion"]],
    ["reason", "G4", ["G4 · economic rationale"]],
    ["budget", "C4 + C5", ["C4 · complexity", "C5 · novelty"]]
  ];

  function instLibrary(slots) {
    var steps = [], blocks = [];
    var G = window.HJ_GATE;
    if (!G || !G.funnel) return libMissing();

    if (slots.sweep) {
      var t1 = now();
      var swept = G.sweep();
      steps.push({ name: "gate.sweep", args: "()", ms: msOf(t1), status: "ok",
        detail: swept.map(function (r) {
          return r.name + " → " + r.verdict;
        }).join("\n") });
      blocks.push({ k: "prose", text: t(
        "The factors this site ships, each put through the same nine gates:",
        "站点自带的每一个因子，过的都是同样这九道闸门：") });
      blocks.push({
        k: "table",
        head: [{ t: "factor" }, { t: "verdict" }, { t: "nodes", num: true }],
        rows: swept.map(function (r) {
          return [
            { t: r.name },
            { t: r.verdict, tone: r.verdict === "admit" ? "ok" : (r.verdict === "flag" ? "flag" : "no") },
            { t: String(r.nodes), num: true }
          ];
        })
      });
      blocks.push({ k: "actions", items: [
        { label: t("open §05b · the gate panel", "打开 §05b · 闸门面板"), fn: function () { G.focus(); } }
      ] });
      return { steps: steps, blocks: blocks };
    }

    var n = slots.n || 400;
    var t0 = now();
    steps.push({ name: "route", args: "n = " + n + " · seed " + SEED, status: "ok",
      detail: t("the sampler is seeded, so everyone sees the same stream",
        "采样器是定种的，所以每个人看到的流一样") });

    var t1 = now();
    var f = G.funnel(n, SEED);
    steps.push({ name: "gate.funnel", args: "(" + n + ", " + SEED + ")", ms: msOf(t1), status: "ok",
      detail: "admitted " + f.admit + " · flagged " + f.flag + " · rejected " + f.reject });

    var alive = f.proposed;
    var bars = [{ label: "proposed", value: alive, max: f.proposed, delta: "" }];
    var rows = [];
    FUNNEL_GROUPS.forEach(function (g) {
      var cut = 0;
      g[2].forEach(function (k) { cut += f.reasons[k] || 0; });
      alive -= cut;
      bars.push({ label: g[0], value: alive, max: f.proposed, delta: cut ? "−" + cut : "" });
      rows.push([{ t: g[0] }, { t: g[1] }, { t: String(alive), num: true },
        { t: cut ? "−" + cut : "—", num: true, tone: cut ? "no" : "" }]);
    });

    blocks.push({ k: "prose", text: t(
      n + " proposals through the shipped grammar and gates — " + t("defects deliberately included", "故意含缺陷") + ":",
      n + " 个提案过站点自带的文法与闸门——" + t("defects deliberately included", "故意含缺陷") + "：") });
    blocks.push({ k: "bars", items: bars });
    blocks.push({
      k: "table",
      head: [{ t: "stage" }, { t: "gates" }, { t: "alive", num: true }, { t: "cut", num: true }],
      rows: rows
    });

    var closes = (alive === f.admit + f.flag);
    blocks.push({ k: "kv", items: [
      { k: "admitted", v: String(f.admit), tone: "ok" },
      { k: "flagged", v: String(f.flag), tone: "warn" },
      { k: "rejected", v: String(f.reject), tone: "no" },
      { k: "consistency", v: closes ? "✓ alive = admitted + flagged = " + alive : "✗ " + alive, tone: closes ? "ok" : "no" }
    ] });

    if (f.examples && f.examples.admit && f.examples.admit.length) {
      blocks.push({ k: "prose", text: t("kept:  ", "留下：  ") + f.examples.admit[0] +
        (f.admit > 1 ? t("   …and " + (f.admit - 1) + " more", "   ……另有 " + (f.admit - 1) + " 个") : "") });
    }
    (f.examples && f.examples.reject ? f.examples.reject.slice(0, 2) : []).forEach(function (x) {
      blocks.push({ k: "prose", text: "dropped:  " + x.text + "\n↳ " + x.why });
    });

    if (n === CANON.proposed) {
      var same = (f.admit === CANON.admit && f.flag === CANON.flag && f.reject === CANON.reject);
      blocks.push({ k: "note", text: same
        ? t("Matches §05b's canonical funnel exactly — same seed, same numbers, for every visitor.",
          "和 §05b 的标准漏斗完全一致——同种子、同数字，每个访客都一样。")
        : t("Differs from §05b's canonical funnel — that would be a bug.",
          "和 §05b 的标准漏斗不一致——那就是 bug。") });
      markCanon(same);
    }

    blocks.push({ k: "verdict", tone: "ok",
      h: t(f.admit + " survivors is not " + f.admit + " factors", f.admit + " 个存活不等于 " + f.admit + " 个因子"),
      b: t("Admission says the program is executable, dispersed and argued — never that it earns. What this pass cannot decide is exactly what §04b decides.",
        "准入说的是这个程序可执行、有离散、有理由——从不说它能赚钱。这一趟判不了的，正是 §04b 判的那件事。") });
    blocks.push({ k: "actions", items: [
      { label: t("open §05b · the gate panel", "打开 §05b · 闸门面板"), fn: function () { G.focus(); } },
      { label: t("open §04b · test a survivor", "打开 §04b · 测一个存活者"),
        fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.focus("stat"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ======================================================================
     §04c LEARNING BENCH — market · evaluate · train · placebo
     Real learning, in this tab, on a tape whose generative process is
     printed. Nothing here is a claim about a real market: the point is
     that the measurement pipeline is real and can be argued with.
     ====================================================================== */
  var ML_SIGNALS = ["MidPrice", "BestBid", "BestAsk", "BidSize", "AskSize",
    "Volume", "TradeSide", "TradeSize"];
  var MKT = null;
  /* the factor the bench falls back to — the declared tape's only real
     channel is queue imbalance, so this one has something to find */
  var IMB = "(BidSize - AskSize) / (BidSize + AskSize)";

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

  /* parse with the gate's own grammar: {ast} or {err} */
  function parseAst(expr) {
    var G = window.HJ_GATE;
    if (!G || !G.parse) return { err: t("gate.js is not loaded", "gate.js 未加载") };
    try { return { ast: G.parse(expr) }; }
    catch (e) { return { err: String((e && e.message) || e) }; }
  }

  /* the shared "this does not parse" answer, reused by three instruments */
  function rejectParse(expr, err, steps) {
    steps.push({ name: "gate.parse", args: '("' + expr + '")', status: "fail", detail: err });
    return {
      steps: steps,
      blocks: [
        { k: "verdict", tone: "no",
          h: t("That expression does not parse", "这个表达式解析不了"),
          b: t("The gate's own parser refused it: ", "站点闸门自己的解析器拒绝了它：") + err },
        { k: "math", lines: [{ t: GATE_VOCAB, hi: false }] },
        { k: "actions", items: [
          { label: t("judge this expression at the gate", "把这个表达式交给闸门评判"),
            fn: function () { run("judge " + expr); } }
        ] }
      ]
    };
  }

  function meanOf(a) {
    var s = 0, i;
    for (i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : 0;
  }
  function stdOf(a) {
    var m = meanOf(a), s = 0, i;
    for (i = 0; i < a.length; i++) { var d = a[i] - m; s += d * d; }
    return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0;
  }
  /* the site's own seeded generator, so every shuffle below is reproducible */
  function rngLocal(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------- ml.evaluate */
  function instMlEval(slots) {
    var steps = [], blocks = [];
    var M = window.HJ_ML;
    if (!M || !M.market) return mlMissing();

    var expr = slots.expr || IMB;
    var P = parseAst(expr);
    if (P.err) return rejectParse(expr, P.err, steps);

    var M0 = market();
    steps.push({ name: "route", args: "expr = " + expr, status: "ok",
      detail: "market = declared · seed " + SEED + " · " + M0.n + " bars" });

    var t1 = now();
    var sig = M.evalAST(P.ast, M0.signals, M0.n);
    steps.push({ name: "ml.evalAST", args: "(ast, signals, " + M0.n + ")", ms: msOf(t1), status: "ok",
      detail: t("the gate's grammar, evaluated as a time series",
        "闸门自己的文法，当成时间序列求值") });

    var t2 = now();
    var st = M.stats(sig, M0.fwd);
    steps.push({ name: "ml.stats", args: "(sig, fwd)", ms: msOf(t2), status: "ok",
      detail: "IC = " + num(st.ic, 4) + " · t = " + num(st.icT, 2) +
        " · " + st.blocks + " non-overlapping blocks" });

    blocks.push({ k: "prose", text: t(
      "The factor, evaluated bar by bar on the declared tape, then measured against the next bar's return:",
      "这个因子在声明胶带上逐根求值，然后对下一根的收益做测量：") });
    blocks.push({ k: "chart", variant: "line", label: expr, series: sig });

    var at = Math.abs(st.icT);
    blocks.push({ k: "kv", items: [
      { k: "IC", v: num(st.ic, 4) },
      { k: "t", v: num(st.icT, 2), tone: at >= ALLOC ? "ok" : (at >= SCREEN ? "warn" : "no") },
      { k: "blocks", v: String(st.blocks) },
      { k: "Sharpe", v: num(st.sharpe, 2) },
      { k: "turnover", v: num(st.turnover, 3) },
      { k: "max DD", v: num(st.maxDD * 100, 1) + "%" },
      { k: "π", v: num(st.pi, 3) },
      { k: "diluted t", v: num(st.dilutedT, 2) }
    ] });

    blocks.push({ k: "bars", items: [
      { label: "|t|", value: at, max: Math.max(ALLOC, at) * 1.15, tone: at < SCREEN ? "cut" : "" },
      { label: "screen 1.96", value: SCREEN, max: Math.max(ALLOC, at) * 1.15 },
      { label: "alloc 2.3803", value: ALLOC, max: Math.max(ALLOC, at) * 1.15 }
    ] });

    var dir = st.ic >= 0 ? t("positive", "正") : t("negative", "负");
    var head = at >= ALLOC
      ? t("clears the allocation bar", "过了配置线")
      : (at >= SCREEN
        ? t("clears the screen, not the allocation bar", "过了筛，没过配置线")
        : t("indistinguishable from zero", "和零区分不开"));
    var body = at >= ALLOC
      ? t("|t| = " + num(at, 2) + " across " + st.blocks + " non-overlapping blocks, and the IC is " + dir +
          ". On a declared tape that is as strong as evidence gets — and it is still one tape, one seed, one generative process.",
          "|t| = " + num(at, 2) + "，跨 " + st.blocks + " 个不重叠区块，IC 为" + dir +
          "。在声明胶带上这已经是证据能到的最强——但它仍然是一条胶带、一个种子、一个生成过程。")
      : (at >= SCREEN
        ? t("|t| = " + num(at, 2) + " clears the 1.96 screen but sits under the √(2 ln 17) = 2.3803 allocation bar. " +
            "Diluted by π = " + num(st.pi, 2) + " it becomes " + num(st.dilutedT, 2) + ".",
            "|t| = " + num(at, 2) + " 过了 1.96 筛选线，但压在 √(2 ln 17) = 2.3803 配置线之下。" +
            "按 π = " + num(st.pi, 2) + " 稀释之后是 " + num(st.dilutedT, 2) + "。")
        : t("|t| = " + num(at, 2) + " across " + st.blocks + " blocks — under the 1.96 screen. The honest reading is " +
            "'no evidence', not 'weak evidence'.",
            "|t| = " + num(at, 2) + "，跨 " + st.blocks + " 个区块——低于 1.96 筛选线。诚实的读法是「没有证据」，不是「证据较弱」。"));
    blocks.push({ k: "verdict", tone: at >= ALLOC ? "ok" : (at >= SCREEN ? "warn" : "no"), h: head, b: body });

    blocks.push({ k: "note", text: t(
      "The t-stat is the mean IC across " + st.blocks + " NON-overlapping 60-bar blocks, scaled by √" + st.blocks +
        ". Overlapping windows would inflate it by roughly √window — the exact error §04 is about.",
      "这个 t 值是 " + st.blocks + " 个不重叠 60 根区块的 IC 均值乘 √" + st.blocks +
        "。重叠窗口会把它虚高约 √window 倍——正是 §04 反对的那个错误。") });

    blocks.push({ k: "actions", items: [
      { label: t("permutation-test this factor", "对这个因子做置换检验"),
        fn: function () { run("placebo test " + expr); } },
      { label: t("train the models on the eight signals", "在八个信号上训练模型"),
        fn: function () { run("train logistic + ridge"); } },
      { label: t("show me the market's generative process", "给我看市场的生成过程"),
        fn: function () { run("show me the market's generative process"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ----------------------------------------------------------- ml.train */
  function instMlTrain() {
    var steps = [], blocks = [];
    var M = window.HJ_ML;
    if (!M || !M.market) return mlMissing();
    var M0 = market();

    var n = M0.n - 1;                       /* the last bar has no forward return */
    var cols = ML_SIGNALS.map(function (k) { return M0.signals[k].slice(0, n); });
    var fwd = M0.fwd.slice(0, n);
    var y = fwd.map(function (r) { return r > 0 ? 1 : 0; });
    var cut = Math.floor(n * M.constants.SPLIT);
    var trCols = cols.map(function (c) { return c.slice(0, cut); });
    var hoCols = cols.map(function (c) { return c.slice(cut); });
    var yTr = y.slice(0, cut), yHo = y.slice(cut);
    var fTr = fwd.slice(0, cut), fHo = fwd.slice(cut);

    steps.push({ name: "route", args: "logistic + ridge · " + ML_SIGNALS.length + " signals", status: "ok",
      detail: "target = sign(next-bar return) · train " + cut + " / holdout " + (n - cut) });

    /* ---- design: standardized on the TRAIN block only, then applied ---- */
    var t1 = now();
    var d = M.design(trCols, yTr);
    function applyD(c2) {
      var X = [], i, j;
      for (i = 0; i < c2[0].length; i++) {
        var row = [1];
        for (j = 0; j < d.k; j++) row.push((c2[j][i] - d.mu[j]) / d.sd[j]);
        X.push(row);
      }
      return X;
    }
    var Xh = applyD(hoCols);
    steps.push({ name: "ml.design", args: "(" + d.k + " features + bias, standardized on train)",
      ms: msOf(t1), status: "ok" });

    /* ---- logistic: full-batch gradient descent, every epoch real ---- */
    var t2 = now();
    var lm = M.logistic(d.X, yTr);
    var ph = M.predictLogistic(lm, Xh);
    var acc = 0, ll = 0, i;
    for (i = 0; i < ph.length; i++) {
      if ((ph[i] > 0.5 ? 1 : 0) === yHo[i]) acc++;
      ll += -(yHo[i] * Math.log(ph[i] + 1e-12) + (1 - yHo[i]) * Math.log(1 - ph[i] + 1e-12));
    }
    acc /= ph.length;
    ll /= ph.length;
    var base = Math.max(meanOf(yHo), 1 - meanOf(yHo));
    steps.push({ name: "ml.logistic", args: "(X, y · " + lm.epochs + " epochs, lr " + M.constants.LR +
      ", l2 " + M.constants.L2 + ")", ms: msOf(t2), status: "ok",
      detail: "loss " + num(lm.loss[0], 4) + " → " + num(lm.loss[lm.loss.length - 1], 4) +
        "\nholdout accuracy " + num(acc * 100, 1) + "% vs base rate " + num(base * 100, 1) + "%" });

    /* ---- ridge: normal equations + Gaussian elimination, no library ---- */
    var t3 = now();
    var dR = M.design(trCols, fTr);
    var rm = M.ridge(dR.X, fTr, 1);
    var eff = M.effects(rm, dR, stdOf(fTr) || 1);
    steps.push({ name: "ml.ridge", args: "(X, fwd · λ = 1)", ms: msOf(t3), status: "ok",
      detail: "solved " + rm.k + "×" + rm.k + " normal equations by elimination" });

    /* ---- permutation importance on the holdout: shuffle a column, re-score
           the SAME model, report the loss it costs. Model-agnostic. ---- */
    var t4 = now();
    function holdoutLL(X) {
      var p = M.predictLogistic(lm, X), s = 0;
      for (var q = 0; q < p.length; q++) {
        s += -(yHo[q] * Math.log(p[q] + 1e-12) + (1 - yHo[q]) * Math.log(1 - p[q] + 1e-12));
      }
      return s / p.length;
    }
    var baseLL = holdoutLL(Xh);
    var u = rngLocal(SEED + 13);
    var imp = [];
    for (var j = 0; j < d.k; j++) {
      var Xp = Xh.map(function (row) { return row.slice(); });
      for (var k = Xp.length - 1; k > 0; k--) {
        var r = Math.floor(u() * (k + 1));
        var tmp = Xp[k][j + 1]; Xp[k][j + 1] = Xp[r][j + 1]; Xp[r][j + 1] = tmp;
      }
      imp.push({ name: ML_SIGNALS[j], drop: holdoutLL(Xp) - baseLL });
    }
    imp.sort(function (a, b) { return b.drop - a.drop; });
    steps.push({ name: "ml.importance", args: "(holdout · permuted)", ms: msOf(t4), status: "ok",
      detail: "most relied upon: " + imp[0].name + " (+" + num(imp[0].drop, 4) + " log-loss)" });

    blocks.push({ k: "prose", text: t(
      "Two real models on the eight declared signals, predicting the sign of the next bar's return. No framework and no library: the gradient descent and the normal equations are written in this page.",
      "两个真实模型跑在八个声明信号上，预测下一根收益的符号。没有框架、没有库：梯度下降和正规方程都写在这一页里。") });

    blocks.push({ k: "chart", variant: "loss", label: "logistic loss · " + lm.epochs + " epochs (log scale)", series: lm.loss });

    blocks.push({ k: "kv", items: [
      { k: "holdout accuracy", v: num(acc * 100, 1) + "%", tone: acc > base + 0.02 ? "ok" : "no" },
      { k: "base rate", v: num(base * 100, 1) + "%" },
      { k: "holdout log-loss", v: num(ll, 4) },
      { k: "epochs", v: String(lm.epochs) },
      { k: "train / holdout", v: cut + " / " + (n - cut) },
      { k: "ridge λ", v: "1" }
    ] });

    blocks.push({
      k: "table",
      head: [{ t: "signal" }, { t: "logistic w", num: true }, { t: "ridge w", num: true },
        { t: "effect / 1σ", num: true }, { t: "Δ log-loss", num: true }],
      rows: ML_SIGNALS.map(function (nm, jj) {
        var drop = 0;
        imp.forEach(function (r) { if (r.name === nm) drop = r.drop; });
        return [
          { t: nm },
          { t: num(lm.w[jj + 1], 4), num: true },
          { t: num(rm.w[jj + 1], 5), num: true },
          { t: num(eff[jj] * 10000, 2) + " bp", num: true },
          { t: "+" + num(drop, 4), num: true, tone: drop > 0.01 ? "ok" : "" }
        ];
      })
    });

    var beat = acc > base + 0.02;
    blocks.push({ k: "verdict", tone: beat ? "ok" : "warn",
      h: beat
        ? t("the holdout agrees with the training", "留出集同意训练集")
        : t("the holdout does not agree with the training", "留出集不同意训练集"),
      b: beat
        ? t("Accuracy " + num(acc * 100, 1) + "% against a " + num(base * 100, 1) + "% base rate on data the models never saw. " +
            "On a declared tape with one written-down channel, that is the measurement pipeline working.",
            "在模型没见过的数据上，准确率 " + num(acc * 100, 1) + "%，基准率 " + num(base * 100, 1) + "%。" +
            "在一条只有一条写下通道的声明胶带上，这说明测量流水线是通的。")
        : t("In-sample the weights fit; out-of-sample accuracy is " + num(acc * 100, 1) + "% against a " + num(base * 100, 1) +
            "% base rate. That gap is the winner's curse §06 describes — measured here instead of asserted.",
            "样本内权重拟合了；样本外准确率 " + num(acc * 100, 1) + "%，基准率 " + num(base * 100, 1) +
            "%。这个缺口就是 §06 写的赢家诅咒——在这里是被测出来的，不是被断言的。") });

    blocks.push({ k: "note", text: t(
      "Ridge weights are per standardized unit; the effect column converts each to basis points of next-bar return per 1σ move. " +
      "Permutation importance shuffles a holdout column and re-scores the same model — a feature the model leans on costs log-loss when destroyed.",
      "岭回归权重是每个标准化单位的；effect 一列把每个系数换成每 1σ 移动对应多少个基点的下一根收益。" +
      "置换重要性打散留出集的一列、用同一个模型重新打分——模型依赖的特征被打散时会付出 log-loss。") });

    blocks.push({ k: "actions", items: [
      { label: t("evaluate a factor on this market", "在这个市场上评估一个因子"),
        fn: function () { run("evaluate " + IMB); } },
      { label: t("placebo test the imbalance factor", "对失衡因子做置换检验"),
        fn: function () { run("placebo test " + IMB); } },
      { label: t("show me the market's generative process", "给我看市场的生成过程"),
        fn: function () { run("show me the market's generative process"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* --------------------------------------------------------- ml.placebo */
  function instMlPlacebo(slots) {
    var steps = [], blocks = [];
    var M = window.HJ_ML;
    if (!M || !M.market) return mlMissing();

    var expr = slots.expr || IMB;
    var P = parseAst(expr);
    if (P.err) return rejectParse(expr, P.err, steps);

    var M0 = market();
    steps.push({ name: "route", args: "expr = " + expr, status: "ok",
      detail: "market = declared · seed " + SEED + " · " + M0.n + " bars" });

    var t1 = now();
    var sig = M.evalAST(P.ast, M0.signals, M0.n);
    steps.push({ name: "ml.evalAST", args: "(ast, signals, " + M0.n + ")", ms: msOf(t1), status: "ok" });

    var t2 = now();
    var pb = M.placebo(sig, M0.fwd, 200);
    steps.push({ name: "ml.placebo", args: "(sig, fwd, " + pb.reps + ")", ms: msOf(t2), status: "ok",
      detail: "real t = " + num(pb.real, 2) + "\nnull median = " + num(pb.nullMedian, 2) +
        " · null p95 = " + num(pb.nullP95, 2) + "\np = " + num(pb.p, 3) });

    blocks.push({ k: "prose", text: t(
      "The signal was shuffled " + pb.reps + " times — the pairing with returns destroyed, the same statistic re-measured each time. Where the real number falls inside that null distribution is the answer:",
      "信号被洗了 " + pb.reps + " 次——和收益的配对被打散，同一个统计量每次重算。真实数字落在那条零分布里的位置，就是答案：") });
    blocks.push({ k: "chart", variant: "hist", label: expr + " · null distribution of t", nulls: pb.nulls, real: pb.real });

    blocks.push({ k: "kv", items: [
      { k: "real t", v: num(pb.real, 2), tone: pb.p < 0.05 ? "ok" : "no" },
      { k: "null median", v: num(pb.nullMedian, 2) },
      { k: "null p95", v: num(pb.nullP95, 2) },
      { k: "reps", v: String(pb.reps) },
      { k: "p", v: num(pb.p, 3), tone: pb.p < 0.05 ? "ok" : "no" }
    ] });

    blocks.push({ k: "verdict", tone: pb.p < 0.05 ? "ok" : "no",
      h: pb.p < 0.05
        ? t("the t-stat survives its own null", "这个 t 值活过了自己的零分布")
        : t("cannot reject the null", "无法拒绝零假设"),
      b: pb.p < 0.05
        ? t("Fewer than 5% of " + pb.reps + " shuffles reach |t| = " + num(Math.abs(pb.real), 2) +
            ". The statistic is doing work the noise cannot do — on this tape.",
            pb.reps + " 次洗牌里，不到 5% 能摸到 |t| = " + num(Math.abs(pb.real), 2) +
            "。这个统计量在做噪声做不到的事——在这条胶带上。")
        : t("Shuffled copies of this signal reach |t| = " + num(Math.abs(pb.real), 2) +
            " about " + num((1 - pb.p) * 100, 0) + "% of the time. Whatever the number is, it is not evidence of alignment.",
            "这个信号洗牌之后的副本，约 " + num((1 - pb.p) * 100, 0) + "% 的时候能摸到 |t| = " + num(Math.abs(pb.real), 2) +
            "。所以这个数字不论大小，都不是对齐的证据。") });

    blocks.push({ k: "note", text: t(
      "A permutation test is the multiple-testing argument turned into a device: it asks whether the statistic is special against the only null that matters — the same numbers, randomly paired. §06 argues this is the honest bar; here it runs.",
      "置换检验是把多重检验的论证变成一台装置：它只问一件事——面对唯一要紧的零假设（同样的数字、随机配对），这个统计量特不特殊。§06 论证这是诚实的门槛；这里它在跑。") });

    blocks.push({ k: "actions", items: [
      { label: t("evaluate this factor", "评估这个因子"),
        fn: function () { run("evaluate " + expr); } },
      { label: t("train the models", "训练模型"),
        fn: function () { run("train logistic + ridge"); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ---------------------------------------------------------- ml.market */
  function instMlMarket() {
    var steps = [], blocks = [];
    var M = window.HJ_ML;
    if (!M || !M.market) return mlMissing();
    var M0 = market();

    steps.push({ name: "ml.market", args: "(" + SEED + ")", status: "ok",
      detail: M0.n + " bars · " + ML_SIGNALS.length + " signals · source = declared" });

    blocks.push({ k: "prose", text: t(
      "The tape the learning bench runs on is synthetic and declared — the generative process is printed here so you can argue with it:",
      "学习台运行的这条胶带是合成且声明的——生成过程印在这里，你可以直接质疑它：") });
    blocks.push({ k: "math", lines: [
      { t: "mid      AR(1) latent → drift + 1.1% noise", hi: false },
      { t: "spread   mean-reverting, widens with volume", hi: false },
      { t: "queue    log-normal sizes; imbalance co-moves with the latent", hi: false },
      { t: "flow     signed trade size co-moves with the latent", hi: false },
      { t: "", hi: false },
      { t: "the ONLY predictable channel:", hi: true },
      { t: "next-bar return = 0.0006·imbalance + 0.0004·signed flow + ε", hi: false },
      { t: "", hi: false },
      { t: "seed " + SEED + " · every visitor gets the same tape", hi: false }
    ] });
    blocks.push({ k: "chart", variant: "line", label: "MidPrice · " + M0.n + " bars", series: M0.signals.MidPrice });

    blocks.push({ k: "prose", text: t(
      "Each raw signal, measured on its own against the next bar's return:",
      "每一个原始信号，单独对下一根收益做测量：") });
    blocks.push({
      k: "table",
      head: [{ t: "raw signal" }, { t: "IC", num: true }, { t: "t", num: true }, { t: "Sharpe", num: true }],
      rows: ML_SIGNALS.map(function (k) {
        var st = M.stats(M0.signals[k], M0.fwd);
        return [
          { t: k },
          { t: num(st.ic, 4), num: true },
          { t: num(st.icT, 2), num: true, tone: Math.abs(st.icT) >= SCREEN ? "ok" : "" },
          { t: num(st.sharpe, 2), num: true }
        ];
      })
    });

    blocks.push({ k: "verdict", tone: "warn",
      h: t("declared, not real", "是声明的，不是真实行情"),
      b: t("No network, no vendor feed. The point of a declared tape is that its only predictable channel is written down — so an IC that survives here proves the measurement pipeline works, not that a strategy earns. Paste your own series into §04b and the same instruments run on it.",
        "没有网络、没有行情商。声明胶带的意义在于它唯一可预测的通道被写下来了——所以在这里活下来的 IC 只能证明测量流水线是通的，不说明策略能赚钱。把你自己的序列贴进 §04b，同样的仪器会在它上面跑。") });

    blocks.push({ k: "actions", items: [
      { label: t("evaluate a factor on it", "在它上面评估一个因子"),
        fn: function () { run("evaluate " + IMB); } },
      { label: t("train the models", "训练模型"),
        fn: function () { run("train logistic + ridge"); } },
      { label: t("placebo test the imbalance factor", "对失衡因子做置换检验"),
        fn: function () { run("placebo test " + IMB); } }
    ] });

    return { steps: steps, blocks: blocks };
  }

  /* ======================================================================
     THE BRAIN — a real language model, with the instruments above as tools
     --------------------------------------------------------------------------
     The deterministic router answers ten shapes of question well and
     everything else with "I can't". A model answers anything. What keeps
     the model honest is that it cannot compute anything itself: every
     instrument on this page is a tool, and the system prompt forbids
     stating a number that did not come back from one.
     ====================================================================== */
  /* evaluated per call: the model must be addressed in the visitor's language */
  /* -------------------------------------------- the council and engines */
  function instCouncil(slots) {
    var C = window.HJ_COUNCIL;
    if (!C) return mlMissing();
    return C.run(slots || {});
  }
  function instVenue(slots) {
    var E = window.HJ_ENGINES;
    if (!E) return mlMissing();
    return E.venueFind(slots || {});
  }
  function instResurrect(slots) {
    var E = window.HJ_ENGINES;
    if (!E) return mlMissing();
    var s = slots || {};
    var SHIPPED = (typeof SAMPLE_FACTORS !== "undefined") ? SAMPLE_FACTORS : null;
    if (!s.lib && !s.rows && SHIPPED && SHIPPED.length && window.HJ_ML) {
      /* the shipped sample library, measured on the declared tape right now:
         every factor evaluated, its IC block-t as the t, its measured pi */
      var M0 = E.helpers.market();
      if (M0) {
        var rows = [];
        SHIPPED.forEach(function (f) {
          if (!f || !f.expr) return;
          try {
            var sig = window.HJ_ML.evalAST(f.expr, M0.signals, M0.n);
            var st = window.HJ_ML.stats(sig, M0.fwd);
            rows.push({ name: f.name || "factor", t: st.icT, pi: st.pi });
          } catch (e) {}
        });
        if (rows.length) s = { rows: rows };
      }
    }
    return E.resurrect(s);
  }
  function instStrategy(slots) {
    var E = window.HJ_ENGINES;
    if (!E) return mlMissing();
    return E.strategyBuild(slots || {});
  }
  function instFoundry(slots) {
    var E = window.HJ_ENGINES;
    if (!E) return mlMissing();
    return E.foundry(slots || {});
  }
  function instAbout(slots) {
    var E = window.HJ_ENGINES;
    if (!E) return mlMissing();
    return E.about((slots || {}).question || "");
  }
  /* the full pipeline: measure -> locate -> deliberate */
  function instResearch(slots) {
    var E = window.HJ_ENGINES, C = window.HJ_COUNCIL;
    var expr = (slots || {}).expr;
    if (!E || !C) return mlMissing();
    if (!expr) {
      return {
        steps: [{ name: "route", args: "research", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The pipeline needs a factor expression", "流水线需要一个因子表达式"),
          b: t("Paste a factor — or describe one in plain words and the foundry compiles it first.",
            "粘贴一个因子——或者用大白话描述，造因子器会先编译它。") }]
      };
    }
    var ev = instMlEval({ expr: expr });
    if (ev.steps.some(function (s) { return s.status === "fail"; })) {
      return {
        steps: ev.steps,
        blocks: ev.blocks.concat([{ k: "note",
          text: t("The pipeline stops at the first gate: a factor that cannot parse cannot be measured.",
            "流水线停在第一道闸：无法解析的因子无法被测量。") }])
      };
    }
    var ve = E.venueFind({ expr: expr });
    var co = C.run({ expr: expr });
    function pick(blocks, k) {
      for (var i = 0; i < blocks.length; i++) if (blocks[i].k === k) return blocks[i];
      return null;
    }
    var evKv = pick(ev.blocks, "kv"), veKv = pick(ve.blocks, "kv");
    var blocks = [
      { k: "prose", text: t(
        "The full pipeline on " + expr + " — measure, locate, deliberate:",
        "对 " + expr + " 跑完整流水线——测量、定位、审议：") },
      pick(ev.blocks, "chart"),
      pick(ve.blocks, "bars"),
      evKv || veKv ? { k: "kv", items: (evKv ? evKv.items : []).concat(veKv ? veKv.items.slice(0, 4) : []) } : null,
      { k: "council", council: co.council },
      pick(co.blocks, "verdict"),
      { k: "note", text: t(
        "Pipeline: ml.evaluate → venue.find → council. Every number computed in this tab under seed " + SEED + ".",
        "流水线：ml.evaluate → venue.find → council。每个数字都在本页计算，种子 " + SEED + "。") },
      { k: "actions", items: [
        { label: t("placebo-test the evidence", "对证据做置换检验"), fn: function () { run("placebo test " + expr); } },
        { label: t("build a strategy on it", "以它建策略"), fn: function () { run("build a strategy on " + expr); } },
        { label: t("open the bench", "打开解剖台"), fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.focus("series"); } }
      ] }
    ].filter(Boolean);
    return { steps: [].concat(ev.steps, ve.steps, co.steps), blocks: blocks, council: co.council };
  }

  /* -------------------------------------------- the zoo and the experiment */
  /* natural-language knobs for the what-if engine: "如果 π 只有 0.1 会怎样",
     "N = 5000 会怎样", "只留 Q1 段", "筛子放到 2.38" */
  function parseWhatIf(s) {
    var out = {};
    var e = extractExpr(s);
    if (e) out.expr = e;
    var pi = /(?:π|pi)\s*(?:=|＝|是|为|只有|降到|变成|到)?\s*(0?\.\d+)/i.exec(s);
    if (pi) out.pi = parseFloat(pi[1]);
    var n = /\bN\s*(?:=|＝|是|为|只有|降到|变成|到)?\s*(\d{2,6})\b/i.exec(s);
    if (n) out.N = parseInt(n[1], 10);
    var sc = /(?:screen|筛|线|门槛)\s*(?:=|＝|是|为|放到|降到|变成|到)?\s*(\d\.\d+)/i.exec(s);
    if (sc) out.screen = parseFloat(sc[1]);
    var v = /\bQ([1-4])\b|第([一二三四1-4])段/.exec(s);
    if (v) out.venue = v[1] ? parseInt(v[1], 10) : ("一二三四".indexOf(v[2]) >= 0 ? "一二三四".indexOf(v[2]) + 1 : parseInt(v[2], 10));
    return out;
  }
  function instWhatIf(slots) {
    var W = window.HJ_WHATIF;
    if (!W) return mlMissing();
    var out = W.whatIf(slots || {});
    return { steps: out.steps, blocks: out.blocks };
  }
  function instValidate(slots) {
    var W = window.HJ_WHATIF;
    if (!W) return mlMissing();
    var out = W.validate({ lib: (slots || {}).text || "" });
    return { steps: out.steps, blocks: out.blocks };
  }

  /* generate legal factors and measure them — the model may SUGGEST, but
     the factors come from the site's own legal pool (the 22 public factors
     and the machine-mined zoo), so every expression compiles and every
     number is computed here. A 3B model writing Close-Close[1] is not a
     factor; this is. */
  function instGenerate(slots) {
    var Z = window.HJ_ZOO, C = window.HJ_COUNCIL;
    if (!Z) return mlMissing();
    var n = Math.min(8, Math.max(3, (slots && slots.count) || 5));
    var fam = (slots && slots.family) || null;
    var pool = Z.builtin.slice();
    var mined = [];
    try { mined = Z.mine ? Z.mine() : []; } catch (e) { mined = []; }
    mined.forEach(function (m) {
      pool.push({ id: m.expr, name: m.expr, expr: m.expr, family: "mined", cite: t("machine-mined from the grammar", "从文法里机器枚举") });
    });
    if (fam) {
      var hit = pool.filter(function (f) { return String(f.family || "").toLowerCase().indexOf(fam) >= 0; });
      if (hit.length >= 3) pool = hit;
    }
    var picked = pool.slice(0, n);
    var rows = [];
    picked.forEach(function (f) {
      var m = Z.measureOne(f);
      if (m && !m.err) rows.push({ f: f, m: m });
    });
    var steps = [{ name: "zoo.generate", args: "(" + n + (fam ? ", " + fam : "") + ")", status: rows.length ? "ok" : "fail",
      detail: "legal expressions only — every one compiles under the grammar" }];
    var blocks = [];
    blocks.push({ k: "prose", text: t(
      "Here are " + rows.length + " factors from the site's legal pool" + (fam ? " (" + fam + " family)" : "") + " — the 22 public factors and the machine-mined zoo, every expression compiled by the grammar and measured on the declared tape just now. The model suggests directions; the factors themselves are the ones that compile.",
      "从站点的合法池里产出了 " + rows.length + " 个因子" + (fam ? "（" + fam + " 族）" : "") + "——内置 22 个公开因子 + 机器枚举动物园，每个表达式都过了文法，刚刚在声明胶带上测完。模型负责建议方向；因子本身必须是能编译的那些。") });
    blocks.push({ k: "table",
      head: [{ t: "factor" }, { t: "expression" }, { t: "IC", num: true }, { t: "t", num: true }, { t: "pi", num: true }, { t: "verdict" }],
      rows: rows.map(function (r) {
        var v = r.m.key === "miskill" ? t("mis-killed", "误杀") : r.m.key === "weak" ? t("weak", "偏弱") : t("pass", "过筛");
        return [{ t: r.f.id }, { t: r.f.expr }, { t: num(r.m.ic, 4), num: true }, { t: num(r.m.t, 2), num: true },
          { t: num(r.m.pi, 2), num: true },
          { t: v, tone: r.m.key === "miskill" ? "no" : (r.m.key === "weak" ? "" : "ok") }];
      }) });
    var best = rows.slice().sort(function (a, b) { return Math.abs(b.m.t) - Math.abs(a.m.t); })[0];
    if (best) {
      blocks.push({ k: "verdict",
        tone: best.m.key === "miskill" ? "warn" : "ok",
        h: t("strongest of the batch: " + best.f.id + " — t = " + num(best.m.t, 2) + (best.m.key === "miskill" ? ", and it is mis-killed" : ""),
            "这批里最强的：" + best.f.id + " —— t = " + num(best.m.t, 2) + (best.m.key === "miskill" ? "，而且它是被误杀的" : "")),
        b: t("IC " + num(best.m.ic, 4) + ", pi = " + num(best.m.pi, 2) + ". Run the experiment to see the whole zoo through both ways, or build a strategy on this one.",
            "IC " + num(best.m.ic, 4) + "，π = " + num(best.m.pi, 2) + "。跑实验看整个动物园走双路，或者就以它建策略。"),
        plain: t("These are factors that compile — not formulas that merely look like factors.", "这些是能编译的因子——不是看起来像因子的公式。") });
      var co = C ? C.run({ expr: best.f.expr }) : null;
      if (co && co.council) blocks.push({ k: "council", council: co.council });
      blocks.push({ k: "actions", items: [
        { label: t("build a strategy on " + best.f.id, "以 " + best.f.id + " 建策略"), fn: function () {
          if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("build a strategy on " + best.f.expr);
        } },
        { label: t("run the experiment", "跑双路对比实验"), fn: function () {
          if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("run the experiment");
        } }
      ] });
    }
    blocks.push({ k: "note", text: t(
      "Declared: every factor above is a legal expression from the site's own pool, measured on the declared tape under seed 20261105. A model-written formula that does not compile is not a factor — the grammar decides, not the model.",
      "声明：上面每个因子都是站点自合法池里的表达式，在声明胶带上按种子 20261105 测量。模型写出的不合法公式不是因子——文法说了算，不是模型。") });
    return { steps: steps, blocks: blocks };
  }

  function instZoo() {
    var Z = window.HJ_ZOO;
    if (!Z) return mlMissing();
    var steps = [{ name: "zoo.list", args: "(" + Z.builtin.length + " public factors)", status: "ok",
      detail: t("every one carries its citation", "每一个都带文献出处") }];
    var blocks = [
      { k: "prose", text: t(
        "The public library, organised by anomaly family. Every factor is a legal expression in the gate's grammar with a real citation — pick one, or run the whole zoo through the experiment.",
        "公开因子库，按异象族组织。每个因子都是闸门文法下的合法表达式，带真实引用——挑一个，或者把整个动物园跑进实验。") },
      { k: "table",
        head: [{ t: "factor" }, { t: "family" }, { t: "citation" }],
        rows: Z.builtin.map(function (f) {
          return [
            { t: f.id },
            { t: f.family },
            { t: f.cite }
          ];
        }) },
      { k: "actions", items: [
        { label: t("run the experiment on the builtin zoo", "对内置动物园跑实验"), fn: function () { run("run the experiment"); } },
        { label: t("mine the machine zoo", "跑机器枚举动物园"), fn: function () { run("mine the factor zoo"); } },
        { label: t("council the order-book imbalance", "让议会裁决盘口失衡"), fn: function () { run("council (BidSize - AskSize) / (BidSize + AskSize)"); } }
      ] }
    ];
    return { steps: steps, blocks: blocks };
  }

  function instExperiment(slots) {
    var Z = window.HJ_ZOO;
    if (!Z) return mlMissing();
    var s = slots || {};
    var opts = { builtin: s.builtin !== false, mined: !!s.mined, expr: s.expr };
    if (s.lib) {
      var rows = Z.parseLibraryText(s.lib).filter(function (r) { return /[A-Za-z]/.test(r.expr || ""); });
      if (!rows.length) {
        return {
          steps: [{ name: "route", args: "experiment", status: "fail" }],
          blocks: [{ k: "verdict", tone: "no",
            h: t("The experiment needs expressions, not t-stats", "实验需要表达式，不是 t 值"),
            b: t("A pasted “name, t” library feeds the resurrection bench. For the experiment, paste “name :: formula” lines — or just say “run the experiment” for the builtin zoo.",
              "粘贴的「名称, t」库喂给复活台。实验请粘贴「名称 :: 公式」行——或者说「跑实验」用内置动物园。") }]
        };
      }
      opts.rows = rows;
    }
    if (s.fetched) opts.fetched = s.fetched;
    var out = Z.experiment(opts);
    return { steps: out.steps, blocks: out.blocks, experiment: out.experiment, council: out.council };
  }

  function fetchBlocks(res) {
    var blocks = [];
    if (!res.ok) {
      blocks.push({ k: "verdict", tone: "no",
        h: t("the fetch failed", "拉取失败"),
        b: t("The source could not be read: " + (res.why || "unknown") + ". GitHub links are rewritten to the jsdelivr mirror; if your network blocks that too, paste the library text instead.",
          "来源读不出来：" + (res.why || "未知") + "。GitHub 链接会改写为 jsdelivr 镜像；如果你的网络连它也挡，就直接粘贴库文本。") });
      return blocks;
    }
    blocks.push({ k: "prose", text: t(
      "Fetched " + res.total + " lines from " + res.source + " at " + res.at + ". Compiled each formula under the gate's grammar: " +
      res.kept.length + " kept, " + res.skipped.length + " skipped.",
      "从 " + res.source + " 拉取 " + res.total + " 行（" + res.at + "）。按闸门文法逐公式编译：收录 " + res.kept.length + " 个，跳过 " + res.skipped.length + " 个。") });
    if (res.kept.length) {
      blocks.push({ k: "table",
        head: [{ t: "kept" }, { t: "expression" }],
        rows: res.kept.slice(0, 24).map(function (r) { return [{ t: r.name }, { t: r.expr }]; }) });
    }
    if (res.skipped.length) {
      blocks.push({ k: "table",
        head: [{ t: "skipped" }, { t: "why" }],
        rows: res.skipped.slice(0, 12).map(function (r) { return [{ t: r.name }, { t: r.why }]; }) });
    }
    blocks.push({ k: "verdict", tone: res.kept.length ? "ok" : "warn",
      h: res.kept.length
        ? t(res.kept.length + " factors compiled", res.kept.length + " 个因子编译成功")
        : t("nothing compiled", "没有编译成功的"),
      b: res.kept.length
        ? t("The kept set is measured, not trusted — run the experiment on it and the council adjudicates.", "收录集是被测量的，不是被信任的——对它跑实验，让议会裁决。")
        : t("Every formula was rejected by the grammar. Check the format: “name :: formula”, one per line.", "每个公式都被文法拒了。检查格式：「名称 :: 公式」，每行一个。"),
      plain: res.kept.length ? t("The library is in — now measure it.", "库进来了——现在测量它。") : t("Nothing usable in that file.", "那个文件里没有能用的。") });
    if (res.kept.length) {
      blocks.push({ k: "actions", items: [
        { label: t("run the experiment on the fetched set", "对拉取集跑实验"), fn: function () {
          run("run the experiment on the fetched library");
        } }
      ] });
    }
    return blocks;
  }

  function instFetch(slots) {
    var Z = window.HJ_ZOO;
    if (!Z) return mlMissing();
    var url = (slots || {}).url;
    if (!url) {
      return {
        steps: [{ name: "route", args: "fetch", status: "fail" }],
        blocks: [{ k: "verdict", tone: "no",
          h: t("The fetch needs a URL", "拉取需要一个 URL"),
          b: t("Paste a link to a public factor library — one “name :: formula” per line. GitHub links are rewritten to the jsdelivr mirror, reachable where raw.githubusercontent is not.",
            "粘贴一个公开因子库链接——每行「名称 :: 公式」。GitHub 链接会改写为 jsdelivr 镜像，在 raw.githubusercontent 不通的网络也能拉。") }]
      };
    }
    var steps = [{ name: "zoo.fetch", args: Z.rewriteUrl(url), status: "ok",
      detail: t("GitHub links are rewritten to the jsdelivr mirror", "GitHub 链接已改写为 jsdelivr 镜像") }];
    var blocks = [{ k: "prose", text: t(
      "Fetching " + Z.rewriteUrl(url) + " — every formula is compiled as it lands.",
      "正在拉取 " + Z.rewriteUrl(url) + "——每个公式现场编译。") }];
    Z.fetchLibrary(url).then(function (res) {
      appendOut({ steps: [], blocks: fetchBlocks(res) });
    });
    return { steps: steps, blocks: blocks };
  }

  function instGuide(slots) {
    var G = window.HJ_GUIDE;
    if (!G) return mlMissing();
    return G.start(slots || {});
  }

  function sysPrompt() { return t(
    "You are BOAT-3, the research agent on Huannian Jin's personal portfolio page about quantitative research discipline (author: 金宦年). You are a real language model running in the visitor's browser, and you are talking to a reviewer.\n\n" +
    "GROUND RULES — these are not suggestions:\n" +
    "1. You may not state, estimate, round, or imply any number that did not come back from a tool call in THIS conversation. If a number is needed, call the instrument that computes it. If no instrument covers it, say so plainly and stop.\n" +
    "2. Never claim to have computed something you did not compute. The tool trail is on screen next to your answer; the reader can see it.\n" +
    "3. The tape the instruments run on is a DECLARED SYNTHETIC market, not real market data. Never present its results as live, real, or tradeable.\n" +
    "4. Admission at the gate means a program is executable, dispersed and argued — never that it earns. Keep that distinction in every sentence.\n" +
    "5. Be brief and concrete. Two short paragraphs beat eight. No filler, no restating the question.\n" +
    "6. Reply in the language the visitor used (English or simplified Chinese).\n" +
    "7. If you cannot call tools directly — you are a local model — express each instrument call on its own line, exactly in this shape: [instrument: the words a visitor would type]. The page parses those lines and runs the instruments itself; you still may not invent the numbers they return.\n\n" +
    "INSTRUMENTS — each runs in this tab, no network, deterministic under seed 20261105:\n" +
    "- judge_factor(expr, why): run a factor expression through the page's nine gates.\n" +
    "- evaluate_factor(expr): evaluate an expression on the declared tape; returns IC, t over non-overlapping blocks, Sharpe, turnover, drawdown, pi, diluted t.\n" +
    "- train_models(): logistic regression by gradient descent + ridge by normal equations on the eight signals; returns weights, holdout accuracy vs base rate, permutation importance.\n" +
    "- placebo_test(expr): permutation test; returns the null distribution and an empirical p-value.\n" +
    "- market_process(): prints the declared generative process.\n" +
    "- dilute(t, pi): Proposition 2, t_g = t*sqrt(pi).\n" +
    "- hurdle(N): the discovery wall sqrt(2 ln N).\n" +
    "- pool(vals): Stouffer pooled t.\n" +
    "- run_funnel(n): the seeded proposal funnel.\n" +
    "- bench_stats(): the last numbers the autopsy bench computed in this tab.\n" +
    "- council_run(expr | t,pi,N | lib): convene the seven-persona council — six voters, a devil's advocate, a captain — on the same computed facts.\n" +
    "- venue_find(expr): find a factor's home venue on the declared tape, with pi measured, not assumed.\n" +
    "- resurrect(lib): the resurrection bench — the mis-killed set pooled with Stouffer.\n" +
    "- strategy_build(expr): factor to strategy — vol targeting, venue routing vs always-on on the same tape.\n" +
    "- compose_factor(expr, idea): compile a plain-language idea into a legal expression, re-measured here.\n" +
    "- about_author(question): the author, from the public record only; unsourced questions are refused.\n" +
    "- research_pipeline(expr): measure, locate, deliberate in one run.\n" +
    "- factor_zoo(): the builtin public factor library with literature citations.\n" +
    "- run_experiment(source | lib): the paper's experiment — the normal screen against home-venue routing plus pooling, adjudicated by the council.\n" +
    "- fetch_library(url): fetch a public factor library from a URL, compile-validate every formula, report kept and skipped.\n" +
    "- mine_factors(): the machine-enumerated zoo over the DSL whitelist.\n" +
    "- generate_factors(count, family): produce legal factors from the site's own pool and measure them.\n" +
    "- strategy_guide(expr): the step-by-step strategy builder.\n" +
    "- what_if(expr, pi, N, screen, venue): the counterfactual engine — re-run the pipeline with one changed parameter and report what changes, before/after.\n" +
    "- validate_own(lib, sharpe, maxDD, turnover): the visitor's own factors or strategy metrics, measured against our method.\n\n" +
    "FACTOR GRAMMAR: Mean[w] Zscore[w] Slope[w] Std[w] Rank Abs Sign Diff Neg Log Sqrt over signals BidSize AskSize BestBid BestAsk MidPrice Volume TradeSide TradeSize, combined with Add Sub Mul Div Min Max Pow, e.g. Rank(Mean[10](BestAsk - BestBid) / MidPrice).\n" +
    "CONSTANTS: screen 1.96, allocation sqrt(2 ln 17) = 2.3803, D_eff 17, seed 20261105, declared tape 1200 bars.\n" +
    "If the visitor asks something outside all of this — live prices, advice, a brokerage, your training data — say what you are and are not, in one sentence, and offer the nearest instrument.\n\n" +
    "YOU ARE ALSO A NORMAL ASSISTANT. For ordinary conversation — greetings, small talk, how are you, the weather, opinions, general knowledge, anything that is not about this site's instruments — answer naturally, briefly and warmly, exactly like a good general chatbot would. The honesty rules above apply to claims about numbers, the paper, and the tape — not to ordinary conversation. Never answer an ordinary question with \"I have no instrument for that\"; that sentence belongs to the deterministic router, not to you.",
    "你是 BOAT-3，金宦年关于量化研究纪律的个人作品集页面上的研究代理（作者：金宦年）。你是一个真实运行在访客浏览器里的大语言模型，对面是评审。\n\n" +
    "基本规则——不是建议：\n" +
    "1. 凡是本次对话里没有从工具调用拿回来的数字，你一律不许说、不许估、不许四舍五入、不许暗示。需要数字就调用算它的仪器；没有仪器覆盖就直说，然后停下。\n" +
    "2. 不许声称你算了你没算的东西。工具调用轨迹就在你答案旁边，读者看得见。\n" +
    "3. 仪器运行的是一条声明的合成胶带，不是真实行情。永远不要把它说成实时、真实或可交易。\n" +
    "4. 闸门准入只说明一个程序可执行、有离散、有理由——从不说它能赚钱。每一句话都要守住这个区分。\n" +
    "5. 简短、具体。两小段胜过八大段。不写废话，不重复问题。\n" +
    "6. 用访客使用的语言回答（英语或简体中文）。\n" +
    "7. 如果你不能直接调用工具——你是本地模型——把每次仪器调用单独写一行，严格用这个形状：[instrument: 访客会输入的原话]。页面会解析这些行并自己运行仪器；它们返回的数字你照样不许编。\n\n" +
    "仪器——每一个都在本页运行、不走网络、在种子 20261105 下确定：\n" +
    "- judge_factor(expr, why)：把因子表达式过完本页九道闸门。\n" +
    "- evaluate_factor(expr)：在声明胶带上评估表达式；返回 IC、非重叠区块的 t、夏普、换手、回撤、π、稀释 t。\n" +
    "- train_models()：八个信号上的逻辑回归（梯度下降）+ 岭回归（正规方程）；返回权重、留出集准确率对基准率、置换重要性。\n" +
    "- placebo_test(expr)：置换检验；返回零分布和经验 p 值。\n" +
    "- market_process()：打印声明的生成过程。\n" +
    "- dilute(t, pi)：命题 2，t_g = t*sqrt(pi)。\n" +
    "- hurdle(N)：发现之墙 sqrt(2 ln N)。\n" +
    "- pool(vals)：Stouffer 合并 t。\n" +
    "- run_funnel(n)：定种提案漏斗。\n" +
    "- bench_stats()：解剖台在这个页面里最近算出的数字。\n" +
    "- council_run(expr | t,pi,N | lib)：召集七智体议会——六个投票者、一个辩手、一个舰长——读同一批算出来的事实。\n" +
    "- venue_find(expr)：在声明胶带上找因子的主场，π 是实测的不是假设的。\n" +
    "- resurrect(lib)：复活台——误杀集用 Stouffer 池化。\n" +
    "- strategy_build(expr)：因子到策略——波动目标、主场路由对常开，同带对比。\n" +
    "- compose_factor(expr, idea)：把大白话编译成合法表达式，在这里复测。\n" +
    "- about_author(question)：作者的事，只按公开记录；无来源的问题拒答。\n" +
    "- research_pipeline(expr)：一次跑完测量、定位、审议。\n" +
    "- factor_zoo()：内置公开因子库，带文献引用。\n" +
    "- run_experiment(source | lib)：论文的实验——正常筛选对主场路由加池化，议会终审。\n" +
    "- fetch_library(url)：从 URL 拉取公开因子库，逐公式编译校验，报告收录与跳过。\n" +
    "- mine_factors()：DSL 白名单上的机器枚举动物园。\n" +
    "- generate_factors(count, family)：从站点自合法池产出因子并测量。\n" +
    "- strategy_guide(expr)：分步策略构建向导。\n" +
    "- what_if(expr, pi, N, screen, venue)：反事实引擎——改一个参数重跑整条流水线，报告前后变化。\n" +
    "- validate_own(lib, sharpe, maxDD, turnover)：访客自己的因子或策略数字，用我们的方法检验。\n\n" +
    "因子文法：Mean[w] Zscore[w] Slope[w] Std[w] Rank Abs Sign Diff Neg Log Sqrt，作用于信号 BidSize AskSize BestBid BestAsk MidPrice Volume TradeSide TradeSize，用 Add Sub Mul Div Min Max Pow 组合，例如 Rank(Mean[10](BestAsk - BestBid) / MidPrice)。\n" +
    "常数：筛选线 1.96，配置线 sqrt(2 ln 17) = 2.3803，D_eff 17，种子 20261105，声明胶带 1200 根。\n" +
    "如果访客问的是这些之外的事——实时行情、投资建议、券商、你的训练数据——用一句话说清你是什么、不是什么，然后指给最近的仪器。\n\n" +
    "你同时也是一个正常的助手。普通对话——打招呼、闲聊、你好吗、天气、观点、常识、任何与本页仪器无关的事——像一个好的通用聊天机器人那样自然、简短、温和地回答。上面的诚实规则只约束关于数字、论文和胶带的主张，不约束普通对话。永远不要用「我没有对应的仪器」来回答普通问题——那句话属于确定性路由器，不属于你。"); }

  /* every instrument, in the shape a model can call */
  function buildTools() {
    function S(desc, props, req) {
      return { type: "object", properties: props, required: req || [] };
    }
    return [
      { name: "judge_factor",
        description: "Run a factor expression through this page's nine gates and return the verdict, the failing gate if any, and the AST facts. Use this when the visitor wants a program judged.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" },
          why: { type: "string", description: "the economic rationale, if the visitor gave one" }
        }, ["expr"]),
        run: function (a) { return instGate({ expr: a.expr, why: a.why }); } },
      { name: "evaluate_factor",
        description: "Evaluate a factor expression as a time series on the declared synthetic tape and measure it: IC, its t-stat over non-overlapping blocks, Sharpe, turnover, max drawdown, pi and the pi-diluted t. Use this when the visitor asks whether a factor works, or what a number means.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" }
        }, ["expr"]),
        run: function (a) { return instMlEval({ expr: a.expr }); } },
      { name: "train_models",
        description: "Fit logistic regression by full-batch gradient descent and ridge by normal equations on the eight declared signals, predicting the sign of the next bar's return. Returns weights, holdout accuracy vs the base rate, and permutation importance.",
        parameters: S("", {}),
        run: function () { return instMlTrain(); } },
      { name: "placebo_test",
        description: "Permutation test on a factor: shuffle the signal many times, re-measure the same statistic, and report where the real number falls in the null distribution. Use this when the visitor asks whether a result is real.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" }
        }, ["expr"]),
        run: function (a) { return instMlPlacebo({ expr: a.expr }); } },
      { name: "market_process",
        description: "Print the declared generative process of the synthetic tape the instruments run on, with each raw signal measured.",
        parameters: S("", {}),
        run: function () { return instMlMarket(); } },
      { name: "dilute",
        description: "Proposition 2 of the page's paper: the unconditional t-stat t_g = t * sqrt(pi), where pi is the share of bars in the paying state.",
        parameters: S("", {
          t: { type: "number", description: "the t-stat inside the paying state" },
          pi: { type: "number", description: "the paying-state share, 0..1" }
        }, ["t"]),
        run: function (a) { return instDilute({ t: a.t, pi: a.pi }); } },
      { name: "hurdle",
        description: "The discovery wall: sqrt(2 ln N) for N candidates tried — how high a single t-stat must reach under multiple testing.",
        parameters: S("", {
          N: { type: "number", description: "number of candidates screened" }
        }, ["N"]),
        run: function (a) { return instHurdle({ N: a.N, t: a.t }); } },
      { name: "pool",
        description: "Stouffer's method: pool several t-stats into one.",
        parameters: S("", {
          vals: { type: "array", items: { type: "number" }, description: "the t-stats to pool" }
        }, ["vals"]),
        run: function (a) { return instPool({ vals: a.vals }); } },
      { name: "run_funnel",
        description: "Run the seeded proposal funnel: n proposals through the site's grammar and gates, with defects deliberately included.",
        parameters: S("", {
          n: { type: "number", description: "how many proposals to sample (20..2000)" }
        }),
        run: function (a) { return instLibrary({ n: a.n }); } },
      { name: "bench_stats",
        description: "The last numbers the §04b autopsy bench computed in this tab, if any.",
        parameters: S("", {}),
        run: function () { return instAutopsy(); } },
      { name: "council_run",
        description: "Convene the council: six voters (statistician, physics engine, factor analyst, risk officer, execution officer) each read the same computed facts through their own lens, a devil's advocate argues the dissent without voting, and the captain aggregates into a verdict with a composite score. Use this when the visitor asks for a judgement, a deliberation, or 'what does the council say'.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" },
          t: { type: "number", description: "or a bare t-stat inside the paying state" },
          pi: { type: "number", description: "the paying-state share, 0..1" },
          N: { type: "number", description: "candidates screened alongside it" },
          lib: { type: "string", description: "or a pasted factor library, one 'name, t' per line" }
        }),
        run: function (a) { return instCouncil(a); } },
      { name: "venue_find",
        description: "Find a factor's home venue: cut the declared tape into four contiguous segments, measure each segment's IC t, and report where the factor actually pays — with pi measured, not assumed. This is the paper's WHERE decision made computable.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" }
        }, ["expr"]),
        run: function (a) { return instVenue({ expr: a.expr }); } },
      { name: "resurrect",
        description: "The resurrection bench: run a factor library through the universal screen, isolate the mis-killed set (t clears the allocation bar but the pi-diluted t falls under the screen), and pool it with Stouffer's method. Use this when the visitor wants the paper's headline claim reproduced on their own numbers.",
        parameters: S("", {
          lib: { type: "string", description: "the library, one 'name, t' or 'name, t, pi' per line" }
        }),
        run: function (a) { return instResurrect({ lib: a.lib }); } },
      { name: "strategy_build",
        description: "Build a strategy on a factor: positions from the z-scored factor, vol targeting calibrated on train only, and the paper's resolution (venue routing) compared against always-on on the same declared tape. Returns holdout Sharpe, max drawdown, turnover and hit for both modes.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" }
        }, ["expr"]),
        run: function (a) { return instStrategy({ expr: a.expr }); } },
      { name: "compose_factor",
        description: "Compile a plain-language factor idea into a legal expression in the site's grammar, then re-measure it. Use this when the visitor describes a factor in words instead of writing the expression. The compiled expression is re-parsed and re-measured by the instruments — you never grade your own homework.",
        parameters: S("", {
          expr: { type: "string", description: "the expression you composed in the site grammar (inputs MidPrice, BestBid, BestAsk, BidSize, AskSize, Volume, TradePrice, TradeSize; ops Abs Neg Log Sqrt Sign Rank Add Sub Mul Div Max Min Pow Mean Std Skew Kurt Min Max Sum Zscore Rank Corr Slope IfThenElse Const; rolling windows as Mean[20](...))" },
          idea: { type: "string", description: "the visitor's plain-language idea, echoed back" }
        }, ["expr"]),
        run: function (a) { return instFoundry({ expr: a.expr, idea: a.idea }); } },
      { name: "about_author",
        description: "Answer a question about the author from the public record only: biography, the paper and its claims, the stack, the desk, the stated goals, how to reach him. Every fact carries its source; questions the record cannot source are refused, not guessed.",
        parameters: S("", {
          question: { type: "string", description: "the visitor's question about the author" }
        }, ["question"]),
        run: function (a) { return instAbout({ question: a.question }); } },
      { name: "research_pipeline",
        description: "The full pipeline on one factor: evaluate it on the declared tape, find its home venue, then convene the council — measurement, location, deliberation, in that order, with every number computed in this tab.",
        parameters: S("", {
          expr: { type: "string", description: "the factor expression in the site grammar" }
        }, ["expr"]),
        run: function (a) { return instResearch({ expr: a.expr }); } },
      { name: "factor_zoo",
        description: "List the builtin public factor library — factors with literature citations, organised by anomaly family. Use this when the visitor asks what factors exist, what is public, or what to test.",
        parameters: S("", {}),
        run: function () { return instZoo(); } },
      { name: "run_experiment",
        description: "The paper's experiment on a factor zoo: the normal way (universal |t|<1.96 screen, survivors equal-weighted) against our way (home-venue routing + Stouffer pooling of the mis-killed), both scored on the same holdout, then adjudicated by the council. Sources: the builtin public library, machine-mined combinations, a fetched library, or the visitor's own expressions.",
        parameters: S("", {
          source: { type: "string", description: "builtin | mined | own (omit for builtin)" },
          lib: { type: "string", description: "a pasted library of 'name :: formula' lines, when source is own" }
        }),
        run: function (a) {
          var s = a.source || "builtin";
          return instExperiment({
            builtin: s !== "own", mined: s === "mined",
            rows: a.lib ? (window.HJ_ZOO.parseLibraryText(a.lib).filter(function (r) { return /[A-Za-z]/.test(r.expr || ""); })) : null
          });
        } },
      { name: "fetch_library",
        description: "Fetch a public factor library from a URL (GitHub links are rewritten to the jsdelivr mirror), compile-validate every formula under the site grammar, and report which were kept or skipped and why. The source URL and fetch time are recorded.",
        parameters: S("", {
          url: { type: "string", description: "the public library URL" }
        }, ["url"]),
        run: function (a) { return instFetch({ url: a.url }); } },
      { name: "mine_factors",
        description: "Enumerate the machine-mined zoo: DSL whitelist operators x input signals x windows x transforms — hundreds of legal expressions, all compiled and measured, then the experiment run on them.",
        parameters: S("", {}),
        run: function () { return instExperiment({ mined: true }); } },
      { name: "strategy_guide",
        description: "Start the step-by-step strategy builder: factor -> signal processing -> position rule -> risk -> home-venue routing -> backtest -> council. Use this when the visitor wants to build a strategy with our method, one step at a time.",
        parameters: S("", {
          expr: { type: "string", description: "optional starting factor expression" }
        }),
        run: function (a) { return instGuide({ expr: a.expr }); } },
      { name: "generate_factors",
        description: "Produce N legal factor expressions from the site's own pool (the 22 public factors and the machine-mined zoo) and measure each on the declared tape: IC, t, pi, verdict. Use when the visitor asks you to generate, suggest, or produce factors. Never write a formula yourself — the pool only contains expressions that compile.",
        parameters: S("", {
          count: { type: "integer", description: "how many, 3-8 (default 5)" },
          family: { type: "string", description: "optional family filter: momentum, reversal, volatility, volume, orderflow, skew, trend" }
        }),
        run: function (a) { return instGenerate({ count: a.count, family: a.family }); } },
      { name: "what_if",
        description: "The counterfactual engine: re-run the measurement pipeline with a changed parameter and show what changes. Use for any question of the form 'what if ...' — pi override, N override, screen level, venue restriction. Reports before/after verdicts with a council adjudication.",
        parameters: S("", {
          expr: { type: "string", description: "optional factor expression (omit for the builtin zoo)" },
          pi: { type: "number", description: "override the paying-state frequency, e.g. 0.1" },
          N: { type: "number", description: "override the candidate count, e.g. 5000" },
          screen: { type: "number", description: "override the screen line, e.g. 2.38" },
          venue: { type: "integer", description: "restrict the home venue to segment 1-4" }
        }),
        run: function (a) { return instWhatIf(a); } },
      { name: "validate_own",
        description: "Validate the visitor's own numbers with our method: a pasted factor library ('name, t' or 'name :: formula' lines) or their own strategy metrics (sharpe, maxDD, turnover). Returns the double-path comparison — the normal way against home-venue routing plus pooling — with an explicit verdict on where each way wins.",
        parameters: S("", {
          lib: { type: "string", description: "the pasted factor library, one entry per line" },
          sharpe: { type: "number", description: "the visitor's own strategy Sharpe, if they have one" },
          maxDD: { type: "number", description: "the visitor's own strategy max drawdown" },
          turnover: { type: "number", description: "the visitor's own strategy turnover" }
        }, ["lib"]),
        run: function (a) { return instValidate({ text: a.lib }); } }
    ];
  }

  /* ------------------------------------------------------------ brain state */
  function brainActive() {
    return !!(window.HJ_LLM && window.HJ_LLM.active());
  }
  function brainCfg() {
    return window.HJ_LLM && window.HJ_LLM.active();
  }
  function brainLabel() {
    var a = brainCfg();
    if (!a) return t("no brain", "无大脑");
    if (a.provider === "local") return t("local · ", "本地 · ") + shortModel(a.model);
    var p = window.HJ_LLM.providers[a.provider];
    return (p ? p.label : a.provider) + " · " + (a.model || "");
  }
  function shortModel(m) {
    m = String(m || "");
    m = m.replace(/-q4f16_1-MLC$/, "").replace(/-Instruct$/, "").replace(/-MLC$/, "");
    return m;
  }

  /* ------------------------------------------------------- mini markdown */
  /* The model answers in prose. This renders the small subset of markdown a
     research answer actually uses — bold, code, lists, headings — with text
     nodes only, so nothing in the answer can inject markup. */
  function inlineMd(text) {
    var frag = document.createDocumentFragment();
    var re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var s = m[0];
      if (s.charAt(0) === "*") frag.appendChild(el("b", null, s.slice(2, -2)));
      else frag.appendChild(el("code", null, s.slice(1, -1)));
      last = m.index + s.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function renderMiniMarkdown(host, raw) {
    var lines = String(raw || "").split("\n");
    var para = [], list = null;
    function flushPara() {
      if (!para.length) return;
      var p = el("p", "ag-md-p");
      p.appendChild(inlineMd(para.join(" ")));
      host.appendChild(p);
      para = [];
    }
    function flushList() {
      if (list) { host.appendChild(list); list = null; }
    }
    lines.forEach(function (line) {
      var li = /^\s*[-*•]\s+(.*)$/.exec(line);
      var head = /^(#{1,4})\s+(.*)$/.exec(line);
      if (li) {
        flushPara();
        if (!list) list = el("ul", "ag-md-ul");
        var item = el("li");
        item.appendChild(inlineMd(li[1]));
        list.appendChild(item);
        return;
      }
      flushList();
      if (head) {
        flushPara();
        host.appendChild(el("p", "ag-md-h", head[2].replace(/\*\*/g, "")));
        return;
      }
      if (!line.trim()) { flushPara(); return; }
      para.push(line.trim());
    });
    flushPara();
    flushList();
  }

  /* a live trail for brain calls — same markup as the deterministic one */
  function liveTrace() {
    var det = el("details", "ag-trace");
    det.open = true;
    var sum = el("summary", "ag-trace-summary");
    sum.appendChild(el("span", null, t("tool calls", "工具调用")));
    var msEl = el("span", "ag-trace-ms");
    sum.appendChild(msEl);
    det.appendChild(sum);
    var ul = el("ul", "ag-trace-steps");
    det.appendChild(ul);
    return {
      det: det, ul: ul, msEl: msEl, n: 0, total: 0,
      close: function () {
        this.msEl.textContent = this.n + " " + t("calls", "次调用") +
          (this.total ? " · " + num(this.total, 2) + " ms" : "");
        this.det.open = false;
      }
    };
  }

  function traceRow(tr, rec) {
    tr.n += 1;
    tr.total += rec.ms || 0;
    var li = el("li", "ag-step" + (rec.error ? " is-fail" : ""));
    li.appendChild(el("span", "ag-step-ico", rec.error ? "✕" : "✓"));
    var nm = el("div", "ag-step-name");
    nm.appendChild(el("em", null, rec.name));
    var args = rec.args || {};
    var keys = Object.keys(args);
    if (keys.length) nm.appendChild(document.createTextNode(" " + keys.map(function (k) {
      return k + "=" + String(args[k]);
    }).join(" ")));
    li.appendChild(nm);
    li.appendChild(el("span", "ag-step-ms", rec.ms != null ? num(rec.ms, 2) + " ms" : ""));
    var brief = briefOf(rec.result);
    if (brief) {
      var d = el("div", "ag-step-detail");
      d.textContent = brief;
      li.appendChild(d);
    }
    tr.ul.appendChild(li);
    maybeScroll();
  }

  /* one line saying what came back — enough to audit the call without opening it */
  function briefOf(out) {
    if (!out) return null;
    var blocks = out.blocks || [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.k === "verdict") return "verdict · " + b.h;
      if (b.k === "table") return "table · " + (b.head || []).map(function (h) { return h.t; }).join(" / ");
      if (b.k === "kv") return "kv · " + b.items.map(function (it) { return it.k + " " + it.v; }).join(" · ");
      if (b.k === "math") return "math · " + (b.lines || []).length + " lines";
    }
    var steps = out.steps || [];
    if (steps.length) return steps[0].name + (steps[0].detail ? " · " + steps[0].detail : "");
    return null;
  }

  /* ------------------------------------------------------------- the brain */
  /* Auto mode: a real model answers, with the ten instruments above as its
     tools. It may not state a number that did not come back from one — the
     trail next to the answer is the proof. Deterministic shapes still take
     the router, because for those the router is exact and instant. */
  function runBrain(text) {
    var L = window.HJ_LLM;
    var cfg = L && L.active();
    if (!cfg) { run(text); return; }

    if (emptyEl) emptyEl.hidden = true;

    var um = el("div", "ag-msg ag-msg-user");
    um.appendChild(el("div", "ag-bubble", text));
    streamEl.appendChild(um);
    maybeScroll(true);

    setBusy(true);
    if (liveEl) liveEl.textContent = t("the model is thinking", "模型正在思考");

    var t0 = now();
    var msg = el("div", "ag-msg");
    msg.style.setProperty("--ac", "#c084fc");
    var who = el("div", "ag-msg-who");
    who.appendChild(el("i"));
    who.appendChild(el("span", null, "BOAT-3"));
    who.appendChild(el("span", "ag-msg-tag", brainLabel()));
    msg.appendChild(who);
    var body = el("div", "ag-blocks");
    msg.appendChild(body);
    streamEl.appendChild(msg);

    var ctl = { aborted: false, ctl: null };
    activeCtl = ctl;

    /* the trail is created on the first tool call — a purely conversational
       turn must not leave an empty "0 calls" box above the answer */
    var tr = null;
    function ensureTrace() {
      if (tr) return tr;
      tr = liveTrace();
      body.insertBefore(tr.det, body.firstChild);
      return tr;
    }
    var proseHost = el("div", "ag-prose ag-md");
    body.appendChild(proseHost);
    var caret = el("span", "ag-caret");
    var raw = "";
    var painting = false;

    function paint() {
      if (painting) return;
      painting = true;
      /* the intent-bridge lines are protocol, not prose — never shown */
      proseHost.textContent = "";
      renderMiniMarkdown(proseHost, raw.replace(/\[instrument:[^\]]*\]/g, ""));
      proseHost.appendChild(caret);
      painting = false;
      maybeScroll();
    }

    /* the intent bridge: a local model asks for instruments in words, and
       this page's own router runs them — the protocol is ours, so it is
       as reliable as the deterministic path it feeds. */
    function runBridge(rawText) {
      var re = /\[instrument:\s*([^\]]+)\]/g, m, qs = [];
      while ((m = re.exec(rawText))) qs.push(m[1].trim());
      qs.forEach(function (q) {
        if (ctl.aborted) return;
        var r = route(q, null);
        var out = dispatch(r);
        var box = el("div", "ag-msg-block");
        body.appendChild(box);
        (out.blocks || []).forEach(function (b) { renderBlock(box, b, ctl, function () {}); });
        maybeScroll(true);
      });
    }

    session.calls += 1;
    session.ms += msOf(t0);
    if (cfg.provider !== "local") session.net += 1;
    paintSession();

    var ac = null;
    if (cfg.provider !== "local" && window.AbortController) {
      ac = new AbortController();
      ctl.ctl = ac;
    }

    L.chat({
      system: sysPrompt(),
      tools: buildTools(),
      text: text,
      signal: ac ? ac.signal : undefined,
      onProgress: function (p) {
        if (liveEl && p && p.text) liveEl.textContent = t("loading the model · ", "正在加载模型 · ") + p.text;
      },
      onToken: function (tok) {
        if (ctl.aborted) return;
        raw += tok;
        paint();
      },
      onCall: function (rec) {
        if (ctl.aborted) return;
        traceRow(ensureTrace(), rec);
        /* the council renders its card into the answer, and with a brain
           attached each persona then delivers its own speech */
        if (rec && rec.result && rec.result.council && window.HJ_COUNCIL) {
          var card = el("div", "ag-msg-block");
          body.appendChild(card);
          window.HJ_COUNCIL.renderCouncil(card, rec.result.council);
          if (brainActive()) window.HJ_COUNCIL.speakAll(rec.result.council);
          maybeScroll(true);
        }
      }
    }).then(function (final) {
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      if (tr) tr.close();
      var computeMs = msOf(t0);
      session.ms += computeMs;
      paintSession();
      runBridge(raw);
      finishBrain(body, cfg, final, computeMs, text, ctl);
    }).catch(function (err) {
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      if (ctl.aborted) {
        if (tr) tr.close();
        finishBrain(body, cfg, { text: raw, calls: [] }, msOf(t0), text, ctl, true);
        return;
      }
      if (tr) tr.close();
      var box = el("div", "ag-verdict");
      box.setAttribute("data-tone", "no");
      box.appendChild(el("p", "ag-verdict-h", t("the model call failed", "模型调用失败")));
      box.appendChild(el("p", "ag-verdict-b",
        t("Nothing was computed on the way here that the trail does not show. ",
          "在这一路上除了轨迹里显示的，没有算别的东西。") +
        String(err && err.message || err)));
      body.appendChild(box);
      body.appendChild(el("p", "ag-prov", t(
        "the model did not answer — the deterministic router took over. Every number below is computed in this tab.",
        "模型没有回答——确定性路由器已接管。下面每个数字都在本页计算。")));
      runDeterministic(text, route(text, currentMode));
      if (activeCtl === ctl) activeCtl = null;
      setBusy(false);
      if (liveEl) liveEl.textContent = t("the model call failed — the router answered", "模型调用失败——路由器已回答");
    });
  }

  /* append an instrument's blocks as a new message — used by the async
     fetch and by the guide wizard, neither of which has a caller body */
  function appendOut(out) {
    if (!out || !streamEl) return null;
    var msg = el("div", "ag-msg");
    var body2 = el("div", "ag-blocks");
    msg.appendChild(body2);
    streamEl.appendChild(msg);
    (out.blocks || []).forEach(function (b) { renderBlock(body2, b, { aborted: false }, function () {}); });
    maybeScroll(true);
    return msg;
  }

  /* follow-up suggestions — an answer that brings no actions of its own
     still ends with somewhere to go next */
  var FOLLOWUPS = {
    council: [t("placebo-test the evidence", "对证据做置换检验"), t("find its home venue", "找它的主场"), t("build a strategy on it", "以它建策略")],
    venue: [t("build a strategy on it", "以它建策略"), t("council the factor", "让议会裁决它"), t("run the experiment", "跑双路对比实验")],
    resurrect: [t("run the experiment", "跑双路对比实验"), t("council the library", "让议会裁决这个库"), t("open the bench", "打开解剖台")],
    strategy: [t("run the experiment", "跑双路对比实验"), t("council the factor", "让议会裁决它"), t("guide me step by step", "带我分步建策略")],
    foundry: [t("evaluate it on the declared market", "在声明市场上评估它"), t("council it", "让议会裁决它"), t("build a strategy on it", "以它建策略")],
    zoo: [t("run the experiment on the zoo", "对动物园跑实验"), t("mine the zoo", "机器枚举动物园"), t("fetch a public library", "拉取公开因子库")],
    generate: [t("build a strategy on the strongest", "以最强的那个建策略"), t("run the experiment on the zoo", "对动物园跑双路实验"), t("generate 8 momentum factors", "产 8 个动量类因子")],
    experiment: [t("what if pi were 0.1", "如果 π 只有 0.1 会怎样"), t("guide me through a strategy", "带我分步建策略"), t("resurrect the sample library", "复活样本库")],
    guide: [t("run the experiment", "跑双路对比实验"), t("council the factor", "让议会裁决它"), t("open the bench", "打开解剖台")],
    whatif: [t("validate my own factors", "检验我自己的因子"), t("run the experiment", "跑双路对比实验"), t("guide me through a strategy", "带我分步建策略")],
    validate: [t("run the experiment", "跑双路对比实验"), t("what if pi were 0.1", "如果 π 只有 0.1 会怎样"), t("open the bench", "打开解剖台")],
    _default: [t("run the experiment — both ways", "跑双路对比实验"), t("guide me through building a strategy", "带我分步建策略"), t("what can't you answer?", "有什么你答不了？")]
  };
  function followUps(intent) {
    return FOLLOWUPS[intent] || FOLLOWUPS._default;
  }

  function actionsOf(items) {
    var node = el("div", "ag-actions");
    items.forEach(function (a) {
      var btn = el("button", "ag-act", a.label);
      btn.type = "button";
      btn.addEventListener("click", a.fn);
      node.appendChild(btn);
    });
    return node;
  }

  function finishBrain(body, cfg, final, computeMs, text, ctl, interrupted) {
    var nCalls = (final.calls || []).length;
    var prov = el("p", "ag-prov");
    prov.textContent = cfg.provider === "local"
      ? t("local model · " + shortModel(cfg.model) + " · runs in this tab · " + nCalls +
          " tool call" + (nCalls === 1 ? "" : "s") + " · compute " + num(computeMs, 2) +
          " ms · seed " + SEED + " · BOAT-3 " + VERSION,
          "本地模型 · " + shortModel(cfg.model) + " · 在本页运行 · " + nCalls +
          " 次工具调用 · 计算 " + num(computeMs, 2) + " ms · 种子 " + SEED +
          " · BOAT-3 " + VERSION)
      : t("model " + cfg.model + " via " + cfg.provider + " · " + nCalls +
          " tool call" + (nCalls === 1 ? "" : "s") + " · every number above came back from one · " +
          (nCalls ? "compute " : "provider latency ") + num(computeMs, 2) + " ms · seed " + SEED +
          " · BOAT-3 " + VERSION,
          "模型 " + cfg.model + " · 经由 " + cfg.provider + " · " + nCalls +
          " 次工具调用 · 上面每个数字都从其中一次回来 · " + (nCalls ? "计算 " : "提供方时延 ") +
          num(computeMs, 2) + " ms · 种子 " + SEED + " · BOAT-3 " + VERSION);
    body.appendChild(prov);

    if (!interrupted) {
      var items = [];
      if (!body.querySelector(".ag-act")) {
        followUps(route(text, null).intent).forEach(function (q) {
          items.push({ label: q, fn: function () { run(q); } });
        });
      }
      items.push({ label: t("new topic", "新话题"), fn: function () {
        if (window.HJ_LLM) window.HJ_LLM.resetChat();
        sysLine(t("conversation cleared — the model starts fresh", "对话已清空——模型重新开始"));
      } });
      body.appendChild(actionsOf(items));
    } else {
      body.appendChild(el("p", "ag-prov", t("interrupted — the partial answer stays above",
        "已中断——部分答案保留在上面")));
    }

    maybeScroll();
    if (activeCtl === ctl) activeCtl = null;
    setBusy(false);
    if (liveEl) {
      liveEl.textContent = interrupted
        ? t("answer interrupted", "回答已中断")
        : t("answer ready", "回答就绪");
    }
  }

  /* ------------------------------------------------------------ brain UI */
  function paintBrainChip() {
    var chip = $("ag-brain");
    var dict = AG_I18N[lang()] || AG_I18N.en;
    if (chip) {
      var a = brainCfg();
      if (a) {
        chip.textContent = t("Brain · ", "大脑 · ") +
          (a.provider === "local" ? shortModel(a.model) : (a.model || a.provider));
        chip.classList.add("is-on");
        chip.setAttribute("aria-pressed", "true");
      } else {
        chip.textContent = dict["brain.off"];
        chip.classList.remove("is-on");
        chip.setAttribute("aria-pressed", "false");
      }
    }
    var note = document.querySelector(".ag-note");
    if (note) {
      var a2 = brainCfg();
      note.textContent = a2
        ? (a2.provider === "local" ? dict["brain.net.local"] : dict["brain.net.byok"])
        : dict["note"];
    }
  }

  function paintBrainPanel() {
    var s = window.HJ_LLM ? window.HJ_LLM.get() : {};
    var prov = s.provider || "none";
    document.querySelectorAll('input[name="ag-bp-prov"]').forEach(function (r) {
      r.checked = (r.value === prov);
    });
    var byok = $("ag-bp-byok"), local = $("ag-bp-local"), custom = $("ag-bp-custom");
    if (byok) byok.hidden = !(window.HJ_LLM.providers[prov] && window.HJ_LLM.providers[prov].byok);
    if (local) local.hidden = prov !== "local";
    if (custom) custom.hidden = prov !== "custom";
    var key = $("ag-bp-key");
    if (key && s.key && key.value !== s.key) key.value = s.key;
    var base = $("ag-bp-base"), mod = $("ag-bp-model-c"), ml = $("ag-bp-model-l");
    if (base && s.base) base.value = s.base;
    if (mod && s.model) mod.value = s.model;
    if (ml) ml.value = s.model || window.HJ_LLM.localModels[0].id;
    var gpu = $("ag-bp-gpu");
    if (gpu) {
      gpu.textContent = window.HJ_LLM.localSupported()
        ? t("WebGPU is available — the model can run in this tab.",
           "WebGPU 可用——模型可以在本页运行。")
        : t("No WebGPU in this browser — the local model needs it (Chrome/Edge 113+). Use your own key instead.",
           "这个浏览器没有 WebGPU——本地模型需要它（Chrome/Edge 113+）。请改用你自己的密钥。");
    }
  }

  function wireBrain() {
    var chip = $("ag-brain"), panel = $("ag-brain-panel");
    if (!chip || !panel || !window.HJ_LLM) return;

    function toggle(force) {
      var open = force == null ? panel.hidden : force;
      panel.hidden = !open;
      chip.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) paintBrainPanel();
    }
    chip.addEventListener("click", function () { toggle(); });
    var x = $("ag-bp-close");
    if (x) x.addEventListener("click", function () { toggle(false); });
    document.addEventListener("click", function (e) {
      if (panel.hidden) return;
      if (panel.contains(e.target) || chip.contains(e.target)) return;
      toggle(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) toggle(false);
    });

    document.querySelectorAll('input[name="ag-bp-prov"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        window.HJ_LLM.set({ provider: r.value });
        if (r.value !== "none") window.HJ_LLM.resetChat();
        paintBrainChip();
        paintBrainPanel();
        paintSession();
        sysLine(r.value === "none"
          ? t("brain off — the deterministic router answers again", "大脑已关——重新由确定性路由器回答")
          : t("brain · " + r.value + " — auto mode now goes to the model", "大脑 · " + r.value + "——自动模式现在交给模型"));
      });
    });

    var key = $("ag-bp-key");
    if (key) key.addEventListener("change", function () {
      window.HJ_LLM.set({ key: key.value.trim() });
      paintBrainChip();
      paintSession();
    });
    var base = $("ag-bp-base");
    if (base) base.addEventListener("change", function () {
      window.HJ_LLM.set({ base: base.value.trim() });
      paintBrainChip();
      paintSession();
    });
    var modc = $("ag-bp-model-c");
    if (modc) modc.addEventListener("change", function () {
      window.HJ_LLM.set({ model: modc.value.trim() });
      paintBrainChip();
      paintSession();
    });
    var modl = $("ag-bp-model-l");
    if (modl) modl.addEventListener("change", function () {
      window.HJ_LLM.set({ model: modl.value });
      paintBrainChip();
      paintSession();
    });

    var load = $("ag-bp-load"), prog = $("ag-bp-prog"), fill = $("ag-bp-prog-fill"), ptxt = $("ag-bp-prog-t");
    if (load) load.addEventListener("click", function () {
      var id = modl ? modl.value : window.HJ_LLM.localModels[0].id;
      load.disabled = true;
      if (prog) prog.hidden = false;
      if (ptxt) ptxt.textContent = t("starting…", "启动中…");
      window.HJ_LLM.loadLocal(id, function (p) {
        var pct = p && p.progress != null ? Math.round(p.progress * 100) : null;
        if (fill) fill.style.width = (pct == null ? 8 : pct) + "%";
        if (ptxt) ptxt.textContent = (pct == null ? "" : pct + "% · ") + (p && p.text ? p.text : "");
      }).then(function () {
        window.HJ_LLM.set({ provider: "local", model: id });
        window.HJ_LLM.resetChat();
        if (ptxt) ptxt.textContent = t("loaded", "已加载");
        paintBrainChip();
        paintBrainPanel();
        paintSession();
        sysLine(t("local model loaded — auto mode now goes to it", "本地模型已加载——自动模式现在交给它"));
      }).catch(function (e) {
        if (ptxt) ptxt.textContent = String(e && e.message || e);
      }).then(function () {
        load.disabled = false;
      });
    });

    var clr = $("ag-bp-clear");
    if (clr) clr.addEventListener("click", function () {
      window.HJ_LLM.clear();
      window.HJ_LLM.resetChat();
      paintBrainChip();
      paintBrainPanel();
      paintSession();
      sysLine(t("brain cleared — key and settings removed from this browser", "大脑已清除——密钥和设置已从本浏览器移除"));
    });
  }

  /* ------------------------------------------------------------------ desk */
  function instDesk() {
    var steps = [], blocks = [];
    var t1 = now();
    steps.push({ name: "desk.read", args: "(600519.SH · daily)", ms: msOf(t1), status: "ok",
      detail: t("readings lifted from the §00 tape — not recomputed here",
        "读数取自 §00 的胶带——不是在这里重算的") });

    blocks.push({ k: "prose", text: t(
      "The desk's current readings on the walkthrough name:",
      "工作台在这个演示标的上的当前读数：") });
    blocks.push({
      k: "table",
      head: [{ t: "reading" }, { t: "value", num: true }, { t: "context" }],
      rows: DESK.map(function (d) {
        return [{ t: d.k }, { t: d.v, num: true }, { t: d.s }];
      })
    });
    blocks.push({ k: "verdict", tone: "warn",
      h: t("readings, not advice", "是读数，不是建议"),
      b: t("Ising High is a regime flag that thins conviction; LPPLS 35% sits in the safe band; V12 SR is a backtest on 1237 days, not a live book. The desk labels its own boundaries — ask me to judge a factor if you want computation instead of narrative.",
        "Ising High 是让信念变薄的regime旗；LPPLS 35% 在安全带里；V12 SR 是 1237 天回测，不是实盘。工作台自己标好了边界——你要是想看计算而不是叙述，让我评判一个因子。") });
    blocks.push({ k: "actions", items: [
      { label: t("judge a factor instead", "改成评判一个因子"),
        fn: function () { run("judge Rank(Mean[10](BestAsk - BestBid) / MidPrice) — order-book imbalance"); } },
      { label: t("open the figures", "看图"), fn: function () {
        var g = document.getElementById("term-gallery");
        if (g) g.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
      } }
    ] });
    return { steps: steps, blocks: blocks };
  }

  /* ----------------------------------------------------------------- paper */
  function instPaper() {
    var steps = [], blocks = [];
    var t1 = now();
    steps.push({ name: "paper.claims", args: "()", ms: msOf(t1), status: "ok",
      detail: t("every figure below is printed elsewhere on this page",
        "下面每个数字都在本页别处印着") });

    blocks.push({ k: "prose", text: t(
      "The paper's claims, with the numbers this site prints next to them:",
      "论文的主张，配上本站印在旁边的数字：") });
    blocks.push({ k: "kv", items: [
      { k: "Prop. 2 dilution", v: "t_g = t·√π" },
      { k: "allocation bar", v: "√(2 ln 17) = 2.3803" },
      { k: "screen", v: "1.96" },
      { k: "machine factors screened", v: "6881" },
      { k: "optimal breadth m*", v: "≈ 1.3" },
      { k: "clear the wall", v: "6 of 94" },
      { k: "fine routing", v: "10.0% → 3.15% → 1.08%" },
      { k: "winner's curse", v: "~5.9× of the gap" },
      { k: "in-sample oracle", v: "1.45 → 1.12 held out" },
      { k: "OOS gain vs discard", v: "+0.45 · p(>0)=1.000" },
      { k: "A-share panel", v: "5441 stocks · +0.95 · p=0" },
      { k: "same-base increments", v: "24/24" },
      { k: "rebalancing value", v: "172 bps · IR ≈ 2" }
    ] });
    blocks.push({ k: "note", text: t(
      "Ask me to compute with any of these: give me a t-stat and a π and I will run the dilution identity on your numbers.",
      "想用其中任何一个来算，就跟我说：给我一个 t 值和一个 π，我把稀释恒等式用在你的数字上。") });
    blocks.push({ k: "actions", items: [
      { label: t("t = 2.40 · π = 0.25", "t = 2.40 · π = 0.25"), fn: function () { run("t = 2.40, π = 0.25"); } },
      { label: t("N = 6960 · discovery wall", "N = 6960 · 发现之墙"), fn: function () { run("N = 6960"); } }
    ] });
    return { steps: steps, blocks: blocks };
  }

  /* ----------------------------------------------------------------- stack */
  function instStack() {
    var steps = [], blocks = [];
    var t1 = now();
    steps.push({ name: "stack.read", args: "()", ms: msOf(t1), status: "ok",
      detail: t("from §07 · the stack panel", "来自 §07 · 技术栈面板") });
    blocks.push({ k: "prose", text: t(
      "The public surface is deliberately thin. The private monorepo is where the work lives:",
      "公开表面是刻意裁剪的。活都在私有 monorepo 里：") });
    blocks.push({ k: "kv", items: [
      { k: "public", v: "boatfx-repro · site · repro · showcase · CI" },
      { k: "private", v: "12 Rust crates · ~2.3k files · ~670k lines" },
      { k: "apps", v: "captain · UI packages" },
      { k: "desk stack", v: "Rust · Python · Flutter" }
    ] });
    blocks.push({ k: "note", text: t(
      "Layers first, then crates — the panel refuses to dump the whole tree.",
      "先看层级，再看 crate——面板拒绝倒出整棵树。") });
    blocks.push({ k: "actions", items: [
      { label: t("open §07 · the stack", "打开 §07 · 技术栈"), fn: function () {
        var s = document.getElementById("stack");
        if (s) s.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
      } }
    ] });
    return { steps: steps, blocks: blocks };
  }

  /* ------------------------------------------------------------------ help */
  var HELP_TOOLS = [
    ["gate.check", t("judge a factor expression · 9 gates", "评判因子表达式 · 9 道闸门")],
    ["paper.dilute", t("Prop. 2 · t_g = t·√π", "命题 2 · t_g = t·√π")],
    ["paper.hurdle", t("discovery wall · √(2 ln N)", "发现之墙 · √(2 ln N)")],
    ["paper.pool", t("Stouffer · pooled t", "Stouffer · 合并 t")],
    ["bench.stats", t("last autopsy-bench numbers", "解剖台最近一次的数字")],
    ["gate.funnel", t("seeded proposal funnel", "定种提案漏斗")],
    ["ml.evaluate", t("a factor on the declared market · IC, t, Sharpe", "在声明市场上评估因子 · IC、t、夏普")],
    ["ml.train", t("logistic + ridge · real gradient descent", "逻辑回归 + 岭回归 · 真实梯度下降")],
    ["ml.placebo", t("permutation test · null distribution + p", "置换检验 · 零分布 + p 值")],
    ["ml.market", t("the declared generative process", "声明的生成过程")]
  ];

  function instHelp() {
    var steps = [], blocks = [];
    var cfg = brainCfg();
    steps.push({ name: "route", args: "capability query", status: "ok" });
    blocks.push({ k: "prose", text: cfg
      ? t("I am BOAT-3. Right now a real language model (" + brainLabel() + ") is answering, and the ten instruments below are its tools — it may not state a number that did not come back from one of them:",
         "我是 BOAT-3。现在由一个真实的大语言模型（" + brainLabel() + "）回答，下面十件仪器是它的工具——凡是没从其中一次调用回来的数字，它不许说：")
      : t("I am BOAT-3, the research agent on this page. I am not a language model and I make no network calls — I am a router over the instruments this site already ships. Ten of them:",
         "我是 BOAT-3，这个页面上的研究代理。我不是语言模型，也不发任何网络请求——我是站点自带仪器之上的一台路由器。一共十件：") });
    blocks.push({
      k: "table",
      head: [{ t: "instrument" }, { t: "what it does" }],
      rows: HELP_TOOLS.map(function (r) { return [{ t: r[0] }, { t: r[1] }]; })
    });
    blocks.push({ k: "verdict", tone: "warn",
      h: t("What I cannot do", "我做不到的事"),
      b: cfg
        ? t("No live market data. No brokerage. The model can reason about anything, but every number it says has to come back from an instrument — so when no instrument covers a number, it says that instead.",
           "没有实时行情。没有券商。模型可以推理任何事，但它说出的每个数字都必须从仪器回来——所以没有仪器覆盖的数字，它会直说。")
        : t("No live market data. No brokerage. No LLM. No network. If a question needs one of those I will say so instead of guessing — try asking me something outside that list.",
           "没有实时行情。没有券商。没有大模型。没有网络。哪个问题需要这些，我会直说，而不是瞎猜——可以试试问一个这个清单外面的事情。") });
    return { steps: steps, blocks: blocks };
  }

  /* --------------------------------------------------------------- unknown */
  function instUnknown(raw) {
    var steps = [], blocks = [];
    var cfg = brainCfg();
    steps.push({ name: "route", args: "no instrument matched", status: "fail",
      detail: JSON.stringify(String(raw || "").slice(0, 120)) });
    blocks.push({ k: "verdict", tone: cfg ? "warn" : "no",
      h: cfg
        ? t("the router has no instrument for this", "路由器没有覆盖这个的仪器")
        : t("I can't answer that from this tab", "这个我在本页答不了"),
      b: cfg
        ? t("A brain is attached (" + brainLabel() + "), but this answer is running on the deterministic router — which has no instrument for this question. In Auto the model takes it, with the same instruments as its tools.",
           "已经接上了大脑（" + brainLabel() + "），但这个回答跑在确定性路由器上——它没有覆盖这个问题的仪器。在自动模式下模型会接，用的还是同一批仪器当工具。")
        : t("Not a language model — no network, no model call. What I can do is judge a factor expression, evaluate it on the declared market, train real models on the eight signals, permutation-test the result, dilute a t-stat by √π, compute the discovery wall, pool t-stats, report the bench, or run the seeded funnel.",
           "不是语言模型——没有网络、没有模型调用。我能做的是：评判一个因子表达式、在声明市场上评估它、在八个信号上训练真实模型、对结果做置换检验、用 √π 稀释一个 t 值、算发现之墙、合并 t 值、报告解剖台、或者跑定种漏斗。") });
    var acts = [
      { label: t("judge Rank(Mean[10](BestAsk - BestBid) / MidPrice)", "评判 Rank(Mean[10](BestAsk - BestBid) / MidPrice)"),
        fn: function () { run("judge Rank(Mean[10](BestAsk - BestBid) / MidPrice) — order-book imbalance"); } },
      { label: t("evaluate it on the declared market", "在声明市场上评估它"),
        fn: function () { run("evaluate Rank(Mean[10](BestAsk - BestBid) / MidPrice)"); } },
      { label: t("train the models", "训练模型"), fn: function () { run("train logistic + ridge"); } },
      { label: t("what can't you answer?", "有什么你答不了？"), fn: function () { run("what can't you answer?"); } }
    ];
    if (cfg) acts.unshift({
      label: t("ask the model instead", "改问模型"),
      fn: function () {
        currentMode = "auto";
        document.querySelectorAll(".ag-mode").forEach(function (x) {
          var on = x.dataset.mode === "auto";
          x.classList.toggle("is-on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        sysLine(t("mode · auto — the model answers this one", "模式 · 自动——这个交给模型"));
        run(String(raw || ""));
      }
    });
    blocks.push({ k: "actions", items: acts });
    return { steps: steps, blocks: blocks };
  }

  /* ======================================================================
     CHARTS — inline SVG, no library. One line chart (raw or log scale) and
     one histogram for the placebo null distribution. Both read theme tokens
     so they follow light/dark like everything else on the page.
     ====================================================================== */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function extentOf(vals, log) {
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < vals.length; i++) {
      if (vals[i] < lo) lo = vals[i];
      if (vals[i] > hi) hi = vals[i];
    }
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (log) { lo = Math.log(Math.max(lo, 1e-9)); hi = Math.log(Math.max(hi, 1e-9)); }
    if (hi - lo < 1e-9) hi = lo + 1;
    return [lo, hi];
  }
  function pathOf(vals, W, H, lo, hi, log) {
    var n = vals.length, d = "", i, f, x, y;
    var step = Math.max(1, Math.floor(n / 240));
    for (i = 0; i < n; i += step) {
      f = log ? Math.log(Math.max(vals[i], 1e-9)) : vals[i];
      x = (i / (n - 1)) * W;
      y = H - ((f - lo) / (hi - lo)) * H;
      d += (d ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    f = log ? Math.log(Math.max(vals[n - 1], 1e-9)) : vals[n - 1];
    d += " L" + W + " " + (H - ((f - lo) / (hi - lo)) * H).toFixed(1);
    return d;
  }
  function chartLine(series, log, label) {
    var W = 680, H = 118, PAD = 5;
    var ext = extentOf(series, log);
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "class": "agc-svg",
      preserveAspectRatio: "xMidYMid meet", "aria-label": label || "" });
    var g, yy;
    for (g = 1; g <= 3; g++) {
      yy = PAD + (H - 2 * PAD) * g / 4;
      svg.appendChild(svgEl("line", { x1: 0, y1: yy, x2: W, y2: yy, "class": "agc-grid" }));
    }
    var grp = svgEl("g", { transform: "translate(0," + PAD + ")" });
    var d = pathOf(series, W, H - 2 * PAD, ext[0], ext[1], log);
    grp.appendChild(svgEl("path", {
      d: d + " L" + W + " " + (H - 2 * PAD) + " L0 " + (H - 2 * PAD) + " Z", "class": "agc-area"
    }));
    grp.appendChild(svgEl("path", { d: d, "class": "agc-line" }));
    var lastV = series[series.length - 1];
    var lastF = log ? Math.log(Math.max(lastV, 1e-9)) : lastV;
    var lastY = (H - 2 * PAD) - ((lastF - ext[0]) / (ext[1] - ext[0])) * (H - 2 * PAD);
    grp.appendChild(svgEl("circle", { cx: W - 1, cy: lastY.toFixed(1), r: 2.6, "class": "agc-pt" }));
    svg.appendChild(grp);
    return svg;
  }
  function chartHist(nulls, real, label) {
    var W = 680, H = 128, TOP = 20, BASE = H - 14;
    var lo = Math.min.apply(null, nulls), hi = Math.max.apply(null, nulls);
    lo = Math.min(lo, real); hi = Math.max(hi, real);
    var pad = (hi - lo) * 0.06 || 1;
    lo -= pad; hi += pad;
    var BINS = 46, counts = [], i;
    for (i = 0; i < BINS; i++) counts.push(0);
    for (i = 0; i < nulls.length; i++) {
      var b = Math.floor((nulls[i] - lo) / (hi - lo) * BINS);
      if (b < 0) b = 0;
      if (b >= BINS) b = BINS - 1;
      counts[b] += 1;
    }
    var mx = 1;
    for (i = 0; i < BINS; i++) if (counts[i] > mx) mx = counts[i];
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "class": "agc-svg",
      preserveAspectRatio: "xMidYMid meet", "aria-label": label || "" });
    svg.appendChild(svgEl("line", { x1: 0, y1: BASE, x2: W, y2: BASE, "class": "agc-axisline" }));
    var bw = W / BINS, h;
    for (i = 0; i < BINS; i++) {
      if (!counts[i]) continue;
      h = (counts[i] / mx) * (BASE - TOP);
      svg.appendChild(svgEl("rect", {
        x: (i * bw + 0.6).toFixed(2), y: (BASE - h).toFixed(2),
        width: (bw - 1.2).toFixed(2), height: h.toFixed(2), "class": "agc-bar"
      }));
    }
    /* the ±1.96 screen, if it falls inside the window */
    [-SCREEN, SCREEN].forEach(function (s) {
      if (s <= lo || s >= hi) return;
      var x = (s - lo) / (hi - lo) * W;
      svg.appendChild(svgEl("line", { x1: x.toFixed(2), y1: TOP - 6, x2: x.toFixed(2), y2: BASE, "class": "agc-screen" }));
      var tx = svgEl("text", { x: Math.min(W - 34, x + 3).toFixed(2), y: TOP - 9, "class": "agc-axis" });
      tx.textContent = s < 0 ? "−1.96" : "+1.96";
      svg.appendChild(tx);
    });
    /* the real statistic */
    var rx = (real - lo) / (hi - lo) * W;
    svg.appendChild(svgEl("line", { x1: rx.toFixed(2), y1: TOP - 4, x2: rx.toFixed(2), y2: BASE + 3, "class": "agc-real" }));
    var rt = svgEl("text", { x: Math.min(W - 96, Math.max(4, rx + 5)).toFixed(2), y: TOP - 9, "class": "agc-axis agc-real-t" });
    rt.textContent = "real t = " + num(real, 2);
    svg.appendChild(rt);
    var lo2 = svgEl("text", { x: 2, y: H - 3, "class": "agc-axis" });
    lo2.textContent = num(lo, 1);
    svg.appendChild(lo2);
    var hi2 = svgEl("text", { x: W - 30, y: H - 3, "class": "agc-axis" });
    hi2.textContent = num(hi, 1);
    svg.appendChild(hi2);
    return svg;
  }

  /* ======================================================================
     RENDER — blocks, tool trail, streaming
     ====================================================================== */
  var streamEl, emptyEl, formEl, inputEl, parseEl, sendBtn, stopBtn, liveEl, statusEl;
  var session = { calls: 0, ms: 0, net: 0 };
  var activeCtl = null;
  var thinkOn = true;
  var currentMode = "auto";
  var PLAIN = true;
  try { PLAIN = localStorage.getItem("hj-plain") !== "off"; } catch (e) {}
  window.HJ_PLAIN = PLAIN;

  var LANE = {
    gate: "#5ec9a8", dilute: "#a78bfa", hurdle: "#38bdf8", pool: "#2c5f7c",
    autopsy: "#fb923c", library: "#fbbf24", desk: "#e879a9", paper: "#5ec9a8",
    stack: "#94a3b8", help: "#5ec9a8", unknown: "#fb923c",
    mleval: "#22d3ee", train: "#a3e635", placebo: "#fb7185", market: "#818cf8"
  };

  function maybeScroll(force) {
    if (!streamEl) return;
    var near = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 80;
    if (near || force) streamEl.scrollTop = streamEl.scrollHeight;
  }

  /* ------------------------------------------------------- prose streaming */
  function streamProse(host, text, ctl, done) {
    if (REDUCED || ctl.aborted) {
      host.textContent = text;
      done();
      return;
    }
    var caret = el("span", "ag-caret");
    host.appendChild(caret);
    var i = 0;
    (function tick() {
      if (ctl.aborted) {
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        host.textContent = text.slice(0, i);
        done();
        return;
      }
      var chunk = 2 + Math.floor(Math.random() * 4);
      host.insertBefore(document.createTextNode(text.slice(i, i + chunk)), caret);
      i += chunk;
      maybeScroll();
      if (i >= text.length) {
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        host.textContent = text;
        done();
        return;
      }
      setTimeout(tick, 8 + Math.random() * 8);
    })();
  }

  /* ------------------------------------------------------------- the trail */
  function renderTrace(host, steps, ctl, done) {
    var det = el("details", "ag-trace");
    det.open = true;
    var sum = el("summary", "ag-trace-summary");
    sum.appendChild(el("span", null, t("tool calls", "工具调用")));
    var msEl = el("span", "ag-trace-ms");
    sum.appendChild(msEl);
    det.appendChild(sum);
    var ul = el("ul", "ag-trace-steps");
    det.appendChild(ul);
    host.appendChild(det);

    var i = 0, total = 0;
    (function add() {
      if (ctl.aborted || i >= steps.length) {
        msEl.textContent = steps.length + " " + t("calls", "次调用") +
          (total ? " · " + num(total, 2) + " ms" : "");
        det.open = false;
        done();
        return;
      }
      var s = steps[i++];
      total += s.ms || 0;
      var li = el("li", "ag-step" + (s.status === "fail" ? " is-fail" : ""));
      li.appendChild(el("span", "ag-step-ico", s.status === "fail" ? "✕" : "✓"));
      var nm = el("div", "ag-step-name");
      nm.appendChild(el("em", null, s.name));
      if (s.args) nm.appendChild(document.createTextNode(" " + s.args));
      li.appendChild(nm);
      li.appendChild(el("span", "ag-step-ms", s.ms != null ? num(s.ms, 2) + " ms" : ""));
      if (s.detail) {
        var d = el("div", "ag-step-detail");
        d.textContent = s.detail;
        li.appendChild(d);
      }
      ul.appendChild(li);
      maybeScroll();
      setTimeout(add, REDUCED ? 0 : 110);
    })();
  }

  /* ---------------------------------------------------------- block types */
  function renderBlock(host, b, ctl, done) {
    if (ctl.aborted) { done(); return; }
    var node;

    if (b.k === "prose") {
      node = el("div", "ag-prose");
      host.appendChild(node);
      streamProse(node, b.text, ctl, done);
      return;
    }

    if (b.k === "math") {
      node = el("div", "ag-math");
      b.lines.forEach(function (l) {
        var line = el("div", null, l.t);
        if (l.hi) {
          var strong = el("b", null, l.t);
          line.textContent = "";
          line.appendChild(strong);
        }
        node.appendChild(line);
      });
    } else if (b.k === "table") {
      var wrap = el("div", "ag-table-wrap");
      var tb = el("table", "ag-table");
      var thead = el("thead");
      var trh = el("tr");
      b.head.forEach(function (h) {
        var th = el("th", h.num ? "num" : null, h.t);
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      tb.appendChild(thead);
      var tbody = el("tbody");
      b.rows.forEach(function (r) {
        var tr = el("tr");
        r.forEach(function (c) {
          var td = el("td", (c.num ? "num " : "") + (c.tone ? "ag-" + c.tone : ""), c.t);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody);
      wrap.appendChild(tb);
      node = wrap;
    } else if (b.k === "kv") {
      node = el("div", "ag-kv");
      b.items.forEach(function (it) {
        var chip = el("div", "ag-kv-chip" + (it.tone ? " is-" + it.tone : ""));
        chip.appendChild(el("span", null, it.k + " "));
        chip.appendChild(el("b", null, it.v));
        node.appendChild(chip);
      });
    } else if (b.k === "bars") {
      node = el("div", "ag-bars");
      b.items.forEach(function (it) {
        var row = el("div", "ag-bar-row" + (it.tone === "cut" ? " is-cut" : ""));
        row.appendChild(el("span", null, it.label));
        var track = el("div", "ag-bar-track");
        var fill = el("div", "ag-bar-fill");
        track.appendChild(fill);
        row.appendChild(track);
        var n = el("span", "ag-bar-n", String(it.value));
        row.appendChild(n);
        if (it.delta) row.appendChild(el("span", "ag-bar-d", it.delta));
        node.appendChild(row);
        setTimeout(function () {
          fill.style.width = Math.max(2, (it.value / it.max) * 100) + "%";
        }, 30);
      });
    } else if (b.k === "chart") {
      node = el("div", "agc-chart");
      if (b.label) node.appendChild(el("p", "agc-cap", b.label));
      node.appendChild(b.variant === "hist"
        ? chartHist(b.nulls, b.real, b.label)
        : chartLine(b.series, b.variant === "loss", b.label));
    } else if (b.k === "council") {
      node = el("div");
      if (window.HJ_COUNCIL) {
        window.HJ_COUNCIL.renderCouncil(node, b.council);
        if (brainActive()) window.HJ_COUNCIL.speakAll(b.council);
      }
    } else if (b.k === "verdict") {
      node = el("div", "ag-verdict");
      node.setAttribute("data-tone", b.tone || "ok");
      node.appendChild(el("p", "ag-verdict-h", b.h));
      node.appendChild(el("p", "ag-verdict-b", b.b));
      if (b.plain && PLAIN) node.appendChild(el("p", "ag-verdict-plain", b.plain));
    } else if (b.k === "note") {
      node = el("p", "ag-prov", b.text);
    } else if (b.k === "actions") {
      node = el("div", "ag-actions");
      b.items.forEach(function (a) {
        var btn = el("button", "ag-act", a.label);
        btn.type = "button";
        btn.addEventListener("click", a.fn);
        node.appendChild(btn);
      });
    } else {
      node = el("div", "ag-prose", String(b.text || ""));
    }

    host.appendChild(node);
    maybeScroll();
    setTimeout(done, REDUCED ? 0 : 80);
  }

  /* ------------------------------------------------------------ provenance */
  function renderProv(host, ms) {
    var p = el("p", "ag-prov");
    p.textContent = t(
      "local compute · 0 network requests · seed " + SEED + " · compute " + num(ms, 2) +
      " ms · streamed for readability · BOAT-3 " + VERSION,
      "本地计算 · 0 次网络请求 · 种子 " + SEED + " · 计算 " + num(ms, 2) +
      " ms · 流式只为可读 · BOAT-3 " + VERSION);
    host.appendChild(p);
    maybeScroll();
  }

  /* --------------------------------------------------------------- the run */
  function dispatch(r) {
    switch (r.intent) {
      case "gate": return instGate(r.slots || {});
      case "dilute": return instDilute(r.slots || {});
      case "hurdle": return instHurdle(r.slots || {});
      case "pool": return instPool(r.slots || {});
      case "autopsy": return instAutopsy();
      case "library": return instLibrary(r.slots || {});
      case "mleval": return instMlEval(r.slots || {});
      case "train": return instMlTrain();
      case "placebo": return instMlPlacebo(r.slots || {});
      case "market": return instMlMarket();
      case "desk": return instDesk();
      case "council": return instCouncil(r.slots || {});
      case "resurrect": return instResurrect(r.slots || {});
      case "strategy": return instStrategy(r.slots || {});
      case "venue": return instVenue(r.slots || {});
      case "foundry": return instFoundry(r.slots || {});
      case "about": return instAbout(r.slots || {});
      case "research": return instResearch(r.slots || {});
      case "zoo": return instZoo();
      case "generate": return instGenerate(r.slots || {});
      case "whatif": return instWhatIf(r.slots || {});
      case "validate": return instValidate(r.slots || {});
      case "experiment": return instExperiment(r.slots || {});
      case "fetch": return instFetch(r.slots || {});
      case "guide": return instGuide(r.slots || {});
      case "paper": return instPaper();
      case "stack": return instStack();
      case "help": return instHelp();
      default: return instUnknown(r.raw);
    }
  }

  function setBusy(on) {
    if (statusEl) {
      statusEl.textContent = on ? t("computing…", "计算中…") : t("ready", "就绪");
      statusEl.classList.toggle("is-busy", !!on);
    }
    if (stopBtn) stopBtn.hidden = !on;
    if (sendBtn) sendBtn.hidden = !!on;
    if (inputEl) inputEl.disabled = false;
  }

  function abortActive() {
    if (!activeCtl) return;
    activeCtl.aborted = true;
    if (activeCtl.ctl) { try { activeCtl.ctl.abort(); } catch (e) {} }
  }

  function run(raw, opts) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text || !streamEl) return;
    if (activeCtl) abortActive();   /* a new question retires the old answer */

    /* BOAT-3 — the router runs FIRST, always. If it has an instrument for
       the question, the instrument runs and its numbers are on screen before
       any model is involved; the model then writes two or three sentences on
       top of the computed digest (narrate()). A small local model can no
       longer lose an instrument by mis-writing a call — the failure that
       made "chat works but the site's machinery does not" possible.
       Only when the router has nothing (chit-chat, open finance questions)
       does the model answer alone. */
    var r0 = route(text, currentMode);
    var hasInstrument = r0 && r0.intent && r0.intent !== "unknown";
    var cfg0 = brainCfg();
    var localBrain = !!(cfg0 && cfg0.provider === "local");
    /* a local model cannot be trusted to write a call the instruments
       accept — so with a local brain the router runs first and the model
       writes on top. A hosted model keeps native tool calling, which is
       more expressive (it can chain instruments), and its calls are
       validated by the same instruments anyway. */
    if (!(opts && opts.deterministic) && hasInstrument && localBrain) {
      runDeterministic(text, r0, { narrate: true });
      return;
    }
    if (!(opts && opts.deterministic) && brainActive() && currentMode === "auto") {
      runBrain(text);
      return;
    }
    runDeterministic(text, r0);
  }

  /* BOAT-3: the model writes on top of the computed result. It receives the
     question and a digest of what the instruments returned — it never gets
     to change a number, only to interpret what is already on screen. */
  function narrate(body, text, r, out, ctl) {
    var cfg = brainCfg();
    if (!cfg || !window.HJ_LLM) return;
    var brief = briefOf(out);
    var host = el("div", "ag-narr");
    body.appendChild(host);
    var p = el("p", "ag-narr-t", "");
    host.appendChild(p);
    var raw = "";
    var sys = t(
      "You are BOAT-3, the research agent on Huannian Jin's quant-research portfolio. The instruments have already run and their numbers are on screen. Write TWO OR THREE short sentences interpreting the result below — what it shows, what it does not. Use only the numbers in the digest; never invent, round or imply a number that is not there. No preamble, no restating the question. Reply in the visitor's language.",
      "你是 BOAT-3，金宦年量化研究作品集上的研究代理。仪器已经跑完，数字就在屏幕上。针对下面的结果写两到三句短句——它说明了什么、没说明什么。只许用摘要里的数字，不许编、不许估、不许暗示摘要里没有的数字。不要开场白，不要重复问题。用访客的语言回答。");
    window.HJ_LLM.chat({
      system: sys,
      tools: [],
      text: t("question: ", "问题：") + text + "\n" + t("digest: ", "摘要：") + (brief || ""),
      onToken: function (tok) { raw += tok; p.textContent = raw; },
      signal: ctl.signal
    }).then(function () {
      if (!raw.trim() && host.parentNode) host.parentNode.removeChild(host);
    }).catch(function () {
      if (host.parentNode) host.parentNode.removeChild(host);
    });
  }

  function runDeterministic(text, r, extra) {
    if (emptyEl) emptyEl.hidden = true;

    /* the question, echoed synchronously — acknowledge first */
    var um = el("div", "ag-msg ag-msg-user");
    var ub = el("div", "ag-bubble", text);
    um.appendChild(ub);
    streamEl.appendChild(um);
    maybeScroll(true);

    setBusy(true);
    if (liveEl) liveEl.textContent = t("BOAT-3 is computing", "BOAT-3 正在计算");

    var t0 = now();
    r.raw = text;
    var out = dispatch(r);
    var computeMs = msOf(t0);
    session.calls += 1;
    session.ms += computeMs;
    paintSession();

    var msg = el("div", "ag-msg");
    msg.style.setProperty("--ac", LANE[r.intent] || "var(--accent)");
    var who = el("div", "ag-msg-who");
    who.appendChild(el("i"));
    who.appendChild(el("span", null, "BOAT-3"));
    msg.appendChild(who);
    var body = el("div", "ag-blocks");
    msg.appendChild(body);
    streamEl.appendChild(msg);

    var ctl = { aborted: false };
    activeCtl = ctl;

    var queue = [];
    if (thinkOn && out.steps && out.steps.length) {
      queue.push(function (next) { renderTrace(body, out.steps, ctl, next); });
    }
    (out.blocks || []).forEach(function (b) {
      queue.push(function (next) { renderBlock(body, b, ctl, next); });
    });
    if (!(out.blocks || []).some(function (b) { return b.k === "actions"; })) {
      queue.push(function (next) {
        var fu = { k: "actions", items: followUps(r.intent).map(function (q) {
          return { label: q, fn: function () { run(q); } };
        }) };
        renderBlock(body, fu, ctl, next);
      });
    }
    queue.push(function (next) {
      renderProv(body, computeMs);
      next();
    });
    if (extra && extra.narrate && brainActive()) {
      queue.push(function (next) {
        narrate(body, text, r, out, ctl);
        next();
      });
    }

    (function step() {
      if (ctl.aborted) { finish(false); return; }
      var fn = queue.shift();
      if (!fn) { finish(true); return; }
      fn(step);
    })();

    function finish(complete) {
      if (activeCtl === ctl) activeCtl = null;
      setBusy(false);
      if (liveEl) {
        liveEl.textContent = complete
          ? t("answer ready", "回答就绪")
          : t("answer interrupted", "回答已中断");
      }
    }
  }

  /* ======================================================================
     SESSION RAIL — counters · canonical funnel · jumps
     ====================================================================== */
  var canonState = null; /* null = not compared yet */

  function paintSession() {
    var host = $("ag-kv-session");
    if (!host) return;
    var cfg = brainCfg();
    var rows = [
      [t("tool calls", "工具调用"), String(session.calls)],
      [t("network requests", "网络请求"),
        cfg ? (cfg.provider === "local"
          ? t("0 in-tab · weights once", "页内 0 · 权重仅一次")
          : String(session.net) + " · " + cfg.provider)
        : "0"],
      [t("compute", "计算"), num(session.ms, 1) + " ms"],
      [t("seed", "种子"), String(SEED)]
    ];
    if (cfg) rows.push([t("brain", "大脑"), brainLabel()]);
    rows.push([t("engine", "引擎"), "BOAT-3 " + VERSION]);
    host.textContent = "";
    rows.forEach(function (r) {
      var row = el("div", "ag-kv-row");
      row.appendChild(el("span", null, r[0]));
      row.appendChild(el("b", null, r[1]));
      host.appendChild(row);
    });
  }

  function paintCanon() {
    var host = $("ag-canon");
    if (!host) return;
    host.textContent = "";
    var note = el("p", "ag-canon-note");
    note.textContent = canonState == null
      ? t("Ask the agent to run 400 proposals — then it checks itself against §05b.",
         "让代理跑 400 个提案——它会自己和 §05b 对上。")
      : canonState
        ? t("✓ this tab reproduced §05b exactly — same seed, same numbers.",
           "✓ 本页完整复现了 §05b——同种子、同数字。")
        : t("✗ mismatch with §05b — that would be a bug, not a feature.",
           "✗ 与 §05b 不一致——那就是 bug，不是特性。");
    if (canonState === true) note.style.color = "#2f8f6b";
    if (canonState === false) note.style.color = "var(--warn)";
    host.appendChild(note);
    [
      ["proposed", CANON.proposed], ["G1", CANON.g1], ["G2", CANON.g2],
      ["G3", CANON.g3], ["G4", CANON.g4],
      ["admit", CANON.admit], ["flag", CANON.flag], ["reject", CANON.reject]
    ].forEach(function (r) {
      var row = el("div", "ag-canon-row");
      row.appendChild(el("span", null, r[0]));
      row.appendChild(el("b", null, String(r[1])));
      host.appendChild(row);
    });
  }

  function markCanon(same) {
    canonState = !!same;
    paintCanon();
  }

  function paintJumps() {
    var host = $("ag-jumps");
    if (!host) return;
    var items = [
      { label: t("§05b · the gate panel", "§05b · 闸门面板"), fn: function () { G.focus(); } },
      { label: t("§04b · autopsy bench", "§04b · 解剖台"), fn: function () { if (window.HJ_BENCH) window.HJ_BENCH.focus("stat"); } },
      { label: t("§06 · the paper", "§06 · 论文"), fn: function () { jumpTo("paper"); } },
      { label: t("§03 · factor library", "§03 · 因子库"), fn: function () { jumpTo("library"); } }
    ];
    host.textContent = "";
    items.forEach(function (it) {
      var b = el("button", null, it.label);
      b.type = "button";
      b.addEventListener("click", it.fn);
      host.appendChild(b);
    });
  }

  function jumpTo(which) {
    var map = {
      paper: ["figures", "paper", "proposition"],
      library: ["library", "factors", "zoo"]
    };
    var keys = map[which] || [];
    for (var i = 0; i < keys.length; i++) {
      var n = document.getElementById(keys[i]);
      if (n && n.scrollIntoView) { n.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); return; }
    }
    /* fall back: nearest section whose id contains the key */
    var all = document.querySelectorAll("section[id]");
    for (var j = 0; j < all.length; j++) {
      if (keys.some(function (k) { return all[j].id.toLowerCase().indexOf(k) >= 0; })) {
        all[j].scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
        return;
      }
    }
  }

  /* ======================================================================
     COMPOSER — submit · autogrow · keys · stop · parse echo · rotation
     ====================================================================== */
  var PH_KEYS = ["ph.0", "ph.1", "ph.2", "ph.3", "ph.4", "ph.5", "ph.6", "ph.7", "ph.8", "ph.9"];
  var phTimer = null, phIdx = 0, phTyping = null, phPaused = false;

  function placeholderText(i) {
    var dict = AG_I18N[lang()] || AG_I18N.en;
    return dict[PH_KEYS[i % PH_KEYS.length]] || dict["ph.0"];
  }

  function startRotation() {
    stopRotation();
    if (REDUCED || !inputEl) return;
    var step = function () {
      if (phPaused) { phTimer = setTimeout(step, 900); return; }
      phIdx = (phIdx + 1) % PH_KEYS.length;
      typeInto(placeholderText(phIdx));
    };
    phTimer = setTimeout(step, 4200);
  }

  function stopRotation() {
    if (phTimer) { clearTimeout(phTimer); phTimer = null; }
    if (phTyping) { clearInterval(phTyping); phTyping = null; }
  }

  function typeInto(text) {
    if (!inputEl) return;
    if (phTyping) { clearInterval(phTyping); phTyping = null; }
    var i = 0;
    inputEl.setAttribute("placeholder", "");
    phTyping = setInterval(function () {
      if (phPaused || document.activeElement === inputEl || inputEl.value) {
        clearInterval(phTyping); phTyping = null;
        inputEl.setAttribute("placeholder", text);
        return;
      }
      i += 1;
      inputEl.setAttribute("placeholder", text.slice(0, i));
      if (i >= text.length) {
        clearInterval(phTyping); phTyping = null;
        phTimer = setTimeout(function () {
          if (!phPaused) typeInto(placeholderText(phIdx));
        }, 4200);
      }
    }, 34 + Math.random() * 16);
  }

  function autogrow() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    var h = Math.min(inputEl.scrollHeight, 134);
    inputEl.style.height = h + "px";
  }

  var parseDebounce = null;
  function parseEcho() {
    if (!parseEl || !inputEl) return;
    var text = inputEl.value.trim();
    if (!text) { parseEl.hidden = true; parseEl.textContent = ""; return; }
    var r = route(text, currentMode);
    parseEl.hidden = false;
    parseEl.textContent = "";
    parseEl.appendChild(el("span", "ag-parse-k", t("parsed", "解析")));
    var chips = [];
    chips.push({ label: r.intent, bad: r.intent === "unknown" });
    var s = r.slots || {};
    Object.keys(s).forEach(function (k) {
      var v = s[k];
      chips.push({ label: k + "=" + (typeof v === "object" ? JSON.stringify(v) : String(v)) });
    });
    if (r.forced) chips.push({ label: t("mode " + currentMode, "模式 " + currentMode) });
    if (r.intent === "unknown" && brainActive()) {
      chips.push({ label: t("→ the model", "→ 模型"), brain: true });
    }
    chips.forEach(function (c) {
      var chip = el("span", "ag-parse-chip" + (c.bad ? " is-no" : "") + (c.brain ? " is-brain" : ""), c.label);
      parseEl.appendChild(chip);
    });
  }

  /* the factor workbench: paste or load a library, run it through the
     double path, get the verdict — no model involved, all computed here */
  function wireWorkbench() {
    var wb = $("ag-wb"), ta = $("ag-wb-ta"), file = $("ag-wb-file"),
        up = $("ag-wb-upload"), go = $("ag-wb-run");
    if (!wb || !ta || !go) return;
    if (up && file) {
      up.addEventListener("click", function () { file.click(); });
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          ta.value = String(rd.result || "");
          sysLine(t("file loaded: " + f.name + " — run it when ready", "文件已加载：" + f.name + "——就绪后点运行"));
        };
        rd.readAsText(f);
      });
    }
    go.addEventListener("click", function () {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      if (!window.HJ_WORKBENCH) {
        sysLine(t("the workbench is still loading — give it a second", "工作台还在加载——稍等一下"));
        return;
      }
      if (activeCtl) abortActive();
      appendOut(window.HJ_WORKBENCH.run(text));
    });
  }

  function wireComposer() {
    formEl = $("ag-form");
    inputEl = $("ag-input");
    parseEl = $("ag-parse");
    sendBtn = $("ag-send");
    stopBtn = $("ag-stop");
    statusEl = $("ag-status");
    if (!formEl || !inputEl) return;

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = inputEl.value;
      inputEl.value = "";
      autogrow();
      parseEl.hidden = true;
      parseEl.textContent = "";
      phPaused = false;
      run(text);
      inputEl.focus();
    });

    inputEl.addEventListener("input", function () {
      autogrow();
      phPaused = !!inputEl.value;
      if (parseDebounce) clearTimeout(parseDebounce);
      parseDebounce = setTimeout(parseEcho, 120);
    });

    inputEl.addEventListener("focus", function () {
      phPaused = true;
      stopRotation();
    });
    inputEl.addEventListener("blur", function () {
      phPaused = false;
      if (!inputEl.value) startRotation();
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        formEl.dispatchEvent(new Event("submit", { cancelable: true }));
      } else if (e.key === "Escape") {
        if (activeCtl) abortActive();
        else inputEl.blur();
      }
    });

    if (stopBtn) {
      stopBtn.addEventListener("click", function () { abortActive(); });
    }

    startRotation();
  }

  /* -------------------------------------------------------------- chips */
  function paintSuggestions() {
    var host = $("ag-sugg");
    if (!host) return;
    var items = [
      t("judge Rank(Mean[10](BestAsk - BestBid) / MidPrice)", "评判 Rank(Mean[10](BestAsk - BestBid) / MidPrice)"),
      t("evaluate Rank(Mean[10](BestAsk - BestBid) / MidPrice) on the market", "在市场上评估 Rank(Mean[10](BestAsk - BestBid) / MidPrice)"),
      t("train logistic + ridge on the eight signals", "在八个信号上训练逻辑回归 + 岭回归"),
      t("placebo test (BidSize - AskSize) / (BidSize + AskSize)", "对 (BidSize - AskSize) / (BidSize + AskSize) 做置换检验"),
      t("show me the market's generative process", "给我看市场的生成过程"),
      t("t = 2.40 · π = 0.25 — does it survive?", "t = 2.40 · π = 0.25——能过筛吗？"),
      t("N = 6960 — what is the discovery wall?", "N = 6960——发现之墙有多高？"),
      t("run the funnel on 400 proposals", "跑 400 个提案的漏斗"),
      t("what can't you answer?", "有什么你答不了？"),
      t("let the council rule on t = 2.40 · π = 0.25", "让议会裁决 t = 2.40 · π = 0.25"),
      t("find the home venue of (BidSize - AskSize) / (BidSize + AskSize)", "找 (BidSize - AskSize) / (BidSize + AskSize) 的主场"),
      t("build a strategy on (BidSize - AskSize) / (BidSize + AskSize)", "以 (BidSize - AskSize) / (BidSize + AskSize) 建策略"),
      t("resurrect the sample library", "复活样本因子库"),
      t("who built this?", "这是谁做的？")
    ];
    host.textContent = "";
    items.forEach(function (s) {
      var b = el("button", "ag-sugg-chip", s);
      b.type = "button";
      b.addEventListener("click", function () {
        host.hidden = true;
        run(s);
      });
      host.appendChild(b);
    });
  }

  /* ------------------------------------------------------------ mode bar */
  function wireModes() {
    var chips = document.querySelectorAll(".ag-mode");
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        if (c.dataset.mode === currentMode) return;
        currentMode = c.dataset.mode;
        chips.forEach(function (x) {
          var on = x.dataset.mode === currentMode;
          x.classList.toggle("is-on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        sysLine(t("mode · " + currentMode + " — next answer uses only that instrument",
          "模式 · " + currentMode + "——下一问只用这个仪器"));
        if (inputEl) inputEl.focus();
      });
    });

    var th = $("ag-think");
    if (th) {
      th.addEventListener("click", function () {
        thinkOn = !thinkOn;
        th.classList.toggle("is-on", thinkOn);
        th.setAttribute("aria-pressed", thinkOn ? "true" : "false");
        th.textContent = t(thinkOn ? "Think · on" : "Think · off", thinkOn ? "思考链 · 开" : "思考链 · 关");
      });
    }

    /* plain language: every verdict carries a one-sentence plain line */
    var pl = $("ag-plain");
    if (pl) {
      var syncPlain = function () {
        pl.classList.toggle("is-on", PLAIN);
        pl.setAttribute("aria-pressed", PLAIN ? "true" : "false");
        pl.textContent = t(PLAIN ? "Plain · on" : "Plain · off", PLAIN ? "说人话 · 开" : "说人话 · 关");
      };
      syncPlain();
      pl.addEventListener("click", function () {
        PLAIN = !PLAIN;
        window.HJ_PLAIN = PLAIN;
        try { localStorage.setItem("hj-plain", PLAIN ? "on" : "off"); } catch (e) {}
        syncPlain();
      });
    }

    /* roster: clicking an instrument fills a starter prompt */
    var tools = document.querySelectorAll(".ag-tool");
    tools.forEach(function (b) {
      b.addEventListener("click", function () {
        var starter = {
          gate: "judge Rank(Mean[10](BestAsk - BestBid) / MidPrice) — order-book imbalance",
          dilute: "t = 2.40 · π = 0.25",
          hurdle: "N = 6960",
          pool: "pool 1.8, 2.2, 0.9, 1.4",
          autopsy: "autopsy bench",
          library: "run the funnel on 400 proposals",
          mleval: "evaluate Rank(Mean[10](BestAsk - BestBid) / MidPrice)",
          train: "train logistic + ridge on the eight signals",
          placebo: "placebo test (BidSize - AskSize) / (BidSize + AskSize)",
          market: "show me the market's generative process"
        }[b.dataset.tool];
        if (starter && inputEl) {
          inputEl.value = starter;
          autogrow();
          phPaused = true;
          parseEcho();
          inputEl.focus();
        }
      });
    });
  }

  function sysLine(text) {
    if (!streamEl) return;
    if (emptyEl) emptyEl.hidden = true;
    var row = el("div", "ag-sys");
    row.appendChild(el("span", null, text));
    streamEl.appendChild(row);
    maybeScroll(true);
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    streamEl = $("ag-stream");
    emptyEl = $("ag-empty");
    liveEl = $("ag-live");
    wireComposer();
    wireWorkbench();
    wireModes();
    wireBrain();
    paintBrainChip();
    paintSession();
    paintCanon();
    paintJumps();
    paintSuggestions();
    autogrow();

    window.addEventListener("hj:lang", function () {
      applyAgI18n();
      paintBrainChip();
      paintSession();
      paintCanon();
      paintJumps();
      paintSuggestions();
      if (statusEl) {
        statusEl.textContent = activeCtl
          ? t("computing…", "计算中…")
          : t("ready", "就绪");
      }
      stopRotation();
      startRotation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.BoatAgent = {
    route: route,
    run: run,
    ask: function (text) { run(text); },
    render: function (out) { return appendOut(out); },
    prefill: function (text) {
      if (!inputEl) return;
      inputEl.value = String(text || "");
      autogrow();
      parseEcho();
      inputEl.focus();
    },
    version: VERSION,
    brain: function () { return brainCfg(); },
    brainActive: brainActive,
    session: function () { return { calls: session.calls, ms: session.ms, net: session.net, seed: SEED }; }
  };
})();
