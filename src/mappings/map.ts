/**
 * Map Function Mappings (Pine v6)
 *
 * Pine v6 introduced `map<K, V>` — an insertion-ordered key-value
 * container. JS `Map` matches the contract exactly, so the polyfill is
 * thin: each Pine `map.*` function maps to a `_map<X>` helper that
 * delegates to the JS `Map` instance.
 *
 * The Pine v6 generic-type syntax (`map.new<string, float>()`) is
 * stripped by the parser, leaving the bare `map.new` callee. We register
 * `map.new` as the canonical mapping; the type parameters were
 * metadata-only so dropping them is non-destructive.
 */

export const MAP_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'map.new': {
    stdName: '_mapNew',
    description: 'Create new Map (Pine v6 generic, type stripped by parser)',
  },
  'map.put': {
    stdName: '_mapPut',
    description: 'Set key/value (returns the map)',
  },
  'map.put_all': {
    stdName: '_mapPutAll',
    description: 'Merge another map in',
  },
  'map.get': {
    stdName: '_mapGet',
    description: 'Read value by key',
  },
  'map.contains': {
    stdName: '_mapContains',
    description: 'Test for key presence',
  },
  'map.remove': {
    stdName: '_mapRemove',
    description: 'Delete by key',
  },
  'map.size': {
    stdName: '_mapSize',
    description: 'Number of entries',
  },
  'map.keys': {
    stdName: '_mapKeys',
    description: 'All keys as an array',
  },
  'map.values': {
    stdName: '_mapValues',
    description: 'All values as an array',
  },
  'map.clear': {
    stdName: '_mapClear',
    description: 'Drop all entries',
  },
  'map.copy': {
    stdName: '_mapCopy',
    description: 'Shallow copy',
  },
};

/**
 * Map helper functions injected as a string into the factory body when
 * any `_map<X>` symbol appears in the transpiled JS. Keep these as
 * pure wrappers around the native JS Map so the runtime stays
 * dependency-free.
 */
export const MAP_HELPER_FUNCTIONS = `
// Map helpers (Pine v6 map.*)
const _mapNew = () => new Map();
const _mapPut = (m, k, v) => { m.set(k, v); return m; };
const _mapPutAll = (a, b) => { for (const [k, v] of b) { a.set(k, v); } return a; };
const _mapGet = (m, k) => m.get(k);
const _mapContains = (m, k) => m.has(k);
const _mapRemove = (m, k) => { const had = m.has(k); m.delete(k); return had; };
const _mapSize = (m) => m.size;
const _mapKeys = (m) => Array.from(m.keys());
const _mapValues = (m) => Array.from(m.values());
const _mapClear = (m) => { m.clear(); return m; };
const _mapCopy = (m) => new Map(m);
`;
