/**
 * Photos des grandes villes — Wikimedia Commons, sous licences libres (CC0, CC BY, CC BY-SA).
 *
 * En production, les images passent par le CDN d'images de Netlify (`/.netlify/images`) :
 * redimensionnées, converties en WebP/AVIF et mises en cache sur notre domaine. Le navigateur
 * du visiteur ne contacte donc pas Wikimedia. Si une photo ne charge pas, l'illustration reste.
 *
 * Attribution obligatoire (licences CC BY / CC BY-SA) : auteur, licence et source sont affichés
 * sur chaque bandeau et sur la page « Crédits photos ». Modifications : recadrage,
 * redimensionnement et retouche des couleurs (ambiance de nuit).
 */
export interface CityPhoto {
  slug: string;
  /** Vignette de 1920 px (ou l'original s'il est plus petit). */
  src: string;
  width: number;
  /** Fiche de la photo sur Wikimedia Commons. */
  page: string;
  author: string;
  license: 'CC0' | 'CC BY 4.0' | 'CC BY-SA 3.0' | 'CC BY-SA 4.0';
  licenseUrl: string;
  /** Ce que montre la photo. */
  caption: string;
  /** Cadrage (`object-position`) pour garder le sujet visible. */
  position?: string;
  /** Photo de jour : assombrie et bleutée pour s'accorder à l'interface de nuit. */
  tone: 'night' | 'day';
}

const T = 'https://thumb.wikimedia.org/wikipedia/commons/thumb';
const W = 'https://commons.wikimedia.org/wiki/File:';
const BY4 = 'https://creativecommons.org/licenses/by/4.0/';
const SA3 = 'https://creativecommons.org/licenses/by-sa/3.0/';
const SA4 = 'https://creativecommons.org/licenses/by-sa/4.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

export const CITY_PHOTOS: Record<string, CityPhoto> = {
  abidjan: {
    slug: 'abidjan',
    src: `${T}/7/75/Le_Plateau_depuis_Treichville_%E2%80%93_Abidjan.jpg/1920px-Le_Plateau_depuis_Treichville_%E2%80%93_Abidjan.jpg`,
    width: 1920,
    page: `${W}Le_Plateau_depuis_Treichville_%E2%80%93_Abidjan.jpg`,
    author: 'Edison McCullen',
    license: 'CC BY 4.0',
    licenseUrl: BY4,
    caption: 'Le Plateau vu de Treichville',
    position: '42% 55%',
    tone: 'night',
  },
  yamoussoukro: {
    slug: 'yamoussoukro',
    src: `${T}/3/36/Basilique_notre_Dame_de_la_Paix_de_Yamoussoukro.jpg/1920px-Basilique_notre_Dame_de_la_Paix_de_Yamoussoukro.jpg`,
    width: 1920,
    page: `${W}Basilique_notre_Dame_de_la_Paix_de_Yamoussoukro.jpg`,
    author: 'Didierwiki',
    license: 'CC0',
    licenseUrl: CC0,
    caption: 'Basilique Notre-Dame de la Paix',
    position: '58% 45%',
    tone: 'day',
  },
  bouake: {
    slug: 'bouake',
    src: `${T}/a/ac/Bouak%C3%A9-1.jpg/1920px-Bouak%C3%A9-1.jpg`,
    width: 1920,
    page: `${W}Bouak%C3%A9-1.jpg`,
    author: 'Cca Raheem',
    license: 'CC BY 4.0',
    licenseUrl: BY4,
    caption: '« J’aime Bouaké », de nuit',
    position: '50% 52%',
    tone: 'night',
  },
  'san-pedro': {
    slug: 'san-pedro',
    src: `${T}/f/f3/Port_autonome_de_San-P%C3%A9dro_%28Bosson%29_%281%29.jpg/1920px-Port_autonome_de_San-P%C3%A9dro_%28Bosson%29_%281%29.jpg`,
    width: 1920,
    page: `${W}Port_autonome_de_San-P%C3%A9dro_(Bosson)_(1).jpg`,
    author: 'HONORE BOSSON',
    license: 'CC BY-SA 4.0',
    licenseUrl: SA4,
    caption: 'Le port autonome',
    position: '50% 50%',
    tone: 'day',
  },
  korhogo: {
    slug: 'korhogo',
    src: `${T}/6/63/Mosque_in_Korhogo_ap_001.jpg/1920px-Mosque_in_Korhogo_ap_001.jpg`,
    width: 1920,
    page: `${W}Mosque_in_Korhogo_ap_001.jpg`,
    author: 'Ariel Palmon',
    license: 'CC BY-SA 4.0',
    licenseUrl: SA4,
    caption: 'Mosquée du quartier Koko',
    position: '50% 38%',
    tone: 'day',
  },
  daloa: {
    slug: 'daloa',
    src: `${T}/8/8c/Rond-point_de_Daloa_01.jpg/1920px-Rond-point_de_Daloa_01.jpg`,
    width: 1920,
    page: `${W}Rond-point_de_Daloa_01.jpg`,
    author: 'Kzie45',
    license: 'CC BY-SA 4.0',
    licenseUrl: SA4,
    caption: 'Le rond-point du château d’eau',
    position: '50% 48%',
    tone: 'day',
  },
  man: {
    slug: 'man',
    src: `${T}/0/0c/The_Dent_de_Man_mountain.jpg/1920px-The_Dent_de_Man_mountain.jpg`,
    width: 1920,
    page: `${W}The_Dent_de_Man_mountain.jpg`,
    author: 'Milequem Diarassouba',
    license: 'CC BY-SA 4.0',
    licenseUrl: SA4,
    caption: 'La Dent de Man',
    position: '62% 40%',
    tone: 'day',
  },
  gagnoa: {
    slug: 'gagnoa',
    src: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Cathgagnoa.jpg',
    width: 1502,
    page: `${W}Cathgagnoa.jpg`,
    author: 'Zenman',
    license: 'CC BY-SA 3.0',
    licenseUrl: SA3,
    caption: 'La cathédrale',
    position: '45% 40%',
    tone: 'day',
  },
  bondoukou: {
    slug: 'bondoukou',
    src: `${T}/8/87/Great_Mosque_Bondoukou_ap_001.JPG/1920px-Great_Mosque_Bondoukou_ap_001.JPG`,
    width: 1920,
    page: `${W}Great_Mosque_Bondoukou_ap_001.JPG`,
    author: 'Ariel Palmon',
    license: 'CC BY-SA 3.0',
    licenseUrl: SA3,
    caption: 'La grande mosquée',
    position: '50% 40%',
    tone: 'day',
  },
  sassandra: {
    slug: 'sassandra',
    src: `${T}/6/67/Pont_Weygand_de_Sassandra_en_2026_01.jpg/1920px-Pont_Weygand_de_Sassandra_en_2026_01.jpg`,
    width: 1920,
    page: `${W}Pont_Weygand_de_Sassandra_en_2026_01.jpg`,
    author: 'Néhémienathan',
    license: 'CC BY-SA 4.0',
    licenseUrl: SA4,
    caption: 'Le pont Weygand',
    position: '50% 45%',
    tone: 'day',
  },
};

export const PHOTO_EDITS = 'recadrées, redimensionnées et retouchées (couleurs)';

export function cityPhoto(slug: string | null | undefined): CityPhoto | null {
  return (slug && CITY_PHOTOS[slug]) || null;
}

/** Adresse d'une version de la photo à la largeur voulue. */
export function photoUrl(photo: CityPhoto, width: number, cdn = import.meta.env.PROD): string {
  if (!cdn) return photo.src;
  return `/.netlify/images?url=${encodeURIComponent(photo.src)}&w=${Math.min(width, photo.width)}&q=72`;
}

/** Jeu de largeurs pour `srcset` (le navigateur choisit selon l'écran). */
export function photoSrcSet(photo: CityPhoto, cdn = import.meta.env.PROD): string | undefined {
  if (!cdn) return undefined;
  return [480, 768, 1080, 1440, 1920]
    .filter((w) => w <= photo.width)
    .map((w) => `${photoUrl(photo, w, true)} ${w}w`)
    .join(', ');
}

/** Mention courte : « Photo : Auteur · Licence ». */
export function photoCredit(photo: CityPhoto): string {
  return photo.license === 'CC0' ? `Photo : ${photo.author} (domaine public)` : `Photo : ${photo.author} · ${photo.license}`;
}
