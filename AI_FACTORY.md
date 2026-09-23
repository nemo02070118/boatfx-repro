# AI Factor Factory — public narrative (for reviewers)

This repository is the **public edge** of a larger research system (BOAT-FX).
The scientific paper studies a population of machine-generated factors. Here is
what that means in engineering terms—without exposing proprietary search policy.

## What “AI talent” means here

Not: pasting prompts into a chatbot.

Yes: building a **proposal → gate → population study** loop where:

1. **Proposers** emit typed ASTs over a fixed microstructure signal grammar.
2. **Gates** reject ill-typed, constant, or rationale-free expressions.
3. **Evaluation** does not pre-screen on expected Sharpe; admitted factors enter
   the study population so rescue rates are population statistics.
4. The research question becomes: *what does the unconditional screen throw away
   when machines propose faster than humans can vet?*

## What you can inspect in this pack

| Artifact | Shows |
|---|---|
| `sample_factors.json` | Real emitted factors with literature-linked rationales |
| `engine_pseudocode.txt` | Generation + admission gate |
| `operator_inventory.json` | Canonical language boundary |
| `repro.py` | 60/60 executable self-test |

## What stays private (intentionally)

- API keys / provider credentials  
- Full ~7k factor pool  
- Ranking / evolutionary search policy  
- Regime router **estimation** source (tilt **outputs** are shipped for headline math)

## How this connects to the paper’s claim

AI makes the screening blind spot *operationally urgent*. The contribution is not
“AI found alpha.” The contribution is a **falsifiable fact about screening**, plus
a continuous tilt that keeps breadth instead of hard-gating legs away.
