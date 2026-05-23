import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandCheck } from '../../src/cli/commands/check';

class ExitSignal extends Error {
  constructor(public readonly code: number | string | null | undefined) {
    super(`__cli_exit__:${code}`);
  }
}

function captureCliIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitSpy = spyOn(process, 'exit').mockImplementation(((
    code?: number | string | null,
  ) => {
    throw new ExitSignal(code);
  }) as never);
  const stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(
    ((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }) as never,
  );
  const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(
    ((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }) as never,
  );

  return {
    run(fn: () => void): { code: number; stdout: string; stderr: string } {
      stdout.length = 0;
      stderr.length = 0;
      try {
        fn();
        return { code: 0, stdout: stdout.join(''), stderr: stderr.join('') };
      } catch (error) {
        if (error instanceof ExitSignal) {
          return {
            code: typeof error.code === 'number' ? error.code : 0,
            stdout: stdout.join(''),
            stderr: stderr.join(''),
          };
        }
        throw error;
      }
    },
    restore(): void {
      exitSpy.mockRestore();
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    },
  };
}

function writeFixture(dir: string, name: string, source: string): string {
  const path = join(dir, name);
  writeFileSync(path, source, 'utf-8');
  return path;
}

let workDir: string;
let io: ReturnType<typeof captureCliIo>;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'pine-preflight-test-'));
  io = captureCliIo();
});

afterEach(() => {
  io.restore();
  rmSync(workDir, { recursive: true, force: true });
});

describe('commandCheck', () => {
  it('returns PASS (exit 0) for compatible scripts', () => {
    const file = writeFixture(
      workDir,
      'pass.pine',
      `//@version=5
indicator("Pass")
plot(ta.sma(close, 14))
`,
    );

    const result = io.run(() => commandCheck(file, {}));
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Compatibility: PASS');
  });

  it('returns WARN (exit 2) for partial/unsupported usage without hard failures', () => {
    const file = writeFixture(
      workDir,
      'warn.pine',
      `//@version=5
indicator("Warn")
strategy.entry("L", strategy.long)
plot(close)
`,
    );

    const result = io.run(() => commandCheck(file, {}));
    expect(result.code).toBe(2);
    expect(result.stdout).toContain('Compatibility: WARN');
    expect(result.stdout).toContain('strategy.* is not supported');
  });

  it('returns FAIL (exit 1) for unmapped std calls', () => {
    const file = writeFixture(
      workDir,
      'fail.pine',
      `//@version=5
indicator("Fail")
value = ta.percentile_nearest_rank(close, 14, 50)
plot(value)
`,
    );

    const result = io.run(() => commandCheck(file, {}));
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('Compatibility: FAIL');
    expect(result.stdout).toContain('ta.percentile_nearest_rank');
  });
});
