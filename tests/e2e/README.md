# Parcours de bout en bout (outil de test)

> **Outil de test uniquement.** `local-backend.mjs` émule le sous-ensemble des API Supabase utilisé
> par l'application (Auth + REST/RPC) au-dessus d'un PostgreSQL local où sont appliquées les **vraies**
> migrations. Chaque requête s'exécute avec le rôle `authenticated`/`anon` et les claims JWT, comme
> PostgREST : RLS et fonctions SQL sont réellement exercées. Storage et Realtime ne sont pas émulés.

```bash
# 1. PostgreSQL jetable + migrations (PG_BIN=/chemin/vers/postgresql/bin si besoin)
WORK=$(mktemp -d) ./tests/e2e/start-local.sh
# 2. Backend de test (affiche la clé ANON à utiliser)
DATABASE_URL=postgres://postgres@127.0.0.1:55433/postgres node tests/e2e/local-backend.mjs
# 3. Application pointée sur ce backend
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=<clé affichée> npx vite --port 5173
# 4. Parcours complet + captures dans docs/captures/ (Playwright requis)
DATABASE_URL=postgres://postgres@127.0.0.1:55433/postgres node tests/e2e/journey.mjs
```

Le parcours : inscription client et véhicule → inscription pro et profil → validation par l'administration →
disponibilité → SOS en 3 étapes → proposition acceptée → devis → validation → départ → code d'arrivée
(un faux code puis le bon) → fin → paiement Wave déclaré → confirmation client → avis 5/5 → reçu → tableaux de bord.
Il échoue si l'état final en base est incorrect ou si le navigateur remonte une erreur.
