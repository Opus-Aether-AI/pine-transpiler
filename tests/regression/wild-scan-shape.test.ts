import { afterEach, describe, expect, it } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  runWildScan,
  writeWildScanArtifacts,
} from '../../scripts/corpus/wild-scan';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = join(
    process.cwd(),
    '.tmp',
    `wild-scan-shape-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('wild scan report shape', () => {
  it('emits clustered report json+md shape without fixture source leakage', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'pass.pine'),
      `//@version=5
indicator("Pass")
plot(ta.sma(close, 14))
`,
    );
    writeFileSync(
      join(dir, 'warn.pine'),
      `//@version=5
indicator("Warn")
strategy.entry("L", strategy.long)
plot(close)
`,
    );
    writeFileSync(
      join(dir, 'fail.pine'),
      `//@version=5
indicator("Fail")
value = ta.percentile_nearest_rank(close, 14, 50)
plot(value)
`,
    );

    const report = runWildScan({
      sourceDir: dir,
      topExamples: 2,
    });
    const artifacts = writeWildScanArtifacts(report);

    expect(report.totalScripts).toBe(3);
    expect(report.passCount).toBe(1);
    expect(report.warnCount).toBe(1);
    expect(report.failCount).toBe(1);
    expect(Array.isArray(report.clusters)).toBe(true);
    expect(report.clusters.length).toBeGreaterThan(0);
    expect(typeof report.clusters[0]?.key).toBe('string');
    expect(report.clusters[0]?.count).toBeGreaterThan(0);
    expect(Array.isArray(report.clusters[0]?.examples)).toBe(true);

    expect(existsSync(artifacts.jsonPath)).toBe(true);
    expect(existsSync(artifacts.mdPath)).toBe(true);
    const parsedJson = JSON.parse(readFileSync(artifacts.jsonPath, 'utf8')) as {
      scripts?: unknown[];
      clusters?: unknown[];
    };
    expect(Array.isArray(parsedJson.scripts)).toBe(true);
    expect(Array.isArray(parsedJson.clusters)).toBe(true);

    const markdown = readFileSync(artifacts.mdPath, 'utf8');
    expect(markdown).toContain('# Wild Scan Report');
    expect(markdown).not.toContain('indicator("Fail")');
    expect(markdown).toContain('ta.percentile_nearest_rank');
  });
});
