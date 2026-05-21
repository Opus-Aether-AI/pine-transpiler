# Disclaimer & Safe-Harbor Framework

This document states the legal posture of the `@opus-aether-ai/pine-transpiler` project. It exists so consumers, contributors, and any reviewing party can read the project's intent in one place.

## Independence

This project is an independent, open-source developer interoperability tool. **It is not affiliated with, endorsed by, sponsored by, or associated with TradingView Inc.**

"TradingView" and "Pine Script" are trademarks of TradingView Inc., used here solely under nominative fair use to identify the language and API surface this tool targets. No claim of ownership over those marks is made or implied.

## What this tool does

This tool is a transpiler. It accepts user-supplied Pine Script v5/v6 source code as input and emits JavaScript objects that conform to the **publicly documented** PineJS Custom Indicators API of the TradingView Charting Library.

The transpiler is:

- A **functional tool**, comparable to compilers, build systems, and language-interop bridges that exist for every major programming ecosystem.
- A **clean-room implementation** built solely from public Pine Script language reference and public Charting Library documentation. No proprietary TradingView source code, binaries, or assets are bundled with, redistributed by, or otherwise included in this project.
- Intended for developers who hold a **valid license for the TradingView Charting Library** and wish to run their own Pine Script source through their own deployments — analogous to using a TypeScript-to-JavaScript transpiler with a JS runtime you license separately.

## What this tool explicitly does not do

The project does not, and will not, include any of the following:

- **No scraping of TradingView properties.** The tool does not retrieve scripts from `tradingview.com/scripts`, `pine.tradingview.com`, or any other TradingView-hosted service. No code in this repository issues network requests to TradingView domains.
- **No bypass of script protections.** The tool does not attempt to decrypt, decode, or otherwise access Pine Script that is marked Protected, Invite-Only, or otherwise locked by its author. The transpiler accepts plaintext `.pine` source only.
- **No circumvention of technological measures.** The tool does not implement, document, or facilitate circumvention of access controls within the meaning of 17 U.S.C. § 1201 (DMCA anti-circumvention) or equivalent statutes in other jurisdictions.
- **No de-compilation or reverse-engineering of TradingView products.** The vocabulary throughout the project — "transpiler," "compiler," "AST," "generator," "interoperability bridge" — reflects this scope. Terms such as "decompiler," "cracker," or "unlocker" do not apply and are not used.

## User responsibility

You — the developer or end-user invoking this tool — are solely responsible for ensuring that:

- The Pine Script source code you supply as input is source you legally possess (e.g. scripts you authored yourself, scripts shared with you under an open-source license, or scripts whose author has authorized your use).
- Your use of the generated JavaScript output, and any chart it is embedded in, complies with your TradingView Terms of Service and your TradingView Charting Library license agreement.
- You are not using this tool to commercially redistribute, paywall, or otherwise extract value from another author's Pine Script without their authorization.

This project provides no warranty as to the legality of any specific use case. When in doubt, consult counsel.

## Legal basis

The functional-tool framing is supported by long-standing US case law on software interoperability, most directly:

- **Google LLC v. Oracle America, Inc.** (US Supreme Court, 2021) — re-implementing or calling functional APIs for purposes of interoperability is fair use.
- The "library precedent" exemplified by projects like Wine (Windows API on Linux), unofficial SDKs that wrap proprietary services, and decades of compiler / transpiler open-source work that target third-party language specifications.

Equivalent doctrines exist in EU (`Article 6, Software Directive 2009/24/EC`) and UK copyright law. We do not opine on every jurisdiction.

## Reporting concerns

If you are a rights-holder who believes this project, in its current form, infringes on rights you hold, please open an issue at https://github.com/Opus-Aether-AI/pine-transpiler/issues or contact the maintainers privately. We will respond promptly and in good faith.

## Project license

The transpiler is released under the **MIT License**. See [LICENSE](LICENSE) for the full text. This license applies only to the transpiler's own source code, not to:

- Pine Script source files you supply as input (those remain governed by their respective authors' licenses)
- The TradingView Charting Library, its PineJS runtime, or any proprietary TradingView code (those remain governed by your TradingView license agreements)
- Vendored fixture files in `tests/corpus/community/`, each of which carries an attribution header pointing at the upstream public GitHub repository and retains the upstream repo's license
