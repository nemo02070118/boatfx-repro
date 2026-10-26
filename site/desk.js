/* ==========================================================================
   BOAT-3 · 07 desk — the real terminal's output, precomputed and embedded
   --------------------------------------------------------------------------
   Not a browser demo: the V12 portfolio backtest below is the real engine's
   cached result (engine v12_final: Sharpe 2.595, 1161 equity points, 2020-01
   → 2025-03, 200-stock universe, 55 factors), and the TSLA / Moutai panels are
   the real Rust stack's /api/analysis + /api/signals output, saved to JSON by
   the local backend and shipped with the page. Every number is the system's,
   not a simulation. The page says so, and says it is not advice.
   ========================================================================== */
(function () {
  "use strict";

  function lang() {
    try { var s = localStorage.getItem("hj-lang"); if (s === "zh" || s === "en") return s; } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
  }
  function T(en, zh) { return lang() === "zh" ? zh : en; }
  function num(x, d) { d = d == null ? 2 : d; if (x == null || !isFinite(x)) return "—"; var p = Math.pow(10, d); return (Math.round(x * p) / p).toFixed(d); }
  function pct(x, d) { return num(x, d == null ? 2 : d) + "%"; }
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, at) { var n = document.createElementNS(NS, tag); for (var k in at) if (at.hasOwnProperty(k)) n.setAttribute(k, at[k]); return n; }

  var D = { v12: null, tsla: null, moutai: null, loaded: false };

  function loadJSON(p) { return fetch(p).then(function (r) { return r.json(); }); }

  function loadAll() {
    return Promise.all([
      loadJSON("desk/v12.json").catch(function () { return null; }),
      Promise.all([
        loadJSON("desk/analysis-tsla.json").catch(function () { return null; }),
        loadJSON("desk/klines-tsla.json").catch(function () { return null; }),
        loadJSON("desk/signals-tsla.json").catch(function () { return null; })
      ]),
      Promise.all([
        loadJSON("desk/analysis-moutai.json").catch(function () { return null; }),
        loadJSON("desk/klines-moutai.json").catch(function () { return null; }),
        loadJSON("desk/signals-moutai.json").catch(function () { return null; })
      ])
    ]).then(function (r) {
      D.v12 = r[0] && r[0].data ? r[0].data : r[0];
      D.tsla = { analysis: r[1][0], klines: r[1][1], signals: r[1][2] };
      D.moutai = { analysis: r[2][0], klines: r[2][1], signals: r[2][2] };
      D.loaded = true;
    });
  }

  /* --------------------------------------------------------------- charts */
  function line(vals, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 170, PAD = 6, i;
    var c = (vals || []).filter(function (v) { return v != null && isFinite(v); });
    if (!c.length) return sv("svg", { viewBox: "0 0 " + W + " " + H });
    var lo = Math.min.apply(null, c), hi = Math.max.apply(null, c);
    if (hi - lo < 1e-9) hi = lo + 1;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    for (i = 1; i <= 3; i++) g.appendChild(sv("line", { x1: 0, y1: PAD + (H - 2 * PAD) * i / 4, x2: W, y2: PAD + (H - 2 * PAD) * i / 4, stroke: "#1d3040", "stroke-width": 1 }));
    var d = "", st = false;
    for (i = 0; i < vals.length; i++) {
      var v = vals[i]; if (v == null || !isFinite(v)) continue;
      var x = i / (vals.length - 1) * W, y = H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
      d += (st ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); st = true;
    }
    g.appendChild(sv("path", { d: d, fill: "none", stroke: opt.color || "#5ec9a8", "stroke-width": 1.6, "stroke-linejoin": "round" }));
    return g;
  }
  function area(vals, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 130, PAD = 6, i;
    var c = (vals || []).filter(function (v) { return v != null && isFinite(v); });
    if (!c.length) return sv("svg", { viewBox: "0 0 " + W + " " + H });
    var lo = Math.min.apply(null, c), hi = Math.max.apply(null, c);
    if (hi - lo < 1e-9) hi = lo + 1;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    var d = "", st = false;
    for (i = 0; i < vals.length; i++) {
      var v = vals[i]; if (v == null || !isFinite(v)) continue;
      var x = i / (vals.length - 1) * W, y = H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
      d += (st ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); st = true;
    }
    g.appendChild(sv("path", { d: d + " L" + W + " " + H + " L0 " + H + " Z", fill: opt.fill || "rgba(229,72,77,.18)", stroke: "none" }));
    g.appendChild(sv("path", { d: d, fill: "none", stroke: opt.color || "#e5484d", "stroke-width": 1.4 }));
    return g;
  }
  function candles(kl, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 320, PAD = 8;
    var from = opt.from || 0, to = opt.to || kl.length, n = to - from;
    var lo = Infinity, hi = -Infinity, i;
    for (i = from; i < to; i++) { if (kl[i].low < lo) lo = kl[i].low; if (kl[i].high > hi) hi = kl[i].high; }
    if (hi - lo < 1e-9) hi = lo + 1;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    function y(v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD); }
    var bw = W / n;
    for (i = from; i < to; i++) {
      var x = (i - from + 0.5) * bw, up = kl[i].close >= kl[i].open;
      g.appendChild(sv("line", { x1: x, y1: y(kl[i].high), x2: x, y2: y(kl[i].low), stroke: up ? "#e5484d" : "#2f9e6b", "stroke-width": 1 }));
      var top = y(Math.max(kl[i].open, kl[i].close)), bot = y(Math.min(kl[i].open, kl[i].close));
      g.appendChild(sv("rect", { x: x - bw * .32, y: top, width: Math.max(1, bw * .64), height: Math.max(1, bot - top), fill: up ? "#e5484d" : "#2f9e6b" }));
    }
    (opt.marks || []).forEach(function (mk) {
      if (mk.i < from || mk.i >= to) return;
      var mx = (mk.i - from + 0.5) * bw, my = mk.side === "buy" ? y(kl[mk.i].low) + 12 : y(kl[mk.i].high) - 12;
      g.appendChild(sv("path", { d: mk.side === "buy" ? ("M" + mx + " " + (my - 5) + " l5 8 l-10 0 z") : ("M" + mx + " " + (my + 5) + " l5 -8 l-10 0 z"), fill: mk.side === "buy" ? "#e5484d" : "#2f9e6b" }));
    });
    return g;
  }
  function bars(items, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 150, PAD = 6, n = items.length;
    var hi = Math.max.apply(null, items.map(function (x) { return x.v; })) || 1;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    var bw = W / n;
    items.forEach(function (it, i) {
      var hh = (it.v / hi) * (H - 2 * PAD);
      g.appendChild(sv("rect", { x: i * bw + bw * .12, y: H - PAD - hh, width: bw * .76, height: hh, fill: it.color || "#5ec9a8", "fill-opacity": ".6" }));
    });
    return g;
  }
  function heat(cells, opt) {
    /* cells: [{r,c,v}] — a monthly grid */
    opt = opt || {}; var cols = opt.cols || 12, rows = opt.rows || 5;
    var W = 680, H = opt.h || 170, cw = W / cols, ch = H / rows;
    var mx = 1; cells.forEach(function (x) { if (Math.abs(x.v) > mx) mx = Math.abs(x.v); });
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    cells.forEach(function (x) {
      var a = Math.min(1, Math.abs(x.v) / mx);
      var fill = x.v >= 0 ? "rgba(229,72,77," + (0.12 + 0.7 * a) + ")" : "rgba(47,158,107," + (0.12 + 0.7 * a) + ")";
      g.appendChild(sv("rect", { x: x.c * cw + 1, y: x.r * ch + 1, width: cw - 2, height: ch - 2, fill: fill, rx: 2 }));
    });
    return g;
  }

  /* --------------------------------------------------------------- pieces */
  function kpi(l, v, cls) { var d = el("div", "dk-kpi"); d.appendChild(el("div", "dk-k", l)); d.appendChild(el("div", "dk-v " + (cls || ""), v)); return d; }
  function cell(k, v, cls) { var d = el("div", "dk-cell"); d.appendChild(el("div", "dk-k", k)); d.appendChild(el("div", "dk-v " + (cls || ""), v)); return d; }
  function card(title, child) { var c = el("div", "dk-card"); if (title) c.appendChild(el("h4", "dk-h", title)); if (child) c.appendChild(child); return c; }
  function svgbox(g) { var d = el("div", "dk-svg"); d.appendChild(g); return d; }

  /* --------------------------------------------------------------- V12 */
  function renderV12(body) {
    var v = D.v12;
    if (!v) { body.appendChild(el("p", "dk-note", T("V12 result not shipped.", "V12 结果未随页提供。"))); return; }
    var k = el("div", "dk-kpis");
    k.appendChild(kpi("Sharpe", num(v.sharpe_ratio, 3), "acc"));
    k.appendChild(kpi(T("annual return", "年化收益"), pct(v.annual_return_pct, 2), "pos"));
    k.appendChild(kpi(T("max drawdown", "最大回撤"), pct(v.max_drawdown_pct, 2), "neg"));
    k.appendChild(kpi("Calmar", num(v.calmar_ratio, 3)));
    k.appendChild(kpi(T("win rate", "胜率"), pct(v.win_rate_pct, 1)));
    k.appendChild(kpi(T("total return", "总收益"), pct(v.total_return_pct, 2), "pos"));
    k.appendChild(kpi(T("annual vol", "年化波动"), pct(v.volatility_pct, 2)));
    k.appendChild(kpi(T("trades", "交易"), String(v.total_trades)));
    k.appendChild(kpi(T("avg hold", "平均持仓"), num(v.avg_holding_days, 1) + "d"));
    k.appendChild(kpi(T("turnover", "换手"), pct(v.annual_turnover, 1)));
    body.appendChild(k);

    body.appendChild(el("p", "dk-prov", "engine " + (v.engine || "v12_final") + " · " + v.backtest_start_date + " → " + v.backtest_end_date +
      " · " + v.universe_size + " stocks · " + v.num_factors + " factors · " + v.rebalance_freq + " · computed by the real backend, shipped as JSON"));

    body.appendChild(card(T("equity curve · V12", "权益曲线 · V12"), svgbox(line(v.equity_curve, { h: 200, color: "#5ec9a8" }))));
    body.appendChild(card(T("underwater · drawdown", "回撤曲线 · underwater"), svgbox(area(v.drawdown_curve, { h: 140 }))));

    /* monthly heatmap */
    var months = Object.keys(v.monthly_returns || {});
    if (months.length) {
      var years = {}; months.forEach(function (m) { years[m.slice(0, 4)] = true; });
      var ys = Object.keys(years).sort(), cells = [];
      months.forEach(function (m) {
        var y = m.slice(0, 4), mo = parseInt(m.slice(5, 7), 10) - 1;
        cells.push({ r: ys.indexOf(y), c: mo, v: Number(v.monthly_returns[m]) || 0 });
      });
      body.appendChild(card(T("monthly returns · red up / green down", "月度收益 · 红涨绿跌"), svgbox(heat(cells, { rows: ys.length, cols: 12, h: 40 + ys.length * 26 }))));
    }
    if (v.rolling_sharpe && v.rolling_sharpe.length) body.appendChild(card(T("rolling Sharpe", "滚动 Sharpe"), svgbox(line(v.rolling_sharpe, { h: 130, color: "#8fa6b8" }))));

    var g = el("div", "dk-grid2");
    /* factor importance */
    if (v.factor_importance && v.factor_importance.length) {
      var fi = v.factor_importance.map(function (f) { return { v: f.importance }; });
      var wrap = el("div");
      wrap.appendChild(svgbox(bars(fi, { h: 150 })));
      var list = el("div", "dk-list");
      v.factor_importance.slice(0, 10).forEach(function (f) {
        var row = el("div", "dk-row"); row.appendChild(el("span", null, f.label || f.name)); row.appendChild(el("b", null, num(f.importance, 3))); list.appendChild(row);
      });
      wrap.appendChild(list);
      g.appendChild(card(T("factor importance · top 10", "因子重要性 · 前 10"), wrap));
    }
    /* overfit */
    if (v.overfit_metrics) {
      var o = v.overfit_metrics, kv = el("div", "dk-cells");
      kv.appendChild(cell("PBO", num(o.pbo, 3)));
      kv.appendChild(cell("DSR", num(o.dsr, 3)));
      kv.appendChild(cell("MC p", num(o.mc_p_value, 3)));
      kv.appendChild(cell(T("WF mean Sharpe", "WF 平均 Sharpe"), num(o.wf_mean_sharpe, 3)));
      kv.appendChild(cell(T("baseline", "基线"), num(o.baseline_sharpe, 3)));
      kv.appendChild(cell(T("all pass", "全部通过"), o.all_pass ? "✓" : "—", o.all_pass ? "acc" : "neg"));
      g.appendChild(card(T("overfitting detectors", "过拟合检测"), kv));
    }
    body.appendChild(g);

    if (v.individual_strategies) {
      var names = Object.keys(v.individual_strategies);
      var t = el("table"); t.className = "dk-table";
      t.innerHTML = "<thead><tr><th>strategy</th><th>Sharpe</th><th>annual</th><th>maxDD</th><th>Calmar</th></tr></thead>";
      var tb = el("tbody");
      names.forEach(function (n) {
        var s = v.individual_strategies[n] || {};
        var tr = el("tr");
        [n, num(s.sharpe_ratio, 3), pct(s.annual_return_pct, 2), pct(s.max_drawdown_pct, 2), num(s.calmar_ratio, 2)].forEach(function (x) { tr.appendChild(el("td", null, String(x))); });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      body.appendChild(card(T("individual strategies", "单策略"), t));
    }
    if (v.top_combinations && v.top_combinations.length) {
      var t2 = el("table"); t2.className = "dk-table";
      t2.innerHTML = "<thead><tr><th>config</th><th>Sharpe</th><th>annual</th><th>maxDD</th><th>Calmar</th><th>Sortino</th></tr></thead>";
      var tb2 = el("tbody");
      v.top_combinations.forEach(function (c) {
        var tr = el("tr");
        [c.config, num(c.sharpe_ratio, 3), pct(c.annual_return_pct, 2), pct(c.max_drawdown_pct, 2), num(c.calmar_ratio, 2), num(c.sortino_ratio, 2)].forEach(function (x) { tr.appendChild(el("td", null, String(x))); });
        tb2.appendChild(tr);
      });
      t2.appendChild(tb2);
      body.appendChild(card(T("top combinations", "最优组合"), t2));
    }
    if (v.trades && v.trades.length) {
      var t3 = el("table"); t3.className = "dk-table";
      t3.innerHTML = "<thead><tr><th>#</th><th>entry</th><th>exit</th><th>side</th><th>pnl %</th><th>days</th></tr></thead>";
      var tb3 = el("tbody");
      v.trades.slice(0, 24).forEach(function (x) {
        var tr = el("tr");
        [x.trade_id, x.entry_date, x.exit_date, x.side, num(x.pnl_pct, 2), x.holding_days].forEach(function (y) { tr.appendChild(el("td", null, String(y))); });
        tb3.appendChild(tr);
      });
      t3.appendChild(tb3);
      body.appendChild(card(T("trades · first 24 of " + v.total_trades, "交易 · 前 24 / 共 " + v.total_trades), t3));
    }
    body.appendChild(el("p", "dk-note", T(
      "The V12 portfolio backtest is the real engine's cached output (engine v12_final), computed on the user's machine and shipped as JSON. It is a historical backtest on a declared universe, not a live signal, and not investment advice.",
      "V12 组合回测是真实引擎的缓存输出（engine v12_final），在用户机器上算完、以 JSON 随页提供。它是声明票池上的历史回测，不是实时信号，也不是投资建议。")));
  }

  /* ------------------------------------------------------------- symbol */
  function renderSymbol(body, pack, name, allowShort) {
    var a = pack.analysis, klRaw = pack.klines && pack.klines.klines, sg = pack.signals && pack.signals.signals;
    if (!a && !klRaw) { body.appendChild(el("p", "dk-note", T("no data for " + name, name + " 没有数据"))); return; }
    var kl = klRaw || [];
    var n = kl.length;

    var k = el("div", "dk-kpis");
    if (kl.length) {
      var last = kl[n - 1], prev = kl[n - 2], chg = prev ? last.close / prev.close - 1 : 0;
      k.appendChild(kpi(T("last", "最新"), "$" + num(last.close, 2), chg >= 0 ? "pos" : "neg"));
      k.appendChild(kpi(T("change", "涨跌"), (chg >= 0 ? "+" : "") + pct(chg * 100, 2), chg >= 0 ? "pos" : "neg"));
    }
    if (a && a.chanlun) k.appendChild(kpi(T("chanlun", "缠论"), a.chanlun.current_position || "—", "acc"));
    if (a && a.ising) k.appendChild(kpi(T("ising risk", "伊辛风险"), a.ising.phase_risk || "—"));
    if (a && a.mfdfa && a.mfdfa.result) k.appendChild(kpi("Hurst", num(a.mfdfa.result.hurst_index, 3)));
    if (a && a.lppls) k.appendChild(kpi("LPPLS p", num(a.lppls.bubble_probability, 3)));
    if (a && a.rmt) k.appendChild(kpi("RMT λmax", num(a.rmt.max_eigenvalue, 2)));
    body.appendChild(k);
    body.appendChild(el("p", "dk-prov", ((a && a.computed_by) ? ("computed_by: " + a.computed_by) : "") + " · " + name));

    /* candles + signals */
    if (kl.length) {
      var from = Math.max(0, n - 240);
      var byTs = {}; kl.forEach(function (x, i) { byTs[x.timestamp] = i; });
      var marks = (sg || []).map(function (s) {
        var i = byTs[s.timestamp];
        if (i == null) { var best = 0, bd = Infinity; kl.forEach(function (x, j) { var d = Math.abs(x.timestamp - s.timestamp); if (d < bd) { bd = d; best = j; } }); i = best; }
        return { i: i, side: /sell/i.test(s.type) ? "sell" : "buy" };
      }).filter(function (m) { return m.i >= from; });
      body.appendChild(card(T("candles · last 240 · ▲ buy ▼ sell", "K线 · 最近 240 · ▲ 买 ▼ 卖"), svgbox(candles(kl, { from: from, h: 340, marks: marks }))));
      var buys = marks.filter(function (m) { return m.side === "buy"; }).length;
      var kv = el("div", "dk-cells");
      kv.appendChild(cell(T("buy signals", "买点"), String(buys), "pos"));
      kv.appendChild(cell(T("sell signals", "卖点"), String(marks.length - buys), "neg"));
      var lastS = (sg || [])[sg.length - 1];
      if (lastS) kv.appendChild(cell(T("last signal", "最近信号"), (lastS.type || "") + " · " + (lastS.reason || ""), "acc"));
      body.appendChild(card(T("signals from /api/signals (rust)", "来自 /api/signals 的信号（Rust）"), kv));
    }

    if (a) {
      var g2 = el("div", "dk-grid2");
      /* chanlun */
      if (a.chanlun) {
        var c = a.chanlun, kv2 = el("div", "dk-cells");
        kv2.appendChild(cell(T("position", "位置"), c.current_position || "—", "acc"));
        kv2.appendChild(cell(T("fractals", "分型"), String((c.fractals || []).length)));
        kv2.appendChild(cell(T("strokes", "笔"), String((c.strokes || []).length)));
        kv2.appendChild(cell(T("segments", "段"), String((c.segments || []).length)));
        kv2.appendChild(cell(T("zhongshu", "中枢"), String((c.zhongshus || []).length)));
        kv2.appendChild(cell(T("signals", "信号"), String((c.signals || []).length)));
        g2.appendChild(card(T("chanlun (rust)", "缠论（Rust）"), kv2));
      }
      /* ising */
      if (a.ising) {
        var s = a.ising, kv3 = el("div", "dk-cells");
        [["buy_ratio", "buy"], ["sell_ratio", "sell"], ["magnetization", "M"], ["susceptibility", "χ"], ["coupling_j", "J"], ["critical_temperature", "Tc"], ["phase_risk", "risk"]].forEach(function (p) {
          if (s[p[0]] != null) kv3.appendChild(cell(p[1], String(s[p[0]]).slice(0, 14)));
        });
        g2.appendChild(card(T("ising three-state (rust)", "伊辛三态（Rust）"), kv3));
      }
      /* TDA */
      if (a.tda) {
        var t = a.tda, kv4 = el("div", "dk-cells");
        if (t.betti_numbers) ["beta_0", "beta_1", "beta_2", "euler_characteristic"].forEach(function (k2) { if (t.betti_numbers[k2] != null) kv4.appendChild(cell(k2, String(t.betti_numbers[k2]))); });
        if (t.max_persistence != null) kv4.appendChild(cell(T("max persistence", "最大持续"), num(t.max_persistence, 3)));
        if (t.confidence) kv4.appendChild(cell(T("confidence", "置信"), (t.confidence.level || "") + " " + num(t.confidence.score, 2)));
        g2.appendChild(card(T("persistent homology (rust)", "持久同调（Rust）"), kv4));
      }
      /* MFDFA */
      if (a.mfdfa && a.mfdfa.result) {
        var m = a.mfdfa.result, kv5 = el("div", "dk-cells");
        [["hurst_index", "Hurst"], ["efficiency", "efficiency"], ["multifractal_strength", "MF"], ["spectrum_width", "width"], ["spectrum_asymmetry", "asym"], ["r_squared", "R²"]].forEach(function (p) {
          if (m[p[0]] != null) kv5.appendChild(cell(p[1], num(m[p[0]], 3)));
        });
        var w5 = el("div"); w5.appendChild(kv5);
        if (m.hurst_spectrum && m.hurst_spectrum.length) w5.appendChild(svgbox(line(m.hurst_spectrum, { h: 100, color: "#8fa6b8" })));
        g2.appendChild(card(T("MF-DFA (rust)", "多重分形（Rust）"), w5));
      }
      /* LPPLS / RMT / gauge */
      var l = a.lppls || {}, r = a.rmt || {}, ga = a.gauge || {};
      var kv6 = el("div", "dk-cells");
      if (l.bubble_probability != null) kv6.appendChild(cell("bubble p", num(l.bubble_probability, 3)));
      if (l.critical_time_days != null) kv6.appendChild(cell("critical d", String(l.critical_time_days)));
      if (l.fit_quality != null) kv6.appendChild(cell("fit", num(l.fit_quality, 3)));
      if (r.max_eigenvalue != null) kv6.appendChild(cell("RMT λmax", num(r.max_eigenvalue, 2)));
      if (r.mp_upper_bound != null) kv6.appendChild(cell("MP edge", num(r.mp_upper_bound, 2)));
      if (ga.curvature != null) kv6.appendChild(cell("gauge κ", num(ga.curvature, 4)));
      g2.appendChild(card(T("LPPLS · RMT · gauge", "LPPLS · RMT · 规范场"), kv6));
      /* entropy */
      if (a.entropy) {
        var e = a.entropy, kv7 = el("div", "dk-cells");
        [["transfer_entropy_xy", "TE x→y"], ["transfer_entropy_yx", "TE y→x"], ["net_flow", "net"], ["p_value", "p"], ["is_significant", "sig"], ["causality_type", "type"]].forEach(function (p) {
          if (e[p[0]] != null) kv7.appendChild(cell(p[1], String(e[p[0]]).slice(0, 14)));
        });
        g2.appendChild(card(T("transfer entropy (rust)", "转移熵（Rust）"), kv7));
      }
      body.appendChild(g2);

      /* indicators */
      if (a.indicators) {
        var I = a.indicators, defs = [["RSI", ["RSI6", "RSI12", "RSI24"]], ["KDJ", ["K", "D", "J"]], ["MACD", ["DIF", "DEA", "MACD"]], ["BOLL", ["upper", "middle", "lower"]], ["CCI", ["CCI"]], ["WR", ["WR"]], ["DMI", ["PDI", "MDI", "ADX", "ADXR"]], ["ATR", ["ATR", "ATR_PERCENT"]], ["OBV", ["OBV"]]];
        var ig = el("div", "dk-grid3");
        defs.forEach(function (d) {
          var obj = I[d[0]]; if (!obj) return;
          var cc = el("div", "dk-card"); cc.appendChild(el("h4", "dk-h", d[0]));
          var kvv = el("div", "dk-cells");
          d[1].forEach(function (k2) { var v2 = obj[k2]; if (v2 && v2.length) kvv.appendChild(cell(k2, num(v2[v2.length - 1], k2 === "OBV" ? 0 : 2))); });
          cc.appendChild(kvv); ig.appendChild(cc);
        });
        body.appendChild(card(T("indicators · 14 families from /api/analysis", "指标 · /api/analysis 的 14 类"), ig));
      }
    }

    /* short mode for US */
    if (allowShort && kl.length && sg && sg.length) {
      var eq = longShort(kl, sg);
      var g3 = el("div", "dk-grid2");
      g3.appendChild(card(T("long/short equity from rust signals (client-side)", "按 Rust 信号的多空权益（前端计算）"), svgbox(line(eq.curve, { h: 160, color: "#5ec9a8" }))));
      var kv8 = el("div", "dk-cells");
      kv8.appendChild(cell("Sharpe", num(eq.sharpe, 3), "acc"));
      kv8.appendChild(cell(T("total return", "总收益"), pct(eq.total, 2), eq.total >= 0 ? "pos" : "neg"));
      kv8.appendChild(cell(T("max drawdown", "最大回撤"), pct(eq.maxDD, 2), "neg"));
      kv8.appendChild(cell(T("trades", "交易"), String(eq.trades)));
      g3.appendChild(card(T("short mode · US stocks can short", "做空模式 · 美股可做空"), kv8));
      body.appendChild(g3);
      body.appendChild(el("p", "dk-note", T(
        "Long on Buy signals, short on Sell signals, sized one unit; computed in this tab from the real signal list and the real bars. No costs. The backend's own backtest is long/flat; this panel is the short extension, labelled as such.",
        "买点做多、卖点做空，单倍仓位；在本页用真实信号与真实 K 线算。无成本。后端自己的回测是多/空仓；这块是做空扩展，如实标注。")));
    }
  }

  function longShort(kl, sig) {
    var byTs = {}; kl.forEach(function (k, i) { byTs[k.timestamp] = i; });
    var pos = 0, curve = [1], trades = 0, peak = 1, mdd = 0, rets = [];
    var events = {};
    sig.forEach(function (s) {
      var i = byTs[s.timestamp];
      if (i == null) { var best = 0, bd = Infinity; kl.forEach(function (k, j) { var d = Math.abs(k.timestamp - s.timestamp); if (d < bd) { bd = d; best = j; } }); i = best; }
      events[i] = /sell/i.test(s.type) ? -1 : 1;
    });
    for (var i = 1; i < kl.length; i++) {
      if (events[i] != null) { pos = events[i]; trades++; }
      var r = pos * (kl[i].close / kl[i - 1].close - 1);
      rets.push(r);
      var e = curve[curve.length - 1] * (1 + r); curve.push(e);
      if (e > peak) peak = e;
      mdd = Math.max(mdd, 1 - e / peak);
    }
    var mean = 0; for (var j = 0; j < rets.length; j++) mean += rets[j]; mean /= rets.length;
    var sd = 0; for (j = 0; j < rets.length; j++) { var d = rets[j] - mean; sd += d * d; } sd = Math.sqrt(sd / (rets.length - 1));
    return { curve: curve, sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, total: curve[curve.length - 1] - 1, maxDD: mdd, trades: trades };
  }

  /* --------------------------------------------------------------- mount */
  function mount(host) {
    if (!host || host.getAttribute("data-desk-mounted") === "1") return;
    host.setAttribute("data-desk-mounted", "1");
    host.appendChild(el("p", "dk-note", T("loading the terminal's output…", "正在载入终端输出…")));
    loadAll().then(function () {
      render(host);
    }).catch(function (e) {
      host.textContent = "";
      host.appendChild(el("p", "dk-note", T("the desk data could not be loaded: ", "桌面数据载入失败：") + String(e && e.message || e)));
    });
  }

  function render(host) {
    host.textContent = "";
    var TABS = [
      ["v12", T("V12 · portfolio", "V12 · 组合")],
      ["tsla", "TSLA"],
      ["moutai", "600519.SH"]
    ];
    var bar = el("div", "dk-tabs");
    var body = el("div", "dk-body");
    host.appendChild(bar); host.appendChild(body);
    var active = "v12";
    function show(id) {
      active = id;
      Array.prototype.forEach.call(bar.children, function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === id); });
      body.textContent = "";
      if (id === "v12") renderV12(body);
      else if (id === "tsla") renderSymbol(body, D.tsla, "TSLA", true);
      else renderSymbol(body, D.moutai, "600519.SH", false);
    }
    TABS.forEach(function (p) {
      var b = el("button", "dk-tab", p[1]); b.type = "button"; b.setAttribute("data-tab", p[0]);
      b.addEventListener("click", function () { show(p[0]); });
      bar.appendChild(b);
    });
    show("v12");
    window.addEventListener("hj:lang", function () { render(host); });
  }

  function autoMount() {
    var host = document.getElementById("desk-host");
    if (!host) return;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); mount(host); }
      }, { rootMargin: "700px" });
      io.observe(host);
    } else mount(host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();

  window.HJ_DESK = { version: "v1.0", mount: mount, data: function () { return D; } };
})();
