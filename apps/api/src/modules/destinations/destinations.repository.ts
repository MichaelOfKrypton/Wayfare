import type { Destination } from '@wayfare/shared';
import type { Pool } from '../../db/pool';
import { escapeLike, SqlParams } from '../../lib/sql';

const SELECT_DESTINATION = `
  SELECT d.slug, d.name, d.kind, d.province, parent.name AS "parentName",
         ST_Y(d.location::geometry) AS lat, ST_X(d.location::geometry) AS lng,
         d.search_radius_km AS "searchRadiusKm",
         (SELECT count(*)::int FROM properties p
           WHERE ST_DWithin(p.location, d.location, d.search_radius_km * 1000)) AS "propertyCount",
         d.summary, d.image_url AS "imageUrl"
  FROM destinations d
  LEFT JOIN destinations parent ON parent.id = d.parent_id`;

// Cities and towns before suburbs and landmarks when relevance ties.
const KIND_ORDER = `CASE d.kind WHEN 'city' THEN 0 WHEN 'town' THEN 1 WHEN 'region' THEN 2 WHEN 'suburb' THEN 3 ELSE 4 END`;

export async function searchDestinations(
  pool: Pool,
  options: { q?: string; featured?: boolean; limit: number },
): Promise<Destination[]> {
  const params = new SqlParams();
  const where: string[] = [];
  let orderBy = `d.sort_order, d.name`;

  if (options.featured) where.push('d.is_featured');
  if (options.q) {
    const q = params.add(options.q);
    const prefix = params.add(`${escapeLike(options.q)}%`);
    const contains = params.add(`%${escapeLike(options.q)}%`);
    // Substring match catches "waterfront" → "V&A Waterfront"; word similarity tolerates typos.
    where.push(`(d.name ILIKE ${contains} OR word_similarity(${q}, d.name) >= 0.45)`);
    orderBy = `CASE WHEN d.name ILIKE ${prefix} THEN 0 WHEN d.name ILIKE ${contains} THEN 1 ELSE 2 END,
               word_similarity(${q}, d.name) DESC, ${KIND_ORDER}, d.sort_order, d.name`;
  }
  const sql = `${SELECT_DESTINATION}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy}
    LIMIT ${params.add(options.limit)}`;
  const { rows } = await pool.query<Destination>(sql, params.values);
  return rows;
}

export async function findDestinationBySlug(pool: Pool, slug: string): Promise<Destination | null> {
  const { rows } = await pool.query<Destination>(`${SELECT_DESTINATION} WHERE d.slug = $1`, [slug]);
  return rows[0] ?? null;
}
