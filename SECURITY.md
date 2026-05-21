# Security Policy

## Supported Versions

`pine-transpiler` is pre-1.0 and ships from a single supported line. Security
fixes land in the latest published version on the `main` branch.

| Version  | Supported |
|----------|-----------|
| latest (0.4.x) | ✅ |
| < 0.4.0  | ❌ — please upgrade |

We do not backport security fixes to older minor lines. Bumping to the latest
release is the supported path.

## Reporting a Vulnerability

**Do not open a public GitHub Issue for security vulnerabilities.**

Please use GitHub's [private vulnerability reporting][gh-private]:

1. Go to https://github.com/Opus-Aether-AI/pine-transpiler/security/advisories
2. Click **Report a vulnerability**
3. Fill in the form; the maintainers receive it privately

[gh-private]: https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability

GitHub's private vulnerability reporting is the **only** intake channel.
If you cannot access the form (account restrictions, network issues, etc.),
open a public GitHub Issue titled `Security: request for private contact`
with no further detail, and a maintainer will reach out via GitHub DM to
collect the report privately.

## What to include

When reporting, please include:

- **Affected version(s)** — e.g. `0.4.3` and earlier
- **Vulnerability class** — e.g. unsafe `eval`, prototype pollution, path
  traversal in the CLI, denial-of-service via crafted Pine source
- **Reproduction** — minimal Pine source or repro steps + expected vs actual
  behavior
- **Impact** — what an attacker can do (RCE? DoS? File write outside the
  intended output dir?)
- **Suggested fix** if you have one

## Response expectations

- **Acknowledgement:** within 7 days
- **Triage + severity rating** (using CVSS 3.1): within 14 days
- **Fix + coordinated disclosure window:** 30–90 days depending on severity
- **Public advisory + CVE** (where applicable): published once the fix is
  released and a reasonable patch-adoption window has passed

## Scope

In scope:

- `@opus-aether-ai/pine-transpiler` package (CLI + library) — both `dist/` and
  the source it's built from
- The generated JavaScript / `CustomIndicator` factory output, when it can be
  triggered by user-supplied Pine Script

Out of scope:

- Vulnerabilities in **TradingView's `charting_library`** or `PineJS` runtime
  itself — please report those to TradingView
- Vulnerabilities in third-party Pine Script source files you transpile (the
  output is only as trustworthy as the input)
- Issues that require physical access or social engineering

## Defensive posture

The library is **zero-runtime-dependency** by design — the only attack surface
is the transpiler's own code. The generator emits identifiers through a
`sanitizeIdentifier` allowlist (blocks `__proto__`, `constructor`, `prototype`,
`eval`, `Function`, reserved words) and all user-controlled string literals are
passed through `JSON.stringify` before interpolation. We use `new Function(...)`
in two places, both with sanitized + uniquified inputs:

- `executePineJS()` in `src/index.ts` — runs only the already-emitted JS
  produced by the transpiler
- the compile step inside `buildIndicatorFactory()` in
  `src/factory/indicator-factory.ts` — invoked once during factory init

Regression tests cover both paths.

We welcome reports that go deeper than this surface.
