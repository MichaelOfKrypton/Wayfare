import {
  addDays,
  CALENDAR_MAX_NIGHTS,
  dayOfWeek,
  diffDays,
  formatZar,
  MAX_DAYS_AHEAD,
  pluralise,
  type CalendarDay,
} from '@wayfare/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { ErrorState } from '../../components/States';
import { useCalendar } from '../../lib/queries';
import styles from './PriceCalendar.module.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const monthOf = (date: string) => date.slice(0, 7);
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};
const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
};
/** Monday-first column (0–6) for a date. */
const column = (date: string) => (dayOfWeek(date) + 6) % 7;

/** "R 1 940" → "R 1.9k" for compact grid cells. */
function compactZar(cents: number): string {
  const rands = Math.round(cents / 100);
  return rands >= 10_000 ? `R ${(rands / 1000).toFixed(1)}k` : formatZar(cents);
}

export interface Stay {
  checkIn: string;
  checkOut: string;
  guests: number;
}

/**
 * A month of check-in dates, each showing the cheapest bookable average per night
 * for the chosen stay length. Choosing a day sets the stay and re-prices the offers.
 */
export function PriceCalendar({
  slug,
  stay,
  today,
  onSelect,
}: {
  slug: string;
  stay: Stay;
  today: string;
  onSelect: (stay: Stay) => void;
}) {
  const id = useId();
  const [month, setMonth] = useState(() => monthOf(stay.checkIn));
  const [nights, setNights] = useState(() =>
    Math.min(Math.max(diffDays(stay.checkIn, stay.checkOut), 1), CALENDAR_MAX_NIGHTS),
  );
  const calendar = useCalendar(slug, { month, nights, guests: stay.guests });

  const firstMonth = monthOf(today);
  const lastMonth = monthOf(addDays(today, MAX_DAYS_AHEAD));
  const days = calendar.data?.days ?? [];
  const leading = days[0] ? column(days[0].date) : 0;
  // Price bands relative to this month: the cheapest third reads as "good value".
  const prices = days.filter((d) => d.totalCents !== null).map((d) => d.totalCents!);
  const sorted = [...prices].sort((a, b) => a - b);
  const lowBand = sorted[Math.floor((sorted.length - 1) / 3)] ?? 0;

  const inStay = (date: string) =>
    diffDays(stay.checkIn, date) >= 0 && diffDays(date, stay.checkOut) > 0;

  function choose(day: CalendarDay) {
    onSelect({ checkIn: day.date, checkOut: addDays(day.date, nights), guests: stay.guests });
    document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className={styles.calendar} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <div>
          <h2 id={`${id}-title`} className={styles.title}>
            Find the cheapest dates
          </h2>
          <p className={styles.lede}>
            Average per night, all-in, for {pluralise(nights, 'night')} from each check-in date.
            Choose a date to compare its offers.
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.nights}>
            <label htmlFor={`${id}-nights`}>Stay length</label>
            <select
              id={`${id}-nights`}
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
            >
              {Array.from({ length: CALENDAR_MAX_NIGHTS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {pluralise(n, 'night')}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.monthNav}>
            <button
              type="button"
              aria-label="Previous month"
              disabled={month <= firstMonth}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className={styles.monthLabel} aria-live="polite">
              {monthLabel(month)}
            </span>
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= lastMonth}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {calendar.isError ? (
        <ErrorState message={calendar.error.message} onRetry={() => void calendar.refetch()} />
      ) : (
        <div
          className={`${styles.gridWrap} ${calendar.isFetching ? styles.loading : ''}`}
          aria-busy={calendar.isFetching}
        >
          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {calendar.isPending ? (
            <div className={styles.grid} aria-hidden="true">
              {Array.from({ length: 35 }, (_, i) => (
                <span key={i} className={`${styles.cell} ${styles.skeleton}`} />
              ))}
            </div>
          ) : (
            <ol key={`${month}|${nights}|${stay.guests}`} className={styles.grid}>
              {days.map((day, i) => {
                const dayNumber = Number(day.date.slice(8));
                const available = day.totalCents !== null;
                // Spoken after the visible day and price, which start the button's name.
                const details = available
                  ? `${WEEKDAY_NAMES[dayOfWeek(day.date)]} ${monthLabel(month)}, per night; ${formatZar(day.totalCents!)} total${day.isCheapest ? ', cheapest this month' : ''}`
                  : `${WEEKDAY_NAMES[dayOfWeek(day.date)]} ${monthLabel(month)}, ${day.unavailableReason === 'sold_out' ? 'sold out' : 'not bookable'}`;
                const tone = !available
                  ? styles.unavailable
                  : day.isCheapest
                    ? styles.cheapest
                    : day.totalCents! <= lowBand
                      ? styles.good
                      : '';
                return (
                  <li key={day.date} style={i === 0 ? { gridColumnStart: leading + 1 } : undefined}>
                    <button
                      type="button"
                      className={`${styles.cell} ${tone} ${inStay(day.date) ? styles.selected : ''} ${
                        day.date === stay.checkIn ? styles.selectedStart : ''
                      }`}
                      disabled={!available}
                      aria-pressed={day.date === stay.checkIn}
                      title={details}
                      onClick={() => choose(day)}
                    >
                      <span className={styles.dayNumber}>{dayNumber}</span>{' '}
                      <span className={styles.price}>
                        {available ? compactZar(day.averageNightlyCents!) : '—'}
                      </span>
                      <span className="visually-hidden">, {details}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <ul className={styles.legend} aria-label="Legend">
            <li>
              <span className={`${styles.swatch} ${styles.cheapest}`} /> Cheapest this month
            </li>
            <li>
              <span className={`${styles.swatch} ${styles.good}`} /> Good value
            </li>
            <li>
              <span className={`${styles.swatch} ${styles.selected}`} /> Your stay
            </li>
            <li>
              <span className={`${styles.swatch} ${styles.unavailable}`} /> Sold out or not bookable
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
