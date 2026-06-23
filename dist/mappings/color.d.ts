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
export declare const COLOR_HELPER_FUNCTIONS = "\n// Color helpers\nconst __colorClampByte = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));\nconst __colorClampTransparency = (value) => {\n  const n = Number(value);\n  if (!Number.isFinite(n)) return 0;\n  return Math.max(0, Math.min(100, n));\n};\nconst __colorRoundAlpha = (value) => Number(Math.max(0, Math.min(1, value)).toFixed(4));\nconst __colorFormatRgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${__colorRoundAlpha(a)})`;\nconst __colorParse = (color) => {\n  if (typeof color !== 'string') return null;\n  const token = color.trim();\n  const hex = token.match(/^#([0-9a-fA-F]{6})$/);\n  if (hex) {\n    const digits = hex[1];\n    return {\n      r: parseInt(digits.slice(0, 2), 16),\n      g: parseInt(digits.slice(2, 4), 16),\n      b: parseInt(digits.slice(4, 6), 16),\n      a: null,\n    };\n  }\n  const rgba = token.match(/^rgba?\\(([^)]+)\\)$/i);\n  if (!rgba) return null;\n  const parts = rgba[1]\n    .split(',')\n    .map((part) => part.trim())\n    .filter((part) => part.length > 0);\n  if (parts.length !== 3 && parts.length !== 4) return null;\n  const r = Number(parts[0]);\n  const g = Number(parts[1]);\n  const b = Number(parts[2]);\n  if (![r, g, b].every(Number.isFinite)) return null;\n  const parsed = {\n    r: __colorClampByte(r),\n    g: __colorClampByte(g),\n    b: __colorClampByte(b),\n    a: null,\n  };\n  if (parts.length === 3) return parsed;\n  const alpha = Number(parts[3]);\n  if (!Number.isFinite(alpha)) return null;\n  parsed.a = __colorRoundAlpha(alpha);\n  return parsed;\n};\nconst _colorRgb = (r, g, b, t = 0) => __colorFormatRgba(\n  __colorClampByte(r),\n  __colorClampByte(g),\n  __colorClampByte(b),\n  1 - __colorClampTransparency(t) / 100,\n);\nconst _colorNew = (color, t) => {\n  const parsed = __colorParse(color);\n  if (!parsed) return color;\n  return __colorFormatRgba(\n    parsed.r,\n    parsed.g,\n    parsed.b,\n    1 - __colorClampTransparency(t) / 100,\n  );\n};\nconst _colorR = (color) => {\n  const parsed = __colorParse(color);\n  return parsed ? parsed.r : Number.NaN;\n};\nconst _colorG = (color) => {\n  const parsed = __colorParse(color);\n  return parsed ? parsed.g : Number.NaN;\n};\nconst _colorB = (color) => {\n  const parsed = __colorParse(color);\n  return parsed ? parsed.b : Number.NaN;\n};\nconst _colorT = (color) => {\n  const parsed = __colorParse(color);\n  if (!parsed) return 0;\n  return Math.round((1 - (parsed.a === null ? 1 : parsed.a)) * 100);\n};\n";
//# sourceMappingURL=color.d.ts.map