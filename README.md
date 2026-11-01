# SOS MOBILITÉ

> **Votre tranquillité, notre engagement.**
> Tous vos moyens de transport motorisés, une seule plateforme — Abidjan, Côte d’Ivoire.

Plateforme qui met en relation les automobilistes, motards et plaisanciers en panne avec des mécaniciens,
garages et dépanneurs **vérifiés** et disponibles à proximité : un bouton SOS, un devis clair à valider,
un suivi jusqu’à la résolution, un reçu et une évaluation.

Trois espaces dans une seule application web progressive (PWA installable sur Android) :

| Espace | Rôle | Fonctions principales |
|---|---|---|
| **Client** `/client` | automobilistes, motards, VTC, livreurs | SOS en 3 étapes, suivi temps réel, devis à valider, code d’arrivée, confirmation du paiement, reçu, avis, historique, **Mon véhicule** (carnet d’entretien + rappels d’assurance), mécanos proches, support |
| **Professionnel** `/pro` | mécaniciens, garages, dépanneurs | profil pro, spécialités, zone et rayon, documents justificatifs, disponibilité, propositions de missions, devis et suppléments, code d’arrivée, déclaration du paiement, gains, avis |
| **Administration** `/admin` | équipe SOS MOBILITÉ (3 niveaux) | statistiques, validation des pros, attribution manuelle, intervention sur les statuts, clients, paiements, réclamations, évaluations, tarifs et paramètres, équipe |

Les pages publiques (`/`, `/services`, `/connexion`, `/inscription`, `/inscription/professionnel`) présentent le service.

---

## 1. Technologies

- **React 18 + TypeScript + Vite**, **Tailwind CSS** (charte graphique dans `tailwind.config.ts`)
- **Supabase** : PostgreSQL, Auth, Storage, Realtime (aucune dépendance propriétaire hors Supabase, qui est open source et auto-hébergeable)
- **TanStack Query** (cache et synchronisation), **React Hook Form + Zod** (formulaires), **lucide-react** (icônes)
- **vite-plugin-pwa** (installation Android, fonctionnement hors ligne de l’interface)
- Polices **Montserrat** (titres) et **Inter** (textes), embarquées

## 2. Installation (poste de développement)

Prérequis : Node.js 20+ et un projet Supabase (gratuit pour démarrer).

```bash
npm install
cp .env.example .env.local      # puis renseigner l'URL et la clé « anon » du projet Supabase
npm run dev                     # http://localhost:5173
```

### Créer la base de données

1. Créer un projet sur https://supabase.com (région la plus proche : Europe de l’Ouest).
2. **SQL Editor** → exécuter, **dans l’ordre**, les fichiers de `supabase/migrations/` :
   `…01_schema.sql`, `…02_helpers_triggers.sql`, `…03_workflow.sql`, `…04_rls.sql`, `…05_storage_realtime.sql`, `…06_reference_data.sql`.
   (Ou avec la CLI : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.)
3. **Authentication → URL Configuration** : *Site URL* = l’adresse publique de l’application ; ajouter `…/connexion` et `…/nouveau-mot-de-passe` aux *Redirect URLs*.
4. **Settings → API** : copier `Project URL` et la clé `anon public` dans `.env.local`.
5. Créer votre compte depuis l’application (`/inscription`), puis vous promouvoir **super administrateur** dans le SQL Editor :

   ```sql
   update public.profiles
      set role = 'admin', admin_level = 'super_admin'
    where email = 'votre-adresse@exemple.com';
   ```

6. Depuis `/admin/parametres`, renseigner le numéro du support (téléphone, WhatsApp, e-mail) et, quand ils sont connus, les tarifs indicatifs.

> ⚠️ N’utilisez **jamais** la clé `service_role` dans l’application : toute variable `VITE_*` est visible dans le navigateur.

### Variables d’environnement

| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | clé publique « anon » |
| `VITE_ENABLE_PHONE_AUTH` | `true` pour la connexion par SMS, **après** configuration d’un fournisseur SMS dans Supabase |
| `VITE_APP_URL` | adresse publique (liens des e-mails) |

Sans base configurée, l’application affiche un écran « Base de données non connectée » : **aucune donnée fictive n’est simulée**.

## 3. Déploiement

L’application est un site statique (`npm run build` → dossier `dist/`). Hébergements possibles : Vercel, Netlify, Cloudflare Pages, ou tout serveur web.
Configurer la réécriture de toutes les routes vers `index.html` (application monopage) et déclarer les variables `VITE_*` dans l’hébergeur.

- **Vercel / Netlify** : commande `npm run build`, dossier `dist`.
- **Nom de domaine**

### Production actuelle

| Élément | Valeur |
|---|---|
| Site | https://sos-mobilite.netlify.app (projet Netlify `sos-mobilite`) |
| Base | Supabase `amopbblmejoabauqkiul` (organisation « SOS », région eu-west-3 Paris), 6 migrations appliquées |
| Configuration | `netlify.toml` (variables publiques, réécriture SPA, en-têtes de sécurité, cache) et `public/_redirects` |

Réglages à faire une fois dans les tableaux de bord :

1. **Supabase → Authentication → URL Configuration** : *Site URL* = `https://sos-mobilite.netlify.app` ;
   *Redirect URLs* = `https://sos-mobilite.netlify.app/**` (liens de confirmation et de réinitialisation).
2. **Netlify → Project configuration → Access & security → Visitor access** : désactiver la protection
   « Netlify team login » pour que le public puisse ouvrir le site.
3. **Premier super administrateur** : créer son compte sur le site, puis dans l’éditeur SQL Supabase
   `update public.profiles set role = 'admin', admin_level = 'super_admin' where email = '…';`
4. **E-mails** : le service d’envoi intégré de Supabase est limité à quelques messages par heure ; brancher un SMTP
   (Authentication → Emails → SMTP) avant l’ouverture au public.
- **Nom de domaine personnalisé** : prévoir HTTPS (obligatoire pour la géolocalisation et l’installation PWA).
- **Android** : depuis Chrome, menu → « Installer l’application ». Une application native (Play Store) pourra ensuite être produite à partir du même code (Capacitor) — étape 5 de la feuille de route.

## 4. Tests

```bash
npm test          # tests unitaires et d'interface (Vitest) — règles métier, rappels, validations, composants
npm run test:db   # migrations + 74 contrôles SQL de bout en bout sur un PostgreSQL local jetable
npm run build     # vérification TypeScript + build de production
```

`npm run test:db` exécute le workflow complet (demande → correspondance → acceptation → devis → déplacement → code d’arrivée →
supplément → fin → paiement → reçu → avis) et vérifie les règles de sécurité (isolation des clients, mécanicien non validé
jamais sollicité, aucune écriture directe, niveaux administrateur, stockage…). Prérequis : binaires PostgreSQL 15+.

Un parcours navigateur complet est également fourni (`tests/e2e/`, voir `tests/e2e/README.md`) : il pilote l’application réelle
avec Playwright contre les vraies migrations et produit les captures de `docs/captures/`.

## 5. Organisation du code

```
supabase/
  migrations/        schéma, déclencheurs, workflow (RPC), RLS, stockage, données de référence
  tests/             tests SQL de bout en bout + bouchon Supabase pour PostgreSQL vierge
src/
  config/            variables d'environnement, identité de marque
  domain/            logique métier pure et testée : statuts, catalogue, prix/commission, rappels, géo, validations
  services/          accès aux données (Supabase) — un fichier par domaine ; paiements, cartes, push : points d'intégration
  hooks/             authentification, temps réel, requêtes partagées
  components/        UI (boutons, champs, cartes, modales…), mise en page, marque, éléments de suivi
  pages/             public/, auth/, client/, mechanic/, admin/, shared/
  types/             types des tables
tests/               tests Vitest, parcours e2e
docs/                architecture, workflow, sécurité, feuille de route, cahier des charges, captures
```

Documentation technique détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/WORKFLOW.md`](docs/WORKFLOW.md),
[`docs/SECURITE.md`](docs/SECURITE.md), [`docs/FEUILLE_DE_ROUTE.md`](docs/FEUILLE_DE_ROUTE.md).

## 6. Logo officiel

Déposer le logo dans `public/brand/` (voir `public/brand/README.md`) :
`logo-sos-mobilite.png` (affiché partout à la place du logotype temporaire) et `logo-icon.png` (icône carrée), puis `npm run icons`
pour régénérer les icônes de l’application installée.

## 7. Ce qui n’est volontairement pas simulé

| Élément | État | Branchement prévu |
|---|---|---|
| Paiement en ligne (Orange Money, MTN MoMo, Wave, carte) | non connecté — paiement direct au pro, déclaré puis confirmé dans l’app | `src/services/payments/providers.ts` + Edge Function + webhook du prestataire |
| Notifications push | non connectées — notifications in-app en temps réel | `src/services/notifications/push.ts` |
| Carte interactive Google Maps | liens « Itinéraire » vers Maps (sans clé) | `src/services/maps/maps.ts` |
| SMS / OTP | désactivé par défaut | fournisseur SMS Supabase + `VITE_ENABLE_PHONE_AUTH=true` |
| Assurance (Premium Moto) | non intégrée — exige un assureur agréé (Code CIMA) | voir feuille de route |

Les textes juridiques (CGU, confidentialité, mentions des reçus) sont des **documents de travail** à faire valider en Côte d’Ivoire.
