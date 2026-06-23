import { DRAWING_REGISTRY } from './drawing';
import { INPUT_REGISTRY } from './inputs';
import type {
  DrawingFnSpec,
  DrawingNamespaceSpec,
  InputFnSpec,
  NamespaceConstant,
} from './types';

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

export function listDrawingNamespaceNames(): DrawingNamespaceName[] {
  return Object.keys(DRAWING_REGISTRY).sort() as DrawingNamespaceName[];
}

export function getDrawingFn(
  namespace: string,
  fn: string,
): DrawingFnSpec | undefined {
  return getDrawingNamespace(namespace)?.functions[fn];
}

export function listDrawingFunctionNames(namespace: string): string[] {
  return Object.keys(getDrawingNamespace(namespace)?.functions ?? {}).sort(
    (a, b) => a.localeCompare(b),
  );
}

export function listDrawingConstants(namespace: string): NamespaceConstant[] {
  return [...(getDrawingNamespace(namespace)?.constants ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getInputFn(name: string): InputFnSpec | undefined {
  return INPUT_REGISTRY[name as InputFunctionName];
}

export function listInputFunctionNames(): InputFunctionName[] {
  return Object.keys(INPUT_REGISTRY).sort() as InputFunctionName[];
}
