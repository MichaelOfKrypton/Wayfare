import { haversineKm } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import {
  classify,
  commonsThumbUrl,
  cleanName,
  cleanPhone,
  dedupePlaces,
  normalizePlace,
  safeWebsite,
  tierFromStars,
} from './normalize';
import type { OsmPlace } from './snapshot';

const place = (tags: Record<string, string>, extra: Partial<OsmPlace> = {}): OsmPlace => ({
  osmType: 'node',
  osmId: 1,
  lat: -33.92,
  lng: 18.42,
  tags: { name: 'Test Place', tourism: 'hotel', ...tags },
  ...extra,
});

describe('safeWebsite', () => {
  it.each([
    ['https://www.example.co.za/', 'https://www.example.co.za/'],
    ['http://example.com/rooms?a=1', 'http://example.com/rooms?a=1'],
    ['www.example.co.za', 'https://www.example.co.za/'],
    ['example.com/path', 'https://example.com/path'],
    ['https://a.example.com;https://b.example.com', 'https://a.example.com/'],
  ])('accepts %s', (input, expected) => {
    expect(safeWebsite(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com',
    'https://user:pass@example.com',
    'http://localhost:3000',
    'http://192.168.0.1/admin',
    'https://[::1]/',
    'not a url',
    'https://exa mple.com',
    'mailto:hello@example.com',
    `https://example.com/${'x'.repeat(400)}`,
    '',
    undefined,
  ])('rejects %s', (input) => {
    expect(safeWebsite(input)).toBeNull();
  });
});

describe('cleanName', () => {
  it('collapses whitespace', () =>
    expect(cleanName('  The   Vineyard Hotel ')).toBe('The Vineyard Hotel'));
  it.each(['Airbnb', 'guesthouse', 'B&B', 'Hotel', '12', 'ab', undefined])(
    'rejects generic or empty name %s',
    (input) => expect(cleanName(input)).toBeNull(),
  );
});

describe('cleanPhone', () => {
  it('keeps the first valid number', () => {
    expect(cleanPhone('+27 21 418 1234; +27 82 000 0000')).toBe('+27 21 418 1234');
  });
  it.each(['call us', '123', '+27 21 418 1234 ext 5'])('rejects %s', (input) => {
    expect(cleanPhone(input)).toBeNull();
  });
});

describe('classify', () => {
  it.each([
    [{ tourism: 'hostel' }, 'Long Street Backpackers', 'backpackers'],
    [{ tourism: 'motel' }, 'Road Stop', 'hotel'],
    [
      { tourism: 'guest_house', guest_house: 'bed_and_breakfast' },
      'Rose Cottage',
      'bed-and-breakfast',
    ],
    [{ tourism: 'guest_house' }, 'Oak Tree B&B', 'bed-and-breakfast'],
    [{ tourism: 'guest_house' }, 'Ridge Guest House', 'guesthouse'],
    [{ tourism: 'guest_house', guest_house: 'farmstay' }, 'Kliphuis', 'farm-stay'],
    [{ tourism: 'hotel' }, 'Thornybush Game Lodge', 'lodge'],
    [{ tourism: 'hotel', rooms: '12' }, 'The Small Hotel', 'boutique-hotel'],
    [{ tourism: 'hotel', rooms: '172' }, 'Garden Court', 'hotel'],
    [{ tourism: 'apartment' }, 'Harbour View Apartments', 'apartment'],
    [{ tourism: 'chalet' }, 'River Chalets', 'self-catering'],
  ] as const)('%o "%s" → %s', (tags, name, expected) => {
    expect(classify({ ...tags }, name)).toBe(expected);
  });
});

describe('tierFromStars', () => {
  it('maps star ratings to price tiers', () => {
    expect([1, 2, 3, 4, 5, null].map(tierFromStars)).toEqual([
      'budget',
      'budget',
      'mid',
      'premium',
      'luxury',
      null,
    ]);
  });
});

describe('normalizePlace', () => {
  it('extracts contact details, address and amenity evidence', () => {
    const result = normalizePlace(
      place({
        website: 'www.example.co.za',
        phone: '+27 21 418 1234',
        stars: '4',
        rooms: '80',
        'addr:housenumber': '46',
        'addr:street': 'Somerset Road',
        'addr:suburb': 'Green Point',
        internet_access: 'wlan',
        wheelchair: 'no',
      }),
    )!;
    expect(result).toMatchObject({
      key: 'node/1',
      type: 'hotel',
      stars: 4,
      tier: 'premium',
      rooms: 80,
      websiteUrl: 'https://www.example.co.za/',
      phone: '+27 21 418 1234',
      streetAddress: '46 Somerset Road',
      suburb: 'Green Point',
      confirmedAmenities: ['wifi'],
      deniedAmenities: ['step-free-access'],
    });
  });

  it('ignores invalid star values and unsafe links', () => {
    const result = normalizePlace(place({ stars: '7', website: 'javascript:alert(1)' }))!;
    expect(result.stars).toBeNull();
    expect(result.tier).toBeNull();
    expect(result.websiteUrl).toBeNull();
  });

  it('drops places without a usable name', () => {
    expect(normalizePlace(place({ name: 'Airbnb' }))).toBeNull();
  });
});

describe('dedupePlaces', () => {
  it('keeps the richer of two same-named places close together, but not far-apart ones', () => {
    const a = normalizePlace(place({ name: 'Sea Breeze' }, { osmId: 1 }))!;
    const b = normalizePlace(
      place(
        { name: 'Sea  Breeze', website: 'https://seabreeze.example.com' },
        {
          osmId: 2,
          osmType: 'way',
          lat: -33.9201,
        },
      ),
    )!;
    const far = normalizePlace(place({ name: 'Sea Breeze' }, { osmId: 3, lat: -34.2 }))!;
    const result = dedupePlaces([a, b, far], haversineKm);
    expect(result.map((p) => p.key)).toEqual(['node/3', 'way/2']);
  });
});

describe('commonsThumbUrl', () => {
  it('normalises Commons thumbnails to upload.wikimedia.org without tracking parameters', () => {
    expect(
      commonsThumbUrl(
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/K.jpg/960px-K.jpg?utm_source=x',
      ),
    ).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/K.jpg/960px-K.jpg');
  });
  it.each([
    'http://upload.wikimedia.org/wikipedia/commons/a.jpg',
    'https://evil.example/wikipedia/commons/a.jpg',
    'https://upload.wikimedia.org/other/a.jpg',
    'not a url',
  ])('rejects %s', (input) => expect(commonsThumbUrl(input)).toBeNull());
});
