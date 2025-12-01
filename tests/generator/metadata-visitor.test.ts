/**
 * Metadata Visitor Tests
 *
 * Tests for extracting metadata (indicator info, inputs, plots, warnings)
 * from Pine Script AST during transpilation.
 */

import { describe, expect, it } from 'vitest';
import { extractMetadata, createIndicator } from '../utils';

describe('MetadataVisitor', () => {
  describe('Indicator Metadata', () => {
    it('should extract indicator name', () => {
      const code = 'indicator("My Custom Indicator")';
      const metadata = extractMetadata(code);
      expect(metadata.name).toBe('My Custom Indicator');
    });

    it('should extract indicator short name', () => {
      const code = 'indicator("My Custom Indicator", shorttitle="MCI")';
      const metadata = extractMetadata(code);
      expect(metadata.shortName).toBe('MCI');
    });

    it('should default short name to title if not provided', () => {
      const code = 'indicator("My Custom Indicator")';
      const metadata = extractMetadata(code);
      expect(metadata.shortName).toBe('My Custom Indicator');
    });

    it('should extract overlay setting', () => {
      const code = 'indicator("Test", overlay=true)';
      const metadata = extractMetadata(code);
      expect(metadata.overlay).toBe(true);
    });

    it('should default overlay to false', () => {
      const code = 'indicator("Test")';
      const metadata = extractMetadata(code);
      expect(metadata.overlay).toBe(false);
    });

    it('should handle study() as alias for indicator()', () => {
      const code = 'study("My Study")';
      const metadata = extractMetadata(code);
      expect(metadata.name).toBe('My Study');
    });

    it('should handle strategy()', () => {
      const code = 'strategy("My Strategy")';
      const metadata = extractMetadata(code);
      expect(metadata.name).toBe('My Strategy');
    });
  });

  describe('Input Extraction', () => {
    describe('Generic input()', () => {
      it('should extract input with number default', () => {
        const code = 'length = input(14, "Length")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs.length).toBe(1);
        expect(metadata.inputs[0].defval).toBe(14);
        expect(metadata.inputs[0].type).toBe('float');
      });

      it('should extract input with boolean default', () => {
        const code = 'showLabels = input(true, "Show Labels")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].defval).toBe(true);
        expect(metadata.inputs[0].type).toBe('bool');
      });

      it('should extract input with string default', () => {
        const code = 'title = input("Default", "Title")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].defval).toBe('Default');
        expect(metadata.inputs[0].type).toBe('string');
      });

      it('should extract input with named parameters', () => {
        const code = 'length = input(defval=14, title="Length")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].defval).toBe(14);
        expect(metadata.inputs[0].name).toBe('Length');
      });
    });

    describe('Typed input functions', () => {
      it('should extract input.int()', () => {
        const code = 'length = input.int(14, "Length")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('integer');
        expect(metadata.inputs[0].defval).toBe(14);
      });

      it('should extract input.float()', () => {
        const code = 'mult = input.float(2.0, "Multiplier")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('float');
        expect(metadata.inputs[0].defval).toBe(2.0);
      });

      it('should extract input.bool()', () => {
        const code = 'show = input.bool(true, "Show")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('bool');
        expect(metadata.inputs[0].defval).toBe(true);
      });

      it('should extract input.string()', () => {
        const code = 'text = input.string("Hello", "Text")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('string');
        expect(metadata.inputs[0].defval).toBe('Hello');
      });

      it('should extract input.source()', () => {
        const code = 'src = input.source(close, "Source")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('source');
        expect(metadata.inputs[0].defval).toBe('close');
      });

      it('should extract input.time()', () => {
        const code = 'startTime = input.time(0, "Start Time")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('integer');
      });

      it('should extract input.symbol()', () => {
        const code = 'sym = input.symbol("AAPL", "Symbol")';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].type).toBe('string');
      });
    });

    describe('Input constraints', () => {
      it('should extract minval', () => {
        const code = 'length = input(14, "Length", minval=1)';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].min).toBe(1);
      });

      it('should extract maxval', () => {
        const code = 'length = input(14, "Length", maxval=100)';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].max).toBe(100);
      });

      it('should extract options array', () => {
        const code = 'maType = input("SMA", "MA Type", options=["SMA", "EMA", "WMA"])';
        const metadata = extractMetadata(code);
        expect(metadata.inputs[0].options).toEqual(['SMA', 'EMA', 'WMA']);
      });
    });

    describe('Multiple inputs', () => {
      it('should extract multiple inputs with correct IDs', () => {
        const code = `
length = input(14, "Length")
mult = input(2.0, "Multiplier")
show = input(true, "Show")
`;
        const metadata = extractMetadata(code);
        expect(metadata.inputs.length).toBe(3);
        expect(metadata.inputs[0].id).toBe('in_0');
        expect(metadata.inputs[1].id).toBe('in_1');
        expect(metadata.inputs[2].id).toBe('in_2');
      });
    });
  });

  describe('Plot Extraction', () => {
    it('should extract basic plot', () => {
      const code = 'plot(close)';
      const metadata = extractMetadata(code);
      expect(metadata.plots.length).toBe(1);
      expect(metadata.plots[0].type).toBe('line');
    });

    it('should extract plot with title', () => {
      const code = 'plot(close, title="Close Price")';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].title).toBe('Close Price');
    });

    it('should extract plot with color literal', () => {
      const code = 'plot(close, color="#FF0000")';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].color).toBe('#FF0000');
    });

    it('should extract plot with color.* constant', () => {
      const code = 'plot(close, color=color.red)';
      const metadata = extractMetadata(code);
      // Should resolve color.red to hex value
      expect(metadata.plots[0].color).toBeDefined();
    });

    it('should extract plot with linewidth', () => {
      const code = 'plot(close, linewidth=2)';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].linewidth).toBe(2);
    });

    it('should detect histogram style', () => {
      const code = 'plot(close, style=plot.style_histogram)';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].type).toBe('histogram');
    });

    it('should detect circles style', () => {
      const code = 'plot(close, style=plot.style_circles)';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].type).toBe('circles');
    });

    it('should extract multiple plots with unique IDs', () => {
      const code = `
plot(close, "Close")
plot(open, "Open")
plot(high, "High")
`;
      const metadata = extractMetadata(code);
      expect(metadata.plots.length).toBe(3);
      expect(metadata.plots[0].id).toBe('plot_0');
      expect(metadata.plots[1].id).toBe('plot_1');
      expect(metadata.plots[2].id).toBe('plot_2');
    });
  });

  describe('PlotShape Extraction', () => {
    it('should extract plotshape as shape type', () => {
      const code = 'plotshape(close > open, "Up", shape.triangleup)';
      const metadata = extractMetadata(code);
      expect(metadata.plots.length).toBe(1);
      expect(metadata.plots[0].type).toBe('shape');
    });
  });

  describe('PlotChar Extraction', () => {
    it('should extract plotchar as shape type', () => {
      const code = 'plotchar(close > open, "Char", "▲")';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].type).toBe('shape');
    });
  });

  describe('Hline Extraction', () => {
    it('should extract hline with price', () => {
      const code = 'hline(50, "Middle")';
      const metadata = extractMetadata(code);
      expect(metadata.plots[0].type).toBe('hline');
      expect(metadata.plots[0].price).toBe(50);
    });
  });

  describe('Source Usage Tracking', () => {
    it('should track close usage', () => {
      const code = 'x = close';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('close')).toBe(true);
    });

    it('should track open usage', () => {
      const code = 'x = open';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('open')).toBe(true);
    });

    it('should track high usage', () => {
      const code = 'x = high';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('high')).toBe(true);
    });

    it('should track low usage', () => {
      const code = 'x = low';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('low')).toBe(true);
    });

    it('should track volume usage', () => {
      const code = 'x = volume';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('volume')).toBe(true);
    });

    it('should track hl2 usage', () => {
      const code = 'x = hl2';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('hl2')).toBe(true);
    });

    it('should track hlc3 usage', () => {
      const code = 'x = hlc3';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('hlc3')).toBe(true);
    });

    it('should track ohlc4 usage', () => {
      const code = 'x = ohlc4';
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('ohlc4')).toBe(true);
    });

    it('should track multiple sources', () => {
      const code = `
x = close + open
y = high - low
`;
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('close')).toBe(true);
      expect(metadata.usedSources.has('open')).toBe(true);
      expect(metadata.usedSources.has('high')).toBe(true);
      expect(metadata.usedSources.has('low')).toBe(true);
    });
  });

  describe('Historical Access Detection', () => {
    it('should detect historical access on sources', () => {
      const code = 'x = close[1]';
      const metadata = extractMetadata(code);
      expect(metadata.historicalAccess.has('close')).toBe(true);
    });

    it('should detect historical access on variables', () => {
      const code = `
myVar = close
x = myVar[1]
`;
      const metadata = extractMetadata(code);
      expect(metadata.historicalAccess.has('myVar')).toBe(true);
    });

    it('should detect multiple historical accesses', () => {
      const code = `
x = close[1]
y = open[2]
z = high[3]
`;
      const metadata = extractMetadata(code);
      expect(metadata.historicalAccess.has('close')).toBe(true);
      expect(metadata.historicalAccess.has('open')).toBe(true);
      expect(metadata.historicalAccess.has('high')).toBe(true);
    });
  });

  describe('Warning Generation', () => {
    it('should warn on unsupported function request.security', () => {
      const code = 'x = request.security("AAPL", "D", close)';
      const metadata = extractMetadata(code);
      expect(metadata.warnings.some((w) => w.functionName === 'request.security')).toBe(true);
      expect(metadata.warnings.some((w) => w.type === 'unsupported')).toBe(true);
    });

    it('should warn on unsupported function alert', () => {
      const code = 'alert("Test alert")';
      const metadata = extractMetadata(code);
      expect(metadata.warnings.some((w) => w.functionName === 'alert')).toBe(true);
    });

    it('should warn on partially supported function plotshape', () => {
      const code = 'plotshape(true, "Shape")';
      const metadata = extractMetadata(code);
      expect(metadata.warnings.some((w) => w.functionName === 'plotshape')).toBe(true);
      expect(metadata.warnings.some((w) => w.type === 'partial')).toBe(true);
    });

    it('should warn on deprecated function study', () => {
      const code = 'study("Test")';
      const metadata = extractMetadata(code);
      expect(metadata.warnings.some((w) => w.functionName === 'study')).toBe(true);
      expect(metadata.warnings.some((w) => w.type === 'deprecated')).toBe(true);
    });

    it('should not duplicate warnings for same function', () => {
      const code = `
alert("Test 1")
alert("Test 2")
alert("Test 3")
`;
      const metadata = extractMetadata(code);
      const alertWarnings = metadata.warnings.filter((w) => w.functionName === 'alert');
      expect(alertWarnings.length).toBe(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle full indicator with inputs and plots', () => {
      const code = createIndicator(`
length = input(14, "Length")
mult = input(2.0, "Multiplier")
basis = ta.sma(close, length)
upper = basis + mult * ta.stdev(close, length)
lower = basis - mult * ta.stdev(close, length)
plot(basis, "Basis", color=color.blue)
plot(upper, "Upper", color=color.red)
plot(lower, "Lower", color=color.green)
`);
      const metadata = extractMetadata(code);

      expect(metadata.name).toBe('Test Indicator');
      expect(metadata.inputs.length).toBe(2);
      expect(metadata.plots.length).toBe(3);
      expect(metadata.usedSources.has('close')).toBe(true);
    });

    it('should handle indicator with historical access in conditions', () => {
      const code = `
indicator("Crossover")
fast = ta.sma(close, 10)
slow = ta.sma(close, 20)
crossover = fast > slow and fast[1] <= slow[1]
plotshape(crossover)
`;
      const metadata = extractMetadata(code);
      expect(metadata.historicalAccess.has('fast')).toBe(true);
      expect(metadata.historicalAccess.has('slow')).toBe(true);
    });

    it('should handle nested function calls', () => {
      const code = `
indicator("Nested")
x = ta.ema(ta.sma(close, 10), 20)
plot(x)
`;
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('close')).toBe(true);
      expect(metadata.plots.length).toBe(1);
    });

    it('should handle control flow with sources', () => {
      const code = `
indicator("Conditional")
x = close > open ? high : low
plot(x)
`;
      const metadata = extractMetadata(code);
      expect(metadata.usedSources.has('close')).toBe(true);
      expect(metadata.usedSources.has('open')).toBe(true);
      expect(metadata.usedSources.has('high')).toBe(true);
      expect(metadata.usedSources.has('low')).toBe(true);
    });

    it('should handle loops with sources', () => {
      const code = `
indicator("Loop")
sum = 0.0
for i = 0 to 10
    sum := sum + close[i]
plot(sum)
`;
      const metadata = extractMetadata(code);
      expect(metadata.historicalAccess.has('close')).toBe(true);
    });
  });
});
