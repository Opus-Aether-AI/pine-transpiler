import type {
  CustomIndicator,
  IndicatorConstructor,
  StudyPlotInfo,
} from '../types';
import type { DescriptorContractReport } from './types';

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isDenseArray<T>(value: T[]): boolean {
  for (let i = 0; i < value.length; i++) {
    if (!(i in value)) return false;
  }
  return true;
}

function hasLocationForVisual(plot: StudyPlotInfo): boolean {
  return plot.type === 'chars' || plot.type === 'shapes';
}

export function validateDescriptorContract(
  indicator: CustomIndicator,
): DescriptorContractReport {
  const plotStyleAlignmentErrors: string[] = [];
  const defaultStyleAlignmentErrors: string[] = [];

  const constructorIsFunction = typeof indicator.constructor === 'function';
  let constructorIsConstructable = false;
  let constructorError: string | undefined;
  let hasCallableMain = false;

  if (constructorIsFunction) {
    try {
      const ctor = indicator.constructor as new () => IndicatorConstructor;
      const instance = new ctor();
      constructorIsConstructable = true;
      hasCallableMain = typeof instance.main === 'function';
      if (!hasCallableMain) {
        constructorError =
          'constructor instance is missing callable main(context, inputCallback)';
      }
    } catch (error) {
      constructorIsConstructable = false;
      constructorError = toMessage(error);
    }
  } else {
    constructorError = 'indicator.constructor is not a function';
  }

  const plots = Array.isArray(indicator.metainfo?.plots)
    ? indicator.metainfo.plots
    : [];
  const plotArrayIsDense = isDenseArray(plots);
  const plotIds = plots.map((p) => String(p?.id ?? ''));

  const styles = indicator.metainfo?.styles ?? {};
  const defaultStyles = indicator.metainfo?.defaults?.styles ?? {};

  for (const plot of plots) {
    const plotId = String(plot?.id ?? '');
    if (!plotId) {
      plotStyleAlignmentErrors.push(
        'metainfo.plots contains entry with empty id',
      );
      continue;
    }

    const style = (styles as Record<string, unknown>)[plotId] as
      | Record<string, unknown>
      | undefined;
    if (!style) {
      plotStyleAlignmentErrors.push(
        `metainfo.styles is missing key for plot id "${plotId}"`,
      );
    } else if (hasLocationForVisual(plot) && style.location === undefined) {
      plotStyleAlignmentErrors.push(
        `metainfo.styles["${plotId}"] is missing required location for ${plot.type} plot`,
      );
    }

    const defaultStyle = (defaultStyles as Record<string, unknown>)[plotId] as
      | Record<string, unknown>
      | undefined;
    if (!defaultStyle) {
      defaultStyleAlignmentErrors.push(
        `metainfo.defaults.styles is missing key for plot id "${plotId}"`,
      );
    }
  }

  return {
    constructorIsFunction,
    constructorIsConstructable,
    constructorError,
    hasCallableMain,
    plotArrayIsDense,
    plotIds,
    plotStyleAlignmentErrors,
    defaultStyleAlignmentErrors,
  };
}
