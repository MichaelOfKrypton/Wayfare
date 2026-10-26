# Required APIs, Services & Configuration

> Living register. Last reviewed: **2026-10-26**.
>
> **No external API credentials are required to run the core local demonstration.**
> Search, filtering, sorting, property details and price comparison all run against the local PostgreSQL database. Only the background **map tiles** need an internet connection, and those use no key.

---

## A. Required local configuration

Copy `.env.example` to `.env` at the repository root. The defaults work as-is with `docker-compose.yml`.

| Variable                | Purpose                                                             | Mandatory                            | Secret                    | Source                                         | Cost | Status     | Example                                                                                   |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------ | ------------------------- | ---------------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | API connection string for the dev database                          | Yes                                  | Local-only dev credential | `docker-compose.yml`                           | Free | Configured | `postgres://wayfare:wayfare_dev@localhost:54329/wayfare`                                  |
| `TEST_DATABASE_URL`     | Database used by integration and E2E tests (dropped and reseeded)   | For tests                            | Local-only                | Created by `docker/init/01-create-test-db.sql` | Free | Configured | `postgres://wayfare:wayfare_dev@localhost:54329/wayfare_test`                             |
| `API_PORT`              | API listen port                                                     | No (default 4000)                    | No                        | —                                              | Free | Configured | `4000`                                                                                    |
| `API_HOST`              | API bind address                                                    | No (default `127.0.0.1`)             | No                        | —                                              | Free | Configured | `127.0.0.1`                                                                               |
| `NODE_ENV`              | `development` / `test` / `production`                               | No (default `development`)           | No                        | —                                              | Free | Configured | `development`                                                                             |
| `LOG_LEVEL`             | pino log level                                                      | No (default `info`)                  | No                        | —                                              | Free | Configured | `info`                                                                                    |
| `CORS_ORIGIN`           | Allowed browser origin for direct API calls                         | No (default `http://localhost:5173`) | No                        | —                                              | Free | Configured | `http://localhost:5173`                                                                   |
| `SEED_REFERENCE_DATE`   | Anchor date for synthetic availability and freshness (`YYYY-MM-DD`) | No (default: today in SAST)          | No                        | —                                              | Free | Configured | `2026-10-26`                                                                              |
| `VITE_API_PROXY_TARGET` | Where the Vite dev server proxies `/api`                            | No (default `http://localhost:4000`) | No                        | —                                              | Free | Configured | `http://localhost:4000`                                                                   |
| `VITE_MAP_TILE_URL`     | Raster tile URL template                                            | No (default OSM standard)            | No                        | See §B                                         | Free | Configured | `https://tile.openstreetmap.org/{z}/{x}/{y}.png`                                          |
| `VITE_MAP_ATTRIBUTION`  | HTML attribution for the tile layer                                 | No (default OSM attribution)         | No                        | See §B                                         | Free | Configured | `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors` |

The Docker Compose database credentials (`wayfare` / `wayfare_dev`) are **non-secret development defaults**. The container binds to `localhost` only. Do not reuse them anywhere else.

**Database initialisation commands:**

| Command                | Effect                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `docker compose up -d` | Starts PostGIS and creates the `wayfare` and `wayfare_test` databases on first start |
| `npm run db:migrate`   | Applies pending SQL migrations                                                       |
| `npm run db:seed`      | Truncates and seeds the deterministic synthetic dataset                              |
| `npm run db:reset`     | Drops and recreates the schema, then migrates and seeds                              |

---

## B. External API / service register

| Service                                                     | Purpose                   | Required?                      | Local alternative                                         | Credentials                                                        | Acquisition                                                      | Cost                                                    | Restrictions                                                                                                                                                      | Status                 | Verification                                                                  |
| ----------------------------------------------------------- | ------------------------- | ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| **Leaflet 1.9.4** (npm library)                             | Interactive map rendering | Required (bundled)             | n/a, runs in the browser                                  | None                                                               | https://leafletjs.com · npm                                      | Free, BSD-2-Clause                                      | Licence notice in bundle                                                                                                                                          | Configured             | The map renders on `/search`                                                  |
| **leaflet.markercluster 1.5.3**                             | Marker clustering         | Required (bundled)             | n/a                                                       | None                                                               | npm                                                              | Free, MIT                                               | —                                                                                                                                                                 | Configured             | Clusters appear when zoomed out                                               |
| **OpenStreetMap standard tiles** (`tile.openstreetmap.org`) | Background map imagery    | Optional (map background only) | The list view works fully; a notice shows when tiles fail | None (no key)                                                      | https://operations.osmfoundation.org/policies/tiles/             | Free, donation-funded, **no SLA**                       | See the notes below                                                                                                                                               | Configured (default)   | Tiles load. Turn off the network → the "Map tiles unavailable" notice appears |
| **Browser Geolocation API**                                 | "Tonight near me"         | Optional                       | Manual destination search (always available)              | None                                                               | https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API | Free                                                    | Secure context only; `http://localhost` qualifies. User permission prompt required                                                                                | Configured             | Click "Use my location" → permission prompt → results sorted by distance      |
| **Nominatim** (OSM geocoder)                                | Free-text geocoding       | **Not used**                   | Local `destinations` gazetteer (ADR-010)                  | —                                                                  | https://operations.osmfoundation.org/policies/nominatim/         | Free                                                    | Max 1 req/s across _all_ users. **No autocomplete**. No systematic queries. Must be switchable off. Attribution required. Code suggesting it must link the policy | Investigated, rejected | —                                                                             |
| **OpenFreeMap**                                             | Alternative tiles         | Not needed                     | —                                                         | None                                                               | https://openfreemap.org/                                         | Free, no key                                            | **Vector tiles only** (needs MapLibre GL, not Leaflet raster)                                                                                                     | Investigated           | —                                                                             |
| **CARTO basemaps**                                          | Alternative raster tiles  | Not needed                     | —                                                         | **API key now required** (watermark without)                       | https://carto.com/legal/basemap-terms/                           | Free tier 5M req/month non-commercial                   | Prominent attribution                                                                                                                                             | Investigated           | —                                                                             |
| **Stadia Maps**                                             | Alternative raster tiles  | Not needed                     | —                                                         | None on `localhost` (strict rate limit); key/domain auth otherwise | https://stadiamaps.com/pricing/                                  | Free plan 200k credits/month, **non-commercial only**   | Attribution required (wording unverified)                                                                                                                         | Investigated           | —                                                                             |
| **MapTiler Cloud Free**                                     | Alternative tiles         | Not needed                     | —                                                         | API key required                                                   | https://www.maptiler.com/cloud/pricing/                          | Free: 100k requests, 5k sessions/month, pauses at quota | Logo required, non-commercial                                                                                                                                     | Investigated           | —                                                                             |
| **Analytics**                                               | —                         | **Not used**                   | —                                                         | —                                                                  | —                                                                | —                                                       | Not justified for a local demo                                                                                                                                    | Not needed             | —                                                                             |

**OSM tile usage policy, and how Wayfare complies with each point:**

- **Attribution:** "© OpenStreetMap contributors" with a link to `/copyright` is always visible, and nothing covers it.
- **No bulk download or prefetching:** Wayfare requests only the tiles the browser needs, with no offline caching.
- **Caching:** the browser's default caching is used, with no `no-cache` headers.
- **HTTPS:** tiles are requested over HTTPS.
- **Referer:** sent by the browser, not stripped (no restrictive Referrer-Policy is set for tile requests).
- **Requests:** none are server-side, so no User-Agent is needed.
- **Blocking:** service can be withdrawn without notice. For heavier use, switch `VITE_MAP_TILE_URL` to another provider or self-host tiles.

---

## C. Future accommodation integrations (not implemented)

None of these is used. **No scraping of any provider is permitted.** Real photos or prices may only be shown under an approved agreement.

| Provider                                    | Official API?                                                                  | Portfolio/demo use?         | Approval                                                                                       | Commercial agreement   | Photos & prices                       | Outbound links       | Cost         | Free option                  |
| ------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------- | -------------------- | ------------ | ---------------------------- |
| **Expedia Group — Rapid API**               | Yes (https://developers.expediagroup.com/rapid/setup)                          | Unlikely (inference)        | Approved partner only. Keys stay in restricted dev mode until a site review and BDM enablement | Yes, partner agreement | Per agreement (unverified)            | Per agreement        | Unverified   | No                           |
| **Booking.com Affiliate Partner Programme** | Links/widgets (via CJ)                                                         | Possibly, for links only    | Application required                                                                           | Affiliate terms        | Widgets only                          | Yes, affiliate links | Free to join | Links only                   |
| **Booking.com Demand API**                  | Yes (https://developers.booking.com/demand/docs/getting-started/prerequisites) | Unlikely                    | Managed Affiliate Partner with a signed contract; Account Manager grants keys                  | Yes                    | Under contract                        | Under contract       | Unverified   | No                           |
| **Airbnb**                                  | No public API; approved software partners only                                 | No                          | Reportedly not accepting new requests (third-party source, **unverified**)                     | —                      | —                                     | —                    | —            | No                           |
| **Travelpayouts** (affiliate network)       | Network API; the **Hotellook hotel API closed 20 Oct 2025**                    | Possibly (open application) | Application                                                                                    | Affiliate terms        | Current hotel data API **unverified** | Affiliate links      | Free to join | Unverified                   |
| **LekkeSlaap** (Tripco (Pty) Ltd)           | No public API or affiliate programme found                                     | —                           | Contact directly                                                                               | —                      | —                                     | —                    | —            | None public (**unverified**) |

**Before building any adapter:**

1. Confirm in writing that the intended use is authorised.
2. Record the credentials' variable names here, marked secret.
3. Add the adapter behind a feature flag.
4. Label its offers `data_status='cached'`/`'live'` with real `last_checked_at`.

---

## D. Environment files

- `.env.example`: committed, placeholders and safe dev defaults only.
- `.env`, `.env.*` (except `.env.example`): gitignored.
- No credential of any kind is required for the MVP.

---

## E. Checklist

- [x] Local database configured (`docker compose up -d`). Verified: PostgreSQL 17.5, PostGIS 3.5.2, `wayfare` + `wayfare_test`
- [x] Database schema applied (`npm run db:migrate`)
- [x] Demonstration dataset seeded (`npm run db:seed`): 91 properties, 602 offers
- [x] Map works with the chosen tile source (OSM standard). Verified in screenshots; E2E blocks tiles to check the offline notice
- [x] External map-service limitations documented (§B)
- [ ] Optional geolocation tested (manual check on `localhost`). Error handling is implemented; a real permission prompt still needs a person to test it
- [x] No paid credentials required for core functionality
- [x] No secrets committed (verified with `git ls-files`, 2026-10-26)
- [x] Future provider integrations documented (§C)
