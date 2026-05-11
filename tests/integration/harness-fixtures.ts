import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const HARNESS_FIXTURE_DIR = join(process.cwd(), 'fixtures');

export function listHarnessFixtures(): string[] {
  return readdirSync(HARNESS_FIXTURE_DIR)
    .filter((name) => name.endsWith('.pine'))
    .sort();
}
