/**
 * Saved places, kept in this browser's localStorage (no account needed).
 * Components read them through `useSaved()`, which re-renders on every change,
 * including changes made in another tab. Storage failures (private mode, full
 * quota) degrade to an in-memory list instead of breaking the page.
 */
import { useSyncExternalStore } from 'react';

export interface SavedPlace {
  slug: string;
  name: string;
  savedAt: string;
}

export const SAVED_KEY = 'wayfare:saved:v1';
export const MAX_SAVED = 24;
/** How many places the compare view shows side by side. */
export const MAX_COMPARE = 3;

const listeners = new Set<() => void>();
let cache: SavedPlace[] | null = null;

function isSavedPlace(value: unknown): value is SavedPlace {
  const v = value as SavedPlace;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.slug === 'string' &&
    /^[a-z0-9-]{1,140}$/.test(v.slug) &&
    typeof v.name === 'string' &&
    typeof v.savedAt === 'string'
  );
}

function read(): SavedPlace[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    cache = Array.isArray(parsed) ? parsed.filter(isSavedPlace).slice(0, MAX_SAVED) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: SavedPlace[]): void {
  cache = next;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // Keep working in memory for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVED_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const savedStore = {
  list: read,
  isSaved: (slug: string) => read().some((p) => p.slug === slug),
  /** Saves (newest first) or removes a place; returns whether it is now saved. */
  toggle(place: { slug: string; name: string }): boolean {
    const current = read();
    if (current.some((p) => p.slug === place.slug)) {
      write(current.filter((p) => p.slug !== place.slug));
      return false;
    }
    write([{ ...place, savedAt: new Date().toISOString() }, ...current].slice(0, MAX_SAVED));
    return true;
  },
  remove(slug: string): void {
    write(read().filter((p) => p.slug !== slug));
  },
  clear(): void {
    write([]);
  },
  /** Test helper: forget the in-memory copy so the next read hits storage. */
  resetCache(): void {
    cache = null;
  },
};

const serverSnapshot: SavedPlace[] = [];

export function useSaved(): SavedPlace[] {
  return useSyncExternalStore(subscribe, read, () => serverSnapshot);
}
