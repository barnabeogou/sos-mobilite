export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Distance orthodromique en km (même formule que public.distance_km). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

export type GeoErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'insecure';

export class GeoError extends Error {
  constructor(public code: GeoErrorCode) {
    super(code);
  }
}

export const GEO_ERROR_MESSAGES: Record<GeoErrorCode, string> = {
  unsupported: 'Votre appareil ne permet pas la géolocalisation. Indiquez un repère dans la description.',
  denied: 'Localisation refusée. Autorisez l’accès à la position dans les réglages du navigateur, puis réessayez.',
  unavailable: 'Position introuvable. Activez le GPS et placez-vous à découvert si possible.',
  timeout: 'La localisation prend trop de temps. Réessayez.',
  insecure: 'La localisation nécessite une connexion sécurisée (https).',
};

/** Position actuelle via l'API du navigateur (aucune donnée inventée). */
export function getCurrentPosition(timeoutMs = 15000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new GeoError('insecure'));
      return;
    }
    if (!('geolocation' in navigator)) {
      reject(new GeoError('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new GeoError('denied'));
        else if (err.code === err.TIMEOUT) reject(new GeoError('timeout'));
        else reject(new GeoError('unavailable'));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
