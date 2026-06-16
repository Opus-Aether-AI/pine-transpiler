/**
 * Color Function Mappings
 *
 * Maps Pine Script color functions to JavaScript equivalents.
 */
/**
 * Color manipulation functions
 */
export declare const COLOR_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Color helper function implementations
 */
export declare const COLOR_HELPER_FUNCTIONS = "\n// Color helpers\nconst _colorRgb = (r, g, b, t = 0) => `rgba(${r}, ${g}, ${b}, ${1 - t/100})`;\nconst _colorNew = (color, t) => color; // Simplified\nconst _colorR = (color) => parseInt(color.slice(1, 3), 16);\nconst _colorG = (color) => parseInt(color.slice(3, 5), 16);\nconst _colorB = (color) => parseInt(color.slice(5, 7), 16);\nconst _colorT = (color) => 0;\n";
//# sourceMappingURL=color.d.ts.map