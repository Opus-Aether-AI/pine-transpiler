import type { DiscoveredFixture } from './list-fixtures';

export type FixtureLane =
  | 'curated_core'
  | 'upstream_authentic'
  | 'synthetic_custom'
  | 'quarantine';

export type FixtureAuthenticity = 'authentic' | 'proxy' | 'synthetic';

export type FixtureCategory =
  | 'core_ta'
  | 'smc_ict'
  | 'mtf'
  | 'visual'
  | 'datastruct'
  | 'session_time'
  | 'other';

export interface FixtureMeta {
  fixture: string;
  group: string;
  name: string;
  source: string;
  lane: FixtureLane;
  authenticity: FixtureAuthenticity;
  category: FixtureCategory;
  features: string[];
  note?: string;
}

interface GroupDefaults {
  source: string;
  lane: FixtureLane;
  authenticity: FixtureAuthenticity;
  category: FixtureCategory;
}

const GROUP_DEFAULTS: Record<string, GroupDefaults> = {
  curated: {
    source: 'pine-transpiler-curated',
    lane: 'curated_core',
    authenticity: 'synthetic',
    category: 'core_ta',
  },
  arunkbhaskar: {
    source: 'tradingview-community:arunkbhaskar',
    lane: 'upstream_authentic',
    authenticity: 'authentic',
    category: 'smc_ict',
  },
  everget: {
    source: 'tradingview-community:everget',
    lane: 'upstream_authentic',
    authenticity: 'authentic',
    category: 'core_ta',
  },
  f13end: {
    source: 'tradingview-community:f13end',
    lane: 'upstream_authentic',
    authenticity: 'authentic',
    category: 'core_ta',
  },
  harryguiacorn: {
    source: 'tradingview-community:harryguiacorn',
    lane: 'upstream_authentic',
    authenticity: 'authentic',
    category: 'core_ta',
  },
  top100: {
    source: 'top100-target-suite',
    lane: 'quarantine',
    authenticity: 'proxy',
    category: 'other',
  },
  top200: {
    source: 'top200-extended-suite',
    lane: 'synthetic_custom',
    authenticity: 'synthetic',
    category: 'other',
  },
};

const DEFAULTS_FALLBACK: GroupDefaults = {
  source: 'unknown',
  lane: 'quarantine',
  authenticity: 'proxy',
  category: 'other',
};

interface ManifestOverride {
  source?: string;
  lane?: FixtureLane;
  authenticity?: FixtureAuthenticity;
  category?: FixtureCategory;
  features?: string[];
  note?: string;
}

/**
 * Optional fixture-level overrides.
 * Keep sparse: defaults + feature extraction should handle most entries.
 */
const FIXTURE_OVERRIDES: Record<string, ManifestOverride> = {
  // Example for future promotions:
  // 'top100/some_script.pine': { lane: 'upstream_authentic', authenticity: 'authentic' },
};

const FEATURE_PATTERNS: Array<{ feature: string; re: RegExp }> = [
  { feature: 'request.security', re: /\brequest\.security\b/ },
  { feature: 'request.external', re: /\brequest\.(financial|economic|earnings|dividends|splits|quandl|seed)\b/ },
  { feature: 'mtf.timeframe', re: /\btimeframe\.|\binput\.timeframe\b/ },
  { feature: 'drawing.line', re: /\bline\./ },
  { feature: 'drawing.label', re: /\blabel\./ },
  { feature: 'drawing.box', re: /\bbox\./ },
  { feature: 'drawing.table', re: /\btable\./ },
  { feature: 'drawing.polyline', re: /\bpolyline\./ },
  { feature: 'plotshape', re: /\bplotshape\b/ },
  { feature: 'plotchar', re: /\bplotchar\b/ },
  { feature: 'plotarrow', re: /\bplotarrow\b/ },
  { feature: 'bgcolor', re: /\bbgcolor\b/ },
  { feature: 'barcolor', re: /\bbarcolor\b/ },
  { feature: 'fill', re: /\bfill\b/ },
  { feature: 'hline', re: /\bhline\b/ },
  { feature: 'map', re: /\bmap\./ },
  { feature: 'matrix', re: /\bmatrix\./ },
  { feature: 'array', re: /\barray\./ },
  { feature: 'session', re: /\bsession\./ },
  { feature: 'time', re: /\btime_close\b|\btime_tradingday\b|\btime\b/ },
  { feature: 'barstate', re: /\bbarstate\./ },
  { feature: 'alert', re: /\balertcondition\b|\balert\(/ },
  { feature: 'strategy', re: /\bstrategy\./ },
  { feature: 'smc_ict_terms', re: /\b(BOS|CHoCH|CHOCH|FVG|ICT|MSS|liquidity|order block|breaker|mitigation)\b/i },
];

export function extractFeaturesFromSource(source: string): string[] {
  const features: string[] = [];
  for (const p of FEATURE_PATTERNS) {
    if (p.re.test(source)) features.push(p.feature);
  }
  return features.sort();
}

function inferCategory(
  fixtureId: string,
  features: string[],
  fallback: FixtureCategory,
): FixtureCategory {
  const id = fixtureId.toLowerCase();
  const has = (f: string) => features.includes(f);

  if (
    has('smc_ict_terms') ||
    /\b(ict|smc|bos|choch|fvg|mss|liquidity|order[_-]?block)\b/.test(id)
  ) {
    return 'smc_ict';
  }
  if (has('request.security') || has('mtf.timeframe') || /\bmtf\b/.test(id)) {
    return 'mtf';
  }
  if (
    has('drawing.line') ||
    has('drawing.label') ||
    has('drawing.box') ||
    has('drawing.table') ||
    has('drawing.polyline') ||
    has('plotshape') ||
    has('plotchar') ||
    has('plotarrow') ||
    has('bgcolor') ||
    has('fill') ||
    has('barcolor')
  ) {
    return 'visual';
  }
  if (has('map') || has('matrix') || has('array')) {
    return 'datastruct';
  }
  if (has('session') || has('time') || has('barstate')) {
    return 'session_time';
  }
  if (/\b(ema|sma|rsi|macd|atr|stoch|vwap|wpr|mfi|cci|roc|qqe|supertrend)\b/.test(id)) {
    return 'core_ta';
  }
  return fallback;
}

export function resolveFixtureMeta(
  fixture: DiscoveredFixture,
  source: string,
): FixtureMeta {
  const fixtureId = `${fixture.group}/${fixture.name}`;
  const defaults = GROUP_DEFAULTS[fixture.group] ?? DEFAULTS_FALLBACK;
  const override = FIXTURE_OVERRIDES[fixtureId];

  const detectedFeatures = extractFeaturesFromSource(source);
  const features = override?.features
    ? Array.from(new Set([...detectedFeatures, ...override.features])).sort()
    : detectedFeatures;

  const fallbackCategory = override?.category ?? defaults.category;
  const category = inferCategory(fixtureId, features, fallbackCategory);

  return {
    fixture: fixtureId,
    group: fixture.group,
    name: fixture.name,
    source: override?.source ?? defaults.source,
    lane: override?.lane ?? defaults.lane,
    authenticity: override?.authenticity ?? defaults.authenticity,
    category,
    features,
    note: override?.note,
  };
}

export function resolveFixtureMetaFromId(
  fixtureId: string,
  source: string,
): FixtureMeta {
  const slash = fixtureId.indexOf('/');
  const group = slash >= 0 ? fixtureId.slice(0, slash) : 'unknown';
  const name = slash >= 0 ? fixtureId.slice(slash + 1) : fixtureId;
  return resolveFixtureMeta({ group, name, path: '' }, source);
}
