/**
 * In-memory response cache with request coalescing.
 *
 * The data only changes when the database is re-seeded, so identical requests
 * can share one result for a short time. While a value is being computed,
 * concurrent callers with the same key wait for that one computation instead
 * of each running the same query ("single flight"). This keeps the database
 * load flat when many users search for the same thing at once.
 *
 * Failures are never cached. Entries expire after `ttlMs`, and the oldest
 * entries are evicted beyond `maxEntries` (a Map keeps insertion order).
 */
export interface ResponseCache {
  wrap<T>(key: string, compute: () => Promise<T>): Promise<T>;
  clear(): void;
  readonly size: number;
  readonly stats: { hits: number; misses: number; coalesced: number };
}

export function createResponseCache(options: {
  ttlMs: number;
  maxEntries?: number;
  now?: () => number;
}): ResponseCache {
  const { ttlMs, maxEntries = 5_000, now = Date.now } = options;
  const values = new Map<string, { value: unknown; expires: number }>();
  const inFlight = new Map<string, Promise<unknown>>();
  const stats = { hits: 0, misses: 0, coalesced: 0 };

  return {
    async wrap<T>(key: string, compute: () => Promise<T>): Promise<T> {
      if (ttlMs <= 0) return compute();
      const entry = values.get(key);
      if (entry && entry.expires > now()) {
        stats.hits += 1;
        // Refresh recency so frequently used keys survive eviction.
        values.delete(key);
        values.set(key, entry);
        return entry.value as T;
      }
      if (entry) values.delete(key);

      const pending = inFlight.get(key);
      if (pending) {
        stats.coalesced += 1;
        return pending as Promise<T>;
      }

      stats.misses += 1;
      const promise = compute().then(
        (value) => {
          values.set(key, { value, expires: now() + ttlMs });
          while (values.size > maxEntries) values.delete(values.keys().next().value!);
          return value;
        },
        (error: unknown) => {
          throw error;
        },
      );
      inFlight.set(key, promise);
      try {
        return await promise;
      } finally {
        inFlight.delete(key);
      }
    },
    clear() {
      values.clear();
    },
    get size() {
      return values.size;
    },
    stats,
  };
}
