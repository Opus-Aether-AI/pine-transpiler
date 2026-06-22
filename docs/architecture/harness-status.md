# Visual Harness Status

Curated visual harness baseline update on 2026-06-23:

- Green: 38 / 43 curated fixtures. Generated baselines live in `tests/visual-harness/baselines/`.
- Red fixtures do not have committed baselines.

Red fixtures:

- `curated/06-macd-multioutput.pine`: parity mismatch. `Std.plot` histogram event carries linewidth `5` on the PineJS path and `undefined` on the standalone path.
- `curated/09-stoch-destructure.pine`: harness runtime error at bar `0`. The fixture destructures `Std.stoch(...)`, but the harness runtime returns a non-iterable scalar (`number is not iterable`).
- `curated/10-supertrend-destructure.pine`: harness runtime error at bar `0`. The fixture destructures `Std.supertrend(...)`, but the harness runtime returns a non-iterable scalar (`number is not iterable`).
- `curated/26-pivot-points.pine`: parity mismatch. `Std.plot` pivot events carry linewidth `3` on the PineJS path and `undefined` on the standalone path.
- `curated/34-volume-ma.pine`: parity mismatch. `Std.plot` volume event carries linewidth `5` on the PineJS path and `undefined` on the standalone path.
