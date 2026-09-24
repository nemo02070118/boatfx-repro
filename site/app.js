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

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
    || matchMedia("(max-width: 720px)").matches
    || matchMedia("(pointer: coarse)").matches;
  const particleN = reduceMotion ? 18 : 64;
  const particles = Array.from({ length: particleN }, () => ({
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
    const cssH = reduceMotion ? 280 : 480;
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

    if (!reduceMotion || document.visibilityState === "visible") requestAnimationFrame(frame);
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
    { id: "field", label: "09 Field · Wiki Finance VIP" },
    { id: "stack", label: "10 Private boatfx stack" },
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
initPiScenarios();
initRegimeCanvas();
initFactors();
initTerminal();
initPalette();
initSpyNav();
initCredBars();
initPaperLab();
initPaperTabI18n();
initPaperAtlas();
initPanelLab();
initFunnelLab();
initPipeLab();
initAgencyLab();
initAgencyTabI18n();
initArgumentTour();
initFusionFocus();
initWikiGallery();
initHeroPortraits();
initFieldLab();
initHkexLab();
initCampLab();
initStackLab();
if (window.initLangToggle) window.initLangToggle();







function initFusionFocus() {
  const flow = document.getElementById("fusion-flow");
  const togs = document.querySelectorAll(".fusion-tog");
  if (!flow || !togs.length) return;
  const NODES = [
    { id: "propose", en: "LLM propose", zh: "LLM 提案", side: "ai" },
    { id: "type", en: "Type-check", zh: "类型检查", side: "both" },
    { id: "sand", en: "Sandbox", zh: "沙箱", side: "both" },
    { id: "rat", en: "Rationale", zh: "经济理由", side: "quant" },
    { id: "admit", en: "Admit / gates", zh: "准入 / 闸门", side: "quant" },
    { id: "study", en: "Study discards", zh: "研究丢弃", side: "quant" },
  ];
  let focusNow = "both";
  function render(focus) {
    focusNow = focus;
    const L = (typeof langNow === "function" ? langNow() : "en") === "zh" ? "zh" : "en";
    flow.innerHTML = NODES.map((n) => {
      const on = focus === "both" || n.side === "both" || n.side === focus;
      return `<div class="fusion-node ${on ? "on" : "dim"}" data-side="${n.side}"><span>${n[L]}</span></div>`;
    }).join('<div class="fusion-arrow" aria-hidden="true">→</div>');
    togs.forEach((t) => t.classList.toggle("active", t.dataset.focus === focus));
  }
  togs.forEach((t) => t.addEventListener("click", () => render(t.dataset.focus)));
  document.addEventListener("hj:lang", () => render(focusNow));
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


/* ---------- pipeline lab ---------- */
function initPipeLab() {
  const detail = document.getElementById("pipe-detail");
  const steps = document.querySelectorAll("#pipeline [data-pipe]");
  if (!detail || !steps.length) return;
  const COPY = [
    { en: { title: "01 · LLM propose", body: "DeepSeek breadth + Claude/GPT depth. Models propose typed factor programs — never arbitrary shell code. Keys only from environment variables." }, zh: { title: "01 · LLM 提案", body: "DeepSeek 广度 + Claude/GPT 深度。模型提案类型化因子程序——绝非任意 shell。密钥只来自环境变量。" } },
    { en: { title: "02 · Type-check", body: "Typed AST over nine microstructure signals. Ill-typed expressions die here before any expensive evaluation." }, zh: { title: "02 · 类型检查", body: "九个微观结构信号上的类型化 AST。类型错误的表达式在昂贵求值前死亡。" } },
    { en: { title: "03 · Sandbox", body: "WASM / fuel / wall-clock / memory hard limits. A proposal that loops forever does not get to waste the research budget." }, zh: { title: "03 · 沙箱", body: "WASM / 燃料 / 墙钟 / 内存硬限制。死循环提案浪费不了研究预算。" } },
    { en: { title: "04 · Rationale", body: "Economic rationale required — not a bare expression. The paper studies the admitted population without performance pre-screening." }, zh: { title: "04 · 经济理由", body: "必须有经济理由——不是裸表达式。论文研究准入总体，不做业绩预筛。" } },
    { en: { title: "05 · Admit", body: "Front gates G1–G4 + constitution checks. Admission is expensive on purpose; proposals are cheap." }, zh: { title: "05 · 准入", body: "前门闸 G1–G4 + 宪章检查。准入故意昂贵；提案便宜。" } },
    { en: { title: "06 · Study discards", body: "The scientific object includes what the global screen throws away. Discards are where Proposition 2 bites — not a trash folder." }, zh: { title: "06 · 研究被丢弃者", body: "科学对象包括全局筛选扔掉的东西。被丢弃者才是命题 2 咬合处——不是垃圾桶。" } },
  ];
  let cur = 0;
  function show(i) {
    cur = Number(i);
    const pack = COPY[cur] || COPY[0];
    const c = langNow() === "zh" ? pack.zh : pack.en;
    steps.forEach((s) => s.classList.toggle("active", String(s.dataset.pipe) === String(cur)));
    const labels = langNow() === "zh"
      ? ["LLM 提案","类型检查","沙箱","经济理由","准入","研究丢弃"]
      : ["LLM propose","Type-check","Sandbox","Rationale","Admit","Study discards"];
    steps.forEach((s, idx) => {
      const n = String(idx + 1).padStart(2, "0");
      s.innerHTML = `<span>${n}</span>${labels[idx] || ""}`;
    });
    detail.innerHTML = `<h4>${c.title}</h4><p>${c.body}</p>`;
  }
  steps.forEach((s) => s.addEventListener("click", () => show(s.dataset.pipe)));
  document.addEventListener("hj:lang", () => show(cur));
  show(0);
}

/* ---------- Academy agency map ---------- */


function langNow() {
  return localStorage.getItem("hj-lang") || "en";
}

function initWikiGallery() {
  const lb = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const close = document.getElementById("lightbox-close");
  if (!lb || !img) return;
  function open(src) {
    img.src = src;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function shut() {
    lb.hidden = true;
    img.src = "";
    document.body.style.overflow = "";
  }
  document.querySelectorAll("#wiki-gallery img, #wiki-gallery .wiki-thumb, #hkex-gallery img, #hkex-gallery .wiki-thumb, #camp-gallery img, #camp-gallery .wiki-thumb").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const src = el.dataset.full || el.getAttribute("src") || el.querySelector("img")?.getAttribute("src");
      if (src) open(src);
    });
  });
  close?.addEventListener("click", shut);
  lb.addEventListener("click", (e) => {
    if (e.target === lb) shut();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") shut();
  });
}

function initFieldLab() {
  const chapters = document.getElementById("field-chapters");
  const stage = document.getElementById("field-stage");
  if (!chapters || !stage) return;

  const CH = [
    {
      id: "invite",
      img: "assets/wiki/wiki-5.webp",
      en: {
        k: "01 · Invite",
        t: "VIP credential — not a hallway pass",
        p: "Physical badge: WIKI FINANCE EXPO HONG KONG 2026 · Sparking Opportunity, Trading Safety · VIP stamped in orange · 23–24 July 2026 · 09:00–18:00 · TRADEHALL sponsor strip · wikiexpo.com. I photographed the card on purpose: invitation status, dates, venue brand — an inspectable receipt, not a LinkedIn caption. VIP was the credential that opened denser rooms.",
        facts: ["Status: VIP", "Site: wikiexpo.com", "Sponsor strip: TRADEHALL", "Hours: 09:00–18:00"],
      },
      zh: {
        k: "01 · 邀请",
        t: "VIP 凭证——不是走廊通行证",
        p: "实体胸卡：WIKI FINANCE EXPO HONG KONG 2026 · Sparking Opportunity, Trading Safety · 橙色 VIP 戳记 · 2026年7月23–24日 · 09:00–18:00 · TRADEHALL 赞助条 · wikiexpo.com。我特意拍下胸卡：邀请身份、日期、场地品牌——可核对的收据，不是 LinkedIn 文案。VIP 是打开更密房间的凭证。",
        facts: ["身份：VIP", "站点：wikiexpo.com", "赞助条：TRADEHALL", "时段：09:00–18:00"],
      },
    },
    {
      id: "floor",
      img: "assets/wiki/wiki-1.webp",
      en: {
        k: "02 · Floor",
        t: "Branded marble · WikiGold · partner strip",
        p: "Daylight expo hall: Hong Kong skyline backdrop, WikiGold standing mark, RS Finance floor graphic, Ronin gimbal in frame. I walked this as a researcher — mapping who sells rails, who sells risk language, who sells “safety.”",
        facts: ["Backdrop: Wiki Finance Expo HK 2026", "Floor: RS Finance / partners", "Atmosphere: filmed / streamed"],
      },
      zh: {
        k: "02 · 展厅",
        t: "品牌大理石厅 · WikiGold · 合作方条带",
        p: "日间展厅：香港天际线背板、WikiGold 立牌、RS Finance 地面图形、画面里的 Ronin 云台。我以研究者身份走动——谁在卖通道、谁在卖风险话术、谁在卖「安全」。",
        facts: ["背板：Wiki Finance Expo HK 2026", "地面：RS Finance / 合作方", "氛围：拍摄 / 直播"],
      },
    },
    {
      id: "panel",
      img: "assets/wiki/wiki-4.webp",
      en: {
        k: "03 · Rooms",
        t: "RWA / tokenization · institutional adoption",
        p: "Panel discourse on tokenization moving from pilot to mainstream — Bitget stage mark, WikiEXPO / WikiGlobal branding, packed chairs. This is where my blind-spot agenda meets public market language: if AI floods predictors, screens still ask the wrong unconditional question.",
        facts: ["Theme: RWA & institutional adoption", "Signal: industry discourse, not a classroom"],
      },
      zh: {
        k: "03 · 会场",
        t: "RWA / 代币化 · 机构采纳",
        p: "分论坛讨论代币化从试点走向主流——Bitget 舞台标识、WikiEXPO / WikiGlobal 品牌、坐满的椅子。这是我的盲区议程接触公开市场语言的地方：若 AI 让预测器泛滥，筛选仍在问错无条件问题。",
        facts: ["主题：RWA 与机构采纳", "信号：行业话语，不是课堂"],
      },
    },
    {
      id: "pose",
      img: "assets/wiki/wiki-3.webp",
      en: {
        k: "04 · Presence",
        t: "On the floor with a lanyard — agency visible",
        p: "I showed up. Lanyard on. Peers in frame. For Academy reviewers: this is the same person who ships the repro pack — already in motion in industry rooms when invited, not only in a private notebook.",
        facts: ["Proof: body on site", "Not: remote cosplay"],
      },
      zh: {
        k: "04 · 在场",
        t: "胸卡在身出现在展厅——行动力可见",
        p: "我到场了。挂着胸卡。同侪同框。给 Academy 审阅者：这与交付可复现包的是同一个人——受邀后出现在行业现场，而不只是在私人笔记本里。",
        facts: ["证据：人在现场", "不是：远程扮演"],
      },
    },
    {
      id: "after",
      img: "assets/wiki/wiki-2.webp",
      en: {
        k: "05 · After",
        t: "After party · same brand, different temperature",
        p: "Night LED: AFTER PARTY WIKI FINANCE EXPO HONG KONG 2026 · Victoria Harbour skyline · WikiFX / WikiBit / WikiGold strip. Informal rooms still carry the slogan. I stayed — because field contact includes the social layer where deals and introductions actually happen.",
        facts: ["Tone: lounge / neon", "Brand continuity: Trading Safety"],
      },
      zh: {
        k: "05 · 夜场",
        t: "After party · 同一品牌，不同温度",
        p: "夜间 LED：AFTER PARTY WIKI FINANCE EXPO HONG KONG 2026 · 维多利亚港天际线 · WikiFX / WikiBit / WikiGold 条带。非正式场合仍挂着口号。我留下——因为现场接触包含交易与引荐真正发生的社交层。",
        facts: ["气质：lounge / 霓虹", "品牌连续：Trading Safety"],
      },
    },
  ];

  let cur = 0;
  function render(i) {
    cur = i;
    const L = langNow() === "zh" ? "zh" : "en";
    const c = CH[i];
    const d = c[L];
    chapters.querySelectorAll("button").forEach((b, n) => b.classList.toggle("active", n === i));
    stage.innerHTML = `
      <div class="field-stage-grid">
        <button type="button" class="field-shot" data-full="${c.img}">
          <img src="${c.img}" alt="${d.t}" />
        </button>
        <div class="field-copy">
          <p class="field-k">${d.k}</p>
          <h3>${d.t}</h3>
          <p>${d.p}</p>
          <ul class="field-facts">${d.facts.map((f) => `<li>${f}</li>`).join("")}</ul>
        </div>
      </div>`;
    stage.querySelector(".field-shot")?.addEventListener("click", () => {
      const lb = document.getElementById("lightbox");
      const img = document.getElementById("lightbox-img");
      if (lb && img) {
        img.src = c.img;
        lb.hidden = false;
        document.body.style.overflow = "hidden";
      }
    });
  }

  CH.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.role = "tab";
    b.dataset.i = String(i);
    b.textContent = langNow() === "zh" ? c.zh.k : c.en.k;
    if (i === 0) b.classList.add("active");
    b.addEventListener("click", () => render(i));
    chapters.appendChild(b);
  });

  function relabel() {
    [...chapters.children].forEach((b, i) => {
      b.textContent = langNow() === "zh" ? CH[i].zh.k : CH[i].en.k;
    });
    render(cur);
  }
  document.addEventListener("hj:lang", relabel);
  render(0);
}

function initStackLab() {
  const rail = document.getElementById("stack-rail");
  const stage = document.getElementById("stack-stage");
  const layersEl = document.getElementById("stack-layers");
  if (!rail || !stage) return;

  const LAYERS = [
    { id: "research", en: "Research", zh: "研究", ids: ["boat_factor", "boat_signal", "boat_backtest"] },
    { id: "risk", en: "Risk & control", zh: "风控", ids: ["boat_risk", "boat_monitor", "boat_bench_harness"] },
    { id: "exec", en: "Execution", zh: "执行", ids: ["boat_execution", "boat_gateway", "boat_shm"] },
    { id: "surface", en: "Surfaces", zh: "界面", ids: ["boat_web", "captain", "boat_team", "boat_common"] },
    { id: "public", en: "Public receipt", zh: "公网收据", ids: ["public"] },
  ];

  const CRATES = [
    { id: "boat_factor", layer: "research", en: "Factor research core · LLM agent factory · typed AST DSL · constitution gates · WASM sandbox · llm_agent (~77 .rs)", zh: "因子研究核心 · LLM agent 工厂 · 类型化 AST DSL · 宪章闸门 · WASM 沙箱 · llm_agent（约 77 个 .rs）", deps: "feeds boat_backtest · studied by paper program" },
    { id: "boat_backtest", layer: "research", en: "Backtest engine for strategies and own-regime overlays", zh: "策略与自状态 overlay 回测引擎", deps: "consumes factor outputs" },
    { id: "boat_signal", layer: "research", en: "Signal generation and transforms over microstructure inputs", zh: "基于微观结构输入的信号生成与变换", deps: "shared with factor DSL" },
    { id: "boat_risk", layer: "risk", en: "Risk controls, limits, kill-switches toward live books", zh: "风控、限额、面向实盘账本的熔断", deps: "gates execution" },
    { id: "boat_monitor", layer: "risk", en: "Monitoring and observability hooks", zh: "监控与可观测性钩子", deps: "ops surface" },
    { id: "boat_bench_harness", layer: "risk", en: "Benchmark harness for latency / throughput work", zh: "延迟 / 吞吐性能基准架", deps: "CI / perf" },
    { id: "boat_execution", layer: "exec", en: "Execution path · order routing toward live venues", zh: "执行路径 · 对接实盘下单", deps: "after risk checks" },
    { id: "boat_gateway", layer: "exec", en: "Gateway / connectivity layer to venues and feeds", zh: "对接交易所与行情的网关层", deps: "IO boundary" },
    { id: "boat_shm", layer: "exec", en: "Shared-memory / low-latency plumbing", zh: "共享内存 / 低延迟管线", deps: "hot path" },
    { id: "boat_web", layer: "surface", en: "Internal web surfaces for operators", zh: "操作者内部 Web 面", deps: "UI packages" },
    { id: "captain", layer: "surface", en: "App shell apps/captain — operator-facing control surface", zh: "应用壳 apps/captain — 操作者控制面", deps: "packages/*" },
    { id: "boat_team", layer: "surface", en: "Team / collaboration utilities", zh: "团队协作工具", deps: "ops" },
    { id: "boat_common", layer: "surface", en: "Shared types and utilities across crates", zh: "跨 crate 共享类型与工具", deps: "workspace glue" },
    { id: "public", layer: "public", en: "Public receipt: boatfx-repro (site · repro.py · reproduce_headline.py · system_showcase · CI Pages)", zh: "公网收据：boatfx-repro（站 · repro · 头条复现 · showcase · CI Pages）", deps: "curated — not a dump" },
  ];

  let layer = "research";
  let active = "boat_factor";

  function show(id) {
    active = id;
    const c = CRATES.find((x) => x.id === id) || CRATES[0];
    rail.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.id === c.id));
    const L = langNow() === "zh";
    const title = L ? "私有栈节点" : "Private stack node";
    const layerLabel = LAYERS.find((x) => x.id === c.layer);
    const layerName = layerLabel ? (L ? layerLabel.zh : layerLabel.en) : c.layer;
    const note = L
      ? "公开仓不倾倒整树。这里只展示角色分区——可核对、不可泄密。体量见 SCALE.md。"
      : "The public repo does not dump the tree. Role partition only — inspectable, not leaked. Mass notes in SCALE.md.";
    stage.innerHTML = `
      <p class="stack-k">${title} · <span class="stack-layer-tag">${layerName}</span></p>
      <h3 class="mono">${c.id}</h3>
      <p>${L ? c.zh : c.en}</p>
      <p class="stack-deps"><span>${L ? "关系" : "Relation"}</span> ${c.deps}</p>
      <p class="stack-note">${note}</p>
      <div class="stack-actions">
        <a class="btn ghost" href="${c.id === "public" ? "https://github.com/nemo02070118/boatfx-repro" : "#proof"}" ${c.id === "public" ? 'target="_blank" rel="noopener"' : ""}>${c.id === "public" ? (L ? "打开公网仓 →" : "Open public repo →") : (L ? "看证据区 →" : "See proof →")}</a>
      </div>`;
  }

  function paintRail() {
    rail.innerHTML = "";
    const ids = (LAYERS.find((x) => x.id === layer) || LAYERS[0]).ids;
    ids.forEach((id, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.id = id;
      b.textContent = id;
      if (id === active || (i === 0 && !ids.includes(active))) b.classList.add("active");
      b.addEventListener("click", () => show(id));
      rail.appendChild(b);
    });
    const first = ids.includes(active) ? active : ids[0];
    show(first);
  }

  if (layersEl) {
    LAYERS.forEach((L0, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.layer = L0.id;
      b.textContent = langNow() === "zh" ? L0.zh : L0.en;
      if (i === 0) b.classList.add("active");
      b.addEventListener("click", () => {
        layer = L0.id;
        layersEl.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.layer === layer));
        paintRail();
      });
      layersEl.appendChild(b);
    });
  }

  function relabelLayers() {
    if (!layersEl) return;
    [...layersEl.children].forEach((b, i) => {
      b.textContent = langNow() === "zh" ? LAYERS[i].zh : LAYERS[i].en;
    });
    paintRail();
  }

  paintRail();
  document.addEventListener("hj:lang", relabelLayers);
}

function initArgumentTour() {
  const stepsEl = document.getElementById("tour-steps");
  const stage = document.getElementById("tour-stage");
  const idxEl = document.getElementById("tour-index");
  const prev = document.getElementById("tour-prev");
  const next = document.getElementById("tour-next");
  if (!stepsEl || !stage) return;

  const STEPS = [
    {
      k: { en: "Claim", zh: "主张" },
      title: { en: "The screen asks the wrong question", zh: "筛选在问错问题" },
      body: {
        en: "Unconditional screens ask whether a factor pays on average. A state-confined premium can average near zero and still be real inside its paying state.",
        zh: "无条件筛选问的是因子平均是否兑现。被困在状态里的溢价可以全局接近零，却在兑现状态内真实存在。",
      },
      jump: "idea",
      metric: "Proposition 2",
    },
    {
      k: { en: "Mechanism", zh: "机制" },
      title: { en: "tg ≈ tstate √π", zh: "tg ≈ tstate √π" },
      body: {
        en: "As the paying state grows rare, global t vanishes even if conditional strength stays large. Hard gates delete legs; continuous tilt keeps breadth.",
        zh: "兑现状态越稀有，全局 t 越消失——即便条件强度仍大。硬闸门删腿；连续倾斜保留广度。",
      },
      jump: "math",
      metric: { en: "Blind-spot identity", zh: "盲区恒等式" },
    },
    {
      k: { en: "Machines", zh: "机器" },
      title: { en: "6,881 proposals · 0 clear the global screen", zh: "6,881 提案 · 0 通过全局筛选" },
      body: {
        en: "10.0% flagged regime-local → 3.15% survive block-shuffle → 1.08% clear BH one-at-a-time. Anchor: 6.4× falsification excess.",
        zh: "10.0% 标为状态局部 → 3.15% 通过块重排证伪 → 1.08% 通过 BH 逐因子。锚点：6.4× 证伪超额。",
      },
      jump: "machine",
      metric: "6.4×",
    },
    {
      k: { en: "Economics", zh: "经济" },
      title: { en: "Deployable overlay on public panels", zh: "公网面板上的可部署 overlay" },
      body: {
        en: "24/24 same-base increments positive. VW ~172 bps/yr · IR ≈ 1.99. Public check: shipped tilt OUTPUT + python reproduce_headline.py.",
        zh: "24/24 同基增量为正。VW ~172 bps/年 · IR ≈ 1.99。公网核对：已交付 tilt 输出 + python reproduce_headline.py。",
      },
      jump: "results",
      metric: "172 bps",
    },
    {
      k: { en: "Factory", zh: "工厂" },
      title: { en: "AI proposes · quant admits", zh: "AI 提案 · 量化准入" },
      body: {
        en: "Typed AST → sandbox → rationale → constitution gates. Study discards — that is where the blind spot bites.",
        zh: "类型化 AST → 沙箱 → 经济理由 → 宪章闸门。研究被丢弃者——盲区正咬在这里。",
      },
      jump: "factory",
      metric: { en: "Gated loop", zh: "闸门回路" },
    },
    {
      k: { en: "Field", zh: "现场" },
      title: { en: "Wiki Finance 2026 · VIP · already in rooms", zh: "Wiki Finance 2026 · VIP · 已在现场" },
      body: {
        en: "VIP invite · Hopewell Hotel Wan Chai · panels + after party. Research that survives contact with live fintech discourse.",
        zh: "VIP 邀请 · 湾仔合和酒店 · 分论坛 + after party。能经得起真实 fintech 话语摩擦的研究。",
      },
      jump: "field",
      metric: "VIP",
    },
    {
      k: { en: "Agency", zh: "行动力" },
      title: { en: "Already in motion · on leave to go deeper", zh: "已在行动 · 休学以走得更深" },
      body: {
        en: "JF external review · EFA submitted · leave of absence · ≤1 year college · Academy-eligible · SF-ready.",
        zh: "JF 外部审稿 · EFA 已投 · 休学 · 大学未满一年 · 符合 Academy · 准备赴 SF。",
      },
      jump: "agency",
      metric: { en: "Proof of work", zh: "工作证据" },
    },
  ];

  let i = 0;
  function pick(v) {
    if (typeof v === "string") return v;
    return langNow() === "zh" ? v.zh : v.en;
  }

  function buildSteps() {
    stepsEl.innerHTML = "";
    STEPS.forEach((s, n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tour-step" + (n === i ? " active" : "");
      b.innerHTML = `<span>${String(n + 1).padStart(2, "0")}</span><b>${pick(s.k)}</b>`;
      b.addEventListener("click", () => show(n));
      stepsEl.appendChild(b);
    });
  }

  function show(n) {
    i = (n + STEPS.length) % STEPS.length;
    const s = STEPS[i];
    buildSteps();
    stage.innerHTML = `
      <div class="tour-metric">${pick(s.metric)}</div>
      <h3>${pick(s.title)}</h3>
      <p>${pick(s.body)}</p>
      <button type="button" class="tour-jump" data-jump="${s.jump}">${langNow() === "zh" ? "打开对应区块 →" : "Open section →"}</button>
    `;
    if (idxEl) idxEl.textContent = `${i + 1} / ${STEPS.length}`;
    stage.querySelector(".tour-jump")?.addEventListener("click", (e) => {
      document.getElementById(e.currentTarget.dataset.jump)?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function labelNav() {
    if (prev) prev.textContent = langNow() === "zh" ? "← 上一步" : "← Prev";
    if (next) next.textContent = langNow() === "zh" ? "下一步 →" : "Next →";
  }
  labelNav();
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
  document.addEventListener("hj:lang", () => { labelNav(); show(i); });
  show(0);
}

function initPaperLab() {
  const stage = document.getElementById("paper-stage");
  const tabs = document.querySelectorAll(".paper-tab");
  if (!stage || !tabs.length) return;

  const CLAIMS = {
    load: {
      en: {
        title: "Tier I · Load-bearing — deployable overlay",
        lead: "The claim I lean on: conditioning adds net-of-cost active return on investable books.",
        bullets: [
          "Chen–Zimmermann OSAP · seven allocators × four panels → 24/24 same-base increments positive",
          "Institutionally investable: ~134–172 bps/yr active · IR ≈ 1.7–2.0 (VW headline 172 · IR ≈ 1.99)",
          "Survives Romano–Wolf / e-BH; Lo (2002) holds on tradeable panels (20/24 familywise)",
          "Public check: shipped tilt OUTPUT + python reproduce_headline.py — router estimation code withheld",
        ],
        badge: "Recomputable from public pack",
      },
      zh: {
        title: "层级 I · 承重——可部署 overlay",
        lead: "我倚重的主张：条件化在可投资账本上增加净成本后主动收益。",
        bullets: [
          "Chen–Zimmermann OSAP · 七种配置 × 四个面板 → 24/24 同基增量为正",
          "机构可投：约 134–172 bps/年主动 · IR ≈ 1.7–2.0（VW 头条 172 · IR ≈ 1.99）",
          "通过 Romano–Wolf / e-BH；Lo (2002) 在可交易面板成立（20/24）",
          "公网核对：已交付 tilt 输出 + python reproduce_headline.py — 路由估计代码保留",
        ],
        badge: "可从公网包重算",
      },
      formula: "\\text{active bps}_{\\mathrm{VW}} \\approx 172 \\quad \\mathrm{IR}\\approx 1.99",
    },
    id: {
      en: {
        title: "Tier II · Identification — the blind spot is structural",
        lead: "Rescued factors carry genuine state-dependent structure — verified by falsification, not vibes.",
        bullets: [
          "Cross-fit: state labels ⊥ conditional alpha on purged month halves · increment positive in 100% of splits",
          "Own-regime beats placebo regime borrowed from another factor by ~3–5×",
          "States persist ~8.6 months on average — tradeable, not monthly noise",
          "Funding scarcity (HKM / Baa–Aaa) steepens local strength; vol placebos fail",
        ],
        badge: "Scientific claim · checkable on Alpha191/101",
      },
      zh: {
        title: "层级 II · 识别——盲区是结构性的",
        lead: "被救回的因子携带真实状态依赖结构——靠证伪，不靠感觉。",
        bullets: [
          "交叉拟合：状态标签 ⊥ 条件 alpha（清洗半月）· 100% 分割增量为正",
          "自状态相对借用他因子安慰剂状态约强 3–5×",
          "状态平均持续约 8.6 个月——可交易，不是月度噪声",
          "融资稀缺（HKM / Baa–Aaa）使局部强度变陡；波动安慰剂失败",
        ],
        badge: "科学主张 · 可在 Alpha191/101 核对",
      },
      formula: "t_g \\approx t_{\\mathrm{state}}\\sqrt{\\pi}",
    },
    machine: {
      en: {
        title: "Tier II·b · Machine population — where the blind spot bites",
        lead: "6,881 genuinely machine-generated factors; none clears the global screen — yet structure remains.",
        bullets: [
          "10.0% flagged regime-local (bootstrap 95% · 9.3–10.7%)",
          "3.15% survive block-shuffle falsification · 1.08% clear BH one-at-a-time",
          "Assumption-free anchor: 6.4× falsification passes vs global-null allowance (219 vs 34)",
          "Same order of magnitude on human libraries: Alpha191 13.8% · Alpha101 11.6%",
        ],
        badge: "Correction cost made visible on purpose",
      },
      zh: {
        title: "层级 II·b · 机器总体——盲区咬合处",
        lead: "6,881 个真实机器生成因子；无一通过全局筛选——结构仍在。",
        bullets: [
          "10.0% 标为状态局部（bootstrap 95% · 9.3–10.7%）",
          "3.15% 通过块重排证伪 · 1.08% 通过 BH 逐因子",
          "无假设锚点：证伪通过数相对全局零假设额度 6.4×（219 vs 34）",
          "人类库同量级：Alpha191 13.8% · Alpha101 11.6%",
        ],
        badge: "刻意展示校正成本",
      },
      formula: "6{,}881 \\rightarrow 10.0\\% \\rightarrow 3.15\\% \\rightarrow 1.08\\%",
    },
    prop2: {
      en: {
        title: "Proposition 2 · State blind spot",
        lead: "A state-confined premium’s global t-statistic vanishes as the paying state grows rare.",
        bullets: [
          "Unconditional mean dilutes local strength by state frequency π",
          "First-order identity: tg ≈ tstate √π — rare paying states look globally weak",
          "Hard gates delete legs; continuous tilt keeps breadth and reweights",
          "Interactive lab below: drag π, tstate, and the screen threshold",
        ],
        badge: "Mechanism — not a backtest slogan",
      },
      zh: {
        title: "命题 2 · 状态盲区",
        lead: "被困在状态中的溢价，其全局 t 统计量随兑现状态变稀有而消失。",
        bullets: [
          "无条件均值按状态频率 π 稀释局部强度",
          "一阶恒等式：tg ≈ tstate √π — 稀有兑现状态看起来全局很弱",
          "硬闸门删腿；连续倾斜保留广度并重加权",
          "下方实验室：拖动 π、tstate 与筛选阈值",
        ],
        badge: "机制——不是回测口号",
      },
      formula: "t_g \\approx t_{\\mathrm{state}}\\sqrt{\\pi}",
    },
    suggest: {
      en: {
        title: "Tier III · Suggestive — reported, not leaned on",
        lead: "I show these for completeness. They are not load-bearing for the paper’s central claim.",
        bullets: [
          "Shorting-cost natural experiments and short cross-asset panels",
          "Observational funding interactions — I stop short of a causal claim",
          "OOS corroboration vs matched placebos can be directional rather than decisive",
          "Honesty rule: raw rescue rates always appear beside FDR-controlled floors",
        ],
        badge: "Explicitly down-weighted",
      },
      zh: {
        title: "层级 III · 提示性——报告但不倚重",
        lead: "为完整性展示。它们不是论文中心主张的承重柱。",
        bullets: [
          "做空成本自然实验与短截面跨资产面板",
          "观测性融资互动——我停在因果主张之前",
          "相对匹配安慰剂的 OOS 印证可能是方向性而非决定性",
          "诚实规则：原始救回率始终与 FDR 控制下界并排出现",
        ],
        badge: "明确降权",
      },
      formula: "\\text{do not lean}",
    },
  };

  let cur = "load";
  function show(key) {
    cur = key;
    const pack = CLAIMS[key];
    if (!pack) return;
    const c = langNow() === "zh" ? pack.zh : pack.en;
    stage.innerHTML = `
      <div class="paper-badge">${c.badge}</div>
      <h3>${c.title}</h3>
      <p class="paper-lead">${c.lead}</p>
      <div class="paper-tex" data-tex="${pack.formula}"></div>
      <ul>${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
      <button type="button" class="paper-jump" data-jump="${key === "prop2" ? "math" : key === "machine" ? "machine" : key === "load" ? "results" : "math"}">${langNow() === "zh" ? "打开相关实验室 →" : "Open related lab →"}</button>
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
  document.addEventListener("hj:lang", () => show(cur));
  show("load");
}

function initFunnelLab() {
  const detail = document.getElementById("funnel-detail");
  const steps = document.querySelectorAll("#funnel [data-funnel]");
  if (!detail || !steps.length) return;
  const COPY = [
    {
      en: { title: "Pool · 6,881 machine factors", body: "Genuinely machine-generated — not a human shortlist. None clears the unconditional global screen. The question is what the discards still contain." },
      zh: { title: "总体 · 6,881 机器因子", body: "真实机器生成——不是人类短名单。无一通过无条件全局筛选。问题是被丢弃者里还剩什么。" },
    },
    {
      en: { title: "Flagged regime-local · 10.0%", body: "Bootstrap 95% interval 9.3–10.7%. Same order of magnitude on Alpha191 (13.8%) and Alpha101 (11.6%)." },
      zh: { title: "标为状态局部 · 10.0%", body: "Bootstrap 95% 区间 9.3–10.7%。Alpha191（13.8%）与 Alpha101（11.6%）同量级。" },
    },
    {
      en: { title: "Block-shuffle falsification · 3.15%", body: "Induced-null pipeline: shuffle regime labels in blocks and re-run. Global-pass factors produce no false rescues on the same test." },
      zh: { title: "块重排证伪 · 3.15%", body: "诱导零假设流水线：按块打乱状态标签并重跑。全局通过的因子在同一检验上不产生假救回。" },
    },
    {
      en: { title: "BH one-factor-at-a-time · 1.08%", body: "Correction cost made visible on purpose. Raw rescue rates sit beside FDR-controlled floors." },
      zh: { title: "BH 逐因子 · 1.08%", body: "刻意展示校正成本。原始救回率与 FDR 控制下界并排。" },
    },
    {
      en: { title: "Assumption-free anchor · 6.4×", body: "Flagged set produces 219 falsification passes versus 34 allowed under a global null." },
      zh: { title: "无假设锚点 · 6.4×", body: "标记集合产生 219 次证伪通过，相对全局零假设额度 34。" },
    },
  ];
  let cur = 0;
  function show(i) {
    cur = Number(i);
    const c = (COPY[cur] || COPY[0])[langNow() === "zh" ? "zh" : "en"];
    steps.forEach((s) => s.classList.toggle("active", String(s.dataset.funnel) === String(cur)));
    detail.innerHTML = `<h4>${c.title}</h4><p>${c.body}</p>`;
  }
  steps.forEach((s) => s.addEventListener("click", () => show(s.dataset.funnel)));
  document.addEventListener("hj:lang", () => show(cur));
  show(0);
}

function initAgencyLab() {
  const panel = document.getElementById("agency-panel");
  const tabs = document.querySelectorAll(".agency-tab");
  if (!panel || !tabs.length) return;

  const COPY = {
    motion: {
      en: { title: "Already in motion", body: "22 months on this system — not a prompt-weekend. JF MS 2026-0738: passed desk, now in external review under Antoinette Schoar. EFA submitted. Academic leave for full-time research. Public site + repro + CI + walkthrough. Wiki Finance Expo HK 2026 VIP. HKEX invited learning visit. Zheshang Houlang Elite Class VII instructor. Zheshang production systems from Aug 2025." },
      zh: { title: "已在行动", body: "这个系统做了 22 个月——不是周末提示词。JF MS 2026-0738：已过 desk，现由 Antoinette Schoar 主持外部审稿。EFA 已投。休学全职研究。公网站 + repro + CI + 讲解视频。Wiki Finance Expo 香港 2026 VIP。港交所受邀学习交流。浙商后浪投研精英班第七期指导员。2025 年 8 月起浙商生产系统。" },
    },
    agency: {
      en: { title: "Agency", body: "When AI-scale factor proposal captured my attention, I built a factory with gates, derived the blind-spot identity, falsified my own rescues, showed up when invited to industry rooms, and made load-bearing numbers regenerable by strangers." },
      zh: { title: "行动力", body: "当 AI 规模因子提案抓住我的注意力，我建造带闸门的工厂，推导盲区恒等式，证伪自己的救回，受邀后出现在行业现场，并让承重数字可被陌生人重算。" },
    },
    proof: {
      en: { title: "Proof of work", body: "Original research counts. Live portfolio. python repro.py (60/60). python reproduce_headline.py (~172 bps · IR ≈ 2). system_showcase. SCALE.md. Zheshang letter. VIP field photos. Video: youtu.be/tVHLUQy93rg." },
      zh: { title: "工作证据", body: "原创研究算数。公网作品集。python repro.py（60/60）。python reproduce_headline.py（~172 bps · IR ≈ 2）。system_showcase。SCALE.md。浙商推荐信。VIP 现场照片。视频：youtu.be/tVHLUQy93rg。" },
    },
    elig: {
      en: { title: "Leave of absence · eligibility", body: "Academic leave from Shanghai Lixin University of Accounting and Finance. Academy-eligible: not more than one year of full-time college after high school by August 2027. International. Ready for San Francisco Founding Class (Sep 2027)." },
      zh: { title: "休学 · 资格", body: "自上海立信会计金融学院休学。符合 Academy：截至 2027 年 8 月高中后全职大学未满一年。国际申请人。准备赴旧金山 Founding Class（2027 年 9 月）。" },
    },
    why: {
      en: { title: "Why The Academy · why now", body: "Harder peers and external tests. SF for a year to push AI×quant screening science into a sharper product surface without abandoning falsification. Peers ship apps and robots — I bring a research system under JF external review plus field presence." },
      zh: { title: "为什么是 Academy · 为什么是现在", body: "更硬的同侪与外部检验。在旧金山一年，把 AI×量化筛选科学推到更锋利的产品面，同时不放弃证伪纪律。同侪交付应用与机器人——我带来处于 JF 外部审稿中的研究系统 + 现场在场。" },
    },
  };

  let cur = "motion";
  function show(key) {
    cur = key;
    const c = (COPY[key] || COPY.motion)[langNow() === "zh" ? "zh" : "en"];
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.agency === key));
    panel.innerHTML = `<h3>${c.title}</h3><p>${c.body}</p>`;
  }
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.agency)));
  document.addEventListener("hj:lang", () => show(cur));
  show("motion");
}


function initPiScenarios() {
  const host = document.getElementById("pi-scenarios");
  if (!host) return;
  const SC = [
    { id: "rare", en: "Rare state π=0.10", zh: "稀有状态 π=0.10", pi: 0.10, t: 3.0, thr: 2.0 },
    { id: "base", en: "Baseline π=0.25", zh: "基线 π=0.25", pi: 0.25, t: 3.0, thr: 2.0 },
    { id: "common", en: "Common π=0.50", zh: "常见 π=0.50", pi: 0.50, t: 3.0, thr: 2.0 },
    { id: "strong", en: "Strong local t=4.5", zh: "强局部 t=4.5", pi: 0.15, t: 4.5, thr: 2.0 },
    { id: "harsh", en: "Harsh screen |t|=3", zh: "苛刻阈值 |t|=3", pi: 0.25, t: 3.0, thr: 3.0 },
  ];
  function paint() {
    const zh = (localStorage.getItem("hj-lang") || "en") === "zh";
    host.innerHTML = SC.map((s, i) =>
      `<button type="button" data-i="${i}" class="${i === 1 ? "active" : ""}">${zh ? s.zh : s.en}</button>`
    ).join("");
    host.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        const s = SC[Number(b.dataset.i)];
        const pi = document.getElementById("pi-range");
        const ts = document.getElementById("tstate-range");
        const th = document.getElementById("thresh-range");
        if (pi) { pi.value = String(s.pi); pi.dispatchEvent(new Event("input")); }
        if (ts) { ts.value = String(s.t); ts.dispatchEvent(new Event("input")); }
        if (th) { th.value = String(s.thr); th.dispatchEvent(new Event("input")); }
        host.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      });
    });
  }
  paint();
  document.addEventListener("hj:lang", paint);
}


function initPaperTabI18n() {
  const MAP = {
    load: { en: ["Tier I", "Load-bearing", "Deployable overlay"], zh: ["层级 I", "承重", "可部署 overlay"] },
    id: { en: ["Tier II", "Identification", "Blind spot is real"], zh: ["层级 II", "识别", "盲区真实"] },
    machine: { en: ["Tier II·b", "Machine pool", "6,881 discards"], zh: ["层级 II·b", "机器池", "6,881 丢弃"] },
    prop2: { en: ["Core", "Proposition 2", "State blind spot"], zh: ["核心", "命题 2", "状态盲区"] },
    suggest: { en: ["Tier III", "Suggestive", "Reported, not leaned on"], zh: ["层级 III", "提示性", "报告但不倚重"] },
  };
  function paint() {
    const L = (localStorage.getItem("hj-lang") || "en") === "zh" ? "zh" : "en";
    document.querySelectorAll(".paper-tab").forEach((tab) => {
      const m = MAP[tab.dataset.claim];
      if (!m) return;
      const [tier, b, em] = m[L];
      const on = tab.classList.contains("active");
      const sel = tab.getAttribute("aria-selected");
      tab.innerHTML = `<span class="tier">${tier}</span><b>${b}</b><em>${em}</em>`;
      if (on) tab.classList.add("active");
      if (sel) tab.setAttribute("aria-selected", sel);
    });
  }
  paint();
  document.addEventListener("hj:lang", paint);
}


function initPaperAtlas() {
  const graph = document.getElementById("atlas-graph");
  const panel = document.getElementById("atlas-panel");
  const meters = document.getElementById("atlas-meters");
  if (!graph || !panel) return;

  const NODES = [
    {
      id: "blind",
      en: { k: "Blind spot", t: "Unconditional screens ask the wrong question", p: "A factor that pays only inside a market state can look globally weak. The manuscript’s Proposition 2 makes the dilution precise: the unconditional t scales with √π and vanishes as the paying state grows rare — so a genuine conditional predictor is discarded as weak on average." },
      zh: { k: "盲区", t: "无条件筛选在问错问题", p: "只在市场状态内兑现的因子，全局可看起来很弱。手稿命题 2 把稀释写精确：无条件 t 随 √π 缩放，兑现状态越稀有越消失——真实的条件预测器会被当作平均很弱而丢弃。" },
    },
    {
      id: "machine",
      en: { k: "Machine pool", t: "6,881 proposals · correction cost visible", p: "None clears the global screen. 10.0% flagged regime-local (9.3–10.7% bootstrap). Tightening standards: 3.15% survive block-shuffle; 1.08% clear BH one-at-a-time. Assumption-free anchor: 6.4× falsification passes vs global-null allowance (219 vs 34)." },
      zh: { k: "机器池", t: "6,881 提案 · 校正成本可见", p: "无一通过全局筛选。10.0% 标为状态局部（bootstrap 9.3–10.7%）。收紧标准：3.15% 通过块重排；1.08% 通过 BH 逐因子。无假设锚点：证伪通过数相对全局零假设额度 6.4×（219 vs 34）。" },
    },
    {
      id: "econ",
      en: { k: "Economics", t: "Deployable overlay · 24/24", p: "Own-regime hierarchical tilt on Chen–Zimmermann OSAP. All 24 same-base comparisons earn positive active return (RW + e-BH). Institutionally investable band ~134–172 bps/yr · IR ≈ 1.7–2.0 (VW headline 172 · IR 1.99). Public check: shipped tilt OUTPUT + reproduce_headline.py." },
      zh: { k: "经济含义", t: "可部署 overlay · 24/24", p: "在 Chen–Zimmermann OSAP 上做自状态分层倾斜。24 个同基比较全部主动收益为正（RW + e-BH）。机构可投大约 134–172 bps/年 · IR ≈ 1.7–2.0（VW 头条 172 · IR 1.99）。公网核对：已交付 tilt 输出 + reproduce_headline.py。" },
    },
    {
      id: "cred",
      en: { k: "Credibility", t: "Cross-fit · placebos · funding gradient", p: "Cross-fit: labels ⊥ alpha on purged halves · increment positive in 100% of splits. Own-regime beats borrowed placebo ~3–5×. States persist ~8.6 months. Funding scarcity (HKM / Baa–Aaa) steepens local strength (t = 3.62 / 2.81); vol placebos fail. Suggestive tiers are reported, not leaned on." },
      zh: { k: "可信度", t: "交叉拟合 · 安慰剂 · 融资梯度", p: "交叉拟合：清洗半月上标签 ⊥ alpha · 100% 分割增量为正。自状态相对借用安慰剂约强 3–5×。状态平均持续约 8.6 个月。融资稀缺（HKM / Baa–Aaa）使局部强度变陡（t = 3.62 / 2.81）；波动安慰剂失败。提示性层级只报告、不倚重。" },
    },
    {
      id: "expert",
      en: { k: "Expert libraries", t: "Not one generator’s artifact", p: "Same order of magnitude on human libraries: Alpha191 13.8% · Alpha101 11.6% regime-local. The blind spot is a property of unconditional screening, not of a single machine search engine." },
      zh: { k: "专家库", t: "不是单一生成器的产物", p: "人类库同量级：Alpha191 13.8% · Alpha101 11.6% 状态局部。盲区是无条件筛选的性质，不是某个机器搜索引擎的产物。" },
    },
  ];

  let cur = 0;
  function paint() {
    const L = langNow() === "zh" ? "zh" : "en";
    graph.innerHTML = "";
    NODES.forEach((n, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "atlas-node" + (i === cur ? " active" : "");
      b.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span><b>${n[L].k}</b>`;
      b.addEventListener("click", () => { cur = i; paint(); });
      graph.appendChild(b);
    });
    const d = NODES[cur][L];
    panel.innerHTML = `<p class="atlas-k">${d.k}</p><h3>${d.t}</h3><p>${d.p}</p>`;
    if (meters) {
      const M = [
        { en: "Machine pool", zh: "机器池", v: "6,881 → 10.0% → 3.15% → 1.08%" },
        { en: "Falsification", zh: "证伪", v: "6.4× (219 vs 34)" },
        { en: "Deployable VW", zh: "可部署 VW", v: "172 bps · IR 1.99" },
        { en: "Same-base", zh: "同基", v: "24/24 positive" },
      ];
      meters.innerHTML = M.map((m) => `<div><span>${L === "zh" ? m.zh : m.en}</span><b>${m.v}</b></div>`).join("");
    }
  }
  document.addEventListener("hj:lang", paint);
  paint();
}


function initAgencyTabI18n() {
  const MAP = {
    motion: { en: "Already in motion", zh: "已在行动" },
    agency: { en: "Agency", zh: "行动力" },
    proof: { en: "Proof of work", zh: "工作证据" },
    elig: { en: "Leave · eligibility", zh: "休学 · 资格" },
    why: { en: "Why SF / why now", zh: "为何 SF / 为何现在" },
  };
  function paint() {
    const L = langNow() === "zh" ? "zh" : "en";
    document.querySelectorAll(".agency-tab").forEach((t) => {
      const m = MAP[t.dataset.agency];
      if (m) t.textContent = m[L];
    });
  }
  paint();
  document.addEventListener("hj:lang", paint);
}

function initHeroPortraits() {
  const lb = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  if (!lb || !img) return;
  document.querySelectorAll(".hero-portrait [data-full]").forEach((el) => {
    el.addEventListener("click", () => {
      const src = el.dataset.full || el.querySelector("img")?.src;
      if (!src) return;
      img.src = src;
      lb.hidden = false;
      document.body.style.overflow = "hidden";
    });
  });
}


function initPresenceLab(prefix, chapters) {
  const chaptersEl = document.getElementById(prefix + "-chapters");
  const stage = document.getElementById(prefix + "-stage");
  if (!chaptersEl || !stage) return;
  let cur = 0;
  function paint() {
    const L = langNow() === "zh" ? "zh" : "en";
    chaptersEl.innerHTML = "";
    chapters.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = i === cur ? "active" : "";
      b.textContent = c[L].k;
      b.addEventListener("click", () => { cur = i; paint(); });
      chaptersEl.appendChild(b);
    });
    const c = chapters[cur];
    const d = c[L];
    stage.innerHTML = `
      <div class="field-stage-grid">
        <button type="button" class="field-shot" data-full="${c.img}">
          <img src="${c.img}" alt="${d.t}" loading="lazy" />
        </button>
        <div class="field-copy">
          <p class="field-k">${d.k}</p>
          <h3>${d.t}</h3>
          <p>${d.p}</p>
          <ul class="field-facts">${d.facts.map((f) => `<li>${f}</li>`).join("")}</ul>
        </div>
      </div>`;
    stage.querySelector(".field-shot")?.addEventListener("click", () => {
      const lb = document.getElementById("lightbox");
      const img = document.getElementById("lightbox-img");
      if (lb && img) {
        img.src = c.img;
        lb.hidden = false;
        document.body.style.overflow = "hidden";
      }
    });
  }
  document.addEventListener("hj:lang", paint);
  paint();
}

function initHkexLab() {
  initPresenceLab("hkex", [
    {
      img: "assets/hkex/hkex-1.webp",
      en: {
        k: "01 · Invite",
        t: "Visitor pass at the exchange wall",
        p: "Invited learning & exchange at Hong Kong Exchanges (HKEX / 香港交易所). Formal attire, visitor badge on the lapel, standing at the blue brand wall. This is the receipt: invitation status at the exchange — not a hallway selfie and not the Wiki expo floor.",
        facts: ["Mode: learning & exchange", "Badge: visitor / invited", "Distinct from Wiki VIP"],
      },
      zh: {
        k: "01 · 受邀",
        t: "交易所墙前的访客证",
        p: "受邀在香港交易所（HKEX / 香港交易所）学习与交流。正装、胸前访客证、蓝色品牌墙。这是收据：在交易所本体的邀请身份——不是走廊自拍，也不是 Wiki 展厅。",
        facts: ["方式：学习与交流", "证件：访客 / 受邀", "有别于 Wiki VIP"],
      },
    },
    {
      img: "assets/hkex/hkex-1.webp",
      en: {
        k: "02 · Why HKEX",
        t: "Infrastructure language, not booth chatter",
        p: "Exchanges define listing, clearing, and market structure. I went to hear that language in situ and ask whether my blind-spot agenda still holds when the room is the institution that operates the tape — complementary to industry expo talk, not a substitute.",
        facts: ["Object: market infrastructure", "Test: agenda vs institution"],
      },
      zh: {
        k: "02 · 为何港交所",
        t: "基础设施话语，不是展位闲谈",
        p: "交易所定义上市、清算与市场结构。我去现场听这种话语，并问：当房间就是运营行情的机构时，盲区议程是否仍然成立——与行业博览会互补，而不是替代。",
        facts: ["对象：市场基础设施", "检验：议程 vs 机构"],
      },
    },
    {
      img: "assets/hkex/hkex-1.webp",
      en: {
        k: "03 · Separation",
        t: "Three field tracks, three roles",
        p: "Wiki Finance Expo = VIP guest in fintech expo rooms. HKEX = invited learner/exchanger at the exchange. Zheshang camp = instructor. Keep the labels honest so Academy reviewers can map each receipt to a role.",
        facts: ["Wiki ≠ HKEX ≠ Camp", "Honest role labels"],
      },
      zh: {
        k: "03 · 分开写清",
        t: "三条现场轨道，三种角色",
        p: "Wiki Finance Expo = fintech 博览会 VIP。港交所 = 在交易所受邀学习交流。浙商营 = 指导员。标签写诚实，方便 Academy 审阅者把每份收据对应到角色。",
        facts: ["Wiki ≠ 港交所 ≠ 精英班", "诚实角色标签"],
      },
    },
  ]);
}

function initCampLab() {
  initPresenceLab("camp", [
    {
      img: "assets/camp/camp-1.webp",
      en: {
        k: "01 · Program",
        t: "Houlang · Elite Class VII · summer camp",
        p: "浙商证券研究所「后浪计划」投研精英班第七期暨暑期考察营. Signed red wall = cohort was real. I was not just passing through — I served as 指导员 (instructor) for the class and summer inspection camp.",
        facts: ["Host: Zheshang Research Institute", "Role: instructor", "Form: elite class + summer camp"],
      },
      zh: {
        k: "01 · 项目",
        t: "后浪 · 精英班第七期 · 暑期考察营",
        p: "浙商证券研究所「后浪计划」投研精英班第七期暨暑期考察营。红色签名墙 = 同期真实存在。我不是路过——担任本期班级与暑期考察营的指导员。",
        facts: ["主办：浙商证券研究所", "角色：指导员", "形态：精英班 + 暑期营"],
      },
    },
    {
      img: "assets/camp/camp-2.webp",
      en: {
        k: "02 · Room",
        t: "Full hall under the program LED",
        p: "Classroom / banquet hall with the program title on the LED wall, laptops open, nameplates on black tables. Instructor work happens here: keep the cohort oriented, answer research and systems questions, move sessions from slides to practice.",
        facts: ["Branded stage visible", "Working cohort", "Instruction in the room"],
      },
      zh: {
        k: "02 · 会场",
        t: "品牌 LED 下的满堂",
        p: "课堂/宴会厅，LED 打着项目全称，笔记本打开，黑桌红名牌。指导员工作发生在这里：稳住队列、回答研究与系统问题，把环节从幻灯片推到练习。",
        facts: ["品牌舞台可见", "在工作的同期", "指导在房间里"],
      },
    },
    {
      img: "assets/camp/camp-3.webp",
      en: {
        k: "03 · Code on site",
        t: "Quant debugging during the camp",
        p: "First-person desk: IDE open on quant / data issues during the camp window (July 2025). Instruction that includes runnable engineering — Wind/data and strategy logic problems — not only podium talk. Same spirit as the systems letter: ship, don’t cosplay.",
        facts: ["Timestamp window: Jul 2025", "Quant + data practice", "Code as instruction"],
      },
      zh: {
        k: "03 · 现场代码",
        t: "营期中的量化排障",
        p: "第一人称工位：营期中（2025年7月）IDE 打开在量化/数据问题上。指导包含可运行工程——数据与策略逻辑——不只是讲台话术。与系统推荐信同一精神：交付，不扮演。",
        facts: ["时间窗：2025年7月", "量化 + 数据实践", "代码即指导"],
      },
    },
  ]);
}

