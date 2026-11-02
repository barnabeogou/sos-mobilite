import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ShieldAlert } from 'lucide-react';
import 'lenis/dist/lenis.css';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ButtonLink } from '@/components/ui/Button';
import { useAuth, homePathFor } from '@/hooks/useAuth';
import { BRAND } from '@/config/env';
import { EMERGENCY_NOTICE } from '@/domain/catalog';
import { scrollToTop, startSmoothScroll, stopSmoothScroll, useScrolled } from '@/components/motion/motion';

export function PublicLayout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const scrolled = useScrolled(12);

  useEffect(() => {
    startSmoothScroll();
    return stopSmoothScroll;
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [pathname]);

  const link = ({ isActive }: { isActive: boolean }) =>
    clsx('rounded-lg px-3 py-2 text-sm font-semibold transition', isActive ? 'text-white' : 'text-silver-300 hover:text-white');

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={clsx(
          'sticky top-0 z-30 border-b backdrop-blur transition-[background-color,border-color,box-shadow] duration-500',
          scrolled ? 'border-white/10 bg-night-950/85 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]' : 'border-transparent bg-night-900/40',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link to="/" aria-label="Accueil SOS MOBILITÉ">
            <BrandLogo compact />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation">
            <NavLink to="/services" className={link}>
              Services
            </NavLink>
            <NavLink to="/inscription/professionnel" className={link}>
              Devenir partenaire
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {profile ? (
              <ButtonLink to={homePathFor(profile)} size="sm">
                Mon espace
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/connexion" variant="ghost" size="sm">
                  Connexion
                </ButtonLink>
                <ButtonLink to="/inscription" size="sm" className="hidden sm:inline-flex">
                  Créer un compte
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div key={pathname} className="page-in">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-white/5 bg-night-950/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
          <div className="space-y-3">
            <BrandLogo />
            <p className="text-sm text-silver-400">{BRAND.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/services" className="text-silver-300 hover:text-white">
              Nos services
            </Link>
            <Link to="/inscription/professionnel" className="text-silver-300 hover:text-white">
              Espace professionnels
            </Link>
            <Link to="/inscription" className="text-silver-300 hover:text-white">
              Créer un compte
            </Link>
            <Link to="/confidentialite" className="text-silver-300 hover:text-white">
              Confidentialité
            </Link>
            <Link to="/credits-photos" className="text-silver-300 hover:text-white">
              Crédits photos
            </Link>
          </div>
          <div className="flex gap-3 rounded-2xl border border-alert-500/30 bg-alert-500/[0.06] p-4 text-xs text-silver-300">
            <ShieldAlert className="h-5 w-5 shrink-0 text-alert-500" aria-hidden />
            <p>{EMERGENCY_NOTICE}</p>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-silver-600">
          © {new Date().getFullYear()} {BRAND.name} — partout en {BRAND.country}
        </p>
      </footer>
    </div>
  );
}
