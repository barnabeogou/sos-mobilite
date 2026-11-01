-- =============================================================================
-- SOS MOBILITÉ — Fonctions utilitaires et déclencheurs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();
create trigger service_categories_touch before update on public.service_categories
  for each row execute function public.touch_updated_at();
create trigger mechanic_profiles_touch before update on public.mechanic_profiles
  for each row execute function public.touch_updated_at();
create trigger service_requests_touch before update on public.service_requests
  for each row execute function public.touch_updated_at();
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rôles & autorisations
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Vrai si l'utilisateur courant est administrateur d'un niveau >= p_min.
create or replace function public.is_admin(p_min public.admin_level default 'support')
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and not is_suspended
      and admin_level >= p_min
  );
$$;

-- Lève une erreur si l'utilisateur n'est pas connecté, est suspendu,
-- ou n'a pas le rôle attendu. Retourne l'identifiant de l'utilisateur.
create or replace function public.require_role(p_role public.user_role)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000', hint = 'Connexion requise.';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.is_suspended then
    raise exception 'ACCOUNT_SUSPENDED' using errcode = '42501', hint = 'Votre compte est suspendu. Contactez le support.';
  end if;
  if v_profile.role <> p_role then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501', hint = 'Action réservée à un autre type de compte.';
  end if;
  return v_uid;
end;
$$;

create or replace function public.require_admin(p_min public.admin_level)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(p_min) then
    raise exception 'FORBIDDEN_ADMIN' using errcode = '42501', hint = 'Niveau d''autorisation administrateur insuffisant.';
  end if;
  return auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------------
create or replace function public.setting_numeric(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select (value #>> '{}')::numeric from public.platform_settings where key = p_key), p_default);
$$;

-- ---------------------------------------------------------------------------
-- Géographie : distance orthodromique (formule de haversine), en km
-- ---------------------------------------------------------------------------
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select 2 * 6371.0088 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------------------------------------------------------------------------
-- Notifications internes
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_type text, p_title text,
                                              p_body text default null, p_request uuid default null)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, type, title, body, request_id)
  values (p_user, p_type, p_title, p_body, p_request);
$$;

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- Le rôle 'admin' ne peut JAMAIS être obtenu via les métadonnées d'inscription.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role := case when v_meta->>'role' = 'mechanic' then 'mechanic'::public.user_role
                                  else 'client'::public.user_role end;
  v_phone text := nullif(trim(coalesce(v_meta->>'phone', new.phone, '')), '');
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{8,20}$' then
    v_phone := null;
  end if;

  insert into public.profiles (id, role, full_name, phone, email, commune)
  values (
    new.id,
    v_role,
    left(coalesce(nullif(trim(v_meta->>'full_name'), ''), ''), 120),
    v_phone,
    new.email,
    left(nullif(trim(v_meta->>'commune'), ''), 80)
  );

  if v_role = 'mechanic' then
    insert into public.mechanic_profiles (id, business_name, commune)
    values (
      new.id,
      left(coalesce(nullif(trim(v_meta->>'business_name'), ''), ''), 120),
      left(nullif(trim(v_meta->>'commune'), ''), 80)
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Références lisibles
-- ---------------------------------------------------------------------------
create or replace function public.next_request_reference()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select 'SOS-' || to_char(now() at time zone 'Africa/Abidjan', 'YYMMDD') || '-' ||
         lpad(nextval('public.request_ref_seq')::text, 5, '0');
$$;

create or replace function public.next_receipt_number()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select 'REC-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-' ||
         lpad(nextval('public.receipt_seq')::text, 6, '0');
$$;

-- Code à 4 chiffres issu d'un générateur aléatoire robuste (gen_random_uuid).
create or replace function public.random_4_digits()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int) % 10000)::text, 4, '0');
$$;

-- ---------------------------------------------------------------------------
-- Historique automatique des statuts
-- La note éventuelle est transmise via le paramètre de session app.status_note.
-- ---------------------------------------------------------------------------
create or replace function public.log_request_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_history (request_id, from_status, to_status, changed_by, note)
    values (new.id, null, new.status, auth.uid(), nullif(current_setting('app.status_note', true), ''));
  elsif new.status is distinct from old.status then
    insert into public.status_history (request_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), nullif(current_setting('app.status_note', true), ''));
  end if;
  return new;
end;
$$;

create trigger service_requests_status_log
  after insert or update of status on public.service_requests
  for each row execute function public.log_request_status();

-- ---------------------------------------------------------------------------
-- Note moyenne des mécaniciens
-- ---------------------------------------------------------------------------
create or replace function public.refresh_mechanic_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mechanic uuid := coalesce(new.mechanic_id, old.mechanic_id);
begin
  update public.mechanic_profiles m
     set rating_avg = coalesce(s.avg_rating, 0),
         rating_count = coalesce(s.cnt, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as cnt
        from public.reviews
       where mechanic_id = v_mechanic and not is_hidden
    ) s
   where m.id = v_mechanic;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_mechanic_rating();

-- ---------------------------------------------------------------------------
-- Cohérence : le propriétaire d'un entretien = propriétaire du véhicule
-- ---------------------------------------------------------------------------
create or replace function public.check_maintenance_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.owner_id = new.owner_id) then
    raise exception 'VEHICLE_NOT_OWNED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger maintenance_owner_check
  before insert or update on public.maintenance_records
  for each row execute function public.check_maintenance_owner();

-- Fonctions internes : pas d'appel direct depuis l'API
revoke execute on function public.notify_user(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.next_request_reference() from public, anon, authenticated;
revoke execute on function public.next_receipt_number() from public, anon, authenticated;
revoke execute on function public.random_4_digits() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_request_status() from public, anon, authenticated;
revoke execute on function public.refresh_mechanic_rating() from public, anon, authenticated;
revoke execute on function public.require_role(public.user_role) from public, anon;
revoke execute on function public.require_admin(public.admin_level) from public, anon;
revoke execute on function public.setting_numeric(text, numeric) from public, anon;
