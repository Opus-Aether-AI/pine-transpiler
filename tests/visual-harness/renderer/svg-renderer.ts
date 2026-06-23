import type { HarnessBarFrame, VisualHarnessRenderInput } from '../types';

interface BoxState {
  left: number;
  right: number;
  top: number;
  bottom: number;
  bgcolor?: string;
  borderColor?: string;
  borderWidth?: number;
  xloc?: string;
  deleted: boolean;
}

interface LineState {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  xloc?: string;
  deleted: boolean;
}

interface LabelState {
  x: number;
  y: number;
  text: string;
  textColor?: string;
  style?: string;
  xloc?: string;
  deleted: boolean;
}

interface TableState {
  position: string;
  columns: number;
  rows: number;
  cells: Map<string, string>;
  deleted: boolean;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeCall(call: string): string {
  return call.startsWith('Std.') ? call.slice('Std.'.length) : call;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function toColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  const lowered = v.toLowerCase();
  if (
    lowered === 'nan' ||
    lowered === 'na' ||
    lowered === 'undefined' ||
    lowered === 'null'
  ) {
    return undefined;
  }
  return v;
}

function chooseColor(...candidates: Array<unknown>): string | undefined {
  for (const candidate of candidates) {
    const color = toColor(candidate);
    if (color) return color;
  }
  return undefined;
}

function locateBarIndexByTime(frames: HarnessBarFrame[], timeMs: number): number {
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < frames.length; i++) {
    const delta = Math.abs(frames[i]?.time - timeMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function coordinateToBarIndex(
  frames: HarnessBarFrame[],
  coordinate: number,
): number {
  if (!Number.isFinite(coordinate)) return 0;
  if (coordinate > 1_000_000_000_000) {
    return locateBarIndexByTime(frames, coordinate);
  }
  const rounded = Math.round(coordinate);
  if (rounded < 0) return 0;
  if (rounded >= frames.length) return frames.length - 1;
  return rounded;
}

interface ProcessedVisualData {
  bgByBar: Map<number, string>;
  barColorByBar: Map<number, string>;
  plotByBar: Map<number, number>;
  plotshapeBars: Array<{ bar: number; value: number }>;
  plotcharBars: Array<{ bar: number; value: number; glyph: string }>;
  plotarrowBars: Array<{ bar: number; value: number }>;
  hlines: Set<number>;
  fillByBar: Map<number, string>;
  boxes: BoxState[];
  lines: LineState[];
  labels: LabelState[];
  tables: TableState[];
  callRows: string[];
  callsPerBar: Map<number, Set<string>>;
}

function processVisualState(frames: HarnessBarFrame[]): ProcessedVisualData {
  const boxes = new Map<number, BoxState>();
  const lines = new Map<number, LineState>();
  const labels = new Map<number, LabelState>();
  const tables = new Map<number, TableState>();

  const bgByBar = new Map<number, string>();
  const barColorByBar = new Map<number, string>();
  const fillByBar = new Map<number, string>();
  const plotByBar = new Map<number, number>();
  const plotshapeBars: Array<{ bar: number; value: number }> = [];
  const plotcharBars: Array<{ bar: number; value: number; glyph: string }> = [];
  const plotarrowBars: Array<{ bar: number; value: number }> = [];
  const hlines = new Set<number>();
  const callsPerBar = new Map<number, Set<string>>();
  const callSet = new Set<string>();

  for (const frame of frames) {
    for (const event of frame.events) {
      const call = normalizeCall(event.call);
      callSet.add(call);
      const row = callsPerBar.get(frame.barIndex) ?? new Set<string>();
      row.add(call);
      callsPerBar.set(frame.barIndex, row);

      if (call === 'plot') {
        const value = toNumber(event.args[0]);
        if (Number.isFinite(value)) {
          plotByBar.set(frame.barIndex, value);
        }
        continue;
      }
      if (call === 'plotshape') {
        const value = toNumber(event.args[0]);
        if (Number.isFinite(value) && value !== 0) {
          plotshapeBars.push({ bar: frame.barIndex, value });
        }
        continue;
      }
      if (call === 'plotchar') {
        const value = toNumber(event.args[0]);
        if (Number.isFinite(value) && value !== 0) {
          const glyphCandidate =
            typeof event.args[1] === 'string'
              ? event.args[1]
              : typeof event.args[2] === 'string'
                ? event.args[2]
                : '•';
          const glyph = glyphCandidate.trim() || '•';
          plotcharBars.push({ bar: frame.barIndex, value, glyph });
        }
        continue;
      }
      if (call === 'plotarrow') {
        const value = toNumber(event.args[0]);
        if (Number.isFinite(value) && value !== 0) {
          plotarrowBars.push({ bar: frame.barIndex, value });
        }
        continue;
      }
      if (call === 'hline') {
        const value = toNumber(event.args[0]);
        if (Number.isFinite(value)) {
          hlines.add(value);
        }
        continue;
      }
      if (call === 'bgcolor') {
        const color =
          chooseColor(
            event.args[0],
            event.style?.colors?.[0],
          ) ?? undefined;
        if (color) {
          bgByBar.set(frame.barIndex, color);
        }
        continue;
      }
      if (call === 'barcolor') {
        const color =
          chooseColor(
            event.args[0],
            event.style?.colors?.[0],
          ) ?? undefined;
        if (color) {
          barColorByBar.set(frame.barIndex, color);
        }
        continue;
      }
      if (call === 'fill') {
        const color =
          chooseColor(
            event.args[2],
            event.args[0],
            event.style?.colors?.[0],
          ) ?? undefined;
        if (color) {
          fillByBar.set(frame.barIndex, color);
        }
        continue;
      }

      if (event.pineHandleId === undefined || !Number.isFinite(event.pineHandleId)) {
        continue;
      }
      const handleId = event.pineHandleId;

      if (call === 'box.new') {
        boxes.set(handleId, {
          left: toNumber(event.args[0]),
          top: toNumber(event.args[1]),
          right: toNumber(event.args[2]),
          bottom: toNumber(event.args[3]),
          borderColor: chooseColor(event.args[4], event.style?.colors?.[0]),
          borderWidth: toNumber(event.args[5]),
          xloc: typeof event.args[8] === 'string' ? event.args[8] : undefined,
          bgcolor: chooseColor(event.args[9], event.style?.colors?.[0]),
          deleted: false,
        });
        continue;
      }
      if (call === 'box.set_left') {
        const box = boxes.get(handleId);
        if (box) box.left = toNumber(event.args[0]);
        continue;
      }
      if (call === 'box.set_right') {
        const box = boxes.get(handleId);
        if (box) box.right = toNumber(event.args[0]);
        continue;
      }
      if (call === 'box.set_top') {
        const box = boxes.get(handleId);
        if (box) box.top = toNumber(event.args[0]);
        continue;
      }
      if (call === 'box.set_bottom') {
        const box = boxes.get(handleId);
        if (box) box.bottom = toNumber(event.args[0]);
        continue;
      }
      if (call === 'box.set_bgcolor') {
        const box = boxes.get(handleId);
        if (box) {
          box.bgcolor = chooseColor(event.args[0], event.style?.colors?.[0]);
        }
        continue;
      }
      if (call === 'box.set_border_color') {
        const box = boxes.get(handleId);
        if (box) {
          box.borderColor = chooseColor(event.args[0], event.style?.colors?.[0]);
        }
        continue;
      }
      if (call === 'box.set_border_width') {
        const box = boxes.get(handleId);
        if (box) box.borderWidth = toNumber(event.args[0]);
        continue;
      }
      if (call === 'box.delete') {
        const box = boxes.get(handleId);
        if (box) box.deleted = true;
        continue;
      }

      if (call === 'line.new') {
        lines.set(handleId, {
          x1: toNumber(event.args[0]),
          y1: toNumber(event.args[1]),
          x2: toNumber(event.args[2]),
          y2: toNumber(event.args[3]),
          xloc: typeof event.args[4] === 'string' ? event.args[4] : undefined,
          color: chooseColor(event.args[6], event.style?.colors?.[0]),
          width: toNumber(event.args[8]),
          deleted: false,
        });
        continue;
      }
      if (call === 'line.set_x2') {
        const line = lines.get(handleId);
        if (line) line.x2 = toNumber(event.args[0]);
        continue;
      }
      if (call === 'line.set_xy1') {
        const line = lines.get(handleId);
        if (line) {
          line.x1 = toNumber(event.args[0]);
          line.y1 = toNumber(event.args[1]);
        }
        continue;
      }
      if (call === 'line.set_xy2') {
        const line = lines.get(handleId);
        if (line) {
          line.x2 = toNumber(event.args[0]);
          line.y2 = toNumber(event.args[1]);
        }
        continue;
      }
      if (call === 'line.set_color') {
        const line = lines.get(handleId);
        if (line) line.color = chooseColor(event.args[0], event.style?.colors?.[0]);
        continue;
      }
      if (call === 'line.delete') {
        const line = lines.get(handleId);
        if (line) line.deleted = true;
        continue;
      }

      if (call === 'label.new') {
        labels.set(handleId, {
          x: toNumber(event.args[0]),
          y: toNumber(event.args[1]),
          text: typeof event.args[2] === 'string' ? event.args[2] : '',
          xloc: typeof event.args[3] === 'string' ? event.args[3] : undefined,
          style: typeof event.args[6] === 'string' ? event.args[6] : undefined,
          textColor: chooseColor(event.args[7], event.style?.colors?.[0]),
          deleted: false,
        });
        continue;
      }
      if (call === 'label.set_text') {
        const label = labels.get(handleId);
        if (label) {
          label.text = typeof event.args[0] === 'string' ? event.args[0] : '';
        }
        continue;
      }
      if (call === 'label.set_textcolor') {
        const label = labels.get(handleId);
        if (label) {
          label.textColor = chooseColor(event.args[0], event.style?.colors?.[0]);
        }
        continue;
      }
      if (call === 'label.set_style') {
        const label = labels.get(handleId);
        if (label && typeof event.args[0] === 'string') {
          label.style = event.args[0];
        }
        continue;
      }
      if (call === 'label.set_xy') {
        const label = labels.get(handleId);
        if (label) {
          label.x = toNumber(event.args[0]);
          label.y = toNumber(event.args[1]);
        }
        continue;
      }
      if (call === 'label.set_x') {
        const label = labels.get(handleId);
        if (label) label.x = toNumber(event.args[0]);
        continue;
      }
      if (call === 'label.set_y') {
        const label = labels.get(handleId);
        if (label) label.y = toNumber(event.args[0]);
        continue;
      }
      if (call === 'label.delete') {
        const label = labels.get(handleId);
        if (label) label.deleted = true;
        continue;
      }

      if (call === 'table.new') {
        tables.set(handleId, {
          position: typeof event.args[0] === 'string' ? event.args[0] : 'top_right',
          columns: Number.isFinite(toNumber(event.args[1]))
            ? Math.max(1, Math.round(toNumber(event.args[1])))
            : 1,
          rows: Number.isFinite(toNumber(event.args[2]))
            ? Math.max(1, Math.round(toNumber(event.args[2])))
            : 1,
          cells: new Map(),
          deleted: false,
        });
        continue;
      }
      if (call === 'table.cell') {
        const table = tables.get(handleId);
        if (table) {
          const col = Math.max(0, Math.round(toNumber(event.args[1])));
          const rowIndex = Math.max(0, Math.round(toNumber(event.args[2])));
          const key = `${col},${rowIndex}`;
          const text = typeof event.args[3] === 'string' ? event.args[3] : '';
          table.cells.set(key, text);
        }
        continue;
      }
      if (call === 'table.clear') {
        const table = tables.get(handleId);
        if (table) table.cells.clear();
        continue;
      }
      if (call === 'table.delete') {
        const table = tables.get(handleId);
        if (table) table.deleted = true;
      }
    }
  }

  return {
    bgByBar,
    barColorByBar,
    plotByBar,
    plotshapeBars,
    plotcharBars,
    plotarrowBars,
    hlines,
    fillByBar,
    boxes: [...boxes.values()],
    lines: [...lines.values()],
    labels: [...labels.values()],
    tables: [...tables.values()],
    callRows: [...callSet].sort((a, b) => a.localeCompare(b)),
    callsPerBar,
  };
}

export function renderVisualHarnessSvg(input: VisualHarnessRenderInput): string {
  const { fixtureId, frames } = input;
  const width = 1440;
  const height = 840;
  const chartLeft = 72;
  const chartRight = width - 36;
  const chartTop = 50;
  const chartHeight = 500;
  const timelineTop = 600;
  const timelineHeight = 180;
  const chartBottom = chartTop + chartHeight;
  const chartWidth = chartRight - chartLeft;
  const frameCount = frames.length;
  const safeFrameCount = Math.max(1, frameCount - 1);
  const xForBar = (barIndex: number): number =>
    chartLeft + (Math.max(0, Math.min(frameCount - 1, barIndex)) / safeFrameCount) * chartWidth;

  const visual = processVisualState(frames);
  const yValues: number[] = [];
  for (const frame of frames) {
    if (Number.isFinite(frame.low)) yValues.push(frame.low);
    if (Number.isFinite(frame.high)) yValues.push(frame.high);
    const plot = visual.plotByBar.get(frame.barIndex);
    if (typeof plot === 'number' && Number.isFinite(plot)) yValues.push(plot);
  }
  for (const value of visual.hlines) yValues.push(value);
  for (const box of visual.boxes) {
    if (Number.isFinite(box.top)) yValues.push(box.top);
    if (Number.isFinite(box.bottom)) yValues.push(box.bottom);
  }
  for (const line of visual.lines) {
    if (Number.isFinite(line.y1)) yValues.push(line.y1);
    if (Number.isFinite(line.y2)) yValues.push(line.y2);
  }
  for (const label of visual.labels) {
    if (Number.isFinite(label.y)) yValues.push(label.y);
  }
  const minY = yValues.length > 0 ? Math.min(...yValues) : 0;
  const maxY = yValues.length > 0 ? Math.max(...yValues) : 1;
  const span = maxY - minY;
  const yPad = span > 0 ? span * 0.08 : 1;
  const domainMin = minY - yPad;
  const domainMax = maxY + yPad;
  const domainSpan = Math.max(1e-9, domainMax - domainMin);
  const yForValue = (value: number): number =>
    chartBottom - ((value - domainMin) / domainSpan) * chartHeight;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  );
  lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc"/>`);
  lines.push(`<rect x="${chartLeft}" y="${chartTop}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#d1d5db"/>`);

  for (let i = 0; i <= 6; i++) {
    const y = chartTop + (i / 6) * chartHeight;
    const value = domainMax - (i / 6) * domainSpan;
    lines.push(
      `<line x1="${chartLeft}" y1="${y.toFixed(2)}" x2="${chartRight}" y2="${y.toFixed(2)}" stroke="#e5e7eb" stroke-width="1"/>`,
    );
    lines.push(
      `<text x="${chartLeft - 8}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-size="11" fill="#64748b">${value.toFixed(2)}</text>`,
    );
  }

  const barWidth = frameCount > 0 ? Math.max(1, chartWidth / frameCount) : 1;
  for (const frame of frames) {
    const x = xForBar(frame.barIndex) - barWidth * 0.5;
    const bg = visual.bgByBar.get(frame.barIndex);
    if (bg) {
      lines.push(
        `<rect x="${x.toFixed(2)}" y="${chartTop}" width="${barWidth.toFixed(2)}" height="${chartHeight}" fill="${escapeXml(bg)}" opacity="0.16"/>`,
      );
    }
    const barColor = visual.barColorByBar.get(frame.barIndex);
    if (barColor) {
      lines.push(
        `<rect x="${x.toFixed(2)}" y="${chartTop}" width="${barWidth.toFixed(2)}" height="${chartHeight}" fill="${escapeXml(barColor)}" opacity="0.08"/>`,
      );
    }
    const fill = visual.fillByBar.get(frame.barIndex);
    if (fill) {
      lines.push(
        `<rect x="${x.toFixed(2)}" y="${chartBottom - 18}" width="${barWidth.toFixed(2)}" height="18" fill="${escapeXml(fill)}" opacity="0.35"/>`,
      );
    }
  }

  const closePath: string[] = [];
  for (const frame of frames) {
    const x = xForBar(frame.barIndex);
    const y = yForValue(frame.close);
    closePath.push(`${frame.barIndex === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  if (closePath.length > 1) {
    lines.push(
      `<path d="${closePath.join(' ')}" fill="none" stroke="#0f172a" stroke-width="1.3" opacity="0.9"/>`,
    );
  }

  const plotPath: string[] = [];
  for (const frame of frames) {
    const value = visual.plotByBar.get(frame.barIndex);
    if (!Number.isFinite(value)) continue;
    const x = xForBar(frame.barIndex);
    const y = yForValue(value as number);
    plotPath.push(`${plotPath.length === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  if (plotPath.length > 1) {
    lines.push(
      `<path d="${plotPath.join(' ')}" fill="none" stroke="#f97316" stroke-width="1.6" opacity="0.95"/>`,
    );
  }

  for (const value of visual.hlines) {
    const y = yForValue(value);
    lines.push(
      `<line x1="${chartLeft}" y1="${y.toFixed(2)}" x2="${chartRight}" y2="${y.toFixed(2)}" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`,
    );
  }

  for (const box of visual.boxes) {
    if (box.deleted) continue;
    const leftBar = coordinateToBarIndex(frames, box.left);
    const rightBar = coordinateToBarIndex(frames, box.right);
    const x1 = xForBar(Math.min(leftBar, rightBar));
    const x2 = xForBar(Math.max(leftBar, rightBar));
    const y1 = yForValue(box.top);
    const y2 = yForValue(box.bottom);
    const rectX = Math.min(x1, x2);
    const rectY = Math.min(y1, y2);
    const rectW = Math.max(1, Math.abs(x2 - x1));
    const rectH = Math.max(1, Math.abs(y2 - y1));
    const fill = box.bgcolor ?? '#93c5fd';
    const stroke = box.borderColor ?? '#1d4ed8';
    const strokeWidth = Number.isFinite(box.borderWidth ?? Number.NaN)
      ? Math.max(1, Number(box.borderWidth))
      : 1;
    lines.push(
      `<rect x="${rectX.toFixed(2)}" y="${rectY.toFixed(2)}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(2)}" fill="${escapeXml(fill)}" opacity="0.18" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth.toFixed(2)}"/>`,
    );
  }

  for (const line of visual.lines) {
    if (line.deleted) continue;
    const x1 = xForBar(coordinateToBarIndex(frames, line.x1));
    const y1 = yForValue(line.y1);
    const x2 = xForBar(coordinateToBarIndex(frames, line.x2));
    const y2 = yForValue(line.y2);
    const stroke = line.color ?? '#4f46e5';
    const strokeWidth = Number.isFinite(line.width ?? Number.NaN)
      ? Math.max(1, Number(line.width))
      : 1.2;
    lines.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth.toFixed(2)}" opacity="0.95"/>`,
    );
  }

  for (const label of visual.labels) {
    if (label.deleted) continue;
    const x = xForBar(coordinateToBarIndex(frames, label.x));
    const y = yForValue(label.y);
    const color = label.textColor ?? '#0f172a';
    const text = escapeXml(label.text || 'label');
    lines.push(
      `<text x="${x.toFixed(2)}" y="${(y - 4).toFixed(2)}" font-size="11" fill="${escapeXml(color)}">${text}</text>`,
    );
  }

  for (const marker of visual.plotshapeBars) {
    const x = xForBar(marker.bar);
    const y = yForValue(marker.value);
    lines.push(
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.8" fill="#7c3aed" opacity="0.9"/>`,
    );
  }

  for (const marker of visual.plotcharBars) {
    const x = xForBar(marker.bar);
    const y = yForValue(marker.value);
    lines.push(
      `<text x="${x.toFixed(2)}" y="${(y - 6).toFixed(2)}" font-size="10" text-anchor="middle" fill="#065f46">${escapeXml(marker.glyph.slice(0, 1))}</text>`,
    );
  }

  for (const marker of visual.plotarrowBars) {
    const x = xForBar(marker.bar);
    const y = yForValue(marker.value);
    const dy = marker.value > 0 ? -10 : 10;
    lines.push(
      `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + dy).toFixed(2)}" stroke="#b45309" stroke-width="1.4"/>`,
    );
    lines.push(
      `<circle cx="${x.toFixed(2)}" cy="${(y + dy).toFixed(2)}" r="2.2" fill="#b45309"/>`,
    );
  }

  const liveTables = visual.tables.filter((table) => !table.deleted);
  liveTables.forEach((table, index) => {
    const blockWidth = 190;
    const blockHeight = 90;
    const blockX = width - blockWidth - 24;
    const blockY = 64 + index * (blockHeight + 10);
    lines.push(
      `<rect x="${blockX}" y="${blockY}" width="${blockWidth}" height="${blockHeight}" rx="6" fill="#ffffff" stroke="#cbd5e1"/>`,
    );
    lines.push(
      `<text x="${blockX + 10}" y="${blockY + 16}" font-size="11" fill="#334155">table ${index + 1} (${escapeXml(table.position)})</text>`,
    );
    let cursorY = blockY + 32;
    const cellEntries = [...table.cells.entries()].slice(0, 4);
    for (const [cellKey, value] of cellEntries) {
      lines.push(
        `<text x="${blockX + 10}" y="${cursorY}" font-size="10" fill="#475569">${escapeXml(cellKey)}: ${escapeXml(value)}</text>`,
      );
      cursorY += 14;
    }
  });

  lines.push(
    `<rect x="${chartLeft}" y="${timelineTop}" width="${chartWidth}" height="${timelineHeight}" fill="#ffffff" stroke="#d1d5db"/>`,
  );
  const rowCount = Math.max(1, Math.min(visual.callRows.length, 24));
  const rowHeight = timelineHeight / rowCount;
  const visibleRows = visual.callRows.slice(0, rowCount);
  for (let rowIndex = 0; rowIndex < visibleRows.length; rowIndex++) {
    const rowName = visibleRows[rowIndex] as string;
    const rowY = timelineTop + rowIndex * rowHeight;
    lines.push(
      `<line x1="${chartLeft}" y1="${rowY.toFixed(2)}" x2="${chartRight}" y2="${rowY.toFixed(2)}" stroke="#f1f5f9" stroke-width="1"/>`,
    );
    lines.push(
      `<text x="${chartLeft - 8}" y="${(rowY + rowHeight * 0.65).toFixed(2)}" text-anchor="end" font-size="9" fill="#64748b">${escapeXml(rowName)}</text>`,
    );
  }
  for (const frame of frames) {
    const calls = visual.callsPerBar.get(frame.barIndex);
    if (!calls) continue;
    const x = xForBar(frame.barIndex) - barWidth * 0.35;
    for (let rowIndex = 0; rowIndex < visibleRows.length; rowIndex++) {
      const rowName = visibleRows[rowIndex] as string;
      if (!calls.has(rowName)) continue;
      const y = timelineTop + rowIndex * rowHeight + rowHeight * 0.18;
      lines.push(
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(1, barWidth * 0.7).toFixed(2)}" height="${Math.max(1, rowHeight * 0.64).toFixed(2)}" fill="#2563eb" opacity="0.68"/>`,
      );
    }
  }

  lines.push(
    `<text x="${chartLeft}" y="24" font-size="16" font-family="Menlo, Monaco, Consolas, monospace" fill="#0f172a">${escapeXml(fixtureId)} visual harness</text>`,
  );
  lines.push(
    `<text x="${chartLeft}" y="${height - 20}" font-size="11" fill="#64748b">bars=${frameCount} events=${frames.reduce((acc, frame) => acc + frame.events.length, 0)} rows=${visual.callRows.length}</text>`,
  );
  lines.push('</svg>');
  return `${lines.join('\n')}\n`;
}
