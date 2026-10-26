import {
  addDays,
  diffDays,
  MAX_DAYS_AHEAD,
  type CalendarDay,
  type CalendarQuery,
  type CalendarResponse,
} from '@wayfare/shared';
import { ValidationError } from '../../lib/errors';
import type { CalendarRow } from './properties.repository';

/** First and last date of a YYYY-MM month. */
export function monthRange(month: string): { first: string; last: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { first, last: addDays(first, daysInMonth - 1) };
}

/**
 * The dates in the month that can be priced, using the same rules as a booking:
 * check-in no earlier than today and no more than MAX_DAYS_AHEAD days ahead.
 * Throws when the whole month is out of range.
 */
export function priceableRange(
  month: string,
  today: string,
): { first: string; last: string; from: string; to: string } {
  const { first, last } = monthRange(month);
  const latest = addDays(today, MAX_DAYS_AHEAD);
  const from = diffDays(today, first) < 0 ? today : first;
  const to = diffDays(last, latest) < 0 ? latest : last;
  if (diffDays(from, to) < 0) {
    throw new ValidationError([
      {
        path: 'month',
        message: `Choose a month between today and ${MAX_DAYS_AHEAD} days ahead.`,
      },
    ]);
  }
  return { first, last, from, to };
}

/** Fills the whole month, explaining every date without a price. */
export function buildCalendar(
  query: CalendarQuery,
  range: { first: string; last: string; from: string; to: string },
  rows: CalendarRow[],
): CalendarResponse {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const priced = rows.filter((r) => r.totalCents !== null).map((r) => r.totalCents!);
  const cheapest = priced.length > 0 ? Math.min(...priced) : null;

  const days: CalendarDay[] = [];
  for (let date = range.first; diffDays(date, range.last) >= 0; date = addDays(date, 1)) {
    const row = byDate.get(date);
    const unavailableReason =
      diffDays(range.from, date) < 0
        ? 'past'
        : diffDays(date, range.to) < 0
          ? 'too_far_ahead'
          : row === undefined || row.totalCents === null
            ? 'sold_out'
            : null;
    const total = unavailableReason ? null : row!.totalCents;
    days.push({
      date,
      totalCents: total,
      averageNightlyCents: total === null ? null : Math.round(total / query.nights),
      offerCount: unavailableReason ? 0 : row!.offerCount,
      unavailableReason,
      isCheapest: total !== null && total === cheapest,
    });
  }
  return {
    month: query.month,
    nights: query.nights,
    guests: query.guests,
    days,
    cheapestTotalCents: cheapest,
    currency: 'ZAR',
  };
}
