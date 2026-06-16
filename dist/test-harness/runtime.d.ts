import { InputCallback, PineJSRuntime, RuntimeContext } from '../types';
import { SyntheticBar } from './types';
interface CreateHarnessRuntimeOptions {
    barCount: number;
    barIndexStart: number;
}
export interface HarnessRuntime {
    bars: SyntheticBar[];
    context: RuntimeContext;
    pineJs: PineJSRuntime;
    barCount: number;
    barIndexStart: number;
    unimplementedStdCalls: Set<string>;
    currentBarIndex: number;
    advanceBar: () => void;
    resetBarState: () => void;
    inputCallbackForDefaults: (defaults: Array<number | boolean | string>) => InputCallback;
}
export declare function createHarnessRuntime(options: CreateHarnessRuntimeOptions): HarnessRuntime;
export {};
//# sourceMappingURL=runtime.d.ts.map