# Performance and Security Review

Measured on the development machine: AMD Ryzen 5 5500 (6 cores, 12 threads), Windows 11, Docker Desktop, PostgreSQL 17.5 + PostGIS 3.5.2. Section 1 was first measured on 2026-10-26 with the fictional dataset (91 properties, 602 offers). It was re-measured on 2026-10-27 with the real OpenStreetMap dataset: **1,742 properties, 11,703 offers, 4,605 room types and 19,242 availability blocks**, about 19 times larger.

## 1. Search query

`EXPLAIN (ANALYZE)` of the page query for a Cape Town search (20 km radius, 2 nights, 2 guests, `amenities=wifi`, `maxPrice=3000`):

| Step              | Plan node                                                      | Notes                                                           |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| Radius filter     | **Bitmap Index Scan on `properties_location_gix`**             | GiST index on `geography` (`ST_DWithin` → `&&` index condition) |
| Amenity "has all" | Index Scan on `amenities_slug_key` + `property_amenities_pkey` | Per candidate only (15 rows)                                    |
| Eligible offers   | **Index Scan on `offers_property_active_idx`**                 | Partial index (`WHERE status = 'active'`)                       |
| Availability      | **Index Only Scan on the exclusion-constraint GiST index**     | `room_type_id = … AND blocked && daterange(…)`                  |
| Pricing           | `quote_stay` **inlined** (arithmetic since migration 003)      | The SQL function is `IMMUTABLE`, so the planner inlines it      |
| Page enrichment   | Correlated subqueries run only for the 20 page rows            | No N+1 queries from the API                                     |

- Planning time is 2.7 ms and execution time is 2.8 ms.
- Small tables (`rating_summaries`, 81 rows) are sequentially scanned. That is the planner's correct choice at this size.

**End-to-end repository timings** at 91 properties (before the changes below, when the page and map queries ran in parallel), 40 runs each:

| Search               | Median | p95    |
| -------------------- | ------ | ------ |
| Nationwide, 2 nights | 7.6 ms | 9.0 ms |
| Cape Town radius     | 6.3 ms | 7.4 ms |

The target was a p95 under 300 ms, and the search met it comfortably at 91 properties (median 6–8 ms).

### At 19 times the data (real OpenStreetMap places)

The first measurement on the larger dataset showed searches over big areas taking 45–80 ms, and only **183 uncached requests/s** under load. Four changes, each verified with `EXPLAIN ANALYZE` and the full integration suite (including the independent eligibility oracle and SQL↔TypeScript price parity):

| Change                                                                                                                        | Why                                                                                                                            | Effect                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **One statement instead of two.** The page and the map points now come from one query, with the ranked pipeline computed once | The page query and the map query each re-priced every eligible offer                                                           | Half the database work per search                                                |
| **Arithmetic weekend count in `quote_stay`** (migration `003`)                                                                | The function built one row per night with `generate_series` to count Friday and Saturday nights, thousands of times per search | Nationwide search 79 → 40 ms. Exhaustively tested: every start day × 1–30 nights |
| **Booked rooms found once.** One GiST range scan finds every room booked for the dates, then a hash anti-join excludes them   | `NOT EXISTS` probed the availability index once per offer (1,523 probes for Cape Town)                                         | About 12 ms → 2 ms                                                               |
| **`MATERIALIZED` offer statistics, plus `ANALYZE` after seeding**                                                             | The planner re-aggregated per-property offer counts once for each of 215 results, and fresh tables had no statistics           | About 18 ms → under 1 ms                                                         |

**Result, warm connection:** Cape Town (20 km, 215 results) went from 52 ms to **24–27 ms** of execution time. Uncached throughput went from 183 to **242 requests/s** in one process and **289 requests/s** with four. At that point PostgreSQL is using all 12 CPUs. In normal use the response cache (section 3) serves repeated searches, so the database sees only a small share of the traffic.

**Measurement note:** the first query on a brand-new database connection pays about 8 ms of one-off PostGIS start-up. The pool keeps connections open, so live requests don't pay it.

Remaining options for a much larger catalogue: precompute a nightly "from" price per offer for the common stay lengths, or cap candidates before pricing.

## 2. Frontend

| Asset                                                   | Size (min)    | Gzip   |
| ------------------------------------------------------- | ------------- | ------ |
| Main JS (React, React Router, TanStack Query, Zod, app) | 773 kB        | 229 kB |
| Results map chunk (Leaflet + markercluster), **lazy**   | 188 kB        | 54 kB  |
| Property map chunk, **lazy**                            | 1.4 kB        | 0.8 kB |
| CSS                                                     | 45 kB         | 9 kB   |
| Fonts (Inter, Fraunces; latin subsets load on demand)   | 37–85 kB each | —      |

- **Leaflet and its CSS are code-split.** They load only when a map is rendered.
- **The main bundle is mostly vendor code.** React DOM accounts for about half of the source, and Zod is shared with the API for URL validation. Splitting routes would save little; the warning threshold is raised to 800 kB with that justification.
- **Map markers are diffed.** Hovering a card updates at most four marker icons (the previous and next selected/hovered markers) instead of rebuilding the layer.
- **Typing is debounced.** Destination autocomplete waits 150 ms, and the price and name filters wait 400–600 ms, so typing does not fire a request per keystroke.
- **Refinement keeps the page stable.** TanStack Query keeps the previous results visible while a refined search loads (`keepPreviousData`).
- **Illustrations are small.** They are SVGs of 3–6 kB each and lazy-loaded below the fold.

## 3. Concurrency and load

**What the API does to stay fast under many simultaneous users:**

- **Response cache with request coalescing** (`apps/api/src/lib/cache.ts`). The data changes only when the database is re-seeded, so identical read requests share one result for 30 seconds (`API_CACHE_TTL_MS`). While a result is being computed, every other request for the same URL waits for that one computation instead of running its own query. A burst of 1,000 users running the same search therefore costs **one** database query. Failed requests are never cached, and the cache is a bounded LRU (5,000 entries).
- **Finished bytes are cached, not objects** (`cached-response.ts`). A cache hit skips validation, JSON serialisation and compression entirely: each body is stored as JSON and compressed with Brotli or gzip at most once.
- **ETags and `Cache-Control`.** Browsers revalidate with `If-None-Match` and get a bodiless `304`. Filters and destinations may be cached for 5 minutes, and search, property and offer responses for 30 seconds. Errors and health checks are `no-store`.
- **Compression.** Brotli (quality 4–5, about 20 times faster than the default 11) cuts a nationwide search response from 32 kB to 6 kB.
- **Multiple processes.** `API_WORKERS=4` runs four API processes on one port through Node's `cluster` module, and restarts a worker if it crashes.
- **Bounded database use.** Each process has `DB_POOL_MAX` connections (default 20), with a 5 s connection timeout and a 10 s statement timeout. With several workers, `workers × DB_POOL_MAX` must stay under PostgreSQL's 100 connections.

**Load test.** `npm run loadtest` starts its own API on port 4300 with the rate limit off, because every simulated user shares one IP. It sends a mix of 237 distinct URLs: searches across 20 destinations and 5 date ranges, price and distance sorts, property pages, offer comparisons, filters and autocomplete. The load generator ([autocannon](https://github.com/mcollina/autocannon)) runs on the same machine, an AMD Ryzen 5 5500 (6 cores, 12 threads) on Windows 11, so it competes with the API for CPU.

| Run (cache on)                                                              | Requests/s | p50    | p99      | Errors |
| --------------------------------------------------------------------------- | ---------- | ------ | -------- | ------ |
| Fictional data, 1,000 connections, 1 process, before caching finished bytes | 1,408      | 757 ms | 2,084 ms | 0      |
| Fictional data, 1,000 connections, 1 process                                | 2,861      | 321 ms | 1,469 ms | 0      |
| Fictional data, 1,000 connections, 4 processes                              | 5,112      | 293 ms | 1,117 ms | 0      |
| **Real data (1,742 places), 1,000 connections, 1 process, 20 s**            | **2,852**  | 317 ms | 1,453 ms | **0**  |
| **Real data, 1,000 connections, 4 processes, 20 s**                         | **4,720**  | 260 ms | 939 ms   | **0**  |
| **Real data, 2,000 connections, 4 processes, 20 s**                         | **4,891**  | 385 ms | 1,710 ms | **0**  |

- **Every request succeeded.** At 2,000 concurrent connections, 97,805 requests completed in 20 seconds with no errors, timeouts or non-2xx responses.
- **Cached throughput doesn't depend on data size:** the 19 times larger real dataset serves at the same rate, because hits never touch the database.
- **The latencies are queueing.** With 1,000 connections open at once, each one waits its turn. At 200 connections, a cached search takes about 2–3 ms end to end.
- **Context:** on this machine a bare Fastify health check tops out near 6,800 requests/s in one process, so cached endpoints now run close to the framework's ceiling.
- **Real-world capacity:** 1,000 _connections_ each firing continuously represent far more than 1,000 _users_. Real users pause between actions, so 5,000 requests/s corresponds to tens of thousands of active browsing users.

Reproduce with:

```bash
npm run loadtest                                   # 1000 connections, 20 s, 1 process
npm run loadtest -- --workers 4 --duration 30
npm run loadtest -- --no-cache --connections 200   # database path only
```

## 4. Security checks performed

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input validation    | Every endpoint parses input with strict Zod schemas. Unknown parameters, repeated parameters, malformed numbers and out-of-range values are rejected with a 400                                                                                                                                                                                                                                |
| SQL injection       | All values are bound parameters (`SqlParams`). Dynamic SQL is limited to whitelisted `ORDER BY` fragments and fixed table names. `LIKE` input is escaped (unit-tested)                                                                                                                                                                                                                         |
| Error leakage       | 500 responses carry a generic message and a request id; details go to the server log only (integration-tested)                                                                                                                                                                                                                                                                                 |
| Headers             | `@fastify/helmet` with `default-src 'none'` CSP on the JSON API, `nosniff` and frame denial (integration-tested)                                                                                                                                                                                                                                                                               |
| Web app headers     | The built app (`npm start`) sends a strict CSP: scripts, fonts and connections from the same origin only, images also from the configured tile server and `upload.wikimedia.org`, no framing, no plugins. Also `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, microphone and payment off) and `COOP`. The built page has no inline scripts                                        |
| CORS                | Restricted to `CORS_ORIGIN` (default `http://localhost:5173`), `GET` only                                                                                                                                                                                                                                                                                                                      |
| Abuse limits        | Rate limit of 300 requests/min/IP, page size ≤ 50, map points ≤ 500, a 10 s statement timeout and a 16 kB body limit                                                                                                                                                                                                                                                                           |
| Secrets             | `.env` is gitignored; `git ls-files` shows only `.env.example`. The DB credentials are documented local-only defaults bound to `127.0.0.1`                                                                                                                                                                                                                                                     |
| Dependencies        | `npm audit --omit=dev`: **0 vulnerabilities** (2026-10-26). The dev-only load-test tool pulls in `uuid@8` (moderate advisory GHSA-w5hq-g745-h8pq, which affects `v3`/`v5`/`v6` with a caller-supplied buffer). That code path isn't used, and the tool never ships                                                                                                                             |
| User content        | There is no user-generated content. React escapes all text. Leaflet marker HTML contains only formatted numbers, and names are set with `setAttribute`                                                                                                                                                                                                                                         |
| External links      | Only real-place websites from OpenStreetMap. `safeWebsite()` accepts plain `http(s)` URLs to a named host and rejects `javascript:`, `data:`, credentials, IP addresses and `localhost` (unit-tested); a database `CHECK` enforces it again (integration-tested). Links open with `rel="noopener noreferrer nofollow"`. Fictional providers still open an explanatory dialog instead of a link |
| Imported data       | OpenStreetMap tags are untrusted: names, phones and addresses are length-limited and normalised, star ratings must be 1–5, and photo URLs must be Wikimedia Commons thumbnails with a free licence and credit. React escapes all of it                                                                                                                                                         |
| Cache safety        | Cache keys are the full request URL plus today's date. Only successful results are cached, and validation errors never are. There is no per-user data, so a shared cache can't leak anything between users                                                                                                                                                                                     |
| Destructive scripts | `db:reset` refuses `NODE_ENV=production`. Test setups refuse databases whose name doesn't end in `_test`                                                                                                                                                                                                                                                                                       |
| Authentication      | Not implemented, deliberately (ADR-012): there is no user data to protect                                                                                                                                                                                                                                                                                                                      |

## 5. Accessibility checks performed

- **axe-core** (WCAG 2.0/2.1/2.2 A and AA rule sets) runs in Playwright on the home, search, property and how-it-works pages, with no violations. It found one issue, unnamed cluster markers, which was fixed.
- **Keyboard flow** is covered by an E2E test: skip link, combobox (arrows/Enter), submitting a search, and opening a result.
- **Map alternative:** the list is the primary interface, and the map is supplementary with keyboard-focusable, labelled markers.
- **Not colour alone:** status is always conveyed with text, never colour alone (badges, simulated labels).
- **Reduced motion** is honoured.
- **Limits:** automated tools catch only part of all accessibility issues, and no screen-reader user testing has been done.
