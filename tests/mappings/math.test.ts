/**
 * Math Mapping Tests
 *
 * Tests for Pine Script math.* function mappings to JavaScript.
 */

import { describe, expect, it } from 'vitest';
import { transpile } from '../utils';
import {
  MATH_FUNCTION_MAPPINGS,
  BASIC_MATH_MAPPINGS,
  POWER_LOG_MAPPINGS,
  TRIG_MAPPINGS,
  MINMAX_MAPPINGS,
  RANDOM_MAPPINGS,
  transpileMathFunction,
} from '../../src/mappings/math';

describe('Math Mappings', () => {
  describe('Mapping Structure', () => {
    it('should have all basic math functions', () => {
      expect(BASIC_MATH_MAPPINGS['math.abs']).toBeDefined();
      expect(BASIC_MATH_MAPPINGS['math.sign']).toBeDefined();
      expect(BASIC_MATH_MAPPINGS['math.floor']).toBeDefined();
      expect(BASIC_MATH_MAPPINGS['math.ceil']).toBeDefined();
      expect(BASIC_MATH_MAPPINGS['math.round']).toBeDefined();
      expect(BASIC_MATH_MAPPINGS['math.round_to_mintick']).toBeDefined();
    });

    it('should have all power/log functions', () => {
      expect(POWER_LOG_MAPPINGS['math.pow']).toBeDefined();
      expect(POWER_LOG_MAPPINGS['math.sqrt']).toBeDefined();
      expect(POWER_LOG_MAPPINGS['math.exp']).toBeDefined();
      expect(POWER_LOG_MAPPINGS['math.log']).toBeDefined();
      expect(POWER_LOG_MAPPINGS['math.log10']).toBeDefined();
    });

    it('should have all trig functions', () => {
      expect(TRIG_MAPPINGS['math.sin']).toBeDefined();
      expect(TRIG_MAPPINGS['math.cos']).toBeDefined();
      expect(TRIG_MAPPINGS['math.tan']).toBeDefined();
      expect(TRIG_MAPPINGS['math.asin']).toBeDefined();
      expect(TRIG_MAPPINGS['math.acos']).toBeDefined();
      expect(TRIG_MAPPINGS['math.atan']).toBeDefined();
      expect(TRIG_MAPPINGS['math.todegrees']).toBeDefined();
      expect(TRIG_MAPPINGS['math.toradians']).toBeDefined();
    });

    it('should have all min/max/avg functions', () => {
      expect(MINMAX_MAPPINGS['math.max']).toBeDefined();
      expect(MINMAX_MAPPINGS['math.min']).toBeDefined();
      expect(MINMAX_MAPPINGS['math.avg']).toBeDefined();
      expect(MINMAX_MAPPINGS['math.sum']).toBeDefined();
    });

    it('should have random function', () => {
      expect(RANDOM_MAPPINGS['math.random']).toBeDefined();
    });
  });

  describe('Mapping Properties', () => {
    it('should map math.abs to Math.abs', () => {
      const mapping = MATH_FUNCTION_MAPPINGS['math.abs'];
      expect(mapping.jsName).toBe('Math.abs');
      expect(mapping.isMath).toBe(true);
      expect(mapping.argCount).toBe(1);
    });

    it('should map math.pow to Math.pow with 2 args', () => {
      const mapping = MATH_FUNCTION_MAPPINGS['math.pow'];
      expect(mapping.jsName).toBe('Math.pow');
      expect(mapping.argCount).toBe(2);
    });

    it('should map math.avg to custom _avg function', () => {
      const mapping = MATH_FUNCTION_MAPPINGS['math.avg'];
      expect(mapping.jsName).toBe('_avg');
      expect(mapping.isMath).toBe(false);
      expect(mapping.minArgs).toBe(2);
    });

    it('should map math.todegrees to custom _toDegrees', () => {
      const mapping = MATH_FUNCTION_MAPPINGS['math.todegrees'];
      expect(mapping.jsName).toBe('_toDegrees');
      expect(mapping.isMath).toBe(false);
    });
  });

  describe('transpileMathFunction helper', () => {
    it('should transpile math.abs', () => {
      const result = transpileMathFunction('math.abs', ['x']);
      expect(result).toBe('Math.abs(x)');
    });

    it('should transpile math.pow', () => {
      const result = transpileMathFunction('math.pow', ['x', '2']);
      expect(result).toBe('Math.pow(x, 2)');
    });

    it('should transpile math.max with multiple args', () => {
      const result = transpileMathFunction('math.max', ['a', 'b', 'c']);
      expect(result).toBe('Math.max(a, b, c)');
    });

    it('should return null for unknown function', () => {
      const result = transpileMathFunction('math.unknown', ['x']);
      expect(result).toBeNull();
    });
  });

  describe('Transpilation Integration', () => {
    it('should transpile math.abs', () => {
      const code = 'x = math.abs(-5)';
      const js = transpile(code);
      expect(js).toContain('Math.abs');
    });

    it('should transpile math.sqrt', () => {
      const code = 'x = math.sqrt(16)';
      const js = transpile(code);
      expect(js).toContain('Math.sqrt');
    });

    it('should transpile math.pow', () => {
      const code = 'x = math.pow(2, 3)';
      const js = transpile(code);
      expect(js).toContain('Math.pow');
    });

    it('should transpile math.sin', () => {
      const code = 'x = math.sin(3.14)';
      const js = transpile(code);
      expect(js).toContain('Math.sin');
    });

    it('should transpile math.cos', () => {
      const code = 'x = math.cos(0)';
      const js = transpile(code);
      expect(js).toContain('Math.cos');
    });

    it('should transpile math.log', () => {
      const code = 'x = math.log(10)';
      const js = transpile(code);
      expect(js).toContain('Math.log');
    });

    it('should transpile math.log10', () => {
      const code = 'x = math.log10(100)';
      const js = transpile(code);
      expect(js).toContain('Math.log10');
    });

    it('should transpile math.floor', () => {
      const code = 'x = math.floor(3.7)';
      const js = transpile(code);
      expect(js).toContain('Math.floor');
    });

    it('should transpile math.ceil', () => {
      const code = 'x = math.ceil(3.2)';
      const js = transpile(code);
      expect(js).toContain('Math.ceil');
    });

    it('should transpile math.round', () => {
      const code = 'x = math.round(3.5)';
      const js = transpile(code);
      expect(js).toContain('Math.round');
    });

    it('should transpile math.max', () => {
      const code = 'x = math.max(1, 2, 3)';
      const js = transpile(code);
      expect(js).toContain('Math.max');
    });

    it('should transpile math.min', () => {
      const code = 'x = math.min(1, 2, 3)';
      const js = transpile(code);
      expect(js).toContain('Math.min');
    });

    it('should transpile math.random', () => {
      const code = 'x = math.random()';
      const js = transpile(code);
      expect(js).toContain('Math.random');
    });
  });

  describe('Custom Helper Functions', () => {
    it('should transpile math.avg to _avg', () => {
      const code = 'x = math.avg(1, 2, 3)';
      const js = transpile(code);
      expect(js).toContain('_avg');
    });

    it('should transpile math.sum to _sum', () => {
      const code = 'x = math.sum(1, 2, 3)';
      const js = transpile(code);
      expect(js).toContain('_sum');
    });

    it('should transpile math.todegrees to _toDegrees', () => {
      const code = 'x = math.todegrees(3.14)';
      const js = transpile(code);
      expect(js).toContain('_toDegrees');
    });

    it('should transpile math.toradians to _toRadians', () => {
      const code = 'x = math.toradians(180)';
      const js = transpile(code);
      expect(js).toContain('_toRadians');
    });
  });

  describe('Complex Math Expressions', () => {
    it('should handle nested math functions', () => {
      const code = 'x = math.sqrt(math.pow(3, 2) + math.pow(4, 2))';
      const js = transpile(code);
      expect(js).toContain('Math.sqrt');
      expect(js).toContain('Math.pow');
    });

    it('should handle math in ternary expressions', () => {
      const code = 'x = a > 0 ? math.abs(a) : math.abs(b)';
      const js = transpile(code);
      expect(js).toContain('Math.abs');
    });

    it('should handle math in binary expressions', () => {
      const code = 'x = math.sin(angle) * radius + offset';
      const js = transpile(code);
      expect(js).toContain('Math.sin');
    });
  });
});
