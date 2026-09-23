# Scale notes (how the numbers were counted)

Measured on the private monorepo checkout used to build this public surface.

## Private `boatfx/` (source only)

- Path counted: `boatfx/boatfx/` (workspace root of the monorepo)
- Excluded: `target/`, `target-*`, `node_modules/`, `.git/`, venv / `__pycache__`
- **Crates:** 12 under `crates/`
  - `boat_backtest`, `boat_bench_harness`, `boat_common`, `boat_execution`,
    `boat_factor`, `boat_gateway`, `boat_monitor`, `boat_risk`, `boat_shm`,
    `boat_signal`, `boat_team`, `boat_web`
- **Rust source files (`.rs`):** ≈ 2,300
- **Rust lines:** ≈ 670,000 (line count of `.rs` files; includes comments/blanks)
- **`boat_factor::llm_agent`:** 77 `.rs` files (public excerpts live in `system_showcase/`)

These are **engineering-mass indicators**, not paper claims.  
Paper numerals remain bound to `repro.py` / `reproduce_headline.py` outputs.

## Public `boatfx-repro/`

Intentionally small: portfolio site + reproducibility scripts + curated Rust excerpts + CI.

## Zheshang internship

**56 modules · ~64k LoC · >95% coverage** — from the Managing Director recommendation letter  
(Liao Jingchi). Separate from the private monorepo totals above.

## What we do *not* claim

- That every private file is public
- That LoC equals research quality
- That JF / EFA acceptance has occurred
