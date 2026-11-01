import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Database, ShieldOff } from 'lucide-react';
import { env } from '@/config/env';
import { homePathFor, useAuth } from '@/hooks/useAuth';
import { LoadingBlock, Notice } from '@/components/ui/Display';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import type { AdminLevel, UserRole } from '@/types/database';

const LEVEL_ORDER: AdminLevel[] = ['support', 'operations', 'super_admin'];
export const hasAdminLevel = (level: AdminLevel | null | undefined, min: AdminLevel) =>
  level != null && LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(min);

/** Écran affiché tant que le projet Supabase n'est pas branché (aucune donnée simulée). */
export function NotConfigured() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <BrandLogo />
      <Notice tone="warning" icon={<Database className="h-5 w-5 text-amber-300" />} title="Base de données non connectée">
        <p>
          L’application n’est pas encore reliée à son projet Supabase. Renseignez <code className="text-white">VITE_SUPABASE_URL</code> et{' '}
          <code className="text-white">VITE_SUPABASE_ANON_KEY</code> dans <code className="text-white">.env.local</code>, appliquez les migrations du
          dossier <code className="text-white">supabase/migrations</code>, puis relancez l’application.
        </p>
        <p className="mt-2">Le guide complet se trouve dans le fichier README.md du projet.</p>
      </Notice>
      <a href="/" className="text-sm font-semibold text-electric-300">
        ← Retour à l’accueil
      </a>
    </div>
  );
}

export function RequireRole({ role, minAdmin, children }: { role: UserRole; minAdmin?: AdminLevel; children: ReactNode }) {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (!env.isSupabaseConfigured) return <NotConfigured />;
  if (loading) return <LoadingBlock label="Connexion…" />;
  if (!session) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <Notice tone="danger" title={profileError ? 'Profil inaccessible' : 'Préparation de votre profil…'}>
          {profileError ? 'Impossible de charger votre profil. Vérifiez votre connexion.' : 'Un instant…'}
        </Notice>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void refreshProfile()}>Réessayer</Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }
  if (profile.is_suspended) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <Notice tone="danger" icon={<ShieldOff className="h-5 w-5 text-alert-400" />} title="Compte suspendu">
          Votre compte est temporairement suspendu. Contactez le support SOS MOBILITÉ pour plus d’informations.
        </Notice>
        <Button className="mt-4" variant="ghost" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    );
  }
  if (profile.role !== role) return <Navigate to={homePathFor(profile)} replace />;
  if (role === 'admin' && minAdmin && !hasAdminLevel(profile.admin_level, minAdmin)) {
    return (
      <Notice tone="warning" title="Accès réservé">
        Cette section nécessite un niveau d’administration supérieur.
      </Notice>
    );
  }
  return <>{children}</>;
}

/** Pages de connexion/inscription : redirige un utilisateur déjà connecté vers son espace. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (!env.isSupabaseConfigured) return <>{children}</>;
  if (loading) return <LoadingBlock />;
  if (profile) return <Navigate to={homePathFor(profile)} replace />;
  return <>{children}</>;
}
