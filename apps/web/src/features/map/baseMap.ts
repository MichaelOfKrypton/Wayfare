import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Tile source. Defaults to the OpenStreetMap standard tile server, used within
 * its usage policy (attribution shown, no prefetching, browser caching only).
 * Override with VITE_MAP_TILE_URL / VITE_MAP_ATTRIBUTION — see "REQUIRED APIS.md".
 */
export const TILE_URL: string =
  import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION: string =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const SOUTH_AFRICA_CENTER: L.LatLngExpression = [-29.0, 25.0];

export interface BaseMapOptions {
  scrollWheelZoom?: boolean;
  onTileError?: () => void;
  onTileLoad?: () => void;
}

export function createBaseMap(container: HTMLElement, options: BaseMapOptions = {}): L.Map {
  const map = L.map(container, {
    center: SOUTH_AFRICA_CENTER,
    zoom: 5,
    minZoom: 4,
    maxZoom: 18,
    scrollWheelZoom: options.scrollWheelZoom ?? true,
    zoomControl: true,
    // Keep the map within southern Africa so users cannot get lost panning.
    maxBounds: L.latLngBounds([-37.5, 12], [-19.5, 36.5]),
    maxBoundsViscosity: 0.8,
  });
  map.attributionControl.setPrefix(false);
  const tiles = L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 19,
    crossOrigin: true,
  });
  if (options.onTileError) tiles.on('tileerror', options.onTileError);
  if (options.onTileLoad) tiles.on('tileload', options.onTileLoad);
  tiles.addTo(map);
  return map;
}
