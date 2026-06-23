import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'bun:test';
import {
  SUPPORTED_SURFACE_DOC_PATH,
  renderSupportedSurfaceDoc,
} from '../../src/registry/supported-surface';

describe('supported Pine surface docs', () => {
  it('match the committed registry-derived markdown exactly', () => {
    const committedDoc = readFileSync(SUPPORTED_SURFACE_DOC_PATH, 'utf8');
    expect(renderSupportedSurfaceDoc()).toBe(committedDoc);
  });
});
