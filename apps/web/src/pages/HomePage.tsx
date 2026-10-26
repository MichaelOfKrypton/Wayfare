import { searchQueryToParams, todayInTimeZone, addDays, pluralise } from '@wayfare/shared';
import { ArrowRight, BadgePercent, Clock3, Layers, LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Skeleton } from '../components/States';
import { SearchForm } from '../features/search/SearchForm';
import { geolocationMessage, requestCurrentPosition } from '../lib/geolocation';
import { useDocumentTitle } from '../lib/hooks';
import { useFeaturedDestinations } from '../lib/queries';
import { defaultStay } from '../lib/searchState';
import styles from './HomePage.module.css';

export function HomePage() {
  useDocumentTitle('');
  const navigate = useNavigate();
  const stay = defaultStay();
  const featured = useFeaturedDestinations();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();

  async function searchTonightNearMe() {
    setLocating(true);
    setLocationError(undefined);
    try {
      const point = await requestCurrentPosition();
      const today = todayInTimeZone();
      const params = searchQueryToParams({
        ...point,
        radiusKm: 15,
        checkIn: today,
        checkOut: addDays(today, 1),
        guests: 2,
        sort: 'distance_asc',
      });
      navigate(`/search?${params.toString()}`);
    } catch (error) {
      setLocationError(geolocationMessage(error));
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`container ${styles.heroInner}`}>
          <p className={styles.eyebrow}>South African stays, compared</p>
          <h1 id="hero-title" className={styles.title}>
            Find tonight’s bed or next month’s escape.
          </h1>
          <p className={styles.lede}>
            Search guesthouses, lodges, farm stays and city hotels, then compare every provider’s
            offer on the total price of your stay, with VAT and fees included.
          </p>
          <SearchForm initial={{ place: { kind: 'anywhere', label: '' }, ...stay }} />
          <div className={styles.tonight}>
            <Button
              variant="secondary"
              icon={<LocateFixed size={18} aria-hidden="true" />}
              onClick={() => void searchTonightNearMe()}
              loading={locating}
            >
              {locating ? 'Finding you…' : 'Tonight near me'}
            </Button>
            <p className={styles.tonightHint}>
              Uses your location (with permission) to show places with a bed free tonight, nearest
              first.
            </p>
          </div>
          {locationError && (
            <p className={styles.locationError} role="alert">
              {locationError}
            </p>
          )}
        </div>
      </section>

      <section className="container" aria-labelledby="destinations-title">
        <div className={styles.sectionHead}>
          <h2 id="destinations-title">Popular destinations</h2>
          <Link
            to={`/search?${searchQueryToParams(stay).toString()}`}
            className={styles.sectionLink}
          >
            Browse all stays <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <ul className={styles.destinations}>
          {featured.isPending &&
            Array.from({ length: 8 }, (_, i) => (
              <li key={i} className={styles.destinationSkeleton}>
                <Skeleton height={140} radius={8} />
                <Skeleton width="60%" height={18} />
                <Skeleton width="40%" height={14} />
              </li>
            ))}
          {featured.isError && (
            <li className={styles.inlineError} role="alert">
              Destinations couldn’t be loaded. Is the API running? You can still search above.
            </li>
          )}
          {featured.data?.items.map((d) => (
            <li key={d.slug}>
              <Link
                className={styles.destination}
                to={`/search?${searchQueryToParams({ ...stay, destination: d.slug }).toString()}`}
              >
                <img
                  src={d.imageUrl ?? '/images/demo/coast-1.svg'}
                  alt=""
                  loading="lazy"
                  className={styles.destinationImage}
                />
                <span className={styles.destinationBody}>
                  <span className={styles.destinationName}>{d.name}</span>
                  <span className={styles.destinationMeta}>
                    {d.province} · {pluralise(d.propertyCount, 'stay')}
                  </span>
                  {d.summary && <span className={styles.destinationSummary}>{d.summary}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`container ${styles.values}`} aria-labelledby="values-title">
        <h2 id="values-title" className={styles.valuesTitle}>
          Comparison you can check
        </h2>
        <div className={styles.valueGrid}>
          <article className={styles.value}>
            <BadgePercent size={24} aria-hidden="true" />
            <h3>Total stay price, not teaser rates</h3>
            <p>
              Every offer is priced for your exact dates, including weekend rates, booking or
              cleaning fees and VAT. We show the breakdown, so a low headline rate can’t hide extra
              costs.
            </p>
          </article>
          <article className={styles.value}>
            <Layers size={24} aria-hidden="true" />
            <h3>One property, many providers</h3>
            <p>
              Offers are grouped by room type with meal plan and cancellation terms side by side, so
              you compare like with like. You also see why an offer is marked cheapest or
              recommended.
            </p>
          </article>
          <article className={styles.value}>
            <Clock3 size={24} aria-hidden="true" />
            <h3>Made for last-minute stays</h3>
            <p>
              “Tonight near me” finds places with a room free tonight, sorted by distance and shown
              on a map with prices. Manual search works too if you’d rather not share your location.
            </p>
          </article>
        </div>
        <p className={styles.disclosure}>
          Wayfare is a portfolio demonstration. Its properties and providers are fictional and its
          prices are simulated. <Link to="/how-it-works">Read how the data and rankings work.</Link>
        </p>
      </section>
    </>
  );
}
