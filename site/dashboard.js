/* ==========================================================================
   BOAT-3 · 04d dashboard — one screen, four sources, both ways
   --------------------------------------------------------------------------
   A permanent panel (not only an agent answer): the universal screen against
   home-venue routing plus pooling, run on four sources — the builtin public
   library, the machine-mined zoo, the two combined, and whatever the visitor
   last put through the workbench. Computed in this tab, cached with a
   timestamp and the seed so a reload does not lie about being fresh.
   ========================================================================== */
(function () {
  "use strict";

  function T(en, zh) {
    try { var s = localStorage.getItem("hj-lang"); if (s === "zh" || s === "en") return s === "zh" ? zh : en; } catch (e) {}
    return (document.documentElement.lang || "en").indexOf("zh") === 0 ? zh : en;
  }
  function num(x, d) {
    d = d == null ? 2 : d;
    if (x == null || !isFinite(x)) return "—";
    var p = Math.pow(10, d);
    return (Math.round(x * p) / p).toFixed(d);
  }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  var KEY = "hj-dashboard-v1";

  function sources() {
    var lib = null;
    try { var raw = localStorage.getItem("hj-wb-lib"); if (raw) lib = JSON.parse(raw); } catch (e) {}
    return [
      { id: "builtin", label: T("builtin public library (22)", "内置公开库（22）"), opts: { builtin: true } },
      { id: "mined", label: T("machine-mined zoo", "机器枚举动物园"), opts: { builtin: false, mined: true } },
      { id: "both", label: T("builtin + mined", "内置 + 挖掘"), opts: { builtin: true, mined: true } },
      { id: "yours", label: T("your library (workbench)", "你的库（工作台）"), opts: lib && lib.length >= 2 ? { builtin: false, rows: lib } : null }
    ];
  }

  function compute() {
    var Z = window.HJ_ZOO;
    if (!Z) return null;
    var out = [];
    sources().forEach(function (s) {
      if (!s.opts) { out.push({ id: s.id, label: s.label, empty: true }); return; }
      try {
        var r = Z.experiment(s.opts);
        var e = r.experiment || {};
        out.push({
          id: s.id, label: s.label,
          n: e.n, kept: e.kept, mis: e.mis, pooledMis: e.pooledMis,
          sharpeA: e.sharpeA, sharpeB: e.sharpeB
        });
      } catch (err) {
        out.push({ id: s.id, label: s.label, err: String(err && err.message || err) });
      }
    });
    return { at: new Date().toISOString(), seed: 20261105, rows: out };
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var j = JSON.parse(raw);
      if (!j || !j.rows) return null;
      return j;
    } catch (e) { return null; }
  }

  function render(host, data) {
    host.textContent = "";
    var bar = el("div", "dash-bar");
    var meta = el("span", "dash-meta", data
      ? T("computed " + data.at.slice(0, 16).replace("T", " ") + " · seed " + data.seed + " · this tab",
          "计算于 " + data.at.slice(0, 16).replace("T", " ") + " · 种子 " + data.seed + " · 本页")
      : T("not computed yet", "还没算"));
    var btn = el("button", "dash-btn", data ? T("recompute", "重算") : T("compute all four", "计算四个源"));
    btn.type = "button";
    bar.appendChild(meta); bar.appendChild(btn);
    host.appendChild(bar);

    var table = el("div", "dash-table");
    var head = el("div", "dash-row dash-head");
    [T("source", "来源"), "N", T("screen kept", "过筛"), T("mis-killed", "误杀"), T("pooled t", "池化 t"),
      T("screen Sharpe", "通用筛 Sharpe"), T("our Sharpe", "我们 Sharpe"), "Δ", T("verdict", "判决")].forEach(function (h) {
      head.appendChild(el("span", null, h));
    });
    table.appendChild(head);

    if (data) {
      data.rows.forEach(function (r) {
        var row = el("div", "dash-row");
        row.appendChild(el("span", "dash-src", r.label));
        if (r.empty) {
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", "dash-v", T("upload a library in §04b", "去 §04b 上传一个库")));
        } else if (r.err) {
          for (var i = 0; i < 7; i++) row.appendChild(el("span", null, "—"));
          row.appendChild(el("span", "dash-v is-no", r.err.slice(0, 40)));
        } else {
          var d = r.sharpeA != null && r.sharpeB != null ? r.sharpeB - r.sharpeA : null;
          var win = d != null && d > 0;
          row.appendChild(el("span", "dash-n", String(r.n == null ? "—" : r.n)));
          row.appendChild(el("span", null, String(r.kept == null ? "—" : r.kept)));
          row.appendChild(el("span", r.mis ? "is-no" : "", String(r.mis == null ? "—" : r.mis)));
          row.appendChild(el("span", null, r.pooledMis == null ? "—" : num(r.pooledMis, 2)));
          row.appendChild(el("span", null, num(r.sharpeA, 2)));
          row.appendChild(el("span", win ? "is-ok" : "", num(r.sharpeB, 2)));
          row.appendChild(el("span", d == null ? "" : (win ? "is-ok" : "is-no"), d == null ? "—" : (d > 0 ? "+" : "") + num(d, 2)));
          row.appendChild(el("span", "dash-v " + (win ? "is-ok" : "is-no"),
            d == null ? "—" : win ? T("our way wins", "我们的方式赢") : T("screen holds", "通用筛守住")));
        }
        table.appendChild(row);
      });
    }
    host.appendChild(table);

    host.appendChild(el("p", "dash-note", T(
      "The normal way keeps the universal screen's survivors, equal-weighted; our way routes the mis-killed to their home venues and pools them (Stouffer). Both are scored on the same holdout. A source with fewer than two factors cannot build both portfolios — that is printed, not hidden.",
      "正常方式等权持有通用筛幸存者；我们的方式把误杀者路由回各自主场再池化（Stouffer）。两条路在同一留出集上打分。少于两个因子的源建不起两条组合——如实印出，不隐藏。")));

    btn.addEventListener("click", function () {
      btn.disabled = true; btn.textContent = T("computing…", "计算中…");
      setTimeout(function () {
        var d = compute();
        if (!d) { btn.disabled = false; btn.textContent = T("the machinery is not loaded", "机器没加载"); return; }
        try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
        render(host, d);
      }, 30);
    });
  }

  function mount(host) {
    if (!host || host.getAttribute("data-dash-mounted") === "1") return;
    host.setAttribute("data-dash-mounted", "1");
    var cached = readCache();
    render(host, cached);
    window.addEventListener("hj:lang", function () { render(host, readCache()); });
  }

  function autoMount() {
    var host = document.getElementById("dash-host");
    if (!host) return;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); mount(host); }
      }, { rootMargin: "600px" });
      io.observe(host);
    } else mount(host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();

  window.HJ_DASHBOARD = { version: "v1.0", mount: mount, compute: compute, readCache: readCache };
})();
