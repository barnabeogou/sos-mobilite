-- =============================================================================
-- SOS MOBILITÉ — Paiements en ligne (2/2)
--
--  * Le client paie dans l'application (Mobile Money, Wave, carte) via un
--    prestataire (CinetPay). Le paiement n'est confirmé QUE par le serveur,
--    après vérification auprès du prestataire (fonctions réservées à service_role,
--    appelées par l'Edge Function « payments »).
--  * Dès la confirmation, un reversement est créé pour le professionnel :
--    sa part (montant − commission), diminuée des commissions qu'il doit encore
--    sur des paiements en espèces, arrondie au multiple de 5 inférieur.
--  * Espèces en secours : le parcours « déclaré par le pro / confirmé par le
--    client » reste possible ; la commission est alors due par le pro.
--  * Aucune simulation : tant que `online_payment_provider` est null, le
--    paiement en ligne est indisponible.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('online_payment_provider', 'null', 'Prestataire de paiement en ligne activé ("cinetpay") ; null = paiement en ligne indisponible')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------
alter table public.payments
  add column channel text not null default 'direct' check (channel in ('direct', 'online')),
  add column provider text,
  add column provider_token text,
  add column provider_transaction_id text,
  add column provider_status text,
  add column failure_reason text,
  add column commission_settled_at timestamptz,
  add column commission_settlement_note text;
create unique index payments_provider_reference_idx on public.payments (provider_reference) where provider_reference is not null;

alter table public.mechanic_profiles
  add column payout_method public.payment_method
    check (payout_method is null or payout_method in ('orange_money', 'mtn_momo', 'moov_money', 'wave')),
  add column payout_phone text check (payout_phone is null or payout_phone ~ '^\+?[0-9 ]{8,20}$');
grant update (payout_method, payout_phone) on public.mechanic_profiles to authenticated;

create table public.payouts (
  id                    uuid primary key default gen_random_uuid(),
  payment_id            uuid not null unique references public.payments (id) on delete restrict,
  mechanic_id           uuid not null references public.mechanic_profiles (id),
  gross_amount          int not null check (gross_amount >= 0),
  deducted_commissions  int not null default 0 check (deducted_commissions >= 0),
  rounding_amount       int not null default 0 check (rounding_amount between 0 and 4),
  amount                int not null check (amount >= 0),
  method                public.payment_method,
  phone                 text,
  status                text not null default 'pending'
                        check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled', 'not_required')),
  provider              text,
  provider_reference    text,
  provider_status       text,
  failure_reason        text,
  attempts              int not null default 0,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  sent_at               timestamptz
);
create index payouts_mechanic_idx on public.payouts (mechanic_id, created_at desc);
create index payouts_status_idx on public.payouts (status, created_at desc);
create trigger payouts_touch before update on public.payouts for each row execute function public.touch_updated_at();

alter table public.payments add column commission_settled_by uuid references public.payouts (id);

alter table public.payouts enable row level security;
revoke all on public.payouts from public, anon, authenticated;
grant select on public.payouts to authenticated;
create policy payouts_select on public.payouts for select to authenticated
  using (mechanic_id = auth.uid() or public.is_admin('support'));

-- ---------------------------------------------------------------------------
-- Aides
-- ---------------------------------------------------------------------------
create or replace function public.commission_rate_for(p_mechanic uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case (select plan from public.mechanic_profiles where id = p_mechanic)
           when 'pro' then public.setting_numeric('commission_rate_pro', 0.05)
           else public.setting_numeric('commission_rate_starter', 0.12)
         end;
$$;
revoke execute on function public.commission_rate_for(uuid) from public, anon, authenticated;

create or replace function public.online_payment_provider()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value #>> '{}' from public.platform_settings where key = 'online_payment_provider';
$$;
revoke execute on function public.online_payment_provider() from public, anon, authenticated;

