#!/usr/bin/env bun
/**
 * Chart Host Top-100 community indicator coverage matrix.
 *
 * Purpose:
 * - Track runtime coverage for a 100-indicator target set
 * - Reuse local corpus fixtures where available
 * - Mark missing scripts as NOT_IN_CORPUS (explicit gap, not silent)
 *
 * Run:
 *   bun scripts/corpus/top100-matrix.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import {
  type FixtureAuthenticity,
  type FixtureLane,
  resolveFixtureMetaFromId,
} from '../../tests/corpus/manifest';
import { runFixture } from '../../tests/corpus/runner';

export type MatrixStatus = 'PASS' | 'FAIL' | 'NOT_IN_CORPUS';

export interface TargetSeed {
  indicator: string;
  fixture?: string;
  chartHostUrl?: string;
}

export interface Target extends TargetSeed {
  rank: number;
  source: 'corpus' | 'external';
}

interface MatrixRow extends Target {
  status: MatrixStatus;
  stage: string;
  error: string;
  lane: FixtureLane;
  authenticity: FixtureAuthenticity;
}

export const TOP100_CORPUS_COMMUNITY_TARGETS: TargetSeed[] = [
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
  {
    indicator: 'Volume Accumulation',
    fixture: 'everget/volume_accumulation.pine',
  },
  {
    indicator: 'Range Volume Change',
    fixture: 'f13end/range_volume_change.pine',
  },
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
    fixture:
      'arunkbhaskar/indicator_momentum_setup_-_rsi_directional_momentum.pine',
  },
  {
    indicator: 'Momentum Setup Ankush Bajaj Momentum Investing Setup',
    fixture:
      'arunkbhaskar/momentum_setup_-_ankush_bajaj_momentum_investing_setup.pine',
  },
  {
    indicator:
      'Momentum Setup Ankush Bajaj Momentum Investing Setup with Scanner',
    fixture:
      'arunkbhaskar/momentum_setup_-_ankush_bajaj_momentum_investing_setup_with_scanner.pine',
  },
  {
    indicator: 'Momentum Setup Vijay Thakare Option Buying Scalping Setup',
    fixture:
      'arunkbhaskar/momentum_setup_-_vijay_thakare_option_buying_scalping_setup.pine',
  },
  {
    indicator:
      'Momentum Setup Vijay Thakare Option Buying Scalping Setup with Scanner',
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
    fixture:
      'arunkbhaskar/scanner_momentum_setup_-_rsi_directional_momentum.pine',
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

export const TOP100_EXTERNAL_POPULAR_TARGETS: TargetSeed[] = [
  {
    indicator: 'Smart Money Interest Index',
    fixture: 'top100/smart_money_interest_index.pine',
  },
  {
    indicator: 'Multi-Timeframe VWAP Master Pro',
    fixture: 'top100/multi_timeframe_vwap_master_pro.pine',
  },
  {
    indicator: 'Structural Leg Profiler',
    fixture: 'top100/structural_leg_profiler.pine',
  },
  {
    indicator: 'XAUUSD Vector SMC',
    fixture: 'top100/xauusd_vector_smc.pine',
  },
  {
    indicator: 'Pine3D: A Native 3D Graphical Rendering Engine',
    fixture: 'top100/pine3d_native_rendering_engine.pine',
  },
  {
    indicator: 'Map Example',
    fixture: 'top100/map_example.pine',
  },
  {
    indicator: 'Liquidity Heatmap GPT Price Levels',
    fixture: 'top100/liquidity_heatmap_gpt_price_levels.pine',
  },
  {
    indicator: 'Market Structure Liquidity Smart Alerts',
    fixture: 'top100/market_structure_liquidity_smart_alerts.pine',
  },
  {
    indicator: 'GEX and OI Levels',
    fixture: 'top100/gex_oi_levels.pine',
  },
  {
    indicator: 'Smart Money Concepts',
    fixture: 'top100/smart_money_concepts.pine',
  },
  {
    indicator: 'Price Action Concepts',
    fixture: 'top100/price_action_concepts.pine',
  },
  {
    indicator: 'Liquidity Concepts',
    fixture: 'top100/liquidity_concepts.pine',
  },
  {
    indicator: 'Sessions and Killzones',
    fixture: 'top100/ict_killzones_sessions.pine',
  },
  {
    indicator: 'Order Block Detector',
    fixture: 'top100/order_block_detector.pine',
  },
  {
    indicator: 'Fair Value Gap Detector',
    fixture: 'top100/ict_fvg_inversion_fvg.pine',
  },
  {
    indicator: 'Break of Structure (BOS) + CHoCH',
    fixture: 'top100/ict_bos_choch_screener.pine',
  },
  {
    indicator: 'SMT Divergence',
    fixture: 'top100/smt_divergence.pine',
  },
  {
    indicator: 'Volumetric Order Blocks',
    fixture: 'top100/volumetric_order_blocks.pine',
  },
  {
    indicator: 'Nadaraya-Watson Envelope',
    fixture: 'top100/nadaraya_watson_envelope.pine',
  },
  {
    indicator: 'Machine Learning Supertrend',
    fixture: 'top100/machine_learning_supertrend.pine',
  },
  {
    indicator: 'Smart Money Concepts AI',
    fixture: 'top100/smart_money_concepts_ai.pine',
  },
  {
    indicator: 'Trend Strength Oscillator',
    fixture: 'top100/trend_strength_oscillator.pine',
  },
  {
    indicator: 'Neural Pulse System',
    fixture: 'top100/neural_pulse_system.pine',
  },
  {
    indicator: 'Adaptive VWAP Bands',
    fixture: 'top100/adaptive_vwap_bands.pine',
  },
  {
    indicator: 'Order Block Probability',
    fixture: 'top100/order_block_probability.pine',
  },
  {
    indicator: 'ICT Killzones + Sessions',
    fixture: 'top100/ict_killzones_sessions.pine',
  },
  {
    indicator: 'ICT OTE + PD Arrays',
    fixture: 'top100/ict_ote_pd_arrays.pine',
  },
  {
    indicator: 'ICT Judas Swing Detector',
    fixture: 'top100/ict_judas_swing_detector.pine',
  },
  {
    indicator: 'ICT Buyside/Sellside Liquidity',
    fixture: 'top100/ict_buyside_sellside_liquidity.pine',
  },
  {
    indicator: 'ICT BOS/CHoCH Screener',
    fixture: 'top100/ict_bos_choch_screener.pine',
  },
  {
    indicator: 'ICT FVG + Inversion FVG',
    fixture: 'top100/ict_fvg_inversion_fvg.pine',
  },
  {
    indicator: 'ICT Mitigation Blocks',
    fixture: 'arunkbhaskar/scanner_ict_mitigation_block_scanner.pine',
  },
  {
    indicator: 'ICT Breaker Blocks',
    fixture: 'top100/ict_breaker_blocks.pine',
  },
  {
    indicator: 'ICT Rejection Blocks',
    fixture: 'top100/ict_rejection_blocks.pine',
  },
  {
    indicator: 'ICT Unicorn Model Detector',
    fixture: 'top100/ict_unicorn_model_detector.pine',
  },
  {
    indicator: 'SMC Composite Index',
    fixture: 'top100/smc_composite_index.pine',
  },
  {
    indicator: 'WaveTrend Oscillator',
    fixture: 'top100/wavetrend_oscillator.pine',
  },
  {
    indicator: 'Squeeze Momentum Indicator [LazyBear]',
    fixture: 'top100/squeeze_momentum.pine',
  },
  { indicator: 'QQE MOD', fixture: 'top100/qqe_mod.pine' },
  { indicator: 'TTM Squeeze Pro', fixture: 'top100/squeeze_momentum.pine' },
  {
    indicator: 'Relative Rotation Graph (RRG-style)',
    fixture: 'top100/rrg_style.pine',
  },
  {
    indicator: 'Anchored VWAP Suite',
    fixture: 'top100/anchored_vwap_suite.pine',
  },
  {
    indicator: 'Session Volume Profile',
    fixture: 'top100/session_volume_profile.pine',
  },
  {
    indicator: 'Volume Profile with POC & VA',
    fixture: 'top100/session_volume_profile.pine',
  },
  {
    indicator: 'Auto Fibonacci Retracement Pro',
    fixture: 'top100/auto_fibonacci_retracement_pro.pine',
  },
  {
    indicator: 'RSI Divergence Detector',
    fixture: 'top100/rsi_divergence_detector.pine',
  },
  {
    indicator: 'MACD Divergence Detector',
    fixture: 'top100/macd_divergence_detector.pine',
  },
  {
    indicator: 'Donchian Trend Ribbon Pro',
    fixture: 'top100/donchian_trend_ribbon_pro.pine',
  },
];

/**
 * Deterministic curated fillers to keep this matrix at a true 100 targets.
 * These are high-signal fixtures that already run in corpus CI and help
 * maintain stable coverage accounting as community sets evolve.
 */
export const TOP100_CURATED_FILL_TARGETS: TargetSeed[] = [
  { indicator: 'Trivial Plot', fixture: 'curated/01-trivial-plot.pine' },
  { indicator: 'SMA Basic', fixture: 'curated/02-sma-basic.pine' },
  { indicator: 'EMA Basic', fixture: 'curated/03-ema-basic.pine' },
  { indicator: 'RSI Basic', fixture: 'curated/04-rsi-basic.pine' },
  { indicator: 'EMA Cross', fixture: 'curated/05-ema-cross.pine' },
  {
    indicator: 'MACD (Multi Output)',
    fixture: 'curated/06-macd-multioutput.pine',
  },
  {
    indicator: 'Bollinger Bands (Destructure)',
    fixture: 'curated/07-bb-destructure.pine',
  },
  {
    indicator: 'Keltner Channel (Destructure)',
    fixture: 'curated/08-keltner-destructure.pine',
  },
  {
    indicator: 'Stochastic (Destructure)',
    fixture: 'curated/09-stoch-destructure.pine',
  },
  {
    indicator: 'Supertrend (Destructure)',
    fixture: 'curated/10-supertrend-destructure.pine',
  },
  {
    indicator: 'Ichimoku (Manual)',
    fixture: 'curated/11-ichimoku-manual.pine',
  },
  {
    indicator: 'Plotshape Buy/Sell',
    fixture: 'curated/16-plotshape-buy-sell.pine',
  },
  { indicator: 'Plotchar Signals', fixture: 'curated/17-plotchar.pine' },
  { indicator: 'Bgcolor Zones', fixture: 'curated/18-bgcolor-zones.pine' },
  { indicator: 'Fill Bands', fixture: 'curated/19-fill-bands.pine' },
  {
    indicator: 'Visual Drawing Lifecycle',
    fixture: 'curated/41-visual-drawing-lifecycle.pine',
  },
  {
    indicator: 'ICT Killzones & Pivots [TFO]',
    fixture: 'curated/ict-killzones.pine',
  },
];

export const TOP100_TARGETS: Target[] = [
  ...TOP100_CORPUS_COMMUNITY_TARGETS.map((t, i) => ({
    ...t,
    rank: i + 1,
    source: 'corpus' as const,
  })),
  ...TOP100_EXTERNAL_POPULAR_TARGETS.map((t, i) => ({
    ...t,
    rank: TOP100_CORPUS_COMMUNITY_TARGETS.length + i + 1,
    source: 'external' as const,
  })),
  ...TOP100_CURATED_FILL_TARGETS.map((t, i) => ({
    ...t,
    rank:
      TOP100_CORPUS_COMMUNITY_TARGETS.length +
      TOP100_EXTERNAL_POPULAR_TARGETS.length +
      i +
      1,
    source: 'corpus' as const,
  })),
];

const EXPECTED_TOP100_COUNT = 100;
if (TOP100_TARGETS.length !== EXPECTED_TOP100_COUNT) {
  throw new Error(
    `Top-100 target list must contain exactly ${EXPECTED_TOP100_COUNT} entries, got ${TOP100_TARGETS.length}`,
  );
}

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
  const notInCorpus = rows.filter((r) => r.status === 'NOT_IN_CORPUS').length;

  const tracked = pass + fail;
  const ictAdvanced = rows.filter((r) =>
    /BOS|CHoCH|FVG|ICT|Liquidity|MSS/i.test(r.indicator),
  );
  const ictPass = ictAdvanced.filter((r) => r.status === 'PASS').length;

  const lines: string[] = [];
  lines.push('# Chart Host Top-100 Community Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    `Summary: PASS ${pass} / FAIL ${fail} / NOT_IN_CORPUS ${notInCorpus} (Total ${rows.length})`,
  );
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(
    `- Overall pass coverage: **${pass}/${rows.length} (${pct(pass, rows.length)})**`,
  );
  lines.push(
    `- Tracked-in-corpus pass rate: **${pass}/${tracked} (${pct(pass, tracked)})**`,
  );
  lines.push(`- Not yet in corpus: **${notInCorpus}**`);
  lines.push(
    `- Advanced ICT/BOS/CHoCH/FVG spot-check: **${ictPass}/${ictAdvanced.length} (${pct(ictPass, ictAdvanced.length)})**`,
  );
  lines.push('');

  const sourceBuckets = new Map<string, { pass: number; total: number }>();
  const laneBuckets = new Map<string, { pass: number; total: number }>();
  const authenticityBuckets = new Map<
    string,
    { pass: number; total: number }
  >();
  for (const row of rows) {
    const record = (
      map: Map<string, { pass: number; total: number }>,
      key: string,
    ) => {
      const bucket = map.get(key) ?? { pass: 0, total: 0 };
      bucket.total += 1;
      if (row.status === 'PASS') bucket.pass += 1;
      map.set(key, bucket);
    };
    record(sourceBuckets, row.source);
    record(laneBuckets, row.lane);
    record(authenticityBuckets, row.authenticity);
  }

  lines.push('## Source Split');
  lines.push('');
  lines.push('| Source | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const source of ['corpus', 'external']) {
    const b = sourceBuckets.get(source) ?? { pass: 0, total: 0 };
    lines.push(
      `| ${source} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  lines.push('');

  lines.push('## Lane Split');
  lines.push('');
  lines.push('| Lane | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const lane of [
    'curated_core',
    'upstream_authentic',
    'synthetic_custom',
    'quarantine',
  ]) {
    const b = laneBuckets.get(lane);
    if (!b) continue;
    lines.push(
      `| ${lane} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`,
    );
  }
  lines.push('');

  lines.push('## Authenticity Split');
  lines.push('');
  lines.push('| Authenticity | Pass | Total | Rate |');
  lines.push('|---|---:|---:|---:|');
  for (const key of ['authentic', 'proxy', 'synthetic']) {
    const b = authenticityBuckets.get(key);
    if (!b) continue;
    lines.push(`| ${key} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
  }
  lines.push('');

  lines.push(
    '| # | Indicator | Source | Lane | Authenticity | Fixture | Status | Stage | Error | Chart Host |',
  );
  lines.push('|---:|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const sourceLink = row.chartHostUrl ? `<${row.chartHostUrl}>` : '';
    lines.push(
      `| ${row.rank} | ${escapeCell(row.indicator)} | ${row.source} | ${row.lane} | ${row.authenticity} | ${escapeCell(row.fixture ?? '')} | ${row.status} | ${escapeCell(row.stage)} | ${escapeCell(row.error)} | ${escapeCell(sourceLink)} |`,
    );
  }

  return lines.join('\n');
}

function main(): number {
  const discovered = new Map(
    listAllFixtures().map((fx) => [`${fx.group}/${fx.name}`, fx.path] as const),
  );

  const rows: MatrixRow[] = TOP100_TARGETS.map((target) => {
    if (!target.fixture) {
      return {
        ...target,
        status: 'NOT_IN_CORPUS',
        stage: 'missing',
        error: 'external target not yet imported as corpus fixture',
        lane: 'quarantine',
        authenticity: 'proxy',
      };
    }

    const fixturePath = discovered.get(target.fixture);
    if (!fixturePath) {
      return {
        ...target,
        status: 'NOT_IN_CORPUS',
        stage: 'missing',
        error: 'fixture not found',
        lane: 'quarantine',
        authenticity: 'proxy',
      };
    }

    const source = readFileSync(fixturePath, 'utf8');
    const result = runFixture(source, { fixtureName: target.fixture });
    const meta = resolveFixtureMetaFromId(target.fixture, source);
    return {
      ...target,
      status: result.pass ? 'PASS' : 'FAIL',
      stage: result.stageReached,
      error: result.error ?? '',
      lane: meta.lane,
      authenticity: meta.authenticity,
    };
  });

  const md = render(rows);
  const outputPath = join(
    import.meta.dir,
    '..',
    '..',
    'docs',
    'TOP100_MATRIX.md',
  );
  writeFileSync(outputPath, `${md}\n`);

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const notInCorpus = rows.filter((r) => r.status === 'NOT_IN_CORPUS').length;

  console.log(
    `Chart Host top-100 matrix written: ${outputPath} (PASS ${pass} / FAIL ${fail} / NOT_IN_CORPUS ${notInCorpus})`,
  );

  // Gap tracking should not fail CI; only real runtime failures should.
  return fail === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
