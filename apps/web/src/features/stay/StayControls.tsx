/**
 * Stay dates and guests held in the URL (?checkIn&checkOut&guests), with the
 * form that edits them. Shared by the property page and the saved-places page.
 */
import {
  addDays,
  diffDays,
  isValidDateString,
  MAX_STAY_NIGHTS,
  pluralise,
  todayInTimeZone,
  validateStayDates,
} from '@wayfare/shared';
import { useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { defaultStay } from '../../lib/searchState';
import styles from './StayControls.module.css';

export function useStayFromUrl() {
  const [params, setParams] = useSearchParams();
  const today = todayInTimeZone();
  const fallback = defaultStay(today);
  const checkIn = params.get('checkIn') ?? fallback.checkIn;
  const checkOut = params.get('checkOut') ?? fallback.checkOut;
  const guests = Number(params.get('guests') ?? fallback.guests);
  const issues = validateStayDates(checkIn, checkOut, today);
  const guestsValid = Number.isInteger(guests) && guests >= 1 && guests <= 16;
  const stay =
    issues.length === 0 && guestsValid
      ? { checkIn, checkOut, guests }
      : { ...fallback, guests: guestsValid ? guests : fallback.guests };
  const correction =
    issues.length > 0 && (params.has('checkIn') || params.has('checkOut'))
      ? `${issues[0]!.message} Showing offers for tonight instead.`
      : !guestsValid
        ? 'The guest count was invalid, so we used 2 guests.'
        : null;
  const setStay = (next: { checkIn: string; checkOut: string; guests: number }) =>
    setParams(
      { checkIn: next.checkIn, checkOut: next.checkOut, guests: String(next.guests) },
      { replace: true },
    );
  return { stay, setStay, correction };
}

export function StayControls({
  stay,
  onChange,
}: {
  stay: { checkIn: string; checkOut: string; guests: number };
  onChange: (stay: { checkIn: string; checkOut: string; guests: number }) => void;
}) {
  const today = todayInTimeZone();
  const [checkIn, setCheckIn] = useState(stay.checkIn);
  const [checkOut, setCheckOut] = useState(stay.checkOut);
  const [guests, setGuests] = useState(stay.guests);
  const [error, setError] = useState<string>();
  const id = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    const issues = validateStayDates(checkIn, checkOut, today);
    if (issues.length) {
      setError(issues[0]!.message);
      return;
    }
    setError(undefined);
    onChange({ checkIn, checkOut, guests });
  }

  const nights =
    isValidDateString(checkIn) && isValidDateString(checkOut) ? diffDays(checkIn, checkOut) : 0;

  return (
    <form
      className={styles.stayForm}
      onSubmit={submit}
      aria-label="Change dates and guests"
      noValidate
    >
      <div className={styles.stayField}>
        <label htmlFor={`${id}-in`}>Check-in</label>
        <input
          id={`${id}-in`}
          type="date"
          value={checkIn}
          min={today}
          onChange={(e) => {
            setCheckIn(e.target.value);
            if (
              isValidDateString(e.target.value) &&
              isValidDateString(checkOut) &&
              diffDays(e.target.value, checkOut) < 1
            ) {
              setCheckOut(addDays(e.target.value, 1));
            }
          }}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <div className={styles.stayField}>
        <label htmlFor={`${id}-out`}>Check-out</label>
        <input
          id={`${id}-out`}
          type="date"
          value={checkOut}
          min={isValidDateString(checkIn) ? addDays(checkIn, 1) : today}
          max={isValidDateString(checkIn) ? addDays(checkIn, MAX_STAY_NIGHTS) : undefined}
          onChange={(e) => setCheckOut(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <div className={styles.stayField}>
        <label htmlFor={`${id}-guests`}>Guests</label>
        <select
          id={`${id}-guests`}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
        >
          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="md">
        Update{nights > 0 ? ` · ${pluralise(nights, 'night')}` : ''}
      </Button>
      {error && (
        <p className={styles.stayError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
