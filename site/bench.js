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
      if (/%$/.test(tok)) {
        v = parseFloat(tok.slice(0, -1));
        if (isFinite(v)) out.push(v / 100);
        continue;
      }
      v = parseFloat(tok);
      if (isFinite(v)) out.push(v);
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
      var val = null, name = "";
      if (parts.length >= 2) {
        val = parseFloat(parts[parts.length - 1]);
        name = parts.slice(0, parts.length - 1).join(" ").trim();
      } else {
        var bits = ln.split(/\s+/);
        val = parseFloat(bits[bits.length - 1]);
        name = bits.slice(0, bits.length - 1).join(" ");
      }
      if (isFinite(val)) rows.push({ name: name || ("factor " + (rows.length + 1)), t: val });
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
    var lb = el("label", "bench-label", t("One factor per line · name, t", "每行一个因子 · 名称, t"));
    lb.setAttribute("for", "bench-lib");
    paneBatch.appendChild(lb);
    libEl = el("textarea", "bench-textarea");
    libEl.id = "bench-lib";
    libEl.spellcheck = false;
    libEl.placeholder = "reversal_5d, 2.71\nnet_quote_demand_rank, 3.04\nvolume_price_corr, 1.62";
    paneBatch.appendChild(libEl);
    var row2 = el("div", "bench-row");
    var demoLib = el("button", "bench-btn", t("Load a demo library", "载入示例因子库"));
    demoLib.type = "button";
    demoLib.addEventListener("click", loadDemoLib);
    row2.appendChild(demoLib);
    row2.appendChild(el("span", "bench-hint", t("12 synthetic factors · seeded", "12 个合成因子 · 固定种子")));
    paneBatch.appendChild(row2);
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

  function loadDemoLib() {
    var u = rng(77031);
    var names = ["reversal_5d", "net_quote_demand_rank", "volume_price_corr", "microprice_pressure",
      "idio_vol_60d", "turnover_shock", "amihud_illiq", "overnight_gap", "intraday_range",
      "beta_dispersion", "earnings_drift", "short_interest_delta"];
    var lines = names.map(function (nm) {
      return nm + ", " + (1.2 + u() * 2.6).toFixed(2);
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
      if (!st || st.n < 2 || !isFinite(st.t)) {
        return paintEmpty(t("Paste at least two numbers to start.", "至少粘贴两个数字开始。"));
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
    var pass = 0, mis = 0, weak = 0, misList = [];
    rows.forEach(function (r) {
      var v = verdictOf(Math.abs(r.t), pi);
      if (v.key === "pass") pass++;
      else if (v.key === "miskill") { mis++; misList.push(r); }
      else weak++;
    });
    var total = rows.length;
    var w = function (x) { return (x / total) * 100; };

    verdictEl.dataset.verdict = mis >= total * 0.5 ? "miskill" : (pass >= total * 0.5 ? "pass" : "weak");
    verdictEl.querySelector("b").textContent = t(
      mis + " of " + total + " would be mis-killed",
      total + " 个里有 " + mis + " 个会被误杀"
    );
    verdictEl.querySelector("p").textContent = t(
      "At π = " + f(pi, 2) + ", the screen keeps " + pass + " and discards " + mis + " factors that clear the allocation hurdle inside their own state.",
      "在 π = " + f(pi, 2) + " 下，筛选留下 " + pass + " 个，丢掉 " + mis + " 个在自身状态里已过配置门槛的因子。"
    );

    readEl.innerHTML = [
      [t("factors in the library", "因子库规模"), String(total)],
      [t("pass the screen", "通过筛选"), pass + "  (" + f(w(pass), 1) + "%)"],
      [t("mis-killed", "被误杀"), mis + "  (" + f(w(mis), 1) + "%)"],
      [t("below allocation hurdle", "低于配置门槛"), weak + "  (" + f(w(weak), 1) + "%)"],
      [t("discovery hurdle", "发现门槛"), f(discovery, 2) + "  (N=" + N.toLocaleString("en-US") + ")"]
    ].map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    }).join("");

    curveWrap.hidden = true;
    batchWrap.hidden = false;
    misList.sort(function (a, b) { return Math.abs(b.t) - Math.abs(a.t); });
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
      (misList.length
        ? '<div class="bench-list">' + misList.slice(0, 40).map(function (r) {
          return '<div><span>' + escapeHtml(r.name) + '</span><span>t ' + f(Math.abs(r.t), 2) + ' → ' + f(Math.abs(r.t) * Math.sqrt(pi), 2) + '</span></div>';
        }).join("") + '</div>'
        : '<div class="bench-empty">' + t("Nothing is being mis-killed at this π.", "在这个 π 下没有因子被误杀。") + '</div>');
    last = { batch: true, total: total, pass: pass, mis: mis, weak: weak, pi: pi, N: N };
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
        "π = " + f(last.pi, 2) + " · N = " + last.N,
        "identity: t_global = t_state · √π · gates 1.96 / 2.38 / √(2 ln N)",
        "source: Proposition 2, Discarded but Alive (SSRN 7607684)"
      ];
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
    root.querySelectorAll(".bench-label")[3].textContent = t("One factor per line · name, t", "每行一个因子 · 名称, t");
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
  function init() {
    build();
    var focusApi = {
      focus: function () {
        if (!root) return;
        root.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(function () {
          setMode("series");
          if (seriesEl) seriesEl.focus({ preventScroll: true });
        }, 520);
      }
    };
    window.HJ_BENCH = focusApi;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
