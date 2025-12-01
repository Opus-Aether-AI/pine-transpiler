/**
 * Indicator Factory Builder
 *
 * Constructs TradingView CustomIndicator factories from parsed metadata.
 * Extracted from index.ts for better maintainability.
 */

import { MATH_HELPER_FUNCTIONS, SESSION_HELPER_FUNCTIONS } from '../mappings';
import type { SessionVariable, ComputedVariable } from '../generator/metadata-visitor';
import {
  createInputMock,
  createMathMock,
  createPlotMock,
  createPriceSources,
  createStubNamespaces,
  createSyminfoMock,
  createTimeframeMock,
  type InputValue,
  type RuntimeContextInternal,
  type StdLibraryInternal,
} from '../runtime';
import { STD_PLUS_LIBRARY } from '../stdlib';
import type { IndicatorFactory, ParsedBgcolor, ParsedInput, ParsedPlot } from '../types';
import { COLOR_MAP } from '../types';
import {
  buildDefaultInputs,
  buildDefaultStyles,
  buildInputsMetadata,
  buildPlotsMetadata,
  buildStylesMetadata,
  sanitizeIndicatorId,
} from './factory-helpers';

/**
 * Options for building an indicator factory
 */
export interface IndicatorFactoryOptions {
  indicatorId: string;
  indicatorName?: string;
  name: string;
  shortName: string;
  overlay: boolean;
  plots: ParsedPlot[];
  inputs: ParsedInput[];
  bgcolors: ParsedBgcolor[];
  usedSources: Set<string>;
  historicalAccess: Set<string>;
  mainBody: string;
  // Session and input tracking for native factory generation
  sessionVariables?: Map<string, SessionVariable>;
  derivedSessionVariables?: Map<string, string>;
  booleanInputMap?: Map<string, number>;
  // Computed variables for general indicators
  computedVariables?: Map<string, ComputedVariable>;
  // Pine variable name to input index mapping
  inputVariableMap?: Map<string, number>;
}

/**
 * Analyze which helpers are needed based on the transpiled code
 */
function analyzeRequiredHelpers(mainBody: string): {
  needsMath: boolean;
  needsSession: boolean;
  needsStdPlus: boolean;
} {
  return {
    // Math helpers: _avg, _sum, _toDegrees, _toRadians, _roundToMintick
    needsMath:
      mainBody.includes('_avg(') ||
      mainBody.includes('_sum(') ||
      mainBody.includes('_toDegrees(') ||
      mainBody.includes('_toRadians(') ||
      mainBody.includes('_roundToMintick('),
    // Session/Time helpers: _isInSession, _isMarketSession, _isPremarket, _isPostmarket, _getTimeClose, _getTradingDayTime
    needsSession:
      mainBody.includes('_isInSession(') ||
      mainBody.includes('_isMarketSession(') ||
      mainBody.includes('_isPremarket(') ||
      mainBody.includes('_isPostmarket(') ||
      mainBody.includes('_getTimeClose(') ||
      mainBody.includes('_getTradingDayTime('),
    // StdPlus: StdPlus.bb, StdPlus.hma, StdPlus.macd, etc.
    needsStdPlus: mainBody.includes('StdPlus.'),
  };
}

/**
 * Generate preamble code for the indicator
 */
export function generatePreamble(
  usedSources: Set<string>,
  historicalAccess: Set<string>,
  mainBody = '',
): string {
  let preamble = '';

  // Historical helpers for sources
  for (const source of usedSources) {
    preamble += `const _series_${source} = context.new_var(${source});\n`;
    preamble += `const _getHistorical_${source} = (offset) => _series_${source}.get(offset);\n`;
  }

  // Historical helpers for other variables
  for (const v of historicalAccess) {
    if (!usedSources.has(v)) {
      preamble += `let _getHistorical_${v} = (offset) => NaN;\n`;
    }
  }

  // Conditionally inject helpers based on what's actually used
  const { needsMath, needsSession, needsStdPlus } =
    analyzeRequiredHelpers(mainBody);

  if (needsMath) {
    preamble += `${MATH_HELPER_FUNCTIONS}\n`;
  }
  if (needsSession) {
    preamble += `${SESSION_HELPER_FUNCTIONS}\n`;
  }
  if (needsStdPlus) {
    preamble += `${STD_PLUS_LIBRARY}\n`;
  }

  return preamble;
}

/**
 * Build an indicator factory from the given options
 */
export function buildIndicatorFactory(
  options: IndicatorFactoryOptions,
): IndicatorFactory {
  const {
    indicatorId,
    indicatorName,
    name,
    shortName,
    overlay,
    plots,
    inputs,
    usedSources,
    historicalAccess,
    mainBody,
  } = options;

  // Generate preamble and full body (conditionally includes helpers)
  const preamble = generatePreamble(usedSources, historicalAccess, mainBody);
  const body = preamble + mainBody;

  const indicatorFactory: IndicatorFactory = (PineJS) => {
    const Std = PineJS.Std;
    const safeId = sanitizeIndicatorId(indicatorId);

    return {
      name: `User_${safeId}`,
      metainfo: {
        id: `User_${safeId}@tv-basicstudies-1`,
        description: indicatorName || name,
        shortDescription: shortName,
        is_price_study: overlay,
        isCustomIndicator: true,
        format: { type: 'inherit' },
        plots: buildPlotsMetadata(plots),
        defaults: {
          styles: buildDefaultStyles(plots),
          inputs: buildDefaultInputs(inputs),
        },
        styles: buildStylesMetadata(plots),
        inputs: buildInputsMetadata(inputs),
      },
      constructor: () => {
        // Compile the script once during initialization
        // biome-ignore lint/complexity/noBannedTypes: Function constructor required
        let compiledScript: Function;
        try {
          compiledScript = new Function(
            'Std',
            'context',
            'input',
            'plot',
            'indicator',
            'study',
            'strategy',
            'color',
            'ta',
            'math',
            'timeframe',
            'plotshape',
            'plotchar',
            'hline',
            'bgcolor',
            'fill',
            'box',
            'line',
            'label',
            'table',
            'str',
            'syminfo',
            'barstate',
            'close',
            'open',
            'high',
            'low',
            'volume',
            'hl2',
            'hlc3',
            'ohlc4',
            body,
          );
        } catch (e) {
          // biome-ignore lint/suspicious/noConsole: Runtime error logging
          console.error('Compilation error', e);
          compiledScript = () => {};
        }

        return {
          main: (context, inputCallback) => {
            // Create runtime mocks using factory functions
            const ta = Std;
            const _plotValues: number[] = [];

            // Cast to internal types for type safety
            const stdLib = Std as StdLibraryInternal;
            const ctx = context as RuntimeContextInternal;

            const input = createInputMock(
              inputCallback as (index: number) => InputValue,
              stdLib,
              ctx,
            );
            const plot = createPlotMock(_plotValues);
            const math = createMathMock();
            const timeframe = createTimeframeMock(stdLib, ctx);
            const syminfo = createSyminfoMock(ctx);
            const stubs = createStubNamespaces();
            const sources = createPriceSources(stdLib, ctx);

            // No-op functions for indicator declarations
            const indicator = () => {};
            const study = () => {};
            const strategy = () => {};

            // Plotting stubs that push NaN for unsupported plot types
            const plotshape = () => {
              _plotValues.push(NaN);
            };
            const plotchar = () => {
              _plotValues.push(NaN);
            };
            const hline = () => {
              _plotValues.push(NaN);
            };
            const bgcolor = () => {};
            const fill = () => {};

            // Color mapping
            const color = COLOR_MAP;

            // Execution
            try {
              compiledScript(
                Std,
                context,
                input,
                plot,
                indicator,
                study,
                strategy,
                color,
                ta,
                math,
                timeframe,
                plotshape,
                plotchar,
                hline,
                bgcolor,
                fill,
                stubs.box,
                stubs.line,
                stubs.label,
                stubs.table,
                stubs.str,
                syminfo,
                stubs.barstate,
                sources.close,
                sources.open,
                sources.high,
                sources.low,
                sources.volume,
                sources.hl2,
                sources.hlc3,
                sources.ohlc4,
              );

              return _plotValues;
            } catch (e) {
              // biome-ignore lint/suspicious/noConsole: Runtime error logging
              console.error('Script execution error', e);
              return plots.map((_p) => NaN);
            }
          },
        };
      },
    };
  };


  return indicatorFactory;
}

/**
 * Build palette colors from bgcolor calls
 */
function buildPaletteColors(bgcolors: ParsedBgcolor[]): Record<number, { name: string }> {
  const colors: Record<number, { name: string }> = {
    0: { name: 'None' },
  };
  for (let i = 0; i < bgcolors.length; i++) {
    colors[i + 1] = { name: `Color ${i + 1}` };
  }
  return colors;
}

/**
 * Build palette color defaults from bgcolor calls
 */
function buildPaletteDefaults(bgcolors: ParsedBgcolor[]): Record<number, { color: string; width: number; style: number }> {
  const defaults: Record<number, { color: string; width: number; style: number }> = {
    0: { color: 'rgba(0,0,0,0)', width: 1, style: 0 },
  };
  for (let i = 0; i < bgcolors.length; i++) {
    defaults[i + 1] = { color: bgcolors[i].color, width: 1, style: 0 };
  }
  return defaults;
}

/**
 * Build valToIndex mapping for palette
 */
function buildValToIndex(bgcolors: ParsedBgcolor[]): Record<number, number> {
  const mapping: Record<number, number> = { 0: 0 };
  for (let i = 0; i < bgcolors.length; i++) {
    mapping[i + 1] = i + 1;
  }
  return mapping;
}

/**
 * Generate a standalone PineJS factory code string
 * This produces native PineJS indicator code with proper plots, palettes, and direct Std.* calls
 */
export function generateStandaloneFactory(
  options: IndicatorFactoryOptions,
): string {
  const {
    indicatorId,
    indicatorName,
    name,
    shortName,
    overlay,
    plots,
    inputs,
    bgcolors,
    sessionVariables,
    derivedSessionVariables,
    booleanInputMap,
    computedVariables,
    inputVariableMap,
  } = options;

  const safeId = sanitizeIndicatorId(indicatorId);
  
  // Determine if we have bgcolors (session-style indicator)
  const hasBgcolors = bgcolors && bgcolors.length > 0;
  
  // Determine if we have regular plots (general indicator)
  const hasPlots = plots && plots.length > 0 && plots.some(p => p.type !== 'shape');
  
  // Build plots array - include bg_colorer if we have bgcolors
  const nativePlots: Array<{ id: string; type: string; palette?: string }> = [];
  
  // Add regular plots first
  for (const plot of plots) {
    nativePlots.push({
      id: plot.id,
      type: plot.type === 'hline' ? 'line' : plot.type,
    });
  }
  
  // Add bg_colorer for bgcolor support
  if (hasBgcolors) {
    nativePlots.push({
      id: 'sessionBg',
      type: 'bg_colorer',
      palette: 'bgPalette',
    });
  }
  
  // Build palettes
  const palettes = hasBgcolors ? {
    bgPalette: {
      colors: buildPaletteColors(bgcolors),
      valToIndex: buildValToIndex(bgcolors),
    },
  } : {};
  
  // Build palette defaults
  const paletteDefaults = hasBgcolors ? {
    bgPalette: {
      colors: buildPaletteDefaults(bgcolors),
    },
  } : {};
  
  // Build style defaults
  const styleDefaults: Record<string, { transparency?: number }> = {};
  if (hasBgcolors) {
    // Use average transparency from bgcolors
    const avgTransparency = bgcolors.reduce((sum, bg) => sum + bg.transparency, 0) / bgcolors.length;
    styleDefaults.sessionBg = { transparency: Math.round(avgTransparency) };
  }
  
  // Add plot styles for regular plots
  for (const plot of plots) {
    if (plot.type === 'line' || plot.type === 'histogram' || plot.type === 'area') {
      styleDefaults[plot.id] = {
        linestyle: 0,
        linewidth: plot.linewidth || 1,
        plottype: plot.type === 'histogram' ? 1 : plot.type === 'area' ? 3 : 0,
        trackPrice: false,
        transparency: 0,
        color: plot.color || '#2962FF',
      };
    } else if (plot.type === 'shape') {
      styleDefaults[plot.id] = {
        plottype: 'shape_circle',
        location: 'AboveBar',
        color: plot.color || '#2962FF',
        size: 'small',
      };
    }
  }
  
  // Build input defaults
  const inputDefaults: Record<string, string | number | boolean> = {};
  for (const input of inputs) {
    inputDefaults[input.id] = input.defval;
  }
  
  // Build styles metadata
  const stylesMetadata: Record<string, { title: string; histogramBase?: number }> = {};
  if (hasBgcolors) {
    stylesMetadata.sessionBg = { title: 'Session Background' };
  }
  
  // Add plot style metadata
  for (const plot of plots) {
    stylesMetadata[plot.id] = { 
      title: plot.title || plot.id,
      ...(plot.type === 'histogram' ? { histogramBase: 0 } : {}),
    };
  }
  
  // Build inputs metadata
  const inputsMetadata = inputs.map(input => ({
    id: input.id,
    name: input.name,
    type: input.type === 'integer' ? 'integer' : 
          input.type === 'float' ? 'float' :
          input.type === 'bool' ? 'bool' :
          input.type === 'source' ? 'source' :
          input.type === 'session' ? 'session' : 'text',
    defval: input.defval,
    ...(input.min !== undefined ? { min: input.min } : {}),
    ...(input.max !== undefined ? { max: input.max } : {}),
    ...(input.options ? { options: input.options } : {}),
  }));

  // Generate the this.main() body code
  const mainBodyCode = generateNativeMainBody(
    inputs, 
    plots,
    bgcolors, 
    sessionVariables, 
    derivedSessionVariables, 
    booleanInputMap,
    computedVariables,
    inputVariableMap,
  );

  return `/**
 * PineJS Indicator Factory
 * Generated by @opusaether/pine-transpiler
 *
 * Original indicator: ${indicatorName || name}
 *
 * Usage:
 *   const indicator = createIndicator(PineJS);
 *   // Register with TradingView chart
 */

function createIndicator(PineJS) {
  const Std = PineJS.Std;

  return {
    name: 'User_${safeId}',
    metainfo: {
      _metainfoVersion: 53,
      id: 'User_${safeId}@tv-basicstudies-1',
      description: ${JSON.stringify(indicatorName || name)},
      shortDescription: ${JSON.stringify(shortName)},
      is_hidden_study: false,
      is_price_study: ${overlay},
      isCustomIndicator: true,
      format: { type: 'inherit' },

      plots: ${JSON.stringify(nativePlots, null, 8).replace(/\n/g, '\n      ')},
${hasBgcolors ? `
      palettes: ${JSON.stringify(palettes, null, 8).replace(/\n/g, '\n      ')},
` : ''}
      defaults: {
${hasBgcolors ? `        palettes: ${JSON.stringify(paletteDefaults, null, 10).replace(/\n/g, '\n        ')},
` : ''}        styles: ${JSON.stringify(styleDefaults, null, 10).replace(/\n/g, '\n        ')},
        inputs: ${JSON.stringify(inputDefaults, null, 10).replace(/\n/g, '\n        ')},
      },

      styles: ${JSON.stringify(stylesMetadata, null, 8).replace(/\n/g, '\n      ')},

      inputs: ${JSON.stringify(inputsMetadata, null, 8).replace(/\n/g, '\n      ')},
    },

    constructor: function() {
      this.main = function(context, inputCallback) {
${mainBodyCode}
      };
    },
  };
}

export { createIndicator };
`;
}

/**
 * Generate native main body code
 * Handles both session indicators (bgcolor) and general indicators (plots with ta.*)
 */
function generateNativeMainBody(
  inputs: ParsedInput[],
  plots: ParsedPlot[],
  bgcolors: ParsedBgcolor[],
  sessionVariables?: Map<string, SessionVariable>,
  derivedSessionVariables?: Map<string, string>,
  booleanInputMap?: Map<string, number>,
  computedVariables?: Map<string, ComputedVariable>,
  inputVariableMap?: Map<string, number>,
): string {
  const lines: string[] = [];
  
  // Create mapping from input index to variable name AND from Pine var name to our var name
  const inputIndexToVarName: Map<number, string> = new Map();
  const pineVarToJsVar: Map<string, string> = new Map();
  
  // Read all inputs
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const varName = input.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
    inputIndexToVarName.set(i, varName);
    
    if (input.type === 'bool') {
      lines.push(`        const ${varName} = Boolean(inputCallback(${i}));`);
    } else if (input.type === 'integer' || input.type === 'float') {
      lines.push(`        const ${varName} = Number(inputCallback(${i}));`);
    } else if (input.type === 'source') {
      // Source inputs need to be resolved to actual price data
      lines.push(`        const ${varName}_src = inputCallback(${i});`);
      lines.push(`        const ${varName} = Std[${varName}_src] ? Std[${varName}_src](context) : Std.close(context);`);
    } else {
      lines.push(`        const ${varName} = inputCallback(${i});`);
    }
  }
  
  // Build reverse mapping: Pine variable name -> JavaScript variable name
  // This uses inputVariableMap which maps Pine var names to input indices
  if (inputVariableMap) {
    for (const [pineVar, inputIdx] of inputVariableMap) {
      const jsVar = inputIndexToVarName.get(inputIdx);
      if (jsVar) {
        pineVarToJsVar.set(pineVar, jsVar);
      }
    }
  }
  
  lines.push('');
  
  // Check if this is a session-style indicator or general indicator
  const hasBgcolors = bgcolors && bgcolors.length > 0;
  const hasPlots = plots && plots.length > 0;
  const hasComputedVars = computedVariables && computedVariables.size > 0;
  
  // Generate computed variables if we have them (for general indicators)
  if (hasComputedVars && computedVariables) {
    lines.push('        // Computed values');
    
    // Sort by dependencies (simple topological sort - assumes no circular deps)
    const sorted = topologicalSort(computedVariables);
    
    for (const cv of sorted) {
      // Replace input variable references in expression using pineVarToJsVar
      let expr = cv.expression;
      
      // First, use our accurate Pine variable -> JS variable mapping
      for (const [pineVar, jsVar] of pineVarToJsVar) {
        // Only replace whole-word matches
        const regex = new RegExp(`\\b${pineVar}\\b`, 'g');
        expr = expr.replace(regex, jsVar);
      }
      
      // Replace ta.* with Std.*
      expr = expr.replace(/\bta\.(\w+)\(/g, 'Std.$1(');
      
      // Add context parameter to Std.* calls if not present
      expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
        if (args.includes('context')) {
          return match;
        }
        return `Std.${fn}(${args}, context)`;
      });
      
      lines.push(`        const ${cv.name} = ${expr};`);
    }
    lines.push('');
  }
  
  // If we have bgcolors, generate session detection logic
  if (hasBgcolors) {
    // Build session info if we have session variables
    const sessionInfo: Array<{
      sessionVarName: string;
      inputVarName: string;
      timezone: string;
      shortName: string;
    }> = [];
    
    if (sessionVariables) {
      for (const [varName, sessVar] of sessionVariables) {
        const inputIdx = sessVar.inputIndex;
        if (inputIdx !== undefined) {
          const inputVarName = inputIndexToVarName.get(inputIdx) || '';
          const input = inputs[inputIdx];
          const shortName = input?.name.split(' ')[0] || varName.replace(/^in/, '');
          sessionInfo.push({
            sessionVarName: varName,
            inputVarName,
            timezone: sessVar.timezone,
            shortName,
          });
        }
      }
    }
    
    // Generate session checking helper if we have sessions
    if (sessionInfo.length > 0) {
      lines.push('        // Session checking helper (DST-safe via timezone conversion)');
      lines.push('        const isInSession = (sessionStr, timezone) => {');
      lines.push('          if (!sessionStr) return false;');
      lines.push('          const parts = sessionStr.split(":");');
      lines.push('          const timeRange = parts[0] || "";');
      lines.push('          const rangeParts = timeRange.split("-");');
      lines.push('          if (rangeParts.length !== 2) return false;');
      lines.push('          const startTime = rangeParts[0];');
      lines.push('          const endTime = rangeParts[1];');
      lines.push('          const startHour = parseInt(startTime.slice(0, 2), 10);');
      lines.push('          const startMin = parseInt(startTime.slice(2, 4), 10) || 0;');
      lines.push('          const endHour = parseInt(endTime.slice(0, 2), 10);');
      lines.push('          const endMin = parseInt(endTime.slice(2, 4), 10) || 0;');
      lines.push('          const barTime = Std.time(context);');
      lines.push('          const date = new Date(barTime);');
      lines.push('          const options = { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false };');
      lines.push('          const timeStr = date.toLocaleTimeString("en-US", options);');
      lines.push('          const [hourStr, minStr] = timeStr.split(":");');
      lines.push('          const hour = parseInt(hourStr, 10);');
      lines.push('          const minute = parseInt(minStr, 10);');
      lines.push('          const currentMins = hour * 60 + minute;');
      lines.push('          const startMins = startHour * 60 + startMin;');
      lines.push('          const endMins = endHour * 60 + endMin;');
      lines.push('          if (startMins <= endMins) {');
      lines.push('            return currentMins >= startMins && currentMins < endMins;');
      lines.push('          }');
      lines.push('          return currentMins >= startMins || currentMins < endMins;');
      lines.push('        };');
      lines.push('');
      
      lines.push('        // Session membership (DST-safe via timezone)');
      for (const sess of sessionInfo) {
        lines.push(`        const ${sess.sessionVarName} = isInSession(${sess.inputVarName}, "${sess.timezone}");`);
      }
      lines.push('');
    }
    
    // Generate derived session variables (overlaps)
    if (derivedSessionVariables && derivedSessionVariables.size > 0) {
      lines.push('        // Session overlaps');
      for (const [varName, exprStr] of derivedSessionVariables) {
        lines.push(`        const ${varName} = ${exprStr};`);
      }
      lines.push('');
    }
    
    // Build boolean input name map for condition resolution
    const boolVarNameToInputVar: Map<string, string> = new Map();
    if (booleanInputMap) {
      for (const [varName, inputIdx] of booleanInputMap) {
        const inputVarName = inputIndexToVarName.get(inputIdx);
        if (inputVarName) {
          boolVarNameToInputVar.set(varName, inputVarName);
        }
      }
    }
    
    lines.push('        // Determine background color index');
    lines.push('        let colorIndex = 0;');
    lines.push('');
    
    // Generate condition checks (reverse order: later bgcolors override earlier ones)
    for (let i = bgcolors.length - 1; i >= 0; i--) {
      const bg = bgcolors[i];
      const colorIdx = i + 1;
      
      if (bg.condition) {
        let condition = bg.condition;
        for (const [pineVarName, inputVarName] of boolVarNameToInputVar) {
          const regex = new RegExp(`\\b${pineVarName}\\b`, 'g');
          condition = condition.replace(regex, inputVarName);
        }
        lines.push(`        if (${condition}) colorIndex = ${colorIdx};`);
      } else {
        lines.push(`        // Color ${colorIdx}: condition not extracted`);
      }
    }
    
    lines.push('');
    lines.push('        return [colorIndex];');
  } else if (hasPlots) {
    // General indicator with plots - return plot values
    lines.push('        // Return plot values');
    const plotReturns: string[] = [];
    
    for (const plot of plots) {
      if (plot.valueExpr) {
        // The value expression might reference computed variables or input variables
        let expr = plot.valueExpr;
        
        // Replace Pine variable names with JS variable names
        for (const [pineVar, jsVar] of pineVarToJsVar) {
          const regex = new RegExp(`\\b${pineVar}\\b`, 'g');
          expr = expr.replace(regex, jsVar);
        }
        
        // Replace ta.* with Std.* and add context parameter
        expr = expr.replace(/\bta\.(\w+)\(/g, 'Std.$1(');
        expr = expr.replace(/Std\.(\w+)\(([^)]+)\)/g, (match, fn, args) => {
          if (args.includes('context')) {
            return match;
          }
          return `Std.${fn}(${args}, context)`;
        });
        
        plotReturns.push(expr);
      } else {
        plotReturns.push('NaN');
      }
    }
    
    lines.push(`        return [${plotReturns.join(', ')}];`);
  } else {
    lines.push('        return [];');
  }
  
  return lines.join('\n');
}

/**
 * Simple topological sort for computed variables based on dependencies
 */
function topologicalSort(vars: Map<string, ComputedVariable>): ComputedVariable[] {
  const result: ComputedVariable[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // Circular dependency, skip
    
    visiting.add(name);
    const cv = vars.get(name);
    if (cv) {
      for (const dep of cv.dependencies) {
        if (vars.has(dep)) {
          visit(dep);
        }
      }
      visited.add(name);
      result.push(cv);
    }
    visiting.delete(name);
  }
  
  for (const name of vars.keys()) {
    visit(name);
  }
  
  return result;
}
