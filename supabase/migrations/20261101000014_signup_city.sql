-- SOS MOBILITÉ — couverture nationale : la ville choisie à l'inscription est enregistrée
-- (auparavant, toutes les inscriptions recevaient « Abidjan » par défaut).
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
  v_city text := coalesce(left(nullif(trim(v_meta->>'city'), ''), 80), 'Abidjan');
begin
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{8,20}$' then
    v_phone := null;
  end if;

  insert into public.profiles (id, role, full_name, phone, email, city, commune)
  values (
    new.id,
    v_role,
    left(coalesce(nullif(trim(v_meta->>'full_name'), ''), ''), 120),
    v_phone,
    new.email,
    v_city,
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
