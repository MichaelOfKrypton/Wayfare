# TODO — Wayfare master checklist

Legend: `[x]` done **and verified** · `[ ]` open · `[~]` in progress · `⛔` blocked · `⏸` deferred.
A box is ticked only after the stated verification has been run.

## 1. Planning
- [x] Phase 0 repository inspection (remote: `MichaelOfKrypton/Wayfare`; README only; Node 24.18, npm 11.16, Docker 29.5, no native PostgreSQL)
- [x] Product requirements (`docs/PRODUCT_REQUIREMENTS.md`)
- [x] Risk register (`docs/RISK_REGISTER.md`)
- [x] External services researched and registered (`REQUIRED APIS.md`)

## 2. Architecture
- [x] Architecture document (`docs/ARCHITECTURE.md`)
- [x] Database design + Mermaid ERD (`docs/DATABASE_DESIGN.md`)
- [x] API specification (`docs/API_SPECIFICATION.md`)
- [x] ADRs (`docs/TECHNICAL_DECISIONS.md`)
- [ ] Monorepo scaffold: workspaces, TypeScript strict, ESLint, Prettier, root scripts — *verify: `npm run typecheck && npm run lint` pass*

## 3. Design system
- [x] Design system document (`docs/DESIGN_SYSTEM.md`)
- [ ] `tokens.css` + global styles implemented
- [ ] Core primitives: Button, IconButton, Field inputs, Chip, Badge, RatingPill, Price, Dialog, Skeleton, Empty/Error states
- [ ] Generated demo illustrations (SVG) committed

## 4. Frontend
- [ ] App shell: header, footer, demo notice, routing, 404
- [ ] Homepage: hero search, "Tonight near me", featured destinations, how-it-works teaser
- [ ] Destination combobox with keyboard support (ARIA combobox)
- [ ] Search results page: summary bar, sort, filter sidebar/drawer, cards, pagination
- [ ] Property page: gallery, facts, amenities, rooms, map, offers, provenance
- [ ] How-it-works / data disclosure page
- [ ] Loading / empty / error states on every data view
- [ ] Mobile layouts (360 px) for all pages — *verify with Playwright mobile project*

## 5. Backend
- [ ] Config (Zod env), Fastify app factory, logging, helmet, CORS, rate limit
- [ ] Error envelope + handler (validation, not found, 503, 500 generic)
- [ ] `GET /api/health`, `/api/health/ready`
- [ ] `GET /api/destinations`, `/api/destinations/:slug`
- [ ] `GET /api/filters`
- [ ] `GET /api/search`
- [ ] `GET /api/properties/:slug`, `/api/properties/:slug/offers`

## 6. Database
- [ ] `docker-compose.yml` with PostGIS 17-3.5 and test DB init — *verify: `docker compose up -d` healthy*
- [ ] Migration runner + `schema_migrations`
- [ ] Schema migration (tables, constraints, indexes, triggers)
- [ ] `quote_stay` SQL function
- [ ] Deterministic seed (~15 destinations, ~90 properties, 5 providers) — *verify: re-running produces identical row checksums*
- [ ] Seed validator (bounding box, radius, 30 m duplicate check)

## 7. Search and filtering
- [ ] Destination and coordinate reference resolution
- [ ] Filters: price range, types, amenities (all-of), min score, free cancellation, bedrooms, guests, radius, availability
- [ ] Sorting: recommended, price asc/desc, score, distance; stable tie-breaks
- [ ] Count reflects the filtered set; pagination
- [ ] Validation of dates (SAST today), guests, ranges, unknown slugs

## 8. Geospatial functionality
- [ ] Leaflet map with price markers + clustering
- [ ] Marker ↔ card selection/highlight sync
- [ ] Tile error handling + attribution
- [ ] "Use my location" with permission handling and fallback
- [ ] Property page location map

## 9. Price comparison
- [ ] Shared `calculateStayPrice` reference implementation
- [ ] Offers endpoint grouped by room type with badges + recommendation reason
- [ ] Unavailable rooms listed with reasons
- [ ] UI: breakdown (subtotal, fees, VAT included/added, total, avg/night), simulated label, last-checked time
- [ ] Provider action dialog (no booking flow)

## 10. Testing
- [ ] Unit: pricing, dates/clock, geo, format, schema validation, SQL builder, ranking
- [ ] Unit (web): URL-state mapping, key components
- [ ] Integration: every endpoint, combined filters, pagination, sorting, errors, SQL↔TS price parity
- [ ] E2E (Playwright): search flow, filters, sort, map↔card, property + offers, mobile, invalid input
- [ ] Production build passes

## 11. Security
- [ ] Strict query validation (unknown keys rejected)
- [ ] Parameterised SQL review (no string-interpolated values)
- [ ] Generic 500s; no stack traces to client
- [ ] Helmet headers, CORS restricted, rate limit, result caps
- [ ] `npm audit` reviewed
- [ ] `.env` untracked; `git ls-files` secret check

## 12. Performance
- [ ] `EXPLAIN ANALYZE` of search recorded (`docs/PERFORMANCE.md`)
- [ ] Map marker diffing (no re-creation on hover)
- [ ] Bundle size reviewed; Leaflet lazy-loaded with the map

## 13. Documentation
- [ ] README: overview, features, screenshots, stack, setup, run, test, limitations, licensing
- [ ] Docs synchronised with implementation (final pass)

## 14. GitHub preparation
- [ ] Screenshots captured from the running app
- [ ] Clean commit history in logical phases
- [ ] Final audit from a fresh clone (Phase 14)

## 15. Optional future improvements ⏸
- ⏸ Saved properties (localStorage)
- ⏸ "Search this area" on map pan
- ⏸ Provider adapter for an authorised affiliate feed
- ⏸ Price history / freshness decay
- ⏸ CI workflow (GitHub Actions with a PostGIS service container)

## Blockers
- None currently.
