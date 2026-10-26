/** Database constraints that protect data integrity. Each case runs in a rolled-back transaction. */
import { describe, expect, it } from 'vitest';
import { useTestApp } from './helpers';

const ctx = useTestApp();

async function expectRejected(sql: string, pattern: RegExp): Promise<void> {
  const client = await ctx.pool.connect();
  try {
    await client.query('BEGIN');
    await expect(client.query(sql)).rejects.toThrow(pattern);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

describe('schema constraints', () => {
  it('rejects an offer that mixes one property’s room with another property’s listing', async () => {
    await expectRejected(
      `INSERT INTO offers (property_id, provider_listing_id, room_type_id, meal_plan, cancellation_policy,
                           nightly_rate_cents, last_checked_at, data_source_id)
       SELECT pl.property_id, pl.id, rt.id, 'room_only', 'non_refundable', 100000, now(), 1
       FROM provider_listings pl
       JOIN room_types rt ON rt.property_id <> pl.property_id
       LIMIT 1`,
      /foreign key/i,
    );
  });

  it('rejects overlapping availability blocks for the same room', async () => {
    await expectRejected(
      `INSERT INTO room_availability_blocks (room_type_id, blocked)
       SELECT room_type_id, blocked FROM room_availability_blocks LIMIT 1`,
      /conflicting key value violates exclusion constraint/i,
    );
  });

  it('rejects coordinates outside South Africa (e.g. swapped lat/lng)', async () => {
    await expectRejected(
      `UPDATE properties SET location = ST_SetSRID(ST_MakePoint(-33.9, 18.4), 4326)::geography
       WHERE id = (SELECT min(id) FROM properties)`,
      /check constraint/i,
    );
  });

  it('rejects duplicate property names within a destination (case-insensitive)', async () => {
    await expectRejected(
      `INSERT INTO properties (slug, name, property_type_id, destination_id, location, summary, description, data_source_id)
       SELECT p.slug || '-copy', upper(p.name), p.property_type_id, p.destination_id, p.location, 's', 'd', p.data_source_id
       FROM properties p LIMIT 1`,
      /properties_destination_name_uq/,
    );
  });

  it('requires a free-cancellation window only for free cancellation', async () => {
    await expectRejected(
      `UPDATE offers SET free_cancellation_hours = NULL
       WHERE id = (SELECT min(id) FROM offers WHERE cancellation_policy = 'free')`,
      /check constraint/i,
    );
  });

  it('rejects negative money values and non-ZAR currencies', async () => {
    await expectRejected(
      `UPDATE offers SET nightly_rate_cents = -1 WHERE id = 1`,
      /check constraint/i,
    );
    await expectRejected(`UPDATE offers SET currency = 'USD' WHERE id = 1`, /check constraint/i);
  });

  it('accepts only plain web links, valid phones and 1–5 stars for real places', async () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,x',
      'https://user@evil.example',
      'ftp://x.example',
    ]) {
      await expectRejected(
        `UPDATE properties SET website_url = '${url}' WHERE id = (SELECT min(id) FROM properties)`,
        /website_url/,
      );
    }
    await expectRejected(`UPDATE properties SET phone = 'call me' WHERE id = 1`, /phone/);
    await expectRejected(`UPDATE properties SET stars = 6 WHERE id = 1`, /stars/);
    await expectRejected(`UPDATE properties SET osm_id = 5 WHERE id = 1`, /osm_pair/);
  });

  it('maintains updated_at on update', async () => {
    const client = await ctx.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE properties SET updated_at = '2000-01-01' WHERE id = 1`);
      await client.query(`UPDATE properties SET summary = summary || '' WHERE id = 1`);
      const { rows } = await client.query<{ fresh: boolean }>(
        `SELECT updated_at > now() - interval '1 minute' AS fresh FROM properties WHERE id = 1`,
      );
      expect(rows[0]?.fresh).toBe(true);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
