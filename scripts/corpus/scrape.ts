#!/usr/bin/env bun
/**
 * Scrape real-world Pine v5/v6 scripts from cloned source repos into
 * the corpus' community/ subtree.
 *
 *   bun scripts/corpus/scrape.ts
 *
 * Expects the repos to already be checked out under
 * /tmp/pine-corpus-sources/<repo>/. The scraper walks each repo for
 * `.pine` and `.txt` files, filters to scripts whose first 10 lines
 * contain `//@version=5` or `//@version=6`, deduplicates by content
 * hash, prepends a one-line attribution header, and writes them into
 * `tests/corpus/community/<repo>/`.
 *
 * Community fixtures are NOT snapshot-tested — they're a stress test
 * for the transpiler's coverage of real-world Pine. corpus.test.ts
 * walks them but skips the snapshot assertion; the report script
 * tallies pass/fail per source so we can spot which transpiler gaps
 * the scraped corpus exposes.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';

interface SourceConfig {
  /** Repo slug, e.g. "everget/chart-host-pinescript-indicators". */
  slug: string;
  /** Local clone path under /tmp/pine-corpus-sources/. */
  dir: string;
  /** Short label for the community/<label> directory. */
  label: string;
  /** Cap the number of fixtures pulled from this source. */
  cap?: number;
}

const SOURCES: SourceConfig[] = [
  {
    slug: 'everget/chart-host-pinescript-indicators',
    dir: '/tmp/pine-corpus-sources/chart-host-pinescript-indicators',
    label: 'everget',
    cap: 80,
  },
  {
    slug: 'f13end/chart-host-custom-indicators',
    dir: '/tmp/pine-corpus-sources/chart-host-custom-indicators',
    label: 'f13end',
    cap: 60,
  },
  {
    slug: 'pinecoders/pine-utils',
    dir: '/tmp/pine-corpus-sources/pine-utils',
    label: 'pinecoders',
    cap: 20,
  },
  {
    slug: 'ArunKBhaskar/PineScript',
    dir: '/tmp/pine-corpus-sources/PineScript',
    label: 'arunkbhaskar',
    cap: 30,
  },
];

const DEST_ROOT = join(
  import.meta.dir,
  '..',
  '..',
  'tests',
  'corpus',
  'community',
);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.pine') || entry.endsWith('.txt')) {
      out.push(full);
    }
  }
  return out;
}

function isV5OrV6(source: string): boolean {
  const head = source.split('\n', 30).join('\n');
  return /\/\/@version\s*=\s*[56]\b/.test(head);
}

function sanitizeFilename(name: string): string {
  // Drop weird chars, normalize spaces and brackets to underscores so
  // shell tools and snapshot diffs don't choke on the filenames.
  return name
    .replace(/\.(txt|pine)$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

function attributionHeader(slug: string, relPath: string): string {
  return [
    `// Source: github.com/${slug}/${relPath.split('/').map(encodeURIComponent).join('/')}`,
    "// Vendored as a corpus fixture. License is the repo's — see the upstream LICENSE.",
    '',
  ].join('\n');
}

interface ScrapeResult {
  sourceLabel: string;
  found: number;
  keptByVersion: number;
  keptAfterDedup: number;
  written: number;
}

function scrapeOne(cfg: SourceConfig, seenHashes: Set<string>): ScrapeResult {
  const dest = join(DEST_ROOT, cfg.label);
  mkdirSync(dest, { recursive: true });

  const files = walk(cfg.dir);
  let keptByVersion = 0;
  let keptAfterDedup = 0;
  let written = 0;

  const candidates: Array<{ source: string; relPath: string }> = [];
  for (const f of files) {
    const source = readFileSync(f, 'utf8');
    if (!isV5OrV6(source)) continue;
    keptByVersion++;
    const hash = createHash('sha256').update(source).digest('hex');
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);
    keptAfterDedup++;
    const relPath = relative(cfg.dir, f);
    candidates.push({ source, relPath });
  }

  const cap = cfg.cap ?? Number.POSITIVE_INFINITY;
  for (const { source, relPath } of candidates.slice(0, cap)) {
    const filename = `${sanitizeFilename(basename(relPath))}.pine`;
    const out = `${attributionHeader(cfg.slug, relPath)}${source}`;
    writeFileSync(join(dest, filename), out);
    written++;
  }

  return {
    sourceLabel: cfg.label,
    found: files.length,
    keptByVersion,
    keptAfterDedup,
    written,
  };
}

function main(): void {
  if (!existsSync(DEST_ROOT)) mkdirSync(DEST_ROOT, { recursive: true });
  const seenHashes = new Set<string>();
  const results: ScrapeResult[] = [];
  for (const cfg of SOURCES) {
    if (!existsSync(cfg.dir)) {
      console.error(
        `! ${cfg.label}: source dir ${cfg.dir} not present — skipping`,
      );
      continue;
    }
    const r = scrapeOne(cfg, seenHashes);
    results.push(r);
  }

  console.log('# Scrape Report');
  console.log('');
  console.log('| Source | Found | v5/v6 | Unique | Written |');
  console.log('|---|---:|---:|---:|---:|');
  let totalWritten = 0;
  for (const r of results) {
    console.log(
      `| ${r.sourceLabel} | ${r.found} | ${r.keptByVersion} | ${r.keptAfterDedup} | ${r.written} |`,
    );
    totalWritten += r.written;
  }
  console.log('');
  console.log(`Total fixtures written: **${totalWritten}**`);
}

main();
