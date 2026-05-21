/**
 * CLI command tests.
 *
 * Exercises the actual `src/cli/commands/{transpile,validate,info}.ts`
 * paths by importing and invoking them with a temp file. Stubs
 * `process.exit` to throw a sentinel so we can assert exit codes
 * without terminating the test runner, and spies on `console.log` /
 * `console.error` to capture output.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandInfo } from '../../src/cli/commands/info';
import { commandTranspile } from '../../src/cli/commands/transpile';
import { commandValidate } from '../../src/cli/commands/validate';

class ExitSignal extends Error {
  constructor(public readonly code: number | string | null | undefined) {
    super(`__cli_exit__:${code}`);
  }
}

function captureExit(): {
  run: (fn: () => void) => {
    code: number | null;
    logs: string[];
    errors: string[];
  };
  restore: () => void;
} {
  const exitSpy = spyOn(process, 'exit').mockImplementation(((
    code?: number | string | null,
  ) => {
    throw new ExitSignal(code);
  }) as never);
  const logs: string[] = [];
  const errors: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.map((a) => String(a)).join(' '));
  });
  const errSpy = spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.map((a) => String(a)).join(' '));
  });
  return {
    run(fn) {
      logs.length = 0;
      errors.length = 0;
      try {
        fn();
        return { code: null, logs: [...logs], errors: [...errors] };
      } catch (e) {
        if (e instanceof ExitSignal) {
          const code = typeof e.code === 'number' ? e.code : 0;
          return { code, logs: [...logs], errors: [...errors] };
        }
        throw e;
      }
    },
    restore() {
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errSpy.mockRestore();
    },
  };
}

let workDir: string;
let captured: ReturnType<typeof captureExit>;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'pine-cli-test-'));
  captured = captureExit();
});

afterEach(() => {
  captured.restore();
  rmSync(workDir, { recursive: true, force: true });
});

function writeFixture(name: string, source: string): string {
  const path = join(workDir, name);
  writeFileSync(path, source, 'utf-8');
  return path;
}

const SMA_SOURCE = `//@version=5
indicator("SMA Basic", overlay=true)
length = input.int(20, "Length")
plot(ta.sma(close, length), "SMA", color=color.blue)
`;

describe('commandTranspile', () => {
  it('exits with error when no file is given', () => {
    const result = captured.run(() => commandTranspile(undefined, {}));
    expect(result.code).toBe(1);
    expect(result.errors.some((e) => e.includes('No input file'))).toBe(true);
  });

  it('default format=js writes transpiled body to stdout', () => {
    const file = writeFixture('sma.pine', SMA_SOURCE);
    const result = captured.run(() => commandTranspile(file, {}));
    expect(result.code).toBeNull();
    expect(result.logs.join('\n')).toContain('Std.sma');
  });

  it('format=js writes to an output file when --output is given', () => {
    const file = writeFixture('sma.pine', SMA_SOURCE);
    const out = join(workDir, 'out.js');
    const result = captured.run(() =>
      commandTranspile(file, { output: out, format: 'js' }),
    );
    expect(result.code).toBeNull();
    const written = readFileSync(out, 'utf-8');
    expect(written).toContain('Std.sma');
  });

  it('format=pinejs emits a createIndicator wrapper module', () => {
    const file = writeFixture('sma.pine', SMA_SOURCE);
    const out = join(workDir, 'sma.pinejs.js');
    const result = captured.run(() =>
      commandTranspile(file, {
        output: out,
        format: 'pinejs',
        name: 'SMA',
        id: 'sma_basic',
      }),
    );
    expect(result.code).toBeNull();
    const written = readFileSync(out, 'utf-8');
    expect(written).toContain('createIndicator');
    expect(written).toContain('@opus-aether-ai/pine-transpiler');
    expect(written).toContain('sma_basic');
  });

  it('format=factory emits a self-contained standalone factory', () => {
    const file = writeFixture('sma.pine', SMA_SOURCE);
    const out = join(workDir, 'sma.factory.js');
    const result = captured.run(() =>
      commandTranspile(file, { output: out, format: 'factory' }),
    );
    expect(result.code).toBeNull();
    const written = readFileSync(out, 'utf-8');
    expect(written).toContain('createIndicator');
    expect(written).toContain('metainfo');
  });

  it('exits with error on unknown format', () => {
    const file = writeFixture('sma.pine', SMA_SOURCE);
    const result = captured.run(() =>
      commandTranspile(file, { format: 'nonsense' }),
    );
    expect(result.code).toBe(1);
    expect(
      result.errors.some((e) => e.includes("Unknown format 'nonsense'")),
    ).toBe(true);
  });

  it('format=js reports a transpilation error on oversized source', () => {
    const file = writeFixture('huge.pine', 'x'.repeat(1_000_001));
    const result = captured.run(() => commandTranspile(file, { format: 'js' }));
    expect(result.code).toBe(1);
    expect(result.errors.some((e) => e.includes('Transpilation error'))).toBe(
      true,
    );
  });

  it('format=factory reports an error on oversized source', () => {
    const file = writeFixture('huge.pine', 'x'.repeat(1_000_001));
    const result = captured.run(() =>
      commandTranspile(file, { format: 'factory' }),
    );
    expect(result.code).toBe(1);
    expect(result.errors.some((e) => e.includes('Transpilation error'))).toBe(
      true,
    );
  });

  it('format=pinejs reports failure when the body itself fails to transpile', () => {
    const file = writeFixture('huge.pine', 'x'.repeat(1_000_001));
    const result = captured.run(() =>
      commandTranspile(file, { format: 'pinejs' }),
    );
    expect(result.code).toBe(1);
    expect(result.errors.some((e) => e.includes('Transpilation error'))).toBe(
      true,
    );
  });
});

describe('commandValidate', () => {
  it('exits with error when no file is given', () => {
    const result = captured.run(() => commandValidate(undefined, {}));
    expect(result.code).toBe(1);
    expect(result.errors.some((e) => e.includes('No input file'))).toBe(true);
  });

  it('exits 0 for valid Pine Script', () => {
    const file = writeFixture('valid.pine', SMA_SOURCE);
    const result = captured.run(() => commandValidate(file, {}));
    expect(result.code).toBe(0);
    expect(result.logs.some((l) => l.includes('is valid'))).toBe(true);
  });

  it('exits 1 with a reason when the parser rejects the input', () => {
    // canTranspilePineScript skips the pipeline's input-size check
    // (it calls Lexer/Parser directly). MAX_TOKEN_COUNT (100k) in the
    // parser is the next reliable failure mode — a script of repeated
    // assignments easily exceeds it.
    const file = writeFixture('huge.pine', 'x = 1\n'.repeat(60_000));
    const result = captured.run(() => commandValidate(file, {}));
    expect(result.code).toBe(1);
    expect(result.errors.some((e) => e.includes('syntax errors'))).toBe(true);
  });
});

describe('commandInfo', () => {
  it('prints supported features and mapping stats', () => {
    const result = captured.run(() => commandInfo());
    expect(result.code).toBeNull();
    const output = result.logs.join('\n');
    expect(output).toContain('Pine Script Transpiler');
    expect(output).toContain('Technical Analysis');
    expect(output).toContain('Supported Features');
  });
});
