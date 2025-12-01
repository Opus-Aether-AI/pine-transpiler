/**
 * Indicator Factory Builder
 *
 * Constructs TradingView CustomIndicator factories from parsed metadata.
 * Extracted from index.ts for better maintainability.
 */

import { MATH_HELPER_FUNCTIONS, SESSION_HELPER_FUNCTIONS } from '../mappings';
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
import type { IndicatorFactory, ParsedInput, ParsedPlot } from '../types';
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
  usedSources: Set<string>;
  historicalAccess: Set<string>;
  mainBody: string;
}

/**
 * Generate preamble code for the indicator
 */
export function generatePreamble(
  usedSources: Set<string>,
  historicalAccess: Set<string>,
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

  // Inject Helpers
  preamble += `${MATH_HELPER_FUNCTIONS}\n`;
  preamble += `${SESSION_HELPER_FUNCTIONS}\n`;
  preamble += `${STD_PLUS_LIBRARY}\n`;

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

  // Generate preamble and full body
  const preamble = generatePreamble(usedSources, historicalAccess);
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
