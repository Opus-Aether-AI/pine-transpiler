import { describe, expect, it } from 'vitest';
import { validateOutput } from '../../src/validator';

const NO_HELPERS = {
  needsMath: false,
  needsSession: false,
  needsStdPlus: false,
};
const WITH_STDPLUS = {
  needsMath: false,
  needsSession: false,
  needsStdPlus: true,
};

describe('Output Validator', () => {
  // -----------------------------------------------------------------------
  // Stage 1 — JS syntax
  // -----------------------------------------------------------------------
  describe('Stage 1: JS syntax check', () => {
    it('should return confidence=0 for syntactically invalid JS', () => {
      const result = validateOutput('let x = (;', NO_HELPERS);
      expect(result.confidence).toBe(0);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].stage).toBe('syntax');
    });

    it('should pass stage 1 for valid JS', () => {
      const result = validateOutput('const x = 1 + 2;', NO_HELPERS);
      expect(result.issues.filter((i) => i.stage === 'syntax')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Stage 2 — Pine namespace leak
  // -----------------------------------------------------------------------
  describe('Stage 2: Pine namespace leak detection', () => {
    it('should detect unmapped ta.* call', () => {
      const result = validateOutput('const x = ta.xyz(close, 14);', NO_HELPERS);
      const leaks = result.issues.filter((i) => i.stage === 'pine-leak');
      expect(leaks.length).toBeGreaterThan(0);
      expect(leaks[0].message).toContain('ta.*');
    });

    it('should detect unmapped math.* call', () => {
      const result = validateOutput('const x = math.sqrt(close);', NO_HELPERS);
      const leaks = result.issues.filter((i) => i.stage === 'pine-leak');
      expect(leaks.length).toBeGreaterThan(0);
    });

    it('should detect Pine := operator (caught by Stage 1 since := is invalid JS)', () => {
      // `:=` in generated output is invalid JS → Stage 1 catches it as syntax
      const result = validateOutput('x := 10;', NO_HELPERS);
      // Stage 1 fires first and returns early (confidence=0)
      expect(result.confidence).toBe(0);
      const syntaxIssues = result.issues.filter((i) => i.stage === 'syntax');
      expect(syntaxIssues.length).toBeGreaterThan(0);
    });

    it('should not flag NaN as a Pine na leak', () => {
      const result = validateOutput('const x = NaN;', NO_HELPERS);
      const leaks = result.issues.filter((i) => i.stage === 'pine-leak');
      // NaN should NOT be flagged
      const naLeaks = leaks.filter((i) => i.message.includes("'na'"));
      expect(naLeaks).toHaveLength(0);
    });

    it('should not flag properly transpiled code', () => {
      const result = validateOutput(
        'const x = Std.sma(context, close, 14);',
        NO_HELPERS,
      );
      expect(result.issues).toHaveLength(0);
      expect(result.confidence).toBe(1.0);
    });

    it('should not flag Pine keywords inside string literals', () => {
      const result = validateOutput(
        'const label = "na value from ta.sma"; const y = 1;',
        NO_HELPERS,
      );
      const leaks = result.issues.filter((i) => i.stage === 'pine-leak');
      expect(leaks).toHaveLength(0);
    });

    it('should still flag Pine keywords outside string literals', () => {
      const result = validateOutput(
        'const label = "safe"; const x = ta.sma(close, 14);',
        NO_HELPERS,
      );
      const leaks = result.issues.filter((i) => i.stage === 'pine-leak');
      expect(leaks.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Stage 3 — Helper integrity
  // -----------------------------------------------------------------------
  describe('Stage 3: Helper integrity check', () => {
    it('should flag StdPlus reference without needsStdPlus=true', () => {
      const result = validateOutput(
        'const x = StdPlus.bb(context, close, 20, 2);',
        NO_HELPERS,
      );
      const integrity = result.issues.filter(
        (i) => i.stage === 'helper-integrity',
      );
      expect(integrity.length).toBeGreaterThan(0);
      expect(integrity[0].message).toContain('StdPlus');
    });

    it('should not flag StdPlus when needsStdPlus=true', () => {
      const result = validateOutput(
        'const x = StdPlus.bb(context, close, 20, 2);',
        WITH_STDPLUS,
      );
      const integrity = result.issues.filter(
        (i) => i.stage === 'helper-integrity',
      );
      expect(integrity).toHaveLength(0);
    });

    it('should flag math helper reference without needsMath=true', () => {
      const result = validateOutput('const x = _avg(arr);', NO_HELPERS);
      const integrity = result.issues.filter(
        (i) => i.stage === 'helper-integrity',
      );
      expect(integrity.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Stage 4 — Confidence score
  // -----------------------------------------------------------------------
  describe('Stage 4: Confidence score', () => {
    it('should return confidence=1.0 for clean output', () => {
      const result = validateOutput(
        'const x = Std.sma(context, close, 14);',
        NO_HELPERS,
      );
      expect(result.confidence).toBe(1.0);
      expect(result.valid).toBe(true);
    });

    it('should reduce confidence by 0.3 per issue', () => {
      // One pine-leak issue → confidence = 0.7, still valid
      const result = validateOutput('const x = ta.xyz(close);', NO_HELPERS);
      expect(result.confidence).toBeCloseTo(0.7);
      expect(result.valid).toBe(true);
    });

    it('should mark result invalid when confidence < 0.5', () => {
      // Two issues → confidence = 0.4
      const result = validateOutput(
        'const x = ta.foo(close); const y = StdPlus.bb(close);',
        NO_HELPERS,
      );
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.valid).toBe(false);
    });
  });
});
