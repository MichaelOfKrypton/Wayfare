# Product Requirements — Wayfare

> Status: MVP specification. Living document — update when scope changes.

## 1. Purpose

Wayfare is an accommodation **discovery and price-comparison** web application focused on South Africa. It helps a traveller find a suitable place to stay — tonight or for a planned trip — and compare the offers that different booking providers make for the *same* property, on a like-for-like, total-stay basis.

It is a **portfolio project**. It runs entirely on a local machine, at zero cost, using a **synthetic demonstration dataset**. No offer, price, availability figure or score in the application is real, and the interface says so wherever that information appears.

## 2. Target users

| Persona | Need | What matters most |
|---|---|---|
| **Last-minute traveller** — already in a town, needs a bed tonight | Speed, proximity, certainty | Distance, tonight's availability, total price, free cancellation |
| **Holiday planner** — researching a trip weeks ahead | Choice, comparison, context | Destination exploration, filters, map, property detail |
| **Price-conscious comparer** — has a shortlist | Transparency | Total stay price, what each offer includes, conditions |
| **Reviewer / employer** (portfolio audience) | Evidence of engineering skill | Working features, tests, documentation, clean code |

## 3. User scenarios

### A — Last-minute accommodation
1. From the homepage the user chooses **"Tonight near me"** (browser geolocation, with permission) or types a town, suburb or landmark.
2. Dates default to tonight → tomorrow, in South African time (SAST).
3. They set guests, a maximum nightly budget, accommodation types and essential amenities.
4. Results are sorted by distance and appear on a map with price labels.
5. They open a property and compare its offers.

### B — Planned holiday
1. The user searches for a destination (e.g. *Knysna*), dates, guests and minimum bedrooms.
2. They refine the results by budget, demo score, type and amenities, and explore them on the map.
3. On a property page they compare offers, grouped by room type, and read the conditions.

### C — Comparing booking offers
For one property and stay, the user sees every eligible offer and can tell apart: the **property**, the **provider**, the **offer**, the **room type**, the **nightly price**, the **total stay price** (with fees and VAT broken down), the **cancellation policy**, the **meal plan**, and the offer's **data status and last-checked time**. The cheapest and the recommended offer are labelled, each with the reason it was chosen. Where offers differ materially (room, meals, cancellation), the differences are pointed out rather than hidden.

## 4. Functional requirements

### FR-1 Search
- FR-1.1 Search by destination (from an autocomplete over the local destination list: towns, suburbs, landmarks).
- FR-1.2 Search by current location (browser geolocation, opt-in), with a configurable radius.
- FR-1.3 Search across all of South Africa when no location is given.
- FR-1.4 Required stay parameters: check-in date, check-out date, guests (1–16). Optional: minimum bedrooms.
- FR-1.5 Optional free-text filter on property name.
- FR-1.6 All search state lives in the URL, so a search can be shared and survives a page reload.

### FR-2 Filtering (all combinable, all evaluated in the database)
- Nightly price range (average nightly cost of the cheapest eligible offer, including fees and VAT).
- Accommodation types (multi-select).
- Amenities (must have all selected).
- Minimum demo score.
- Free cancellation only.
- Distance radius (when a reference location exists).
- Guest capacity and minimum bedrooms.
- Availability for the selected dates (properties with no eligible offer are excluded).

### FR-3 Sorting
Recommended (documented formula), price low→high, price high→low, demo score, and distance (only when a reference location exists). Pagination stays stable under every sort order.

### FR-4 Results
- A summary of destination, dates, guests and match count. The count reflects the filtered data in the database.
- Property cards: image, name, type, location, demo score and count (or "Not yet rated"), key amenities, the cheapest total stay price with the nightly average, the number of offers and providers, and a link to the details page.
- A synchronised map: price-labelled markers, clustering, marker ↔ card highlighting, zoom and pan.
- Loading, empty (with suggestions for loosening the search) and error states.
- On mobile, a list/map toggle and a filter drawer.

### FR-5 Property details
Image gallery, description, location map, amenities grouped by category, room types with their capacity, check-in and check-out times, a data provenance panel, and an offer comparison for the selected dates and guests (which can be changed on the page).

### FR-6 Price comparison
- Offers are grouped by room type and show nightly average, room subtotal, fees, VAT (included or added) and total.
- Cheapest and recommended badges, each with the reason.
- The cancellation policy and meal plan are shown on every offer.
- Every offer is labelled **Simulated** and shows its generation time.
- The provider action opens an explanatory dialog. There is no booking flow and no payment.

### FR-7 Transparency
- A persistent demo-data notice.
- A "How Wayfare works" page that explains the data, the pricing formula and the ranking formula.

## 5. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Cost | R0. No paid services, keys or subscriptions. |
| NFR-2 | Local-first | Runs on Windows. Core features work offline once installed (map tiles excepted). |
| NFR-3 | Performance | p95 search API < 300 ms on the demo dataset locally; first contentful paint < 2 s locally. |
| NFR-4 | Accessibility | WCAG 2.2 AA intent: keyboard operable, visible focus, labelled controls, AA contrast, a list alternative to the map. |
| NFR-5 | Security | Validated input, parameterised SQL, generic client errors, no secrets in Git, security headers, rate limiting. |
| NFR-6 | Responsiveness | Usable from 360 px to 1920 px. |
| NFR-7 | Maintainability | TypeScript strict mode, linting, separated layers, documented decisions. |
| NFR-8 | Testability | Unit, integration (real PostgreSQL) and E2E (Playwright) suites. |
| NFR-9 | Honesty | No data is presented as live, real or verified. |

## 6. MVP scope

In scope: FR-1 to FR-7, the synthetic dataset (~90 properties across ~15 destinations), the documentation set, and the test suites.

## 7. Out of scope (MVP)

- Booking, payment, user accounts and authentication (no requirement justifies them).
- Live commercial inventory or price integrations, and any scraping.
- External geocoding (the local destination list is used instead).
- Reviews and review text (only an aggregate *synthetic* score exists).
- Multi-currency (prices are in ZAR only).
- Saved properties and price alerts (possible future improvements).
- Multi-room bookings: "rooms" is modelled as *minimum bedrooms* in a single unit (see ADR-009).

## 8. Acceptance criteria (MVP)

1. A clean checkout can be set up and run from the README alone, on Windows.
2. `npm run db:reset` migrates and seeds the database deterministically.
3. Searching *Cape Town*, 2 guests, tonight, returns only properties that can host 2 guests and are available tonight, and the count matches the list.
4. Every filter changes the results, filters combine correctly, and invalid parameters return a 400 with a readable message.
5. Every sort order yields correctly ordered, stable pages.
6. Selecting a marker highlights its card and vice versa.
7. The offer comparison totals match the documented formula (unit tested and cross-checked against SQL).
8. Every price and score in the UI carries a demo or simulated label.
9. The unit, integration and E2E suites pass, and the production build succeeds.
10. No secrets are tracked by Git.

## 9. Known limitations

- The data is synthetic. Coordinates are plausible but approximate, and the properties are fictional.
- Availability is simulated by deterministic blocks generated relative to the seed's reference date.
- Map tiles need an internet connection and are subject to the tile provider's policy.
- Geolocation needs browser permission and a secure context (`localhost` qualifies).
