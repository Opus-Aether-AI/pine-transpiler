/**
 * Factory module index
 *
 * Re-exports indicator factory builder utilities.
 */

export {
  buildDefaultInputs,
  buildDefaultStyles,
  buildInputsMetadata,
  buildPlotsMetadata,
  buildStylesMetadata,
  mapPlotType,
  sanitizeIndicatorId,
} from './factory-helpers';

export {
  buildIndicatorFactory,
  generatePreamble,
  generateStandaloneFactory,
  type IndicatorFactoryOptions,
} from './indicator-factory';
