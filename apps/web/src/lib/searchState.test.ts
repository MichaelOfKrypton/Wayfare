import { describe, expect, it } from 'vitest';
import { activeFilterCount, parseSearchParams, updateSearch } from './searchState';

const TODAY = '2026-10-26';
const parse = (qs: string) => parseSearchParams(new URLSearchParams(qs), TODAY);

describe('parseSearchParams', () => {
  it('defaults to tonight for 2 guests', () => {
    const { query, corrections } = parse('');
    expect(query).toMatchObject({ checkIn: '2026-10-26', checkOut: '2026-10-27', guests: 2 });
    expect(corrections).toEqual([]);
  });

  it('parses filters from the URL', () => {
    const { query } = parse(
      'destination=knysna&checkIn=2026-11-01&checkOut=2026-11-03&guests=4&types=lodge,guesthouse&maxPrice=2000&freeCancellation=true',
    );
    expect(query).toMatchObject({
      destination: 'knysna',
      guests: 4,
      types: ['lodge', 'guesthouse'],
      maxPrice: 2000,
      freeCancellation: true,
    });
  });

  it('resets past dates to tonight and explains why', () => {
    const { query, corrections } = parse('checkIn=2026-10-01&checkOut=2026-10-03&guests=2');
    expect(query.checkIn).toBe(TODAY);
    expect(corrections[0]).toMatch(/past/);
  });

  it('drops invalid or unknown values instead of failing', () => {
    const { query, corrections } = parse(
      'checkIn=2026-11-01&checkOut=2026-11-02&guests=99&sort=bogus&utm_source=x',
    );
    expect(query.guests).toBe(2);
    expect(query.sort).toBeUndefined();
    expect(corrections.length).toBeGreaterThan(0);
  });
});

describe('updateSearch', () => {
  const { query } = parse(
    'destination=durban&checkIn=2026-11-01&checkOut=2026-11-02&guests=2&page=3',
  );

  it('resets to page 1 when a filter changes', () => {
    expect(updateSearch(query, { minRating: 8 }).get('page')).toBeNull();
  });

  it('keeps the requested page when paginating', () => {
    expect(updateSearch(query, { page: 4 }).get('page')).toBe('4');
  });

  it('removes a filter when patched with undefined', () => {
    const withTypes = parse('checkIn=2026-11-01&checkOut=2026-11-02&guests=2&types=lodge').query;
    expect(updateSearch(withTypes, { types: undefined }).has('types')).toBe(false);
  });
});

describe('activeFilterCount', () => {
  it('counts filter groups, not individual values', () => {
    const { query } = parse(
      'checkIn=2026-11-01&checkOut=2026-11-02&guests=2&types=lodge,hotel&minPrice=100&maxPrice=900',
    );
    expect(activeFilterCount(query)).toBe(2);
  });
});
