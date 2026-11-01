-- =============================================================================
-- SOS MOBILITÉ — Sécurité : privilèges et politiques Row Level Security
--
-- Principes :
--  * RLS activé sur toutes les tables.
--  * Les clients n'accèdent qu'à leurs propres informations.
--  * Les mécaniciens n'accèdent qu'aux missions qui leur sont attribuées
--    (les propositions passent par list_open_proposals, avec position approximative).
--  * Les administrateurs ont des autorisations par niveau (support < operations < super_admin).
--  * Aucune écriture directe sur les tables de workflow : uniquement via RPC.
-- =============================================================================

-- Point de départ : aucun privilège implicite pour les rôles de l'API.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.profiles             enable row level security;
alter table public.vehicles             enable row level security;
alter table public.maintenance_records  enable row level security;
alter table public.service_categories   enable row level security;
alter table public.mechanic_profiles    enable row level security;
alter table public.mechanic_specialties enable row level security;
alter table public.mechanic_documents   enable row level security;
alter table public.service_requests     enable row level security;
alter table public.request_arrival_codes enable row level security;
alter table public.assignments          enable row level security;
alter table public.quotes               enable row level security;
alter table public.status_history       enable row level security;
alter table public.payments             enable row level security;
alter table public.reviews              enable row level security;
alter table public.notifications        enable row level security;
alter table public.support_tickets      enable row level security;
alter table public.platform_settings    enable row level security;

-- ---------------------------------------------------------------------------
-- Fonctions d'aide aux politiques (SECURITY DEFINER pour éviter la récursion RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_counterpart(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.service_requests r
     where r.assigned_mechanic_id is not null
       and ((r.client_id = auth.uid() and r.assigned_mechanic_id = p_other)
         or (r.assigned_mechanic_id = auth.uid() and r.client_id = p_other))
  );
$$;

create or replace function public.can_access_request(p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.service_requests r
     where r.id = p_request
       and (r.client_id = auth.uid() or r.assigned_mechanic_id = auth.uid())
  ) or public.is_admin('support');
$$;

create or replace function public.is_request_client(p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.service_requests r where r.id = p_request and r.client_id = auth.uid());
$$;

create or replace function public.is_vehicle_of_my_mission(p_vehicle uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.service_requests r
                  where r.vehicle_id = p_vehicle and r.assigned_mechanic_id = auth.uid());
$$;

revoke execute on function public.is_counterpart(uuid), public.can_access_request(uuid),
  public.is_request_client(uuid), public.is_vehicle_of_my_mission(uuid) from public, anon;
grant execute on function public.is_counterpart(uuid), public.can_access_request(uuid),
  public.is_request_client(uuid), public.is_vehicle_of_my_mission(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, city, commune, avatar_url) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin('support') or public.is_counterpart(id));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and not is_suspended)
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- vehicles & maintenance_records
-- ---------------------------------------------------------------------------
grant select, delete on public.vehicles to authenticated;
grant insert (owner_id, type, brand, model, year, plate, color, insurance_expires_at) on public.vehicles to authenticated;
grant update (type, brand, model, year, plate, color, insurance_expires_at) on public.vehicles to authenticated;

create policy vehicles_select on public.vehicles for select to authenticated
  using (owner_id = auth.uid() or public.is_admin('support') or public.is_vehicle_of_my_mission(id));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (owner_id = auth.uid());
create policy vehicles_update on public.vehicles for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vehicles_delete on public.vehicles for delete to authenticated
  using (owner_id = auth.uid());

grant select, delete on public.maintenance_records to authenticated;
grant insert (vehicle_id, owner_id, kind, performed_at, mileage_km, cost, next_due_at, notes)
  on public.maintenance_records to authenticated;
grant update (kind, performed_at, mileage_km, cost, next_due_at, notes) on public.maintenance_records to authenticated;

create policy maintenance_select on public.maintenance_records for select to authenticated
  using (owner_id = auth.uid() or public.is_admin('support'));
create policy maintenance_insert on public.maintenance_records for insert to authenticated
  with check (owner_id = auth.uid());
create policy maintenance_update on public.maintenance_records for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy maintenance_delete on public.maintenance_records for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- service_categories (catalogue public, gestion super_admin)
-- ---------------------------------------------------------------------------
grant select on public.service_categories to anon, authenticated;
grant insert, update, delete on public.service_categories to authenticated;

create policy categories_select_anon on public.service_categories for select to anon
  using (is_active);
create policy categories_select_auth on public.service_categories for select to authenticated
  using (is_active or public.is_admin('support'));
create policy categories_write on public.service_categories for insert to authenticated
  with check (public.is_admin('super_admin'));
create policy categories_update on public.service_categories for update to authenticated
  using (public.is_admin('super_admin')) with check (public.is_admin('super_admin'));
create policy categories_delete on public.service_categories for delete to authenticated
  using (public.is_admin('super_admin'));

-- ---------------------------------------------------------------------------
-- mechanic_profiles, spécialités, documents
-- ---------------------------------------------------------------------------
grant select on public.mechanic_profiles to authenticated;
grant update (business_name, kind, bio, years_experience, vehicle_types, service_radius_km,
              base_lat, base_lng, commune, address, opening_hours)
  on public.mechanic_profiles to authenticated;

create policy mechanic_profiles_select on public.mechanic_profiles for select to authenticated
  using (id = auth.uid() or public.is_admin('support') or public.is_counterpart(id));
create policy mechanic_profiles_update_own on public.mechanic_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.mechanic_specialties to authenticated;
create policy mechanic_specialties_select on public.mechanic_specialties for select to authenticated
  using (true);

grant select, delete on public.mechanic_documents to authenticated;
grant insert (mechanic_id, doc_type, storage_path) on public.mechanic_documents to authenticated;
create policy mechanic_documents_select on public.mechanic_documents for select to authenticated
  using (mechanic_id = auth.uid() or public.is_admin('operations'));
create policy mechanic_documents_insert on public.mechanic_documents for insert to authenticated
  with check (mechanic_id = auth.uid()
              and public.current_user_role() = 'mechanic'
              and position((auth.uid()::text || '/') in storage_path) = 1);
create policy mechanic_documents_delete on public.mechanic_documents for delete to authenticated
  using (mechanic_id = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------------
-- service_requests & workflow (lecture seule côté API)
-- ---------------------------------------------------------------------------
grant select on public.service_requests to authenticated;
create policy service_requests_select on public.service_requests for select to authenticated
  using (client_id = auth.uid() or assigned_mechanic_id = auth.uid() or public.is_admin('support'));

-- request_arrival_codes : aucun accès direct (voir get_arrival_code / verify_arrival_code)

grant select on public.assignments to authenticated;
create policy assignments_select on public.assignments for select to authenticated
  using (mechanic_id = auth.uid() or public.is_request_client(request_id) or public.is_admin('support'));

grant select on public.quotes to authenticated;
create policy quotes_select on public.quotes for select to authenticated
  using (mechanic_id = auth.uid() or public.is_request_client(request_id) or public.is_admin('support'));

grant select on public.status_history to authenticated;
create policy status_history_select on public.status_history for select to authenticated
  using (public.can_access_request(request_id));

grant select on public.payments to authenticated;
create policy payments_select on public.payments for select to authenticated
  using (client_id = auth.uid() or mechanic_id = auth.uid() or public.is_admin('support'));

grant select on public.reviews to authenticated;
create policy reviews_select on public.reviews for select to authenticated
  using (client_id = auth.uid() or mechanic_id = auth.uid() or public.is_admin('support'));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
grant select, delete on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
grant select on public.support_tickets to authenticated;
grant insert (created_by, request_id, category, subject, message) on public.support_tickets to authenticated;
create policy support_tickets_select on public.support_tickets for select to authenticated
  using (created_by = auth.uid() or public.is_admin('support'));
create policy support_tickets_insert on public.support_tickets for insert to authenticated
  with check (created_by = auth.uid()
              and (request_id is null or public.can_access_request(request_id))
              and not exists (select 1 from public.profiles where id = auth.uid() and is_suspended));

-- ---------------------------------------------------------------------------
-- platform_settings (lecture publique, écriture super_admin)
-- ---------------------------------------------------------------------------
grant select on public.platform_settings to anon, authenticated;
grant update (value) on public.platform_settings to authenticated;
create policy settings_select on public.platform_settings for select to anon, authenticated using (true);
create policy settings_update on public.platform_settings for update to authenticated
  using (public.is_admin('super_admin')) with check (public.is_admin('super_admin'));

create or replace function public.stamp_setting_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.stamp_setting_update() from public, anon, authenticated;
create trigger platform_settings_stamp before update on public.platform_settings
  for each row execute function public.stamp_setting_update();
