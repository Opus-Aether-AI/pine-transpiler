import type { SyntheticBar } from './types';

/**
 * Deterministic synthetic bars with realistic timestamps and smooth-ish
 * movement. Keeps harness runs reproducible while exercising time/session
 * code paths.
 */
export function generateSyntheticBars(count: number): SyntheticBar[] {
  const bars: SyntheticBar[] = [];
  const startTime = Date.UTC(2024, 0, 2, 13, 30, 0); // ~09:30 America/New_York
  const oneMinuteMs = 60_000;
  let lastClose = 100;

  for (let i = 0; i < count; i++) {
    const trend = i * 0.03;
    const wave = Math.sin(i / 11) * 3.5 + Math.cos(i / 5) * 1.2;
    const noise =
      (((i * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff - 0.5) * 0.4;
    const open = lastClose;
    const close = 100 + trend + wave + noise;
    const spread = Math.max(
      0.15,
      Math.abs(close - open) * 0.65 + Math.abs(noise) * 0.5,
    );
    const high = Math.max(open, close) + spread;
    const low = Math.min(open, close) - spread;
    const volume = 1200 + Math.abs(wave) * 250 + (i % 20) * 7;

    bars.push({
      time: startTime + i * oneMinuteMs,
      open,
      high,
      low,
      close,
      volume,
    });

    lastClose = close;
  }

  return bars;
}
