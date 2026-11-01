import { NotConfiguredError } from './supabase';

/** Messages français pour les codes d'erreur métier levés par les fonctions SQL. */
const CODE_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Veuillez vous connecter pour continuer.',
  ACCOUNT_SUSPENDED: 'Votre compte est suspendu. Contactez le support.',
  FORBIDDEN_ROLE: 'Cette action n’est pas disponible pour votre type de compte.',
  FORBIDDEN_ADMIN: 'Niveau d’autorisation insuffisant.',
  LOCATION_CONSENT_REQUIRED: 'Autorisez le partage de votre position pour envoyer la demande.',
  ACTIVE_REQUEST_EXISTS: 'Vous avez déjà une demande en cours.',
  MECHANIC_NOT_APPROVED: 'Votre profil doit d’abord être validé par l’administration.',
  MECHANIC_BUSY: 'Terminez votre mission en cours avant d’en accepter une autre.',
  PROPOSAL_EXPIRED: 'Cette proposition a expiré.',
  REQUEST_NO_LONGER_AVAILABLE: 'Cette demande a déjà été prise par un autre professionnel.',
  PROPOSAL_CLOSED: 'Cette proposition n’est plus ouverte.',
  INVALID_STATUS: 'Action impossible à cette étape de l’intervention.',
  QUOTE_PENDING: 'Un devis attend encore la réponse du client.',
  TOO_MANY_ATTEMPTS: 'Trop de tentatives. Contactez le support.',
  SUPABASE_NOT_CONFIGURED: 'Le service n’est pas encore connecté à sa base de données.',
};

interface MaybeSupabaseError {
  message?: string;
  hint?: string | null;
  code?: string;
  details?: string | null;
  status?: number;
}

export function errorMessage(err: unknown): string {
  if (err instanceof NotConfiguredError) return CODE_MESSAGES.SUPABASE_NOT_CONFIGURED;
  const e = (err ?? {}) as MaybeSupabaseError;
  const msg = e.message ?? (typeof err === 'string' ? err : '');

  if (e.hint && !/^(Perhaps|Try|No function)/i.test(e.hint)) return e.hint;
  if (msg && CODE_MESSAGES[msg]) return CODE_MESSAGES[msg];

  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return 'Confirmez votre adresse e-mail via le lien reçu avant de vous connecter.';
  if (/User already registered/i.test(msg)) return 'Un compte existe déjà avec cette adresse e-mail.';
  if (/Password should be at least/i.test(msg)) return 'Le mot de passe est trop court (8 caractères minimum).';
  if (/rate limit|too many requests/i.test(msg)) return 'Trop de tentatives. Patientez quelques minutes.';
  if (/permission denied|row-level security|violates row-level/i.test(msg)) return 'Action non autorisée.';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg))
    return 'Connexion impossible. Vérifiez votre accès internet puis réessayez.';
  if (/JWT expired/i.test(msg)) return 'Votre session a expiré. Reconnectez-vous.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
