import {
  CANCELLATION_LABELS,
  formatRelativeTime,
  formatZar,
  formatZarPrecise,
  MEAL_PLAN_LABELS,
  pluralise,
  type Offer,
  type OffersResponse,
  type UnavailableRoom,
} from '@wayfare/shared';
import { BedDouble, Info, Star, Tag, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import styles from './OfferComparison.module.css';

const UNAVAILABLE_TEXT: Record<UnavailableRoom['reason'], (room: UnavailableRoom) => string> = {
  booked_for_dates: () => 'Fully booked for your dates',
  too_small: () => 'Too small for your group',
  min_nights: (room) => `Minimum stay of ${pluralise(room.minNights ?? 2, 'night')}`,
};

export function OfferComparison({
  data,
  propertyName,
}: {
  data: OffersResponse;
  propertyName: string;
}) {
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);
  const { summary } = data;
  const allOffers = data.groups.flatMap((g) => g.offers);
  const cheapest = allOffers.find((o) => o.id === summary.cheapestOfferId);
  const recommended = allOffers.find((o) => o.id === summary.recommendedOfferId);
  const differences =
    cheapest && recommended && cheapest.id !== recommended.id
      ? describeDifferences(cheapest, recommended)
      : [];

  return (
    <div className={styles.wrap}>
      {summary.eligibleCount > 0 && cheapest && (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>
              <Tag size={14} aria-hidden="true" /> Cheapest total
            </span>
            <span className={styles.summaryValue}>{formatZar(cheapest.price.totalCents)}</span>
            <span className={styles.summaryMeta}>via {cheapest.provider.name}</span>
          </div>
          {recommended && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                <Star size={14} aria-hidden="true" /> Recommended
              </span>
              <span className={styles.summaryValue}>{formatZar(recommended.price.totalCents)}</span>
              <span className={styles.summaryMeta}>{summary.recommendationReason}</span>
            </div>
          )}
          {summary.priceSpreadCents !== null && summary.priceSpreadCents > 0 && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Price spread</span>
              <span className={styles.summaryValue}>{formatZar(summary.priceSpreadCents)}</span>
              <span className={styles.summaryMeta}>
                between {pluralise(summary.eligibleCount, 'offer')} for this stay
              </span>
            </div>
          )}
        </div>
      )}

      {differences.length > 0 && (
        <p className={styles.differences}>
          <Info size={16} aria-hidden="true" />
          <span>
            The cheapest and recommended offers are not identical: {differences.join('; ')}. Compare
            the details before choosing.
          </span>
        </p>
      )}

      {data.groups.length === 0 && (
        <div className={styles.none} role="status">
          <p className={styles.noneTitle}>No offers for these dates and guests</p>
          <p>
            Try different dates or fewer guests. The reasons for each room type are listed below.
          </p>
        </div>
      )}

      {data.groups.map((group) => (
        <section
          key={group.roomType.id}
          className={styles.group}
          aria-labelledby={`room-${group.roomType.id}`}
        >
          <header className={styles.groupHead}>
            <h3 id={`room-${group.roomType.id}`} className={styles.roomName}>
              {group.roomType.name}
            </h3>
            <span className={styles.roomMeta}>
              <Users size={14} aria-hidden="true" /> Sleeps {group.roomType.maxGuests}
              <BedDouble size={14} aria-hidden="true" />
              {group.roomType.bedrooms === 0
                ? 'Studio'
                : pluralise(group.roomType.bedrooms, 'bedroom')}
            </span>
          </header>
          <table className={styles.table}>
            <caption className="visually-hidden">
              Offers for the {group.roomType.name} at {propertyName}, sorted by total price
            </caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Conditions</th>
                <th scope="col" className={styles.num}>
                  Price breakdown
                </th>
                <th scope="col" className={styles.num}>
                  Total
                </th>
                <th scope="col">
                  <span className="visually-hidden">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onView={() => setActiveOffer(offer)} />
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {data.unavailable.length > 0 && (
        <div className={styles.unavailable}>
          <h3 className={styles.unavailableTitle}>Not available for this search</h3>
          <ul>
            {data.unavailable.map((room) => (
              <li key={room.roomTypeName}>
                <strong>{room.roomTypeName}</strong>: {UNAVAILABLE_TEXT[room.reason](room)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={activeOffer !== null}
        onClose={() => setActiveOffer(null)}
        title="This is a simulated offer"
        footer={<Button onClick={() => setActiveOffer(null)}>Got it</Button>}
      >
        {activeOffer && (
          <>
            <p>
              <strong>{activeOffer.provider.name}</strong> is a fictional provider, and this{' '}
              {formatZar(activeOffer.price.totalCents)} offer was generated for the Wayfare demo.
              There is no booking page to send you to, so Wayfare doesn’t link out or take payments.
            </p>
            <p>
              With a real, authorised provider integration, this button would open the provider’s
              own booking page for these dates. The price would be labelled with when it was last
              checked, and you would book directly with the provider.
            </p>
          </>
        )}
      </Dialog>
    </div>
  );
}

function OfferRow({ offer, onView }: { offer: Offer; onView: () => void }) {
  const p = offer.price;
  const isCheapest = offer.badges.includes('cheapest');
  const isRecommended = offer.badges.includes('recommended');
  return (
    <tr className={isRecommended ? styles.recommendedRow : undefined} data-testid="offer-row">
      <td data-label="Provider">
        <div className={styles.provider}>
          <span className={styles.providerName}>{offer.provider.name}</span>
          <span className={styles.providerKind}>
            {offer.provider.kind === 'direct' ? 'Direct (simulated)' : 'Travel site (simulated)'}
          </span>
          <div className={styles.badges}>
            {isCheapest && (
              <Badge tone="accent" icon={<Tag />}>
                Cheapest
              </Badge>
            )}
            {isRecommended && (
              <Badge tone="primary" icon={<Star />}>
                Recommended
              </Badge>
            )}
          </div>
        </div>
      </td>
      <td data-label="Conditions">
        <ul className={styles.conditions}>
          <li>
            <Badge
              tone={
                offer.cancellationPolicy === 'free'
                  ? 'success'
                  : offer.cancellationPolicy === 'partial'
                    ? 'warning'
                    : 'danger'
              }
            >
              {CANCELLATION_LABELS[offer.cancellationPolicy]}
            </Badge>
            {offer.freeCancellationHours !== null && (
              <span className={styles.conditionMeta}>
                {' '}
                until {offer.freeCancellationHours} h before check-in
              </span>
            )}
          </li>
          <li className={styles.meal}>{MEAL_PLAN_LABELS[offer.mealPlan]}</li>
        </ul>
      </td>
      <td data-label="Price breakdown" className={styles.num}>
        <dl className={styles.breakdown}>
          <div>
            <dt>
              {pluralise(p.nights, 'night')}
              {p.weekendNights > 0 ? ` (${p.weekendNights} weekend)` : ''}
            </dt>
            <dd className="tabular">{formatZarPrecise(p.roomSubtotalCents)}</dd>
          </div>
          {p.feesCents > 0 && (
            <div>
              <dt>{p.feeLabel ?? 'Fees'}</dt>
              <dd className="tabular">{formatZarPrecise(p.feesCents)}</dd>
            </div>
          )}
          <div>
            <dt>
              {p.taxIncluded ? `incl. VAT ${p.taxRateBps / 100}%` : `+ VAT ${p.taxRateBps / 100}%`}
            </dt>
            <dd className={`tabular ${p.taxIncluded ? styles.included : ''}`}>
              {formatZarPrecise(p.taxCents)}
            </dd>
          </div>
        </dl>
      </td>
      <td data-label="Total" className={styles.num}>
        <span className={styles.total}>{formatZar(p.totalCents)}</span>
        <span className={styles.avg}>{formatZar(p.averageNightlyCents)} avg / night</span>
        <span
          className={styles.freshness}
          title={`Generated ${new Date(offer.lastCheckedAt).toLocaleString('en-ZA')}`}
        >
          Simulated · generated {formatRelativeTime(offer.lastCheckedAt)}
        </span>
      </td>
      <td className={styles.actionCell}>
        <Button size="sm" variant={isRecommended ? 'primary' : 'secondary'} onClick={onView}>
          View deal
        </Button>
      </td>
    </tr>
  );
}

function describeDifferences(a: Offer, b: Offer): string[] {
  const diffs: string[] = [];
  if (a.cancellationPolicy !== b.cancellationPolicy) {
    diffs.push(
      `${CANCELLATION_LABELS[a.cancellationPolicy].toLowerCase()} vs ${CANCELLATION_LABELS[b.cancellationPolicy].toLowerCase()}`,
    );
  }
  if (a.mealPlan !== b.mealPlan) {
    diffs.push(
      `${MEAL_PLAN_LABELS[a.mealPlan].toLowerCase()} vs ${MEAL_PLAN_LABELS[b.mealPlan].toLowerCase()}`,
    );
  }
  if (a.provider.slug !== b.provider.slug) diffs.push(`${a.provider.name} vs ${b.provider.name}`);
  return diffs;
}
