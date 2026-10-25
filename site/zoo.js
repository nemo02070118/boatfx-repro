/* ==========================================================================
   BOAT · 00b zoo — the factor zoo, made literal
   --------------------------------------------------------------------------
   The paper's subject is a zoo: thousands of candidates, one universal
   screen, and the discards it cannot see. This file makes that zoo real
   and runnable, four ways in:

     builtin  26 public factors with literature citations, organised by
              anomaly family — momentum, reversal, volatility, volume,
              liquidity, skew, MAX, order flow
     mined    machine enumeration over the DSL whitelist: signals x
              operators x windows x transforms, hundreds of legal
              expressions, all compiled and measured here
     fetched  any public "name :: formula" text from a URL (GitHub links
              are rewritten to the jsdelivr mirror), compiled and
              validated one by one, kept or skipped with reasons
     own      the visitor's own library, series or expression

   Then run_experiment puts the zoo through the paper's own test:
   the normal way (universal |t|<1.96 screen, survivors equal-weighted)
   against our way (home-venue routing + Stouffer pooling of the
   mis-killed), both measured on the same holdout, then adjudicated by
   the council — with the devil's dissent hard-coded to say what this
   can and cannot prove.
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
  var BLK = 60, SEGMENTS = 4, PAY_T = 1.5, SPLIT = 0.7;

  /* ------------------------------------------------- the builtin library */
  /* Every expr must parse under the gate's grammar. Every cite is real. */
  var BUILTIN = [
    { id: "mom20", family: "momentum", expr: "Rank(MidPrice - Mean[20](MidPrice))",
      cite: "Jegadeesh & Titman (1993), Returns to Buying Winners",
      mech: { en: "price above its own 20-bar mean keeps paying", zh: "价格高于自身 20 根均值后继续兑现" } },
    { id: "mom60", family: "momentum", expr: "Rank(MidPrice - Mean[60](MidPrice))",
      cite: "Jegadeesh & Titman (1993), intermediate horizon",
      mech: { en: "the same bet at the quarter horizon", zh: "同一个押注在季度尺度上" } },
    { id: "accel", family: "momentum", expr: "Rank(Mean[5](MidPrice) - Mean[20](MidPrice))",
      cite: "time-series momentum (Moskowitz et al. 2012)",
      mech: { en: "fast mean crossing slow mean", zh: "快均值上穿慢均值" } },
    { id: "slope", family: "momentum", expr: "Slope[20](MidPrice)",
      cite: "trend strength, technical analysis canon",
      mech: { en: "regression slope of price", zh: "价格的回归斜率" } },
    { id: "rev5", family: "reversal", expr: "Rank(Mean[5](MidPrice) - MidPrice)",
      cite: "Bondt & Thaler (1985); Lo & MacKinlay (1990)",
      mech: { en: "a five-bar pop tends to give back", zh: "五根的冲高倾向于回吐" } },
    { id: "rev20", family: "reversal", expr: "Rank(Mean[20](MidPrice) - MidPrice)",
      cite: "mean deviation, Bollinger-style",
      mech: { en: "price stretched from its mean", zh: "价格被拉离均值" } },
    { id: "zrev", family: "reversal", expr: "Zscore[20](MidPrice)",
      cite: "standardised deviation",
      mech: { en: "how many sigma from the mean", zh: "离均值几个 sigma" } },
    { id: "ivol20", family: "volatility", expr: "Std[20](MidPrice)",
      cite: "Ang, Hodrick, Xing & Zhang (2006), IVOL effect",
      mech: { en: "high idiosyncratic vol under-earns", zh: "高特异波动低收益" } },
    { id: "ivol60", family: "volatility", expr: "Std[60](MidPrice)",
      cite: "Ang et al. (2006), quarter horizon",
      mech: { en: "the same risk at the quarter horizon", zh: "同一个风险在季度尺度" } },
    { id: "volterm", family: "volatility", expr: "Std[5](MidPrice) / Std[20](MidPrice)",
      cite: "volatility term structure",
      mech: { en: "short vol over long vol", zh: "短波动比长波动" } },
    { id: "volsurg", family: "volume", expr: "Rank(Volume / Mean[20](Volume))",
      cite: "Gervais, Kaniel & Mingelgrin (2001)",
      mech: { en: "unusual volume", zh: "异常成交量" } },
    { id: "volstd", family: "volume", expr: "Rank(Volume / Std[20](Volume))",
      cite: "volume z-score family",
      mech: { en: "volume against its own noise", zh: "成交量对自身噪音" } },
    { id: "tradeint", family: "volume", expr: "Rank(TradeSize / Mean[20](TradeSize))",
      cite: "trade intensity (Easley & O'Hara lineage)",
      mech: { en: "tape activity spike", zh: "成交活跃度尖峰" } },
    { id: "priceratio", family: "range", expr: "Rank(MidPrice / Mean[20](MidPrice))",
      cite: "anchoring (George & Hwang 2004) family, expressed as price against its own mean",
      mech: { en: "price stretched above its own anchor", zh: "价格被拉离自身锚点" } },
    { id: "cv", family: "max", expr: "Rank(Std[20](MidPrice) / Mean[20](MidPrice))",
      cite: "variability family (Bali, Cakici & Whitelaw 2011 lineage)",
      mech: { en: "coefficient of variation — moves relative to level", zh: "变异系数——波动对水平" } },
    { id: "imb", family: "orderflow", expr: "(BidSize - AskSize) / (BidSize + AskSize)",
      cite: "Biais, Hillion & Spatt (1995)",
      mech: { en: "order-book imbalance — the declared tape's only real channel", zh: "盘口失衡——声明胶带上唯一真实的通道" } },
    { id: "imbrank", family: "orderflow", expr: "Rank((BidSize - AskSize) / (BidSize + AskSize))",
      cite: "Biais et al. (1995), ranked",
      mech: { en: "the same imbalance, ranked", zh: "同一个失衡，排名化" } },
    { id: "spread", family: "liquidity", expr: "Rank(BestAsk - BestBid)",
      cite: "quoted spread, Amihud (2002) lineage",
      mech: { en: "the cost of crossing", zh: "穿价的成本" } },
    { id: "spreadrel", family: "liquidity", expr: "Rank((BestAsk - BestBid) / MidPrice)",
      cite: "relative spread",
      mech: { en: "spread against price level", zh: "价差对价格水平" } },
    { id: "quotepress", family: "orderflow", expr: "Rank((BestAsk + BestBid) / 2 - MidPrice)",
      cite: "quote pressure around the mid",
      mech: { en: "quotes pushing off the mid", zh: "报价把中点推离" } },
    { id: "flowact", family: "orderflow", expr: "Rank((BidSize - AskSize) * TradeSize)",
      cite: "signed flow (Easley & O'Hara lineage), expressed as imbalance × activity",
      mech: { en: "imbalance weighted by how much trades", zh: "失衡按成交活跃度加权" } },
    { id: "volspread", family: "liquidity", expr: "Rank(Std[20](BestAsk - BestBid))",
      cite: "spread volatility, illiquidity proxy",
      mech: { en: "the spread will not hold still", zh: "价差稳不住" } }
  ];

  /* ------------------------------------------------------- machine mining */
  /* Enumeration over the DSL whitelist. Deterministic: the same seed of
     inputs produces the same zoo for every visitor. */
  var MINE_INPUTS = ["MidPrice", "Volume", "(BestAsk - BestBid)"];
  var MINE_OPS = ["Mean", "Std", "Slope", "Zscore"];
  var MINE_WINS = [5, 10, 20, 60];
  function mine() {
    var out = [], i, j, k;
    for (i = 0; i < MINE_INPUTS.length; i++) {
      for (j = 0; j < MINE_OPS.length; j++) {
        for (k = 0; k < MINE_WINS.length; k++) {
          var raw = MINE_OPS[j] + "[" + MINE_WINS[k] + "](" + MINE_INPUTS[i] + ")";
          out.push({ id: "m_" + out.length, family: "mined", expr: raw,
            cite: t("machine-enumerated · DSL whitelist", "机器枚举 · DSL 白名单"),
            mech: { en: MINE_OPS[j] + " over " + MINE_WINS[k] + " bars of " + MINE_INPUTS[i], zh: MINE_OPS[j] + " · " + MINE_WINS[k] + " 根 · " + MINE_INPUTS[i] } });
          out.push({ id: "m_" + out.length, family: "mined", expr: "Rank(" + raw + ")",
            cite: t("machine-enumerated · DSL whitelist", "机器枚举 · DSL 白名单"),
            mech: { en: "ranked " + MINE_OPS[j] + " over " + MINE_WINS[k] + " bars", zh: "排名化 " + MINE_OPS[j] + " · " + MINE_WINS[k] + " 根" } });
        }
      }
    }
    var ratios = [
      ["Volume / Mean[20](Volume)", "volume surge"],
      ["Volume / Std[20](Volume)", "volume z"],
      ["BidSize / (AskSize + 1)", "bid pressure"],
      ["(BestAsk - BestBid) / MidPrice", "relative spread"],
      ["TradeSize / Mean[20](TradeSize)", "trade intensity"]
    ];
    for (i = 0; i < ratios.length; i++) {
      out.push({ id: "m_" + out.length, family: "mined", expr: "Rank(" + ratios[i][0] + ")",
        cite: t("machine-enumerated · DSL whitelist", "机器枚举 · DSL 白名单"),
        mech: { en: ratios[i][1], zh: ratios[i][1] } });
      for (k = 0; k < 2; k++) {
        out.push({ id: "m_" + out.length, family: "mined", expr: ratios[i][0],
          cite: t("machine-enumerated · DSL whitelist", "机器枚举 · DSL 白名单"),
          mech: { en: ratios[i][1] + (k ? " · raw" : ""), zh: ratios[i][1] } });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ fetching */
  /* A GitHub blob URL is rewritten to the jsdelivr mirror, which is
     reachable where raw.githubusercontent is not. The source and the
     fetch time are carried with the result, permanently. */
  function rewriteUrl(u) {
    var m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/.exec(u);
    if (m) return "https://cdn.jsdelivr.net/gh/" + m[1] + "/" + m[2] + "@" + m[3] + "/" + m[4];
    return u;
  }
  function parseLibraryText(text) {
    var rows = [];
    String(text || "").split(/\r?\n/).forEach(function (ln) {
      ln = ln.trim();
      if (!ln || ln.charAt(0) === "#" || ln.charAt(0) === "/") return;
      var name = null, formula = null;
      if (ln.indexOf("::") >= 0) {
        var p = ln.split("::");
        name = p[0].trim(); formula = p.slice(1).join("::").trim();
      } else if (ln.indexOf("\t") >= 0) {
        var q = ln.split("\t");
        name = q[0].trim(); formula = q.slice(1).join("\t").trim();
      } else if (ln.indexOf(" | ") >= 0) {
        var r = ln.split(" | ");
        name = r[0].trim(); formula = r.slice(1).join(" | ").trim();
      } else if (ln.indexOf(",") >= 0) {
        var s = ln.split(",");
        name = s[0].trim(); formula = s.slice(1).join(",").trim();
      } else {
        formula = ln;
      }
      if (formula) rows.push({ name: name || ("fetched " + (rows.length + 1)), expr: formula });
    });
    return rows;
  }
  function fetchLibrary(url) {
    var src = rewriteUrl(String(url || "").trim());
    if (!/^https?:\/\//.test(src)) {
      return Promise.resolve({ ok: false, why: t("that is not a URL", "这不是一个 URL"), kept: [], skipped: [], source: src });
    }
    return fetch(src, { redirect: "follow" }).then(function (r) {
      if (!r.ok) return { ok: false, why: t("the source answered " + r.status(), "来源返回 " + r.status()), kept: [], skipped: [], source: src };
      return r.text();
    }).then(function (text) {
      if (typeof text !== "string") return text;
      var parsed = parseLibraryText(text);
      var kept = [], skipped = [];
      parsed.forEach(function (row) {
        var P = (window.HJ_GATE && window.HJ_GATE.parse) ? null : { err: "no grammar" };
        var ok = false, why = "";
        if (window.HJ_GATE && window.HJ_GATE.parse) {
          try { window.HJ_GATE.parse(row.expr); ok = true; }
          catch (e) { why = String((e && e.message) || e); }
        } else { why = "grammar unavailable"; }
        if (ok) kept.push({ name: row.name, expr: row.expr });
        else skipped.push({ name: row.name, expr: row.expr, why: why });
      });
      return { ok: true, kept: kept, skipped: skipped, source: src, at: new Date().toISOString(), total: parsed.length };
    }).catch(function (e) {
      return { ok: false, why: String((e && e.message) || e), kept: [], skipped: [], source: src };
    });
  }

  /* ==================================================== the experiment */
  /* The paper's own test, run on whatever zoo the visitor assembled:
     the normal way against our way, both measured on the same holdout. */
  function measureOne(f) {
    var E = window.HJ_ENGINES;
    var sig = E.helpers.evalExpr(f.expr);
    if (!sig) return { name: f.name, expr: f.expr, cite: f.cite, family: f.family, err: true };
    var M0 = E.helpers.market();
    var st = window.HJ_ML.stats(sig, M0.fwd);
    var n = Math.min(sig.length, M0.fwd.length);
    var segLen = Math.floor(n / SEGMENTS);
    var segs = [], s;
    for (s = 0; s < SEGMENTS; s++) {
      var a = s * segLen, b = (s === SEGMENTS - 1) ? n : a + segLen;
      var bt = E.helpers.blockT(sig.slice(a, b), M0.fwd.slice(a, b));
      segs.push({ i: s + 1, t: bt.t, pays: bt.t >= PAY_T });
    }
    var home = null;
    segs.forEach(function (g) { if (g.pays && (!home || Math.abs(g.t) > Math.abs(home.t))) home = g; });
    var tg = st.icT * Math.sqrt(st.pi);
    var key = "weak";
    if (tg >= SCREEN) key = "pass";
    else if (st.icT >= ALLOC) key = "miskill";
    return {
      name: f.name, expr: f.expr, cite: f.cite, family: f.family,
      ic: st.ic, t: st.icT, pi: st.pi, sharpe: st.sharpe, maxDD: st.maxDD,
      home: home ? home.i : null, segs: segs, tg: tg, key: key
    };
  }

  function positionsOf(expr, n) {
    var E = window.HJ_ENGINES;
    var sig = E.helpers.evalExpr(expr);
    if (!sig) return null;
    var M = window.HJ_ML;
    var z = M.zscore(sig.slice(0, n));
    return z.map(function (v) { return v < -2.5 ? -0.5 : (v > 2.5 ? 0.5 : v / 5); });
  }

  function portfolio(rows, mode) {
    /* mode "screen": the survivors of the universal |t|>=1.96 screen,
       equal-weighted. mode "ours": the mis-killed set, each position
       live only inside its own paying segments. No fitted parameters
       anywhere: z-scoring is a transform, not a fit. */
    var E = window.HJ_ENGINES;
    var M0 = E.helpers.market();
    var fwd = M0.fwd;
    var n = Math.min(fwd.length, 4000);
    var chosen = rows.filter(function (r) {
      return !r.err && (mode === "screen" ? Math.abs(r.t) >= SCREEN : r.key === "miskill");
    });
    if (!chosen.length) return null;
    var pos = new Array(n).fill(0);
    chosen.forEach(function (r) {
      var p = positionsOf(r.expr, n);
      if (!p) return;
      var i;
      if (mode === "ours") {
        var segLen = Math.floor(n / SEGMENTS);
        for (i = 0; i < n; i++) {
          var seg = Math.min(SEGMENTS - 1, Math.floor(i / segLen));
          if (r.segs && r.segs[seg] && r.segs[seg].pays) pos[i] += p[i] / chosen.length;
        }
      } else {
        for (i = 0; i < n; i++) pos[i] += p[i] / chosen.length;
      }
    });
    var cut = Math.floor(n * SPLIT);
    function metrics(from, to) {
      var strat = [], i;
      for (i = from; i < to; i++) strat.push(pos[i] * fwd[i]);
      if (!strat.length) return null;
      var m = 0, v = 0;
      for (i = 0; i < strat.length; i++) m += strat[i];
      m /= strat.length;
      for (i = 0; i < strat.length; i++) { var d = strat[i] - m; v += d * d; }
      var sd = strat.length > 1 ? Math.sqrt(v / (strat.length - 1)) : 0;
      var eq = 1, peak = 1, mdd = 0;
      for (i = 0; i < strat.length; i++) {
        eq *= (1 + strat[i]);
        if (eq > peak) peak = eq;
        var dd = 1 - eq / peak;
        if (dd > mdd) mdd = dd;
      }
      var turn = 0;
      for (i = Math.max(from, 1); i < to; i++) turn += Math.abs(pos[i] - pos[i - 1]);
      turn = to - from > 1 ? turn / (to - from - 1) : 0;
      var hit = 0;
      for (i = from; i < to; i++) if ((pos[i] > 0 ? 1 : -1) === (fwd[i] > 0 ? 1 : -1)) hit++;
      var curve = [], e2 = 1;
      for (i = from; i < to; i++) { e2 *= (1 + pos[i] * fwd[i]); curve.push(e2); }
      return {
        sharpe: sd > 1e-12 ? (m / sd) * Math.sqrt(252) : 0,
        maxDD: mdd, turnover: turn, hit: hit / strat.length, equity: curve
      };
    }
    return { n: chosen.length, names: chosen.map(function (r) { return r.name; }), is: metrics(0, cut), oos: metrics(cut, n) };
  }

  function experiment(opts) {
    var steps = [], blocks = [];
    var E = window.HJ_ENGINES, C = window.HJ_COUNCIL;
    if (!E || !window.HJ_ML || !C) return { steps: [{ name: "instruments", args: "zoo", status: "fail" }], blocks: [] };

    /* assemble the zoo */
    var pool = [];
    var src = [];
    if (opts.builtin !== false) { pool = pool.concat(BUILTIN); src.push(t("builtin public library (" + BUILTIN.length + ")", "内置公开库（" + BUILTIN.length + " 个）")); }
    if (opts.mined) { var m = mine(); pool = pool.concat(m); src.push(t("machine-mined (" + m.length + ")", "机器枚举（" + m.length + " 个）")); }
    if (opts.fetched && opts.fetched.kept) { pool = pool.concat(opts.fetched.kept); src.push(t("fetched from " + opts.fetched.source + " (" + opts.fetched.kept.length + ")", "来自 " + opts.fetched.source + "（" + opts.fetched.kept.length + " 个）")); }
    if (opts.rows) { pool = pool.concat(opts.rows); src.push(t("your library (" + opts.rows.length + ")", "你的因子库（" + opts.rows.length + " 个）")); }
    if (opts.expr) { pool = pool.concat([{ id: "one", name: "your factor", expr: opts.expr, cite: t("yours", "你的"), family: "own" }]); src.push(t("your expression", "你的表达式")); }

    /* dedupe by expression */
    var seen = {}, uniq = [];
    pool.forEach(function (f) { if (f && f.expr && !seen[f.expr]) { seen[f.expr] = 1; uniq.push(f); } });

    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var measured = uniq.map(measureOne);
    var ok = measured.filter(function (r) { return !r.err; });
    steps.push({ name: "zoo.measure", args: "(" + uniq.length + " factors)", status: "ok",
      ms: Math.max(0, Math.round((((window.performance && performance.now) ? performance.now() : 0) - t0) * 100) / 100),
      detail: ok.length + " compiled and measured on the declared tape" });

    var keptA = ok.filter(function (r) { return Math.abs(r.t) >= SCREEN; });
    var mis = ok.filter(function (r) { return r.key === "miskill"; });
    var pA = portfolio(ok, "screen");
    var pB = portfolio(ok, "ours");
    function pooled(list) {
      if (!list.length) return null;
      var s = 0;
      list.forEach(function (r) { s += r.t; });
      return (s / list.length) * Math.sqrt(list.length);
    }
    var pMis = pooled(mis);

    blocks.push({ k: "prose", text: t(
      "The experiment. Hypotheses, declared before the run: H1 — a universal |t|<1.96 screen discards factors that pay only in their home venue; H2 — pooling the discards (Stouffer) restores a group-level signal the screen destroyed. " +
      "Sample: " + uniq.length + " factors on the declared tape (" + src.join(" · ") + "), seed 20261105. " +
      "Two ways, same tape, same holdout: the normal way keeps the screen's survivors equal-weighted; our way routes the mis-killed to their home venues and pools them.",
      "实验。假设先声明再跑：H1——通用 |t|<1.96 筛会丢弃只在自己主场兑现的因子；H2——把废弃集池化（Stouffer）能恢复被筛掉的组级信号。" +
      "样本：" + uniq.length + " 个因子跑在声明胶带上（" + src.join(" · ") + "），种子 20261105。" +
      "两条路，同一胶带、同一留出集：正常方式保留过筛因子等权；我们的方式把误杀集路由回主场并池化。") });

    var top = ok.slice().sort(function (a, b) { return Math.abs(b.t) - Math.abs(a.t); }).slice(0, 24);
    blocks.push({ k: "table",
      head: [{ t: "factor" }, { t: "IC", num: true }, { t: "t", num: true }, { t: "π", num: true },
        { t: "home", num: true }, { t: "t_g", num: true }, { t: "screen" }],
      rows: top.map(function (r) {
        return [
          { t: r.name },
          { t: num(r.ic, 4), num: true },
          { t: num(r.t, 2), num: true, tone: Math.abs(r.t) >= ALLOC ? "ok" : (Math.abs(r.t) >= SCREEN ? "warn" : "no") },
          { t: num(r.pi, 3), num: true },
          { t: r.home ? ("Q" + r.home) : "—", num: true },
          { t: num(r.tg, 2), num: true, tone: r.tg >= SCREEN ? "ok" : "no" },
          { t: r.key === "pass" ? t("pass", "过筛") : r.key === "miskill" ? t("mis-killed", "误杀") : t("weak", "偏弱"),
            tone: r.key === "miskill" ? "no" : (r.key === "pass" ? "ok" : "") }
        ];
      }) });

    var maxT = 1;
    ok.forEach(function (r) { maxT = Math.max(maxT, Math.abs(r.t)); });
    blocks.push({ k: "bars", items: top.slice(0, 12).map(function (r) {
      return { label: r.name + " · t_g " + num(r.tg, 2), value: Math.abs(r.t), max: maxT * 1.15,
        tone: r.key === "miskill" ? "cut" : "", delta: "t_g " + num(r.tg, 2) };
    }) });

    blocks.push({ k: "kv", items: [
      { k: "factors measured", v: String(ok.length) },
      { k: "screen keeps", v: keptA.length + " (" + num(ok.length ? keptA.length / ok.length * 100 : 0, 0) + "%)" },
      { k: "mis-killed", v: String(mis.length), tone: mis.length ? "no" : "" },
      { k: "pooled t (mis-killed)", v: pMis == null ? "—" : num(pMis, 2), tone: pMis != null && pMis >= SCREEN ? "ok" : "" },
      { k: "Sharpe OOS · normal", v: pA && pA.oos ? num(pA.oos.sharpe, 2) : "—" },
      { k: "Sharpe OOS · ours", v: pB && pB.oos ? num(pB.oos.sharpe, 2) : "—", tone: pB && pA && pB.oos && pA.oos && pB.oos.sharpe > pA.oos.sharpe ? "ok" : "" },
      { k: "max DD OOS · ours", v: pB && pB.oos ? num(pB.oos.maxDD * 100, 1) + "%" : "—" }
    ] });

    function decimate(arr) {
      var k = Math.max(1, Math.floor(arr.length / 240));
      var out = [];
      for (var q = 0; q < arr.length; q += k) out.push(arr[q]);
      if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
      return out;
    }
    if (pA && pA.oos) blocks.push({ k: "chart", variant: "line", log: true,
      label: t("equity · the normal way (screen survivors, holdout)", "净值 · 正常方式（过筛幸存者，留出集）"), series: decimate(pA.oos.equity) });
    if (pB && pB.oos) blocks.push({ k: "chart", variant: "line", log: true,
      label: t("equity · our way (home-venue routed, holdout)", "净值 · 我们的方式（主场路由，留出集）"), series: decimate(pB.oos.equity) });

    var ours = pB && pA && pB.oos && pA.oos ? pB.oos.sharpe > pA.oos.sharpe : false;
    blocks.push({ k: "verdict",
      tone: ours ? "ok" : "warn",
      h: ours
        ? t("on this tape, our way wins the holdout", "在这条胶带上，我们的方式赢了留出集")
        : t("on this tape, the normal way holds up", "在这条胶带上，正常方式守住了"),
      b: t(
        "The screen keeps " + keptA.length + " of " + ok.length + " factors; the mis-killed set (" + mis.length +
        ") pools to t = " + (pMis == null ? "—" : num(pMis, 2)) + ". Holdout Sharpe: " +
        (pA && pA.oos ? num(pA.oos.sharpe, 2) : "—") + " the normal way versus " +
        (pB && pB.oos ? num(pB.oos.sharpe, 2) : "—") + " ours. Either answer is printed as measured — " +
        "the paper's claim is about pools with home-venue factors, and here you can watch it hold or fail.",
        "筛子留下 " + ok.length + " 个中的 " + keptA.length + " 个；误杀集（" + mis.length +
        " 个）池化到 t = " + (pMis == null ? "—" : num(pMis, 2)) + "。留出集 Sharpe：正常方式 " +
        (pA && pA.oos ? num(pA.oos.sharpe, 2) : "—") + " versus 我们的方式 " +
        (pB && pB.oos ? num(pB.oos.sharpe, 2) : "—") + "。两种答案都按实测印出——论文的主张是关于含有主场因子的池子的，在这里你可以看它成立还是失败。"),
      plain: ours
        ? t("The screen's discards, routed home and pooled, beat the survivors.", "筛子丢弃的因子，路由回主场再池化，赢了幸存者。")
        : t("On this tape the survivors were simply better — the mechanism is visible either way.", "在这条胶带上幸存者就是更强——机制两种方式下都可见。") });

    /* the parliament adjudicates the experiment */
    var councilOut = C.run({ rows: measured.filter(function (r) { return !r.err; }).map(function (r) {
      return { name: r.name, t: r.t, pi: r.pi };
    }) });
    blocks.push({ k: "council", council: councilOut.council });

    blocks.push({ k: "note", text: t(
      "Declared: per-factor t is the IC block-t over " + BLK + "-bar non-overlapping blocks; π is the measured active share; " +
      "a segment pays at block t ≥ " + PAY_T + "; positions are clip(z, ±2.5)/2.5 averaged across the chosen set — a transform, not a fit; " +
      "both portfolios are scored on the same " + Math.round(SPLIT * 100) + "/" + Math.round((1 - SPLIT) * 100) + " split, holdout only. " +
      "One tape, one seed, one generative process — a mechanism reproduction, not a market conclusion. The paper's own US-pool numbers (94 discards, 0.85 → 1.30) are quoted in §04, never borrowed for this zoo.",
      "声明：单因子 t 是 " + BLK + " 根不重叠区块的 IC 区块 t；π 是实测活跃占比；段 t ≥ " + PAY_T + " 记为兑现；" +
      "仓位是 clip(z, ±2.5)/2.5 在所选集合上平均——是变换不是拟合；两个组合同一套 " + Math.round(SPLIT * 100) + "/" + Math.round((1 - SPLIT) * 100) +
      " 分割，只报留出集。一条胶带、一个种子、一个生成过程——是机制复现，不是市场结论。论文自己的美股池数字（94 个废弃、0.85 → 1.30）引用在 §04，从不借给这个动物园。") });

    blocks.push({ k: "actions", items: [
      { label: t("fetch a public library from a URL", "从 URL 拉取公开因子库"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("fetch a factor library from a URL");
      } },
      { label: t("run the machine-mined zoo", "跑机器枚举的动物园"), fn: function () {
        if (window.BoatAgent && window.BoatAgent.ask) window.BoatAgent.ask("mine the factor zoo and run the experiment");
      } },
      { label: t("open the autopsy bench", "打开误杀解剖台"), fn: function () {
        if (window.HJ_BENCH) window.HJ_BENCH.focus("batch");
      } }
    ] });

    return {
      steps: steps,
      blocks: blocks,
      experiment: {
        n: uniq.length, ok: ok.length, kept: keptA.length, mis: mis.length, pooledMis: pMis,
        sharpeA: pA && pA.oos ? pA.oos.sharpe : null,
        sharpeB: pB && pB.oos ? pB.oos.sharpe : null,
        sources: src
      },
      council: councilOut.council
    };
  }

  /* ------------------------------------------------------------- export */
  window.HJ_ZOO = {
    version: "v1.0",
    builtin: BUILTIN,
    mine: mine,
    fetchLibrary: fetchLibrary,
    rewriteUrl: rewriteUrl,
    parseLibraryText: parseLibraryText,
    experiment: experiment,
    measureOne: measureOne,
    constants: { SCREEN: SCREEN, ALLOC: ALLOC, BLK: BLK, SEGMENTS: SEGMENTS, PAY_T: PAY_T, SPLIT: SPLIT },
    helpers: { t: t, num: num }
  };
})();
