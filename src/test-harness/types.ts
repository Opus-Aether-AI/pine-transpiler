import type { StudyPlotInfo } from '../types';

export interface SyntheticBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HarnessIssue {
  stage: 'transpile' | 'descriptor' | 'construct' | 'init' | 'main' | 'reducer';
  barIndex?: number;
  plotId?: string;
  message: string;
}

export interface DescriptorContractReport {
  constructorIsFunction: boolean;
  constructorIsConstructable: boolean;
  constructorError?: string;
  hasCallableMain: boolean;
  plotArrayIsDense: boolean;
  plotIds: string[];
  plotStyleAlignmentErrors: string[];
  defaultStyleAlignmentErrors: string[];
}

export interface ReducerContractReport {
  reducerErrors: HarnessIssue[];
  reducersExecuted: number;
}

export interface TradingViewHarnessReport {
  fixtureName?: string;
  indicatorId: string;
  barsRequested: number;
  barsProcessed: number;
  transpileError?: string;
  descriptor: DescriptorContractReport;
  runtimeErrors: HarnessIssue[];
  reducer: ReducerContractReport;
  unimplementedStdCalls: string[];
  pass: boolean;
}

export interface TradingViewHarnessOptions {
  source: string;
  fixtureName?: string;
  indicatorId?: string;
  indicatorName?: string;
  bars?: number;
  barIndexStart?: number;
}

export interface PlotExecutionFrame {
  plot: StudyPlotInfo;
  value: unknown;
}
