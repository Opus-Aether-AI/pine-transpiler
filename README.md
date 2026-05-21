# Pine Script Transpiler — Pine v5/v6 → JavaScript (PineJS)

[![npm version](https://img.shields.io/npm/v/@opus-aether-ai/pine-transpiler.svg)](https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler)
[![npm downloads](https://img.shields.io/npm/dm/@opus-aether-ai/pine-transpiler.svg)](https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Test coverage](https://img.shields.io/badge/coverage-95%25%2B-brightgreen.svg)](docs/DEVELOPMENT.md#test-coverage)

**Convert Pine Script v5/v6 into JavaScript that runs on the TradingView Charting Library.** A zero-dependency, TypeScript-first, clean-room transpiler that emits PineJS `CustomIndicator` factories from Pine source — so your own indicators can render on charts you embed in your own apps.

```typescript
import { transpileToPineJS } from '@opus-aether-ai/pine-transpiler';

const result = transpileToPineJS(pineSource, 'my-sma', 'My SMA');
if (result.success) {
  chart.registerCustomIndicator(result.indicatorFactory(PineJS));
}
```

> **Independent project — not affiliated with TradingView Inc.**
> "TradingView" and "Pine Script" are trademarks of TradingView Inc. This tool targets the publicly documented Pine language and PineJS API for interoperability purposes. You must hold a valid TradingView Charting Library license to use the output. The tool does not access private, encrypted, or invite-only scripts and never contacts TradingView servers. See [DISCLAIMER.md](DISCLAIMER.md).

---

## Why use this

- **Drop-in PineJS factories.** Output implements the public `CustomIndicator` interface — register it the same way you'd register any custom study.
- **Pine v5 and v6 support.** Type definitions, methods, named args, `var`/`varip`, control flow, multi-output functions, maps, matrices (subset), arrays, switch expressions.
- **Standard library mapped.** `ta.*`, `math.*`, `time.*`, `str.*` resolved to `PineJS.Std` equivalents. StdPlus polyfills cover gaps (`bb`, `kc`, `hma`, session/time helpers, etc.).
- **Zero runtime dependencies.** The core transpiler ships with no `node_modules` cost. Works in Node 18+, browsers, Deno, and Bun.
- **Strict-CSP friendly.** `transpileToStandaloneFactory` emits ESM source you can build into a static module — no `unsafe-eval` required at chart-host runtime.
- **Production-tested.** 1,400+ unit tests, 95%+ coverage gate enforced in CI, plus a corpus of real-world community Pine scripts that gates parity regressions.

---

## Install

```bash
bun add @opus-aether-ai/pine-transpiler
# or: npm install @opus-aether-ai/pine-transpiler
```

Works in any JS runtime that supports ES2020. ESM and CJS both ship in the published tarball; types are included.

## Quick start

Transpile a Pine indicator and register it with the TradingView Charting Library:

```typescript
import { transpileToPineJS } from '@opus-aether-ai/pine-transpiler';

const pineSource = `
//@version=6
indicator("SMA Crossover", overlay=true)
fast = ta.sma(close, input.int(9,  "Fast"))
slow = ta.sma(close, input.int(21, "Slow"))
plot(fast, "Fast", color.blue)
plot(slow, "Slow", color.orange)
`;

const result = transpileToPineJS(
  pineSource,
  'sma_crossover',     // stable id
  'SMA Crossover',     // display name
);

if (!result.success) {
  throw new Error(result.error);
}

// `result.indicatorFactory` is a standard PineJS CustomIndicator factory.
// Register it through your usual `custom_indicators_getter`:
//
// custom_indicators_getter: (PineJS) => [result.indicatorFactory(PineJS), ...]
```

For strict-CSP environments where `unsafe-eval` is blocked, swap in `transpileToStandaloneFactory` to emit a buildable ESM module instead. Full example in [docs/API.md](docs/API.md).

---

## Documentation

Everything beyond the quick start lives in `docs/`:

| Topic | Doc |
|---|---|
| Full API reference (every exported function, type, and pipeline stage) | [docs/API.md](docs/API.md) |
| Internal architecture, the four-stage pipeline, source layout | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Supported language features, full mapping tables | [docs/SUPPORTED_FEATURES.md](docs/SUPPORTED_FEATURES.md) |
| Known limitations and partial-support areas | [docs/LIMITATIONS.md](docs/LIMITATIONS.md) |
| Roadmap and parity tracking | [docs/FUTURE_PARITY_ROADMAP.md](docs/FUTURE_PARITY_ROADMAP.md) |
| Host renderer contract (`__visualEvents`, `pineHandleId`, drawing API) | [docs/HOST_RENDERING_CONTRACT.md](docs/HOST_RENDERING_CONTRACT.md) |
| Local development, testing, and corpus tooling | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Legal posture and safe-harbor framework | [DISCLAIMER.md](DISCLAIMER.md) |
| Release notes | [CHANGELOG.md](CHANGELOG.md) |

---

## Project status

- **Stable for indicator workloads.** Strategy (`strategy.*`) is intentionally out of scope; this is an indicator transpiler.
- **`request.security` is a subset.** Same-bar and HTF bucket-merge passthrough work; cross-symbol fetching and full `barmerge` semantics are tracked in the roadmap.
- **Drawing APIs are tracked but host-rendered.** `box.new` / `line.new` / `label.new` / `table.new` emit visual events on each bar; chart-side rendering is the host's responsibility via the [host rendering contract](docs/HOST_RENDERING_CONTRACT.md).
- **Coverage gate.** CI fails if line or function coverage drops below 95%. Current: 95.81% functions / 98.62% lines / 1,400+ tests.

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the complete known-issues list.

---

## Contributing

Issues and PRs welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the dev workflow, then [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the test/corpus commands.

Good first-issue areas: missing `ta.*` polyfills in StdPlus, edge-case test coverage, source map generation, doc improvements.

---

## License

MIT — see [LICENSE](LICENSE). Use, modify, distribute, sublicense, sell. Just keep the copyright notice and license text in copies or substantial portions. No warranty.

---

## Disclaimer

This is an independent, open-source developer interoperability tool. It is **not** affiliated with, endorsed by, sponsored by, or associated with TradingView Inc.

- "TradingView" and "Pine Script" are trademarks of TradingView Inc., used solely for nominative identification of the language and API surface this tool targets.
- The transpiler accepts plaintext `.pine` source only. It does **not** retrieve, decode, decrypt, or access private, encrypted, Protected, or Invite-Only scripts.
- It does **not** scrape, automate, or interact with `tradingview.com` or any TradingView-hosted service.
- Users are solely responsible for ensuring their use of the input source code and the generated JavaScript output complies with the TradingView Terms of Service and any Charting Library license agreement they hold.
- Provided as-is. The authors assume no responsibility for trading decisions, license-compliance breaches, or financial losses resulting from use of this software.

For the full safe-harbor framework, see [DISCLAIMER.md](DISCLAIMER.md).
