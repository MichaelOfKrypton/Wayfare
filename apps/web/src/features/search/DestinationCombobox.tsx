import type { Destination } from '@wayfare/shared';
import { Building2, Landmark, LocateFixed, MapPin, Mountain } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDebouncedValue } from '../../lib/hooks';
import { useDestinationSuggestions } from '../../lib/queries';
import styles from './SearchForm.module.css';

export type PlaceSelection =
  | { kind: 'destination'; slug: string; label: string }
  | { kind: 'coordinates'; lat: number; lng: number; label: string }
  | { kind: 'anywhere'; label: '' };

const KIND_ICON = {
  city: Building2,
  town: MapPin,
  suburb: MapPin,
  region: Mountain,
  landmark: Landmark,
} as const;

const KIND_LABEL = {
  city: 'City',
  town: 'Town',
  suburb: 'Suburb',
  region: 'Region',
  landmark: 'Landmark',
} as const;

/**
 * Destination autocomplete following the WAI-ARIA 1.2 combobox pattern:
 * typing filters suggestions, arrows move the active option, Enter selects,
 * Escape closes. Free text is resolved on submit by the parent form.
 */
export function DestinationCombobox({
  text,
  onTextChange,
  onSelect,
  onUseLocation,
  locating,
  error,
  inputRef,
}: {
  text: string;
  onTextChange: (value: string) => void;
  onSelect: (selection: PlaceSelection) => void;
  onUseLocation: () => void;
  locating: boolean;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebouncedValue(text, 150);
  const { data, isFetching } = useDestinationSuggestions(debounced);
  const suggestions: Destination[] = text.trim().length >= 2 ? (data?.items ?? []) : [];
  const blurTimer = useRef<number | undefined>(undefined);

  // Option 0 is always "Use my current location".
  const optionCount = suggestions.length + 1;

  function choose(index: number) {
    if (index === 0) {
      onUseLocation();
    } else {
      const destination = suggestions[index - 1];
      if (!destination) return;
      onSelect({ kind: 'destination', slug: destination.slug, label: destination.name });
    }
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % optionCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? optionCount - 1 : i - 1));
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const describedBy = error ? errorId : undefined;

  return (
    <div className={styles.comboWrap}>
      <label htmlFor={`${id}-input`} className={styles.label}>
        Where to?
      </label>
      <div className={styles.inputShell}>
        <MapPin size={18} aria-hidden="true" className={styles.inputIcon} />
        <input
          id={`${id}-input`}
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          placeholder="Town, suburb or landmark"
          value={text}
          onChange={(event) => {
            onTextChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="Destination suggestions"
        className={styles.listbox}
        hidden={!open}
        onMouseDown={(event) => event.preventDefault() /* keep focus in the input */}
      >
        <li
          id={`${id}-opt-0`}
          role="option"
          aria-selected={active === 0}
          className={`${styles.option} ${styles.locationOption} ${active === 0 ? styles.optionActive : ''}`}
          onClick={() => choose(0)}
        >
          <LocateFixed size={18} aria-hidden="true" />
          <span>
            <span className={styles.optionName}>
              {locating ? 'Finding your location…' : 'Use my current location'}
            </span>
            <span className={styles.optionMeta}>
              Best for tonight · asks your browser for permission
            </span>
          </span>
        </li>
        {suggestions.map((d, i) => {
          const Icon = KIND_ICON[d.kind];
          const index = i + 1;
          return (
            <li
              key={d.slug}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={active === index}
              className={`${styles.option} ${active === index ? styles.optionActive : ''}`}
              onClick={() => choose(index)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>
                <span className={styles.optionName}>{d.name}</span>
                <span className={styles.optionMeta}>
                  {KIND_LABEL[d.kind]}
                  {d.parentName ? ` · ${d.parentName}` : ''} · {d.province}
                </span>
              </span>
            </li>
          );
        })}
        {text.trim().length >= 2 && !isFetching && suggestions.length === 0 && (
          <li className={styles.optionEmpty} role="presentation">
            No matching destinations in the demo dataset.
          </li>
        )}
      </ul>
    </div>
  );
}
