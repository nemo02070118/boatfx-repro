# Engineering discipline standard

How this public surface is meant to be judged — by Academy reviewers, engineers, or future collaborators.

---

## 1. What “professional” means here

| Signal | Where to look |
|---|---|
| Clear ownership | README author line · email · profile |
| Separated concerns | `site/` · research scripts · `system_showcase/` · private body |
| Machine + human policy | `AGENTS.md` · `VIBE_CODING.md` · `CONTRIBUTING.md` |
| Automated receipts | GitHub Actions · `scripts/verify.*` |
| Honest venue status | JF under review · EFA submitted · never “accepted” unless true |
| Measured scale | `SCALE.md` (method + exclusions) |
| Security boundary | `SECURITY.md` · no keys · no JF PDF in public git |

---

## 2. Quality bar (definition of shippable)

A change is shippable only if:

1. Intent is stated (commit / PR)  
2. Diff is reviewable in one sitting  
3. Local verify passes  
4. CI passes on `main`  
5. Public claims remain consistent across README + site + profile  

---

## 3. Anti-patterns we refuse

- Chat-log portfolios  
- Inflated LoC dumps without measurement notes  
- “AI built everything” with no gates  
- Hidden failures (skipped tests, forced green)  
- Mixing private monorepo noise into the public receipt  

---

## 4. Peer contrast (calm, factual)

Many same-age portfolios show enthusiasm.  
This surface is optimized for **inspectable judgment**:

- Research claim with a falsification story  
- Production internship numbers from a signed letter  
- Public repro anyone can run  
- Explicit AI policy, not cosplay  

---

## 5. Related files

- [`VIBE_CODING.md`](VIBE_CODING.md)  
- [`AGENTS.md`](AGENTS.md)  
- [`CONTRIBUTING.md`](CONTRIBUTING.md)  
- [`SECURITY.md`](SECURITY.md)  
- [`SCALE.md`](SCALE.md)  
- [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md)
