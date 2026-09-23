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
  video: "#",
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
  document.querySelectorAll("a, button, .factor-btn, input").forEach((el) => {
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

/* ---------- pi lab ---------- */
function initPiLab() {
  const range = document.getElementById("pi-range");
  const piVal = document.getElementById("pi-val");
  const tgVal = document.getElementById("tg-val");
  const verdict = document.getElementById("verdict");
  const canvas = document.getElementById("pi-canvas");
  if (!range || !canvas) return;
  const ctx = canvas.getContext("2d");
  const T_STATE = 3;
  const THRESH = 2;

  function draw(pi) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 1100;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a1018";
    ctx.fillRect(0, 0, w, h);

    const pad = 48;
    const plotW = w - pad * 2;
    const plotH = h - 56;

    // axes
    ctx.strokeStyle = "rgba(215,224,234,0.2)";
    ctx.beginPath();
    ctx.moveTo(pad, 20);
    ctx.lineTo(pad, 20 + plotH);
    ctx.lineTo(pad + plotW, 20 + plotH);
    ctx.stroke();

    // threshold
    const yThresh = 20 + plotH - (THRESH / 4) * plotH;
    ctx.strokeStyle = "rgba(196,92,38,0.7)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, yThresh);
    ctx.lineTo(pad + plotW, yThresh);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c45c26";
    ctx.font = "11px IBM Plex Mono";
    ctx.fillText("|t|=2 threshold", pad + 8, yThresh - 6);

    // curve tg = 3 * sqrt(pi)
    ctx.strokeStyle = "#6dcea8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const p = 0.05 + (0.85 * i) / 100;
      const tg = T_STATE * Math.sqrt(p);
      const x = pad + ((p - 0.05) / 0.85) * plotW;
      const y = 20 + plotH - (tg / 4) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // current point
    const tg = T_STATE * Math.sqrt(pi);
    const x = pad + ((pi - 0.05) / 0.85) * plotW;
    const y = 20 + plotH - (tg / 4) * plotH;
    ctx.fillStyle = tg >= THRESH ? "#6dcea8" : "#c45c26";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d7e0ea";
    ctx.font = "12px IBM Plex Mono";
    ctx.fillText(`π=${pi.toFixed(2)}  tg=${tg.toFixed(2)}`, x + 12, y - 8);

    ctx.fillStyle = "#8a93a3";
    ctx.fillText("π →", pad + plotW - 28, 20 + plotH + 22);
    ctx.fillText("t", 18, 28);
  }

  function update() {
    const pi = parseFloat(range.value);
    const tg = T_STATE * Math.sqrt(pi);
    piVal.textContent = pi.toFixed(2);
    tgVal.textContent = tg.toFixed(2);
    const pass = tg >= THRESH;
    verdict.textContent = pass ? "survives" : "discarded";
    verdict.style.color = pass ? "#0d5c4b" : "#c45c26";
    draw(pi);
  }
  range.addEventListener("input", update);
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
    { id: "venues", label: "01b Venues — JF · EFA" },
    { id: "math", label: "02 Math — blind-spot identity" },
    { id: "results", label: "03 Results — panel table" },
    { id: "machine", label: "04 Machine population funnel" },
    { id: "factory", label: "05 AI factor factory" },
    { id: "letter", label: "06 Zheshang recommendation" },
    { id: "edge", label: "06b Edge vs peers" },
    { id: "craft", label: "06c Web coding craft" },
    { id: "proof", label: "07 Proof / repro commands" },
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
