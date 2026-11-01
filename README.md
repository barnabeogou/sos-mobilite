# SOS MOBILITÉ

> **Votre tranquillité, notre engagement.**
> Tous vos moyens de transport motorisés, une seule plateforme — Abidjan, Côte d’Ivoire.

Plateforme qui met en relation les automobilistes, motards et plaisanciers en panne avec des mécaniciens,
garages et dépanneurs **vérifiés** et disponibles à proximité : un bouton SOS, un devis clair à valider,
un suivi jusqu’à la résolution, un reçu et une évaluation.

Trois espaces dans une seule application web progressive (PWA installable sur Android) :

| Espace | Rôle | Fonctions principales |
|---|---|---|
| **Client** `/client` | automobilistes, motards, VTC, livreurs | SOS en 3 étapes, suivi temps réel, devis à valider ou à négocier, code d’arrivée, paiement dans l’application (ou confirmation d’un paiement direct), reçu, avis, historique, **Mon véhicule** (carnet d’entretien + rappels d’assurance), mécanos proches, support |
| **Professionnel** `/pro` | mécaniciens, garages, dépanneurs | profil pro, spécialités, zone et rayon, documents justificatifs, disponibilité, propositions de missions, devis et suppléments, code d’arrivée, versement automatique de sa part (ou déclaration d’un paiement direct), gains et versements, avis |
| **Administration** `/admin` | équipe SOS MOBILITÉ (3 niveaux) | statistiques, validation des pros, attribution manuelle, intervention sur les statuts, clients, paiements et versements, réclamations, évaluations, tarifs et paramètres, équipe |

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
| Base | Supabase `amopbblmejoabauqkiul` (organisation « SOS », région eu-west-3 Paris), toutes les migrations de `supabase/migrations/` appliquées |
| Edge Function | `payments` (paiement en ligne et versements), déployée sans vérification JWT automatique : chaque route contrôle l’appelant |
| Configuration | `netlify.toml` (variables publiques, réécriture SPA, en-têtes de sécurité, cache) et `public/_redirects` |
| Code source | https://github.com/barnabeogou/sos-mobilite (branche `main`) |
| Mise en ligne | automatique : chaque envoi sur `main` est construit (`npm run build`) et publié par Netlify |

Réglages à faire une fois dans les tableaux de bord :

1. **Supabase → Authentication → URL Configuration** : *Site URL* = `https://sos-mobilite.netlify.app` ;
   *Redirect URLs* = `https://sos-mobilite.netlify.app/**` (liens de confirmation et de réinitialisation).
2. **Netlify → Project configuration → Access & security → Visitor access** : désactiver la protection
   « Netlify team login » pour que le public puisse ouvrir le site.
3. **Premier super administrateur** : créer son compte sur le site, puis dans l’éditeur SQL Supabase
   `update public.profiles set role = 'admin', admin_level = 'super_admin' where email = '…';`
4. **E-mails** : le service d’envoi intégré de Supabase est limité à 2 messages par heure pour tout le projet.
   *État au 1er novembre 2026* : la confirmation d’adresse à l’inscription est **désactivée**
   (Authentication → Sign In / Providers → Confirm email) pour que les inscriptions ne soient plus bloquées.
   À faire : brancher Gmail en SMTP (Authentication → Emails → SMTP : `smtp.gmail.com`, port 465, mot de passe
   d’application Google), relever la limite (Authentication → Rate Limits), puis réactiver la confirmation.
- **Nom de domaine personnalisé** : prévoir HTTPS (obligatoire pour la géolocalisation et l’installation PWA).
- **Android** : depuis Chrome, menu → « Installer l’application ». Une application native (Play Store) pourra ensuite être produite à partir du même code (Capacitor) — étape 5 de la feuille de route.

### Activer le paiement dans l’application (CinetPay)

Tout est en place (tables, règles, Edge Function `payments`, écrans). Il reste à brancher le compte marchand :

1. Ouvrir un compte marchand sur cinetpay.com (pièces de l’entreprise), puis dans le tableau de bord récupérer
   l’**APIKEY**, le **site_id**, la **clé secrète** (menu Intégrations) et le **mot de passe de l’API de transfert**.
2. **Supabase → Edge Functions → Secrets** : ajouter `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`
   et `CINETPAY_TRANSFER_PASSWORD`. Ces clés restent côté serveur : ne jamais les mettre dans le site ni dans `netlify.toml`.
3. **Administration → Tarifs & paramètres** : passer `online_payment_provider` à `"cinetpay"`.
   La carte « Paiement dans l’application » de la page Paiements doit alors afficher 4 coches vertes.
4. Faire un paiement réel de faible montant (par ex. 100 FCFA) de bout en bout, puis vérifier le versement.

Fonctionnement : le client paie sur la page sécurisée CinetPay ; la notification est signée (x-token) et le statut est
**toujours recontrôlé** auprès de CinetPay avant validation. La part du pro (montant − commission, arrondie au multiple
de 5 FCFA inférieur) lui est envoyée sur son numéro Mobile Money, déduction faite des commissions dues sur ses paiements
en espèces. Sans mot de passe de transfert, ou si CinetPay exige la validation des transferts par e-mail (sauf IP
déclarée), les versements restent « À verser » et se font depuis le compte CinetPay, puis sont marqués « Versé » dans
l’administration. Paiement en double, montant différent ou référence inconnue : l’équipe opérations est alertée.

## 4. Tests

```bash
npm test          # tests unitaires et d'interface (Vitest) — règles métier, rappels, validations, composants
npm run test:db   # migrations + 137 contrôles SQL de bout en bout sur un PostgreSQL local jetable
npm run build     # vérification TypeScript + build de production
```

`npm run test:db` exécute le workflow complet (demande → correspondance → acceptation → devis → déplacement → code d’arrivée →
supplément → négociation → fin → paiement direct ou en ligne → versement → reçu → avis) et vérifie les règles de sécurité (isolation des clients, mécanicien non validé
jamais sollicité, aucune écriture directe, niveaux administrateur, stockage…). Prérequis : binaires PostgreSQL 15+.

Un parcours navigateur complet est également fourni (`tests/e2e/`, voir `tests/e2e/README.md`) : il pilote l’application réelle
avec Playwright contre les vraies migrations et produit les captures de `docs/captures/`. Avec `ONLINE=1`, il passe par l’Edge
Function `payments` (lancée avec Deno) et un faux CinetPay : paiement au guichet, notification signée, retour, versement au pro.

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

## 6. Couverture nationale et identité visuelle

- **Toute la Côte d’Ivoire** : la ville se choisit à l’inscription et dans le profil (`src/domain/cities.ts` :
  35 villes ; à Abidjan, la commune se choisit dans la liste officielle). La correspondance client ↔ professionnel
  reste calculée sur les positions GPS, partout dans le pays.
- **Une ville par rubrique** : chaque écran de l’application affiche une grande ville de nuit avec son monument
  (Abidjan, Yamoussoukro, Bouaké, San-Pédro, Korhogo, Daloa, Man, Gagnoa, Bondoukou, Sassandra) et son nom en
  filigrane ; l’accueil montre la ville de l’utilisateur. Les illustrations sont dessinées en code
  (`src/components/cities/`), légères et animées (étoiles, lumières, reflets, phare…).
- **Photos HD** : pour remplacer un dessin par une photo, déposer le fichier dans `public/cities/` (ex.
  `public/cities/abidjan.webp`, 1600 px de large au moins, droits d’utilisation acquis) et le déclarer dans
  `CITY_PHOTOS` (`src/components/cities/CityScene.tsx`).
- **Intro de lancement** : la carte du pays se dessine et l’alerte gagne les grandes villes (une fois par session ;
  version courte pour une personne connectée ou l’application installée ; jamais sur un lien direct, ni si
  « réduire les animations » est activé ; `?sans-intro` pour la désactiver).

## 7. Logo officiel

Déposer le logo dans `public/brand/` (voir `public/brand/README.md`) :
`logo-sos-mobilite.png` (affiché partout à la place du logotype temporaire) et `logo-icon.png` (icône carrée), puis `npm run icons`
pour régénérer les icônes de l’application installée.

## 8. Ce qui n’est volontairement pas simulé

| Élément | État | Branchement prévu |
|---|---|---|
| Paiement en ligne (Orange Money, MTN MoMo, Moov, Wave, carte) | **prêt, inactif** tant que les clés CinetPay ne sont pas saisies — d’ici là, paiement direct déclaré puis confirmé | voir « Activer le paiement dans l’application » ci-dessus |
| Notifications push | non connectées — notifications in-app en temps réel | `src/services/notifications/push.ts` |
| Carte interactive Google Maps | liens « Itinéraire » vers Maps (sans clé) | `src/services/maps/maps.ts` |
| SMS / OTP | désactivé par défaut | fournisseur SMS Supabase + `VITE_ENABLE_PHONE_AUTH=true` |
| Assurance (Premium Moto) | non intégrée — exige un assureur agréé (Code CIMA) | voir feuille de route |

Les textes juridiques (CGU, confidentialité, mentions des reçus) sont des **documents de travail** à faire valider en Côte d’Ivoire.
