/**
 * Reference implementation of Wayfare's stay-pricing rules.
 *
 * The authoritative calculation runs in PostgreSQL (`quote_stay`, see
 * apps/api/src/db/migrations) so that filtering, sorting and the offer
 * comparison always agree. This module mirrors it exactly; an integration test
 * asserts parity for every seeded offer.
 *
 * Rules:
 * - Friday and Saturday nights use the weekend rate when one is set.
 * - Fees are charged once per stay.
 * - VAT is computed once on (room subtotal + fees), never per night.
 * - If prices include VAT, the VAT figure is the included portion and is NOT added again.
 */

import { dayOfWeek, addDays, diffDays } from './dates';

export interface OfferRates {
  nightlyRateCents: number;
  weekendNightlyRateCents: number | null;
  feePerStayCents: number;
  taxRateBps: number;
  pricesIncludeTax: boolean;
}

export interface StayPrice {
  nights: number;
  weekendNights: number;
  roomSubtotalCents: number;
  feesCents: number;
  taxCents: number;
  totalCents: number;
  averageNightlyCents: number;
}

const FRIDAY = 5;
const SATURDAY = 6;

/** Round half away from zero, matching PostgreSQL's `round(numeric)`. */
export function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function isWeekendNight(date: string): boolean {
  const dow = dayOfWeek(date);
  return dow === FRIDAY || dow === SATURDAY;
}

export function countWeekendNights(checkIn: string, checkOut: string): number {
  const nights = diffDays(checkIn, checkOut);
  let count = 0;
  for (let i = 0; i < nights; i += 1) {
    if (isWeekendNight(addDays(checkIn, i))) count += 1;
  }
  return count;
}

export function calculateStayPrice(rates: OfferRates, checkIn: string, checkOut: string): StayPrice {
  const nights = diffDays(checkIn, checkOut);
  if (nights < 1) {
    throw new RangeError('A stay must be at least one night.');
  }
  assertNonNegativeInteger(rates.nightlyRateCents, 'nightlyRateCents');
  assertNonNegativeInteger(rates.feePerStayCents, 'feePerStayCents');
  assertNonNegativeInteger(rates.taxRateBps, 'taxRateBps');
  if (rates.weekendNightlyRateCents !== null) {
    assertNonNegativeInteger(rates.weekendNightlyRateCents, 'weekendNightlyRateCents');
  }

  const weekendNights = countWeekendNights(checkIn, checkOut);
  const weekendRate = rates.weekendNightlyRateCents ?? rates.nightlyRateCents;
  const roomSubtotalCents =
    (nights - weekendNights) * rates.nightlyRateCents + weekendNights * weekendRate;
  const feesCents = rates.feePerStayCents;
  const taxable = roomSubtotalCents + feesCents;

  const taxCents = rates.pricesIncludeTax
    ? roundHalfAwayFromZero((taxable * rates.taxRateBps) / (10_000 + rates.taxRateBps))
    : roundHalfAwayFromZero((taxable * rates.taxRateBps) / 10_000);
  const totalCents = rates.pricesIncludeTax ? taxable : taxable + taxCents;

  return {
    nights,
    weekendNights,
    roomSubtotalCents,
    feesCents,
    taxCents,
    totalCents,
    averageNightlyCents: roundHalfAwayFromZero(totalCents / nights),
  };
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (got ${value}).`);
  }
}

/** Threshold used when choosing the recommended offer (see API spec). */
export const RECOMMENDED_FREE_CANCELLATION_TOLERANCE = 0.1;
