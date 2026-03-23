/**
 * Output Validator
 *
 * 4-stage validation of transpiler output before it is handed to the
 * indicator factory. Catches silent failures that would otherwise surface
 * as browser errors inside TradingView's charting library.
 *
 * Stage 1 — JS syntax check (uses `new Function` — intentional; this is safe
 *           because the input is our own transpiler output, not arbitrary user
 *           code. The function body is never called, only parsed by the engine.)
 * Stage 2 — Pine namespace leak detection
 * Stage 3 — Injected helper integrity
 * Stage 4 — Confidence score
 */

import type { ValidationIssue, ValidationResult } from '../types';

/**
 * Strip string literals from JS source so regex-based leak detection
 * doesn't produce false positives on content inside strings.
 */
function stripStringLiterals(src: string): string {
  return src.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
    '""',
  );
}

// Pine constructs that should have been transpiled away
const PINE_NAMESPACE_LEAKS: Array<{ re: RegExp; label: string }> = [
  { re: /\bta\.[a-z_]+\s*\(/, label: "unmapped 'ta.*' call" },
  { re: /\bmath\.[a-z_]+\s*\(/, label: "unmapped 'math.*' call" },
  // 'na' as standalone identifier (not part of NaN, function name, property)
  {
    re: /(?<![A-Za-z0-9_])na(?![A-Za-z0-9_=:()])/,
    label: "Pine 'na' identifier not converted",
  },
];

/**
 * Validate transpiler output before handing it to the indicator factory.
 *
 * @param mainBody - The transpiled JavaScript body string
 * @param helpers - Booleans indicating which helpers were injected
 */
export function validateOutput(
  mainBody: string,
  helpers: { needsMath: boolean; needsSession: boolean; needsStdPlus: boolean },
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // -------------------------------------------------------------------------
  // Stage 1 — JavaScript syntax check
  // -------------------------------------------------------------------------
  try {
    // eslint-disable-next-line no-new-func
    new Function(mainBody);
  } catch (e) {
    issues.push({
      stage: 'syntax',
      message: `Generated JS has a syntax error: ${e instanceof Error ? e.message : String(e)}`,
    });
    // Fatal — no point running further stages on unparseable code
    return { valid: false, confidence: 0, issues };
  }

  // -------------------------------------------------------------------------
  // Stage 2 — Pine namespace leak detection
  // Strip string literals first so that e.g. "na" inside a title string
  // doesn't trigger a false positive.
  // -------------------------------------------------------------------------
  const strippedBody = stripStringLiterals(mainBody);
  for (const { re, label } of PINE_NAMESPACE_LEAKS) {
    if (re.test(strippedBody)) {
      issues.push({
        stage: 'pine-leak',
        message: `Transpiler output contains ${label}`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Stage 3 — Injected helper integrity
  // -------------------------------------------------------------------------
  const usesStdPlus = mainBody.includes('StdPlus.');
  if (usesStdPlus && !helpers.needsStdPlus) {
    issues.push({
      stage: 'helper-integrity',
      message:
        "Output references 'StdPlus.*' but StdPlus helper was not injected into the preamble",
    });
  }

  const usesMathHelpers =
    mainBody.includes('_avg(') ||
    mainBody.includes('_sum(') ||
    mainBody.includes('_toDegrees(') ||
    mainBody.includes('_toRadians(') ||
    mainBody.includes('_roundToMintick(');
  if (usesMathHelpers && !helpers.needsMath) {
    issues.push({
      stage: 'helper-integrity',
      message:
        'Output references math helper functions but math helpers were not injected into the preamble',
    });
  }

  // -------------------------------------------------------------------------
  // Stage 3b — Series safety (ported from Pine-A-Script reviewer)
  // Bracket indexing on series (e.g. `close[1]`) should have been converted
  // to `_getHistorical_*()` calls. Raw bracket access suggests a missed
  // conversion.
  // -------------------------------------------------------------------------
  const seriesBracketPattern =
    /\b(close|open|high|low|volume|hl2|hlc3|ohlc4)\s*\[\s*\d+\s*\]/;
  if (seriesBracketPattern.test(strippedBody)) {
    issues.push({
      stage: 'helper-integrity',
      message:
        'Output contains raw bracket indexing on a price series (e.g. close[1]) — should use _getHistorical_* or Std offset',
    });
  }

  // -------------------------------------------------------------------------
  // Stage 4 — Confidence score
  // -------------------------------------------------------------------------
  const seriousIssues = issues.length;
  const confidence = Math.max(0, 1.0 - seriousIssues * 0.3);

  return {
    valid: confidence >= 0.5,
    confidence,
    issues,
  };
}
