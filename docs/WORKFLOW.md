# Workflow d’une demande d’assistance

```
           create_service_request                respond_to_assignment(accept)
 [client] ───────────────────────► SEARCHING ─────────────────────────────► ACCEPTED
                 │  match_mechanics         ▲  expand_search (rayon ×2)        │ submit_quote
                 ▼                          │  withdraw_from_request (pro)     ▼
       propositions (assignments)           └───────────────────────────── QUOTED
       aux pros validés, disponibles,                 respond_to_quote(refus) ──┘│ respond_to_quote(accept)
       compétents, dans le rayon                                                 ▼
                                                                          QUOTE_ACCEPTED
                                                                                 │ start_route
                                                                                 ▼
                                                                             EN_ROUTE
                                                                                 │ verify_arrival_code (code client, 5 essais)
                                                                                 ▼
                                    submit_quote (supplément) ◄──────────► IN_PROGRESS
                                    respond_to_quote (client)                    │ complete_mission (aucun supplément en attente)
                                                                                 ▼
                                                                             COMPLETED
                                                    declare_payment (pro) ───────┤ confirm_payment (client) → reçu REC-AAAA-NNNNNN
                                                                                 ▼
                                                                                PAID
                                                                                 │ submit_review
                                                                                 ▼
                                                                               CLOSED

 cancel_request (client) : depuis SEARCHING … EN_ROUTE → CANCELLED
 report_problem (client/pro) : depuis EN_ROUTE, IN_PROGRESS, COMPLETED → DISPUTED (+ réclamation « litige »)
 admin_assign_mechanic / admin_set_request_status : intervention manuelle, motif obligatoire, historisée
```

## Règles clés

| Règle | Où |
|---|---|
| Consentement explicite à la localisation obligatoire | `create_service_request` |
| Une seule demande active par client | `create_service_request` |
| Seuls les pros **validés**, disponibles, non suspendus, compétents (spécialité + type de véhicule) et sans mission en cours sont sollicités, dès que la demande est dans **leur zone d’intervention** (ou dans le rayon élargi de la demande s’il est plus grand) | `match_mechanics` |
| Comme une appli de VTC, chaque pro disponible voit lui-même les demandes en recherche de sa zone : en se rendant disponible, en terminant une mission ou en agrandissant sa zone, les demandes déjà en cours apparaissent (rafraîchissement automatique + temps réel). Aucune intervention de l’administration n’est nécessaire | `offer_open_requests`, `list_open_proposals` |
| Avant acceptation, le pro ne voit qu’une position arrondie (≈ 1 km), sans coordonnées du client | `list_open_proposals` |
| Le premier pro confirmé obtient la mission ; les autres sont prévenus | `respond_to_assignment` (verrou `FOR UPDATE`) |
| Propositions limitées dans le temps (10 min par défaut) | `platform_settings.proposal_timeout_minutes` |
| Personne ne répond : le client peut élargir le rayon (5 → 10 → 20 → 30 km) pour atteindre des pros au-delà de leur zone, alerte des opérations | `expand_search` |
| Une proposition expirée est reproposée tant que la demande est en recherche ; une proposition refusée ne l’est jamais | `offer_open_requests` |
| Pas de déplacement sans devis validé | `start_route` |
| Code d’arrivée : bon professionnel / bon client | `verify_arrival_code` |
| Aucun supplément sans accord : un nouveau devis doit être accepté, la mission ne peut pas être terminée avant | `submit_quote`, `complete_mission` |
| Montant payé = dernier devis accepté ; commission selon la formule (Starter 12 %, Pro 5 %) | `declare_payment` |
| « Terminé » confirmé par le client (ou litige documenté) | `confirm_payment`, `report_problem` |
| Avis uniquement après paiement confirmé, un par intervention | `submit_review` |
| Chaque changement de statut est historisé avec son auteur et son motif | déclencheur `log_request_status` |

## Statuts affichés

| Statut | Client | Professionnel |
|---|---|---|
| `searching` | Recherche en cours | — |
| `accepted` | Mission acceptée | Envoyer le devis |
| `quoted` | Devis à valider | En attente du client |
| `quote_accepted` | Devis validé | « Je pars » |
| `en_route` | En route + code | Saisir le code |
| `in_progress` | Intervention en cours | Supplément / Terminer |
| `completed` | À confirmer | Déclarer le paiement |
| `paid` | Payée → avis | Paiement confirmé |
| `closed` | Terminée | Clôturée |
| `cancelled` / `disputed` / `expired` | Annulée / Litige / Expirée | idem |
