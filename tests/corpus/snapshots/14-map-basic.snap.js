const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);
const _series_open = context.new_var(open);
const _getHistorical_open = (offset) => _series_open.get(offset);

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

indicator("Map Basic");
let counts = _mapNew();
let key = ((close > open) ? "up" : "down");
let prevCount = (_mapContains(counts, key) ? _mapGet(counts, key) : 0);
_mapPut(counts, key, (prevCount + 1));
Std.plot(_mapSize(counts), "Map Size");