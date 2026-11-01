# Sécurité et protection des données

## Contrôle d’accès (Row Level Security)

| Donnée | Client | Professionnel | Administration |
|---|---|---|---|
| Son profil | lecture / modification (nom, téléphone, commune, photo) | idem | toutes (support+) |
| Profil de l’autre partie | uniquement s’il existe une mission commune | idem | toutes |
| Véhicules, entretiens | les siens | véhicule de sa mission | lecture (support+) |
| Demandes | les siennes | celles qui lui sont attribuées | toutes |
| Propositions avant acceptation | nombre et statut | les siennes, position ≈ 1 km | toutes |
| Code d’arrivée | le sien | **jamais** (vérification côté serveur) | non |
| Devis, paiements, avis, historique | de ses demandes | de ses missions | toutes |
| Négociation du prix (contre-propositions) | celles de ses demandes | celles de ses missions | toutes (support+) |
| Documents justificatifs | — | les siens | opérations+ |
| Photos de panne | les siennes | mission attribuée ou proposée | support+ |
| Catalogue, paramètres | lecture | lecture | écriture super_admin |

Niveaux administrateur : **support** (réclamations, consultation, statistiques) < **opérations** (validation des pros,
attribution manuelle, statuts, suspensions, paiements, avis) < **super_admin** (tarifs, paramètres, équipe).
Le rôle administrateur ne peut jamais être obtenu à l’inscription.

## Protections

- Aucune écriture directe sur les tables de workflow ; fonctions `security definer` avec `search_path` fixé.
- Privilèges par colonne : impossible de modifier son rôle, sa validation, sa note, sa formule, sa suspension.
- Vérification de propriété des fichiers (chemins `<uid>/…`) côté base et côté stockage.
- Code d’arrivée : 5 tentatives maximum, alerte du support au blocage.
- Suspension : désactive la disponibilité, annule les propositions ouvertes, bloque toutes les actions.
- Clés secrètes : jamais dans le navigateur. Seule la clé publique `anon` est utilisée côté client.
- Traçabilité : historique des statuts (auteur, date, motif), devis versionnés, reçus numérotés uniques.

## Données personnelles

- Localisation demandée au moment de la demande, avec explication et consentement horodaté (`location_consent_at`).
- Position précise et téléphone visibles uniquement par le professionnel attribué.
- Le SOS ne remplace pas les services d’urgence (Police 170 / 110 / 111, Pompiers 180, SAMU 185) : rappel affiché.
- À faire avant ouverture : politique de confidentialité et CGU validées localement, durées de conservation,
  procédure de suppression de compte, déclaration auprès de l’autorité de protection des données (ARTCI).

## Tests

`npm run test:db` vérifie automatiquement 98 points, dont : isolation des clients, absence d’auto-validation,
mécanicien non validé jamais sollicité, position arrondie, code d’arrivée inaccessible au pro, refus des écritures
directes, niveaux administrateur, dépôts de fichiers hors de son dossier refusés, RPC fermées aux anonymes.
