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
export declare const MAP_FUNCTION_MAPPINGS: Record<string, {
    stdName: string;
    description: string;
}>;
/**
 * Map helper functions injected as a string into the factory body when
 * any `_map<X>` symbol appears in the transpiled JS. Keep these as
 * pure wrappers around the native JS Map so the runtime stays
 * dependency-free.
 */
export declare const MAP_HELPER_FUNCTIONS = "\n// Map helpers (Pine v6 map.*)\nconst _mapNew = () => new Map();\nconst _mapPut = (m, k, v) => { m.set(k, v); return m; };\nconst _mapPutAll = (a, b) => { for (const [k, v] of b) { a.set(k, v); } return a; };\nconst _mapGet = (m, k) => m.get(k);\nconst _mapContains = (m, k) => m.has(k);\nconst _mapRemove = (m, k) => { const had = m.has(k); m.delete(k); return had; };\nconst _mapSize = (m) => m.size;\nconst _mapKeys = (m) => Array.from(m.keys());\nconst _mapValues = (m) => Array.from(m.values());\nconst _mapClear = (m) => { m.clear(); return m; };\nconst _mapCopy = (m) => new Map(m);\n";
//# sourceMappingURL=map.d.ts.map