import {
  AMENITY_CATEGORY_LABELS,
  todayInTimeZone,
  type AmenityCategory,
  type PropertyDetail,
} from '@wayfare/shared';
import {
  ArrowLeft,
  BedDouble,
  Check,
  Clock,
  Database,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { RatingPill } from '../components/RatingPill';
import { SaveButton } from '../components/SaveButton';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { PriceCalendar } from '../features/calendar/PriceCalendar';
import { StayControls, useStayFromUrl } from '../features/stay/StayControls';
import { OfferComparison } from '../features/offers/OfferComparison';
import { ApiError } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import { useOffers, useProperty } from '../lib/queries';
import styles from './PropertyPage.module.css';

const PropertyMap = lazy(() => import('../features/map/PropertyMap'));

export function PropertyPage() {
  const { slug = '' } = useParams();
  const property = useProperty(slug);
  const { stay, setStay, correction } = useStayFromUrl();
  const offers = useOffers(slug, property.data ? stay : null);
  useDocumentTitle(property.data?.name ?? 'Property');

  if (property.isPending) return <PropertySkeleton />;
  if (property.isError) {
    if (property.error instanceof ApiError && property.error.status === 404) {
      return (
        <div className={`container ${styles.page}`}>
          <EmptyState title="We couldn’t find that property" actions={<BackToSearch stay={stay} />}>
            It may have been removed from the demo dataset, or the link may be mistyped.
          </EmptyState>
        </div>
      );
    }
    return (
      <div className={`container ${styles.page}`}>
        <ErrorState message={property.error.message} onRetry={() => void property.refetch()} />
      </div>
    );
  }

  const p = property.data;
  const searchHref = `/search?${new URLSearchParams({
    destination: p.destination.slug,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: String(stay.guests),
  }).toString()}`;

  return (
    <div className={`container ${styles.page}`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to={searchHref}>
          <ArrowLeft size={16} aria-hidden="true" /> Stays in {p.destination.name}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {p.propertyType.name} · {p.destination.province}
          </p>
          <h1 className={styles.title}>{p.name}</h1>
          <p className={styles.location}>
            <MapPin size={16} aria-hidden="true" />
            {[p.suburb, p.destination.name].filter((v, i, a) => v && a.indexOf(v) === i).join(', ')}
          </p>
        </div>
        <div className={styles.headerAside}>
          <RatingPill rating={p.rating} />
          <SaveButton slug={p.slug} name={p.name} variant="inline" />
          {p.isDemo ? (
            <Badge tone="warning">Fictional demo property</Badge>
          ) : (
            <Badge tone="primary">Real place · simulated prices</Badge>
          )}
        </div>
      </header>

      {p.realPlace && <RealPlaceLinks name={p.name} place={p.realPlace} />}

      <Gallery images={p.images} />

      {/* Keyed by month so changing dates elsewhere jumps the calendar to that month. */}
      <PriceCalendar
        key={stay.checkIn.slice(0, 7)}
        slug={p.slug}
        stay={stay}
        today={todayInTimeZone()}
        onSelect={setStay}
      />

      <section className={styles.offersSection} aria-labelledby="offers-title" id="offers">
        <div className={styles.offersHead}>
          <div>
            <h2 id="offers-title" className={styles.sectionTitle}>
              Compare offers
            </h2>
            <p className={styles.sectionLede}>
              Every provider’s price for your exact stay, including fees and VAT. All offers are
              simulated.
            </p>
          </div>
          <StayControls
            key={`${stay.checkIn}|${stay.checkOut}|${stay.guests}`}
            stay={stay}
            onChange={setStay}
          />
        </div>
        {correction && (
          <p className={styles.correction} role="status">
            {correction}
          </p>
        )}
        {offers.isPending ? (
          <div className={styles.offersLoading} aria-busy="true">
            <Skeleton height={90} radius={8} />
            <Skeleton height={220} radius={12} />
          </div>
        ) : offers.isError ? (
          <ErrorState message={offers.error.message} onRetry={() => void offers.refetch()} />
        ) : (
          <div className={offers.isFetching ? styles.refreshing : undefined}>
            <OfferComparison data={offers.data} propertyName={p.name} />
          </div>
        )}
      </section>

      <div className={styles.details}>
        <section aria-labelledby="about-title" className={styles.card}>
          <h2 id="about-title" className={styles.sectionTitle}>
            About this stay
          </h2>
          <p className={styles.summary}>{p.summary}</p>
          <p className={styles.description}>{p.description}</p>
          <dl className={styles.facts}>
            <div>
              <dt>
                <Clock size={16} aria-hidden="true" /> Check-in
              </dt>
              <dd>
                {p.checkIn.from ? `From ${p.checkIn.from}` : 'Not specified'}
                {p.checkIn.until ? ` until ${p.checkIn.until}` : ''}
              </dd>
            </div>
            <div>
              <dt>
                <Clock size={16} aria-hidden="true" /> Check-out
              </dt>
              <dd>{p.checkOut.until ? `By ${p.checkOut.until}` : 'Not specified'}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="rooms-title" className={styles.card}>
          <h2 id="rooms-title" className={styles.sectionTitle}>
            Rooms and units
          </h2>
          <ul className={styles.rooms}>
            {p.roomTypes.map((room) => (
              <li key={room.id}>
                <p className={styles.roomName}>{room.name}</p>
                <p className={styles.roomMeta}>
                  <Users size={14} aria-hidden="true" /> Sleeps {room.maxGuests}
                  <BedDouble size={14} aria-hidden="true" /> {room.beds}
                </p>
                {room.description && <p className={styles.roomDesc}>{room.description}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="amenities-title" className={`${styles.card} ${styles.wide}`}>
          <h2 id="amenities-title" className={styles.sectionTitle}>
            Amenities
          </h2>
          <Amenities amenities={p.amenities} />
          {!p.isDemo && p.amenities.length > 0 && (
            <p className={styles.sectionLede}>
              Amenities marked “confirmed” come from OpenStreetMap. The others are simulated for the
              demo.
            </p>
          )}
        </section>

        <section aria-labelledby="location-title" className={`${styles.card} ${styles.wide}`}>
          <h2 id="location-title" className={styles.sectionTitle}>
            Location
          </h2>
          <p className={styles.sectionLede}>
            {p.suburb ? `${p.suburb}, ` : ''}
            {p.destination.name}, {p.destination.province}.{' '}
            {p.isDemo
              ? 'Coordinates are approximate, and the property is fictional.'
              : 'Location from OpenStreetMap.'}
          </p>
          <div className={styles.mapFrame}>
            <Suspense fallback={<div className={styles.mapLoading}>Loading map…</div>}>
              <PropertyMap lat={p.lat} lng={p.lng} name={p.name} />
            </Suspense>
          </div>
        </section>

        <Provenance property={p} />
      </div>
    </div>
  );
}

function Gallery({ images }: { images: PropertyDetail['images'] }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  if (!current) return null;
  return (
    <section className={styles.gallery} aria-label="Image gallery">
      <figure className={styles.mainFigure}>
        <img src={current.url} alt={current.alt} className={styles.mainImage} />
        <figcaption className={styles.caption}>
          {current.credit && current.creditUrl ? (
            <>
              Photo {index + 1} of {images.length} ·{' '}
              <a href={current.creditUrl} target="_blank" rel="noopener noreferrer">
                {current.credit}
              </a>
            </>
          ) : (
            <>
              Illustration {index + 1} of {images.length} · original demo artwork, not a photograph
            </>
          )}
        </figcaption>
      </figure>
      <ul className={styles.thumbs}>
        {images.map((image, i) => (
          <li key={image.url + i}>
            <button
              type="button"
              className={styles.thumb}
              aria-label={`Show image ${i + 1}: ${image.alt}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              <img src={image.url} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Amenities({ amenities }: { amenities: PropertyDetail['amenities'] }) {
  if (amenities.length === 0) return <p className={styles.sectionLede}>No amenities listed.</p>;
  const byCategory = new Map<AmenityCategory, typeof amenities>();
  for (const a of amenities) byCategory.set(a.category, [...(byCategory.get(a.category) ?? []), a]);
  return (
    <div className={styles.amenityGrid}>
      {[...byCategory.entries()].map(([category, items]) => (
        <div key={category}>
          <h3 className={styles.amenityHeading}>{AMENITY_CATEGORY_LABELS[category]}</h3>
          <ul className={styles.amenityList}>
            {items.map((a) => (
              <li key={a.slug}>
                <Check size={16} aria-hidden="true" /> {a.name}
                {a.verified && <span className={styles.verified}>confirmed</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Provenance({ property }: { property: PropertyDetail }) {
  return (
    <section
      aria-labelledby="provenance-title"
      className={`${styles.card} ${styles.wide} ${styles.provenance}`}
    >
      <h2 id="provenance-title" className={styles.sectionTitle}>
        <Database size={18} aria-hidden="true" /> Data source and status
      </h2>
      <dl className={styles.provenanceList}>
        <div>
          <dt>Source</dt>
          <dd>
            {property.isDemo
              ? `${property.dataSource.name} (${property.dataSource.kind})`
              : 'Name, location and contact details: OpenStreetMap contributors (ODbL)'}
          </dd>
        </div>
        <div>
          <dt>Listed by</dt>
          <dd>{property.providers.map((pr) => pr.name).join(', ')}, all fictional providers</dd>
        </div>
        <div>
          <dt>Prices and availability</dt>
          <dd>Simulated from a deterministic seed, not live and not bookable</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>
            {property.rating ? `${property.rating.label}, not real guest reviews` : 'No score'}
          </dd>
        </div>
      </dl>
      <p className={styles.sectionLede}>
        <Link to="/how-it-works">How Wayfare’s demo data, pricing and ranking work →</Link>
      </p>
    </section>
  );
}

/** Links to the real property. External, so they open in a new tab without a referrer. */
function RealPlaceLinks({
  name,
  place,
}: {
  name: string;
  place: NonNullable<PropertyDetail['realPlace']>;
}) {
  return (
    <section className={styles.realLinks} aria-label={`Contact ${name}`}>
      {place.websiteUrl && (
        <a
          className={styles.realLink}
          href={place.websiteUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <Globe size={16} aria-hidden="true" /> Visit website
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      )}
      {place.phone && (
        <a className={styles.realLink} href={`tel:${place.phone.replace(/[^+\d]/g, '')}`}>
          <Phone size={16} aria-hidden="true" /> {place.phone}
        </a>
      )}
      <a className={styles.realLink} href={place.osmUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={16} aria-hidden="true" /> View on OpenStreetMap
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>
      <p className={styles.realNote}>
        Wayfare isn’t affiliated with this property. Confirm prices and availability with them
        directly.
      </p>
    </section>
  );
}

function BackToSearch({ stay }: { stay: { checkIn: string; checkOut: string; guests: number } }) {
  return (
    <Link
      to={`/search?${new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) }).toString()}`}
    >
      Browse all stays
    </Link>
  );
}

function PropertySkeleton() {
  return (
    <div className={`container ${styles.page}`} aria-busy="true" aria-label="Loading property">
      <Skeleton width="30%" height={14} />
      <Skeleton width="60%" height={36} />
      <Skeleton height={360} radius={12} />
      <Skeleton height={200} radius={12} />
    </div>
  );
}
