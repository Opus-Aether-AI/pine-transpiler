/**
 * Pure helpers that turn visual-event args (see
 * docs/HOST_RENDERING_CONTRACT.md) into widget override values.
 */
export declare const TRANSPARENT = "rgba(0,0,0,0)";
/** Pine's documented `line.new` default colour (`color.blue`). */
export declare const DEFAULT_LINE_COLOR = "#2962FF";
/** Neutral text colour that reads on light and dark chart themes. */
export declare const DEFAULT_TEXT_COLOR = "#787B86";
export declare const DEFAULT_FONT_SIZE = 14;
/** Applied to every shape: script drawings are not user drawings. */
export declare const SCRIPT_SHAPE_OPTIONS: {
    readonly lock: true;
    readonly disableSelection: true;
    readonly disableSave: true;
    readonly disableUndo: true;
};
export declare function finite(value: unknown): number | null;
export declare function text(value: unknown): string | null;
/** A colour arg, or null for Pine `na` (numeric NaN, 'NaN', 'na'). */
export declare function color(value: unknown): string | null;
export declare function colorOrTransparent(value: unknown): string;
export declare function fontSize(value: unknown): number | null;
/**
 * `line.style_*` suffix → widget `linestyle`. Arrow styles have no
 * equivalent on a trend line and draw solid.
 */
export declare function lineStyle(value: unknown): number | null;
export declare function extend(value: unknown): {
    extendLeft: boolean;
    extendRight: boolean;
} | null;
export type HorzAlign = 'left' | 'center' | 'right';
export type VertAlign = 'top' | 'middle' | 'bottom';
export declare function horzAlign(value: unknown): HorzAlign | null;
export declare function vertAlign(value: unknown): VertAlign | null;
/**
 * Text alignment that approximates where a Pine `label.style_label_*`
 * sits relative to its anchor (`label_down` hangs below the point, so
 * its text is top-aligned to it, and so on).
 */
export declare function labelStyleAlign(style: unknown): {
    horz: HorzAlign | null;
    vert: VertAlign | null;
};
export declare function labelText(value: string, style: unknown): string;
/** Epoch ms → the widget's UNIX seconds. */
export declare function msToSec(ms: number): number;
export declare function defined(overrides: Record<string, unknown>): Record<string, unknown>;
/** `__id` of a drawing handle passed as an arg, or null. */
export declare function handleId(value: unknown): number | null;
//# sourceMappingURL=args.d.ts.map