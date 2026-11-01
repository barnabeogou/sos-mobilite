/**
 * Outils d'animation des pages publiques.
 *  - défilement fluide (Lenis) sur ordinateur, défilement natif conservé sur mobile tactile ;
 *  - verrouillage du défilement pendant l'intro ;
 *  - état « intro terminée » partagé avec la page d'accueil ;
 *  - préférences système : aucune animation si « réduire les animations » est activé.
 */
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import Lenis from 'lenis';

const REDUCED = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED).matches);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED);
    if (!mq) return;
    const update = () => setReduced(mq.matches);
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

/** Variables CSS typées pour `style`. */
export const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

// --- Défilement fluide -------------------------------------------------------

let lenis: Lenis | null = null;
let rafId = 0;
let locks = 0;

export function startSmoothScroll() {
  if (lenis || typeof window === 'undefined' || prefersReducedMotion()) return;
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
  if (locks) lenis.stop();
  const loop = (time: number) => {
    lenis?.raf(time);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

export function stopSmoothScroll() {
  cancelAnimationFrame(rafId);
  lenis?.destroy();
  lenis = null;
}

export function lockScroll() {
  locks += 1;
  document.documentElement.style.overflow = 'hidden';
  lenis?.stop();
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks) return;
  document.documentElement.style.overflow = '';
  lenis?.start();
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

// --- Intro --------------------------------------------------------------------

let introDone = false;
const listeners = new Set<() => void>();

export const introState = {
  get: () => introDone,
  set(value: boolean) {
    if (introDone === value) return;
    introDone = value;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Vrai dès que l'intro se retire (ou immédiatement s'il n'y a pas d'intro). */
export function useIntroDone(): boolean {
  return useSyncExternalStore(introState.subscribe, introState.get, () => true);
}

const INTRO_KEY = 'sos-intro-vue';

/** Pages d'arrivée où l'intro accueille le visiteur (jamais sur un lien direct vers une intervention). */
const ENTRY_PATHS = new Set(['/', '/client', '/pro', '/admin', '/connexion', '/inscription', '/inscription/professionnel']);

/**
 * Intro de lancement, une fois par session :
 *  - `full` pour un visiteur ;
 *  - `short` pour une personne connectée ou l'application installée (accès rapide en cas de panne) ;
 *  - aucune pour un lien direct (suivi, retour de paiement…), « réduire les animations » ou `?sans-intro`.
 */
export function launchIntroMode(): 'full' | 'short' | null {
  if (typeof window === 'undefined') return null;
  try {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (!ENTRY_PATHS.has(path)) return null;
    if (new URLSearchParams(window.location.search).has('sans-intro')) return null;
    if (prefersReducedMotion()) return null;
    if (window.sessionStorage.getItem(INTRO_KEY)) return null;
    const signedIn = Object.keys(window.localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    const installed = Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
    return signedIn || installed ? 'short' : 'full';
  } catch {
    return null;
  }
}

export function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* navigation privée : sans conséquence */
  }
}

// --- Progression au défilement -----------------------------------------------

/**
 * Calcule la progression (0 → 1) d'un élément qui traverse l'écran et l'expose
 * en variable CSS `--p`. `onChange` reçoit la valeur (appelé au plus une fois par image).
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement>, onChange?: (p: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.setProperty('--p', '1');
      onChange?.(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, (vh * 0.78 - rect.top) / (rect.height + vh * 0.25)));
      el.style.setProperty('--p', p.toFixed(3));
      onChange?.(p);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

/** Vrai quand la page a défilé au-delà de `offset` pixels. */
export function useScrolled(offset = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [offset]);
  return scrolled;
}
