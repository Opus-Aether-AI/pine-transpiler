# top200 — synthetic stress-test fixtures

Every `.pine` file in this directory is a **synthetic fixture** — short hand-written Pine Script generated as a coverage stress test for the transpiler. **None of the files are copies of, derived from, or based on any author-published Chart Host script.**

The naming pattern `custom_NNN_<technique>.pine` and `popular_NNN_<technique>.pine` is purely sequential numbering for batch coverage — no reference to any specific community author, brand handle, or third-party script is intended. The repetition of technique names across numbered slots (e.g. `popular_001_ema_ribbon_pro.pine` ... `popular_071_ema_ribbon_pro.pine`) is intentional: it stresses the transpiler against many variations of the same technical pattern.

## Why proxies?

A broad synthetic corpus lets us:

- Exercise the parser/generator across many small Pine scripts with varied features (drawing primitives, multi-output funcs, `request.security`, maps, matrices, named args, etc.)
- Keep the test corpus self-contained and license-clean
- Avoid any redistribution of third-party code

## Manifest status

These fixtures are classified in [tests/corpus/manifest.ts](../../manifest.ts) as:

- `lane: synthetic_custom`
- `authenticity: synthetic`

They participate in the corpus regression suite (`bun run corpus`) but are not snapshot-tested for numeric equivalence to any specific upstream script — by definition there is no upstream to match against.

## Adding fixtures

When adding a new fixture here:

1. Use a sequential filename: `popular_NNN_<technique>.pine` or `custom_NNN_<technique>.pine`.
2. Use a generic technical name in the `indicator()` title (no author handles).
3. Keep the existing proxy header comment:
   ```pine
   //@version=5
   // Synthetic proxy fixture — not a copy of any author-published script.
   indicator("Popular NNN Technique Name", overlay=true)
   ```
4. The matrix doc [docs/TOP200_MATRIX.md](../../../../docs/TOP200_MATRIX.md) is regenerated with `bun run corpus:top200`.
