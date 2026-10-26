/* ==========================================================================
   BOAT-3 · 07 tsla desk — the trial version of the terminal, on one real tape
   --------------------------------------------------------------------------
   A declared snapshot of TSLA daily bars (Yahoo Finance, 2y) plus a small
   peer basket, analysed in this tab by a browser port of the BOAT method:
   indicators, Chanlun fractals/pens, an Ising three-state phase gauge, Hurst,
   an RMT eigenvalue spectrum, transfer entropy, an LPPLS fit, a logistic
   "decision gene", and a long/flat backtest with an equity curve and an
   underwater chart. Every number is computed here from the committed JSON.

   It is a SNAPSHOT, not a feed. It is a methodology demo, not the Rust
   terminal, and not investment advice. That is printed on the panel.
   ========================================================================== */
(function () {
  "use strict";

  var DATA = null, ST = null;

  function lang() {
    try { var s = localStorage.getItem("hj-lang"); if (s === "zh" || s === "en") return s; } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
  }
  function T(en, zh) { return lang() === "zh" ? zh : en; }
  function num(x, d) {
    d = d == null ? 2 : d;
    if (x == null || !isFinite(x)) return "—";
    var p = Math.pow(10, d);
    return (Math.round(x * p) / p).toFixed(d);
  }
  function pct(x, d) { return num(x * 100, d == null ? 2 : d) + "%"; }

  /* ---------------------------------------------------------- math helpers */
  function mean(a) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
  function std(a) {
    var n = a.length; if (n < 2) return 0;
    var m = mean(a), s = 0, i;
    for (i = 0; i < n; i++) { var d = a[i] - m; s += d * d; }
    return Math.sqrt(s / (n - 1));
  }
  function pctile(a, q) {
    if (!a.length) return 0;
    var b = a.slice().sort(function (x, y) { return x - y; });
    var i = Math.min(b.length - 1, Math.max(0, Math.floor(q * (b.length - 1))));
    return b[i];
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ------------------------------------------------------------ indicators */
  function sma(a, n) {
    var o = [], s = 0, i;
    for (i = 0; i < a.length; i++) {
      s += a[i];
      if (i >= n) s -= a[i - n];
      o.push(i >= n - 1 ? s / n : null);
    }
    return o;
  }
  function ema(a, n) {
    var o = [], k = 2 / (n + 1), prev = null, i;
    for (i = 0; i < a.length; i++) {
      if (i < n - 1) { o.push(null); continue; }
      if (prev == null) { var s = 0; for (var j = i - n + 1; j <= i; j++) s += a[j]; prev = s / n; }
      else prev = a[i] * k + prev * (1 - k);
      o.push(prev);
    }
    return o;
  }
  function rsi(c, n) {
    n = n || 14;
    var o = [null], g = 0, l = 0, i;
    for (i = 1; i < c.length; i++) {
      var d = c[i] - c[i - 1], up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
      if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); } else o.push(null); }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); }
    }
    return o;
  }
  function macd(c) {
    var e12 = ema(c, 12), e26 = ema(c, 26), dif = [], i;
    for (i = 0; i < c.length; i++) dif.push(e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null);
    var dea = ema(dif.map(function (v) { return v == null ? 0 : v; }), 9);
    var hist = dif.map(function (v, k) { return v != null && dea[k] != null ? (v - dea[k]) * 2 : null; });
    return { dif: dif, dea: dea, hist: hist };
  }
  function atr(h, l, c, n) {
    n = n || 14;
    var tr = [null], o = [null], i;
    for (i = 1; i < c.length; i++) tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    var prev = null;
    for (i = 1; i < c.length; i++) {
      if (i < n) { o.push(null); continue; }
      if (prev == null) { var s = 0; for (var j = i - n + 1; j <= i; j++) s += tr[j]; prev = s / n; }
      else prev = (prev * (n - 1) + tr[i]) / n;
      o.push(prev);
    }
    return o;
  }
  function boll(c, n, k) {
    n = n || 20; k = k || 2;
    var mid = sma(c, n), up = [], dn = [], i;
    for (i = 0; i < c.length; i++) {
      if (mid[i] == null) { up.push(null); dn.push(null); continue; }
      var s = 0; for (var j = i - n + 1; j <= i; j++) { var d = c[j] - mid[i]; s += d * d; }
      var sd = Math.sqrt(s / n);
      up.push(mid[i] + k * sd); dn.push(mid[i] - k * sd);
    }
    return { mid: mid, up: up, dn: dn };
  }
  function adx(h, l, c, n) {
    n = n || 14;
    var plus = [null], minus = [null], i;
    for (i = 1; i < c.length; i++) {
      var up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
      plus.push(up > dn && up > 0 ? up : 0);
      minus.push(dn > up && dn > 0 ? dn : 0);
    }
    var a = atr(h, l, c, n), pdi = [], mdi = [], dx = [], out = [];
    var sp = 0, sm = 0;
    for (i = 1; i < c.length; i++) {
      sp += plus[i]; sm += minus[i];
      if (i >= n) { sp -= plus[i - n + 1]; sm -= minus[i - n + 1]; }
      var p = a[i] ? 100 * (sp / n) / a[i] : null, m = a[i] ? 100 * (sm / n) / a[i] : null;
      pdi.push(p); mdi.push(m);
      dx.push(p != null && m != null && p + m !== 0 ? 100 * Math.abs(p - m) / (p + m) : null);
    }
    var prev = null;
    for (i = 0; i < dx.length; i++) {
      if (dx[i] == null) { out.push(null); continue; }
      if (prev == null) { var s = 0, cnt = 0; for (var j = Math.max(0, i - n + 1); j <= i; j++) { if (dx[j] != null) { s += dx[j]; cnt++; } } prev = cnt ? s / cnt : dx[i]; }
      else prev = (prev * (n - 1) + dx[i]) / n;
      out.push(prev);
    }
    return out;
  }
  function obv(c, v) {
    var o = [0], i;
    for (i = 1; i < c.length; i++) o.push(o[i - 1] + (c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0));
    return o;
  }

  /* ------------------------------------------------------------- chanlun */
  /* fractals -> pens -> a simple buy/sell read. The pen filter drops
     fractals that are not separated by at least 4 bars and forces the
     high/low alternation a pen requires. */
  function chanlun(h, l) {
    var n = h.length, tops = [], bots = [], i;
    for (i = 1; i < n - 1; i++) {
      if (h[i] >= h[i - 1] && h[i] >= h[i + 1] && h[i] > h[i - 1] && h[i] > h[i + 1]) tops.push(i);
      if (l[i] <= l[i - 1] && l[i] <= l[i + 1] && l[i] < l[i - 1] && l[i] < l[i + 1]) bots.push(i);
    }
    var pts = tops.map(function (i) { return { i: i, t: "top", p: h[i] }; })
      .concat(bots.map(function (i) { return { i: i, t: "bot", p: l[i] }; }))
      .sort(function (a, b) { return a.i - b.i; });
    var pens = [], last = null;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!last) { last = p; continue; }
      if (p.t === last.t) { if ((p.t === "top" && p.p > last.p) || (p.t === "bot" && p.p < last.p)) last = p; continue; }
      if (p.i - last.i >= 4) { pens.push({ a: last, b: p }); last = p; }
    }
    return { tops: tops, bots: bots, pens: pens };
  }

  /* ---------------------------------------------------------------- ising */
  /* three-state spins (+1 up, 0 flat, -1 down) on daily returns; rolling
     magnetization M and susceptibility chi = N * Var(M). A spike in chi is
     the phase-transition warning the terminal prints. */
  function ising(c, win) {
    win = win || 30;
    var spin = [], i;
    for (i = 0; i < c.length; i++) {
      if (!i) { spin.push(0); continue; }
      var r = c[i] / c[i - 1] - 1;
      spin.push(Math.abs(r) < 0.004 ? 0 : r > 0 ? 1 : -1);
    }
    var M = [], X = [];
    for (i = 0; i < spin.length; i++) {
      var s = spin.slice(Math.max(0, i - win + 1), i + 1);
      var m = mean(s);
      M.push(m); X.push(s.length * std(s) * std(s));
    }
    return { spin: spin, M: M, X: X };
  }

  /* ---------------------------------------------------------------- hurst */
  /* R/S analysis: the slope of log(R/S) on log(window) is H. */
  function hurst(series) {
    var rets = [], i;
    for (i = 1; i < series.length; i++) rets.push(series[i] / series[i - 1] - 1);
    var sizes = [8, 16, 32, 64, 128], pts = [];
    sizes.forEach(function (sz) {
      var rs = [];
      for (var s = 0; s + sz <= rets.length; s += sz) {
        var seg = rets.slice(s, s + sz), m = mean(seg), cum = 0, mx = -Infinity, mn = Infinity;
        for (var j = 0; j < seg.length; j++) { cum += seg[j] - m; if (cum > mx) mx = cum; if (cum < mn) mn = cum; }
        var sd = std(seg);
        if (sd > 1e-12) rs.push((mx - mn) / sd);
      }
      if (rs.length >= 2) pts.push([Math.log(sz), Math.log(mean(rs))]);
    });
    if (pts.length < 2) return 0.5;
    var mx = mean(pts.map(function (p) { return p[0]; })), my = mean(pts.map(function (p) { return p[1]; }));
    var a = 0, b = 0;
    pts.forEach(function (p) { a += (p[0] - mx) * (p[1] - my); b += (p[0] - mx) * (p[0] - mx); });
    return b > 0 ? a / b : 0.5;
  }

  /* ------------------------------------------------------------------ RMT */
  /* correlation matrix of the peer basket's returns, eigenvalues by Jacobi.
     The Marchenko-Pastur edge tells you how many eigenvalues are signal. */
  function jacobiEigen(A) {
    var n = A.length, a = A.map(function (r) { return r.slice(); }), V = [], i, j;
    for (i = 0; i < n; i++) { V.push([]); for (j = 0; j < n; j++) V[i].push(i === j ? 1 : 0); }
    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-12) break;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) < 1e-14) continue;
        var theta = (a[j][j] - a[i][i]) / (2 * a[i][j]);
        var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        var cth = 1 / Math.sqrt(t * t + 1), sth = t * cth, k;
        for (k = 0; k < n; k++) {
          var aik = a[i][k], ajk = a[j][k];
          a[i][k] = cth * aik - sth * ajk; a[j][k] = sth * aik + cth * ajk;
        }
        for (k = 0; k < n; k++) {
          var aki = a[k][i], akj = a[k][j];
          a[k][i] = cth * aki - sth * akj; a[k][j] = sth * aki + cth * akj;
        }
        for (k = 0; k < n; k++) {
          var vki = V[k][i], vkj = V[k][j];
          V[k][i] = cth * vki - sth * vkj; V[k][j] = sth * vki + cth * vkj;
        }
      }
    }
    var vals = [];
    for (i = 0; i < n; i++) vals.push(a[i][i]);
    return vals.sort(function (x, y) { return y - x; });
  }
  function rmt(basket) {
    var tickers = basket.tickers, closes = basket.closes, n = basket.dates.length;
    var rets = tickers.map(function (t) {
      var c = closes[t], r = [];
      for (var i = 1; i < c.length; i++) r.push(c[i] != null && c[i - 1] != null ? c[i] / c[i - 1] - 1 : 0);
      return r;
    });
    var m = rets.length, L = rets[0].length, C = [], i, j;
    for (i = 0; i < m; i++) {
      C.push([]);
      for (j = 0; j < m; j++) {
        var x = rets[i], y = rets[j], mx = mean(x), my = mean(y), a = 0, bx = 0, by = 0, k;
        for (k = 0; k < L; k++) { var dx = x[k] - mx, dy = y[k] - my; a += dx * dy; bx += dx * dx; by += dy * dy; }
        C[i].push(bx > 0 && by > 0 ? a / Math.sqrt(bx * by) : 0);
      }
    }
    var vals = jacobiEigen(C);
    var q = L / m, mp = Math.pow(1 + Math.sqrt(1 / q), 2);
    var above = vals.filter(function (v) { return v > mp; }).length;
    return { tickers: tickers, eigen: vals, mp: mp, above: above, L: L, m: m };
  }

  /* ---------------------------------------------------------- transfer entropy */
  function transferEntropy(x, y, bins) {
    bins = bins || 4;
    var n = Math.min(x.length, y.length), i;
    function q(a) {
      var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a), o = [];
      for (i = 0; i < a.length; i++) o.push(clamp(Math.floor((a[i] - lo) / (hi - lo + 1e-12) * bins), 0, bins - 1));
      return o;
    }
    var X = q(x), Y = q(y), cnt = {}, tot = 0;
    for (i = 1; i < n - 1; i++) {
      var k = Y[i + 1] + "," + Y[i] + "," + X[i];
      cnt[k] = (cnt[k] || 0) + 1; tot++;
    }
    var te = 0;
    for (var key in cnt) {
      if (!cnt.hasOwnProperty(key)) continue;
      var p3 = cnt[key] / tot, parts = key.split(",").map(Number);
      var y1 = parts[0], y0 = parts[1], x0 = parts[2];
      var py1y0 = 0, py0x0 = 0, py0 = 0;
      for (var k2 in cnt) {
        if (!cnt.hasOwnProperty(k2)) continue;
        var p2 = k2.split(",").map(Number);
        if (p2[0] === y1 && p2[1] === y0) py1y0 += cnt[k2] / tot;
        if (p2[1] === y0 && p2[2] === x0) py0x0 += cnt[k2] / tot;
        if (p2[1] === y0) py0 += cnt[k2] / tot;
      }
      if (py1y0 > 0 && py0x0 > 0 && py0 > 0) te += p3 * Math.log((p3 * py0) / (py1y0 * py0x0));
    }
    return Math.max(0, te);
  }

  /* ---------------------------------------------------------------- LPPLS */
  /* log p(t) = A + B(tc-t)^m + C1(tc-t)^m cos(w ln(tc-t)) + C2(...) sin(...).
     A coarse grid over tc, m, w with linear least squares for A,B,C1,C2. */
  function lppls(c) {
    var n = c.length, t = [], y = [], i;
    for (i = 0; i < n; i++) { t.push(i); y.push(Math.log(c[i])); }
    var best = null;
    for (var fi = 0.05; fi <= 0.5; fi += 0.05) {
      var tc = n - 1 + n * fi;
      for (var m = 0.1; m <= 0.9; m += 0.1) {
        for (var w = 6; w <= 13; w += 1) {
          var X = [], Y = y.slice(), k, j;
          for (k = 0; k < n; k++) {
            var dt = tc - t[k];
            if (dt <= 0) { X = null; break; }
            var f = Math.pow(dt, m), lf = Math.log(dt);
            X.push([1, f, f * Math.cos(w * lf), f * Math.sin(w * lf)]);
          }
          if (!X) continue;
          var coef = lstsq(X, Y);
          if (!coef) continue;
          var sse = 0, sst = 0, my = mean(Y);
          for (k = 0; k < n; k++) {
            var pr = 0; for (j = 0; j < 4; j++) pr += coef[j] * X[k][j];
            sse += (Y[k] - pr) * (Y[k] - pr); sst += (Y[k] - my) * (Y[k] - my);
          }
          var r2 = sst > 0 ? 1 - sse / sst : 0;
          if (!best || r2 > best.r2) best = { tc: tc, m: m, w: w, r2: r2, coef: coef, sse: sse };
        }
      }
    }
    if (!best) return { r2: 0, tc: n, m: 0.5, w: 8 };
    best.daysToTc = Math.round(best.tc - (n - 1));
    return best;
  }
  function lstsq(X, y) {
    var n = X.length, k = X[0].length, A = [], b = [], i, j, m;
    for (i = 0; i < k; i++) {
      A.push(new Array(k).fill(0)); b.push(0);
      for (j = 0; j < k; j++) { var s = 0; for (m = 0; m < n; m++) s += X[m][i] * X[m][j]; A[i][j] = s; }
      for (m = 0; m < n; m++) b[i] += X[m][i] * y[m];
    }
    for (i = 0; i < k; i++) {
      var p = i;
      for (m = i + 1; m < k; m++) if (Math.abs(A[m][i]) > Math.abs(A[p][i])) p = m;
      if (Math.abs(A[p][i]) < 1e-12) return null;
      var tmp = A[i]; A[i] = A[p]; A[p] = tmp; var tb = b[i]; b[i] = b[p]; b[p] = tb;
      for (m = i + 1; m < k; m++) {
        var f = A[m][i] / A[i][i];
        for (j = i; j < k; j++) A[m][j] -= f * A[i][j];
        b[m] -= f * b[i];
      }
    }
    var w = new Array(k).fill(0);
    for (i = k - 1; i >= 0; i--) {
      var s2 = b[i];
      for (j = i + 1; j < k; j++) s2 -= A[i][j] * w[j];
      w[i] = s2 / A[i][i];
    }
    return w;
  }

  /* ------------------------------------------------------------- backtest */
  /* long/flat: long when close > MA50 and MACD hist > 0 and RSI < 74; flat
     when close < MA50 or MACD hist < 0. No costs, one tape, labelled. */
  function backtest(o, h, l, c, v) {
    var ma50 = sma(c, 50), r = rsi(c, 14), m = macd(c);
    var pos = 0, entry = 0, trades = [], eq = [1], dd = [0], rets = [], holdDays = [], wins = 0, losses = 0;
    var peak = 1;
    for (var i = 1; i < c.length; i++) {
      var goLong = ma50[i] != null && c[i] > ma50[i] && m.hist[i] != null && m.hist[i] > 0 && r[i] != null && r[i] < 74;
      var goFlat = ma50[i] == null || c[i] < ma50[i] || (m.hist[i] != null && m.hist[i] < 0);
      if (pos === 0 && goLong) { pos = 1; entry = i; trades.push({ i: i, side: "buy" }); }
      else if (pos === 1 && goFlat) {
        pos = 0; trades.push({ i: i, side: "sell" });
        holdDays.push(i - entry);
        if (c[i] > c[entry]) wins++; else losses++;
      }
      var ret = pos * (c[i] / c[i - 1] - 1);
      rets.push(ret);
      var e = eq[eq.length - 1] * (1 + ret);
      eq.push(e);
      if (e > peak) peak = e;
      dd.push(1 - e / peak);
    }
    if (pos === 1) { trades.push({ i: c.length - 1, side: "sell" }); holdDays.push(c.length - 1 - entry); if (c[c.length - 1] > c[entry]) wins++; }
    var n = rets.length, total = trades.filter(function (t) { return t.side === "sell"; }).length;
    var sharpe = std(rets) > 1e-12 ? mean(rets) / std(rets) * Math.sqrt(252) : 0;
    var annual = Math.pow(eq[eq.length - 1], 252 / n) - 1;
    var maxDD = Math.max.apply(null, dd);
    var vol = std(rets) * Math.sqrt(252);
    var var95 = pctile(rets, 0.05);
    var calmar = maxDD > 1e-9 ? annual / maxDD : 0;
    var avgHold = holdDays.length ? mean(holdDays) : 0;
    return {
      equity: eq, drawdown: dd, trades: trades, rets: rets,
      metrics: {
        sharpe: sharpe, annual: annual, maxDD: maxDD, calmar: calmar,
        trades: total, winRate: total ? wins / total : 0, var95: var95,
        vol: vol, avgHold: avgHold, totalReturn: eq[eq.length - 1] - 1
      }
    };
  }

  /* ---------------------------------------------------------- decision gene */
  function decisionGene(o, h, l, c, v) {
    var M = window.HJ_ML;
    if (!M) return null;
    var n = c.length, feats = [], names = [];
    function push(name, arr) { names.push(name); feats.push(arr); }
    push("ret1", c.map(function (x, i) { return i ? x / c[i - 1] - 1 : 0; }));
    push("rsi14", rsi(c, 14).map(function (x) { return x == null ? 50 : x; }));
    var mm = macd(c); push("macdHist", mm.hist.map(function (x) { return x == null ? 0 : x; }));
    var a = atr(h, l, c, 14); push("atr", a.map(function (x) { return x == null ? 0 : x / c[0]; }));
    var b = boll(c, 20, 2); push("bbPos", c.map(function (x, i) { return b.up[i] == null ? 0 : (x - b.dn[i]) / (b.up[i] - b.dn[i] + 1e-9); }));
    push("volZ", (function () { var z = []; var m0 = mean(v), s0 = std(v) || 1; for (var i = 0; i < n; i++) z.push((v[i] - m0) / s0); return z; })());
    push("range", h.map(function (x, i) { return (x - l[i]) / c[i]; }));
    var y = c.map(function (x, i) { return i + 1 < n ? (c[i + 1] > x ? 1 : 0) : 0; });
    var cut = Math.floor(n * 0.7);
    var X = [];
    for (var i = 0; i < n; i++) { var row = []; for (var j = 0; j < feats.length; j++) row.push(feats[j][i]); X.push(row); }
    var mu = [], sd = [];
    for (j = 0; j < feats.length; j++) { mu.push(mean(feats[j])); sd.push(std(feats[j]) || 1); }
    var Xs = X.map(function (row) { return row.map(function (x, j) { return (x - mu[j]) / sd[j]; }); });
    var model = M.logistic(Xs.slice(0, cut), y.slice(0, cut), { epochs: 120 });
    var imp = M.importance(Xs.slice(0, cut), names, y.slice(0, cut), 20261105);
    return { names: names, importance: imp, model: model, cut: cut };
  }

  /* ------------------------------------------------------------------ SVG */
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, at) { var n = document.createElementNS(NS, tag); for (var k in at) if (at.hasOwnProperty(k)) n.setAttribute(k, at[k]); return n; }
  function lineChart(series, opts) {
    opts = opts || {};
    var W = 640, H = opts.h || 150, PAD = 6;
    var all = series.filter(function (s) { return s.vals && s.vals.length; });
    if (!all.length) return sv("svg", { viewBox: "0 0 " + W + " " + H });
    var lo = Infinity, hi = -Infinity;
    all.forEach(function (s) { s.vals.forEach(function (v) { if (v == null) return; if (v < lo) lo = v; if (v > hi) hi = v; }); });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) hi = lo + 1;
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "ts-svg", preserveAspectRatio: "none" });
    for (var g = 1; g <= 3; g++) svg.appendChild(sv("line", { x1: 0, y1: PAD + (H - 2 * PAD) * g / 4, x2: W, y2: PAD + (H - 2 * PAD) * g / 4, "class": "ts-grid" }));
    all.forEach(function (s, si) {
      var d = "", started = false;
      for (var i = 0; i < s.vals.length; i++) {
        var v = s.vals[i]; if (v == null) { continue; }
        var x = i / (s.vals.length - 1) * W, y = H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
        d += (started ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); started = true;
      }
      svg.appendChild(sv("path", { d: d, "class": "ts-line" + (si ? " ts-line-" + si : "") }));
    });
    return svg;
  }
  function candles(o, h, l, c, from, to, marks) {
    var W = 640, H = 220, PAD = 6, n = to - from;
    var lo = Infinity, hi = -Infinity, i;
    for (i = from; i < to; i++) { if (l[i] < lo) lo = l[i]; if (h[i] > hi) hi = h[i]; }
    if (hi - lo < 1e-9) hi = lo + 1;
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "ts-svg", preserveAspectRatio: "none" });
    var bw = W / n;
    function y(v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD); }
    for (i = from; i < to; i++) {
      var x = (i - from + 0.5) * bw;
      var up = c[i] >= o[i];
      svg.appendChild(sv("line", { x1: x, y1: y(h[i]), x2: x, y2: y(l[i]), "class": "ts-wick " + (up ? "is-up" : "is-dn") }));
      var top = y(Math.max(o[i], c[i])), bot = y(Math.min(o[i], c[i]));
      svg.appendChild(sv("rect", { x: x - bw * 0.32, y: top, width: Math.max(1, bw * 0.64), height: Math.max(1, bot - top), "class": "ts-candle " + (up ? "is-up" : "is-dn") }));
    }
    (marks || []).forEach(function (mk) {
      if (mk.i < from || mk.i >= to) return;
      var mx = (mk.i - from + 0.5) * bw, my = mk.side === "buy" ? y(l[mk.i]) + 10 : y(h[mk.i]) - 10;
      svg.appendChild(sv("path", { d: mk.side === "buy" ? "M" + mx + " " + (my - 5) + " l5 8 l-10 0 z" : "M" + mx + " " + (my + 5) + " l5 -8 l-10 0 z", "class": "ts-mark " + (mk.side === "buy" ? "is-buy" : "is-sell") }));
    });
    return svg;
  }
  function barsChart(items, opts) {
    opts = opts || {};
    var W = 640, H = opts.h || 140, PAD = 6, n = items.length;
    var hi = Math.max.apply(null, items.map(function (x) { return x.v; })) || 1;
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "ts-svg", preserveAspectRatio: "none" });
    var bw = W / n;
    items.forEach(function (it, i) {
      var hh = (it.v / hi) * (H - 2 * PAD);
      svg.appendChild(sv("rect", { x: i * bw + bw * 0.12, y: H - PAD - hh, width: bw * 0.76, height: hh, "class": "ts-bar" }));
    });
    return svg;
  }

  /* ---------------------------------------------------------------- mount */
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  function mount(host) {
    if (!host || host.getAttribute("data-tsla-mounted") === "1") return;
    host.setAttribute("data-tsla-mounted", "1");
    host.appendChild(el("p", "ts-loading", T("loading the TSLA snapshot…", "正在载入 TSLA 快照…")));
    fetch("tsla.json?v=1").then(function (r) { return r.json(); }).then(function (j) {
      DATA = j;
      compute();
      render(host);
    }).catch(function (e) {
      host.textContent = "";
      host.appendChild(el("p", "ts-err", T("the snapshot could not be loaded: ", "快照载入失败：") + String(e && e.message || e)));
    });
  }

  function compute() {
    var rows = DATA.tsla;
    var o = rows.map(function (r) { return r.o; }), h = rows.map(function (r) { return r.h; });
    var l = rows.map(function (r) { return r.l; }), c = rows.map(function (r) { return r.c; });
    var v = rows.map(function (r) { return r.v; });
    var dates = rows.map(function (r) { return r.d; });
    var cl = chanlun(h, l), is = ising(c, 30), H = hurst(c);
    var rm = rmt(DATA.basket);
    var lr = c.map(function (x, i) { return i ? Math.log(x / c[i - 1]) : 0; });
    var teVR = transferEntropy(v, lr, 4), teRV = transferEntropy(lr, v, 4);
    var lp = lppls(c);
    var bt = backtest(o, h, l, c, v);
    var dg = decisionGene(o, h, l, c, v);
    ST = {
      o: o, h: h, l: l, c: c, v: v, dates: dates, cl: cl, is: is, H: H, rm: rm,
      teVR: teVR, teRV: teRV, lp: lp, bt: bt, dg: dg,
      ma20: sma(c, 20), ma50: sma(c, 50), rsi: rsi(c, 14), macd: macd(c),
      atr: atr(h, l, c, 14), boll: boll(c, 20, 2), adx: adx(h, l, c, 14), obv: obv(c, v)
    };
  }

  function chip(label, value, tone) {
    var d = el("div", "ts-chip" + (tone ? " is-" + tone : ""));
    d.appendChild(el("span", "ts-chip-l", label));
    d.appendChild(el("b", "ts-chip-v", value));
    return d;
  }

  function render(host) {
    host.textContent = "";
    var c = ST.c, n = c.length, last = c[n - 1], prev = c[n - 2];
    var chg = last / prev - 1;
    var mt = ST.bt.metrics;

    /* header */
    var head = el("div", "ts-head");
    var left = el("div", "ts-head-l");
    left.appendChild(el("span", "ts-sym", "TSLA"));
    left.appendChild(el("span", "ts-name", "Tesla, Inc. · NASDAQ"));
    left.appendChild(el("span", "ts-snap", T("snapshot " + DATA.tsla[0].d + " → " + DATA.tsla[n - 1].d + " · " + n + " bars",
      "快照 " + DATA.tsla[0].d + " → " + DATA.tsla[n - 1].d + " · " + n + " 根")));
    head.appendChild(left);
    var right = el("div", "ts-head-r");
    right.appendChild(el("b", "ts-last", "$" + num(last, 2)));
    right.appendChild(el("span", "ts-chg " + (chg >= 0 ? "is-up" : "is-dn"), (chg >= 0 ? "+" : "") + pct(chg)));
    head.appendChild(right);
    host.appendChild(head);

    var warn = el("p", "ts-warn", T(
      "Declared snapshot · not live · not investment advice. Data: " + DATA.source + ", fetched " + DATA.fetchedAt + ". Every number below is computed in this tab.",
      "声明快照 · 非实时 · 非投资建议。数据：" + DATA.source + "，" + DATA.fetchedAt + " 抓取。以下每个数字都在本页计算。"));
    host.appendChild(warn);

    /* tabs */
    var TABS = [
      { id: "over", en: "Overview", zh: "概览" },
      { id: "kline", en: "K-line & signals", zh: "K线与买卖点" },
      { id: "ind", en: "Indicators", zh: "指标" },
      { id: "chan", en: "Chanlun", zh: "缠论" },
      { id: "ising", en: "Ising phase", zh: "伊辛相变" },
      { id: "hurst", en: "Hurst & RMT", zh: "Hurst 与 RMT" },
      { id: "ent", en: "Entropy & LPPLS", zh: "熵与 LPPLS" },
      { id: "gene", en: "Decision gene", zh: "决策基因" },
      { id: "bt", en: "Backtest", zh: "回测" }
    ];
    var tabBar = el("div", "ts-tabs");
    tabBar.setAttribute("role", "tablist");
    var body = el("div", "ts-body");
    host.appendChild(tabBar); host.appendChild(body);
    var active = "over";
    function show(id) {
      active = id;
      Array.prototype.forEach.call(tabBar.children, function (b) { b.classList.toggle("is-on", b.getAttribute("data-tab") === id); });
      body.textContent = "";
      var fn = PANELS[id];
      if (fn) fn(body);
    }
    TABS.forEach(function (tb) {
      var b = el("button", "ts-tab", T(tb.en, tb.zh));
      b.type = "button"; b.setAttribute("data-tab", tb.id);
      b.addEventListener("click", function () { show(tb.id); });
      tabBar.appendChild(b);
    });

    /* ------------------------------------------------------------- panels */
    var PANELS = {};

    PANELS.over = function (b) {
      var chips = el("div", "ts-chips");
      chips.appendChild(chip(T("last", "最新"), "$" + num(last, 2), chg >= 0 ? "up" : "dn"));
      chips.appendChild(chip(T("RSI(14)", "RSI(14)"), num(ST.rsi[n - 1], 1)));
      chips.appendChild(chip(T("ADX(14)", "ADX(14)"), num(ST.adx[ST.adx.length - 1], 1)));
      chips.appendChild(chip(T("Hurst", "Hurst"), num(ST.H, 2), ST.H > 0.5 ? "up" : "dn"));
      chips.appendChild(chip(T("Ising χ", "伊辛 χ"), num(ST.is.X[n - 1], 2)));
      chips.appendChild(chip(T("LPPLS tc", "LPPLS tc"), "+" + ST.lp.daysToTc + "d"));
      chips.appendChild(chip(T("backtest Sharpe", "回测 Sharpe"), num(mt.sharpe, 2), mt.sharpe > 0 ? "up" : "dn"));
      chips.appendChild(chip(T("max drawdown", "最大回撤"), pct(mt.maxDD, 1)));
      b.appendChild(chips);
      var card = el("div", "ts-card");
      card.appendChild(el("p", "ts-card-h", T("price · last 180 bars with MA20 / MA50", "价格 · 最近 180 根，含 MA20 / MA50")));
      card.appendChild(lineChart([
        { vals: c.slice(-180) }, { vals: ST.ma20.slice(-180) }, { vals: ST.ma50.slice(-180) }
      ], { h: 190 }));
      b.appendChild(card);
      var note = el("p", "ts-note", T(
        "The trial reads a committed snapshot, so it is reproducible: same JSON, same numbers. The Rust terminal streams a live feed and runs the full 61-indicator kernel; this page runs a browser port of the method on one tape.",
        "试用版读的是提交进仓库的快照，所以可复现：同一份 JSON，同一组数字。Rust 终端接实时流、跑全量 61 指标内核；本页在一条胶带上跑方法的浏览器移植。"));
      b.appendChild(note);
    };

    PANELS.kline = function (b) {
      var from = Math.max(0, n - 180);
      var card = el("div", "ts-card");
      card.appendChild(el("p", "ts-card-h", T("candles · last 180 bars · ▲ buy  ▼ sell", "K线 · 最近 180 根 · ▲ 买  ▼ 卖")));
      card.appendChild(candles(ST.o, ST.h, ST.l, ST.c, from, n, ST.bt.trades));
      b.appendChild(card);
      var rows = el("div", "ts-kv");
      rows.appendChild(chip(T("buy signals", "买点"), String(ST.bt.trades.filter(function (t) { return t.side === "buy"; }).length)));
      rows.appendChild(chip(T("sell signals", "卖点"), String(ST.bt.trades.filter(function (t) { return t.side === "sell"; }).length)));
      rows.appendChild(chip(T("last signal", "最近信号"), (function () { var t = ST.bt.trades[ST.bt.trades.length - 1]; return t ? (t.side === "buy" ? T("buy", "买") : T("sell", "卖")) + " @ " + ST.dates[t.i] : "—"; })()));
      b.appendChild(rows);
    };

    PANELS.ind = function (b) {
      function card(title, series, h) {
        var cc = el("div", "ts-card");
        cc.appendChild(el("p", "ts-card-h", title));
        cc.appendChild(lineChart(series, { h: h || 120 }));
        b.appendChild(cc);
      }
      card(T("RSI(14)", "RSI(14)"), [{ vals: ST.rsi.slice(-180) }]);
      card(T("MACD · DIF / DEA / hist", "MACD · DIF / DEA / 柱"), [{ vals: ST.macd.dif.slice(-180) }, { vals: ST.macd.dea.slice(-180) }, { vals: ST.macd.hist.slice(-180) }]);
      card(T("Bollinger · mid / upper / lower", "布林带 · 中轨 / 上轨 / 下轨"), [{ vals: ST.boll.mid.slice(-180) }, { vals: ST.boll.up.slice(-180) }, { vals: ST.boll.dn.slice(-180) }]);
      card(T("ATR(14) · normalized", "ATR(14) · 归一"), [{ vals: ST.atr.slice(-180).map(function (x) { return x == null ? null : x / last; }) }]);
    };

    PANELS.chan = function (b) {
      var card = el("div", "ts-card");
      card.appendChild(el("p", "ts-card-h", T("Chanlun pens · fractals joined", "缠论笔 · 分型相连")));
      var from = Math.max(0, n - 180);
      var svg = candles(ST.o, ST.h, ST.l, ST.c, from, n, ST.bt.trades);
      var W = 640, H = 220, PAD = 6, cnt = n - from;
      var lo = Infinity, hi = -Infinity;
      for (var i = from; i < n; i++) { if (ST.l[i] < lo) lo = ST.l[i]; if (ST.h[i] > hi) hi = ST.h[i]; }
      function y(v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD); }
      ST.cl.pens.forEach(function (p) {
        if (p.a.i < from || p.b.i >= n) return;
        var x1 = (p.a.i - from + 0.5) * (W / cnt), x2 = (p.b.i - from + 0.5) * (W / cnt);
        svg.appendChild(sv("line", { x1: x1, y1: y(p.a.p), x2: x2, y2: y(p.b.p), "class": "ts-pen" }));
      });
      card.appendChild(svg);
      b.appendChild(card);
      var kv = el("div", "ts-kv");
      kv.appendChild(chip(T("top fractals", "顶分型"), String(ST.cl.tops.length)));
      kv.appendChild(chip(T("bottom fractals", "底分型"), String(ST.cl.bots.length)));
      kv.appendChild(chip(T("pens", "笔"), String(ST.cl.pens.length)));
      b.appendChild(kv);
    };

    PANELS.ising = function (b) {
      function card(title, vals) {
        var cc = el("div", "ts-card");
        cc.appendChild(el("p", "ts-card-h", title));
        cc.appendChild(lineChart([{ vals: vals.slice(-180) }], { h: 120 }));
        b.appendChild(cc);
      }
      card(T("magnetization M (30-bar window)", "磁化强度 M（30 根窗口）"), ST.is.M);
      card(T("susceptibility χ = N·Var(M) — a spike is the phase warning", "磁化率 χ = N·Var(M)——尖峰即相变预警"), ST.is.X);
      var kv = el("div", "ts-kv");
      kv.appendChild(chip(T("M now", "当前 M"), num(ST.is.M[n - 1], 3)));
      kv.appendChild(chip(T("χ now", "当前 χ"), num(ST.is.X[n - 1], 2)));
      b.appendChild(kv);
    };

    PANELS.hurst = function (b) {
      var kv = el("div", "ts-kv");
      kv.appendChild(chip(T("Hurst H", "Hurst H"), num(ST.H, 3), ST.H > 0.5 ? "up" : "dn"));
      kv.appendChild(chip(T("reading", "读数"), ST.H > 0.55 ? T("trending", "趋势") : ST.H < 0.45 ? T("mean-reverting", "均值回复") : T("random walk", "随机游走")));
      kv.appendChild(chip(T("MP edge", "MP 边"), num(ST.rm.mp, 2)));
      kv.appendChild(chip(T("eigenvalues above edge", "超边特征值"), String(ST.rm.above)));
      b.appendChild(kv);
      var card = el("div", "ts-card");
      card.appendChild(el("p", "ts-card-h", T("RMT eigenvalue spectrum · " + ST.rm.m + " assets × " + ST.rm.L + " days", "RMT 特征值谱 · " + ST.rm.m + " 资产 × " + ST.rm.L + " 天")));
      card.appendChild(barsChart(ST.rm.eigen.map(function (v) { return { v: v }; }), { h: 140 }));
      b.appendChild(card);
      var note = el("p", "ts-note", T(
        "The largest eigenvalue above the Marchenko-Pastur edge is the market mode — how much of the basket is one trade. More eigenvalues above the edge means more independent risk, or less.",
        "超过 Marchenko-Pastur 边的最大特征值就是市场模态——这个篮子有多少是同一笔交易。超边的特征值越多，独立风险越多，或者越少。"));
      b.appendChild(note);
    };

    PANELS.ent = function (b) {
      var kv = el("div", "ts-kv");
      kv.appendChild(chip(T("TE volume → return", "转移熵 量 → 收益"), num(ST.teVR, 4)));
      kv.appendChild(chip(T("TE return → volume", "转移熵 收益 → 量"), num(ST.teRV, 4)));
      kv.appendChild(chip(T("LPPLS R²", "LPPLS R²"), num(ST.lp.r2, 3)));
      kv.appendChild(chip(T("m / ω", "m / ω"), num(ST.lp.m, 1) + " / " + num(ST.lp.w, 0)));
      b.appendChild(kv);
      var card = el("div", "ts-card");
      card.appendChild(el("p", "ts-card-h", T("log price vs the fitted LPPLS trend", "对数价格 vs 拟合的 LPPLS 趋势")));
      card.appendChild(lineChart([{ vals: c.slice(-180).map(Math.log) }], { h: 150 }));
      b.appendChild(card);
      var v = el("p", "ts-verdict " + (ST.lp.r2 > 0.9 ? "is-ok" : "is-warn"),
        ST.lp.r2 > 0.9
          ? T("the fit is tight (R² " + num(ST.lp.r2, 3) + "), critical time ≈ +" + ST.lp.daysToTc + " bars — a bubble read, not a forecast", "拟合很紧（R² " + num(ST.lp.r2, 3) + "），临界时间 ≈ +" + ST.lp.daysToTc + " 根——这是泡沫读数，不是预测")
          : T("the fit is loose (R² " + num(ST.lp.r2, 3) + ") — no clean super-exponential structure on this window", "拟合很松（R² " + num(ST.lp.r2, 3) + "）——这个窗口没有干净的超指数结构"));
      b.appendChild(v);
    };

    PANELS.gene = function (b) {
      if (!ST.dg) { b.appendChild(el("p", "ts-note", "HJ_ML not loaded")); return; }
      var card = el("div", "ts-card");
      card.appendChild(el("p", "ts-card-h", T("permutation importance · next-day direction", "置换重要性 · 次日方向")));
      var items = ST.dg.importance.map(function (it) { return { v: Math.abs(it.drop) }; });
      card.appendChild(barsChart(items, { h: 140 }));
      b.appendChild(card);
      var list = el("div", "ts-genelist");
      ST.dg.importance.slice(0, 8).forEach(function (it) {
        var row = el("div", "ts-gene-row");
        row.appendChild(el("span", "ts-gene-n", it.name));
        row.appendChild(el("b", null, num(Math.abs(it.drop), 3)));
        list.appendChild(row);
      });
      b.appendChild(list);
      b.appendChild(el("p", "ts-note", T(
        "A logistic model on seven features, trained on the first 70% and scored on the rest; the bars are how much each feature's rank correlation with next-day direction collapses when it is shuffled. Model-agnostic, no fitted weight is read.",
        "七特征上的逻辑回归，前 70% 训练、其余打分；柱高是每个特征被洗牌后与次日方向的秩相关跌了多少。与模型无关，不读拟合权重。")));
    };

    PANELS.bt = function (b) {
      var chips = el("div", "ts-chips");
      chips.appendChild(chip(T("Sharpe", "Sharpe"), num(mt.sharpe, 3), mt.sharpe > 1 ? "up" : ""));
      chips.appendChild(chip(T("annual return", "年化收益"), pct(mt.annual, 1), mt.annual > 0 ? "up" : "dn"));
      chips.appendChild(chip(T("max drawdown", "最大回撤"), pct(mt.maxDD, 1), "dn"));
      chips.appendChild(chip(T("Calmar", "Calmar"), num(mt.calmar, 2)));
      chips.appendChild(chip(T("trades", "交易次数"), String(mt.trades)));
      chips.appendChild(chip(T("win rate", "胜率"), pct(mt.winRate, 1)));
      chips.appendChild(chip(T("VaR(95%)", "VaR(95%)"), pct(mt.var95, 2)));
      chips.appendChild(chip(T("annual vol", "年化波动"), pct(mt.vol, 1)));
      chips.appendChild(chip(T("avg hold", "平均持仓"), num(mt.avgHold, 1) + "d"));
      chips.appendChild(chip(T("total return", "总收益"), pct(mt.totalReturn, 1), mt.totalReturn > 0 ? "up" : "dn"));
      b.appendChild(chips);

      var eqCard = el("div", "ts-card");
      eqCard.appendChild(el("p", "ts-card-h", T("equity curve · long/flat, no costs", "权益曲线 · 多/空仓，无成本")));
      eqCard.appendChild(lineChart([{ vals: ST.bt.equity }], { h: 170 }));
      b.appendChild(eqCard);

      var ddCard = el("div", "ts-card");
      ddCard.appendChild(el("p", "ts-card-h", T("underwater · drawdown from peak", "回撤曲线 · 距峰值")));
      ddCard.appendChild(lineChart([{ vals: ST.bt.drawdown.map(function (x) { return -x; }) }], { h: 120 }));
      b.appendChild(ddCard);

      b.appendChild(el("p", "ts-note", T(
        "Long when close > MA50 and MACD hist > 0 and RSI < 74; flat otherwise. No costs, no slippage, one snapshot. A backtest is a backtest — this one is labelled declared-synthetic-free, but it is still one tape.",
        "收盘价 > MA50 且 MACD 柱 > 0 且 RSI < 74 时做多，否则空仓。无成本、无滑点、一份快照。回测就是回测——这份标了非合成，但仍然只是一条胶带。")));
    };

    show("over");

    /* language switch re-renders */
    window.addEventListener("hj:lang", function () { render(host); });
  }

  window.HJ_TSLA = {
    version: "v1.0",
    mount: mount,
    load: function () { return DATA; },
    state: function () { return ST; }
  };

  function autoMount() {
    var host = document.getElementById("tsla-host");
    if (!host) return;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); mount(host); }
      }, { rootMargin: "700px" });
      io.observe(host);
    } else { mount(host); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();
})();
