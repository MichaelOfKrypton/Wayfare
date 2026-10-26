import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Database,
  FlaskConical,
  Map as MapIcon,
  Scale,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CompassWatermark } from '../components/Logo';
import { useDocumentTitle } from '../lib/hooks';
import styles from './HowItWorksPage.module.css';

const SECTIONS = [
  { id: 'data', label: 'The data' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'offers', label: 'Offers' },
  { id: 'availability', label: 'Availability' },
];

const PRICE_STEPS = [
  {
    title: 'Room subtotal',
    text: 'The nightly rate for each night. Friday and Saturday use the weekend rate where there is one.',
  },
  { title: 'Fees', text: 'Cleaning or booking fees, charged once per stay.' },
  {
    title: 'VAT (15%)',
    text: 'Calculated once on subtotal plus fees. Included VAT is shown for information, never added twice.',
  },
  {
    title: 'Total',
    text: 'Subtotal + fees (+ VAT if it wasn’t included). Average per night is the total ÷ nights.',
  },
];

const WEIGHTS = [
  { label: 'Demo score', value: 45, note: 'Unrated places count as 6/10' },
  { label: 'Price', value: 35, note: 'Cheaper ranks higher' },
  { label: 'Distance', value: 20, note: 'Closer ranks higher' },
];

export function HowItWorksPage() {
  useDocumentTitle('How it works');
  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <CompassWatermark className="watermark watermark--hero" />
        <div className={`container ${styles.heroInner}`}>
          <p className={styles.eyebrow}>Transparency</p>
          <h1>How Wayfare works</h1>
          <p className={styles.lede}>
            What the data is, where it comes from, and exactly how every price and ranking is
            calculated.
          </p>
          <nav aria-label="On this page" className={styles.jump}>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className={`container ${styles.body}`}>
        <section aria-labelledby="data-title" id="data" className={styles.section}>
          <SectionHead icon={<Database size={18} />} id="data-title" title="Real and simulated" />
          <div className={`${styles.split} stagger`}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <BadgeCheck size={18} aria-hidden="true" /> Real, from OpenStreetMap
              </h3>
              <ul className={styles.list}>
                <li>Property names, locations and types</li>
                <li>Star ratings, websites and phone numbers</li>
                <li>Amenities marked “confirmed”</li>
                <li>Photos from Wikimedia Commons, each credited</li>
              </ul>
              <p className={styles.small}>
                Place data ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenStreetMap contributors
                </a>{' '}
                (ODbL). Wayfare isn’t affiliated with any of these places.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <FlaskConical size={18} aria-hidden="true" /> Simulated for the demo
              </h3>
              <ul className={styles.list}>
                <li>The 5 booking providers, their offers and prices</li>
                <li>Room types, availability and the other amenities</li>
                <li>Demo scores out of 10. These aren’t reviews.</li>
                <li>Images labelled “Illustration”</li>
              </ul>
              <p className={styles.small}>
                Nothing can be booked and no payment is taken. Without an OpenStreetMap snapshot,
                the app shows fictional properties labelled “Fictional demo property”.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="pricing-title" id="pricing" className={styles.section}>
          <SectionHead
            icon={<Scale size={18} />}
            id="pricing-title"
            title="How a total price is calculated"
          />
          <p className={styles.intro}>
            One database function prices every stay, so search results, budget filters, sorting and
            the offer comparison always agree.
          </p>
          <ol className={`${styles.steps} stagger`}>
            {PRICE_STEPS.map((step, i) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.small}>{step.text}</p>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            The <strong>budget filter</strong> uses that all-in average per night, so fees and VAT
            can’t sneak past it.
          </p>
        </section>

        <section aria-labelledby="ranking-title" id="ranking" className={styles.section}>
          <SectionHead
            icon={<Sparkles size={18} />}
            id="ranking-title"
            title="How results are ranked"
          />
          <p className={styles.intro}>
            <strong>Recommended</strong> blends three signals, each scaled from 0 to 1 within your
            current results. No provider pays for placement.
          </p>
          <div
            className={styles.weights}
            role="img"
            aria-label="Weights: demo score 45%, price 35%, distance 20%"
          >
            {WEIGHTS.map((w) => (
              <span key={w.label} className={styles.weight} style={{ flexGrow: w.value }}>
                {w.value}%
              </span>
            ))}
          </div>
          <dl className={styles.legend}>
            {WEIGHTS.map((w) => (
              <div key={w.label}>
                <dt>
                  <span className={styles.swatch} aria-hidden="true" /> {w.label} · {w.value}%
                </dt>
                <dd>{w.note}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>
            Searches without a location split the distance weight: score 55%, price 45%. You can
            sort by price, demo score or distance at any time.
          </p>
        </section>

        <section aria-labelledby="offers-title" id="offers" className={styles.section}>
          <SectionHead
            icon={<BadgeCheck size={18} />}
            id="offers-title"
            title="Cheapest vs recommended offers"
          />
          <div className={`${styles.split} stagger`}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Cheapest</h3>
              <p className={styles.small}>Simply the lowest total for your exact stay.</p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Recommended</h3>
              <p className={styles.small}>
                The cheapest offer with free cancellation, if it costs at most 10% more. Otherwise
                the cheapest. The reason is always shown, and differences in meals or cancellation
                terms are called out.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="availability-title" id="availability" className={styles.section}>
          <SectionHead
            icon={<CalendarCheck size={18} />}
            id="availability-title"
            title="Availability and maps"
          />
          <div className={`${styles.split} stagger`}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <CalendarCheck size={18} aria-hidden="true" /> Availability
              </h3>
              <p className={styles.small}>
                A place appears only if a room fits your group, meets any minimum stay and has no
                simulated booking on your dates. About one room in five is pre-booked for tonight,
                so last-minute searches show realistic gaps.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <MapIcon size={18} aria-hidden="true" /> Maps and location
              </h3>
              <p className={styles.small}>
                Leaflet with OpenStreetMap tiles. Tiles need internet; everything else runs locally.
                “Use my location” always asks first, and typing a destination works too.
              </p>
            </div>
          </div>
        </section>

        <div className={styles.cta}>
          <p>Ready to compare?</p>
          <Link to="/search" className={styles.ctaButton}>
            Browse all stays <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function SectionHead({ icon, id, title }: { icon: ReactNode; id: string; title: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 id={id}>{title}</h2>
    </div>
  );
}
