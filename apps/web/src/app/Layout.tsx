import { FlaskConical } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useFilters } from '../lib/queries';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();
  // Describe the data that is actually loaded: real OSM places, or the fictional set.
  const realPlaces = (useFilters().data?.dataSummary.realPropertyCount ?? 0) > 0;
  const isSearch = location.pathname === '/search';

  // Move focus to the main landmark on client-side navigation so screen-reader users hear
  // the new page. Skipped on first load so the skip link stays the first Tab stop.
  // (Comparing paths, not a "first render" flag, keeps this correct under StrictMode.)
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={`${styles.headerInner} ${isSearch ? styles.wide : ''}`}>
          <Link to="/" className={styles.brand} aria-label="Wayfare home">
            <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="currentColor" />
              <circle cx="32" cy="32" r="21" fill="none" stroke="#0b1f35" strokeWidth="3.5" />
              <path
                d="M32 14.5v4.5M32 45v4.5M14.5 32h4.5M45 32h4.5"
                stroke="#0b1f35"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <g transform="rotate(40 32 32)">
                <path d="M32 15.5 L37.5 32 L26.5 32 Z" fill="#e08a4f" />
                <path d="M32 48.5 L37.5 32 L26.5 32 Z" fill="#0b1f35" />
              </g>
              <circle cx="32" cy="32" r="2.5" fill="currentColor" />
            </svg>
            <span className={styles.wordmark}>Wayfare</span>
          </Link>
          <nav aria-label="Main" className={styles.nav}>
            <NavLink
              to="/search"
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              Stays
            </NavLink>
            <NavLink
              to="/how-it-works"
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              How it works
            </NavLink>
          </nav>
        </div>
      </header>

      <div className={styles.notice} role="note">
        <div className={`${styles.noticeInner} ${isSearch ? styles.wide : ''}`}>
          <FlaskConical size={16} aria-hidden="true" />
          <p>
            <strong>Portfolio demo.</strong>{' '}
            {realPlaces
              ? 'Places come from OpenStreetMap, but providers, prices, availability and scores are simulated.'
              : 'All properties, providers, prices and scores are simulated.'}{' '}
            Nothing here can be booked. <Link to="/how-it-works">How the data works</Link>
          </p>
        </div>
      </div>

      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      {!isSearch && (
        <footer className={styles.footer}>
          <div className="container">
            <div className={styles.footerGrid}>
              <div>
                <p className={styles.footerBrand}>Wayfare</p>
                <p className={styles.footerText}>
                  A South African accommodation discovery and price-comparison demo, built as a
                  software engineering portfolio project.
                </p>
              </div>
              <div>
                <p className={styles.footerHeading}>About the data</p>
                <p className={styles.footerText}>
                  {realPlaces
                    ? 'Place names, locations and websites © OpenStreetMap contributors (ODbL). Photos from Wikimedia Commons are credited where shown. Providers, prices, availability and scores are simulated, and other images are original illustrations.'
                    : 'Properties and providers are fictional. Prices, availability and scores are simulated. Illustrations are original artwork. Map data © OpenStreetMap contributors.'}
                </p>
              </div>
            </div>
          </div>
        </footer>
      )}
      <ScrollRestoration />
    </div>
  );
}
