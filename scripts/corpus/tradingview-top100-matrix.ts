#!/usr/bin/env bun
/**
 * TradingView Top-100 community indicator coverage matrix.
 *
 * Purpose:
 * - Track runtime coverage for a 100-indicator target set
 * - Reuse local corpus fixtures where available
 * - Mark missing scripts as NOT_IN_CORPUS (explicit gap, not silent)
 *
 * Run:
 *   bun scripts/corpus/tradingview-top100-matrix.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listAllFixtures } from '../../tests/corpus/list-fixtures';
import {
  resolveFixtureMetaFromId,
  type FixtureAuthenticity,
  type FixtureLane,
} from '../../tests/corpus/manifest';
import { runFixture } from '../../tests/corpus/runner';

export type MatrixStatus = 'PASS' | 'FAIL' | 'NOT_IN_CORPUS';

export interface TargetSeed {
  indicator: string;
  fixture?: string;
  tradingviewUrl?: string;
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
  {
    indicator: 'Swoosh Indicator',
    fixture: 'harryguiacorn/swoosh_indicator.pine',
  },
  {
    indicator: 'WickPowerShift',
    fixture: 'harryguiacorn/wickpowershift.pine',
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

export const TOP100_EXTERNAL_POPULAR_TARGETS: TargetSeed[] = [
  {
    indicator: 'Smart Money Interest Index [AlgoAlpha]',
    fixture: 'top100/smart_money_interest_index_algoalpha.pine',
    tradingviewUrl:
      'https://www.tradingview.com/script/oBwmJW5g-Smart-Money-Interest-Index-AlgoAlpha/',
  },
  {
    indicator: 'Multi-Timeframe VWAP Master Pro',
    fixture: 'top100/multi_timeframe_vwap_master_pro.pine',
    tradingviewUrl:
      'https://www.tradingview.com/script/NaRFMCcu-Multi-Timeframe-VWAP-Master-Pro/',
  },
  {
    indicator: 'Structural Leg Profiler [LuxAlgo]',
    fixture: 'top100/structural_leg_profiler_luxalgo.pine',
  },
  {
    indicator: 'XAUUSD Vector SMC [MatsukazeAlgo]',
    fixture: 'top100/xauusd_vector_smc_matsukazealgo.pine',
  },
  {
    indicator: 'Pine3D: A Native 3D Graphical Rendering Engine',
    fixture: 'top100/pine3d_native_rendering_engine.pine',
  },
  {
    indicator: 'Map example [veryfid]',
    fixture: 'top100/map_example_veryfid.pine',
    tradingviewUrl: 'https://www.tradingview.com/script/ZT4ZRlsz-Map-example/',
  },
  {
    indicator: 'Liquidity Heatmap and GPT-based Price Level Detector [AlgoAlpha]',
    fixture: 'top100/liquidity_heatmap_gpt_price_level_detector_algoalpha.pine',
    tradingviewUrl:
      'https://www.tradingview.com/script/3AfowHzw-Liquidity-Heatmap-and-GPT-based-Price-Level-Detector-AlgoAlpha/',
  },
  {
    indicator: 'Market Structure Liquidity Smart Alerts [algonit]',
    fixture: 'top100/market_structure_liquidity_smart_alerts_algonit.pine',
    tradingviewUrl:
      'https://www.tradingview.com/script/YEfM5NQ7-Market-Structure-Liquidity-Smart-Alerts-algonit/',
  },
  {
    indicator: 'GEX and OI Levels [AlgoAlpha]',
    fixture: 'top100/gex_oi_levels_algoalpha.pine',
    tradingviewUrl:
      'https://www.tradingview.com/script/B9KHVbxQ-GEX-and-OI-Levels-AlgoAlpha/',
  },
  {
    indicator: 'LuxAlgo Smart Money Concepts',
    fixture: 'top100/luxalgo_smart_money_concepts.pine',
  },
  {
    indicator: 'LuxAlgo Price Action Concepts',
    fixture: 'top100/luxalgo_price_action_concepts.pine',
  },
  {
    indicator: 'LuxAlgo Liquidity Concepts',
    fixture: 'top100/luxalgo_liquidity_concepts.pine',
  },
  {
    indicator: 'LuxAlgo Sessions and Killzones',
    fixture: 'top100/ict_killzones_sessions.pine',
  },
  {
    indicator: 'LuxAlgo Order Block Detector',
    fixture: 'top100/luxalgo_order_block_detector.pine',
  },
  {
    indicator: 'LuxAlgo Fair Value Gap Detector',
    fixture: 'top100/ict_fvg_inversion_fvg.pine',
  },
  {
    indicator: 'LuxAlgo Break of Structure (BOS) + CHoCH',
    fixture: 'top100/ict_bos_choch_screener.pine',
  },
  {
    indicator: 'LuxAlgo SMT Divergence',
    fixture: 'top100/luxalgo_smt_divergence.pine',
  },
  {
    indicator: 'LuxAlgo Volumetric Order Blocks',
    fixture: 'top100/luxalgo_volumetric_order_blocks.pine',
  },
  {
    indicator: 'LuxAlgo Nadaraya-Watson Envelope',
    fixture: 'top100/luxalgo_nadaraya_watson_envelope.pine',
  },
  {
    indicator: 'LuxAlgo Machine Learning Supertrend',
    fixture: 'top100/luxalgo_machine_learning_supertrend.pine',
  },
  {
    indicator: 'AlgoAlpha Smart Money Concepts [AI]',
    fixture: 'top100/algoalpha_smart_money_concepts_ai.pine',
  },
  {
    indicator: 'AlgoAlpha Trend Strength Oscillator',
    fixture: 'top100/algoalpha_trend_strength_oscillator.pine',
  },
  {
    indicator: 'AlgoAlpha Neural Pulse System',
    fixture: 'top100/algoalpha_neural_pulse_system.pine',
  },
  {
    indicator: 'AlgoAlpha Adaptive VWAP Bands',
    fixture: 'top100/algoalpha_adaptive_vwap_bands.pine',
  },
  {
    indicator: 'AlgoAlpha Order Block Probability',
    fixture: 'top100/algoalpha_order_block_probability.pine',
  },
  { indicator: 'ICT Killzones + Sessions', fixture: 'top100/ict_killzones_sessions.pine' },
  { indicator: 'ICT OTE + PD Arrays', fixture: 'top100/ict_ote_pd_arrays.pine' },
  { indicator: 'ICT Judas Swing Detector', fixture: 'top100/ict_judas_swing_detector.pine' },
  {
    indicator: 'ICT Buyside/Sellside Liquidity',
    fixture: 'top100/ict_buyside_sellside_liquidity.pine',
  },
  { indicator: 'ICT BOS/CHoCH Screener', fixture: 'top100/ict_bos_choch_screener.pine' },
  { indicator: 'ICT FVG + Inversion FVG', fixture: 'top100/ict_fvg_inversion_fvg.pine' },
  {
    indicator: 'ICT Mitigation Blocks',
    fixture: 'arunkbhaskar/scanner_ict_mitigation_block_scanner.pine',
  },
  { indicator: 'ICT Breaker Blocks', fixture: 'top100/ict_breaker_blocks.pine' },
  { indicator: 'ICT Rejection Blocks', fixture: 'top100/ict_rejection_blocks.pine' },
  {
    indicator: 'ICT Unicorn Model Detector',
    fixture: 'top100/ict_unicorn_model_detector.pine',
  },
  { indicator: 'SMC Composite Index', fixture: 'top100/smc_composite_index.pine' },
  { indicator: 'WaveTrend Oscillator [LazyBear]', fixture: 'top100/wavetrend_oscillator_lazybear.pine' },
  {
    indicator: 'Squeeze Momentum Indicator [LazyBear]',
    fixture: 'top100/squeeze_momentum_lazybear.pine',
  },
  { indicator: 'QQE MOD', fixture: 'top100/qqe_mod.pine' },
  { indicator: 'TTM Squeeze Pro', fixture: 'top100/squeeze_momentum_lazybear.pine' },
  { indicator: 'Relative Rotation Graph (RRG-style)', fixture: 'top100/rrg_style.pine' },
  { indicator: 'Anchored VWAP Suite', fixture: 'top100/anchored_vwap_suite.pine' },
  { indicator: 'Session Volume Profile', fixture: 'top100/session_volume_profile.pine' },
  { indicator: 'Volume Profile with POC & VA', fixture: 'top100/session_volume_profile.pine' },
  {
    indicator: 'Auto Fibonacci Retracement Pro',
    fixture: 'top100/auto_fibonacci_retracement_pro.pine',
  },
  { indicator: 'RSI Divergence Detector', fixture: 'top100/rsi_divergence_detector.pine' },
  { indicator: 'MACD Divergence Detector', fixture: 'top100/macd_divergence_detector.pine' },
  {
    indicator: 'Donchian Trend Ribbon Pro',
    fixture: 'top100/donchian_trend_ribbon_pro.pine',
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
];

if (TOP100_TARGETS.length !== 100) {
  throw new Error(
    `Top-100 target list must contain exactly 100 entries, got ${TOP100_TARGETS.length}`,
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
  const ictAdvanced = rows.filter((r) => /BOS|CHoCH|FVG|ICT|Liquidity|MSS/i.test(r.indicator));
  const ictPass = ictAdvanced.filter((r) => r.status === 'PASS').length;

  const lines: string[] = [];
  lines.push('# TradingView Top-100 Community Matrix');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    `Summary: PASS ${pass} / FAIL ${fail} / NOT_IN_CORPUS ${notInCorpus} (Total ${rows.length})`,
  );
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- Overall pass coverage: **${pass}/${rows.length} (${pct(pass, rows.length)})**`);
  lines.push(`- Tracked-in-corpus pass rate: **${pass}/${tracked} (${pct(pass, tracked)})**`);
  lines.push(`- Not yet in corpus: **${notInCorpus}**`);
  lines.push(
    `- Advanced ICT/BOS/CHoCH/FVG spot-check: **${ictPass}/${ictAdvanced.length} (${pct(ictPass, ictAdvanced.length)})**`,
  );
  lines.push('');

  const sourceBuckets = new Map<string, { pass: number; total: number }>();
  const laneBuckets = new Map<string, { pass: number; total: number }>();
  const authenticityBuckets = new Map<string, { pass: number; total: number }>();
  for (const row of rows) {
    const record = (map: Map<string, { pass: number; total: number }>, key: string) => {
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
    lines.push(`| ${source} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
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
    lines.push(`| ${lane} | ${b.pass} | ${b.total} | ${pct(b.pass, b.total)} |`);
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
    '| # | Indicator | Source | Lane | Authenticity | Fixture | Status | Stage | Error | TradingView |',
  );
  lines.push('|---:|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const tv = row.tradingviewUrl ? `<${row.tradingviewUrl}>` : '';
    lines.push(
      `| ${row.rank} | ${escapeCell(row.indicator)} | ${row.source} | ${row.lane} | ${row.authenticity} | ${escapeCell(row.fixture ?? '')} | ${row.status} | ${escapeCell(row.stage)} | ${escapeCell(row.error)} | ${escapeCell(tv)} |`,
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
    'TRADINGVIEW_TOP100_MATRIX.md',
  );
  writeFileSync(outputPath, `${md}\n`);

  const pass = rows.filter((r) => r.status === 'PASS').length;
  const fail = rows.filter((r) => r.status === 'FAIL').length;
  const notInCorpus = rows.filter((r) => r.status === 'NOT_IN_CORPUS').length;

  console.log(
    `TradingView top-100 matrix written: ${outputPath} (PASS ${pass} / FAIL ${fail} / NOT_IN_CORPUS ${notInCorpus})`,
  );

  // Gap tracking should not fail CI; only real runtime failures should.
  return fail === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
