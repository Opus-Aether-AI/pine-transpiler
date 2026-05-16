# Critical Indicator Matrix

Generated: 2026-05-12T18:27:24.814Z

Summary: PASS 30 / FAIL 0 / NOT_FOUND 0 (Total 30)

- Scope: high-impact real-world scripts used in ICT/SMC, killzones/sessions, and forex/XAU workflows.

## Theme Coverage

| Theme | Pass | Total | Rate |
|---|---:|---:|---:|
| forex_xau | 5 | 5 | 100% |
| ict_smc | 19 | 19 | 100% |
| session_kz | 3 | 3 | 100% |
| trend_volatility | 3 | 3 | 100% |

## Lane Coverage

| Lane | Pass | Total | Rate |
|---|---:|---:|---:|
| curated_core | 1 | 1 | 100% |
| quarantine | 16 | 16 | 100% |
| synthetic_custom | 7 | 7 | 100% |
| upstream_authentic | 6 | 6 | 100% |

| Indicator | Fixture | Theme | Status | Stage | Error | Lane | Authenticity | Category |
|---|---|---|---|---|---|---|---|---|
| ICT Killzones & Pivots (TFO Curated) | curated/ict-killzones.pine | session_kz | PASS | complete |  | curated_core | synthetic | smc_ict |
| ICT Killzones + Sessions | top100/ict_killzones_sessions.pine | session_kz | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT BOS / CHOCH Screener | top100/ict_bos_choch_screener.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT FVG + Inversion FVG | top100/ict_fvg_inversion_fvg.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT Breaker Blocks | top100/ict_breaker_blocks.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT Buyside/Sellside Liquidity | top100/ict_buyside_sellside_liquidity.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT Judas Swing Detector | top100/ict_judas_swing_detector.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT OTE + PD Arrays | top100/ict_ote_pd_arrays.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT Rejection Blocks | top100/ict_rejection_blocks.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| ICT Unicorn Model Detector | top100/ict_unicorn_model_detector.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| LuxAlgo Smart Money Concepts | top100/luxalgo_smart_money_concepts.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| LuxAlgo Price Action Concepts | top100/luxalgo_price_action_concepts.pine | ict_smc | PASS | complete |  | quarantine | proxy | visual |
| LuxAlgo Liquidity Concepts | top100/luxalgo_liquidity_concepts.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| LuxAlgo Order Block Detector | top100/luxalgo_order_block_detector.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| Market Structure + Liquidity Alerts | top100/market_structure_liquidity_smart_alerts_algonit.pine | ict_smc | PASS | complete |  | quarantine | proxy | smc_ict |
| XAUUSD Vector SMC | top100/xauusd_vector_smc_matsukazealgo.pine | forex_xau | PASS | complete |  | quarantine | proxy | visual |
| MFT VWAP Master Pro | top100/multi_timeframe_vwap_master_pro.pine | trend_volatility | PASS | complete |  | quarantine | proxy | mtf |
| Forex BOS/CHOCH Lite | forex_xau/forex_bos_choch_lite.pine | forex_xau | PASS | complete |  | synthetic_custom | synthetic | smc_ict |
| Liquidity Sweep Lite | forex_xau/liquidity_sweep_lite.pine | forex_xau | PASS | complete |  | synthetic_custom | synthetic | smc_ict |
| Killzone Session Bias | forex_xau/killzone_session_bias.pine | session_kz | PASS | complete |  | synthetic_custom | synthetic | visual |
| XAUUSD FVG Lite | forex_xau/xauusd_fvg_lite.pine | forex_xau | PASS | complete |  | synthetic_custom | synthetic | smc_ict |
| VWAP Reversion XAU | forex_xau/vwap_reversion_xau.pine | forex_xau | PASS | complete |  | synthetic_custom | synthetic | visual |
| XAUUSD ATR Regime Filter | forex_xau/xauusd_atr_regime_filter.pine | trend_volatility | PASS | complete |  | synthetic_custom | synthetic | visual |
| ISV-200 PRO Vol-Depletion Logic | forex_xau/isv_200_pro_vol_depletion_logic.pine | trend_volatility | PASS | complete |  | synthetic_custom | synthetic | visual |
| ICT Market Structure Shift (MSS) | arunkbhaskar/ict_market_structure_shift_mss.pine | ict_smc | PASS | complete |  | upstream_authentic | authentic | smc_ict |
| ICT Market Structure Shift (MSS) Screener | arunkbhaskar/ict_market_structure_shift_mss_screener.pine | ict_smc | PASS | complete |  | upstream_authentic | authentic | smc_ict |
| Scanner ICT Fair Value Gap (FVG) | arunkbhaskar/scanner_-_ict_fair_value_gap_fvg_scanner.pine | ict_smc | PASS | complete |  | upstream_authentic | authentic | smc_ict |
| Scanner ICT Liquidity Sweep Pattern | arunkbhaskar/scanner_-_ict_liquidity_sweep_pattern_scanner.pine | ict_smc | PASS | complete |  | upstream_authentic | authentic | smc_ict |
| Indicator ICT Displacement Candles | arunkbhaskar/indicator_ict_displacement_candles.pine | ict_smc | PASS | complete |  | upstream_authentic | authentic | smc_ict |
| Indicator ICT Liquidity Void Fill | arunkbhaskar/indicator_ict_liquidity_void_fill.pine | ict_smc | PASS | complete |  | upstream_authentic | authentic | smc_ict |
