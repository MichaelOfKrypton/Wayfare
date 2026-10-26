import {
  addDays,
  type ApiErrorBody,
  type CalendarResponse,
  type OffersResponse,
} from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { getJson, useTestApp } from './helpers';

const ctx = useTestApp();
const SLUG = 'fynbos-ridge-guesthouse-knysna';
const nextMonth = (today: string) => {
  const [y, m] = today.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

describe('GET /api/properties/:slug/calendar', () => {
  it('returns every day of the month and explains days without a price', async () => {
    const month = ctx.today.slice(0, 7);
    const { status, body } = await getJson<CalendarResponse>(
      ctx.app,
      `/api/properties/${SLUG}/calendar`,
      { month, nights: '2', guests: '2' },
    );
    expect(status).toBe(200);
    const day = Number(ctx.today.slice(8));
    expect(body.days[0]!.date).toBe(`${month}-01`);
    expect(body.days.length).toBeGreaterThanOrEqual(28);
    for (const d of body.days.slice(0, day - 1)) expect(d.unavailableReason).toBe('past');
    for (const d of body.days) {
      expect(d.totalCents === null).toBe(d.unavailableReason !== null);
      if (d.totalCents !== null) expect(d.averageNightlyCents).toBe(Math.round(d.totalCents / 2));
    }
    const cheapest = body.days.filter((d) => d.isCheapest);
    if (body.cheapestTotalCents !== null) {
      expect(cheapest.length).toBeGreaterThan(0);
      expect(cheapest.every((d) => d.totalCents === body.cheapestTotalCents)).toBe(true);
    }
  });

  it('agrees with the offers endpoint for every date of a month (price and sold-out)', async () => {
    const month = nextMonth(ctx.today);
    const nights = 3;
    const { body } = await getJson<CalendarResponse>(ctx.app, `/api/properties/${SLUG}/calendar`, {
      month,
      nights: String(nights),
      guests: '2',
    });
    expect(body.days.some((d) => d.totalCents !== null)).toBe(true);
    for (const day of body.days) {
      const offers = await getJson<OffersResponse>(ctx.app, `/api/properties/${SLUG}/offers`, {
        checkIn: day.date,
        checkOut: addDays(day.date, nights),
        guests: '2',
      });
      const all = offers.body.groups.flatMap((g) => g.offers);
      const cheapest = all.length ? Math.min(...all.map((o) => o.price.totalCents)) : null;
      expect({ date: day.date, total: day.totalCents, count: day.offerCount }).toEqual({
        date: day.date,
        total: cheapest,
        count: all.length,
      });
    }
  });

  it('counts only rooms that fit the group', async () => {
    const month = nextMonth(ctx.today);
    const big = await getJson<CalendarResponse>(ctx.app, `/api/properties/${SLUG}/calendar`, {
      month,
      nights: '2',
      guests: '16',
    });
    expect(big.body.days.every((d) => d.totalCents === null)).toBe(true);
  });

  it('validates the month, stay length and slug', async () => {
    const bad = await getJson<ApiErrorBody>(ctx.app, `/api/properties/${SLUG}/calendar`, {
      month: '2026-13',
      nights: '2',
      guests: '2',
    });
    expect(bad.status).toBe(400);
    const tooLong = await getJson(ctx.app, `/api/properties/${SLUG}/calendar`, {
      month: nextMonth(ctx.today),
      nights: '15',
      guests: '2',
    });
    expect(tooLong.status).toBe(400);
    const farAway = await getJson(ctx.app, `/api/properties/${SLUG}/calendar`, {
      month: `${Number(ctx.today.slice(0, 4)) + 3}-01`,
      nights: '2',
      guests: '2',
    });
    expect(farAway.status).toBe(400);
    const unknown = await getJson(ctx.app, '/api/properties/no-such-place/calendar', {
      month: nextMonth(ctx.today),
      nights: '2',
      guests: '2',
    });
    expect(unknown.status).toBe(404);
  });
});
