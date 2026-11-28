import {
  color,
  colorOrTransparent,
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_COLOR,
  DEFAULT_TEXT_COLOR,
  defined,
  extend,
  finite,
  fontSize,
  type HorzAlign,
  handleId,
  horzAlign,
  labelStyleAlign,
  labelText,
  lineStyle,
  SCRIPT_SHAPE_OPTIONS,
  TRANSPARENT,
  text,
  type VertAlign,
  vertAlign,
} from './args';
import { BarTimeline, type RawPoint, type Xloc } from './timeline';
import type {
  BarObservation,
  ChartApi,
  ChartEntityId,
  ChartShapePoint,
  HostDiagnostic,
  VisualEvent,
} from './types';

/** Kinds of chart shape the renderer owns. */
export type DrawingKind = 'box' | 'line' | 'label' | 'linefill' | 'bgcolor';

export interface VisualEventsRendererOptions {
  /**
   * Returns the chart an indicator instance draws on, or null while it
   * is not ready. Each instance is pinned to the first chart returned,
   * so its shapes stay put when the user switches the active chart.
   */
  getChart: (instanceId: string) => ChartApi | null;
  /**
   * Live shapes kept per kind and indicator instance; the oldest are
   * removed first, as Pine does with `max_boxes_count` and friends.
   * Defaults to 500, Pine's ceiling.
   */
  maxDrawingsPerKind?: number;
  onDiagnostic?: (diagnostic: HostDiagnostic) => void;
}

interface Entity {
  key: string;
  kind: DrawingKind;
  /** [primary shape, box text shape]. */
  ids: Array<ChartEntityId | null>;
  /** The chart holding `ids`; updates and removal always go there. */
  chart: ChartApi | null;
  created: boolean;
  removed: boolean;
  queued: boolean;
  dirtyPoints: boolean;
  dirtyProps: boolean;
  dirtyText: boolean;
  ready: Promise<void>;
  points: RawPoint[];
  /** Primary-shape overrides, kept whole so creation sees the latest. */
  style: Record<string, unknown>;
  /** Label text, or box text. */
  text: string;
  textStyle: Record<string, unknown>;
  halign: HorzAlign;
  valign: VertAlign;
  yloc?: string;
  /** label: the Pine `label.style_*` suffix, for glyph styles. */
  labelStyle?: unknown;
  /** linefill: the two line keys. */
  lines?: [string, string];
  /** bgcolor band: first and last bar index. */
  span?: [number, number];
}

interface BackgroundRun {
  entity: Entity;
  color: string;
}

interface InstanceState {
  id: string;
  /** Pinned on first use, so shapes never follow another chart. */
  chart: ChartApi | null;
  timeline: BarTimeline;
  /** Labels placed with yloc.abovebar / belowbar. */
  candleLabels: Set<Entity>;
  entities: Map<string, Entity>;
  order: Record<DrawingKind, Set<string>>;
  /** line key → keys of linefills that reference it. */
  fillsByLine: Map<string, Set<string>>;
  /** Shapes whose geometry is provisional, or that could not draw yet. */
  retry: Set<Entity>;
  background: Array<BackgroundRun | undefined>;
  backgroundBar: number;
  backgroundSeq: number;
}

const DRAWING_NAMESPACES = new Set(['box', 'line', 'label', 'linefill']);
const BACKGROUND_CALLS = new Set(['bgcolor', 'Std.bgcolor']);
const UNRENDERED_CALLS: Record<string, string> = {
  fill: 'fill() events carry no plot identity, so they are not drawn',
  'Std.fill': 'fill() events carry no plot identity, so they are not drawn',
  barcolor: 'barcolor() is not drawn by the host renderer',
  'Std.barcolor': 'barcolor() is not drawn by the host renderer',
};

function emptyOrder(): Record<DrawingKind, Set<string>> {
  return {
    box: new Set(),
    line: new Set(),
    label: new Set(),
    linefill: new Set(),
    bgcolor: new Set(),
  };
}

/** A coordinate arg; Pine `na` stays NaN until a setter fills it in. */
function coord(value: unknown): number {
  return finite(value) ?? Number.NaN;
}

function isCandleRelative(yloc: string | undefined): boolean {
  return yloc !== undefined && /above|below/.test(yloc);
}

function parseXloc(value: unknown): Xloc | null {
  if (value === 'bar_time' || value === 'xloc.bar_time') return 'bar_time';
  if (value === 'bar_index' || value === 'xloc.bar_index') return 'bar_index';
  if (value === undefined || value === null) return 'bar_index';
  if (typeof value === 'number' && Number.isNaN(value)) return 'bar_index';
  return null;
}

/** Namespace-form calls (`box.set_right(b, x)`) carry the handle first. */
function valueArgs(event: VisualEvent): unknown[] {
  const args = Array.isArray(event.args) ? event.args : [];
  return handleId(args[0]) !== null ? args.slice(1) : args;
}

/**
 * Draws the transpiler's `__visualEvents` stream onto a chart through
 * the widget's public drawing API.
 *
 * Each Pine handle maps to one tracked entity holding the latest
 * desired geometry and style. Events mutate that state synchronously;
 * chart calls happen later, one coalesced flush per entity, chained so
 * a shape is never updated before it exists. A box extended across
 * 300 historical bars therefore costs one create, not 300 updates.
 */
export class VisualEventsRenderer {
  private readonly getChart: (instanceId: string) => ChartApi | null;
  private readonly maxPerKind: number;
  private readonly onDiagnostic?: (diagnostic: HostDiagnostic) => void;
  private readonly instances = new Map<string, InstanceState>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly warned = new Set<string>();

  constructor(options: VisualEventsRendererOptions) {
    this.getChart = options.getChart;
    this.maxPerKind = Math.max(1, options.maxDrawingsPerKind ?? 500);
    this.onDiagnostic = options.onDiagnostic;
  }

  /** Feed one `main()` call's events plus what is known about its bar. */
  processBar(
    instanceId: string,
    events: ReadonlyArray<VisualEvent>,
    bar?: BarObservation,
  ): void {
    const instance = this.instance(instanceId);
    if (bar) {
      const change = instance.timeline.record(bar);
      if (change.newBar) this.retry(instance);
      if (change.candleChanged) {
        // A realtime tick moved this candle's high or low.
        for (const label of instance.candleLabels) {
          const point = label.points[0];
          if (point?.xloc === 'bar_index' && point.x === bar.barIndex) {
            this.touchPoints(label, instance);
          }
        }
      }
      if (change.extentChanged) {
        for (const key of instance.order.bgcolor) {
          this.touchPoints(instance.entities.get(key), instance);
        }
      }
    }
    const barIndex =
      bar?.barIndex ??
      events.find((e) => typeof e.barIndex === 'number')?.barIndex;
    if (typeof barIndex === 'number' && Number.isInteger(barIndex)) {
      this.background(
        instance,
        barIndex,
        events.filter((e) => BACKGROUND_CALLS.has(e.call)),
      );
    }
    for (const event of events) {
      try {
        this.dispatch(instance, event);
      } catch (error) {
        this.report('error', `failed to apply ${event.call}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /** Remove every shape drawn for one indicator instance. */
  reset(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    this.instances.delete(instanceId);
    for (const entity of instance.entities.values()) this.remove(entity);
  }

  resetAll(): void {
    for (const id of [...this.instances.keys()]) this.reset(id);
  }

  instanceIds(): string[] {
    return [...this.instances.keys()];
  }

  /** Re-issue every live shape, e.g. after the chart becomes ready. */
  refresh(): void {
    for (const instance of this.instances.values()) {
      for (const entity of instance.entities.values()) {
        entity.dirtyPoints = true;
        entity.dirtyProps = true;
        entity.dirtyText = true;
        this.queue(instance, entity);
      }
    }
  }

  /** Resolves once every queued chart call has settled. */
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }

  // ── Dispatch ────────────────────────────────────────────────────────

  private dispatch(instance: InstanceState, event: VisualEvent): void {
    const call = typeof event.call === 'string' ? event.call : '';
    if (BACKGROUND_CALLS.has(call)) return;
    const unrendered = UNRENDERED_CALLS[call];
    if (unrendered) {
      this.warnOnce(call, unrendered);
      return;
    }
    const dot = call.indexOf('.');
    const ns = dot > 0 ? call.slice(0, dot) : '';
    const method = call.slice(dot + 1);
    if (ns === 'table') {
      this.warnOnce(
        'table',
        'table.* events need a DOM overlay; the chart has no table shape',
      );
      return;
    }
    if (!DRAWING_NAMESPACES.has(ns) || method.startsWith('get_')) return;
    if (typeof event.pineHandleId !== 'number') {
      this.report('warn', `dropped ${call} without pineHandleId`);
      return;
    }
    const key = `${ns}:${event.pineHandleId}`;
    if (method === 'new') {
      this.create(instance, ns, key, event.args);
      return;
    }
    const entity = instance.entities.get(key);
    if (!entity) return;
    if (method === 'delete') {
      this.delete(instance, entity);
      return;
    }
    const args = valueArgs(event);
    switch (ns) {
      case 'box': {
        this.mutateBox(instance, entity, method, args);
        return;
      }
      case 'line': {
        this.mutateLine(instance, entity, method, args);
        return;
      }
      case 'label': {
        this.mutateLabel(instance, entity, method, args);
        return;
      }
      case 'linefill':
        if (method === 'set_color') {
          entity.style.backgroundColor = colorOrTransparent(args[0]);
          this.touchProps(instance, entity);
        }
        return;
    }
  }

  private create(
    instance: InstanceState,
    ns: string,
    key: string,
    args: unknown[],
  ): void {
    if (instance.entities.has(key)) return;
    const entity =
      ns === 'box'
        ? this.newBox(key, args)
        : ns === 'line'
          ? this.newLine(key, args)
          : ns === 'label'
            ? this.newLabel(key, args)
            : this.newLinefill(instance, key, args);
    if (!entity) {
      this.report('warn', `${ns}.new skipped: unusable xloc or lines`, {
        key,
      });
      return;
    }
    this.track(instance, entity);
  }

  private track(instance: InstanceState, entity: Entity): void {
    instance.entities.set(entity.key, entity);
    if (isCandleRelative(entity.yloc)) instance.candleLabels.add(entity);
    const order = instance.order[entity.kind];
    order.add(entity.key);
    if (entity.lines) {
      for (const line of entity.lines) {
        const fills = instance.fillsByLine.get(line) ?? new Set<string>();
        fills.add(entity.key);
        instance.fillsByLine.set(line, fills);
      }
    }
    this.queue(instance, entity);
    while (order.size > this.maxPerKind) {
      const oldest = instance.entities.get(order.values().next().value ?? '');
      if (!oldest) break;
      this.delete(instance, oldest);
    }
  }

  private delete(instance: InstanceState, entity: Entity): void {
    instance.entities.delete(entity.key);
    instance.order[entity.kind].delete(entity.key);
    instance.retry.delete(entity);
    instance.candleLabels.delete(entity);
    if (entity.lines) {
      for (const line of entity.lines) {
        instance.fillsByLine.get(line)?.delete(entity.key);
      }
    }
    // Pine deletes a linefill together with either of its lines.
    for (const fillKey of [...(instance.fillsByLine.get(entity.key) ?? [])]) {
      const fill = instance.entities.get(fillKey);
      if (fill) this.delete(instance, fill);
    }
    instance.fillsByLine.delete(entity.key);
    this.remove(entity);
  }

  private remove(entity: Entity): void {
    if (entity.removed) return;
    entity.removed = true;
    this.enqueue(entity, () => this.removeShapes(entity));
  }

  // ── Constructors per namespace ──────────────────────────────────────

  private blank(key: string, kind: DrawingKind, points: RawPoint[]): Entity {
    return {
      key,
      kind,
      ids: [null, null],
      chart: null,
      created: false,
      removed: false,
      queued: false,
      dirtyPoints: false,
      dirtyProps: false,
      dirtyText: false,
      ready: Promise.resolve(),
      points,
      style: {},
      text: '',
      textStyle: {},
      halign: 'center',
      valign: 'middle',
    };
  }

  /** box.new: 0 left, 1 top, 2 right, 3 bottom, 4 border_color, … */
  private newBox(key: string, args: unknown[]): Entity | null {
    const [left, top, right, bottom] = [0, 1, 2, 3].map((i) => coord(args[i]));
    const xloc = parseXloc(args[8]);
    if (!xloc) return null;
    const entity = this.blank(key, 'box', [
      { x: left, xloc, price: top },
      { x: right, xloc, price: bottom },
    ]);
    const border = color(args[4]);
    const background = color(args[9]);
    entity.style = defined({
      color: border ?? TRANSPARENT,
      linewidth: finite(args[5]) ?? 1,
      linestyle: lineStyle(args[6]) ?? 0,
      backgroundColor: background ?? TRANSPARENT,
      fillBackground: background !== null,
      transparency: 0,
      ...extend(args[7]),
    });
    entity.text = text(args[10]) ?? '';
    entity.textStyle = {
      color: color(args[12]) ?? DEFAULT_TEXT_COLOR,
      fontsize: fontSize(args[11]) ?? DEFAULT_FONT_SIZE,
      bold: false,
    };
    entity.halign = horzAlign(args[13]) ?? 'center';
    entity.valign = vertAlign(args[14]) ?? 'middle';
    return entity;
  }

  /** line.new: 0 x1, 1 y1, 2 x2, 3 y2, 4 xloc, 5 extend, 6 color, … */
  private newLine(key: string, args: unknown[]): Entity | null {
    const [x1, y1, x2, y2] = [0, 1, 2, 3].map((i) => coord(args[i]));
    const xloc = parseXloc(args[4]);
    if (!xloc) return null;
    const entity = this.blank(key, 'line', [
      { x: x1, xloc, price: y1 },
      { x: x2, xloc, price: y2 },
    ]);
    entity.style = defined({
      linecolor: color(args[6]) ?? DEFAULT_LINE_COLOR,
      linewidth: Math.max(1, finite(args[8]) ?? 1),
      linestyle: lineStyle(args[7]) ?? 0,
      ...extend(args[5]),
    });
    return entity;
  }

  /** label.new: 0 x, 1 y, 2 text, 3 xloc, 4 yloc, 5 color, 6 style, … */
  private newLabel(key: string, args: unknown[]): Entity | null {
    const xloc = parseXloc(args[3]);
    if (!xloc) return null;
    const entity = this.blank(key, 'label', [
      { x: coord(args[0]), xloc, price: coord(args[1]) },
    ]);
    const yloc = typeof args[4] === 'string' ? args[4] : undefined;
    entity.yloc = yloc;
    entity.text = text(args[2]) ?? '';
    entity.labelStyle = args[6];
    const background = color(args[5]);
    const align = labelStyleAlign(args[6]);
    entity.style = defined({
      text: labelText(entity.text, args[6]),
      color: color(args[7]) ?? DEFAULT_TEXT_COLOR,
      backgroundColor: background ?? TRANSPARENT,
      fillBackground: background !== null,
      fontsize: fontSize(args[8]) ?? DEFAULT_FONT_SIZE,
      bold: false,
      textHorzAlign: horzAlign(args[9]) ?? align.horz ?? undefined,
      textVertAlign: align.vert ?? undefined,
    });
    return entity;
  }

  /** linefill.new: 0 line1, 1 line2, 2 color. */
  private newLinefill(
    instance: InstanceState,
    key: string,
    args: unknown[],
  ): Entity | null {
    const first = handleId(args[0]);
    const second = handleId(args[1]);
    if (first === null || second === null || first === second) return null;
    const lines: [string, string] = [`line:${first}`, `line:${second}`];
    if (!lines.every((line) => instance.entities.has(line))) return null;
    const entity = this.blank(key, 'linefill', []);
    entity.lines = lines;
    entity.style = {
      filled: true,
      fillBackground: true,
      backgroundColor: colorOrTransparent(args[2]),
      linecolor: TRANSPARENT,
      linewidth: 1,
      transparency: 0,
    };
    return entity;
  }

  // ── Mutations ───────────────────────────────────────────────────────

  private mutateBox(
    instance: InstanceState,
    entity: Entity,
    method: string,
    args: unknown[],
  ): void {
    const [topLeft, bottomRight] = entity.points as [RawPoint, RawPoint];
    const a = finite(args[0]);
    const b = finite(args[1]);
    switch (method) {
      case 'set_left':
        if (a !== null) topLeft.x = a;
        break;
      case 'set_right':
        if (a !== null) bottomRight.x = a;
        break;
      case 'set_top':
        if (a !== null) topLeft.price = a;
        break;
      case 'set_bottom':
        if (a !== null) bottomRight.price = a;
        break;
      case 'set_lefttop':
        if (a !== null && b !== null)
          Object.assign(topLeft, { x: a, price: b });
        break;
      case 'set_rightbottom':
        if (a !== null && b !== null) {
          Object.assign(bottomRight, { x: a, price: b });
        }
        break;
      default:
        this.styleBox(instance, entity, method, args);
        return;
    }
    this.touchPoints(entity, instance);
  }

  private styleBox(
    instance: InstanceState,
    entity: Entity,
    method: string,
    args: unknown[],
  ): void {
    const style = entity.style;
    const value = args[0];
    switch (method) {
      case 'set_bgcolor': {
        const background = color(value);
        style.backgroundColor = background ?? TRANSPARENT;
        style.fillBackground = background !== null;
        break;
      }
      case 'set_border_color':
        style.color = colorOrTransparent(value);
        break;
      case 'set_border_width':
        style.linewidth = finite(value) ?? style.linewidth;
        break;
      case 'set_border_style':
        style.linestyle = lineStyle(value) ?? style.linestyle;
        break;
      case 'set_extend':
        Object.assign(style, extend(value));
        break;
      case 'set_text':
        entity.text = text(value) ?? '';
        this.touchText(instance, entity);
        return;
      case 'set_text_color':
        entity.textStyle.color = color(value) ?? TRANSPARENT;
        this.touchText(instance, entity);
        return;
      case 'set_text_size':
        entity.textStyle.fontsize = fontSize(value) ?? DEFAULT_FONT_SIZE;
        this.touchText(instance, entity);
        return;
      case 'set_text_halign':
      case 'set_text_valign':
        if (method === 'set_text_halign') {
          entity.halign = horzAlign(value) ?? entity.halign;
        } else {
          entity.valign = vertAlign(value) ?? entity.valign;
        }
        this.touchText(instance, entity);
        // The text anchor moves inside the box.
        this.touchPoints(entity, instance);
        return;
      default:
        return;
    }
    this.touchProps(instance, entity);
  }

  private mutateLine(
    instance: InstanceState,
    entity: Entity,
    method: string,
    args: unknown[],
  ): void {
    const [p1, p2] = entity.points as [RawPoint, RawPoint];
    const a = finite(args[0]);
    const b = finite(args[1]);
    let moved = true;
    switch (method) {
      case 'set_x1':
        if (a !== null) p1.x = a;
        break;
      case 'set_x2':
        if (a !== null) p2.x = a;
        break;
      case 'set_y1':
        if (a !== null) p1.price = a;
        break;
      case 'set_y2':
        if (a !== null) p2.price = a;
        break;
      case 'set_xy1':
        if (a !== null && b !== null) Object.assign(p1, { x: a, price: b });
        break;
      case 'set_xy2':
        if (a !== null && b !== null) Object.assign(p2, { x: a, price: b });
        break;
      case 'set_xloc': {
        const xloc = parseXloc(args[2]);
        if (a !== null && b !== null && xloc) {
          Object.assign(p1, { x: a, xloc });
          Object.assign(p2, { x: b, xloc });
        }
        break;
      }
      default:
        moved = false;
    }
    if (moved) {
      this.touchPoints(entity, instance);
      for (const fillKey of instance.fillsByLine.get(entity.key) ?? []) {
        this.touchPoints(instance.entities.get(fillKey), instance);
      }
      return;
    }
    switch (method) {
      case 'set_color':
        entity.style.linecolor = colorOrTransparent(args[0]);
        break;
      case 'set_width':
        if (a !== null) entity.style.linewidth = Math.max(1, a);
        break;
      case 'set_style':
        entity.style.linestyle = lineStyle(args[0]) ?? entity.style.linestyle;
        break;
      case 'set_extend':
        Object.assign(entity.style, extend(args[0]));
        break;
      default:
        return;
    }
    this.touchProps(instance, entity);
  }

  private mutateLabel(
    instance: InstanceState,
    entity: Entity,
    method: string,
    args: unknown[],
  ): void {
    const point = entity.points[0] as RawPoint;
    const style = entity.style;
    const a = finite(args[0]);
    const b = finite(args[1]);
    switch (method) {
      case 'set_x':
        if (a !== null) point.x = a;
        this.touchPoints(entity, instance);
        return;
      case 'set_y':
        if (a !== null) point.price = a;
        this.touchPoints(entity, instance);
        return;
      case 'set_xy':
        if (a !== null && b !== null) Object.assign(point, { x: a, price: b });
        this.touchPoints(entity, instance);
        return;
      case 'set_xloc': {
        const xloc = parseXloc(args[1]);
        if (a !== null && xloc) Object.assign(point, { x: a, xloc });
        this.touchPoints(entity, instance);
        return;
      }
      case 'set_yloc':
        entity.yloc = typeof args[0] === 'string' ? args[0] : undefined;
        if (isCandleRelative(entity.yloc)) instance.candleLabels.add(entity);
        else instance.candleLabels.delete(entity);
        this.touchPoints(entity, instance);
        return;
      case 'set_text':
        entity.text = text(args[0]) ?? '';
        style.text = labelText(entity.text, entity.labelStyle);
        break;
      case 'set_textcolor':
        style.color = colorOrTransparent(args[0]);
        break;
      case 'set_color': {
        const background = color(args[0]);
        style.backgroundColor = background ?? TRANSPARENT;
        style.fillBackground = background !== null;
        break;
      }
      case 'set_size':
        style.fontsize = fontSize(args[0]) ?? style.fontsize;
        break;
      case 'set_style': {
        const align = labelStyleAlign(args[0]);
        entity.labelStyle = args[0];
        style.text = labelText(entity.text, args[0]);
        if (align.horz) style.textHorzAlign = align.horz;
        if (align.vert) style.textVertAlign = align.vert;
        break;
      }
      case 'set_textalign':
        style.textHorzAlign = horzAlign(args[0]) ?? style.textHorzAlign;
        break;
      default:
        return;
    }
    this.touchProps(instance, entity);
  }

  // ── bgcolor bands ───────────────────────────────────────────────────

  /**
   * `bgcolor()` colours a bar's whole column. Consecutive bars with the
   * same colour from the same call site (its order within the bar)
   * become one band, a rectangle spanning every observed candle's
   * price range. A bar that runs again (a realtime tick) replaces its
   * own contribution instead of stacking.
   */
  private background(
    instance: InstanceState,
    barIndex: number,
    events: VisualEvent[],
  ): void {
    const repeat = barIndex === instance.backgroundBar;
    if (!repeat && barIndex < instance.backgroundBar) {
      instance.background = [];
    }
    instance.backgroundBar = barIndex;
    const layers = Math.max(instance.background.length, events.length);
    for (let layer = 0; layer < layers; layer++) {
      const event = events[layer];
      const next = event ? color(event.args?.[0]) : null;
      let run = instance.background[layer];
      const span = run?.entity.span;
      if (run && span && repeat && span[1] === barIndex) {
        if (run.color === next) continue;
        // This bar's earlier execution extended or started the run.
        if (span[0] === barIndex) {
          this.delete(instance, run.entity);
        } else {
          span[1] = barIndex - 1;
          this.touchPoints(run.entity, instance);
        }
        run = undefined;
      } else if (
        run &&
        span &&
        span[1] === barIndex - 1 &&
        run.color === next
      ) {
        span[1] = barIndex;
        this.touchPoints(run.entity, instance);
        continue;
      }
      instance.background[layer] = undefined;
      if (next === null) continue;
      const key = `bgcolor:${layer}:${instance.backgroundSeq++}`;
      const entity = this.blank(key, 'bgcolor', []);
      entity.span = [barIndex, barIndex];
      entity.style = {
        color: TRANSPARENT,
        linewidth: 1,
        backgroundColor: next,
        fillBackground: true,
        transparency: 0,
      };
      instance.background[layer] = { entity, color: next };
      this.track(instance, entity);
    }
  }

  // ── Scheduling ──────────────────────────────────────────────────────

  private touchPoints(
    entity: Entity | undefined,
    instance: InstanceState,
  ): void {
    if (!entity || entity.removed) return;
    entity.dirtyPoints = true;
    this.queue(instance, entity);
  }

  private touchProps(instance: InstanceState, entity: Entity): void {
    entity.dirtyProps = true;
    this.queue(instance, entity);
  }

  private touchText(instance: InstanceState, entity: Entity): void {
    entity.dirtyText = true;
    this.queue(instance, entity);
  }

  private retry(instance: InstanceState): void {
    for (const entity of instance.retry) {
      entity.dirtyPoints = true;
      this.queue(instance, entity);
    }
  }

  private queue(instance: InstanceState, entity: Entity): void {
    if (entity.queued || entity.removed) return;
    entity.queued = true;
    this.enqueue(entity, () => this.flush(instance, entity));
  }

  private enqueue(entity: Entity, task: () => Promise<void>): void {
    const next = entity.ready.then(task).catch((error: unknown) => {
      this.report('error', `chart call failed for ${entity.key}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    entity.ready = next;
    this.inFlight.add(next);
    // `next` never rejects: failures are reported above.
    next.then(() => this.inFlight.delete(next));
  }

  private async flush(instance: InstanceState, entity: Entity): Promise<void> {
    entity.queued = false;
    if (entity.removed) return;
    const chart = entity.chart ?? this.chartFor(instance);
    if (!chart) {
      instance.retry.add(entity);
      return;
    }
    const geometry = this.geometry(instance, entity);
    if (!entity.created) {
      if (!geometry) return;
      entity.dirtyPoints = false;
      entity.dirtyProps = false;
      entity.dirtyText = false;
      const id = await this.createShape(chart, entity, geometry);
      if (!id) return;
      entity.ids[0] = id;
      entity.chart = chart;
      entity.created = true;
      await this.syncBoxText(chart, entity, geometry, true);
      return;
    }
    if (!geometry) {
      // A linefill whose lines collapsed to one point: hide until valid.
      if (entity.kind === 'linefill') {
        await this.removeShapes(entity);
        entity.created = false;
      }
      return;
    }
    const id = entity.ids[0] as ChartEntityId;
    const moved = entity.dirtyPoints;
    const restyled = entity.dirtyProps;
    entity.dirtyPoints = false;
    entity.dirtyProps = false;
    try {
      if (moved) chart.getShapeById(id).setPoints(geometry);
      if (restyled) chart.getShapeById(id).setProperties({ ...entity.style });
      await this.syncBoxText(chart, entity, geometry, moved);
    } catch (error) {
      // The shape is gone from the chart (removed outside the
      // renderer). Forget it; the next change draws it again.
      entity.ids = [null, null];
      entity.chart = null;
      entity.created = false;
      this.report('warn', `lost chart shape for ${entity.key}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async createShape(
    chart: ChartApi,
    entity: Entity,
    points: ChartShapePoint[],
  ): Promise<ChartEntityId | null> {
    const overrides = { ...entity.style };
    let id: ChartEntityId | null | undefined;
    switch (entity.kind) {
      case 'label': {
        const label = String(overrides.text ?? '');
        delete overrides.text;
        id = await chart.createShape(points[0] as ChartShapePoint, {
          shape: 'text',
          text: label,
          ...SCRIPT_SHAPE_OPTIONS,
          overrides,
        });
        break;
      }
      case 'line':
        id = await chart.createMultipointShape(points, {
          shape: 'trend_line',
          ...SCRIPT_SHAPE_OPTIONS,
          overrides,
        });
        break;
      case 'linefill':
        id = await chart.createMultipointShape(points, {
          shape: 'polyline',
          ...SCRIPT_SHAPE_OPTIONS,
          overrides,
        });
        break;
      default:
        id = await chart.createMultipointShape(points, {
          shape: 'rectangle',
          ...SCRIPT_SHAPE_OPTIONS,
          overrides,
        });
    }
    if (!id) return null;
    const shape = chart.getShapeById(id);
    if (entity.kind === 'bgcolor') shape.sendToBack?.();
    else if (entity.kind === 'box') shape.bringToFront?.();
    return id;
  }

  /** Boxes carry their text as a second shape anchored inside them. */
  private async syncBoxText(
    chart: ChartApi,
    entity: Entity,
    geometry: ChartShapePoint[],
    moved: boolean,
  ): Promise<void> {
    if (entity.kind !== 'box') return;
    const anchor = this.boxTextAnchor(entity, geometry);
    const overrides = {
      ...entity.textStyle,
      textHorzAlign: entity.halign,
      textVertAlign: entity.valign,
    };
    const existing = entity.ids[1];
    if (!existing) {
      entity.dirtyText = false;
      if (entity.text.length === 0) return;
      entity.ids[1] =
        (await chart.createShape(anchor, {
          shape: 'text',
          text: entity.text,
          ...SCRIPT_SHAPE_OPTIONS,
          overrides,
        })) ?? null;
      return;
    }
    const shape = chart.getShapeById(existing);
    if (moved) shape.setPoints([anchor]);
    if (entity.dirtyText) {
      entity.dirtyText = false;
      shape.setProperties({ ...overrides, text: entity.text });
    }
  }

  private boxTextAnchor(
    entity: Entity,
    [a, b]: ChartShapePoint[],
  ): ChartShapePoint {
    const p = a as ChartShapePoint;
    const q = b as ChartShapePoint;
    const left = Math.min(p.time, q.time);
    const right = Math.max(p.time, q.time);
    const high = Math.max(p.price, q.price);
    const low = Math.min(p.price, q.price);
    const time =
      entity.halign === 'left'
        ? left
        : entity.halign === 'right'
          ? right
          : Math.round((left + right) / 2);
    const price =
      entity.valign === 'top'
        ? high
        : entity.valign === 'bottom'
          ? low
          : (high + low) / 2;
    return { time, price };
  }

  private async removeShapes(entity: Entity): Promise<void> {
    const ids = entity.ids.filter((id): id is ChartEntityId => Boolean(id));
    const chart = entity.chart;
    entity.ids = [null, null];
    entity.chart = null;
    if (ids.length === 0 || !chart) return;
    for (const id of ids) {
      try {
        chart.removeEntity(id);
      } catch {
        // Already gone, e.g. removed together with its study.
      }
    }
  }

  private chartFor(instance: InstanceState): ChartApi | null {
    if (!instance.chart) instance.chart = this.getChart(instance.id) ?? null;
    return instance.chart;
  }

  // ── Geometry ────────────────────────────────────────────────────────

  /**
   * Widget points for an entity, or null when it cannot be drawn yet.
   * Entities with unresolved or extrapolated coordinates go on the
   * instance's retry list and are redrawn when the next candle lands.
   */
  private geometry(
    instance: InstanceState,
    entity: Entity,
  ): ChartShapePoint[] | null {
    const state = { provisional: false };
    const resolve = (point: RawPoint): ChartShapePoint | null => {
      // `na` coordinates wait for a setter, not for the next candle.
      if (!Number.isFinite(point.x)) return null;
      const resolved = instance.timeline.resolve(point.x, point.xloc);
      if (!resolved) {
        state.provisional = true;
        return null;
      }
      if (resolved.provisional) state.provisional = true;
      let price = point.price;
      if (entity.kind === 'label' && isCandleRelative(entity.yloc)) {
        const candle = instance.timeline.candle(point.x, point.xloc);
        const above = entity.yloc?.includes('above');
        if (candle) price = above ? candle.high : candle.low;
      }
      return Number.isFinite(price) ? { time: resolved.time, price } : null;
    };
    let points: ChartShapePoint[] | null = null;
    if (entity.kind === 'linefill') {
      points = this.fillPolygon(instance, entity, resolve);
    } else if (entity.kind === 'bgcolor') {
      points = this.bandRectangle(instance, entity, resolve);
    } else {
      const resolved = entity.points.map(resolve);
      if (resolved.every((p): p is ChartShapePoint => p !== null)) {
        points = resolved;
      }
    }
    if (state.provisional) instance.retry.add(entity);
    else instance.retry.delete(entity);
    return points;
  }

  private fillPolygon(
    instance: InstanceState,
    entity: Entity,
    resolve: (point: RawPoint) => ChartShapePoint | null,
  ): ChartShapePoint[] | null {
    const sides = (entity.lines ?? []).map((key) => {
      const line = instance.entities.get(key);
      const ends = line?.points.map(resolve) ?? [];
      if (ends.length !== 2 || ends.some((p) => p === null)) return null;
      return (ends as ChartShapePoint[]).sort((p, q) => p.time - q.time);
    });
    const [a, b] = sides;
    if (!a || !b) return null;
    const [a0, a1] = a as [ChartShapePoint, ChartShapePoint];
    const [b0, b1] = b as [ChartShapePoint, ChartShapePoint];
    // Session lines start with zero width; wait for a real span.
    if (a0.time === a1.time && b0.time === b1.time && a0.time === b0.time) {
      return null;
    }
    return [a0, a1, b1, b0];
  }

  private bandRectangle(
    instance: InstanceState,
    entity: Entity,
    resolve: (point: RawPoint) => ChartShapePoint | null,
  ): ChartShapePoint[] | null {
    const extent = instance.timeline.extent();
    const span = entity.span;
    if (!extent || !span) return null;
    // A band covers its bars up to the next candle's open.
    const left = resolve({ x: span[0], xloc: 'bar_index', price: extent.high });
    const right = resolve({
      x: span[1] + 1,
      xloc: 'bar_index',
      price: extent.low,
    });
    return left && right ? [left, right] : null;
  }

  // ── Diagnostics ─────────────────────────────────────────────────────

  private instance(id: string): InstanceState {
    let instance = this.instances.get(id);
    if (!instance) {
      instance = {
        id,
        chart: null,
        candleLabels: new Set(),
        timeline: new BarTimeline(),
        entities: new Map(),
        order: emptyOrder(),
        fillsByLine: new Map(),
        retry: new Set(),
        background: [],
        backgroundBar: Number.NaN,
        backgroundSeq: 0,
      };
      this.instances.set(id, instance);
    }
    return instance;
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.report('info', message);
  }

  private report(
    level: HostDiagnostic['level'],
    message: string,
    detail?: Record<string, unknown>,
  ): void {
    this.onDiagnostic?.({ level, message, detail });
  }
}
