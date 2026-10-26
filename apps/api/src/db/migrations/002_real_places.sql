-- Real places from OpenStreetMap, alongside the synthetic dataset.
-- Facts about the place (name, location, website, phone, stars) come from OSM;
-- rooms, offers, prices and availability stay simulated and are labelled so.

ALTER TABLE data_sources DROP CONSTRAINT data_sources_kind_check;
ALTER TABLE data_sources ADD CONSTRAINT data_sources_kind_check
  CHECK (kind IN ('synthetic', 'open_data', 'partner_api', 'manual'));

ALTER TABLE properties
  ADD COLUMN osm_type    text CHECK (osm_type IN ('node', 'way', 'relation')),
  ADD COLUMN osm_id      bigint CHECK (osm_id > 0),
  -- Only plain web links; the seed also rejects IP hosts, credentials and localhost.
  ADD COLUMN website_url text CHECK (website_url ~ '^https?://[^\s/@]+\.[^\s/@]+(/\S*)?$' AND length(website_url) <= 300),
  ADD COLUMN phone       text CHECK (phone ~ '^[+0-9 ()-]{9,25}$'),
  ADD COLUMN stars       smallint CHECK (stars BETWEEN 1 AND 5),
  ADD CONSTRAINT properties_osm_pair_check CHECK ((osm_type IS NULL) = (osm_id IS NULL));
CREATE UNIQUE INDEX properties_osm_uq ON properties (osm_type, osm_id) WHERE osm_id IS NOT NULL;

-- Real chains have several branches with the same name in one city, so the
-- per-destination name rule applies to fictional properties only.
DROP INDEX properties_destination_name_uq;
CREATE UNIQUE INDEX properties_destination_name_uq ON properties (destination_id, lower(name))
  WHERE osm_id IS NULL;

ALTER TABLE property_images
  ADD COLUMN credit_url text CHECK (credit_url ~ '^https://commons\.wikimedia\.org/'),
  ADD COLUMN licence    text CHECK (length(licence) <= 40);

-- Amenities confirmed by the place's OpenStreetMap tags (the rest are simulated).
ALTER TABLE property_amenities ADD COLUMN is_verified boolean NOT NULL DEFAULT false;

ALTER TABLE destinations
  ADD COLUMN image_credit     text CHECK (length(image_credit) <= 200),
  ADD COLUMN image_credit_url text CHECK (image_credit_url ~ '^https://commons\.wikimedia\.org/');
