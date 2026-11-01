import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LogOut, type LucideIcon } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Display';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Mis en avant (bouton SOS) */
  highlight?: boolean;
}

/**
 * Coque des espaces connectés : barre supérieure, navigation latérale (ordinateur)
 * et barre d'onglets en bas (mobile, comme sur les maquettes).
 */
export function AppShell({ nav, homePath, banner }: { nav: NavItem[]; homePath: string; banner?: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate('/connexion', { replace: true });
  };

  return (
    <div className="min-h-dvh md:flex">
      {/* Navigation latérale (≥ md) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-night-950/40 px-4 py-5 md:flex">
        <Link to={homePath} className="px-2">
          <BrandLogo compact />
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Navigation principale">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-electric-500/15 text-white ring-1 ring-inset ring-electric-500/40' : 'text-silver-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className={clsx('h-5 w-5', item.highlight && 'text-alert-500')} aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-night-850/60 p-3">
          <Avatar name={profile?.full_name} src={profile?.avatar_url} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.full_name || 'Mon compte'}</p>
            <p className="truncate text-xs text-silver-500">{profile?.email}</p>
          </div>
          <button type="button" onClick={logout} className="rounded-lg p-2 text-silver-400 hover:bg-white/5 hover:text-white" aria-label="Se déconnecter">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-night-900/85 px-4 py-3 backdrop-blur md:px-8">
          <Link to={homePath} className="md:hidden">
            <BrandLogo compact />
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={logout}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850 text-silver-300 md:hidden"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {banner}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12">
          <Outlet />
        </main>

        {/* Barre d'onglets (mobile) */}
        <nav
          className="no-print safe-bottom fixed inset-x-3 bottom-3 z-30 flex items-stretch justify-around rounded-3xl border border-white/10 bg-night-850/95 px-1 pt-1.5 shadow-2xl backdrop-blur md:hidden"
          aria-label="Navigation principale"
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition',
                  isActive ? 'bg-electric-500/15 text-white' : 'text-silver-400',
                )
              }
            >
              <item.icon className={clsx('h-5 w-5', item.highlight && 'text-alert-500')} aria-hidden />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
