import { describe, expect, it } from 'vitest';
import { generateDataset } from './generate';
import { validateDataset } from './validate';

describe('synthetic dataset generator', () => {
  it('is deterministic for a given reference date', () => {
    expect(generateDataset('2026-10-26')).toEqual(generateDataset('2026-10-26'));
  });

  it('keeps properties, rooms and prices stable when only the reference date changes', () => {
    const a = generateDataset('2026-10-26');
    const b = generateDataset('2027-03-01');
    const strip = (d: typeof a) =>
      d.properties.map((p) => ({
        ...p,
        roomTypes: p.roomTypes.map(({ blocks: _b, ...r }) => r),
        offers: p.offers.map(({ lastCheckedAt: _l, ...o }) => o),
      }));
    expect(strip(a)).toEqual(strip(b));
  });

  it('passes validation and covers the intended variety', () => {
    const dataset = generateDataset('2026-10-26');
    expect(() => validateDataset(dataset)).not.toThrow();
    expect(dataset.properties).toHaveLength(91);
    expect(new Set(dataset.properties.map((p) => p.typeSlug)).size).toBe(10);
    expect(new Set(dataset.properties.map((p) => p.destinationSlug)).size).toBeGreaterThanOrEqual(15);
    const multiProvider = dataset.properties.filter((p) => p.listings.length >= 2).length;
    expect(multiProvider / dataset.properties.length).toBeGreaterThan(0.6);
  });

  it('never generates overlapping availability blocks', () => {
    for (const property of generateDataset('2026-10-26').properties) {
      for (const room of property.roomTypes) {
        for (let i = 1; i < room.blocks.length; i += 1) {
          expect(room.blocks[i]![0] >= room.blocks[i - 1]![1]).toBe(true);
        }
      }
    }
  });
});
