# Global Weakness, Local Strength — public surface

[![Live site](https://img.shields.io/badge/live-portfolio-0d5c4b?style=for-the-badge&logo=githubpages)](https://nemo02070118.github.io/boatfx-repro/)
[![CI repro](https://img.shields.io/github/actions/workflow/status/nemo02070118/boatfx-repro/ci.yml?branch=main&label=repro-smoke&style=for-the-badge)](https://github.com/nemo02070118/boatfx-repro/actions/workflows/ci.yml)
[![CI pages](https://img.shields.io/github/actions/workflow/status/nemo02070118/boatfx-repro/pages.yml?branch=main&label=pages&style=for-the-badge)](https://github.com/nemo02070118/boatfx-repro/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2c5f7c?style=for-the-badge)](LICENSE)

**Author:** Huannian Jin · **Email:** [15761209998@163.com](mailto:15761209998@163.com)  
**Paper:** *Global Weakness, Local Strength* — **Journal of Finance (under review)** · **Eastern Finance Association (submitted)**

> Machines propose factors faster than humans can vet them.  
> Unconditional screens have a **structural blind spot** for state-dependent premia.  
> This repo is the **public receipt**: live web craft + one-command repro + AI-factory excerpts.

---

## Start here (30 seconds)

| Want | Go |
|---|---|
| **Open the portfolio** | https://nemo02070118.github.io/boatfx-repro/ |
| **Run research smoke** | `pip install -r requirements.txt && python repro.py && python reproduce_headline.py` |
| **See AI factory code** | [`system_showcase/`](system_showcase/) |
| **See vibe-coding discipline** | [`VIBE_CODING.md`](VIBE_CODING.md) |
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
| Human contribution gates | `CONTRIBUTING.md` |
| Citation metadata | `CITATION.cff` |
| Security / secrets policy | `SECURITY.md` |
| Verify script | `scripts/verify.ps1` / `scripts/verify.sh` |

---

## Venue status (honest)

| Venue | Status |
|---|---|
| Journal of Finance | Under review (submitted Sep 2026) |
| Eastern Finance Association | Submitted |
| This GitHub surface | Public · MIT for code |

Acceptance is **not** claimed.

---

## Citation

```bibtex
@unpublished{jin2026global,
  title  = {Global Weakness, Local Strength: The Blind Spot of Unconditional Factor Screening},
  author = {Jin, Huannian},
  note   = {Submitted to the Journal of Finance; submitted to Eastern Finance Association},
  year   = {2026}
}
```

---

## Contact

- **Email:** [15761209998@163.com](mailto:15761209998@163.com)  
- **Live:** https://nemo02070118.github.io/boatfx-repro/  
- **GitHub:** [@nemo02070118](https://github.com/nemo02070118)
