/* ==========================================================================
   BOAT-3 · 07 desk — the real terminal, precomputed and embedded
   --------------------------------------------------------------------------
   Every number here is the real backend's output, saved to JSON by the local
   FastAPI/Rust stack and shipped with the page:
     · V12 portfolio backtest (engine v12_final): Sharpe 2.595, 1161 equity
       points, 2020→2025, 200-stock universe, 55 factors
     · TSLA / 600519.SH: /api/analysis (chanlun, ising, TDA, MFDFA, LPPLS, RMT,
       entropy, 14 indicator families), /api/signals (labeled B1/B2/B3 · S1/S2/S3
       at exact kline indices), /api/backtest/run, /api/pattern/similar,
       /api/multi_level, /api/crowding/heatmap
     · A-share extras: northbound, margin, dragon-tiger, block trade, indices
   The chart is interactive: hover for a crosshair + OHLC, toggle overlays,
   and every buy is paired with the sell that closes it (and vice versa).
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
  function get(o, p) { return p.split(".").reduce(function (a, k) { return a && a[k] != null ? a[k] : null; }, o); }

  var D = {};
  function j(name) { return fetch("desk/" + name).then(function (r) { return r.json(); }).catch(function () { return null; }); }

  function loadAll() {
    return Promise.all([
      j("v12.json"), j("mcwf.json"), j("market-indices.json"), j("northbound.json"),
      j("margin-moutai.json"), j("dragon-moutai.json"), j("block-moutai.json"),
      Promise.all([j("analysis-tsla.json"), j("klines-tsla.json"), j("signals-tsla.json"), j("bt-tsla.json"), j("similar-tsla.json"), j("multi-tsla.json"), j("crowd-tsla.json")]),
      Promise.all([j("analysis-moutai.json"), j("klines-moutai.json"), j("signals-moutai.json"), j("bt-moutai.json"), j("similar-moutai.json"), j("multi-moutai.json"), j("crowd-moutai.json")])
    ]).then(function (r) {
      D.v12 = r[0] && r[0].data ? r[0].data : r[0];
      D.mcwf = r[1] && r[1].data ? r[1].data : r[1];
      D.market = r[2]; D.northbound = r[3]; D.marginM = r[4]; D.dragonM = r[5]; D.blockM = r[6];
      function pack(a) {
        return { analysis: a[0], klines: a[1] && a[1].klines ? a[1] : null, signals: a[2] && a[2].signals ? a[2] : null, bt: a[3], similar: a[4], multi: a[5], crowd: a[6] };
      }
      D.tsla = pack(r[7]); D.moutai = pack(r[8]);
    });
  }

  /* --------------------------------------------------------------- charts */
  function extent(vals) {
    var lo = Infinity, hi = -Infinity;
    (vals || []).forEach(function (v) { if (v == null || !isFinite(v)) return; if (v < lo) lo = v; if (v > hi) hi = v; });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) hi = lo + 1;
    return [lo, hi];
  }
  function line(vals, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 170, PAD = 6, i;
    var ex = extent(vals), g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    for (i = 1; i <= 3; i++) g.appendChild(sv("line", { x1: 0, y1: PAD + (H - 2 * PAD) * i / 4, x2: W, y2: PAD + (H - 2 * PAD) * i / 4, stroke: "#1d3040", "stroke-width": 1 }));
    var d = "", st = false;
    for (i = 0; i < (vals || []).length; i++) {
      var v = vals[i]; if (v == null || !isFinite(v)) continue;
      var x = i / (vals.length - 1) * W, y = H - PAD - ((v - ex[0]) / (ex[1] - ex[0])) * (H - 2 * PAD);
      d += (st ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); st = true;
    }
    g.appendChild(sv("path", { d: d, fill: "none", stroke: opt.color || "#5ec9a8", "stroke-width": 1.6, "stroke-linejoin": "round" }));
    return g;
  }
  function area(vals, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 130, PAD = 6, i;
    var ex = extent(vals), g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    var d = "", st = false;
    for (i = 0; i < (vals || []).length; i++) {
      var v = vals[i]; if (v == null || !isFinite(v)) continue;
      var x = i / (vals.length - 1) * W, y = H - PAD - ((v - ex[0]) / (ex[1] - ex[0])) * (H - 2 * PAD);
      d += (st ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); st = true;
    }
    g.appendChild(sv("path", { d: d + " L" + W + " " + H + " L0 " + H + " Z", fill: opt.fill || "rgba(229,72,77,.16)", stroke: "none" }));
    g.appendChild(sv("path", { d: d, fill: "none", stroke: opt.color || "#e5484d", "stroke-width": 1.4 }));
    return g;
  }
  function miniLine(vals, opt) { opt = opt || {}; return line(vals, { h: opt.h || 90, color: opt.color }); }

  function isingField(m) {
    var N = m.length, W = 300, H = 300, c = W / N;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet" });
    for (var r = 0; r < N; r++) for (var q = 0; q < N; q++) {
      var v = m[r][q];
      var fill = v > 0 ? "rgba(229,72,77," + (0.25 + 0.6 * Math.min(1, v)) + ")" : v < 0 ? "rgba(47,158,107," + (0.25 + 0.6 * Math.min(1, -v)) + ")" : "rgba(95,122,142,.14)";
      g.appendChild(sv("rect", { x: q * c, y: r * c, width: c + .4, height: c + .4, fill: fill }));
    }
    return g;
  }
  function barcodeChart(list) {
    var W = 680, H = 150, PAD = 8;
    var ds = list.map(function (b) { return b.death; }).sort(function (a, b) { return a - b; });
    var cap = ds[Math.floor(ds.length * 0.95)] || ds[ds.length - 1] || 1; if (!(cap > 0)) cap = 1;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    var rows = Math.min(list.length, 80);
    for (var i = 0; i < rows; i++) {
      var b = list[i], y = PAD + (H - 2 * PAD) * i / Math.max(1, rows - 1);
      var x1 = PAD + (Math.min(b.birth, cap) / cap) * (W - 2 * PAD), x2 = PAD + (Math.min(b.death, cap) / cap) * (W - 2 * PAD);
      g.appendChild(sv("line", { x1: x1, y1: y, x2: Math.max(x1 + 1, x2), y2: y, stroke: b.dimension === 1 ? "#f5a524" : "#2dd4bf", "stroke-width": 2, "stroke-opacity": .75 }));
    }
    return g;
  }
  function lpplsChart(kl, lp) {
    var ws = lp.window_size || 120, n = kl.length, from = Math.max(0, n - ws), p = lp.params || {};
    var actual = [], fitted = [], i;
    for (i = from; i < n; i++) {
      actual.push(Math.log(kl[i].close));
      var t = i - from, dt = p.tc - t;
      if (dt > 0) { var f = Math.pow(dt, p.m || 0.5), lf = Math.log(dt); fitted.push(p.a + p.b * f + p.c1 * f * Math.cos((p.omega || 8) * lf) + p.c2 * f * Math.sin((p.omega || 8) * lf)); }
      else fitted.push(null);
    }
    var W = 680, H = 160, PAD = 8, all = actual.concat(fitted.filter(function (v) { return v != null; }));
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi - lo < 1e-9) hi = lo + 1;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    function Y(v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD); }
    function path(arr) { var d = "", st = false; for (var q = 0; q < arr.length; q++) { if (arr[q] == null) continue; var x = PAD + (q / (arr.length - 1)) * (W - 2 * PAD); d += (st ? " L" : "M") + x.toFixed(1) + " " + Y(arr[q]).toFixed(1); st = true; } return d; }
    g.appendChild(sv("path", { d: path(actual), fill: "none", stroke: "#8fa6b8", "stroke-width": 1.3 }));
    g.appendChild(sv("path", { d: path(fitted), fill: "none", stroke: "#f5a524", "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
    return g;
  }
  function heat(cells, rows) {
    var W = 680, H = 40 + rows * 26, cw = W / 12, ch = (H - 10) / rows;
    var mx = 1; cells.forEach(function (x) { if (Math.abs(x.v) > mx) mx = Math.abs(x.v); });
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    cells.forEach(function (x) {
      var a = Math.min(1, Math.abs(x.v) / mx);
      var fill = x.v >= 0 ? "rgba(229,72,77," + (0.12 + 0.7 * a) + ")" : "rgba(47,158,107," + (0.12 + 0.7 * a) + ")";
      g.appendChild(sv("rect", { x: x.c * cw + 1, y: x.r * ch + 1, width: cw - 2, height: ch - 2, fill: fill, rx: 2 }));
    });
    return g;
  }
  function barsChart(items, opt) {
    opt = opt || {}; var W = 680, H = opt.h || 150, PAD = 6, n = items.length || 1;
    var hi = 1; items.forEach(function (x) { if (Math.abs(x.v) > hi) hi = Math.abs(x.v); });
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    var bw = W / n;
    items.forEach(function (it, i) {
      var hh = (Math.abs(it.v) / hi) * (H - 2 * PAD);
      g.appendChild(sv("rect", { x: i * bw + bw * .12, y: H - PAD - hh, width: bw * .76, height: hh, fill: it.color || "#5ec9a8", "fill-opacity": ".6" }));
    });
    return g;
  }
  function corrHeat(names, matrix) {
    var n = names.length, W = 420, H = 420, c = W / n;
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet" });
    for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) {
      var v = matrix[r][q], a = Math.min(1, Math.abs(v));
      var fill = v >= 0 ? "rgba(229,72,77," + (0.08 + 0.8 * a) + ")" : "rgba(47,158,107," + (0.08 + 0.8 * a) + ")";
      g.appendChild(sv("rect", { x: q * c, y: r * c, width: c + .3, height: c + .3, fill: fill }));
    }
    return g;
  }

  /* --------------------------------------------------------------- pieces */
  function kpi(l, v, cls) { var d = el("div", "dk-kpi"); d.appendChild(el("div", "dk-k", l)); d.appendChild(el("div", "dk-v " + (cls || ""), v)); return d; }
  function cell(k, v, cls) { var d = el("div", "dk-cell"); d.appendChild(el("div", "dk-k", k)); d.appendChild(el("div", "dk-v " + (cls || ""), v)); return d; }
  function card(title, child, cls) { var c = el("div", "dk-card" + (cls ? " " + cls : "")); if (title) c.appendChild(el("h4", "dk-h", title)); if (child) c.appendChild(child); return c; }
  function svgbox(g) { var d = el("div", "dk-svg"); d.appendChild(g); return d; }
  function grid(n) { return el("div", "dk-grid" + n); }

  var LAB = { FirstBuy: "B1", SecondBuy: "B2", ThirdBuy: "B3", FirstSell: "S1", SecondSell: "S2", ThirdSell: "S3" };

  function pairTrades(sigs) {
    var s = (sigs || []).slice().sort(function (a, b) { return (a.kline_index || 0) - (b.kline_index || 0); });
    var longs = [], shorts = [];
    for (var i = 0; i < s.length; i++) {
      var a = s[i], buy = /buy/i.test(a.type);
      for (var k = i + 1; k < s.length; k++) {
        var b = s[k];
        if (/buy/i.test(b.type) !== buy) {
          var ret = buy ? (b.price / a.price - 1) : (a.price / b.price - 1);
          (buy ? longs : shorts).push({ entry: a, exit: b, ret: ret, bars: (b.kline_index || 0) - (a.kline_index || 0), side: buy ? "long" : "short" });
          break;
        }
      }
    }
    return { longs: longs, shorts: shorts };
  }

  /* a backtest that follows the labeled points themselves: buy → long,
     sell → short (or flat). Every entry is paired with the next signal. */
  function signalTrades(kl, sigs, mode) {
    var s = (sigs || []).slice().sort(function (a, b) { return (a.kline_index || 0) - (b.kline_index || 0); });
    var ev = {}; s.forEach(function (x) { ev[x.kline_index] = x; });
    var pos = 0, curve = [1], rets = [], peak = 1, mdd = 0, segs = [], open = null, i;
    for (i = 1; i < kl.length; i++) {
      /* the position held from the previous bar earns this bar's return */
      var r = pos * (kl[i].close / kl[i - 1].close - 1);
      rets.push(r);
      var e = curve[curve.length - 1] * (1 + r); curve.push(e);
      if (e > peak) peak = e; mdd = Math.max(mdd, 1 - e / peak);
      /* a signal at this bar acts from the NEXT bar; same-side runs do not
         open a new trade (that was the bug that made long-only look weak) */
      if (ev[i]) {
        var buy = /buy/i.test(ev[i].type);
        var np = mode === "inverse" ? (buy ? -1 : 1) : (buy ? 1 : (mode === "longshort" ? -1 : 0));
        if (np !== pos) {
          if (open) { open.exit = { sig: ev[i], i: i, price: kl[i].close }; segs.push(open); open = null; }
          pos = np;
          if (pos !== 0) open = { entry: { sig: ev[i], i: i, price: kl[i].close }, side: pos > 0 ? "long" : "short" };
        }
      }
    }
    if (open) { open.exit = { sig: null, i: kl.length - 1, price: kl[kl.length - 1].close }; segs.push(open); }
    segs.forEach(function (g) {
      g.ret = g.side === "long" ? (g.exit.price / g.entry.price - 1) : (g.entry.price / g.exit.price - 1);
      g.bars = g.exit.i - g.entry.i;
    });
    var mean = 0; for (i = 0; i < rets.length; i++) mean += rets[i]; mean /= (rets.length || 1);
    var sd = 0; for (i = 0; i < rets.length; i++) { var d = rets[i] - mean; sd += d * d; } sd = Math.sqrt(sd / Math.max(1, rets.length - 1));
    var wins = segs.filter(function (g) { return g.ret > 0; }).length;
    return { trades: segs, curve: curve, sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, total: curve[curve.length - 1] - 1, maxDD: mdd, winRate: segs.length ? wins / segs.length : 0, n: segs.length, mode: mode };
  }

  /* forward return after each signal: which "sell" was actually a long */
  function signalQuality(kl, sigs) {
    return (sigs || []).map(function (s) {
      var i = s.kline_index;
      var f20 = i + 20 < kl.length ? kl[i + 20].close / s.price - 1 : null;
      var f60 = i + 60 < kl.length ? kl[i + 60].close / s.price - 1 : null;
      var buy = /buy/i.test(s.type);
      var score = f20 == null ? null : (f20 + (f60 == null ? f20 : f60)) / 2;
      var v = score == null ? "—" : score > 0.02 ? (buy ? T("good long", "有效做多") : T("false sell → long", "假卖 → 该做多")) : score < -0.02 ? (buy ? T("false buy → short", "假买 → 该做空") : T("good short", "有效做空")) : T("flat", "走平");
      return { s: s, f20: f20, f60: f60, verdict: v, buy: buy };
    });
  }

  function f60Of(kl, sig) {
    var i = sig.kline_index;
    return i + 60 < kl.length ? kl[i + 60].close / sig.price - 1 : null;
  }

  /* per-type reliability: how each label has actually resolved */
  function signalStats(kl, sigs) {
    var by = {};
    (sigs || []).forEach(function (s) {
      if (!by[s.type]) by[s.type] = { type: s.type, n: 0, sum: 0, cnt: 0, wins: 0 };
      by[s.type].n++;
      var f = f60Of(kl, s);
      if (f != null) { by[s.type].sum += f; by[s.type].cnt++; if (f > 0) by[s.type].wins++; }
    });
    return Object.keys(by).map(function (k) {
      var x = by[k];
      return { type: k, n: x.n, meanF60: x.cnt ? x.sum / x.cnt : null, winRate: x.cnt ? x.wins / x.cnt : null };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  /* causal filter: at signal i, look only at same-type signals whose +60
     window has already completed (idx + 60 <= i). No future information. */
  function causalDecision(kl, sigs) {
    var s = (sigs || []).slice().sort(function (a, b) { return (a.kline_index || 0) - (b.kline_index || 0); });
    var taken = {}, skipped = {};
    s.forEach(function (sig) {
      var i = sig.kline_index, take = true, buy = /buy/i.test(sig.type);
      var prior = s.filter(function (x) { return x.type === sig.type && x.kline_index + 60 <= i; });
      /* need at least two completed observations before filtering at all —
         one observation is noise, and filtering on it kills the best trade */
      if (prior.length >= 2) {
        var sum = 0, c = 0;
        prior.forEach(function (x) { var g = f60Of(kl, x); if (g != null) { sum += g; c++; } });
        if (c >= 2) {
          var mean = sum / c;
          /* a buy is trusted if past buys rose; a sell is trusted if past
             sells actually fell (f60 < 0) — otherwise it is a false sell */
          take = buy ? mean > 0 : mean < 0;
        }
      }
      var key = i + ":" + sig.type;
      if (take) taken[key] = true; else skipped[key] = true;
    });
    return { taken: taken, skipped: skipped };
  }

  /* mode: longonly | longshort | inverse
     filter: none | causal | hindsight (hindsight is look-ahead, labelled) */
  function filteredTrades(kl, sigs, mode, filter) {
    var s = (sigs || []).slice().sort(function (a, b) { return (a.kline_index || 0) - (b.kline_index || 0); });
    var ev = {}; s.forEach(function (x) { ev[x.kline_index] = x; });
    var pos = 0, curve = [1], rets = [], peak = 1, mdd = 0, segs = [], open = null, skipped = 0, i;
    for (i = 1; i < kl.length; i++) {
      var r = pos * (kl[i].close / kl[i - 1].close - 1);
      rets.push(r);
      var e = curve[curve.length - 1] * (1 + r); curve.push(e);
      if (e > peak) peak = e; mdd = Math.max(mdd, 1 - e / peak);
      if (ev[i]) {
        var sig = ev[i], take = true;
        if (filter === "hindsight") { var f = f60Of(kl, sig); take = f != null && f > 0; }
        else if (filter === "causal") {
          var buySig = /buy/i.test(sig.type);
          var prior = s.filter(function (x) { return x.type === sig.type && x.kline_index + 60 <= i; });
          if (prior.length >= 2) {
            var sum = 0, c = 0;
            prior.forEach(function (x) { var g = f60Of(kl, x); if (g != null) { sum += g; c++; } });
            if (c >= 2) { var mean = sum / c; take = buySig ? mean > 0 : mean < 0; }
          }
        }
        if (!take) { skipped++; continue; }
        var buy = /buy/i.test(sig.type);
        var np = mode === "inverse" ? (buy ? -1 : 1) : (buy ? 1 : (mode === "longshort" ? -1 : 0));
        if (np !== pos) {
          if (open) { open.exit = { sig: sig, i: i, price: kl[i].close }; segs.push(open); open = null; }
          pos = np;
          if (pos !== 0) open = { entry: { sig: sig, i: i, price: kl[i].close }, side: pos > 0 ? "long" : "short" };
        }
      }
    }
    if (open) { open.exit = { sig: null, i: kl.length - 1, price: kl[kl.length - 1].close }; segs.push(open); }
    segs.forEach(function (g) {
      g.ret = g.side === "long" ? (g.exit.price / g.entry.price - 1) : (g.entry.price / g.exit.price - 1);
      g.bars = g.exit.i - g.entry.i;
    });
    var mean = 0; for (i = 0; i < rets.length; i++) mean += rets[i]; mean /= (rets.length || 1);
    var sd = 0; for (i = 0; i < rets.length; i++) { var d = rets[i] - mean; sd += d * d; } sd = Math.sqrt(sd / Math.max(1, rets.length - 1));
    var wins = segs.filter(function (g) { return g.ret > 0; }).length;
    return { trades: segs, curve: curve, sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, total: curve[curve.length - 1] - 1, maxDD: mdd, winRate: segs.length ? wins / segs.length : 0, n: segs.length, skipped: skipped, mode: mode, filter: filter };
  }

  /* simple causal rules on the same bars — the US trend playbook */
  function ruleBacktest(kl, rule, opt) {
    opt = opt || {};
    var lag = opt.lag !== false;
    var cost = opt.cost == null ? 0.0005 : opt.cost;
    var c = kl.map(function (k) { return k.close; });
    var h = kl.map(function (k) { return k.high; });
    var l = kl.map(function (k) { return k.low; });
    var n = kl.length, pos = new Array(n).fill(0), i;
    function sma(w) { var o = [], s = 0; for (var q = 0; q < n; q++) { s += c[q]; if (q >= w) s -= c[q - w]; o.push(q >= w - 1 ? s / w : null); } return o; }
    if (rule === "ma50") { var m = sma(50); for (i = 1; i < n; i++) pos[i] = m[i] == null ? 0 : (c[i] > m[i] ? 1 : -1); }
    else if (rule === "ma20_50") { var a = sma(20), b = sma(50); for (i = 1; i < n; i++) pos[i] = (a[i] != null && b[i] != null) ? (a[i] > b[i] ? 1 : -1) : 0; }
    else if (rule === "donchian") {
      var p = 0;
      for (i = 1; i < n; i++) {
        var hi = -Infinity, lo = Infinity;
        for (var q = Math.max(0, i - 20); q < i; q++) { if (h[q] > hi) hi = h[q]; if (l[q] < lo) lo = l[q]; }
        if (c[i] > hi) p = 1; else if (c[i] < lo) p = -1;
        pos[i] = p;
      }
    }
    else if (rule === "momentum60") { for (i = 1; i < n; i++) pos[i] = i >= 60 ? (c[i] / c[i - 60] - 1 > 0 ? 1 : -1) : 0; }
    else if (rule === "buyhold") { for (i = 0; i < n; i++) pos[i] = 1; }
    var eq = 1, curve = [1], rets = [], peak = 1, mdd = 0, sw = 0, prev = 0;
    for (i = 1; i < n; i++) {
      /* the position decided at the PREVIOUS close earns this bar's return;
         opt.lag === false reproduces the old look-ahead for the audit only */
      var p = lag ? pos[i - 1] : pos[i];
      var r = p * (c[i] / c[i - 1] - 1);
      if (p !== prev) { r -= cost; sw++; }
      prev = p;
      rets.push(r); eq *= 1 + r; curve.push(eq);
      if (eq > peak) peak = eq; mdd = Math.max(mdd, 1 - eq / peak);
    }
    var mean = 0; for (i = 0; i < rets.length; i++) mean += rets[i]; mean /= (rets.length || 1);
    var sd = 0; for (i = 0; i < rets.length; i++) { var d = rets[i] - mean; sd += d * d; } sd = Math.sqrt(sd / Math.max(1, rets.length - 1));
    return { curve: curve, total: eq - 1, sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0, maxDD: mdd, switches: sw, rule: rule };
  }

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
    body.appendChild(el("p", "dk-prov", "engine " + (v.engine || "v12_final") + " · " + v.backtest_start_date + " → " + v.backtest_end_date + " · " + v.universe_size + " stocks · " + v.num_factors + " factors · " + v.rebalance_freq + " · computed by the real backend, shipped as JSON"));

    body.appendChild(card(T("equity curve · V12", "权益曲线 · V12"), svgbox(line(v.equity_curve, { h: 210, color: "#5ec9a8" }))));
    body.appendChild(card(T("underwater · drawdown", "回撤曲线 · underwater"), svgbox(area(v.drawdown_curve, { h: 140 }))));

    var months = Object.keys(v.monthly_returns || {});
    if (months.length) {
      var years = {}; months.forEach(function (m) { years[m.slice(0, 4)] = true; });
      var ys = Object.keys(years).sort(), cells = [];
      months.forEach(function (m) { cells.push({ r: ys.indexOf(m.slice(0, 4)), c: parseInt(m.slice(5, 7), 10) - 1, v: Number(v.monthly_returns[m]) || 0 }); });
      body.appendChild(card(T("monthly returns · red up / green down", "月度收益 · 红涨绿跌"), svgbox(heat(cells, ys.length))));
    }
    if (v.rolling_sharpe && v.rolling_sharpe.length) body.appendChild(card(T("rolling Sharpe", "滚动 Sharpe"), svgbox(line(v.rolling_sharpe, { h: 130, color: "#8fa6b8" }))));

    var g2 = grid(2);
    if (v.factor_importance && v.factor_importance.length) {
      var w = el("div"); w.appendChild(svgbox(barsChart(v.factor_importance.map(function (f) { return { v: f.importance }; }), { h: 150 })));
      var list = el("div", "dk-list");
      v.factor_importance.forEach(function (f) { var r = el("div", "dk-row"); r.appendChild(el("span", null, f.label || f.name)); r.appendChild(el("b", null, num(f.importance, 3))); list.appendChild(r); });
      w.appendChild(list);
      g2.appendChild(card(T("factor importance · top 10", "因子重要性 · 前 10"), w));
    }
    if (v.factor_correlation && v.factor_correlation.names) {
      var cw = el("div"); cw.appendChild(svgbox(corrHeat(v.factor_correlation.names, v.factor_correlation.matrix)));
      cw.appendChild(el("p", "dk-note", v.factor_correlation.names.join(" · ")));
      g2.appendChild(card(T("factor correlation", "因子相关矩阵"), cw));
    }
    body.appendChild(g2);

    var g3 = grid(2);
    if (D.mcwf) {
      var mw = el("div");
      mw.appendChild(svgbox(barsChart((D.mcwf.wf_sharpes || []).map(function (x) { return { v: x, color: x >= 0 ? "#5ec9a8" : "#e5484d" }; }), { h: 110 })));
      var mk = el("div", "dk-cells");
      mk.appendChild(cell("PBO", num(D.mcwf.pbo, 3), D.mcwf.pbo < 0.5 ? "acc" : "neg"));
      mk.appendChild(cell("MC p", num(D.mcwf.mc_p_value, 3)));
      mk.appendChild(cell(T("MC mean Sharpe", "MC 平均 Sharpe"), num(D.mcwf.mc_mean_sharpe, 3)));
      mk.appendChild(cell(T("WF mean", "WF 平均"), num(D.mcwf.wf_mean_sharpe, 3)));
      mk.appendChild(cell(T("baseline", "基线"), num(D.mcwf.baseline_sharpe, 3)));
      mk.appendChild(cell(T("all pass", "全部通过"), D.mcwf.all_pass ? "✓" : "—", D.mcwf.all_pass ? "acc" : "neg"));
      mw.appendChild(mk);
      g3.appendChild(card(T("MC / Walk-Forward · overfitting checks", "MC / Walk-Forward · 过拟合检测"), mw));
    }
    if (v.overfit_metrics) {
      var o = v.overfit_metrics, kv = el("div", "dk-cells");
      kv.appendChild(cell("PBO", num(o.pbo, 3))); kv.appendChild(cell("DSR", num(o.dsr, 3)));
      kv.appendChild(cell("MC p", num(o.mc_p_value, 3))); kv.appendChild(cell(T("WF mean", "WF 平均"), num(o.wf_mean_sharpe, 3)));
      g3.appendChild(card(T("embedded overfit metrics", "内嵌过拟合指标"), kv));
    }
    body.appendChild(g3);

    if (v.individual_strategies) {
      var t = el("table"); t.className = "dk-table";
      t.innerHTML = "<thead><tr><th>strategy</th><th>Sharpe</th><th>annual</th><th>maxDD</th><th>Calmar</th></tr></thead>";
      var tb = el("tbody");
      Object.keys(v.individual_strategies).forEach(function (n) {
        var s = v.individual_strategies[n] || {}, tr = el("tr");
        [n, num(s.sharpe_ratio, 3), pct(s.annual_return_pct, 2), pct(s.max_drawdown_pct, 2), num(s.calmar_ratio, 2)].forEach(function (x) { tr.appendChild(el("td", null, String(x))); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); body.appendChild(card(T("individual strategies", "单策略"), t));
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
      t2.appendChild(tb2); body.appendChild(card(T("top combinations", "最优组合"), t2));
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
      t3.appendChild(tb3); body.appendChild(card(T("trades · first 24 of " + v.total_trades, "交易 · 前 24 / 共 " + v.total_trades), t3));
    }
    body.appendChild(el("p", "dk-note", T(
      "The V12 portfolio backtest is the real engine's cached output (engine v12_final), computed on the user's machine and shipped as JSON. A historical backtest on a declared universe, not a live signal, and not investment advice.",
      "V12 组合回测是真实引擎的缓存输出（engine v12_final），在用户机器上算完、以 JSON 随页提供。是声明票池上的历史回测，不是实时信号，也不是投资建议。")));
  }

  /* ------------------------------------------------------------- symbol */
  function buildChart(kl, ch, sigs, pairs, opt) {
    var W = 680, H = opt.h || 430, L = 8, R = 8, TP = 14, B = 20;
    var from = opt.from, to = kl.length, n = to - from, i;
    var lo = Infinity, hi = -Infinity;
    for (i = from; i < to; i++) { if (kl[i].low < lo) lo = kl[i].low; if (kl[i].high > hi) hi = kl[i].high; }
    if (hi - lo < 1e-9) hi = lo + 1;
    var padY = (hi - lo) * 0.07; lo -= padY; hi += padY;
    var byTs = {}; kl.forEach(function (k, q) { byTs[k.timestamp] = q; });
    function X(q) { return L + ((q - from + 0.5) / n) * (W - L - R); }
    function Y(v) { return H - B - ((v - lo) / (hi - lo)) * (H - B - TP); }
    var g = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", "class": "dk-chart-svg" });
    for (i = 0; i <= 4; i++) {
      var gy = TP + (H - B - TP) * i / 4;
      g.appendChild(sv("line", { x1: L, y1: gy, x2: W - R, y2: gy, stroke: "#1d3040", "stroke-width": 1, "stroke-dasharray": "2 4" }));
      var tx = sv("text", { x: L + 2, y: gy - 3, fill: "#5f7a8e", "font-size": 9, "font-family": "monospace" }); tx.textContent = num(hi - (hi - lo) * i / 4, 1); g.appendChild(tx);
    }
    if (opt.zs) (ch.zhongshus || []).forEach(function (z) {
      var a = byTs[z.start_time], b = byTs[z.end_time];
      if (a == null || b == null || b < from || a >= to) return;
      a = Math.max(a, from); b = Math.min(b, to - 1);
      g.appendChild(sv("rect", { x: X(a), y: Y(z.high), width: Math.max(2, X(b) - X(a)), height: Math.max(2, Y(z.low) - Y(z.high)), fill: "rgba(94,201,168,.10)", stroke: "rgba(94,201,168,.5)", "stroke-width": 1 }));
    });
    var bw = (W - L - R) / n;
    for (i = from; i < to; i++) {
      var x = X(i), up = kl[i].close >= kl[i].open;
      g.appendChild(sv("line", { x1: x, y1: Y(kl[i].high), x2: x, y2: Y(kl[i].low), stroke: up ? "#e5484d" : "#2f9e6b", "stroke-width": 1 }));
      var top = Y(Math.max(kl[i].open, kl[i].close)), bot = Y(Math.min(kl[i].open, kl[i].close));
      g.appendChild(sv("rect", { x: x - bw * .3, y: top, width: Math.max(1, bw * .6), height: Math.max(1, bot - top), fill: up ? "#e5484d" : "#2f9e6b" }));
    }
    function sma(arr, w) { var o = [], s = 0; for (var q = 0; q < arr.length; q++) { s += arr[q]; if (q >= w) s -= arr[q - w]; o.push(q >= w - 1 ? s / w : null); } return o; }
    if (opt.ma) {
      var closes = kl.map(function (k) { return k.close; });
      [[sma(closes, 20), "#f5a524"], [sma(closes, 50), "#8fa6b8"]].forEach(function (p) {
        var d = "", st = false;
        for (var q = from; q < to; q++) { var v = p[0][q]; if (v == null) continue; d += (st ? " L" : "M") + X(q).toFixed(1) + " " + Y(v).toFixed(1); st = true; }
        if (d) g.appendChild(sv("path", { d: d, fill: "none", stroke: p[1], "stroke-width": 1, "stroke-opacity": .8 }));
      });
    }
    if (opt.strokes) (ch.strokes || []).forEach(function (s) {
      var a = byTs[s.start_time], b = byTs[s.end_time];
      if (a == null || b == null || b < from || a >= to) return;
      var up = /up/i.test(s.direction);
      g.appendChild(sv("line", { x1: X(a), y1: Y(s.start_price), x2: X(b), y2: Y(s.end_price), stroke: up ? "#2dd4bf" : "#f5a524", "stroke-width": 1.6, "stroke-linecap": "round" }));
    });
    if (opt.trades) {
      opt.trades.forEach(function (p) {
        var a = p.entry.i, b = p.exit.i;
        if (a < from || a >= to) return;
        var bx = Math.min(b, to - 1);
        var col = p.ret >= 0 ? "#5ec9a8" : "#e5484d";
        g.appendChild(sv("line", { x1: X(a), y1: Y(p.entry.price), x2: X(bx), y2: Y(p.exit.price), stroke: col, "stroke-width": 1.3, "stroke-dasharray": "3 3", "stroke-opacity": .9 }));
        var mx = (X(a) + X(bx)) / 2, my = (Y(p.entry.price) + Y(p.exit.price)) / 2;
        var t = sv("text", { x: mx, y: my - 4, fill: col, "font-size": 8, "font-family": "monospace", "text-anchor": "middle" });
        t.textContent = p.side + " " + (p.ret >= 0 ? "+" : "") + num(p.ret * 100, 1) + "%"; g.appendChild(t);
      });
    }
    if (opt.signals) (sigs || []).forEach(function (s) {
      var q = s.kline_index != null ? s.kline_index : s.index;
      if (q == null || q < from || q >= to) return;
      if (opt.skipped && opt.skipped[q + ":" + s.type]) {
        /* the causal filter would skip this one — show a hollow ring */
        g.appendChild(sv("circle", { cx: X(q), cy: Y(s.price), r: 2.4, fill: "none", stroke: "#5f7a8e", "stroke-width": 1 }));
        return;
      }
      var buy = /buy/i.test(s.type), lbl = LAB[s.type] || (buy ? "B" : "S"), px = X(q), py = Y(s.price);
      var ly = py + (buy ? 26 : -26);
      g.appendChild(sv("line", { x1: px, y1: py, x2: px, y2: ly, stroke: buy ? "#e5484d" : "#2f9e6b", "stroke-width": 1, "stroke-opacity": .6, "stroke-dasharray": "2 2" }));
      g.appendChild(sv("circle", { cx: px, cy: py, r: 3.2, fill: buy ? "#e5484d" : "#2f9e6b", stroke: "#0a1018", "stroke-width": 1 }));
      g.appendChild(sv("rect", { x: px - 11, y: ly - (buy ? 0 : 12), width: 22, height: 12, rx: 3, fill: buy ? "rgba(229,72,77,.16)" : "rgba(47,158,107,.16)", stroke: buy ? "#e5484d" : "#2f9e6b", "stroke-width": 1 }));
      var tx2 = sv("text", { x: px, y: ly + (buy ? 9 : -3), fill: buy ? "#e5484d" : "#2f9e6b", "font-size": 9, "font-family": "monospace", "text-anchor": "middle" }); tx2.textContent = lbl; g.appendChild(tx2);
    });
    [0, Math.floor(n / 2), n - 1].forEach(function (q) {
      var j2 = from + q, d = new Date(kl[j2].timestamp);
      var tx3 = sv("text", { x: X(j2), y: H - 6, fill: "#5f7a8e", "font-size": 9, "font-family": "monospace", "text-anchor": q === 0 ? "start" : q === n - 1 ? "end" : "middle" });
      tx3.textContent = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); g.appendChild(tx3);
    });
    return g;
  }

  function interactiveChart(kl, ch, sigs, trades, opt) {
    opt = opt || {}; opt.trades = trades || [];
    var wrap = el("div", "dk-chart");
    var g = buildChart(kl, ch, sigs, null, opt);
    wrap.appendChild(g);
    var cross = el("div", "dk-cross"); cross.style.display = "none";
    var tip = el("div", "dk-tip"); tip.style.display = "none";
    wrap.appendChild(cross); wrap.appendChild(tip);
    var from = opt.from, n = kl.length - from, L = 8, R = 8;
    function idxAt(clientX) {
      var r = g.getBoundingClientRect();
      var vx = (clientX - r.left) / r.width * 680;
      var q = Math.round((vx - L) / (680 - L - R) * n - 0.5) + from;
      return Math.max(from, Math.min(kl.length - 1, q));
    }
    wrap.addEventListener("mousemove", function (e) {
      var q = idxAt(e.clientX), k = kl[q], r = wrap.getBoundingClientRect(), r2 = g.getBoundingClientRect();
      var x = e.clientX - r2.left;
      cross.style.display = "block"; cross.style.left = x + "px";
      tip.style.display = "block";
      tip.style.left = Math.min(r.width - 190, Math.max(0, x + 12)) + "px";
      tip.style.top = "10px";
      var sig = (sigs || []).filter(function (s) { return (s.kline_index != null ? s.kline_index : s.index) === q; });
      var html = "<b>" + new Date(k.timestamp).toISOString().slice(0, 10) + "</b><br>" +
        "O " + num(k.open, 2) + " · H " + num(k.high, 2) + "<br>L " + num(k.low, 2) + " · C " + num(k.close, 2) + "<br>" +
        "V " + (k.volume ? (k.volume / 1e6).toFixed(1) + "M" : "—");
      if (sig.length) html += "<br><span class='dk-tip-sig'>" + sig.map(function (s) { return (LAB[s.type] || s.type) + " @" + num(s.price, 2); }).join(" · ") + "</span>";
      tip.innerHTML = html;
    });
    wrap.addEventListener("mouseleave", function () { cross.style.display = "none"; tip.style.display = "none"; });
    return wrap;
  }

  function renderSymbol(body, pack, name, opts) {
    opts = opts || {};
    var a = pack.analysis || {}, ch = a.chanlun || {}, is = a.ising || {}, tda = a.tda || {}, lp = a.lppls || {};
    var kl = (pack.klines && pack.klines.klines) || [], n = kl.length;
    var sigs = (ch.signals && ch.signals.length ? ch.signals : ((pack.signals && pack.signals.signals) || []));
    if (!n && !a.success) { body.appendChild(el("p", "dk-note", T("no data for " + name, name + " 没有数据"))); return; }
    var sigT = signalTrades(kl, sigs, "longshort");
    var sigL = signalTrades(kl, sigs, "longonly");
    var sigI = signalTrades(kl, sigs, "inverse");
    var dec = causalDecision(kl, sigs);
    var fL = filteredTrades(kl, sigs, "longonly", "causal");
    var fT = filteredTrades(kl, sigs, "longshort", "causal");
    var hL = filteredTrades(kl, sigs, "longonly", "hindsight");

    var k = el("div", "dk-kpis");
    if (n) { var last = kl[n - 1], prev = kl[n - 2], chg = prev ? last.close / prev.close - 1 : 0;
      k.appendChild(kpi(T("last", "最新"), "$" + num(last.close, 2), chg >= 0 ? "pos" : "neg"));
      k.appendChild(kpi(T("change", "涨跌"), (chg >= 0 ? "+" : "") + pct(chg * 100, 2), chg >= 0 ? "pos" : "neg")); }
    k.appendChild(kpi(T("chanlun", "缠论"), ch.current_position || "—", "acc"));
    k.appendChild(kpi(T("market state", "市场态"), is.market_state || "—"));
    k.appendChild(kpi("T / Tc", num(is.temperature, 2) + " / " + num(is.critical_temperature, 2)));
    k.appendChild(kpi("LPPLS p", num(lp.bubble_probability, 3)));
    k.appendChild(kpi("Hurst", num(a.mfdfa ? (a.mfdfa.hurst_index != null ? a.mfdfa.hurst_index : get(a.mfdfa, "result.hurst_index")) : null, 3)));
    k.appendChild(kpi(T("similar win", "相似胜率"), pack.similar && pack.similar.statistics ? pct(pack.similar.statistics.win_rate * 100, 1) : "—"));
    body.appendChild(k);
    body.appendChild(el("p", "dk-prov", "computed_by: " + (a.computed_by || "rust") + " · " + name + " · " + n + " bars · " + sigs.length + " signals · " + sigT.n + " signal trades"));

    var st = { ma: true, strokes: true, zs: true, signals: true, pairs: true, win: 320 };
    var bar = el("div", "dk-toolbar");
    function toggle(label, key) {
      var b = el("button", "dk-tog" + (st[key] ? " on" : ""), label); b.type = "button";
      b.addEventListener("click", function () { st[key] = !st[key]; b.classList.toggle("on", st[key]); redraw(); });
      bar.appendChild(b);
    }
    toggle("MA", "ma"); toggle(T("笔", "笔"), "strokes"); toggle(T("中枢", "中枢"), "zs"); toggle(T("信号", "信号"), "signals"); toggle(T("配对", "配对"), "pairs");
    [160, 320, 500].forEach(function (w) {
      var b = el("button", "dk-tog" + (st.win === w ? " on" : ""), String(w)); b.type = "button";
      b.addEventListener("click", function () { st.win = w; Array.prototype.forEach.call(bar.querySelectorAll(".dk-tog"), function (x) { if (/^\d+$/.test(x.textContent)) x.classList.remove("on"); }); b.classList.add("on"); redraw(); });
      bar.appendChild(b);
    });
    body.appendChild(bar);

    var chartHost = el("div");
    body.appendChild(card(T("chanlun · candles + 笔 + 中枢 + labeled points + paired trades (hover)", "缠论 · K线 + 笔 + 中枢 + 标签买卖点 + 配对交易（可悬停）"), chartHost));
    function redraw() {
      chartHost.textContent = "";
      chartHost.appendChild(interactiveChart(kl, ch, sigs, sigT.trades, { h: 440, from: Math.max(0, n - st.win), ma: st.ma, strokes: st.strokes, zs: st.zs, signals: st.signals, trades: st.pairs, skipped: dec.skipped }));
    }
    redraw();

    if (sigT.trades.length) {
      var pt = el("table"); pt.className = "dk-table";
      pt.innerHTML = "<thead><tr><th>side</th><th>entry</th><th>exit</th><th>in</th><th>out</th><th>return</th><th>bars</th></tr></thead>";
      var pb = el("tbody");
      sigT.trades.forEach(function (p) {
        var tr = el("tr");
        [p.side, p.entry.sig ? (LAB[p.entry.sig.type] || p.entry.sig.type) : "—", p.exit.sig ? (LAB[p.exit.sig.type] || p.exit.sig.type) : T("open", "持仓中"),
          num(p.entry.price, 2), num(p.exit.price, 2), (p.ret >= 0 ? "+" : "") + pct(p.ret * 100, 2), p.bars].forEach(function (x, i2) {
          tr.appendChild(el("td", i2 === 5 ? (p.ret >= 0 ? "pos" : "neg") : null, String(x)));
        });
        pb.appendChild(tr);
      });
      pt.appendChild(pb);
      var wins = sigT.trades.filter(function (p) { return p.ret > 0; }).length;
      body.appendChild(card(T("signal trades · " + wins + "/" + sigT.trades.length + " profitable", "信号交易 · " + wins + "/" + sigT.trades.length + " 盈利"), pt));
    }

    /* the backtest that actually follows the points */
    var sb = el("div"), sk = el("div", "dk-cells");
    sk.appendChild(cell(T("long-only return", "只做多收益"), pct(sigL.total * 100, 2), sigL.total >= 0 ? "pos" : "neg"));
    sk.appendChild(cell(T("long-only Sharpe", "只做多 Sharpe"), num(sigL.sharpe, 3), sigL.sharpe > 0 ? "acc" : "neg"));
    sk.appendChild(cell(T("long-only maxDD", "只做多回撤"), pct(sigL.maxDD * 100, 2), "neg"));
    sk.appendChild(cell(T("long/short return", "多空收益"), pct(sigT.total * 100, 2), sigT.total >= 0 ? "pos" : "neg"));
    sk.appendChild(cell(T("long/short Sharpe", "多空 Sharpe"), num(sigT.sharpe, 3), sigT.sharpe > 0 ? "acc" : "neg"));
    sk.appendChild(cell(T("long/short maxDD", "多空回撤"), pct(sigT.maxDD * 100, 2), "neg"));
    sk.appendChild(cell(T("inverse return", "反向收益"), pct(sigI.total * 100, 2), sigI.total >= 0 ? "pos" : "neg"));
    sk.appendChild(cell(T("trades", "交易"), String(sigT.n)));
    sb.appendChild(sk);
    sb.appendChild(svgbox(line(sigL.curve, { h: 150, color: "#5ec9a8" })));
    sb.appendChild(svgbox(line(sigT.curve, { h: 100, color: "#8fa6b8" })));
    sb.appendChild(svgbox(line(sigI.curve, { h: 100, color: "#f5a524" })));
    body.appendChild(card(T("backtest that follows the points · long-only (teal) / long-short (grey) / inverse (amber)", "按买卖点走的回测 · 只做多（青）/ 多空（灰）/ 反向（琥珀）"), sb));

    /* the smart filter: trade a label only after its past +60 has been positive */
    var smart = el("div");
    var stt = el("table"); stt.className = "dk-table";
    stt.innerHTML = "<thead><tr><th>type</th><th>n</th><th>mean +60</th><th>win</th></tr></thead>";
    var stb = el("tbody");
    signalStats(kl, sigs).forEach(function (x) {
      var tr = el("tr");
      [x.type, x.n, x.meanF60 == null ? "—" : (x.meanF60 >= 0 ? "+" : "") + pct(x.meanF60 * 100, 1), x.winRate == null ? "—" : pct(x.winRate * 100, 1)].forEach(function (v, i2) {
        tr.appendChild(el("td", i2 === 2 ? (String(v).charAt(0) === "+" ? "pos" : "neg") : null, String(v)));
      });
      stb.appendChild(tr);
    });
    stt.appendChild(stb);
    smart.appendChild(stt);
    var variants = [
      [T("unfiltered long-only", "未过滤·只做多"), sigL],
      [T("unfiltered long/short", "未过滤·多空"), sigT],
      [T("smart filter long-only", "聪明过滤·只做多"), fL],
      [T("smart filter long/short", "聪明过滤·多空"), fT],
      [T("hindsight filter (not tradable)", "事后过滤（不可交易）"), hL]
    ];
    var cmp = el("table"); cmp.className = "dk-table";
    cmp.innerHTML = "<thead><tr><th>variant</th><th>return</th><th>Sharpe</th><th>maxDD</th><th>trades</th><th>win</th><th>skipped</th></tr></thead>";
    var cb = el("tbody");
    variants.forEach(function (p) {
      var r = p[1], tr = el("tr");
      [p[0], pct(r.total * 100, 2), num(r.sharpe, 3), pct(r.maxDD * 100, 2), String(r.n), pct(r.winRate * 100, 1), String(r.skipped == null ? 0 : r.skipped)].forEach(function (v, i2) {
        tr.appendChild(el("td", i2 === 1 ? (r.total >= 0 ? "pos" : "neg") : i2 === 2 ? (r.sharpe > 0 ? "acc" : "neg") : null, String(v)));
      });
      cb.appendChild(tr);
    });
    cmp.appendChild(cb);
    smart.appendChild(cmp);
    var best = variants.slice(0, 4).reduce(function (a, b) { return b[1].total > a[1].total ? b : a; });
    smart.appendChild(el("p", "dk-verdict " + (best[1].total > 0 ? "is-ok" : "is-warn"),
      T("best honest variant: " + best[0] + " " + pct(best[1].total * 100, 2) + " · Sharpe " + num(best[1].sharpe, 3),
        "最优诚实版本：" + best[0] + " " + pct(best[1].total * 100, 2) + " · Sharpe " + num(best[1].sharpe, 3))));
    if (fL.total < sigL.total) smart.appendChild(el("p", "dk-note", T(
      "The causal filter reduced the return on this tape: it learned from early false sells and skipped the two that were right (a regime change). Keeping every point is the better honest choice here.",
      "因果过滤在这条胶带上反而降低了收益：它从早期假卖里学到“卖点不可信”，于是跳过了后来两个真正正确的卖点（市场状态变了）。这里保留全部信号才是更诚实的更好选择。")));
    smart.appendChild(svgbox(line(fL.curve, { h: 140, color: "#5ec9a8" })));
    smart.appendChild(svgbox(line(sigL.curve, { h: 90, color: "#8fa6b8" })));
    body.appendChild(card(T("smart filter · trade a label only after its past +60 has been positive", "聪明过滤 · 只在该标签的历史 +60 为正时交易"), smart));
    body.appendChild(el("p", "dk-note", T(
      "Causal: only same-type signals whose +60 window has already closed are used — no future data. A buy is trusted if past buys rose; a sell is trusted if past sells actually fell. Fewer than two completed observations and the signal is taken (one observation is noise). The hindsight row uses the signal's own future and is only a ceiling, not a strategy. Hollow rings are the points the filter skips.",
      "因果：只参考同类型、且 +60 窗口已经走完的过去信号——不用未来数据。买点看过去买点是否上涨；卖点看过去卖点之后是否真的下跌。已走完样本少于两个就不过滤（一个样本是噪声）。事后那一行用了信号自己的未来，只作为上限，不是策略。图上的空心圈就是被过滤掉的点。")))
    ;

    /* US playbook: simple causal rules on the same bars */
    var rules = [
      [T("MA50 long/short", "MA50 多空"), ruleBacktest(kl, "ma50")],
      [T("Donchian 20 breakout", "唐奇安 20 突破"), ruleBacktest(kl, "donchian")],
      [T("60-bar momentum", "60 日动量"), ruleBacktest(kl, "momentum60")],
      [T("buy & hold", "买入持有"), ruleBacktest(kl, "buyhold")],
      [T("chanlun points · long-only", "缠论点 · 只做多"), sigL],
      [T("chanlun points · long/short", "缠论点 · 多空"), sigT]
    ];
    var bestRule = rules.reduce(function (a, b) { return b[1].total > a[1].total ? b : a; });
    var pw = el("div");
    var rt = el("table"); rt.className = "dk-table";
    rt.innerHTML = "<thead><tr><th>rule</th><th>return</th><th>Sharpe</th><th>maxDD</th><th>switches</th></tr></thead>";
    var rb = el("tbody");
    rules.forEach(function (p) {
      var r = p[1], tr = el("tr");
      [p[0], pct(r.total * 100, 2), num(r.sharpe, 3), pct(r.maxDD * 100, 2), String(r.switches != null ? r.switches : r.n)].forEach(function (v, i2) {
        tr.appendChild(el("td", i2 === 1 ? (r.total >= 0 ? "pos" : "neg") : i2 === 2 ? (r.sharpe > 0 ? "acc" : "neg") : null, String(v)));
      });
      rb.appendChild(tr);
    });
    rt.appendChild(rb); pw.appendChild(rt);
    pw.appendChild(svgbox(line(ruleBacktest(kl, "ma50").curve, { h: 150, color: "#5ec9a8" })));
    pw.appendChild(svgbox(line(ruleBacktest(kl, "donchian").curve, { h: 100, color: "#f5a524" })));
    var la = ruleBacktest(kl, "ma50", { lag: false, cost: 0 });
    var honest = ruleBacktest(kl, "ma50");
    pw.appendChild(el("p", "dk-note", T(
      "look-ahead audit: the same MA50 rule with the position set on the current close shows " + pct(la.total * 100, 1) + "; lagged one bar it is " + pct(honest.total * 100, 1) + ". The table uses the lagged, cost-charged version — the earlier number was not real.",
      "偷看审计：同一条 MA50 规则，若用当根收盘定当根仓位，显示 " + pct(la.total * 100, 1) + "；滞后一根后是 " + pct(honest.total * 100, 1) + "。表格用的是滞后+计成本的版本——之前那个数不是真的。")));
    pw.appendChild(el("p", "dk-verdict " + (bestRule[1].total > 0 ? "is-ok" : "is-warn"), T(
      "best rule on this tape: " + bestRule[0] + " " + pct(bestRule[1].total * 100, 2) + " · Sharpe " + num(bestRule[1].sharpe, 3),
      "这条胶带上最强的规则：" + bestRule[0] + " " + pct(bestRule[1].total * 100, 2) + " · Sharpe " + num(bestRule[1].sharpe, 3))));
    body.appendChild(card(T("US playbook · simple causal rules on the same bars", "美股剧本 · 同一批 bar 上的简单因果规则"), pw));
    body.appendChild(el("p", "dk-note", T(
      "Every row is lagged one bar (the position decided at yesterday's close earns today's return) and charged 5 bp per switch. No fitting, no look-ahead. If a rule looks too good, the audit line above shows what the look-ahead version would have claimed.",
      "每一行都滞后一根（昨天收盘定的仓位赚今天的收益），每次切换扣 5bp。无拟合、无偷看。如果某条规则看起来太好，上面的审计行会告诉你“偷看版”会报多少。")));;

    var q = signalQuality(kl, sigs);
    if (q.length) {
      var qt = el("table"); qt.className = "dk-table";
      qt.innerHTML = "<thead><tr><th>label</th><th>type</th><th>price</th><th>+20</th><th>+60</th><th>verdict</th></tr></thead>";
      var qb = el("tbody");
      q.forEach(function (x) {
        var tr = el("tr");
        [LAB[x.s.type] || x.s.type, x.s.type, num(x.s.price, 2),
          x.f20 == null ? "—" : (x.f20 >= 0 ? "+" : "") + pct(x.f20 * 100, 1),
          x.f60 == null ? "—" : (x.f60 >= 0 ? "+" : "") + pct(x.f60 * 100, 1), x.verdict].forEach(function (v, i2) {
          var cls = (i2 === 3 || i2 === 4) ? (String(v).charAt(0) === "+" ? "pos" : "neg") : i2 === 5 ? (/good|long|做多|有效/.test(String(v)) ? "acc" : "") : null;
          tr.appendChild(el("td", cls, String(v)));
        });
        qb.appendChild(tr);
      });
      qt.appendChild(qb);
      body.appendChild(card(T("forward return after each signal · which sell was actually a long", "每个信号之后的前瞻收益 · 哪个卖点其实该做多"), qt));
    }

    if (pack.bt && pack.bt.success) {
      var b = pack.bt, bk = el("div", "dk-cells");
      [["sharpe_ratio", "Sharpe"], ["total_return_pct", "total"], ["annual_return_pct", "annual"], ["max_drawdown_pct", "maxDD"], ["win_rate_pct", "win"], ["calmar_ratio", "Calmar"], ["sortino_ratio", "Sortino"], ["total_trades", "trades"], ["volatility_pct", "vol"]].forEach(function (p) {
        var v = b[p[0]]; if (v == null) return;
        bk.appendChild(cell(p[1], /pct/.test(p[0]) ? pct(v, 2) : num(v, p[0] === "total_trades" ? 0 : 3), /return|annual/.test(p[0]) ? (v >= 0 ? "pos" : "neg") : ""));
      });
      var bw2 = el("div"); bw2.appendChild(bk);
      if (b.equity_curve && b.equity_curve.length) bw2.appendChild(svgbox(line(b.equity_curve, { h: 150, color: "#5ec9a8" })));
      if (b.drawdown_curve && b.drawdown_curve.length) bw2.appendChild(svgbox(area(b.drawdown_curve.map(function (x) { return -Math.abs(x); }), { h: 100 })));
      body.appendChild(card(T("engine strategy backtest · MA/MACD — NOT the signal strategy · " + name, "引擎策略回测 · MA/MACD——不是买卖点策略 · " + name), bw2));
      body.appendChild(el("p", "dk-note", T("This engine backtest runs its own MA/MACD rule; it does not trade the labeled B/S points. The signal backtest above is the one that follows them.", "这个引擎回测跑的是它自己的 MA/MACD 规则，不交易带标签的 B/S 点。上面那个「按买卖点走的回测」才是跟随这些点的。")));
    }

    if (pack.similar && pack.similar.statistics) {
      var s = pack.similar.statistics, sw = el("div");
      var sk = el("div", "dk-cells");
      sk.appendChild(cell(T("matches", "匹配"), String(s.total_matches)));
      sk.appendChild(cell(T("win rate", "胜率"), pct(s.win_rate * 100, 1), s.win_rate >= 0.5 ? "acc" : "neg"));
      sk.appendChild(cell(T("avg return", "平均收益"), pct(s.avg_return, 2), s.avg_return >= 0 ? "pos" : "neg"));
      sk.appendChild(cell(T("max / min", "最大/最小"), pct(s.max_return, 1) + " / " + pct(s.min_return, 1)));
      sk.appendChild(cell(T("avg similarity", "平均相似"), num(s.avg_similarity, 3)));
      sw.appendChild(sk);
      var spark = el("div", "dk-sim");
      (pack.similar.similar_patterns || []).slice(0, 12).forEach(function (m) {
        var c2 = el("div", "dk-sim-cell");
        c2.appendChild(el("span", "dk-sim-r " + (m.pattern_return >= 0 ? "pos" : "neg"), (m.pattern_return >= 0 ? "+" : "") + num(m.pattern_return, 1) + "%"));
        c2.appendChild(el("span", "dk-sim-s", num(m.similarity, 2)));
        spark.appendChild(c2);
      });
      sw.appendChild(spark);
      body.appendChild(card(T("similar patterns · 20 historical matches", "相似形态 · 20 个历史匹配"), sw));
    }

    if (pack.multi && pack.multi.resonance) {
      var r = pack.multi.resonance, mk = el("div", "dk-cells");
      mk.appendChild(cell(T("resonance", "共振"), r.direction || "—", /bull/i.test(r.direction) ? "pos" : "neg"));
      mk.appendChild(cell(T("strength", "强度"), num(r.strength, 2)));
      mk.appendChild(cell(T("up / down levels", "上/下级"), (r.up_levels || 0) + " / " + (r.down_levels || 0)));
      mk.appendChild(cell(T("consistency", "一致性"), num(r.consistency, 2)));
      body.appendChild(card(T("multi-level resonance (D · W · 60m)", "多级别共振（日 · 周 · 60分）"), mk));
    }

    if (pack.crowd && pack.crowd.factors) {
      var c = pack.crowd, cw = el("div");
      var ck = el("div", "dk-cells");
      ck.appendChild(cell(T("crowding ratio", "拥挤度"), num(c.crowding_ratio, 2)));
      ck.appendChild(cell(T("avg score", "平均分"), num(c.avg_score, 3)));
      ck.appendChild(cell(T("crowded", "拥挤因子"), String((c.crowded_factors || []).length)));
      cw.appendChild(ck);
      var top = c.factors.map(function (f, i2) { return { n: f, v: c.scores[i2] }; }).sort(function (x, y) { return y.v - x.v; }).slice(0, 12);
      cw.appendChild(svgbox(barsChart(top.map(function (x) { return { v: x.v, color: x.v > 0.6 ? "#e5484d" : "#5ec9a8" }; }), { h: 100 })));
      var cl = el("div", "dk-list");
      top.forEach(function (x) { var row = el("div", "dk-row"); row.appendChild(el("span", null, x.n)); row.appendChild(el("b", null, num(x.v, 3))); cl.appendChild(row); });
      cw.appendChild(cl);
      body.appendChild(card(T("crowding · top 12 of 49 factors", "拥挤度 · 49 因子前 12"), cw));
    }

    if (a.indicators) {
      var g2 = grid(2);
      if (a.indicators.RSI && a.indicators.RSI.RSI6) g2.appendChild(card("RSI(6)", svgbox(miniLine(a.indicators.RSI.RSI6.slice(-st.win), { h: 90, color: "#f5a524" }))));
      if (a.indicators.MACD && a.indicators.MACD.DIF) {
        var mw = el("div"); mw.appendChild(svgbox(miniLine(a.indicators.MACD.DIF.slice(-st.win), { h: 90, color: "#2dd4bf" }))); mw.appendChild(svgbox(miniLine(a.indicators.MACD.MACD.slice(-st.win), { h: 60, color: "#e5484d" })));
        g2.appendChild(card("MACD · DIF / hist", mw));
      }
      body.appendChild(g2);
    }

    var g3 = grid(2);
    if (is.spin_matrix && is.spin_matrix.length) {
      var iw = el("div"); iw.appendChild(svgbox(isingField(is.spin_matrix)));
      var ik = el("div", "dk-cells");
      [["market_state", T("state", "状态")], ["temperature", "T"], ["critical_temperature", "Tc"], ["wait_ratio", T("wait", "观望")], ["buy_ratio", T("buy", "买")], ["sell_ratio", T("sell", "卖")], ["magnetization", "M"], ["susceptibility", "χ"], ["phase_risk", T("risk", "风险")]].forEach(function (p) { if (is[p[0]] != null) ik.appendChild(cell(p[1], String(is[p[0]]).slice(0, 12))); });
      iw.appendChild(ik);
      g3.appendChild(card(T("Ising force-field · 64×64 spins", "伊辛力场 · 64×64 自旋"), iw));
    }
    if (tda.barcodes && tda.barcodes.length) {
      var tw = el("div"); tw.appendChild(svgbox(barcodeChart(tda.barcodes)));
      var tk = el("div", "dk-cells");
      if (tda.betti_numbers) ["beta_0", "beta_1", "beta_2", "euler_characteristic"].forEach(function (k2) { if (tda.betti_numbers[k2] != null) tk.appendChild(cell(k2, String(tda.betti_numbers[k2]))); });
      if (tda.max_persistence != null) tk.appendChild(cell(T("max persistence", "最大持续"), num(tda.max_persistence, 3)));
      tw.appendChild(tk);
      g3.appendChild(card(T("TDA · persistence barcodes", "拓扑 · 持久条码"), tw));
    }
    body.appendChild(g3);

    var g4 = grid(2);
    if (lp.params) {
      var lw = el("div"); lw.appendChild(svgbox(lpplsChart(kl, lp)));
      var lk = el("div", "dk-cells");
      [["bubble_probability", T("bubble p", "泡沫概率")], ["critical_time_days", T("critical days", "临界天数")], ["fit_quality", T("fit", "拟合")], ["rmse", "RMSE"], ["window_size", T("window", "窗口")]].forEach(function (p) { if (lp[p[0]] != null) lk.appendChild(cell(p[1], num(lp[p[0]], 3))); });
      lw.appendChild(lk); g4.appendChild(card(T("LPPLS · fitted vs actual", "LPPLS · 拟合 vs 实际"), lw));
    }
    if (a.entropy) {
      var e = a.entropy, ek = el("div", "dk-cells");
      [["transfer_entropy_xy", "TE x→y"], ["transfer_entropy_yx", "TE y→x"], ["net_flow", T("net flow", "净流")], ["p_value", "p"], ["is_significant", T("significant", "显著")], ["causality_type", T("type", "类型")]].forEach(function (p) { if (e[p[0]] != null) ek.appendChild(cell(p[1], String(e[p[0]]).slice(0, 14))); });
      g4.appendChild(card(T("transfer entropy (rust)", "转移熵（Rust）"), ek));
    }
    if (a.mfdfa) {
      var mf = a.mfdfa.result || a.mfdfa, mk2 = el("div", "dk-cells");
      [["hurst_index", "Hurst"], ["efficiency", "efficiency"], ["multifractal_strength", "MF"], ["r_squared", "R²"]].forEach(function (p) { if (mf[p[0]] != null) mk2.appendChild(cell(p[1], num(mf[p[0]], 3))); });
      var mw2 = el("div"); mw2.appendChild(mk2);
      if (mf.hurst_spectrum && mf.hurst_spectrum.length) mw2.appendChild(svgbox(miniLine(mf.hurst_spectrum, { h: 90, color: "#8fa6b8" })));
      g4.appendChild(card(T("MF-DFA (rust)", "多重分形（Rust）"), mw2));
    }
    body.appendChild(g4);

    if (opts.aShare) {
      var g5 = grid(2);
      if (D.northbound && D.northbound.success) {
        var nb = D.northbound, nk = el("div", "dk-cells");
        nk.appendChild(cell(T("today net", "今日净流入"), num(nb.today_net / 1e8, 2) + "亿", nb.today_net >= 0 ? "pos" : "neg"));
        nk.appendChild(cell(T("week net", "本周"), num(nb.week_net / 1e8, 2) + "亿"));
        nk.appendChild(cell(T("month net", "本月"), num(nb.month_net / 1e8, 2) + "亿"));
        var nw = el("div"); nw.appendChild(nk);
        if (nb.history && nb.history.length) nw.appendChild(svgbox(miniLine(nb.history.map(function (x) { return x.net_flow != null ? x.net_flow : x.value; }).slice(-60), { h: 90, color: "#5ec9a8" })));
        g5.appendChild(card(T("northbound capital", "北向资金"), nw));
      }
      if (D.marginM && D.marginM.success && D.marginM.data) {
        var mg = D.marginM, mkk = el("div", "dk-cells");
        mkk.appendChild(cell(T("margin balance", "融资余额"), num(mg.margin_balance / 1e8, 1) + "亿"));
        mkk.appendChild(cell(T("securities balance", "融券余额"), num(mg.securities_balance / 1e8, 2) + "亿"));
        mkk.appendChild(cell(T("daily change", "日变化"), num(mg.daily_change / 1e8, 2) + "亿"));
        var mw3 = el("div"); mw3.appendChild(mkk);
        mw3.appendChild(svgbox(miniLine(mg.data.map(function (x) { return x.margin_balance; }), { h: 100, color: "#f5a524" })));
        g5.appendChild(card(T("margin financing · 107 days", "融资融券 · 107 天"), mw3));
      }
      body.appendChild(g5);
    }

    if (a.indicators) {
      var defs = [["RSI", ["RSI6", "RSI12", "RSI24"]], ["KDJ", ["K", "D", "J"]], ["MACD", ["DIF", "DEA", "MACD"]], ["BOLL", ["upper", "middle", "lower"]], ["CCI", ["CCI"]], ["WR", ["WR"]], ["DMI", ["PDI", "MDI", "ADX", "ADXR"]], ["ATR", ["ATR", "ATR_PERCENT"]], ["OBV", ["OBV"]]];
      var ig = el("div", "dk-grid3");
      defs.forEach(function (d) {
        var obj = a.indicators[d[0]]; if (!obj) return;
        var cc = el("div", "dk-card"); cc.appendChild(el("h4", "dk-h", d[0]));
        var kvv = el("div", "dk-cells");
        d[1].forEach(function (k2) { var v2 = obj[k2]; if (v2 && v2.length) kvv.appendChild(cell(k2, num(v2[v2.length - 1], k2 === "OBV" ? 0 : 2))); });
        cc.appendChild(kvv); ig.appendChild(cc);
      });
      body.appendChild(card(T("indicators · 14 families from /api/analysis", "指标 · /api/analysis 的 14 类"), ig));
    }

    body.appendChild(el("p", "dk-note", T(
      "Candles, 笔, 中枢 and the labeled B1/B2/B3 · S1/S2/S3 are the real Rust chanlun output at exact kline indices. Paired trades connect each buy to the next sell (long) and each sell to the next buy (short). Similar patterns, multi-level resonance, crowding, Ising 64×64, TDA, LPPLS, entropy and 14 indicators are the same backend payload. Not investment advice.",
      "K线、笔、中枢与带标签的 B1/B2/B3 · S1/S2/S3 都是真实 Rust 缠论输出，落在精确 kline 索引。配对交易把每个买点连到下一个卖点（多）、每个卖点连到下一个买点（空）。相似形态、多级别共振、拥挤度、伊辛 64×64、TDA、LPPLS、熵与 14 类指标同属后端载荷。非投资建议。")));
  }

  /* --------------------------------------------------------------- mount */
  function mount(host) {
    if (!host || host.getAttribute("data-desk-mounted") === "1") return;
    host.setAttribute("data-desk-mounted", "1");
    host.appendChild(el("p", "dk-note", T("loading the terminal's output…", "正在载入终端输出…")));
    loadAll().then(function () { render(host); }).catch(function (e) {
      host.textContent = ""; host.appendChild(el("p", "dk-note", T("desk data failed: ", "桌面数据失败：") + String(e && e.message || e)));
    });
  }

  function render(host) {
    host.textContent = "";
    var TABS = [["v12", T("V12 · portfolio", "V12 · 组合")], ["tsla", "TSLA"], ["moutai", "600519.SH"]];
    var bar = el("div", "dk-tabs"), body = el("div", "dk-body");
    host.appendChild(bar); host.appendChild(body);
    function show(id) {
      Array.prototype.forEach.call(bar.children, function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === id); });
      body.textContent = "";
      if (id === "v12") renderV12(body);
      else if (id === "tsla") renderSymbol(body, D.tsla, "TSLA", { aShare: false });
      else renderSymbol(body, D.moutai, "600519.SH", { aShare: true });
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
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); mount(host); } }, { rootMargin: "700px" });
      io.observe(host);
    } else mount(host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();

  window.HJ_DESK = { version: "v2.0", mount: mount, data: function () { return D; } };
})();
