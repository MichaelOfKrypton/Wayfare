/**
 * Builds the complete synthetic dataset in memory. Pure and deterministic:
 * the same reference date always yields exactly the same dataset.
 */
import { addDays, offsetByMetres, type CancellationPolicy, type MealPlan } from '@wayfare/shared';
import {
  AMENITIES,
  PROPERTY_TYPES,
  PROVIDERS,
  type PropertyTypeSlug,
  type ProviderSeed,
} from './data/catalog';
import { DESTINATIONS } from './data/destinations';
import {
  ANCHORS,
  PROPERTIES,
  type Anchor,
  type PropertySeed,
  type Theme,
  type Tier,
} from './data/properties';
import { Rng, slugify } from './rng';

export const IMAGE_VARIANTS = {
  exterior: 6,
  bedroom: 6,
  lounge: 4,
  terrace: 4,
  kitchen: 3,
} as const;

export interface GeneratedOffer {
  providerSlug: string;
  roomTypeName: string;
  mealPlan: MealPlan;
  cancellationPolicy: CancellationPolicy;
  freeCancellationHours: number | null;
  nightlyRateCents: number;
  weekendNightlyRateCents: number | null;
  feePerStayCents: number;
  feeLabel: string | null;
  taxRateBps: number;
  pricesIncludeTax: boolean;
  minNights: number;
  status: 'active' | 'suspended';
  lastCheckedAt: string;
}

export interface GeneratedRoomType {
  name: string;
  description: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  beds: string;
  /** [start, end) date pairs. */
  blocks: [string, string][];
}

export interface GeneratedProperty {
  slug: string;
  name: string;
  typeSlug: PropertyTypeSlug;
  destinationSlug: string;
  suburb: string;
  lat: number;
  lng: number;
  summary: string;
  description: string;
  checkInFrom: string | null;
  checkInUntil: string | null;
  checkOutUntil: string | null;
  images: { url: string; alt: string }[];
  amenitySlugs: string[];
  roomTypes: GeneratedRoomType[];
  rating: { score: number; count: number } | null;
  listings: { providerSlug: string; externalRef: string }[];
  offers: GeneratedOffer[];
}

export interface Dataset {
  referenceDate: string;
  destinations: typeof DESTINATIONS;
  properties: GeneratedProperty[];
}

// ---------------------------------------------------------------------------
// Room templates
// ---------------------------------------------------------------------------
interface RoomTemplate {
  name: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  beds: string;
  priceMultiplier: number;
  description: string;
  minTier?: Tier;
}

const TIER_ORDER: Tier[] = ['budget', 'mid', 'premium', 'luxury'];
const tierAtLeast = (tier: Tier, min: Tier) => TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);

const ROOMS: Record<PropertyTypeSlug, RoomTemplate[]> = {
  hotel: [
    {
      name: 'Standard Queen Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 queen bed',
      priceMultiplier: 1,
      description: 'A compact en-suite room with a queen bed and desk.',
    },
    {
      name: 'Deluxe King Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 king bed',
      priceMultiplier: 1.3,
      description: 'A larger room with a king bed and a seating corner.',
    },
    {
      name: 'Family Room',
      maxGuests: 4,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 king bed and 2 single beds',
      priceMultiplier: 1.65,
      description: 'Space for a family of four, with a king bed and two singles.',
    },
    {
      name: 'Junior Suite',
      maxGuests: 3,
      bedrooms: 1,
      bathrooms: 1.5,
      beds: '1 king bed and 1 sleeper couch',
      priceMultiplier: 2.1,
      description: 'A suite with a separate lounge area.',
      minTier: 'premium',
    },
  ],
  'boutique-hotel': [
    {
      name: 'Classic Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 king bed',
      priceMultiplier: 1,
      description: 'A thoughtfully designed en-suite room.',
    },
    {
      name: 'Garden Suite',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 king bed',
      priceMultiplier: 1.35,
      description: 'A suite opening onto a private patio.',
    },
    {
      name: 'Loft Suite',
      maxGuests: 3,
      bedrooms: 1,
      bathrooms: 1.5,
      beds: '1 king bed and 1 daybed',
      priceMultiplier: 1.8,
      description: 'A double-volume suite with a mezzanine lounge.',
    },
  ],
  guesthouse: [
    {
      name: 'Standard Double Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 double bed',
      priceMultiplier: 1,
      description: 'A comfortable en-suite double room.',
    },
    {
      name: 'Garden Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 queen bed',
      priceMultiplier: 1.15,
      description: 'A quiet room with its own garden entrance.',
    },
    {
      name: 'Family Suite',
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
      beds: '1 queen bed and 2 single beds',
      priceMultiplier: 1.6,
      description: 'Two interleading rooms sharing a bathroom.',
    },
  ],
  'bed-and-breakfast': [
    {
      name: 'Double Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 queen bed',
      priceMultiplier: 1,
      description: 'An en-suite room with breakfast served in the main house.',
    },
    {
      name: 'Twin Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '2 single beds',
      priceMultiplier: 1,
      description: 'Two single beds, ideal for friends travelling together.',
    },
    {
      name: 'Family Room',
      maxGuests: 3,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 queen bed and 1 single bed',
      priceMultiplier: 1.35,
      description: 'A larger room with an extra single bed.',
    },
  ],
  lodge: [
    {
      name: 'Chalet',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 king bed',
      priceMultiplier: 1,
      description: 'A private chalet with a deck.',
    },
    {
      name: 'Family Chalet',
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 2,
      beds: '1 king bed and 2 single beds',
      priceMultiplier: 1.7,
      description: 'Two bedrooms and a shared lounge.',
    },
    {
      name: 'Luxury Suite',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 king bed',
      priceMultiplier: 1.6,
      description: 'A secluded suite with an outdoor shower.',
      minTier: 'premium',
    },
  ],
  'self-catering': [
    {
      name: 'One-bedroom Cottage',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 queen bed',
      priceMultiplier: 1,
      description: 'A cottage with a fully equipped kitchen.',
    },
    {
      name: 'Two-bedroom Cottage',
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 1,
      beds: '1 queen bed and 2 single beds',
      priceMultiplier: 1.55,
      description: 'Two bedrooms, a kitchen and an outdoor braai.',
    },
  ],
  'holiday-home': [
    {
      name: 'Entire Home',
      maxGuests: 6,
      bedrooms: 3,
      bathrooms: 2,
      beds: '2 queen beds and 2 single beds',
      priceMultiplier: 2.4,
      description: 'The whole house, with a kitchen and living areas.',
    },
    {
      name: 'Entire Home with Annex',
      maxGuests: 8,
      bedrooms: 4,
      bathrooms: 3,
      beds: '3 queen beds and 2 single beds',
      priceMultiplier: 3,
      description: 'The main house plus a separate garden annex.',
      minTier: 'premium',
    },
  ],
  'farm-stay': [
    {
      name: 'Farmhouse Room',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 double bed',
      priceMultiplier: 1,
      description: 'A room in the original farmhouse.',
    },
    {
      name: 'Farm Cottage',
      maxGuests: 5,
      bedrooms: 2,
      bathrooms: 1,
      beds: '1 queen bed and 3 single beds',
      priceMultiplier: 1.6,
      description: 'A stand-alone cottage with views over the fields.',
    },
  ],
  apartment: [
    {
      name: 'Studio Apartment',
      maxGuests: 2,
      bedrooms: 0,
      bathrooms: 1,
      beds: '1 queen bed',
      priceMultiplier: 1,
      description: 'An open-plan studio with a kitchenette.',
    },
    {
      name: 'One-bedroom Apartment',
      maxGuests: 3,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 queen bed and 1 sleeper couch',
      priceMultiplier: 1.3,
      description: 'A separate bedroom, kitchen and lounge.',
    },
    {
      name: 'Two-bedroom Apartment',
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 2,
      beds: '2 queen beds',
      priceMultiplier: 1.8,
      description: 'Two en-suite bedrooms and a balcony.',
    },
  ],
  backpackers: [
    {
      name: 'Private Double',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 0.5,
      beds: '1 double bed',
      priceMultiplier: 1,
      description: 'A private room; bathrooms are shared.',
    },
    {
      name: 'Private Twin',
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 0.5,
      beds: '2 single beds',
      priceMultiplier: 1,
      description: 'A private twin room; bathrooms are shared.',
    },
    {
      name: 'En-suite Family Room',
      maxGuests: 4,
      bedrooms: 1,
      bathrooms: 1,
      beds: '1 double bed and 1 bunk bed',
      priceMultiplier: 1.5,
      description: 'A private family room with its own bathroom.',
    },
  ],
};

const BASE_RATE_RANDS: Record<Tier, [number, number]> = {
  budget: [380, 750],
  mid: [850, 1600],
  premium: [1700, 3200],
  luxury: [3600, 7500],
};

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------
function chooseAmenities(rng: Rng, seed: PropertySeed, anchor: Anchor): string[] {
  const set = new Set<string>();
  const t = seed.type;
  const premium = tierAtLeast(seed.tier, 'premium');
  const selfCatering = t === 'self-catering' || t === 'holiday-home' || t === 'apartment';
  const p = (slug: string, probability: number) => {
    if (rng.chance(probability)) set.add(slug);
  };

  p('wifi', 0.96);
  p('secure-parking', t === 'backpackers' ? 0.4 : 0.85);
  p('backup-power', premium ? 0.85 : 0.5);
  p('water-backup', 0.35);
  p(
    'air-conditioning',
    anchor.theme === 'bushveld' || anchor.destination === 'durban' ? 0.85 : premium ? 0.7 : 0.35,
  );
  p('fireplace', anchor.theme === 'mountain' || anchor.theme === 'forest' ? 0.6 : 0.1);
  p('workspace', t === 'hotel' || t === 'apartment' ? 0.7 : 0.25);
  if (selfCatering) set.add('kitchen');
  p('washing-machine', selfCatering ? 0.7 : 0.05);
  p('pool', premium ? 0.75 : t === 'backpackers' ? 0.2 : 0.4);
  p('braai', selfCatering || t === 'farm-stay' || t === 'lodge' ? 0.85 : 0.25);
  p('garden', t === 'guesthouse' || t === 'bed-and-breakfast' || t === 'farm-stay' ? 0.85 : 0.3);
  if (anchor.coastal) p('sea-view', premium ? 0.75 : 0.4);
  if (anchor.mountains) p('mountain-view', 0.6);
  p('family-rooms', ROOMS[t].some((r) => r.maxGuests >= 4) ? 0.8 : 0.1);
  p('cot-available', 0.45);
  p(
    'pet-friendly',
    t === 'farm-stay' || t === 'self-catering' || t === 'holiday-home' ? 0.45 : 0.1,
  );
  p('step-free-access', t === 'hotel' ? 0.8 : 0.3);
  if (set.has('step-free-access')) p('accessible-bathroom', 0.55);
  if (t === 'hotel') set.add('reception-24h');
  p('self-check-in', selfCatering ? 0.7 : t === 'backpackers' ? 0.3 : 0.05);
  p(
    'restaurant',
    t === 'hotel' || t === 'lodge' || (t === 'boutique-hotel' && premium) ? 0.85 : 0.05,
  );
  p('airport-shuttle', t === 'hotel' ? 0.45 : 0.1);
  p('spa', seed.tier === 'luxury' ? 0.7 : premium ? 0.25 : 0);
  p('gym', t === 'hotel' && premium ? 0.8 : t === 'hotel' ? 0.35 : 0.03);

  // Keep the catalogue order so output is stable and readable.
  return AMENITIES.map((a) => a.slug).filter((slug) => set.has(slug));
}

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------
const THEME_INTROS: Record<Theme, string[]> = {
  coast: [
    'A short walk from the sea in {suburb}',
    'Close to the beaches of {suburb}',
    'Within earshot of the waves in {suburb}',
  ],
  city: ['Well placed in {suburb}', 'In the heart of {suburb}', 'On a quiet street in {suburb}'],
  winelands: [
    'Among the vineyards of {suburb}',
    'In the winelands of {suburb}',
    'Surrounded by oaks and vines in {suburb}',
  ],
  forest: [
    'Tucked into the green hills of {suburb}',
    'On the forest edge near {suburb}',
    'Among indigenous trees in {suburb}',
  ],
  mountain: [
    'Beneath the peaks around {suburb}',
    'With mountain air in {suburb}',
    'At the foot of the mountains near {suburb}',
  ],
  bushveld: [
    'In the bushveld outside {suburb}',
    'On the road to the Kruger near {suburb}',
    'Among marula and acacia trees near {suburb}',
  ],
};

const TYPE_SENTENCES: Record<PropertyTypeSlug, string> = {
  hotel: '{name} is a hotel with friendly front-desk staff and practical, well-kept rooms.',
  'boutique-hotel': '{name} is an intimate boutique hotel with individually styled rooms.',
  guesthouse: '{name} is an owner-run guesthouse with a handful of en-suite rooms.',
  'bed-and-breakfast': '{name} is a homely B&B where breakfast is served each morning.',
  lodge: '{name} is a lodge built for slow days outdoors and quiet evenings.',
  'self-catering':
    '{name} offers self-catering units with everything needed to cook your own meals.',
  'holiday-home': '{name} is an entire home for families and groups who want their own space.',
  'farm-stay': '{name} is set on a working smallholding with space to roam.',
  apartment: '{name} offers apartments with a kitchenette, suited to longer stays.',
  backpackers: '{name} is a sociable, budget-friendly hostel with private rooms.',
};

function describe(rng: Rng, seed: PropertySeed, anchor: Anchor, amenityNames: string[]) {
  const typeName = PROPERTY_TYPES.find((t) => t.slug === seed.type)!.name;
  const intro = rng.pick(THEME_INTROS[anchor.theme]).replace('{suburb}', anchor.suburb);
  const highlights = rng.shuffle(amenityNames.filter((n) => n !== 'Wi-Fi')).slice(0, 3);
  const highlightText =
    highlights.length > 1
      ? `${highlights.slice(0, -1).join(', ').toLowerCase()} and ${highlights.at(-1)!.toLowerCase()}`
      : (highlights[0]?.toLowerCase() ?? 'Wi-Fi');
  const summary = `${typeName} ${intro.charAt(0).toLowerCase()}${intro.slice(1)}, with ${highlightText}.`;
  const description = [
    `${intro}.`,
    TYPE_SENTENCES[seed.type].replace('{name}', seed.name),
    highlights.length ? `Guests can make use of ${highlightText}.` : '',
    'This is a fictional property created for the Wayfare demonstration; its details, prices and availability are simulated.',
  ]
    .filter(Boolean)
    .join(' ');
  return { summary, description };
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------
function mealPlansFor(seed: PropertySeed): MealPlan[] {
  switch (seed.type) {
    case 'bed-and-breakfast':
      return ['breakfast'];
    case 'self-catering':
    case 'holiday-home':
    case 'apartment':
      return ['self_catering'];
    case 'lodge':
      return tierAtLeast(seed.tier, 'premium')
        ? ['half_board', 'full_board', 'breakfast']
        : ['breakfast', 'half_board'];
    case 'backpackers':
      return ['room_only'];
    default:
      return ['room_only', 'breakfast'];
  }
}

const MEAL_COST_PER_GUEST_RANDS: Record<MealPlan, number> = {
  room_only: 0,
  self_catering: 0,
  breakfast: 160,
  half_board: 420,
  full_board: 650,
};

const round10 = (rands: number) => Math.max(10, Math.round(rands / 10) * 10);

function buildOffers(
  rng: Rng,
  seed: PropertySeed,
  anchor: Anchor,
  rooms: { template: RoomTemplate; baseRands: number }[],
  providers: ProviderSeed[],
  referenceDate: string,
): GeneratedOffer[] {
  const offers: GeneratedOffer[] = [];
  const keys = new Set<string>();
  const plans = mealPlansFor(seed);
  const isBusiness = anchor.destination === 'johannesburg' || anchor.destination === 'pretoria';
  const hasWeekendRate = rng.chance(isBusiness ? 0.7 : 0.6);
  const weekendFactor =
    isBusiness && seed.type === 'hotel' ? rng.float(0.8, 0.9) : rng.float(1.1, 1.25);
  const wholeUnit = seed.type === 'holiday-home' || seed.type === 'self-catering';
  const minNightsBase =
    seed.type === 'holiday-home' && rng.chance(0.6)
      ? 2
      : seed.tier === 'luxury' && seed.type === 'lodge'
        ? 2
        : 1;
  const cleaningFee = wholeUnit ? round10(rng.float(250, 650)) * 100 : 0;
  // Reference "check time": 06:00 SAST (04:00 UTC) on the reference date.
  const checkBase = Date.parse(`${referenceDate}T04:00:00Z`);

  for (const provider of providers) {
    const covered = rooms.filter(() => rng.chance(0.8));
    if (covered.length === 0) covered.push(rooms[0]!);
    for (const room of covered) {
      const variants = rng.chance(0.35) ? 2 : 1;
      for (let v = 0; v < variants; v += 1) {
        const policy: CancellationPolicy =
          v === 1
            ? 'non_refundable'
            : rng.chance(provider.freeCancellationShare)
              ? 'free'
              : rng.weighted([
                  ['partial', 1],
                  ['non_refundable', 1.4],
                ] as const);
        const mealPlan = v === 1 ? plans[0]! : rng.pick(plans);
        const key = `${room.template.name}|${mealPlan}|${policy}`;
        if (keys.has(`${provider.slug}|${key}`)) continue;
        keys.add(`${provider.slug}|${key}`);

        const policyFactor = policy === 'free' ? 1.06 : policy === 'partial' ? 1.02 : 0.95;
        const mealRands =
          MEAL_COST_PER_GUEST_RANDS[mealPlan] * Math.min(room.template.maxGuests, 2);
        let nightlyRands = round10(
          room.baseRands * provider.priceFactor * rng.float(0.96, 1.05) * policyFactor + mealRands,
        );
        // Providers quoting ex-VAT show a lower headline number; VAT is added in the total.
        if (!provider.pricesIncludeTax) nightlyRands = round10(nightlyRands / 1.15);

        const fee =
          provider.serviceFeeRate > 0
            ? { cents: round10(nightlyRands * provider.serviceFeeRate) * 100, label: 'Booking fee' }
            : cleaningFee > 0 && provider.kind === 'direct'
              ? { cents: cleaningFee, label: 'Cleaning fee' }
              : cleaningFee > 0 && rng.chance(0.5)
                ? { cents: cleaningFee, label: 'Cleaning fee' }
                : { cents: 0, label: null };

        offers.push({
          providerSlug: provider.slug,
          roomTypeName: room.template.name,
          mealPlan,
          cancellationPolicy: policy,
          freeCancellationHours: policy === 'free' ? rng.pick([24, 48, 72]) : null,
          nightlyRateCents: nightlyRands * 100,
          weekendNightlyRateCents: hasWeekendRate
            ? round10(nightlyRands * weekendFactor) * 100
            : null,
          feePerStayCents: fee.cents,
          feeLabel: fee.label,
          taxRateBps: 1500,
          pricesIncludeTax: provider.pricesIncludeTax,
          minNights: minNightsBase,
          status: rng.chance(0.03) ? 'suspended' : 'active',
          lastCheckedAt: new Date(checkBase - rng.int(5, 720) * 60_000).toISOString(),
        });
      }
    }
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
function buildBlocks(rng: Rng, referenceDate: string): [string, string][] {
  const blocks: [string, string][] = [];
  // ~18% of rooms are already booked tonight — realistic for last-minute searches.
  let cursor = 0;
  if (rng.chance(0.18)) {
    const length = rng.int(1, 4);
    blocks.push([addDays(referenceDate, 0), addDays(referenceDate, length)]);
    cursor = length;
  }
  const count = rng.int(2, 6);
  for (let i = 0; i < count; i += 1) {
    const gap = rng.int(2, 25);
    const length = rng.int(1, 6);
    const start = cursor + gap;
    if (start > 150) break;
    blocks.push([addDays(referenceDate, start), addDays(referenceDate, start + length)]);
    cursor = start + length; // next block starts after this one ends: never overlapping
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------
const SCORE_RANGES: Record<Tier, [number, number]> = {
  budget: [6.8, 8.6],
  mid: [7.5, 9.0],
  premium: [8.1, 9.4],
  luxury: [8.7, 9.8],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function generateDataset(referenceDate: string): Dataset {
  const properties = PROPERTIES.map((seed) => generateProperty(seed, referenceDate));
  return { referenceDate, destinations: DESTINATIONS, properties };
}

function generateProperty(seed: PropertySeed, referenceDate: string): GeneratedProperty {
  const anchor = ANCHORS[seed.anchor];
  if (!anchor) throw new Error(`Unknown anchor ${String(seed.anchor)} for ${seed.name}`);
  const slug = slugify(`${seed.name}-${anchor.destination}`);
  // Structural randomness is seeded from the slug only; date-relative parts use a
  // separate generator so changing the reference date never changes prices or rooms.
  const rng = new Rng(slug);
  const dateRng = new Rng(`${slug}|${referenceDate}`);

  const distance = Math.sqrt(rng.next()) * anchor.jitterM; // uniform over the disc
  const angle = rng.float(0, 2 * Math.PI);
  const point = offsetByMetres(anchor, distance * Math.cos(angle), distance * Math.sin(angle));

  const amenitySlugs = chooseAmenities(rng, seed, anchor);
  const amenityNames = amenitySlugs.map((s) => AMENITIES.find((a) => a.slug === s)!.name);
  const { summary, description } = describe(rng, seed, anchor, amenityNames);

  const [minRate, maxRate] = BASE_RATE_RANDS[seed.tier];
  const baseRands = rng.float(minRate, maxRate) * anchor.priceLevel;
  const templates = ROOMS[seed.type].filter((r) => !r.minTier || tierAtLeast(seed.tier, r.minTier));
  const roomCount = Math.max(1, templates.length - (rng.chance(0.3) ? 1 : 0));
  const chosen = templates.slice(0, roomCount);
  const rooms = chosen.map((template) => ({
    template,
    baseRands: baseRands * template.priceMultiplier,
  }));

  const providerCount = rng.weighted([
    [1, 20],
    [2, 30],
    [3, 30],
    [4, 15],
    [5, 5],
  ] as const);
  const providers = rng.shuffle(PROVIDERS).slice(0, providerCount);

  const offers = buildOffers(rng, seed, anchor, rooms, providers, referenceDate);

  const roomTypes: GeneratedRoomType[] = chosen.map((t) => ({
    name: t.name,
    description: t.description,
    maxGuests: t.maxGuests,
    bedrooms: t.bedrooms,
    bathrooms: t.bathrooms,
    beds: t.beds,
    blocks: buildBlocks(dateRng, referenceDate),
  }));

  const [minScore, maxScore] = SCORE_RANGES[seed.tier];
  const rating = rng.chance(0.88)
    ? {
        score: Math.round(rng.float(minScore, maxScore) * 10) / 10,
        count: Math.round(Math.exp(rng.float(Math.log(4), Math.log(1400)))),
      }
    : null;

  const ext = rng.int(1, IMAGE_VARIANTS.exterior);
  const typeName = PROPERTY_TYPES.find((t) => t.slug === seed.type)!.name.toLowerCase();
  const wholeUnit =
    seed.type === 'self-catering' || seed.type === 'holiday-home' || seed.type === 'apartment';
  const images = [
    {
      url: `/images/demo/${anchor.theme}-${ext}.svg`,
      alt: `Illustration of a ${typeName} setting in ${anchor.suburb}`,
    },
    {
      url: `/images/demo/bedroom-${rng.int(1, IMAGE_VARIANTS.bedroom)}.svg`,
      alt: 'Illustration of a bedroom',
    },
    wholeUnit
      ? {
          url: `/images/demo/kitchen-${rng.int(1, IMAGE_VARIANTS.kitchen)}.svg`,
          alt: 'Illustration of a kitchen',
        }
      : {
          url: `/images/demo/lounge-${rng.int(1, IMAGE_VARIANTS.lounge)}.svg`,
          alt: 'Illustration of a lounge',
        },
    {
      url: `/images/demo/terrace-${rng.int(1, IMAGE_VARIANTS.terrace)}.svg`,
      alt: 'Illustration of an outdoor terrace',
    },
  ];

  const times = checkTimes(seed.type);

  return {
    slug,
    name: seed.name,
    typeSlug: seed.type,
    destinationSlug: anchor.destination,
    suburb: anchor.suburb,
    lat: Math.round(point.lat * 1e6) / 1e6,
    lng: Math.round(point.lng * 1e6) / 1e6,
    summary,
    description,
    ...times,
    images,
    amenitySlugs,
    roomTypes,
    rating,
    listings: providers.map((p) => ({
      providerSlug: p.slug,
      externalRef: `${p.slug}-${slug}`.slice(0, 120),
    })),
    offers,
  };
}

function checkTimes(type: PropertySeed['type']) {
  switch (type) {
    case 'hotel':
      return { checkInFrom: '14:00', checkInUntil: null, checkOutUntil: '11:00' };
    case 'self-catering':
    case 'holiday-home':
    case 'apartment':
      return { checkInFrom: '15:00', checkInUntil: '21:00', checkOutUntil: '10:00' };
    case 'backpackers':
      return { checkInFrom: '13:00', checkInUntil: '22:00', checkOutUntil: '10:00' };
    case 'lodge':
      return { checkInFrom: '14:00', checkInUntil: '18:00', checkOutUntil: '10:00' };
    default:
      return { checkInFrom: '14:00', checkInUntil: '19:00', checkOutUntil: '10:00' };
  }
}
