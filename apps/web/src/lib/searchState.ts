/**
 * The URL query string is the single source of truth for search state (ADR-008).
 * These helpers parse it with the shared schema and write it back canonically.
 */
import {
  addDays,
  searchQuerySchema,
  searchQueryToParams,
  todayInTimeZone,
  validateStayDates,
  type SearchQuery,
} from '@wayfare/shared';

export const DEFAULT_GUESTS = 2;

export function defaultStay(today = todayInTimeZone()) {
  return { checkIn: today, checkOut: addDays(today, 1), guests: DEFAULT_GUESTS };
}

export interface ParsedSearch {
  query: SearchQuery;
  /** Messages explaining any values that were invalid and replaced with defaults. */
  corrections: string[];
}

/**
 * Parses URL params into a valid query. Invalid parts are dropped (with a
 * visible correction) rather than crashing the page — e.g. stale links with past dates.
 */
export function parseSearchParams(
  params: URLSearchParams,
  today = todayInTimeZone(),
): ParsedSearch {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) raw[key] = value;
  const corrections: string[] = [];

  const stay = defaultStay(today);
  const dateIssues = validateStayDates(raw.checkIn ?? '', raw.checkOut ?? '', today);
  if (raw.checkIn === undefined && raw.checkOut === undefined) {
    raw.checkIn = stay.checkIn;
    raw.checkOut = stay.checkOut;
  } else if (dateIssues.length > 0) {
    corrections.push(`${dateIssues[0]!.message} We've reset your dates to tonight.`);
    raw.checkIn = stay.checkIn;
    raw.checkOut = stay.checkOut;
  }
  raw.guests ??= String(stay.guests);

  let result = searchQuerySchema.safeParse(raw);
  // Drop offending keys one round at a time until the remainder is valid.
  for (let attempt = 0; !result.success && attempt < 5; attempt += 1) {
    for (const issue of result.error.issues) {
      const key = issue.code === 'unrecognized_keys' ? null : String(issue.path[0] ?? '');
      if (issue.code === 'unrecognized_keys') {
        for (const k of issue.keys) delete raw[k];
        continue;
      }
      if (!key) continue;
      if (key === 'guests') raw.guests = String(DEFAULT_GUESTS);
      else if (key === 'checkIn' || key === 'checkOut') {
        raw.checkIn = stay.checkIn;
        raw.checkOut = stay.checkOut;
      } else delete raw[key];
      corrections.push(`Ignored an invalid "${key}" value: ${issue.message}`);
    }
    result = searchQuerySchema.safeParse(raw);
  }
  if (!result.success) {
    return {
      query: searchQuerySchema.parse({ ...stay, guests: String(stay.guests) }),
      corrections,
    };
  }
  return { query: result.data, corrections };
}

/** Applies a patch and returns canonical params; filter changes reset to page 1. */
export function updateSearch(current: SearchQuery, patch: Partial<SearchQuery>): URLSearchParams {
  const next: Partial<SearchQuery> = { ...current, ...patch };
  if (!('page' in patch)) delete next.page;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key as keyof SearchQuery];
  }
  return searchQueryToParams(next);
}

export function hasReference(query: SearchQuery): boolean {
  return Boolean(query.destination) || (query.lat !== undefined && query.lng !== undefined);
}

export function activeFilterCount(query: SearchQuery): number {
  return [
    query.minPrice !== undefined || query.maxPrice !== undefined,
    (query.types?.length ?? 0) > 0,
    (query.amenities?.length ?? 0) > 0,
    query.minRating !== undefined,
    query.freeCancellation === true,
    query.minBedrooms !== undefined,
    query.radiusKm !== undefined,
    query.q !== undefined,
  ].filter(Boolean).length;
}
