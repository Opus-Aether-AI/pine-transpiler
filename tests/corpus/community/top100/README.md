# top100 — synthetic proxy fixtures

Every `.pine` file in this directory is a **synthetic proxy** — short hand-written Pine Script written specifically as a transpiler test fixture. **None of the files are copies of, derived from, or based on any author-published Chart Host script.**

The filenames and `indicator()` titles use generic technique names (e.g. "Smart Money Concepts", "Order Block Detector", "WaveTrend Oscillator") because those describe the technical analysis concept under test. No reference to any specific community author, brand handle, or paywalled script is intended.

## Why proxies?

Real-world community Pine scripts vary widely in size and complexity. A small set of compact, deliberately-crafted fixtures lets us:

- Exercise specific language features (drawing primitives, multi-output funcs, `request.security`, maps, matrices, named args, etc.) in isolation
- Keep the test corpus self-contained and license-clean
- Avoid any redistribution of third-party code

## Manifest status

These fixtures are classified in [tests/corpus/manifest.ts](../../manifest.ts) as:

- `lane: quarantine`
- `authenticity: proxy`

They participate in the corpus regression suite (`bun run corpus`) but are not snapshot-tested for numeric equivalence to any specific upstream script — by definition there is no upstream to match against.

## Adding fixtures

When adding a new fixture here:

1. Write a short, technique-focused Pine script that exercises whatever the test target is.
2. Use a generic technical name (no author handles in the filename or `indicator()` title).
3. Keep the existing proxy header comment:
   ```pine
   //@version=5
   // Synthetic proxy fixture — not a copy of any author-published script.
   indicator("Your Technique Name", overlay=true)
   ```
4. If the new fixture should be tracked in [docs/TOP100_MATRIX.md](../../../../docs/TOP100_MATRIX.md), add an entry to [scripts/corpus/top100-matrix.ts](../../../../scripts/corpus/top100-matrix.ts) and regenerate the doc with `bun run corpus:top100`.
