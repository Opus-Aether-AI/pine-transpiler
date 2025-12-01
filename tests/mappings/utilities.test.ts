/**
 * Utilities Mapping Tests
 *
 * Tests for Pine Script utility function mappings including:
 * - NA handling (na, nz, fixnan)
 * - Type conversion
 * - Symbol info
 * - Bar state
 * - Color functions
 * - String functions
 * - Array functions
 */

import { describe, expect, it } from 'vitest';
import { transpile } from '../utils';
import {
  ALL_UTILITY_MAPPINGS,
  NA_FUNCTION_MAPPINGS,
  COMPARISON_FUNCTION_MAPPINGS,
  UTILITY_FUNCTION_MAPPINGS,
  TYPE_FUNCTION_MAPPINGS,
  SYMINFO_MAPPINGS,
  BARSTATE_MAPPINGS,
  COLOR_FUNCTION_MAPPINGS,
  STRING_FUNCTION_MAPPINGS,
  ARRAY_FUNCTION_MAPPINGS,
  isUtilityFunction,
  getUtilityMapping,
} from '../../src/mappings/utilities';

describe('Utility Mappings', () => {
  describe('NA Function Mappings', () => {
    it('should have na mapping', () => {
      expect(NA_FUNCTION_MAPPINGS.na).toBeDefined();
      expect(NA_FUNCTION_MAPPINGS.na.stdName).toBe('Std.na');
    });

    it('should have nz mapping', () => {
      expect(NA_FUNCTION_MAPPINGS.nz).toBeDefined();
      expect(NA_FUNCTION_MAPPINGS.nz.stdName).toBe('Std.nz');
    });

    it('should have fixnan mapping', () => {
      expect(NA_FUNCTION_MAPPINGS.fixnan).toBeDefined();
      expect(NA_FUNCTION_MAPPINGS.fixnan.stdName).toBe('Std.fixnan');
    });
  });

  describe('Comparison Function Mappings', () => {
    it('should have ge mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.ge).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.ge.stdName).toBe('Std.ge');
    });

    it('should have le mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.le).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.le.stdName).toBe('Std.le');
    });

    it('should have gt mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.gt).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.gt.stdName).toBe('Std.gt');
    });

    it('should have lt mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.lt).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.lt.stdName).toBe('Std.lt');
    });

    it('should have eq mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.eq).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.eq.stdName).toBe('Std.eq');
    });

    it('should have neq mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.neq).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.neq.stdName).toBe('Std.neq');
    });

    it('should have iff mapping', () => {
      expect(COMPARISON_FUNCTION_MAPPINGS.iff).toBeDefined();
      expect(COMPARISON_FUNCTION_MAPPINGS.iff.stdName).toBe('Std.iff');
    });
  });

  describe('Utility Helper Mappings', () => {
    it('should have eps mapping', () => {
      expect(UTILITY_FUNCTION_MAPPINGS.eps).toBeDefined();
      expect(UTILITY_FUNCTION_MAPPINGS.eps.stdName).toBe('Std.eps');
    });

    it('should have isZero mapping', () => {
      expect(UTILITY_FUNCTION_MAPPINGS.isZero).toBeDefined();
      expect(UTILITY_FUNCTION_MAPPINGS.isZero.stdName).toBe('Std.isZero');
    });

    it('should have toBool mapping', () => {
      expect(UTILITY_FUNCTION_MAPPINGS.toBool).toBeDefined();
      expect(UTILITY_FUNCTION_MAPPINGS.toBool.stdName).toBe('Std.toBool');
    });
  });

  describe('Type Conversion Mappings', () => {
    it('should have bool mapping', () => {
      expect(TYPE_FUNCTION_MAPPINGS.bool).toBeDefined();
      expect(TYPE_FUNCTION_MAPPINGS.bool.stdName).toBe('Std.toBool');
    });

    it('should have int mapping', () => {
      expect(TYPE_FUNCTION_MAPPINGS.int).toBeDefined();
      expect(TYPE_FUNCTION_MAPPINGS.int.stdName).toBe('Math.floor');
    });

    it('should have float mapping', () => {
      expect(TYPE_FUNCTION_MAPPINGS.float).toBeDefined();
      expect(TYPE_FUNCTION_MAPPINGS.float.stdName).toBe('Number');
    });

    it('should have str.tostring mapping', () => {
      expect(TYPE_FUNCTION_MAPPINGS['str.tostring']).toBeDefined();
      expect(TYPE_FUNCTION_MAPPINGS['str.tostring'].stdName).toBe('String');
    });
  });

  describe('Syminfo Mappings', () => {
    it('should have syminfo.ticker mapping', () => {
      expect(SYMINFO_MAPPINGS['syminfo.ticker']).toBeDefined();
    });

    it('should have syminfo.tickerid mapping', () => {
      expect(SYMINFO_MAPPINGS['syminfo.tickerid']).toBeDefined();
    });

    it('should have syminfo.currency mapping', () => {
      expect(SYMINFO_MAPPINGS['syminfo.currency']).toBeDefined();
    });

    it('should have syminfo.mintick mapping', () => {
      expect(SYMINFO_MAPPINGS['syminfo.mintick']).toBeDefined();
    });

    it('should have syminfo.timezone mapping', () => {
      expect(SYMINFO_MAPPINGS['syminfo.timezone']).toBeDefined();
    });

    it('should have syminfo.type mapping', () => {
      expect(SYMINFO_MAPPINGS['syminfo.type']).toBeDefined();
    });
  });

  describe('Barstate Mappings', () => {
    it('should have barstate.isfirst mapping', () => {
      expect(BARSTATE_MAPPINGS['barstate.isfirst']).toBeDefined();
    });

    it('should have barstate.islast mapping', () => {
      expect(BARSTATE_MAPPINGS['barstate.islast']).toBeDefined();
    });

    it('should have barstate.ishistory mapping', () => {
      expect(BARSTATE_MAPPINGS['barstate.ishistory']).toBeDefined();
    });

    it('should have barstate.isrealtime mapping', () => {
      expect(BARSTATE_MAPPINGS['barstate.isrealtime']).toBeDefined();
    });

    it('should have barstate.isnew mapping', () => {
      expect(BARSTATE_MAPPINGS['barstate.isnew']).toBeDefined();
    });

    it('should have barstate.isconfirmed mapping', () => {
      expect(BARSTATE_MAPPINGS['barstate.isconfirmed']).toBeDefined();
    });
  });

  describe('Color Function Mappings', () => {
    it('should have color.rgb mapping', () => {
      expect(COLOR_FUNCTION_MAPPINGS['color.rgb']).toBeDefined();
    });

    it('should have color.new mapping', () => {
      expect(COLOR_FUNCTION_MAPPINGS['color.new']).toBeDefined();
    });

    it('should have color.r mapping', () => {
      expect(COLOR_FUNCTION_MAPPINGS['color.r']).toBeDefined();
    });

    it('should have color.g mapping', () => {
      expect(COLOR_FUNCTION_MAPPINGS['color.g']).toBeDefined();
    });

    it('should have color.b mapping', () => {
      expect(COLOR_FUNCTION_MAPPINGS['color.b']).toBeDefined();
    });

    it('should have color.t mapping', () => {
      expect(COLOR_FUNCTION_MAPPINGS['color.t']).toBeDefined();
    });
  });

  describe('String Function Mappings', () => {
    it('should have str.length mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.length']).toBeDefined();
    });

    it('should have str.contains mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.contains']).toBeDefined();
    });

    it('should have str.startswith mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.startswith']).toBeDefined();
    });

    it('should have str.endswith mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.endswith']).toBeDefined();
    });

    it('should have str.substring mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.substring']).toBeDefined();
    });

    it('should have str.replace mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.replace']).toBeDefined();
    });

    it('should have str.replace_all mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.replace_all']).toBeDefined();
    });

    it('should have str.lower mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.lower']).toBeDefined();
    });

    it('should have str.upper mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.upper']).toBeDefined();
    });

    it('should have str.split mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.split']).toBeDefined();
    });

    it('should have str.format mapping', () => {
      expect(STRING_FUNCTION_MAPPINGS['str.format']).toBeDefined();
    });
  });

  describe('Array Function Mappings', () => {
    it('should have array.new_float mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.new_float']).toBeDefined();
    });

    it('should have array.new_int mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.new_int']).toBeDefined();
    });

    it('should have array.new_bool mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.new_bool']).toBeDefined();
    });

    it('should have array.new_string mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.new_string']).toBeDefined();
    });

    it('should have array.push mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.push']).toBeDefined();
    });

    it('should have array.pop mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.pop']).toBeDefined();
    });

    it('should have array.get mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.get']).toBeDefined();
    });

    it('should have array.set mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.set']).toBeDefined();
    });

    it('should have array.size mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.size']).toBeDefined();
    });

    it('should have array.avg mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.avg']).toBeDefined();
    });

    it('should have array.sum mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.sum']).toBeDefined();
    });

    it('should have array.min mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.min']).toBeDefined();
    });

    it('should have array.max mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.max']).toBeDefined();
    });

    it('should have array.sort mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.sort']).toBeDefined();
    });

    it('should have array.reverse mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.reverse']).toBeDefined();
    });

    it('should have array.slice mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.slice']).toBeDefined();
    });

    it('should have array.includes mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.includes']).toBeDefined();
    });

    it('should have array.indexof mapping', () => {
      expect(ARRAY_FUNCTION_MAPPINGS['array.indexof']).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    describe('isUtilityFunction', () => {
      it('should return true for na', () => {
        expect(isUtilityFunction('na')).toBe(true);
      });

      it('should return true for nz', () => {
        expect(isUtilityFunction('nz')).toBe(true);
      });

      it('should return true for plot', () => {
        expect(isUtilityFunction('plot')).toBe(true);
      });

      it('should return false for unknown function', () => {
        expect(isUtilityFunction('unknown_func')).toBe(false);
      });
    });

    describe('getUtilityMapping', () => {
      it('should return mapping for na', () => {
        const mapping = getUtilityMapping('na');
        expect(mapping).toBeDefined();
        expect(mapping?.stdName).toBe('Std.na');
      });

      it('should return undefined for unknown function', () => {
        const mapping = getUtilityMapping('unknown_func');
        expect(mapping).toBeUndefined();
      });
    });
  });

  describe('Combined Mappings', () => {
    it('should contain all NA mappings', () => {
      expect(ALL_UTILITY_MAPPINGS.na).toBeDefined();
      expect(ALL_UTILITY_MAPPINGS.nz).toBeDefined();
      expect(ALL_UTILITY_MAPPINGS.fixnan).toBeDefined();
    });

    it('should contain all comparison mappings', () => {
      expect(ALL_UTILITY_MAPPINGS.ge).toBeDefined();
      expect(ALL_UTILITY_MAPPINGS.le).toBeDefined();
    });

    it('should contain all plot mappings', () => {
      expect(ALL_UTILITY_MAPPINGS.plot).toBeDefined();
      expect(ALL_UTILITY_MAPPINGS.plotshape).toBeDefined();
      expect(ALL_UTILITY_MAPPINGS.plotchar).toBeDefined();
    });
  });

  describe('Transpilation Integration', () => {
    it('should transpile na() function', () => {
      const code = 'x = na(close)';
      const js = transpile(code);
      // na is mapped to NaN
      expect(js).toContain('NaN');
    });

    it('should transpile nz() function', () => {
      const code = 'x = nz(close, 0)';
      const js = transpile(code);
      expect(js).toContain('nz');
    });

    it('should transpile plot() function', () => {
      const code = 'plot(close)';
      const js = transpile(code);
      expect(js).toContain('Std.plot');
    });
  });
});
