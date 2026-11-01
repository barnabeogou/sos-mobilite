import { registerSW } from 'virtual:pwa-register';

/**
 * Enregistre le service worker (PWA installable sur Android).
 * En cas de nouvelle version, propose de recharger plutôt que de forcer la mise à jour
 * au milieu d'une intervention.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      if (window.confirm('Une nouvelle version de SOS MOBILITÉ est disponible. Recharger maintenant ?')) {
        void update(true);
      }
    },
  });
}
