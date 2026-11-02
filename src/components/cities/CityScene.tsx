import { memo, type ReactNode } from 'react';
import { useSvgId } from '@/components/motion/SignalMap';
import { cssVars } from '@/components/motion/motion';
import type { City } from '@/domain/cities';
import { C, H, buildScene, genericScene, rngFor } from './scenes';

/**
 * Photos haute définition facultatives, par ville (fichiers dans public/cities/).
 * Quand une photo est fournie, elle remplace l'illustration ; le nom reste en filigrane.
 * Exemple : abidjan: '/cities/abidjan.webp'
 */
export const CITY_PHOTOS: Partial<Record<string, string>> = {};

export interface SceneCity {
  slug: string;
  name: string;
  landmark?: string;
  scene?: City['scene'];
  water?: boolean;
}

/** Taille du filigrane : le nom tient dans la largeur visible sur un téléphone (~600 unités). */
function watermarkSize(name: string) {
  return Math.min(150, Math.round(520 / (0.86 * Math.max(3, name.length))));
}

/**
 * Ville de nuit : ciel étoilé, grand nom en filigrane, monument éclairé, reflets dans l'eau.
 * Le dessin remplit son conteneur (recadrage centré, monument toujours visible).
 */
export const CityScene = memo(function CityScene({
  city,
  showName = true,
  className,
  framing = 'bottom',
}: {
  city: SceneCity;
  showName?: boolean;
  className?: string;
  /** `bottom` : bandeau (horizon en bas) ; `center` : vignette. */
  framing?: 'bottom' | 'center';
}) {
  const id = useSvgId(`cs-${city.slug}`);
  const ids = {
    sky: `${id}-sky`,
    glow: `${id}-glow`,
    water: `${id}-water`,
    ground: `${id}-ground`,
    warm: `${id}-warm`,
    body: `${id}-body`,
    beam: `${id}-beam`,
    fade: `${id}-fade`,
    mask: `${id}-mask`,
    wm: `${id}-wm`,
    horizon: `${id}-hz`,
    halo: `${id}-halo`,
    haloCool: `${id}-haloc`,
    mist: `${id}-mist`,
    lit: `${id}-lit`,
    litWarm: `${id}-litw`,
    city: `${id}-city`,
    cloud: `${id}-cloud`,
    pillar: `${id}-pillar`,
    pillarCool: `${id}-pillarc`,
    sheen: `${id}-sheen`,
    adobe: `${id}-adobe`,
    glass: `${id}-glass`,
    steel: `${id}-steel`,
    shoot: `${id}-shoot`,
  };
  const g = { halo: ids.halo, haloCool: ids.haloCool, mist: ids.mist, lit: ids.lit, litWarm: ids.litWarm, adobe: ids.adobe, glass: ids.glass, steel: ids.steel };
  const rng = rngFor(city.slug);
  const parts = city.scene
    ? buildScene(city.scene, { rng, glow: ids.glow, gradWarm: ids.warm, gradBody: ids.body, gradBeam: ids.beam, g })
    : genericScene({ rng, glow: ids.glow, gradWarm: ids.warm, gradBody: ids.body, gradBeam: ids.beam, g });
  const starRng = rngFor(`${city.slug}-stars`);
  const stars = Array.from({ length: 70 }, (_, i) => ({
    key: i,
    x: starRng() * 1000,
    y: starRng() * 200,
    r: 0.4 + starRng() * 1.1,
    d: (starRng() * 6).toFixed(2),
    t: (2.5 + starRng() * 4).toFixed(2),
  }));
  const upper = city.name.toUpperCase();
  const fs = watermarkSize(upper);
  // Dans le ciel, en partie derrière le monument (comme sur la maquette).
  const baseline = 48 + fs * 0.8;
  const photo = CITY_PHOTOS[city.slug];
  const water = Boolean(city.water);

  const mirrored = (content: ReactNode) => (
    <g mask={`url(#${ids.mask})`} opacity={0.5} aria-hidden>
      <g transform={`matrix(1 0 0 -1 0 ${H * 2})`}>{content}</g>
    </g>
  );

  return (
    <svg
      viewBox="0 0 1000 360"
      preserveAspectRatio={framing === 'bottom' ? 'xMidYMax slice' : 'xMidYMid slice'}
      className={['cs', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={city.landmark ? `${city.name} — ${city.landmark}` : city.name}
    >
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020713" />
          <stop offset="0.42" stopColor="#071B36" />
          <stop offset="0.72" stopColor="#0E3463" />
          <stop offset="0.92" stopColor="#1B4F8E" />
          <stop offset="1" stopColor="#2A63A3" />
        </linearGradient>
        <linearGradient id={ids.water} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12406F" />
          <stop offset="0.45" stopColor="#0A2643" />
          <stop offset="1" stopColor="#030A14" />
        </linearGradient>
        <linearGradient id={ids.ground} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A1C30" />
          <stop offset="1" stopColor="#040B14" />
        </linearGradient>
        <linearGradient id={ids.warm} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B57A3A" />
          <stop offset="0.5" stopColor="#F4C77E" />
          <stop offset="1" stopColor="#FFE9BD" />
        </linearGradient>
        <linearGradient id={ids.body} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0D2540" />
          <stop offset="1" stopColor="#081A2D" />
        </linearGradient>
        <linearGradient id={ids.beam} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFE3A1" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFE3A1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.wm} gradientUnits="userSpaceOnUse" x1="0" y1={baseline - fs * 0.75} x2="0" y2={baseline + 4}>
          <stop offset="0" stopColor="#C4DCFF" stopOpacity="0.5" />
          <stop offset="1" stopColor="#8CC0FF" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id={ids.horizon}>
          <stop offset="0" stopColor="#1E7BFF" stopOpacity="0.42" />
          <stop offset="0.6" stopColor="#1E7BFF" stopOpacity="0.12" />
          <stop offset="1" stopColor="#1E7BFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.halo}>
          <stop offset="0" stopColor="#FFC27A" stopOpacity="0.42" />
          <stop offset="0.45" stopColor="#FFB060" stopOpacity="0.14" />
          <stop offset="1" stopColor="#FFC27A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.haloCool}>
          <stop offset="0" stopColor="#B9D6FF" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="#8DB8FF" stopOpacity="0.10" />
          <stop offset="1" stopColor="#AFCFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.mist}>
          <stop offset="0" stopColor="#AFCFFF" stopOpacity="0.14" />
          <stop offset="1" stopColor="#AFCFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.lit} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FB2E4" />
          <stop offset="0.55" stopColor="#D6E5FB" />
          <stop offset="1" stopColor="#F5F9FF" />
        </linearGradient>
        <linearGradient id={ids.litWarm} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C98C47" />
          <stop offset="0.45" stopColor="#F7CF8A" />
          <stop offset="1" stopColor="#FFF0CF" />
        </linearGradient>
        {/* Halo orangé des éclairages de la ville au-dessus de l'horizon */}
        <radialGradient id={ids.city}>
          <stop offset="0" stopColor="#FFA650" stopOpacity="0.30" />
          <stop offset="0.5" stopColor="#E07A3A" stopOpacity="0.10" />
          <stop offset="1" stopColor="#E07A3A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.adobe} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A4A28" />
          <stop offset="0.6" stopColor="#C1834C" />
          <stop offset="1" stopColor="#EDB273" />
        </linearGradient>
        <linearGradient id={ids.glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A426F" />
          <stop offset="1" stopColor="#0A1E36" />
        </linearGradient>
        <linearGradient id={ids.steel} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B86BF" />
          <stop offset="1" stopColor="#24446E" />
        </linearGradient>
        <linearGradient id={ids.shoot} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id={ids.cloud}>
          <stop offset="0" stopColor="#9CC2FF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#9CC2FF" stopOpacity="0" />
        </radialGradient>
        {/* Colonnes de lumière reflétées dans l'eau */}
        <radialGradient id={ids.pillar} cx="0.5" cy="0" r="1" fx="0.5" fy="0">
          <stop offset="0" stopColor="#FFD38A" stopOpacity="0.34" />
          <stop offset="0.5" stopColor="#FFC274" stopOpacity="0.08" />
          <stop offset="1" stopColor="#FFC274" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.pillarCool} cx="0.5" cy="0" r="1" fx="0.5" fy="0">
          <stop offset="0" stopColor="#DCEBFF" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="#B9D6FF" stopOpacity="0.07" />
          <stop offset="1" stopColor="#B9D6FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5FA2FF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#5FA2FF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#5FA2FF" stopOpacity="0" />
        </linearGradient>
        <mask id={ids.mask} maskUnits="userSpaceOnUse" x="0" y={H} width="1000" height={360 - H}>
          <rect x="0" y={H} width="1000" height={360 - H} fill={`url(#${ids.fade})`} />
        </mask>
        <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="1000" height="360" fill={`url(#${ids.sky})`} />
      <ellipse cx="500" cy={H} rx="620" ry="150" fill={`url(#${ids.horizon})`} />
      <ellipse cx="500" cy={H + 6} rx="560" ry="96" fill={`url(#${ids.city})`} />

      {photo ? (
        <image href={photo} x="0" y="0" width="1000" height="360" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <>
          <g className="cs-clouds" aria-hidden>
            <ellipse cx="210" cy="150" rx="230" ry="26" fill={`url(#${ids.cloud})`} />
            <ellipse cx="760" cy="118" rx="260" ry="22" fill={`url(#${ids.cloud})`} />
            <ellipse cx="520" cy="196" rx="300" ry="18" fill={`url(#${ids.cloud})`} opacity="0.7" />
          </g>
          {/* Étoile filante, de temps en temps (décalée selon la ville). */}
          <g className="cs-shoot" style={cssVars({ '--d': `${(starRng() * 9).toFixed(2)}s` })} aria-hidden>
            <line x1="0" y1="0" x2="70" y2="0" stroke={`url(#${ids.shoot})`} strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g className="cs-stars">
            {stars.map((s) => (
              <circle key={s.key} cx={s.x} cy={s.y} r={s.r} fill="#fff" style={cssVars({ '--d': `${s.d}s`, '--t': `${s.t}s` })} />
            ))}
          </g>
          {parts.moon && (
            <g className="cs-moon">
              <circle cx="842" cy="64" r="26" fill="rgba(255,236,190,0.08)" />
              <path d="M850 46 a 18 18 0 1 0 8 30 a 14 14 0 1 1 -8 -30 Z" fill="#F4E6C4" opacity="0.9" />
            </g>
          )}
        </>
      )}

      {showName && (
        <text
          x="500"
          y={baseline}
          textAnchor="middle"
          className="cs-name"
          fontSize={fs}
          fill={`url(#${ids.wm})`}
          stroke="rgba(140,192,255,0.22)"
          strokeWidth="1"
        >
          {upper}
        </text>
      )}

      {!photo && (
        <g className="cs-scene">
          {parts.back}
          <g className="cs-landmark">{parts.landmark}</g>
          <rect x="0" y={H} width="1000" height={360 - H} fill={`url(#${water ? ids.water : ids.ground})`} />
          <rect x="0" y={H} width="1000" height="1" fill={C.rim} opacity="0.25" />
          {water && (
            <>
              {mirrored(
                <>
                  {parts.back}
                  {parts.landmark}
                </>,
              )}
              <rect x="0" y={H} width="1000" height="26" fill={`url(#${ids.sheen})`} />
              {(parts.lights ?? []).map(([x, w, tone], i) => (
                <ellipse
                  key={`p${i}`}
                  cx={x}
                  cy={H + 1}
                  rx={w * 0.42}
                  ry={360 - H}
                  fill={`url(#${tone === 'cool' ? ids.pillarCool : ids.pillar})`}
                  className="cs-pillar"
                  style={cssVars({ '--d': `${(i * 0.6).toFixed(2)}s` })}
                />
              ))}
              <g className="cs-shimmer" strokeLinecap="round">
                {Array.from({ length: 22 + (parts.lights?.length ?? 0) * 7 }, (_, i) => {
                  const lights = parts.lights ?? [];
                  // Sous chaque lumière, une colonne de tirets qui s'amenuise ; le reste est réparti sur l'eau.
                  const under = lights.length && i % 4 !== 3 ? lights[i % lights.length] : null;
                  const row = Math.floor(i / Math.max(1, lights.length));
                  const y = under ? H + 4 + (row % 8) * 7.5 : H + 6 + (i % 9) * 6.5;
                  const spread = under ? Math.max(4, under[1] * (0.25 + (row % 8) * 0.06)) : 0;
                  const x = under ? under[0] - spread / 2 + ((i * 7) % 5) - 2 : 40 + ((i * 137) % 920);
                  const warm = under ? under[2] !== 'cool' : i % 3 === 0;
                  return (
                    <line
                      key={i}
                      x1={x}
                      y1={y}
                      x2={x + (under ? spread : 10 + (i % 4) * 7)}
                      y2={y}
                      stroke={warm ? '#FFD9A0' : '#CFE3FF'}
                      strokeWidth={under ? 1.2 : 0.8}
                      opacity={under ? Math.max(0.16, 0.6 - (row % 8) * 0.06) : 0.2}
                      style={cssVars({ '--d': `${(i * 0.29).toFixed(2)}s` })}
                    />
                  );
                })}
              </g>
            </>
          )}
          {parts.front}
        </g>
      )}
    </svg>
  );
});
