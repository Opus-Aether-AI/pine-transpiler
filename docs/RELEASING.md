# Releasing

Releases are fully automated via two GitHub Actions workflows + npm Trusted
Publishers. Maintainers don't run `npm publish` by hand on the happy path.

## TL;DR

1. Land work on `main` using [Conventional Commits](https://www.conventionalcommits.org/).
2. `release-please` opens a **Release PR** with version bump + CHANGELOG entry.
3. Merge the Release PR. A tag + GitHub Release are created automatically.
4. The tag push triggers the `release` workflow, which publishes to npm
   (with provenance) and GitHub Packages.

## Conventional Commits → version bump

| Commit prefix | CHANGELOG section | Version bump (pre-1.0) |
|---|---|---|
| `feat:`     | Added         | patch (0.4.4 → 0.4.5) |
| `fix:`      | Fixed         | patch |
| `perf:`     | Performance   | patch |
| `refactor:` | Changed       | patch |
| `docs:`     | Documentation | patch |
| `revert:`   | Reverts       | patch |
| `feat!:` / `BREAKING CHANGE:` footer | (in current section) | minor (0.4.4 → 0.5.0) |
| `chore:`, `style:`, `test:`, `ci:`, `build:` | _hidden_ | no release |

> Pre-1.0 we use the `bump-minor-pre-major: true` + `bump-patch-for-minor-pre-major: true`
> release-please flags, so breaking changes bump the **minor** (not major) and
> feat-only releases stay on **patch**. This will change to standard semver
> when we hit 1.0.

## Workflow files

| File | Trigger | Job |
|---|---|---|
| `.github/workflows/release-please.yml` | push to `main` | open/update Release PR + create tag + Release on merge |
| `.github/workflows/release.yml` | tag matching `v*.*.*` (or `workflow_dispatch`) | build / test / publish to npm + GH Packages |
| `.github/release-please-config.json` | — | release-please configuration |
| `.github/.release-please-manifest.json` | — | last-released version tracker (must be committed) |

## One-time setup

### 1. Configure the npm Trusted Publisher

This unlocks OIDC-based publishing — no long-lived `NPM_TOKEN` secret is needed.

1. Sign in at https://www.npmjs.com/
2. Open the package: https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler/access
3. Scroll to **Trusted Publishers** → **Add Trusted Publisher**
4. Set:
   - **Publisher:** GitHub Actions
   - **Organization or user:** `Opus-Aether-AI`
   - **Repository:** `pine-transpiler`
   - **Workflow filename:** `release.yml`
   - **Environment name:** `release`
5. Save

Until this is configured, the `Publish to npm with provenance` step will fail
with `403 Forbidden`. As a stop-gap, the legacy local-publish path still works:

```bash
git checkout v<version>
bun run release   # local publish to npm + GitHub Packages
```

### 2. Configure the `release` GitHub Environment (recommended)

The release workflow targets `environment: release`. Adding a manual-approval
gate gives you a "are you sure?" step before any publish:

1. Repo **Settings → Environments → New environment** named `release`
2. **Required reviewers:** add yourself
3. **Deployment branches and tags:** restrict to `main` + tags matching `v*.*.*`

This is optional but recommended: it means even if a malicious or buggy commit
landed on `main`, a human still has to click "Approve" before the publish runs.

## Day-to-day flow

```text
                ┌──────────────────────────────────────────┐
                │ Push commits to main (Conventional       │
                │ Commits, e.g. fix(parser): handle ...).  │
                └──────────────────────┬───────────────────┘
                                       │
                                       ▼
                ┌──────────────────────────────────────────┐
                │ release-please bot opens or updates a    │
                │ "release: pine-transpiler X.Y.Z" PR with:│
                │   • package.json bumped to X.Y.Z         │
                │   • CHANGELOG.md entry for X.Y.Z         │
                │   • .release-please-manifest.json bumped │
                └──────────────────────┬───────────────────┘
                                       │   maintainer review
                                       ▼
                ┌──────────────────────────────────────────┐
                │ Merge the Release PR.                    │
                │ release-please then:                     │
                │   • creates a vX.Y.Z annotated tag       │
                │   • creates a GitHub Release with notes  │
                └──────────────────────┬───────────────────┘
                                       │   tag push
                                       ▼
                ┌──────────────────────────────────────────┐
                │ release.yml workflow:                    │
                │   1. checkout @ tag                       │
                │   2. typecheck / lint / test / corpus     │
                │   3. verify tag == package.json version   │
                │   4. build                                │
                │   5. npm publish --provenance (OIDC)      │
                │   6. npm publish to GitHub Packages       │
                └──────────────────────────────────────────┘
```

## Manual emergency publish

If something breaks the automated path and you need to ship urgently:

```bash
# 1. Pull the tag locally
git fetch --tags origin
git checkout v0.5.0

# 2. Build + publish from your machine (uses npm credentials from ~/.npmrc)
bun run release
```

`package.json` retains the legacy `publish:npm` / `publish:gh` / `release` scripts
specifically so this fallback always works.

## Re-publishing a previously released tag

Use `workflow_dispatch`:

1. Repo **Actions → release → Run workflow**
2. Enter the tag (e.g. `v0.5.0`) as the `ref` input
3. Run

This re-runs the full publish pipeline against that tag. Useful if npm
rejected the original publish (e.g. transient infra issue, Trusted Publisher
config missing on first attempt).

## What automation does NOT do (yet)

- Pin GitHub Actions to commit SHAs in `ci.yml` (the new workflows in this PR
  are already pinned; `ci.yml` still uses `@v4`). Tracked as audit P1.
- Sign commits / verify tag signatures.
- Auto-merge the Release PR. Currently the maintainer must merge it manually
  — by design, since release content is the place to catch a "this shouldn't
  ship" change.
