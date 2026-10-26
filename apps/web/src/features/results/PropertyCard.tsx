import {
  CANCELLATION_LABELS,
  formatDistanceKm,
  formatZar,
  MEAL_PLAN_LABELS,
  pluralise,
  type SearchResultItem,
  type StaySummary,
} from '@wayfare/shared';
import { Check, MapPin, Users } from 'lucide-react';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { RatingPill } from '../../components/RatingPill';
import styles from './PropertyCard.module.css';

interface Props {
  item: SearchResultItem;
  stay: StaySummary;
  selected?: boolean;
  highlighted?: boolean;
  onHover?: (id: number | null) => void;
}

export function propertyHref(
  slug: string,
  stay: Pick<StaySummary, 'checkIn' | 'checkOut' | 'guests'>,
): string {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: String(stay.guests),
  });
  return `/properties/${slug}?${params.toString()}`;
}

export const PropertyCard = forwardRef<HTMLElement, Props>(function PropertyCard(
  { item, stay, selected, highlighted, onHover },
  ref,
) {
  const offer = item.bestOffer;
  const href = propertyHref(item.slug, stay);
  const location = [item.suburb, item.destinationName]
    .filter((v, i, all) => v && all.indexOf(v) === i)
    .join(', ');

  return (
    <article
      ref={ref}
      id={`property-card-${item.id}`}
      className={`hover-card ${styles.card} ${selected ? styles.selected : ''} ${highlighted ? styles.highlighted : ''}`}
      onMouseEnter={() => onHover?.(item.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(item.id)}
      onBlur={() => onHover?.(null)}
      aria-current={selected ? 'true' : undefined}
      data-testid="property-card"
    >
      <div className={styles.inner}>
        <div className={styles.media}>
          {item.coverImage ? (
            <img
              src={item.coverImage.url}
              alt={item.coverImage.alt}
              loading="lazy"
              decoding="async"
              className={`hover-zoom ${styles.image}`}
            />
          ) : (
            <div className={styles.imagePlaceholder} aria-hidden="true" />
          )}
          <span className={styles.illustration} title={item.coverImage?.credit ?? undefined}>
            {item.coverImage?.credit ? 'Photo' : 'Illustration'}
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.main}>
            <p className={styles.eyebrow}>{item.propertyType.name}</p>
            <h3 className={styles.name}>
              <Link to={href} className={styles.link}>
                {item.name}
              </Link>
            </h3>
            <p className={styles.location}>
              <MapPin size={14} aria-hidden="true" />
              {location}
              {item.distanceKm !== null && (
                <span className={styles.distance}> · {formatDistanceKm(item.distanceKm)} away</span>
              )}
            </p>
            <RatingPill rating={item.rating} />
            {item.keyAmenities.length > 0 && (
              <ul className={styles.amenities} aria-label="Key amenities">
                {item.keyAmenities.map((a) => (
                  <li key={a.slug}>
                    <Check size={13} aria-hidden="true" />
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.priceBlock}>
            <div className={styles.badges}>
              {offer.cancellationPolicy === 'free' ? (
                <Badge tone="success">{CANCELLATION_LABELS.free}</Badge>
              ) : null}
              {offer.mealPlan === 'breakfast' ||
              offer.mealPlan === 'half_board' ||
              offer.mealPlan === 'full_board' ? (
                <Badge tone="neutral">{MEAL_PLAN_LABELS[offer.mealPlan]}</Badge>
              ) : null}
            </div>
            <p className={styles.from}>
              Lowest of {pluralise(item.offerCount, 'offer')} ·{' '}
              {pluralise(item.providerCount, 'provider')}
            </p>
            <p className={styles.total}>
              <span className="tabular">{formatZar(offer.totalCents)}</span>
              <span className={styles.totalLabel}> total</span>
            </p>
            <p className={styles.nightly}>
              <span className="tabular">{formatZar(offer.averageNightlyCents)}</span> avg / night ·{' '}
              {pluralise(offer.nights, 'night')}
            </p>
            <p className={styles.provider}>
              via {offer.providerName} · <span className={styles.simulated}>simulated</span>
            </p>
            <p className={styles.capacity}>
              <Users size={13} aria-hidden="true" /> Sleeps up to {item.maxGuests}
            </p>
            <Link to={href} className={styles.cta} tabIndex={-1} aria-hidden="true">
              Compare offers
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
});
