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

Paiement dans l'application (`ONLINE=1`) — en plus des étapes ci-dessus :

```bash
# faux CinetPay (guichet, notification signée, contrôle, API de transfert) sur le port 4340
node tests/e2e/mock-cinetpay.mjs
# backend de test relayant /functions/v1/* vers l'Edge Function locale
DATABASE_URL=postgres://postgres@127.0.0.1:55433/postgres FUNCTIONS_TARGET=http://127.0.0.1:8000 node tests/e2e/local-backend.mjs
# Edge Function « payments » (clés ANON et SERVICE affichées par le backend de test)
cd supabase/functions/payments && NO_PROXY=127.0.0.1,localhost SUPABASE_URL=http://127.0.0.1:54321 \
  SUPABASE_ANON_KEY=<ANON> SUPABASE_SERVICE_ROLE_KEY=<SERVICE> \
  CINETPAY_API_KEY=mock-api-key CINETPAY_SITE_ID=105000 CINETPAY_SECRET_KEY=mock-secret CINETPAY_TRANSFER_PASSWORD=mock-transfer-password \
  CINETPAY_CHECKOUT_URL=http://127.0.0.1:4340 CINETPAY_TRANSFER_URL=http://127.0.0.1:4340 \
  APP_URL=http://localhost:5173 PUBLIC_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1 \
  deno run --allow-net --allow-env --allow-read index.ts
# parcours
ONLINE=1 DATABASE_URL=postgres://postgres@127.0.0.1:55433/postgres node tests/e2e/journey.mjs
```

Le parcours : inscription client et véhicule → inscription pro et profil → validation par l'administration →
disponibilité → SOS en 3 étapes → proposition acceptée → devis → validation → départ → code d'arrivée
(un faux code puis le bon) → fin → paiement Wave déclaré → confirmation client → avis 5/5 → reçu → tableaux de bord.
Avec `ONLINE=1` : fin → « Payer 48 000 FCFA » → guichet de test → notification signée et contrôle → retour dans l'app →
versement en attente (pas de compte) → le pro renseigne son numéro → versement envoyé (42 240 FCFA) → administration.
Il échoue si l'état final en base est incorrect ou si le navigateur remonte une erreur.
