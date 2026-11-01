import { useEffect, useId, useRef, useState } from 'react';
import { SosButton } from '@/components/brand/SosButton';
import { cssVars, useReducedMotion } from './motion';
import { HERO_PROS, LAGOON, SEARCH_RINGS, SOS_RADIUS, STREETS, routeToCenter } from './signalGeometry';

const CYCLE_MS = 3200;

/** Fondu circulaire des rues et de la lagune vers les bords (pas de coupure carrée). */
export function MapFade({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-g`}>
        <stop offset="0.5" stopColor="#fff" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <mask id={id}>
        <rect x={-200} y={-200} width={400} height={400} fill={`url(#${id}-g)`} />
      </mask>
    </defs>
  );
}

/** Identifiant utilisable dans `url(#…)`. */
export const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

/**
 * Illustration du fonctionnement (pas des données en direct) : le SOS émet un signal,
 * les professionnels vérifiés autour reçoivent la demande, l'un d'eux répond.
 * L'animation se met en pause hors écran et quand l'onglet est masqué.
 */
export function SignalMap({ sosTarget }: { sosTarget: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useSvgId('signal-fade');

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let visible = true;
    const sync = () => setPaused(!visible || document.hidden);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            sync();
          })
        : null;
    io?.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || paused) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % HERO_PROS.length), CYCLE_MS);
    return () => window.clearInterval(t);
  }, [reduced, paused]);

  return (
    <figure className="hero-map relative mx-auto w-full max-w-[540px]">
      <div ref={ref} className="signal relative aspect-square w-full" data-paused={paused || undefined}>
        <svg viewBox="-200 -200 400 400" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <MapFade id={fade} />
          <g mask={`url(#${fade})`}>
            <path className="lagoon" d={LAGOON} />
            <g className="streets">
              {STREETS.map((d) => (
                <path key={d} d={d} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          </g>
          <g className="rings">
            {SEARCH_RINGS.map((ring) => (
              <g key={ring.r}>
                <circle r={ring.r} vectorEffect="non-scaling-stroke" />
                <text className="ring-label" x={0} y={-ring.r + 13} textAnchor="middle">
                  {ring.label}
                </text>
              </g>
            ))}
          </g>
          <circle className="wave" r={SOS_RADIUS} vectorEffect="non-scaling-stroke" />
          <circle className="wave wave-late" r={SOS_RADIUS} vectorEffect="non-scaling-stroke" />
          <path key={active} className="route" d={routeToCenter(HERO_PROS[active])} pathLength={1} vectorEffect="non-scaling-stroke" />
          <g>
            {HERO_PROS.map(([x, y], i) => (
              <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
                <circle className="pro-halo" r={11} data-on={i === active || undefined} />
                <circle className="pro" r={4.5} data-on={i === active || undefined} style={cssVars({ '--i': i })} />
              </g>
            ))}
          </g>
        </svg>
        <SosButton to={sosTarget} size="fluid" />
      </div>
      <figcaption className="mx-auto mt-2 max-w-sm text-center text-sm text-silver-400">
        Votre demande part vers les professionnels vérifiés et disponibles autour de vous. Si personne ne répond, le rayon s’élargit
        jusqu’à 30 km.
      </figcaption>
    </figure>
  );
}
