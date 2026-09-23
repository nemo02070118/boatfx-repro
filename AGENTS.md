# AGENTS.md — Cursor / Claude Code / Codex / cloud agents

## Repo role

Public evidence surface for Huannian Jin.  
Live site: https://nemo02070118.github.io/boatfx-repro/

## Allowed

- Improve `site/` UI/UX with surgical diffs  
- Improve docs (`README`, `VIBE_CODING`, `system_showcase` READMEs)  
- Keep CI green (`python repro.py`, `python reproduce_headline.py`)

## Forbidden

- Invent or hand-edit scientific numbers  
- Commit API keys, `.env`, JF PDF, or private monorepo dumps  
- Rewrite the scientific claim without human approval  
- Author Academy essay / video script in the user’s voice

## Stack notes

- Portfolio is static HTML/CSS/JS in `site/` (no React on purpose)  
- Research smoke is Python 3.12 + pinned requirements  
- Rust excerpts under `system_showcase/` are **reference only**

## Verify before finishing

```bash
pip install -r requirements.txt
python repro.py
python reproduce_headline.py
```

Preview site: `python -m http.server 5173 --directory site`
