/**
 * Drawing Function Mappings
 *
 * Maps Pine Script line.*, label.*, box.*, and polyline.* functions
 * to JavaScript equivalents (stubs for charting library integration).
 * Ported from Pine-A-Script (MIT licensed).
 */

export const DRAWING_FUNCTION_MAPPINGS: Record<
  string,
  { stdName: string; description: string }
> = {
  // Line functions
  'line.new': {
    stdName: '_lineNew',
    description: 'Create new line',
  },
  'line.delete': {
    stdName: '_lineDelete',
    description: 'Delete line',
  },
  'line.set_xy1': {
    stdName: '_lineSetXY1',
    description: 'Set line start point',
  },
  'line.set_xy2': {
    stdName: '_lineSetXY2',
    description: 'Set line end point',
  },
  'line.get_x1': {
    stdName: '_lineGetX1',
    description: 'Get line start X',
  },
  'line.get_y1': {
    stdName: '_lineGetY1',
    description: 'Get line start Y',
  },
  'line.get_x2': {
    stdName: '_lineGetX2',
    description: 'Get line end X',
  },
  'line.get_y2': {
    stdName: '_lineGetY2',
    description: 'Get line end Y',
  },
  'line.set_color': {
    stdName: '_lineSetColor',
    description: 'Set line color',
  },
  'line.set_width': {
    stdName: '_lineSetWidth',
    description: 'Set line width',
  },
  'line.set_style': {
    stdName: '_lineSetStyle',
    description: 'Set line style',
  },

  // Label functions
  'label.new': {
    stdName: '_labelNew',
    description: 'Create new label',
  },
  'label.delete': {
    stdName: '_labelDelete',
    description: 'Delete label',
  },
  'label.set_text': {
    stdName: '_labelSetText',
    description: 'Set label text',
  },
  'label.get_text': {
    stdName: '_labelGetText',
    description: 'Get label text',
  },
  'label.set_xy': {
    stdName: '_labelSetXY',
    description: 'Set label position',
  },
  'label.set_color': {
    stdName: '_labelSetColor',
    description: 'Set label color',
  },
  'label.set_textcolor': {
    stdName: '_labelSetTextColor',
    description: 'Set label text color',
  },
  'label.set_style': {
    stdName: '_labelSetStyle',
    description: 'Set label style',
  },
  'label.set_size': {
    stdName: '_labelSetSize',
    description: 'Set label size',
  },

  // Box functions
  'box.new': {
    stdName: '_boxNew',
    description: 'Create new box',
  },
  'box.delete': {
    stdName: '_boxDelete',
    description: 'Delete box',
  },
  'box.set_lefttop': {
    stdName: '_boxSetLeftTop',
    description: 'Set box left-top corner',
  },
  'box.set_rightbottom': {
    stdName: '_boxSetRightBottom',
    description: 'Set box right-bottom corner',
  },
  'box.set_bgcolor': {
    stdName: '_boxSetBgColor',
    description: 'Set box background color',
  },
  'box.set_border_color': {
    stdName: '_boxSetBorderColor',
    description: 'Set box border color',
  },

  // Polyline functions
  'polyline.new': {
    stdName: '_polylineNew',
    description: 'Create new polyline',
  },
  'polyline.delete': {
    stdName: '_polylineDelete',
    description: 'Delete polyline',
  },

  // Chart point functions
  'chart.point.from_index': {
    stdName: '_chartPointFromIndex',
    description: 'Create chart point from bar index',
  },
  'chart.point.new': {
    stdName: '_chartPointNew',
    description: 'Create chart point',
  },
};

export const DRAWING_HELPER_FUNCTIONS = `
const _drawingId = (() => { let id = 0; return () => ++id; })();
const _lineNew = (x1, y1, x2, y2, opts) => ({id: _drawingId(), type: 'line', x1, y1, x2, y2, ...opts});
const _lineDelete = (l) => { if (l) l._deleted = true; };
const _lineSetXY1 = (l, x, y) => { if (l) { l.x1 = x; l.y1 = y; } };
const _lineSetXY2 = (l, x, y) => { if (l) { l.x2 = x; l.y2 = y; } };
const _lineGetX1 = (l) => l?.x1 ?? NaN;
const _lineGetY1 = (l) => l?.y1 ?? NaN;
const _lineGetX2 = (l) => l?.x2 ?? NaN;
const _lineGetY2 = (l) => l?.y2 ?? NaN;
const _lineSetColor = (l, c) => { if (l) l.color = c; };
const _lineSetWidth = (l, w) => { if (l) l.width = w; };
const _lineSetStyle = (l, s) => { if (l) l.style = s; };
const _labelNew = (x, y, text, opts) => ({id: _drawingId(), type: 'label', x, y, text, ...opts});
const _labelDelete = (l) => { if (l) l._deleted = true; };
const _labelSetText = (l, t) => { if (l) l.text = t; };
const _labelGetText = (l) => l?.text ?? '';
const _labelSetXY = (l, x, y) => { if (l) { l.x = x; l.y = y; } };
const _labelSetColor = (l, c) => { if (l) l.color = c; };
const _labelSetTextColor = (l, c) => { if (l) l.textcolor = c; };
const _labelSetStyle = (l, s) => { if (l) l.style = s; };
const _labelSetSize = (l, s) => { if (l) l.size = s; };
const _boxNew = (x1, y1, x2, y2, opts) => ({id: _drawingId(), type: 'box', x1, y1, x2, y2, ...opts});
const _boxDelete = (b) => { if (b) b._deleted = true; };
const _boxSetLeftTop = (b, x, y) => { if (b) { b.x1 = x; b.y1 = y; } };
const _boxSetRightBottom = (b, x, y) => { if (b) { b.x2 = x; b.y2 = y; } };
const _boxSetBgColor = (b, c) => { if (b) b.bgcolor = c; };
const _boxSetBorderColor = (b, c) => { if (b) b.bordercolor = c; };
const _polylineNew = (points, opts) => ({id: _drawingId(), type: 'polyline', points: points || [], ...opts});
const _polylineDelete = (p) => { if (p) p._deleted = true; };
const _chartPointFromIndex = (idx, price) => ({index: idx, price, time: NaN});
const _chartPointNew = (time, idx, price) => ({time, index: idx, price});
`;
