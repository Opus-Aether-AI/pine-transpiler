# Pine Script Transpiler — Pine v5/v6 → JavaScript (PineJS)

[![npm version](https://img.shields.io/npm/v/@opus-aether-ai/pine-transpiler.svg)](https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler)
[![npm downloads](https://img.shields.io/npm/dm/@opus-aether-ai/pine-transpiler.svg)](https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Test coverage](https://img.shields.io/badge/coverage-95%25%2B-brightgreen.svg)](docs/DEVELOPMENT.md#test-coverage)

**Convert Pine Script v5/v6 into JavaScript that runs on the TradingView Charting Library.** A zero-dependency, TypeScript-first, clean-room Pine Script compiler that emits PineJS `CustomIndicator` factories from Pine source — so your own indicators can render on charts you embed in your own webapp, dashboard, or trading terminal. Works in Node.js, Bun, Deno, and modern browsers.

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

## Use cases

### TradingView Charting Library integration
Drop Pine indicators into any chart that embeds the TradingView Charting Library. The transpiler outputs standard PineJS `CustomIndicator` factories — register them through your `custom_indicators_getter` and they render alongside the library's built-in studies.

### White-label dashboards and SaaS chart hosts
Add Pine v5/v6 support to your own webapp without re-implementing the language. The output works in any chart host you control: embedded dashboards, broker terminals, white-label analytics products, internal research tools.

### ICT / SMC indicator workflows
Killzones, BOS / CHoCH, FVG, breaker blocks, order blocks, liquidity sweeps, and session-aware indicators all transpile end-to-end. Drawing primitives (`box.new`, `line.new`, `label.new`, `table.new`) are tracked through the host rendering contract.

### Strict-CSP environments without `unsafe-eval`
`transpileToStandaloneFactory` emits a buildable ESM module that runs without `new Function(...)`. Use it when your chart host enforces a strict Content Security Policy.

### Server-side Pine evaluation
Run the same Pine source on Node 18+ for alerting, screening, or pre-computing indicator values. The output is plain JavaScript — no browser, chart library, or DOM required.

### Pine Script tooling — linters, formatters, language servers
The pipeline (`parse → extractMetadata → generateBody → buildFactory`) is exported as individual stages, so you can build a Pine linter, formatter, language-server, or static analyzer without re-wiring the parser.

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

## Compatibility

| Surface | Support |
|---|---|
| Pine Script versions | v5, v6 |
| Target runtime | PineJS (TradingView Charting Library Custom Studies API) |
| Output formats | ESM, CommonJS, and a buildable standalone ESM module for strict-CSP |
| JavaScript runtimes | Node 18+, Bun, Deno, modern browsers (ES2020) |
| TypeScript | Full type definitions bundled |
| Package managers | npm, pnpm, yarn, bun |
| Charting Library | Any version that exposes `custom_indicators_getter` (the documented Custom Studies API) |

---

## Project status

- **Stable for indicator workloads.** Strategy (`strategy.*`) is intentionally out of scope; this is an indicator transpiler.
- **`request.security` is a subset.** Same-bar and HTF bucket-merge passthrough work; cross-symbol fetching and full `barmerge` semantics are tracked in the roadmap.
- **Drawing APIs are tracked but host-rendered.** `box.new` / `line.new` / `label.new` / `table.new` emit visual events on each bar; chart-side rendering is the host's responsibility via the [host rendering contract](docs/HOST_RENDERING_CONTRACT.md).
- **Coverage gate.** CI fails if line or function coverage drops below 95%. Current: 95.81% functions / 98.62% lines / 1,400+ tests.

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the complete known-issues list.

---

## FAQ

<details>
<summary>How do I add Pine Script support to the TradingView Charting Library?</summary>

Transpile your Pine source with `transpileToPineJS`, then pass the resulting factory to `custom_indicators_getter` when you construct the widget. The factory implements the standard `CustomIndicator` interface — no chart-library patches needed. See the [quick start](#quick-start) and [docs/API.md](docs/API.md) for the full example.
</details>

<details>
<summary>What's the difference between PineJS and Pine Script?</summary>

Pine Script is the language traders write indicators in. PineJS is the JavaScript binding the TradingView Charting Library uses to execute custom indicators at runtime. This tool converts the former into the latter — you write Pine, it emits PineJS.
</details>

<details>
<summary>Can I run Pine Script in a browser or in Node.js without TradingView?</summary>

Yes. The transpiler emits plain JavaScript. You still need to provide a `PineJS.Std` runtime — implementations of standard-library functions like `ta.sma`, `ta.ema`, `ta.rsi`, and friends. The library ships a `StdPlus` polyfill that covers many of these. See [docs/SUPPORTED_FEATURES.md](docs/SUPPORTED_FEATURES.md).
</details>

<details>
<summary>Does this support Pine Script v6?</summary>

Yes. User-defined types, methods, named arguments, generic type parameters (`array<T>`, `matrix<T>`, `map<K,V>`), `varip`, `switch` expressions, and v6 `request.security` semantics are all implemented. Feature table in [docs/SUPPORTED_FEATURES.md](docs/SUPPORTED_FEATURES.md).
</details>

<details>
<summary>How is this different from running Pine on TradingView directly?</summary>

TradingView runs Pine inside its own hosted environment. This tool transpiles Pine into JavaScript that your own application runs. Use it when you need Pine indicators inside a chart host you control — a custom webapp, embedded dashboard, broker terminal, or strict-CSP SaaS product.
</details>

<details>
<summary>What about <code>strategy.*</code> and backtesting?</summary>

Out of scope. This is an indicator transpiler. `strategy.entry`, `strategy.exit`, `strategy.close`, and the rest of the order-execution surface are intentionally unimplemented. Use a dedicated backtester for that workflow.
</details>

<details>
<summary>Can I use this in a strict-CSP environment without <code>unsafe-eval</code>?</summary>

Yes — use `transpileToStandaloneFactory` instead of `transpileToPineJS`. It emits a buildable ESM module that does not call `new Function(...)`. Bundle it through Vite, esbuild, Rollup, or webpack and the output runs under a strict Content Security Policy.
</details>

<details>
<summary>How do drawing primitives (box, line, label, table) work?</summary>

The transpiler tracks them as stateful handles and emits a `__visualEvents` stream each bar. The host chart renderer consumes that stream and decides how to draw boxes, lines, labels, and tables. See [docs/HOST_RENDERING_CONTRACT.md](docs/HOST_RENDERING_CONTRACT.md) for event shape and lifecycle invariants.
</details>

<details>
<summary>Is there a CLI?</summary>

Yes. `bunx pine-transpiler input.pine --format pinejs > out.js` produces a `CustomIndicator` factory module. Run `pine-transpiler --help` for the full flag list, or see [docs/API.md](docs/API.md).
</details>

<details>
<summary>What's the runtime overhead?</summary>

Zero `node_modules` — the published package has no `dependencies`, only `devDependencies`. The transpiler is tree-shakeable; modern bundlers strip what you don't import. Most consumers see roughly 30–80 kB minified + gzipped.
</details>

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
