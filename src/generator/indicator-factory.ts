/**
 * Indicator Factory Generator
 *
 * Generates the CustomIndicator factory function that creates a TradingView indicator.
 * This is the final stage of transpilation - assembling all parts into a runnable indicator.
 */

import type {
  CustomIndicator,
  PineJSRuntime,
  StudyMetaInfo,
  StudyInputInfo,
  StudyPlotInfo,
  RuntimeContext,
  InputCallback,
} from '../types/runtime';
import type { ParsedIndicator, IndicatorFactory } from '../types';
import { generateMainFunction, generateMainFunctionWithHelpers } from './main-function-generator';

// ============================================================================
// Runtime Error & Warning Event System
// ============================================================================

/**
 * Runtime error event detail - emitted when transpiled code fails at runtime
 */
export interface TranspilerRuntimeError {
  /** Unique identifier of the indicator */
  indicatorId: string;
  /** Display name of the indicator */
  indicatorName: string;
  /** The error that occurred */
  error: Error | string;
  /** The generated JavaScript code that failed */
  generatedCode?: string;
  /** Timestamp when error occurred */
  timestamp: number;
}

/**
 * Transpiler warning event detail - emitted for unsupported features
 */
export interface TranspilerWarning {
  /** Display name of the indicator */
  indicatorName: string;
  /** Warning message */
  message: string;
  /** Line number in source (if applicable) */
  line?: number | undefined;
  /** The feature that is not supported */
  feature: string;
  /** Timestamp when warning was generated */
  timestamp: number;
}

/**
 * Emit a runtime error event that can be caught by the UI
 * This allows the Pine Script editor to display runtime errors in its console
 */
function emitRuntimeError(detail: TranspilerRuntimeError): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('transpiler-runtime-error', { detail })
    );
  }
  // Always log to browser console as well
  console.error('[Transpiler] Runtime error:', detail.error);
  if (detail.generatedCode) {
    console.error('[Transpiler] Generated code:\n', detail.generatedCode);
  }
}

/**
 * Emit a transpiler warning for unsupported features
 */
export function emitTranspilerWarning(detail: TranspilerWarning): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('transpiler-warning', { detail })
    );
  }
  // Also log to console
  console.warn(`[Transpiler] Warning: ${detail.message}`);
}

/**
 * Validate that the generated code is syntactically correct JavaScript
 * This catches syntax errors before they cause runtime failures
 */
function validateGeneratedCode(code: string): { valid: boolean; error?: string } {
  try {
    // Try to create a function with the code to validate syntax
    new Function('Std', 'context', 'inputCallback', 'isNaN', 'NaN', 'Math', code);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Metainfo Generation
// ============================================================================

/**
 * Generate the plots array for metainfo
 */
function generatePlotInfos(parsed: ParsedIndicator): StudyPlotInfo[] {
  return parsed.plots.map((plot) => ({
    id: plot.id,
    type: 'line' as const,
  })) as StudyPlotInfo[];
}

/**
 * Generate the defaults.styles object for metainfo
 */
function generateDefaultStyles(
  parsed: ParsedIndicator
): Record<string, { linestyle: number; visible: boolean; linewidth: number; plottype: number; color: string; transparency: number }> {
  return parsed.plots.reduce(
    (acc, plot) => {
      acc[plot.id] = {
        linestyle: 0,
        visible: true,
        linewidth: plot.linewidth,
        plottype: getPlotType(plot.type),
        color: plot.color,
        transparency: 0,
      };
      return acc;
    },
    {} as Record<string, { linestyle: number; visible: boolean; linewidth: number; plottype: number; color: string; transparency: number }>
  );
}

/**
 * Get numeric plot type from string type
 */
function getPlotType(type: string): number {
  switch (type) {
    case 'line':
      return 0;
    case 'histogram':
      return 1;
    case 'circles':
      return 4;
    case 'columns':
      return 5;
    case 'area':
      return 3;
    default:
      return 0;
  }
}

/**
 * Generate the defaults.inputs object for metainfo
 */
function generateDefaultInputs(parsed: ParsedIndicator): Record<string, number | boolean | string> {
  return parsed.inputs.reduce(
    (acc, input) => {
      acc[input.id] = input.defval;
      return acc;
    },
    {} as Record<string, number | boolean | string>
  );
}

/**
 * Generate the styles object for metainfo
 */
function generateStyles(parsed: ParsedIndicator): Record<string, { title: string; histogramBase: number }> {
  return parsed.plots.reduce(
    (acc, plot) => {
      acc[plot.id] = {
        title: plot.title,
        histogramBase: 0,
      };
      return acc;
    },
    {} as Record<string, { title: string; histogramBase: number }>
  );
}

/**
 * Generate the inputs array for metainfo
 */
function generateInputInfos(parsed: ParsedIndicator): StudyInputInfo[] {
  return parsed.inputs.map((input) => ({
    id: input.id,
    name: input.name,
    type: input.type,
    defval: input.defval,
    min: input.min,
    max: input.max,
  })) as StudyInputInfo[];
}

// ============================================================================
// Factory Function Generation
// ============================================================================

/**
 * Create the indicator factory function
 *
 * @param parsed - Parsed indicator metadata
 * @param indicatorId - Unique identifier for this indicator
 * @param displayName - Display name for the indicator
 * @returns Factory function that creates the CustomIndicator
 */
export function createIndicatorFactory(
  parsed: ParsedIndicator,
  indicatorId: string,
  displayName: string
): IndicatorFactory {
  const safeId = indicatorId.replace(/[^a-zA-Z0-9_]/g, '_');
  const inputIds = parsed.inputs.map((i) => i.id);

  // Generate the main function body with all helper functions included
  const mainFunctionBody = generateMainFunctionWithHelpers(parsed, inputIds);

  // Validate the generated code syntax before creating the factory
  const validation = validateGeneratedCode(mainFunctionBody);
  if (!validation.valid) {
    console.error('[Transpiler] Generated code has syntax errors:', validation.error);
    console.error('[Transpiler] Generated code:\n', mainFunctionBody);
    // Emit error event for UI to catch
    emitRuntimeError({
      indicatorId,
      indicatorName: displayName,
      error: `Syntax error in generated code: ${validation.error}`,
      generatedCode: mainFunctionBody,
      timestamp: Date.now(),
    });
  }

  // Create the factory function
  const createIndicator = (PineJS: PineJSRuntime): CustomIndicator => {
    const Std = PineJS.Std;

    return {
      name: `User_${safeId}`,
      metainfo: {
        id: `User_${safeId}@tv-basicstudies-1`,
        description: displayName,
        shortDescription: parsed.shortName,
        is_price_study: parsed.overlay,
        isCustomIndicator: true,
        format: {
          type: 'inherit',
        },
        plots: generatePlotInfos(parsed),
        defaults: {
          styles: generateDefaultStyles(parsed),
          inputs: generateDefaultInputs(parsed),
        },
        styles: generateStyles(parsed),
        inputs: generateInputInfos(parsed),
      } as StudyMetaInfo,
      constructor: function () {
        return {
          // Build the main function dynamically using the transpiled code
          main: (context: RuntimeContext, inputCallback: InputCallback) => {
            try {
              // Execute the transpiled code
              // We create a function with all the necessary variables in scope
              const executeMain = new Function(
                'Std',
                'context',
                'inputCallback',
                'isNaN',
                'NaN',
                'Math',
                mainFunctionBody
              );

              return executeMain(Std, context, inputCallback, isNaN, NaN, Math);
            } catch (error) {
              // Emit error event for UI to catch
              emitRuntimeError({
                indicatorId,
                indicatorName: displayName,
                error: error instanceof Error ? error : String(error),
                generatedCode: mainFunctionBody,
                timestamp: Date.now(),
              });
              // Return NaN for all plots on error to avoid breaking the chart
              return parsed.plots.map(() => NaN);
            }
          },
        };
      },
    };
  };

  return createIndicator;
}

// ============================================================================
// Debug/Inspection Functions
// ============================================================================

/**
 * Generate a human-readable summary of the indicator
 */
export function generateIndicatorSummary(parsed: ParsedIndicator): string {
  const lines: string[] = [];

  lines.push(`Indicator: ${parsed.name}`);
  lines.push(`Version: ${parsed.version}`);
  lines.push(`Overlay: ${parsed.overlay}`);
  lines.push('');

  if (parsed.inputs.length > 0) {
    lines.push('Inputs:');
    for (const input of parsed.inputs) {
      lines.push(`  - ${input.id}: ${input.type} = ${input.defval}`);
    }
    lines.push('');
  }

  if (parsed.variables.length > 0) {
    lines.push('Variables:');
    for (const variable of parsed.variables) {
      lines.push(`  - ${variable.name} = ${variable.expression}`);
    }
    lines.push('');
  }

  if (parsed.plots.length > 0) {
    lines.push('Plots:');
    for (const plot of parsed.plots) {
      lines.push(`  - ${plot.title}: ${plot.varName} (${plot.type}, ${plot.color})`);
    }
  }

  return lines.join('\n');
}

/**
 * Get the generated main function body for debugging
 */
export function getGeneratedMainFunctionBody(
  parsed: ParsedIndicator,
  inputIds: string[]
): string {
  return generateMainFunction(parsed, inputIds);
}
