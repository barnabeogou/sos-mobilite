import { useEffect, useRef, useState } from 'react';
import { BRAND } from '@/config/env';
import { cssVars, introState, lockScroll, markIntroSeen, unlockScroll } from './motion';
import { INTRO_PROS, INTRO_ROUTE, LAGOON, STREETS } from './signalGeometry';
import { MapFade, useSvgId } from './SignalMap';

/** Durée de l'intro avant le lever de rideau, puis durée du rideau. */
const HOLD_MS = 2400;
const EXIT_MS = 850;

const WORDS = ['SOS', 'MOBILITÉ'];

/**
 * Intro : un client lance un SOS, le signal se propage, les professionnels proches s'allument,
 * l'un d'eux prend la route. Puis le logotype, le slogan, et le rideau se lève sur l'accueil.
 * Un toucher, un clic ou Échap la passe immédiatement.
 */
export function IntroSplash({ onFinished }: { onFinished: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);
  const fade = useSvgId('intro-fade');

  const leave = () => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    unlockScroll();
    introState.set(true);
    window.setTimeout(onFinished, EXIT_MS);
  };

  useEffect(() => {
    markIntroSeen();
    lockScroll();
    const timer = window.setTimeout(leave, HOLD_MS);
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

  let letter = 0;

  return (
    <div className="intro" data-leaving={leaving || undefined} onPointerDown={leave}>
      <div className="intro-stage" aria-hidden>
        <svg viewBox="-200 -200 400 400" className="intro-map">
          <MapFade id={fade} />
          <g mask={`url(#${fade})`}>
            <path className="i-lagoon" d={LAGOON} />
            <g className="i-streets">
              {STREETS.map((d, i) => (
                <path key={d} d={d} pathLength={1} vectorEffect="non-scaling-stroke" style={cssVars({ '--i': i })} />
              ))}
            </g>
          </g>
          <g className="i-rings">
            {[62, 112, 162].map((r, i) => (
              <circle key={r} r={r} vectorEffect="non-scaling-stroke" style={cssVars({ '--i': i })} />
            ))}
          </g>
          <path className="i-route" d={INTRO_ROUTE} pathLength={1} />
          <g className="i-pros">
            {INTRO_PROS.map(([x, y], i) => (
              <circle key={`${x}${y}`} cx={x} cy={y} r={4.5} className={i === 0 ? 'chosen' : undefined} style={cssVars({ '--i': i })} />
            ))}
          </g>
          <circle className="i-pulse" r={8} vectorEffect="non-scaling-stroke" />
          <circle className="i-pulse i-pulse-late" r={8} vectorEffect="non-scaling-stroke" />
          <circle className="i-me" r={7} />
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
