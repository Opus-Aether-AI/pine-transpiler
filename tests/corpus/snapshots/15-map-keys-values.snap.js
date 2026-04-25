const _series_high = context.new_var(high);
const _getHistorical_high = (offset) => _series_high.get(offset);
const _series_low = context.new_var(low);
const _getHistorical_low = (offset) => _series_low.get(offset);
const _series_close = context.new_var(close);
const _getHistorical_close = (offset) => _series_close.get(offset);

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

indicator("Map Keys Values");
var m = _mapNew();
_mapPut(m, "high", high);
_mapPut(m, "low", low);
_mapPut(m, "close", close);
Std.plot(_mapSize(m), "Size");