/* EN / 中文 — keep strings ASCII+CJK only; never edit this file via PowerShell Set-Content */
window.I18N = {
  en: {
    "nav.field": "Field",
    "nav.stack": "Stack",
    "field.kicker": "09 · Field presence",
    "field.title": "Wiki Finance Expo Hong Kong 2026 · VIP",
    "field.lede":
      "Invited as a VIP guest to Wiki Finance Expo Hong Kong 2026 (Hopewell Hotel, Wan Chai · 23–24 July). Not a spectator hobby — industry rooms where tokenization, trading safety, and fintech infrastructure are debated in public. I show up because the research has to survive contact with the real market conversation.",
    "field.m1s": "Status",
    "field.m1b": "VIP invite",
    "field.m2s": "Event",
    "field.m3s": "Theme",
    "field.m3b": "Sparking opportunity · trading safety",
    "field.m4s": "Why it matters",
    "field.m4b": "Agency outside the notebook",
    "field.cap1": "VIP badge · TRADEHALL sponsor strip · 23–24 July 2026",
    "field.n1t": "What I did there",
    "field.n1p":
      "Entered as VIP, walked the floor, sat the rooms, and treated the expo as a stress test for whether my screening-science agenda still sounds real next to live fintech product talk.",
    "field.n2t": "How it connects",
    "field.n2p":
      "RWA / tokenization panels and “trading safety” branding sit next to my work: AI proposes factors fast; unconditional screens still miss state-dependent structure. Field presence keeps the research honest.",
    "field.n3t": "Academy signal",
    "field.n3p":
      "Already in motion — not only code and a paper track, but showing up where the industry gathers when invited.",
    "stack.kicker": "10 · Private boatfx stack",
    "stack.title": "The body behind the thin public receipt",
    "stack.lede":
      "Public GitHub is curated on purpose. The private monorepo is a multi-crate trading / research system. Click a crate — see what it owns. Numbers measured locally (build artifacts excluded).",
    "stack.s1": "Crates",
    "stack.s2": "App",
    "stack.s3": "UI packages",
    "stack.s4": "Public surface",
    "lang.btn": "中文",
  },
  zh: {
    "nav.field": "现场",
    "nav.stack": "工程栈",
    "field.kicker": "09 · 现场在场",
    "field.title": "Wiki Finance Expo 香港 2026 · VIP",
    "field.lede":
      "受邀以 VIP 身份参加 Wiki Finance Expo Hong Kong 2026（湾仔合和酒店 · 7月23–24日）。不是围观爱好——这是 tokenization、交易安全与金融基础设施被公开讨论的行业现场。我去，是因为研究必须经得起真实市场对话的摩擦。",
    "field.m1s": "身份",
    "field.m1b": "VIP 邀请",
    "field.m2s": "活动",
    "field.m3s": "主题",
    "field.m3b": "机遇火花 · 交易安全",
    "field.m4s": "意义",
    "field.m4b": "笔记本外的行动力",
    "field.cap1": "VIP 胸卡 · TRADEHALL · 2026年7月23–24日",
    "field.n1t": "我在现场做什么",
    "field.n1p":
      "以 VIP 入场，走展厅、进会场，把这次博览会当作压力测试：我的筛选科学议程，在真实 fintech 产品话语旁边是否仍然站得住。",
    "field.n2t": "与研究如何衔接",
    "field.n2p":
      "RWA / 资产代币化分论坛与「交易安全」叙事，正对着我的工作：AI 让因子提案变便宜；无条件筛选仍会错过状态依赖结构。到现场，是为了让研究保持诚实。",
    "field.n3t": "对 Academy 的信号",
    "field.n3p":
      "Already in motion——不只是代码与论文轨道，还包括受邀后出现在行业聚集的地方。",
    "stack.kicker": "10 · 私有 boatfx 工程栈",
    "stack.title": "薄公网收据背后的主体",
    "stack.lede":
      "公开 GitHub 是刻意裁剪的。私有 monorepo 是多 crate 交易/研究系统。点一个 crate，看它负责什么。规模数字本地计量（已排除构建产物）。",
    "stack.s1": "Crates",
    "stack.s2": "应用",
    "stack.s3": "UI 包",
    "stack.s4": "公网表面",
    "lang.btn": "EN",
  },
};

window.applyI18n = function applyI18n(lang) {
  const dict = window.I18N[lang] || window.I18N.en;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) el.textContent = dict[key];
  });
  const btn = document.getElementById("lang-toggle");
  if (btn) btn.textContent = dict["lang.btn"] || (lang === "zh" ? "EN" : "中文");
  localStorage.setItem("hj-lang", lang);
  document.dispatchEvent(new CustomEvent("hj:lang", { detail: { lang } }));
};

window.initLangToggle = function initLangToggle() {
  const btn = document.getElementById("lang-toggle");
  if (!btn) return;
  let lang = localStorage.getItem("hj-lang") || "en";
  window.applyI18n(lang);
  btn.addEventListener("click", () => {
    lang = lang === "en" ? "zh" : "en";
    window.applyI18n(lang);
  });
};
