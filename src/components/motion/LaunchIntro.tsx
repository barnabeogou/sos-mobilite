import { useEffect, useRef, useState } from 'react';
import { BRAND } from '@/config/env';
import { CI_OUTLINE, CITIES, MAP_SIZE, project } from '@/domain/cities';
import { cssVars, introState, launchIntroMode, lockScroll, markIntroSeen, unlockScroll } from './motion';

const EXIT_MS = 850;
const WORDS = ['SOS', 'MOBILITÉ'];

const ORIGIN = CITIES[0];
const [OX, OY] = project(ORIGIN.lat, ORIGIN.lng);
/** Les autres grandes villes, de la plus proche à la plus lointaine d'Abidjan : l'alerte se propage. */
const TARGETS = CITIES.slice(1)
  .map((c) => {
    const [x, y] = project(c.lat, c.lng);
    return { c, x, y, d: Math.hypot(x - OX, y - OY) };
  })
  .sort((a, b) => a.d - b.d);

/** Arc de signal entre Abidjan et une ville (légèrement bombé vers le haut). */
function arc(x: number, y: number) {
  const mx = (OX + x) / 2;
  const my = (OY + y) / 2 - Math.min(60, Math.hypot(x - OX, y - OY) * 0.28);
  return `M${OX} ${OY} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x} ${y}`;
}

/**
 * Intro de lancement : la carte de Côte d'Ivoire se dessine, une alerte part d'Abidjan et rejoint
 * les grandes villes du pays, puis le logotype et le slogan. Le rideau se lève ensuite sur la page.
 * Version courte pour une personne connectée ou l'application installée ; jamais pour un lien
 * direct (suivi d'une intervention, retour de paiement…) ni si « réduire les animations » est actif.
 * Un toucher, un clic ou Échap la passe.
 */
export function LaunchIntro() {
  const [mode] = useState(() => {
    const m = launchIntroMode();
    if (!m) introState.set(true);
    return m;
  });
  const [visible, setVisible] = useState(Boolean(mode));
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);
  const hold = mode === 'short' ? 1700 : 2900;

  const leave = () => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    unlockScroll();
    introState.set(true);
    window.setTimeout(() => setVisible(false), EXIT_MS);
  };

  useEffect(() => {
    if (!mode) return;
    markIntroSeen();
    lockScroll();
    const timer = window.setTimeout(leave, hold);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      if (!left.current) unlockScroll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;
  let letter = 0;

  return (
    <div
      className="intro"
      data-leaving={leaving || undefined}
      onPointerDown={leave}
      style={cssVars({ '--k': mode === 'short' ? 0.55 : 1, '--hold': `${hold}ms` })}
    >
      <div className="intro-stage" aria-hidden>
        <svg viewBox={`-10 -10 ${MAP_SIZE + 20} ${MAP_SIZE + 20}`} className="intro-map">
          <path className="li-land" d={CI_OUTLINE} />
          <path className="li-border" d={CI_OUTLINE} pathLength={1} />
          <g className="li-arcs">
            {TARGETS.map((t, i) => (
              <path key={t.c.slug} d={arc(t.x, t.y)} pathLength={1} style={cssVars({ '--i': i })} />
            ))}
          </g>
          <g className="li-cities">
            {TARGETS.map((t, i) => (
              <g key={t.c.slug} style={cssVars({ '--i': i })}>
                <circle className="li-halo" cx={t.x} cy={t.y} r={9} />
                <circle cx={t.x} cy={t.y} r={3.6} />
                <text x={t.x + (t.x > 300 ? -7 : 7)} y={t.y + 3} textAnchor={t.x > 300 ? 'end' : 'start'}>
                  {t.c.name}
                </text>
              </g>
            ))}
          </g>
          <circle className="li-ping" cx={OX} cy={OY} r={7} vectorEffect="non-scaling-stroke" />
          <circle className="li-ping li-ping-late" cx={OX} cy={OY} r={7} vectorEffect="non-scaling-stroke" />
          <circle className="li-sos" cx={OX} cy={OY} r={6} />
        </svg>

        <p className="intro-word">
          {WORDS.map((word, w) => (
            <span key={word} className={w === 1 ? 'w text-alert-500' : 'w'}>
              {[...word].map((ch, i) => (
                <span key={i} className="ch" style={cssVars({ '--i': letter++ })}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </p>
        <p className="intro-slogan">{BRAND.slogan}</p>
        <p className="intro-reach">Partout en {BRAND.country}</p>
      </div>

      <div className="intro-progress" aria-hidden>
        <span />
      </div>
      <button type="button" className="intro-skip" onClick={leave}>
        Passer l’intro
      </button>
    </div>
  );
}
