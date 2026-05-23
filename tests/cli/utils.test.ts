/**
 * CLI utilities tests — getVersion, getHelpText, deriveIndicatorId,
 * readInput, writeOutput, parseArguments.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  deriveIndicatorId,
  getHelpText,
  getVersion,
  parseArguments,
  readInput,
  writeOutput,
} from '../../src/cli/utils';

class ExitSignal extends Error {
  constructor(public readonly code: number | string | null | undefined) {
    super(`__cli_exit__:${code}`);
  }
}

describe('getVersion', () => {
  it('returns a semver-shaped string', () => {
    const v = getVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('is memoized across calls', () => {
    expect(getVersion()).toBe(getVersion());
  });
});

describe('getHelpText', () => {
  it('mentions every public command', () => {
    const text = getHelpText();
    expect(text).toContain('transpile');
    expect(text).toContain('validate');
    expect(text).toContain('check');
    expect(text).toContain('info');
  });

  it('documents all flag short forms', () => {
    const text = getHelpText();
    expect(text).toContain('-o, --output');
    expect(text).toContain('-f, --format');
    expect(text).toContain('-n, --name');
    expect(text).toContain('-i, --id');
    expect(text).toContain('-h, --help');
    expect(text).toContain('-v, --version');
  });
});

describe('deriveIndicatorId', () => {
  it('strips the .pine extension', () => {
    expect(deriveIndicatorId('my-script.pine')).toBe('my_script');
  });

  it('replaces non-identifier chars with underscores', () => {
    expect(deriveIndicatorId('hello world!.pine')).toBe('hello_world_');
  });

  it('handles a path with directories', () => {
    expect(deriveIndicatorId('/tmp/foo/bar.pine')).toBe('bar');
  });

  it('leaves alphanumeric and underscores unchanged', () => {
    expect(deriveIndicatorId('abc_123.pine')).toBe('abc_123');
  });
});

describe('parseArguments', () => {
  function withArgv<T>(args: string[], fn: () => T): T {
    const original = process.argv;
    process.argv = ['bun', 'pine-transpiler', ...args];
    try {
      return fn();
    } finally {
      process.argv = original;
    }
  }

  it('extracts the command and file positionals', () => {
    const parsed = withArgv(['transpile', 'foo.pine'], () => parseArguments());
    expect(parsed.command).toBe('transpile');
    expect(parsed.file).toBe('foo.pine');
  });

  it('parses --format and --output flags', () => {
    const parsed = withArgv(
      ['transpile', 'x.pine', '--format', 'pinejs', '--output', 'out.js'],
      () => parseArguments(),
    );
    expect(parsed.options.format).toBe('pinejs');
    expect(parsed.options.output).toBe('out.js');
  });

  it('parses --name and --id flags', () => {
    const parsed = withArgv(
      ['transpile', 'x.pine', '--name', 'MyName', '--id', 'my_id'],
      () => parseArguments(),
    );
    expect(parsed.options.name).toBe('MyName');
    expect(parsed.options.id).toBe('my_id');
  });

  it('parses --help and --version booleans', () => {
    const helpParsed = withArgv(['--help'], () => parseArguments());
    expect(helpParsed.options.help).toBe(true);

    const versionParsed = withArgv(['--version'], () => parseArguments());
    expect(versionParsed.options.version).toBe(true);
  });

  it('defaults format to "js" when not provided', () => {
    const parsed = withArgv(['transpile', 'x.pine'], () => parseArguments());
    expect(parsed.options.format).toBe('js');
  });

  it('returns an empty command when no positionals are given', () => {
    const parsed = withArgv([], () => parseArguments());
    expect(parsed.command).toBe('');
  });
});

describe('readInput / writeOutput', () => {
  let workDir: string;
  let stdoutSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const toText = (chunk: unknown): string => {
    if (typeof chunk === 'string') return chunk;
    if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString('utf8');
    return String(chunk);
  };

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'pine-utils-test-'));
    stdoutChunks.length = 0;
    stderrChunks.length = 0;
    stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(
      ((chunk: unknown) => {
        stdoutChunks.push(toText(chunk));
        return true;
      }) as never,
    );
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(
      ((chunk: unknown) => {
        stderrChunks.push(toText(chunk));
        return true;
      }) as never,
    );
    exitSpy = spyOn(process, 'exit').mockImplementation(((
      code?: number | string | null,
    ) => {
      throw new ExitSignal(code);
    }) as never);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('readInput returns file contents', () => {
    const file = join(workDir, 'x.pine');
    writeFileSync(file, 'hello pine', 'utf-8');
    expect(readInput(file)).toBe('hello pine');
  });

  it('readInput exits 1 when the file does not exist', () => {
    const missing = join(workDir, 'nope.pine');
    let signal: ExitSignal | undefined;
    try {
      readInput(missing);
    } catch (e) {
      if (e instanceof ExitSignal) signal = e;
    }
    expect(signal?.code).toBe(1);
  });

  it('writeOutput writes to a file when path is provided', () => {
    const out = join(workDir, 'out.js');
    writeOutput('factory body', out);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, 'utf-8')).toBe('factory body');
  });

  it('writeOutput writes to stdout when no path is provided', () => {
    writeOutput('inline content');
    expect(stdoutChunks.join('')).toContain('inline content');
  });
});
