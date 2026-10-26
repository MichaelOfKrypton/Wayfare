# Technical Decisions (ADRs) — Wayfare

Each record follows the format: context → decision → alternatives rejected → consequences.

## ADR-001 — Monorepo with npm workspaces

- **Context:** The web app and the API share contract types, query validation and pricing rules.
- **Decision:** One repository with npm workspaces: `apps/web`, `apps/api`, `packages/shared`.
- **Rejected:**
  - Separate repositories: duplicated types, and contract drift between them.
  - pnpm, Turborepo or Nx: extra tooling for three packages, and npm ships with Node.
- **Consequences:** A single `npm install`. The shared package is consumed as TypeScript source (no build step).

## ADR-002 — Separate SPA + REST API rather than a full-stack framework

- **Context:** This is a portfolio piece that should show clear backend engineering: SQL, validation, layering and API design.
- **Decision:** A React SPA (Vite) and a Fastify JSON API.
- **Rejected:**
  - Next.js: it blurs the client/server boundary and adds framework concepts (RSC, caching) that aren't needed here.
  - Express: Fastify has better built-in logging, schema-friendly hooks, `inject()` for tests, and better performance.
- **Consequences:** Two dev servers, which `npm run dev` runs together with `concurrently`. Vite proxies `/api` in development.

## ADR-003 — PostgreSQL + PostGIS via Docker Compose

- **Context:** Geospatial radius search and distance sorting are core features. The machine has Docker Desktop but no native PostgreSQL. PostGIS on native Windows needs the EDB installer plus a Stack Builder (GUI) step.
- **Decision:** The `postgis/postgis:17-3.5` image from `docker-compose.yml`, with host port 54329 to avoid clashing with any native install, and a named volume. The native installation is documented as an alternative.
- **Rejected:**
  - SQLite/SpatiaLite: weaker geospatial and constraint support, and a less transferable skill.
  - PGlite (WASM Postgres): PostGIS support is not mature enough for the core feature.
  - Haversine-only without PostGIS: possible, but loses index-assisted radius queries.
- **Consequences:** Docker Desktop must be running. Docker Desktop is free for personal and educational use; check its terms for other uses.

## ADR-004 — Raw SQL with `pg` and a tiny migration runner (no ORM)

- **Context:** The search is one sophisticated statement (CTEs, `DISTINCT ON`, window functions, `LATERAL`, PostGIS). ORMs make that harder, not easier.
- **Decision:**
  - `pg` with parameterised queries.
  - A small `SqlBuilder` that appends fragments and binds values as `$n`.
  - Plain `.sql` migrations applied in order by a runner of about 60 lines, inside transactions, recorded in `schema_migrations`.
- **Rejected:**
  - Prisma: poor PostGIS support, and a generated client.
  - Drizzle or Kysely: viable, but they add a layer readers must learn; the SQL is the point here.
  - node-pg-migrate: fine, but it's unnecessary for forward-only SQL files.
- **Consequences:** Developers read and write SQL directly. Injection safety relies on the builder only accepting values as parameters, and identifiers (sort columns) come from a whitelist map.

## ADR-005 — Leaflet used directly (no react-leaflet)

- **Context:** react-leaflet 5 is licensed **Hippocratic-2.1** (not OSI-approved), and react-leaflet-cluster's licence field is unclear. Clustering and price markers need imperative control anyway.
- **Decision:** `leaflet` (BSD-2-Clause) + `leaflet.markercluster` (MIT), managed through a `useLeafletMap` hook and a `ResultsMap` component that diffs markers.
- **Rejected:** react-leaflet (licence ambiguity for a CV project); MapLibre GL with vector tiles (heavier, and needs a style server).
- **Consequences:** About 150 lines of integration code that we own and test.

## ADR-006 — Plain CSS with design tokens + CSS Modules

- **Context:** The UI should look distinctive rather than like a template, and its styling skill should be visible.
- **Decision:** CSS custom properties in `tokens.css`, global base styles, and component-scoped CSS Modules.
- **Rejected:** Tailwind (utility soup in a portfolio project's JSX, plus a build plugin); component kits like MUI or Chakra (generic look, heavy).
- **Consequences:** Some more CSS to write. Theming is centralised.

## ADR-007 — Stay pricing computed in SQL, mirrored in TypeScript

- **Context:** Price filters and sorting must use the same total as the offer comparison.
- **Decision:** An `IMMUTABLE` SQL function `quote_stay`, plus a TypeScript reference implementation in `@wayfare/shared` that is unit-tested and parity-tested against SQL.
- **Rejected:** Computing in TypeScript after fetching all offers, which breaks DB-side filtering, sorting and pagination.
- **Consequences:** Two implementations to keep in sync, guarded by the parity test.

## ADR-008 — URL query string as the search state

- **Decision:** Every search parameter is serialised to the URL. Forms read from and write to it. There is no global state store.
- **Consequences:** Shareable links, a working back button, and simple E2E tests.

## ADR-009 — "Rooms" modelled as minimum bedrooms in one unit

- **Context:** Multi-room allocation (splitting guests across several units) is a hard inventory problem and adds little demo value.
- **Decision:** Search takes `guests` and an optional `minBedrooms`, and each offer is for one unit.
- **Consequences:** This is documented as a limitation. A large group can filter for multi-bedroom holiday homes and lodges.

## ADR-010 — Local destination gazetteer instead of a geocoding API

- **Context:** Nominatim's policy forbids autocomplete and caps usage at 1 request per second. Commercial geocoders need keys.
- **Decision:** A `destinations` table of SA towns, suburbs and landmarks with coordinates, searched with `pg_trgm`.
- **Consequences:** It works offline and costs nothing. Only places in the gazetteer can be searched; "near me" covers the rest.

## ADR-011 — Original generated SVG imagery

- **Context:** Commercial photos aren't licensable for this use, and hotlinking stock photography needs the internet and attribution management.
- **Decision:** A deterministic script generates illustrative SVG scenes (coast, mountains, winelands, city, bushveld, forest, interiors), which are committed.
- **Consequences:** Clearly illustrative, licence-clean, tiny and offline. They are not photographs, and the UI labels them "Illustration".

## ADR-012 — No authentication

- **Context:** No feature needs user identity, since there is no booking and no saved data on the server.
- **Decision:** No login system.
- **Consequences:** A smaller attack surface. Saved properties, if ever added, would use `localStorage`.

## ADR-013 — TypeScript pinned to 6.0.x

- **Context:** TypeScript 7.0 (the native port) is `latest`, but `typescript-eslint` supports `<6.1`.
- **Decision:** Pin `typescript@~6.0.3`.
- **Consequences:** Revisit when typescript-eslint supports 7.x.

## ADR-014 — Times and dates in SAST

- **Decision:** "Today" means the current date in `Africa/Johannesburg`. Dates travel as `YYYY-MM-DD` strings and stay arithmetic uses UTC-safe integer day maths, never local `Date` parsing.
- **Consequences:** The "tonight" search is correct regardless of the machine's timezone.
