import { describe, expect, it, vi } from 'vitest';
import { createResponseCache } from './cache';

describe('createResponseCache', () => {
  it('serves repeat requests from memory until the entry expires', async () => {
    let t = 0;
    const cache = createResponseCache({ ttlMs: 1_000, now: () => t });
    const compute = vi.fn(async () => 'value');
    expect(await cache.wrap('k', compute)).toBe('value');
    expect(await cache.wrap('k', compute)).toBe('value');
    expect(compute).toHaveBeenCalledTimes(1);
    t = 1_001;
    await cache.wrap('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('runs one computation for many concurrent identical requests', async () => {
    const cache = createResponseCache({ ttlMs: 1_000 });
    let release!: (v: number) => void;
    const compute = vi.fn(() => new Promise<number>((resolve) => (release = resolve)));
    const calls = Array.from({ length: 500 }, () => cache.wrap('same', compute));
    release(42);
    expect(await Promise.all(calls)).toEqual(Array(500).fill(42));
    expect(compute).toHaveBeenCalledTimes(1);
    expect(cache.stats.coalesced).toBe(499);
  });

  it('never caches failures', async () => {
    const cache = createResponseCache({ ttlMs: 1_000 });
    await expect(cache.wrap('k', () => Promise.reject(new Error('db down')))).rejects.toThrow(
      'db down',
    );
    expect(await cache.wrap('k', async () => 'ok')).toBe('ok');
  });

  it('evicts the least recently used entries beyond the limit', async () => {
    const cache = createResponseCache({ ttlMs: 10_000, maxEntries: 2 });
    await cache.wrap('a', async () => 1);
    await cache.wrap('b', async () => 2);
    await cache.wrap('a', async () => 1); // touch a
    await cache.wrap('c', async () => 3); // evicts b
    const compute = vi.fn(async () => 2);
    await cache.wrap('b', compute);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(2);
  });

  it('is a pass-through when disabled', async () => {
    const cache = createResponseCache({ ttlMs: 0 });
    const compute = vi.fn(async () => 1);
    await cache.wrap('k', compute);
    await cache.wrap('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
