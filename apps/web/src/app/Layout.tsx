import { Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo';
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
            <Logo size={32} />
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
          <Info size={14} aria-hidden="true" />
          <p>
            <strong>Portfolio demo.</strong>{' '}
            {realPlaces
              ? 'Places come from OpenStreetMap, but providers, prices, availability and scores are simulated.'
              : 'All properties, providers, prices and scores are simulated.'}{' '}
            Nothing here can be booked. <Link to="/how-it-works">How the data works</Link>
          </p>
        </div>
      </div>

      {/* Keyed by path so each page plays its entrance animation on navigation. */}
      <main key={location.pathname} id="main" tabIndex={-1} className={`${styles.main} page-enter`}>
        <Outlet />
      </main>

      {!isSearch && (
        <footer className={styles.footer}>
          <div className="container">
            <div className={styles.footerGrid}>
              <div>
                <p className={styles.footerBrand}>
                  <Logo size={28} />
                  Wayfare
                </p>
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
