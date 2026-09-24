/* Portfolio interactions — cursor, math, canvas, counters, factory, palette */

const SAMPLE_FACTORS = [
  {
    name: "net_quote_demand_rank",
    rationale: "Biais et al. (1995): order-book imbalance predicts price changes.",
    expr: {
      kind: "unary", op: "Rank",
      inner: {
        kind: "binary", op: "Div",
        left: { kind: "input", signal: "BidSize" },
        right: { kind: "input", signal: "AskSize" },
      },
    },
  },
  {
    name: "volume_price_correlation_proxy",
    rationale: "Karpoff (1987): positive volume–price-change correlation; product proxy.",
    expr: {
      kind: "binary", op: "Mul",
      left: { kind: "input", signal: "Volume" },
      right: {
        kind: "unary", op: "Abs",
        inner: { kind: "unary", op: "Diff", inner: { kind: "input", signal: "MidPrice" } },
      },
    },
  },
  {
    name: "microprice_pressure",
    rationale: "Size-weighted mid (microprice) drifts ahead of traded mid under queue asymmetry.",
    expr: {
      kind: "binary", op: "Sub",
      left: {
        kind: "binary", op: "Div",
        left: {
          kind: "binary", op: "Add",
          left: { kind: "binary", op: "Mul", left: { kind: "input", signal: "BestAsk" }, right: { kind: "input", signal: "BidSize" } },
          right: { kind: "binary", op: "Mul", left: { kind: "input", signal: "BestBid" }, right: { kind: "input", signal: "AskSize" } },
        },
        right: { kind: "binary", op: "Add", left: { kind: "input", signal: "BidSize" }, right: { kind: "input", signal: "AskSize" } },
      },
      right: { kind: "input", signal: "MidPrice" },
    },
  },
  {
    name: "signed_trade_zscore",
    rationale: "Signed flow normalized by recent volume volatility — microstructure pressure.",
    expr: {
      kind: "rolling", op: "Zscore", window: 20,
      inner: {
        kind: "binary", op: "Mul",
        left: { kind: "input", signal: "TradeSide" },
        right: { kind: "input", signal: "TradeSize" },
      },
    },
  },
  {
    name: "spread_widening_rank",
    rationale: "Quoted-spread expansion ranks names under temporary liquidity stress.",
    expr: {
      kind: "unary", op: "Rank",
      inner: {
        kind: "rolling", op: "Mean", window: 10,
        inner: {
          kind: "binary", op: "Sub",
          left: { kind: "input", signal: "BestAsk" },
          right: { kind: "input", signal: "BestBid" },
        },
      },
    },
  },
  {
    name: "trend_aligned_signed_flow",
    rationale: "Flow agreeing with recent mid drift — conditional pressure, not raw imbalance.",
    expr: {
      kind: "binary", op: "Mul",
      left: {
        kind: "unary", op: "Sign",
        inner: { kind: "rolling", op: "Slope", window: 20, inner: { kind: "input", signal: "MidPrice" } },
      },
      right: {
        kind: "binary", op: "Mul",
        left: { kind: "input", signal: "TradeSide" },
        right: { kind: "input", signal: "TradeSize" },
      },
    },
  },
];

const CFG = {
  github: "https://github.com/nemo02070118/boatfx-repro",
  video: "https://youtu.be/tVHLUQy93rg",
  email: "mailto:15761209998@163.com",
  showcase: "https://github.com/nemo02070118/boatfx-repro/tree/main/system_showcase",
  live: "https://nemo02070118.github.io/boatfx-repro/",
};

function prettyExpr(expr, indent = 0) {
  const pad = "  ".repeat(indent);
  if (!expr || typeof expr !== "object") return String(expr);
  if (expr.kind === "input") return `${pad}${expr.signal}`;
  if (expr.kind === "const") return `${pad}${expr.value}`;
  if (expr.kind === "unary") return `${pad}${expr.op}(\n${prettyExpr(expr.inner, indent + 1)}\n${pad})`;
  if (expr.kind === "binary") return `${pad}${expr.op}(\n${prettyExpr(expr.left, indent + 1)},\n${prettyExpr(expr.right, indent + 1)}\n${pad})`;
  if (expr.kind === "rolling") return `${pad}${expr.op}[w=${expr.window}](\n${prettyExpr(expr.inner, indent + 1)}\n${pad})`;
  return `${pad}${JSON.stringify(expr)}`;
}

/* ---------- cursor ---------- */
function initCursor() {
  const isTouch = matchMedia("(pointer: coarse)").matches;
  if (isTouch) {
    document.body.classList.add("touch");
    return;
  }
  const ring = document.getElementById("cursor");
  const dot = document.getElementById("cursor-dot");
  let x = 0, y = 0, rx = 0, ry = 0;
  window.addEventListener("mousemove", (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  });
  function loop() {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    ring.style.left = `${rx}px`;
    ring.style.top = `${ry}px`;
    requestAnimationFrame(loop);
  }
  loop();
  document.querySelectorAll("a, button, .factor-btn, input, .funnel-step, .pipe-step, .paper-tab, .data-table tbody tr").forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("on-link"));
    el.addEventListener("mouseleave", () => ring.classList.remove("on-link"));
  });
}

/* ---------- magnetic ---------- */
function initMagnetic() {
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.22}px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });
}

/* ---------- scramble (disabled for brand; hover decor only on [data-scramble]) ---------- */
function scrambleOnce(el) {
  const target = el.dataset.scramble || el.textContent;
  if (!target || el.classList.contains("brand")) return;
  if (el._scrambleTimer) clearInterval(el._scrambleTimer);
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·—";
  let frame = 0;
  const total = 12;
  el._scrambleTimer = setInterval(() => {
    frame++;
    const revealed = Math.floor((frame / total) * target.length);
    el.textContent = target
      .split("")
      .map((ch, i) => {
        if (ch === " ") return " ";
        if (i < revealed) return target[i];
        return glyphs[(Math.random() * glyphs.length) | 0];
      })
      .join("");
    if (frame >= total) {
      el.textContent = target;
      clearInterval(el._scrambleTimer);
      el._scrambleTimer = null;
    }
  }, 24);
}

function initScramble() {
  // Intentionally empty for hero name stability.
  // Optional: attach only to non-critical decorative nodes if re-enabled later.
}

/* ---------- reveal / progress ---------- */
function initReveal() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) en.target.classList.add("in");
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));

  const bar = document.getElementById("progress");
  window.addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = `${p}%`;
  });
}

/* ---------- counters ---------- */
function initCounters() {
  const nodes = document.querySelectorAll("[data-count]");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (el.dataset.done) return;
        el.dataset.done = "1";
        const target = parseFloat(el.dataset.count);
        const decimals = parseInt(el.dataset.decimals || "0", 10);
        const suffix = el.dataset.suffix || "";
        const t0 = performance.now();
        const dur = 1200;
        function tick(now) {
          const u = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - u, 3);
          const val = target * eased;
          el.textContent = (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
          if (u < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );
  nodes.forEach((n) => io.observe(n));
}

/* ---------- katex ---------- */
function initTex() {
  const render = () => {
    if (!window.katex) return false;
    document.querySelectorAll("[data-tex]").forEach((el) => {
      window.katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: true });
    });
    return true;
  };
  if (!render()) {
    const t = setInterval(() => {
      if (render()) clearInterval(t);
    }, 80);
  }
}

/* ---------- pi lab (deluxe) ---------- */
function initPiLab() {
  const range = document.getElementById("pi-range");
  const tStateRange = document.getElementById("tstate-range");
  const threshRange = document.getElementById("thresh-range");
  const piVal = document.getElementById("pi-val");
  const tStateVal = document.getElementById("tstate-val");
  const tgVal = document.getElementById("tg-val");
  const threshVal = document.getElementById("thresh-val");
  const verdict = document.getElementById("verdict");
  const dilutionVal = document.getElementById("dilution-val");
  const canvas = document.getElementById("pi-canvas");
  const gateStatus = document.getElementById("gate-status");
  const tiltStatus = document.getElementById("tilt-status");
  const gateMeter = document.getElementById("gate-meter");
  const tiltMeter = document.getElementById("tilt-meter");
  if (!range || !canvas) return;
  const ctx = canvas.getContext("2d");

  function draw(pi, tState, thresh) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 1100;
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0c121a");
    grad.addColorStop(1, "#0a1018");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const pad = 52;
    const plotW = w - pad * 2;
    const plotH = h - 64;
    const tmax = 5.2;

    ctx.strokeStyle = "rgba(215,224,234,0.18)";
    ctx.beginPath();
    ctx.moveTo(pad, 24);
    ctx.lineTo(pad, 24 + plotH);
    ctx.lineTo(pad + plotW, 24 + plotH);
    ctx.stroke();

    // soft fill under curve above threshold = survive region
    ctx.fillStyle = "rgba(109,206,168,0.06)";
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 120; i++) {
      const p = 0.05 + (0.85 * i) / 120;
      const tg = tState * Math.sqrt(p);
      const x = pad + ((p - 0.05) / 0.85) * plotW;
      const y = 24 + plotH - (Math.min(tg, tmax) / tmax) * plotH;
      if (tg >= thresh) {
        if (!started) {
          ctx.moveTo(x, 24 + plotH - (thresh / tmax) * plotH);
          started = true;
        }
        ctx.lineTo(x, y);
      }
    }
    if (started) {
      ctx.lineTo(pad + plotW, 24 + plotH - (thresh / tmax) * plotH);
      ctx.closePath();
      ctx.fill();
    }

    const yThresh = 24 + plotH - (thresh / tmax) * plotH;
    ctx.strokeStyle = "rgba(196,92,38,0.75)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pad, yThresh);
    ctx.lineTo(pad + plotW, yThresh);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c45c26";
    ctx.font = "11px IBM Plex Mono";
    ctx.fillText(`|t|=${thresh.toFixed(1)} threshold`, pad + 8, yThresh - 8);

    ctx.strokeStyle = "#6dcea8";
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = 0.05 + (0.85 * i) / 120;
      const tg = tState * Math.sqrt(p);
      const x = pad + ((p - 0.05) / 0.85) * plotW;
      const y = 24 + plotH - (Math.min(tg, tmax) / tmax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const tg = tState * Math.sqrt(pi);
    const x = pad + ((pi - 0.05) / 0.85) * plotW;
    const y = 24 + plotH - (Math.min(tg, tmax) / tmax) * plotH;
    ctx.strokeStyle = "rgba(215,224,234,0.25)";
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, 24 + plotH);
    ctx.stroke();

    ctx.fillStyle = tg >= thresh ? "#6dcea8" : "#c45c26";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.stroke();

    ctx.fillStyle = "#d7e0ea";
    ctx.font = "12px IBM Plex Mono";
    ctx.fillText(`π=${pi.toFixed(2)}   tg=${tg.toFixed(2)}`, Math.min(x + 14, w - 160), Math.max(y - 10, 36));
    ctx.fillStyle = "#8a93a3";
    ctx.fillText("π →", pad + plotW - 28, 24 + plotH + 26);
    ctx.fillText("t_g", 14, 32);
  }

  function update() {
    const pi = parseFloat(range.value);
    const tState = parseFloat((tStateRange && tStateRange.value) || "3");
    const thresh = parseFloat((threshRange && threshRange.value) || "2");
    const tg = tState * Math.sqrt(pi);
    const dil = Math.sqrt(pi);
    if (piVal) piVal.textContent = pi.toFixed(2);
    if (tStateVal) tStateVal.textContent = tState.toFixed(2);
    if (tgVal) tgVal.textContent = tg.toFixed(2);
    if (threshVal) threshVal.textContent = thresh.toFixed(1);
    if (dilutionVal) dilutionVal.textContent = `√π = ${dil.toFixed(2)}`;
    const pass = tg >= thresh;
    if (verdict) {
      verdict.textContent = pass ? "survives" : "discarded";
      verdict.style.color = pass ? "#0d5c4b" : "#c45c26";
    }
    if (gateStatus) {
      gateStatus.textContent = pass ? "KEEP" : "CUT";
      gateStatus.style.color = pass ? "#0d5c4b" : "#c45c26";
    }
    if (tiltStatus) {
      tiltStatus.textContent = "WEIGHTED";
      tiltStatus.style.color = "#0d5c4b";
    }
    if (gateMeter) gateMeter.style.width = pass ? "100%" : "8%";
    if (tiltMeter) {
      // tilt keeps exposure proportional to local strength proxy
      const w = Math.min(100, Math.max(18, (tg / Math.max(thresh, 0.01)) * 55 + dil * 40));
      tiltMeter.style.width = `${w}%`;
    }
    draw(pi, tState, thresh);
  }

  range.addEventListener("input", update);
  tStateRange?.addEventListener("input", update);
  threshRange?.addEventListener("input", update);
  update();
  window.addEventListener("resize", update);
}

/* ---------- regime canvas ---------- */
function initRegimeCanvas() {
  const canvas = document.getElementById("regime-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let mouse = { x: 0.5, y: 0.5 };
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = (e.clientY - r.top) / r.height;
  });

  const particles = Array.from({ length: 64 }, () => ({
    x: Math.random(),
    y: 0.15 + Math.random() * 0.7,
    local: Math.random(),
    phase: Math.random() * Math.PI * 2,
    r: 2.2 + Math.random() * 2.8,
  }));

  let t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 1400;
    const cssH = 480;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const mid = cssW * 0.5;
    ctx.fillStyle = "rgba(10,16,24,0.035)";
    ctx.fillRect(0, 0, mid, cssH);
    ctx.fillStyle = "rgba(13,92,75,0.07)";
    ctx.fillRect(mid, 0, cssW - mid, cssH);
    ctx.strokeStyle = "rgba(10,16,24,0.12)";
    ctx.beginPath();
    ctx.moveTo(mid, 40);
    ctx.lineTo(mid, cssH - 28);
    ctx.stroke();

    const disturb = (mouse.x - 0.5) * 0.25;

    particles.forEach((p) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 1.15 + p.phase + disturb * 4);
      const globalT = p.local * wave;
      const keptHard = globalT > 0.58;
      const tilt = Math.min(1, Math.max(0.2, 0.3 + 0.7 * p.local + disturb * (p.local - 0.5)));

      const lx = 28 + p.x * (mid - 56);
      const ly = p.y * cssH + Math.sin(t + p.phase) * 7;
      ctx.beginPath();
      ctx.fillStyle = keptHard ? "#0d5c4b" : "rgba(107,117,133,0.35)";
      ctx.globalAlpha = keptHard ? 0.92 : 0.35;
      ctx.arc(lx, ly, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (!keptHard) {
        ctx.strokeStyle = "rgba(196,92,38,0.55)";
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(lx - 5, ly - 5);
        ctx.lineTo(lx + 5, ly + 5);
        ctx.moveTo(lx + 5, ly - 5);
        ctx.lineTo(lx - 5, ly + 5);
        ctx.stroke();
      }

      const rx = mid + 28 + p.x * (cssW - mid - 56);
      const ry = p.y * cssH + Math.cos(t * 0.9 + p.phase) * 7;
      ctx.globalAlpha = 0.28 + 0.72 * tilt;
      ctx.fillStyle = "#0d5c4b";
      ctx.beginPath();
      ctx.arc(rx, ry, p.r * (0.65 + tilt), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = "#6b7585";
    ctx.font = "11px IBM Plex Sans";
    ctx.fillText("X = discarded by global t", 24, cssH - 14);
    ctx.fillText("Dot size / opacity = continuous state weight", mid + 24, cssH - 14);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- factors ---------- */
function initFactors() {
  const list = document.getElementById("factor-list");
  const detail = document.getElementById("factor-detail");
  if (!list || !detail) return;
  SAMPLE_FACTORS.forEach((f, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "factor-btn";
    btn.textContent = f.name;
    btn.addEventListener("click", () => {
      list.querySelectorAll(".factor-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      detail.innerHTML = `<h3>${f.name}</h3><p class="rationale">${f.rationale}</p><pre>${prettyExpr(f.expr)}</pre>`;
    });
    list.appendChild(btn);
    if (i === 0) btn.click();
  });
}

/* ---------- terminal typewriter ---------- */
function initTerminal() {
  const el = document.querySelector("#terminal-body code");
  if (!el) return;
  const lines = [
    { cls: "cmd", text: "$ python repro.py" },
    { cls: "ok", text: "RESULT: 60/60 sample factors evaluated cleanly" },
    { cls: "cmd", text: "$ python reproduce_headline.py" },
    { cls: "", text: "panel   active bps/yr      IR" },
    { cls: "ok", text: "vw                172    2.01" },
    { cls: "ok", text: "nyse              134    1.73" },
    { cls: "", text: "# router estimation code withheld · tilt OUTPUT shipped" },
  ];
  let i = 0, j = 0;
  el.innerHTML = "";
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      function type() {
        if (i >= lines.length) return;
        const line = lines[i];
        if (j === 0) {
          const span = document.createElement("span");
          if (line.cls) span.className = line.cls;
          span.dataset.i = String(i);
          el.appendChild(span);
          if (i > 0) el.appendChild(document.createTextNode("\n"));
        }
        const span = el.querySelector(`span[data-i="${i}"]`);
        span.textContent = line.text.slice(0, j + 1);
        j++;
        if (j >= line.text.length) {
          i++;
          j = 0;
          setTimeout(type, 220);
        } else {
          setTimeout(type, 16 + Math.random() * 22);
        }
      }
      type();
    },
    { threshold: 0.35 }
  );
  io.observe(el.closest(".terminal-block") || el);
}

/* ---------- palette ---------- */
function initPalette() {
  const palette = document.getElementById("palette");
  const input = document.getElementById("palette-input");
  const list = document.getElementById("palette-list");
  const hint = document.getElementById("cmd-hint");
  const items = [
    { id: "idea", label: "01 Idea — Global Weakness" },
    { id: "tour", label: "01a Argument tour" },
    { id: "venues", label: "01b Venues — JF · EFA" },
    { id: "paper", label: "01c Paper map — claim tiers" },
    { id: "math", label: "02 Math — blind-spot lab" },
    { id: "results", label: "03 Results — panel inspector" },
    { id: "machine", label: "04 Machine population funnel" },
    { id: "factory", label: "05 AI factor factory" },
    { id: "letter", label: "06 Zheshang recommendation" },
    { id: "edge", label: "06b Edge vs peers" },
    { id: "fusion", label: "06e AI × quant fusion" },
    { id: "craft", label: "06c Engineering discipline" },
    { id: "scale", label: "06d Engineering mass" },
    { id: "proof", label: "07 Proof / repro commands" },
    { id: "agency", label: "08 Academy · already in motion" },
    { id: "links", label: "Artifacts / links" },
  ];

  function render(filter = "") {
    list.innerHTML = "";
    items
      .filter((it) => it.label.toLowerCase().includes(filter.toLowerCase()))
      .forEach((it, idx) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = it.label;
        if (idx === 0) btn.classList.add("active");
        btn.addEventListener("click", () => {
          document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth" });
          close();
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
  }

  function open() {
    palette.hidden = false;
    render("");
    input.value = "";
    input.focus();
  }
  function close() {
    palette.hidden = true;
  }

  hint?.addEventListener("click", open);
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== "INPUT") {
      e.preventDefault();
      open();
    }
    if (e.key === "Escape") close();
  });
  input?.addEventListener("input", () => render(input.value));
  palette?.addEventListener("click", (e) => {
    if (e.target === palette) close();
  });
}

/* ---------- meta ---------- */
function initMeta() {
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
  const g1 = document.getElementById("github-link");
  const g2 = document.getElementById("github-link-2");
  const v = document.getElementById("video-link");
  const e = document.getElementById("email-link");
  if (g1) g1.href = CFG.github;
  if (g2) g2.href = CFG.github;
  if (v) {
    v.href = CFG.video;
    if (CFG.video === "#") v.textContent = "Add YouTube link in app.js →";
  }
  if (e) {
    e.href = CFG.email;
    e.textContent = CFG.email.replace("mailto:", "");
  }
  const live = document.getElementById("live-link");
  if (live) live.href = CFG.live;
  const show = document.getElementById("showcase-link");
  if (show) show.href = CFG.showcase;
}

initMeta();
initCursor();
initMagnetic();
initScramble();
initReveal();
initCounters();
initTex();
initPiLab();
initRegimeCanvas();
initFactors();
initTerminal();
initPalette();
initSpyNav();
initCredBars();
initPaperLab();
initPanelLab();
initFunnelLab();
initPipeLab();
initAgencyLab();
initArgumentTour();
initFusionFocus();

function initArgumentTour() {
  const stepsEl = document.getElementById("tour-steps");
  const stage = document.getElementById("tour-stage");
  const idxEl = document.getElementById("tour-index");
  const prev = document.getElementById("tour-prev");
  const next = document.getElementById("tour-next");
  if (!stepsEl || !stage) return;

  const STEPS = [
    {
      k: "Claim",
      title: "The screen asks the wrong question",
      body: "Unconditional screens ask whether a factor pays on average. A state-confined premium can average near zero and still be real inside its paying state.",
      jump: "idea",
      metric: "Proposition 2",
    },
    {
      k: "Mechanism",
      title: "t_g ≈ t_state √π",
      body: "As the paying state grows rare, global t vanishes even if conditional strength stays large. Hard gates delete legs; continuous tilt keeps breadth.",
      jump: "math",
      metric: "Blind-spot identity",
    },
    {
      k: "Machines",
      title: "6,881 proposals · 0 clear the global screen",
      body: "10.0% flagged regime-local → 3.15% survive block-shuffle → 1.08% clear BH one-at-a-time. Correction cost is shown on purpose. Anchor: 6.4× falsification excess.",
      jump: "machine",
      metric: "6.4×",
    },
    {
      k: "Economics",
      title: "Deployable overlay on public panels",
      body: "24/24 same-base increments positive. VW ~172 bps/yr · IR ≈ 1.99. Public check: shipped tilt OUTPUT + python reproduce_headline.py.",
      jump: "results",
      metric: "172 bps",
    },
    {
      k: "Factory",
      title: "AI proposes · quant admits",
      body: "Typed AST → sandbox → rationale → constitution gates. Study discards — that is where the blind spot bites. Same discipline as vibe-coding the public surface.",
      jump: "factory",
      metric: "Gated loop",
    },
    {
      k: "Agency",
      title: "Already in motion · on leave to go deeper",
      body: "JF external review · EFA submitted · leave of absence to research full-time · ≤1 year college completed · Academy-eligible · SF-ready.",
      jump: "agency",
      metric: "Proof of work",
    },
  ];

  let i = 0;
  STEPS.forEach((s, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tour-step" + (n === 0 ? " active" : "");
    b.innerHTML = `<span>${String(n + 1).padStart(2, "0")}</span><b>${s.k}</b>`;
    b.addEventListener("click", () => show(n));
    stepsEl.appendChild(b);
  });

  function show(n) {
    i = (n + STEPS.length) % STEPS.length;
    const s = STEPS[i];
    [...stepsEl.children].forEach((el, k) => el.classList.toggle("active", k === i));
    stage.innerHTML = `
      <div class="tour-metric">${s.metric}</div>
      <h3>${s.title}</h3>
      <p>${s.body}</p>
      <button type="button" class="tour-jump" data-jump="${s.jump}">Open section →</button>
    `;
    if (idxEl) idxEl.textContent = `${i + 1} / ${STEPS.length}`;
    stage.querySelector(".tour-jump")?.addEventListener("click", (e) => {
      document.getElementById(e.currentTarget.dataset.jump)?.scrollIntoView({ behavior: "smooth" });
    });
  }

  prev?.addEventListener("click", () => show(i - 1));
  next?.addEventListener("click", () => show(i + 1));
  window.addEventListener("keydown", (e) => {
    if (document.activeElement?.tagName === "INPUT") return;
    const sec = document.getElementById("tour");
    if (!sec) return;
    const r = sec.getBoundingClientRect();
    const visible = r.top < window.innerHeight * 0.7 && r.bottom > 80;
    if (!visible) return;
    if (e.key === "ArrowRight") show(i + 1);
    if (e.key === "ArrowLeft") show(i - 1);
  });
  show(0);
}

function initFusionFocus() {
  const flow = document.getElementById("fusion-flow");
  const togs = document.querySelectorAll(".fusion-tog");
  if (!flow || !togs.length) return;
  const NODES = [
    { id: "propose", label: "LLM propose", side: "ai" },
    { id: "type", label: "Type-check", side: "both" },
    { id: "sand", label: "Sandbox", side: "both" },
    { id: "rat", label: "Rationale", side: "quant" },
    { id: "admit", label: "Admit / gates", side: "quant" },
    { id: "study", label: "Study discards", side: "quant" },
  ];
  function render(focus) {
    flow.innerHTML = NODES.map((n) => {
      const on =
        focus === "both" ||
        n.side === "both" ||
        n.side === focus;
      return `<div class="fusion-node ${on ? "on" : "dim"}" data-side="${n.side}"><span>${n.label}</span></div>`;
    }).join('<div class="fusion-arrow" aria-hidden="true">→</div>');
    togs.forEach((t) => t.classList.toggle("active", t.dataset.focus === focus));
  }
  togs.forEach((t) => t.addEventListener("click", () => render(t.dataset.focus)));
  render("both");
}

function initSpyNav() {
  const links = [...document.querySelectorAll("#spy-nav a[data-spy]")];
  const map = links.map((a) => ({
    a,
    el: document.getElementById(a.dataset.spy),
  })).filter((x) => x.el);
  function sync() {
    let current = map[0]?.a;
    const y = window.scrollY + 120;
    map.forEach(({ a, el }) => {
      if (el.offsetTop <= y) current = a;
    });
    links.forEach((l) => l.classList.toggle("active", l === current));
  }
  window.addEventListener("scroll", sync, { passive: true });
  sync();
}

function initCredBars() {
  const rows = document.querySelectorAll(".cred-row");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) en.target.classList.add("in");
      });
    },
    { threshold: 0.4 }
  );
  rows.forEach((r) => io.observe(r));
}

/* ---------- paper claim map ---------- */
function initPaperLab() {
  const stage = document.getElementById("paper-stage");
  const tabs = document.querySelectorAll(".paper-tab");
  if (!stage || !tabs.length) return;

  const CLAIMS = {
    load: {
      title: "Tier I · Load-bearing — deployable overlay",
      lead: "The claim I lean on: conditioning adds net-of-cost active return on investable books.",
      bullets: [
        "Chen–Zimmermann OSAP · seven allocators × four panels → 24/24 same-base increments positive",
        "Institutionally investable: ~134–172 bps/yr active · IR ≈ 1.7–2.0 (VW headline 172 · IR ≈ 1.99)",
        "Survives Romano–Wolf / e-BH; Lo (2002) holds on tradeable panels (20/24 familywise)",
        "Public check: shipped tilt OUTPUT + python reproduce_headline.py — router estimation code withheld",
      ],
      formula: "\\text{active bps}_{\\mathrm{VW}} \\approx 172 \\quad \\mathrm{IR}\\approx 1.99",
      badge: "Recomputable from public pack",
    },
    id: {
      title: "Tier II · Identification — the blind spot is structural",
      lead: "Rescued factors carry genuine state-dependent structure — verified by falsification, not vibes.",
      bullets: [
        "Cross-fit: state labels ⊥ conditional alpha on purged month halves · increment positive in 100% of splits",
        "Own-regime beats placebo regime borrowed from another factor by ~3–5×",
        "States persist ~8.6 months on average — tradeable, not monthly noise",
        "Deflated Sharpe ≈ 1 across panels · funding scarcity (HKM / Baa–Aaa) steepens local strength; vol placebos fail",
      ],
      formula: "t_g \\approx t_{\\mathrm{state}}\\sqrt{\\pi}",
      badge: "Scientific claim · independently checkable on Alpha191/101",
    },
    machine: {
      title: "Tier II·b · Machine population — where the blind spot bites",
      lead: "6,881 genuinely machine-generated factors; none clears the global screen — yet structure remains.",
      bullets: [
        "10.0% flagged regime-local (bootstrap 95% · 9.3–10.7%)",
        "3.15% survive block-shuffle falsification · 1.08% clear BH one-at-a-time",
        "Assumption-free anchor: flagged set yields 6.4× falsification passes vs global-null allowance (219 vs 34)",
        "Same order of magnitude on human libraries: Alpha191 13.8% · Alpha101 11.6%",
      ],
      formula: "6{,}881 \\rightarrow 10.0\\% \\rightarrow 3.15\\% \\rightarrow 1.08\\%",
      badge: "Correction cost made visible on purpose",
    },
    prop2: {
      title: "Proposition 2 · State blind spot",
      lead: "A state-confined premium’s global t-statistic vanishes as the paying state grows rare.",
      bullets: [
        "Unconditional mean dilutes local strength by state frequency π",
        "First-order identity: t_g ≈ t_state √π — rare paying states look globally weak",
        "Hard gates delete legs; continuous tilt keeps breadth and reweights",
        "Interactive lab below: drag π, t_state, and the screen threshold",
      ],
      formula: "t_g \\approx t_{\\mathrm{state}}\\sqrt{\\pi}",
      badge: "Mechanism — not a backtest slogan",
    },
    suggest: {
      title: "Tier III · Suggestive — reported, not leaned on",
      lead: "I show these for completeness. They are not load-bearing for the paper’s central claim.",
      bullets: [
        "Shorting-cost natural experiments and short cross-asset panels",
        "Observational funding interactions — I stop short of a causal claim",
        "OOS corroboration vs matched placebos can be directional rather than decisive",
        "Honesty rule: raw rescue rates always appear beside FDR-controlled floors",
      ],
      formula: "\\text{do not lean}",
      badge: "Explicitly down-weighted",
    },
  };

  function show(key) {
    const c = CLAIMS[key];
    if (!c) return;
    stage.innerHTML = `
      <div class="paper-badge">${c.badge}</div>
      <h3>${c.title}</h3>
      <p class="paper-lead">${c.lead}</p>
      <div class="paper-tex" data-tex="${c.formula}"></div>
      <ul>${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
      <button type="button" class="paper-jump" data-jump="${key === "prop2" ? "math" : key === "machine" ? "machine" : key === "load" ? "results" : "math"}">Open related lab →</button>
    `;
    if (window.katex) {
      stage.querySelectorAll(".paper-tex").forEach((el) => {
        window.katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: true });
      });
    }
    stage.querySelector(".paper-jump")?.addEventListener("click", (e) => {
      document.getElementById(e.currentTarget.dataset.jump)?.scrollIntoView({ behavior: "smooth" });
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      show(tab.dataset.claim);
    });
  });
  show("load");
}

/* ---------- results panel inspector ---------- */
function initPanelLab() {
  const table = document.getElementById("panel-table");
  const canvas = document.getElementById("panel-canvas");
  const nameEl = document.getElementById("inspect-name");
  const factsEl = document.getElementById("inspect-facts");
  if (!table || !canvas) return;

  const DATA = {
    ew: { name: "Equal-weight", min: 2.79, over: 3.01, bps: 128, ir: 1.73, t: 1.49, oos: 101, oosIr: 1.72, note: "Near-frontier book · Lo exceptions concentrate here" },
    vw: { name: "Value-weight ★", min: 1.37, over: 1.91, bps: 172, ir: 1.99, t: 6.81, oos: 134, oosIr: 2.05, note: "Headline investable panel · primary public receipt" },
    nyse: { name: "NYSE breakpoint", min: 1.73, over: 2.15, bps: 134, ir: 1.68, t: 4.11, oos: 116, oosIr: 1.52, note: "Institutionally familiar breakpoint construction" },
    me20: { name: "Large-cap (ME20)", min: 1.77, over: 2.05, bps: 109, ir: 1.66, t: 2.79, oos: 75, oosIr: 1.60, note: "Large-cap stress · still positive active increment" },
  };

  const ctx = canvas.getContext("2d");

  function draw(d) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 480;
    const h = 260;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a1018";
    ctx.fillRect(0, 0, w, h);

    const metrics = [
      { label: "bps", v: d.bps, max: 200, color: "#6dcea8" },
      { label: "IR×100", v: d.ir * 100, max: 220, color: "#7eb6ff" },
      { label: "dep t×10", v: d.t * 10, max: 80, color: "#e0b15a" },
      { label: "OOS bps", v: d.oos, max: 200, color: "#c9a0ff" },
    ];
    const pad = 36;
    const barW = (w - pad * 2) / metrics.length - 12;
    metrics.forEach((m, i) => {
      const x = pad + i * (barW + 12);
      const bh = ((m.v / m.max) * (h - 80));
      const y = h - 40 - bh;
      ctx.fillStyle = m.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, barW, bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#d7e0ea";
      ctx.font = "11px IBM Plex Mono";
      const shown = m.label.startsWith("IR") ? d.ir.toFixed(2) : m.label.startsWith("dep") ? d.t.toFixed(2) : String(Math.round(m.v));
      ctx.fillText(shown, x, y - 8);
      ctx.fillStyle = "#8a93a3";
      ctx.fillText(m.label.replace("×100", "").replace("×10", ""), x, h - 18);
    });
  }

  function select(key) {
    const d = DATA[key];
    if (!d) return;
    table.querySelectorAll("tbody tr").forEach((tr) => tr.classList.toggle("active", tr.dataset.panel === key));
    if (nameEl) nameEl.textContent = d.name;
    if (factsEl) {
      factsEl.innerHTML = `
        <li><span>MinVar → Overlay SR</span><b>${d.min.toFixed(2)} → ${d.over.toFixed(2)}</b></li>
        <li><span>Active bps / IR</span><b>${d.bps} · ${d.ir.toFixed(2)}</b></li>
        <li><span>Deployable t</span><b>${d.t.toFixed(2)}</b></li>
        <li><span>OOS bps / IR</span><b>${d.oos} · ${d.oosIr.toFixed(2)}</b></li>
        <li class="note">${d.note}</li>
      `;
    }
    draw(d);
  }

  table.querySelectorAll("tbody tr").forEach((tr) => {
    const activate = () => select(tr.dataset.panel);
    tr.addEventListener("click", activate);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
  select("vw");
  window.addEventListener("resize", () => {
    const active = table.querySelector("tr.active")?.dataset.panel || "vw";
    select(active);
  });
}

/* ---------- funnel lab ---------- */
function initFunnelLab() {
  const detail = document.getElementById("funnel-detail");
  const steps = document.querySelectorAll("#funnel [data-funnel]");
  if (!detail || !steps.length) return;
  const COPY = [
    {
      title: "Pool · 6,881 machine factors",
      body: "Genuinely machine-generated — not a human shortlist. None clears the unconditional global screen. The question is what the discards still contain.",
    },
    {
      title: "Flagged regime-local · 10.0%",
      body: "Bootstrap 95% interval 9.3–10.7%. A minority — but well above chance. Same order of magnitude reappears on Alpha191 (13.8%) and Alpha101 (11.6%).",
    },
    {
      title: "Block-shuffle falsification · 3.15%",
      body: "Induced-null pipeline: shuffle regime labels in blocks and re-run. The router does not manufacture signal from noise; global-pass factors produce no false rescues on the same test.",
    },
    {
      title: "BH one-factor-at-a-time · 1.08%",
      body: "Correction cost made visible on purpose. Raw rescue rates always sit beside FDR-controlled floors so readers see the conservative figure.",
    },
    {
      title: "Assumption-free anchor · 6.4×",
      body: "Flagged set produces 219 falsification passes versus 34 allowed under a global null — the load-bearing machine-pool fact without leaning on a single cutoff.",
    },
  ];
  function show(i) {
    const c = COPY[i] || COPY[0];
    steps.forEach((s) => s.classList.toggle("active", String(s.dataset.funnel) === String(i)));
    detail.innerHTML = `<h4>${c.title}</h4><p>${c.body}</p>`;
  }
  steps.forEach((s) => {
    s.addEventListener("click", () => show(s.dataset.funnel));
  });
  show(0);
}

/* ---------- pipeline lab ---------- */
function initPipeLab() {
  const detail = document.getElementById("pipe-detail");
  const steps = document.querySelectorAll("#pipeline [data-pipe]");
  if (!detail || !steps.length) return;
  const COPY = [
    { title: "01 · LLM propose", body: "DeepSeek breadth + Claude/GPT depth. Models propose typed factor programs — never arbitrary shell code. Keys only from environment variables." },
    { title: "02 · Type-check", body: "Typed AST over nine microstructure signals. Ill-typed expressions die here before any expensive evaluation." },
    { title: "03 · Sandbox", body: "WASM / fuel / wall-clock / memory hard limits. A proposal that loops forever does not get to waste the research budget." },
    { title: "04 · Rationale", body: "Economic rationale required — not a bare expression. The paper studies the admitted population without performance pre-screening." },
    { title: "05 · Admit", body: "Front gates G1–G4 + constitution checks. Admission is expensive on purpose; proposals are cheap." },
    { title: "06 · Study discards", body: "The scientific object includes what the global screen throws away. Discards are where Proposition 2 bites — not a trash folder." },
  ];
  function show(i) {
    const c = COPY[i] || COPY[0];
    steps.forEach((s) => s.classList.toggle("active", String(s.dataset.pipe) === String(i)));
    detail.innerHTML = `<h4>${c.title}</h4><p>${c.body}</p>`;
  }
  steps.forEach((s) => s.addEventListener("click", () => show(s.dataset.pipe)));
  show(0);
}

/* ---------- Academy agency map ---------- */
function initAgencyLab() {
  const panel = document.getElementById("agency-panel");
  const tabs = document.querySelectorAll(".agency-tab");
  if (!panel || !tabs.length) return;

  const COPY = {
    motion: {
      title: "Already in motion",
      body: "22 months on this system — not a prompt-weekend. JF MS 2026-0738: passed desk, now in external review under Antoinette Schoar. EFA submitted. I took academic leave to pursue this research full-time. Public site + repro + CI + walkthrough shipped. Zheshang production systems from Aug 2025. The work predates the application form.",
    },
    agency: {
      title: "Agency",
      body: "When AI-scale factor proposal captured my attention, I did not write a thread — I built a factory with gates, derived the blind-spot identity, falsified my own rescues, and made the load-bearing numbers regenerable by strangers. Agency here means: notice the structural mistake → instrument it → publish a receipt.",
    },
    proof: {
      title: "Proof of work",
      body: "Original research counts. Live portfolio. python repro.py (60/60). python reproduce_headline.py (~172 bps · IR ≈ 2). system_showcase Rust excerpts. SCALE.md mass notes. MD letter: 56 modules · ~64k LoC · >95%. Video: youtu.be/tVHLUQy93rg. Chat logs are not the artifact — the repo is.",
    },
    elig: {
      title: "Leave of absence · eligibility",
      body: "I took an academic leave from Shanghai Lixin University of Accounting and Finance to pursue this research full-time. I remain Academy-eligible: I have not completed more than one year of full-time college after high school by August 2027. International applicant. Ready to live in San Francisco full-time for the Founding Class Fellowship (Sep 2027).",
    },
    why: {
      title: "Why The Academy · why now",
      body: "I want harder peers and external tests than I can create alone. SF for a year is where I push AI×quant screening science into a sharper product surface without abandoning falsification discipline. Peers will ship apps and robots — I bring a research system already under JF external review. Different instrument. Same bar: proof.",
    },
  };

  function show(key) {
    const c = COPY[key] || COPY.motion;
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.agency === key));
    panel.innerHTML = `<h3>${c.title}</h3><p>${c.body}</p>`;
  }

  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.agency)));
  show("motion");
}
