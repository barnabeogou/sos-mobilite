/**
 * Configuration lue depuis les variables d'environnement Vite.
 * Seules des valeurs publiques peuvent figurer ici (elles sont visibles dans le navigateur).
 */
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  /** Vrai si un projet Supabase réel est configuré. */
  isSupabaseConfigured: /^https?:\/\//.test(url) && anonKey.length > 20 && !url.includes('VOTRE-PROJET'),
  enablePhoneAuth: import.meta.env.VITE_ENABLE_PHONE_AUTH === 'true',
  appUrl: (import.meta.env.VITE_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, ''),
} as const;

export const BRAND = {
  name: 'SOS MOBILITÉ',
  slogan: 'Votre tranquillité, notre engagement.',
  tagline: 'Tous vos moyens de transport motorisés, une seule plateforme.',
  country: 'Côte d’Ivoire',
  city: 'Abidjan',
} as const;
