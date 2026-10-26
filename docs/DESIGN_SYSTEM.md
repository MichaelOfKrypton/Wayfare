# Design System — Wayfare

The design direction is **editorial travel**: calm and confident, with the information density of a comparison tool and the warmth of a travel magazine. The palette is deep navy on warm sand neutrals, with one restrained ochre accent. A serif display face carries the headings and a neutral sans carries the UI.

All tokens live in `apps/web/src/styles/tokens.css` as CSS custom properties. Components never hard-code colours, spacing or radii.

## 1. Colour

| Token | Value | Use |
|---|---|---|
| `--color-navy-900` | `#0B1F35` | Header, footer, dark surfaces |
| `--color-navy-700` | `#12355B` | **Primary brand**, primary buttons, links |
| `--color-navy-600` | `#1C4A7A` | Primary hover |
| `--color-navy-100` | `#DCE6F2` | Selected / hover tints |
| `--color-navy-50` | `#EFF4FA` | Subtle info surfaces |
| `--color-ochre-600` | `#B0521C` | **Accent**: cheapest badge, selected marker, key highlights (4.9:1 on white) |
| `--color-ochre-100` | `#F8E6D9` | Accent tint |
| `--color-sand-50` | `#FAF8F4` | Page background |
| `--color-sand-100` | `#F3EFE7` | Secondary surfaces, sidebar |
| `--color-sand-200` | `#E6E0D4` | Borders / dividers |
| `--color-surface` | `#FFFFFF` | Cards, inputs |
| `--color-ink` | `#14202E` | Body text (15.9:1 on sand-50) |
| `--color-ink-muted` | `#55606E` | Secondary text (6.0:1 on sand-50) |
| `--color-success-700` / `-100` | `#1D6B4F` / `#DDF1E8` | Free cancellation, available |
| `--color-warning-700` / `-100` | `#7A4B00` / `#FCEFD2` | Demo / simulated notices |
| `--color-danger-700` / `-100` | `#A3261B` / `#FBE3E0` | Errors, non-refundable |

**Rules:**
- Status is **never** conveyed by colour alone: badges carry text and an icon.
- Body-text contrast is ≥ 4.5:1 and UI component boundaries ≥ 3:1.

## 2. Typography

| Token | Value |
|---|---|
| `--font-display` | `"Fraunces Variable", Georgia, serif`: page titles, property names, section headings |
| `--font-sans` | `"Inter Variable", system-ui, sans-serif`: everything else |
| Scale (`--text-*`) | xs 12 · sm 14 · base 16 · md 18 · lg 20 · xl 24 · 2xl 30 · 3xl 38 · 4xl 48 (px) |
| Line height | 1.5 body · 1.2 headings |
| Weights | 400 body · 500 UI labels · 600 emphasis/prices · Fraunces 500–600 headings |

Prices use `font-variant-numeric: tabular-nums` so figures align in comparison tables. The minimum text size is 12 px, used only for meta labels.

## 3. Spacing, radii, elevation

- **Spacing** (`--space-*`, 4 px base): 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80.
- **Radii:** `--radius-sm` 4 (inputs, chips) · `--radius-md` 8 (buttons, cards) · `--radius-lg` 12 (panels, dialogs) · `--radius-pill`. Rounding is deliberately modest.
- **Borders:** `1px solid var(--color-sand-200)` is the default separator. Prefer borders over shadows.
- **Shadows:** `--shadow-sm` (cards at rest, barely visible), `--shadow-md` (hover / sticky bars), `--shadow-lg` (dialogs, map popovers). All tinted navy at low alpha.
- **Motion:** 150 ms ease-out for hover and focus, 200 ms for drawers. Everything is disabled under `prefers-reduced-motion`.

## 4. Layout & breakpoints

| Name | Min width | Behaviour |
|---|---|---|
| base | 0 | Single column, 16 px gutters, filter drawer, list/map toggle |
| `sm` | 640 px | Wider cards (image left) |
| `md` | 768 px | Two-column property page sections |
| `lg` | 1024 px | Search: filter sidebar + list. The map is behind a toggle |
| `xl` | 1280 px | Search: filters · list · sticky map (three panes) |

The content max width is 1200 px (marketing pages) and full-bleed for the search workspace. Breakpoints are applied with `min-width` media queries (mobile-first).

## 5. Components

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (navy), `secondary` (outline), `ghost`, `accent`. Sizes `sm`/`md`/`lg`. Always a real `<button>` or `<a>`. Loading state keeps width |
| `IconButton` | Requires `aria-label` |
| `Field` / `TextInput` / `Select` / `DateInput` / `Stepper` | A label is always rendered; error text is linked by `aria-describedby` |
| `Chip` / `ToggleChip` | Filter toggles use `aria-pressed` |
| `Badge` | Variants `cheapest`, `recommended`, `success`, `neutral`, `simulated`. Icon + text |
| `RatingPill` | Score + count + "Demo score" label; "Not yet rated" when null |
| `Price` | Formats cents → `R 1 590` (en-ZA). Shows the "total for N nights" / "avg per night" context |
| `PropertyCard` | Image, type eyebrow, name (display font), location, rating, amenities, price block, CTA. `selected` / `highlighted` states |
| `SearchBar` | Destination combobox (ARIA 1.2 pattern), dates, guests, submit; compact variant for the results header |
| `FilterPanel` | Sections: Budget, Type, Amenities, Score, Cancellation, Bedrooms, Distance. Sidebar on lg+, drawer on mobile |
| `ResultsMap` | Leaflet; price-pill markers; clustering; tile-error notice |
| `OfferComparison` | Groups per room type; offer rows with provider, meal plan, cancellation, price breakdown, badges |
| `Dialog` | Native `<dialog>` with focus return |
| `DemoNotice` | Warning-tone banner explaining the synthetic data |
| `EmptyState` / `ErrorState` / `Skeleton` | Designed states, never blank screens |

## 6. Iconography & imagery

- **Icons:** `lucide-react`, 1.75 px stroke, 16/20/24 px sizes, `aria-hidden` when decorative. No emoji in the UI.
- **Imagery:** original generated SVG illustrations (ADR-011), 3:2 aspect ratio, with an "Illustration" caption on galleries.

## 7. Content tone

Plain, specific and honest. Show prices as "R 3 180 total · 2 nights", never just "R 1 590" without context. Label all synthetic data. Empty states suggest a concrete next step ("Widen the radius to 25 km").
