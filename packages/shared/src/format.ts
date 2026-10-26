/**
 * Presentation formatting. Implemented by hand (not Intl) so output is identical
 * across browsers, Node versions and ICU builds — which also keeps tests stable.
 */

const NBSP = ' ';

/** 159000 → "R 1 590" (rounded to whole rand, space-grouped as is common in South Africa). */
export function formatZar(cents: number): string {
  const rands = Math.round(cents / 100);
  const sign = rands < 0 ? '-' : '';
  const grouped = Math.abs(rands)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}R${NBSP}${grouped}`;
}

/** 159050 → "R 1 590.50" — for price breakdowns where cents matter. */
export function formatZarPrecise(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const rem = (abs % 100).toString().padStart(2, '0');
  return `${sign}R${NBSP}${rands}.${rem}`;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-26" → "Mon 26 Oct" */
export function formatShortDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[dow]} ${d} ${MONTHS[m - 1]}`;
}

/** Relative age of a timestamp, e.g. "3 h ago". `now` is injectable for tests. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
