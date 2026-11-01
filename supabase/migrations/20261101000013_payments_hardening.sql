-- SOS MOBILITÉ — Paiements en ligne (3) : relances, tentatives multiples, garde-fous.

-- Un versement relancé (en attente ou en échec) part sur le compte ACTUEL du profil :
-- si le pro corrige un numéro refusé, la relance ne doit pas réutiliser l'ancien.
create or replace function public.claim_payout(p_payout_id uuid)
returns public.payouts
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.payouts p
     set status = 'processing', attempts = p.attempts + 1, failure_reason = null,
         method = coalesce(m.payout_method, p.method), phone = coalesce(m.payout_phone, p.phone)
    from public.mechanic_profiles m
   where m.id = p.mechanic_id and p.id = p_payout_id and p.status in ('pending', 'failed') and p.amount > 0
     and coalesce(m.payout_method, p.method) is not null and coalesce(m.payout_phone, p.phone) is not null
  returning p.*;
$$;

revoke execute on function public.claim_payout(uuid) from public, anon, authenticated;
grant execute on function public.claim_payout(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Historique des références de paiement : un client qui relance le paiement ne doit pas
-- perdre la trace de la première tentative si elle aboutit finalement.
-- ---------------------------------------------------------------------------
create table public.payment_attempts (
  reference text primary key,
  payment_id uuid not null references public.payments (id) on delete cascade,
  amount int not null,
  created_at timestamptz not null default now(),
  duplicate_reported_at timestamptz
);
create index payment_attempts_payment_idx on public.payment_attempts (payment_id);
alter table public.payment_attempts enable row level security;
create policy payment_attempts_admin_read on public.payment_attempts
  for select to authenticated using (public.is_admin('support'));
revoke all on public.payment_attempts from anon, authenticated;
grant select on public.payment_attempts to authenticated;

create or replace function public.track_payment_attempt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.provider_reference is not null
     and (tg_op = 'INSERT' or new.provider_reference is distinct from old.provider_reference) then
    insert into public.payment_attempts (reference, payment_id, amount)
    values (new.provider_reference, new.id, new.amount)
    on conflict (reference) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.track_payment_attempt() from public, anon, authenticated;

create trigger payments_track_attempt
  after insert or update of provider_reference on public.payments
  for each row execute function public.track_payment_attempt();

insert into public.payment_attempts (reference, payment_id, amount)
select provider_reference, id, amount from public.payments where provider_reference is not null
on conflict (reference) do nothing;

create or replace function public.confirm_online_payment(p_reference text, p_amount int, p_method public.payment_method,
                                                         p_provider_tx text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pay public.payments;
  v_attempt public.payment_attempts;
  v_req public.service_requests;
  v_mech public.mechanic_profiles;
  v_mech_profile public.profiles;
  v_payout public.payouts;
  v_debt record;
  v_deducted int := 0;
  v_raw int;
  v_amount int;
begin
  select * into v_pay from public.payments where provider_reference = p_reference for update;
  if found then
    select a.* into v_attempt from public.payment_attempts a where a.reference = p_reference for update;
  else
    -- Ancienne tentative : le client avait relancé le paiement, puis a finalement validé la première.
    select a.* into v_attempt from public.payment_attempts a where a.reference = p_reference for update;
    if not found then
      perform public.notify_admins('operations', 'payment_unknown', 'Paiement reçu sans correspondance',
        'Le prestataire signale ' || coalesce(p_amount, 0) || ' FCFA (réf. ' || p_reference || ') sans paiement correspondant.', null);
      return jsonb_build_object('status', 'not_found');
    end if;
    select * into v_pay from public.payments where id = v_attempt.payment_id for update;
    if v_pay.status <> 'confirmed' then
      update public.payments set provider_reference = p_reference where id = v_pay.id returning * into v_pay;
    end if;
  end if;

  -- Déjà réglé autrement (autre tentative en ligne ou paiement direct) : le client a payé deux fois.
  if v_pay.status = 'confirmed' and (v_pay.provider_reference is distinct from p_reference or v_pay.channel = 'direct') then
    if v_attempt.duplicate_reported_at is null then
      update public.payment_attempts set duplicate_reported_at = now() where reference = p_reference;
      perform public.notify_admins('operations', 'payment_duplicate', 'Paiement en double à rembourser',
        'Le client a réglé deux fois l''intervention : ' || coalesce(p_amount, 0) || ' FCFA en ligne (réf. ' || p_reference
        || ') en plus du paiement ' || coalesce(v_pay.receipt_number, 'déjà confirmé') || '. À rembourser.', v_pay.request_id);
    end if;
    return jsonb_build_object('status', 'duplicate', 'payment_id', v_pay.id);
  end if;
  if v_pay.status = 'declared' then
    perform public.notify_admins('operations', 'payment_check_double', 'Paiement à vérifier',
      'Paiement en ligne reçu (réf. ' || p_reference || ') alors que le professionnel avait déclaré un paiement direct. '
      || 'Vérifiez que le client n''a pas payé deux fois.', v_pay.request_id);
  end if;

  if v_pay.status = 'confirmed' then
    select * into v_payout from public.payouts where payment_id = v_pay.id;
  else
    if v_pay.status not in ('pending', 'failed', 'declared') then
      raise exception 'PAYMENT_LOCKED' using hint = 'Ce paiement est en litige ou remboursé.';
    end if;
    if p_amount is distinct from v_pay.amount then
      update public.payments set status = 'failed', failure_reason = 'Montant reçu différent du montant dû (' || coalesce(p_amount, 0) || ' FCFA)'
       where id = v_pay.id;
      perform public.notify_admins('operations', 'payment_amount_mismatch', 'Paiement à vérifier',
        'Montant reçu ' || coalesce(p_amount, 0) || ' FCFA au lieu de ' || v_pay.amount || ' FCFA (réf. ' || p_reference || ').',
        v_pay.request_id);
      return jsonb_build_object('status', 'amount_mismatch', 'payment_id', v_pay.id);
    end if;

    select * into v_req from public.service_requests where id = v_pay.request_id for update;
    update public.payments
       set status = 'confirmed', channel = 'online', method = coalesce(p_method, 'other'),
           provider_transaction_id = p_provider_tx, provider_status = 'ACCEPTED', failure_reason = null,
           confirmed_at = now(), receipt_number = coalesce(receipt_number, public.next_receipt_number()),
           commission_settled_at = now(), commission_settlement_note = 'Retenue lors du paiement en ligne'
     where id = v_pay.id returning * into v_pay;

    if v_req.status in ('completed', 'disputed') then
      perform public.set_status_note('Paiement en ligne reçu (' || p_reference || ')');
      update public.service_requests set status = 'paid', paid_at = coalesce(paid_at, now()) where id = v_req.id;
      if v_req.paid_at is null then
        update public.mechanic_profiles set completed_missions = completed_missions + 1 where id = v_pay.mechanic_id;
      end if;
    end if;

    -- Reversement au professionnel, déduction faite des commissions dues sur ses paiements en espèces.
    select * into v_mech from public.mechanic_profiles where id = v_pay.mechanic_id;
    insert into public.payouts (payment_id, mechanic_id, gross_amount, amount, method, phone)
    values (v_pay.id, v_pay.mechanic_id, v_pay.mechanic_net, 0, v_mech.payout_method, v_mech.payout_phone)
    returning * into v_payout;

    for v_debt in
      select id, commission_amount from public.payments
       where mechanic_id = v_pay.mechanic_id and channel = 'direct' and status = 'confirmed'
         and commission_settled_at is null and commission_amount > 0
       order by confirmed_at
       for update
    loop
      exit when v_deducted + v_debt.commission_amount > v_pay.mechanic_net;
      v_deducted := v_deducted + v_debt.commission_amount;
      update public.payments
         set commission_settled_at = now(), commission_settled_by = v_payout.id,
             commission_settlement_note = 'Déduite du versement de l''intervention ' || v_req.reference
       where id = v_debt.id;
    end loop;

    v_raw := v_pay.mechanic_net - v_deducted;
    v_amount := v_raw - (v_raw % 5);
    update public.payouts
       set deducted_commissions = v_deducted, rounding_amount = v_raw - v_amount, amount = v_amount,
           status = case when v_amount = 0 then 'not_required' else 'pending' end,
           failure_reason = case when v_amount > 0 and (v_mech.payout_method is null or v_mech.payout_phone is null)
                                 then 'PAYOUT_ACCOUNT_MISSING' end
     where id = v_payout.id returning * into v_payout;

    perform public.notify_user(v_pay.client_id, 'payment_confirmed', 'Paiement reçu',
      'Merci ! ' || v_pay.amount || ' FCFA réglés dans l''application. Reçu ' || v_pay.receipt_number || '.', v_pay.request_id);
    perform public.notify_user(v_pay.mechanic_id, 'payment_confirmed', 'Le client a payé dans l''application',
      v_pay.amount || ' FCFA reçus. Votre versement : ' || v_payout.amount || ' FCFA'
      || case when v_deducted > 0 then ' (commissions espèces de ' || v_deducted || ' FCFA déduites)' else '' end || '.',
      v_pay.request_id);
    if v_payout.failure_reason = 'PAYOUT_ACCOUNT_MISSING' then
      perform public.notify_user(v_pay.mechanic_id, 'payout_account_missing', 'Renseignez votre compte de versement',
        'Ajoutez votre numéro Mobile Money dans « Mon profil » pour recevoir ' || v_payout.amount || ' FCFA.', v_pay.request_id);
      perform public.notify_admins('operations', 'payout_account_missing', 'Versement en attente',
        'Le professionnel n''a pas de compte de versement (' || v_payout.amount || ' FCFA).', v_pay.request_id);
    end if;
  end if;

  select * into v_mech_profile from public.profiles where id = v_pay.mechanic_id;
  return jsonb_build_object(
    'status', 'confirmed',
    'payment_id', v_pay.id,
    'receipt_number', v_pay.receipt_number,
    'payout', case when v_payout.id is null then null else jsonb_build_object(
      'id', v_payout.id, 'amount', v_payout.amount, 'status', v_payout.status, 'method', v_payout.method,
      'phone', v_payout.phone, 'failure_reason', v_payout.failure_reason,
      'name', v_mech_profile.full_name, 'email', v_mech_profile.email) end
  );
end;
$$;

revoke execute on function public.confirm_online_payment(text, int, public.payment_method, text) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, int, public.payment_method, text) to service_role;

-- ---------------------------------------------------------------------------
-- L'administration ne « confirme » pas à la main un paiement en ligne non vérifié.
-- ---------------------------------------------------------------------------
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
  if p_status in ('pending', 'failed') then
    raise exception 'INVALID_STATUS' using hint = 'Ce statut est réservé au paiement en ligne.';
  end if;
  if v_pay.channel = 'online' and v_pay.status in ('pending', 'failed') and p_status = 'confirmed' then
    raise exception 'ONLINE_PAYMENT_NOT_VERIFIED'
      using hint = 'Un paiement en ligne est confirmé par le prestataire : utilisez le bouton « Vérifier ».';
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

revoke execute on function public.admin_resolve_payment(uuid, public.payment_status, text) from public, anon;
grant execute on function public.admin_resolve_payment(uuid, public.payment_status, text) to authenticated;
