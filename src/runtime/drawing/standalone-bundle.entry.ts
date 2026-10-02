import { resolveTime } from '../helpers/timeframe-time';
import { createDrawingRuntime, type DrawingEventSink } from './index';
import { STANDALONE_DRAWING_BUNDLE_GLOBAL } from './standalone-bundle.constants';

interface StandaloneDrawingBundleApi {
  createDrawingRuntime: typeof createDrawingRuntime;
  resolveTime: typeof resolveTime;
  createDrawingStubNamespaces: () => ReturnType<typeof createDrawingRuntime>;
}

type StandaloneDrawingBundleGlobal = typeof globalThis & {
  [STANDALONE_DRAWING_BUNDLE_GLOBAL]?: StandaloneDrawingBundleApi;
};

function createNoopDrawingSink(): DrawingEventSink {
  return {
    barIndex: -1,
    pushEvent: () => undefined,
  };
}

function createDrawingStubNamespaces(): ReturnType<
  typeof createDrawingRuntime
> {
  return createDrawingRuntime(createNoopDrawingSink());
}

const standaloneDrawingBundle: StandaloneDrawingBundleApi = {
  createDrawingRuntime,
  resolveTime,
  createDrawingStubNamespaces,
};

const standaloneDrawingGlobal = globalThis as StandaloneDrawingBundleGlobal;
standaloneDrawingGlobal[STANDALONE_DRAWING_BUNDLE_GLOBAL] =
  standaloneDrawingBundle;
