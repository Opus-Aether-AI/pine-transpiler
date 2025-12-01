/**
 * Tests for indicator factory generation
 */

import { describe, expect, it } from 'vitest';
import { generateStandaloneFactory } from '../../src/factory/indicator-factory';
import type { ParsedBgcolor, ParsedInput, ParsedPlot } from '../../src/types';

describe('generateStandaloneFactory', () => {
  describe('basic indicator', () => {
    it('should generate factory for simple indicator with no inputs', () => {
      const result = generateStandaloneFactory({
        indicatorId: 'test_indicator',
        indicatorName: 'Test Indicator',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('function createIndicator(PineJS)');
      expect(result).toContain("name: 'User_test_indicator'");
      expect(result).toContain('description: "Test Indicator"');
      expect(result).toContain('is_price_study: true');
    });

    it('should generate factory for indicator with overlay=false', () => {
      const result = generateStandaloneFactory({
        indicatorId: 'oscillator',
        indicatorName: 'Oscillator',
        name: 'Osc',
        shortName: 'Osc',
        overlay: false,
        plots: [],
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('is_price_study: false');
    });
  });

  describe('inputs', () => {
    it('should generate integer input', () => {
      const inputs: ParsedInput[] = [
        { id: 'in_0', name: 'Length', type: 'integer', defval: 14 },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"type": "integer"');
      expect(result).toContain('"defval": 14');
      expect(result).toContain('"name": "Length"');
    });

    it('should generate float input', () => {
      const inputs: ParsedInput[] = [
        { id: 'in_0', name: 'Multiplier', type: 'float', defval: 2.5 },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"type": "float"');
      expect(result).toContain('"defval": 2.5');
    });

    it('should generate bool input', () => {
      const inputs: ParsedInput[] = [
        { id: 'in_0', name: 'Show Lines', type: 'bool', defval: true },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"type": "bool"');
      expect(result).toContain('"defval": true');
    });

    it('should generate source input', () => {
      const inputs: ParsedInput[] = [
        { id: 'in_0', name: 'Source', type: 'source', defval: 'close' },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"type": "source"');
      expect(result).toContain('"defval": "close"');
    });

    it('should generate session input', () => {
      const inputs: ParsedInput[] = [
        {
          id: 'in_0',
          name: 'Session',
          type: 'session',
          defval: '0930-1600:23456',
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"type": "session"');
      expect(result).toContain('"defval": "0930-1600:23456"');
    });

    it('should generate string input as text', () => {
      const inputs: ParsedInput[] = [
        { id: 'in_0', name: 'Label', type: 'string', defval: 'Hello' },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"type": "text"');
      expect(result).toContain('"defval": "Hello"');
    });

    it('should include min/max constraints', () => {
      const inputs: ParsedInput[] = [
        {
          id: 'in_0',
          name: 'Length',
          type: 'integer',
          defval: 14,
          min: 1,
          max: 100,
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('"min": 1');
      expect(result).toContain('"max": 100');
    });
  });

  describe('plots', () => {
    it('should generate line plot', () => {
      const plots: ParsedPlot[] = [
        {
          id: 'plot_0',
          title: 'SMA',
          varName: 'sma',
          type: 'line',
          color: '#2962FF',
          linewidth: 2,
          valueExpr: 'smaValue',
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots,
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('"type": "line"');
      expect(result).toContain('"title": "SMA"');
      expect(result).toContain('"color": "#2962FF"');
      expect(result).toContain('"linewidth": 2');
    });

    it('should generate histogram plot', () => {
      const plots: ParsedPlot[] = [
        {
          id: 'plot_0',
          title: 'Histogram',
          varName: 'hist',
          type: 'histogram',
          color: '#26A69A',
          linewidth: 1,
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: false,
        plots,
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('"type": "histogram"');
      expect(result).toContain('"plottype": 1');
      expect(result).toContain('"histogramBase": 0');
    });

    it('should generate area plot', () => {
      const plots: ParsedPlot[] = [
        {
          id: 'plot_0',
          title: 'Area',
          varName: 'area',
          type: 'area',
          color: '#2962FF',
          linewidth: 1,
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots,
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('"plottype": 3');
    });

    it('should generate shape plot', () => {
      const plots: ParsedPlot[] = [
        {
          id: 'plot_0',
          title: 'Signal',
          varName: 'signal',
          type: 'shape',
          color: '#00FF00',
          linewidth: 1,
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots,
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('"type": "shape"');
      expect(result).toContain('"plottype": "shape_circle"');
    });
  });

  describe('bgcolor / session indicators', () => {
    it('should generate bg_colorer plot for bgcolors', () => {
      const bgcolors: ParsedBgcolor[] = [
        { colorExpr: 'sessionColor', transparency: 90 },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'sessions',
        indicatorName: 'Sessions',
        name: 'Sessions',
        shortName: 'Sessions',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors,
      });

      expect(result).toContain('"type": "bg_colorer"');
      expect(result).toContain('"palette": "bgPalette"');
      expect(result).toContain('palettes');
      expect(result).toContain('bgPalette');
    });

    it('should generate session checking helper', () => {
      const inputs: ParsedInput[] = [
        {
          id: 'in_0',
          name: 'Session',
          type: 'session',
          defval: '0800-1700:1234567',
        },
      ];
      const bgcolors: ParsedBgcolor[] = [
        { colorExpr: 'color', transparency: 85 },
      ];
      const sessionVariables = new Map([
        [
          'inSession',
          {
            varName: 'inSession',
            sessionInputVar: 'session',
            timezone: 'America/New_York',
            inputIndex: 0,
          },
        ],
      ]);

      const result = generateStandaloneFactory({
        indicatorId: 'sessions',
        indicatorName: 'Sessions',
        name: 'Sessions',
        shortName: 'Sessions',
        overlay: true,
        plots: [],
        inputs,
        bgcolors,
        sessionVariables,
      });

      expect(result).toContain('isInSession');
      expect(result).toContain('toLocaleTimeString');
      expect(result).toContain('timeZone');
    });
  });

  describe('computed variables', () => {
    it('should generate computed variables in main body', () => {
      const computedVariables = new Map([
        [
          'fastSMA',
          {
            name: 'fastSMA',
            expression: 'Std.sma(close, 10, context)',
            dependencies: ['close'],
          },
        ],
      ]);

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
        computedVariables,
      });

      expect(result).toContain('const fastSMA = Std.sma(close, 10, context)');
    });

    it('should handle ta.* to Std.* mapping in computed variables', () => {
      const computedVariables = new Map([
        [
          'sma',
          {
            name: 'sma',
            expression: 'ta.sma(close, 14)',
            dependencies: ['close'],
          },
        ],
      ]);

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
        computedVariables,
      });

      expect(result).toContain('Std.sma');
      expect(result).toContain('context');
    });
  });

  describe('indicator ID sanitization', () => {
    it('should sanitize special characters in indicator ID', () => {
      const result = generateStandaloneFactory({
        indicatorId: 'FX Sessions — Full Clean',
        indicatorName: 'FX Sessions',
        name: 'FX Sessions',
        shortName: 'FX',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
      });

      // Should replace em-dash and spaces with underscores
      expect(result).toContain("name: 'User_FX_Sessions___Full_Clean'");
      expect(result).not.toContain('—');
    });

    it('should handle indicator ID with spaces', () => {
      const result = generateStandaloneFactory({
        indicatorId: 'my indicator',
        indicatorName: 'My Indicator',
        name: 'My Indicator',
        shortName: 'MI',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
      });

      // The name field should not have spaces
      expect(result).toContain("name: 'User_my_indicator'");
    });
  });

  describe('main function structure', () => {
    it('should generate constructor with main function', () => {
      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('constructor: function()');
      expect(result).toContain('this.main = function(context, inputCallback)');
    });

    it('should read inputs in main function', () => {
      const inputs: ParsedInput[] = [
        { id: 'in_0', name: 'Length', type: 'integer', defval: 14 },
        { id: 'in_1', name: 'Source', type: 'source', defval: 'close' },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs,
        bgcolors: [],
      });

      expect(result).toContain('inputCallback(0)');
      expect(result).toContain('inputCallback(1)');
      expect(result).toContain('Number(inputCallback(0))');
    });

    it('should return plot values', () => {
      const plots: ParsedPlot[] = [
        {
          id: 'plot_0',
          title: 'SMA',
          varName: 'sma',
          type: 'line',
          color: '#2962FF',
          linewidth: 1,
          valueExpr: 'smaValue',
        },
      ];

      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots,
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('return [');
    });
  });

  describe('export', () => {
    it('should export createIndicator', () => {
      const result = generateStandaloneFactory({
        indicatorId: 'test',
        indicatorName: 'Test',
        name: 'Test',
        shortName: 'Test',
        overlay: true,
        plots: [],
        inputs: [],
        bgcolors: [],
      });

      expect(result).toContain('export { createIndicator }');
    });
  });
});
