# Feuille de route

Stratégie du cahier des charges : développer progressivement, MVP fonctionnalité par fonctionnalité.

## ✅ Livré dans cette version (étapes 1 à 3 + éléments de 4 et 5)

**Étape 1 — Structure et identité** : architecture modulaire, charte (bleu nuit, bleu électrique, rouge sécurité,
Montserrat/Inter), navigation, écrans principaux, responsive mobile.

**Étape 2 — Supabase** : schéma complet, authentification (e-mail ; SMS activable), profils, RLS, stockage.

**Étape 3 — Cœur du service** : demandes d’assistance (SOS en 3 étapes, photos, symptômes), correspondance
automatique, espace mécanicien (validation, disponibilité, propositions, devis, code d’arrivée, paiement), administration
(statistiques, validation, attribution manuelle, statuts, paiements, réclamations, avis, tarifs, équipe).

**Étape 4 (partiel)** : géolocalisation du navigateur, notifications in-app temps réel, paiement direct tracé
(déclaré / confirmé, commission, reçu), tests de sécurité automatisés.

**Étape 5 (partiel)** : PWA installable.

**Idées d’amélioration intégrées** : « Mon véhicule » (carnet d’entretien, rappel de vidange, alerte de fin
d’assurance). Partage de l’intervention avec un proche. Formules Garage Starter / Pro (commission paramétrable).

## ⏭️ Prochaines étapes

| Priorité | Élément | Prérequis |
|---|---|---|
| 1 | Logo officiel en fichiers (`public/brand/`) | fichier PNG du logo |
| 1 | Projet Supabase de production + domaine HTTPS | compte Supabase, nom de domaine |
| 1 | CGU, confidentialité, mentions des reçus | validation juridique / comptable locale |
| 2 | Notifications push (Web Push / FCM) et SMS de secours | clés VAPID, fournisseur SMS |
| 2 | Carte interactive et suivi GPS du pro en route | clé Google Maps restreinte |
| 2 | Paiement Mobile Money / carte (Orange Money, MTN, Wave) | contrats prestataires, Edge Functions, webhooks |
| 2 | Facturation des abonnements Garage Pro | moyen de paiement récurrent validé |
| 3 | « Mon assurance » : catalogue d’assureurs partenaires et souscription | partenariat avec un assureur agréé (Code CIMA) |
| 3 | GARAGE EN LIGNE PREMIUM MOTO (abonnement livreurs) | pilote d’assistance, puis assureur |
| 3 | Contrats flottes (taxis, VTC, livraison) | — |
| 3 | Application Android native (Play Store) | Capacitor, compte développeur |
| 3 | PostGIS, optimisation, tableaux de bord avancés | volume réel |

## Indicateurs de pilotage (affichés dans l’administration)

Professionnels vérifiés (cible 40–60), demandes acceptées (≥ 80 %), délai médian d’acceptation (≤ 5 min),
interventions terminées, note moyenne (≥ 4,5/5), volume et commissions confirmés, réclamations ouvertes.
