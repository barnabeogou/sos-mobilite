/**
 * Notifications push (Web Push / FCM) — ÉTAPE 4 de la feuille de route.
 *
 * Aujourd'hui : les notifications sont enregistrées dans la table `notifications`
 * et diffusées en temps réel dans l'application (Supabase Realtime).
 *
 * Pour activer le push :
 *  1. Générer des clés VAPID et les stocker dans les secrets Supabase.
 *  2. Créer une table `push_subscriptions` (endpoint, clés, user_id) protégée par RLS.
 *  3. Écrire une Edge Function `send-push` déclenchée par un Database Webhook sur
 *     l'insertion dans `notifications`.
 *  4. Implémenter `subscribeToPush()` ci-dessous avec `registration.pushManager.subscribe`.
 *
 * Aucun envoi n'est simulé tant que ces éléments ne sont pas en place.
 */
export const PUSH_ENABLED = false;

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function subscribeToPush(): Promise<never> {
  throw new Error('PUSH_NOT_CONFIGURED');
}
