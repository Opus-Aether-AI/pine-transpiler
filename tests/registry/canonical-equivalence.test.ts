import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'bun:test';
import {
  getDrawingFn,
  getInputFn,
  INPUT_REGISTRY,
} from '../../src/registry';

const EXPRESSION_GENERATOR_SOURCE = readFileSync(
  new URL('../../src/generator/expression-generator.ts', import.meta.url),
  'utf8',
);

const DRAWING_CANONICAL_ARG_ORDER = readCanonicalMap(
  'DRAWING_CANONICAL_ARG_ORDER',
);
const INPUT_CANONICAL_ARG_ORDER = readCanonicalMap('INPUT_CANONICAL_ARG_ORDER');

const KNOWN_DRAWING_CORRECTIONS: Readonly<Record<string, readonly string[]>> = {
  // Empty in Phase 2a: the generator canonical arrays are already authoritative.
};

const KNOWN_INPUT_CORRECTIONS: Readonly<Record<string, readonly string[]>> = {
  // Empty in Phase 2a: the generator canonical arrays are already authoritative.
};

function readCanonicalMap(name: string): Record<string, string[]> {
  const prefix = `const ${name}: Record<string, string[]> = `;
  const start = EXPRESSION_GENERATOR_SOURCE.indexOf(prefix);
  if (start === -1) {
    throw new Error(`Could not locate ${name} in expression-generator.ts`);
  }
  const objectStart = EXPRESSION_GENERATOR_SOURCE.indexOf(
    '{',
    start + prefix.length,
  );
  if (objectStart === -1) {
    throw new Error(`Could not locate ${name} object start`);
  }

  let depth = 0;
  let objectEnd = -1;
  for (let index = objectStart; index < EXPRESSION_GENERATOR_SOURCE.length; index++) {
    const char = EXPRESSION_GENERATOR_SOURCE[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        objectEnd = index;
        break;
      }
    }
  }

  if (objectEnd === -1) {
    throw new Error(`Could not locate ${name} object end`);
  }

  const literal = EXPRESSION_GENERATOR_SOURCE.slice(objectStart, objectEnd + 1);
  return Function(`return (${literal});`)() as Record<string, string[]>;
}

function assertCanonicalMatch(
  key: string,
  actual: readonly string[] | undefined,
  expected: readonly string[],
  knownCorrections: Readonly<Record<string, readonly string[]>>,
): void {
  expect(actual).toBeDefined();
  const correction = knownCorrections[key];
  if (correction) {
    expect(actual).toEqual(correction);
    expect(actual).not.toEqual(expected);
    return;
  }
  expect(actual).toEqual(expected);
}

describe('registry canonical equivalence — drawing', () => {
  for (const [key, expectedArgs] of Object.entries(
    DRAWING_CANONICAL_ARG_ORDER,
  )) {
    it(`${key} matches the current canonical array exactly`, () => {
      const [namespace, fn] = key.split('.');
      const actual = getDrawingFn(namespace ?? '', fn ?? '')?.canonicalArgs;
      assertCanonicalMatch(
        key,
        actual,
        expectedArgs,
        KNOWN_DRAWING_CORRECTIONS,
      );
    });
  }

  it('KNOWN_DRAWING_CORRECTIONS only contains real divergences', () => {
    for (const [key, correctedArgs] of Object.entries(
      KNOWN_DRAWING_CORRECTIONS,
    )) {
      const [namespace, fn] = key.split('.');
      const actual = getDrawingFn(namespace ?? '', fn ?? '')?.canonicalArgs;
      const expected = DRAWING_CANONICAL_ARG_ORDER[key];
      expect(expected).toBeDefined();
      expect(actual).toEqual(correctedArgs);
      expect(actual).not.toEqual(expected);
    }
  });
});

describe('registry canonical equivalence — inputs', () => {
  it('covers the current input canonical keys exactly', () => {
    expect(Object.keys(INPUT_REGISTRY).sort()).toEqual(
      Object.keys(INPUT_CANONICAL_ARG_ORDER).sort(),
    );
  });

  for (const [key, expectedArgs] of Object.entries(INPUT_CANONICAL_ARG_ORDER)) {
    it(`${key} matches the current canonical array exactly`, () => {
      const actual = getInputFn(key)?.canonicalArgs;
      assertCanonicalMatch(key, actual, expectedArgs, KNOWN_INPUT_CORRECTIONS);
    });
  }

  it('KNOWN_INPUT_CORRECTIONS only contains real divergences', () => {
    for (const [key, correctedArgs] of Object.entries(KNOWN_INPUT_CORRECTIONS)) {
      const actual = getInputFn(key)?.canonicalArgs;
      const expected = INPUT_CANONICAL_ARG_ORDER[key];
      expect(expected).toBeDefined();
      expect(actual).toEqual(correctedArgs);
      expect(actual).not.toEqual(expected);
    }
  });
});
