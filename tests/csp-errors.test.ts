/**
 * CSP error classification tests — pin the detection of the engine-
 * specific phrasings ("unsafe-eval", "Content Security Policy",
 * "Evaluating a string as JavaScript") and the two consumer shapes
 * (string-return via `withCspEvalHint`, in-place mutation via
 * `appendCspHint`).
 */

import { describe, expect, it } from 'bun:test';
import {
  appendCspHint,
  CSP_EVAL_HINT,
  isUnsafeEvalCspError,
  withCspEvalHint,
} from '../src/csp-errors';

describe('isUnsafeEvalCspError', () => {
  it('matches the "unsafe-eval" phrasing', () => {
    expect(
      isUnsafeEvalCspError(
        new Error("Refused to evaluate a string as JavaScript because 'unsafe-eval' is not allowed"),
      ),
    ).toBe(true);
  });

  it('matches the "Content Security Policy" phrasing', () => {
    expect(
      isUnsafeEvalCspError(
        new Error('Some prefix: Content Security Policy directive blocked this'),
      ),
    ).toBe(true);
  });

  it('matches the "violates the following content security policy directive" phrasing', () => {
    expect(
      isUnsafeEvalCspError(
        new Error('the script violates the following content security policy directive'),
      ),
    ).toBe(true);
  });

  it('matches the "evaluating a string as javascript" phrasing', () => {
    expect(
      isUnsafeEvalCspError(new EvalError('Evaluating a string as JavaScript was blocked')),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isUnsafeEvalCspError(new Error('TypeError: foo is not a function'))).toBe(false);
    expect(isUnsafeEvalCspError(new SyntaxError('Unexpected token'))).toBe(false);
    expect(isUnsafeEvalCspError('plain string error')).toBe(false);
    expect(isUnsafeEvalCspError(null)).toBe(false);
    expect(isUnsafeEvalCspError(undefined)).toBe(false);
  });

  it('handles non-Error values by stringifying', () => {
    expect(isUnsafeEvalCspError('content security policy blocked it')).toBe(true);
    expect(isUnsafeEvalCspError({ toString: () => 'unsafe-eval boom' })).toBe(true);
  });
});

describe('withCspEvalHint', () => {
  it('returns the base error message unchanged for non-CSP errors', () => {
    const message = withCspEvalHint(new Error('TypeError: x is not defined'));
    expect(message).toBe('TypeError: x is not defined');
    expect(message).not.toContain(CSP_EVAL_HINT);
  });

  it('appends the canonical hint for CSP errors', () => {
    const message = withCspEvalHint(new Error('unsafe-eval blocked'));
    expect(message).toContain('unsafe-eval blocked');
    expect(message).toContain(CSP_EVAL_HINT);
  });

  it('stringifies non-Error inputs', () => {
    expect(withCspEvalHint('foo')).toBe('foo');
    expect(withCspEvalHint(null)).toBe('null');
  });
});

describe('appendCspHint', () => {
  it('returns the same Error instance on non-CSP errors, unchanged', () => {
    const err = new Error('plain bug');
    const result = appendCspHint(err);
    expect(result).toBe(err);
    expect(err.message).toBe('plain bug');
  });

  it('mutates the Error message to include the hint on CSP errors', () => {
    const err = new Error('unsafe-eval rejected');
    appendCspHint(err);
    expect(err.message).toContain(CSP_EVAL_HINT);
  });

  it('is idempotent — does not re-append on a second pass', () => {
    const err = new Error('Content Security Policy');
    appendCspHint(err);
    const firstLength = err.message.length;
    appendCspHint(err);
    expect(err.message.length).toBe(firstLength);
  });
});

describe('CSP_EVAL_HINT', () => {
  it('mentions transpileToStandaloneFactory as the CSP-safe path', () => {
    expect(CSP_EVAL_HINT).toContain('transpileToStandaloneFactory');
  });

  it('mentions the --format factory CLI escape hatch', () => {
    expect(CSP_EVAL_HINT).toContain('--format factory');
  });
});
