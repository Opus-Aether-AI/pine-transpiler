---
name: Transpilation failure
about: A Pine Script that should transpile cleanly does not, or produces wrong output
title: "[transpile] "
labels: transpilation-bug
---

## Pine Script source

```pinescript
// Paste a minimal Pine v5/v6 script that reproduces the issue.
// Strip everything not needed to demonstrate the failure.
```

## What you expected

Either:
- the resulting `IndicatorFactory` should execute without error, OR
- a specific generated JS shape (paste it).

## What actually happened

- Error message (if `transpileToPineJS` returned `success: false`):
- Or: factory loaded but produced wrong output for these inputs:

## Environment

- `@opus-aether-ai/pine-transpiler` version:
- Node / Bun version:
- Is the script in `tests/corpus/community/`? If so, which file?

## Notes

- Have you checked [docs/LIMITATIONS.md](../../docs/LIMITATIONS.md)? Unsupported features (`request.security`, `alert`, drawing primitives, strategies, maps, matrices) are known gaps, not bugs.
