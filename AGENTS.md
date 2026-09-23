# AGENTS.md — Cursor / Claude Code / Codex / OpenAI / cloud agents

Machine-readable working agreement for any coding agent touching this repository.

## Mission

Keep this **public evidence surface** honest, fast, and reviewable.  
Live site: https://nemo02070118.github.io/boatfx-repro/  
Human owner: Huannian Jin · 15761209998@163.com

## Context files (read first)

1. `README.md` — hub  
2. `VIBE_CODING.md` — loop + gates  
3. `SCALE.md` — mass numbers (do not invent new ones)  
4. `SECURITY.md` — secrets / PDF boundary  
5. `system_showcase/README.md` — what the Rust excerpts are

## Allowed

- Surgical improvements to `site/` (HTML/CSS/JS)  
- Docs clarity (`README`, `VIBE_CODING`, `CONTRIBUTING`, showcase READMEs)  
- CI / verify script hardening that **preserves** existing pass criteria  
- Accessibility, performance, mobile polish without changing scientific claims

## Forbidden

- Invent, round-up, or hand-edit scientific numbers  
- Change venue status (JF / EFA) without explicit human instruction  
- Commit secrets, `.env`, JF PDF, recommendation originals, or private monorepo dumps  
- Expand `system_showcase/` into a fake standalone crate that “compiles the factory”  
- Author Academy essay / walkthrough **in the applicant’s voice**  
- Disable or weaken CI to force green

## Stack contract

| Layer | Contract |
|---|---|
| Portfolio | Static `site/` — no React unless human asks |
| Research smoke | Python 3.12 + `requirements.txt` |
| Rust excerpts | Reference only under `system_showcase/` |
| Deploy | GitHub Actions → Pages from `site/` |

## Change hygiene

- Prefer small diffs; one intent per PR/commit when possible  
- Match existing naming, CSS variables, and tone  
- If a number appears in UI, it must already exist in README / paper macros / letter  
- When unsure about a claim → **ask human**, do not guess

## Verify before finishing

```bash
pip install -r requirements.txt
python repro.py
python reproduce_headline.py
```

Optional: `.\scripts\verify.ps1` (Windows) / `./scripts/verify.sh` (Unix)  
Preview: `python -m http.server 5173 --directory site`

## Stop conditions

Stop and report if:

- Repro scripts fail after your change  
- You would need private data to “complete” a feature  
- The request conflicts with Forbidden above
