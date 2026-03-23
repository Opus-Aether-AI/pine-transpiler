/**
 * Map Function Mappings
 *
 * Maps Pine Script map.* functions to JavaScript equivalents.
 * Ported from Pine-A-Script (MIT licensed).
 */

export const MAP_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'map.new': {
    stdName: '_mapNew',
    description: 'Create new map',
  },
  'map.size': {
    stdName: '_mapSize',
    description: 'Get map size',
  },
  'map.get': {
    stdName: '_mapGet',
    description: 'Get value by key',
  },
  'map.put': {
    stdName: '_mapPut',
    description: 'Set key-value pair',
  },
  'map.set': {
    stdName: '_mapPut',
    description: 'Set key-value pair (alias)',
  },
  'map.remove': {
    stdName: '_mapRemove',
    description: 'Remove key-value pair',
  },
  'map.keys': {
    stdName: '_mapKeys',
    description: 'Get all keys',
  },
  'map.values': {
    stdName: '_mapValues',
    description: 'Get all values',
  },
  'map.contains': {
    stdName: '_mapContains',
    description: 'Check if key exists',
  },
  'map.clear': {
    stdName: '_mapClear',
    description: 'Remove all entries',
  },
  'map.copy': {
    stdName: '_mapCopy',
    description: 'Copy map',
  },
};

export const MAP_HELPER_FUNCTIONS = `
const _mapNew = () => new Map();
const _mapSize = (m) => m.size;
const _mapGet = (m, k) => m.get(k) ?? null;
const _mapPut = (m, k, v) => { m.set(k, v); return m; };
const _mapRemove = (m, k) => { const v = m.get(k); m.delete(k); return v ?? null; };
const _mapKeys = (m) => [...m.keys()];
const _mapValues = (m) => [...m.values()];
const _mapContains = (m, k) => m.has(k);
const _mapClear = (m) => { m.clear(); return m; };
const _mapCopy = (m) => new Map(m);
`;
