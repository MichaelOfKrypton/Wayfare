import { isWithinSouthAfrica, type LatLng } from '@wayfare/shared';

export type GeolocationFailure =
  'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'outside_sa';

export const GEOLOCATION_MESSAGES: Record<GeolocationFailure, string> = {
  unsupported:
    'Your browser does not support location access. Please type a town or suburb instead.',
  denied: 'Location permission was declined. You can type a town, suburb or landmark instead.',
  unavailable:
    'We could not determine your location. Please type a town, suburb or landmark instead.',
  timeout: 'Finding your location took too long. Please try again or type a destination.',
  outside_sa:
    'Your location appears to be outside South Africa, and the demo only covers South African destinations. Please type a destination.',
};

/**
 * Asks the browser for the user's position. Only ever called in response to a
 * user action, so the permission prompt has clear context.
 */
export function requestCurrentPosition(timeoutMs = 10_000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported' satisfies GeolocationFailure));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: Math.round(position.coords.latitude * 1e5) / 1e5,
          lng: Math.round(position.coords.longitude * 1e5) / 1e5,
        };
        if (!isWithinSouthAfrica(point))
          reject(new Error('outside_sa' satisfies GeolocationFailure));
        else resolve(point);
      },
      (error) => {
        const reason: GeolocationFailure =
          error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        reject(new Error(reason));
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}

export function geolocationMessage(error: unknown): string {
  const key = (error as Error)?.message as GeolocationFailure;
  return GEOLOCATION_MESSAGES[key] ?? GEOLOCATION_MESSAGES.unavailable;
}
