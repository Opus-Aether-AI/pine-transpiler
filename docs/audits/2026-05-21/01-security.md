# Security & Supply-Chain Audit — `@opus-aether-ai/pine-transpiler`

- HEAD: `202eac1` (tag `v0.4.1` ancestor)
- Scope: pure transpiler library + CLI, zero runtime deps, MIT
- Auditor frame: OWASP Top 10 + SAST + secret-scanning posture

## 1. OWASP Top 10 applicability — **WARN**

| Cat | Verdict | Note |
|---|---|---|
| A01 Broken Access Control | N/A | no authz surface |
| A02 Crypto Failures | N/A | no crypto |
| **A03 Injection** | **WARN** | transpiler emits JS that downstream hosts execute. See §2 |
| A04 Insecure Design | PASS | clear boundary: lib in, JS string out |
| A05 Misconfig | WARN | tsconfig strict ON; biome `noExplicitAny=error` (good); but **GitHub secret-scanning + Dependabot security-updates DISABLED**, no `.github/dependabot.yml`, org-level 2FA **disabled** |
| **A06 Vulnerable Components** | **WARN** | 3 dev-only advisories (see §3) |
| A07 Auth Failures | N/A | |
| A08 Software/Data Integrity | WARN | npm tarball signed by registry, **no Sigstore provenance attestation** (`dist.attestations: no-provenance` on 0.4.1 + 0.4.2) |
| A09 Logging | N/A | |
| A10 SSRF | N/A | |

## 2. Code-execution surface — **PASS (with one expected `new Function`)**

- `eval(` / `vm.*` / `child_process` / dynamic `import()`/`require()`: **zero** matches in `src/`.
- `new Function(...)`: 2 legitimate sites, both **by design** and **documented**:
  - `src/index.ts:231` — `executePineJS` opt-in path; runs user-provided already-transpiled JS. Caller controls input; CSP-eval hint is wired (`csp-errors.ts`).
  - `src/factory/indicator-factory.ts:986` — per-bar compile in the non-CSP factory. Arg list is a fixed positional whitelist; body is generator output (not raw user source).
- Generator template-string emit: **safe**.
  - String literals routed through `JSON.stringify` (`generator/expression-generator.ts:798`).
  - Every identifier emit calls `sanitizeIdentifier` (`generator/generator-utils.ts:83`): denies `__proto__`, `constructor`, `prototype`, `eval`, `Function`, `arguments`, `caller`, `callee`, plus reserved words — prefixes with `_pine_`.
  - Standalone-factory path adds `sanitizeJsIdentifier` + `uniquifyIdentifier` (`indicator-factory.ts:2750-2824`) — the fix from `5a0f07b` is **real and complete** (regex `/[^a-zA-Z0-9_$]/g → _`, reserved-word table, monotonic `_N` suffix). Two regression tests gate it.
- CLI: `writeOutput` → `writeFileSync(resolve(outputPath))` (`src/cli/utils.ts:122`). `outputPath` comes only from `-o` flag in the **same** invocation — not derivable from the input file content. No traversal risk because the attacker controls the flag, not the input source.

## 3. Dependencies — **WARN (dev-only)**

- Runtime: `dependencies: {}`, `peerDependencies: {}` — **zero**. Confirmed.
- devDeps (7): `@biomejs/biome ^2.4.13`, `@types/bun`, `@types/node`, `bun-types`, `typescript ^6.0.3`, `vite ^8.0.10`, `vite-plugin-dts ^4.5.4`. All maintained.
- `bun audit` (full tree): **3 advisories**, all transitive devDeps:
  - HIGH `fast-uri ≤3.1.1` (host confusion + path traversal) via `vite-plugin-dts → @microsoft/api-extractor → ajv → fast-uri`.
  - MOD `brace-expansion >=5.0.0 <5.0.6` via `vite-plugin-dts → @vue/language-core → minimatch`.
- `bun audit --prod`: **0 vulnerabilities**. Consumers are unaffected.
- Licenses (production-tree): only MIT/BSD/Apache/ISC ancestors; the two flagged non-permissive (`lightningcss` MPL-2.0, `minimatch` BlueOak-1.0.0) are devDeps only and are MIT-compatible to redistribute when not shipped.

## 4. CI/CD safety — **PASS (with one gap)**

`.github/workflows/ci.yml`:
- ❌ Actions **pinned to `@v4`/`@v2`**, not full commit SHAs — supply-chain hardening gap.
- ✅ No `pull_request_target`.
- ✅ No `${{ github.event.* }}` interpolation in `run:` blocks.
- ⚠️ No explicit `permissions:` block on jobs. GitHub repo-default workflow token is `read` (verified via API) so impact is bounded, but explicit `permissions: {contents: read}` per-job is best-practice.
- ✅ No secrets used in CI workflow.
- ❌ No publish workflow in `.github/workflows/` — `npm publish` is run manually (`bun run publish:npm`), which is why provenance attestation is absent. No OIDC publish.
- ❌ No `timeout-minutes`, no `concurrency` key.

## 5. npm publish hygiene — **WARN**

- Maintainers: `opusaether <infra@opusaether.com>`, `garou11 <adityasharma61376@gmail.com>` (2 humans).
- **No provenance attestation** on 0.4.1 or 0.4.2 (`dist.attestations` absent). Registry signature present (Sigstore Rekor not used).
- `.npmignore` correct: excludes `src/`, `tsconfig.json`, `*.test.ts`, `node_modules/`.
- `files` field is allowlist-style: `["dist","fixtures","README.md","LICENSE","DISCLAIMER.md"]`. `npm pack --dry-run` confirms 24-file tarball, no test/script leakage.
- `prepare: vite build` runs on `npm install` for git/tarball installs — standard, but means installing from git triggers a build. Acceptable.
- `prepublishOnly`: `typecheck && lint && test && build`. Clean.
- Dual-registry publish (`publish:gh` uses `--ignore-scripts` — defends GH Packages from prepublish replay). Good.

## 6. Static analysis tooling — **PASS**

- `tsconfig.json`: `strict: true`, `forceConsistentCasingInFileNames: true`. PASS.
- `biome.json` 2.3.8 schema, `recommended: true`, `noExplicitAny: error`, `noVar: error`, `noConsole: warn` (off for `src/cli/**`). `noEval` is **not explicitly set** but is part of Biome's `recommended` rule pack as `noGlobalEval`/`noImplicitCoercion` — confirmed not bypassed.
- Suppressions: **3 `biome-ignore` comments in all of `src/`**, all legitimate (Function-constructor codegen + 2 console.error sites in runtime catch). No `@ts-ignore` / `@ts-expect-error` / `eslint-disable`.

## 7. Secret scanning posture — **FAIL (config gap)**

- `gh api repos/Opus-Aether-AI/pine-transpiler` reports: `secret_scanning: disabled`, `secret_scanning_push_protection: disabled`, `secret_scanning_non_provider_patterns: disabled`, `secret_scanning_validity_checks: disabled`, `dependabot_security_updates: disabled`.
- `dependabot/vulnerability-alerts` endpoint returns 204 (enabled), but no `.github/dependabot.yml` config exists.
- No `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml` — no client-side secret-leak guard.
- (Manual scan already verified clean.)

## 8. Test surface for security-relevant paths — **PASS**

`tests/generator/security.test.ts` covers:
- Input size cap (1MB enforced, `MAX_INPUT_SIZE` in `pipeline.ts:25`).
- Recursion depth cap (`MAX_RECURSION_DEPTH`).
- Token count cap (`MAX_TOKEN_COUNT`).
- Unterminated string / block-comment lexer errors.
- **Dangerous identifier sanitization**: explicit tests for `__proto__`, `constructor`, `prototype`, `eval`, `Function`, plus for-loop & function-param contexts.
- `tests/regression/duplicate-input-title.test.ts` + `ict-killzones-standalone.test.ts` lock the `5a0f07b` uniquifier fix.

Gaps:
- No property-based / fuzz testing (`fast-check` not in devDeps).
- No explicit corpus of "Pine source crafted to inject JS via string interpolation" — but the JSON.stringify + sanitizeIdentifier discipline makes this lower priority.

---

## Top-3 prioritized actions

- **P0 — Enable GitHub secret-scanning + push-protection** on `Opus-Aether-AI/pine-transpiler` (free for public repos). Enforce **org-level 2FA** on `Opus-Aether-AI`. This is one-click and closes the largest open exposure.
- **P1 — Add npm provenance + automate publish**. Create `.github/workflows/release.yml` that uses `permissions: {id-token: write, contents: read}` and runs `npm publish --provenance --access public`. Pin the action to a commit SHA. Pin all existing `ci.yml` actions to SHAs (`actions/checkout@<sha>`, `oven-sh/setup-bun@<sha>`). Add `.github/dependabot.yml` (npm + actions, weekly).
- **P2 — Tighten dev-tree advisories + add fuzz harness**. Run `bun update vite-plugin-dts` (or move to `tsup`/`unbuild`) to dropthe `fast-uri` + `brace-expansion` chains. Add a `fast-check` property-test that generates random Pine identifiers (including unicode, reserved words, dangerous names) and asserts `transpileToStandaloneFactory` output parses as valid JS via `new Function`.

## Overall verdict — **PASS with documented WARNs**. Library code is well-disciplined (zero runtime deps, hardened identifier sanitizer with regression tests, strict TS + Biome, no dynamic eval beyond the explicit factory path). Supply-chain posture is the weak link: missing provenance, missing secret-scanning, unpinned actions, no org 2FA. None of these alter the runtime safety of v0.4.1 for consumers today, but each is a cheap, one-PR fix that materially raises the bar for downstream trust.
