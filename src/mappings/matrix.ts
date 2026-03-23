/**
 * Matrix Function Mappings
 *
 * Maps Pine Script matrix.* functions to JavaScript equivalents.
 * Ported from Pine-A-Script (MIT licensed).
 */

export const MATRIX_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  'matrix.new': {
    stdName: '_matrixNew',
    description: 'Create new matrix',
  },
  'matrix.rows': {
    stdName: '_matrixRows',
    description: 'Get number of rows',
  },
  'matrix.columns': {
    stdName: '_matrixCols',
    description: 'Get number of columns',
  },
  'matrix.get': {
    stdName: '_matrixGet',
    description: 'Get element at row, col',
  },
  'matrix.set': {
    stdName: '_matrixSet',
    description: 'Set element at row, col',
  },
  'matrix.fill': {
    stdName: '_matrixFill',
    description: 'Fill matrix with value',
  },
  'matrix.sum': {
    stdName: '_matrixSum',
    description: 'Sum of all elements',
  },
  'matrix.avg': {
    stdName: '_matrixAvg',
    description: 'Average of all elements',
  },
  'matrix.min': {
    stdName: '_matrixMin',
    description: 'Minimum element',
  },
  'matrix.max': {
    stdName: '_matrixMax',
    description: 'Maximum element',
  },
  'matrix.transpose': {
    stdName: '_matrixTranspose',
    description: 'Transpose matrix',
  },
  'matrix.mult': {
    stdName: '_matrixMult',
    description: 'Matrix multiplication',
  },
  'matrix.inv': {
    stdName: '_matrixInv',
    description: 'Matrix inverse (2x2 only)',
  },
  'matrix.row': {
    stdName: '_matrixRow',
    description: 'Get row as array',
  },
  'matrix.col': {
    stdName: '_matrixCol',
    description: 'Get column as array',
  },
  'matrix.add_row': {
    stdName: '_matrixAddRow',
    description: 'Add row to matrix',
  },
  'matrix.add_col': {
    stdName: '_matrixAddCol',
    description: 'Add column to matrix',
  },
  'matrix.remove_row': {
    stdName: '_matrixRemoveRow',
    description: 'Remove row from matrix',
  },
  'matrix.remove_col': {
    stdName: '_matrixRemoveCol',
    description: 'Remove column from matrix',
  },
  'matrix.det': {
    stdName: '_matrixDet',
    description: 'Matrix determinant (2x2 only)',
  },
  'matrix.copy': {
    stdName: '_matrixCopy',
    description: 'Deep copy matrix',
  },
};

export const MATRIX_HELPER_FUNCTIONS = `
const _matrixNew = (rows = 0, cols = 0, val = 0) => Array.from({length: rows}, () => Array(cols).fill(val));
const _matrixRows = (m) => m.length;
const _matrixCols = (m) => m.length > 0 ? m[0].length : 0;
const _matrixGet = (m, r, c) => m[r][c];
const _matrixSet = (m, r, c, v) => { m[r][c] = v; return m; };
const _matrixFill = (m, v) => { m.forEach(r => r.fill(v)); return m; };
const _matrixSum = (m) => m.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0);
const _matrixAvg = (m) => { const n = m.length * (m[0]?.length || 0); return n > 0 ? _matrixSum(m) / n : 0; };
const _matrixMin = (m) => Math.min(...m.flat());
const _matrixMax = (m) => Math.max(...m.flat());
const _matrixTranspose = (m) => m[0].map((_, i) => m.map(r => r[i]));
const _matrixMult = (a, b) => a.map(r => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
const _matrixInv = (m) => {
  if (m.length === 2 && m[0].length === 2) {
    const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (det === 0) return null;
    return [[m[1][1] / det, -m[0][1] / det], [-m[1][0] / det, m[0][0] / det]];
  }
  return null;
};
const _matrixRow = (m, r) => [...m[r]];
const _matrixCol = (m, c) => m.map(r => r[c]);
const _matrixAddRow = (m, r, vals) => { m.splice(r, 0, vals || Array(m[0]?.length || 0).fill(0)); return m; };
const _matrixAddCol = (m, c, vals) => { m.forEach((r, i) => r.splice(c, 0, vals ? vals[i] : 0)); return m; };
const _matrixRemoveRow = (m, r) => m.splice(r, 1)[0];
const _matrixRemoveCol = (m, c) => m.map(r => r.splice(c, 1)[0]);
const _matrixDet = (m) => m.length === 2 ? m[0][0] * m[1][1] - m[0][1] * m[1][0] : NaN;
const _matrixCopy = (m) => m.map(r => [...r]);
`;
