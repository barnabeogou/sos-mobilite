import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getMyProfile } from '@/services/profile.service';
import type { Profile } from '@/types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Vrai si la session existe mais que le profil n'a pas pu être chargé. */
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));
  const [profileError, setProfileError] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setProfileError(false);
      return;
    }
    try {
      setProfile(await getMyProfile(s.user.id));
      setProfileError(false);
    } catch {
      setProfileError(true);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Différé : éviter d'appeler Supabase à l'intérieur du callback d'authentification.
      setTimeout(() => {
        void loadProfile(s);
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileError,
      refreshProfile: () => loadProfile(session),
      signOut: async () => {
        await supabase?.auth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, loading, profileError, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

/** Profil garanti (à utiliser sous une route protégée). */
export function useProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('Profil non chargé');
  return profile;
}

export function homePathFor(profile: Pick<Profile, 'role'> | null): string {
  if (!profile) return '/connexion';
  if (profile.role === 'admin') return '/admin';
  if (profile.role === 'mechanic') return '/pro';
  return '/client';
}
