/**
 * String Function Mappings
 *
 * Maps Pine Script string functions to JavaScript equivalents.
 */

/**
 * String manipulation functions
 */
export const STRING_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'str.length': {
    stdName: '_strLength',
    description: 'String length',
  },
  'str.contains': {
    stdName: '_strContains',
    description: 'Check if string contains substring',
  },
  'str.startswith': {
    stdName: '_strStartsWith',
    description: 'Check if string starts with prefix',
  },
  'str.endswith': {
    stdName: '_strEndsWith',
    description: 'Check if string ends with suffix',
  },
  'str.substring': {
    stdName: '_strSubstring',
    description: 'Extract substring',
  },
  'str.replace': {
    stdName: '_strReplace',
    description: 'Replace first occurrence',
  },
  'str.replace_all': {
    stdName: '_strReplaceAll',
    description: 'Replace all occurrences',
  },
  'str.lower': {
    stdName: '_strLower',
    description: 'Convert to lowercase',
  },
  'str.upper': {
    stdName: '_strUpper',
    description: 'Convert to uppercase',
  },
  'str.split': {
    stdName: '_strSplit',
    description: 'Split string',
  },
  'str.format': {
    stdName: '_strFormat',
    description: 'Format string with placeholders',
  },
};

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
export const STRING_HELPER_FUNCTIONS = `
// String helpers
const _strCoerce = (s) => (s == null ? '' : String(s));
const _strLength = (s) => _strCoerce(s).length;
const _strContains = (s, sub) => _strCoerce(s).includes(_strCoerce(sub));
const _strStartsWith = (s, prefix) => _strCoerce(s).startsWith(_strCoerce(prefix));
const _strEndsWith = (s, suffix) => _strCoerce(s).endsWith(_strCoerce(suffix));
const _strSubstring = (s, start, end) => _strCoerce(s).substring(start, end);
const _strReplace = (s, old, rep) => _strCoerce(s).replace(_strCoerce(old), _strCoerce(rep));
const _strReplaceAll = (s, old, rep) => _strCoerce(s).replaceAll(_strCoerce(old), _strCoerce(rep));
const _strLower = (s) => _strCoerce(s).toLowerCase();
const _strUpper = (s) => _strCoerce(s).toUpperCase();
const _strSplit = (s, sep) => _strCoerce(s).split(_strCoerce(sep));
const _strFormat = (fmt, ...args) => _strCoerce(fmt).replace(/{(\\d+)}/g, (m, i) => args[i] ?? m);
`;
