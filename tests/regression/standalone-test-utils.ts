import type { InputCallback } from '../../src/types';

export function stripModuleSyntax(factoryCode: string): string {
  return factoryCode
    .replace(/^[ \t]*import\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+default\b[^\n]*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\b/gm, '$1')
    .replace(/^[ \t]*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

export function loadCreateIndicator(
  factoryCode: string,
  deps: Record<string, unknown> = {},
): (pineJs: unknown) => unknown {
  const stripped = stripModuleSyntax(factoryCode);
  const loader = new Function(
    'deps',
    `with (deps) { ${stripped}; return createIndicator; }`,
  ) as (deps: Record<string, unknown>) => (pineJs: unknown) => unknown;
  return loader(deps);
}

export function buildInputCallback(indicator: {
  metainfo?: {
    defaults?: { inputs?: Record<string, unknown> };
    inputs?: Array<{ id: string; defval?: unknown }>;
  };
}): InputCallback {
  const defaultsById = indicator.metainfo?.defaults?.inputs ?? {};
  const inputs = indicator.metainfo?.inputs ?? [];
  const values = inputs.map((input) => {
    const fromDefaults = defaultsById[input.id];
    if (fromDefaults !== undefined) return fromDefaults;
    return input.defval;
  });
  return (index: number) => values[index] ?? 14;
}

