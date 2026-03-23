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
  'str.tonumber': {
    stdName: '_strToNumber',
    description: 'Convert string to number',
  },
  'str.concat': {
    stdName: '_strConcat',
    description: 'Concatenate strings',
  },
  'str.len': {
    stdName: '_strLength',
    description: 'String length (alias)',
  },
  'str.match': {
    stdName: '_strMatch',
    description: 'Match regex pattern',
  },
  'str.pos': {
    stdName: '_strPos',
    description: 'Find position of substring',
  },
  'str.rpos': {
    stdName: '_strRPos',
    description: 'Find last position of substring',
  },
  'str.remove': {
    stdName: '_strRemove',
    description: 'Remove substring at position',
  },
  'str.reverse': {
    stdName: '_strReverse',
    description: 'Reverse string',
  },
};

/**
 * String helper function implementations
 */
export const STRING_HELPER_FUNCTIONS = `
// String helpers
const _strLength = (s) => s.length;
const _strContains = (s, sub) => s.includes(sub);
const _strStartsWith = (s, prefix) => s.startsWith(prefix);
const _strEndsWith = (s, suffix) => s.endsWith(suffix);
const _strSubstring = (s, start, end) => s.substring(start, end);
const _strReplace = (s, old, rep) => s.replace(old, rep);
const _strReplaceAll = (s, old, rep) => s.replaceAll(old, rep);
const _strLower = (s) => s.toLowerCase();
const _strUpper = (s) => s.toUpperCase();
const _strSplit = (s, sep) => s.split(sep);
const _strFormat = (fmt, ...args) => fmt.replace(/{(\\d+)}/g, (m, i) => args[i] ?? m);
const _strToNumber = (s) => Number(s);
const _strConcat = (...args) => args.join('');
const _strMatch = (s, pattern) => { const m = s.match(new RegExp(pattern)); return m ? m[0] : ''; };
const _strPos = (s, sub) => s.indexOf(sub);
const _strRPos = (s, sub) => s.lastIndexOf(sub);
const _strRemove = (s, pos, len = 1) => s.slice(0, pos) + s.slice(pos + len);
const _strReverse = (s) => [...s].reverse().join('');
`;
