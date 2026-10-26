/** API response contracts. See docs/API_SPECIFICATION.md. */
import type {
  AmenityCategory,
  CancellationPolicy,
  DataStatus,
  DestinationKind,
  MealPlan,
  ProviderKind,
  SortOption,
} from './domain';

export interface ApiErrorBody {
  error: {
    code:
      'VALIDATION_ERROR' | 'NOT_FOUND' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR';
    message: string;
    issues?: { path: string; message: string }[];
    requestId?: string;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface RatingSummary {
  score: number;
  count: number;
  label: string;
}

export interface ImageRef {
  url: string;
  alt: string;
  /** Set for third-party photos (e.g. Wikimedia Commons); absent for Wayfare's own illustrations. */
  credit?: string | null;
  creditUrl?: string | null;
}

export interface NamedSlug {
  slug: string;
  name: string;
}

// ---------- Destinations ----------

export interface Destination {
  slug: string;
  name: string;
  kind: DestinationKind;
  province: string;
  parentName: string | null;
  lat: number;
  lng: number;
  searchRadiusKm: number;
  propertyCount: number;
  summary: string | null;
  imageUrl: string | null;
  /** Photographer and licence, when `imageUrl` is a third-party photo. */
  imageCredit?: { text: string; url: string } | null;
}

export interface DestinationsResponse {
  items: Destination[];
}

// ---------- Filters ----------

export interface FiltersResponse {
  propertyTypes: (NamedSlug & { propertyCount: number })[];
  amenities: (NamedSlug & { category: AmenityCategory; isEssential: boolean })[];
  priceBounds: { minNightlyCents: number; maxNightlyCents: number; currency: 'ZAR' };
  sortOptions: SortOption[];
  /** What the loaded dataset contains, so the UI can describe it accurately. */
  dataSummary: { realPropertyCount: number; demoPropertyCount: number };
}

// ---------- Search ----------

export interface BestOffer {
  offerId: number;
  providerName: string;
  roomTypeName: string;
  nights: number;
  totalCents: number;
  averageNightlyCents: number;
  cancellationPolicy: CancellationPolicy;
  mealPlan: MealPlan;
  dataStatus: DataStatus;
}

export interface SearchResultItem {
  id: number;
  slug: string;
  name: string;
  propertyType: NamedSlug;
  destinationName: string;
  suburb: string | null;
  province: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  rating: RatingSummary | null;
  coverImage: ImageRef | null;
  keyAmenities: NamedSlug[];
  bestOffer: BestOffer;
  offerCount: number;
  providerCount: number;
  maxGuests: number;
}

export interface MapPoint {
  id: number;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  averageNightlyCents: number;
}

export interface SearchReference {
  kind: 'destination' | 'coordinates';
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface StaySummary {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  pagination: Pagination;
  mapPoints: MapPoint[];
  mapPointsTruncated: boolean;
  reference: SearchReference | null;
  stay: StaySummary;
  dataNotice: string;
}

// ---------- Property ----------

export interface RoomType {
  id: number;
  name: string;
  description: string | null;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  beds: string | null;
}

export interface ProviderRef {
  slug: string;
  name: string;
  kind: ProviderKind;
}

export interface PropertyDetail {
  id: number;
  slug: string;
  name: string;
  propertyType: NamedSlug;
  summary: string;
  description: string;
  destination: { slug: string; name: string; province: string };
  suburb: string | null;
  streetAddress: string | null;
  lat: number;
  lng: number;
  checkIn: { from: string | null; until: string | null };
  checkOut: { until: string | null };
  images: ImageRef[];
  /** `verified` amenities are confirmed by OpenStreetMap; the rest are simulated. */
  amenities: (NamedSlug & { category: AmenityCategory; verified: boolean })[];
  roomTypes: RoomType[];
  rating: RatingSummary | null;
  providers: ProviderRef[];
  dataSource: { code: string; name: string; kind: string };
  /** True for fictional properties; false for real places from OpenStreetMap. */
  isDemo: boolean;
  /** Facts about a real place (null for fictional properties). */
  realPlace: {
    websiteUrl: string | null;
    phone: string | null;
    stars: number | null;
    osmUrl: string;
  } | null;
}

// ---------- Offers ----------

export type OfferBadge = 'cheapest' | 'recommended';

export interface OfferPrice {
  nights: number;
  weekendNights: number;
  roomSubtotalCents: number;
  feesCents: number;
  feeLabel: string | null;
  taxCents: number;
  taxRateBps: number;
  taxIncluded: boolean;
  totalCents: number;
  averageNightlyCents: number;
  currency: 'ZAR';
}

export interface Offer {
  id: number;
  provider: ProviderRef;
  mealPlan: MealPlan;
  cancellationPolicy: CancellationPolicy;
  freeCancellationHours: number | null;
  price: OfferPrice;
  badges: OfferBadge[];
  dataStatus: DataStatus;
  lastCheckedAt: string;
  exampleUrl: string | null;
}

export interface OfferGroup {
  roomType: Pick<RoomType, 'id' | 'name' | 'maxGuests' | 'bedrooms'>;
  offers: Offer[];
}

export type UnavailableReason = 'booked_for_dates' | 'too_small' | 'min_nights';

export interface UnavailableRoom {
  roomTypeName: string;
  reason: UnavailableReason;
  minNights: number | null;
}

export interface OffersResponse {
  stay: StaySummary;
  summary: {
    eligibleCount: number;
    cheapestOfferId: number | null;
    recommendedOfferId: number | null;
    recommendationReason: string | null;
    priceSpreadCents: number | null;
  };
  groups: OfferGroup[];
  unavailable: UnavailableRoom[];
}
