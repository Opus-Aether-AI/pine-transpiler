export interface CriticalFixtureTarget {
  indicator: string;
  fixture: string; // <group>/<name>.pine
  theme: 'ict_smc' | 'session_kz' | 'forex_xau' | 'trend_volatility';
}

/**
 * High-impact market scripts we treat as regression-critical for real dashboard usage.
 * These are intentionally real-world heavy indicators (ICT/SMC/FVG/BOS/CHOCH/killzones/XAU).
 */
export const CRITICAL_FIXTURES: CriticalFixtureTarget[] = [
  {
    indicator: 'ICT Killzones & Pivots (TFO Curated)',
    fixture: 'curated/ict-killzones.pine',
    theme: 'session_kz',
  },
  {
    indicator: 'ICT Killzones + Sessions',
    fixture: 'top100/ict_killzones_sessions.pine',
    theme: 'session_kz',
  },
  {
    indicator: 'ICT BOS / CHOCH Screener',
    fixture: 'top100/ict_bos_choch_screener.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT FVG + Inversion FVG',
    fixture: 'top100/ict_fvg_inversion_fvg.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT Breaker Blocks',
    fixture: 'top100/ict_breaker_blocks.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT Buyside/Sellside Liquidity',
    fixture: 'top100/ict_buyside_sellside_liquidity.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT Judas Swing Detector',
    fixture: 'top100/ict_judas_swing_detector.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT OTE + PD Arrays',
    fixture: 'top100/ict_ote_pd_arrays.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT Rejection Blocks',
    fixture: 'top100/ict_rejection_blocks.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT Unicorn Model Detector',
    fixture: 'top100/ict_unicorn_model_detector.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Smart Money Concepts',
    fixture: 'top100/smart_money_concepts.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Price Action Concepts',
    fixture: 'top100/price_action_concepts.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Liquidity Concepts',
    fixture: 'top100/liquidity_concepts.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Order Block Detector',
    fixture: 'top100/order_block_detector.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Market Structure + Liquidity Alerts',
    fixture: 'top100/market_structure_liquidity_smart_alerts.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'XAUUSD Vector SMC',
    fixture: 'top100/xauusd_vector_smc.pine',
    theme: 'forex_xau',
  },
  {
    indicator: 'MFT VWAP Master Pro',
    fixture: 'top100/multi_timeframe_vwap_master_pro.pine',
    theme: 'trend_volatility',
  },
  {
    indicator: 'Forex BOS/CHOCH Lite',
    fixture: 'forex_xau/forex_bos_choch_lite.pine',
    theme: 'forex_xau',
  },
  {
    indicator: 'Liquidity Sweep Lite',
    fixture: 'forex_xau/liquidity_sweep_lite.pine',
    theme: 'forex_xau',
  },
  {
    indicator: 'Killzone Session Bias',
    fixture: 'forex_xau/killzone_session_bias.pine',
    theme: 'session_kz',
  },
  {
    indicator: 'XAUUSD FVG Lite',
    fixture: 'forex_xau/xauusd_fvg_lite.pine',
    theme: 'forex_xau',
  },
  {
    indicator: 'VWAP Reversion XAU',
    fixture: 'forex_xau/vwap_reversion_xau.pine',
    theme: 'forex_xau',
  },
  {
    indicator: 'XAUUSD ATR Regime Filter',
    fixture: 'forex_xau/xauusd_atr_regime_filter.pine',
    theme: 'trend_volatility',
  },
  {
    indicator: 'ISV-200 PRO Vol-Depletion Logic',
    fixture: 'forex_xau/isv_200_pro_vol_depletion_logic.pine',
    theme: 'trend_volatility',
  },
  {
    indicator: 'ICT Market Structure Shift (MSS)',
    fixture: 'arunkbhaskar/ict_market_structure_shift_mss.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'ICT Market Structure Shift (MSS) Screener',
    fixture: 'arunkbhaskar/ict_market_structure_shift_mss_screener.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Scanner ICT Fair Value Gap (FVG)',
    fixture: 'arunkbhaskar/scanner_-_ict_fair_value_gap_fvg_scanner.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Scanner ICT Liquidity Sweep Pattern',
    fixture: 'arunkbhaskar/scanner_-_ict_liquidity_sweep_pattern_scanner.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Indicator ICT Displacement Candles',
    fixture: 'arunkbhaskar/indicator_ict_displacement_candles.pine',
    theme: 'ict_smc',
  },
  {
    indicator: 'Indicator ICT Liquidity Void Fill',
    fixture: 'arunkbhaskar/indicator_ict_liquidity_void_fill.pine',
    theme: 'ict_smc',
  },
];

export const CRITICAL_FIXTURE_IDS = CRITICAL_FIXTURES.map((t) => t.fixture);
