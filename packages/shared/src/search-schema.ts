/**
 * Query-string schemas shared by the API (authoritative validation) and the web
 * app (parsing URL state). Inputs are strings because they come from a URL.
 */
import { z } from 'zod';
import { diffDays, isValidDateString, MAX_STAY_NIGHTS } from './dates';
import { SORT_OPTIONS } from './domain';
import { isWithinSouthAfrica } from './geo';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slug = z
  .string()
  .max(80)
  .regex(SLUG_PATTERN, { error: 'Must be a lowercase slug (letters, digits and hyphens).' });

const dateString = z
  .string()
  .refine(isValidDateString, { error: 'Must be a valid date in YYYY-MM-DD format.' });

/** A numeric string → number, with bounds. Rejects "", "abc", "1e5". */
function numberParam(opts: { min: number; max: number; integer?: boolean }) {
  const pattern = opts.integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/;
  const label = opts.integer ? 'a whole number' : 'a number';
  return z
    .string()
    .regex(pattern, { error: `Must be ${label}.` })
    .transform(Number)
    .pipe(
      z
        .number()
        .min(opts.min, { error: `Must be at least ${opts.min}.` })
        .max(opts.max, { error: `Must be at most ${opts.max}.` }),
    );
}

const booleanParam = z
  .enum(['true', 'false'], { error: 'Must be "true" or "false".' })
  .transform((v) => v === 'true');

const slugList = z
  .string()
  .max(600)
  .transform((s) =>
    s
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .pipe(z.array(slug).max(25, { error: 'Too many values.' }))
  .transform((values) => [...new Set(values)]);

export const stayQueryShape = {
  checkIn: dateString,
  checkOut: dateString,
  guests: numberParam({ min: 1, max: 16, integer: true }),
};

function refineStay(value: { checkIn: unknown; checkOut: unknown }, ctx: z.RefinementCtx): void {
  // Zod 4 still runs refinements when individual fields failed; only check valid dates.
  if (
    typeof value.checkIn !== 'string' ||
    typeof value.checkOut !== 'string' ||
    !isValidDateString(value.checkIn) ||
    !isValidDateString(value.checkOut)
  ) {
    return;
  }
  const nights = diffDays(value.checkIn, value.checkOut);
  if (nights < 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['checkOut'],
      message: 'Check-out must be after check-in.',
    });
  } else if (nights > MAX_STAY_NIGHTS) {
    ctx.addIssue({
      code: 'custom',
      path: ['checkOut'],
      message: `Stays are limited to ${MAX_STAY_NIGHTS} nights.`,
    });
  }
}

export const searchQuerySchema = z
  .strictObject({
    ...stayQueryShape,
    destination: slug.optional(),
    lat: numberParam({ min: -90, max: 90 }).optional(),
    lng: numberParam({ min: -180, max: 180 }).optional(),
    radiusKm: numberParam({ min: 1, max: 200 }).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    minBedrooms: numberParam({ min: 0, max: 10, integer: true }).optional(),
    minPrice: numberParam({ min: 0, max: 1_000_000, integer: true }).optional(),
    maxPrice: numberParam({ min: 0, max: 1_000_000, integer: true }).optional(),
    types: slugList.optional(),
    amenities: slugList.optional(),
    minRating: numberParam({ min: 0, max: 10 }).optional(),
    freeCancellation: booleanParam.optional(),
    sort: z.enum(SORT_OPTIONS, { error: `Must be one of: ${SORT_OPTIONS.join(', ')}.` }).optional(),
    page: numberParam({ min: 1, max: 1000, integer: true }).optional(),
    pageSize: numberParam({ min: 1, max: 50, integer: true }).optional(),
  })
  .superRefine((value, ctx) => {
    refineStay(value, ctx);
    const hasLat = value.lat !== undefined;
    const hasLng = value.lng !== undefined;
    const lat = typeof value.lat === 'number' ? value.lat : null;
    const lng = typeof value.lng === 'number' ? value.lng : null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: [hasLat ? 'lng' : 'lat'],
        message: 'Latitude and longitude must be provided together.',
      });
    }
    if (hasLat && hasLng) {
      if (value.destination) {
        ctx.addIssue({
          code: 'custom',
          path: ['destination'],
          message: 'Use either a destination or coordinates, not both.',
        });
      }
      if (lat !== null && lng !== null && !isWithinSouthAfrica({ lat, lng })) {
        ctx.addIssue({
          code: 'custom',
          path: ['lat'],
          message: 'Coordinates must be within South Africa.',
        });
      }
    }
    if (
      typeof value.minPrice === 'number' &&
      typeof value.maxPrice === 'number' &&
      value.minPrice > value.maxPrice
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['minPrice'],
        message: 'Minimum price cannot exceed maximum price.',
      });
    }
    const hasReference = Boolean(value.destination) || (hasLat && hasLng);
    if (value.sort === 'distance_asc' && !hasReference) {
      ctx.addIssue({
        code: 'custom',
        path: ['sort'],
        message: 'Sorting by distance needs a destination or your location.',
      });
    }
  });

export type SearchQueryInput = z.input<typeof searchQuerySchema>;
export type SearchQuery = z.output<typeof searchQuerySchema>;

export const offersQuerySchema = z.strictObject(stayQueryShape).superRefine(refineStay);
export type OffersQuery = z.output<typeof offersQuerySchema>;

export const destinationsQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(80).optional(),
  featured: z
    .literal('true')
    .transform(() => true)
    .optional(),
  limit: numberParam({ min: 1, max: 20, integer: true }).optional(),
});
export type DestinationsQuery = z.output<typeof destinationsQuerySchema>;

export const slugParamSchema = z.strictObject({ slug });

/** Serialises a parsed search back into a canonical, stable query string. */
export function searchQueryToParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  const order: (keyof SearchQuery)[] = [
    'destination',
    'lat',
    'lng',
    'radiusKm',
    'checkIn',
    'checkOut',
    'guests',
    'minBedrooms',
    'q',
    'minPrice',
    'maxPrice',
    'types',
    'amenities',
    'minRating',
    'freeCancellation',
    'sort',
    'page',
    'pageSize',
  ];
  for (const key of order) {
    const value = query[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, [...value].sort().join(','));
    } else if (typeof value === 'boolean') {
      if (value) params.set(key, 'true');
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}
