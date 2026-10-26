import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * Security headers for the built app (`npm start` / `vite preview`). Scripts,
 * styles and fonts are self-hosted; the only third-party content is map tiles
 * and credited Wikimedia Commons photos. Leaflet positions elements with inline
 * styles, hence 'unsafe-inline' for styles only (never for scripts).
 */
function contentSecurityPolicy(tileUrl: string): string {
  // Allow the configured tile server's origin; a {s} subdomain placeholder becomes a wildcard.
  const tileOrigin = (
    tileUrl.match(/^https:\/\/[^/]+/)?.[0] ?? 'https://tile.openstreetmap.org'
  ).replace(/\{s\}/g, '*');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${tileOrigin} https://upload.wikimedia.org`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), payment=(), geolocation=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// The repository root holds the single `.env` file (see .env.example).
const envDir = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
  const csp = contentSecurityPolicy(
    env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );
  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      // No CSP in dev: Vite's hot reload injects inline scripts.
      headers: BASE_HEADERS,
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
    },
    preview: {
      port: 4173,
      strictPort: true,
      headers: { ...BASE_HEADERS, 'Content-Security-Policy': csp, 'X-Frame-Options': 'DENY' },
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
    },
    build: {
      sourcemap: true,
      // The main chunk is ~230 kB gzipped, almost all React DOM, React Router and Zod
      // (see docs/PERFORMANCE.md). Leaflet is already split out with the lazy map.
      chunkSizeWarningLimit: 800,
    },
  };
});
