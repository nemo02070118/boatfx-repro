/* ==========================================================================
   BOAT · 04b Autopsy bench
   --------------------------------------------------------------------------
   The paper's Proposition 2 turned into a device: paste a return series, a
   t-stat, or a whole factor library, and the bench applies the dilution
   identity to *your* numbers, in this tab, with no network call.

   Thresholds are the ones already printed on the page:
     screen      |t| >= 1.96                        (the unconditional gate)
     allocation  sqrt(2 ln d_eff), d_eff = 17  ->  2.38   (§04)
     discovery   sqrt(2 ln N)                  ->  4.21 at N = 6,960 (§04)

   Nothing here invents a number: every output is either arithmetic on the
   visitor's input or one of those three thresholds.
   ========================================================================== */
(function () {
  "use strict";

  var SCREEN = 1.96;
  var D_EFF = 17;
  var ALLOC = Math.sqrt(2 * Math.log(D_EFF)); /* 2.3803 */
  var TRADING_DAYS = 252;

  /* ------------------------------------------------------------- helpers */
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
  function f(x, d) {
    if (!isFinite(x)) return "—";
    return Number(x).toFixed(d == null ? 2 : d);
  }
  function pct(x, d) { return f(x * 100, d == null ? 1 : d) + "%"; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var x = Math.imul(s ^ (s >>> 15), 1 | s);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(u) {
    var a = u() || 1e-12, b = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
  }

  /* ---------------------------------------------------------------- math */
  function stats(xs) {
    var n = xs.length, i, s = 0;
    if (!n) return null;
    for (i = 0; i < n; i++) s += xs[i];
    var m = s / n, v = 0;
    for (i = 0; i < n; i++) { var d = xs[i] - m; v += d * d; }
    var sd = n > 1 ? Math.sqrt(v / (n - 1)) : 0;
    return {
      n: n,
      mean: m,
      sd: sd,
      t: sd > 0 ? m / (sd / Math.sqrt(n)) : (m === 0 ? 0 : Infinity),
      sharpe: sd > 0 ? (m / sd) * Math.sqrt(TRADING_DAYS) : 0
    };
  }

  function parseSeries(text) {
    var raw = String(text || "").split(/[\s,;]+/);
    var out = [], i, tok, v;
    for (i = 0; i < raw.length; i++) {
      tok = raw[i].trim();
      if (!tok) continue;
      /* drop date stamps and index columns so a pasted CSV still works */
      if (/^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/.test(tok)) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(tok)) continue;
      if (/%$/.test(tok)) {
        v = parseFloat(tok.slice(0, -1));
        if (isFinite(v) && Math.abs(v) < 1000) out.push(v / 100);
        continue;
      }
      v = parseFloat(tok);
      /* a daily return outside +/-1000% is a parse accident, not a return */
      if (isFinite(v) && Math.abs(v) < 10) out.push(v);
    }
    return out;
  }

  function parseLibrary(text) {
    var lines = String(text || "").split(/\r?\n/);
    var rows = [];
    lines.forEach(function (ln) {
      ln = ln.trim();
      if (!ln || ln.charAt(0) === "#") return;
      var parts = ln.split(/[,;\t]+/).filter(function (s) { return s.trim() !== ""; });
      var val = null, name = "", pi = null;
      if (parts.length >= 3) {
        /* name, t, π — the optional third column is the share of the panel that
           sits in this factor's own paying state. It overrides the slider for
           this row, which is the honest way to describe a real library: every
           factor has its own home venue, not one shared one. */
        var lastN = parseFloat(parts[parts.length - 1]);
        var prevN = parseFloat(parts[parts.length - 2]);
        if (isFinite(lastN) && lastN > 0 && lastN <= 1 && isFinite(prevN)) {
          pi = lastN;
          val = prevN;
          name = parts.slice(0, parts.length - 2).join(" ").trim();
        }
      }
      if (val == null) {
        if (parts.length >= 2) {
          val = parseFloat(parts[parts.length - 1]);
          name = parts.slice(0, parts.length - 1).join(" ").trim();
        } else {
          var bits = ln.split(/\s+/);
          val = parseFloat(bits[bits.length - 1]);
          name = bits.slice(0, bits.length - 1).join(" ");
        }
      }
      if (isFinite(val)) rows.push({ name: name || ("factor " + (rows.length + 1)), t: val, pi: pi });
    });
    return rows;
  }

  function verdictOf(tState, pi) {
    var tg = tState * Math.sqrt(pi);
    if (!isFinite(tState)) return { key: "weak", tg: tg };
    if (tg >= SCREEN) return { key: "pass", tg: tg };
    if (tState >= ALLOC) return { key: "miskill", tg: tg };
    return { key: "weak", tg: tg };
  }

  /* ---------------------------------------------------------------- chart */
  function curveSvg(tState, pi, piStar) {
    var W = 520, H = 236;
    var L = 46, R = 14, T = 16, B = 34;
    var ymax = Math.max(2.6, (isFinite(tState) ? tState : 0) * 1.12, SCREEN * 1.25);
    var x = function (p) { return L + p * (W - L - R); };
    var y = function (v) { return H - B - (v / ymax) * (H - B - T); };
    var path = [], p;
    for (p = 0; p <= 1.0001; p += 0.02) {
      path.push((p === 0 ? "M" : "L") + x(p).toFixed(1) + " " + y((isFinite(tState) ? tState : 0) * Math.sqrt(p)).toFixed(1));
    }
    var yScreen = y(SCREEN);
    var parts = [];
    parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"/>');
    /* grid */
    parts.push('<line x1="' + L + '" y1="' + y(0) + '" x2="' + (W - R) + '" y2="' + y(0) + '" stroke="currentColor" stroke-opacity=".22"/>');
    parts.push('<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + y(0) + '" stroke="currentColor" stroke-opacity=".22"/>');
    /* screen line */
    parts.push('<line x1="' + L + '" y1="' + yScreen + '" x2="' + (W - R) + '" y2="' + yScreen + '" stroke="var(--warn)" stroke-opacity=".55" stroke-dasharray="4 4"/>');
    parts.push('<text x="' + (W - R) + '" y="' + (yScreen - 5) + '" text-anchor="end">|t| = 1.96</text>');
    /* allocation line */
    if (ALLOC < ymax) {
      var yA = y(ALLOC);
      parts.push('<line x1="' + L + '" y1="' + yA + '" x2="' + (W - R) + '" y2="' + yA + '" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="2 5"/>');
      parts.push('<text x="' + (L + 4) + '" y="' + (yA - 4) + '">alloc 2.38</text>');
    }
    /* curve */
    parts.push('<path d="' + path.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="1.8"/>');
    /* pi* marker */
    if (isFinite(piStar) && piStar > 0 && piStar <= 1) {
      parts.push('<line x1="' + x(piStar) + '" y1="' + yScreen + '" x2="' + x(piStar) + '" y2="' + y(0) + '" stroke="var(--accent)" stroke-opacity=".35" stroke-dasharray="3 3"/>');
      parts.push('<text x="' + (x(piStar) + 4) + '" y="' + (y(0) - 6) + '">π* ' + f(piStar, 2) + '</text>');
    }
    /* point */
    var px = x(clamp(pi, 0, 1)), py = y(clamp((isFinite(tState) ? tState : 0) * Math.sqrt(pi), 0, ymax));
    parts.push('<circle cx="' + px + '" cy="' + py + '" r="4.5" fill="var(--warn)" stroke="var(--bg)" stroke-width="1.5"/>');
    /* axes labels */
    parts.push('<text x="' + L + '" y="' + (H - 12) + '">π = 0</text>');
    parts.push('<text x="' + (W - R) + '" y="' + (H - 12) + '" text-anchor="end">π = 1</text>');
    parts.push('<text x="' + L + '" y="' + (T - 4) + '">t_global = t_state · √π</text>');
    return '<svg class="bench-curve" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      t("Curve of the global t-statistic against the share of the panel in the paying state; your factor is the orange dot, the 1.96 gate is the dashed line.",
        "全局 t 值随兑现状态占比变化的曲线；橙色点是你输入的因子，虚线是 1.96 门槛。") + '">' + parts.join("") + '</svg>';
  }

  /* pooled t as a function of how many factors you put in the pool:
     mean|t| · √m. The crossing of the allocation hurdle is the number that
     matters — m* = (2.38 / mean)². */
  function poolCurve(mean, n) {
    if (!(mean > 0) || !(n >= 2)) return "";
    var W = 520, H = 172, L = 46, R = 16, T = 18, B = 32;
    var top = Math.max(2.9, mean * Math.sqrt(n) * 1.08);
    var x = function (m) { return L + ((m - 1) / Math.max(1, n - 1)) * (W - L - R); };
    var y = function (v) { return H - B - (Math.min(v, top) / top) * (H - B - T); };
    var mStar = Math.pow(ALLOC / mean, 2);
    var pts = [], m;
    for (m = 1; m <= n; m++) pts.push(x(m).toFixed(1) + " " + y(mean * Math.sqrt(m)).toFixed(1));
    var p = [];
    p.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"/>');
    p.push('<line x1="' + L + '" y1="' + y(0) + '" x2="' + (W - R) + '" y2="' + y(0) + '" stroke="currentColor" stroke-opacity=".22"/>');
    p.push('<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + y(0) + '" stroke="currentColor" stroke-opacity=".22"/>');
    var yA = y(ALLOC);
    p.push('<line x1="' + L + '" y1="' + yA + '" x2="' + (W - R) + '" y2="' + yA + '" stroke="var(--warn)" stroke-opacity=".6" stroke-dasharray="4 4"/>');
    p.push('<text x="' + (W - R) + '" y="' + (yA - 5) + '" text-anchor="end">alloc 2.38</text>');
    p.push('<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="1.8"/>');
    if (mStar >= 1 && mStar <= n) {
      p.push('<line x1="' + x(mStar) + '" y1="' + yA + '" x2="' + x(mStar) + '" y2="' + y(0) + '" stroke="var(--accent)" stroke-opacity=".4" stroke-dasharray="3 3"/>');
      p.push('<circle cx="' + x(mStar) + '" cy="' + yA + '" r="4" fill="var(--warn)" stroke="var(--bg)" stroke-width="1.5"/>');
      p.push('<text x="' + (x(mStar) + 6) + '" y="' + (y(0) - 6) + '">m* ' + f(mStar, 1) + '</text>');
    }
    p.push('<text x="' + L + '" y="' + (H - 12) + '">1</text>');
    p.push('<text x="' + (W - R) + '" y="' + (H - 12) + '" text-anchor="end">' + n + '</text>');
    p.push('<text x="' + (L + 4) + '" y="' + (T - 5) + '">pooled t · pool size m</text>');
    return '<svg class="bench-curve bench-poolcurve" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      t("Pooled t-statistic against the number of factors in the pool; the dashed line is the 2.38 allocation hurdle.",
        "合并 t 值随池中因子数变化；虚线是 2.38 配置门槛。") + '">' + p.join("") + '</svg>';
  }

  /* --------------------------------------------------------------- markup */
  var root, seriesEl, statTEl, statNEl, libEl, piEl, piOut, nEl, nOut;
  var outEl, verdictEl, readEl, curveWrap, batchWrap, copyBtn;
  var mode = "series";
  var last = null;

  function build() {
    var host = document.querySelector("#machine .viz[data-viz='zoo']");
    if (!host || document.getElementById("bench")) return;

    root = el("div", "bench");
    root.id = "bench";

    var head = el("div", "bench-head");
    head.appendChild(el("p", "bench-kicker", t("04b · Autopsy bench", "04b · 误杀解剖台")));
    head.appendChild(el("h3", "bench-title", t("Throw your own factor in", "把你的因子扔进来")));
    head.appendChild(el("p", "bench-lede", t(
      "Paste a return series, a t-stat, or your whole factor library. The bench runs the paper's dilution identity on your numbers — everything is computed in this tab, nothing is uploaded, and every threshold shown is one already printed on this page.",
      "粘贴一段收益序列、一个 t 值，或者你整个因子库。解剖台会用论文的稀释恒等式算你自己的数字——全部在本页计算，不上传任何东西，所有阈值都是本页已经写明的那些。"
    )));
    root.appendChild(head);

    var grid = el("div", "bench-grid");

    /* ---------------- inputs ---------------- */
    var inp = el("div", "bench-input");
    var tabs = el("div", "bench-tabs");
    tabs.setAttribute("role", "tablist");
    [["series", t("Return series", "收益序列")], ["stat", t("t-stat", "t 值")], ["batch", t("Factor library", "因子库")]].forEach(function (pair) {
      var b = el("button", "bench-tab" + (pair[0] === mode ? " active" : ""), pair[1]);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.mode = pair[0];
      b.addEventListener("click", function () { setMode(pair[0]); });
      tabs.appendChild(b);
    });
    inp.appendChild(tabs);

    /* series pane */
    var paneSeries = el("div", "bench-pane");
    paneSeries.dataset.pane = "series";
    var l1 = el("label", "bench-label", t("Daily returns · comma, space or newline separated", "日收益 · 逗号 / 空格 / 换行分隔"));
    l1.setAttribute("for", "bench-series");
    paneSeries.appendChild(l1);
    seriesEl = el("textarea", "bench-textarea");
    seriesEl.id = "bench-series";
    seriesEl.spellcheck = false;
    seriesEl.placeholder = "0.0041, -0.0022, 0.0113, 0.0004, …";
    paneSeries.appendChild(seriesEl);
    var row1 = el("div", "bench-row");
    var demoBtn = el("button", "bench-btn", t("Load a demo series", "载入示例序列"));
    demoBtn.type = "button";
    demoBtn.addEventListener("click", loadDemo);
    row1.appendChild(demoBtn);
    row1.appendChild(el("span", "bench-hint", t("252 days · t = 2.60 · synthetic, seeded", "252 个交易日 · t = 2.60 · 合成、固定种子")));
    paneSeries.appendChild(row1);
    inp.appendChild(paneSeries);

    /* stat pane */
    var paneStat = el("div", "bench-pane");
    paneStat.dataset.pane = "stat";
    paneStat.hidden = true;
    var rowStat = el("div", "bench-stat-row");
    var wrapT = el("div");
    var lt = el("label", "bench-label", t("t-stat inside the paying state", "兑现状态内的 t 值"));
    lt.setAttribute("for", "bench-t");
    wrapT.appendChild(lt);
    statTEl = el("input", "bench-num");
    statTEl.id = "bench-t";
    statTEl.type = "number";
    statTEl.step = "0.01";
    statTEl.value = "2.40";
    wrapT.appendChild(statTEl);
    var wrapN = el("div");
    var ln = el("label", "bench-label", t("Observations (optional)", "观测数（可选）"));
    ln.setAttribute("for", "bench-obs");
    wrapN.appendChild(ln);
    statNEl = el("input", "bench-num");
    statNEl.id = "bench-obs";
    statNEl.type = "number";
    statNEl.step = "1";
    statNEl.value = "252";
    wrapN.appendChild(statNEl);
    rowStat.appendChild(wrapT);
    rowStat.appendChild(wrapN);
    paneStat.appendChild(rowStat);
    var rowStat2 = el("div", "bench-row");
    rowStat2.appendChild(el("span", "bench-hint", t("Already have the number? Skip the series.", "已经有 t 值？跳过序列。")));
    paneStat.appendChild(rowStat2);
    inp.appendChild(paneStat);

    /* batch pane */
    var paneBatch = el("div", "bench-pane");
    paneBatch.dataset.pane = "batch";
    paneBatch.hidden = true;
    var lb = el("label", "bench-label", t("One factor per line · name, t  or  name, t, π", "每行一个因子 · 名称, t  或  名称, t, π"));
    lb.setAttribute("for", "bench-lib");
    paneBatch.appendChild(lb);
    libEl = el("textarea", "bench-textarea");
    libEl.id = "bench-lib";
    libEl.spellcheck = false;
    libEl.placeholder = "reversal_5d, 2.71\nnet_quote_demand_rank, 3.04, 0.12\nvolume_price_corr, 1.62";
    paneBatch.appendChild(libEl);
    var row2 = el("div", "bench-row");
    var demoLib = el("button", "bench-btn", t("Load a demo library", "载入示例因子库"));
    demoLib.type = "button";
    demoLib.addEventListener("click", loadDemoLib);
    row2.appendChild(demoLib);
    row2.appendChild(el("span", "bench-hint", t("12 synthetic factors · seeded · π on five of them", "12 个合成因子 · 固定种子 · 其中 5 个自带 π")));
    paneBatch.appendChild(row2);

    /* simulate a library — so a visitor with no data of their own can still
       put the screen under load. Parameters are explicit; nothing is hidden. */
    var simRow = el("div", "bench-row sim-row");
    simRow.appendChild(el("span", "bench-hint", t("or simulate:", "或模拟：")));
    function numBox(val, label, w) {
      var i = el("input", "bench-num small");
      i.type = "number";
      i.value = val;
      i.setAttribute("aria-label", label);
      i.title = label;
      if (w) i.style.width = w;
      return i;
    }
    var simN = numBox("40", t("how many factors", "多少个因子"));
    var simAlive = numBox("35", t("share with a real home-state edge, %", "有真实状态内优势的比例 %"));
    var simMu = numBox("2.2", t("typical t inside the state", "状态内典型 t"));
    simRow.appendChild(simN);
    simRow.appendChild(el("span", "bench-hint", t("factors ·", "个因子 ·")));
    simRow.appendChild(simAlive);
    simRow.appendChild(el("span", "bench-hint", t("% alive ·", "% 有优势 ·")));
    simRow.appendChild(simMu);
    simRow.appendChild(el("span", "bench-hint", "t"));
    var genBtn = el("button", "bench-btn", t("Generate", "生成"));
    genBtn.type = "button";
    genBtn.id = "bench-gen";
    genBtn.addEventListener("click", function () {
      loadSimLibrary(parseInt(simN.value, 10), parseInt(simAlive.value, 10), parseFloat(simMu.value));
    });
    simRow.appendChild(genBtn);
    paneBatch.appendChild(simRow);
    inp.appendChild(paneBatch);

    /* controls */
    var ctl = el("div", "bench-controls");
    var h1 = el("div", "bench-ctl-head");
    h1.appendChild(el("span", null, t("π · share of the panel in the paying state", "π · 兑现状态占面板的比例")));
    piOut = el("output", null, "0.25");
    h1.appendChild(piOut);
    ctl.appendChild(h1);
    piEl = el("input", "bench-range");
    piEl.id = "bench-pi";
    piEl.type = "range";
    piEl.min = "1";
    piEl.max = "100";
    piEl.value = "25";
    piEl.setAttribute("aria-label", t("Share of the panel in the paying state", "兑现状态占面板的比例"));
    ctl.appendChild(piEl);

    var h2 = el("div", "bench-ctl-head");
    h2.appendChild(el("span", null, t("N · candidates screened alongside it", "N · 与它一起被筛的候选数")));
    nOut = el("output", null, "6,960");
    h2.appendChild(nOut);
    ctl.appendChild(h2);
    nEl = el("input", "bench-range");
    nEl.id = "bench-n";
    nEl.type = "range";
    nEl.min = "100";
    nEl.max = "20000";
    nEl.step = "20";
    nEl.value = "6960";
    nEl.setAttribute("aria-label", t("Number of candidates screened", "一起被筛的候选数量"));
    ctl.appendChild(nEl);
    inp.appendChild(ctl);

    grid.appendChild(inp);

    /* ---------------- output ---------------- */
    outEl = el("div", "bench-out");

    verdictEl = el("div", "bench-verdict");
    verdictEl.dataset.verdict = "miskill";
    verdictEl.setAttribute("role", "status");
    verdictEl.setAttribute("aria-live", "polite");
    verdictEl.innerHTML = '<span class="bv-k">' + t("verdict", "判决") + '</span><b>—</b><p></p>';
    outEl.appendChild(verdictEl);

    readEl = el("dl", "bench-read");
    outEl.appendChild(readEl);

    curveWrap = el("div");
    outEl.appendChild(curveWrap);

    batchWrap = el("div");
    batchWrap.hidden = true;
    outEl.appendChild(batchWrap);

    var foot = el("div", "bench-foot");
    copyBtn = el("button", "bench-btn", t("Copy report", "复制报告"));
    copyBtn.type = "button";
    foot.appendChild(copyBtn);
    foot.appendChild(el("span", "spacer"));
    foot.appendChild(el("span", null, t("computed in this tab · Prop. 2 · §04", "本页计算 · 命题 2 · §04")));
    outEl.appendChild(foot);

    grid.appendChild(outEl);
    root.appendChild(grid);
    host.parentNode.insertBefore(root, host.nextSibling);

    /* events */
    seriesEl.addEventListener("input", debounce(run, 220));
    statTEl.addEventListener("input", debounce(run, 160));
    statNEl.addEventListener("input", debounce(run, 160));
    libEl.addEventListener("input", debounce(run, 260));
    piEl.addEventListener("input", function () {
      piOut.textContent = f(parseInt(piEl.value, 10) / 100, 2);
      run();
    });
    nEl.addEventListener("input", function () {
      nOut.textContent = Number(nEl.value).toLocaleString("en-US");
      run();
    });
    copyBtn.addEventListener("click", copyReport);
    document.addEventListener("hj:lang", relabel);

    loadDemo();
  }

  function setMode(m) {
    mode = m;
    root.querySelectorAll(".bench-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === m);
      b.setAttribute("aria-selected", b.dataset.mode === m ? "true" : "false");
    });
    root.querySelectorAll(".bench-pane").forEach(function (p) {
      p.hidden = p.dataset.pane !== m;
    });
    if (m === "batch" && !libEl.value.trim()) {
      loadDemoLib();
      return;
    }
    run();
  }

  var dTimer = null;
  function debounce(fn, ms) {
    return function () {
      clearTimeout(dTimer);
      dTimer = setTimeout(fn, ms);
    };
  }

  /* ---------------------------------------------------------------- demos */
  function loadDemo() {
    var n = 252, target = 2.60, sdTarget = 0.012;
    var u = rng(20261105), xs = [], i;
    for (i = 0; i < n; i++) xs.push(gauss(u));
    var st = stats(xs);
    var meanTarget = target * sdTarget / Math.sqrt(n);
    var out = xs.map(function (z) { return ((z - st.mean) / st.sd) * sdTarget + meanTarget; });
    seriesEl.value = out.map(function (v) { return v.toFixed(5); }).join(", ");
    run();
  }

  /* a synthetic library, with its parameters on the surface. The point is not
     the numbers — it is that the screen's behaviour is visible at any scale. */
  function loadSimLibrary(n, alivePct, mu) {
    n = Math.min(Math.max(n || 40, 4), 400);
    var share = Math.min(Math.max((alivePct || 0) / 100, 0), 1);
    mu = Math.min(Math.max(mu || 2, 0.5), 6);
    var u = rng(20261105), lines = [], i;
    for (i = 0; i < n; i++) {
      var alive = u() < share;
      var tState = alive ? Math.max(1.05, mu + gauss(u) * 0.55) : Math.abs(gauss(u)) * 1.15;
      var pi = 0.03 + u() * 0.32;
      var id = String(i + 1);
      while (id.length < 3) id = "0" + id;
      lines.push("sim_" + id + ", " + tState.toFixed(2) + ", " + pi.toFixed(2));
    }
    libEl.value = lines.join("\n");
    if (mode !== "batch") setMode("batch");
    run();
  }

  function loadDemoLib() {
    var u = rng(77031);
    var names = ["reversal_5d", "net_quote_demand_rank", "volume_price_corr", "microprice_pressure",
      "idio_vol_60d", "turnover_shock", "amihud_illiq", "overnight_gap", "intraday_range",
      "beta_dispersion", "earnings_drift", "short_interest_delta"];
    /* five rows carry their own home-state share, to show the third column */
    var homes = [0, 2, 4, 7, 10];
    var lines = names.map(function (nm, i) {
      var tv = (1.2 + u() * 2.6).toFixed(2);
      if (homes.indexOf(i) < 0) return nm + ", " + tv;
      var p = (0.04 + u() * 0.30).toFixed(2);
      return nm + ", " + tv + ", " + p;
    });
    libEl.value = lines.join("\n");
    run();
  }

  /* ----------------------------------------------------------------- run */
  function run() {
    if (!root) return;
    var pi = parseInt(piEl.value, 10) / 100;
    var N = parseInt(nEl.value, 10);
    var discovery = Math.sqrt(2 * Math.log(N));

    if (mode === "batch") return runBatch(pi, N, discovery);

    var tState, nObs = null, note = "";
    if (mode === "series") {
      var xs = parseSeries(seriesEl.value);
      var st = stats(xs);
      if (!st || st.n < 2) {
        return paintEmpty(t("Paste at least two numbers to start.", "至少粘贴两个数字开始。"));
      }
      if (!(st.sd > 0)) {
        return paintEmpty(t("This series has no variance — there is nothing to test.", "这段序列没有方差——没有可检验的东西。"));
      }
      tState = Math.abs(st.t);
      nObs = st.n;
      note = "series";
      last = { tState: tState, n: st.n, mean: st.mean, sd: st.sd, sharpe: st.sharpe, pi: pi, N: N };
    } else {
      tState = Math.abs(parseFloat(statTEl.value));
      nObs = parseInt(statNEl.value, 10);
      if (!isFinite(tState) || tState === 0) {
        return paintEmpty(t("Enter a t-stat.", "输入一个 t 值。"));
      }
      last = { tState: tState, n: isFinite(nObs) ? nObs : null, pi: pi, N: N };
    }

    var v = verdictOf(tState, pi);
    var piStar = tState > 0 ? Math.pow(SCREEN / tState, 2) : Infinity;

    var K = {
      pass: [t("PASSES THE SCREEN", "通过筛选"), t("This factor clears the unconditional gate on its own. Rare — and not what the paper is about.", "这个因子自己就过了无条件门槛。很少见——也不是论文要讲的事。")],
      miskill: [t("MIS-KILLED", "被误杀"), t("Alive inside its state, invisible globally. This is the exact population the paper argues is discarded by construction.", "在兑现状态里活着，在全局看不见。这正是论文所说被结构性丢弃的那一类。")],
      weak: [t("WEAK", "偏弱"), t("Below the allocation hurdle too. The screen is not what is killing it — the signal is.", "也低于配置门槛。杀死它的不是筛选，是信号本身。")]
    }[v.key];

    verdictEl.dataset.verdict = v.key;
    verdictEl.querySelector("b").textContent = K[0];
    verdictEl.querySelector("p").textContent = K[1];

    var rows = [];
    rows.push([t("t inside the state", "状态内 t"), f(tState, 2), ""]);
    if (last.sharpe != null) rows.push([t("annualized Sharpe", "年化 Sharpe"), f(last.sharpe, 2), ""]);
    if (last.n) rows.push([t("observations", "观测数"), String(last.n), ""]);
    rows.push([t("global t = t · √π", "全局 t = t · √π"), f(v.tg, 2), v.tg >= SCREEN ? "ok" : "hot"]);
    rows.push([t("unconditional gate", "无条件门槛"), "1.96", ""]);
    rows.push([t("allocation hurdle √(2 ln d_eff)", "配置门槛 √(2 ln d_eff)"), f(ALLOC, 2), ""]);
    rows.push([t("discovery hurdle √(2 ln N)", "发现门槛 √(2 ln N)"), f(discovery, 2) + "  (N=" + N.toLocaleString("en-US") + ")", ""]);
    rows.push([t("π needed to survive", "幸存所需 π"), isFinite(piStar) ? (piStar > 1 ? t("unreachable", "不可达") : f(piStar, 2)) : "—", isFinite(piStar) && piStar <= 1 ? "ok" : "hot"]);

    readEl.innerHTML = rows.map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd class="' + r[2] + '">' + r[1] + '</dd></div>';
    }).join("");

    curveWrap.hidden = false;
    curveWrap.innerHTML = curveSvg(tState, pi, piStar);
    batchWrap.hidden = true;
  }

  function runBatch(pi, N, discovery) {
    var rows = parseLibrary(libEl.value);
    if (!rows.length) return paintEmpty(t("Paste one factor per line: name, t.", "每行粘贴一个因子：名称, t。"));

    var pass = 0, mis = 0, weak = 0, misList = [], withPi = 0, sum = 0, best = 0;
    rows.forEach(function (r) {
      var p = r.pi != null ? r.pi : pi;
      if (r.pi != null) withPi++;
      r.used = p;
      var at = Math.abs(r.t);
      sum += at;
      if (at > best) best = at;
      var v = verdictOf(at, p);
      if (v.key === "pass") pass++;
      else if (v.key === "miskill") { mis++; misList.push(r); }
      else weak++;
    });

    var total = rows.length;
    var mean = sum / total;
    var pooled = mean * Math.sqrt(total);
    var misMean = 0, pooledMis = 0;
    misList.forEach(function (r) { misMean += Math.abs(r.t); });
    if (misList.length) {
      misMean /= misList.length;
      pooledMis = misMean * Math.sqrt(misList.length);
    }
    var w = function (x) { return (x / total) * 100; };
    var piLabel = withPi >= total
      ? t("each row's own π", "每行自带的 π")
      : withPi
        ? t("each row's own π (slider " + f(pi, 2) + " for the rest)", "每行自带的 π（其余用滑块 " + f(pi, 2) + "）")
        : "π = " + f(pi, 2);

    verdictEl.dataset.verdict = mis >= total * 0.5 ? "miskill" : (pass >= total * 0.5 ? "pass" : "weak");
    verdictEl.querySelector("b").textContent = t(
      mis + " of " + total + " would be mis-killed",
      total + " 个里有 " + mis + " 个会被误杀"
    );
    verdictEl.querySelector("p").textContent = t(
      "At " + piLabel + ", the screen keeps " + pass + " and discards " + mis + " that clear the allocation hurdle inside their own state.",
      "在" + piLabel + "下，筛选留下 " + pass + " 个，丢掉 " + mis + " 个在自身状态里已过配置门槛的因子。"
    );

    var read = [
      [t("factors in the library", "因子库规模"), String(total), ""]
    ];
    if (withPi) {
      read.push([t("rows carrying their own π", "自带 π 的行"), withPi + " / " + total, ""]);
    }
    read.push(
      [t("pass the screen", "通过筛选"), pass + "  (" + f(w(pass), 1) + "%)", ""],
      [t("mis-killed", "被误杀"), mis + "  (" + f(w(mis), 1) + "%)", "hot"],
      [t("below allocation hurdle", "低于配置门槛"), weak + "  (" + f(w(weak), 1) + "%)", ""],
      [t("discovery hurdle", "发现门槛"), f(discovery, 2) + "  (N=" + N.toLocaleString("en-US") + ")", ""]
    );
    readEl.innerHTML = read.map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd class="' + r[2] + '">' + r[1] + '</dd></div>';
    }).join("");

    curveWrap.hidden = true;
    batchWrap.hidden = false;
    misList.sort(function (a, b) { return Math.abs(b.t) - Math.abs(a.t); });

    var clears = pooled >= ALLOC;
    var pool =
      '<div class="bench-pool">' +
      '<p class="bp-head">' + t("pooling · equal weight, independent (Stouffer)", "合并 · 等权、独立（Stouffer）") + '</p>' +
      '<div class="bp-grid">' +
      '<div><span>n</span><b>' + total + '</b></div>' +
      '<div><span>' + t("mean |t|", "平均 |t|") + '</span><b>' + f(mean, 2) + '</b></div>' +
      '<div><span>' + t("best |t|", "最大 |t|") + '</span><b>' + f(best, 2) + '</b></div>' +
      '<div class="bp-key"><span>' + t("pooled t = mean · √n", "合并 t = 均值 · √n") + '</span><b class="' + (clears ? "ok" : "hot") + '">' + f(pooled, 2) + '</b></div>' +
      '</div>' +
      '<p class="bp-note">' + (clears
        ? t("Not one of these rows has to clear 1.96 for the group to clear 2.38. That is the paper's entire move — the √n in the pooling, not any single factor.",
          "这些行里没有一行需要过 1.96，整组就能过 2.38。这就是论文的全部动作——力量来自合并里的 √n，而不是任何单个因子。")
        : t("The group does not clear 2.38 either. Pooling buys √n, and √n is not free money.",
          "整组也没过 2.38。合并买来的是 √n，而 √n 不是白送的钱。")) +
      (misList.length
        ? t(" Mis-killed subset alone pools to " + f(pooledMis, 2) + ".", " 仅被误杀的那 " + misList.length + " 个合并为 " + f(pooledMis, 2) + "。")
        : "") +
      (mean > 0 && Math.pow(ALLOC / mean, 2) <= total
        ? t(" You need about " + Math.ceil(Math.pow(ALLOC / mean, 2)) + " of these in the pool to clear the hurdle.",
          " 大约需要把 " + Math.ceil(Math.pow(ALLOC / mean, 2)) + " 个放进池子才能过这道门槛。")
        : "") +
      '</p>' +
      '<div class="bp-curve">' + poolCurve(mean, total) + '</div>' +
      '<p class="bp-caveat">' + t("assumes independent tests; correlation lowers it — which is why the paper reports GRS F = 51 rather than a pooled t.",
        "假设检验相互独立；相关性会拉低它——所以论文报的是 GRS F = 51，而不是一个合并 t。") + '</p>' +
      '</div>';

    batchWrap.innerHTML =
      '<div class="bench-batch-bar">' +
      '<i class="s-pass" style="width:' + w(pass) + '%"></i>' +
      '<i class="s-mis" style="width:' + w(mis) + '%"></i>' +
      '<i class="s-weak" style="width:' + w(weak) + '%"></i>' +
      '</div>' +
      '<div class="bench-batch-legend">' +
      '<span><b>' + pass + '</b> ' + t("pass", "通过") + '</span>' +
      '<span><b>' + mis + '</b> ' + t("mis-killed", "被误杀") + '</span>' +
      '<span><b>' + weak + '</b> ' + t("weak", "偏弱") + '</span>' +
      '</div>' +
      pool +
      (misList.length
        ? '<div class="bench-list">' + misList.slice(0, 40).map(function (r) {
          return '<div><span>' + escapeHtml(r.name) + '</span><span>t ' + f(Math.abs(r.t), 2) +
            ' · π ' + f(r.used, 2) + ' → ' + f(Math.abs(r.t) * Math.sqrt(r.used), 2) + '</span></div>';
        }).join("") + '</div>'
        : '<div class="bench-empty">' + t("Nothing is being mis-killed at this π.", "在这个 π 下没有因子被误杀。") + '</div>');

    last = {
      batch: true, total: total, pass: pass, mis: mis, weak: weak, pi: pi, N: N,
      withPi: withPi, mean: mean, best: best, pooled: pooled, pooledMis: pooledMis,
      rows: rows
    };
  }

  function paintEmpty(msg) {
    verdictEl.dataset.verdict = "weak";
    verdictEl.querySelector("b").textContent = "—";
    verdictEl.querySelector("p").textContent = msg;
    readEl.innerHTML = "";
    curveWrap.hidden = true;
    batchWrap.hidden = true;
    last = null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* --------------------------------------------------------------- copy */
  function copyReport() {
    if (!last) return;
    var lines;
    if (last.batch) {
      lines = [
        "BOAT autopsy bench — factor library",
        "factors: " + last.total + " · pass " + last.pass + " · mis-killed " + last.mis + " · weak " + last.weak,
        "π: " + (last.withPi ? last.withPi + " rows carry their own, slider " + f(last.pi, 2) + " for the rest" : f(last.pi, 2)) + " · N = " + last.N,
        "pooled t = mean|t| · √n = " + f(last.mean, 2) + " · √" + last.total + " = " + f(last.pooled, 2) +
          " (allocation hurdle " + f(ALLOC, 2) + ")",
        last.mis ? "mis-killed subset pools to " + f(last.pooledMis, 2) : "",
        "identity: t_global = t_state · √π · gates 1.96 / 2.38 / √(2 ln N)",
        "source: Proposition 2, Discarded but Alive (SSRN 7607684)"
      ].filter(Boolean);
    } else {
      lines = [
        "BOAT autopsy bench",
        "t_state = " + f(last.tState, 2) + (last.n ? " · n = " + last.n : ""),
        "π = " + f(last.pi, 2) + " → t_global = " + f(last.tState * Math.sqrt(last.pi), 2),
        "gate 1.96 · allocation 2.38 · discovery √(2 ln " + last.N + ") = " + f(Math.sqrt(2 * Math.log(last.N)), 2),
        "source: Proposition 2, Discarded but Alive (SSRN 7607684)"
      ];
    }
    var txt = lines.join("\n");
    var done = function () {
      copyBtn.textContent = t("Copied", "已复制");
      setTimeout(function () { copyBtn.textContent = t("Copy report", "复制报告"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }
  }

  /* --------------------------------------------------------------- i18n */
  function relabel() {
    if (!root) return;
    root.querySelector(".bench-kicker").textContent = t("04b · Autopsy bench", "04b · 误杀解剖台");
    root.querySelector(".bench-title").textContent = t("Throw your own factor in", "把你的因子扔进来");
    root.querySelector(".bench-lede").textContent = t(
      "Paste a return series, a t-stat, or your whole factor library. The bench runs the paper's dilution identity on your numbers — everything is computed in this tab, nothing is uploaded, and every threshold shown is one already printed on this page.",
      "粘贴一段收益序列、一个 t 值，或者你整个因子库。解剖台会用论文的稀释恒等式算你自己的数字——全部在本页计算，不上传任何东西，所有阈值都是本页已经写明的那些。"
    );
    var labels = root.querySelectorAll(".bench-tab");
    var names = [[t("Return series", "收益序列")], [t("t-stat", "t 值")], [t("Factor library", "因子库")]];
    labels.forEach(function (b, i) { b.textContent = names[i][0]; });
    root.querySelectorAll(".bench-label")[0].textContent = t("Daily returns · comma, space or newline separated", "日收益 · 逗号 / 空格 / 换行分隔");
    root.querySelectorAll(".bench-label")[1].textContent = t("t-stat inside the paying state", "兑现状态内的 t 值");
    root.querySelectorAll(".bench-label")[2].textContent = t("Observations (optional)", "观测数（可选）");
    root.querySelectorAll(".bench-label")[3].textContent = t("One factor per line · name, t  or  name, t, π", "每行一个因子 · 名称, t  或  名称, t, π");
    var ctlHeads = root.querySelectorAll(".bench-ctl-head span");
    if (ctlHeads[0]) ctlHeads[0].textContent = t("π · share of the panel in the paying state", "π · 兑现状态占面板的比例");
    if (ctlHeads[1]) ctlHeads[1].textContent = t("N · candidates screened alongside it", "N · 与它一起被筛的候选数");
    copyBtn.textContent = t("Copy report", "复制报告");
    root.querySelector(".bench-foot span:last-child").textContent = t("computed in this tab · Prop. 2 · §04", "本页计算 · 命题 2 · §04");
    var jump = document.querySelector(".bench-jump");
    if (jump) jump.textContent = t("Now run your own factor through this gate →", "现在把你的因子放进这道闸门 →");
    run();
  }

  /* ---------------------------------------------------------------- init */
  function currentStats() {
    if (!last) return null;
    if (last.batch) {
      return {
        source: "library", n: last.total, mean: last.mean, best: last.best,
        pooledT: last.pooled, pooledMis: last.pooledMis, mis: last.mis,
        pass: last.pass, weak: last.weak, pi: last.pi, N: last.N, withPi: last.withPi,
        rows: last.rows
      };
    }
    return {
      source: last.n ? "series" : "stat", n: last.n || 1, mean: last.tState,
      best: last.tState, pooledT: last.tState, pi: last.pi, N: last.N
    };
  }

  function init() {
    build();
    var api = {
      focus: function (m) {
        if (!root) return;
        root.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(function () {
          setMode(m === "batch" || m === "stat" ? m : "series");
          var node = m === "batch" ? libEl : (m === "stat" ? statTEl : seriesEl);
          if (node) node.focus({ preventScroll: true });
        }, 520);
      },
      stats: currentStats,
      generate: loadSimLibrary,
      prefill: function (tState, pi) {
        if (!root) return;
        setMode("stat");
        statTEl.value = String(tState);
        if (pi != null && isFinite(pi)) {
          piEl.value = String(Math.round(clamp(pi, 0.01, 1) * 100));
          piOut.textContent = f(parseInt(piEl.value, 10) / 100, 2);
        }
        run();
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      verdict: function () { return last; }
    };
    window.HJ_BENCH = api;
  }

  /* Same reasoning as gate.js: the host node is already parsed by the time this
     end-of-body script runs, so initialise now rather than on DOMContentLoaded.
     Language resolution reads localStorage, so the labels are identical either
     way, and hj:lang still relabels on toggle. */
  if (document.readyState === "loading" &&
      !document.querySelector("#machine .viz[data-viz='zoo']")) {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
