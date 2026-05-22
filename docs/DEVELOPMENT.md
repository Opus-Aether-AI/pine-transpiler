# Development

Local workflow, test commands, and corpus tooling for working on `@opus-aether-ai/pine-transpiler`.

## Setup

```bash
bun install
```

The repo uses [Bun](https://bun.sh) as the package manager, test runner, and CLI executor. Node 18+ also works for running the published package but Bun is required for the dev workflow (`bun test`, `bun run scripts/...`).

## Day-to-day commands

```bash
# Run all unit + regression tests
bun test tests/

# Watch mode
bun test --watch tests/

# Type check
bun run typecheck

# Lint
bun run lint
bun run lint:fix

# Build dist/ (vite)
bun run build
```

## Test coverage

Coverage is enforced through multiple layers. The aggregate gate runs in CI and fails the build if line or function coverage drops below 95%:

```bash
bun run test:coverage
```

Latest local full-run numbers: **95.24% functions / 97.63% lines** across **1,589 tests**.

Per-layer test commands:

| Layer | Command | What it checks |
|---|---|---|
| Unit / regression | `bun test tests/` | Lexer, parser, generator, mappings, factory wrappers, runtime helpers |
| Runtime-shaped harness | `bun run test:harness` | Constructor contract, plot/style alignment, reducer safety against transpiled output |
| Visual-event payload contract | included in `bun test tests/contract/` | `__visualEvents` shape, `pineHandleId` lifecycle, canonical arg order |

## Corpus tooling

The transpiler is gated against a corpus of real-world Pine scripts. Two sources:

- **Curated** — hand-crafted fixtures under `tests/corpus/fixtures/` covering specific language features
- **Community** — public-GitHub Pine scripts vendored into `tests/corpus/community/<source>/` via the corpus-ingest script (each file carries an attribution header pointing at the upstream repo)

The ingest script reads from local clones at `/tmp/pine-corpus-sources/<repo>/` and does not perform remote fetches on its own. To refresh community fixtures, clone the configured source repos locally and re-run ingest:

```bash
bun scripts/corpus/scrape.ts
```

### Parity check commands

```bash
# Full corpus scorecard (pass/total + top failures + per-source breakdown)
bun run corpus

# Strict numeric parity checks on core indicators
bun run corpus:strict

# Indicator parity matrix
bun run corpus:matrix

# Critical real-world market scripts (ICT / SMC / killzones / forex / XAU)
bun run corpus:critical

# Forex/XAU-focused matrix
bun run corpus:forex-xau

# Top-100 community target matrix
bun run corpus:top100

# Top-200 target matrix (top-100 + 100 additional popular/customized)
bun run corpus:top200

# Differential numeric parity report
bun run corpus:differential

# Visual parity baselines (snapshot-tested)
bun run corpus:visual

# Refresh corpus + visual snapshots after intentional changes
bun run corpus:snap

# Strict standalone scanner over corpus/runtime
bun run scan tests/corpus
```

### Stability gates

```bash
# Stability gate — lane / authenticity / category budgets enforced in CI
bun run corpus:gate

# Host-runtime safety gate
#   (constructor, per-bar plot shape, visual-event payload integrity)
bun run chart:safety
```

`bun run chart:safety` writes failure artifacts to `.tmp/chart-safety/` for inspection.

## Corpus governance

Fixtures are classified by `tests/corpus/manifest.ts`:

- **Lanes** — `curated_core`, `upstream_authentic`, `synthetic_custom`, `quarantine`
- **Authenticity** — `authentic`, `proxy`, `synthetic`
- **Categories and features** — inferred from fixture source

`bun run corpus:gate` enforces per-lane and per-authenticity pass-rate budgets. Override via env vars (`CORPUS_GATE_MIN_PASS=0.97`, etc.) if you are intentionally accepting a regression while diagnosing.

Reference docs for corpus baselines and matrices:

- [docs/CORPUS-BASELINE.md](CORPUS-BASELINE.md)
- [docs/TOP100_MATRIX.md](TOP100_MATRIX.md)
- [docs/TOP200_MATRIX.md](TOP200_MATRIX.md)
- [docs/CRITICAL_INDICATOR_MATRIX.md](CRITICAL_INDICATOR_MATRIX.md)

## Release workflow

The package publishes to **both** public npm and GitHub Packages from one command:

```bash
# Bump version (commits + tags)
npm version patch     # 0.x.y -> 0.x.(y+1)  — or `minor` / `major`

# Push the version commit and tag
git push --follow-tags

# Publish to both registries
bun run release
```

`bun run release` is two scripts in sequence:

1. `publish:npm` — runs `prepublishOnly` (typecheck + lint + test + build), then `npm publish --registry=https://registry.npmjs.org`
2. `publish:gh` — `npm publish --registry=https://npm.pkg.github.com --ignore-scripts` (skips the redundant rebuild)

Individual targets:

```bash
bun run publish:npm   # public npm only (full pre-publish gate)
bun run publish:gh    # GitHub Packages only (expects fresh dist)
```

### First-time publish auth

Public npm requires either an interactive OTP (`npm publish --otp=123456`) or a granular access token with "Bypass 2FA" enabled.

GitHub Packages requires a Personal Access Token with `write:packages` + `read:packages` (+ `repo` if the source repo is private) in `~/.npmrc`:

```
//npm.pkg.github.com/:_authToken=ghp_yourToken
```

Do not add `@opus-aether-ai:registry=https://npm.pkg.github.com` to your local `~/.npmrc` — it overrides the explicit `--registry=` flags in the publish scripts and routes `publish:npm` to GitHub Packages by accident.

## Project layout pointers

```
src/                # transpiler source (see ARCHITECTURE.md for the map)
tests/              # unit + regression + corpus + contract tests
docs/               # API, architecture, supported features, limitations, contract
fixtures/           # ICT killzones + small Pine smoke fixtures (shipped in npm tarball)
scripts/corpus/     # corpus reports, matrices, ingest, gate, chart-safety
dist/               # built output (ESM + CJS + types); committed for git-URL consumers
```
