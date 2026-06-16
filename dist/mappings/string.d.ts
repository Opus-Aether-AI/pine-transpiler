/**
 * String Function Mappings
 *
 * Maps Pine Script string functions to JavaScript equivalents.
 */
/**
 * String manipulation functions
 */
export declare const STRING_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * String helper function implementations
 *
 * Pine string operations need to be defensive: at runtime the input
 * may be undefined / NaN / a non-string when a transpiler stub or
 * upstream Std fallback returns a non-string sentinel. Coerce to
 * string before each operation so a missing input doesn't crash the
 * whole indicator (it'll just produce empty / default output for
 * that call).
 */
export declare const STRING_HELPER_FUNCTIONS = "\n// String helpers\nconst _strCoerce = (s) => (s == null ? '' : String(s));\nconst _strLength = (s) => _strCoerce(s).length;\nconst _strContains = (s, sub) => _strCoerce(s).includes(_strCoerce(sub));\nconst _strStartsWith = (s, prefix) => _strCoerce(s).startsWith(_strCoerce(prefix));\nconst _strEndsWith = (s, suffix) => _strCoerce(s).endsWith(_strCoerce(suffix));\nconst _strSubstring = (s, start, end) => _strCoerce(s).substring(start, end);\nconst _strReplace = (s, old, rep) => _strCoerce(s).replace(_strCoerce(old), _strCoerce(rep));\nconst _strReplaceAll = (s, old, rep) => _strCoerce(s).replaceAll(_strCoerce(old), _strCoerce(rep));\nconst _strLower = (s) => _strCoerce(s).toLowerCase();\nconst _strUpper = (s) => _strCoerce(s).toUpperCase();\nconst _strSplit = (s, sep) => _strCoerce(s).split(_strCoerce(sep));\nconst _strFormat = (fmt, ...args) => _strCoerce(fmt).replace(/{(\\d+)}/g, (m, i) => args[i] ?? m);\n";
//# sourceMappingURL=string.d.ts.map