# Security policy

## Secrets

- Never commit API keys (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, OpenAI keys, etc.).  
- Production providers read keys **only from environment variables** (see `system_showcase/rust_excerpts/llm_provider.rs`).  
- If you find a leaked secret in this repo, email **15761209998@163.com** immediately.

## Scope

This repository ships a reproducibility surface + portfolio site + reference excerpts.  
It does **not** ship the full private trading monorepo or regime-router estimation source.

## Reporting

Email: 15761209998@163.com
