import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildVisualArtifact,
  VISUAL_BASELINE_FIXTURES,
} from '../../scripts/corpus/visual-artifact';

const UPDATE_SNAPSHOTS = process.env.UPDATE_VISUAL_SNAPSHOTS === '1';
const SNAPSHOT_DIR = join(import.meta.dir, '../corpus/visual-snapshots');

function snapshotPathFor(fixture: string): string {
  return join(SNAPSHOT_DIR, fixture.replace(/\.pine$/, '.visual.json'));
}

if (!existsSync(SNAPSHOT_DIR)) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

describe('visual parity baseline', () => {
  for (const fixture of VISUAL_BASELINE_FIXTURES) {
    it(`${fixture} matches visual snapshot`, () => {
      const artifact = buildVisualArtifact(fixture);
      const actual = `${JSON.stringify(artifact, null, 2)}\n`;
      const snapPath = snapshotPathFor(fixture);

      if (!existsSync(snapPath) || UPDATE_SNAPSHOTS) {
        writeFileSync(snapPath, actual);
        return;
      }

      const expected = readFileSync(snapPath, 'utf8');
      expect(actual).toBe(expected);
    });
  }
});
