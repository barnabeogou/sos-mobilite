-- SOS MOBILITÉ — Paiements en ligne (2b) : montants multiples de 5, espèces en secours, lancement du paiement.

-- ---------------------------------------------------------------------------
-- Montants payables : multiples de 5 FCFA (exigence des opérateurs)
-- ---------------------------------------------------------------------------
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
  if coalesce(p_labor, 0) % 5 <> 0 or coalesce(p_parts, 0) % 5 <> 0 or coalesce(p_travel, 0) % 5 <> 0 then
    raise exception 'INVALID_AMOUNT' using hint = 'Les montants doivent être des multiples de 5 FCFA (exigence du paiement mobile).';
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

create or replace function public.propose_price(p_quote_id uuid, p_amount int, p_message text default null)
returns public.price_offers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_quote public.quotes;
  v_req public.service_requests;
  v_accepted_total int;
  v_max int := public.setting_numeric('max_price_offers', 3)::int;
  v_ratio numeric := public.setting_numeric('min_offer_ratio', 0.5);
  v_floor int;
  v_used int;
  v_offer public.price_offers;
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
    raise exception 'INVALID_STATUS' using hint = 'Le prix ne peut plus être discuté à ce stade.';
  end if;
  if exists (select 1 from public.price_offers where quote_id = p_quote_id and status = 'pending') then
    raise exception 'OFFER_PENDING' using hint = 'Votre proposition attend déjà la réponse du professionnel.';
  end if;

  select count(*) into v_used from public.price_offers where request_id = v_req.id;
  if v_used >= v_max then
    raise exception 'OFFER_LIMIT'
      using hint = format('Vous avez déjà fait %s propositions de prix pour cette demande : acceptez ou refusez le devis.', v_max);
  end if;

  if p_amount is null or p_amount <= 0 or p_amount >= v_quote.total_amount then
    raise exception 'INVALID_AMOUNT' using hint = 'Proposez un montant inférieur à celui du devis.';
  end if;
  if p_amount % 5 <> 0 then
    raise exception 'INVALID_AMOUNT' using hint = 'Proposez un montant multiple de 5 FCFA.';
  end if;

  v_floor := ceil(v_quote.total_amount * v_ratio)::int;
  if v_req.status = 'in_progress' then
    select total_amount into v_accepted_total from public.quotes
     where request_id = v_req.id and status = 'accepted' order by version desc limit 1;
    if v_accepted_total is not null and p_amount <= v_accepted_total then
      raise exception 'INVALID_AMOUNT'
        using hint = format('Le nouveau total doit rester supérieur au devis déjà validé (%s FCFA).', v_accepted_total);
    end if;
  end if;
  if p_amount < v_floor then
    raise exception 'OFFER_TOO_LOW'
      using hint = format('Proposez au moins %s FCFA (%s %% du devis).', v_floor, round(v_ratio * 100));
  end if;

  insert into public.price_offers (request_id, quote_id, client_id, amount, message)
  values (v_req.id, p_quote_id, v_uid, p_amount, nullif(trim(p_message), ''))
  returning * into v_offer;

  perform public.notify_user(v_quote.mechanic_id, 'price_offer', 'Le client propose un autre prix',
    'Proposition : ' || p_amount || ' FCFA au lieu de ' || v_quote.total_amount || ' FCFA. Acceptez ou maintenez votre prix.',
    v_req.id);
  return v_offer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Espèces (secours) : le pro déclare, le client confirme. La déclaration
-- remplace un paiement en ligne commencé mais non abouti.
-- ---------------------------------------------------------------------------
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

  v_rate := public.commission_rate_for(v_uid);
  v_commission := round(v_quote.total_amount * v_rate)::int;

  insert into public.payments (request_id, client_id, mechanic_id, quote_id, amount, method,
                               commission_rate, commission_amount, mechanic_net)
  values (p_request_id, v_req.client_id, v_uid, v_quote.id, v_quote.total_amount, p_method,
          v_rate, v_commission, v_quote.total_amount - v_commission)
  on conflict (request_id) do update
     set method = excluded.method, quote_id = excluded.quote_id, amount = excluded.amount,
         commission_rate = excluded.commission_rate, commission_amount = excluded.commission_amount,
         mechanic_net = excluded.mechanic_net, declared_at = now(),
         status = 'declared', channel = 'direct', failure_reason = null
   where public.payments.status in ('declared', 'pending', 'failed')
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

-- ---------------------------------------------------------------------------
-- 1. Le client lance le paiement en ligne (appelé avec SON jeton par l'Edge Function)
-- ---------------------------------------------------------------------------
create or replace function public.start_online_payment(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('client');
  v_provider text := public.online_payment_provider();
  v_req public.service_requests;
  v_quote public.quotes;
  v_rate numeric;
  v_commission int;
  v_payment public.payments;
  v_client public.profiles;
  v_ref text := 'SOSPAY' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 14));
begin
  if v_provider is null then
    raise exception 'ONLINE_PAYMENT_DISABLED'
      using hint = 'Le paiement en ligne n''est pas encore disponible. Réglez le professionnel directement : il déclarera le paiement.';
  end if;
  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found or v_req.client_id <> v_uid then
    raise exception 'REQUEST_NOT_FOUND' using hint = 'Demande introuvable.';
  end if;
  if v_req.status <> 'completed' then
    raise exception 'INVALID_STATUS' using hint = 'Le paiement se fait une fois l''intervention terminée.';
  end if;
  select * into v_quote from public.quotes
   where request_id = p_request_id and status = 'accepted' order by version desc limit 1;
  if not found then
    raise exception 'NO_ACCEPTED_QUOTE' using hint = 'Aucun devis validé pour cette intervention.';
  end if;
  if v_quote.total_amount % 5 <> 0 then
    raise exception 'AMOUNT_NOT_PAYABLE'
      using hint = 'Ce montant ne peut pas être payé en ligne (multiple de 5 FCFA requis). Réglez le professionnel directement.';
  end if;

  if exists (select 1 from public.payments where request_id = p_request_id and status = 'declared') then
    raise exception 'PAYMENT_DECLARED'
      using hint = 'Le professionnel a déclaré un paiement en espèces : confirmez-le, ou signalez un problème si ce n''est pas le cas.';
  end if;

  v_rate := public.commission_rate_for(v_req.assigned_mechanic_id);
  v_commission := round(v_quote.total_amount * v_rate)::int;

  insert into public.payments (request_id, client_id, mechanic_id, quote_id, amount, method, status, channel,
                               provider, provider_reference, commission_rate, commission_amount, mechanic_net)
  values (p_request_id, v_uid, v_req.assigned_mechanic_id, v_quote.id, v_quote.total_amount, 'other', 'pending', 'online',
          v_provider, v_ref, v_rate, v_commission, v_quote.total_amount - v_commission)
  on conflict (request_id) do update
     set status = 'pending', channel = 'online', method = 'other', provider = excluded.provider,
         provider_reference = excluded.provider_reference, provider_token = null, provider_status = null,
         failure_reason = null, quote_id = excluded.quote_id, amount = excluded.amount,
         commission_rate = excluded.commission_rate, commission_amount = excluded.commission_amount,
         mechanic_net = excluded.mechanic_net, declared_at = now()
   where public.payments.status in ('pending', 'failed')
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'PAYMENT_LOCKED' using hint = 'Ce paiement a déjà été confirmé ou est en litige.';
  end if;

  select * into v_client from public.profiles where id = v_uid;
  return jsonb_build_object(
    'payment_id', v_payment.id,
    'reference', v_payment.provider_reference,
    'provider', v_provider,
    'amount', v_payment.amount,
    'currency', 'XOF',
    'request_id', v_req.id,
    'request_reference', v_req.reference,
    'description', 'Intervention ' || v_req.reference,
    'customer', jsonb_build_object('id', v_uid, 'full_name', v_client.full_name, 'phone', v_client.phone, 'email', v_client.email)
  );
end;
$$;

