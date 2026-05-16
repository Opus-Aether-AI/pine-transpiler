import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';

function buildInputs(source: string) {
  const result = transpileToPineJS(source, 'input_options_contract', 'Input Options Contract');
  expect(result.success).toBe(true);
  expect(result.indicatorFactory).toBeDefined();
  const indicator = result.indicatorFactory!({ Std: {} as never });
  const inputs = indicator.metainfo?.inputs ?? [];
  return inputs as Array<Record<string, unknown>>;
}

describe('input options contract', () => {
  it('normalizes missing options to an empty array', () => {
    const inputs = buildInputs(`//@version=5
indicator("Input contract")
len = input.int(14, "Length")
mode = input.string("A", "Mode", options=["A", "B"])
src = input.source(close, "Source")
plot(len)
`);

    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(Array.isArray(input.options)).toBe(true);
    }

    const modeInput = inputs.find((x) => x.name === 'Mode');
    expect(modeInput).toBeDefined();
    expect(modeInput?.options).toEqual(['A', 'B']);

    const lenInput = inputs.find((x) => x.name === 'Length');
    expect(lenInput).toBeDefined();
    expect(lenInput?.options).toEqual([]);
  });
});
