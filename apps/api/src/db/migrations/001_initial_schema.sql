-- 001 — Initial Wayfare schema. See docs/DATABASE_DESIGN.md for the rationale.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Shared trigger: keep updated_at current on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- South Africa bounding box (mirrors packages/shared/src/geo.ts SA_BOUNDS).
CREATE OR REPLACE FUNCTION is_in_south_africa(p geography) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT ST_Y(p::geometry) BETWEEN -35.5 AND -21.5
     AND ST_X(p::geometry) BETWEEN 16 AND 33.5;
$$;

-- ---------------------------------------------------------------------------
-- Provenance
-- ---------------------------------------------------------------------------
CREATE TABLE data_sources (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('synthetic', 'partner_api', 'manual')),
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Places
-- ---------------------------------------------------------------------------
CREATE TABLE destinations (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  kind             text NOT NULL CHECK (kind IN ('city', 'town', 'suburb', 'landmark', 'region')),
  province         text NOT NULL CHECK (province IN (
                     'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
                     'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape')),
  parent_id        integer REFERENCES destinations (id) ON DELETE RESTRICT,
  location         geography(Point, 4326) NOT NULL CHECK (is_in_south_africa(location)),
  search_radius_km numeric(5, 1) NOT NULL DEFAULT 15 CHECK (search_radius_km > 0 AND search_radius_km <= 200),
  is_featured      boolean NOT NULL DEFAULT false,
  sort_order       smallint NOT NULL DEFAULT 0,
  summary          text,
  image_url        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX destinations_location_gix ON destinations USING gist (location);
CREATE INDEX destinations_name_trgm_idx ON destinations USING gin (name gin_trgm_ops);
CREATE INDEX destinations_parent_idx ON destinations (parent_id);
CREATE TRIGGER destinations_updated_at BEFORE UPDATE ON destinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Classification
-- ---------------------------------------------------------------------------
CREATE TABLE property_types (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL UNIQUE,
  description text NOT NULL,
  sort_order  smallint NOT NULL DEFAULT 0
);

CREATE TABLE amenities (
  id           smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL UNIQUE,
  category     text NOT NULL CHECK (category IN
                 ('essentials', 'comfort', 'outdoor', 'family', 'accessibility', 'services')),
  is_essential boolean NOT NULL DEFAULT false,
  sort_order   smallint NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------
CREATE TABLE properties (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  property_type_id smallint NOT NULL REFERENCES property_types (id),
  destination_id   integer NOT NULL REFERENCES destinations (id),
  street_address   text,
  suburb           text,
  location         geography(Point, 4326) NOT NULL CHECK (is_in_south_africa(location)),
  summary          text NOT NULL,
  description      text NOT NULL,
  check_in_from    time,
  check_in_until   time,
  check_out_until  time,
  is_demo          boolean NOT NULL DEFAULT true,
  data_source_id   smallint NOT NULL REFERENCES data_sources (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (check_in_until IS NULL OR check_in_from IS NULL OR check_in_until > check_in_from)
);
CREATE UNIQUE INDEX properties_destination_name_uq ON properties (destination_id, lower(name));
CREATE INDEX properties_location_gix ON properties USING gist (location);
CREATE INDEX properties_type_idx ON properties (property_type_id);
CREATE INDEX properties_destination_idx ON properties (destination_id);
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE property_images (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id integer NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt_text    text NOT NULL CHECK (length(alt_text) > 0),
  credit      text,
  sort_order  smallint NOT NULL DEFAULT 0,
  UNIQUE (property_id, sort_order)
);

CREATE TABLE property_amenities (
  property_id integer NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
  amenity_id  smallint NOT NULL REFERENCES amenities (id) ON DELETE RESTRICT,
  PRIMARY KEY (property_id, amenity_id)
);
CREATE INDEX property_amenities_amenity_idx ON property_amenities (amenity_id);

CREATE TABLE room_types (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id integer NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  max_guests  smallint NOT NULL CHECK (max_guests BETWEEN 1 AND 20),
  bedrooms    smallint NOT NULL CHECK (bedrooms BETWEEN 0 AND 10),
  bathrooms   numeric(3, 1) NOT NULL CHECK (bathrooms >= 0),
  beds        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, name),
  UNIQUE (id, property_id) -- target of the composite FK on offers
);
CREATE TRIGGER room_types_updated_at BEFORE UPDATE ON room_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE room_availability_blocks (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_type_id integer NOT NULL REFERENCES room_types (id) ON DELETE CASCADE,
  blocked      daterange NOT NULL CHECK (NOT isempty(blocked) AND lower_inc(blocked) AND NOT upper_inc(blocked)),
  reason       text NOT NULL DEFAULT 'simulated_booking',
  -- No overlapping blocks for the same room type; the GiST index also serves availability lookups.
  EXCLUDE USING gist (room_type_id WITH =, blocked WITH &&)
);

CREATE TABLE rating_summaries (
  property_id    integer PRIMARY KEY REFERENCES properties (id) ON DELETE CASCADE,
  score          numeric(3, 1) NOT NULL CHECK (score BETWEEN 0 AND 10),
  rating_count   integer NOT NULL CHECK (rating_count >= 0),
  source_label   text NOT NULL,
  data_source_id smallint NOT NULL REFERENCES data_sources (id),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Providers and offers
-- ---------------------------------------------------------------------------
CREATE TABLE providers (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL UNIQUE,
  kind        text NOT NULL CHECK (kind IN ('ota', 'direct', 'metasearch')),
  description text NOT NULL,
  website_url text,
  is_demo     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One provider's listing of one property: the anchor for cross-provider matching.
CREATE TABLE provider_listings (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id  integer NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
  provider_id  smallint NOT NULL REFERENCES providers (id) ON DELETE RESTRICT,
  external_ref text NOT NULL,
  listing_url  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, provider_id),
  UNIQUE (provider_id, external_ref),
  UNIQUE (id, property_id) -- target of the composite FK on offers
);

CREATE TABLE offers (
  id                         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id                integer NOT NULL,
  provider_listing_id        integer NOT NULL,
  room_type_id               integer NOT NULL,
  meal_plan                  text NOT NULL CHECK (meal_plan IN
                               ('room_only', 'self_catering', 'breakfast', 'half_board', 'full_board')),
  cancellation_policy        text NOT NULL CHECK (cancellation_policy IN ('free', 'partial', 'non_refundable')),
  free_cancellation_hours    smallint CHECK (free_cancellation_hours BETWEEN 0 AND 720),
  nightly_rate_cents         integer NOT NULL CHECK (nightly_rate_cents > 0),
  weekend_nightly_rate_cents integer CHECK (weekend_nightly_rate_cents > 0),
  fee_per_stay_cents         integer NOT NULL DEFAULT 0 CHECK (fee_per_stay_cents >= 0),
  fee_label                  text,
  tax_rate_bps               integer NOT NULL DEFAULT 1500 CHECK (tax_rate_bps BETWEEN 0 AND 5000),
  prices_include_tax         boolean NOT NULL DEFAULT true,
  min_nights                 smallint NOT NULL DEFAULT 1 CHECK (min_nights BETWEEN 1 AND 30),
  currency                   char(3) NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status                     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  data_status                text NOT NULL DEFAULT 'simulated' CHECK (data_status IN ('simulated', 'cached', 'live')),
  last_checked_at            timestamptz NOT NULL,
  example_url                text,
  data_source_id             smallint NOT NULL REFERENCES data_sources (id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  -- Both parents must belong to the same property.
  FOREIGN KEY (room_type_id, property_id) REFERENCES room_types (id, property_id) ON DELETE CASCADE,
  FOREIGN KEY (provider_listing_id, property_id) REFERENCES provider_listings (id, property_id) ON DELETE CASCADE,
  UNIQUE (provider_listing_id, room_type_id, meal_plan, cancellation_policy),
  -- Free cancellation must say until when; other policies must not.
  CHECK ((cancellation_policy = 'free') = (free_cancellation_hours IS NOT NULL)),
  CHECK (fee_per_stay_cents = 0 OR fee_label IS NOT NULL)
);
CREATE INDEX offers_property_active_idx ON offers (property_id) WHERE status = 'active';
CREATE INDEX offers_room_type_idx ON offers (room_type_id);
CREATE INDEX offers_listing_idx ON offers (provider_listing_id);
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Stay pricing — the single source of truth (mirrored by packages/shared/src/pricing.ts).
-- Weekend nights are Friday (dow 5) and Saturday (dow 6). VAT is computed once per stay.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION quote_stay(
  p_nightly_cents  integer,
  p_weekend_cents  integer,
  p_fee_cents      integer,
  p_tax_bps        integer,
  p_includes_tax   boolean,
  p_check_in       date,
  p_check_out      date
) RETURNS TABLE (
  nights              integer,
  weekend_nights      integer,
  room_subtotal_cents bigint,
  fees_cents          bigint,
  tax_cents           bigint,
  total_cents         bigint
)
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  WITH n AS (
    SELECT (p_check_out - p_check_in)::integer AS nights,
           count(*) FILTER (WHERE extract(isodow FROM d) IN (5, 6))::integer AS weekend_nights
    FROM generate_series(p_check_in, p_check_out - 1, interval '1 day') AS d
  ),
  s AS (
    SELECT nights, weekend_nights,
           ((nights - weekend_nights)::bigint * p_nightly_cents
             + weekend_nights::bigint * coalesce(p_weekend_cents, p_nightly_cents)) AS subtotal
    FROM n
  ),
  t AS (
    SELECT nights, weekend_nights, subtotal,
           (subtotal + p_fee_cents) AS taxable,
           CASE WHEN p_includes_tax
             THEN round((subtotal + p_fee_cents)::numeric * p_tax_bps / (10000 + p_tax_bps))
             ELSE round((subtotal + p_fee_cents)::numeric * p_tax_bps / 10000)
           END::bigint AS tax
    FROM s
  )
  SELECT nights, weekend_nights, subtotal, p_fee_cents::bigint, tax,
         CASE WHEN p_includes_tax THEN taxable ELSE taxable + tax END
  FROM t
  WHERE nights >= 1;
$$;
