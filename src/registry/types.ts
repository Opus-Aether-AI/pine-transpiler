export interface DrawingFnSpec {
  canonicalArgs: readonly string[];
  handleFields?: Readonly<Record<string, string>>;
  visualEventArgs?: readonly string[];
}

export interface InputFnSpec {
  canonicalArgs: readonly string[];
}

export interface NamespaceConstant {
  name: string;
  value: string | number;
}

export interface DrawingNamespaceSpec {
  name: string;
  functions: Readonly<Record<string, DrawingFnSpec>>;
  constants: readonly NamespaceConstant[];
}
