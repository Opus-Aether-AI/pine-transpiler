/**
 * CSP-eval error classification.
 *
 * Both `transpileToPineJS` and the factory closure inside
 * `buildIndicatorFactory` instantiate the transpiled body via
 * `new Function(...)`. Strict Content-Security-Policy environments
 * block that and surface an error whose phrasing varies by engine.
 *
 * This module is the single source of truth for:
 *  - detecting that an unknown error came from a CSP eval block, and
 *  - appending the actionable hint that points users to
 *    `transpileToStandaloneFactory(...)` as the CSP-safe path.
 *
 * Two adapters consume it today: the public `transpileToPineJS` entry
 * (string-return form, used in `{success: false, error: string}`
 * results) and the factory builder (in-place mutation form, used when
 * re-throwing a typed `Error`).
 */
/**
 * Canonical hint appended to CSP-blocked errors. Mentioned here so the
 * exact phrasing lives in one place and matches what tests assert on.
 */
export declare const CSP_EVAL_HINT = "CSP blocked dynamic compilation (`new Function`). Use `transpileToStandaloneFactory(...)` (or CLI `pine-transpiler transpile --format factory`) and load the generated module at build-time.";
/**
 * Classify an arbitrary error as a CSP-eval rejection. Returns `true`
 * for the engine-specific phrasings we've seen ("unsafe-eval",
 * "Content Security Policy", "EvalError: Refused to evaluate a string
 * as JavaScript", etc.).
 */
export declare function isUnsafeEvalCspError(error: unknown): boolean;
/**
 * String-return form: return `error.message` enriched with the CSP
 * hint when applicable. Used by `{success: false, error: string}`
 * result shapes that don't carry the original Error instance.
 */
export declare function withCspEvalHint(error: unknown): string;
/**
 * In-place mutation form: append the CSP hint to a typed `Error`'s
 * message (idempotent — won't re-append on a second pass) and return
 * the same instance. Used by code paths that re-throw the original
 * Error rather than constructing a fresh result object.
 */
export declare function appendCspHint(error: Error): Error;
//# sourceMappingURL=csp-errors.d.ts.map