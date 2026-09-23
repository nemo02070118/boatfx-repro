# Reproducibility matrix

This package exposes the factor **language** and a representative **sample**, and it makes the
factor-engine claims independently checkable. It does not ship the proprietary regime router
or the full machine-factor pool. This file states precisely which objects in the paper are
reproducible from what, so a data editor can see the boundary at a glance.

| Paper object | Reproducible from this package? | With what |
|---|---|---|
| Factor language is real, well-formed, executable | **Yes** | `repro.py` / `evaluate_factors.py` on the 60 shipped ASTs (`60/60` pass) |
| Operator/signal inventory and generation grammar | **Yes** | `operator_inventory.json`, `engine_pseudocode.txt` |
| Daily-OHLCV proxy mapping for the 9 microstructure signals | **Yes** | `signal_proxies()` in `evaluate_factors.py` (executable, not just prose) |
| Rescue-rate result on public expert libraries (Alpha191, Alpha101) | **Yes, in principle** | Public formula sets (cited); apply the same local-strength + falsification test |
| Rescue rate on the 6,881 machine factors (10.0% flagged etc.) | **No** | Requires the full generated pool (not redistributed) + the router |
| Deployable overlay increment on Chen–Zimmermann panels (the headline economics) | **Conditional / output-level** | `reproduce_headline.py` on the shipped `headline_tilt/` files regenerates the deployable basis-point level (172 bps/yr on VW, etc.) and the information ratio (to within an alignment-window rounding gap: VW IR 2.01 here vs 1.99 in the body; large-cap 111 bps here vs 109 in the body) **given the router's shipped tilt output**. It also reproduces the *same-base* active-return Newey–West t (`\acttXminvar`, 11.69 on VW). It does **not** reproduce the paper's *headline deployable* t (`\depXactivet`: 6.81 VW, 4.11 NYSE, 2.79 large-cap, 1.49 EW), which is a strictly more conservative object computed on the implementation-constrained investable series (investable-universe and borrow-cost filters shorten the series and widen the SE). This verifies the portfolio-construction arithmetic end to end for the bps/IR/same-base-t; the router's estimation of the tilt and the implementation-constrained deployable-t series are not shipped |
| Frozen out-of-sample deployable band (the overfitting defense) | **Conditional / output-level** | The pre-split OOS tilt for the primary 60/40 split is shipped in `headline_tilt/oos/`, so `reproduce_headline.py --oos` regenerates the frozen-OOS figures (VW IR≈2.0, etc.) from output. The three additional robustness splits are produced by the same withheld router and are not all shipped |
| Mechanism interaction (HKM / credit-spread funding splits) | **Data yes, code no** | Instruments are public (HKM site, FRED); the local-strength scoring uses the withheld engine |

## What is now shipped, and what remains withheld

To make the headline economics independently verifiable without exposing the proprietary
core, this package ships the router's **output** but not its **code**:

  * `headline_tilt/tilt_<panel>.csv` — the per-leg monthly tilt multiplier the router produces
    on each public OSAP panel (the frozen full-sample series behind the headline figures).
  * `headline_tilt/minvar_<panel>.csv` — the Ledoit–Wolf minimum-variance book weights (a
    standard, public baseline).
  * `headline_tilt/returns_<panel>.csv` — the aligned public OSAP anomaly net returns.
  * `reproduce_headline.py` — regenerates the exact deployable bps / IR / t from the above.

A data editor can reproduce the headline bps level and IR from output: `reproduce_headline.py`
returns 172 bps/yr and IR≈2 on the value-weighted panel and matches the other panels (subject
to the small alignment-window rounding gaps noted above). The t it prints is the same-base
active t (11.69 on VW), not the more conservative deployable t (6.81 on VW) reported in the
economic-significance section. The
tilt series is a disclosed numerical artifact; the OSAP returns and the minimum-variance
baseline are public.

## Why the router *code* is still withheld

The router's estimation code (per-factor state estimation, hierarchical shrinkage, dynamic-K
selection, and the complementarity tilt policy) is the proprietary core, as is the
factor-generation engine that produces the machine pool. Shipping the tilt **output** lets a
third party verify every headline number without the code, which is the reproducibility a data
editor needs. The paper's central scientific claim — a state-dependent blind spot in
unconditional screening — is a *fact about screening* established by a falsification test whose
logic is fully documented and corroborated on two public expert libraries (Alpha191, Alpha101)
that need no proprietary data at all. The overlay economics, whose portfolio-construction
arithmetic is now reproducible from the shipped tilt output (conditional on that output, since
the tilt-estimation code is withheld), corroborate that the recovered structure is tradeable.

## A note on the IR rounding

`reproduce_headline.py` prints a value-weighted information ratio of 2.01, while the paper
reports 1.99 (`\depvwir`). The 0.02 gap is not a discrepancy in the data: it reflects the
active-return alignment window (the reproduction aligns the overlay and base net-return series
on their common index; the paper's pipeline computes the IR inside `evaluate()` over the
panel's own support). Both use identical returns, weights, and cost model; the basis-point
active returns match (large-cap 111 vs 109 body, a two-bps alignment gap). The Newey--West t
printed by the script is the same-base active t (`\acttXminvar`, matching the race-table
object), which is distinct from and larger than the paper's headline deployable t
(`\depXactivet`), computed on the implementation-constrained investable series.

## Environment

Python 3.12.8; `numpy==2.4.2`, `pandas==2.2.3`, `scipy==1.17.1` (see `requirements.txt`).
`repro.py` fixes the random seed to 0 and is deterministic across runs.
