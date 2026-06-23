export interface ParsedColorChannels {
    red: number;
    green: number;
    blue: number;
    alpha: number | null;
}
export declare function toHexByte(value: number): string;
export declare function roundAlpha(value: number): number;
export declare function clampTransparency(value: number): number;
export declare function alphaFromTransparency(transparency: number): number;
export declare function normalizeHexColor(value: string): string | null;
export declare function parseColorString(value: string): ParsedColorChannels | null;
export declare function formatHexColor(color: Pick<ParsedColorChannels, 'red' | 'green' | 'blue'>): string;
export declare function formatRgbaColor(color: Pick<ParsedColorChannels, 'red' | 'green' | 'blue'>, alpha: number): string;
export declare function toRenderableColor(value: string): string;
export declare function applyTransparency(color: string, transparency: number | null): string;
//# sourceMappingURL=colors.d.ts.map