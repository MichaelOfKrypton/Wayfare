/** Enumerations shared by the database CHECK constraints, API and UI. */

export const SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'rating_desc',
  'distance_asc',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating_desc: 'Demo score',
  distance_asc: 'Distance',
};

export const MEAL_PLANS = [
  'room_only',
  'self_catering',
  'breakfast',
  'half_board',
  'full_board',
] as const;
export type MealPlan = (typeof MEAL_PLANS)[number];

export const MEAL_PLAN_LABELS: Record<MealPlan, string> = {
  room_only: 'Room only',
  self_catering: 'Self-catering',
  breakfast: 'Breakfast included',
  half_board: 'Breakfast & dinner',
  full_board: 'All meals',
};

export const CANCELLATION_POLICIES = ['free', 'partial', 'non_refundable'] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export const CANCELLATION_LABELS: Record<CancellationPolicy, string> = {
  free: 'Free cancellation',
  partial: 'Partially refundable',
  non_refundable: 'Non-refundable',
};

export const DATA_STATUSES = ['simulated', 'cached', 'live'] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const PROVIDER_KINDS = ['ota', 'direct', 'metasearch'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const DESTINATION_KINDS = ['city', 'town', 'suburb', 'landmark', 'region'] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

export const AMENITY_CATEGORIES = [
  'essentials',
  'comfort',
  'outdoor',
  'family',
  'accessibility',
  'services',
] as const;
export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number];

export const AMENITY_CATEGORY_LABELS: Record<AmenityCategory, string> = {
  essentials: 'Essentials',
  comfort: 'Comfort',
  outdoor: 'Outdoor',
  family: 'Family',
  accessibility: 'Accessibility',
  services: 'Services',
};

export const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;
export type Province = (typeof SA_PROVINCES)[number];

export const DATA_NOTICE =
  'All properties, prices, availability and scores are synthetic demonstration data.';
