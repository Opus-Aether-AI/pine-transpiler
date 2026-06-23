export interface ParsedColorChannels {
  red: number;
  green: number;
  blue: number;
  alpha: number | null;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0').toUpperCase();
}

export function roundAlpha(value: number): number {
  // 4 decimals preserves fractional transparency (color.new(c, 0.5) -> 0.995)
  // and near-opaque 8-bit alpha (#RRGGBBFE -> 0.9961, not collapsed to opaque),
  // while still emitting "0.15" for the common integer-transparency case.
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

export function clampTransparency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function alphaFromTransparency(transparency: number): number {
  return roundAlpha(1 - clampTransparency(transparency) / 100);
}

export function normalizeHexColor(value: string): string | null {
  const hex = value.match(
    /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/,
  );
  if (!hex) return null;

  const digits = hex[1];
  const expanded =
    digits.length === 3 || digits.length === 4
      ? [...digits].map((digit) => `${digit}${digit}`).join('')
      : digits;

  return `#${expanded.toUpperCase()}`;
}

export function parseColorString(value: string): ParsedColorChannels | null {
  const normalizedHex = normalizeHexColor(value);
  if (normalizedHex) {
    const digits = normalizedHex.slice(1);
    const red = parseInt(digits.slice(0, 2), 16);
    const green = parseInt(digits.slice(2, 4), 16);
    const blue = parseInt(digits.slice(4, 6), 16);
    const alpha =
      digits.length === 8
        ? roundAlpha(parseInt(digits.slice(6, 8), 16) / 255)
        : null;
    return { red, green, blue, alpha };
  }

  const rgba = value.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!rgba) return null;

  const parts = rgba[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length !== 3 && parts.length !== 4) return null;

  const red = Number(parts[0]);
  const green = Number(parts[1]);
  const blue = Number(parts[2]);
  if (![red, green, blue].every(Number.isFinite)) return null;

  if (parts.length === 3) {
    return {
      red: clampByte(red),
      green: clampByte(green),
      blue: clampByte(blue),
      alpha: null,
    };
  }

  const alpha = Number(parts[3]);
  if (!Number.isFinite(alpha)) return null;

  return {
    red: clampByte(red),
    green: clampByte(green),
    blue: clampByte(blue),
    alpha: roundAlpha(alpha),
  };
}

export function formatHexColor(
  color: Pick<ParsedColorChannels, 'red' | 'green' | 'blue'>,
): string {
  return `#${toHexByte(color.red)}${toHexByte(color.green)}${toHexByte(color.blue)}`;
}

export function formatRgbaColor(
  color: Pick<ParsedColorChannels, 'red' | 'green' | 'blue'>,
  alpha: number,
): string {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${roundAlpha(alpha)})`;
}

export function toRenderableColor(value: string): string {
  const parsed = parseColorString(value);
  if (!parsed) return value;
  if (parsed.alpha === null || parsed.alpha >= 1) {
    return formatHexColor(parsed);
  }
  return formatRgbaColor(parsed, parsed.alpha);
}

export function applyTransparency(
  color: string,
  transparency: number | null,
): string {
  if (transparency === null) return toRenderableColor(color);

  const parsed = parseColorString(color);
  if (!parsed) return color;

  if (transparency <= 0 && parsed.alpha === null) {
    return formatHexColor(parsed);
  }

  return formatRgbaColor(parsed, alphaFromTransparency(transparency));
}
