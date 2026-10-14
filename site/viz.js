/* viz.js — signature interactives for the resolution-limit story.
   Zero-build, vanilla ES6. Lazy-initialized via IntersectionObserver so the
   hero paints fast (LCP). Respects prefers-reduced-motion. Keyboard + ARIA.

   Public contract: markup provides containers with data-viz="<name>".
   Each registered builder is called once when its container first scrolls near.
*/
(function () {
  "use strict";

  var REDUCED = false;
  try {
    REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var registry = {};
  function register(name, build) { registry[name] = build; }

  // ---- small shared helpers -------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function fmt(n, d) { return Number(n).toFixed(d == null ? 2 : d); }

  // Device-pixel-ratio aware canvas sizing. Returns 2d context in CSS pixels.
  function fitCanvas(canvas, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || canvas.parentNode.clientWidth || 640;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: cssH };
  }

  function cssVar(node, name, fallback) {
    try {
      var v = getComputedStyle(node).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  // Tooltip helper bound to a wrap element (position: relative).
  function makeTip(wrap) {
    var tip = document.createElement("div");
    tip.className = "viz-tip";
    tip.setAttribute("role", "status");
    wrap.appendChild(tip);
    return {
      show: function (html, x, y) {
        tip.innerHTML = html;
        tip.classList.add("show");
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var left = clamp(x + 14, 4, wrap.clientWidth - tw - 4);
        var top = clamp(y - th - 12, 4, wrap.clientHeight - th - 4);
        tip.style.left = left + "px";
        tip.style.top = top + "px";
      },
      hide: function () { tip.classList.remove("show"); }
    };
  }

  // Expose helpers to builders via closure object.
  var H = { el: el, clamp: clamp, fmt: fmt, fitCanvas: fitCanvas, cssVar: cssVar, makeTip: makeTip, reduced: REDUCED };

  // ---- lazy init via IntersectionObserver -----------------------------------
  function initContainer(node) {
    if (node.getAttribute("data-viz-ready") === "1") return;
    var name = node.getAttribute("data-viz");
    var build = registry[name];
    if (!build) return;
    node.setAttribute("data-viz-ready", "1");
    try { build(node, H); }
    catch (e) {
      node.setAttribute("data-fallback", "true");
      if (window.console) console.warn("viz build failed:", name, e);
    }
  }

  function boot() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-viz]"));
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(initContainer);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          initContainer(en.target);
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "200px 0px" });
    nodes.forEach(function (n) { io.observe(n); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Builders are attached below.
  // ===== 1) DIFFRACTION LIMIT =====
  register("diffraction", function (root, H) {
    var canvas = root.querySelector("canvas");
    var range = root.querySelector('input[type="range"]');
    if (!canvas || !range) { root.setAttribute("data-fallback", "true"); return; }
    var wrap = canvas.parentNode;
    var tip = H.makeTip(wrap);
    var rmVal = root.querySelector("[data-out=m]");
    var rtVal = root.querySelector("[data-out=tau]");
    var rqVal = root.querySelector("[data-out=q]");
    var verdict = root.querySelector("[data-out=verdict]");
    var MSTAR = 1.3, MMAX = 94;
    var tauOf = function (m) { return m / MSTAR; };
    var qsqOf = function (t) { return t / (1 + t); };
    // fixed per-arrow random directions (seeded, stable across redraws)
    var COLS = 16, ROWS = 8, NA = COLS * ROWS, noiseAng = [];
    var seed = 1337;
    function rr() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < NA; i++) noiseAng.push(rr() * Math.PI * 2);
    var TRUE_DIR = -Math.PI / 4.5; // "home tilt" ~ up-right

    function draw() {
      var m = parseInt(range.value, 10);
      var tau = tauOf(m), q2 = qsqOf(tau), q = Math.sqrt(q2);
      var good = H.cssVar(root, "--viz-good", "#6dcea8");
      var warn = H.cssVar(root, "--viz-warn", "#c45c26");
      var muted = H.cssVar(root, "--viz-muted", "#8a93a3");
      var line = H.cssVar(root, "--viz-line", "rgba(215,224,234,0.18)");
      var fit = H.fitCanvas(canvas, 260);
      var ctx = fit.ctx, w = fit.w, h = fit.h;
      ctx.clearRect(0, 0, w, h);
      // split: left = field of estimated tilts, right = q²(m) curve
      var splitX = Math.round(w * 0.52);
      drawField(ctx, 0, 0, splitX, h, m, tau, q, good, warn, muted, line);
      drawCurve(ctx, splitX, 0, w - splitX, h, m, tau, q2, good, warn, muted, line);
      if (rmVal) rmVal.textContent = String(m);
      if (rtVal) rtVal.textContent = H.fmt(tau, 2);
      if (rqVal) rqVal.textContent = H.fmt(q2, 2);
      if (verdict) {
        var ok = q2 >= 0.5;
        verdict.textContent = ok ? (verdict.getAttribute("data-ok") || "mostly recoverable")
                                 : (verdict.getAttribute("data-no") || "below resolution");
        verdict.style.color = ok ? good : warn;
      }
      root._state = { m: m, tau: tau, q2: q2, splitX: splitX, w: w, h: h };
    }
    function drawField(ctx, x0, y0, ww, hh, m, tau, q, good, warn, muted, line) {
      ctx.save();
      ctx.translate(x0, y0);
      ctx.beginPath(); ctx.rect(0, 0, ww, hh); ctx.clip();
      // each arrow = estimated direction = blend of true dir (weight q) and noise (weight 1-q)
      var padX = 18, padY = 22;
      var cw = (ww - padX * 2) / (COLS - 1);
      var ch = (hh - padY * 2 - 16) / (ROWS - 1);
      var len = Math.min(cw, ch) * 0.42;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var idx = r * COLS + c;
          var cx = padX + c * cw, cy = padY + r * ch;
          // vector sum: coherent component + incoherent component
          var vx = q * Math.cos(TRUE_DIR) + (1 - q) * Math.cos(noiseAng[idx]);
          var vy = q * Math.sin(TRUE_DIR) + (1 - q) * Math.sin(noiseAng[idx]);
          var ang = Math.atan2(vy, vx);
          var coher = q; // 0..1
          ctx.strokeStyle = mix(warn, good, coher);
          ctx.globalAlpha = 0.55 + 0.4 * coher;
          ctx.lineWidth = 1.3 + 1.1 * coher;
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len);
          var hx = cx + Math.cos(ang) * len, hy = cy + Math.sin(ang) * len;
          ctx.lineTo(hx, hy);
          ctx.stroke();
          // arrowhead
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - Math.cos(ang - 0.4) * len * 0.4, hy - Math.sin(ang - 0.4) * len * 0.4);
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - Math.cos(ang + 0.4) * len * 0.4, hy - Math.sin(ang + 0.4) * len * 0.4);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // reference "true direction" badge
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.font = "11px IBM Plex Mono";
      ctx.fillStyle = muted;
      ctx.fillText("estimated home-tilt directions", padX, hh - 6);
      ctx.restore();
    }
    function drawCurve(ctx, x0, y0, ww, hh, m, tau, q2, good, warn, muted, line) {
      ctx.save();
      ctx.translate(x0, y0);
      var pad = 40, pb = 34;
      var plotW = ww - pad - 14, plotH = hh - 24 - pb;
      var xOfM = function (mm) { return pad + (Math.log(mm) / Math.log(MMAX)) * plotW; };
      var yOfQ = function (qq) { return 24 + plotH - qq * plotH; };
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, 24); ctx.lineTo(pad, 24 + plotH); ctx.lineTo(pad + plotW, 24 + plotH);
      ctx.stroke();
      // half-recovery guides
      ctx.strokeStyle = warn; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(xOfM(MSTAR), 24); ctx.lineTo(xOfM(MSTAR), 24 + plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, yOfQ(0.5)); ctx.lineTo(pad + plotW, yOfQ(0.5)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = warn; ctx.font = "10px IBM Plex Mono";
      ctx.fillText("m*≈1.3 · q²=0.5", xOfM(MSTAR) + 6, 36);
      // curve
      ctx.strokeStyle = good; ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (var i = 0; i <= 180; i++) {
        var mm = Math.exp((Math.log(MMAX) * i) / 180);
        var qq = qsqOf(tauOf(mm));
        var px = xOfM(mm), py = yOfQ(qq);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // current point
      var cxp = xOfM(Math.max(1, m)), cyp = yOfQ(q2);
      ctx.strokeStyle = "rgba(150,160,175,0.3)";
      ctx.beginPath(); ctx.moveTo(cxp, 24); ctx.lineTo(cxp, 24 + plotH); ctx.stroke();
      ctx.fillStyle = q2 >= 0.5 ? good : warn;
      ctx.beginPath(); ctx.arc(cxp, cyp, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = muted; ctx.font = "10px IBM Plex Mono";
      ctx.fillText("m pooled (log) →", pad + plotW - 92, 24 + plotH + 24);
      ctx.fillText("q²", 8, 30);
      ctx.restore();
    }
    function mix(a, b, t) {
      var ca = parseHex(a), cb = parseHex(b);
      if (!ca || !cb) return b;
      var r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
      var g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
      var bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
      return "rgb(" + r + "," + g + "," + bl + ")";
    }
    function parseHex(s) {
      var m2 = /^#?([0-9a-f]{6})$/i.exec(s.trim());
      if (!m2) return null;
      var n = parseInt(m2[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    draw();
    range.addEventListener("input", draw);
    window.addEventListener("resize", function () { draw(); });
    H._live["diffraction"] = draw;
    // hover tooltip
    canvas.addEventListener("mousemove", function (ev) {
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      var s = root._state; if (!s) return;
      if (x < s.splitX) {
        tip.show("<b>Estimated home-tilt field</b><br>m=" + s.m + " factors<br>τ=" + H.fmt(s.tau, 2) +
          "<br>overlap q²=" + H.fmt(s.q2, 2) + "<br>q=cosθ=" + H.fmt(Math.sqrt(s.q2), 2), x, y);
      } else {
        tip.show("<b>q²(τ)=τ/(1+τ)</b><br>τ=m/1.3<br>m=" + s.m + " → q²=" + H.fmt(s.q2, 2) +
          "<br>half-recovery at m*≈1.3", x, y);
      }
    });
    canvas.addEventListener("mouseleave", function () { tip.hide(); });
    range.addEventListener("focus", function () {
      var s = root._state; if (s) tip.show("m=" + s.m + " · q²=" + H.fmt(s.q2, 2), s.splitX * 0.5, s.h * 0.2);
    });
    range.addEventListener("blur", function () { tip.hide(); });
  });
  // ===== 2) SHARPE LADDER (waterfall) =====
  register("sharpe", function (root, H) {
    var canvas = root.querySelector("canvas");
    if (!canvas) { root.setAttribute("data-fallback", "true"); return; }
    var wrap = canvas.parentNode;
    var tip = H.makeTip(wrap);
    // bars: value, Sharpe, 95% CI [lo,hi] (null = no whisker), kind
    var DATA = {
      us: [
        { key: "discard", label: "Discarded in large-caps", sr: 0.85, ci: null, kind: "base" },
        { key: "coarse", label: "Coarse pool → home venue", sr: 1.30, ci: [1.11, 1.47], kind: "real", delta: "+0.45 · p(>0)=1.000" },
        { key: "oracle_is", label: "Oracle (in-sample mirage)", sr: 1.45, ci: null, kind: "mirage" },
        { key: "oracle_oos", label: "Oracle held out of sample", sr: 1.12, ci: [0.90, 1.33], kind: "collapse" },
        { key: "ml", label: "ML characteristic router", sr: 1.12, ci: [0.89, 1.34], kind: "router" }
      ],
      cn: [
        { key: "discard", label: "A-share discards (where tested)", sr: 0.42, ci: null, kind: "base" },
        { key: "coarse", label: "Coarse pool → home venue", sr: 1.37, ci: [1.14, 1.59], kind: "real", delta: "+0.95 · bootstrap p=0" },
        { key: "oracle_is", label: "Oracle (in-sample mirage)", sr: 1.52, ci: null, kind: "mirage" },
        { key: "oracle_oos", label: "Oracle held out of sample", sr: 1.20, ci: [0.96, 1.44], kind: "collapse" },
        { key: "ml", label: "ML characteristic router", sr: 1.18, ci: [0.94, 1.42], kind: "router" }
      ]
    };
    var market = "us";
    var toggle = root.querySelector(".viz-toggle");
    if (toggle) {
      toggle.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        market = b.getAttribute("data-market") || "us";
        Array.prototype.forEach.call(toggle.querySelectorAll("button"), function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        draw();
      });
    }
    var bars = [];
    function draw() {
      var good = H.cssVar(root, "--viz-good", "#6dcea8");
      var warn = H.cssVar(root, "--viz-warn", "#c45c26");
      var muted = H.cssVar(root, "--viz-muted", "#8a93a3");
      var ink = H.cssVar(root, "--viz-ink", "#d7e0ea");
      var line = H.cssVar(root, "--viz-line", "rgba(215,224,234,0.18)");
      var fit = H.fitCanvas(canvas, 320);
      var ctx = fit.ctx, w = fit.w, h = fit.h;
      ctx.clearRect(0, 0, w, h);
      var d = DATA[market];
      var pad = 46, pb = 56, top = 18;
      var plotH = h - top - pb;
      var SRMAX = 1.6;
      var yOf = function (sr) { return top + plotH - (sr / SRMAX) * plotH; };
      var n = d.length, gap = 16;
      var bw = (w - pad - 16 - gap * (n - 1)) / n;
      // gridlines
      ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.font = "10px IBM Plex Mono";
      for (var g = 0; g <= 1.5; g += 0.5) {
        var gy = yOf(g);
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - 16, gy); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillText(H.fmt(g, 1), 16, gy + 3);
      }
      ctx.fillText("Sharpe", 14, top - 4);
      bars = [];
      for (var i = 0; i < n; i++) {
        var it = d[i];
        var x = pad + i * (bw + gap);
        var col = it.kind === "base" ? muted : it.kind === "real" ? good : it.kind === "mirage" ? warn
                 : it.kind === "collapse" ? warn : "#6f8bd0";
        var y = yOf(it.sr), bh = (top + plotH) - y;
        // mirage drawn hollow/hatched
        if (it.kind === "mirage") {
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
          ctx.strokeRect(x, y, bw, bh); ctx.setLineDash([]);
        } else {
          ctx.fillStyle = col; ctx.globalAlpha = it.kind === "collapse" ? 0.55 : 0.9;
          ctx.fillRect(x, y, bw, bh); ctx.globalAlpha = 1;
        }
        // connector from previous top (waterfall feel)
        // CI whiskers
        if (it.ci) {
          var cxw = x + bw / 2, yl = yOf(it.ci[0]), yh = yOf(it.ci[1]);
          ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(cxw, yh); ctx.lineTo(cxw, yl);
          ctx.moveTo(cxw - 5, yh); ctx.lineTo(cxw + 5, yh);
          ctx.moveTo(cxw - 5, yl); ctx.lineTo(cxw + 5, yl); ctx.stroke();
        }
        // value label
        ctx.fillStyle = ink; ctx.font = "600 12px IBM Plex Mono"; ctx.textAlign = "center";
        ctx.fillText(H.fmt(it.sr, 2), x + bw / 2, y - (it.ci ? 16 : 6));
        ctx.textAlign = "left";
        // x label (wrapped)
        ctx.fillStyle = muted; ctx.font = "9.5px IBM Plex Mono";
        wrapText(ctx, it.label, x + bw / 2, top + plotH + 14, bw + gap - 2, 10);
        bars.push({ x: x, y: y, w: bw, h: bh, it: it });
      }
      ctx.font = "10px IBM Plex Mono"; ctx.fillStyle = muted;
      root._state = { bars: bars };
      H._live["sharpe"] = draw;
    }
    function wrapText(ctx, text, cx, y, maxW, lh) {
      ctx.textAlign = "center";
      var words = text.split(" "), lineStr = "", lines = [];
      for (var i = 0; i < words.length; i++) {
        var test = lineStr ? lineStr + " " + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && lineStr) { lines.push(lineStr); lineStr = words[i]; }
        else lineStr = test;
      }
      if (lineStr) lines.push(lineStr);
      lines = lines.slice(0, 3);
      for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], cx, y + j * lh);
      ctx.textAlign = "left";
    }
    draw();
    window.addEventListener("resize", function () { draw(); });
    canvas.addEventListener("mousemove", function (ev) {
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      var st = root._state; if (!st) return;
      for (var i = 0; i < st.bars.length; i++) {
        var b = st.bars[i];
        if (x >= b.x && x <= b.x + b.w && y >= Math.min(b.y, b.y + b.h) - 60 && y <= b.y + b.h) {
          var it = b.it;
          var html = "<b>" + it.label + "</b><br>Sharpe " + H.fmt(it.sr, 2);
          if (it.ci) html += "<br>95% CI [" + H.fmt(it.ci[0], 2) + ", " + H.fmt(it.ci[1], 2) + "]";
          if (it.delta) html += "<br>" + it.delta;
          if (it.kind === "mirage") html += "<br>in-sample selection — not tradable";
          if (it.kind === "collapse") html += "<br>winner's curse: ~5.9× of the gap is noise";
          tip.show(html, x, y);
          return;
        }
      }
      tip.hide();
    });
    canvas.addEventListener("mouseleave", function () { tip.hide(); });
  });
  // ===== 3) FACTOR ZOO =====
  register("zoo", function (root, H) {
    var canvas = root.querySelector("canvas");
    if (!canvas) { root.setAttribute("data-fallback", "true"); return; }
    var wrap = canvas.parentNode;
    var tip = H.makeTip(wrap);
    var N = 6960, DEFF = 17;
    var hurdleUniversal = Math.sqrt(2 * Math.log(N));      // ≈ 4.19
    var hurdleAlloc = Math.sqrt(2 * Math.log(DEFF));        // ≈ 2.38
    var mode = "universal"; // or "alloc"
    var keptPctEl = root.querySelector("[data-out=kept]");
    var cutEl = root.querySelector("[data-out=cut]");
    var hurdleEl = root.querySelector("[data-out=hurdle]");
    // Sample a representative cloud (fixed seed) of ~900 points standing in for N.
    // Reference-venue t and home-venue t are correlated (rho); we then affine-
    // calibrate each axis via quantiles so the drawn hurdles reproduce the paper's
    // headline: the universal hurdle √(2logN)≈4.19 admits ~6% of candidates, and
    // ~94% of genuinely home-profitable factors are wrongly discarded under it.
    var P = 900, pts = [], seed = 90125;
    function rr() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function gauss() { var u = Math.max(1e-9, rr()), v = rr(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var rho = 0.5, rawU = [], rawH = [];
    for (var i = 0; i < P; i++) {
      var g1 = gauss(), g2 = gauss();
      var h = Math.abs(rho * g1 + Math.sqrt(1 - rho * rho) * g2); // latent home strength
      rawH.push(h);
      rawU.push(rho * g1 + Math.sqrt(1 - rho * rho) * gauss() * 1.1); // weaker reference read
    }
    function quantile(arr, p) {
      var s = arr.slice().sort(function (a, b) { return a - b; });
      return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
    }
    // reference axis: q50→0.9, q94→hurdleUniversal (so ~6% clear the universal hurdle)
    var uq50 = quantile(rawU, 0.5), uq94 = quantile(rawU, 0.94);
    var ua = (hurdleUniversal - 0.9) / (uq94 - uq50), ub = 0.9 - ua * uq50;
    // home axis: q45→hurdleAlloc (so ~55% are "profitable"), q95→5.6
    var hq45 = quantile(rawH, 0.45), hq95 = quantile(rawH, 0.95);
    var ha = (5.6 - hurdleAlloc) / (hq95 - hq45), hb = hurdleAlloc - ha * hq45;
    for (var j = 0; j < P; j++) {
      pts.push({ u: ua * rawU[j] + ub, hhome: Math.max(0, ha * rawH[j] + hb) });
    }
    var toggle = root.querySelector(".viz-toggle");
    if (toggle) {
      toggle.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        mode = b.getAttribute("data-mode") || "universal";
        Array.prototype.forEach.call(toggle.querySelectorAll("button"), function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        draw();
      });
    }
    function draw() {
      var good = H.cssVar(root, "--viz-good", "#6dcea8");
      var warn = H.cssVar(root, "--viz-warn", "#c45c26");
      var muted = H.cssVar(root, "--viz-muted", "#8a93a3");
      var ink = H.cssVar(root, "--viz-ink", "#d7e0ea");
      var line = H.cssVar(root, "--viz-line", "rgba(215,224,234,0.18)");
      var fit = H.fitCanvas(canvas, 300);
      var ctx = fit.ctx, w = fit.w, h = fit.h;
      ctx.clearRect(0, 0, w, h);
      var pad = 44, pb = 36, top = 16;
      var plotW = w - pad - 16, plotH = h - top - pb;
      var AX = 7; // axis max t
      var xOf = function (t) { return pad + H.clamp(t / AX, -0.1, 1) * plotW; };
      var yOf = function (t) { return top + plotH - H.clamp(t / AX, 0, 1) * plotH; };
      // axes
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, top); ctx.lineTo(pad, top + plotH); ctx.lineTo(pad + plotW, top + plotH); ctx.stroke();
      ctx.fillStyle = muted; ctx.font = "10px IBM Plex Mono";
      ctx.fillText("|t| in reference venue →", pad + plotW - 150, top + plotH + 24);
      ctx.save(); ctx.translate(12, top + 90); ctx.rotate(-Math.PI / 2);
      ctx.fillText("|t| in home venue", 0, 0); ctx.restore();
      // hurdle line (vertical on reference-venue axis)
      var hurdle = mode === "universal" ? hurdleUniversal : hurdleAlloc;
      var hx = xOf(hurdle);
      // points
      var kept = 0, profitableN = 0, wrongDiscard = 0;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var px = xOf(p.u), py = yOf(p.hhome);
        // retained if reference-venue t clears the active hurdle
        var passes = p.u >= hurdle;
        // "truly profitable somewhere": home t clears the allocation hurdle
        var profitable = p.hhome >= hurdleAlloc;
        if (passes) kept++;
        if (profitable) { profitableN++; if (!passes) wrongDiscard++; }
        var col, alpha, rad;
        if (passes) { col = good; alpha = 0.9; rad = 2.6; }
        else if (profitable) { col = warn; alpha = 0.8; rad = 2.6; } // wrongly discarded
        else { col = muted; alpha = 0.25; rad = 1.8; }
        ctx.globalAlpha = alpha; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // hurdle line
      ctx.strokeStyle = mode === "universal" ? warn : good; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(hx, top); ctx.lineTo(hx, top + plotH); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = mode === "universal" ? warn : good; ctx.font = "11px IBM Plex Mono";
      var hlabel = mode === "universal" ? "√(2 log N) ≈ " + H.fmt(hurdleUniversal, 2) : "√(2 log d_eff) ≈ " + H.fmt(hurdleAlloc, 2);
      ctx.fillText(hlabel, hx + 6, top + 14);
      // readouts: kept = share of all candidates retained; cut = share of
      // genuinely-profitable factors wrongly discarded under the active hurdle.
      var keptPct = (kept / pts.length) * 100;
      var wrongPct = profitableN ? (wrongDiscard / profitableN) * 100 : 0;
      if (keptPctEl) keptPctEl.textContent = H.fmt(keptPct, 0) + "%";
      if (cutEl) cutEl.textContent = H.fmt(wrongPct, 0) + "%";
      if (hurdleEl) hurdleEl.textContent = H.fmt(hurdle, 2);
      root._state = { xOf: xOf, yOf: yOf, hurdle: hurdle, hurdleAlloc: hurdleAlloc };
      H._live["zoo"] = draw;
    }
    draw();
    window.addEventListener("resize", function () { draw(); });
    canvas.addEventListener("mousemove", function (ev) {
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      var st = root._state; if (!st) return;
      var best = null, bestD = 1e9;
      for (var i = 0; i < pts.length; i++) {
        var px = st.xOf(pts[i].u), py = st.yOf(pts[i].hhome);
        var d2 = (px - x) * (px - x) + (py - y) * (py - y);
        if (d2 < bestD) { bestD = d2; best = pts[i]; }
      }
      if (best && bestD < 220) {
        var passes = best.u >= st.hurdle;
        var profitable = best.hhome >= st.hurdleAlloc;
        var tag = passes ? "<b>kept</b>" : profitable ? "<b style='color:#c45c26'>wrongly discarded</b>" : "null";
        tip.show(tag + "<br>ref |t|=" + H.fmt(best.u, 2) + "<br>home |t|=" + H.fmt(best.hhome, 2), x, y);
      } else tip.hide();
    });
    canvas.addEventListener("mouseleave", function () { tip.hide(); });
  });
  /* __BUILDERS__ */

  // Re-render all ready vizzes on language/theme change if they registered a redraw.
  H._live = {};
  function refreshAll() {
    for (var k in H._live) { if (H._live.hasOwnProperty(k)) { try { H._live[k](); } catch (e) {} } }
  }
  window.addEventListener("viz:refresh", refreshAll);
  document.addEventListener("hj:theme", function () { setTimeout(refreshAll, 30); });
  document.addEventListener("hj:lang", function () { setTimeout(refreshAll, 30); });

  // Three-act narrative: highlight the divider as it enters the viewport.
  function bootActs() {
    var acts = Array.prototype.slice.call(document.querySelectorAll(".act-divider"));
    if (!acts.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      acts.forEach(function (a) { a.classList.add("act-live"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) en.target.classList.add("act-live");
      });
    }, { rootMargin: "0px 0px -35% 0px" });
    acts.forEach(function (a) { io.observe(a); });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootActs);
  } else { bootActs(); }

  window.__vizRegister = register;
})();
