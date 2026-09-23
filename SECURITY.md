# Security policy

## Principles

1. **Public receipt ≠ private body** — this repo must stay safe to clone  
2. **Secrets never in git** — env vars only  
3. **Venue materials stay gated** — JF PDF / letter originals are not public artifacts  

## Secrets

- Never commit API keys (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, OpenAI keys, tokens, `.env`).  
- Production-style providers read keys **only from environment variables**  
  (see `system_showcase/rust_excerpts/llm_provider.rs`).  
- Rotate immediately if a key appears in history; email **15761209998@163.com**.

## In scope for disclosure

- Accidental secret commit / Pages leak  
- XSS or supply-chain issues in `site/` that could harm visitors  
- CI misconfiguration that would publish private paths  

## Out of scope

- Demanding the private monorepo  
- Demanding JF manuscript PDF via public channels  
- Trading-strategy extraction from research excerpts  

## Scope of this repository

Ships: reproducibility surface + portfolio + reference Rust excerpts + CI.  
Does **not** ship: full private trading monorepo, regime-router estimation source, or review PDFs.

## Reporting

Email: [15761209998@163.com](mailto:15761209998@163.com)  
Please include: what you found, where, and whether it is already public.
