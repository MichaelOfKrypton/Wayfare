/**
 * Calendar-date helpers that work on plain `YYYY-MM-DD` strings.
 *
 * Stay dates are calendar days, not instants, so we never parse them with the
 * local-time `Date` constructor (which would shift days depending on the
 * machine's timezone). All arithmetic is done on UTC midnight timestamps.
 */

export const SA_TIME_ZONE = 'Africa/Johannesburg';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Round-trip check rejects impossible dates such as 2026-02-30.
  return date.toISOString().slice(0, 10) === value;
}

function toUtcMs(value: string): number {
  if (!isValidDateString(value)) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return Date.parse(`${value}T00:00:00Z`);
}

export function addDays(value: string, days: number): string {
  return new Date(toUtcMs(value) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday, matching PostgreSQL's `extract(dow …)`. */
export function dayOfWeek(value: string): number {
  return new Date(toUtcMs(value)).getUTCDay();
}

/** The calendar date "now" in the given IANA timezone (default SAST). */
export function todayInTimeZone(now: Date = new Date(), timeZone: string = SA_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export const MAX_STAY_NIGHTS = 30;
export const MAX_DAYS_AHEAD = 365;

export interface DateIssue {
  path: 'checkIn' | 'checkOut';
  message: string;
}

/**
 * Business rules for a stay relative to "today". Shared by the API (authoritative)
 * and the web app (early feedback), so both report the same messages.
 */
export function validateStayDates(checkIn: string, checkOut: string, today: string): DateIssue[] {
  const issues: DateIssue[] = [];
  if (!isValidDateString(checkIn)) {
    issues.push({ path: 'checkIn', message: 'Check-in must be a valid date (YYYY-MM-DD).' });
  }
  if (!isValidDateString(checkOut)) {
    issues.push({ path: 'checkOut', message: 'Check-out must be a valid date (YYYY-MM-DD).' });
  }
  if (issues.length > 0) return issues;

  if (diffDays(today, checkIn) < 0) {
    issues.push({ path: 'checkIn', message: 'Check-in cannot be in the past.' });
  } else if (diffDays(today, checkIn) > MAX_DAYS_AHEAD) {
    issues.push({
      path: 'checkIn',
      message: `Check-in must be within ${MAX_DAYS_AHEAD} days from today.`,
    });
  }

  const nights = diffDays(checkIn, checkOut);
  if (nights < 1) {
    issues.push({ path: 'checkOut', message: 'Check-out must be after check-in.' });
  } else if (nights > MAX_STAY_NIGHTS) {
    issues.push({
      path: 'checkOut',
      message: `Stays are limited to ${MAX_STAY_NIGHTS} nights.`,
    });
  }
  return issues;
}
