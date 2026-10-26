import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/hooks';
import styles from './HowItWorksPage.module.css';

export function HowItWorksPage() {
  useDocumentTitle('How it works');
  return (
    <article className={`container ${styles.page}`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Transparency</p>
        <h1>How Wayfare works</h1>
        <p className={styles.lede}>
          Wayfare is a portfolio project that demonstrates accommodation search and price
          comparison. This page explains exactly what the data is and how prices and rankings are
          calculated.
        </p>
      </header>

      <section aria-labelledby="data">
        <h2 id="data">The data is synthetic</h2>
        <ul>
          <li>
            The <strong>91 properties</strong> and <strong>5 booking providers</strong> are
            fictional. Their names were invented for this demo, and any resemblance to a real
            business is coincidental.
          </li>
          <li>
            Locations are real South African towns, suburbs and landmarks, but property coordinates
            are approximate points placed nearby.
          </li>
          <li>
            Every offer is <strong>simulated</strong>. Prices, availability and “generated” times
            come from a deterministic seed script, not from any booking site. Nothing can be booked
            and no payment is taken.
          </li>
          <li>
            The <strong>demo scores</strong> (out of 10) are synthetic numbers that let you try
            rating filters and sorting. They are not reviews, and there are no fabricated guest
            comments.
          </li>
          <li>
            All images are original illustrations generated for this project, not photographs of
            real places.
          </li>
        </ul>
      </section>

      <section aria-labelledby="pricing">
        <h2 id="pricing">How a total price is calculated</h2>
        <p>
          The same calculation, a single database function, is used for search results, price
          filters, sorting and the offer comparison, so the price on a result card always matches
          the property page.
        </p>
        <ol>
          <li>
            <strong>Room subtotal</strong>: the nightly rate for each night of the stay. Friday and
            Saturday nights use the weekend rate where the offer has one.
          </li>
          <li>
            <strong>Fees</strong>: cleaning or booking fees, charged once per stay.
          </li>
          <li>
            <strong>VAT (15%)</strong>: calculated once on subtotal plus fees. Some providers quote
            prices that already include VAT; we show the included amount for information but never
            add it twice. Others quote prices excluding VAT, and we add it.
          </li>
          <li>
            <strong>Total</strong> = subtotal + fees (+ VAT if it wasn’t included). The “average per
            night” figure is the total divided by the number of nights.
          </li>
        </ol>
        <p>
          The <strong>budget filter</strong> uses that average nightly figure for each property’s
          cheapest eligible offer, so fees and VAT can’t sneak past it.
        </p>
      </section>

      <section aria-labelledby="ranking-title" id="ranking">
        <h2 id="ranking-title">How results are ranked</h2>
        <p>
          The default <strong>Recommended</strong> order combines three signals, each scaled from 0
          to 1 within your current results:
        </p>
        <ul>
          <li>
            <strong>45%</strong>: demo score (unrated properties count as 6/10).
          </li>
          <li>
            <strong>35%</strong>: price, where cheaper ranks higher.
          </li>
          <li>
            <strong>20%</strong>: distance from your destination or location, where closer ranks
            higher. Searches without a location split this weight between score (55%) and price
            (45%).
          </li>
        </ul>
        <p>
          No provider pays for placement, and providers don’t affect the order at all. You can
          switch to sorting by price, demo score or distance at any time.
        </p>
      </section>

      <section aria-labelledby="offers">
        <h2 id="offers">Cheapest vs recommended offers</h2>
        <p>
          On a property page, <strong>Cheapest</strong> is simply the lowest total for your stay.{' '}
          <strong>Recommended</strong> is the cheapest offer with free cancellation, if it costs at
          most 10% more than the cheapest. Otherwise it’s the cheapest offer. The reason is always
          shown, and if the two offers differ in meals or cancellation terms, the page says so.
        </p>
      </section>

      <section aria-labelledby="availability">
        <h2 id="availability">Availability</h2>
        <p>
          A property appears in results only if at least one of its room types fits your group,
          meets any minimum stay, and has no simulated booking overlapping your dates. Around one in
          five rooms is pre-booked for tonight, so the last-minute search shows realistic gaps.
        </p>
      </section>

      <section aria-labelledby="maps">
        <h2 id="maps">Maps and location</h2>
        <p>
          Maps use Leaflet with OpenStreetMap tiles (© OpenStreetMap contributors). Tiles need an
          internet connection; everything else runs locally. “Use my location” asks your browser for
          permission and is never required. You can always type a destination instead.
        </p>
      </section>

      <p className={styles.back}>
        <Link to="/">← Back to search</Link>
      </p>
    </article>
  );
}
