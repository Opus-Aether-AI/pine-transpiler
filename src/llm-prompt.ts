/**
 * LLM Conversion Prompt for Pine Script → PineJS
 *
 * This prompt can be given to an LLM along with Pine Script code
 * to reliably generate valid PineJS output.
 */

export const PINESCRIPT_TO_PINEJS_LLM_PROMPT = `# Pine Script to PineJS Conversion Guide for LLMs

You are converting Pine Script (TradingView's scripting language) to PineJS (JavaScript-based custom indicator format). Follow these rules EXACTLY.

---

## OUTPUT FORMAT (REQUIRED)

Your output MUST be a JavaScript function named \`createIndicator\` that returns a CustomIndicator object:

\`\`\`javascript
function createIndicator(PineJS) {
  return {
    name: 'Indicator Name',
    metainfo: { /* metadata */ },
    constructor: function() {
      this.main = (context, inputCallback) => {
        // calculation logic
        return [plotValue1, plotValue2, ...];
      };
    },
  };
}
export { createIndicator };
\`\`\`

---

## CONVERSION RULES

### 1. INDICATOR DECLARATION

**Pine Script:**
\`\`\`pinescript
//@version=5
indicator("My Indicator", overlay=true)
\`\`\`

**PineJS:**
\`\`\`javascript
name: 'My Indicator',
metainfo: {
  _metainfoVersion: 53,
  id: 'MyIndicator@tv-basicstudies-1',
  description: 'My Indicator',
  shortDescription: 'My Indicator',
  is_hidden_study: false,
  is_price_study: true,  // overlay=true → is_price_study: true
  isCustomIndicator: true,
  format: { type: 'inherit' },
  // ... plots, defaults, styles, inputs
}
\`\`\`

- \`overlay=true\` → \`is_price_study: true\`
- \`overlay=false\` → \`is_price_study: false\`

---

### 2. INPUT DECLARATIONS

**Pine Script:**
\`\`\`pinescript
length = input.int(14, "Length", minval=1, maxval=500)
source = input.source(close, "Source")
showMA = input.bool(true, "Show MA")
mult = input.float(2.0, "Multiplier", step=0.1)
\`\`\`

**PineJS metainfo.inputs array:**
\`\`\`javascript
inputs: [
  { id: 'length', name: 'Length', type: 'integer', defval: 14, min: 1, max: 500 },
  { id: 'source', name: 'Source', type: 'source', defval: 'close' },
  { id: 'showMA', name: 'Show MA', type: 'bool', defval: true },
  { id: 'mult', name: 'Multiplier', type: 'float', defval: 2.0, step: 0.1 },
]
\`\`\`

**PineJS metainfo.defaults.inputs:**
\`\`\`javascript
defaults: {
  inputs: {
    length: 14,
    source: 'close',
    showMA: true,
    mult: 2.0,
  }
}
\`\`\`

**Accessing inputs in constructor (0-based index matching inputs array order):**
\`\`\`javascript
this.main = (context, inputCallback) => {
  const length = inputCallback(0);   // first input
  const source = inputCallback(1);   // second input
  const showMA = inputCallback(2);   // third input
  const mult = inputCallback(3);     // fourth input
}
\`\`\`

---

### 3. PRICE SOURCES

**Pine Script → PineJS mapping:**

| Pine Script | PineJS Code |
|-------------|-------------|
| \`close\` | \`Std.close(context)\` |
| \`open\` | \`Std.open(context)\` |
| \`high\` | \`Std.high(context)\` |
| \`low\` | \`Std.low(context)\` |
| \`volume\` | \`Std.volume(context)\` |
| \`hl2\` | \`Std.hl2(context)\` |
| \`hlc3\` | \`Std.hlc3(context)\` |
| \`ohlc4\` | \`Std.ohlc4(context)\` |

---

### 4. TECHNICAL ANALYSIS FUNCTIONS

**CRITICAL: Series Variables**

Most TA functions require a "series" (historical data). You MUST wrap values with \`context.new_var()\`:

\`\`\`javascript
const close = Std.close(context);
const closeSeries = context.new_var(close);  // REQUIRED for TA functions
const sma = Std.sma(closeSeries, length, context);
\`\`\`

**Function Mapping Table:**

| Pine Script | PineJS | Arguments |
|-------------|--------|-----------|
| \`ta.sma(src, len)\` | \`Std.sma(series, length, context)\` | series, int, context |
| \`ta.ema(src, len)\` | \`Std.ema(series, length, context)\` | series, int, context |
| \`ta.wma(src, len)\` | \`Std.wma(series, length, context)\` | series, int, context |
| \`ta.rma(src, len)\` | \`Std.rma(series, length, context)\` | series, int, context |
| \`ta.vwma(src, len)\` | \`Std.vwma(series, length, context)\` | series, int, context |
| \`ta.rsi(src, len)\` | \`Std.rsi(series, length, context)\` | series, int, context |
| \`ta.stoch(close, high, low, len)\` | \`Std.stoch(closeSeries, highSeries, lowSeries, length, context)\` | 4 series, int, context |
| \`ta.atr(len)\` | \`Std.atr(length, context)\` | int, context |
| \`ta.tr\` | \`Std.tr(context)\` | context only |
| \`ta.stdev(src, len)\` | \`Std.stdev(series, length, context)\` | series, int, context |
| \`ta.highest(src, len)\` | \`Std.highest(series, length, context)\` | series, int, context |
| \`ta.lowest(src, len)\` | \`Std.lowest(series, length, context)\` | series, int, context |
| \`ta.crossover(a, b)\` | \`Std.crossover(seriesA, seriesB, context)\` | 2 series, context |
| \`ta.crossunder(a, b)\` | \`Std.crossunder(seriesA, seriesB, context)\` | 2 series, context |
| \`ta.change(src)\` | \`Std.change(series)\` | series only |
| \`ta.change(src, n)\` | \`Std.change(series, n)\` | series, int |
| \`ta.cum(src)\` | \`Std.cum(series, context)\` | series, context |
| \`ta.valuewhen(cond, src, n)\` | \`Std.valuewhen(condSeries, srcSeries, n, context)\` | 2 series, int, context |
| \`ta.barssince(cond)\` | \`Std.barssince(condSeries, context)\` | series, context |
| \`ta.pivothigh(src, lb, rb)\` | \`Std.pivothigh(series, leftbars, rightbars, context)\` | series, int, int, context |
| \`ta.pivotlow(src, lb, rb)\` | \`Std.pivotlow(series, leftbars, rightbars, context)\` | series, int, int, context |

**Multi-Output Functions (MACD, BB, etc.):**

| Pine Script | PineJS |
|-------------|--------|
| \`[macdLine, signalLine, histLine] = ta.macd(src, fast, slow, signal)\` | See example below |

\`\`\`javascript
// MACD returns object with properties
const macdResult = Std.macd(srcSeries, fastLen, slowLen, signalLen, context);
const macdLine = macdResult.macd;
const signalLine = macdResult.signal;
const histogram = macdResult.histogram;
\`\`\`

\`\`\`javascript
// Bollinger Bands
const bbResult = Std.bb(srcSeries, length, mult, context);
const middle = bbResult.middle;
const upper = bbResult.upper;
const lower = bbResult.lower;
\`\`\`

---

### 5. MATH FUNCTIONS

| Pine Script | PineJS |
|-------------|--------|
| \`math.abs(x)\` | \`Math.abs(x)\` |
| \`math.max(a, b)\` | \`Math.max(a, b)\` |
| \`math.min(a, b)\` | \`Math.min(a, b)\` |
| \`math.round(x)\` | \`Math.round(x)\` |
| \`math.floor(x)\` | \`Math.floor(x)\` |
| \`math.ceil(x)\` | \`Math.ceil(x)\` |
| \`math.sqrt(x)\` | \`Math.sqrt(x)\` |
| \`math.pow(x, y)\` | \`Math.pow(x, y)\` |
| \`math.log(x)\` | \`Math.log(x)\` |
| \`math.exp(x)\` | \`Math.exp(x)\` |
| \`math.sign(x)\` | \`Math.sign(x)\` |
| \`math.avg(a, b, ...)\` | \`Std.avg(a, b, ...)\` |
| \`math.sum(src, len)\` | \`Std.sum(series, length, context)\` |

---

### 6. NA HANDLING

| Pine Script | PineJS |
|-------------|--------|
| \`na\` | \`NaN\` |
| \`na(x)\` | \`Std.na(x)\` or \`Number.isNaN(x)\` |
| \`nz(x)\` | \`Std.nz(x)\` |
| \`nz(x, replacement)\` | \`Std.nz(x, replacement)\` |
| \`fixnan(x)\` | \`Std.fixnan(series, context)\` |

---

### 7. CONDITIONAL LOGIC

**Pine Script ternary:**
\`\`\`pinescript
color = close > open ? color.green : color.red
\`\`\`

**PineJS:**
\`\`\`javascript
const color = close > open ? '#00FF00' : '#FF0000';
\`\`\`

**Pine Script if/else:**
\`\`\`pinescript
if close > open
    result := 1
else
    result := -1
\`\`\`

**PineJS:**
\`\`\`javascript
let result;
if (close > open) {
  result = 1;
} else {
  result = -1;
}
\`\`\`

---

### 8. PLOT DEFINITIONS

**Pine Script:**
\`\`\`pinescript
plot(smaValue, "SMA", color=color.blue, linewidth=2)
plot(emaValue, "EMA", color=color.red)
hline(0, "Zero", color=color.gray)
\`\`\`

**PineJS metainfo.plots:**
\`\`\`javascript
plots: [
  { id: 'plot_0', type: 'line' },
  { id: 'plot_1', type: 'line' },
  { id: 'hline_0', type: 'hline' },  // for horizontal lines
]
\`\`\`

**PineJS metainfo.defaults.styles:**
\`\`\`javascript
defaults: {
  styles: {
    plot_0: { linestyle: 0, visible: true, linewidth: 2, plottype: 0, color: '#2196F3', transparency: 0 },
    plot_1: { linestyle: 0, visible: true, linewidth: 1, plottype: 0, color: '#F44336', transparency: 0 },
  },
  hlines: {
    hline_0: { color: '#787878', linestyle: 0, linewidth: 1, visible: true },
  }
}
\`\`\`

**PineJS metainfo.styles:**
\`\`\`javascript
styles: {
  plot_0: { title: 'SMA', histogramBase: 0 },
  plot_1: { title: 'EMA', histogramBase: 0 },
}
\`\`\`

**Plot types (plottype values):**
- \`0\` = Line
- \`1\` = Histogram
- \`2\` = Cross
- \`3\` = Area
- \`4\` = Columns
- \`5\` = Circles
- \`6\` = Line with breaks

**Linestyle values:**
- \`0\` = Solid
- \`1\` = Dotted
- \`2\` = Dashed

---

### 9. COLOR MAPPING

| Pine Script | PineJS Hex |
|-------------|------------|
| \`color.red\` | \`#F44336\` |
| \`color.green\` | \`#4CAF50\` |
| \`color.blue\` | \`#2196F3\` |
| \`color.yellow\` | \`#FFEB3B\` |
| \`color.orange\` | \`#FF9800\` |
| \`color.purple\` | \`#9C27B0\` |
| \`color.white\` | \`#FFFFFF\` |
| \`color.black\` | \`#000000\` |
| \`color.gray\` | \`#9E9E9E\` |
| \`color.teal\` | \`#009688\` |
| \`color.aqua\` | \`#00BCD4\` |
| \`color.lime\` | \`#CDDC39\` |
| \`color.fuchsia\` | \`#E91E63\` |
| \`color.maroon\` | \`#880E4F\` |
| \`color.navy\` | \`#1A237E\` |
| \`color.olive\` | \`#827717\` |
| \`color.silver\` | \`#BDBDBD\` |

---

### 10. RETURNING PLOT VALUES

The \`this.main\` function MUST return an array with one value per plot, in the same order as the \`plots\` array:

\`\`\`javascript
// If plots: [{ id: 'plot_0' }, { id: 'plot_1' }, { id: 'plot_2' }]
return [smaValue, emaValue, rsiValue];
\`\`\`

For plots you want to hide conditionally, return \`NaN\`:
\`\`\`javascript
return [showMA ? smaValue : NaN, emaValue];
\`\`\`

---

## COMPLETE EXAMPLE

**Pine Script:**
\`\`\`pinescript
//@version=5
indicator("RSI with MA", overlay=false)

length = input.int(14, "RSI Length", minval=1)
maLength = input.int(9, "MA Length", minval=1)
overbought = input.int(70, "Overbought")
oversold = input.int(30, "Oversold")

rsiValue = ta.rsi(close, length)
rsiMA = ta.sma(rsiValue, maLength)

plot(rsiValue, "RSI", color=color.purple, linewidth=2)
plot(rsiMA, "RSI MA", color=color.orange)
hline(overbought, "Overbought", color=color.red)
hline(oversold, "Oversold", color=color.green)
\`\`\`

**PineJS Output:**
\`\`\`javascript
function createIndicator(PineJS) {
  return {
    name: 'RSI with MA',
    metainfo: {
      _metainfoVersion: 53,
      id: 'RSIwithMA@tv-basicstudies-1',
      description: 'RSI with MA',
      shortDescription: 'RSI+MA',
      is_hidden_study: false,
      is_price_study: false,
      isCustomIndicator: true,
      format: { type: 'inherit' },
      plots: [
        { id: 'plot_0', type: 'line' },
        { id: 'plot_1', type: 'line' },
      ],
      hlines: [
        { id: 'hline_0', value: 70, color: '#F44336', linestyle: 0, linewidth: 1, visible: true },
        { id: 'hline_1', value: 30, color: '#4CAF50', linestyle: 0, linewidth: 1, visible: true },
      ],
      defaults: {
        styles: {
          plot_0: { linestyle: 0, visible: true, linewidth: 2, plottype: 0, color: '#9C27B0', transparency: 0 },
          plot_1: { linestyle: 0, visible: true, linewidth: 1, plottype: 0, color: '#FF9800', transparency: 0 },
        },
        inputs: { length: 14, maLength: 9, overbought: 70, oversold: 30 },
      },
      styles: {
        plot_0: { title: 'RSI', histogramBase: 0 },
        plot_1: { title: 'RSI MA', histogramBase: 0 },
      },
      inputs: [
        { id: 'length', name: 'RSI Length', type: 'integer', defval: 14, min: 1 },
        { id: 'maLength', name: 'MA Length', type: 'integer', defval: 9, min: 1 },
        { id: 'overbought', name: 'Overbought', type: 'integer', defval: 70 },
        { id: 'oversold', name: 'Oversold', type: 'integer', defval: 30 },
      ],
    },
    constructor: function() {
      const Std = PineJS.Std;

      this.main = (context, inputCallback) => {
        // Get inputs by index
        const length = inputCallback(0);
        const maLength = inputCallback(1);

        // Get close price and create series
        const close = Std.close(context);
        const closeSeries = context.new_var(close);

        // Calculate RSI
        const rsiValue = Std.rsi(closeSeries, length, context);

        // Create RSI series for MA calculation
        const rsiSeries = context.new_var(rsiValue);
        const rsiMA = Std.sma(rsiSeries, maLength, context);

        // Return plot values in order
        return [rsiValue, rsiMA];
      };
    },
  };
}

export { createIndicator };
\`\`\`

---

## CHECKLIST BEFORE OUTPUTTING

1. ✅ Function named \`createIndicator(PineJS)\` exists
2. ✅ Returns object with \`name\`, \`metainfo\`, \`constructor\`
3. ✅ \`metainfo._metainfoVersion\` is \`53\`
4. ✅ \`metainfo.isCustomIndicator\` is \`true\`
5. ✅ All Pine Script inputs have matching entries in \`metainfo.inputs\` array
6. ✅ All plots have matching entries in \`metainfo.plots\` array
7. ✅ \`defaults.inputs\` and \`defaults.styles\` match the inputs and plots
8. ✅ \`constructor\` defines \`this.main = (context, inputCallback) => { ... }\`
9. ✅ All price sources use \`Std.close(context)\`, etc.
10. ✅ All values used in TA functions are wrapped with \`context.new_var()\`
11. ✅ Input values are retrieved with \`inputCallback(index)\` in correct order
12. ✅ \`this.main\` returns array with one value per plot
13. ✅ \`export { createIndicator };\` is at the end
`;

/**
 * Copy the LLM prompt to clipboard
 */
export async function copyLLMPromptToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(PINESCRIPT_TO_PINEJS_LLM_PROMPT);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download the LLM prompt as a markdown file
 */
export function downloadLLMPrompt(): void {
  const blob = new Blob([PINESCRIPT_TO_PINEJS_LLM_PROMPT], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pinescript-to-pinejs-llm-prompt.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
