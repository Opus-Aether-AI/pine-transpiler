/**
 * Matrix Function Mappings (Pine v6)
 *
 * Pine `matrix.*` APIs are lowered to lightweight JS helpers so scripts
 * like `var matrix = matrix.new<string>(...)` don't depend on an
 * injected runtime namespace object.
 */

export const MATRIX_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'matrix.new': {
    stdName: '_matrixNew',
    description: 'Create a new matrix',
  },
  'matrix.rows': {
    stdName: '_matrixRows',
    description: 'Get row count',
  },
  'matrix.columns': {
    stdName: '_matrixColumns',
    description: 'Get column count',
  },
  'matrix.get': {
    stdName: '_matrixGet',
    description: 'Read a matrix cell',
  },
  'matrix.set': {
    stdName: '_matrixSet',
    description: 'Write a matrix cell',
  },
  'matrix.add_row': {
    stdName: '_matrixAddRow',
    description: 'Insert a row',
  },
  'matrix.remove_row': {
    stdName: '_matrixRemoveRow',
    description: 'Remove a row',
  },
};

export const MATRIX_HELPER_FUNCTIONS = `
// Matrix helpers (Pine v6 matrix.*)
const _matrixSafeInt = (v, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};
const _matrixNew = (rows = 0, columns = 0, fill = NaN) => {
  const r = _matrixSafeInt(rows, 0);
  const c = _matrixSafeInt(columns, 0);
  const data = Array.from({ length: r }, () => Array(c).fill(fill));
  return { _rows: data, _columns: c, _fill: fill };
};
const _matrixRows = (m) => (Array.isArray(m?._rows) ? m._rows.length : 0);
const _matrixColumns = (m) =>
  typeof m?._columns === 'number' ? m._columns : 0;
const _matrixNormalizeRow = (m, row) => {
  const values = Array.isArray(row) ? [...row] : [row];
  const width = _matrixColumns(m);
  if (width === 0) return values;
  if (values.length > width) return values.slice(0, width);
  if (values.length < width) {
    return values.concat(Array(width - values.length).fill(m?._fill ?? NaN));
  }
  return values;
};
const _matrixAddRow = (m, index, row) => {
  if (!Array.isArray(m?._rows)) return m;
  const at = _matrixSafeInt(index, m._rows.length);
  const safeIndex = Math.min(at, m._rows.length);
  m._rows.splice(safeIndex, 0, _matrixNormalizeRow(m, row));
  return m;
};
const _matrixRemoveRow = (m, index) => {
  if (!Array.isArray(m?._rows) || m._rows.length === 0) return [];
  const at = _matrixSafeInt(index, m._rows.length - 1);
  const safeIndex = Math.min(at, m._rows.length - 1);
  const removed = m._rows.splice(safeIndex, 1);
  return removed[0] ?? [];
};
const _matrixGet = (m, row, column) => {
  if (!Array.isArray(m?._rows)) return NaN;
  const r = _matrixSafeInt(row, 0);
  const c = _matrixSafeInt(column, 0);
  return m._rows[r]?.[c];
};
const _matrixSet = (m, row, column, value) => {
  if (!Array.isArray(m?._rows)) return m;
  const r = _matrixSafeInt(row, 0);
  const c = _matrixSafeInt(column, 0);
  if (!Array.isArray(m._rows[r])) {
    m._rows[r] = Array(_matrixColumns(m)).fill(m?._fill ?? NaN);
  }
  m._rows[r][c] = value;
  return m;
};
`;
