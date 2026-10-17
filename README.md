# Global Weakness, Local Strength — public surface

[![Live site](https://img.shields.io/badge/live-portfolio-0d5c4b?style=for-the-badge&logo=githubpages)](https://nemo02070118.github.io/boatfx-repro/)
[![Walkthrough](https://img.shields.io/badge/video-walkthrough-c4302b?style=for-the-badge&logo=youtube)](https://youtu.be/tVHLUQy93rg)
[![CI repro](https://img.shields.io/github/actions/workflow/status/nemo02070118/boatfx-repro/ci.yml?branch=main&label=repro-smoke&style=for-the-badge)](https://github.com/nemo02070118/boatfx-repro/actions/workflows/ci.yml)
[![CI pages](https://img.shields.io/github/actions/workflow/status/nemo02070118/boatfx-repro/pages.yml?branch=main&label=pages&style=for-the-badge)](https://github.com/nemo02070118/boatfx-repro/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2c5f7c?style=for-the-badge)](LICENSE)

**Author:** Huannian Jin · **Email:** [huanian.jin@outlook.com](mailto:huanian.jin@outlook.com)  
**Paper:** *Discarded but Alive: What Factor Screening Throws Away, and What It Cannot Recover* — working paper, Oct 2026 (companion to the JF submission; acceptance not claimed). SSRN [abstract 7607684](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7607684) · ORCID [0009-0006-9124-9152](https://orcid.org/0009-0006-9124-9152).  
**Predecessor:** *Global Weakness, Local Strength* — **Journal of Finance** (MS 2026-0738 · **passed desk · external review** · editor: Antoinette Schoar) · **Eastern Finance Association (submitted)**

> Machines propose factors faster than humans can vet them.  
> Unconditional screens have a **structural blind spot** for state-dependent premia. The fix is a discovery and its converse: one coarse reallocation moves Sharpe **0.85 → 1.30** (3/4 of the way to the **1.45** ceiling), and the converse — a **BBP phase transition** at **m\* ≈ 1.3 factors** — proves no router recovers the rest (five frozen routers ≤ 0.05; fine routing −0.18; 6 of 94 factors clear the wall).  
> This repo is the **public receipt**: live web craft + one-command repro + AI-factory excerpts.

---

## Start here (30 seconds)

| Want | Go |
|---|---|
| **Open the portfolio** | https://nemo02070118.github.io/boatfx-repro/ |
| **Watch walkthrough** | https://youtu.be/tVHLUQy93rg |
| **Run research smoke** | `pip install -r requirements.txt && python repro.py && python reproduce_headline.py` |
| **See AI factory code** | [`system_showcase/`](system_showcase/) |
| **See vibe-coding discipline** | [`VIBE_CODING.md`](VIBE_CODING.md) · [`DISCIPLINE.md`](DISCIPLINE.md) |
| **See agent instructions** | [`AGENTS.md`](AGENTS.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) |

---

## Repo map (partition on purpose)

```
boatfx-repro/                 ← YOU ARE HERE (public)
├── site/                     ← Web portfolio (GitHub Pages)
├── system_showcase/          ← Real Rust excerpts from boat_factor::llm_agent
├── headline_tilt/            ← Shipped tilt outputs for headline economics
├── repro.py / reproduce_*.py ← One-command verification
├── VIBE_CODING.md            ← Cursor / Claude Code / Codex / OpenAI / cloud agents
├── AGENTS.md                 ← How coding agents must behave in this repo
├── CONTRIBUTING.md           ← Human + agent contribution gates
└── .github/workflows/        ← CI: repro-smoke + pages deploy

boat-fx/                      ← PRIVATE monorepo (not dumped)
```

Why not one giant public dump? Reviewers drown.  
Public surfaces are **role-separated**: web face · research lung · private body.

---

## Engineering mass (honest scale)

The private **boatfx** monorepo is large on purpose. This public repo is the **thin receipt**, not the body.

| Surface | Scale (measured locally, build artifacts excluded) |
|---|---|
| **Private `boatfx/`** | **12 crates** · **~2,300 Rust source files** · **~670k LoC Rust** · `llm_agent` alone **77** `.rs` modules |
| **Public `boatfx-repro`** | Curated: live `site/` · one-command repro · CI · `system_showcase/` excerpts |
| **Zheshang internship** | **56 modules · ~64k LoC · >95% coverage** (enterprise letter on file) |

How to read this: dumping 10k+ files on GitHub is noise.  
Shipping a **partitioned surface** with CI greens is discipline.

Measurement notes: [`SCALE.md`](SCALE.md)

---

## Results you can regenerate

| Panel | Active bps/yr | IR | Command |
|---|---:|---:|---|
| **Value-weight ★** | **172** | **≈2.01** | `python reproduce_headline.py` |
| NYSE | 134 | ≈1.73 | same |
| Equal-weight | 128 | ≈1.77 | same |
| Large-cap | 111 | ≈1.69 | same |
| VW OOS | 134 | ≈2.05 | `python reproduce_headline.py --oos` |
| Language | 60/60 | — | `python repro.py` |

Exact yes/no matrix: [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md)

**Reallocation study** (new paper): grave Sharpe **0.85** → coarse **1.30** (gain **+0.45** over current practice, 3/4 of the grave→oracle gap; oracle **1.45**), FF6 alpha **+3.8%/yr** (t=8.3), GRS F(8,594)=5.7. Converse: five frozen out-of-sample routers recover **≤ 0.05** of the 0.14 residual, fine routing **−0.18**, only **6 of 94** factors clear τ_i > 1 — resolution limit **m\* ≈ 1.3**. These are **shipped as paper exhibits, not in this public repro** — a boundary, not an omission. The deployable overlay above is the part you can regenerate today.

---

## Vibe coding (what “using AI” means here)

I use **Cursor · Claude Code · Codex · OpenAI · cloud coding agents** the way a modern shop does:

```
intent → agent draft → human gate → CI → ship public surface
```

- Agents implement and refactor.  
- Humans own numbers, narrative, and boundaries.  
- CI is the receipt (`repro-smoke` + `pages`).  
- Factor factory uses the **same philosophy**: LLM proposes → constitution/gates → admit.

Full write-up: [`VIBE_CODING.md`](VIBE_CODING.md)

---

## System showcase (from production boatfx)

Public Rust excerpts (reference, not a standalone crate):

| File | Signal |
|---|---|
| `llm_provider.rs` | DeepSeek breadth + Claude/GPT depth · keys **only from env** |
| `dsl.rs` | Typed AST — no arbitrary code from the model |
| `gates.rs` | G1–G4 front gates before expensive eval |
| `constitution.rs` | Machine-checkable factor constitution |
| `wasm_sandbox.rs` | Fuel / wall-clock / memory hard limits |

Details: [`system_showcase/README.md`](system_showcase/README.md)

---

## Professional workflow (small craft that compounds)

| Practice | Where |
|---|---|
| CI on every push | `.github/workflows/ci.yml` |
| Pages deploy from `site/` | `.github/workflows/pages.yml` |
| Agent policy file | `AGENTS.md` |
| Engineering discipline standard | `DISCIPLINE.md` |
| Human contribution gates | `CONTRIBUTING.md` |
| Citation metadata | `CITATION.cff` |
| Security / secrets policy | `SECURITY.md` |
| Verify script | `scripts/verify.ps1` / `scripts/verify.sh` |

---

## Venue status (honest)

| Paper | Venue | Status |
|---|---|---|
| Global Weakness, Local Strength | Journal of Finance | **Passed desk review · external / referee review** · MS **2026-0738** · received **Sep 21, 2026** · editor in charge: **Antoinette Schoar** |
| Global Weakness, Local Strength | Eastern Finance Association | Submitted |
| Discarded but Alive | SSRN · WFA 2027 · EFA (US) | **Working paper** (Oct 2026) · WFA + Eastern FA submitted · SFS & European EFA preparing · public repro |
| This GitHub surface | — | Public · MIT for code |

Acceptance is **not** claimed. Status labels update as decisions arrive.

---

## Citation

```bibtex
@unpublished{jin2026global,
  title  = {Global Weakness, Local Strength: The Blind Spot of Unconditional Factor Screening},
  author = {Jin, Huannian},
  note   = {Journal of Finance MS 2026-0738: passed desk review, in external review (editor in charge: Antoinette Schoar); submitted to Eastern Finance Association},
  year   = {2026}
}

@unpublished{jin2026discarded,
  title  = {Discarded but Alive: What Factor Screening Throws Away, and What It Cannot Recover},
  author = {Jin, Huannian},
  note   = {Working paper, Oct 2026; companion to the Journal of Finance submission (MS 2026-0738). Repro: github.com/nemo02070118/localstrength-repro. Acceptance not claimed.},
  year   = {2026}
}
```

---

## Contact

- **Email:** [huanian.jin@outlook.com](mailto:huanian.jin@outlook.com)  
- **Live:** https://nemo02070118.github.io/boatfx-repro/  
- **GitHub:** [@nemo02070118](https://github.com/nemo02070118)
