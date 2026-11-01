/**
 * Villes de Côte d'Ivoire — couverture nationale.
 *
 *  - `CITIES` : grandes villes illustrées (bandeaux, intro, accueil public) ;
 *  - `LOCALITIES` : villes proposées dans les formulaires et pour situer une position ;
 *  - `nearestLocality` : ville la plus proche d'une position GPS (sans service de cartographie) ;
 *  - `CI_OUTLINE` : contour simplifié du pays pour les visuels (projection équirectangulaire).
 *
 * Coordonnées approximatives (centre-ville), suffisantes pour l'affichage. La correspondance
 * client ↔ professionnel reste calculée sur les positions GPS exactes, côté serveur.
 */
import { distanceKm, type GeoPoint } from './geo';

export type CityScene =
  | 'bridge'
  | 'basilica'
  | 'monument'
  | 'port'
  | 'mosque'
  | 'watertower'
  | 'mountains'
  | 'obelisk'
  | 'sudanese'
  | 'fishing';

export interface City {
  slug: string;
  name: string;
  /** Monument ou lieu emblématique représenté. */
  landmark: string;
  lat: number;
  lng: number;
  scene: CityScene;
  /** La scène comporte de l'eau (lagune, lac, mer) : reflets. */
  water: boolean;
}

export const CITIES: City[] = [
  { slug: 'abidjan', name: 'Abidjan', landmark: 'Le Plateau et ses ponts', lat: 5.33, lng: -4.02, scene: 'bridge', water: true },
  { slug: 'yamoussoukro', name: 'Yamoussoukro', landmark: 'Basilique Notre-Dame de la Paix', lat: 6.82, lng: -5.28, scene: 'basilica', water: true },
  { slug: 'bouake', name: 'Bouaké', landmark: 'Monument de la Paix', lat: 7.69, lng: -5.03, scene: 'monument', water: false },
  { slug: 'san-pedro', name: 'San-Pédro', landmark: 'Port autonome', lat: 4.75, lng: -6.64, scene: 'port', water: true },
  { slug: 'korhogo', name: 'Korhogo', landmark: 'Grande mosquée', lat: 9.46, lng: -5.63, scene: 'mosque', water: false },
  { slug: 'daloa', name: 'Daloa', landmark: 'Château d’eau', lat: 6.88, lng: -6.45, scene: 'watertower', water: false },
  { slug: 'man', name: 'Man', landmark: 'La Dent de Man', lat: 7.41, lng: -7.55, scene: 'mountains', water: false },
  { slug: 'gagnoa', name: 'Gagnoa', landmark: 'Grand carrefour', lat: 6.13, lng: -5.95, scene: 'obelisk', water: false },
  { slug: 'bondoukou', name: 'Bondoukou', landmark: 'Mosquée soudanaise', lat: 8.04, lng: -2.8, scene: 'sudanese', water: false },
  { slug: 'sassandra', name: 'Sassandra', landmark: 'Phare et port de pêche', lat: 4.95, lng: -6.08, scene: 'fishing', water: true },
];

export interface Locality {
  name: string;
  lat: number;
  lng: number;
}

/** Villes proposées dans les formulaires (ordre alphabétique à l'affichage). */
export const LOCALITIES: Locality[] = [
  ...CITIES.map(({ name, lat, lng }) => ({ name, lat, lng })),
  { name: 'Abengourou', lat: 6.73, lng: -3.49 },
  { name: 'Aboisso', lat: 5.47, lng: -3.21 },
  { name: 'Adzopé', lat: 6.11, lng: -3.86 },
  { name: 'Agboville', lat: 5.93, lng: -4.22 },
  { name: 'Bingerville', lat: 5.36, lng: -3.89 },
  { name: 'Bouaflé', lat: 6.99, lng: -5.74 },
  { name: 'Bouna', lat: 9.27, lng: -3.0 },
  { name: 'Dabou', lat: 5.32, lng: -4.38 },
  { name: 'Daoukro', lat: 7.06, lng: -3.96 },
  { name: 'Dimbokro', lat: 6.65, lng: -4.71 },
  { name: 'Divo', lat: 5.84, lng: -5.36 },
  { name: 'Duékoué', lat: 6.74, lng: -7.35 },
  { name: 'Ferkessédougou', lat: 9.59, lng: -5.2 },
  { name: 'Grand-Bassam', lat: 5.21, lng: -3.74 },
  { name: 'Grand-Lahou', lat: 5.14, lng: -5.02 },
  { name: 'Guiglo', lat: 6.54, lng: -7.49 },
  { name: 'Issia', lat: 6.49, lng: -6.59 },
  { name: 'Katiola', lat: 8.14, lng: -5.1 },
  { name: 'Odienné', lat: 9.51, lng: -7.56 },
  { name: 'Séguéla', lat: 7.96, lng: -6.67 },
  { name: 'Sinfra', lat: 6.62, lng: -5.91 },
  { name: 'Soubré', lat: 5.79, lng: -6.61 },
  { name: 'Tabou', lat: 4.42, lng: -7.35 },
  { name: 'Tiassalé', lat: 5.9, lng: -4.82 },
  { name: 'Touba', lat: 8.28, lng: -7.68 },
];

export const LOCALITY_NAMES: string[] = LOCALITIES.map((l) => l.name).sort((a, b) => a.localeCompare(b, 'fr'));

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim()
    .toLowerCase();

/** Ville illustrée correspondant à un nom saisi (« bouake », « San Pedro »…), sinon `undefined`. */
export function findCity(name: string | null | undefined): City | undefined {
  if (!name) return undefined;
  const key = fold(name);
  return CITIES.find((c) => fold(c.name) === key || c.slug.replace(/-/g, ' ') === key);
}

export function findLocality(name: string | null | undefined): Locality | undefined {
  if (!name) return undefined;
  const key = fold(name);
  return LOCALITIES.find((l) => fold(l.name) === key);
}

/** Ville la plus proche d'une position (au-delà de `maxKm`, on considère qu'on ne sait pas). */
export function nearestLocality(p: GeoPoint, maxKm = 80): { locality: Locality; km: number } | null {
  let best: { locality: Locality; km: number } | null = null;
  for (const locality of LOCALITIES) {
    const km = distanceKm(p, locality);
    if (!best || km < best.km) best = { locality, km };
  }
  return best && best.km <= maxKm ? best : null;
}

/** Grande ville illustrée la plus proche (pour habiller une ville qui n'a pas son propre dessin). */
export function nearestCity(p: GeoPoint): City {
  return CITIES.reduce((a, b) => (distanceKm(p, b) < distanceKm(p, a) ? b : a));
}

// ---------------------------------------------------------------------------
// Contour du pays (simplifié) — repère 0..380 × 0..380
// ---------------------------------------------------------------------------
const K = 60;
export const MAP_SIZE = 380;

/** Position sur la carte d'un point (lat, lng). */
export function project(lat: number, lng: number): [number, number] {
  return [Math.round(((lng + 8.66) * K + 4) * 10) / 10, Math.round(((10.52 - lat) * K + 4) * 10) / 10];
}

/** Frontières approximatives, dans le sens horaire depuis l'embouchure du Cavally. [lng, lat] */
const BORDER: [number, number][] = [
  [-7.53, 4.36], [-7.35, 4.4], [-7.0, 4.5], [-6.64, 4.72], [-6.3, 4.85], [-6.08, 4.94], [-5.8, 5.03], [-5.5, 5.1],
  [-5.0, 5.13], [-4.6, 5.18], [-4.2, 5.22], [-4.0, 5.24], [-3.74, 5.19], [-3.3, 5.11], [-3.1, 5.09],
  [-3.02, 5.32], [-2.8, 5.62], [-2.78, 5.95], [-3.18, 6.25], [-3.1, 6.7], [-2.95, 7.2], [-2.8, 7.7], [-2.55, 8.1],
  [-2.5, 8.6], [-2.65, 9.1], [-2.7, 9.5],
  [-3.1, 9.85], [-3.6, 9.95], [-4.3, 9.62], [-4.7, 9.72], [-5.1, 10.25], [-5.52, 10.43], [-5.9, 10.3], [-6.25, 10.2],
  [-6.6, 10.4], [-7.0, 10.25], [-7.45, 10.45], [-7.97, 10.17],
  [-8.25, 9.85], [-8.15, 9.5], [-8.05, 9.0], [-8.2, 8.5], [-8.58, 8.1], [-8.47, 7.56],
  [-8.4, 7.05], [-8.55, 6.6], [-8.25, 6.25], [-7.85, 6.05], [-7.6, 5.8], [-7.45, 5.4], [-7.55, 4.9],
];

/** Courbe fermée lissée (Catmull-Rom → Bézier) passant par les points. */
export function smoothClosedPath(points: [number, number][], tension = 0.5): string {
  const n = points.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

export const CI_OUTLINE = smoothClosedPath(BORDER.map(([lng, lat]) => project(lat, lng)));

/** Ville affichée par défaut dans chaque rubrique (la maquette fait voyager l'utilisateur dans tout le pays). */
export const PAGE_CITY = {
  clientMechanics: 'yamoussoukro',
  clientHistory: 'bouake',
  clientProfile: 'san-pedro',
  clientVehicles: 'korhogo',
  clientSupport: 'sassandra',
  newRequest: 'abidjan',
  proMissions: 'bouake',
  proEarnings: 'san-pedro',
  proReviews: 'man',
  proProfile: 'daloa',
  proSupport: 'gagnoa',
} as const;

export function cityBySlug(slug: string): City {
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0];
}
