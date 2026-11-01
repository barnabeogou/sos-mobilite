-- =============================================================================
-- SOS MOBILITÉ — Négociation du devis
--
-- Le client peut répondre à un devis (initial ou complémentaire) par une
-- contre-proposition de prix. Le professionnel peut alors :
--   * accepter ce prix : un nouveau devis « prix négocié » est créé et validé
--     d'office (les deux parties sont d'accord) ;
--   * maintenir son prix : le client garde le choix d'accepter le devis,
--     de refaire une proposition ou de refuser ;
--   * envoyer un nouveau montant (submit_quote) : la proposition en attente
--     est close et le client reçoit le nouveau devis.
-- Garde-fous : une proposition à la fois, au plus N propositions par demande,
-- montant inférieur au devis et au moins X % de celui-ci ; pour un supplément,
-- montant supérieur au devis déjà validé. Tout est historisé.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('max_price_offers', '3', 'Nombre maximal de contre-propositions de prix du client par demande'),
  ('min_offer_ratio', '0.5', 'Contre-proposition minimale du client, en part du devis (0.5 = 50 %)')
on conflict (key) do nothing;

create table public.price_offers (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.service_requests (id) on delete cascade,
  quote_id      uuid not null references public.quotes (id) on delete cascade,
  client_id     uuid not null references public.profiles (id),
  amount        int not null check (amount > 0),
  message       text check (message is null or char_length(message) <= 300),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);
create index price_offers_request_idx on public.price_offers (request_id, created_at desc);
create unique index price_offers_one_pending_idx on public.price_offers (quote_id) where status = 'pending';

-- Devis issu d'une négociation : lien vers la proposition acceptée.
alter table public.quotes add column offer_id uuid references public.price_offers (id);

-- Lecture : client de la demande, professionnel attribué, administration (support+). Aucune écriture directe.
alter table public.price_offers enable row level security;
revoke all on public.price_offers from public, anon, authenticated;
grant select on public.price_offers to authenticated;
create policy price_offers_select on public.price_offers for select to authenticated
  using (public.can_access_request(request_id));

-- Un devis qui n'est plus en attente clôt la proposition qui le visait.
create or replace function public.close_offers_on_quote_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'proposed' and new.status <> 'proposed' then
    update public.price_offers set status = 'cancelled', responded_at = now()
     where quote_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
create trigger quotes_close_offers
  after update of status on public.quotes
  for each row execute function public.close_offers_on_quote_change();
revoke execute on function public.close_offers_on_quote_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Client : proposer un autre prix
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Professionnel : accepter le prix du client ou maintenir son devis
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_price_offer(p_offer_id uuid, p_accept boolean)
returns public.service_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_role('mechanic');
  v_offer public.price_offers;
  v_quote public.quotes;
  v_req public.service_requests;
  v_version int;
begin
  select * into v_offer from public.price_offers where id = p_offer_id for update;
  if not found then
    raise exception 'OFFER_NOT_FOUND' using hint = 'Proposition introuvable.';
  end if;
  select * into v_req from public.service_requests where id = v_offer.request_id for update;
  if v_req.assigned_mechanic_id is distinct from v_uid then
    raise exception 'OFFER_NOT_FOUND' using hint = 'Proposition introuvable.';
  end if;
  select * into v_quote from public.quotes where id = v_offer.quote_id for update;
  if v_offer.status <> 'pending' or v_quote.status <> 'proposed' or v_req.status not in ('quoted', 'in_progress') then
    raise exception 'OFFER_CLOSED' using hint = 'Cette proposition n''est plus en attente.';
  end if;

  if p_accept then
    update public.price_offers set status = 'accepted', responded_at = now() where id = p_offer_id;
    update public.quotes set status = 'superseded', responded_at = now() where id = v_quote.id;
    update public.quotes set status = 'superseded' where request_id = v_req.id and status = 'accepted';
    select coalesce(max(version), 0) + 1 into v_version from public.quotes where request_id = v_req.id;
    insert into public.quotes (request_id, mechanic_id, version, labor_amount, parts_amount, travel_amount,
                               eta_minutes, notes, status, responded_at, offer_id)
    values (v_req.id, v_uid, v_version, v_offer.amount, 0, 0, v_quote.eta_minutes,
            'Prix négocié avec le client (devis n° ' || v_quote.version || ' : ' || v_quote.total_amount || ' FCFA).',
            'accepted', now(), p_offer_id);

    if v_req.status = 'quoted' then
      perform public.set_status_note('Prix négocié accepté : ' || v_offer.amount || ' FCFA');
      update public.service_requests set status = 'quote_accepted', quote_accepted_at = now()
       where id = v_req.id returning * into v_req;
    end if;
    perform public.notify_user(v_req.client_id, 'price_offer_accepted', 'Votre prix est accepté',
      'Le professionnel accepte ' || v_offer.amount || ' FCFA. '
      || case when v_req.status = 'in_progress' then 'Le supplément est validé à ce montant.'
              else 'Il peut maintenant se mettre en route.' end,
      v_req.id);
  else
    update public.price_offers set status = 'rejected', responded_at = now() where id = p_offer_id;
    perform public.notify_user(v_req.client_id, 'price_offer_rejected', 'Le professionnel maintient son prix',
      'Devis maintenu à ' || v_quote.total_amount || ' FCFA. Vous pouvez l''accepter, faire une autre proposition ou le refuser.',
      v_req.id);
  end if;
  return v_req;
end;
$$;

revoke execute on function public.propose_price(uuid, int, text), public.respond_to_price_offer(uuid, boolean)
  from public, anon;
grant execute on function public.propose_price(uuid, int, text), public.respond_to_price_offer(uuid, boolean)
  to authenticated;

-- Temps réel : la contre-proposition apparaît aussitôt chez l'autre partie (RLS appliquée).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.price_offers;
  end if;
end;
$$;
