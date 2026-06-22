import { DRAWING_REGISTRY } from './drawing';
import { INPUT_REGISTRY } from './inputs';
import type { DrawingFnSpec, DrawingNamespaceSpec, InputFnSpec } from './types';

export { DRAWING_REGISTRY } from './drawing';
export { INPUT_REGISTRY } from './inputs';
export type {
  DrawingFnSpec,
  DrawingNamespaceSpec,
  InputFnSpec,
  NamespaceConstant,
} from './types';

export type DrawingNamespaceName = keyof typeof DRAWING_REGISTRY;
export type InputFunctionName = keyof typeof INPUT_REGISTRY;

export function getDrawingNamespace(
  namespace: string,
): DrawingNamespaceSpec | undefined {
  return DRAWING_REGISTRY[namespace as DrawingNamespaceName];
}

export function getDrawingFn(
  namespace: string,
  fn: string,
): DrawingFnSpec | undefined {
  return getDrawingNamespace(namespace)?.functions[fn];
}

export function getInputFn(name: string): InputFnSpec | undefined {
  return INPUT_REGISTRY[name as InputFunctionName];
}
