/**
 * Turns raw OpenStreetMap tags into clean, safe property fields. Pure functions,
 * unit tested in normalize.test.ts.
 */
import type { PropertyTypeSlug } from '../data/catalog';
import type { Tier } from '../data/properties';
import type { OsmPlace, Photo } from './snapshot';

export interface NormalizedPlace {
  key: string;
  osmType: OsmPlace['osmType'];
  osmId: number;
  name: string;
  lat: number;
  lng: number;
  type: PropertyTypeSlug;
  /** From the `stars` tag only; null when OSM doesn't say. */
  stars: number | null;
  tier: Tier | null;
  rooms: number | null;
  websiteUrl: string | null;
  phone: string | null;
  streetAddress: string | null;
  suburb: string | null;
  city: string | null;
  /** Amenities OSM explicitly confirms. */
  confirmedAmenities: string[];
  /** Amenities OSM explicitly denies (e.g. `wheelchair=no`); never simulated. */
  deniedAmenities: string[];
  photo: Photo | null;
  /** Rough completeness score, used to pick between duplicates. */
  richness: number;
}

const GENERIC_NAMES =
  /^(airbnb|air bnb|guest ?house|b ?& ?b|bnb|hotel|motel|hostel|lodge|accommodation|apartment|apartments|flat|chalet|cottage|house|home|private|holiday home|self[- ]catering|unknown|n\/?a)$/i;

/** Collapses whitespace and rejects names that don't identify a place. */
export function cleanName(raw: string | undefined): string | null {
  if (!raw) return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 120) return null;
  if (GENERIC_NAMES.test(name)) return null;
  if (!/[a-z]/i.test(name)) return null; // numbers or symbols only
  return name;
}

/**
 * Accepts only plain http(s) URLs to a real host: no other schemes (javascript:,
 * data:), no embedded credentials, no IP literals or localhost. Returns the
 * normalised href, or null.
 */
export function safeWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.split(';')[0]!.trim();
  if (!candidate || candidate.length > 300 || /\s/.test(candidate)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (!/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local')) return null;
  if (/^[\d.]+$/.test(host) || host.startsWith('[')) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return url.href;
}

/** First phone number, keeping only digits, spaces, +, - and brackets. */
export function cleanPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;,/]/)[0]!.trim();
  if (!/^[+\d\s()-]+$/.test(first)) return null;
  const digits = first.replace(/\D/g, '').length;
  if (digits < 9 || digits > 15) return null;
  return first.replace(/\s+/g, ' ');
}

function parseCount(raw: string | undefined, max: number): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= 1 && n <= max ? n : null;
}

const BNB_NAME = /\b(b ?& ?b|bed (and|&) breakfast|bnb)\b/i;
const LODGE_NAME = /\b(lodge|safari|game reserve|bush camp)\b/i;
const FARM_NAME = /\b(farm|plaas|estate)\b/i;
const COTTAGE_NAME = /\b(cottage|cottages|chalets?|cabins?|self[- ]catering)\b/i;
const BOUTIQUE_NAME = /\bboutique\b/i;

export function classify(tags: Record<string, string>, name: string): PropertyTypeSlug {
  const rooms = parseCount(tags.rooms, 2000);
  switch (tags.tourism) {
    case 'hostel':
      return 'backpackers';
    case 'motel':
      return 'hotel';
    case 'apartment':
      return COTTAGE_NAME.test(name) ? 'self-catering' : 'apartment';
    case 'chalet':
      return LODGE_NAME.test(name) ? 'lodge' : 'self-catering';
    case 'guest_house': {
      const kind = tags.guest_house ?? '';
      if (kind === 'bed_and_breakfast' || BNB_NAME.test(name)) return 'bed-and-breakfast';
      if (kind === 'farmstay' || kind === 'agritourism') return 'farm-stay';
      if (LODGE_NAME.test(name)) return 'lodge';
      if (FARM_NAME.test(name)) return 'farm-stay';
      if (COTTAGE_NAME.test(name)) return 'self-catering';
      return 'guesthouse';
    }
    default: {
      // hotel
      if (LODGE_NAME.test(name)) return 'lodge';
      if (BOUTIQUE_NAME.test(name) || (rooms !== null && rooms <= 20)) return 'boutique-hotel';
      return 'hotel';
    }
  }
}

export function tierFromStars(stars: number | null): Tier | null {
  if (stars === null) return null;
  if (stars >= 5) return 'luxury';
  if (stars >= 4) return 'premium';
  if (stars >= 3) return 'mid';
  return 'budget';
}

const YES = /^(yes|wlan|wifi|wired|terminal|customers|outdoor|indoor)$/i;
const NO = /^no$/i;

function amenityEvidence(tags: Record<string, string>) {
  const confirmed = new Set<string>();
  const denied = new Set<string>();
  const check = (value: string | undefined, slug: string) => {
    if (value === undefined) return;
    if (YES.test(value)) confirmed.add(slug);
    else if (NO.test(value)) denied.add(slug);
  };
  check(tags.internet_access, 'wifi');
  check(tags.wheelchair, 'step-free-access');
  check(tags.swimming_pool, 'pool');
  check(tags.air_conditioning, 'air-conditioning');
  check(tags.restaurant, 'restaurant');
  check(tags.dog ?? tags.pets, 'pet-friendly');
  // Wheelchair "limited" neither confirms nor denies step-free access.
  return { confirmed: [...confirmed], denied: [...denied] };
}

function streetAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street']?.trim();
  if (!street) return null;
  const number = tags['addr:housenumber']?.trim();
  return (number ? `${number} ${street}` : street).slice(0, 120);
}

const shortText = (value: string | undefined, max = 60) => {
  const v = value?.replace(/\s+/g, ' ').trim();
  return v && v.length <= max ? v : null;
};

export function normalizePlace(place: OsmPlace): NormalizedPlace | null {
  const name = cleanName(place.tags.name);
  if (!name) return null;
  const starsRaw = place.tags.stars?.trim().replace(/s$/i, '');
  const stars = starsRaw && /^[1-5]$/.test(starsRaw) ? Number(starsRaw) : null;
  const websiteUrl =
    safeWebsite(place.tags.website) ??
    safeWebsite(place.tags['contact:website']) ??
    safeWebsite(place.tags.url);
  const phone = cleanPhone(place.tags.phone ?? place.tags['contact:phone']);
  const evidence = amenityEvidence(place.tags);
  const address = streetAddress(place.tags);
  return {
    key: `${place.osmType}/${place.osmId}`,
    osmType: place.osmType,
    osmId: place.osmId,
    name,
    lat: place.lat,
    lng: place.lng,
    type: classify(place.tags, name),
    stars,
    tier: tierFromStars(stars),
    rooms: parseCount(place.tags.rooms, 2000),
    websiteUrl,
    phone,
    streetAddress: address,
    suburb: shortText(place.tags['addr:suburb']),
    city: shortText(place.tags['addr:city']),
    confirmedAmenities: evidence.confirmed,
    deniedAmenities: evidence.denied,
    photo: place.photo ?? null,
    richness:
      (websiteUrl ? 3 : 0) +
      (phone ? 1 : 0) +
      (address ? 1 : 0) +
      (place.photo ? 2 : 0) +
      Object.keys(place.tags).length / 100,
  };
}

const nameKey = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * OSM sometimes maps one establishment twice (a node and a building outline).
 * Keeps the richer record when two places share a name within `withinKm`.
 */
export function dedupePlaces(
  places: NormalizedPlace[],
  distanceKm: (a: NormalizedPlace, b: NormalizedPlace) => number,
  withinKm = 0.25,
): NormalizedPlace[] {
  const byName = new Map<string, NormalizedPlace[]>();
  for (const place of places) {
    const key = nameKey(place.name);
    byName.set(key, [...(byName.get(key) ?? []), place]);
  }
  const kept: NormalizedPlace[] = [];
  for (const group of byName.values()) {
    const sorted = [...group].sort((a, b) => b.richness - a.richness || a.key.localeCompare(b.key));
    const chosen: NormalizedPlace[] = [];
    for (const candidate of sorted) {
      if (!chosen.some((c) => distanceKm(c, candidate) < withinKm)) chosen.push(candidate);
    }
    kept.push(...chosen);
  }
  return kept.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Commons now returns thumbnails on thumb.wikimedia.org with tracking
 * parameters. The same path is served by upload.wikimedia.org, the host the
 * app's schema and Content-Security-Policy allow, so normalise to that.
 */
export function commonsThumbUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== 'upload.wikimedia.org' && url.hostname !== 'thumb.wikimedia.org')
    return null;
  if (!url.pathname.startsWith('/wikipedia/commons/')) return null;
  return `https://upload.wikimedia.org${url.pathname}`;
}
