import { useEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion } from '@/components/motion/motion';
import { MapPin } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { cityBySlug, findCity, findLocality, type City } from '@/domain/cities';
import { cityPhoto } from '@/domain/cityPhotos';
import { CityScene, type SceneCity } from './CityScene';

/** Ville de l'utilisateur (profil) : grande ville illustrée, sinon sa ville avec un décor générique. */
export function useMyCity(): SceneCity {
  const profile = useProfile();
  return sceneCityFor(profile.city);
}

export function sceneCityFor(name: string | null | undefined): SceneCity {
  const city = findCity(name);
  if (city) return city;
  const locality = findLocality(name);
  if (locality) return { slug: locality.name.toLowerCase(), name: locality.name };
  return cityBySlug('abidjan');
}

/** Met en pause les animations du décor quand il sort de l'écran ou que l'onglet est masqué. */
export function usePauseOffscreen(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = true;
    const apply = () => {
      if (visible && !document.hidden) delete el.dataset.paused;
      else el.dataset.paused = '';
    };
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => ((visible = e.isIntersecting), apply())) : null;
    io?.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, [ref]);
}

/**
 * Profondeur au défilement : le décor descend moins vite que la page et le nom en filigrane
 * s'efface (variable CSS `--sy`, mise à jour au plus une fois par image et seulement près du haut).
 */
function useHeroParallax(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const y = Math.min(360, Math.max(0, window.scrollY));
      if (y === last) return;
      last = y;
      el.style.setProperty('--sy', String(Math.round(y)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [ref]);
}

/**
 * Bandeau de rubrique : une grande ville de Côte d'Ivoire de nuit, son nom en filigrane,
 * puis le titre de la page. Sur téléphone, le décor passe sous la barre du haut (pleine largeur).
 */
export function CityHero({
  city,
  title,
  subtitle,
  eyebrow,
  actions,
  media,
  pin = false,
  children,
}: {
  city: SceneCity | City | string;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Élément affiché à gauche du titre (photo de profil…). */
  media?: ReactNode;
  /** Afficher le repère de la ville (seulement quand c'est la ville de l'utilisateur). */
  pin?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  usePauseOffscreen(ref);
  useHeroParallax(ref);
  const c = typeof city === 'string' ? cityBySlug(city) : city;
  // Avec une photo, le repère n'indique que la ville (la photo peut être remplacée par l'illustration).
  const landmark = cityPhoto(c.slug) ? null : c.landmark;

  return (
    <section ref={ref} className="city-hero relative -mx-4 -mt-[85px] mb-6 md:mx-0 md:mt-0 md:mb-8">
      <div className="city-hero-art relative h-[310px] overflow-hidden bg-[#030912] md:h-auto md:aspect-[3/1] md:rounded-3xl md:border md:border-white/10">
        {/* Sur téléphone, le décor commence sous la barre du haut : le monument reste entièrement visible. */}
        <div className="cs-zoom absolute inset-x-0 bottom-0 top-14 md:top-0">
          <CityScene city={c} priority credit />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-night-950/80 to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-night-900/70 to-night-900" />

        {pin && (
          <span className="city-pin absolute bottom-20 right-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-night-950/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-silver-200 backdrop-blur md:bottom-6 md:right-6">
            <MapPin className="h-3.5 w-3.5 text-alert-500" aria-hidden />
            {c.name}
            {landmark && <span className="hidden font-medium normal-case tracking-normal text-silver-400 md:inline"> · {landmark}</span>}
          </span>
        )}
      </div>
      <div className="city-hero-title relative -mt-16 flex flex-wrap items-end justify-between gap-3 px-4 md:-mt-24 md:px-8 md:pb-2">
        <div className="flex min-w-0 items-center gap-4">
          {media}
          <div className="min-w-0">
            {eyebrow && <div className="mb-1">{eyebrow}</div>}
            <h1 className="text-[1.7rem] font-bold leading-tight text-white drop-shadow md:text-4xl">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-silver-300">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
