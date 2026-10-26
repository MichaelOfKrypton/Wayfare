import {
  formatShortDate,
  formatZar,
  pluralise,
  SORT_LABELS,
  SORT_OPTIONS,
  type SearchQuery,
  type SortOption,
} from '@wayfare/shared';
import { List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { FilterPanel } from '../features/filters/FilterPanel';
import { Pagination } from '../features/results/Pagination';
import { PropertyCard, propertyHref } from '../features/results/PropertyCard';
import { SearchForm } from '../features/search/SearchForm';
import type { PlaceSelection } from '../features/search/DestinationCombobox';
import { ApiError } from '../lib/api';
import { useDocumentTitle, useMediaQuery } from '../lib/hooks';
import { useDestination, useFilters, useSearchResults } from '../lib/queries';
import {
  activeFilterCount,
  hasReference,
  parseSearchParams,
  updateSearch,
} from '../lib/searchState';
import styles from './SearchPage.module.css';

const ResultsMap = lazy(() => import('../features/map/ResultsMap'));

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { query, corrections } = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const canonical = useMemo(() => updateSearch(query, { page: query.page }), [query]);

  const results = useSearchResults(canonical);
  const filters = useFilters();
  const destination = useDestination(query.destination);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isWide = useMediaQuery('(min-width: 1280px)');

  const [view, setView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const cardRefs = useRef(new Map<number, HTMLElement>());
  const listTopRef = useRef<HTMLDivElement>(null);

  const data = results.data;
  const placeLabel = data?.reference?.label ?? destination.data?.name ?? 'All of South Africa';
  useDocumentTitle(`Stays in ${placeLabel}`);

  const setQuery = useCallback(
    (patch: Partial<SearchQuery>) => {
      // flushSync: commit immediately so controlled inputs (checkboxes) never flicker back.
      setSearchParams(updateSearch(query, patch), { replace: !('page' in patch), flushSync: true });
      setSelectedId(null);
    },
    [query, setSearchParams],
  );

  const clearFilters = () =>
    setQuery({
      minPrice: undefined,
      maxPrice: undefined,
      types: undefined,
      amenities: undefined,
      minRating: undefined,
      freeCancellation: undefined,
      minBedrooms: undefined,
      radiusKm: undefined,
      q: undefined,
    });

  // Map → list: scroll the selected card into view (when it's on this page).
  useEffect(() => {
    if (selectedId === null) return;
    const el = cardRefs.current.get(selectedId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  const showMap = isWide || view === 'map';
  const showList = isWide || view === 'list';
  const selectedPoint = data?.mapPoints.find((p) => p.id === selectedId);
  const selectedOnPage = data?.items.some((i) => i.id === selectedId);

  const initialPlace: PlaceSelection = query.destination
    ? { kind: 'destination', slug: query.destination, label: destination.data?.name ?? '' }
    : query.lat !== undefined && query.lng !== undefined
      ? { kind: 'coordinates', lat: query.lat, lng: query.lng, label: 'Current location' }
      : { kind: 'anywhere', label: '' };

  const filterPanel = (
    <FilterPanel
      query={query}
      filters={filters.data}
      defaultRadiusKm={destination.data?.searchRadiusKm ?? (hasReference(query) ? 25 : null)}
      onChange={setQuery}
      onClear={clearFilters}
    />
  );
  const filterCount = activeFilterCount(query);
  const sortOptions = SORT_OPTIONS.filter((s) => s !== 'distance_asc' || hasReference(query));

  return (
    <div className={styles.page}>
      <section className={styles.searchBar} aria-label="Change search">
        {/* Remount the form when place/dates change from outside so its fields stay in sync. */}
        <SearchForm
          key={`${query.destination ?? ''}|${query.lat ?? ''}|${query.checkIn}|${query.checkOut}|${query.guests}|${destination.data?.name ?? ''}`}
          variant="compact"
          baseQuery={query}
          initial={{
            place: initialPlace,
            checkIn: query.checkIn,
            checkOut: query.checkOut,
            guests: query.guests,
          }}
        />
      </section>

      <div className={styles.workspace}>
        {isDesktop && (
          <aside className={styles.sidebar} aria-label="Filters">
            {filterPanel}
          </aside>
        )}

        <div className={styles.resultsColumn} hidden={!showList}>
          <div ref={listTopRef} className={styles.toolbar}>
            <div className={styles.summary} aria-live="polite">
              <h1 className={styles.heading}>
                {data ? pluralise(data.pagination.totalItems, 'stay') : 'Searching'} in {placeLabel}
              </h1>
              <p className={styles.stay}>
                {formatShortDate(query.checkIn)} – {formatShortDate(query.checkOut)} ·{' '}
                {pluralise(query.guests, 'guest')}
                {data?.reference ? ` · within ${data.reference.radiusKm} km` : ''}
                {results.isFetching && data ? (
                  <span className={styles.updating}> · Updating…</span>
                ) : null}
              </p>
            </div>
            <div className={styles.controls}>
              {!isDesktop && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<SlidersHorizontal size={16} aria-hidden="true" />}
                  onClick={() => setFiltersOpen(true)}
                >
                  Filters{filterCount ? ` (${filterCount})` : ''}
                </Button>
              )}
              <label className={styles.sortLabel}>
                <span className="visually-hidden">Sort by</span>
                <select
                  className={styles.sort}
                  value={query.sort ?? 'recommended'}
                  onChange={(e) => setQuery({ sort: e.target.value as SortOption })}
                  aria-label="Sort by"
                >
                  {sortOptions.map((s) => (
                    <option key={s} value={s}>
                      {SORT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              {!isWide && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<MapIcon size={16} aria-hidden="true" />}
                  onClick={() => setView('map')}
                >
                  Map
                </Button>
              )}
            </div>
          </div>

          {corrections.length > 0 && (
            <div className={styles.correction} role="status">
              {corrections.map((c) => (
                <p key={c}>{c}</p>
              ))}
            </div>
          )}

          {(query.sort ?? 'recommended') === 'recommended' && data && data.items.length > 0 && (
            <p className={styles.rankingNote}>
              Recommended order balances demo score, price and distance.{' '}
              <Link to="/how-it-works#ranking">How ranking works</Link>
            </p>
          )}

          <ResultsBody
            state={results}
            onRetry={() => void results.refetch()}
            onClearFilters={filterCount ? clearFilters : undefined}
            onWiden={
              hasReference(query) && (query.radiusKm ?? 0) < 100
                ? () =>
                    setQuery({
                      radiusKm: Math.min(100, Math.max(25, (data?.reference?.radiusKm ?? 25) * 2)),
                    })
                : undefined
            }
          >
            {data && (
              <>
                <ol className={`${styles.list} stagger`} aria-label="Search results">
                  {data.items.map((item) => (
                    <li key={item.id} className="hover-lift">
                      <PropertyCard
                        ref={(el) => {
                          if (el) cardRefs.current.set(item.id, el);
                          else cardRefs.current.delete(item.id);
                        }}
                        item={item}
                        stay={data.stay}
                        selected={item.id === selectedId}
                        highlighted={item.id === hoveredId}
                        onHover={setHoveredId}
                      />
                    </li>
                  ))}
                </ol>
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  onChange={(page) => {
                    setQuery({ page });
                    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
              </>
            )}
          </ResultsBody>
        </div>

        {showMap && (
          <section className={styles.mapColumn} aria-label="Map">
            {!isWide && (
              <div className={styles.mapToolbar}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<List size={16} aria-hidden="true" />}
                  onClick={() => setView('list')}
                >
                  Show list
                </Button>
                {data && (
                  <span className={styles.mapCount}>
                    {pluralise(data.pagination.totalItems, 'stay')}
                  </span>
                )}
              </div>
            )}
            <div className={styles.mapFrame}>
              <Suspense fallback={<div className={styles.mapLoading}>Loading map…</div>}>
                <ResultsMap
                  points={data?.mapPoints ?? []}
                  reference={data?.reference ?? null}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={setSelectedId}
                />
              </Suspense>
              {selectedPoint && (!selectedOnPage || !showList) && data && (
                <div
                  className={styles.preview}
                  role="dialog"
                  aria-label={`Selected: ${selectedPoint.name}`}
                >
                  <div>
                    <p className={styles.previewName}>{selectedPoint.name}</p>
                    <p className={styles.previewPrice}>
                      {formatZar(selectedPoint.averageNightlyCents)} avg / night{' '}
                      <Badge tone="warning">Simulated</Badge>
                    </p>
                  </div>
                  <div className={styles.previewActions}>
                    <Link
                      className={styles.previewLink}
                      to={propertyHref(selectedPoint.slug, data.stay)}
                    >
                      View offers
                    </Link>
                    <button
                      type="button"
                      className={styles.previewClose}
                      onClick={() => setSelectedId(null)}
                      aria-label="Close preview"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            {data?.mapPointsTruncated && (
              <p className={styles.mapNote}>
                Showing the first 500 matches on the map. Narrow your filters to see more.
              </p>
            )}
          </section>
        )}
      </div>

      {!isDesktop && (
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filters"
          footer={
            <Button onClick={() => setFiltersOpen(false)}>
              Show {data ? pluralise(data.pagination.totalItems, 'stay') : 'stays'}
            </Button>
          }
        >
          {filterPanel}
        </Dialog>
      )}
    </div>
  );
}

function ResultsBody({
  state,
  onRetry,
  onClearFilters,
  onWiden,
  children,
}: {
  state: ReturnType<typeof useSearchResults>;
  onRetry: () => void;
  onClearFilters?: () => void;
  onWiden?: () => void;
  children: React.ReactNode;
}) {
  if (state.isPending) {
    return (
      <ol className={styles.list} aria-label="Loading results" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className={styles.skeletonCard}>
            <Skeleton height={180} radius={8} />
            <div className={styles.skeletonLines}>
              <Skeleton width="30%" height={12} />
              <Skeleton width="70%" height={22} />
              <Skeleton width="50%" height={14} />
              <Skeleton width="40%" height={14} />
            </div>
          </li>
        ))}
      </ol>
    );
  }
  if (state.isError) {
    const error = state.error;
    if (error instanceof ApiError && error.status === 400) {
      return (
        <ErrorState
          title="We couldn’t run that search"
          message={error.issues.map((i) => i.message).join(' ') || error.message}
        />
      );
    }
    return <ErrorState message={(error as Error).message} onRetry={onRetry} />;
  }
  if (state.data && state.data.items.length === 0) {
    if (state.data.pagination.totalItems > 0) {
      return (
        <EmptyState title="No more results">This page is past the end of the results.</EmptyState>
      );
    }
    return (
      <EmptyState
        title="No stays match this search"
        actions={
          <>
            {onWiden && (
              <Button variant="secondary" onClick={onWiden}>
                Widen the search area
              </Button>
            )}
            {onClearFilters && (
              <Button variant="secondary" onClick={onClearFilters}>
                Clear filters
              </Button>
            )}
          </>
        }
      >
        Every property is either fully booked for these dates, too small for your group, or filtered
        out. Try other dates, fewer filters or a larger area.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
