import { formatZar, pluralise, type OffersResponse, type PropertyDetail } from '@wayfare/shared';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, Check, ExternalLink, Heart, Minus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RatingPill } from '../components/RatingPill';
import { EmptyState, Skeleton } from '../components/States';
import { propertyHref } from '../features/results/PropertyCard';
import { StayControls, useStayFromUrl } from '../features/stay/StayControls';
import { api } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import { MAX_COMPARE, savedStore, useSaved } from '../lib/saved';
import styles from './SavedPage.module.css';

interface Column {
  slug: string;
  name: string;
  property?: PropertyDetail;
  offers?: OffersResponse;
  loading: boolean;
  missing: boolean;
}

/** Cheapest eligible offer for the stay, or null when nothing is bookable. */
function cheapestOffer(offers: OffersResponse | undefined) {
  const all = offers?.groups.flatMap((g) => g.offers) ?? [];
  return all.reduce<(typeof all)[number] | null>(
    (best, o) => (!best || o.price.totalCents < best.price.totalCents ? o : best),
    null,
  );
}

export function SavedPage() {
  useDocumentTitle('Saved places');
  const saved = useSaved();
  const { stay, setStay } = useStayFromUrl();
  const [picked, setPicked] = useState<string[] | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  // Compare the user's picks, or the newest saved places by default.
  const compareSlugs = (picked ?? saved.map((p) => p.slug))
    .filter((slug) => saved.some((p) => p.slug === slug))
    .slice(0, MAX_COMPARE);

  const details = useQueries({
    queries: saved.map((p) => ({
      queryKey: ['property', p.slug],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.property(p.slug, signal),
      retry: false,
    })),
  });
  const offers = useQueries({
    queries: compareSlugs.map((slug) => ({
      queryKey: ['offers', slug, stay.checkIn, stay.checkOut, stay.guests],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.offers(slug, stay, signal),
      retry: false,
    })),
  });

  const detailBySlug = new Map(saved.map((p, i) => [p.slug, details[i]]));
  const columns: Column[] = compareSlugs.map((slug, i) => {
    const detail = detailBySlug.get(slug);
    return {
      slug,
      name: saved.find((p) => p.slug === slug)!.name,
      property: detail?.data,
      offers: offers[i]?.data,
      loading: Boolean(detail?.isPending || offers[i]?.isPending),
      missing: Boolean(detail?.isError),
    };
  });

  function toggleCompare(slug: string) {
    const current = compareSlugs;
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug].slice(-MAX_COMPARE);
    setPicked(next);
  }

  if (saved.length === 0) {
    return (
      <div className={`container ${styles.page}`}>
        <header className={styles.header}>
          <h1>Saved places</h1>
        </header>
        <EmptyState
          icon={<Heart size={28} aria-hidden="true" />}
          title="Nothing saved yet"
          actions={
            <Link to="/search" className={styles.browse}>
              Browse stays <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          Tap the heart on any stay to save it here, then compare up to {MAX_COMPARE} side by side.
          Saved places stay in this browser; no account needed.
        </EmptyState>
      </div>
    );
  }

  // Best values across the compared places, for highlighting.
  const prices = columns.map((c) => cheapestOffer(c.offers)?.price.totalCents ?? null);
  const lowest = Math.min(...prices.filter((p): p is number => p !== null));
  const scores = columns.map((c) => c.property?.rating?.score ?? null);
  const topScore = Math.max(...scores.filter((s): s is number => s !== null));
  const amenityNames = [
    ...new Map(
      columns.flatMap((c) => c.property?.amenities ?? []).map((a) => [a.slug, a.name]),
    ).entries(),
  ]
    .sort((a, b) => a[1].localeCompare(b[1]))
    // Optionally hide amenities every compared place has (or lacks) alike.
    .filter(
      ([slug]) =>
        !onlyDifferences ||
        new Set(columns.map((c) => c.property?.amenities.some((a) => a.slug === slug))).size > 1,
    );

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1>Saved places</h1>
          <p className={styles.lede}>
            {pluralise(saved.length, 'place')} saved in this browser. Comparing{' '}
            {pluralise(columns.length, 'place')} for your dates.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Trash2 size={16} aria-hidden="true" />}
          onClick={() => {
            if (window.confirm('Remove all saved places?')) savedStore.clear();
          }}
        >
          Clear all
        </Button>
      </header>

      <div className={styles.stayBar}>
        <StayControls
          key={`${stay.checkIn}|${stay.checkOut}|${stay.guests}`}
          stay={stay}
          onChange={setStay}
        />
      </div>

      <section aria-labelledby="compare-title" className={styles.compare}>
        <div className={styles.compareHead}>
          <h2 id="compare-title" className={styles.sectionTitle}>
            Side by side
          </h2>
          <label className={styles.compareToggle}>
            <input
              type="checkbox"
              checked={onlyDifferences}
              onChange={(e) => setOnlyDifferences(e.target.checked)}
            />
            Only show differences
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">
              Comparison of {columns.map((c) => c.name).join(', ')}
            </caption>
            <thead>
              <tr>
                <td />
                {columns.map((c) => (
                  <th key={c.slug} scope="col" className={styles.placeHead}>
                    {c.property?.images[0] ? (
                      <img src={c.property.images[0].url} alt="" className={styles.thumb} />
                    ) : (
                      <span className={styles.thumb} aria-hidden="true" />
                    )}
                    <Link to={propertyHref(c.slug, stay)} className={styles.placeName}>
                      {c.name}
                    </Link>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Stop comparing ${c.name}`}
                      onClick={() => toggleCompare(c.slug)}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Price for your stay">
                {columns.map((c, i) => {
                  if (c.loading) return <Skeleton key={c.slug} height={40} />;
                  const offer = cheapestOffer(c.offers);
                  return offer ? (
                    <div key={c.slug} className={styles.price}>
                      <strong>{formatZar(offer.price.totalCents)}</strong>
                      <span>
                        {formatZar(offer.price.averageNightlyCents)} / night · {offer.provider.name}
                      </span>
                      {prices[i] === lowest && columns.length > 1 && (
                        <Badge tone="primary">Lowest price</Badge>
                      )}
                    </div>
                  ) : (
                    <span key={c.slug} className={styles.muted}>
                      {c.missing ? 'No longer listed' : 'Nothing available for these dates'}
                    </span>
                  );
                })}
              </Row>
              <Row label="Demo score">
                {columns.map((c, i) =>
                  c.property ? (
                    <div key={c.slug} className={styles.stack}>
                      <RatingPill rating={c.property.rating} />
                      {scores[i] === topScore && columns.length > 1 && (
                        <Badge tone="primary">Top score</Badge>
                      )}
                    </div>
                  ) : (
                    <Skeleton key={c.slug} height={28} />
                  ),
                )}
              </Row>
              <Row label="Type">
                {columns.map((c) => (
                  <span key={c.slug}>
                    {c.property?.propertyType.name ?? '…'}
                    {c.property?.realPlace?.stars ? ` · ${c.property.realPlace.stars}★` : ''}
                  </span>
                ))}
              </Row>
              <Row label="Location">
                {columns.map((c) => (
                  <span key={c.slug}>
                    {c.property
                      ? [c.property.suburb, c.property.destination.name]
                          .filter((v, i, a) => v && a.indexOf(v) === i)
                          .join(', ')
                      : '…'}
                  </span>
                ))}
              </Row>
              <Row label="Free cancellation">
                {columns.map((c) => {
                  const free = c.offers?.groups.some((g) =>
                    g.offers.some((o) => o.cancellationPolicy === 'free'),
                  );
                  return <YesNo key={c.slug} value={c.offers ? Boolean(free) : undefined} />;
                })}
              </Row>
              {amenityNames.map(([slug, name]) => (
                <Row key={slug} label={name}>
                  {columns.map((c) => (
                    <YesNo
                      key={c.slug}
                      value={
                        c.property ? c.property.amenities.some((a) => a.slug === slug) : undefined
                      }
                    />
                  ))}
                </Row>
              ))}
              <Row label="Website">
                {columns.map((c) =>
                  c.property?.realPlace?.websiteUrl ? (
                    <a
                      key={c.slug}
                      href={c.property.realPlace.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={styles.external}
                    >
                      Visit <ExternalLink size={14} aria-hidden="true" />
                      <span className="visually-hidden"> {c.name} (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span key={c.slug} className={styles.muted}>
                      Not listed
                    </span>
                  ),
                )}
              </Row>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="all-saved-title">
        <h2 id="all-saved-title" className={styles.sectionTitle}>
          All saved places
        </h2>
        <p className={styles.lede}>Choose up to {MAX_COMPARE} to compare.</p>
        <ul className={`${styles.savedList} stagger`}>
          {saved.map((p) => {
            const detail = detailBySlug.get(p.slug)?.data;
            const comparing = compareSlugs.includes(p.slug);
            return (
              <li key={p.slug} className={styles.savedItem}>
                {detail?.images[0] ? (
                  <img src={detail.images[0].url} alt="" className={styles.savedThumb} />
                ) : (
                  <span className={styles.savedThumb} aria-hidden="true" />
                )}
                <div className={styles.savedText}>
                  <Link to={propertyHref(p.slug, stay)} className={styles.placeName}>
                    {p.name}
                  </Link>
                  <span className={styles.muted}>
                    {detail
                      ? `${detail.propertyType.name} · ${detail.destination.name}`
                      : 'Loading…'}
                  </span>
                </div>
                <label className={styles.compareToggle}>
                  <input
                    type="checkbox"
                    checked={comparing}
                    onChange={() => toggleCompare(p.slug)}
                  />
                  Compare
                </label>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Remove ${p.name} from saved places`}
                  onClick={() => savedStore.remove(p.slug)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode[] }) {
  return (
    <tr>
      <th scope="row" className={styles.rowLabel}>
        {label}
      </th>
      {children.map((cell, i) => (
        <td key={i}>{cell}</td>
      ))}
    </tr>
  );
}

function YesNo({ value }: { value: boolean | undefined }) {
  if (value === undefined) return <span className={styles.muted}>…</span>;
  return value ? (
    <span className={styles.yes}>
      <Check size={16} aria-hidden="true" /> Yes
    </span>
  ) : (
    <span className={styles.no}>
      <Minus size={16} aria-hidden="true" /> No
    </span>
  );
}
