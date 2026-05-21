# Code Quality & Testing Audit — `@opus-aether-ai/pine-transpiler`

**HEAD:** `202eac1` (post-v0.4.1) · **Files audited:** 61 src + 67 tests + 16 scripts
**Tooling:** Bun 1.3.14 · Vite/tsup · Biome 2 · TypeScript 6 · zero runtime deps

---

## TL;DR

A genuinely well-tested, zero-dep transpiler library. **1422 tests pass, 95.96% function / 98.67% line coverage**, lint clean, and the dependency graph is acyclic. The library has one structural problem and one type-safety lacuna; everything else is polish.

- **The structural problem:** `src/factory/indicator-factory.ts` is **3180 lines** with a **1660-line `buildIndicatorFactory` function** and a **408-line `generateNativeMainBody`**. That single file is **27 % of src/ LOC**, is well below 90 % coverage, and breaks the project's own "files under 500 lines" rule by 6×.
- **The type-safety lacuna:** `tsconfig.json` enables only baseline `strict: true`. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are off. The codebase has earned the right to turn them on — `any` usage is effectively zero (only 7 `as unknown as` escape hatches, all narrow and justified).
- Tests are deep on unit + corpus (251 real Pine fixtures, 43 snapshots, ~293 K `expect()` calls), but there are **no property-based / fuzz tests** for the lexer or parser, which would be the highest-leverage addition.

---

## Scoreboard

| Area | Verdict | Score |
|---|---|---|
| File size & complexity | One outlier dominates; rest is fine | **C** |
| Type safety | Excellent for `any`/escape-hatches; tsconfig under-tuned | **B+** |
| Lint health | Zero violations; only 3 justified `biome-ignore` | **A** |
| Test coverage & structure | 95.96 % funcs / 98.67 % lines, 1422 tests, real corpus | **A** |
| Dead / unreachable code | 2 trivially-dead exports | **A−** |
| Refactor opportunities | One big seam; otherwise clean | **B** |
| Naming consistency | Uniform kebab-case + `export interface`-heavy | **A** |
| Build artifact quality | 1.9 MB dist, no `sideEffects: false`, two big bundle chunks | **B** |

---

## 1. File size & complexity — **C**

**Files > 500 lines (9):**

| Lines | Path |
|------:|------|
| **3180** | `src/factory/indicator-factory.ts` |
| **1122** | `src/parser/parser.ts` |
|  **965** | `src/generator/expression-generator.ts` |
|  **914** | `src/generator/metadata-visitor.ts` |
|  **901** | `src/runtime/stub-namespaces.ts` |
|  648 | `src/types/runtime.ts` (type-only — acceptable) |
|  647 | `src/parser/lexer.ts` |
|  647 | `src/mappings/technical-analysis.ts` (data-only — acceptable) |
|  567 | `src/generator/statement-generator.ts` |

**Files > 800 lines (5):** all of the top five above violate the project's own "Files under 500 lines" rule from `CLAUDE.md`. `indicator-factory.ts` violates it by **6.4×**.

**Functions > 100 lines (real brace-depth measurement):**

| Lines | Function | File |
|------:|----------|------|
| **1660** | `buildIndicatorFactory` | `factory/indicator-factory.ts:781` |
|  **408** | `generateNativeMainBody` | `factory/indicator-factory.ts:2738` |
|  243 | `generateStandaloneFactory` | `factory/indicator-factory.ts` |
|  135 | `normalizeVisualStyle` | `factory/indicator-factory.ts:333` |
|  123 | `Parser.parseStatement` | `parser/parser.ts` |
|  115 | `Parser.parsePrimary` | `parser/parser.ts` |
|  125 | `ExpressionGenerator.normalizeRequestSecurityArgs` | `generator/expression-generator.ts` |

`buildIndicatorFactory` is the entire codegen seam in one closure — it touches plots, inputs, palette colors, visual events, std-proxy, helper usage, varip state, and the main-body generator. It is also the only sub-90 % coverage hotspot in the repo (77.93 % funcs, 89.65 % lines).

## 2. Type safety — **B+**

**`tsconfig.json`:**
- `strict: true` ✅
- `noUncheckedIndexedAccess` ❌ (off)
- `exactOptionalPropertyTypes` ❌ (off)
- `noImplicitOverride` / `noImplicitReturns` / `noFallthroughCasesInSwitch` / `noPropertyAccessFromIndexSignature` ❌ (off)

**Escape hatches:**
- `any` as a **type**: **0** occurrences (the 9 hits are in comments/strings/docstrings).
- `@ts-ignore` / `@ts-expect-error`: **0**.
- `as unknown as X`: **7** total, all narrow and justifiable:
  - `factory/indicator-factory.ts:133` — `Array.prototype as unknown as Record<string, unknown>` (mutating prototype to add `min/max/sum`)
  - `factory/indicator-factory.ts:1724` — `Proxy` factory shape
  - `test-harness/descriptor.ts:79`, `reducers.ts:34,53` — reading runtime-shaped `plot` properties (`plottype`, `char`)
  - `generator/metadata-visitor.ts:196` — `stmt.body as Expression` (visitor pattern collapse)
  - `generator/expression-generator.ts:454` — `expr as SwitchExpression`

The codebase has earned the strict-flag upgrade. Turning on `noUncheckedIndexedAccess` is the single highest-value change here — the parser/lexer are full of `tokens[i]` indexing where the current type lies and says `Token` when it could be `undefined`.

## 3. Lint health — **A**

- `bun run lint` exits **0**. Biome checks 61 files in 52 ms. No warnings, no errors.
- `// biome-ignore` directives: **3**, all in `indicator-factory.ts`, all genuine:
  - line 983: `lint/complexity/noBannedTypes` — `Function` constructor required for runtime codegen
  - lines 1055 & 2351: `lint/suspicious/noConsole` — runtime error logging in the executed factory
- Biome config is strict: `noExplicitAny: error`, `noConsole: warn` (off for `src/cli/**`), `noUnusedImports: error`, `useTemplate: error`.

## 4. Test coverage & structure — **A**

**Coverage (`bun test --coverage`, 1422 pass / 0 fail / 293 759 expect calls, 4.06 s):**
- Overall: **95.96 % functions · 98.67 % lines** (threshold is 95 % both; gated by `scripts/check-coverage.ts`).
- Worst-covered files:
  - `factory/indicator-factory.ts` — **77.93 % funcs / 89.65 % lines** (the only real gap)
  - `runtime/mock-factories.ts` — 64.71 % funcs / 81.65 % lines
  - `generator/expression-generator.ts` — 87.88 % funcs / 92.19 % lines
  - `runtime/stub-namespaces.ts` — 83.19 % funcs / 94.24 % lines

**Test infrastructure:**
- 67 test files vs 61 src files — 1.10 test:src ratio.
- **Corpus tests are excellent**: `tests/corpus/community/` has **207** real-world Pine scripts pulled from 7 author corpora (top100, top200, everget, pinecoders, arunkbhaskar, f13end, harryguiacorn, forex_xau), plus **44** curated fixtures in `tests/corpus/fixtures/` and **43** snapshot files in `tests/corpus/snapshots/`. The corpus runner + mock-runtime is genuine integration-level testing.
- Categories: `lexer`, `parser`, `generator`, `factory`, `mappings`, `stdlib`, `runtime`, `cli`, `contract`, `integration`, `regression`, `corpus`. Well partitioned.

**Flakiness signals — clean:**
- Zero `setTimeout` / `Date.now()` in tests.
- Zero network calls in tests.
- `/tmp/...` paths appear only in `scripts/corpus/scrape.ts` (corpus-sourcing tool, not a test) and one CLI fixture-name assertion.

**The one missing class of test:** **no property-based / fuzz tests.** No `fast-check`, no `@effect/vitest` Arbitrary, no Bun equivalent. For a lexer + parser, this is the most cost-effective addition.

## 5. Dead / unreachable code — **A−**

Scanning exported `function | const | class` against repo-wide consumption:

- `INDENT_STRING` (`generator/generator-utils.ts:20`) — exported, used only internally by `indent()` in the same file. **Demote to non-export.**
- `PLOT_MAPPINGS` (`mappings/utilities.ts:195`) — exported, spread into `UTILITY_FUNCTION_MAPPINGS` in the same file but never imported elsewhere. **Demote to non-export** (or accept as a public-API constant for downstream consumers).

Everything else is either consumed by `tests/` or by `dist/` / public API. No deep dead code.

## 6. Refactor opportunities — **B**

**Module dependency graph (verified acyclic):**

```
parser    → (none)
mappings  → types
runtime   → (none)
generator → parser/ast, types
factory   → csp-errors, generator/helper-usage, stdlib, types
pipeline  → parser, generator, factory, types  (top of stack)
```

No bidirectional or near-circular imports. **The seam shape is correct.**

**Concrete refactor candidates:**

1. **`indicator-factory.ts` (3180 LOC) needs to be split.** Natural seams (each is largely self-contained):
   - `visual-handlers.ts` — `coercePlotNumber`, `coerceShapePlotNumber`, `unwrapVisualValue`, `readVisualNumber/Display/Color`, `readTranspFromColor`, `normalizeVisualStyle`, `wrapVisualHandle`, `createVisualNamespaceProxy`, `createVisualStdProxy` (~600 lines today).
   - `palette.ts` — `buildPaletteColors`, `buildPaletteDefaults`, `buildValToIndex` (~150 lines).
   - `runtime-main-body.ts` — `generateNativeMainBody` + `topologicalSort` (~500 lines).
   - `array-prototype-compat.ts` — `ensureArrayPrototypeCompat` (the global prototype-mutation block; isolate so it has a single import site).
   - Keep `buildIndicatorFactory` + `generateStandaloneFactory` + `generatePreamble` + `attachPineJsBody` in `indicator-factory.ts` (~500 lines).
2. **`parser.ts` (1122 LOC) is fine in shape but big.** Statement-parsing methods (`parseIfStatement`, `parseWhileStatement`, `parseForStatement`, `parseSwitchStatement`, `parseTypeDefinition`) could move into a `statement-parser.ts` mixin/sibling, leaving `parser.ts` as the top-level orchestrator. Lower urgency — file is cohesive.
3. **`expression-generator.ts` (965 LOC):** the two big record literals `INPUT_CANONICAL_ARG_ORDER` (138 lines) and `DRAWING_CANONICAL_ARG_ORDER` (86 lines) could move to a sibling `canonical-arg-order.ts` data file.
4. **No functions take > 5 positional args** (audited).
5. **No string-typed enums** to consolidate (audited).

## 7. Naming consistency — **A**

- All `src/**` files are kebab-case (`expression-generator.ts`, `stub-namespaces.ts`, etc.) — uniform.
- `export interface` is preferred (99) over `export type` (15) — heavily interface-favored, but consistent.
- `type` keyword used 0× standalone, 15× as `export type`.
- Generic type params: mostly `T` / `K`. Exceptions are domain-meaningful (`HelperCategory`, `DrawingHandle`).
- No `T`-prefix-with-suffix style (e.g. `TUser`); uses bare `T extends Record<…>` consistently.

## 8. Build artifact quality — **B**

- `dist/` total: **1.9 MB on disk**.
  - `dist/src-KxxrYdrf.js` (ESM): **283 KB** + 600 KB sourcemap
  - `dist/src-BwcdT67d.cjs` (CJS): **285 KB** + 600 KB sourcemap
  - `dist/index.js` (entry): 949 B; `dist/index.cjs`: 1.3 KB
  - `dist/cli`: 60 KB; `dist/test-harness`: 124 KB
- Main entry is named-export-only, no top-level side-effect statements at the index level.
- **`sideEffects` is NOT declared in `package.json`.** With opaque hashed-bundle names from vite, bundlers consuming this package can't tree-shake the un-used factory code path when only `transpileToStandaloneFactory` is needed (or vice versa). Either declare `"sideEffects": false` or list the actual side-effect files.
- Multiple module-init side-effects exist (e.g. `runtime/stub-namespaces.ts` declares `interface DrawingHandle` and module-level helpers; `factory/indicator-factory.ts`'s `ensureArrayPrototypeCompat` mutates `Array.prototype`). The Array prototype mutation in particular is a **load-bearing global side effect** that would break under `sideEffects: false`. It needs to be moved to a lazily-invoked init (called from `buildIndicatorFactory`) before tree-shaking can be declared safe.

---

## Prioritized actions

### P0 — Fix before next minor release

1. **Split `src/factory/indicator-factory.ts`** into the 5 sub-files in §6.1. The 1660-line function alone hides ~10 % of the codebase from coverage and makes review/PR diff impossible. This is the single largest quality win in the repo.
2. **Type the 7 `as unknown as` sites** properly. Most are reading runtime-shaped property bags — add a small `PlotShape` / `VisualField` interface and use proper narrowing helpers (`typeof raw === 'string'`, etc., already used inline below the cast). Cost: < 1 hour, removes the only typing-debt scar.
3. **Move `Array.prototype` mutation out of module top-level** and call it from `buildIndicatorFactory` once. Required before any `sideEffects: false` declaration is safe.

### P1 — Next milestone

4. **Add property-based tests for lexer + parser.** Bun is `fast-check`-compatible. Targeted invariants:
   - Lex(arbitrary identifier-shaped string) → tokens.length ≥ 1, no throw.
   - Lex/Parse roundtrip stability: parsing the same source twice produces structurally-equal ASTs (catch regressions in error recovery).
   - For any well-formed `expression` → `transpile` → `executePineJS` round-trip should not throw on bar(0).
5. **Turn on `noUncheckedIndexedAccess` in `tsconfig.json`.** Expect ~20 fixes concentrated in `parser/parser.ts` and `parser/expression-parser.ts` (token-stream indexing). Already covered by tests, so failures will be loud.
6. **Demote dead exports:** `INDENT_STRING` and `PLOT_MAPPINGS` → non-exported `const`.
7. **Improve coverage on `runtime/mock-factories.ts`** (64.71 % funcs) — these are user-facing mocks for the test-harness. Adding 4–5 unit tests in `tests/runtime/mock-factories.test.ts` would close the gap.

### P2 — Polish

8. Add `"sideEffects": false` to `package.json` (after P0.3).
9. Split `parser.ts` statement methods into `statement-parser.ts`.
10. Move `INPUT_CANONICAL_ARG_ORDER` + `DRAWING_CANONICAL_ARG_ORDER` literals into `generator/canonical-arg-order.ts`.
11. Enable `exactOptionalPropertyTypes` after the `noUncheckedIndexedAccess` cleanup settles. Lower-value but tightens API contracts.
12. Add a `tests/property/` directory + `fast-check` dev-dep with 3–5 generators (Pine identifier, Pine number, Pine string, Pine binary expression).

---

## Tests-to-add shortlist (concrete)

- `tests/factory/visual-handlers.test.ts` — cover `normalizeVisualStyle`, `readVisualColor`, `readTranspFromColor`, `coerceShapePlotNumber` (currently buried in 89 % coverage of `indicator-factory.ts`).
- `tests/factory/runtime-main-body.test.ts` — `generateNativeMainBody` + `topologicalSort` (the 408-line function deserves dedicated unit tests, not just corpus coverage).
- `tests/runtime/mock-factories.test.ts` — bring funcs coverage from 64.71 → ≥ 95 %.
- `tests/property/lexer.property.test.ts` — fast-check lexer never throws on random ASCII input shorter than `MAX_INPUT_SIZE`.
- `tests/property/parser.property.test.ts` — fast-check parser is idempotent on its own output (parse → generate-source-string → parse again).

---

*Report generated against `202eac1` on 2026-05-22 (read-only audit, no files mutated).*
