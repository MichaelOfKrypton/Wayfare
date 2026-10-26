# API Specification — Wayfare

Base URL (local): `http://localhost:4000/api`. In development the web app proxies `/api` to this address.
All responses are JSON (`application/json; charset=utf-8`). The only method is `GET`, because the API is read-only.
Money is always **integer cents in ZAR** (`…Cents` fields), plus a `currency: "ZAR"` field where relevant.
Dates are `YYYY-MM-DD`, in South African Standard Time (SAST, UTC+2). Timestamps are ISO 8601 UTC.

## 1. Conventions

### Pagination

`page` (≥ 1, default 1) and `pageSize` (1–50, default 20). Responses include:

```json
"pagination": { "page": 1, "pageSize": 20, "totalItems": 37, "totalPages": 2 }
```

A `page` beyond `totalPages` returns an empty `items` array, not an error.

### Arrays in query strings

Arrays are comma-separated: `types=guesthouse,lodge&amenities=wifi,pool`. Unknown slugs are a 400 error. They are never silently ignored, because that would make a filter look broken.

### Limits

Unknown query parameters are rejected (400). This catches typos like `maxPrise`. Rate limit: 300 requests per minute per IP (local default, `RATE_LIMIT_PER_MINUTE`).

### Caching

Read responses carry an `ETag` and `Cache-Control` (`max-age=300` for filters and destinations, `max-age=30` for everything else). A request with a matching `If-None-Match` gets `304 Not Modified` with no body. Errors and health checks are `no-store`. Bodies over 1 kB are Brotli- or gzip-compressed when the client sends `Accept-Encoding`. The server shares one cached result between identical requests for `API_CACHE_TTL_MS` (default 30 s).

## 2. Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check-out must be after check-in.",
    "issues": [{ "path": "checkOut", "message": "Check-out must be after check-in." }],
    "requestId": "req-1a"
  }
}
```

| HTTP | `code`                | When                                                                                                                                                                         |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Malformed or out-of-range parameters, or a business-rule violation (past dates, distance sort with no reference point)                                                       |
| 404  | `NOT_FOUND`           | Unknown resource in the **path** (`/properties/:slug`, `/destinations/:slug`) or unknown route. Unknown slugs in **query parameters** (e.g. `destination`, `types`) are 400s |
| 429  | `RATE_LIMITED`        | Rate limit exceeded                                                                                                                                                          |
| 503  | `SERVICE_UNAVAILABLE` | Database unreachable                                                                                                                                                         |
| 500  | `INTERNAL_ERROR`      | Unexpected. The message is generic; details are server-log only                                                                                                              |

## 3. Endpoints

### `GET /api/health`

Liveness. Always `200 { "status": "ok" }` if the process is up.

### `GET /api/health/ready`

Readiness. `200 { "status": "ready", "database": "ok" }`, or `503` when `SELECT 1` fails.

### `GET /api/destinations`

Destination autocomplete and listing.

| Param      | Type        | Notes                                                                    |
| ---------- | ----------- | ------------------------------------------------------------------------ |
| `q`        | string 1–80 | Optional. Trigram + prefix match on name; landmarks and suburbs included |
| `featured` | `true`      | Optional. Only featured destinations, with property counts               |
| `limit`    | int 1–20    | Default 8                                                                |

```json
{
  "items": [
    {
      "slug": "knysna",
      "name": "Knysna",
      "kind": "town",
      "province": "Western Cape",
      "parentName": null,
      "lat": -34.0363,
      "lng": 23.0471,
      "searchRadiusKm": 12,
      "propertyCount": 6,
      "summary": "…",
      "imageUrl": "/images/demo/…"
    }
  ]
}
```

### `GET /api/destinations/:slug`

A single destination (same shape), or 404.

### `GET /api/filters`

The values the filter UI needs.

```json
{
  "propertyTypes": [{ "slug": "guesthouse", "name": "Guesthouse", "propertyCount": 18 }],
  "amenities": [{ "slug": "wifi", "name": "Wi-Fi", "category": "essentials", "isEssential": true }],
  "priceBounds": { "minNightlyCents": 45000, "maxNightlyCents": 850000, "currency": "ZAR" },
  "sortOptions": ["recommended", "price_asc", "price_desc", "rating_desc", "distance_asc"]
}
```

### `GET /api/search`

The core search. Returns properties that have **at least one eligible offer** for the stay.

| Param                  | Type           | Required | Rules                                                                                                           |
| ---------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `checkIn`              | date           | yes      | ≥ today (SAST), ≤ today + 365                                                                                   |
| `checkOut`             | date           | yes      | > `checkIn`; stay ≤ 30 nights                                                                                   |
| `guests`               | int            | yes      | 1–16                                                                                                            |
| `destination`          | slug           | no       | Mutually exclusive with `lat`/`lng`                                                                             |
| `lat`, `lng`           | number         | no       | Both or neither; must be inside South Africa's bounding box                                                     |
| `radiusKm`             | number         | no       | 1–200. Default: the destination's own radius, or 25 for a coordinate search. Ignored without a reference point  |
| `q`                    | string         | no       | 1–80 characters; matches property name (case-insensitive)                                                       |
| `minBedrooms`          | int            | no       | 0–10                                                                                                            |
| `minPrice`, `maxPrice` | int (rand)     | no       | ≥ 0. Applies to the **average nightly price including fees and VAT**; `minPrice ≤ maxPrice`                     |
| `types`                | slug list      | no       | Property type slugs                                                                                             |
| `amenities`            | slug list      | no       | Must have **all** of them                                                                                       |
| `minRating`            | number         | no       | 0–10. Properties without a score are excluded when set                                                          |
| `freeCancellation`     | `true`/`false` | no       | Only offers with free cancellation are considered                                                               |
| `sort`                 | enum           | no       | `recommended` (default), `price_asc`, `price_desc`, `rating_desc`, `distance_asc` (only with a reference point) |
| `page`, `pageSize`     | int            | no       | See §1                                                                                                          |

Response:

```json
{
  "items": [
    {
      "id": 12,
      "slug": "fynbos-ridge-guesthouse-knysna",
      "name": "Fynbos Ridge Guesthouse",
      "propertyType": { "slug": "guesthouse", "name": "Guesthouse" },
      "destinationName": "Knysna",
      "suburb": "Paradise",
      "province": "Western Cape",
      "lat": -34.03,
      "lng": 23.05,
      "distanceKm": 1.8,
      "rating": { "score": 8.6, "count": 214, "label": "Synthetic demo score" },
      "coverImage": { "url": "/images/demo/forest-2.svg", "alt": "…" },
      "keyAmenities": [{ "slug": "wifi", "name": "Wi-Fi" }],
      "bestOffer": {
        "offerId": 301,
        "providerName": "Kopano Stays",
        "roomTypeName": "Garden Suite",
        "nights": 2,
        "totalCents": 318000,
        "averageNightlyCents": 159000,
        "cancellationPolicy": "free",
        "mealPlan": "breakfast",
        "dataStatus": "simulated"
      },
      "offerCount": 4,
      "providerCount": 3,
      "maxGuests": 4
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 6, "totalPages": 1 },
  "mapPoints": [
    {
      "id": 12,
      "slug": "…",
      "name": "…",
      "lat": -34.03,
      "lng": 23.05,
      "averageNightlyCents": 159000
    }
  ],
  "mapPointsTruncated": false,
  "reference": {
    "kind": "destination",
    "label": "Knysna",
    "lat": -34.036,
    "lng": 23.047,
    "radiusKm": 12
  },
  "stay": { "checkIn": "2026-10-26", "checkOut": "2026-10-28", "nights": 2, "guests": 2 },
  "dataNotice": "All properties, prices and scores are synthetic demonstration data."
}
```

`reference` is `null` for a nationwide search, and then `distanceKm` is `null`.

**Recommended ranking:** `score = 0.45·R + 0.35·(1 − Pp) + 0.20·(1 − Dp)`, where:

- `R` is the demo score divided by 10, or 0.6 when the property has no score.
- `Pp` is the percentile rank of the nightly price within the result set.
- `Dp` is the percentile rank of the distance within the result set. Without a reference point its weight is redistributed: `0.55·R + 0.45·(1 − Pp)`.

Ties are broken by `id`.

### `GET /api/properties/:slug`

Property details (no prices). Returns 404 if the slug is unknown.

```json
{
  "id": 12, "slug": "…", "name": "…", "propertyType": {…}, "summary": "…", "description": "…",
  "destination": { "slug": "knysna", "name": "Knysna", "province": "Western Cape" },
  "suburb": "Paradise", "streetAddress": "…", "lat": -34.03, "lng": 23.05,
  "checkIn": { "from": "14:00", "until": "20:00" }, "checkOut": { "until": "10:00" },
  "images": [{ "url": "…", "alt": "…", "credit": "A. Author · CC BY-SA 4.0 · Wikimedia Commons" | null, "creditUrl": "https://commons.wikimedia.org/wiki/File:…" | null }],
  "amenities": [{ "slug": "wifi", "name": "Wi-Fi", "category": "essentials", "verified": true }],
  "roomTypes": [{ "id": 40, "name": "Garden Suite", "maxGuests": 2, "bedrooms": 1, "bathrooms": 1, "beds": "1 queen bed", "description": "…" }],
  "rating": {…} | null,
  "providers": [{ "slug": "kopano-stays", "name": "Kopano Stays", "kind": "ota" }],
  "dataSource": { "code": "synthetic-demo", "name": "Wayfare synthetic dataset", "kind": "synthetic" },
  "isDemo": false,
  "realPlace": {
    "websiteUrl": "https://example.co.za/" | null,
    "phone": "+27 21 555 0100" | null,
    "stars": 4 | null,
    "osmUrl": "https://www.openstreetmap.org/node/123456"
  } | null
}
```

- `isDemo` is `true` for fictional properties, and `realPlace` is then `null`.
- `verified` amenities are confirmed by OpenStreetMap tags; the others are simulated.
- `credit`/`creditUrl` are set for third-party photos and `null` for Wayfare's own illustrations.
- Search results' `coverImage` and destinations' `imageCredit` (`{ "text", "url" } | null`) follow the same rule.

### `GET /api/properties/:slug/offers`

The offer comparison for a stay.

| Param                           | Rules           |
| ------------------------------- | --------------- |
| `checkIn`, `checkOut`, `guests` | As in `/search` |

```json
{
  "stay": { "checkIn": "…", "checkOut": "…", "nights": 2, "guests": 2 },
  "summary": {
    "eligibleCount": 5, "cheapestOfferId": 301, "recommendedOfferId": 304,
    "recommendationReason": "Free cancellation for R120 more than the cheapest offer (within 10%).",
    "priceSpreadCents": 42000
  },
  "groups": [{
    "roomType": { "id": 40, "name": "Garden Suite", "maxGuests": 2, "bedrooms": 1 },
    "offers": [{
      "id": 301, "provider": { "slug": "…", "name": "…", "kind": "ota" },
      "mealPlan": "room_only", "cancellationPolicy": "non_refundable", "freeCancellationHours": null,
      "price": { "nights": 2, "weekendNights": 1, "roomSubtotalCents": 300000, "feesCents": 18000,
                 "feeLabel": "Cleaning fee", "taxCents": 41478, "taxIncluded": true,
                 "totalCents": 318000, "averageNightlyCents": 159000, "currency": "ZAR" },
      "badges": ["cheapest"],
      "dataStatus": "simulated", "lastCheckedAt": "2026-10-26T06:12:00Z",
      "exampleUrl": null
    }]
  }],
  "unavailable": [{ "roomTypeName": "Family Cottage", "reason": "booked_for_dates" | "too_small" | "min_nights", "minNights": 3 }]
}
```

Offers with `status = 'suspended'` never appear. When the property exists but no offer is eligible, `groups` is empty, `summary.eligibleCount = 0` and the response is still `200`.

**Recommended offer rule:** take the cheapest offer that has free cancellation if its total is within 10% of the overall cheapest. Otherwise take the overall cheapest. The reason string states which rule applied.
