/**
 * The search query. One SQL pipeline (CTEs) does filtering, availability,
 * pricing, ranking and pagination in the database — see docs/ARCHITECTURE.md §6.
 */
import type { MapPoint, SearchResultItem, SortOption } from '@wayfare/shared';
import type { Pool } from '../../db/pool';
import { escapeLike, SqlParams } from '../../lib/sql';

export interface SearchCriteria {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  reference: { lat: number; lng: number; radiusKm: number } | null;
  q?: string;
  minBedrooms?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  typeSlugs: string[];
  amenitySlugs: string[];
  minRating?: number;
  freeCancellation: boolean;
  sort: SortOption;
}

export const MAP_POINT_LIMIT = 500;

// Whitelisted ORDER BY expressions. Never built from user input.
const SORT_SQL: Record<SortOption, string> = {
  recommended: 'r.recommended_score DESC',
  price_asc: 'r.average_nightly_cents ASC',
  price_desc: 'r.average_nightly_cents DESC',
  rating_desc: 'r.rating_score DESC NULLS LAST, r.rating_count DESC NULLS LAST',
  distance_asc: 'r.distance_m ASC NULLS LAST',
};

function buildRankedCte(criteria: SearchCriteria, params: SqlParams): string {
  const checkIn = params.add(criteria.checkIn);
  const checkOut = params.add(criteria.checkOut);

  const candidateWhere: string[] = [];
  let distanceExpr = 'NULL::float8';
  if (criteria.reference) {
    const point = `ST_SetSRID(ST_MakePoint(${params.add(criteria.reference.lng)}, ${params.add(
      criteria.reference.lat,
    )}), 4326)::geography`;
    distanceExpr = `ST_Distance(p.location, ${point})`;
    candidateWhere.push(`ST_DWithin(p.location, ${point}, ${params.add(criteria.reference.radiusKm * 1000)})`);
  }
  if (criteria.typeSlugs.length > 0) {
    candidateWhere.push(
      `p.property_type_id IN (SELECT id FROM property_types WHERE slug = ANY(${params.add(criteria.typeSlugs)}::text[]))`,
    );
  }
  if (criteria.amenitySlugs.length > 0) {
    // "Has all of": the number of matching amenities must equal the number requested.
    candidateWhere.push(`(
      SELECT count(*) FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id
      WHERE pa.property_id = p.id AND a.slug = ANY(${params.add(criteria.amenitySlugs)}::text[])
    ) = ${params.add(criteria.amenitySlugs.length)}`);
  }
  if (criteria.minRating !== undefined) {
    candidateWhere.push(`rs.score >= ${params.add(criteria.minRating)}`);
  }
  if (criteria.q) {
    candidateWhere.push(`p.name ILIKE ${params.add(`%${escapeLike(criteria.q)}%`)}`);
  }

  const offerWhere = [
    `o.status = 'active'`,
    `rt.max_guests >= ${params.add(criteria.guests)}`,
    `o.min_nights <= ${params.add(criteria.nights)}`,
    `NOT EXISTS (
       SELECT 1 FROM room_availability_blocks b
       WHERE b.room_type_id = o.room_type_id
         AND b.blocked && daterange(${checkIn}::date, ${checkOut}::date, '[)')
     )`,
  ];
  if (criteria.minBedrooms !== undefined) offerWhere.push(`rt.bedrooms >= ${params.add(criteria.minBedrooms)}`);
  if (criteria.freeCancellation) offerWhere.push(`o.cancellation_policy = 'free'`);

  const priceWhere: string[] = [];
  if (criteria.minPriceCents !== undefined) {
    priceWhere.push(`f.average_nightly_cents >= ${params.add(criteria.minPriceCents)}`);
  }
  if (criteria.maxPriceCents !== undefined) {
    priceWhere.push(`f.average_nightly_cents <= ${params.add(criteria.maxPriceCents)}`);
  }

  // With a reference point, distance contributes to the recommended score.
  const recommended = criteria.reference
    ? `0.45 * coalesce(f.rating_score, 6) / 10
       + 0.35 * (1 - percent_rank() OVER (ORDER BY f.average_nightly_cents))
       + 0.20 * (1 - percent_rank() OVER (ORDER BY f.distance_m))`
    : `0.55 * coalesce(f.rating_score, 6) / 10
       + 0.45 * (1 - percent_rank() OVER (ORDER BY f.average_nightly_cents))`;

  return `
    candidates AS (
      SELECT p.id, ${distanceExpr} AS distance_m, rs.score AS rating_score, rs.rating_count
      FROM properties p
      LEFT JOIN rating_summaries rs ON rs.property_id = p.id
      ${candidateWhere.length ? `WHERE ${candidateWhere.join('\n        AND ')}` : ''}
    ),
    eligible AS (
      SELECT o.id AS offer_id, o.property_id, pl.provider_id, pr.name AS provider_name,
             rt.name AS room_type_name, o.cancellation_policy, o.meal_plan, o.data_status,
             q.nights, q.total_cents
      FROM offers o
      JOIN candidates c ON c.id = o.property_id
      JOIN room_types rt ON rt.id = o.room_type_id
      JOIN provider_listings pl ON pl.id = o.provider_listing_id
      JOIN providers pr ON pr.id = pl.provider_id
      CROSS JOIN LATERAL quote_stay(o.nightly_rate_cents, o.weekend_nightly_rate_cents, o.fee_per_stay_cents,
                                    o.tax_rate_bps, o.prices_include_tax, ${checkIn}::date, ${checkOut}::date) q
      WHERE ${offerWhere.join('\n        AND ')}
    ),
    offer_stats AS (
      SELECT property_id, count(*)::int AS offer_count, count(DISTINCT provider_id)::int AS provider_count
      FROM eligible GROUP BY property_id
    ),
    best AS (
      SELECT DISTINCT ON (property_id) *
      FROM eligible
      ORDER BY property_id, total_cents, offer_id
    ),
    filtered AS (
      SELECT c.id, c.distance_m, c.rating_score, c.rating_count,
             b.offer_id, b.provider_name, b.room_type_name, b.cancellation_policy, b.meal_plan,
             b.data_status, b.nights, b.total_cents,
             round(b.total_cents::numeric / b.nights)::bigint AS average_nightly_cents,
             s.offer_count, s.provider_count
      FROM candidates c
      JOIN best b ON b.property_id = c.id
      JOIN offer_stats s ON s.property_id = c.id
    ),
    ranked AS (
      SELECT f.*, count(*) OVER () AS total_items, ${recommended} AS recommended_score
      FROM filtered f
      ${priceWhere.length ? `WHERE ${priceWhere.join(' AND ')}` : ''}
    ),
    ordered AS (
      SELECT r.*, row_number() OVER (ORDER BY ${SORT_SQL[criteria.sort]}, r.id) AS position
      FROM ranked r
    )`;
}

interface SearchRow extends Omit<SearchResultItem, 'bestOffer'> {
  totalItems: number;
  bestOffer: SearchResultItem['bestOffer'];
}

export async function searchProperties(
  pool: Pool,
  criteria: SearchCriteria,
  page: { limit: number; offset: number },
): Promise<{ items: SearchResultItem[]; totalItems: number; mapPoints: MapPoint[]; mapPointsTruncated: boolean }> {
  const params = new SqlParams();
  const cte = buildRankedCte(criteria, params);

  const pageParams = params.clone();
  const pageSql = `
    WITH ${cte}
    SELECT o.id, p.slug, p.name,
           json_build_object('slug', pt.slug, 'name', pt.name) AS "propertyType",
           d.name AS "destinationName", p.suburb, d.province,
           ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
           CASE WHEN o.distance_m IS NULL THEN NULL ELSE round((o.distance_m / 1000)::numeric, 2) END AS "distanceKm",
           CASE WHEN o.rating_score IS NULL THEN NULL
                ELSE json_build_object('score', o.rating_score, 'count', o.rating_count, 'label', 'Synthetic demo score')
           END AS rating,
           (SELECT json_build_object('url', i.url, 'alt', i.alt_text) FROM property_images i
             WHERE i.property_id = p.id ORDER BY i.sort_order LIMIT 1) AS "coverImage",
           (SELECT coalesce(json_agg(json_build_object('slug', k.slug, 'name', k.name)), '[]'::json) FROM (
              SELECT a.slug, a.name FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id
              WHERE pa.property_id = p.id ORDER BY a.is_essential DESC, a.sort_order LIMIT 4) k) AS "keyAmenities",
           json_build_object(
             'offerId', o.offer_id, 'providerName', o.provider_name, 'roomTypeName', o.room_type_name,
             'nights', o.nights, 'totalCents', o.total_cents, 'averageNightlyCents', o.average_nightly_cents,
             'cancellationPolicy', o.cancellation_policy, 'mealPlan', o.meal_plan, 'dataStatus', o.data_status
           ) AS "bestOffer",
           o.offer_count AS "offerCount", o.provider_count AS "providerCount",
           (SELECT max(max_guests) FROM room_types WHERE property_id = p.id)::int AS "maxGuests",
           o.total_items::int AS "totalItems"
    FROM ordered o
    JOIN properties p ON p.id = o.id
    JOIN property_types pt ON pt.id = p.property_type_id
    JOIN destinations d ON d.id = p.destination_id
    WHERE o.position > ${pageParams.add(page.offset)} AND o.position <= ${pageParams.add(page.offset + page.limit)}
    ORDER BY o.position`;

  const mapParams = params.clone();
  const mapSql = `
    WITH ${cte}
    SELECT o.id, p.slug, p.name,
           ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
           o.average_nightly_cents AS "averageNightlyCents",
           o.total_items::int AS "totalItems"
    FROM ordered o JOIN properties p ON p.id = o.id
    WHERE o.position <= ${mapParams.add(MAP_POINT_LIMIT + 1)}
    ORDER BY o.position`;

  const [pageResult, mapResult] = await Promise.all([
    pool.query<SearchRow>(pageSql, pageParams.values),
    pool.query<MapPoint & { totalItems: number }>(mapSql, mapParams.values),
  ]);

  // The page may be beyond the last result; the map query still knows the total.
  const totalItems = mapResult.rows[0]?.totalItems ?? 0;
  const items = pageResult.rows.map(({ totalItems: _t, ...item }) => item);
  const mapPoints = mapResult.rows.slice(0, MAP_POINT_LIMIT).map(({ totalItems: _t, ...point }) => point);
  return { items, totalItems, mapPoints, mapPointsTruncated: mapResult.rows.length > MAP_POINT_LIMIT };
}
