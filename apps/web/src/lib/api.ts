import type {
  ApiErrorBody,
  Destination,
  DestinationsResponse,
  FiltersResponse,
  OffersResponse,
  PropertyDetail,
  SearchResponse,
} from '@wayfare/shared';

/** An API failure with a user-presentable message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(
  path: string,
  params?: URLSearchParams,
  signal?: AbortSignal,
): Promise<T> {
  const url = params && params.size > 0 ? `${path}?${params.toString()}` : path;
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'We could not reach the Wayfare server. Is the API running?',
    );
  }
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed (${response.status}).`,
      err?.issues ?? [],
    );
  }
  return body as T;
}

export const api = {
  search: (params: URLSearchParams, signal?: AbortSignal) =>
    getJson<SearchResponse>('/api/search', params, signal),
  filters: (signal?: AbortSignal) => getJson<FiltersResponse>('/api/filters', undefined, signal),
  destinations: (
    query: { q?: string; featured?: boolean; limit?: number },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.featured) params.set('featured', 'true');
    if (query.limit) params.set('limit', String(query.limit));
    return getJson<DestinationsResponse>('/api/destinations', params, signal);
  },
  destination: (slug: string, signal?: AbortSignal) =>
    getJson<Destination>(`/api/destinations/${encodeURIComponent(slug)}`, undefined, signal),
  property: (slug: string, signal?: AbortSignal) =>
    getJson<PropertyDetail>(`/api/properties/${encodeURIComponent(slug)}`, undefined, signal),
  offers: (
    slug: string,
    stay: { checkIn: string; checkOut: string; guests: number },
    signal?: AbortSignal,
  ) =>
    getJson<OffersResponse>(
      `/api/properties/${encodeURIComponent(slug)}/offers`,
      new URLSearchParams({
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: String(stay.guests),
      }),
      signal,
    ),
};
