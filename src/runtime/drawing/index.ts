import type { DrawingNamespaceSpec } from '../../registry';
import { DRAWING_REGISTRY } from '../../registry';

export interface DrawingVisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  pineHandleId?: number;
}

export interface DrawingEventSink {
  barIndex: number;
  pushEvent: (event: DrawingVisualEvent) => void;
}

export interface DrawingHandle {
  __id: number;
  __deleted: boolean;
  [key: string]: unknown;
}

export interface DrawingTableCellData {
  text?: unknown;
  width?: unknown;
  height?: unknown;
  textColor?: unknown;
  textHalign?: unknown;
  textValign?: unknown;
  textSize?: unknown;
  bgcolor?: unknown;
  tooltip?: unknown;
  textFontFamily?: unknown;
  textFormatting?: unknown;
}

export interface DrawingTableHandle extends DrawingHandle {
  columns: number;
  rows: number;
  cells: Map<string, DrawingTableCellData>;
  merges: Array<[number, number, number, number]>;
}

export interface DrawingNamespaceInstance extends Record<string, unknown> {
  new: (...args: unknown[]) => DrawingHandle;
  __hasHandle: (value: unknown) => boolean;
}

export interface DrawingRuntime {
  line: DrawingNamespaceInstance;
  box: DrawingNamespaceInstance;
  label: DrawingNamespaceInstance;
  linefill: DrawingNamespaceInstance;
  table: DrawingNamespaceInstance;
}

const NUMBER_VALUE_NAMES = new Set([
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'left',
  'top',
  'right',
  'bottom',
]);

const INTEGER_VALUE_NAMES = new Set([
  'width',
  'height',
  'border_width',
  'frame_width',
  'column',
  'row',
  'start_column',
  'start_row',
  'end_column',
  'end_row',
]);

const NONNEGATIVE_INTEGER_VALUE_NAMES = new Set(['columns', 'rows']);
const STRING_VALUE_NAMES = new Set(['text', 'tooltip']);
const HANDLE_OWNER = Symbol('drawingHandleOwner');

const ONE_DEFAULT_INTEGER_NAMES = new Set([
  'width',
  'border_width',
  'frame_width',
]);

function toFiniteNumber(value: unknown, fallback = Number.NaN): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function toInteger(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? Math.trunc(candidate) : fallback;
}

function asHandle(value: unknown): DrawingHandle | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Partial<DrawingHandle>;
  if (typeof candidate.__id !== 'number') return undefined;
  return candidate as DrawingHandle;
}

function withConstantFallback<T extends Record<string, unknown>>(
  base: T,
  prefix: string,
): T {
  return new Proxy(base, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value !== undefined || typeof prop !== 'string') return value;
      return `${prefix}.${prop}`;
    },
  }) as T;
}

function resolveHandle<T extends DrawingHandle>(
  value: unknown,
  store: Map<number, T>,
  ownerToken: object,
): T | undefined {
  const handle = asHandle(value);
  if (!handle) return undefined;
  const handleOwner = (handle as unknown as Record<PropertyKey, unknown>)[
    HANDLE_OWNER
  ];
  if (handleOwner !== ownerToken) {
    return undefined;
  }
  const resolved = store.get(handle.__id);
  if (!resolved || resolved.__deleted) return undefined;
  return resolved;
}

function normalizeValue(name: string, value: unknown): unknown {
  if (STRING_VALUE_NAMES.has(name)) {
    return value == null ? '' : String(value);
  }

  if (NONNEGATIVE_INTEGER_VALUE_NAMES.has(name)) {
    return Math.max(0, toInteger(value, 0));
  }

  if (INTEGER_VALUE_NAMES.has(name)) {
    const fallback =
      value == null && ONE_DEFAULT_INTEGER_NAMES.has(name) ? 1 : 0;
    return toInteger(value, fallback);
  }

  if (NUMBER_VALUE_NAMES.has(name)) {
    return toFiniteNumber(value);
  }

  return value;
}

function getterFallback(name: string): unknown {
  if (STRING_VALUE_NAMES.has(name)) return '';
  if (
    NUMBER_VALUE_NAMES.has(name) ||
    INTEGER_VALUE_NAMES.has(name) ||
    NONNEGATIVE_INTEGER_VALUE_NAMES.has(name)
  ) {
    return Number.NaN;
  }
  return undefined;
}

function keyForCell(column: number, row: number): string {
  return `${column}:${row}`;
}

function parseAccessorFields(fnName: string): string[] {
  const suffix = fnName.replace(/^(set|get)_/, '');
  if (suffix === 'xy') return ['x', 'y'];

  const xyMatch = /^xy(\d+)$/.exec(suffix);
  if (xyMatch) {
    return [`x${xyMatch[1]}`, `y${xyMatch[1]}`];
  }

  return [suffix];
}

function buildProjectedArgs(
  projection: readonly string[],
  valuesByName: Readonly<Record<string, unknown>>,
  length: number,
): unknown[] {
  const projected: unknown[] = [];
  const cappedLength = Math.min(length, projection.length);
  for (let index = 0; index < cappedLength; index++) {
    projected.push(valuesByName[projection[index] ?? '']);
  }
  return projected;
}

function createTableCellData(
  valuesByName: Readonly<Record<string, unknown>>,
): DrawingTableCellData {
  return {
    text: valuesByName.text,
    width: valuesByName.width,
    height: valuesByName.height,
    textColor: valuesByName.text_color,
    textHalign: valuesByName.text_halign,
    textValign: valuesByName.text_valign,
    textSize: valuesByName.text_size,
    bgcolor: valuesByName.bgcolor,
    tooltip: valuesByName.tooltip,
    textFontFamily: valuesByName.text_font_family,
    textFormatting: valuesByName.text_formatting,
  };
}

export function createDrawingNamespace(
  descriptor: DrawingNamespaceSpec,
  sink: DrawingEventSink,
): DrawingNamespaceInstance {
  let nextId = 1;
  const ownerToken = {};
  const store = new Map<number, DrawingHandle>();
  const base: Record<string, unknown> = {};

  const emit = (call: string, pineHandleId: number, args: unknown[]): void => {
    sink.pushEvent({
      call,
      args,
      barIndex: sink.barIndex,
      pineHandleId,
    });
  };

  const hasHandle = (value: unknown): boolean =>
    resolveHandle(value, store, ownerToken) !== undefined;

  const attachHandleMethods = (handle: DrawingHandle): void => {
    for (const fnName of Object.keys(descriptor.functions)) {
      if (fnName === 'new') continue;
      if (typeof handle[fnName] === 'function') continue;
      handle[fnName] = (...args: unknown[]) => {
        const method = base[fnName];
        if (typeof method !== 'function') return undefined;
        return method(handle, ...args);
      };
    }
  };

  const createHandle = (...args: unknown[]): DrawingHandle => {
    const newSpec = descriptor.functions.new;
    const canonicalArgs = newSpec.canonicalArgs;
    const handleFields = newSpec.handleFields ?? {};
    const normalizedArgsByName: Record<string, unknown> = {};

    for (
      let index = 0;
      index < args.length && index < canonicalArgs.length;
      index++
    ) {
      const argName = canonicalArgs[index];
      if (!argName) continue;
      const fieldName = handleFields[argName] ?? argName;
      normalizedArgsByName[argName] = normalizeValue(fieldName, args[index]);
    }

    const handle: DrawingHandle = {
      __id: nextId++,
      __deleted: false,
    };
    Object.defineProperty(handle, HANDLE_OWNER, {
      value: ownerToken,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    for (const [argName, fieldName] of Object.entries(handleFields)) {
      handle[fieldName] = normalizedArgsByName[argName];
    }

    if (descriptor.name === 'table') {
      const tableHandle = handle as DrawingTableHandle;
      tableHandle.cells = new Map();
      tableHandle.merges = [];
    }

    attachHandleMethods(handle);
    store.set(handle.__id, handle);

    if (newSpec.visualEventArgs) {
      emit(
        `${descriptor.name}.new`,
        handle.__id,
        buildProjectedArgs(
          newSpec.visualEventArgs,
          normalizedArgsByName,
          args.length,
        ),
      );
    }

    return handle;
  };

  const getValue = (handle: DrawingHandle, fieldName: string): unknown => {
    const value = handle[fieldName];
    if (value === undefined) return getterFallback(fieldName);
    if (
      NUMBER_VALUE_NAMES.has(fieldName) ||
      INTEGER_VALUE_NAMES.has(fieldName) ||
      NONNEGATIVE_INTEGER_VALUE_NAMES.has(fieldName)
    ) {
      return toFiniteNumber(value);
    }
    if (STRING_VALUE_NAMES.has(fieldName)) {
      return value == null ? '' : String(value);
    }
    return value;
  };

  for (const [fnName, fnSpec] of Object.entries(descriptor.functions)) {
    if (fnName === 'new') {
      base.new = createHandle;
      continue;
    }

    if (fnName === 'delete') {
      base.delete = (handleLike: unknown) => {
        const handle = resolveHandle(handleLike, store, ownerToken);
        if (!handle) return;
        handle.__deleted = true;
        store.delete(handle.__id);
        emit(`${descriptor.name}.delete`, handle.__id, []);
      };
      continue;
    }

    if (fnName.startsWith('get_')) {
      const [fieldName = ''] = parseAccessorFields(fnName);
      base[fnName] = (handleLike: unknown) => {
        const handle = resolveHandle(handleLike, store, ownerToken);
        if (!handle) return getterFallback(fieldName);
        return getValue(handle, fieldName);
      };
      continue;
    }

    if (descriptor.name === 'table' && fnName === 'cell') {
      base.cell = (...args: unknown[]) => {
        const table = resolveHandle(args[0], store, ownerToken) as
          | DrawingTableHandle
          | undefined;
        if (!table) return;

        const normalizedArgsByName: Record<string, unknown> = {
          table_id: table,
        };
        for (
          let index = 1;
          index < args.length && index < fnSpec.canonicalArgs.length;
          index++
        ) {
          const argName = fnSpec.canonicalArgs[index];
          if (!argName) continue;
          normalizedArgsByName[argName] = normalizeValue(argName, args[index]);
        }

        const column = normalizedArgsByName.column as number;
        const row = normalizedArgsByName.row as number;
        table.cells.set(
          keyForCell(column, row),
          createTableCellData(normalizedArgsByName),
        );

        const projection = fnSpec.visualEventArgs ?? fnSpec.canonicalArgs;
        emit(
          'table.cell',
          table.__id,
          buildProjectedArgs(projection, normalizedArgsByName, args.length),
        );
      };
      continue;
    }

    if (descriptor.name === 'table' && fnName === 'clear') {
      base.clear = (...args: unknown[]) => {
        const table = resolveHandle(args[0], store, ownerToken) as
          | DrawingTableHandle
          | undefined;
        if (!table) return;

        const normalizedArgsByName: Record<string, unknown> = {};
        for (
          let index = 1;
          index < args.length && index < fnSpec.canonicalArgs.length;
          index++
        ) {
          const argName = fnSpec.canonicalArgs[index];
          if (!argName) continue;
          normalizedArgsByName[argName] = normalizeValue(argName, args[index]);
        }

        if (args.length <= 1) {
          table.cells.clear();
          table.merges = [];
        } else {
          const startColumn = normalizedArgsByName.start_column as number;
          const startRow = normalizedArgsByName.start_row as number;
          const endColumn =
            typeof normalizedArgsByName.end_column === 'number'
              ? (normalizedArgsByName.end_column as number)
              : table.columns - 1;
          const endRow =
            typeof normalizedArgsByName.end_row === 'number'
              ? (normalizedArgsByName.end_row as number)
              : table.rows - 1;

          for (const key of [...table.cells.keys()]) {
            const [columnText = '', rowText = ''] = key.split(':');
            const column = Number(columnText);
            const row = Number(rowText);
            if (
              column >= startColumn &&
              column <= endColumn &&
              row >= startRow &&
              row <= endRow
            ) {
              table.cells.delete(key);
            }
          }
        }

        emit(
          'table.clear',
          table.__id,
          buildProjectedArgs(
            fnSpec.canonicalArgs.slice(1),
            normalizedArgsByName,
            Math.max(0, args.length - 1),
          ),
        );
      };
      continue;
    }

    if (descriptor.name === 'table' && fnName === 'merge_cells') {
      base.merge_cells = (...args: unknown[]) => {
        const table = resolveHandle(args[0], store, ownerToken) as
          | DrawingTableHandle
          | undefined;
        if (!table) return;

        const normalizedArgsByName: Record<string, unknown> = {};
        for (
          let index = 1;
          index < args.length && index < fnSpec.canonicalArgs.length;
          index++
        ) {
          const argName = fnSpec.canonicalArgs[index];
          if (!argName) continue;
          normalizedArgsByName[argName] = normalizeValue(argName, args[index]);
        }

        const startColumn = normalizedArgsByName.start_column as number;
        const startRow = normalizedArgsByName.start_row as number;
        const endColumn =
          typeof normalizedArgsByName.end_column === 'number'
            ? (normalizedArgsByName.end_column as number)
            : startColumn;
        const endRow =
          typeof normalizedArgsByName.end_row === 'number'
            ? (normalizedArgsByName.end_row as number)
            : startRow;

        table.merges.push([startColumn, startRow, endColumn, endRow]);

        emit(
          'table.merge_cells',
          table.__id,
          buildProjectedArgs(
            fnSpec.canonicalArgs.slice(1),
            normalizedArgsByName,
            Math.max(0, args.length - 1),
          ),
        );
      };
      continue;
    }

    if (fnName.startsWith('set_')) {
      const fieldNames = parseAccessorFields(fnName);
      base[fnName] = (...args: unknown[]) => {
        const handle = resolveHandle(args[0], store, ownerToken);
        if (!handle) return;

        const normalizedArgsByName: Record<string, unknown> = {};
        for (
          let index = 1;
          index < args.length && index < fnSpec.canonicalArgs.length;
          index++
        ) {
          const argName = fnSpec.canonicalArgs[index];
          const fieldName = fieldNames[index - 1] ?? argName ?? '';
          if (!argName) continue;
          const normalizedValue = normalizeValue(fieldName, args[index]);
          normalizedArgsByName[argName] = normalizedValue;
          handle[fieldName] = normalizedValue;
        }

        emit(
          `${descriptor.name}.${fnName}`,
          handle.__id,
          buildProjectedArgs(
            fnSpec.canonicalArgs.slice(1),
            normalizedArgsByName,
            Math.max(0, args.length - 1),
          ),
        );
      };
    }
  }

  base.__hasHandle = hasHandle;

  for (const constant of descriptor.constants) {
    base[constant.name] = constant.value;
  }

  return withConstantFallback(
    base,
    descriptor.name,
  ) as DrawingNamespaceInstance;
}

export function createDrawingRuntime(sink: DrawingEventSink): DrawingRuntime {
  return {
    line: createDrawingNamespace(DRAWING_REGISTRY.line, sink),
    box: createDrawingNamespace(DRAWING_REGISTRY.box, sink),
    label: createDrawingNamespace(DRAWING_REGISTRY.label, sink),
    linefill: createDrawingNamespace(DRAWING_REGISTRY.linefill, sink),
    table: createDrawingNamespace(DRAWING_REGISTRY.table, sink),
  };
}
