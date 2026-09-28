import * as Location from 'expo-location';

import type { MyLocation } from '@/data/types';

export type LocationResult =
  | { ok: true; location: MyLocation }
  | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * Returns the current position with its city. Asks for foreground permission unless `silent`,
 * in which case it only proceeds if permission was already granted.
 */
export async function getMyLocation({ silent = false } = {}): Promise<LocationResult> {
  try {
    const perm = silent
      ? await Location.getForegroundPermissionsAsync()
      : await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };

    // A recent cached fix is instant; fall back to a fresh, battery-friendly one.
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 200 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

    const { latitude: lat, longitude: lng } = position.coords;
    let city: string | undefined;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      city = place?.city ?? place?.subregion ?? place?.region ?? undefined;
    } catch {
      // City is a nice-to-have.
    }
    return { ok: true, location: { lat, lng, city, updatedAt: Date.now() } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
