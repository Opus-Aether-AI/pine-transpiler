# Pine Corpus Baseline

This is the primary parity scorecard for transpiler stability. Re-run with `bun run corpus`.

## Current Snapshot (2026-05-22)

```text
Total fixtures:        233
Transpile success:     233  (100%)
+ Parse-clean:         233  (100%)
+ Instantiate:         233  (100%)
+ Construct:           233  (100%)
+ Full pass (no err):  233  (100%)
```

Additional parity checks:

- `bun run corpus:strict`: **11/11** strict numeric checks passed
- `bun run corpus:matrix`: **50/50** targeted indicator checks passed
- `bun run corpus:critical`: **30/30** critical indicators passed
- `bun run corpus:forex-xau`: **13/13** forex-XAU checks passed
- `bun run corpus:top100`: **100/100** pass
- `bun run corpus:top200`: **200/200** pass
- `bun run corpus:visual`: **8/8** visual parity checks passed
- `bun run corpus:gate`: **PASS** (all lane/authenticity budgets)
- `bun run chart:safety`: **233/233** pass, no schema/lifecycle failures
- `bun run scan tests/corpus`: **233/233** pass, zero runtime errors

## Corpus Composition

### By source group

| Group | Pass | Total | Rate |
|---|---:|---:|---:|
| curated | 43 | 43 | 100% |
| arunkbhaskar | 26 | 26 | 100% |
| everget | 8 | 8 | 100% |
| f13end | 1 | 1 | 100% |
| forex_xau | 13 | 13 | 100% |
| top100 | 42 | 42 | 100% |
| top200 | 100 | 100 | 100% |

### By lane

| Lane | Pass | Total | Rate |
|---|---:|---:|---:|
| curated_core | 43 | 43 | 100% |
| upstream_authentic | 35 | 35 | 100% |
| synthetic_custom | 113 | 113 | 100% |
| quarantine | 42 | 42 | 100% |

### By authenticity

| Authenticity | Pass | Total | Rate |
|---|---:|---:|---:|
| authentic | 35 | 35 | 100% |
| proxy | 42 | 42 | 100% |
| synthetic | 156 | 156 | 100% |

### By category

| Category | Pass | Total | Rate |
|---|---:|---:|---:|
| core_ta | 31 | 31 | 100% |
| datastruct | 5 | 5 | 100% |
| mtf | 22 | 22 | 100% |
| other | 37 | 37 | 100% |
| session_time | 3 | 3 | 100% |
| smc_ict | 56 | 56 | 100% |
| visual | 79 | 79 | 100% |

## Score History (Milestones)

| Date | Score | Notes |
|---|---|---|
| 2026-04-25 (initial baseline) | 32/40 = **80%** | Curated corpus start |
| 2026-04-25 (phase completion) | 40/40 = **100%** | Curated parity achieved |
| 2026-05-01 (community rollout complete) | 92/92 = **100%** | Curated + upstream community corpus |
| 2026-05-02 (top100/top200 + governance) | 234/234 = **100%** | Manifest lanes/authenticity + CI gate budgets |
| 2026-05-22 (cleanup + validation refresh) | 233/233 = **100%** | Harness parity + scanner + safety gates all green |

## KPI Meanings

1. **Full pass**: fixture transpiles and executes with no runtime error.
2. **Curated pass**: pass rate within the curated baseline suite.
3. **Community pass**: pass rate within imported community suites.
4. **Parse-clean**: fixtures parsed with zero parser errors (`parseWithErrors().hasErrors === false`).
5. **Unimplemented Std calls**: count and list of unresolved `Std.*` calls seen during corpus execution.
6. **Top failure modes**: grouped dominant failure signatures from runtime/transpile errors.

## Commands

```bash
bun run corpus            # full scorecard + lane/authenticity/category/features
bun run corpus:strict     # strict numeric parity checks (11 fixtures)
bun run corpus:matrix     # indicator pass/fail matrix
bun run corpus:critical   # critical indicator matrix
bun run corpus:forex-xau  # forex/XAU indicator matrix
bun run corpus:top100     # top-100 matrix artifact
bun run corpus:top200     # top-200 matrix artifact
bun run corpus:gate       # CI-style quality/stability budgets
bun run chart:safety      # host-runtime safety contract gate
bun run corpus:visual     # visual event snapshot parity harness
bun run scan tests/corpus # strict standalone runtime scanner
bun run corpus:snap       # refresh corpus + visual snapshots intentionally
```

## Gate Budgets (`bun run corpus:gate`)

Defaults are strict (all 100% except unimplemented calls max 0). Override via env vars:

- `GATE_MIN_PASS_OVERALL`
- `GATE_MIN_PARSE_CLEAN`
- `GATE_MAX_UNIMPLEMENTED_STD_CALLS`
- `GATE_MIN_PASS_LANE_CURATED_CORE`
- `GATE_MIN_PASS_LANE_UPSTREAM_AUTHENTIC`
- `GATE_MIN_PASS_LANE_SYNTHETIC_CUSTOM`
- `GATE_MIN_PASS_LANE_QUARANTINE`
- `GATE_MIN_PASS_AUTH_AUTHENTIC`
- `GATE_MIN_PASS_AUTH_PROXY`
- `GATE_MIN_PASS_AUTH_SYNTHETIC`

## Interpretation

- A corpus pass means transpilation + runtime execution succeeded under the project runtime model.
- This is a strong compatibility signal, but not absolute PineScript parity for all unsupported APIs.
- Full parity work continues in the roadmap (`FUTURE_PARITY_ROADMAP.md`), especially around deeper MTF, time/session correctness, and visual semantics.
