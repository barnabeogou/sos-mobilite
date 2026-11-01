import type { GeoPoint } from '@/domain/geo';

/**
 * Cartographie.
 * Les liens d'itinéraire utilisent l'URL universelle Google Maps (aucune clé requise :
 * elle ouvre simplement l'application Maps de l'appareil).
 * L'intégration d'une carte interactive (Google Maps JavaScript API) se branchera ici
 * avec une clé restreinte au domaine — ÉTAPE 4 de la feuille de route.
 */
export function directionsUrl(to: GeoPoint, from?: GeoPoint): string {
  const params = new URLSearchParams({ api: '1', destination: `${to.lat},${to.lng}`, travelmode: 'driving' });
  if (from) params.set('origin', `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function placeUrl(p: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}
