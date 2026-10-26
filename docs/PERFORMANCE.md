# Performance and Security Review

Measured on 2026-10-26 on the development machine: Windows 11, Docker Desktop, PostgreSQL 17.5 + PostGIS 3.5.2, and the seeded dataset (91 properties, 602 offers, 911 availability blocks).

## 1. Search query

`EXPLAIN (ANALYZE)` of the page query for a Cape Town search (20 km radius, 2 nights, 2 guests, `amenities=wifi`, `maxPrice=3000`):

| Step              | Plan node                                                      | Notes                                                           |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| Radius filter     | **Bitmap Index Scan on `properties_location_gix`**             | GiST index on `geography` (`ST_DWithin` → `&&` index condition) |
| Amenity "has all" | Index Scan on `amenities_slug_key` + `property_amenities_pkey` | Per candidate only (15 rows)                                    |
| Eligible offers   | **Index Scan on `offers_property_active_idx`**                 | Partial index (`WHERE status = 'active'`)                       |
| Availability      | **Index Only Scan on the exclusion-constraint GiST index**     | `room_type_id = … AND blocked && daterange(…)`                  |
| Pricing           | `quote_stay` **inlined** (Function Scan on `generate_series`)  | The SQL function is `IMMUTABLE`, so the planner inlines it      |
| Page enrichment   | Correlated subqueries run only for the 20 page rows            | No N+1 queries from the API                                     |

- Planning time is 2.7 ms and execution time is 2.8 ms.
- Small tables (`rating_summaries`, 81 rows) are sequentially scanned. That is the planner's correct choice at this size.

**End-to-end repository timings** (the page and map queries run in parallel), 40 runs each:

| Search               | Median | p95    |
| -------------------- | ------ | ------ |
| Nationwide, 2 nights | 7.6 ms | 9.0 ms |
| Cape Town radius     | 6.3 ms | 7.4 ms |

The target was a p95 under 300 ms, and the search meets it comfortably. At larger scale (thousands of properties), the next steps would be:

1. Cap candidate rows before pricing.
2. Precompute a nightly "from" price per offer.
3. Cache filter metadata.

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

## 3. Security checks performed

| Check               | Result                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input validation    | Every endpoint parses input with strict Zod schemas. Unknown parameters, repeated parameters, malformed numbers and out-of-range values are rejected with a 400        |
| SQL injection       | All values are bound parameters (`SqlParams`). Dynamic SQL is limited to whitelisted `ORDER BY` fragments and fixed table names. `LIKE` input is escaped (unit-tested) |
| Error leakage       | 500 responses carry a generic message and a request id; details go to the server log only (integration-tested)                                                         |
| Headers             | `@fastify/helmet` with `default-src 'none'` CSP on the JSON API, `nosniff` and frame denial (integration-tested)                                                       |
| CORS                | Restricted to `CORS_ORIGIN` (default `http://localhost:5173`), `GET` only                                                                                              |
| Abuse limits        | Rate limit of 300 requests/min/IP, page size ≤ 50, map points ≤ 500, a 10 s statement timeout and a 16 kB body limit                                                   |
| Secrets             | `.env` is gitignored; `git ls-files` shows only `.env.example`. The DB credentials are documented local-only defaults bound to `127.0.0.1`                             |
| Dependencies        | `npm audit`: **0 vulnerabilities** (2026-10-26)                                                                                                                        |
| User content        | There is no user-generated content. React escapes all text. Leaflet marker HTML contains only formatted numbers, and names are set with `setAttribute`                 |
| External links      | None. Provider actions open an explanatory dialog instead of linking to unverified URLs                                                                                |
| Destructive scripts | `db:reset` refuses `NODE_ENV=production`. Test setups refuse databases whose name doesn't end in `_test`                                                               |
| Authentication      | Not implemented, deliberately (ADR-012): there is no user data to protect                                                                                              |

## 4. Accessibility checks performed

- **axe-core** (WCAG 2.0/2.1/2.2 A and AA rule sets) runs in Playwright on the home, search, property and how-it-works pages, with no violations. It found one issue, unnamed cluster markers, which was fixed.
- **Keyboard flow** is covered by an E2E test: skip link, combobox (arrows/Enter), submitting a search, and opening a result.
- **Map alternative:** the list is the primary interface, and the map is supplementary with keyboard-focusable, labelled markers.
- **Not colour alone:** status is always conveyed with text, never colour alone (badges, simulated labels).
- **Reduced motion** is honoured.
- **Limits:** automated tools catch only part of all accessibility issues, and no screen-reader user testing has been done.
