import type {
  CancellationPolicy,
  DataStatus,
  MealPlan,
  PropertyDetail,
  ProviderKind,
} from '@wayfare/shared';
import type { Pool } from '../../db/pool';

export async function findPropertyBySlug(pool: Pool, slug: string): Promise<PropertyDetail | null> {
  const { rows } = await pool.query<PropertyDetail>(
    `SELECT p.id, p.slug, p.name,
            json_build_object('slug', pt.slug, 'name', pt.name) AS "propertyType",
            p.summary, p.description,
            json_build_object('slug', d.slug, 'name', d.name, 'province', d.province) AS destination,
            p.suburb, p.street_address AS "streetAddress",
            ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
            json_build_object('from', to_char(p.check_in_from, 'HH24:MI'),
                              'until', to_char(p.check_in_until, 'HH24:MI')) AS "checkIn",
            json_build_object('until', to_char(p.check_out_until, 'HH24:MI')) AS "checkOut",
            (SELECT coalesce(json_agg(json_build_object('url', i.url, 'alt', i.alt_text, 'credit', CASE WHEN i.credit_url IS NULL THEN NULL ELSE i.credit END,
                                                'creditUrl', i.credit_url) ORDER BY i.sort_order), '[]'::json)
               FROM property_images i WHERE i.property_id = p.id) AS images,
            (SELECT coalesce(json_agg(json_build_object('slug', a.slug, 'name', a.name, 'category', a.category,
                                                'verified', pa.is_verified)
                                      ORDER BY a.sort_order), '[]'::json)
               FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id
              WHERE pa.property_id = p.id) AS amenities,
            (SELECT coalesce(json_agg(json_build_object(
                      'id', r.id, 'name', r.name, 'description', r.description, 'maxGuests', r.max_guests,
                      'bedrooms', r.bedrooms, 'bathrooms', r.bathrooms, 'beds', r.beds) ORDER BY r.id), '[]'::json)
               FROM room_types r WHERE r.property_id = p.id) AS "roomTypes",
            CASE WHEN rs.property_id IS NULL THEN NULL
                 ELSE json_build_object('score', rs.score, 'count', rs.rating_count, 'label', rs.source_label)
            END AS rating,
            (SELECT coalesce(json_agg(json_build_object('slug', pr.slug, 'name', pr.name, 'kind', pr.kind)
                                      ORDER BY pr.id), '[]'::json)
               FROM provider_listings pl JOIN providers pr ON pr.id = pl.provider_id
              WHERE pl.property_id = p.id) AS providers,
            json_build_object('code', ds.code, 'name', ds.name, 'kind', ds.kind) AS "dataSource",
            p.is_demo AS "isDemo",
            CASE WHEN p.osm_id IS NULL THEN NULL
                 ELSE json_build_object('websiteUrl', p.website_url, 'phone', p.phone, 'stars', p.stars,
                                        'osmUrl', 'https://www.openstreetmap.org/' || p.osm_type || '/' || p.osm_id)
            END AS "realPlace"
     FROM properties p
     JOIN property_types pt ON pt.id = p.property_type_id
     JOIN destinations d ON d.id = p.destination_id
     JOIN data_sources ds ON ds.id = p.data_source_id
     LEFT JOIN rating_summaries rs ON rs.property_id = p.id
     WHERE p.slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

export interface OfferRow {
  id: number;
  roomTypeId: number;
  roomTypeName: string;
  maxGuests: number;
  bedrooms: number;
  providerSlug: string;
  providerName: string;
  providerKind: ProviderKind;
  mealPlan: MealPlan;
  cancellationPolicy: CancellationPolicy;
  freeCancellationHours: number | null;
  minNights: number;
  feeLabel: string | null;
  taxRateBps: number;
  pricesIncludeTax: boolean;
  dataStatus: DataStatus;
  lastCheckedAt: Date;
  exampleUrl: string | null;
  nights: number;
  weekendNights: number;
  roomSubtotalCents: number;
  feesCents: number;
  taxCents: number;
  totalCents: number;
  tooSmall: boolean;
  belowMinNights: boolean;
  booked: boolean;
}

/** Every active offer for the property, priced for the stay, with its eligibility flags. */
export async function findOffersForStay(
  pool: Pool,
  propertyId: number,
  stay: { checkIn: string; checkOut: string; guests: number; nights: number },
): Promise<OfferRow[]> {
  const { rows } = await pool.query<OfferRow>(
    `SELECT o.id, rt.id AS "roomTypeId", rt.name AS "roomTypeName", rt.max_guests AS "maxGuests", rt.bedrooms,
            pr.slug AS "providerSlug", pr.name AS "providerName", pr.kind AS "providerKind",
            o.meal_plan AS "mealPlan", o.cancellation_policy AS "cancellationPolicy",
            o.free_cancellation_hours AS "freeCancellationHours", o.min_nights AS "minNights",
            o.fee_label AS "feeLabel", o.tax_rate_bps AS "taxRateBps",
            o.prices_include_tax AS "pricesIncludeTax", o.data_status AS "dataStatus",
            o.last_checked_at AS "lastCheckedAt", o.example_url AS "exampleUrl",
            q.nights, q.weekend_nights AS "weekendNights", q.room_subtotal_cents AS "roomSubtotalCents",
            q.fees_cents AS "feesCents", q.tax_cents AS "taxCents", q.total_cents AS "totalCents",
            rt.max_guests < $4 AS "tooSmall",
            o.min_nights > $5 AS "belowMinNights",
            EXISTS (SELECT 1 FROM room_availability_blocks b
                     WHERE b.room_type_id = rt.id
                       AND b.blocked && daterange($2::date, $3::date, '[)')) AS booked
     FROM offers o
     JOIN room_types rt ON rt.id = o.room_type_id
     JOIN provider_listings pl ON pl.id = o.provider_listing_id
     JOIN providers pr ON pr.id = pl.provider_id
     CROSS JOIN LATERAL quote_stay(o.nightly_rate_cents, o.weekend_nightly_rate_cents, o.fee_per_stay_cents,
                                   o.tax_rate_bps, o.prices_include_tax, $2::date, $3::date) q
     WHERE o.property_id = $1 AND o.status = 'active'
     ORDER BY rt.id, q.total_cents, o.id`,
    [propertyId, stay.checkIn, stay.checkOut, stay.guests, stay.nights],
  );
  return rows;
}

export async function findPropertyIdBySlug(pool: Pool, slug: string): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM properties WHERE slug = $1', [
    slug,
  ]);
  return rows[0]?.id ?? null;
}

export interface CalendarRow {
  date: string;
  totalCents: number | null;
  offerCount: number;
}

/**
 * Prices every check-in date in [from, to] for a stay of `nights` nights in one
 * statement: dates × active offers that fit the group and minimum stay, minus
 * rooms booked over that stay, priced by the same `quote_stay` function as the
 * offers endpoint. Returns the cheapest total per date (null when nothing fits).
 */
export async function findCalendar(
  pool: Pool,
  propertyId: number,
  range: { from: string; to: string; nights: number; guests: number },
): Promise<CalendarRow[]> {
  const { rows } = await pool.query<CalendarRow>(
    `WITH days AS (
       SELECT d::date AS check_in, (d + make_interval(days => $4))::date AS check_out
       FROM generate_series($2::date, $3::date, interval '1 day') AS d
     ),
     priced AS (
       SELECT days.check_in, min(q.total_cents) AS total_cents, count(*)::int AS offer_count
       FROM days
       JOIN offers o ON o.property_id = $1 AND o.status = 'active' AND o.min_nights <= $4
       JOIN room_types rt ON rt.id = o.room_type_id AND rt.max_guests >= $5
       CROSS JOIN LATERAL quote_stay(o.nightly_rate_cents, o.weekend_nightly_rate_cents, o.fee_per_stay_cents,
                                     o.tax_rate_bps, o.prices_include_tax, days.check_in, days.check_out) q
       WHERE NOT EXISTS (
         SELECT 1 FROM room_availability_blocks b
         WHERE b.room_type_id = o.room_type_id
           AND b.blocked && daterange(days.check_in, days.check_out, '[)')
       )
       GROUP BY days.check_in
     )
     SELECT to_char(days.check_in, 'YYYY-MM-DD') AS date,
            priced.total_cents AS "totalCents",
            coalesce(priced.offer_count, 0) AS "offerCount"
     FROM days LEFT JOIN priced USING (check_in)
     ORDER BY days.check_in`,
    [propertyId, range.from, range.to, range.nights, range.guests],
  );
  return rows;
}
