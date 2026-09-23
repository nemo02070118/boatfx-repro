# Contributing

This repository is a **public evidence surface**, not an open dump of the private monorepo.

**Contact:** [15761209998@163.com](mailto:15761209998@163.com)

---

## Principles

1. **Thin public receipt** — prove claims; do not flood reviewers  
2. **Human owns judgment** — agents accelerate diffs  
3. **CI is the merge gate** — red means stop  
4. **Honesty over hype** — JF is *under review*; acceptance is not claimed  

---

## Humans

1. Open an issue describing intent and boundary  
2. Keep PRs small and focused (one intent)  
3. Never add proprietary data, API keys, or the JF manuscript PDF  
4. Run verification before push:

```bash
pip install -r requirements.txt
python repro.py
python reproduce_headline.py
```

5. Prefer conventional, readable commit messages (why > noise)

---

## Coding agents

Follow [`AGENTS.md`](AGENTS.md) and [`VIBE_CODING.md`](VIBE_CODING.md).

Required pattern:

```
intent → agent draft → human gate → local verify → CI → public surface
```

Agents must not:

- Invent metrics  
- Rewrite scientific narrative  
- Commit secrets or private trees  
- Soften CI  

---

## Review checklist (maintainers)

- [ ] Numbers unchanged unless human-approved and traced  
- [ ] No secrets / PDF / `.env`  
- [ ] `site/` still loads on mobile  
- [ ] Actions: `repro-smoke` + `pages` green  
- [ ] README links still resolve  

---

## Security

See [`SECURITY.md`](SECURITY.md). Report secrets exposure immediately to the email above.
