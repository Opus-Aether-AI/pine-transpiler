#!/usr/bin/env bun
/**
 * Debug a single corpus fixture: prints declared vs actual plot count
 * and the lastPlotOutput array so we can see where extras come from.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileToPineJS } from '../../src/index';
import { createMockRuntime } from '../../tests/corpus/mock-runtime';

const fixture = process.argv[2];
if (!fixture) {
    console.error('usage: bun scripts/corpus/debug-fixture.ts <fixture>');
    process.exit(1);
}

const path = join(import.meta.dir, '..', '..', 'tests', 'corpus', 'fixtures', fixture);
const source = readFileSync(path, 'utf8');

const result = transpileToPineJS(source, fixture.replace(/[^a-z0-9]/gi, '_'), fixture);
if (!result.success || !result.indicatorFactory) {
    console.error('transpile failed:', result.error);
    process.exit(1);
}

const runtime = createMockRuntime({ barCount: 50 });
const indicator = result.indicatorFactory(runtime.pineJs);
const declared = (indicator.metainfo as { plots?: unknown[] }).plots?.length ?? 0;
console.log('declared plots:', declared);
console.log('plots metainfo:', JSON.stringify((indicator.metainfo as { plots?: unknown[] }).plots, null, 2));

const ctor = (indicator.constructor as () => { main: (c: unknown, i: unknown) => unknown });
const constructed = ctor();
const main = constructed.main as (
    ctx: unknown,
    cb: (i: number) => number,
) => unknown;

for (let i = 0; i < runtime.totalBars; i++) {
    runtime.resetVarPointer();
    runtime.resetCurrentBarPlots();
    const r = main(runtime.context, () => 14);
    if (i === runtime.totalBars - 1) {
        console.log('--- LAST BAR ---');
        console.log('main return (factory _plotValues):', r);
        console.log('mock currentBarPlots:', runtime.currentBarPlots);
    }
    runtime.advanceBar();
}
