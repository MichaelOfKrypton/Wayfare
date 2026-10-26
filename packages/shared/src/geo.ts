export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Generous bounding box around South Africa (incl. Lesotho/Eswatini enclaves).
 * Used to reject swapped or garbage coordinates; mirrored by a DB check constraint.
 */
export const SA_BOUNDS = {
  minLat: -35.5,
  maxLat: -21.5,
  minLng: 16,
  maxLng: 33.5,
} as const;

export function isWithinSouthAfrica({ lat, lng }: LatLng): boolean {
  return (
    lat >= SA_BOUNDS.minLat &&
    lat <= SA_BOUNDS.maxLat &&
    lng >= SA_BOUNDS.minLng &&
    lng <= SA_BOUNDS.maxLng
  );
}

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance (haversine). PostGIS uses the spheroid, so expect <0.5% difference. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Moves a point by metres north/east — used to jitter seed coordinates near land anchors. */
export function offsetByMetres(origin: LatLng, northM: number, eastM: number): LatLng {
  const dLat = northM / 111_320;
  const dLng = eastM / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}
