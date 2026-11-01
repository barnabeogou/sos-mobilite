-- =============================================================================
-- SOS MOBILITÉ — Stockage (Supabase Storage) et temps réel
-- Convention de chemin : <bucket>/<uid de l'auteur>/<fichier>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-photos', 'request-photos', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('mechanic-documents', 'mechanic-documents', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Accès aux photos de panne : auteur, administrateurs, mécanicien attribué
-- ou mécanicien à qui la demande est actuellement proposée.
create or replace function public.can_view_request_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin('support') or exists (
    select 1 from public.service_requests r
     where p_path = any (r.photos)
       and (r.assigned_mechanic_id = auth.uid()
            or exists (select 1 from public.assignments a
                        where a.request_id = r.id and a.mechanic_id = auth.uid()
                          and a.status = 'proposed' and a.expires_at > now()))
  );
$$;
revoke execute on function public.can_view_request_photo(text) from public, anon;
grant execute on function public.can_view_request_photo(text) to authenticated;

-- Photos de panne
create policy request_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy request_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'request-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.can_view_request_photo(name)));
create policy request_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Documents justificatifs des professionnels
create policy mechanic_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mechanic-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy mechanic_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'mechanic-documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin('operations')));
create policy mechanic_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mechanic-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Photos de profil (bucket public en lecture)
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Temps réel : les changements respectent les politiques RLS ci-dessus.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.notifications, public.service_requests, public.assignments, public.quotes, public.payments;
  end if;
end;
$$;
