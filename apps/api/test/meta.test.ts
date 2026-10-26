import type { ApiErrorBody, DestinationsResponse, FiltersResponse } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { getJson, useTestApp } from './helpers';

const ctx = useTestApp();

describe('health', () => {
  it('reports liveness and readiness', async () => {
    expect((await getJson(ctx.app, '/api/health')).body).toEqual({ status: 'ok' });
    expect((await getJson(ctx.app, '/api/health/ready')).body).toEqual({ status: 'ready', database: 'ok' });
  });
});

describe('GET /api/destinations', () => {
  it('autocompletes by prefix, substring and with small typos', async () => {
    const prefix = await getJson<DestinationsResponse>(ctx.app, '/api/destinations', { q: 'stell' });
    expect(prefix.body.items[0]?.slug).toBe('stellenbosch');
    const substring = await getJson<DestinationsResponse>(ctx.app, '/api/destinations', { q: 'waterfront' });
    expect(substring.body.items.map((d) => d.slug)).toContain('va-waterfront');
    const typo = await getJson<DestinationsResponse>(ctx.app, '/api/destinations', { q: 'Knysan' });
    expect(typo.body.items.map((d) => d.slug)).toContain('knysna');
  });

  it('lists featured destinations with property counts', async () => {
    const { body } = await getJson<DestinationsResponse>(ctx.app, '/api/destinations', { featured: 'true' });
    expect(body.items.length).toBeGreaterThanOrEqual(6);
    expect(body.items.every((d) => d.propertyCount > 0)).toBe(true);
  });

  it('honours limits and validates input', async () => {
    const { body } = await getJson<DestinationsResponse>(ctx.app, '/api/destinations', { limit: '2' });
    expect(body.items).toHaveLength(2);
    const bad = await getJson<ApiErrorBody>(ctx.app, '/api/destinations', { limit: '500' });
    expect(bad.status).toBe(400);
  });

  it('gets one destination by slug or 404s', async () => {
    expect((await getJson(ctx.app, '/api/destinations/hermanus')).status).toBe(200);
    expect((await getJson(ctx.app, '/api/destinations/atlantis')).status).toBe(404);
  });
});

describe('GET /api/filters', () => {
  it('returns filter values with counts and price bounds', async () => {
    const { body } = await getJson<FiltersResponse>(ctx.app, '/api/filters');
    expect(body.propertyTypes).toHaveLength(10);
    expect(body.propertyTypes.reduce((sum, t) => sum + t.propertyCount, 0)).toBe(91);
    expect(body.amenities.some((a) => a.slug === 'backup-power' && a.isEssential)).toBe(true);
    expect(body.priceBounds.minNightlyCents).toBeGreaterThan(0);
    expect(body.priceBounds.maxNightlyCents).toBeGreaterThan(body.priceBounds.minNightlyCents);
  });
});

describe('errors and headers', () => {
  it('returns a JSON 404 envelope for unknown routes', async () => {
    const { status, body } = await getJson<ApiErrorBody>(ctx.app, '/api/unknown');
    expect(status).toBe(404);
    expect(body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(body.error.requestId).toBeTruthy();
  });

  it('sets security headers', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('never leaks internal error details', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: "/api/properties/x'--" });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toMatch(/SELECT|syntax|stack/i);
  });
});
