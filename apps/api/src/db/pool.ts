import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of local-time Date objects.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// int8 (bigint) → number. Our bigints are money sums in cents, far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
// numeric → number (scores, radii, bathrooms; all small, fixed-scale values).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

export type Pool = pg.Pool;

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Guard against runaway queries; search should take milliseconds.
    statement_timeout: 10_000,
    application_name: 'wayfare-api',
  });
}
