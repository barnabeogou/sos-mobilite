-- =============================================================================
-- Tests de bout en bout du workflow et des règles de sécurité (RLS)
-- Exécution : ./supabase/tests/run_local.sh  (PostgreSQL 15+ vierge)
-- =============================================================================
\set ON_ERROR_STOP 1
\pset footer off
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Outils de test
-- ---------------------------------------------------------------------------
create schema tst;
grant usage on schema tst to authenticated, anon;

create function tst.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;

create function tst.ok(p_cond boolean, p_msg text) returns text language plpgsql as $$
begin
  if p_cond is not true then raise exception 'ÉCHEC : %', p_msg; end if;
  return 'OK  ' || p_msg;
end $$;

-- Exécute p_sql et vérifie qu'une erreur contenant p_expected est levée.
create function tst.fails(p_sql text, p_expected text, p_msg text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) > 0 then
      return 'OK  ' || p_msg || '  [' || sqlerrm || ']';
    end if;
    raise exception 'ÉCHEC : % — erreur inattendue : %', p_msg, sqlerrm;
  end;
  raise exception 'ÉCHEC : % — aucune erreur levée', p_msg;
end $$;

grant execute on all functions in schema tst to authenticated, anon;
create table tst.ctx (k text primary key, v text);
grant all on tst.ctx to authenticated;

-- ---------------------------------------------------------------------------
-- Comptes de test (inscription → profils créés par déclencheur)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'client1@test.local', '{"full_name":"Client Un","phone":"+225 07 00 00 00 01"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'client2@test.local', '{"full_name":"Client Deux","role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'meca1@test.local',   '{"full_name":"Méca Un","role":"mechanic","business_name":"Garage Un"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'meca2@test.local',   '{"full_name":"Méca Deux","role":"mechanic"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'meca3@test.local',   '{"full_name":"Méca Trois","role":"mechanic"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'super@test.local',   '{"full_name":"Super Admin"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'support@test.local', '{"full_name":"Agent Support"}');

-- Promotion des administrateurs (opération réservée au propriétaire de la base / SQL editor)
update public.profiles set role = 'admin', admin_level = 'super_admin' where email = 'super@test.local';
update public.profiles set role = 'admin', admin_level = 'support' where email = 'support@test.local';

select tst.ok((select role from public.profiles where email = 'client2@test.local') = 'client',
              'le rôle admin ne peut pas être obtenu à l''inscription');
select tst.ok((select count(*) from public.mechanic_profiles) = 3, 'profil pro créé pour chaque mécanicien');
select tst.ok((select business_name from public.mechanic_profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'Garage Un',
              'raison sociale reprise de l''inscription');

-- ---------------------------------------------------------------------------
-- Espace mécanicien : configuration, validation obligatoire
-- ---------------------------------------------------------------------------
set role authenticated;

select tst.login('00000000-0000-0000-0000-0000000000a1');
update public.mechanic_profiles set base_lat = 5.3197, base_lng = -4.0167, service_radius_km = 10,
       vehicle_types = array['auto','moto']::public.vehicle_type[], commune = 'Plateau'
 where id = auth.uid();
select public.set_my_specialties(array(select id from public.service_categories where slug in ('batterie','depannage_mecanique')));
select tst.fails($$ select public.set_my_availability(true) $$, 'MECHANIC_NOT_APPROVED',
                 'un mécanicien non validé ne peut pas se rendre disponible');
select tst.fails($$ update public.mechanic_profiles set verification_status = 'approved' where id = auth.uid() $$,
                 'permission denied', 'un mécanicien ne peut pas s''auto-valider');
select tst.fails($$ update public.mechanic_profiles set rating_avg = 5 where id = auth.uid() $$,
                 'permission denied', 'un mécanicien ne peut pas modifier sa note');

select tst.login('00000000-0000-0000-0000-0000000000a2');
update public.mechanic_profiles set base_lat = 5.3450, base_lng = -4.0050, service_radius_km = 15 where id = auth.uid();
select public.set_my_specialties(array(select id from public.service_categories where slug = 'batterie'));

select tst.login('00000000-0000-0000-0000-0000000000a3');
update public.mechanic_profiles set base_lat = 5.3250, base_lng = -4.0200 where id = auth.uid();
select public.set_my_specialties(array(select id from public.service_categories where slug = 'batterie'));

-- Validation : l'agent support (niveau insuffisant) échoue, le super admin réussit
select tst.login('00000000-0000-0000-0000-0000000000d2');
select tst.fails($$ select public.admin_verify_mechanic('00000000-0000-0000-0000-0000000000a1', 'approved') $$,
                 'FORBIDDEN_ADMIN', 'le niveau support ne peut pas valider un professionnel');
select tst.login('00000000-0000-0000-0000-0000000000d1');
select public.admin_verify_mechanic('00000000-0000-0000-0000-0000000000a1', 'approved');
select public.admin_verify_mechanic('00000000-0000-0000-0000-0000000000a2', 'approved');
select tst.fails($$ select public.admin_verify_mechanic('00000000-0000-0000-0000-0000000000a3', 'rejected') $$,
                 'REASON_REQUIRED', 'un refus exige un motif');

select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((public.set_my_availability(true)).is_available, 'mécanicien validé disponible');
select tst.login('00000000-0000-0000-0000-0000000000a2');
select public.set_my_availability(true);

-- ---------------------------------------------------------------------------
-- Client : profil, véhicule, règles d'écriture
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000c1');
select tst.fails($$ update public.profiles set role = 'admin' where id = auth.uid() $$, 'permission denied',
                 'un client ne peut pas changer son rôle');
update public.profiles set commune = 'Plateau' where id = auth.uid();
select tst.ok((select commune from public.profiles where id = auth.uid()) = 'Plateau', 'mise à jour du profil autorisée');

insert into public.vehicles (owner_id, type, brand, model, year, plate, insurance_expires_at)
values (auth.uid(), 'auto', 'Toyota', 'Corolla', 2016, '1234 AB 01', current_date + 10);
insert into tst.ctx values ('vehicle1', (select id::text from public.vehicles where owner_id = auth.uid()));
insert into public.maintenance_records (vehicle_id, owner_id, kind, performed_at, next_due_at)
values ((select v::uuid from tst.ctx where k = 'vehicle1'), auth.uid(), 'vidange', current_date - 80, current_date + 10);

select tst.fails($$ insert into public.vehicles (owner_id, brand, model) values ('00000000-0000-0000-0000-0000000000c2', 'X', 'Y') $$,
                 'row-level security', 'impossible de créer un véhicule pour un autre utilisateur');
select tst.fails($$ insert into public.service_requests (reference, client_id, category_id, lat, lng, location_consent_at)
                    values ('X', auth.uid(), (select id from public.service_categories limit 1), 5, -4, now()) $$,
                 'permission denied', 'aucune écriture directe dans service_requests');

-- ---------------------------------------------------------------------------
-- 1-4. Demande, consentement, correspondance
-- ---------------------------------------------------------------------------
select tst.fails($$ select public.create_service_request((select id from public.service_categories where slug = 'batterie'),
                                                         5.3250, -4.0200, false) $$,
                 'LOCATION_CONSENT_REQUIRED', 'consentement de localisation obligatoire');
select tst.fails($$ select public.create_service_request((select id from public.service_categories where slug = 'batterie'),
                                                         5.3250, -4.0200, true, null, 'auto', '{}', null,
                                                         array['00000000-0000-0000-0000-0000000000c2/x.jpg']) $$,
                 'INVALID_PHOTO_PATH', 'photo d''un autre utilisateur refusée');

insert into tst.ctx
select 'req1', (public.create_service_request(
          (select id from public.service_categories where slug = 'batterie'),
          5.3250, -4.0200, true,
          (select v::uuid from tst.ctx where k = 'vehicle1'), 'auto',
          array['ne_demarre_pas'], 'La voiture ne démarre plus devant la pharmacie.',
          array['00000000-0000-0000-0000-0000000000c1/panne.jpg'], 15, 'Près de la pharmacie du Plateau')).id::text;

select tst.ok((select status from public.service_requests where id = (select v::uuid from tst.ctx where k='req1')) = 'searching',
              'demande créée en recherche');
select tst.ok((select reference ~ '^SOS-[0-9]{6}-[0-9]{5}$' from public.service_requests
                where id = (select v::uuid from tst.ctx where k='req1')), 'référence lisible générée');
select tst.fails($$ select public.create_service_request((select id from public.service_categories where slug = 'batterie'),
                                                         5.3250, -4.0200, true) $$,
                 'ACTIVE_REQUEST_EXISTS', 'une seule demande active à la fois');

reset role;
select tst.ok((select count(*) from public.assignments where request_id = (select v::uuid from tst.ctx where k='req1')
                 and status = 'proposed') = 2, 'deux mécaniciens validés, disponibles et compatibles sollicités');
select tst.ok(not exists (select 1 from public.assignments where mechanic_id = '00000000-0000-0000-0000-0000000000a3'),
              'mécanicien non validé jamais sollicité');
select tst.ok((select count(*) from public.notifications where type = 'mission_proposed') = 2, 'notifications envoyées');
set role authenticated;

-- Isolation client
select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.ok((select count(*) from public.service_requests) = 0, 'un client ne voit pas les demandes des autres');
select tst.ok((select count(*) from public.vehicles) = 0, 'un client ne voit pas les véhicules des autres');
select tst.ok((select count(*) from public.profiles) = 1, 'un client ne voit que son propre profil');
select tst.fails(format($$ insert into public.support_tickets (created_by, request_id, subject, message)
                           values (auth.uid(), %L, 'Test', 'Message de test') $$, (select v from tst.ctx where k='req1')),
                 'row-level security', 'réclamation impossible sur la demande d''un autre');

-- Vue mécanicien avant acceptation : position approximative uniquement
select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((select count(*) from public.service_requests) = 0, 'le mécanicien ne lit pas la demande avant acceptation');
select tst.ok((select count(*) from public.list_open_proposals()) = 1, 'la proposition apparaît dans l''espace pro');
select tst.ok((select approx_lat = 5.33 and approx_lng = -4.02 from public.list_open_proposals()),
              'position arrondie (≈ 1 km) avant acceptation');
select tst.fails($$ select * from public.request_arrival_codes $$, 'permission denied', 'code d''arrivée inaccessible');

-- ---------------------------------------------------------------------------
-- 5. Acceptation : le premier confirmé obtient la mission
-- ---------------------------------------------------------------------------
select public.respond_to_assignment((select assignment_id from public.list_open_proposals()), true);
select tst.ok((select status from public.service_requests) = 'accepted', 'mission acceptée et visible du mécanicien');
select tst.fails($$ select public.get_arrival_code((select id from public.service_requests)) $$, 'FORBIDDEN_ROLE',
                 'le mécanicien ne peut pas lire le code d''arrivée');

select tst.login('00000000-0000-0000-0000-0000000000a2');
select tst.ok((select count(*) from public.list_open_proposals()) = 0, 'la proposition disparaît pour les autres');
select tst.fails(format($$ select public.respond_to_assignment(%L, true) $$,
                        (select id from public.assignments where mechanic_id = auth.uid() limit 1)),
                 'PROPOSAL_CLOSED', 'un second mécanicien ne peut plus accepter');

select tst.login('00000000-0000-0000-0000-0000000000c1');
select tst.ok((select count(*) from public.profiles) = 2, 'le client voit le profil du mécanicien attribué');
insert into tst.ctx select 'code1', public.get_arrival_code((select v::uuid from tst.ctx where k='req1'));
select tst.ok((select v ~ '^[0-9]{4}$' from tst.ctx where k = 'code1'), 'code d''arrivée à 4 chiffres pour le client');

-- ---------------------------------------------------------------------------
-- 6-9. Devis, déplacement, arrivée
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((select count(*) from public.vehicles) = 1, 'le mécanicien voit le véhicule de sa mission');
select tst.fails($$ select public.start_route((select id from public.service_requests)) $$, 'INVALID_STATUS',
                 'pas de déplacement avant validation du devis');
select tst.fails($$ select public.submit_quote((select id from public.service_requests), 0, 0, 0) $$, 'INVALID_AMOUNT',
                 'devis à zéro refusé');
select tst.ok((public.submit_quote((select id from public.service_requests), 12000, 6000, 2000, 20, 'Batterie à remplacer')).total_amount = 20000,
              'devis de 20 000 FCFA envoyé');

select tst.login('00000000-0000-0000-0000-0000000000c1');
select tst.ok((select status from public.service_requests) = 'quoted', 'le client voit le devis');
select tst.ok((public.respond_to_quote((select id from public.quotes where status = 'proposed'), true)).status = 'quote_accepted',
              'devis accepté par le client');

select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((public.start_route((select id from public.service_requests))).status = 'en_route', 'mécanicien en route');
select tst.ok(public.verify_arrival_code((select id from public.service_requests), '9999x') = false, 'mauvais code refusé');
reset role;
select tst.ok((select attempts from public.request_arrival_codes) = 1, 'tentative comptabilisée');
set role authenticated;
select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok(public.verify_arrival_code((select id from public.service_requests), (select v from tst.ctx where k='code1')),
              'bon code : intervention commencée');
select tst.ok((select status from public.service_requests) = 'in_progress', 'statut en cours');

-- Supplément : accord explicite obligatoire avant de terminer
select public.submit_quote((select id from public.service_requests), 15000, 6000, 2000, null, 'Cosse oxydée à changer');
select tst.fails($$ select public.complete_mission((select id from public.service_requests)) $$, 'QUOTE_PENDING',
                 'impossible de terminer avec un supplément non validé');
select tst.login('00000000-0000-0000-0000-0000000000c1');
select public.respond_to_quote((select id from public.quotes where status = 'proposed'), true);
select tst.ok((select count(*) from public.quotes where status = 'accepted') = 1
              and (select total_amount from public.quotes where status = 'accepted') = 23000,
              'un seul devis accepté (le plus récent : 23 000 FCFA)');

-- ---------------------------------------------------------------------------
-- 10-12. Fin, paiement, évaluation
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((public.complete_mission((select id from public.service_requests), 'Batterie remplacée')).status = 'completed',
              'mission terminée');
select tst.ok((select amount = 23000 and commission_amount = 2760 and mechanic_net = 20240
                 from public.declare_payment((select id from public.service_requests), 'cash')),
              'paiement déclaré au montant du devis, commission Starter 12 %');

select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.fails(format($$ select public.confirm_payment(%L) $$, (select v from tst.ctx where k='req1')),
                 'REQUEST_NOT_FOUND', 'un autre client ne peut pas confirmer');

select tst.login('00000000-0000-0000-0000-0000000000c1');
select tst.fails($$ select public.submit_review((select id from public.service_requests), 5) $$, 'INVALID_STATUS',
                 'pas d''avis avant confirmation du paiement');
select tst.ok((select receipt_number ~ '^REC-[0-9]{4}-[0-9]{6}$' from public.confirm_payment((select id from public.service_requests))),
              'paiement confirmé, reçu numéroté');
select tst.ok((select status from public.service_requests) = 'paid', 'demande payée');
select tst.ok((public.submit_review((select id from public.service_requests), 5, 'Rapide et honnête')).rating = 5, 'avis enregistré');
select tst.ok((select status from public.service_requests) = 'closed', 'dossier clos');

reset role;
select tst.ok((select rating_avg = 5 and rating_count = 1 and completed_missions = 1
                 from public.mechanic_profiles where id = '00000000-0000-0000-0000-0000000000a1'),
              'note et compteur du mécanicien mis à jour');
select tst.ok((select array_agg(to_status::text order by id) from public.status_history
                where request_id = (select v::uuid from tst.ctx where k='req1'))
              = array['searching','accepted','quoted','quote_accepted','en_route','in_progress','completed','paid','closed'],
              'historique complet des statuts');
set role authenticated;

-- ---------------------------------------------------------------------------
-- Recherche infructueuse, élargissement, attribution manuelle, annulation
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000c2');
insert into tst.ctx
select 'req2', (public.create_service_request((select id from public.service_categories where slug = 'crevaison'),
                5.4100, -3.9500, true)).id::text;
reset role;
select tst.ok((select count(*) from public.assignments where request_id = (select v::uuid from tst.ctx where k='req2')) = 0,
              'aucun professionnel compatible : aucune proposition');
set role authenticated;
select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.ok(public.expand_search((select v::uuid from tst.ctx where k='req2')) = 0, 'élargissement sans résultat');
reset role;
select tst.ok((select search_radius_km from public.service_requests where id = (select v::uuid from tst.ctx where k='req2')) = 10,
              'rayon doublé');
select tst.ok((select count(*) from public.notifications where type = 'request_unmatched') = 1,
              'l''administration (operations+) est alertée');
set role authenticated;

select tst.login('00000000-0000-0000-0000-0000000000d2');
select tst.fails(format($$ select public.admin_assign_mechanic(%L, '00000000-0000-0000-0000-0000000000a2') $$,
                        (select v from tst.ctx where k='req2')),
                 'FORBIDDEN_ADMIN', 'le support ne peut pas attribuer manuellement');
select tst.ok((select (public.admin_dashboard_stats() ->> 'interventions_done')::int) = 1, 'statistiques accessibles au support');

select tst.login('00000000-0000-0000-0000-0000000000d1');
select tst.ok((public.admin_assign_mechanic((select v::uuid from tst.ctx where k='req2'), '00000000-0000-0000-0000-0000000000a2',
               'Appel au garage')).status = 'accepted', 'attribution manuelle par l''administration');

select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.ok((public.cancel_request((select v::uuid from tst.ctx where k='req2'), 'Réparé par un proche')).status = 'cancelled',
              'annulation par le client');
reset role;
select tst.ok((select count(*) from public.notifications where type = 'request_cancelled'
                 and user_id = '00000000-0000-0000-0000-0000000000a2') = 1, 'le mécanicien est prévenu de l''annulation');
set role authenticated;

-- ---------------------------------------------------------------------------
-- Modèle « VTC » : chaque pro voit lui-même les demandes de sa zone
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000a2');
select public.set_my_availability(false);

-- Demande à ≈ 7,8 km du pro a2 (zone 15 km) : hors du rayon initial de 5 km de la demande,
-- et à ≈ 10,7 km du pro a1 (zone 10 km).
select tst.login('00000000-0000-0000-0000-0000000000c2');
insert into tst.ctx
select 'req3', (public.create_service_request((select id from public.service_categories where slug = 'batterie'),
                5.4150, -4.0050, true)).id::text;
reset role;
select tst.ok((select count(*) from public.assignments where request_id = (select v::uuid from tst.ctx where k='req3')) = 0,
              'aucun pro disponible dans sa zone au moment de la demande');
set role authenticated;

select tst.login('00000000-0000-0000-0000-0000000000a2');
select public.set_my_availability(true);
select tst.ok((select count(*) from public.list_open_proposals()
                where request_id = (select v::uuid from tst.ctx where k='req3')) = 1,
              'un pro qui se rend disponible voit aussitôt la demande déjà en cours dans sa zone');
select tst.ok((select distance_km between 7 and 8.5 from public.list_open_proposals()
                where request_id = (select v::uuid from tst.ctx where k='req3')),
              'distance indiquée au pro');
select public.respond_to_assignment((select assignment_id from public.list_open_proposals()
                                      where request_id = (select v::uuid from tst.ctx where k='req3')), false, 'Trop loin');
select tst.ok((select count(*) from public.list_open_proposals()
                where request_id = (select v::uuid from tst.ctx where k='req3')) = 0,
              'une demande refusée n''est plus reproposée');

select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((select count(*) from public.list_open_proposals()
                where request_id = (select v::uuid from tst.ctx where k='req3')) = 0,
              'hors de la zone du pro : demande non visible');
update public.mechanic_profiles set service_radius_km = 12 where id = auth.uid();
select tst.ok((select count(*) from public.list_open_proposals()
                where request_id = (select v::uuid from tst.ctx where k='req3')) = 1,
              'zone agrandie : la demande apparaît sans intervention de l''administration');
select tst.ok((public.respond_to_assignment((select assignment_id from public.list_open_proposals()
                where request_id = (select v::uuid from tst.ctx where k='req3')), true)).status = 'accepted',
              'le pro accepte directement la demande');
select tst.ok((select count(*) from public.list_open_proposals()) = 0,
              'un pro en mission ne reçoit pas d''autre demande');

select tst.login('00000000-0000-0000-0000-0000000000c2');
select public.cancel_request((select v::uuid from tst.ctx where k='req3'), 'Test terminé');

-- ---------------------------------------------------------------------------
-- Négociation du devis
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000c2');
insert into tst.ctx
select 'req4', (public.create_service_request((select id from public.service_categories where slug = 'batterie'),
                5.3300, -4.0100, true)).id::text;
select tst.login('00000000-0000-0000-0000-0000000000a1');
select public.respond_to_assignment((select assignment_id from public.list_open_proposals()
                                      where request_id = (select v::uuid from tst.ctx where k='req4')), true);
insert into tst.ctx select 'q4a', (public.submit_quote((select v::uuid from tst.ctx where k='req4'), 20000)).id::text;

select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.fails($$ select public.propose_price((select v::uuid from tst.ctx where k='q4a'), 8000) $$,
                 'OFFER_TOO_LOW', 'contre-proposition sous le plancher (50 % du devis) refusée');
select tst.fails($$ select public.propose_price((select v::uuid from tst.ctx where k='q4a'), 25000) $$,
                 'INVALID_AMOUNT', 'contre-proposition supérieure au devis refusée');
insert into tst.ctx select 'offA', (public.propose_price((select v::uuid from tst.ctx where k='q4a'), 15000,
                                                         'Je peux payer 15 000')).id::text;
select tst.ok((select status from public.price_offers where id = (select v::uuid from tst.ctx where k='offA')) = 'pending',
              'le client propose un autre prix');
select tst.fails($$ select public.propose_price((select v::uuid from tst.ctx where k='q4a'), 16000) $$,
                 'OFFER_PENDING', 'une seule proposition en attente à la fois');
select tst.fails($$ insert into public.price_offers (request_id, quote_id, client_id, amount)
                    values ((select v::uuid from tst.ctx where k='req4'), (select v::uuid from tst.ctx where k='q4a'), auth.uid(), 1) $$,
                 'permission denied', 'aucune écriture directe dans les propositions de prix');

select tst.login('00000000-0000-0000-0000-0000000000a2');
select tst.fails($$ select public.respond_to_price_offer((select v::uuid from tst.ctx where k='offA'), true) $$,
                 'OFFER_NOT_FOUND', 'un autre professionnel ne peut pas répondre');
select tst.ok((select count(*) from public.price_offers) = 0, 'un autre professionnel ne voit pas la négociation');

select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((select count(*) from public.price_offers where request_id = (select v::uuid from tst.ctx where k='req4')) = 1,
              'le professionnel attribué voit la contre-proposition');
select public.respond_to_price_offer((select v::uuid from tst.ctx where k='offA'), false);
select tst.ok((select status from public.price_offers where id = (select v::uuid from tst.ctx where k='offA')) = 'rejected',
              'le professionnel maintient son prix');
insert into tst.ctx select 'q4b', (public.submit_quote((select v::uuid from tst.ctx where k='req4'), 18000)).id::text;

select tst.login('00000000-0000-0000-0000-0000000000c2');
insert into tst.ctx select 'offB', (public.propose_price((select v::uuid from tst.ctx where k='q4b'), 16000)).id::text;
select tst.login('00000000-0000-0000-0000-0000000000a1');
insert into tst.ctx select 'q4c', (public.submit_quote((select v::uuid from tst.ctx where k='req4'), 17500)).id::text;
select tst.ok((select status from public.price_offers where id = (select v::uuid from tst.ctx where k='offB')) = 'cancelled',
              'un nouveau montant du professionnel clôt la proposition en attente');

select tst.login('00000000-0000-0000-0000-0000000000c2');
insert into tst.ctx select 'offC', (public.propose_price((select v::uuid from tst.ctx where k='q4c'), 17000)).id::text;
select tst.login('00000000-0000-0000-0000-0000000000a1');
select public.respond_to_price_offer((select v::uuid from tst.ctx where k='offC'), false);
select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.fails($$ select public.propose_price((select v::uuid from tst.ctx where k='q4c'), 17200) $$,
                 'OFFER_LIMIT', 'au plus 3 contre-propositions par demande');
select tst.ok((public.respond_to_quote((select v::uuid from tst.ctx where k='q4c'), true)).status = 'quote_accepted',
              'le client peut toujours accepter le devis');
select public.cancel_request((select v::uuid from tst.ctx where k='req4'), 'Test négociation terminé');

-- Prix du client accepté par le professionnel
select tst.login('00000000-0000-0000-0000-0000000000c1');
insert into tst.ctx
select 'req5', (public.create_service_request((select id from public.service_categories where slug = 'batterie'),
                5.3400, -4.0060, true)).id::text;
select tst.login('00000000-0000-0000-0000-0000000000a2');
select public.respond_to_assignment((select assignment_id from public.list_open_proposals()
                                      where request_id = (select v::uuid from tst.ctx where k='req5')), true);
insert into tst.ctx select 'q5', (public.submit_quote((select v::uuid from tst.ctx where k='req5'), 10000, 2000)).id::text;
select tst.login('00000000-0000-0000-0000-0000000000c1');
insert into tst.ctx select 'off5', (public.propose_price((select v::uuid from tst.ctx where k='q5'), 9000)).id::text;
select tst.login('00000000-0000-0000-0000-0000000000a2');
select tst.ok((public.respond_to_price_offer((select v::uuid from tst.ctx where k='off5'), true)).status = 'quote_accepted',
              'le professionnel accepte le prix du client : devis validé, il peut partir');
select tst.ok((select total_amount = 9000 and offer_id = (select v::uuid from tst.ctx where k='off5')
                 from public.quotes where request_id = (select v::uuid from tst.ctx where k='req5') and status = 'accepted'),
              'devis « prix négocié » créé au montant convenu');
select tst.ok((select status from public.quotes where id = (select v::uuid from tst.ctx where k='q5')) = 'superseded',
              'le devis initial est remplacé');
reset role;
select tst.ok((select count(*) from public.notifications where type = 'price_offer_accepted'
                 and user_id = '00000000-0000-0000-0000-0000000000c1') = 1, 'le client est prévenu');
set role authenticated;
select tst.login('00000000-0000-0000-0000-0000000000c1');
select public.cancel_request((select v::uuid from tst.ctx where k='req5'), 'Test terminé');

-- ---------------------------------------------------------------------------
-- Suspension
-- ---------------------------------------------------------------------------
select tst.login('00000000-0000-0000-0000-0000000000d1');
select public.admin_set_suspension('00000000-0000-0000-0000-0000000000a2', true, 'Vérification en cours');
select tst.login('00000000-0000-0000-0000-0000000000a2');
select tst.fails($$ select public.set_my_availability(true) $$, 'ACCOUNT_SUSPENDED', 'un compte suspendu est bloqué');

-- ---------------------------------------------------------------------------
-- Stockage
-- ---------------------------------------------------------------------------
reset role;
insert into storage.buckets (id, name) values ('request-photos', 'request-photos') on conflict do nothing;
set role authenticated;
select tst.login('00000000-0000-0000-0000-0000000000c1');
insert into storage.objects (bucket_id, name) values ('request-photos', '00000000-0000-0000-0000-0000000000c1/panne.jpg');
select tst.fails($$ insert into storage.objects (bucket_id, name) values ('request-photos', '00000000-0000-0000-0000-0000000000c2/x.jpg') $$,
                 'row-level security', 'dépôt impossible dans le dossier d''un autre utilisateur');
select tst.login('00000000-0000-0000-0000-0000000000a1');
select tst.ok((select count(*) from storage.objects where bucket_id = 'request-photos') = 1,
              'le mécanicien attribué voit la photo de la panne');
select tst.login('00000000-0000-0000-0000-0000000000c2');
select tst.ok((select count(*) from storage.objects where bucket_id = 'request-photos') = 0,
              'un autre client ne voit pas la photo');

-- Lecture anonyme : catalogue public uniquement
reset role;
set role anon;
select tst.ok((select count(*) from public.service_categories) = 8, 'catalogue des services public');
select tst.fails($$ select * from public.profiles $$, 'permission denied', 'aucun profil lisible anonymement');
select tst.fails($$ select public.admin_dashboard_stats() $$, 'permission denied', 'RPC fermées aux anonymes');
reset role;

select 'TOUS LES TESTS SONT PASSÉS' as resultat;
