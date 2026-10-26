# TODO — Wayfare master checklist

Legend: `[x]` done **and verified** · `[ ]` open · `⏸` deferred (optional / future).
A box is ticked only after the stated verification has been run. Last updated: 2026-10-26.

## 1. Planning

- [x] Phase 0 repository inspection. Remote: `MichaelOfKrypton/Wayfare` (README only). Tools: Node 24.18, npm 11.16, Docker 29.5, no native PostgreSQL
- [x] Product requirements (`docs/PRODUCT_REQUIREMENTS.md`)
- [x] Risk register (`docs/RISK_REGISTER.md`)
- [x] External services researched and registered (`REQUIRED APIS.md`)

## 2. Architecture

- [x] Architecture document (`docs/ARCHITECTURE.md`)
- [x] Database design + Mermaid ERD (`docs/DATABASE_DESIGN.md`)
- [x] API specification (`docs/API_SPECIFICATION.md`)
- [x] ADRs (`docs/TECHNICAL_DECISIONS.md`)
- [x] Monorepo scaffold: workspaces, TypeScript strict, ESLint, Prettier, root scripts. _Verified: `npm run typecheck`, `npm run lint` and `npm run format:check` pass_

## 3. Design system

- [x] Design system document (`docs/DESIGN_SYSTEM.md`)
- [x] `tokens.css` + global styles
- [x] Primitives: Button, Badge, RatingPill, Dialog, Skeleton, Empty/Error states. _Field inputs are styled in feature modules; there are no separate Field/Chip components (YAGNI)_
- [x] Generated demo illustrations: 53 SVGs, reviewed visually

## 4. Frontend

- [x] App shell: header, footer, persistent demo notice, routing, 404, skip link
- [x] Homepage: hero search, "Tonight near me", featured destinations, value section
- [x] Destination combobox with keyboard support. _Verified by E2E keyboard test_
- [x] Search results page: summary, sort, filter sidebar/drawer, cards, pagination
- [x] Property page: gallery, facts, amenities, rooms, map, offers, provenance
- [x] How-it-works / data disclosure page
- [x] Loading, empty and error states on every data view
- [x] Mobile layouts. _Verified: Playwright Pixel 7 project, no horizontal overflow_

## 5. Backend

- [x] Config (Zod env), Fastify app factory, logging, helmet, CORS, rate limit
- [x] Error envelope + handler (400/404/429/503/500 generic)
- [x] `GET /api/health`, `/api/health/ready`
- [x] `GET /api/destinations`, `/api/destinations/:slug`
- [x] `GET /api/filters`
- [x] `GET /api/search`
- [x] `GET /api/properties/:slug`, `/api/properties/:slug/offers`

## 6. Database

- [x] `docker-compose.yml` (PostGIS 17-3.5) + test DB init. _Verified: container healthy, both DBs present_
- [x] Migration runner + `schema_migrations` (advisory lock, per-file transactions)
- [x] Schema: constraints, composite FKs, exclusion constraint, indexes, triggers
- [x] `quote_stay` SQL function
- [x] Deterministic seed: 40 destinations, 91 properties, 5 providers, 602 offers. _Verified by unit test (same input gives equal output)_
- [x] Seed validator: bounding box, destination radius, 30 m duplicate check, referential checks

## 7. Search and filtering

- [x] Destination and coordinate reference resolution
- [x] Filters: price, types, amenities (all-of), score, free cancellation, bedrooms, guests, radius, availability, name
- [x] Sorting: recommended, price asc/desc, score, distance, with stable tie-breaks
- [x] Count reflects the filtered set; pagination. _Verified against an independent SQL oracle_
- [x] Validation of dates (SAST today), guests, ranges, unknown parameters and slugs

## 8. Geospatial functionality

- [x] Leaflet map with price markers + clustering
- [x] Marker ↔ card selection/highlight sync. _Verified by E2E_
- [x] Tile error handling + attribution. _Verified by E2E with tiles blocked_
- [x] "Use my location" with permission handling and fallback messages
- [ ] Geolocation tested manually in a real browser with a real permission prompt. _Not automated; needs a person to grant permission_
- [x] Property page location map

## 9. Price comparison

- [x] Shared `calculateStayPrice` reference implementation. _Verified by unit tests + SQL parity over 3,000+ stays_
- [x] Offers endpoint grouped by room type with badges + recommendation reason
- [x] Unavailable rooms listed with reasons
- [x] UI breakdown: subtotal, fees, VAT included/added, total, avg/night, simulated label, generated time
- [x] Provider action dialog (no booking flow)

## 10. Testing

- [x] Unit: 62 tests (shared, API helpers, recommendation, seed)
- [x] Web unit: 19 tests (URL state, pagination, offer comparison)
- [x] Integration: 56 tests against real PostgreSQL
- [x] E2E: 19 Playwright tests (desktop, mobile, accessibility, keyboard)
- [x] Production build passes

## 11. Security

- [x] Strict query validation (unknown keys rejected)
- [x] Parameterised SQL review; `LIKE` escaping unit-tested
- [x] Generic 500s; no stack traces to the client
- [x] Helmet headers, restricted CORS, rate limit, result caps
- [x] `npm audit`: 0 vulnerabilities
- [x] `.env` untracked (`git ls-files` shows only `.env.example`)

## 12. Performance

- [x] `EXPLAIN ANALYZE` of search recorded (`docs/PERFORMANCE.md`): p95 under 10 ms locally
- [x] Map marker diffing (only changed markers are updated)
- [x] Bundle reviewed; Leaflet lazy-loaded with the map

## 13. Documentation

- [x] README: overview, features, screenshots, stack, setup, run, test, limitations, licensing
- [x] Docs synchronised with the implementation (API spec 400/404 rule corrected; performance/security report added)

## 14. GitHub preparation

- [x] Screenshots captured from the running app (`docs/screenshots/`)
- [x] Commit history in logical phases
- [x] Final audit from a fresh clone (Phase 14). _See the final report_
- [ ] Push to GitHub. _Awaiting the owner's go-ahead_

## 15. Optional future improvements ⏸

- ⏸ Saved properties (localStorage)
- ⏸ "Search this area" on map pan
- ⏸ Provider adapter for an authorised affiliate feed
- ⏸ Price history / freshness decay
- ⏸ CI workflow (GitHub Actions with a PostGIS service container)
- ⏸ Route-level code splitting (low value at the current bundle size)

## 16. Real places, scale and hardening (Phase 15)

- [x] OpenStreetMap fetch script: resumable, polite to public servers, free-licence photos only
- [x] Tag normalisation with safe website/phone/name handling (unit-tested, incl. `javascript:` links)
- [x] Real-place dataset builder: dedupe, spacing, destination assignment, honest descriptions (unit-tested)
- [x] Migration `002_real_places.sql` with `CHECK`s on website, phone, stars and OSM ids (integration-tested)
- [x] API exposes `realPlace`, photo credits and verified amenities; UI shows website, phone, OSM link and credits
- [x] Wording updated: real places vs simulated prices, providers and scores
- [x] OpenStreetMap snapshot (2,029 places → 1,742 after cleaning) loaded by `npm run db:reset`; pages checked in a browser
- [x] Search tuned for 19x data: one statement, arithmetic `quote_stay` (migration 003), booked rooms found once, `ANALYZE` after seed (`docs/PERFORMANCE.md` §1)
- [x] Response cache with request coalescing, pre-compressed bodies, ETag/304, `Cache-Control` (tested)
- [x] Multi-process mode (`API_WORKERS`), configurable pool and rate limit
- [x] Load test on real data: 2,000 concurrent connections, 0 errors, 4,891 req/s with 4 workers (`docs/PERFORMANCE.md` §3)
- [x] README screenshots retaken with real data and the compass logo
- [x] Web app security headers (CSP without inline scripts, Permissions-Policy, COOP)
- [x] `npm audit --omit=dev`: 0 vulnerabilities

## Blockers

- None. The two open items need the owner: a manual geolocation check, and approval to push.
