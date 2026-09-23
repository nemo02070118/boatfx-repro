# System showcase — BOAT-FX AI agent factory (public excerpts)

Extracted from the production `boat_factor::llm_agent` stack for reviewers who want to
**see real engineering**, not a slide.

These files are **reference excerpts**. They are not a standalone crate (they depend on
the private monorepo). They exist so Academy / peers can inspect:

1. How LLMs are routed (breadth cheap · depth expensive)  
2. How proposals are gated (constitution · consistency · novelty)  
3. How unsafe code is sandboxed (WASM deny-by-default)  
4. How vibe-coding agents are *constrained* the same way factors are  

## Map

| File | What it proves |
|---|---|
| `rust_excerpts/mod.rs` | Factory module map · Agora multi-agent · evolution · WASM |
| `rust_excerpts/llm_provider.rs` | DeepSeek breadth + Claude/GPT depth · **keys only from env** |
| `rust_excerpts/dsl.rs` | Typed AST language — LLM cannot emit arbitrary code |
| `rust_excerpts/gates.rs` | G1–G4 front gates before expensive eval |
| `rust_excerpts/constitution.rs` | Machine-checkable “factor constitution” |
| `rust_excerpts/wasm_sandbox.rs` | Fuel / wall-clock / memory hard limits |

## Vibe coding ↔ factor factory (same discipline)

```
Cursor / Claude Code / Codex / cloud agents
        │
        ▼
   propose diffs / factors
        │
        ▼
   gates (AGENTS.md · tests · CI · constitution)
        │
        ▼
   ship public surface (this repo + site/)
```

Peers say “I used AI.”  
This folder shows **AI under gates** — the skill Silicon Valley actually wants.

## What stays private

- API keys · full ranking / search policy · full ~7k factor pool  
- Regime router estimation source (tilt *outputs* are in `headline_tilt/`)  
- Full `boat-fx` monorepo

## Run the public surface

```bash
pip install -r requirements.txt
python repro.py
python reproduce_headline.py
```

Portfolio (GitHub Pages): after enabling Pages →  
`https://nemo02070118.github.io/boatfx-repro/`
