-- SOS MOBILITÉ — Paiements en ligne (2c) : confirmation serveur, reversements, administration.

-- ---------------------------------------------------------------------------
-- 2. Fonctions serveur (service_role uniquement)
-- ---------------------------------------------------------------------------
create or replace function public.record_payment_session(p_reference text, p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.payments set provider_token = p_token
   where provider_reference = p_reference and status = 'pending';
$$;

create or replace function public.fail_online_payment(p_reference text, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pay public.payments;
begin
  update public.payments
     set status = 'failed', failure_reason = left(coalesce(p_reason, 'Paiement refusé'), 300), provider_status = 'REFUSED'
   where provider_reference = p_reference and status = 'pending'
  returning * into v_pay;
  if v_pay.id is not null then
    perform public.notify_user(v_pay.client_id, 'payment_failed', 'Paiement non abouti',
      'Le paiement de ' || v_pay.amount || ' FCFA n''a pas abouti. Vous pouvez réessayer depuis le suivi de votre demande.',
      v_pay.request_id);
  end if;
  return v_pay;
end;
$$;

/**
 * Confirmation d'un paiement en ligne, après vérification auprès du prestataire.
 * Idempotente : un second appel renvoie le même résultat sans rien modifier.
 */
create or replace function public.confirm_online_payment(p_reference text, p_amount int, p_method public.payment_method,
                                                         p_provider_tx text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pay public.payments;
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
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using hint = 'Paiement introuvable.';
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

-- Réserve un reversement avant l'appel au prestataire (évite un double envoi).
-- Le compte de versement est relu sur le profil s'il a été renseigné après le paiement.
create or replace function public.claim_payout(p_payout_id uuid)
returns public.payouts
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.payouts p
     set status = 'processing', attempts = p.attempts + 1, failure_reason = null,
         method = coalesce(p.method, m.payout_method), phone = coalesce(p.phone, m.payout_phone)
    from public.mechanic_profiles m
   where m.id = p.mechanic_id and p.id = p_payout_id and p.status in ('pending', 'failed') and p.amount > 0
     and coalesce(p.method, m.payout_method) is not null and coalesce(p.phone, m.payout_phone) is not null
  returning p.*;
$$;

-- Pour l'Edge Function : un utilisateur peut-il relancer ce versement ? (admin opérations+ ou le pro concerné)
create or replace function public.can_retry_payout(p_payout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.payouts where id = p_payout_id and mechanic_id = auth.uid())
      or public.is_admin('operations');
$$;
revoke execute on function public.can_retry_payout(uuid) from public, anon;
grant execute on function public.can_retry_payout(uuid) to authenticated;

create or replace function public.record_payout_result(p_payout_id uuid, p_status text, p_provider_reference text,
                                                       p_provider_status text, p_reason text)
returns public.payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.payouts;
begin
  if p_status not in ('processing', 'sent', 'failed') then
    raise exception 'INVALID_STATUS' using hint = 'Statut de versement invalide.';
  end if;
  update public.payouts
     set status = p_status,
         provider = coalesce(provider, 'cinetpay'),
         provider_reference = coalesce(p_provider_reference, provider_reference),
         provider_status = coalesce(p_provider_status, provider_status),
         failure_reason = case when p_status = 'failed' then left(coalesce(p_reason, 'Échec du versement'), 300) else null end,
         sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end
   where id = p_payout_id and status not in ('sent', 'cancelled')
  returning * into v_payout;

  if v_payout.id is not null and p_status = 'sent' then
    perform public.notify_user(v_payout.mechanic_id, 'payout_sent', 'Versement envoyé',
      v_payout.amount || ' FCFA envoyés sur votre compte ' || coalesce(v_payout.phone, '') || '.', null);
  elsif v_payout.id is not null and p_status = 'failed' then
    perform public.notify_admins('operations', 'payout_failed', 'Versement à reprendre',
      'Le versement de ' || v_payout.amount || ' FCFA a échoué : ' || coalesce(p_reason, 'motif inconnu') || '.', null);
  end if;
  return v_payout;
end;
$$;

revoke execute on function
  public.record_payment_session(text, text),
  public.fail_online_payment(text, text),
  public.confirm_online_payment(text, int, public.payment_method, text),
  public.claim_payout(uuid),
  public.record_payout_result(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.record_payment_session(text, text),
  public.fail_online_payment(text, text),
  public.confirm_online_payment(text, int, public.payment_method, text),
  public.claim_payout(uuid),
  public.record_payout_result(uuid, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Administration
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_payout_status(p_payout_id uuid, p_status text, p_note text)
returns public.payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_payout public.payouts;
begin
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using hint = 'Un motif est obligatoire.';
  end if;
  if p_status not in ('sent', 'cancelled', 'pending') then
    raise exception 'INVALID_STATUS' using hint = 'Statut de versement invalide.';
  end if;
  update public.payouts
     set status = p_status, note = trim(p_note),
         sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
         failure_reason = case when p_status = 'pending' then null else failure_reason end
   where id = p_payout_id and status <> 'sent'
  returning * into v_payout;
  if v_payout.id is null then
    raise exception 'PAYOUT_LOCKED' using hint = 'Ce versement est introuvable ou déjà envoyé.';
  end if;
  if p_status = 'sent' then
    perform public.notify_user(v_payout.mechanic_id, 'payout_sent', 'Versement envoyé',
      v_payout.amount || ' FCFA vous ont été versés.', null);
  end if;
  return v_payout;
end;
$$;

create or replace function public.admin_settle_commission(p_payment_id uuid, p_note text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := public.require_admin('operations');
  v_pay public.payments;
begin
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'REASON_REQUIRED' using hint = 'Un motif est obligatoire.';
  end if;
  update public.payments
     set commission_settled_at = now(), commission_settlement_note = trim(p_note)
   where id = p_payment_id and channel = 'direct' and status = 'confirmed' and commission_settled_at is null
  returning * into v_pay;
  if v_pay.id is null then
    raise exception 'NOTHING_TO_SETTLE' using hint = 'Aucune commission due sur ce paiement.';
  end if;
  return v_pay;
end;
$$;

revoke execute on function public.start_online_payment(uuid), public.admin_set_payout_status(uuid, text, text),
  public.admin_settle_commission(uuid, text) from public, anon;
grant execute on function public.start_online_payment(uuid), public.admin_set_payout_status(uuid, text, text),
  public.admin_settle_commission(uuid, text) to authenticated;

-- Temps réel : suivi du reversement côté pro.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.payouts;
  end if;
end;
$$;
