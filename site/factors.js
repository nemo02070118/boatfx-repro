/* ==========================================================================
   BOAT · shipped sample factors
   --------------------------------------------------------------------------
   The 60-factor public sample the site ships. It lives in its own file and
   loads FIRST because two independent consumers need it: app.js renders the
   §06 factor list from it, and gate.js draws duplicate proposals from it in
   the seeded sampler.

   When this lived at the top of app.js (the largest script), a slow network
   could start the console's `agent` pass before app.js had executed — the
   sampler then saw an empty shipped() and produced a DIFFERENT proposal
   stream from the same seed, so two reviewers got two different funnels.
   The site claims the seed makes the numbers identical for everyone; this
   file is what makes that true.
   ========================================================================== */

const SAMPLE_FACTORS = [
  {
    name: "net_quote_demand_rank",
    rationale: "Biais et al. (1995): order-book imbalance predicts price changes.",
    expr: {
      kind: "unary", op: "Rank",
      inner: {
        kind: "binary", op: "Div",
        left: { kind: "input", signal: "BidSize" },
        right: { kind: "input", signal: "AskSize" },
      },
    },
  },
  {
    name: "volume_price_correlation_proxy",
    rationale: "Karpoff (1987): positive volume–price-change correlation; product proxy.",
    expr: {
      kind: "binary", op: "Mul",
      left: { kind: "input", signal: "Volume" },
      right: {
        kind: "unary", op: "Abs",
        inner: { kind: "unary", op: "Diff", inner: { kind: "input", signal: "MidPrice" } },
      },
    },
  },
  {
    name: "microprice_pressure",
    rationale: "Size-weighted mid (microprice) drifts ahead of traded mid under queue asymmetry.",
    expr: {
      kind: "binary", op: "Sub",
      left: {
        kind: "binary", op: "Div",
        left: {
          kind: "binary", op: "Add",
          left: { kind: "binary", op: "Mul", left: { kind: "input", signal: "BestAsk" }, right: { kind: "input", signal: "BidSize" } },
          right: { kind: "binary", op: "Mul", left: { kind: "input", signal: "BestBid" }, right: { kind: "input", signal: "AskSize" } },
        },
        right: { kind: "binary", op: "Add", left: { kind: "input", signal: "BidSize" }, right: { kind: "input", signal: "AskSize" } },
      },
      right: { kind: "input", signal: "MidPrice" },
    },
  },
  {
    name: "signed_trade_zscore",
    rationale: "Signed flow normalized by recent volume volatility — microstructure pressure.",
    expr: {
      kind: "rolling", op: "Zscore", window: 20,
      inner: {
        kind: "binary", op: "Mul",
        left: { kind: "input", signal: "TradeSide" },
        right: { kind: "input", signal: "TradeSize" },
      },
    },
  },
  {
    name: "spread_widening_rank",
    rationale: "Quoted-spread expansion ranks names under temporary liquidity stress.",
    expr: {
      kind: "unary", op: "Rank",
      inner: {
        kind: "rolling", op: "Mean", window: 10,
        inner: {
          kind: "binary", op: "Sub",
          left: { kind: "input", signal: "BestAsk" },
          right: { kind: "input", signal: "BestBid" },
        },
      },
    },
  },
  {
    name: "trend_aligned_signed_flow",
    rationale: "Flow agreeing with recent mid drift — conditional pressure, not raw imbalance.",
    expr: {
      kind: "binary", op: "Mul",
      left: {
        kind: "unary", op: "Sign",
        inner: { kind: "rolling", op: "Slope", window: 20, inner: { kind: "input", signal: "MidPrice" } },
      },
      right: {
        kind: "binary", op: "Mul",
        left: { kind: "input", signal: "TradeSide" },
        right: { kind: "input", signal: "TradeSize" },
      },
    },
  },
];
