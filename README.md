# Global Weakness, Local Strength — Reproducibility Pack

[![Python 3.12](https://img.shields.io/badge/python-3.12-0d5c4b?style=flat-square)](requirements.txt)
[![License: MIT](https://img.shields.io/badge/license-MIT-2c5f7c?style=flat-square)](LICENSE)
[![JF](https://img.shields.io/badge/Journal%20of%20Finance-under%20review-0d5c4b?style=flat-square)](#venue-status)
[![EFA](https://img.shields.io/badge/Eastern%20Finance%20Association-submitted-2c5f7c?style=flat-square)](#venue-status)
[![Repro](https://img.shields.io/badge/repro-60%2F60%20%2B%20headline-c45c26?style=flat-square)](#quick-start)

> **Paper:** *Global Weakness, Local Strength: The Blind Spot of Unconditional Factor Screening*  
> **Author:** Huannian Jin (independent researcher)  
> **License:** MIT  
> **GitHub:** [nemo02070118/boatfx-repro](https://github.com/nemo02070118/boatfx-repro)

Public reproducibility surface for the paper — and the cleanest way to inspect the
**machine-factor language** an LLM/agent factory emits — without shipping proprietary
search policy or the full factor pool.

---

## Live portfolio (public web)

After GitHub Pages is enabled on this repo:

**https://nemo02070118.github.io/boatfx-repro/**

Source: [`site/`](site/) · AI factory excerpts: [`system_showcase/`](system_showcase/) · Vibe coding: [`VIBE_CODING.md`](VIBE_CODING.md)

**Contact:** [15761209998@163.com](mailto:15761209998@163.com)

---

## Venue status

| Venue | Status | Note |
|---|---|---|
| **Journal of Finance** | Under review (submitted Sep 2026) | Do not treat as published |
| **Eastern Finance Association (EFA)** | Submitted | U.S. academic conference track |
| This GitHub pack | Public | Code + tilt *outputs*; not the manuscript PDF |

---

## Why this exists (30 seconds)

Machines propose return predictors faster than researchers can vet them.
The standard **unconditional** screen looks weak-on-average and throws many away.

When a premium lives in a **market state**, the unconditional *t* shrinks with that
state’s rarity (\(t_g \approx t_{\mathrm{state}}\sqrt{\pi}\)). Genuine **regime-local**
predictors are structurally discarded. The claim is established by **falsification**,
not a single backtest curve. A continuous regime **tilt** (not a hard gate) shows the
recovered structure is economically deployable.

---

## Results at a glance (regenerate locally)

| Panel | Active bps/yr | IR | Command |
|---|---:|---:|---|
| **Value-weight ★** | **172** | **≈2.01** | `python reproduce_headline.py` |
| NYSE breakpoint | 134 | ≈1.73 | same |
| Equal-weight | 128 | ≈1.77 | same |
| Large-cap (ME20) | 111 | ≈1.69 | same |
| VW out-of-sample | 134 | ≈2.05 | `python reproduce_headline.py --oos` |
| Language self-test | 60/60 | — | `python repro.py` |

Paper body reports VW IR **1.99** / deployable *t* **6.81**; the script prints same-base
active *t* and IR within a documented alignment-window gap (see `REPRODUCIBILITY.md`).

---

## Quick start

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python repro.py
python reproduce_headline.py
python reproduce_headline.py --oos
```

**Runtime:** typically &lt; 30s on a laptop after deps install.  
**Seed:** `repro.py` fixes seed `0` (deterministic).

---

## What you can / cannot verify

| Claim | Here? |
|---|---|
| Factor language typed & executable | **Yes** — `repro.py` |
| Agents emit rationales + ASTs | **Yes** — `sample_factors.json` |
| Generation grammar / admission gate | **Yes** — `engine_pseudocode.txt` |
| Headline bps / IR from tilt **output** | **Yes** — `reproduce_headline.py` |
| Full ~7k factor pool | **No** (deliberate) |
| Regime router **estimation** source | **No** (tilt *output* shipped) |

Full matrix: [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md) · AI framing: [`AI_FACTORY.md`](AI_FACTORY.md)

---

## Layout

```
repro.py                 language self-test (60/60)
evaluate_factors.py      reference AST evaluator
reproduce_headline.py    headline economics from shipped tilt output
sample_factors.json      60 machine factors + rationales
operator_inventory.json  canonical operators / signals
engine_pseudocode.txt    generation + admission gate
AI_FACTORY.md            how the factory is framed publicly
CITATION.cff             machine-readable citation
headline_tilt/           tilt / min-var / returns (+ oos/)
REPRODUCIBILITY.md       exact yes/no matrix
DATA_SOURCES.md          external data provenance
.github/workflows/ci.yml smoke test on push
```

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

Also see [`CITATION.cff`](CITATION.cff).

---

## Sister repos

| Repo | Role |
|---|---|
| [`boatfx-repro`](https://github.com/nemo02070118/boatfx-repro) (this) | Research smoke tests |
| [`huannian-jin`](https://github.com/nemo02070118/huannian-jin) | Portfolio / web craft · [live](https://nemo02070118.github.io/huannian-jin/) |
| `boat-fx` | Full production system · **keep private** |

---

## Contact

Portfolio: [nemo02070118.github.io/huannian-jin](https://nemo02070118.github.io/huannian-jin/)
