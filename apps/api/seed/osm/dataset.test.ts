import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import { buildOsmDataset } from './dataset';
import type { OsmPlace, OsmSnapshot } from './snapshot';

const photo = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/960px-X.jpg',
  width: 960,
  height: 640,
  credit: 'A. Photographer · CC BY-SA 4.0 · Wikimedia Commons',
  creditUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
  licence: 'CC BY-SA 4.0',
};

const place = (id: number, lat: number, lng: number, tags: Record<string, string>): OsmPlace => ({
  osmType: 'node',
  osmId: id,
  lat,
  lng,
  tags: { tourism: 'guest_house', ...tags },
});

function snapshot(places: OsmPlace[]): OsmSnapshot {
  return {
    fetchedAt: '2026-10-26T00:00:00Z',
    attribution: '© OpenStreetMap contributors',
    licence: 'ODbL-1.0',
    destinationPhotos: { 'cape-town': photo },
    places,
  };
}

const SEA_POINT = { lat: -33.9205, lng: 18.3905 };

describe('buildOsmDataset', () => {
  const data = buildOsmDataset(
    snapshot([
      place(1, SEA_POINT.lat, SEA_POINT.lng, {
        name: 'Ocean View Guesthouse',
        website: 'oceanview.example.co.za',
        phone: '+27 21 555 0100',
        stars: '4',
        swimming_pool: 'yes',
        wheelchair: 'no',
      }),
      // Same name a few metres away: OSM mapped it twice, keep one.
      place(2, SEA_POINT.lat + 0.00003, SEA_POINT.lng, { name: 'Ocean View Guesthouse' }),
      place(3, -33.93, 18.42, { name: 'City Bowl B&B', website: 'javascript:alert(1)' }),
      // Generic name: dropped.
      place(4, -33.94, 18.41, { name: 'Guesthouse' }),
      // Far from every destination: dropped.
      place(5, -30.5, 21.0, { name: 'Middle Of Nowhere Inn', tourism: 'hotel' }),
    ]),
    '2026-11-02',
  );

  it('keeps one record per real place and drops unusable ones', () => {
    expect(data.source).toBe('osm');
    expect(data.properties.map((p) => p.name).sort()).toEqual([
      'City Bowl B&B',
      'Ocean View Guesthouse',
    ]);
  });

  it('carries real facts and labels the rest as simulated', () => {
    const p = data.properties.find((x) => x.name === 'Ocean View Guesthouse')!;
    expect(p.real).toMatchObject({
      osmType: 'node',
      osmId: 1,
      websiteUrl: 'https://oceanview.example.co.za/',
      phone: '+27 21 555 0100',
      stars: 4,
    });
    expect(p.destinationSlug).toBe('cape-town');
    expect(p.lat).toBe(SEA_POINT.lat);
    expect(p.description).toMatch(/simulated/);
    expect(p.amenitySlugs).toContain('pool');
    expect(p.amenitySlugs).not.toContain('step-free-access');
    expect(p.amenitySlugs).not.toContain('accessible-bathroom');
    expect(p.real!.confirmedAmenitySlugs).toEqual(['pool']);
  });

  it('never keeps an unsafe website link', () => {
    const p = data.properties.find((x) => x.name === 'City Bowl B&B')!;
    expect(p.real!.websiteUrl).toBeNull();
    expect(p.typeSlug).toBe('bed-and-breakfast');
  });

  it('adds destination photos with credit, and passes dataset validation', () => {
    const ct = data.destinations.find((d) => d.slug === 'cape-town')!;
    expect(ct.photo).toMatchObject({ url: photo.url, credit: photo.credit });
    expect(() => validateDataset(data)).not.toThrow();
  });

  it('is deterministic', () => {
    const again = buildOsmDataset(
      snapshot([place(3, -33.93, 18.42, { name: 'City Bowl B&B' })]),
      '2026-11-02',
    );
    const first = data.properties.find((x) => x.name === 'City Bowl B&B')!;
    expect(again.properties[0]!.offers).toEqual(first.offers);
  });
});
