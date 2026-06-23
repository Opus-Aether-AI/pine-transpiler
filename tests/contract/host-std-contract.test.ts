import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';
import { TA_FUNCTION_MAPPINGS } from '../../src/mappings/technical-analysis';
import {
  HOST_STD_CONTRACT,
  HOST_STD_FUNCTION_NAMES,
  type HostStdContractParam,
  type HostStdFunctionName,
} from './host-std-contract';

interface HostStdContractTestCase {
  readonly invocation: string;
  readonly emittedArgByParam: Record<string, string>;
}

const HOST_STD_CONTRACT_TEST_CASES: Record<
  HostStdFunctionName,
  HostStdContractTestCase
> = {
  atr: {
    invocation: 'ta.atr(7)',
    emittedArgByParam: {
      length: '7',
    },
  },
  correlation: {
    invocation: 'ta.correlation(close, open, 5)',
    emittedArgByParam: {
      sourceA: 'close',
      sourceB: 'open',
      length: '5',
    },
  },
  cum: {
    invocation: 'ta.cum(volume)',
    emittedArgByParam: {
      n_value: '_series_volume',
    },
  },
  dev: {
    invocation: 'ta.dev(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
  ema: {
    invocation: 'ta.ema(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
  highest: {
    invocation: 'ta.highest(high, 5)',
    emittedArgByParam: {
      source: '_series_high',
      length: '5',
    },
  },
  lowest: {
    invocation: 'ta.lowest(low, 5)',
    emittedArgByParam: {
      source: '_series_low',
      length: '5',
    },
  },
  rma: {
    invocation: 'ta.rma(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
  sma: {
    invocation: 'ta.sma(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
  stdev: {
    invocation: 'ta.stdev(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
  stoch: {
    invocation: 'ta.stoch(close, high, low, 5)',
    emittedArgByParam: {
      source: 'close',
      high: 'high',
      low: 'low',
      length: '5',
    },
  },
  sum: {
    invocation: 'ta.sum(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
  tr: {
    invocation: 'ta.tr(true)',
    emittedArgByParam: {
      n_handleNaN: 'true',
    },
  },
  wma: {
    invocation: 'ta.wma(close, 5)',
    emittedArgByParam: {
      source: '_series_close',
      length: '5',
    },
  },
};

function buildSource(fnName: HostStdFunctionName): string {
  const { invocation } = HOST_STD_CONTRACT_TEST_CASES[fnName];
  return `//@version=5
indicator("${fnName} host contract")
value = ${invocation}
plot(value)
`;
}

function extractStdCallArgs(body: string, fnName: HostStdFunctionName): string[] {
  const prefix = `Std.${fnName}(`;
  const line = body.split('\n').find((candidate) => candidate.includes(prefix));
  if (!line) {
    throw new Error(`Could not find ${prefix} in __pineJsBody`);
  }

  const start = line.indexOf(prefix) + prefix.length;
  const end = line.indexOf(');', start);
  if (end === -1) {
    throw new Error(`Could not parse ${prefix} arg list from line: ${line}`);
  }

  return line
    .slice(start, end)
    .split(',')
    .map((arg) => arg.trim());
}

function expectedArgsFor(
  fnName: HostStdFunctionName,
  params: readonly HostStdContractParam[],
): string[] {
  const { emittedArgByParam } = HOST_STD_CONTRACT_TEST_CASES[fnName];

  return params.map((param) =>
    param.isContext ? 'context' : emittedArgByParam[param.name],
  );
}

function collectMappingDisagreements(): string[] {
  const disagreements: string[] = [];

  for (const fnName of HOST_STD_FUNCTION_NAMES) {
    const mapping = TA_FUNCTION_MAPPINGS[`ta.${fnName}`];
    const contract = HOST_STD_CONTRACT[fnName];
    const expectedArgCount = contract.params.length - 1;
    const firstNonContextParam = contract.params.find((param) => !param.isContext);
    const expectedNeedsSeries = firstNonContextParam?.kind === 'series';

    if (!mapping) {
      disagreements.push(`ta.${fnName}: missing mapping entry`);
      continue;
    }

    if (mapping.stdName !== contract.stdName) {
      disagreements.push(
        `ta.${fnName}: mapping stdName=${mapping.stdName} but Host contract expects ${contract.stdName}`,
      );
    }

    if (mapping.contextArg !== true) {
      disagreements.push(
        `ta.${fnName}: mapping contextArg=${String(mapping.contextArg)} but Host contract requires context last`,
      );
    }

    if (mapping.argCount !== expectedArgCount) {
      disagreements.push(
        `ta.${fnName}: mapping argCount=${String(mapping.argCount)} but Host contract expects ${expectedArgCount} non-context args`,
      );
    }

    if (
      typeof expectedNeedsSeries === 'boolean' &&
      mapping.needsSeries !== expectedNeedsSeries
    ) {
      disagreements.push(
        `ta.${fnName}: mapping needsSeries=${String(mapping.needsSeries)} but first Host param "${firstNonContextParam?.name}" is ${expectedNeedsSeries ? 'series-backed' : 'scalar'}`,
      );
    }
  }

  return disagreements;
}

describe('Host Std contract — emitted TA call shapes', () => {
  for (const fnName of HOST_STD_FUNCTION_NAMES) {
    it(`emits ${HOST_STD_CONTRACT[fnName].stdName} with Host arg order`, () => {
      const result = transpileToPineJS(
        buildSource(fnName),
        `${fnName}_host_contract`,
        `${fnName} host contract`,
      );

      expect(result.success).toBe(true);
      expect(result.indicatorFactory?.__pineJsBody).toBeDefined();

      const body = result.indicatorFactory?.__pineJsBody;
      if (!body) {
        throw new Error('__pineJsBody was not attached');
      }

      const contract = HOST_STD_CONTRACT[fnName];
      const emittedArgs = extractStdCallArgs(body, fnName);
      const expectedArgs = expectedArgsFor(fnName, contract.params);

      expect(contract.contextParamIndex).toBe(contract.params.length - 1);
      expect(contract.params.at(contract.contextParamIndex)?.isContext).toBe(true);
      expect(emittedArgs).toHaveLength(contract.params.length);
      expect(emittedArgs.at(-1)).toBe('context');
      expect(emittedArgs.slice(0, -1)).not.toContain('context');
      expect(emittedArgs).toEqual(expectedArgs);
    });
  }
});

describe('Host Std contract — TA mapping findings', () => {
  // Tracked disagreements between src/mappings/technical-analysis.ts metadata and the
  // vendored Host contract. These are findings to resolve during the registry
  // consolidation (ADR-0001), NOT silently-accepted bugs. This allowlist RATCHETS:
  // a NEW disagreement fails the test (a real regression), and FIXING a tracked one
  // also fails it (forcing this list to shrink). The list must stay exact.
  const KNOWN_DISAGREEMENTS: readonly string[] = [
    'ta.correlation: mapping needsSeries=false but first Host param "sourceA" is series-backed',
    'ta.cum: mapping needsSeries=true but first Host param "n_value" is scalar',
    'ta.stoch: mapping needsSeries=false but first Host param "source" is series-backed',
    'ta.tr: mapping argCount=0 but Host contract expects 1 non-context args',
  ];

  it('has exactly the tracked set of mapping disagreements (no new, none silently fixed)', () => {
    const disagreements = collectMappingDisagreements();
    expect([...disagreements].sort()).toEqual([...KNOWN_DISAGREEMENTS].sort());
  });
});
