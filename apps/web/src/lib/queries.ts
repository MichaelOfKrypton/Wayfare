import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';

export function useSearchResults(params: URLSearchParams | null) {
  const key = params?.toString() ?? '';
  return useQuery({
    queryKey: ['search', key],
    queryFn: ({ signal }) => api.search(params!, signal),
    enabled: params !== null,
    // Keep showing the previous results while a refined search loads (no layout jump).
    placeholderData: keepPreviousData,
  });
}

export function useFilters() {
  return useQuery({
    queryKey: ['filters'],
    queryFn: ({ signal }) => api.filters(signal),
    staleTime: Infinity,
  });
}

export function useFeaturedDestinations() {
  return useQuery({
    queryKey: ['destinations', 'featured'],
    queryFn: ({ signal }) => api.destinations({ featured: true, limit: 12 }, signal),
    staleTime: Infinity,
  });
}

export function useDestinationSuggestions(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['destinations', 'suggest', trimmed.toLowerCase()],
    queryFn: ({ signal }) => api.destinations({ q: trimmed, limit: 8 }, signal),
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useDestination(slug: string | undefined) {
  return useQuery({
    queryKey: ['destination', slug],
    queryFn: ({ signal }) => api.destination(slug!, signal),
    enabled: Boolean(slug),
    staleTime: Infinity,
  });
}

export function useProperty(slug: string) {
  return useQuery({
    queryKey: ['property', slug],
    queryFn: ({ signal }) => api.property(slug, signal),
  });
}

export function useOffers(
  slug: string,
  stay: { checkIn: string; checkOut: string; guests: number } | null,
) {
  return useQuery({
    queryKey: ['offers', slug, stay?.checkIn, stay?.checkOut, stay?.guests],
    queryFn: ({ signal }) => api.offers(slug, stay!, signal),
    enabled: stay !== null,
    placeholderData: keepPreviousData,
  });
}

export function useCalendar(
  slug: string,
  query: { month: string; nights: number; guests: number },
) {
  return useQuery({
    queryKey: ['calendar', slug, query.month, query.nights, query.guests],
    queryFn: ({ signal }) => api.calendar(slug, query, signal),
    // Keep the previous month on screen while the next one loads, so the grid never jumps.
    placeholderData: keepPreviousData,
  });
}
