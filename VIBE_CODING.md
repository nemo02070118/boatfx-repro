# Vibe coding · engineering discipline (public standard)

> Academy preference is not “never use AI.”  
> It is: **use Cursor / Claude Code / Codex / OpenAI / cloud coding agents like a shop — with gates, receipts, and ownership.**

**Author:** Huannian Jin · **Email:** [15761209998@163.com](mailto:15761209998@163.com)  
**Live:** https://nemo02070118.github.io/boatfx-repro/

---

## 1. Definition (what “vibe coding” means here)

| Casual use | This repo |
|---|---|
| Chat → paste → hope | Intent → agent draft → **human gate** → tests → CI → ship |
| “AI wrote my app” | “AI accelerated diffs I can defend” |
| Screenshots of chats | Encoded policy: `AGENTS.md` · CI · partition |
| Speed without memory | Speed **with** receipts |

I do **not** paste chat logs into applications.  
I ship **repos that encode the discipline**.

---

## 2. The loop (non-negotiable)

```
intent (human)                  ← what / why / boundary
  → agent draft                 ← Cursor / Claude Code / Codex / OpenAI / cloud agents
  → diff review (human)         ← taste, numbers, secrets, claim integrity
  → local verify                ← scripts/verify.* or python repro*
  → commit (small, named)       ← one intent per commit when possible
  → CI                          ← repro-smoke + pages
  → public surface              ← site/ + README receipts
```

Same philosophy as the factor factory:

```
LLM propose → type-check → sandbox → constitution/gates → admit → study discards
```

---

## 3. Tool matrix

| Class | Examples | Allowed | Forbidden |
|---|---|---|---|
| IDE agents | Cursor, Claude Code | UI, refactors, docs, tests | Invent paper numbers; rewrite claim |
| Cloud / CLI | Codex-class, cloud coding agents | Parallel implement behind PR | Own scientific narrative |
| Model APIs | OpenAI / DeepSeek / Anthropic | Factor proposals **inside** gated factory | Hot-path inference; hard-coded keys |
| Humans | Me | Numbers, essay, video, venue status, final merge | Pretending I typed every line |

---

## 4. Ownership map (who is accountable)

| Artifact | Owner |
|---|---|
| Paper claim & venue wording | Human |
| Headline numerals (bps / IR / matrices) | Human · must trace to macros / repro |
| Academy essay / walkthrough voice | Human |
| Portfolio layout / CSS / interaction | Human taste · agent draft OK |
| CI green / Pages deploy | Shared · fail = no ship |
| Secrets / JF PDF / private monorepo | Human · never in public git |

---

## 5. Public partition (discipline as architecture)

```
boatfx-repro/          PUBLIC receipt (thin)
├── site/              Web craft · GitHub Pages
├── system_showcase/   Real Rust excerpts (reference)
├── headline_tilt/     Shipped outputs for economics
├── repro*.py          One-command verification
├── AGENTS.md          Machine-readable policy
├── VIBE_CODING.md     This file
├── SCALE.md           How mass numbers were counted
└── .github/workflows/ CI receipts

boatfx/                PRIVATE body (large) — not dumped
```

Dumping 10k+ files is not professionalism.  
**Role-separated surfaces** are.

---

## 6. Hard gates (fail closed)

1. **No invented metrics** — numbers trace to paper macros or Zheshang letter  
2. **No JF PDF in public git** while under review  
3. **No API keys / `.env`** — env only (`llm_provider` pattern)  
4. **Essay / video human-authored** — agents may outline facts, not voice  
5. **CI must stay green** — `repro-smoke` + `pages`  
6. **Agents must read** `AGENTS.md` before editing  

---

## 7. Definition of done (before any public push)

```bash
# Windows
.\scripts\verify.ps1

# Unix
./scripts/verify.sh
```

Or manually:

```bash
pip install -r requirements.txt
python repro.py
python reproduce_headline.py
```

Site preview: `python -m http.server 5173 --directory site`

---

## 8. What reviewers should feel in 60 seconds

1. Live site opens  
2. Claim is clear and honest (JF **under review**, not accepted)  
3. AI is a **factory with gates**, not a vibe  
4. Public repo is thin on purpose; private mass is documented in `SCALE.md`  
5. CI greens are visible  

That is the standard this surface is built to meet.
