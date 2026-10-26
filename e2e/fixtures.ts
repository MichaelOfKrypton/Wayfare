import { test as base, expect, type Page } from '@playwright/test';

/** Dates relative to today in SAST, matching the app's notion of "today". */
export function sastDate(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(
    new Date(),
  );
  const ms = Date.parse(`${today}T00:00:00Z`) + offsetDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function searchUrl(params: Record<string, string>): string {
  const all = { checkIn: sastDate(3), checkOut: sastDate(5), guests: '2', ...params };
  return `/search?${new URLSearchParams(all).toString()}`;
}

/**
 * Block public map tiles: automated tests must not load the OSM tile server
 * (tile usage policy), and it also exercises the offline-tiles notice.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
    await use(page);
  },
});

/** Reads "R 1 540"-style prices from text as integer rands. */
export function rands(text: string): number {
  return Number(text.replace(/[^0-9]/g, ''));
}

export { expect };
