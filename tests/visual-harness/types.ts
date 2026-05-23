export interface VisualStyleSemantics {
  colors: string[];
  transp: number | null;
  linewidth: number | null;
  offset: number | null;
  display: string | number | null;
}

export interface VisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  pineHandleId?: number;
  style?: VisualStyleSemantics | null;
}

export interface HarnessBarFrame {
  barIndex: number;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  plots: number[];
  events: VisualEvent[];
}

export interface VisualHarnessRenderInput {
  fixtureId: string;
  frames: HarnessBarFrame[];
}
