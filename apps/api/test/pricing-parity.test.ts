/**
 * The SQL `quote_stay` function is the source of truth; the TypeScript
 * implementation in @wayfare/shared must agree with it for every offer.
 */
import { addDays, calculateStayPrice } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { useTestApp } from './helpers';

const ctx = useTestApp();

interface Row {
  id: number;
  nightly: number;
  weekend: number | null;
  fee: number;
  bps: number;
  incl: boolean;
  nights: number;
  weekend_nights: number;
  room_subtotal_cents: number;
  fees_cents: number;
  tax_cents: number;
  total_cents: number;
}

describe('quote_stay (SQL) ↔ calculateStayPrice (TypeScript)', () => {
  // Stays chosen to cover weekday-only, weekend-spanning, long and single-night cases.
  const stays: [number, number][] = [
    [0, 1],
    [1, 3],
    [3, 4],
    [5, 7],
    [10, 30],
  ];

  it.each(stays)('agrees for every offer (start +%i days, %i nights)', async (offset, nights) => {
    const checkIn = addDays(ctx.today, offset);
    const checkOut = addDays(checkIn, nights);
    const { rows } = await ctx.pool.query<Row>(
      `SELECT o.id, o.nightly_rate_cents AS nightly, o.weekend_nightly_rate_cents AS weekend,
              o.fee_per_stay_cents AS fee, o.tax_rate_bps AS bps, o.prices_include_tax AS incl, q.*
       FROM offers o
       CROSS JOIN LATERAL quote_stay(o.nightly_rate_cents, o.weekend_nightly_rate_cents, o.fee_per_stay_cents,
                                     o.tax_rate_bps, o.prices_include_tax, $1::date, $2::date) q`,
      [checkIn, checkOut],
    );
    expect(rows.length).toBeGreaterThan(500);
    for (const row of rows) {
      const ts = calculateStayPrice(
        {
          nightlyRateCents: row.nightly,
          weekendNightlyRateCents: row.weekend,
          feePerStayCents: row.fee,
          taxRateBps: row.bps,
          pricesIncludeTax: row.incl,
        },
        checkIn,
        checkOut,
      );
      expect({ id: row.id, ...ts, averageNightlyCents: undefined }).toEqual({
        id: row.id,
        nights: row.nights,
        weekendNights: row.weekend_nights,
        roomSubtotalCents: row.room_subtotal_cents,
        feesCents: row.fees_cents,
        taxCents: row.tax_cents,
        totalCents: row.total_cents,
        averageNightlyCents: undefined,
      });
    }
  });

  it('returns no row for zero-night stays', async () => {
    const { rows } = await ctx.pool.query(
      `SELECT * FROM quote_stay(100000, NULL, 0, 1500, true, $1::date, $1::date)`,
      [ctx.today],
    );
    expect(rows).toHaveLength(0);
  });
});
