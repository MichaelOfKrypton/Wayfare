import type { AmenityCategory, ProviderKind } from '@wayfare/shared';

export const DATA_SOURCE = {
  code: 'synthetic-demo',
  name: 'Wayfare synthetic dataset',
  kind: 'synthetic' as const,
  description:
    'Deterministically generated demonstration data. Properties, providers, prices, availability and scores are fictional.',
};

export const PROPERTY_TYPES = [
  {
    slug: 'hotel',
    name: 'Hotel',
    description: 'Full-service hotel with reception and daily housekeeping.',
  },
  {
    slug: 'boutique-hotel',
    name: 'Boutique hotel',
    description: 'Small, design-led hotel with personal service.',
  },
  {
    slug: 'guesthouse',
    name: 'Guesthouse',
    description: 'Owner-run house with a handful of en-suite rooms.',
  },
  {
    slug: 'bed-and-breakfast',
    name: 'B&B',
    description: 'Bed and breakfast with a home-cooked morning meal.',
  },
  {
    slug: 'lodge',
    name: 'Lodge',
    description: 'Nature or bush lodge, often with meals and activities.',
  },
  {
    slug: 'self-catering',
    name: 'Self-catering',
    description: 'Cottage or unit with its own kitchen.',
  },
  {
    slug: 'holiday-home',
    name: 'Holiday home',
    description: 'An entire house for families and groups.',
  },
  {
    slug: 'farm-stay',
    name: 'Farm stay',
    description: 'Accommodation on a working farm or smallholding.',
  },
  {
    slug: 'apartment',
    name: 'Apartment',
    description: 'Serviced or private apartment in a residential block.',
  },
  {
    slug: 'backpackers',
    name: 'Backpackers',
    description: 'Budget-friendly hostel with private rooms and shared spaces.',
  },
] as const;

export type PropertyTypeSlug = (typeof PROPERTY_TYPES)[number]['slug'];

export const AMENITIES: {
  slug: string;
  name: string;
  category: AmenityCategory;
  isEssential?: boolean;
}[] = [
  { slug: 'wifi', name: 'Wi-Fi', category: 'essentials', isEssential: true },
  { slug: 'secure-parking', name: 'Secure parking', category: 'essentials', isEssential: true },
  { slug: 'backup-power', name: 'Backup power', category: 'essentials', isEssential: true },
  { slug: 'water-backup', name: 'Backup water', category: 'essentials' },
  { slug: 'air-conditioning', name: 'Air conditioning', category: 'comfort', isEssential: true },
  { slug: 'fireplace', name: 'Fireplace', category: 'comfort' },
  { slug: 'workspace', name: 'Dedicated workspace', category: 'comfort' },
  { slug: 'kitchen', name: 'Kitchen', category: 'comfort' },
  { slug: 'washing-machine', name: 'Washing machine', category: 'comfort' },
  { slug: 'pool', name: 'Swimming pool', category: 'outdoor', isEssential: true },
  { slug: 'braai', name: 'Braai area', category: 'outdoor' },
  { slug: 'garden', name: 'Garden', category: 'outdoor' },
  { slug: 'sea-view', name: 'Sea view', category: 'outdoor' },
  { slug: 'mountain-view', name: 'Mountain view', category: 'outdoor' },
  { slug: 'family-rooms', name: 'Family rooms', category: 'family' },
  { slug: 'cot-available', name: 'Cot available', category: 'family' },
  { slug: 'pet-friendly', name: 'Pet-friendly', category: 'family', isEssential: true },
  { slug: 'step-free-access', name: 'Step-free access', category: 'accessibility' },
  { slug: 'accessible-bathroom', name: 'Accessible bathroom', category: 'accessibility' },
  { slug: 'reception-24h', name: '24-hour reception', category: 'services' },
  { slug: 'self-check-in', name: 'Self check-in', category: 'services', isEssential: true },
  { slug: 'restaurant', name: 'Restaurant', category: 'services' },
  { slug: 'airport-shuttle', name: 'Airport shuttle', category: 'services' },
  { slug: 'spa', name: 'Spa', category: 'services' },
  { slug: 'gym', name: 'Gym', category: 'services' },
];

export interface ProviderSeed {
  slug: string;
  name: string;
  kind: ProviderKind;
  description: string;
  /** Pricing personality used by the generator. */
  priceFactor: number;
  pricesIncludeTax: boolean;
  serviceFeeRate: number; // fraction of the nightly rate charged once per stay; 0 = none
  freeCancellationShare: number; // probability an offer has free cancellation
}

export const PROVIDERS: ProviderSeed[] = [
  {
    slug: 'kopano-stays',
    name: 'Kopano Stays',
    kind: 'ota',
    description: 'Fictional South African online travel agency (demonstration only).',
    priceFactor: 1.0,
    pricesIncludeTax: true,
    serviceFeeRate: 0,
    freeCancellationShare: 0.6,
  },
  {
    slug: 'marula-trips',
    name: 'Marula Trips',
    kind: 'ota',
    description: 'Fictional travel marketplace that adds a booking fee (demonstration only).',
    priceFactor: 0.94,
    pricesIncludeTax: true,
    serviceFeeRate: 0.12,
    freeCancellationShare: 0.35,
  },
  {
    slug: 'tidewater-travel',
    name: 'Tidewater Travel',
    kind: 'ota',
    description:
      'Fictional international agency that quotes prices excluding VAT (demonstration only).',
    priceFactor: 0.9,
    pricesIncludeTax: false,
    serviceFeeRate: 0,
    freeCancellationShare: 0.5,
  },
  {
    slug: 'sunbird-getaways',
    name: 'Sunbird Getaways',
    kind: 'ota',
    description: 'Fictional deals site with mostly non-refundable rates (demonstration only).',
    priceFactor: 0.88,
    pricesIncludeTax: true,
    serviceFeeRate: 0,
    freeCancellationShare: 0.15,
  },
  {
    slug: 'book-direct',
    name: 'Property direct',
    kind: 'direct',
    description: "Simulated rates from the property's own channel (demonstration only).",
    priceFactor: 0.97,
    pricesIncludeTax: true,
    serviceFeeRate: 0,
    freeCancellationShare: 0.75,
  },
];
