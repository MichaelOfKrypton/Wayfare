/**
 * Inserts the seed dataset: real OpenStreetMap places (when a snapshot exists)
 * or the fictional set. Everything happens in one transaction using
 * set-based `INSERT … SELECT FROM jsonb_to_recordset(...)`, so the seed is
 * fast, atomic and keeps identity values in a deterministic order.
 */
import type { PoolClient } from 'pg';
import type { Pool } from '../src/db/pool';
import { AMENITIES, DATA_SOURCE, OSM_DATA_SOURCE, PROPERTY_TYPES, PROVIDERS } from './data/catalog';
import { generateDataset, type Dataset } from './generate';
import { buildOsmDataset } from './osm/dataset';
import { hasSnapshot, loadSnapshot } from './osm/snapshot';
import { validateDataset } from './validate';

export interface SeedOptions {
  /** 'synthetic' (default, used by tests), 'osm' (requires the snapshot) or 'auto'. */
  dataset?: 'auto' | 'osm' | 'synthetic';
}

export function chooseDataset(referenceDate: string, options: SeedOptions = {}): Dataset {
  const wanted = options.dataset ?? 'synthetic';
  if (wanted === 'osm' && !hasSnapshot()) {
    throw new Error('SEED_DATASET=osm but no snapshot exists. Run: npm run data:fetch-osm');
  }
  if (wanted === 'osm' || (wanted === 'auto' && hasSnapshot())) {
    return buildOsmDataset(loadSnapshot(), referenceDate);
  }
  return generateDataset(referenceDate);
}

export interface SeedSummary {
  source: Dataset['source'];
  referenceDate: string;
  counts: Record<string, number>;
}

const TABLES = [
  'room_availability_blocks',
  'offers',
  'provider_listings',
  'rating_summaries',
  'room_types',
  'property_amenities',
  'property_images',
  'properties',
  'destinations',
  'providers',
  'amenities',
  'property_types',
  'data_sources',
];

export async function seed(
  pool: Pool,
  referenceDate: string,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  const dataset = chooseDataset(referenceDate, options);
  validateDataset(dataset);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    await insertCatalog(client);
    await insertDestinations(client, dataset);
    await insertProperties(client, dataset);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Fresh tables have no planner statistics; without them PostgreSQL guesses
  // single-row results and picks slow nested-loop plans for search.
  await pool.query(`ANALYZE ${TABLES.join(', ')}`);

  const counts: Record<string, number> = {};
  for (const table of [...TABLES].reverse()) {
    const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    counts[table] = rows[0]!.n;
  }
  return { source: dataset.source, referenceDate, counts };
}

/** Sends rows as one JSON parameter; `ord` preserves array order for deterministic identities. */
async function insertJson(client: PoolClient, sql: string, rows: object[]): Promise<void> {
  await client.query(sql, [JSON.stringify(rows.map((row, ord) => ({ ...row, ord })))]);
}

async function insertCatalog(client: PoolClient): Promise<void> {
  await insertJson(
    client,
    `INSERT INTO data_sources (code, name, kind, description)
     SELECT code, name, kind, description FROM jsonb_to_recordset($1::jsonb)
       AS t(code text, name text, kind text, description text, ord int) ORDER BY ord`,
    [DATA_SOURCE, OSM_DATA_SOURCE],
  );
  await insertJson(
    client,
    `INSERT INTO property_types (slug, name, description, sort_order)
     SELECT slug, name, description, ord FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, name text, description text, ord int) ORDER BY ord`,
    PROPERTY_TYPES.map((t) => ({ ...t })),
  );
  await insertJson(
    client,
    `INSERT INTO amenities (slug, name, category, is_essential, sort_order)
     SELECT slug, name, category, coalesce("isEssential", false), ord
     FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, name text, category text, "isEssential" boolean, ord int) ORDER BY ord`,
    AMENITIES,
  );
  await insertJson(
    client,
    `INSERT INTO providers (slug, name, kind, description, is_demo)
     SELECT slug, name, kind, description, true FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, name text, kind text, description text, ord int) ORDER BY ord`,
    PROVIDERS,
  );
}

async function insertDestinations(client: PoolClient, dataset: Dataset): Promise<void> {
  await insertJson(
    client,
    `INSERT INTO destinations (slug, name, kind, province, location, search_radius_km, is_featured, sort_order,
                               summary, image_url, image_credit, image_credit_url)
     SELECT slug, name, kind, province,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            "radiusKm", coalesce(featured, false), ord, summary,
            CASE WHEN photo IS NOT NULL THEN photo->>'url'
                 WHEN theme IS NULL THEN NULL
                 ELSE '/images/demo/' || theme || '-' || (ord % 6 + 1) || '.svg' END,
            photo->>'credit', photo->>'creditUrl'
     FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, name text, kind text, province text, lat float8, lng float8,
            "radiusKm" numeric, featured boolean, summary text, theme text, photo jsonb, ord int)
     ORDER BY ord`,
    dataset.destinations,
  );
  await insertJson(
    client,
    `UPDATE destinations d SET parent_id = p.id
     FROM jsonb_to_recordset($1::jsonb) AS t(slug text, parent text)
     JOIN destinations p ON p.slug = t.parent
     WHERE d.slug = t.slug`,
    dataset.destinations.filter((d) => d.parent).map((d) => ({ slug: d.slug, parent: d.parent })),
  );
}

async function insertProperties(client: PoolClient, dataset: Dataset): Promise<void> {
  const props = dataset.properties;

  await insertJson(
    client,
    `INSERT INTO properties (slug, name, property_type_id, destination_id, suburb, street_address, location,
                             summary, description, check_in_from, check_in_until, check_out_until, is_demo,
                             data_source_id, osm_type, osm_id, website_url, phone, stars)
     SELECT t.slug, t.name, pt.id, d.id, t.suburb, t.real->>'streetAddress',
            ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326)::geography,
            t.summary, t.description, t."checkInFrom"::time, t."checkInUntil"::time, t."checkOutUntil"::time,
            t.real IS NULL,
            (SELECT id FROM data_sources
              WHERE code = CASE WHEN t.real IS NULL THEN 'synthetic-demo' ELSE 'openstreetmap' END),
            t.real->>'osmType', (t.real->>'osmId')::bigint, t.real->>'websiteUrl', t.real->>'phone',
            (t.real->>'stars')::smallint
     FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, name text, "typeSlug" text, "destinationSlug" text, suburb text, lat float8, lng float8,
            summary text, description text, "checkInFrom" text, "checkInUntil" text, "checkOutUntil" text,
            real jsonb, ord int)
     JOIN property_types pt ON pt.slug = t."typeSlug"
     JOIN destinations d ON d.slug = t."destinationSlug"
     ORDER BY t.ord`,
    props.map(
      ({
        images: _i,
        amenitySlugs: _a,
        roomTypes: _r,
        rating: _ra,
        listings: _l,
        offers: _o,
        ...rest
      }) => rest,
    ),
  );

  await insertJson(
    client,
    `INSERT INTO property_images (property_id, url, alt_text, credit, credit_url, licence, sort_order)
     SELECT p.id, t.url, t.alt, coalesce(t.credit, 'Original illustration (Wayfare demo)'),
            t."creditUrl", t.licence, t.position
     FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, url text, alt text, credit text, "creditUrl" text, licence text, position int, ord int)
     JOIN properties p ON p.slug = t.slug ORDER BY t.ord`,
    props.flatMap((p) => p.images.map((img, position) => ({ slug: p.slug, ...img, position }))),
  );

  await insertJson(
    client,
    `INSERT INTO property_amenities (property_id, amenity_id, is_verified)
     SELECT p.id, a.id, t.verified
     FROM jsonb_to_recordset($1::jsonb) AS t(slug text, amenity text, verified boolean)
     JOIN properties p ON p.slug = t.slug JOIN amenities a ON a.slug = t.amenity`,
    props.flatMap((p) =>
      p.amenitySlugs.map((amenity) => ({
        slug: p.slug,
        amenity,
        verified: p.real?.confirmedAmenitySlugs.includes(amenity) ?? false,
      })),
    ),
  );

  await insertJson(
    client,
    `INSERT INTO room_types (property_id, name, description, max_guests, bedrooms, bathrooms, beds)
     SELECT p.id, t.name, t.description, t."maxGuests", t.bedrooms, t.bathrooms, t.beds
     FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, name text, description text, "maxGuests" int, bedrooms int, bathrooms numeric, beds text, ord int)
     JOIN properties p ON p.slug = t.slug ORDER BY t.ord`,
    props.flatMap((p) => p.roomTypes.map(({ blocks: _b, ...room }) => ({ slug: p.slug, ...room }))),
  );

  await insertJson(
    client,
    `INSERT INTO room_availability_blocks (room_type_id, blocked)
     SELECT rt.id, daterange(t.start::date, t.end::date, '[)')
     FROM jsonb_to_recordset($1::jsonb) AS t(slug text, room text, start text, "end" text, ord int)
     JOIN properties p ON p.slug = t.slug
     JOIN room_types rt ON rt.property_id = p.id AND rt.name = t.room
     ORDER BY t.ord`,
    props.flatMap((p) =>
      p.roomTypes.flatMap((r) =>
        r.blocks.map(([start, end]) => ({ slug: p.slug, room: r.name, start, end })),
      ),
    ),
  );

  await insertJson(
    client,
    `INSERT INTO rating_summaries (property_id, score, rating_count, source_label, data_source_id)
     SELECT p.id, t.score, t.count, 'Synthetic demo score', (SELECT id FROM data_sources WHERE code = 'synthetic-demo')
     FROM jsonb_to_recordset($1::jsonb) AS t(slug text, score numeric, count int)
     JOIN properties p ON p.slug = t.slug`,
    props.filter((p) => p.rating).map((p) => ({ slug: p.slug, ...p.rating })),
  );

  await insertJson(
    client,
    `INSERT INTO provider_listings (property_id, provider_id, external_ref)
     SELECT p.id, pr.id, t.ref
     FROM jsonb_to_recordset($1::jsonb) AS t(slug text, provider text, ref text, ord int)
     JOIN properties p ON p.slug = t.slug JOIN providers pr ON pr.slug = t.provider
     ORDER BY t.ord`,
    props.flatMap((p) =>
      p.listings.map((l) => ({ slug: p.slug, provider: l.providerSlug, ref: l.externalRef })),
    ),
  );

  await insertJson(
    client,
    `INSERT INTO offers (property_id, provider_listing_id, room_type_id, meal_plan, cancellation_policy,
                         free_cancellation_hours, nightly_rate_cents, weekend_nightly_rate_cents,
                         fee_per_stay_cents, fee_label, tax_rate_bps, prices_include_tax, min_nights,
                         status, data_status, last_checked_at, data_source_id)
     SELECT p.id, pl.id, rt.id, t."mealPlan", t."cancellationPolicy", t."freeCancellationHours",
            t."nightlyRateCents", t."weekendNightlyRateCents", t."feePerStayCents", t."feeLabel",
            t."taxRateBps", t."pricesIncludeTax", t."minNights", t.status, 'simulated',
            t."lastCheckedAt"::timestamptz, (SELECT id FROM data_sources WHERE code = 'synthetic-demo')
     FROM jsonb_to_recordset($1::jsonb)
       AS t(slug text, "providerSlug" text, "roomTypeName" text, "mealPlan" text, "cancellationPolicy" text,
            "freeCancellationHours" int, "nightlyRateCents" int, "weekendNightlyRateCents" int,
            "feePerStayCents" int, "feeLabel" text, "taxRateBps" int, "pricesIncludeTax" boolean,
            "minNights" int, status text, "lastCheckedAt" text, ord int)
     JOIN properties p ON p.slug = t.slug
     JOIN providers pr ON pr.slug = t."providerSlug"
     JOIN provider_listings pl ON pl.property_id = p.id AND pl.provider_id = pr.id
     JOIN room_types rt ON rt.property_id = p.id AND rt.name = t."roomTypeName"
     ORDER BY t.ord`,
    props.flatMap((p) => p.offers.map((o) => ({ slug: p.slug, ...o }))),
  );
}
