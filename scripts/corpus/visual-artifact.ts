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
  | 'label.new'
  | 'box.new'
  | 'table.new';

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
  'label.new': /\blabel\.new\(/g,
  'box.new': /\bbox\.new\(/g,
  'table.new': /\btable\.new\(/g,
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
      topRuntimeErrors: run.runtimeErrors.slice(0, 5),
      unimplementedStdCalls: [...run.unimplementedStdCalls],
    },
    metainfo: metainfoSummary,
    visualCallCounts: countVisualCalls(run.transpiledBody),
  };
}
