import {
  formatZar,
  RECOMMENDED_FREE_CANCELLATION_TOLERANCE,
  type CancellationPolicy,
} from '@wayfare/shared';

export interface RankableOffer {
  id: number;
  totalCents: number;
  cancellationPolicy: CancellationPolicy;
}

export interface Recommendation {
  cheapestId: number;
  recommendedId: number;
  reason: string;
}

/**
 * Cheapest = lowest total (ties → lowest id, for stability).
 * Recommended = the cheapest free-cancellation offer if it costs at most 10% more
 * than the cheapest overall; otherwise the cheapest. The reason is shown to users.
 */
export function pickRecommendation(offers: RankableOffer[]): Recommendation | null {
  if (offers.length === 0) return null;
  const byPrice = [...offers].sort((a, b) => a.totalCents - b.totalCents || a.id - b.id);
  const cheapest = byPrice[0]!;
  const cheapestFree = byPrice.find((o) => o.cancellationPolicy === 'free');

  if (!cheapestFree) {
    return {
      cheapestId: cheapest.id,
      recommendedId: cheapest.id,
      reason: 'Lowest total price. No offer with free cancellation is available for these dates.',
    };
  }
  if (cheapestFree.id === cheapest.id) {
    return {
      cheapestId: cheapest.id,
      recommendedId: cheapest.id,
      reason: 'Lowest total price, and it includes free cancellation.',
    };
  }
  const extra = cheapestFree.totalCents - cheapest.totalCents;
  if (extra <= cheapest.totalCents * RECOMMENDED_FREE_CANCELLATION_TOLERANCE) {
    return {
      cheapestId: cheapest.id,
      recommendedId: cheapestFree.id,
      reason: `Free cancellation for ${formatZar(extra)} more than the cheapest offer (within 10%).`,
    };
  }
  return {
    cheapestId: cheapest.id,
    recommendedId: cheapest.id,
    reason: `Lowest total price. Free cancellation costs ${formatZar(extra)} more (over 10% extra).`,
  };
}
