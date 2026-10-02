/** Calendar/session arithmetic shared by both Factory paths. Host timestamps
 * are authoritative for chart bars; higher timeframes use the supplied symbol
 * calendar. Exchange holidays/exceptional sessions require host calendar data. */
const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function localTime(timestamp: number, timezone: string): number {
  const offset = /^(?:GMT|UTC)(?:([+-])(\d{1,2})(?::?(\d{2}))?)?$/i.exec(
    timezone,
  );
  if (offset) {
    const minutes = Number(offset[2] ?? 0) * 60 + Number(offset[3] ?? 0);
    return timestamp + (offset[1] === '-' ? -minutes : minutes) * 60_000;
  }
  try {
    let formatter = formatters.get(timezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
      formatters.set(timezone, formatter);
    }
    const parts = formatter.formatToParts(timestamp);
    const part = (name: string) =>
      Number(parts.find((p) => p.type === name)?.value);
    return (
      Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
        part('second'),
      ) +
      (timestamp % 1000)
    );
  } catch {
    return timestamp;
  }
}

function utcTime(local: number, timezone: string): number {
  // Sample both sides of a timezone transition. Testing each candidate at the
  // target instant avoids using today's UTC offset for a historical open.
  const matches: number[] = [];
  for (const probe of [local - DAY, local, local + DAY]) {
    const candidate = local - (localTime(probe, timezone) - probe);
    if (localTime(candidate, timezone) === local) matches.push(candidate);
  }
  return matches.length ? Math.min(...matches) : Number.NaN;
}

interface SessionWindow {
  start: number;
  end: number;
  days: string;
}

function sessionWindows(raw: string): SessionWindow[] {
  if (raw === '24x7' || !raw) return [{ start: 0, end: 0, days: '1234567' }];
  const [ranges, days = '1234567'] = raw.split(':');
  const windows: SessionWindow[] = [];
  for (const range of ranges.split(',')) {
    const match = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(range);
    if (!match) continue;
    const [, sh, sm, eh, em] = match.map(Number);
    if (sh > 23 || eh > 23 || sm > 59 || em > 59) continue;
    windows.push({ start: sh * 60 + sm, end: eh * 60 + em, days });
  }
  return windows;
}

/** barsBack indexes processed chart bars, never fabricated fixed-duration bars. */
export function resolveTime(
  currentBarTime: number,
  priorProcessedBars: number,
  barTimes: readonly number[],
  chartPeriod: string,
  symbol: Record<string, unknown> | undefined,
  timeframeArg: unknown,
  sessionArg?: unknown,
  timezoneArg?: unknown,
  barsBackArg?: unknown,
): number {
  if (barsBackArg === undefined && typeof timezoneArg === 'number') {
    barsBackArg = timezoneArg;
    timezoneArg = undefined;
  }
  const rawBack = Number(barsBackArg ?? 0);
  const back =
    Number.isFinite(rawBack) && rawBack > 0 ? Math.trunc(rawBack) : 0;
  if (back > priorProcessedBars) return Number.NaN;
  const timestamp = back ? barTimes[priorProcessedBars - back] : currentBarTime;
  if (!Number.isFinite(timestamp)) return Number.NaN;

  const requested = typeof timeframeArg === 'string' ? timeframeArg.trim() : '';
  const explicitSession =
    typeof sessionArg === 'string' ? sessionArg.trim() : '';
  // time, time(), time("") and host Std.time(context) keep the host bar open.
  if ((!requested || requested === chartPeriod) && !explicitSession)
    return timestamp;
  const timezone =
    typeof timezoneArg === 'string' && timezoneArg.trim()
      ? timezoneArg
      : String(symbol?.timezone || 'UTC');
  const session =
    explicitSession || String(symbol?.session_regular || symbol?.session || '');
  const local = localTime(timestamp, timezone);
  const date = Math.floor(local / DAY) * DAY;
  const minute = (local - date) / 60_000;
  let window: SessionWindow | undefined;
  let sessionDate = date;
  let tradingDate = date;
  for (const candidate of sessionWindows(session)) {
    const overnight = candidate.start >= candidate.end && candidate.start !== 0;
    const startDate = date - (minute < candidate.start ? DAY : 0);
    const tradeDate = startDate + (overnight ? DAY : 0);
    const inHours =
      candidate.start === candidate.end ||
      (candidate.start < candidate.end
        ? minute >= candidate.start && minute < candidate.end
        : minute >= candidate.start || minute < candidate.end);
    if (
      inHours &&
      candidate.days.includes(String(new Date(tradeDate).getUTCDay() + 1))
    ) {
      window = candidate;
      sessionDate = startDate;
      tradingDate = tradeDate;
      break;
    }
  }
  if (!window) return Number.NaN;
  if (!requested || requested === chartPeriod) return timestamp;
  const match = /^(\d+)?([SMHDWY])?$/.exec(requested.toUpperCase());
  if (!match) return timestamp;
  const count = Number(match[1] || 1);
  if (!Number.isFinite(count) || count <= 0) return Number.NaN;
  const unit = match[2] || '';
  const sessionOpen = utcTime(sessionDate + window.start * 60_000, timezone);
  if (unit === '' || unit === 'S' || unit === 'H') {
    const duration =
      count * (unit === 'S' ? 1000 : unit === 'H' ? 3_600_000 : 60_000);
    return (
      sessionOpen + Math.floor((timestamp - sessionOpen) / duration) * duration
    );
  }

  let periodDate = tradingDate;
  if (unit === 'D') {
    periodDate = Math.floor(tradingDate / (DAY * count)) * DAY * count;
  } else if (unit === 'W') {
    const monday = 4 * DAY; // 1970-01-05, a Monday in the local calendar.
    periodDate =
      monday +
      Math.floor((tradingDate - monday) / (7 * DAY * count)) * 7 * DAY * count;
  } else {
    const d = new Date(tradingDate);
    const months = unit === 'Y' ? count * 12 : count;
    const month =
      Math.floor((d.getUTCFullYear() * 12 + d.getUTCMonth()) / months) * months;
    periodDate = Date.UTC(Math.floor(month / 12), month % 12, 1);
  }
  // The first scheduled trading day can follow a weekend at a month boundary.
  for (
    let day = 0;
    day < 7 &&
    !window.days.includes(String(new Date(periodDate).getUTCDay() + 1));
    day++
  ) {
    periodDate += DAY;
  }
  const overnight = window.start >= window.end && window.start !== 0;
  return utcTime(
    periodDate - (overnight ? DAY : 0) + window.start * 60_000,
    timezone,
  );
}
