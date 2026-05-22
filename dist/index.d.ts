export declare interface ChartRuntimeHarnessOptions {
    source: string;
    fixtureName?: string;
    indicatorId?: string;
    indicatorName?: string;
    bars?: number;
    barIndexStart?: number;
}

export declare interface ChartRuntimeHarnessReport {
    fixtureName?: string;
    indicatorId: string;
    barsRequested: number;
    barsProcessed: number;
    transpileError?: string;
    descriptor: DescriptorContractReport;
    runtimeErrors: HarnessIssue[];
    reducer: ReducerContractReport;
    unimplementedStdCalls: string[];
    pass: boolean;
}

export declare interface DescriptorContractReport {
    constructorIsFunction: boolean;
    constructorIsConstructable: boolean;
    constructorError?: string;
    hasCallableMain: boolean;
    plotArrayIsDense: boolean;
    plotIds: string[];
    plotStyleAlignmentErrors: string[];
    defaultStyleAlignmentErrors: string[];
}

export declare interface HarnessIssue {
    stage: 'transpile' | 'descriptor' | 'construct' | 'init' | 'main' | 'reducer';
    barIndex?: number;
    plotId?: string;
    message: string;
}

export declare interface PlotExecutionFrame {
    plot: StudyPlotInfo;
    value: unknown;
}

export declare interface ReducerContractReport {
    reducerErrors: HarnessIssue[];
    reducersExecuted: number;
}

export declare function runChartRuntimeHarness(options: ChartRuntimeHarnessOptions): ChartRuntimeHarnessReport;

/**
 * Study/Indicator plot definition
 */
declare interface StudyPlotInfo {
    /** Unique plot identifier */
    id: string;
    /** Plot type/style. The 'shapes', 'chars', 'bg_colorer' members are
     *  the PineJS metainfo types emitted by `buildPlotsMetadata` for
     *  plotshape / plotchar / bgcolor calls; the rest are AST-side names
     *  used by the metadata visitor. */
    type: 'line' | 'histogram' | 'circles' | 'column' | 'area' | 'stepline' | 'cross' | 'shape' | 'shapes' | 'chars' | 'hline' | 'bg_colorer';
    /** Visual renderer style marker (required by chart runtime for shapes/chars). */
    plottype?: number | string;
    /** Chars-plot glyph marker (required for chars renderer contract). */
    char?: string;
    /** Optional visual location hint (AboveBar/BelowBar/etc.). */
    location?: string;
    /** Optional price for hline */
    price?: number;
}

export declare interface SyntheticBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export { }
