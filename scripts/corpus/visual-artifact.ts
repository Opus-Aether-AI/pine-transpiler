import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src/index';
import type { StudyMetaInfo } from '../../src/types';
import { FIXTURES_DIR } from '../../tests/corpus/list-fixtures';
import { createMockRuntime } from '../../tests/corpus/mock-runtime';
import type { CorpusResult } from '../../tests/corpus/runner';
import { runFixture } from '../../tests/corpus/runner';

export const VISUAL_BASELINE_FIXTURES = [
  '16-plotshape-buy-sell.pine',
  '17-plotchar.pine',
  '18-bgcolor-zones.pine',
  '19-fill-bands.pine',
  '20-hline-multi.pine',
  '41-visual-drawing-lifecycle.pine',
  '42-visual-table-scanner.pine',
  'ict-killzones.pine',
] as const;

type VisualCallName =
  | 'Std.plot'
  | 'Std.plotshape'
  | 'Std.plotchar'
  | 'Std.plotarrow'
  | 'hline'
  | 'Std.bgcolor'
  | 'Std.fill'
  | 'Std.barcolor'
  | 'line.new'
  | 'line.set_x2'
  | 'line.set_xy1'
  | 'line.set_xy2'
  | 'line.set_color'
  | 'line.delete'
  | 'label.new'
  | 'label.set_text'
  | 'label.set_textcolor'
  | 'label.set_style'
  | 'label.delete'
  | 'box.new'
  | 'box.set_bgcolor'
  | 'box.set_border_color'
  | 'box.set_border_width'
  | 'box.delete'
  | 'table.new'
  | 'table.cell'
  | 'table.merge_cells'
  | 'table.clear';

const VISUAL_CALL_PATTERNS: Record<VisualCallName, RegExp> = {
  'Std.plot': /\bStd\.plot\(/g,
  'Std.plotshape': /\bStd\.plotshape\(/g,
  'Std.plotchar': /\bStd\.plotchar\(/g,
  'Std.plotarrow': /\bStd\.plotarrow\(/g,
  hline: /\bhline\(/g,
  'Std.bgcolor': /\bStd\.bgcolor\(/g,
  'Std.fill': /\bStd\.fill\(/g,
  'Std.barcolor': /\bStd\.barcolor\(/g,
  'line.new': /\bline\.new\(/g,
  'line.set_x2': /\bline\.set_x2\(/g,
  'line.set_xy1': /\bline\.set_xy1\(/g,
  'line.set_xy2': /\bline\.set_xy2\(/g,
  'line.set_color': /\bline\.set_color\(/g,
  'line.delete': /\bline\.delete\(/g,
  'label.new': /\blabel\.new\(/g,
  'label.set_text': /\blabel\.set_text\(/g,
  'label.set_textcolor': /\blabel\.set_textcolor\(/g,
  'label.set_style': /\blabel\.set_style\(/g,
  'label.delete': /\blabel\.delete\(/g,
  'box.new': /\bbox\.new\(/g,
  'box.set_bgcolor': /\bbox\.set_bgcolor\(/g,
  'box.set_border_color': /\bbox\.set_border_color\(/g,
  'box.set_border_width': /\bbox\.set_border_width\(/g,
  'box.delete': /\bbox\.delete\(/g,
  'table.new': /\btable\.new\(/g,
  'table.cell': /\btable\.cell\(/g,
  'table.merge_cells': /\btable\.merge_cells\(/g,
  'table.clear': /\btable\.clear\(/g,
};

export interface VisualArtifact {
  fixture: string;
  stageReached: CorpusResult['stageReached'];
  pass: boolean;
  error: string | null;
  runtime: {
    barsCompleted: number;
    barsErrored: number;
    declaredPlotCount: number;
    actualPlotCount: number;
    visualEventCount: number;
    visualCalls: Array<{ call: string; count: number }>;
    visualStyleSemantics: {
      colors: string[];
      transpValues: number[];
      linewidthValues: number[];
      offsetValues: number[];
      displayFlags: string[];
    };
    topRuntimeErrors: Array<{ message: string; count: number }>;
    unimplementedStdCalls: string[];
  };
  metainfo: {
    plotCount: number;
    plots: Array<{ id: string; type: string; price: number | null }>;
    inputCount: number;
    inputs: Array<{
      id: string;
      type: string;
      defval: string | number | boolean | null;
    }>;
    styleKeys: string[];
    styles: Array<{ id: string; title: string | null; histogramBase: number | null }>;
    defaultStyles: Array<{
      id: string;
      plottype: number | null;
      linewidth: number | null;
      linestyle: number | null;
      color: string | null;
      transparency: number | null;
      visible: boolean | null;
      trackPrice: boolean | null;
    }>;
  };
  visualCallCounts: Record<VisualCallName, number>;
}

interface RuntimeVisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  style?: {
    colors: string[];
    transp: number | null;
    linewidth: number | null;
    offset: number | null;
    display: string | number | null;
  } | null;
}

function countRegexMatches(text: string, pattern: RegExp): number {
  if (!text) return 0;
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function countVisualCalls(body: string | null): Record<VisualCallName, number> {
  const source = body ?? '';
  const out = {} as Record<VisualCallName, number>;
  for (const [name, pattern] of Object.entries(VISUAL_CALL_PATTERNS) as Array<
    [VisualCallName, RegExp]
  >) {
    out[name] = countRegexMatches(source, pattern);
  }
  return out;
}

function summarizeVisualEvents(
  events: RuntimeVisualEvent[],
): Array<{ call: string; count: number }> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.call, (counts.get(event.call) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([call, count]) => ({ call, count }))
    .sort((a, b) =>
      a.call === b.call ? a.count - b.count : a.call.localeCompare(b.call),
    );
}

function sortUniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((v) => Number.isFinite(v)))].sort(
    (a, b) => a - b,
  );
}

function summarizeVisualStyleSemantics(events: RuntimeVisualEvent[]): {
  colors: string[];
  transpValues: number[];
  linewidthValues: number[];
  offsetValues: number[];
  displayFlags: string[];
} {
  const colors = new Set<string>();
  const transpValues: number[] = [];
  const linewidthValues: number[] = [];
  const offsetValues: number[] = [];
  const displayFlags = new Set<string>();

  for (const event of events) {
    const style = event.style;
    if (!style) continue;

    for (const color of style.colors ?? []) {
      if (typeof color === 'string' && color.trim()) {
        colors.add(color.trim());
      }
    }

    if (typeof style.transp === 'number' && Number.isFinite(style.transp)) {
      transpValues.push(style.transp);
    }
    if (
      typeof style.linewidth === 'number' &&
      Number.isFinite(style.linewidth)
    ) {
      linewidthValues.push(style.linewidth);
    }
    if (typeof style.offset === 'number' && Number.isFinite(style.offset)) {
      offsetValues.push(style.offset);
    }
    if (style.display !== null && style.display !== undefined) {
      displayFlags.add(String(style.display));
    }
  }

  return {
    colors: [...colors].sort((a, b) => a.localeCompare(b)),
    transpValues: sortUniqueNumbers(transpValues),
    linewidthValues: sortUniqueNumbers(linewidthValues),
    offsetValues: sortUniqueNumbers(offsetValues),
    displayFlags: [...displayFlags].sort((a, b) => a.localeCompare(b)),
  };
}

function toStableDefval(value: unknown): string | number | boolean | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return null;
}

function normalizeMetainfo(metainfo: StudyMetaInfo) {
  const plots = [...(metainfo.plots ?? [])]
    .map((plot) => ({
      id: String(plot.id),
      type: String(plot.type),
      price: typeof plot.price === 'number' ? plot.price : null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const inputs = [...(metainfo.inputs ?? [])]
    .map((input) => ({
      id: String(input.id),
      type: String(input.type),
      defval: toStableDefval(input.defval),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const styleEntries = Object.entries(metainfo.styles ?? {})
    .map(([id, style]) => ({
      id,
      title: typeof style?.title === 'string' ? style.title : null,
      histogramBase:
        typeof style?.histogramBase === 'number' ? style.histogramBase : null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const defaultStyleEntries = Object.entries(metainfo.defaults?.styles ?? {})
    .map(([id, style]) => {
      const s = style as Record<string, unknown>;
      return {
        id,
        plottype: typeof s.plottype === 'number' ? s.plottype : null,
        linewidth: typeof s.linewidth === 'number' ? s.linewidth : null,
        linestyle: typeof s.linestyle === 'number' ? s.linestyle : null,
        color: typeof s.color === 'string' ? s.color : null,
        transparency:
          typeof s.transparency === 'number' ? s.transparency : null,
        visible: typeof s.visible === 'boolean' ? s.visible : null,
        trackPrice: typeof s.trackPrice === 'boolean' ? s.trackPrice : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    plotCount: plots.length,
    plots,
    inputCount: inputs.length,
    inputs,
    styleKeys: Object.keys(metainfo.styles ?? {}).sort(),
    styles: styleEntries,
    defaultStyles: defaultStyleEntries,
  };
}

export function buildVisualArtifact(fixture: string): VisualArtifact {
  const sourcePath = join(FIXTURES_DIR, fixture);
  const source = readFileSync(sourcePath, 'utf8');
  const run = runFixture(source, { fixtureName: fixture });

  const indicatorId = fixture.replace(/[^a-zA-Z0-9]/g, '_');
  const tr = transpileToPineJS(source, indicatorId, fixture);

  let metainfoSummary: VisualArtifact['metainfo'] = {
    plotCount: 0,
    plots: [],
    inputCount: 0,
    inputs: [],
    styleKeys: [],
    styles: [],
    defaultStyles: [],
  };
  let runtimeVisualEvents: RuntimeVisualEvent[] = [];

  if (tr.success && tr.indicatorFactory) {
    const mockRuntime = createMockRuntime({ barCount: 1 });
    const indicator = tr.indicatorFactory(mockRuntime.pineJs);
    metainfoSummary = normalizeMetainfo(indicator.metainfo);
    const constructed = indicator.constructor();
    mockRuntime.resetVarPointer();
    mockRuntime.resetCurrentBarPlots();
    const output = constructed.main(mockRuntime.context, () => 14) as
      | (number[] & { __visualEvents?: RuntimeVisualEvent[] })
      | undefined;
    if (Array.isArray(output?.__visualEvents)) {
      runtimeVisualEvents = [...output.__visualEvents];
    }
  }

  return {
    fixture,
    stageReached: run.stageReached,
    pass: run.pass,
    error: run.error,
    runtime: {
      barsCompleted: run.barsCompleted,
      barsErrored: run.barsErrored,
      declaredPlotCount: run.declaredPlotCount,
      actualPlotCount: run.actualPlotCount,
      visualEventCount: runtimeVisualEvents.length,
      visualCalls: summarizeVisualEvents(runtimeVisualEvents),
      visualStyleSemantics: summarizeVisualStyleSemantics(runtimeVisualEvents),
      topRuntimeErrors: run.runtimeErrors.slice(0, 5),
      unimplementedStdCalls: [...run.unimplementedStdCalls],
    },
    metainfo: metainfoSummary,
    visualCallCounts: countVisualCalls(run.transpiledBody),
  };
}
