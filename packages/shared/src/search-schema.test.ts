import { describe, expect, it } from 'vitest';
import { searchQuerySchema, searchQueryToParams } from './search-schema';

const stay = { checkIn: '2026-10-26', checkOut: '2026-10-28', guests: '2' };

function issuesOf(input: Record<string, string>) {
  const result = searchQuerySchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('searchQuerySchema', () => {
  it('parses a full query into typed values', () => {
    const result = searchQuerySchema.parse({
      ...stay,
      destination: 'cape-town',
      radiusKm: '12.5',
      minPrice: '500',
      maxPrice: '2500',
      types: 'lodge, guesthouse,lodge',
      amenities: 'wifi',
      freeCancellation: 'true',
      sort: 'price_asc',
      page: '2',
    });
    expect(result).toMatchObject({
      guests: 2,
      radiusKm: 12.5,
      minPrice: 500,
      types: ['lodge', 'guesthouse'],
      freeCancellation: true,
      page: 2,
    });
  });

  it('rejects unknown parameters (typos must not be silently ignored)', () => {
    expect(issuesOf({ ...stay, maxPrise: '100' }).join()).toMatch(/maxPrise|Unrecognized/i);
  });

  it.each([
    [{ guests: '0' }, 'guests'],
    [{ guests: '2.5' }, 'guests'],
    [{ guests: 'abc' }, 'guests'],
    [{ checkIn: '2026-13-01' }, 'checkIn'],
    [{ radiusKm: '500' }, 'radiusKm'],
    [{ sort: 'cheapest' }, 'sort'],
    [{ types: 'Not A Slug' }, 'types'],
    [{ pageSize: '100' }, 'pageSize'],
  ])('rejects invalid value %o', (override, path) => {
    expect(issuesOf({ ...stay, ...override }).join()).toContain(path);
  });

  it('enforces cross-field rules', () => {
    expect(issuesOf({ ...stay, checkOut: '2026-10-26' }).join()).toMatch(/after check-in/);
    expect(issuesOf({ ...stay, lat: '-33.9' }).join()).toMatch(/together/);
    expect(issuesOf({ ...stay, lat: '51.5', lng: '-0.1' }).join()).toMatch(/South Africa/);
    expect(issuesOf({ ...stay, destination: 'knysna', lat: '-34', lng: '23' }).join()).toMatch(
      /either a destination/,
    );
    expect(issuesOf({ ...stay, minPrice: '900', maxPrice: '100' }).join()).toMatch(/Minimum price/);
    expect(issuesOf({ ...stay, sort: 'distance_asc' }).join()).toMatch(/distance/);
  });
});

describe('searchQueryToParams', () => {
  it('produces a canonical, round-trippable query string', () => {
    const parsed = searchQuerySchema.parse({
      ...stay,
      types: 'lodge,b-and-b',
      freeCancellation: 'false',
    });
    const params = searchQueryToParams(parsed);
    expect(params.toString()).toBe(
      'checkIn=2026-10-26&checkOut=2026-10-28&guests=2&types=b-and-b%2Clodge',
    );
    expect(searchQuerySchema.parse(Object.fromEntries(params))).toEqual({
      ...parsed,
      types: ['b-and-b', 'lodge'],
      freeCancellation: undefined,
    });
  });
});
