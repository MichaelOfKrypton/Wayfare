import type {
  Offer,
  OfferGroup,
  OffersResponse,
  StaySummary,
  UnavailableReason,
  UnavailableRoom,
} from '@wayfare/shared';
import type { OfferRow } from './properties.repository';
import { pickRecommendation } from './recommendation';

const isEligible = (row: OfferRow) => !row.tooSmall && !row.belowMinNights && !row.booked;

/**
 * Turns priced offer rows into the comparison response: eligible offers grouped
 * by room type (cheapest group first), badges, and reasons for unavailable rooms.
 * Pure function — unit tested without a database.
 */
export function buildOffersResponse(rows: OfferRow[], stay: StaySummary): OffersResponse {
  const eligible = rows.filter(isEligible);
  const recommendation = pickRecommendation(eligible);

  const groups = new Map<number, OfferGroup>();
  for (const row of eligible) {
    let group = groups.get(row.roomTypeId);
    if (!group) {
      group = {
        roomType: { id: row.roomTypeId, name: row.roomTypeName, maxGuests: row.maxGuests, bedrooms: row.bedrooms },
        offers: [],
      };
      groups.set(row.roomTypeId, group);
    }
    group.offers.push(toOffer(row, recommendation));
  }
  for (const group of groups.values()) {
    group.offers.sort((a, b) => a.price.totalCents - b.price.totalCents || a.id - b.id);
  }
  const sortedGroups = [...groups.values()].sort(
    (a, b) => a.offers[0]!.price.totalCents - b.offers[0]!.price.totalCents || a.roomType.id - b.roomType.id,
  );

  const totals = eligible.map((r) => r.totalCents);
  return {
    stay,
    summary: {
      eligibleCount: eligible.length,
      cheapestOfferId: recommendation?.cheapestId ?? null,
      recommendedOfferId: recommendation?.recommendedId ?? null,
      recommendationReason: recommendation?.reason ?? null,
      priceSpreadCents: totals.length > 1 ? Math.max(...totals) - Math.min(...totals) : null,
    },
    groups: sortedGroups,
    unavailable: findUnavailableRooms(rows, new Set(groups.keys())),
  };
}

function toOffer(row: OfferRow, recommendation: ReturnType<typeof pickRecommendation>): Offer {
  const badges: Offer['badges'] = [];
  if (recommendation?.cheapestId === row.id) badges.push('cheapest');
  if (recommendation?.recommendedId === row.id) badges.push('recommended');
  return {
    id: row.id,
    provider: { slug: row.providerSlug, name: row.providerName, kind: row.providerKind },
    mealPlan: row.mealPlan,
    cancellationPolicy: row.cancellationPolicy,
    freeCancellationHours: row.freeCancellationHours,
    price: {
      nights: row.nights,
      weekendNights: row.weekendNights,
      roomSubtotalCents: row.roomSubtotalCents,
      feesCents: row.feesCents,
      feeLabel: row.feesCents > 0 ? row.feeLabel : null,
      taxCents: row.taxCents,
      taxRateBps: row.taxRateBps,
      taxIncluded: row.pricesIncludeTax,
      totalCents: row.totalCents,
      averageNightlyCents: Math.round(row.totalCents / row.nights),
      currency: 'ZAR',
    },
    badges,
    dataStatus: row.dataStatus,
    lastCheckedAt: new Date(row.lastCheckedAt).toISOString(),
    exampleUrl: row.exampleUrl,
  };
}

/** Room types that have offers, but none usable for this stay — with the most relevant reason. */
function findUnavailableRooms(rows: OfferRow[], availableRoomIds: Set<number>): UnavailableRoom[] {
  const byRoom = new Map<number, OfferRow[]>();
  for (const row of rows) {
    if (availableRoomIds.has(row.roomTypeId)) continue;
    byRoom.set(row.roomTypeId, [...(byRoom.get(row.roomTypeId) ?? []), row]);
  }
  return [...byRoom.values()].map((roomRows) => {
    const first = roomRows[0]!;
    let reason: UnavailableReason;
    if (first.tooSmall) reason = 'too_small';
    else if (roomRows.every((r) => r.booked)) reason = 'booked_for_dates';
    else reason = 'min_nights';
    return {
      roomTypeName: first.roomTypeName,
      reason,
      minNights: reason === 'min_nights' ? Math.min(...roomRows.map((r) => r.minNights)) : null,
    };
  });
}
