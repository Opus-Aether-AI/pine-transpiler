/**
 * Factory module index
 *
 * Re-exports indicator factory builder utilities.
 */

export {
  attachPineJsBody,
  buildDefaultInputs,
  buildDefaultStyles,
  buildInputsMetadata,
  buildPlotsMetadata,
  buildStylesMetadata,
  mapPlotType,
  PINE_JS_BODY_PROPERTY,
  sanitizeIndicatorId,
} from './factory-helpers';

export {
  buildIndicatorFactory,
  generatePreamble,
  generateStandaloneFactory,
  type IndicatorFactoryOptions,
} from './indicator-factory';
