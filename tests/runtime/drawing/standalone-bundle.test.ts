import { describe, expect, it } from 'bun:test';
import { buildStandaloneDrawingBundle } from '../../../scripts/build-drawing-bundle';
import { STANDALONE_DRAWING_BUNDLE } from '../../../src/runtime/drawing/standalone-bundle.generated';
import { STANDALONE_DRAWING_BUNDLE_GLOBAL } from '../../../src/runtime/drawing/standalone-bundle.constants';
import type {
  DrawingEventSink,
  DrawingHandle,
  DrawingRuntime,
  DrawingVisualEvent,
} from '../../../src/runtime/drawing';

interface StandaloneDrawingBundleApi {
  createDrawingRuntime: (sink: DrawingEventSink) => DrawingRuntime;
  createDrawingStubNamespaces: () => DrawingRuntime;
}

interface LoadedStandaloneDrawingBundle {
  bundleApi: StandaloneDrawingBundleApi | undefined;
  createDrawingRuntime:
    | StandaloneDrawingBundleApi['createDrawingRuntime']
    | undefined;
  createStubNamespaces: (() => DrawingRuntime) | undefined;
}

type SmokeRuntime = DrawingRuntime & {
  line: DrawingRuntime['line'] & {
    set_xy2: (handle: unknown, x: unknown, y: unknown) => void;
    get_y2: (handle: unknown) => number;
  };
  box: DrawingRuntime['box'] & {
    set_left: (handle: unknown, left: unknown) => void;
    get_left: (handle: unknown) => number;
  };
  label: DrawingRuntime['label'] & {
    set_text: (handle: unknown, text: unknown) => void;
    get_text: (handle: unknown) => string;
  };
};

function evaluateStandaloneDrawingBundle(
  bundle: string,
): LoadedStandaloneDrawingBundle {
  const loader = new Function(
    'bundleGlobalName',
    `const scope = Object.create(null);
var globalThis = scope;
${bundle}
return {
  bundleApi: scope[bundleGlobalName],
  createDrawingRuntime:
    typeof __createDrawingRuntime === 'function'
      ? __createDrawingRuntime
      : undefined,
  createStubNamespaces:
    typeof __createStubNamespaces === 'function'
      ? __createStubNamespaces
      : undefined,
};`,
  ) as (bundleGlobalName: string) => LoadedStandaloneDrawingBundle;

  return loader(STANDALONE_DRAWING_BUNDLE_GLOBAL);
}

describe('STANDALONE_DRAWING_BUNDLE', () => {
  it('stays fresh with the build script output', () => {
    expect(buildStandaloneDrawingBundle()).toBe(STANDALONE_DRAWING_BUNDLE);
  });

  it('remains CSP-safe', () => {
    expect(STANDALONE_DRAWING_BUNDLE).not.toMatch(/\bimport\s/);
    expect(STANDALONE_DRAWING_BUNDLE).not.toMatch(/\bexport\s/);
    expect(STANDALONE_DRAWING_BUNDLE).not.toMatch(/\bnew Function\b/);
  });

  it('evaluates standalone, exposes aliases, and emits drawing events', () => {
    const {
      bundleApi,
      createDrawingRuntime,
      createStubNamespaces,
    } = evaluateStandaloneDrawingBundle(STANDALONE_DRAWING_BUNDLE);

    expect(bundleApi).toBeDefined();
    expect(bundleApi?.createDrawingRuntime).toBe(createDrawingRuntime);
    expect(typeof bundleApi?.createDrawingStubNamespaces).toBe('function');
    expect(typeof createStubNamespaces).toBe('function');

    const stubs = createStubNamespaces?.();
    expect(stubs).toBeDefined();
    expect(stubs?.line.__hasHandle(stubs.line.new(1, 2, 3, 4))).toBe(true);
    expect(stubs?.box.__hasHandle(stubs.box.new(10, 20, 30, 40))).toBe(true);
    expect(stubs?.label.__hasHandle(stubs.label.new(5, 6, 'stub'))).toBe(true);
    expect(typeof stubs?.table.new).toBe('function');
    expect(typeof stubs?.linefill.new).toBe('function');

    const events: DrawingVisualEvent[] = [];
    const runtime = createDrawingRuntime?.({
      barIndex: 33,
      pushEvent: (event) => {
        events.push(event);
      },
    }) as SmokeRuntime | undefined;

    expect(runtime).toBeDefined();

    const line = runtime?.line.new(
      1,
      2,
      3,
      4,
      'bar_index',
      'right',
      '#112233',
      'solid',
      2,
      true,
    ) as DrawingHandle;
    const box = runtime?.box.new(
      10,
      20,
      30,
      40,
      '#AABBCC',
      1,
      'solid',
      'none',
      'bar_index',
      '#DDEEFF',
      'box text',
      'normal',
      '#000000',
      'center',
      'top',
      'wrap_auto',
      true,
      'mono',
    ) as DrawingHandle;
    const label = runtime?.label.new(
      5,
      6,
      'hello',
      'bar_index',
      'price',
      '#445566',
      'label_up',
      '#FFFFFF',
      'small',
      'center',
      'tip',
      'mono',
      true,
      'bold',
    ) as DrawingHandle;

    runtime?.line.set_xy2(line, 7, 8);
    runtime?.box.set_left(box, 12);
    runtime?.label.set_text(label, 'updated');

    expect(runtime?.line.get_y2(line)).toBe(8);
    expect(runtime?.box.get_left(box)).toBe(12);
    expect(runtime?.label.get_text(label)).toBe('updated');
    expect(events).toHaveLength(6);
    expect(events.map((event) => event.call)).toEqual([
      'line.new',
      'box.new',
      'label.new',
      'line.set_xy2',
      'box.set_left',
      'label.set_text',
    ]);
    expect(events.every((event) => event.barIndex === 33)).toBe(true);
  });
});
