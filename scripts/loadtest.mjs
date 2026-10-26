#!/usr/bin/env node
/**
 * Load test: starts its own API on port 4300 (rate limit off, so one machine can
 * act as many users), then sends a realistic mix of requests from many concurrent
 * connections with autocannon and prints throughput and latency.
 *
 *   npm run loadtest                       # 1000 connections, 20 s, 1 worker
 *   npm run loadtest -- --connections 2000 --duration 30 --workers 4
 *   npm run loadtest -- --no-cache         # measure the database path alone
 *
 * Needs the database running and seeded (npm run db:up && npm run db:reset).
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { availableParallelism } from 'node:os';
import autocannon from 'autocannon';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const connections = flag('connections', 1000);
const duration = flag('duration', 20);
const workers = flag('workers', 1);
const noCache = args.includes('--no-cache');
const PORT = 4300;
const base = `http://127.0.0.1:${PORT}`;

const api = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], {
  env: {
    ...process.env,
    API_PORT: String(PORT),
    NODE_ENV: 'production',
    LOG_LEVEL: 'warn',
    RATE_LIMIT_PER_MINUTE: '0',
    API_WORKERS: String(workers),
    DB_POOL_MAX: String(Math.max(5, Math.floor(80 / workers))),
    API_CACHE_TTL_MS: noCache ? '0' : '30000',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stopApi = () => api.exitCode === null && api.kill('SIGTERM');
process.on('exit', stopApi);

async function waitForReady() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(`${base}/api/health/ready`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API did not become ready. Is the database running? Try: npm run db:up');
}

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function buildRequests() {
  const destinations = (await (await fetch(`${base}/api/destinations?limit=20`)).json()).items;
  const stays = [1, 3, 7, 14, 21].map((o) => ({ checkIn: day(o), checkOut: day(o + 2) }));
  const searches = [];
  for (const d of destinations) {
    for (const s of stays) {
      searches.push(
        `/api/search?${new URLSearchParams({ destination: d.slug, ...s, guests: '2' })}`,
      );
    }
  }
  searches.push(
    `/api/search?${new URLSearchParams({ ...stays[0], guests: '2', sort: 'price_asc' })}`,
  );
  searches.push(
    `/api/search?${new URLSearchParams({ lat: '-33.92', lng: '18.42', radiusKm: '10', ...stays[0], guests: '2', sort: 'distance_asc' })}`,
  );

  const first = await (await fetch(`${base}${searches[0]}`)).json();
  const slugs = (first.items ?? []).slice(0, 15).map((p) => p.slug);
  const pages = slugs.flatMap((slug) => [
    `/api/properties/${slug}`,
    `/api/properties/${slug}/offers?${new URLSearchParams({ ...stays[1], guests: '2' })}`,
  ]);
  // Weighted like real traffic: mostly searches, then property pages and offers.
  return [
    ...searches,
    ...searches,
    ...pages,
    '/api/filters',
    '/api/destinations?featured=true',
    '/api/destinations?q=cape',
  ];
}

try {
  await waitForReady();
  const paths = await buildRequests();
  let i = 0;
  console.info(
    `\nLoad test: ${connections} concurrent connections for ${duration}s, ${paths.length} distinct URLs, ` +
      `${workers} API worker(s) of ${availableParallelism()} cores, cache ${noCache ? 'off' : 'on'}\n`,
  );
  const result = await autocannon({
    url: base,
    connections,
    duration,
    pipelining: 1,
    headers: { 'accept-encoding': 'br, gzip' },
    requests: [{ setupRequest: (req) => ({ ...req, path: paths[i++ % paths.length] }) }],
  });
  const ok = result['2xx'];
  const total = ok + result.non2xx + result.errors + result.timeouts;
  // eslint-disable-next-line no-console -- a results table is the point of this CLI
  console.table({
    'Requests/second (avg)': Math.round(result.requests.average),
    'Total requests': total,
    'Successful (2xx)': ok,
    'Non-2xx': result.non2xx,
    'Errors + timeouts': result.errors + result.timeouts,
    'Latency p50 (ms)': result.latency.p50,
    'Latency p90 (ms)': result.latency.p90,
    'Latency p99 (ms)': result.latency.p99,
    'Latency max (ms)': result.latency.max,
  });
  if (result.non2xx || result.errors || result.timeouts) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopApi();
  await Promise.race([once(api, 'exit'), new Promise((r) => setTimeout(r, 3000))]);
}
