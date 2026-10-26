import {
  addDays,
  diffDays,
  isValidDateString,
  MAX_STAY_NIGHTS,
  searchQueryToParams,
  todayInTimeZone,
  validateStayDates,
  type SearchQuery,
} from '@wayfare/shared';
import { Search } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { api } from '../../lib/api';
import { geolocationMessage, requestCurrentPosition } from '../../lib/geolocation';
import { DestinationCombobox, type PlaceSelection } from './DestinationCombobox';
import styles from './SearchForm.module.css';

export interface SearchFormValues {
  place: PlaceSelection;
  checkIn: string;
  checkOut: string;
  guests: number;
}

const GUEST_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);

/**
 * The main search form. On the homepage it starts a new search; on the results
 * page (`baseQuery` given) it keeps the user's filters and changes only place,
 * dates and guests.
 */
export function SearchForm({
  initial,
  baseQuery,
  variant = 'hero',
}: {
  initial: SearchFormValues;
  baseQuery?: SearchQuery;
  variant?: 'hero' | 'compact';
}) {
  const navigate = useNavigate();
  const today = todayInTimeZone();
  const [place, setPlace] = useState<PlaceSelection>(initial.place);
  const [text, setText] = useState(initial.place.label);
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState(initial.guests);
  const [locating, setLocating] = useState(false);
  const [placeError, setPlaceError] = useState<string>();
  const [dateError, setDateError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function locateUser() {
    setLocating(true);
    setPlaceError(undefined);
    try {
      const point = await requestCurrentPosition();
      const selection: PlaceSelection = {
        kind: 'coordinates',
        ...point,
        label: 'Current location',
      };
      setPlace(selection);
      setText(selection.label);
    } catch (error) {
      setPlaceError(geolocationMessage(error));
      inputRef.current?.focus();
    } finally {
      setLocating(false);
    }
  }

  async function resolvePlace(): Promise<PlaceSelection | null> {
    const typed = text.trim();
    if (!typed) return { kind: 'anywhere', label: '' };
    if (place.kind !== 'anywhere' && place.label === typed) return place;
    const { items } = await api.destinations({ q: typed, limit: 1 });
    const match = items[0];
    if (!match) {
      setPlaceError(
        `We couldn't find "${typed}" in the demo destinations. Try a town such as Knysna or Durban.`,
      );
      inputRef.current?.focus();
      return null;
    }
    return { kind: 'destination', slug: match.slug, label: match.name };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPlaceError(undefined);
    const issues = validateStayDates(checkIn, checkOut, today);
    if (issues.length) {
      setDateError(issues[0]!.message);
      return;
    }
    setDateError(undefined);
    setSubmitting(true);
    try {
      const resolved = await resolvePlace();
      if (!resolved) return;
      setPlace(resolved);
      setText(resolved.label);

      const base: Partial<SearchQuery> = baseQuery ? { ...baseQuery } : {};
      delete base.destination;
      delete base.lat;
      delete base.lng;
      delete base.page;
      if (
        baseQuery?.destination !== (resolved.kind === 'destination' ? resolved.slug : undefined)
      ) {
        delete base.radiusKm; // a radius chosen for one place rarely suits another
      }
      const next: Partial<SearchQuery> = { ...base, checkIn, checkOut, guests };
      if (resolved.kind === 'destination') next.destination = resolved.slug;
      if (resolved.kind === 'coordinates') {
        next.lat = resolved.lat;
        next.lng = resolved.lng;
        next.sort = 'distance_asc';
      }
      if (resolved.kind === 'anywhere' && next.sort === 'distance_asc') delete next.sort;
      navigate(`/search?${searchQueryToParams(next).toString()}`);
    } catch {
      setPlaceError(
        'Search is unavailable right now. Please check that the API is running and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onCheckInChange(value: string) {
    setCheckIn(value);
    setDateError(undefined);
    // Keep the stay valid as the user moves check-in forward.
    if (isValidDateString(value) && isValidDateString(checkOut) && diffDays(value, checkOut) < 1) {
      setCheckOut(addDays(value, 1));
    }
  }

  const nights =
    isValidDateString(checkIn) && isValidDateString(checkOut) ? diffDays(checkIn, checkOut) : 0;

  return (
    <form
      className={`${styles.form} ${styles[variant]}`}
      onSubmit={onSubmit}
      noValidate
      aria-label="Search stays"
    >
      <DestinationCombobox
        text={text}
        onTextChange={(value) => {
          setText(value);
          setPlaceError(undefined);
        }}
        onSelect={(selection) => {
          setPlace(selection);
          setText(selection.label);
        }}
        onUseLocation={() => void locateUser()}
        locating={locating}
        error={placeError}
        inputRef={inputRef}
      />
      <div className={styles.dates}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${variant}-check-in`}>
            Check-in
          </label>
          <input
            id={`${variant}-check-in`}
            className={styles.input}
            type="date"
            min={today}
            max={addDays(today, 365)}
            value={checkIn}
            required
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? `${variant}-date-error` : undefined}
            onChange={(event) => onCheckInChange(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${variant}-check-out`}>
            Check-out
          </label>
          <input
            id={`${variant}-check-out`}
            className={styles.input}
            type="date"
            min={isValidDateString(checkIn) ? addDays(checkIn, 1) : today}
            max={isValidDateString(checkIn) ? addDays(checkIn, MAX_STAY_NIGHTS) : undefined}
            value={checkOut}
            required
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? `${variant}-date-error` : `${variant}-nights`}
            onChange={(event) => {
              setCheckOut(event.target.value);
              setDateError(undefined);
            }}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${variant}-guests`}>
          Guests
        </label>
        <select
          id={`${variant}-guests`}
          className={styles.input}
          value={guests}
          onChange={(event) => setGuests(Number(event.target.value))}
        >
          {GUEST_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'guest' : 'guests'}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.submit}>
        <Button
          type="submit"
          size="lg"
          block
          icon={<Search size={18} aria-hidden="true" />}
          loading={submitting}
        >
          Search
        </Button>
      </div>
      {dateError ? (
        <p
          id={`${variant}-date-error`}
          className={`${styles.fieldError} ${styles.formMessage}`}
          role="alert"
        >
          {dateError}
        </p>
      ) : (
        <p id={`${variant}-nights`} className={`${styles.hint} ${styles.formMessage}`}>
          {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : ''}
        </p>
      )}
    </form>
  );
}
