/**
 * Mock of the Charting Library widget's drawing API, in the spirit of
 * tests/corpus/mock-runtime.ts: just enough surface to record what the
 * tv-host renderer asks the chart to draw, written from the public
 * documentation (no library code).
 *
 * It is strict where the real widget is unforgiving: points must be
 * finite and in UNIX seconds, and updating or removing an unknown
 * entity throws.
 */

import type {
  ChartApi,
  ChartShapeOptions,
  ChartShapePoint,
} from '../../src/tv-host';

export interface MockShape {
  id: string;
  shape: string;
  text?: string;
  points: ChartShapePoint[];
  properties: Record<string, unknown>;
  createdWith: ChartShapeOptions;
  order: 'front' | 'back' | 'default';
}

export interface MockChartCall {
  op: 'create' | 'setPoints' | 'setProperties' | 'remove';
  id: string;
}

export interface MockChartWidgetOptions {
  /** Return entity ids as Promises, like older library versions. */
  asyncCreate?: boolean;
  studies?: Array<{ id: string; name: string }>;
}

/** Any real candle time from 2001 on is < 1e11 seconds. */
const MAX_SECONDS = 100_000_000_000;

function checkPoints(points: ChartShapePoint[]): ChartShapePoint[] {
  for (const point of points) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.price)) {
      throw new Error(`non-finite point ${JSON.stringify(point)}`);
    }
    if (!Number.isInteger(point.time) || point.time >= MAX_SECONDS) {
      throw new Error(`point time is not UNIX seconds: ${point.time}`);
    }
  }
  return points.map((point) => ({ time: point.time, price: point.price }));
}

export function createMockChartWidget(options: MockChartWidgetOptions = {}) {
  const shapes = new Map<string, MockShape>();
  const calls: MockChartCall[] = [];
  let studies = options.studies ?? [];
  const listeners = new Set<(id: string, type: string) => void>();
  let sequence = 0;

  const create = (points: ChartShapePoint[], opts: ChartShapeOptions) => {
    const id = `entity-${++sequence}`;
    shapes.set(id, {
      id,
      shape: opts.shape,
      text: opts.text,
      points: checkPoints(points),
      properties: { ...opts.overrides },
      createdWith: opts,
      order: 'default',
    });
    calls.push({ op: 'create', id });
    return options.asyncCreate ? Promise.resolve(id) : id;
  };

  const known = (id: string): MockShape => {
    const shape = shapes.get(id);
    if (!shape) throw new Error(`unknown entity ${id}`);
    return shape;
  };

  const chart: ChartApi = {
    createShape: (point, opts) => create([point], opts),
    createMultipointShape: (points, opts) => create(points, opts),
    getShapeById: (id) => {
      const shape = known(id);
      return {
        setPoints(points) {
          shape.points = checkPoints(points);
          calls.push({ op: 'setPoints', id });
        },
        setProperties(properties) {
          Object.assign(shape.properties, properties);
          calls.push({ op: 'setProperties', id });
        },
        bringToFront() {
          shape.order = 'front';
        },
        sendToBack() {
          shape.order = 'back';
        },
      };
    },
    removeEntity: (id) => {
      known(id);
      shapes.delete(id);
      calls.push({ op: 'remove', id });
    },
    getAllStudies: () => studies.map((study) => ({ ...study })),
  };

  return {
    widget: {
      activeChart: () => chart,
      subscribe(_event: 'study_event', cb: (id: string, type: string) => void) {
        listeners.add(cb);
      },
      unsubscribe(
        _event: 'study_event',
        cb: (id: string, type: string) => void,
      ) {
        listeners.delete(cb);
      },
    },
    chart,
    shapes,
    calls,
    /** Live shapes of one widget shape type. */
    live(shape: string): MockShape[] {
      return [...shapes.values()].filter((s) => s.shape === shape);
    },
    setStudies(next: Array<{ id: string; name: string }>) {
      studies = next;
    },
    emitStudyEvent(id: string, type: string) {
      for (const listener of listeners) listener(id, type);
    },
  };
}

export type MockChartWidget = ReturnType<typeof createMockChartWidget>;
