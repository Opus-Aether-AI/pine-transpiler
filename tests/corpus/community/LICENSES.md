# Vendored Community Pine Script Licenses

This directory contains Pine Script files vendored from public GitHub repositories for use as transpiler test fixtures. **None of these files are shipped in the published npm tarball.** The `files` allowlist in [package.json](../../../package.json) only includes `dist`, `fixtures`, `README.md`, `LICENSE`, and `DISCLAIMER.md` — the entire `tests/` tree (including this directory) is excluded from `@opus-aether-ai/pine-transpiler` releases.

That said, we still want to be careful about which upstream sources we vendor, because the repository itself is public. This document tracks the upstream license posture for each subdirectory.

## Per-source verification

Confirmed via `gh api repos/<owner>/<repo>/license` and inline file headers, last checked 2026-05-22.

| Subdirectory | Upstream repo | Files | License | Status | Notes |
|---|---|---|---|---|---|
| `arunkbhaskar/` | [ArunKBhaskar/PineScript](https://github.com/ArunKBhaskar/PineScript) | 26 | **MPL-2.0** | ✅ Permits redistribution | Per-file headers carry the MPL-2.0 notice + `© Arun_K_Bhaskar` attribution as required by the license. |
| `everget/` | `everget/<public pine indicators repo>` (GitHub) | 8 | **GPL-3.0** | ✅ Permits redistribution (test-only) | GPL-3.0 is copyleft. Files are **test data**, not linked code — they're never compiled into the transpiler binary or shipped to npm consumers. Per-file headers carry `Copyright (c) 2019-present, Alex Orekhov (everget)` + the upstream license note. |
| `f13end/` | `f13end/<public custom indicators repo>` (GitHub) | 1 | **CC-BY-SA 4.0** (inline in file) | ✅ Permits redistribution | Repo has no top-level LICENSE; per-file header declares CC-BY-SA 4.0 with `© dman103`. |
| ~~`harryguiacorn/`~~ | ~~`harryguiacorn/<removed proprietary-named repo>` (GitHub)~~ | 0 | n/a | 🗑️ Removed | Previously contained 17 .pine files. Upstream had no LICENSE file and used a proprietary naming convention. Defensive removal on 2026-05-22. Scrape script no longer references this source ([scripts/corpus/scrape.ts](../../../scripts/corpus/scrape.ts)). |
| `top100/` | (none — synthetic) | 42 | n/a | ✅ Our own work | See [top100/README.md](top100/README.md). All fixtures are synthetic proxies written specifically as transpiler test inputs. |
| `top200/` | (none — synthetic) | 100 | n/a | ✅ Our own work | See [top200/README.md](top200/README.md). All fixtures are synthetic stress-test inputs written specifically for transpiler coverage. |
| `forex_xau/` | (none — synthetic) | varies | n/a | ✅ Our own work | Synthetic, hand-written forex/XAU pattern fixtures. |

## Why we keep this doc

If the project ever needs to defend its OSS posture — e.g. during a legal review of the public GitHub repo — this document is the single source of truth for what was vendored, from where, and under what license. New contributors adding fixtures should update this file in the same PR.
