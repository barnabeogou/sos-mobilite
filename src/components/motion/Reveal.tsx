import { createElement, useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cssVars } from './motion';

/** Un seul observateur partagé pour toute la page. */
let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === 'undefined') return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.shown = 'true';
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );
  return observer;
}

type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Retard en millisecondes (cascade). */
  delay?: number;
  /** `rise` : apparition en montant ; `mask` : le texte monte derrière un masque (titres). */
  variant?: 'rise' | 'mask';
  children: ReactNode;
};

/** Apparition au défilement, une seule fois. Sans effet si « réduire les animations » est actif. */
export function Reveal({ as = 'div', delay = 0, variant = 'rise', style, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = getObserver();
    if (!io) {
      el.dataset.shown = 'true';
      return;
    }
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return createElement(
    as,
    { ref, 'data-reveal': variant, style: { ...cssVars({ '--d': `${delay}ms` }), ...style }, ...rest },
    variant === 'mask' ? <span className="mask-inner">{children}</span> : children,
  );
}
