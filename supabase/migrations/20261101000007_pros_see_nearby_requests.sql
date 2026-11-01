-- =============================================================================
-- SOS MOBILITÉ — Les professionnels voient eux-mêmes les demandes autour d'eux
-- (modèle « VTC » : aucune intervention de l'administration n'est nécessaire).
--
-- Avant : une demande n'était proposée qu'au moment de sa création (ou d'un
-- élargissement), et seulement aux pros situés à la fois dans le rayon de la
-- demande (5 km au départ) ET dans leur propre zone.
-- Désormais :
--   1. une demande est proposée à tout pro compatible situé dans SA zone
--      d'intervention (ou dans le rayon élargi de la demande, s'il est plus grand) ;
--   2. un pro qui se rend disponible, qui termine une mission ou qui agrandit sa
--      zone voit aussitôt les demandes déjà en recherche autour de lui ;
--   3. tant que la demande est en recherche, elle reste visible (une proposition
--      expirée est reproposée ; une proposition refusée ne l'est jamais).
-- Inchangé : premier pro qui accepte = mission attribuée, position approximative
-- avant acceptation, pros non validés / suspendus / déjà en mission exclus.
-- =============================================================================

-- 1. Correspondance au moment de la création / de l'élargissement -------------
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
             m.service_radius_km,
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
     where c.dist <= greatest(v_req.search_radius_km, c.service_radius_km)
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

-- 2. Demandes déjà en recherche autour d'un pro (appelé côté pro) -------------
create or replace function public.offer_open_requests(p_mechanic uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.mechanic_profiles;
  v_timeout int := public.setting_numeric('proposal_timeout_minutes', 10)::int;
  v_row record;
  v_cat_name text;
  v_count int := 0;
begin
  select m.* into v_m
    from public.mechanic_profiles m
    join public.profiles p on p.id = m.id
   where m.id = p_mechanic
     and m.verification_status = 'approved'
     and m.is_available
     and not p.is_suspended
     and m.base_lat is not null and m.base_lng is not null;
  if not found or public.mechanic_is_busy(p_mechanic) then
    return 0;
  end if;

  for v_row in
    with candidates as (
      select r.id as request_id,
             r.search_radius_km,
             public.distance_km(r.lat, r.lng, v_m.base_lat, v_m.base_lng) as dist
        from public.service_requests r
       where r.status = 'searching'
         and r.client_id <> p_mechanic
         and r.vehicle_type = any (v_m.vehicle_types)
         and exists (select 1 from public.mechanic_specialties s
                      where s.mechanic_id = p_mechanic and s.category_id = r.category_id)
         and not exists (select 1 from public.assignments a
                          where a.request_id = r.id and a.mechanic_id = p_mechanic
                            and (a.status in ('declined', 'withdrawn', 'cancelled', 'accepted')
                                 or (a.status = 'proposed' and a.expires_at > now())))
    )
    insert into public.assignments as a (request_id, mechanic_id, distance_km, expires_at)
    select c.request_id, p_mechanic, round(c.dist::numeric, 2), now() + make_interval(mins => v_timeout)
      from candidates c
     where c.dist <= greatest(c.search_radius_km, v_m.service_radius_km)
     order by c.dist
     limit 20
    on conflict (request_id, mechanic_id) do update
       set status = 'proposed',
           proposed_at = now(),
           expires_at = excluded.expires_at,
           distance_km = excluded.distance_km
     where a.status = 'expired' or (a.status = 'proposed' and a.expires_at <= now())
    returning a.request_id, a.distance_km
  loop
    v_count := v_count + 1;
    select c.name into v_cat_name
      from public.service_requests r join public.service_categories c on c.id = r.category_id
     where r.id = v_row.request_id;
    perform public.notify_user(
      p_mechanic, 'mission_proposed',
      'Nouvelle demande : ' || coalesce(v_cat_name, 'assistance'),
      'À environ ' || replace(v_row.distance_km::text, '.', ',') || ' km. Répondez avant expiration.',
      v_row.request_id);
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.offer_open_requests(uuid) from public, anon, authenticated;

-- 3. Liste des demandes pour le pro connecté : rafraîchit d'abord sa zone ------
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
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
begin
  perform public.offer_open_requests(v_uid);

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
   order by a.distance_km, a.proposed_at desc;
end;
$$;

-- 4. Se rendre disponible fait apparaître tout de suite les demandes proches ---
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
  if p_available then
    perform public.offer_open_requests(v_uid);
  end if;
  return v_mech;
end;
$$;

-- Les droits d'exécution des RPC exposées sont conservés (create or replace).
grant execute on function public.list_open_proposals(), public.set_my_availability(boolean) to authenticated;
