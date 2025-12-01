/**
 * Comparison Mapping Tests
 *
 * Tests for Pine Script comparison function mappings.
 */

import { describe, expect, it } from 'vitest';
import {
  COMPARISON_FUNCTION_MAPPINGS,
  BOOLEAN_COMPARISON_MAPPINGS,
  NUMERIC_COMPARISON_MAPPINGS,
  COMPARE_MAPPING,
  IFF_MAPPING,
  EPSILON_MAPPING,
  LOGICAL_OPERATORS,
  COMPARISON_OPERATORS,
  transpileLogicalOperators,
  transpileComparisonOperators,
  isComparisonFunction,
} from '../../src/mappings/comparison';

describe('Comparison Mappings', () => {
  describe('Boolean Comparison Mappings', () => {
    it('should have greaterOrEqual mapping with epsilon support', () => {
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.greaterOrEqual']).toBeDefined();
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.greaterOrEqual'].returnsBoolean).toBe(true);
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.greaterOrEqual'].supportsEpsilon).toBe(true);
    });

    it('should have lessOrEqual mapping with epsilon support', () => {
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.lessOrEqual']).toBeDefined();
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.lessOrEqual'].returnsBoolean).toBe(true);
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.lessOrEqual'].supportsEpsilon).toBe(true);
    });

    it('should have equal mapping with epsilon support', () => {
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.equal']).toBeDefined();
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.equal'].supportsEpsilon).toBe(true);
    });

    it('should have greater mapping with epsilon support', () => {
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.greater']).toBeDefined();
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.greater'].supportsEpsilon).toBe(true);
    });

    it('should have less mapping with epsilon support', () => {
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.less']).toBeDefined();
      expect(BOOLEAN_COMPARISON_MAPPINGS['Std.less'].supportsEpsilon).toBe(true);
    });
  });

  describe('Numeric Comparison Mappings (0/1 return)', () => {
    it('should have ge mapping returning numeric', () => {
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.ge']).toBeDefined();
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.ge'].returnsBoolean).toBe(false);
    });

    it('should have le mapping returning numeric', () => {
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.le']).toBeDefined();
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.le'].returnsBoolean).toBe(false);
    });

    it('should have eq mapping returning numeric', () => {
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.eq']).toBeDefined();
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.eq'].returnsBoolean).toBe(false);
    });

    it('should have neq mapping returning numeric', () => {
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.neq']).toBeDefined();
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.neq'].returnsBoolean).toBe(false);
    });

    it('should have gt mapping returning numeric', () => {
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.gt']).toBeDefined();
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.gt'].returnsBoolean).toBe(false);
    });

    it('should have lt mapping returning numeric', () => {
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.lt']).toBeDefined();
      expect(NUMERIC_COMPARISON_MAPPINGS['Std.lt'].returnsBoolean).toBe(false);
    });
  });

  describe('Compare Mapping', () => {
    it('should have compare function mapping', () => {
      expect(COMPARE_MAPPING.stdName).toBe('Std.compare');
      expect(COMPARE_MAPPING.returnsBoolean).toBe(false);
      expect(COMPARE_MAPPING.supportsEpsilon).toBe(true);
    });
  });

  describe('IFF Mapping', () => {
    it('should have iff function mapping', () => {
      expect(IFF_MAPPING.stdName).toBe('Std.iff');
      expect(IFF_MAPPING.description).toContain('Ternary');
    });
  });

  describe('Epsilon Mapping', () => {
    it('should have epsilon mapping', () => {
      expect(EPSILON_MAPPING.stdName).toBe('Std.eps');
      expect(EPSILON_MAPPING.description).toContain('epsilon');
    });
  });

  describe('Logical Operators', () => {
    it('should map and to &&', () => {
      expect(LOGICAL_OPERATORS.and).toBe('&&');
    });

    it('should map or to ||', () => {
      expect(LOGICAL_OPERATORS.or).toBe('||');
    });

    it('should map not to !', () => {
      expect(LOGICAL_OPERATORS.not).toBe('!');
    });
  });

  describe('Comparison Operators', () => {
    it('should map == to ===', () => {
      expect(COMPARISON_OPERATORS['==']).toBe('===');
    });

    it('should map != to !==', () => {
      expect(COMPARISON_OPERATORS['!=']).toBe('!==');
    });

    it('should preserve >', () => {
      expect(COMPARISON_OPERATORS['>']).toBe('>');
    });

    it('should preserve <', () => {
      expect(COMPARISON_OPERATORS['<']).toBe('<');
    });

    it('should preserve >=', () => {
      expect(COMPARISON_OPERATORS['>=']).toBe('>=');
    });

    it('should preserve <=', () => {
      expect(COMPARISON_OPERATORS['<=']).toBe('<=');
    });
  });

  describe('transpileLogicalOperators', () => {
    it('should convert and to &&', () => {
      const result = transpileLogicalOperators('a and b');
      expect(result).toBe('a && b');
    });

    it('should convert or to ||', () => {
      const result = transpileLogicalOperators('a or b');
      expect(result).toBe('a || b');
    });

    it('should convert not to !', () => {
      const result = transpileLogicalOperators('not x');
      expect(result).toBe('!x');
    });

    it('should convert not with parentheses', () => {
      const result = transpileLogicalOperators('not(x)');
      expect(result).toBe('!(x)');
    });

    it('should handle complex expressions', () => {
      const result = transpileLogicalOperators('a and b or not c');
      expect(result).toBe('a && b || !c');
    });

    it('should not convert and/or inside identifiers', () => {
      const result = transpileLogicalOperators('handler or android');
      // handler and android contain 'and' and 'or' but as substrings
      expect(result).toBe('handler || android');
    });
  });

  describe('transpileComparisonOperators', () => {
    it('should convert == to ===', () => {
      const result = transpileComparisonOperators('a == b');
      expect(result).toBe('a === b');
    });

    it('should convert != to !==', () => {
      const result = transpileComparisonOperators('a != b');
      expect(result).toBe('a !== b');
    });

    it('should not double-convert ===', () => {
      const result = transpileComparisonOperators('a === b');
      expect(result).toBe('a === b');
    });

    it('should not double-convert !==', () => {
      const result = transpileComparisonOperators('a !== b');
      expect(result).toBe('a !== b');
    });

    it('should handle multiple comparisons', () => {
      const result = transpileComparisonOperators('a == b and c != d');
      expect(result).toBe('a === b and c !== d');
    });
  });

  describe('isComparisonFunction', () => {
    it('should return true for Std.ge', () => {
      expect(isComparisonFunction('Std.ge')).toBe(true);
    });

    it('should return true for Std.equal', () => {
      expect(isComparisonFunction('Std.equal')).toBe(true);
    });

    it('should return false for unknown function', () => {
      expect(isComparisonFunction('unknown')).toBe(false);
    });
  });

  describe('Combined Mappings', () => {
    it('should contain all boolean comparison mappings', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS['Std.greaterOrEqual']).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS['Std.lessOrEqual']).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS['Std.equal']).toBeDefined();
    });

    it('should contain all numeric comparison mappings', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS['Std.ge']).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS['Std.le']).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS['Std.eq']).toBeDefined();
    });
  });
});
