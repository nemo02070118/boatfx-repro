# Data sources and versions

This package reproduces the factor-evaluation engine and the state-conditional overlay on a
public sample of factors. The full study draws on the following sources; each is public and
citable, and the table records the exact vintage used.

| Source | Series / dataset | Vintage | URL |
|---|---|---|---|
| Chen & Zimmermann, *Open Source Asset Pricing* | Anomaly long-short portfolio returns (EW, VW, NYSE-breakpoint, ME20) | 2024 release | https://www.openassetpricing.com/ |
| He, Kelly & Manela (2017) | Intermediary capital ratio; broker-dealer squared leverage (monthly) | factors file, 2025-06 refresh | https://voices.uchicago.edu/zhiguohe/data-and-empirical-patterns/ |
| Moody's via FRED | Baa (`BAA`), Aaa (`AAA`) seasoned corporate yields | monthly; ALFRED vintage 2026-09-15 | https://fred.stlouisfed.org/ |
| Chicago Fed via FRED | Adjusted National Financial Conditions Index (`ANFCI`) | weekly to month-end; ALFRED vintage 2026-09-15 | https://fred.stlouisfed.org/series/ANFCI |
| OECD MEI / US Treasury via FRED | 3-month interbank rate (`IR3TIB01USM156N`), 3-month T-bill (`DTB3`) | monthly; ALFRED vintage 2026-09-15 | https://fred.stlouisfed.org/ |
| CBOE via FRED | VIX (`VIXCLS`) | daily to month-end; ALFRED vintage 2026-09-15 | https://fred.stlouisfed.org/series/VIXCLS |
| St. Louis Fed via FRED | Financial Stress Index (`STLFSI4`) | weekly to month-end; ALFRED vintage 2026-09-15 | https://fred.stlouisfed.org/series/STLFSI4 |
| FRB New York primary-dealer statistics | Dealer secured financing, US Treasuries in/out (`PDSIOSB-UTSETTOT`, `PDSOOS-UTSETTOT`) | weekly from 2013-04; retrieved 2026-09-20 | https://markets.newyorkfed.org/api/pd/ |

> FRED series are revised. Because these enter only the mechanism split (a median cut into
> scarce- vs abundant-funding months), the result is insensitive to small revisions, but the
> exact ALFRED vintage date is recorded above so the split is reproducible bit-for-bit.
| Kakushadze (2016) | WorldQuant Alpha101 formulas | published paper | https://arxiv.org/abs/1601.00991 |
| Guotai Junan Securities (2017) | Alpha191 formulas | research report | (formulas reproduced in cited sources) |

## Notes on the machine factor pool

The 7,384 syntactically admitted machine-generated candidate factors (6,881 of which survive
a minimal data-quality filter and enter the rescue battery) are LLM-authored formulaic
expressions over a fixed operator/signal inventory (see `operator_inventory.json`). The
generator does not tune its grammar or windows on the CRSP evaluation sample. The pool itself is not
redistributed, because it is generated rather than sourced; `sample_factors.json` ships 60
representative expressions (as parsed ASTs) so that the engine can be exercised end to end.
The microstructure signals the operators consume are mapped from daily OHLCV, i.e. they are
daily-OHLCV proxies for the named microstructure quantities, not tick data.

## Path configuration

Scripts read their data root from the `BOATFX_DATA` environment variable when set, then fall
back to a repo-local `data/external` directory, then to a stand-alone data drive. Set
`BOATFX_DATA` to point at your own copy of the sources above; no absolute path is hard-coded.
