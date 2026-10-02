import { DRAWING_REGISTRY } from './drawing';
import { INPUT_REGISTRY } from './inputs';
import { DrawingFnSpec, DrawingNamespaceSpec, InputFnSpec, NamespaceConstant } from './types';
export { DRAWING_REGISTRY } from './drawing';
export { INPUT_REGISTRY } from './inputs';
export type { DrawingFnSpec, DrawingNamespaceSpec, InputFnSpec, NamespaceConstant, } from './types';
export type DrawingNamespaceName = keyof typeof DRAWING_REGISTRY;
export type InputFunctionName = keyof typeof INPUT_REGISTRY;
export declare function getDrawingNamespace(namespace: string): DrawingNamespaceSpec | undefined;
export declare function listDrawingNamespaceNames(): DrawingNamespaceName[];
export declare function getDrawingFn(namespace: string, fn: string): DrawingFnSpec | undefined;
export declare function listDrawingFunctionNames(namespace: string): string[];
export declare function listDrawingConstants(namespace: string): NamespaceConstant[];
export declare function getInputFn(name: string): InputFnSpec | undefined;
export declare function listInputFunctionNames(): InputFunctionName[];
//# sourceMappingURL=index.d.ts.map