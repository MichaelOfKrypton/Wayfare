import { describe, expect, it } from 'vitest';
import { calculateStayPrice, countWeekendNights, roundHalfAwayFromZero, type OfferRates } from './pricing';

const base: OfferRates = {
  nightlyRateCents: 100_000, // R1 000
  weekendNightlyRateCents: null,
  feePerStayCents: 0,
  taxRateBps: 1500,
  pricesIncludeTax: true,
};

// 2026-10-26 is a Monday.
describe('countWeekendNights', () => {
  it('counts Friday and Saturday nights only', () => {
    expect(countWeekendNights('2026-10-26', '2026-10-30')).toBe(0); // Mon–Thu nights
    expect(countWeekendNights('2026-10-30', '2026-11-01')).toBe(2); // Fri + Sat
    expect(countWeekendNights('2026-11-01', '2026-11-02')).toBe(0); // Sun night
    expect(countWeekendNights('2026-10-26', '2026-11-02')).toBe(2); // full week
  });
});

describe('calculateStayPrice', () => {
  it('multiplies the nightly rate by nights when there is no weekend rate', () => {
    const price = calculateStayPrice(base, '2026-10-26', '2026-10-29');
    expect(price.nights).toBe(3);
    expect(price.roomSubtotalCents).toBe(300_000);
    expect(price.totalCents).toBe(300_000);
    expect(price.averageNightlyCents).toBe(100_000);
  });

  it('applies the weekend rate to Friday and Saturday nights', () => {
    const price = calculateStayPrice(
      { ...base, weekendNightlyRateCents: 150_000 },
      '2026-10-29', // Thu
      '2026-11-01', // Sun → Thu, Fri, Sat nights
    );
    expect(price.weekendNights).toBe(2);
    expect(price.roomSubtotalCents).toBe(100_000 + 2 * 150_000);
  });

  it('adds the per-stay fee exactly once', () => {
    const price = calculateStayPrice({ ...base, feePerStayCents: 25_000 }, '2026-10-26', '2026-10-31');
    expect(price.feesCents).toBe(25_000);
    expect(price.totalCents).toBe(5 * 100_000 + 25_000);
  });

  it('reports included VAT without adding it to the total', () => {
    const price = calculateStayPrice({ ...base, feePerStayCents: 15_000 }, '2026-10-26', '2026-10-27');
    // taxable 115 000; included VAT = 115 000 × 15/115 = 15 000
    expect(price.taxCents).toBe(15_000);
    expect(price.totalCents).toBe(115_000);
  });

  it('adds VAT once on subtotal plus fees when prices exclude tax', () => {
    const price = calculateStayPrice(
      { ...base, pricesIncludeTax: false, feePerStayCents: 10_000 },
      '2026-10-26',
      '2026-10-28',
    );
    // taxable 210 000 → VAT 31 500
    expect(price.taxCents).toBe(31_500);
    expect(price.totalCents).toBe(241_500);
  });

  it('rounds VAT half away from zero at stay level (not per night)', () => {
    // 3 nights × 10 003 = 30 009; 15% = 4 501.35 → 4 501.
    // Per-night rounding would give 3 × round(1 500.45) = 4 500 — a different (wrong) answer.
    const price = calculateStayPrice(
      { ...base, nightlyRateCents: 10_003, pricesIncludeTax: false },
      '2026-10-26',
      '2026-10-29',
    );
    expect(price.taxCents).toBe(4_501);
    expect(price.totalCents).toBe(30_009 + 4_501);
  });

  it('rejects zero-night and negative stays', () => {
    expect(() => calculateStayPrice(base, '2026-10-26', '2026-10-26')).toThrow(RangeError);
    expect(() => calculateStayPrice(base, '2026-10-27', '2026-10-26')).toThrow(RangeError);
  });

  it('rejects non-integer money values', () => {
    expect(() =>
      calculateStayPrice({ ...base, nightlyRateCents: 100.5 }, '2026-10-26', '2026-10-27'),
    ).toThrow(/nightlyRateCents/);
  });
});

describe('roundHalfAwayFromZero', () => {
  it('matches PostgreSQL numeric rounding', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4999)).toBe(2);
  });
});
