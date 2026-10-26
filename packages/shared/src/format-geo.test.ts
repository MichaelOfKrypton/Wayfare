import { describe, expect, it } from 'vitest';
import {
  formatDistanceKm,
  formatRelativeTime,
  formatShortDate,
  formatZar,
  formatZarPrecise,
  pluralise,
} from './format';
import { haversineKm, isWithinSouthAfrica, offsetByMetres } from './geo';

const NBSP = ' ';

describe('formatZar', () => {
  it('formats whole rands with space grouping', () => {
    expect(formatZar(159_000)).toBe(`R${NBSP}1${NBSP}590`);
    expect(formatZar(123_456_789)).toBe(`R${NBSP}1${NBSP}234${NBSP}568`);
    expect(formatZar(0)).toBe(`R${NBSP}0`);
  });
  it('formats precise amounts with cents', () => {
    expect(formatZarPrecise(41_478)).toBe(`R${NBSP}414.78`);
    expect(formatZarPrecise(100_005)).toBe(`R${NBSP}1${NBSP}000.05`);
  });
});

describe('other formatters', () => {
  it('formats distances', () => {
    expect(formatDistanceKm(0.234)).toBe('230 m');
    expect(formatDistanceKm(3.456)).toBe('3.5 km');
    expect(formatDistanceKm(42.6)).toBe('43 km');
  });
  it('formats short dates', () => {
    expect(formatShortDate('2026-10-26')).toBe('Mon 26 Oct');
  });
  it('pluralises', () => {
    expect(pluralise(1, 'night')).toBe('1 night');
    expect(pluralise(3, 'night')).toBe('3 nights');
    expect(pluralise(2, 'property', 'properties')).toBe('2 properties');
  });
  it('formats relative times', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    expect(formatRelativeTime('2026-10-26T11:59:40Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-10-26T11:15:00Z', now)).toBe('45 min ago');
    expect(formatRelativeTime('2026-10-26T09:00:00Z', now)).toBe('3 h ago');
  });
});

describe('geo', () => {
  it('computes Cape Town → Johannesburg ≈ 1 265 km', () => {
    const km = haversineKm({ lat: -33.9249, lng: 18.4241 }, { lat: -26.2041, lng: 28.0473 });
    expect(km).toBeGreaterThan(1255);
    expect(km).toBeLessThan(1275);
  });
  it('detects coordinates outside South Africa, including swapped lat/lng', () => {
    expect(isWithinSouthAfrica({ lat: -33.92, lng: 18.42 })).toBe(true);
    expect(isWithinSouthAfrica({ lat: 18.42, lng: -33.92 })).toBe(false);
    expect(isWithinSouthAfrica({ lat: 51.5, lng: -0.12 })).toBe(false);
  });
  it('offsets a point by metres', () => {
    const origin = { lat: -33.9, lng: 18.4 };
    const moved = offsetByMetres(origin, 300, 400);
    expect(haversineKm(origin, moved) * 1000).toBeCloseTo(500, -1);
  });
});
