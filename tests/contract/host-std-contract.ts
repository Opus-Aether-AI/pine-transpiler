/**
 * Authoritative Host `Std.*` contract for the TA calls this repo emits.
 *
 * Source: TradingView `charting_library.d.ts` (vendored slice).
 * Treat this file as the source of truth for Host arg order; local
 * runtime mirrors and mapping tables must conform to it.
 */

export type HostStdParamKind = 'number' | 'number-or-undefined' | 'series';

export interface HostStdContractParam {
  readonly name: string;
  readonly kind: HostStdParamKind;
  readonly isContext?: boolean;
}

export interface HostStdContractEntry {
  readonly stdName: `Std.${string}`;
  readonly params: readonly HostStdContractParam[];
  readonly contextParamIndex: number;
}

export const HOST_STD_CONTRACT = {
  atr: {
    stdName: 'Std.atr',
    params: [
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 1,
  },
  correlation: {
    stdName: 'Std.correlation',
    params: [
      { name: 'sourceA', kind: 'series' },
      { name: 'sourceB', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 3,
  },
  cum: {
    stdName: 'Std.cum',
    params: [
      { name: 'n_value', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 1,
  },
  dev: {
    stdName: 'Std.dev',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  ema: {
    stdName: 'Std.ema',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  highest: {
    stdName: 'Std.highest',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  lowest: {
    stdName: 'Std.lowest',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  rma: {
    stdName: 'Std.rma',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  sma: {
    stdName: 'Std.sma',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  stdev: {
    stdName: 'Std.stdev',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  stoch: {
    stdName: 'Std.stoch',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'high', kind: 'series' },
      { name: 'low', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 4,
  },
  sum: {
    stdName: 'Std.sum',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
  tr: {
    stdName: 'Std.tr',
    params: [
      { name: 'n_handleNaN', kind: 'number-or-undefined' },
      { name: 'ctx', kind: 'number', isContext: true },
    ],
    contextParamIndex: 1,
  },
  wma: {
    stdName: 'Std.wma',
    params: [
      { name: 'source', kind: 'series' },
      { name: 'length', kind: 'number' },
      { name: 'context', kind: 'number', isContext: true },
    ],
    contextParamIndex: 2,
  },
} as const satisfies Record<string, HostStdContractEntry>;

export type HostStdFunctionName = keyof typeof HOST_STD_CONTRACT;

export const HOST_STD_FUNCTION_NAMES = Object.keys(
  HOST_STD_CONTRACT,
) as HostStdFunctionName[];
