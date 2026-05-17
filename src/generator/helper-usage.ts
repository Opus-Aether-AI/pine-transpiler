/**
 * Helper-usage tracking.
 *
 * Runtime helpers (math, session, StdPlus, array, map, matrix, color,
 * string, utility, state) are emitted into the generated body whenever
 * the corresponding Pine builtin is called — e.g. `ta.sma(close, n)`
 * does not need a helper, but `array.push(arr, v)` is emitted as
 * `_arrayPush(arr, v)`, which requires `ARRAY_HELPER_FUNCTIONS` in
 * the preamble.
 *
 * Historically, `analyzeRequiredHelpers(mainBody: string)` in
 * `src/factory/indicator-factory.ts` scanned the generated body for
 * marker substrings (e.g. `mainBody.includes('_arrayPush(')`) to decide
 * which helper libraries to inject. That works but is brittle: adding
 * a new helper means updating the marker list in lockstep with the
 * mapping table, and substring matches inside string literals could
 * produce false positives.
 *
 * `HelperUsage` is the alternative: the generator records which helper
 * categories it actually emitted, and `generatePreamble` consults that
 * record directly. The mapping table — where helper names already
 * live — is now the single source of truth.
 *
 * The string-grep fallback remains in `analyzeRequiredHelpers` for
 * external callers of `buildIndicatorFactory` / `generateStandaloneFactory`
 * that don't supply a `helperUsage`. New internal paths go through the
 * pipeline, which always supplies one.
 */

export type HelperCategory =
  | 'math'
  | 'session'
  | 'stdplus'
  | 'array'
  | 'map'
  | 'matrix'
  | 'color'
  | 'string'
  | 'utility'
  | 'state';

export interface HelperUsageRecord {
  needsMath: boolean;
  needsSession: boolean;
  needsStdPlus: boolean;
  needsArray: boolean;
  needsMap: boolean;
  needsMatrix: boolean;
  needsColor: boolean;
  needsString: boolean;
  needsUtility: boolean;
  needsState: boolean;
}

/**
 * Classify a helper identifier into its category by prefix or exact
 * name. Returns null for identifiers that don't correspond to a
 * preamble-injected helper (e.g. `Std.sma`, `Math.abs`, user-defined
 * function names).
 *
 * Names are matched against the same set that
 * `src/factory/indicator-factory.ts#analyzeRequiredHelpers` checks for —
 * keeping the two in sync is the whole point of this module.
 */
export function classifyHelperName(name: string): HelperCategory | null {
  if (name.startsWith('StdPlus.')) {
    return 'stdplus';
  }

  // Math helpers (`_pineSum` was renamed from `_sum` to avoid clashing
  // with user-defined `sum` symbols).
  if (
    name === '_avg' ||
    name === '_pineSum' ||
    name === '_toDegrees' ||
    name === '_toRadians' ||
    name === '_roundToMintick'
  ) {
    return 'math';
  }

  // Session/time helpers. Bar-state helpers (`_isLastBar`,
  // `_isConfirmedBar`, etc.) are intentionally NOT classified here:
  // they would belong to a `barstate` / `utility` category that the
  // current preamble logic does not have a switch for. Tracking them
  // would do nothing today.
  if (
    name === '_isInSession' ||
    name === '_isMarketSession' ||
    name === '_isPremarket' ||
    name === '_isPostmarket' ||
    name === '_getTimeClose' ||
    name === '_getTradingDayTime'
  ) {
    return 'session';
  }

  if (name.startsWith('_array')) {
    return 'array';
  }
  if (name.startsWith('_map')) {
    return 'map';
  }
  if (name.startsWith('_matrix')) {
    return 'matrix';
  }
  if (name.startsWith('_color')) {
    return 'color';
  }
  // _str helpers are camelCase (`_strContains`, `_strFormat`, etc.);
  // the underscore-followed-by-uppercase check matches the regex used
  // in the grep fallback (`/\b_str[A-Z]/`).
  if (/^_str[A-Z]/.test(name)) {
    return 'string';
  }

  if (name === '_pineNa' || name === '_pineNz' || name === '_pineFixnan') {
    return 'utility';
  }

  // Persistent-variable helpers emitted for Pine `var` / `varip`.
  // These are emitted directly by statement/expression generators
  // (not via the mapping table), so callers must hand them to
  // `markByName` themselves.
  if (
    name === '_pineVar' ||
    name === '_pineVarip' ||
    name === '_pineSetVar' ||
    name === '_pineSetVarip' ||
    name === '_pineScopeKey'
  ) {
    return 'state';
  }

  return null;
}

/**
 * Accumulating set of helper categories used during code generation.
 * Created fresh per transpilation; mutated by the generators at every
 * helper emission; consumed by the factory builder when assembling
 * the preamble.
 */
export class HelperUsage {
  private readonly categories = new Set<HelperCategory>();

  /** Mark a category as used. */
  mark(category: HelperCategory): void {
    this.categories.add(category);
  }

  /**
   * Classify an emitted helper identifier and mark its category as
   * used. Returns true if the identifier was a helper; false for
   * non-helper names (which is the common case — most calls are to
   * `Std.X` or user-defined functions).
   */
  markByName(name: string): boolean {
    const category = classifyHelperName(name);
    if (category === null) {
      return false;
    }
    this.categories.add(category);
    return true;
  }

  has(category: HelperCategory): boolean {
    return this.categories.has(category);
  }

  /**
   * Project the tracked set into the record shape that
   * `generatePreamble` consumes. Order mirrors the historical
   * `analyzeRequiredHelpers` return value so call sites are drop-in
   * substitutable.
   */
  toRecord(): HelperUsageRecord {
    return {
      needsMath: this.categories.has('math'),
      needsSession: this.categories.has('session'),
      needsStdPlus: this.categories.has('stdplus'),
      needsArray: this.categories.has('array'),
      needsMap: this.categories.has('map'),
      needsMatrix: this.categories.has('matrix'),
      needsColor: this.categories.has('color'),
      needsString: this.categories.has('string'),
      needsUtility: this.categories.has('utility'),
      needsState: this.categories.has('state'),
    };
  }

  /** Merge another tracker's categories into this one. */
  mergeFrom(other: HelperUsage): void {
    for (const category of other.categories) {
      this.categories.add(category);
    }
  }
}
