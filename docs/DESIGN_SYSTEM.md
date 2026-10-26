# Design System — Wayfare

The design direction is **clean and modern**: calm, confident and easy to scan, with the information density of a comparison tool. The palette follows a 60/30/10 balance: about 60% light grays, 30% white surfaces and dark-gray chrome (header, hero, footer), and 10% blue. Navy is the primary action colour, and royal and light blues are used for highlights. One sans-serif family (Inter) carries everything.

All tokens live in `apps/web/src/styles/tokens.css` as CSS custom properties. Components never hard-code colours, spacing or radii.

## 1. Colour

| Token                          | Value                 | Use                                                                         |
| ------------------------------ | --------------------- | --------------------------------------------------------------------------- |
| `--color-gray-900`             | `#1F2228`             | **Chrome** (header, hero, footer) and body text (15.9:1 on white)           |
| `--color-gray-600`             | `#5D6470`             | Secondary text (5.7:1 on gray-50)                                           |
| `--color-gray-200` / `-300`    | `#E6E8EC` / `#D5D9DF` | Borders / dividers                                                          |
| `--color-gray-100` / `-50`     | `#F1F2F4` / `#F8F9FA` | Secondary surfaces / page background                                        |
| `--color-surface`              | `#FFFFFF`             | Cards, inputs                                                               |
| `--color-navy-700`             | `#1E3A8A`             | **Primary**: buttons, links, logo tile, score badges (white on it: 10.4:1)  |
| `--color-navy-900`             | `#132A5E`             | Primary hover                                                               |
| `--color-royal-600`            | `#4169E1`             | Royal blue highlights: headline marker, hovered map pin, focus ring         |
| `--color-royal-100` / `-50`    | `#E3E9FD` / `#F2F5FF` | Selected rows, tints, soft buttons                                          |
| `--color-sky-400`              | `#8FA9FF`             | Light-blue accents on dark gray (7:1): eyebrow labels, active nav underline |
| `--color-success-700` / `-100` | `#17694B` / `#DCF3E8` | Free cancellation, available                                                |
| `--color-warning-700` / `-100` | `#7A4B00` / `#FDF0D5` | Warnings                                                                    |
| `--color-danger-700` / `-100`  | `#B42318` / `#FDE4E1` | Errors, non-refundable                                                      |

**Rules:**

- Status is **never** conveyed by colour alone: badges carry text and an icon.
- Body-text contrast is ≥ 4.5:1 and UI component boundaries ≥ 3:1.

## 2. Typography

| Token              | Value                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| `--font-display`   | `"Inter Variable"` at 700 with tight tracking (−0.025 to −0.035em): headings    |
| `--font-sans`      | `"Inter Variable", system-ui, sans-serif`: everything else                      |
| Scale (`--text-*`) | xs 12 · sm 14 · base 16 · md 18 · lg 20 · xl 24 · 2xl 30 · 3xl 38 · 4xl 48 (px) |
| Line height        | 1.5 body · 1.2 headings                                                         |
| Weights            | 400 body · 500 UI labels · 600 emphasis/prices · 700 headings                   |

Prices use `font-variant-numeric: tabular-nums` so figures align in comparison tables. The minimum text size is 12 px, used only for meta labels.

## 3. Spacing, radii, elevation

- **Spacing** (`--space-*`, 4 px base): 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80.
- **Radii:** `--radius-sm` 4 (inputs, chips) · `--radius-md` 8 (buttons, cards) · `--radius-lg` 14 (panels, dialogs) · `--radius-pill`. Rounding is deliberately modest.
- **Borders:** `1px solid var(--color-gray-200)` is the default separator. Prefer borders over shadows.
- **Shadows:** `--shadow-sm` (cards at rest, barely visible), `--shadow-md` (hover / sticky bars), `--shadow-lg` (dialogs, map popovers). All neutral gray at low alpha.
- **Motion** (`styles/motion.css`): pages fade up on navigation; lists (destinations, results, offers) cascade in 40 ms apart; cards and buttons lift on hover and press in on click; the logo needle settles on load and swings on hover; map pins pop in; the hero glow and compass watermark drift slowly on a static backdrop (`components/HeroBackdrop.tsx`: a fixed layer clipped to the hero) that the page scrolls over. For smoothness, only `transform` and `opacity` animate; hover shadows fade in on a pre-drawn pseudo-element (`.hover-lift`, `.lift-self`) and photos zoom on their own layer (`.hover-zoom`), which cut paint work during card hovers from 89 ms to 13 ms. Animations use `backwards` fill so no transform lingers (which would break sticky and fixed elements). Everything is disabled under `prefers-reduced-motion`.

## 4. Layout & breakpoints

| Name | Min width | Behaviour                                                    |
| ---- | --------- | ------------------------------------------------------------ |
| base | 0         | Single column, 16 px gutters, filter drawer, list/map toggle |
| `sm` | 640 px    | Wider cards (image left)                                     |
| `md` | 768 px    | Two-column property page sections                            |
| `lg` | 1024 px   | Search: filter sidebar + list. The map is behind a toggle    |
| `xl` | 1280 px   | Search: filters · list · sticky map (three panes)            |

The content max width is 1200 px (marketing pages) and full-bleed for the search workspace. Breakpoints are applied with `min-width` media queries (mobile-first).

## 5. Components

| Component                                                  | Notes                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                   | Variants: `primary` (navy), `secondary` (outline), `ghost`, `accent`. Sizes `sm`/`md`/`lg`. Always a real `<button>` or `<a>`. Loading state keeps width |
| `IconButton`                                               | Requires `aria-label`                                                                                                                                    |
| `Field` / `TextInput` / `Select` / `DateInput` / `Stepper` | A label is always rendered; error text is linked by `aria-describedby`                                                                                   |
| `Chip` / `ToggleChip`                                      | Filter toggles use `aria-pressed`                                                                                                                        |
| `Badge`                                                    | Variants `cheapest`, `recommended`, `success`, `neutral`, `simulated`. Icon + text                                                                       |
| `RatingPill`                                               | Score + count + "Demo score" label; "Not yet rated" when null                                                                                            |
| `Price`                                                    | Formats cents → `R 1 590` (en-ZA). Shows the "total for N nights" / "avg per night" context                                                              |
| `PropertyCard`                                             | Image, type eyebrow, name (display font), location, rating, amenities, price block, CTA. `selected` / `highlighted` states                               |
| `SearchBar`                                                | Destination combobox (ARIA 1.2 pattern), dates, guests, submit; compact variant for the results header                                                   |
| `FilterPanel`                                              | Sections: Budget, Type, Amenities, Score, Cancellation, Bedrooms, Distance. Sidebar on lg+, drawer on mobile                                             |
| `ResultsMap`                                               | Leaflet; price-pill markers; clustering; tile-error notice                                                                                               |
| `OfferComparison`                                          | Groups per room type; offer rows with provider, meal plan, cancellation, price breakdown, badges                                                         |
| `Dialog`                                                   | Native `<dialog>` with focus return                                                                                                                      |
| `DemoNotice`                                               | Warning-tone banner explaining the synthetic data                                                                                                        |
| `EmptyState` / `ErrorState` / `Skeleton`                   | Designed states, never blank screens                                                                                                                     |

## 6. Iconography & imagery

- **Icons:** `lucide-react`, 1.75 px stroke, 16/20/24 px sizes, `aria-hidden` when decorative. No emoji in the UI.
- **Logo:** a solid-white compass on a navy tile (`components/Logo.tsx`, `public/favicon.svg`). `CompassWatermark` draws the compass alone as a large, faint background mark on the home and How it works heroes.
- **Imagery:** credited Wikimedia Commons photos where available; otherwise original generated SVG illustrations (ADR-011) in the same palette, 3:2, labelled "Illustration".

## 7. Content tone

Plain, specific and honest. Show prices as "R 3 180 total · 2 nights", never just "R 1 590" without context. Label all synthetic data. Empty states suggest a concrete next step ("Widen the radius to 25 km").
