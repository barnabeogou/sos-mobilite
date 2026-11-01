-- =============================================================================
-- SOS MOBILITÉ — Paiements en ligne (1/2) : nouvelles valeurs d'énumérations.
-- Fichier séparé : une valeur ajoutée à un type énuméré n'est utilisable
-- qu'après la validation de la transaction qui l'a créée.
-- =============================================================================
alter type public.payment_status add value if not exists 'pending' before 'declared';
alter type public.payment_status add value if not exists 'failed';
alter type public.payment_method add value if not exists 'moov_money' after 'mtn_momo';
