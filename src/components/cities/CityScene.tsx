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
  };
  const g = { halo: ids.halo, haloCool: ids.haloCool, mist: ids.mist, lit: ids.lit, litWarm: ids.litWarm };
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
    <g mask={`url(#${ids.mask})`} opacity={0.34} aria-hidden>
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
          <stop offset="0" stopColor="#030912" />
          <stop offset="0.55" stopColor="#081A2E" />
          <stop offset="0.82" stopColor="#0F2C4C" />
          <stop offset="1" stopColor="#174570" />
        </linearGradient>
        <linearGradient id={ids.water} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0C2A48" />
          <stop offset="1" stopColor="#040D17" />
        </linearGradient>
        <linearGradient id={ids.ground} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A1C30" />
          <stop offset="1" stopColor="#040B14" />
        </linearGradient>
        <linearGradient id={ids.warm} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6B5738" />
          <stop offset="1" stopColor="#E9B66E" />
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
          <stop offset="0" stopColor="#8CC0FF" stopOpacity="0.42" />
          <stop offset="1" stopColor="#8CC0FF" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id={ids.horizon}>
          <stop offset="0" stopColor="#1E7BFF" stopOpacity="0.42" />
          <stop offset="0.6" stopColor="#1E7BFF" stopOpacity="0.12" />
          <stop offset="1" stopColor="#1E7BFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.halo}>
          <stop offset="0" stopColor="#FFC27A" stopOpacity="0.24" />
          <stop offset="1" stopColor="#FFC27A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.haloCool}>
          <stop offset="0" stopColor="#AFCFFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#AFCFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.mist}>
          <stop offset="0" stopColor="#AFCFFF" stopOpacity="0.14" />
          <stop offset="1" stopColor="#AFCFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.lit} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0C2340" />
          <stop offset="1" stopColor="#2A5583" />
        </linearGradient>
        <linearGradient id={ids.litWarm} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14233A" />
          <stop offset="1" stopColor="#6A5236" />
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

      {photo ? (
        <image href={photo} x="0" y="0" width="1000" height="360" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <>
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
              <g className="cs-shimmer" stroke="#CFE3FF" strokeLinecap="round">
                {Array.from({ length: 14 }, (_, i) => {
                  const y = H + 8 + (i % 7) * 8;
                  const x = 60 + ((i * 137) % 880);
                  return <line key={i} x1={x} y1={y} x2={x + 24 + (i % 3) * 14} y2={y} strokeWidth={0.8} opacity={0.18} style={cssVars({ '--d': `${(i * 0.37).toFixed(2)}s` })} />;
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
