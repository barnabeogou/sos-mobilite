-- =============================================================================
-- SOS MOBILITÉ — Workflow des demandes d'assistance (fonctions RPC)
--
-- Cycle de vie (cahier des charges §7) :
--   1. Le client crée une demande                      create_service_request
--   2. Sa position est enregistrée avec autorisation   (location_consent obligatoire)
--   3. Le système identifie les mécaniciens compatibles match_mechanics
--   4. Une demande de mission est transmise             assignments.status = 'proposed'
--   5. Le mécanicien accepte ou refuse                  respond_to_assignment
--   6. Le prix est communiqué au client                 submit_quote
--   7. Le client valide le devis                        respond_to_quote
--   8. Le mécanicien se déplace                         start_route
--   9. L'intervention commence (code d'arrivée)         verify_arrival_code
--  10. Le mécanicien termine la mission                 complete_mission
--  11. Le paiement est enregistré                       declare_payment + confirm_payment
--  12. Le client évalue la prestation                   submit_review
--
-- Chaque transition vérifie : identité, rôle, propriété de la demande et statut
-- de départ autorisé. Les changements sont historisés (status_history).
-- =============================================================================

create or replace function public.set_status_note(p_note text)
returns void
language sql
set search_path = public, pg_temp
as $$
  select set_config('app.status_note', coalesce(p_note, ''), true);
$$;
revoke execute on function public.set_status_note(text) from public, anon, authenticated;

-- Notifie tous les administrateurs d'un niveau minimum donné.
create or replace function public.notify_admins(p_min public.admin_level, p_type text, p_title text,
                                                p_body text, p_request uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, type, title, body, request_id)
  select id, p_type, p_title, p_body, p_request
    from public.profiles
   where role = 'admin' and not is_suspended and admin_level >= p_min;
$$;
revoke execute on function public.notify_admins(public.admin_level, text, text, text, uuid) from public, anon, authenticated;

-- Vrai si le mécanicien a déjà une mission en cours.
create or replace function public.mechanic_is_busy(p_mechanic uuid, p_except_request uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.service_requests
     where assigned_mechanic_id = p_mechanic
       and status in ('accepted', 'quoted', 'quote_accepted', 'en_route', 'in_progress')
       and (p_except_request is null or id <> p_except_request)
  );
$$;
revoke execute on function public.mechanic_is_busy(uuid, uuid) from public, anon, authenticated;

-- =============================================================================
-- 3-4. Identification des mécaniciens compatibles et envoi des propositions
-- =============================================================================
create or replace function public.match_mechanics(p_request_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.service_requests;
  v_timeout int := public.setting_numeric('proposal_timeout_minutes', 10)::int;
  v_max_per_round int := public.setting_numeric('max_proposals_per_round', 10)::int;
  v_cat_name text;
  v_row record;
  v_open int;
begin
  select * into v_req from public.service_requests where id = p_request_id;
  if not found or v_req.status <> 'searching' then
    return 0;
  end if;
  select name into v_cat_name from public.service_categories where id = v_req.category_id;

  for v_row in
    with candidates as (
      select m.id as mechanic_id,
             public.distance_km(v_req.lat, v_req.lng, m.base_lat, m.base_lng) as dist
        from public.mechanic_profiles m
        join public.profiles p on p.id = m.id
       where m.verification_status = 'approved'
         and m.is_available
         and not p.is_suspended
         and m.base_lat is not null and m.base_lng is not null
         and v_req.vehicle_type = any (m.vehicle_types)
         and m.id <> v_req.client_id
         and exists (select 1 from public.mechanic_specialties s
                      where s.mechanic_id = m.id and s.category_id = v_req.category_id)
         and not exists (select 1 from public.assignments a
                          where a.request_id = v_req.id and a.mechanic_id = m.id
                            and a.status in ('declined', 'withdrawn', 'cancelled', 'accepted'))
         and not public.mechanic_is_busy(m.id)
    )
    insert into public.assignments as a (request_id, mechanic_id, distance_km, expires_at)
    select v_req.id, c.mechanic_id, round(c.dist::numeric, 2), now() + make_interval(mins => v_timeout)
      from candidates c
     where c.dist <= v_req.search_radius_km
       and c.dist <= (select service_radius_km from public.mechanic_profiles where id = c.mechanic_id)
     order by c.dist
     limit v_max_per_round
    on conflict (request_id, mechanic_id) do update
       set status = 'proposed',
           proposed_at = now(),
           expires_at = excluded.expires_at,
           distance_km = excluded.distance_km
     where a.status = 'expired' or (a.status = 'proposed' and a.expires_at <= now())
    returning a.mechanic_id, a.distance_km
  loop
    perform public.notify_user(
      v_row.mechanic_id, 'mission_proposed',
      'Nouvelle demande : ' || coalesce(v_cat_name, 'assistance'),
      'À environ ' || replace(v_row.distance_km::text, '.', ',') || ' km. Répondez avant expiration.',
      v_req.id);
  end loop;

  select count(*) into v_open
    from public.assignments
   where request_id = v_req.id and status = 'proposed' and expires_at > now();
  return v_open;
end;
$$;
revoke execute on function public.match_mechanics(uuid) from public, anon, authenticated;

-- =============================================================================
-- 1-2. Création d'une demande d'assistance
-- =============================================================================
create or replace function public.create_service_request(
  p_category_id        uuid,
  p_lat                double precision,
  p_lng                double precision,
  p_location_consent   boolean,
  p_vehicle_id         uuid default null,
  p_vehicle_type       public.vehicle_type default 'auto',
  p_symptoms           text[] default '{}',
  p_description        text default null,
  p_photos             text[] default '{}',
  p_accuracy_m         int default null,
  p_address_hint       text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_vehicle public.vehicles;
  v_vehicle_type public.vehicle_type := coalesce(p_vehicle_type, 'auto');
  v_req public.service_requests;
  v_photo text;
  v_radius numeric := public.setting_numeric('default_search_radius_km', 5);
begin
  if p_location_consent is not true then
    raise exception 'LOCATION_CONSENT_REQUIRED'
      using hint = 'Vous devez autoriser le partage de votre position pour cette demande.';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'LOCATION_REQUIRED' using hint = 'Position introuvable. Activez la localisation.';
  end if;
  if not exists (select 1 from public.service_categories where id = p_category_id and is_active) then
    raise exception 'INVALID_CATEGORY' using hint = 'Type d''assistance indisponible.';
  end if;

  if p_vehicle_id is not null then
    select * into v_vehicle from public.vehicles where id = p_vehicle_id and owner_id = v_uid;
    if not found then
      raise exception 'VEHICLE_NOT_FOUND' using hint = 'Véhicule introuvable.';
    end if;
    v_vehicle_type := v_vehicle.type;
  end if;

  if exists (select 1 from public.service_requests
              where client_id = v_uid
                and status in ('searching', 'accepted', 'quoted', 'quote_accepted', 'en_route', 'in_progress', 'completed')) then
    raise exception 'ACTIVE_REQUEST_EXISTS'
      using hint = 'Vous avez déjà une demande en cours. Terminez-la ou annulez-la avant d''en créer une nouvelle.';
  end if;

  foreach v_photo in array coalesce(p_photos, '{}') loop
    if v_photo is null or position((v_uid::text || '/') in v_photo) <> 1 then
      raise exception 'INVALID_PHOTO_PATH' using hint = 'Photo invalide.';
    end if;
  end loop;

  insert into public.service_requests (
    reference, client_id, vehicle_id, vehicle_type, category_id, symptoms, description, photos,
    lat, lng, location_accuracy_m, address_hint, location_consent_at, search_radius_km
  ) values (
    public.next_request_reference(), v_uid, p_vehicle_id, v_vehicle_type, p_category_id,
    coalesce(p_symptoms, '{}'), nullif(trim(p_description), ''), coalesce(p_photos, '{}'),
    p_lat, p_lng, p_accuracy_m, nullif(trim(p_address_hint), ''), now(), v_radius
  ) returning * into v_req;

  insert into public.request_arrival_codes (request_id, code) values (v_req.id, public.random_4_digits());

  perform public.match_mechanics(v_req.id);
  return v_req;
end;
$$;

-- Élargir le rayon de recherche lorsque personne n'a accepté
create or replace function public.expand_search(p_request_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_req public.service_requests;
  v_max numeric := public.setting_numeric('max_search_radius_km', 30);
  v_open int;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.client_id <> v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if v_req.status <> 'searching' then
    raise exception 'INVALID_STATUS' using hint = 'La recherche n''est plus active pour cette demande.';
  end if;

  update public.assignments set status = 'expired'
   where request_id = p_request_id and status = 'proposed' and expires_at <= now();

  update public.service_requests
     set search_radius_km = least(search_radius_km * 2, v_max)
   where id = p_request_id;

  v_open := public.match_mechanics(p_request_id);
  if v_open = 0 then
    perform public.notify_admins('operations', 'request_unmatched',
      'Demande sans mécanicien : ' || v_req.reference,
      'Aucun professionnel disponible après élargissement. Prise en charge manuelle recommandée.', p_request_id);
  end if;
  return v_open;
end;
$$;

-- Propositions ouvertes pour le mécanicien connecté.
-- Position approximative (≈ 1 km) et aucune coordonnée du client avant acceptation.
create or replace function public.list_open_proposals()
returns table (
  assignment_id   uuid,
  request_id      uuid,
  reference       text,
  category_slug   text,
  category_name   text,
  vehicle_type    public.vehicle_type,
  vehicle_label   text,
  symptoms        text[],
  description     text,
  photo_count     int,
  approx_lat      double precision,
  approx_lng      double precision,
  address_hint    text,
  distance_km     numeric,
  created_at      timestamptz,
  expires_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
begin
  return query
  select a.id, r.id, r.reference, c.slug, c.name, r.vehicle_type,
         nullif(trim(coalesce(v.brand, '') || ' ' || coalesce(v.model, '')), ''),
         r.symptoms, r.description, cardinality(r.photos),
         round(r.lat::numeric, 2)::double precision, round(r.lng::numeric, 2)::double precision,
         r.address_hint, a.distance_km, r.created_at, a.expires_at
    from public.assignments a
    join public.service_requests r on r.id = a.request_id
    join public.service_categories c on c.id = r.category_id
    left join public.vehicles v on v.id = r.vehicle_id
   where a.mechanic_id = v_uid
     and a.status = 'proposed'
     and a.expires_at > now()
     and r.status = 'searching'
   order by a.proposed_at desc;
end;
$$;

-- =============================================================================
-- 5. Acceptation / refus d'une proposition
-- =============================================================================
create or replace function public.respond_to_assignment(p_assignment_id uuid, p_accept boolean,
                                                        p_reason text default null)
returns public.assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_asg public.assignments;
  v_req public.service_requests;
  v_mech public.mechanic_profiles;
  v_name text;
  v_other record;
begin
  select * into v_mech from public.mechanic_profiles where id = v_uid;
  if v_mech.verification_status <> 'approved' then
    raise exception 'MECHANIC_NOT_APPROVED' using hint = 'Votre profil doit être validé par l''administration.';
  end if;

  select * into v_asg from public.assignments where id = p_assignment_id for update;
  if not found or v_asg.mechanic_id <> v_uid then
    raise exception 'PROPOSAL_NOT_FOUND' using hint = 'Proposition introuvable.';
  end if;
  if v_asg.status <> 'proposed' then
    raise exception 'PROPOSAL_CLOSED' using hint = 'Cette proposition n''est plus ouverte.';
  end if;

  -- Verrou sur la demande : le premier mécanicien confirmé obtient la mission.
  -- (La ligne de la demande n'est jamais renvoyée au mécanicien avant attribution.)
  select * into v_req from public.service_requests where id = v_asg.request_id for update;

  if v_asg.expires_at <= now() then
    raise exception 'PROPOSAL_EXPIRED' using hint = 'Cette proposition a expiré.';
  end if;

  if v_req.status <> 'searching' then
    raise exception 'REQUEST_NO_LONGER_AVAILABLE' using hint = 'Cette demande n''est plus disponible.';
  end if;

  if not p_accept then
    update public.assignments
       set status = 'declined', responded_at = now(), decline_reason = nullif(trim(p_reason), '')
     where id = p_assignment_id
    returning * into v_asg;
    if not exists (select 1 from public.assignments
                    where request_id = v_req.id and status = 'proposed' and expires_at > now()) then
      perform public.notify_user(v_req.client_id, 'no_mechanic_yet',
        'Recherche en cours',
        'Aucun professionnel n''a encore accepté. Vous pouvez élargir la zone de recherche ou contacter le support.',
        v_req.id);
    end if;
    return v_asg;
  end if;

  if public.mechanic_is_busy(v_uid) then
    raise exception 'MECHANIC_BUSY' using hint = 'Terminez votre mission en cours avant d''en accepter une autre.';
  end if;

  update public.assignments set status = 'accepted', responded_at = now() where id = p_assignment_id
  returning * into v_asg;

  for v_other in
    update public.assignments set status = 'cancelled', responded_at = now()
     where request_id = v_req.id and status = 'proposed' and id <> p_assignment_id
    returning mechanic_id
  loop
    perform public.notify_user(v_other.mechanic_id, 'mission_taken',
      'Demande ' || v_req.reference || ' attribuée',
      'Un autre professionnel a pris cette demande. Elle n''est plus disponible.', v_req.id);
  end loop;

  update public.service_requests
     set status = 'accepted', assigned_mechanic_id = v_uid, accepted_at = now()
   where id = v_req.id
  returning * into v_req;

  select coalesce(nullif(m.business_name, ''), p.full_name) into v_name
    from public.mechanic_profiles m join public.profiles p on p.id = m.id where m.id = v_uid;
  perform public.notify_user(v_req.client_id, 'mission_accepted',
    'Mission acceptée',
    coalesce(v_name, 'Un professionnel') || ' a accepté votre demande. Le devis va vous être communiqué.',
    v_req.id);
  return v_asg;
end;
$$;

-- Désistement du mécanicien avant le déplacement : la demande repart en recherche.
create or replace function public.withdraw_from_request(p_request_id uuid, p_reason text default null)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Mission introuvable.';
  end if;
  if v_req.status not in ('accepted', 'quoted', 'quote_accepted') then
    raise exception 'INVALID_STATUS' using hint = 'Désistement impossible à ce stade. Contactez le support.';
  end if;

  update public.assignments set status = 'withdrawn', responded_at = now(),
         decline_reason = nullif(trim(p_reason), '')
   where request_id = p_request_id and mechanic_id = v_uid;
  update public.quotes set status = 'superseded'
   where request_id = p_request_id and status in ('proposed', 'accepted');

  perform public.set_status_note('Désistement du professionnel' || coalesce(' : ' || nullif(trim(p_reason), ''), ''));
  update public.service_requests
     set status = 'searching', assigned_mechanic_id = null, accepted_at = null, quote_accepted_at = null
   where id = p_request_id
  returning * into v_req;

  perform public.notify_user(v_req.client_id, 'mechanic_withdrew',
    'Recherche relancée',
    'Le professionnel s''est désisté. Nous recherchons un autre mécanicien disponible.', p_request_id);
  if public.match_mechanics(p_request_id) = 0 then
    perform public.notify_admins('operations', 'request_unmatched',
      'Demande relancée sans mécanicien : ' || v_req.reference, 'Prise en charge manuelle recommandée.', p_request_id);
  end if;
  return v_req;
end;
$$;

-- =============================================================================
-- 6-7. Devis
-- =============================================================================
create or replace function public.submit_quote(
  p_request_id   uuid,
  p_labor        int,
  p_parts        int default 0,
  p_travel       int default 0,
  p_eta_minutes  int default null,
  p_notes        text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_req public.service_requests;
  v_quote public.quotes;
  v_version int;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Mission introuvable.';
  end if;
  if v_req.status not in ('accepted', 'quoted', 'in_progress') then
    raise exception 'INVALID_STATUS' using hint = 'Un devis ne peut pas être envoyé à ce stade.';
  end if;
  if coalesce(p_labor, 0) < 0 or coalesce(p_parts, 0) < 0 or coalesce(p_travel, 0) < 0
     or coalesce(p_labor, 0) + coalesce(p_parts, 0) + coalesce(p_travel, 0) <= 0 then
    raise exception 'INVALID_AMOUNT' using hint = 'Le montant du devis doit être supérieur à zéro.';
  end if;

  update public.quotes set status = 'superseded' where request_id = p_request_id and status = 'proposed';
  select coalesce(max(version), 0) + 1 into v_version from public.quotes where request_id = p_request_id;

  insert into public.quotes (request_id, mechanic_id, version, labor_amount, parts_amount, travel_amount,
                             eta_minutes, notes)
  values (p_request_id, v_uid, v_version, coalesce(p_labor, 0), coalesce(p_parts, 0), coalesce(p_travel, 0),
          p_eta_minutes, nullif(trim(p_notes), ''))
  returning * into v_quote;

  if v_req.status in ('accepted', 'quoted') then
    update public.service_requests set status = 'quoted' where id = p_request_id;
    perform public.notify_user(v_req.client_id, 'quote_received', 'Devis reçu',
      'Montant proposé : ' || v_quote.total_amount || ' FCFA. Validez-le pour que le professionnel se déplace.',
      p_request_id);
  else
    perform public.notify_user(v_req.client_id, 'quote_supplement', 'Devis complémentaire à valider',
      'Nouveau montant total : ' || v_quote.total_amount || ' FCFA. Aucun travail supplémentaire sans votre accord.',
      p_request_id);
  end if;
  return v_quote;
end;
$$;

create or replace function public.respond_to_quote(p_quote_id uuid, p_accept boolean)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_quote public.quotes;
  v_req public.service_requests;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'QUOTE_NOT_FOUND' using hint = 'Devis introuvable.';
  end if;
  select * into v_req from public.service_requests where id = v_quote.request_id for update;
  if v_req.client_id <> v_uid then
    raise exception 'QUOTE_NOT_FOUND' using hint = 'Devis introuvable.';
  end if;
  if v_quote.status <> 'proposed' then
    raise exception 'QUOTE_CLOSED' using hint = 'Ce devis n''est plus en attente de réponse.';
  end if;
  if v_req.status not in ('quoted', 'in_progress') then
    raise exception 'INVALID_STATUS' using hint = 'Le devis ne peut plus être modifié à ce stade.';
  end if;

  if p_accept then
    update public.quotes set status = 'superseded'
     where request_id = v_req.id and status = 'accepted';
    update public.quotes set status = 'accepted', responded_at = now() where id = p_quote_id;
    if v_req.status = 'quoted' then
      update public.service_requests set status = 'quote_accepted', quote_accepted_at = now()
       where id = v_req.id returning * into v_req;
    end if;
    perform public.notify_user(v_quote.mechanic_id, 'quote_accepted', 'Devis accepté',
      'Le client a validé le devis de ' || v_quote.total_amount || ' FCFA.', v_req.id);
  else
    update public.quotes set status = 'rejected', responded_at = now() where id = p_quote_id;
    if v_req.status = 'quoted' then
      perform public.set_status_note('Devis refusé par le client');
      update public.service_requests set status = 'accepted' where id = v_req.id returning * into v_req;
    end if;
    perform public.notify_user(v_quote.mechanic_id, 'quote_rejected', 'Devis refusé',
      'Le client a refusé le devis. Vous pouvez proposer un nouveau montant ou vous désister.', v_req.id);
  end if;
  return v_req;
end;
$$;

-- =============================================================================
-- 8-10. Déplacement, arrivée, intervention, fin de mission
-- =============================================================================
create or replace function public.start_route(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Mission introuvable.';
  end if;
  if v_req.status <> 'quote_accepted' then
    raise exception 'INVALID_STATUS' using hint = 'Le devis doit être validé par le client avant le déplacement.';
  end if;
  update public.service_requests set status = 'en_route', en_route_at = now()
   where id = p_request_id returning * into v_req;
  perform public.notify_user(v_req.client_id, 'mechanic_en_route', 'Le professionnel est en route',
    'À son arrivée, communiquez-lui votre code de confirmation affiché dans l''application.', p_request_id);
  return v_req;
end;
$$;

-- Vérifie le code communiqué par le client à l'arrivée du professionnel.
-- Retourne false si le code est faux (5 tentatives maximum).
create or replace function public.verify_arrival_code(p_request_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_req public.service_requests;
  v_code public.request_arrival_codes;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Mission introuvable.';
  end if;
  if v_req.status <> 'en_route' then
    raise exception 'INVALID_STATUS' using hint = 'Le code se saisit à l''arrivée, une fois en route.';
  end if;
  select * into v_code from public.request_arrival_codes where request_id = p_request_id for update;
  if v_code.attempts >= 5 then
    raise exception 'TOO_MANY_ATTEMPTS' using hint = 'Trop de tentatives. Contactez le support.';
  end if;

  if trim(coalesce(p_code, '')) <> v_code.code then
    update public.request_arrival_codes set attempts = attempts + 1 where request_id = p_request_id;
    if v_code.attempts + 1 >= 5 then
      perform public.notify_admins('support', 'arrival_code_locked',
        'Code d''arrivée bloqué : ' || v_req.reference, 'Vérification d''identité recommandée.', p_request_id);
    end if;
    return false;
  end if;

  update public.request_arrival_codes set verified_at = now(), attempts = attempts + 1 where request_id = p_request_id;
  perform public.set_status_note('Arrivée confirmée par code');
  update public.service_requests set status = 'in_progress', started_at = now() where id = p_request_id;
  perform public.notify_user(v_req.client_id, 'intervention_started', 'Intervention commencée',
    'Le professionnel est bien arrivé. Tout supplément devra être validé par vous.', p_request_id);
  return true;
end;
$$;

create or replace function public.complete_mission(p_request_id uuid, p_note text default null)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Mission introuvable.';
  end if;
  if v_req.status <> 'in_progress' then
    raise exception 'INVALID_STATUS' using hint = 'La mission doit être en cours pour être terminée.';
  end if;
  if exists (select 1 from public.quotes where request_id = p_request_id and status = 'proposed') then
    raise exception 'QUOTE_PENDING' using hint = 'Un devis complémentaire attend la réponse du client.';
  end if;
  if not exists (select 1 from public.quotes where request_id = p_request_id and status = 'accepted') then
    raise exception 'NO_ACCEPTED_QUOTE' using hint = 'Aucun devis validé pour cette mission.';
  end if;

  perform public.set_status_note(p_note);
  update public.service_requests set status = 'completed', completed_at = now()
   where id = p_request_id returning * into v_req;
  perform public.notify_user(v_req.client_id, 'mission_completed', 'Intervention terminée',
    'Vérifiez votre véhicule puis confirmez la fin de la prestation et le paiement.', p_request_id);
  return v_req;
end;
$$;

-- =============================================================================
-- 11. Paiement
-- Phase 1 : paiement direct au professionnel (espèces ou mobile money hors
-- application), déclaré par le professionnel puis confirmé par le client.
-- Le montant est TOUJOURS celui du dernier devis accepté : aucun supplément
-- sans accord. Les paiements en ligne s'ajouteront via provider_reference.
-- =============================================================================
create or replace function public.declare_payment(p_request_id uuid, p_method public.payment_method)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_req public.service_requests;
  v_quote public.quotes;
  v_plan public.mechanic_plan;
  v_rate numeric;
  v_commission int;
  v_payment public.payments;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Mission introuvable.';
  end if;
  if v_req.status <> 'completed' then
    raise exception 'INVALID_STATUS' using hint = 'Le paiement se déclare une fois la mission terminée.';
  end if;

  select * into v_quote from public.quotes
   where request_id = p_request_id and status = 'accepted'
   order by version desc limit 1;
  if not found then
    raise exception 'NO_ACCEPTED_QUOTE' using hint = 'Aucun devis validé pour cette mission.';
  end if;

  select plan into v_plan from public.mechanic_profiles where id = v_uid;
  v_rate := case v_plan
              when 'pro' then public.setting_numeric('commission_rate_pro', 0.05)
              else public.setting_numeric('commission_rate_starter', 0.12)
            end;
  v_commission := round(v_quote.total_amount * v_rate)::int;

  insert into public.payments (request_id, client_id, mechanic_id, quote_id, amount, method,
                               commission_rate, commission_amount, mechanic_net)
  values (p_request_id, v_req.client_id, v_uid, v_quote.id, v_quote.total_amount, p_method,
          v_rate, v_commission, v_quote.total_amount - v_commission)
  on conflict (request_id) do update
     set method = excluded.method, quote_id = excluded.quote_id, amount = excluded.amount,
         commission_rate = excluded.commission_rate, commission_amount = excluded.commission_amount,
         mechanic_net = excluded.mechanic_net, declared_at = now()
   where public.payments.status = 'declared'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'PAYMENT_LOCKED' using hint = 'Ce paiement a déjà été confirmé ou est en litige.';
  end if;

  perform public.notify_user(v_req.client_id, 'payment_declared', 'Paiement à confirmer',
    'Le professionnel déclare avoir reçu ' || v_payment.amount || ' FCFA. Confirmez pour obtenir votre reçu.',
    p_request_id);
  return v_payment;
end;
$$;

create or replace function public.confirm_payment(p_request_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_req public.service_requests;
  v_payment public.payments;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.client_id <> v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if v_req.status <> 'completed' then
    raise exception 'INVALID_STATUS' using hint = 'La prestation doit être terminée avant de confirmer le paiement.';
  end if;
  select * into v_payment from public.payments where request_id = p_request_id for update;
  if not found or v_payment.status <> 'declared' then
    raise exception 'PAYMENT_NOT_DECLARED' using hint = 'Le professionnel n''a pas encore déclaré le paiement.';
  end if;

  update public.payments
     set status = 'confirmed', confirmed_at = now(), receipt_number = public.next_receipt_number()
   where id = v_payment.id returning * into v_payment;

  perform public.set_status_note('Fin de prestation et paiement confirmés par le client');
  update public.service_requests set status = 'paid', paid_at = now() where id = p_request_id;
  update public.mechanic_profiles set completed_missions = completed_missions + 1
   where id = v_req.assigned_mechanic_id;

  perform public.notify_user(v_req.assigned_mechanic_id, 'payment_confirmed', 'Paiement confirmé',
    'Le client a confirmé la prestation. Reçu ' || v_payment.receipt_number || '.', p_request_id);
  return v_payment;
end;
$$;

-- =============================================================================
-- 12. Évaluation
-- =============================================================================
create or replace function public.submit_review(p_request_id uuid, p_rating int, p_comment text default null)
returns public.reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_req public.service_requests;
  v_review public.reviews;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.client_id <> v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if v_req.status <> 'paid' then
    raise exception 'INVALID_STATUS' using hint = 'L''évaluation est possible après confirmation du paiement.';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'INVALID_RATING' using hint = 'La note doit être comprise entre 1 et 5.';
  end if;

  insert into public.reviews (request_id, client_id, mechanic_id, rating, comment)
  values (p_request_id, v_uid, v_req.assigned_mechanic_id, p_rating, nullif(trim(p_comment), ''))
  returning * into v_review;

  update public.service_requests set status = 'closed', closed_at = now() where id = p_request_id;
  perform public.notify_user(v_req.assigned_mechanic_id, 'review_received', 'Nouvelle évaluation',
    'Vous avez reçu une note de ' || p_rating || '/5.', p_request_id);
  return v_review;
end;
$$;

-- =============================================================================
-- Annulation, litiges
-- =============================================================================
create or replace function public.cancel_request(p_request_id uuid, p_reason text default null)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.client_id <> v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if v_req.status not in ('searching', 'accepted', 'quoted', 'quote_accepted', 'en_route') then
    raise exception 'INVALID_STATUS' using hint = 'Annulation impossible à ce stade. Contactez le support.';
  end if;

  update public.assignments set status = 'cancelled', responded_at = now()
   where request_id = p_request_id and status = 'proposed';
  update public.quotes set status = 'superseded' where request_id = p_request_id and status = 'proposed';

  perform public.set_status_note(coalesce(nullif(trim(p_reason), ''), 'Annulée par le client'));
  update public.service_requests
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid, cancel_reason = nullif(trim(p_reason), '')
   where id = p_request_id returning * into v_req;

  if v_req.assigned_mechanic_id is not null then
    perform public.notify_user(v_req.assigned_mechanic_id, 'request_cancelled', 'Mission annulée',
      'Le client a annulé la demande ' || v_req.reference || '.', p_request_id);
  end if;
  return v_req;
end;
$$;

-- Signalement d'un problème (client ou professionnel) : ouvre un litige suivi par le support.
create or replace function public.report_problem(p_request_id uuid, p_message text)
returns public.support_tickets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.service_requests;
  v_ticket public.support_tickets;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_suspended) then
    raise exception 'ACCOUNT_SUSPENDED' using hint = 'Votre compte est suspendu.';
  end if;
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or (v_req.client_id <> v_uid and v_req.assigned_mechanic_id is distinct from v_uid) then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if char_length(trim(coalesce(p_message, ''))) < 5 then
    raise exception 'MESSAGE_TOO_SHORT' using hint = 'Décrivez le problème en quelques mots.';
  end if;

  insert into public.support_tickets (created_by, request_id, category, subject, message)
  values (v_uid, p_request_id, 'litige', 'Problème sur la demande ' || v_req.reference, trim(p_message))
  returning * into v_ticket;

  if v_req.status in ('en_route', 'in_progress', 'completed') then
    perform public.set_status_note('Problème signalé');
    update public.service_requests set status = 'disputed' where id = p_request_id;
    update public.payments set status = 'disputed' where request_id = p_request_id and status = 'declared';
  end if;

  perform public.notify_admins('support', 'problem_reported', 'Problème signalé : ' || v_req.reference,
    left(trim(p_message), 200), p_request_id);
  return v_ticket;
end;
$$;

-- =============================================================================
-- Espace mécanicien : disponibilité & spécialités
-- =============================================================================
create or replace function public.set_my_availability(p_available boolean)
returns public.mechanic_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_mech public.mechanic_profiles;
begin
  select * into v_mech from public.mechanic_profiles where id = v_uid for update;
  if p_available then
    if v_mech.verification_status <> 'approved' then
      raise exception 'MECHANIC_NOT_APPROVED'
        using hint = 'Votre profil doit être validé par l''administration avant de recevoir des missions.';
    end if;
    if v_mech.base_lat is null or v_mech.base_lng is null then
      raise exception 'ZONE_REQUIRED' using hint = 'Définissez d''abord votre position de base dans votre profil.';
    end if;
    if not exists (select 1 from public.mechanic_specialties where mechanic_id = v_uid) then
      raise exception 'SPECIALTY_REQUIRED' using hint = 'Sélectionnez au moins une spécialité.';
    end if;
  end if;
  update public.mechanic_profiles set is_available = p_available where id = v_uid returning * into v_mech;
  return v_mech;
end;
$$;

create or replace function public.set_my_specialties(p_category_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_count int;
begin
  delete from public.mechanic_specialties where mechanic_id = v_uid;
  insert into public.mechanic_specialties (mechanic_id, category_id)
  select v_uid, c.id from public.service_categories c
   where c.id = any (coalesce(p_category_ids, '{}')) and c.is_active;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    update public.mechanic_profiles set is_available = false where id = v_uid;
  end if;
  return v_count;
end;
$$;

-- Liste publique (pour les clients connectés) des professionnels validés à proximité.
create or replace function public.nearby_mechanics(
  p_lat double precision,
  p_lng double precision,
  p_category_id uuid default null,
  p_vehicle_type public.vehicle_type default null,
  p_max_km numeric default 30,
  p_limit int default 30
)
returns table (
  id                 uuid,
  display_name       text,
  kind               public.mechanic_kind,
  commune            text,
  avatar_url         text,
  rating_avg         numeric,
  rating_count       int,
  completed_missions int,
  is_available       boolean,
  distance_km        numeric,
  vehicle_types      public.vehicle_type[],
  specialties        text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  return query
  select m.id,
         coalesce(nullif(m.business_name, ''), p.full_name),
         m.kind, m.commune, p.avatar_url, m.rating_avg, m.rating_count, m.completed_missions,
         m.is_available,
         round(public.distance_km(p_lat, p_lng, m.base_lat, m.base_lng)::numeric, 1),
         m.vehicle_types,
         array(select c.slug from public.mechanic_specialties s join public.service_categories c on c.id = s.category_id
                where s.mechanic_id = m.id order by c.sort_order)
    from public.mechanic_profiles m
    join public.profiles p on p.id = m.id
   where m.verification_status = 'approved'
     and not p.is_suspended
     and m.base_lat is not null
     and public.distance_km(p_lat, p_lng, m.base_lat, m.base_lng) <= least(coalesce(p_max_km, 30), 100)
     and (p_vehicle_type is null or p_vehicle_type = any (m.vehicle_types))
     and (p_category_id is null or exists (select 1 from public.mechanic_specialties s
                                            where s.mechanic_id = m.id and s.category_id = p_category_id))
   order by m.is_available desc, public.distance_km(p_lat, p_lng, m.base_lat, m.base_lng)
   limit least(coalesce(p_limit, 30), 100);
end;
$$;

-- Code d'arrivée (client propriétaire uniquement)
create or replace function public.get_arrival_code(p_request_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_code text;
begin
  select c.code into v_code
    from public.request_arrival_codes c
    join public.service_requests r on r.id = c.request_id
   where c.request_id = p_request_id and r.client_id = v_uid
     and r.status in ('accepted', 'quoted', 'quote_accepted', 'en_route');
  return v_code;
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- Administration
-- =============================================================================
create or replace function public.admin_verify_mechanic(p_mechanic_id uuid, p_decision public.verification_status,
                                                        p_reason text default null)
returns public.mechanic_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_mech public.mechanic_profiles;
begin
  if p_decision = 'pending' then
    raise exception 'INVALID_DECISION' using hint = 'Décision invalide.';
  end if;
  if p_decision in ('rejected', 'suspended') and char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using hint = 'Indiquez le motif de la décision.';
  end if;
  update public.mechanic_profiles
     set verification_status = p_decision,
         verified_at = case when p_decision = 'approved' then now() else verified_at end,
         verified_by = v_admin,
         rejection_reason = case when p_decision = 'approved' then null else trim(p_reason) end,
         is_available = case when p_decision = 'approved' then is_available else false end
   where id = p_mechanic_id
  returning * into v_mech;
  if not found then
    raise exception 'MECHANIC_NOT_FOUND' using hint = 'Professionnel introuvable.';
  end if;
  perform public.notify_user(p_mechanic_id, 'verification_' || p_decision::text,
    case p_decision when 'approved' then 'Profil validé'
                    when 'rejected' then 'Profil non validé'
                    else 'Profil suspendu' end,
    case p_decision when 'approved' then 'Vous pouvez activer votre disponibilité et recevoir des missions.'
                    else 'Motif : ' || trim(p_reason) end,
    null);
  return v_mech;
end;
$$;

create or replace function public.admin_review_document(p_document_id uuid, p_status public.document_status)
returns public.mechanic_documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_doc public.mechanic_documents;
begin
  update public.mechanic_documents set status = p_status, reviewed_by = v_admin, reviewed_at = now()
   where id = p_document_id returning * into v_doc;
  if not found then
    raise exception 'DOCUMENT_NOT_FOUND' using hint = 'Document introuvable.';
  end if;
  return v_doc;
end;
$$;

create or replace function public.admin_set_suspension(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_target public.profiles;
begin
  if p_user_id = v_admin then
    raise exception 'CANNOT_TARGET_SELF' using hint = 'Vous ne pouvez pas suspendre votre propre compte.';
  end if;
  select * into v_target from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using hint = 'Utilisateur introuvable.';
  end if;
  if v_target.role = 'admin' and not public.is_admin('super_admin') then
    raise exception 'FORBIDDEN_ADMIN' using hint = 'Seul un super administrateur peut suspendre un administrateur.';
  end if;
  update public.profiles set is_suspended = p_suspended where id = p_user_id returning * into v_target;
  if p_suspended then
    update public.mechanic_profiles set is_available = false where id = p_user_id;
    update public.assignments set status = 'cancelled', responded_at = now()
     where mechanic_id = p_user_id and status = 'proposed';
  end if;
  perform public.notify_user(p_user_id, case when p_suspended then 'account_suspended' else 'account_restored' end,
    case when p_suspended then 'Compte suspendu' else 'Compte réactivé' end,
    nullif(trim(coalesce(p_reason, '')), ''), null);
  return v_target;
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role,
                                                 p_admin_level public.admin_level default null)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('super_admin');
  v_target public.profiles;
begin
  if p_user_id = v_admin then
    raise exception 'CANNOT_TARGET_SELF' using hint = 'Vous ne pouvez pas modifier votre propre rôle.';
  end if;
  if p_role = 'admin' and p_admin_level is null then
    raise exception 'LEVEL_REQUIRED' using hint = 'Précisez le niveau d''administration.';
  end if;
  update public.profiles
     set role = p_role, admin_level = case when p_role = 'admin' then p_admin_level else null end
   where id = p_user_id returning * into v_target;
  if not found then
    raise exception 'USER_NOT_FOUND' using hint = 'Utilisateur introuvable.';
  end if;
  if p_role = 'mechanic' then
    insert into public.mechanic_profiles (id) values (p_user_id) on conflict (id) do nothing;
  end if;
  return v_target;
end;
$$;

-- Attribution manuelle (ou réattribution) d'une demande à un professionnel validé.
create or replace function public.admin_assign_mechanic(p_request_id uuid, p_mechanic_id uuid, p_note text default null)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_req public.service_requests;
  v_mech public.mechanic_profiles;
begin
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if v_req.status not in ('searching', 'accepted', 'quoted', 'quote_accepted', 'expired') then
    raise exception 'INVALID_STATUS' using hint = 'Attribution impossible à ce stade de la demande.';
  end if;
  select * into v_mech from public.mechanic_profiles where id = p_mechanic_id;
  if not found or v_mech.verification_status <> 'approved' then
    raise exception 'MECHANIC_NOT_APPROVED' using hint = 'Le professionnel doit être validé.';
  end if;
  if exists (select 1 from public.profiles where id = p_mechanic_id and is_suspended) then
    raise exception 'ACCOUNT_SUSPENDED' using hint = 'Ce professionnel est suspendu.';
  end if;
  if public.mechanic_is_busy(p_mechanic_id, p_request_id) then
    raise exception 'MECHANIC_BUSY' using hint = 'Ce professionnel a déjà une mission en cours.';
  end if;

  if v_req.assigned_mechanic_id is not null and v_req.assigned_mechanic_id <> p_mechanic_id then
    update public.assignments set status = 'withdrawn', responded_at = now(), decline_reason = 'Réattribution administrateur'
     where request_id = p_request_id and mechanic_id = v_req.assigned_mechanic_id;
    update public.quotes set status = 'superseded' where request_id = p_request_id and status in ('proposed', 'accepted');
    perform public.notify_user(v_req.assigned_mechanic_id, 'mission_reassigned', 'Mission réattribuée',
      'La demande ' || v_req.reference || ' a été confiée à un autre professionnel par le support.', p_request_id);
  end if;

  update public.assignments set status = 'cancelled', responded_at = now()
   where request_id = p_request_id and status = 'proposed' and mechanic_id <> p_mechanic_id;

  insert into public.assignments (request_id, mechanic_id, status, distance_km, is_manual, expires_at, responded_at)
  values (p_request_id, p_mechanic_id, 'accepted',
          case when v_mech.base_lat is not null
               then round(public.distance_km(v_req.lat, v_req.lng, v_mech.base_lat, v_mech.base_lng)::numeric, 2) end,
          true, now(), now())
  on conflict (request_id, mechanic_id) do update
     set status = 'accepted', is_manual = true, responded_at = now();

  perform public.set_status_note(coalesce('Attribution manuelle : ' || nullif(trim(p_note), ''), 'Attribution manuelle'));
  update public.service_requests
     set status = 'accepted', assigned_mechanic_id = p_mechanic_id, accepted_at = now(), quote_accepted_at = null
   where id = p_request_id returning * into v_req;

  perform public.notify_user(p_mechanic_id, 'mission_assigned', 'Mission attribuée par le support',
    'La demande ' || v_req.reference || ' vous a été attribuée. Envoyez votre devis au client.', p_request_id);
  perform public.notify_user(v_req.client_id, 'mission_accepted', 'Professionnel attribué',
    'Le support vous a attribué un professionnel. Le devis va vous être communiqué.', p_request_id);
  return v_req;
end;
$$;

-- Intervention manuelle sur le statut (cas de problème), avec motif obligatoire.
create or replace function public.admin_set_request_status(p_request_id uuid, p_status public.request_status, p_note text)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_req public.service_requests;
begin
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using hint = 'Un motif est obligatoire pour toute intervention manuelle.';
  end if;
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if p_status in ('accepted', 'quoted', 'quote_accepted', 'en_route', 'in_progress', 'completed', 'paid')
     and v_req.assigned_mechanic_id is null then
    raise exception 'MECHANIC_REQUIRED' using hint = 'Attribuez d''abord un professionnel.';
  end if;

  perform public.set_status_note('Intervention administrateur : ' || trim(p_note));
  update public.service_requests
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancelled_by = case when p_status = 'cancelled' then v_admin else cancelled_by end,
         cancel_reason = case when p_status = 'cancelled' then trim(p_note) else cancel_reason end,
         closed_at = case when p_status = 'closed' then now() else closed_at end
   where id = p_request_id returning * into v_req;

  if p_status in ('cancelled', 'closed', 'expired') then
    update public.assignments set status = 'cancelled', responded_at = now()
     where request_id = p_request_id and status = 'proposed';
  end if;
  if p_status = 'searching' then
    perform public.match_mechanics(p_request_id);
  end if;

  perform public.notify_user(v_req.client_id, 'status_changed_by_support', 'Mise à jour par le support',
    trim(p_note), p_request_id);
  if v_req.assigned_mechanic_id is not null then
    perform public.notify_user(v_req.assigned_mechanic_id, 'status_changed_by_support', 'Mise à jour par le support',
      trim(p_note), p_request_id);
  end if;
  return v_req;
end;
$$;

create or replace function public.admin_resolve_payment(p_payment_id uuid, p_status public.payment_status, p_note text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_pay public.payments;
  v_req public.service_requests;
begin
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using hint = 'Un motif est obligatoire.';
  end if;
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using hint = 'Paiement introuvable.';
  end if;
  select * into v_req from public.service_requests where id = v_pay.request_id for update;

  update public.payments
     set status = p_status,
         confirmed_at = case when p_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
         receipt_number = case when p_status = 'confirmed' then coalesce(receipt_number, public.next_receipt_number())
                               else receipt_number end
   where id = p_payment_id returning * into v_pay;

  if p_status = 'confirmed' and v_req.status in ('completed', 'disputed') then
    perform public.set_status_note('Paiement validé par l''administration : ' || trim(p_note));
    update public.service_requests set status = 'paid', paid_at = coalesce(paid_at, now()) where id = v_req.id;
    if v_req.paid_at is null then
      update public.mechanic_profiles set completed_missions = completed_missions + 1 where id = v_pay.mechanic_id;
    end if;
  end if;
  return v_pay;
end;
$$;

create or replace function public.admin_update_ticket(p_ticket_id uuid, p_status public.ticket_status,
                                                      p_response text default null)
returns public.support_tickets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('support');
  v_ticket public.support_tickets;
begin
  update public.support_tickets
     set status = p_status,
         admin_response = coalesce(nullif(trim(p_response), ''), admin_response),
         assigned_admin = coalesce(assigned_admin, v_admin),
         resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end
   where id = p_ticket_id returning * into v_ticket;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using hint = 'Réclamation introuvable.';
  end if;
  perform public.notify_user(v_ticket.created_by, 'ticket_updated', 'Réponse du support',
    coalesce(nullif(trim(p_response), ''), 'Statut de votre réclamation mis à jour.'), v_ticket.request_id);
  return v_ticket;
end;
$$;

create or replace function public.admin_set_review_visibility(p_review_id uuid, p_hidden boolean)
returns public.reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_review public.reviews;
begin
  update public.reviews set is_hidden = p_hidden where id = p_review_id returning * into v_review;
  if not found then
    raise exception 'REVIEW_NOT_FOUND' using hint = 'Avis introuvable.';
  end if;
  return v_review;
end;
$$;

create or replace function public.admin_set_mechanic_plan(p_mechanic_id uuid, p_plan public.mechanic_plan)
returns public.mechanic_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_mech public.mechanic_profiles;
begin
  update public.mechanic_profiles set plan = p_plan where id = p_mechanic_id returning * into v_mech;
  if not found then
    raise exception 'MECHANIC_NOT_FOUND' using hint = 'Professionnel introuvable.';
  end if;
  return v_mech;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('support');
  v_today timestamptz := date_trunc('day', now() at time zone 'Africa/Abidjan') at time zone 'Africa/Abidjan';
begin
  return jsonb_build_object(
    'clients',               (select count(*) from public.profiles where role = 'client'),
    'mechanics',             (select count(*) from public.mechanic_profiles),
    'mechanics_approved',    (select count(*) from public.mechanic_profiles where verification_status = 'approved'),
    'mechanics_pending',     (select count(*) from public.mechanic_profiles where verification_status = 'pending'),
    'mechanics_available',   (select count(*) from public.mechanic_profiles where is_available),
    'requests_total',        (select count(*) from public.service_requests),
    'requests_today',        (select count(*) from public.service_requests where created_at >= v_today),
    'requests_active',       (select count(*) from public.service_requests
                               where status in ('searching','accepted','quoted','quote_accepted','en_route','in_progress','completed')),
    'requests_searching',    (select count(*) from public.service_requests where status = 'searching'),
    'requests_disputed',     (select count(*) from public.service_requests where status = 'disputed'),
    'interventions_done',    (select count(*) from public.service_requests where status in ('paid','closed')),
    'acceptance_rate',       (select round(100.0 * count(*) filter (where accepted_at is not null or status in ('paid','closed'))
                                       / nullif(count(*), 0), 1)
                                from public.service_requests),
    'median_accept_minutes', (select round((percentile_cont(0.5) within group
                                (order by extract(epoch from accepted_at - created_at) / 60))::numeric, 1)
                                from public.service_requests where accepted_at is not null),
    'volume_confirmed',      (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed'),
    'commission_confirmed',  (select coalesce(sum(commission_amount), 0) from public.payments where status = 'confirmed'),
    'tickets_open',          (select count(*) from public.support_tickets where status in ('open','in_progress')),
    'rating_avg',            (select round(avg(rating)::numeric, 2) from public.reviews where not is_hidden)
  );
end;
$$;

-- Droits d'exécution des RPC exposées
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_service_request(uuid, double precision, double precision, boolean, uuid, public.vehicle_type, text[], text, text[], int, text),
  public.expand_search(uuid),
  public.list_open_proposals(),
  public.respond_to_assignment(uuid, boolean, text),
  public.withdraw_from_request(uuid, text),
  public.submit_quote(uuid, int, int, int, int, text),
  public.respond_to_quote(uuid, boolean),
  public.start_route(uuid),
  public.verify_arrival_code(uuid, text),
  public.complete_mission(uuid, text),
  public.declare_payment(uuid, public.payment_method),
  public.confirm_payment(uuid),
  public.submit_review(uuid, int, text),
  public.cancel_request(uuid, text),
  public.report_problem(uuid, text),
  public.set_my_availability(boolean),
  public.set_my_specialties(uuid[]),
  public.nearby_mechanics(double precision, double precision, uuid, public.vehicle_type, numeric, int),
  public.get_arrival_code(uuid),
  public.mark_notifications_read(uuid[]),
  public.admin_verify_mechanic(uuid, public.verification_status, text),
  public.admin_review_document(uuid, public.document_status),
  public.admin_set_suspension(uuid, boolean, text),
  public.admin_set_role(uuid, public.user_role, public.admin_level),
  public.admin_assign_mechanic(uuid, uuid, text),
  public.admin_set_request_status(uuid, public.request_status, text),
  public.admin_resolve_payment(uuid, public.payment_status, text),
  public.admin_update_ticket(uuid, public.ticket_status, text),
  public.admin_set_review_visibility(uuid, boolean),
  public.admin_set_mechanic_plan(uuid, public.mechanic_plan),
  public.admin_dashboard_stats(),
  public.is_admin(public.admin_level),
  public.current_user_role()
to authenticated;
