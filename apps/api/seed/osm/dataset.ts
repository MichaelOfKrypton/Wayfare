/**
 * Builds the seed dataset from the committed OpenStreetMap snapshot.
 *
 * Real: name, location, type, star rating, website, phone, street address,
 * amenities OSM confirms, and Wikimedia Commons photos (with credit).
 * Simulated (and labelled so in the app): rooms, offers, prices, availability,
 * demo scores and the remaining amenities.
 */
import { haversineKm } from '@wayfare/shared';
import { PROPERTY_TYPES, type PropertyTypeSlug } from '../data/catalog';
import { DESTINATIONS, type DestinationSeed } from '../data/destinations';
import { ANCHORS, type Anchor, type Theme, type Tier } from '../data/properties';
import {
  buildProperty,
  type Dataset,
  type DatasetDestination,
  type GeneratedProperty,
} from '../generate';
import { Rng, slugify } from '../rng';
import { dedupePlaces, normalizePlace, type NormalizedPlace } from './normalize';
import { EXTRA_DESTINATIONS } from './sources';
import type { OsmSnapshot } from './snapshot';

/** Keeps each destination's result list (and the seed) a sensible size. */
export const MAX_PLACES_PER_DESTINATION = 220;
/** Two places closer than this are treated as one mapped twice. */
const MIN_SPACING_KM = 0.008;

const THEMES = new Set<Theme>(['coast', 'city', 'winelands', 'forest', 'mountain', 'bushveld']);

/** Default price tier when OSM has no star rating. */
const TIER_WEIGHTS: Record<PropertyTypeSlug, [Tier, number][]> = {
  hotel: [
    ['budget', 15],
    ['mid', 55],
    ['premium', 25],
    ['luxury', 5],
  ],
  'boutique-hotel': [
    ['mid', 25],
    ['premium', 55],
    ['luxury', 20],
  ],
  guesthouse: [
    ['budget', 25],
    ['mid', 65],
    ['premium', 10],
  ],
  'bed-and-breakfast': [
    ['budget', 25],
    ['mid', 65],
    ['premium', 10],
  ],
  lodge: [
    ['mid', 25],
    ['premium', 50],
    ['luxury', 25],
  ],
  'self-catering': [
    ['budget', 30],
    ['mid', 55],
    ['premium', 15],
  ],
  'holiday-home': [
    ['budget', 20],
    ['mid', 55],
    ['premium', 25],
  ],
  'farm-stay': [
    ['budget', 35],
    ['mid', 60],
    ['premium', 5],
  ],
  apartment: [
    ['budget', 30],
    ['mid', 55],
    ['premium', 15],
  ],
  backpackers: [['budget', 100]],
};

/** One generation anchor per top-level destination, averaged from the hand-made anchors. */
function destinationAnchor(dest: DestinationSeed): Anchor {
  const known = Object.values(ANCHORS).filter((a) => a.destination === dest.slug);
  const theme: Theme = THEMES.has(dest.theme as Theme) ? (dest.theme as Theme) : 'city';
  const priceLevel = known.length
    ? known.reduce((sum, a) => sum + a.priceLevel, 0) / known.length
    : dest.kind === 'city'
      ? 1
      : 0.95;
  return {
    destination: dest.slug,
    suburb: dest.name,
    lat: dest.lat,
    lng: dest.lng,
    jitterM: 0,
    theme,
    priceLevel,
    coastal: known.length ? known.some((a) => a.coastal) : theme === 'coast',
    mountains: known.length ? known.some((a) => a.mountains) : theme === 'mountain',
  };
}

/** The top-level destination whose search circle contains the place most centrally. */
function assignDestination(
  place: { lat: number; lng: number },
  tops: DestinationSeed[],
): DestinationSeed | null {
  let best: DestinationSeed | null = null;
  let bestRatio = Infinity;
  for (const d of tops) {
    const ratio = haversineKm(place, d) / d.radiusKm;
    if (ratio <= 1 && ratio < bestRatio) {
      best = d;
      bestRatio = ratio;
    }
  }
  return best;
}

function suburbFor(place: NormalizedPlace, children: DestinationSeed[]): string | null {
  if (place.suburb) return place.suburb;
  // Only real suburbs name an area; a nearby landmark (an airport, a garden) is not an address.
  const inside = children
    .filter((c) => c.kind === 'suburb')
    .map((c) => ({ c, ratio: haversineKm(place, c) / c.radiusKm }))
    .filter((x) => x.ratio <= 1)
    .sort((a, b) => a.ratio - b.ratio)[0];
  return inside?.c.name ?? null;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

function describeReal(
  place: NormalizedPlace,
  typeName: string,
  where: string,
  rooms: number | null,
) {
  const kind = place.stars ? `${place.stars}-star ${typeName}` : typeName;
  const summary = `${article(kind)[0]!.toUpperCase()}${article(kind).slice(1)} ${kind} in ${where}.`;
  const known = [
    'name',
    'location',
    place.websiteUrl ? 'website' : null,
    place.phone ? 'phone number' : null,
    place.stars ? 'star rating' : null,
  ].filter(Boolean) as string[];
  const list = known.length > 1 ? `${known.slice(0, -1).join(', ')} and ${known.at(-1)}` : known[0];
  const description = [
    `${place.name} is ${article(kind)} ${kind} in ${where}${rooms ? ` with ${rooms} rooms` : ''}.`,
    `Its ${list} come from OpenStreetMap.`,
    'The rooms, prices, availability and demo score shown here are simulated for this portfolio demo, so check directly with the property before you plan a stay.',
  ].join(' ');
  return { summary, description };
}

/** Greedy spacing filter: richer places win when two sit on the same spot. */
function enforceSpacing(places: NormalizedPlace[]): NormalizedPlace[] {
  const sorted = [...places].sort((a, b) => b.richness - a.richness || a.key.localeCompare(b.key));
  const kept: NormalizedPlace[] = [];
  for (const p of sorted) {
    if (!kept.some((k) => haversineKm(k, p) < MIN_SPACING_KM)) kept.push(p);
  }
  return kept;
}

export function buildOsmDataset(snapshot: OsmSnapshot, referenceDate: string): Dataset {
  const allDestinations: DatasetDestination[] = [...DESTINATIONS, ...EXTRA_DESTINATIONS].map(
    (d) => {
      const photo = snapshot.destinationPhotos[d.slug];
      return {
        ...d,
        photo: photo ? { url: photo.url, credit: photo.credit, creditUrl: photo.creditUrl } : null,
      };
    },
  );
  const tops = allDestinations.filter((d) => !d.parent && d.kind !== 'suburb');
  const childrenOf = new Map<string, DestinationSeed[]>();
  for (const d of allDestinations) {
    if (d.parent) childrenOf.set(d.parent, [...(childrenOf.get(d.parent) ?? []), d]);
  }

  const normalized = snapshot.places
    .map(normalizePlace)
    .filter((p): p is NormalizedPlace => p !== null);
  const unique = dedupePlaces(normalized, haversineKm);

  const byDestination = new Map<string, NormalizedPlace[]>();
  for (const place of unique) {
    const dest = assignDestination(place, tops);
    if (!dest) continue;
    byDestination.set(dest.slug, [...(byDestination.get(dest.slug) ?? []), place]);
  }

  const properties: GeneratedProperty[] = [];
  const slugs = new Set<string>();
  for (const dest of tops) {
    const places = enforceSpacing(byDestination.get(dest.slug) ?? []).slice(
      0,
      MAX_PLACES_PER_DESTINATION,
    );
    const baseAnchor = destinationAnchor(dest);
    const children = childrenOf.get(dest.slug) ?? [];

    for (const place of places.sort((a, b) => a.key.localeCompare(b.key))) {
      let slug = slugify(`${place.name}-${dest.slug}`) || `place-${dest.slug}`;
      if (slugs.has(slug)) slug = `${slug}-${place.osmId}`;
      slugs.add(slug);

      const rng = new Rng(`osm|${place.key}`);
      const tier = place.tier ?? rng.weighted(TIER_WEIGHTS[place.type]);
      const suburb = suburbFor(place, children);
      const anchor: Anchor = { ...baseAnchor, suburb: suburb ?? dest.name };
      const generated = buildProperty({
        slug,
        rng,
        seed: { name: place.name, type: place.type, tier },
        anchor,
        point: place,
        referenceDate,
        confirmedAmenities: place.confirmedAmenities,
        deniedAmenities: place.deniedAmenities,
      });

      // Rarely every offer is randomly suspended; a listed place always keeps one bookable offer.
      if (!generated.offers.some((o) => o.status === 'active') && generated.offers[0]) {
        generated.offers[0] = { ...generated.offers[0], status: 'active' };
      }

      const typeName = PROPERTY_TYPES.find((t) => t.slug === place.type)!.name.toLowerCase();
      const where = suburb && suburb !== dest.name ? `${suburb}, ${dest.name}` : dest.name;
      const images = place.photo
        ? [
            {
              url: place.photo.url,
              alt: `Photo of ${place.name}`,
              credit: place.photo.credit,
              creditUrl: place.photo.creditUrl,
              licence: place.photo.licence,
            },
            ...generated.images.slice(1),
          ]
        : generated.images;

      properties.push({
        ...generated,
        ...describeReal(place, typeName, where, place.rooms),
        suburb,
        lat: place.lat,
        lng: place.lng,
        images,
        real: {
          osmType: place.osmType,
          osmId: place.osmId,
          websiteUrl: place.websiteUrl,
          phone: place.phone,
          streetAddress: place.streetAddress,
          stars: place.stars,
          confirmedAmenitySlugs: place.confirmedAmenities.filter(
            (s) => !place.deniedAmenities.includes(s),
          ),
        },
      });
    }
  }

  return {
    source: 'osm',
    referenceDate,
    destinations: allDestinations,
    properties,
    minSpacingKm: MIN_SPACING_KM,
  };
}
