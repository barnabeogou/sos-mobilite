/**
 * Géométrie commune de l'intro et de la carte « signal » du héros (repère SVG centré, -200 → 200).
 * Plan abstrait : quelques grands axes et, en bas, une lagune — un clin d'œil à Abidjan.
 */
export const STREETS = [
  'M-200 -64 C-90 -40 30 -96 200 -34',
  'M-200 62 C-70 34 60 104 200 54',
  'M-74 -200 C-52 -84 -96 54 -44 200',
  'M66 -200 C42 -64 94 58 72 200',
  'M-200 182 L196 -200',
];

export const LAGOON = 'M-200 128 C-128 100 -66 164 2 142 C72 120 126 172 200 150 L200 200 L-200 200 Z';

/** Professionnels de l'intro (proches du centre). Le premier est celui qui accepte. */
export const INTRO_PROS: [number, number][] = [
  [54, -62],
  [-92, 30],
  [70, 108],
  [-124, -78],
  [136, 36],
  [-28, 96],
];

/** Itinéraire du professionnel qui accepte jusqu'au client (centre). */
export const INTRO_ROUTE = 'M54 -62 C46 -36 26 -14 0 0';

/** Professionnels de la carte du héros, au-delà du bouton SOS. */
export const HERO_PROS: [number, number][] = [
  [112, -96],
  [-150, -58],
  [-58, 152],
  [152, 84],
  [-124, 112],
  [38, -166],
];

/** Rayon (repère SVG) couvert par le bouton SOS posé au centre. */
export const SOS_RADIUS = 118;

/** Cercles de recherche : le rayon s'élargit si personne ne répond. */
export const SEARCH_RINGS = [
  { r: 130, label: '5 km' },
  { r: 162, label: '10 km' },
  { r: 194, label: '20 km' },
];

/** Segment du professionnel jusqu'au bord du bouton SOS. */
export function routeToCenter([x, y]: [number, number], stopAt = SOS_RADIUS + 4): string {
  const d = Math.hypot(x, y) || 1;
  const k = stopAt / d;
  return `M${x} ${y} L${(x * k).toFixed(1)} ${(y * k).toFixed(1)}`;
}
