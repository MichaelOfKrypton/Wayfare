import { formatZar, type FiltersResponse, type SearchQuery } from '@wayfare/shared';
import { useEffect, useId, useState } from 'react';
import { Button } from '../../components/Button';
import { useDebouncedValue } from '../../lib/hooks';
import { activeFilterCount, hasReference } from '../../lib/searchState';
import styles from './FilterPanel.module.css';

const RATING_OPTIONS = [
  { value: undefined, label: 'Any' },
  { value: 7, label: '7+' },
  { value: 8, label: '8+' },
  { value: 9, label: '9+' },
] as const;

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50, 100];
const BEDROOM_OPTIONS = [1, 2, 3, 4];

/**
 * All filters map 1:1 to API query parameters and are evaluated in the database.
 * Text and price inputs are debounced so typing doesn't fire a request per key.
 */
export function FilterPanel({
  query,
  filters,
  defaultRadiusKm,
  onChange,
  onClear,
}: {
  query: SearchQuery;
  filters: FiltersResponse | undefined;
  defaultRadiusKm: number | null;
  onChange: (patch: Partial<SearchQuery>) => void;
  onClear: () => void;
}) {
  const id = useId();
  const active = activeFilterCount(query);
  const essentials = filters?.amenities.filter((a) => a.isEssential) ?? [];
  const others = filters?.amenities.filter((a) => !a.isEssential) ?? [];
  const selectedTypes = new Set(query.types ?? []);
  const selectedAmenities = new Set(query.amenities ?? []);

  const toggle = (key: 'types' | 'amenities', slug: string) => {
    const set = new Set(query[key] ?? []);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    onChange({ [key]: set.size ? [...set] : undefined });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>Filters</h2>
        {active > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear all ({active})
          </Button>
        )}
      </div>

      <PriceRange query={query} filters={filters} onChange={onChange} />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Cancellation</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={query.freeCancellation === true}
            onChange={(e) => onChange({ freeCancellation: e.target.checked ? true : undefined })}
          />
          Free cancellation only
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Demo score</legend>
        <div className={styles.segmented} role="radiogroup" aria-label="Minimum demo score">
          {RATING_OPTIONS.map((option) => (
            <label key={option.label} className={styles.segment}>
              <input
                type="radio"
                name={`${id}-rating`}
                checked={query.minRating === option.value}
                onChange={() => onChange({ minRating: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className={styles.help}>Scores are synthetic and exist only to demonstrate filtering.</p>
      </fieldset>

      {hasReference(query) && (
        <div className={styles.group}>
          <label className={styles.legend} htmlFor={`${id}-radius`}>
            Distance
          </label>
          <select
            id={`${id}-radius`}
            className={styles.select}
            value={query.radiusKm ?? ''}
            onChange={(e) =>
              onChange({ radiusKm: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">
              Default{defaultRadiusKm ? ` (within ${defaultRadiusKm} km)` : ''}
            </option>
            {RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                Within {km} km
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.group}>
        <label className={styles.legend} htmlFor={`${id}-bedrooms`}>
          Bedrooms
        </label>
        <select
          id={`${id}-bedrooms`}
          className={styles.select}
          value={query.minBedrooms ?? ''}
          onChange={(e) =>
            onChange({ minBedrooms: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Any</option>
          {BEDROOM_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}+ bedroom{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Type of stay</legend>
        <div className={styles.checkList}>
          {filters?.propertyTypes.map((type) => (
            <label key={type.slug} className={styles.check}>
              <input
                type="checkbox"
                checked={selectedTypes.has(type.slug)}
                onChange={() => toggle('types', type.slug)}
              />
              <span className={styles.checkLabel}>{type.name}</span>
              <span className={styles.count} aria-label={`${type.propertyCount} in dataset`}>
                {type.propertyCount}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Must have</legend>
        <div className={styles.chips}>
          {essentials.map((a) => (
            <button
              key={a.slug}
              type="button"
              className={styles.chip}
              aria-pressed={selectedAmenities.has(a.slug)}
              onClick={() => toggle('amenities', a.slug)}
            >
              {a.name}
            </button>
          ))}
        </div>
        {others.length > 0 && (
          <details
            className={styles.more}
            open={others.some((a) => selectedAmenities.has(a.slug)) || undefined}
          >
            <summary>More amenities</summary>
            <div className={styles.checkList}>
              {others.map((a) => (
                <label key={a.slug} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={selectedAmenities.has(a.slug)}
                    onChange={() => toggle('amenities', a.slug)}
                  />
                  <span className={styles.checkLabel}>{a.name}</span>
                </label>
              ))}
            </div>
          </details>
        )}
      </fieldset>

      <NameFilter value={query.q} onChange={(q) => onChange({ q })} />
    </div>
  );
}

function PriceRange({
  query,
  filters,
  onChange,
}: {
  query: SearchQuery;
  filters: FiltersResponse | undefined;
  onChange: (patch: Partial<SearchQuery>) => void;
}) {
  const id = useId();
  const [min, setMin] = useState(query.minPrice?.toString() ?? '');
  const [max, setMax] = useState(query.maxPrice?.toString() ?? '');
  const [error, setError] = useState<string>();

  // Keep inputs in sync when the URL changes elsewhere (e.g. "Clear all").
  useEffect(() => setMin(query.minPrice?.toString() ?? ''), [query.minPrice]);
  useEffect(() => setMax(query.maxPrice?.toString() ?? ''), [query.maxPrice]);

  const debouncedMin = useDebouncedValue(min, 600);
  const debouncedMax = useDebouncedValue(max, 600);

  useEffect(() => {
    const parse = (v: string) => (v.trim() === '' ? undefined : Number(v));
    const nextMin = parse(debouncedMin);
    const nextMax = parse(debouncedMax);
    if ([nextMin, nextMax].some((v) => v !== undefined && (!Number.isInteger(v) || v < 0))) {
      setError('Enter whole rand amounts, e.g. 1500.');
      return;
    }
    if (nextMin !== undefined && nextMax !== undefined && nextMin > nextMax) {
      setError('The minimum cannot be more than the maximum.');
      return;
    }
    setError(undefined);
    if (nextMin !== query.minPrice || nextMax !== query.maxPrice)
      onChange({ minPrice: nextMin, maxPrice: nextMax });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to debounced input
  }, [debouncedMin, debouncedMax]);

  const hint = filters
    ? `One-night prices in the demo range from ${formatZar(filters.priceBounds.minNightlyCents)} to ${formatZar(
        filters.priceBounds.maxNightlyCents,
      )}.`
    : undefined;

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Budget per night</legend>
      <div className={styles.priceRow}>
        <div className={styles.priceField}>
          <label htmlFor={`${id}-min`}>Min (R)</label>
          <input
            id={`${id}-min`}
            className={styles.select}
            inputMode="numeric"
            placeholder="No min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-help`}
          />
        </div>
        <span aria-hidden="true" className={styles.dash}>
          –
        </span>
        <div className={styles.priceField}>
          <label htmlFor={`${id}-max`}>Max (R)</label>
          <input
            id={`${id}-max`}
            className={styles.select}
            inputMode="numeric"
            placeholder="No max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-help`}
          />
        </div>
      </div>
      <p
        id={`${id}-help`}
        className={error ? styles.error : styles.help}
        role={error ? 'alert' : undefined}
      >
        {error ?? `Average per night for the cheapest offer, incl. fees and VAT. ${hint ?? ''}`}
      </p>
    </fieldset>
  );
}

function NameFilter({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (q: string | undefined) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  const debounced = useDebouncedValue(text, 400);
  useEffect(() => {
    const next = debounced.trim() || undefined;
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to debounced input
  }, [debounced]);
  return (
    <div className={styles.group}>
      <label className={styles.legend} htmlFor={`${id}-name`}>
        Property name
      </label>
      <input
        id={`${id}-name`}
        className={styles.select}
        type="search"
        placeholder="e.g. Lagoon"
        maxLength={80}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
