#!/usr/bin/env bun
/**
 * Indicator matrix generator for a fixed set of 67 requested indicators.
 *
 * Produces `INDICATOR_TEST_MATRIX.md` with:
 * - PASS / FAIL / NOT_FOUND summary
 * - per-group coverage breakdown
 * - curated vs community split
 * - per-indicator stage + error details
 *
 * Run:
 *   bun scripts/corpus/indicator-matrix.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import { runFixture } from '../../tests/corpus/runner';

type MatrixStatus = 'PASS' | 'FAIL' | 'NOT_FOUND';

interface MatrixTarget {
  indicator: string;
  fixture: string; // "<group>/<name>.pine"
}

interface MatrixRow extends MatrixTarget {
  status: MatrixStatus;
  stage: string;
  error: string;
}

const TARGETS: MatrixTarget[] = [
  { indicator: 'Trivial Plot', fixture: 'curated/01-trivial-plot.pine' },
  { indicator: 'SMA Basic', fixture: 'curated/02-sma-basic.pine' },
  { indicator: 'EMA Basic', fixture: 'curated/03-ema-basic.pine' },
  {
    indicator: 'Keltner Channel (Destructure)',
    fixture: 'curated/08-keltner-destructure.pine',
  },
  {
    indicator: 'Stochastic (Destructure)',
    fixture: 'curated/09-stoch-destructure.pine',
  },
  { indicator: 'Pivot Points', fixture: 'curated/26-pivot-points.pine' },
  { indicator: 'OBV', fixture: 'curated/28-obv.pine' },
  { indicator: 'ATR Bands', fixture: 'curated/29-atr-bands.pine' },
  { indicator: 'CCI', fixture: 'curated/30-cci.pine' },
  { indicator: 'MFI', fixture: 'curated/31-mfi.pine' },
  { indicator: 'Williams %R', fixture: 'curated/32-wpr.pine' },
  { indicator: 'Momentum ROC', fixture: 'curated/33-momentum-roc.pine' },
  { indicator: 'Volume MA', fixture: 'curated/34-volume-ma.pine' },
  { indicator: 'Source Input', fixture: 'curated/35-source-input.pine' },
  { indicator: 'Color Input', fixture: 'curated/36-color-input.pine' },
  { indicator: 'Chandelier Exit', fixture: 'everget/chandelier_exit.pine' },
  { indicator: 'HalfTrend', fixture: 'everget/halftrend.pine' },
  {
    indicator: 'NRTR Nick Rypock Trailing Reverse',
    fixture: 'everget/nrtr_nick_rypock_trailing_reverse.pine',
  },
  { indicator: 'Parabolic SAR', fixture: 'everget/parabolic_sar.pine' },
  { indicator: 'Supertrend (Everget)', fixture: 'everget/supertrend.pine' },
  {
    indicator: 'Ticker Performance by US President',
    fixture: 'everget/ticker_performance_by_us_president.pine',
  },
  {
    indicator: 'Unit Testing Framework',
    fixture: 'everget/unit_testing_framework.pine',
  },
  { indicator: 'Volume Accumulation', fixture: 'everget/volume_accumulation.pine' },
  { indicator: 'Range Volume Change', fixture: 'f13end/range_volume_change.pine' },
  { indicator: 'ADX Hist', fixture: 'harryguiacorn/adx-hist.pine' },
  { indicator: 'BBForce', fixture: 'harryguiacorn/bbforce.pine' },
  {
    indicator: 'BodyMassIndicator',
    fixture: 'harryguiacorn/bodymassindicator.pine',
  },
  {
    indicator: 'Candlestick Engulfing',
    fixture: 'harryguiacorn/candlestickengulfing.pine',
  },
  {
    indicator: 'Candlestick Inside Bar',
    fixture: 'harryguiacorn/candlestickinsidebar.pine',
  },
  {
    indicator: 'Candlestick Kicker',
    fixture: 'harryguiacorn/candlestickkicker.pine',
  },
  {
    indicator: 'Candlestick Patterns',
    fixture: 'harryguiacorn/candlestickpatterns.pine',
  },
  {
    indicator: 'Candlestick Patterns HOLP-LOHP',
    fixture: 'harryguiacorn/candlestickpatterns-holp-lohp.pine',
  },
  { indicator: 'Cloud', fixture: 'harryguiacorn/cloud.pine' },
  { indicator: 'Flip Flop', fixture: 'harryguiacorn/flip_flop.pine' },
  { indicator: 'MACD-V', fixture: 'harryguiacorn/macd-v.pine' },
  { indicator: 'STRG BBForce', fixture: 'harryguiacorn/strg-bbforce.pine' },
  { indicator: 'STRG HOLP', fixture: 'harryguiacorn/strg-holp.pine' },
  {
    indicator: 'STRG KijunArrow',
    fixture: 'harryguiacorn/strg-kijunarrow.pine',
  },
  {
    indicator: 'STRG One Bar Pursuit',
    fixture: 'harryguiacorn/strg_one_bar_pursuit.pine',
  },
  { indicator: 'Swoosh Indicator', fixture: 'harryguiacorn/swoosh_indicator.pine' },
  { indicator: 'WickPowerShift', fixture: 'harryguiacorn/wickpowershift.pine' },
  {
    indicator: 'ICT Equal Highs and Lows Indicator',
    fixture: 'arunkbhaskar/ict_equal_highs_and_lows_indicator.pine',
  },
  {
    indicator: 'ICT Equal Highs and Lows with Screener',
    fixture: 'arunkbhaskar/ict_equal_highs_and_lows_with_screener.pine',
  },
  {
    indicator: 'ICT External and Internal Range Liquidity Multi-Timeframe',
    fixture:
      'arunkbhaskar/ict_external_and_internal_range_liquidity_multi-timeframe.pine',
  },
  {
    indicator:
      'ICT External Range Liquidity Static Multi-Timeframe Swing High and Low',
    fixture:
      'arunkbhaskar/ict_external_range_liquidity_static_multi-timeframe_swing_high_and_low.pine',
  },
  {
    indicator: 'ICT Liquidity Void Multi-Timeframe',
    fixture: 'arunkbhaskar/ict_liquidity_void_multi-timeframe.pine',
  },
  {
    indicator: 'ICT Liquidity Void Screener',
    fixture: 'arunkbhaskar/ict_liquidity_void_screener.pine',
  },
  {
    indicator: 'ICT Market Structure Shift (MSS)',
    fixture: 'arunkbhaskar/ict_market_structure_shift_mss.pine',
  },
  {
    indicator: 'ICT Market Structure Shift (MSS) Screener',
    fixture: 'arunkbhaskar/ict_market_structure_shift_mss_screener.pine',
  },
  {
    indicator: 'Indicator Trend Following Setup Sideways Market Skipper',
    fixture:
      'arunkbhaskar/indicator_-_trend_following_setup_-_sideways_market_skipper.pine',
  },
  {
    indicator: 'Indicator ICT Displacement Candles',
    fixture: 'arunkbhaskar/indicator_ict_displacement_candles.pine',
  },
  {
    indicator: 'Indicator ICT Liquidity Void Fill',
    fixture: 'arunkbhaskar/indicator_ict_liquidity_void_fill.pine',
  },
  {
    indicator: 'Indicator Magnetic Zones Multi Timeframe',
    fixture: 'arunkbhaskar/indicator_magnetic_zones_-_multi_timeframe.pine',
  },
  {
    indicator: 'Indicator Momentum Setup RSI Directional Momentum',
    fixture: 'arunkbhaskar/indicator_momentum_setup_-_rsi_directional_momentum.pine',
  },
  {
    indicator: 'Momentum Setup Ankush Bajaj Momentum Investing Setup',
    fixture:
      'arunkbhaskar/momentum_setup_-_ankush_bajaj_momentum_investing_setup.pine',
  },
  {
    indicator: 'Momentum Setup Ankush Bajaj Momentum Investing Setup with Scanner',
    fixture:
      'arunkbhaskar/momentum_setup_-_ankush_bajaj_momentum_investing_setup_with_scanner.pine',
  },
  {
    indicator: 'Momentum Setup Vijay Thakare Option Buying Scalping Setup',
    fixture:
      'arunkbhaskar/momentum_setup_-_vijay_thakare_option_buying_scalping_setup.pine',
  },
  {
    indicator: 'Momentum Setup Vijay Thakare Option Buying Scalping Setup with Scanner',
    fixture:
      'arunkbhaskar/momentum_setup_-_vijay_thakare_option_buying_scalping_setup_with_scanner.pine',
  },
  {
    indicator: 'Scanner ICT Fair Value Gap (FVG)',
    fixture: 'arunkbhaskar/scanner_-_ict_fair_value_gap_fvg_scanner.pine',
  },
  {
    indicator: 'Scanner ICT Liquidity Sweep Pattern',
    fixture: 'arunkbhaskar/scanner_-_ict_liquidity_sweep_pattern_scanner.pine',
  },
  {
    indicator: 'Scanner Trend Following Setup Sideways Market Skipper',
    fixture:
      'arunkbhaskar/scanner_-_trend_following_setup_-_sideways_market_skipper_scanner.pine',
  },
  {
    indicator: 'Scanner ICT Displacement Candles',
    fixture: 'arunkbhaskar/scanner_ict_displacement_candles.pine',
  },
  {
    indicator: 'Scanner ICT Liquidity Void Fill',
    fixture: 'arunkbhaskar/scanner_ict_liquidity_void_fill_scanner.pine',
  },
  {
    indicator: 'Scanner ICT Mitigation Block',
    fixture: 'arunkbhaskar/scanner_ict_mitigation_block_scanner.pine',
  },
  {
    indicator: 'Scanner Momentum Setup RSI Directional Momentum',
    fixture: 'arunkbhaskar/scanner_momentum_setup_-_rsi_directional_momentum.pine',
  },
  {
    indicator: 'Screener ICT Retracement to Order Block',
    fixture:
      'arunkbhaskar/screener_ict_retracement_to_order_block_with_screener.pine',
  },
  {
    indicator: 'Screener Market Profile (Ricardosanto-based)',
    fixture:
      'arunkbhaskar/screener_market_profile_with_screener_based_on_rs_market_profile_by_ricardosanto.pine',
  },
];

function pct(pass: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((pass / total) * 100)}%`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

function render(rows: MatrixRow[]): string {
  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const notFound = rows.filter((r) => r.status === 'NOT_FOUND').length;

  const lines: string[] = [];
  lines.push('# Indicator Test Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Summary: PASS ${pass} / FAIL ${fail} / NOT_FOUND ${notFound}`);
  lines.push('');

  const groupBuckets = new Map<string, { pass: number; total: number }>();
  for (const row of rows) {
    const group = row.fixture.split('/')[0] ?? 'unknown';
    const bucket = groupBuckets.get(group) ?? { pass: 0, total: 0 };
    bucket.total += 1;
    if (row.status === 'PASS') bucket.pass += 1;
    groupBuckets.set(group, bucket);
  }

  const groupOrder = ['curated', 'everget', 'f13end', 'harryguiacorn', 'arunkbhaskar'];
  lines.push(`## Grouped Coverage (Requested ${rows.length})`);
  lines.push('');
  lines.push('| Group | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const group of groupOrder) {
    const b = groupBuckets.get(group);
    if (!b) continue;
    lines.push(`| ${group} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  for (const [group, b] of Array.from(groupBuckets.entries()).sort()) {
    if (groupOrder.includes(group)) continue;
    lines.push(`| ${group} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  lines.push('');

  const core = rows.filter((r) => r.fixture.startsWith('curated/'));
  const community = rows.filter((r) => !r.fixture.startsWith('curated/'));
  const corePass = core.filter((r) => r.status === 'PASS').length;
  const communityPass = community.filter((r) => r.status === 'PASS').length;

  lines.push('## Core vs Community Split');
  lines.push('');
  lines.push('| Scope | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  lines.push(
    `| curated core indicators | ${corePass} | ${core.length} | ${pct(corePass, core.length)} |`,
  );
  lines.push(
    `| community indicators | ${communityPass} | ${community.length} | ${pct(communityPass, community.length)} |`,
  );
  lines.push('');

  lines.push('| # | Indicator | Fixture | Status | Stage | Error |');
  lines.push('|---:|---|---|---|---|---|');
  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${escapeCell(row.indicator)} | ${escapeCell(row.fixture)} | ${row.status} | ${escapeCell(row.stage)} | ${escapeCell(row.error)} |`,
    );
  });

  return lines.join('\n');
}

function main(): number {
  const discovered = new Map(
    listAllFixtures().map((fx) => [`${fx.group}/${fx.name}`, fx.path] as const),
  );

  const rows: MatrixRow[] = TARGETS.map((target) => {
    const fixturePath = discovered.get(target.fixture);
    if (!fixturePath) {
      return {
        ...target,
        status: 'NOT_FOUND',
        stage: 'missing',
        error: 'fixture not found',
      };
    }

    const source = readFileSync(fixturePath, 'utf8');
    const result = runFixture(source, { fixtureName: target.fixture });
    return {
      ...target,
      status: result.pass ? 'PASS' : 'FAIL',
      stage: result.stageReached,
      error: result.error ?? '',
    };
  });

  const md = render(rows);
  const outputPath = join(import.meta.dir, '..', '..', 'INDICATOR_TEST_MATRIX.md');
  writeFileSync(outputPath, `${md}\n`);

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const notFound = rows.filter((r) => r.status === 'NOT_FOUND').length;
  console.log(
    `Indicator matrix written: ${outputPath} (PASS ${pass} / FAIL ${fail} / NOT_FOUND ${notFound})`,
  );

  return fail === 0 && notFound === 0 ? 0 : 1;
}

process.exit(main());
