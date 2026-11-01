# Architecture technique — SOS MOBILITÉ

## Vue d’ensemble

```
 Navigateur / PWA Android
 ┌──────────────────────────────────────────────────────────┐
 │ pages/ (public · auth · client · mechanic · admin)       │  interfaces
 │ components/ (ui · layout · brand · requests)             │
 │ hooks/ (auth, temps réel, requêtes)                      │
 │ services/  ──► un fichier par domaine (accès données)    │  aucune logique SQL dans les pages
 │ domain/    ──► règles métier pures, testées              │  statuts, prix, rappels, géo, validations
 └───────────────▲──────────────────────────────────────────┘
                 │ supabase-js (clé publique anon + JWT utilisateur)
 ┌───────────────┴──────────────────────────────────────────┐
 │ Supabase                                                  │
 │  Auth ── profils créés par déclencheur (handle_new_user)  │
 │  PostgREST ── lecture filtrée par RLS                     │
 │             ── écritures métier via fonctions RPC         │  security definer, vérifications de rôle/statut
 │  Storage ── photos de panne, documents pros, avatars      │  politiques par dossier <uid>/
 │  Realtime ── notifications, demandes, devis, paiements    │  respecte la RLS
 └──────────────────────────────────────────────────────────┘
```

## Principes

1. **La base est la source de vérité des règles.** Les transitions de statut, la correspondance mécanicien/demande,
   le calcul de commission et les contrôles d’accès sont dans PostgreSQL. L’interface ne fait qu’afficher et appeler.
   Un client modifié ou malveillant ne peut pas contourner une règle.
2. **Aucune écriture directe** sur les tables de workflow (`service_requests`, `assignments`, `quotes`, `payments`,
   `reviews`) : privilèges `UPDATE/INSERT` retirés, passage obligé par les RPC.
3. **Privilèges par colonne** pour les tables éditables (profil, profil pro, véhicules) : un utilisateur ne peut pas
   modifier son rôle, sa validation, sa note ou sa suspension.
4. **Pas de données simulées** : sans projet Supabase, l’application l’indique ; les intégrations non branchées
   (paiement en ligne, push, carte) sont signalées comme telles.
5. **Modules indépendants** : interfaces (`pages/`, `components/`), logique métier (`domain/`), accès aux données
   (`services/`), services externes (`services/payments`, `services/maps`, `services/notifications`), authentification
   (`hooks/useAuth`, `services/auth.service`), sécurité (`supabase/migrations/*rls*`).

## Base de données

| Table | Contenu |
|---|---|
| `profiles` | utilisateur : rôle (client / mechanic / admin), niveau admin, nom, téléphone, commune, suspension |
| `vehicles` | véhicules du client (auto, moto, marine), immatriculation, fin d’assurance |
| `maintenance_records` | carnet d’entretien (« Mon véhicule »), prochaine échéance |
| `mechanic_profiles` | profil pro : activité, véhicules pris en charge, position de base, rayon, validation, disponibilité, formule, note |
| `mechanic_specialties` | spécialités (lien vers `service_categories`) |
| `mechanic_documents` | documents justificatifs (Storage privé) |
| `service_categories` | catalogue des assistances + fourchettes indicatives |
| `service_requests` | demande : catégorie, symptômes, photos, position + consentement, statut, horodatages |
| `request_arrival_codes` | code d’arrivée à 4 chiffres — lisible par le client seul |
| `assignments` | propositions/attributions aux mécaniciens, distance, expiration |
| `quotes` | devis versionnés (main-d’œuvre, pièces, déplacement), statut |
| `status_history` | journal de chaque changement de statut (qui, quand, motif) |
| `payments` | paiement, moyen, commission, part du pro, numéro de reçu |
| `reviews` | évaluations (1 par intervention payée) |
| `notifications` | notifications in-app (temps réel) |
| `support_tickets` | réclamations et litiges |
| `platform_settings` | commissions, délais, rayons, contacts du support |

Correspondance géographique : formule de haversine (`distance_km`) ; PostGIS n’est pas nécessaire au volume pilote
et pourra être ajouté pour l’optimisation.

## Front-end

- Routage par espace avec chargement différé (`src/app/router.tsx`), gardes de rôle (`RequireRole`).
- Données : TanStack Query ; invalidation par Supabase Realtime (`useRealtimeInvalidate`) + rafraîchissement périodique de secours.
- Mobile d’abord : barre d’onglets en bas (comme les maquettes), navigation latérale sur ordinateur.
- Erreurs SQL traduites en français (`lib/errors.ts`) à partir du `hint` des exceptions.
- PWA : manifeste, icônes, service worker (aucune mise en cache des appels API).

## Évolutivité

- Nouvelles villes : rien à coder (positions et rayons) ; filtrage par commune possible.
- Application native Android/iOS : même code via Capacitor ou réécriture React Native en réutilisant `domain/` et `services/`.
- Paiements, push, cartes : interfaces prêtes, à implémenter côté Edge Functions (secrets côté serveur).
- Types Supabase générables : `npx supabase gen types typescript --project-id <id> > src/types/supabase.ts`.
