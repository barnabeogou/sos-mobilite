/**
 * Edge Function « payments » — paiement en ligne et reversements (CinetPay).
 *
 * Routes :
 *   GET  /payments/status            → le prestataire est-il configuré ? (aucun secret renvoyé)
 *   POST /payments/checkout          → { request_id } — client connecté : crée le paiement et renvoie l'URL du guichet
 *   GET|POST /payments/notify        → notification CinetPay : x-token vérifié, statut CONTRÔLÉ auprès de CinetPay
 *   GET|POST /payments/return        → retour du client depuis le guichet : contrôle du statut puis redirection vers l'app
 *   POST /payments/verify            → { payment_id } — client concerné ou administration : recontrôle auprès de CinetPay
 *   POST /payments/transfer-notify   → notification de transfert : statut contrôlé auprès de CinetPay
 *   POST /payments/payout-retry      → { payout_id } — pro concerné ou administration (opérations+)
 *
 * Secrets (Supabase → Edge Functions → Secrets) : CINETPAY_API_KEY, CINETPAY_SITE_ID,
 * CINETPAY_SECRET_KEY, CINETPAY_TRANSFER_PASSWORD (facultatif), APP_URL (facultatif).
 * Déployée sans vérification JWT automatique : chaque route vérifie elle-même l'appelant.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.46.1';
import * as cp from '../_shared/cinetpay.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://sos-mobilite.netlify.app').replace(/\/$/, '');
const FUNCTIONS_URL = (Deno.env.get('PUBLIC_FUNCTIONS_URL') ?? `${SUPABASE_URL}/functions/v1`).replace(/\/$/, '');
const cfg = cp.readConfig((k) => Deno.env.get(k));
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const fail = (status: number, code: string, message: string) => json(status, { code, message });
const log = (...args: unknown[]) => console.log('[payments]', ...args);

function userClient(req: Request): SupabaseClient | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readFields(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? '';
  const raw = await req.text();
  if (type.includes('application/json')) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? '' : String(v)]));
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ code: String(r.status), message: 'Réponse illisible du prestataire' }));
}

async function postForm(url: string, fields: Record<string, string>): Promise<unknown> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: cp.formBody(fields),
  });
  return r.json().catch(() => ({ code: String(r.status), message: 'Réponse illisible du prestataire' }));
}

// ---------------------------------------------------------------------------
// Paiement
// ---------------------------------------------------------------------------
async function checkout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
  const user = userClient(req);
  if (!user) return fail(401, 'AUTH_REQUIRED', 'Veuillez vous connecter pour continuer.');
  if (!cfg) return fail(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Le paiement en ligne n’est pas encore branché. Réglez le professionnel directement.');

  const { request_id } = (await req.json().catch(() => ({}))) as { request_id?: string };
  if (!request_id) return fail(400, 'REQUEST_REQUIRED', 'Demande manquante.');

  const { data: intent, error } = await user.rpc('start_online_payment', { p_request_id: request_id });
  if (error) return fail(400, error.message, error.hint ?? 'Paiement impossible pour le moment.');
  const p = intent as {
    reference: string;
    amount: number;
    description: string;
    request_id: string;
    customer: { id: string; full_name: string | null; phone: string | null; email: string | null };
  };

  const body = cp.buildInitBody(cfg, {
    reference: p.reference,
    amount: p.amount,
    description: p.description,
    notifyUrl: `${FUNCTIONS_URL}/payments/notify`,
    // Le guichet peut revenir en POST : on passe par la fonction, qui redirige ensuite vers l'application.
    returnUrl: `${FUNCTIONS_URL}/payments/return?ref=${encodeURIComponent(p.reference)}&request=${encodeURIComponent(p.request_id)}`,
    requestId: p.request_id,
    customer: p.customer,
  });
  const res = (await postJson(`${cfg.checkoutBase}/v2/payment`, body)) as { code?: string; message?: string; description?: string; data?: { payment_url?: string; payment_token?: string } };
  if (String(res.code) !== '201' || !res.data?.payment_url) {
    log('init refusée', p.reference, res.code, res.message);
    await admin.rpc('fail_online_payment', { p_reference: p.reference, p_reason: `Initialisation refusée : ${res.message ?? res.code}` });
    return fail(502, 'PROVIDER_ERROR', 'Le service de paiement est momentanément indisponible. Réessayez dans un instant ou réglez le professionnel directement.');
  }
  await admin.rpc('record_payment_session', { p_reference: p.reference, p_token: res.data.payment_token ?? null });
  return json(200, { payment_url: res.data.payment_url, reference: p.reference });
}

async function notify(req: Request): Promise<Response> {
  // CinetPay vérifie d'abord la disponibilité de l'URL en GET.
  if (req.method === 'GET') return new Response('ok', { status: 200, headers: CORS });
  if (!cfg) return fail(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Prestataire non configuré.');
  const fields = await readFields(req);
  const reference = fields.cpm_trans_id;
  if (!reference) return new Response('ok', { status: 200 });

  if (cfg.secretKey && !(await cp.verifyXToken(fields, req.headers.get('x-token'), cfg.secretKey))) {
    log('x-token invalide', reference);
    return new Response('invalid token', { status: 401 });
  }
  if (fields.cpm_site_id && fields.cpm_site_id !== cfg.siteId) return new Response('ok', { status: 200 });

  await settlePayment(reference);
  return new Response('ok', { status: 200 });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retour du guichet : on contrôle (sans rien croire de la requête) puis on renvoie le client vers son suivi. */
async function paymentReturn(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ref = url.searchParams.get('ref') ?? '';
  const requestId = url.searchParams.get('request') ?? '';
  const target = UUID_RE.test(requestId) ? `${APP_URL}/client/demandes/${requestId}?paiement=retour` : `${APP_URL}/client/demandes`;
  try {
    if (cfg && /^SOSPAY[A-Z0-9]{6,30}$/.test(ref)) {
      const { data } = await admin.from('payments').select('status').eq('provider_reference', ref).maybeSingle();
      if (data?.status === 'pending') await settlePayment(ref);
    }
  } catch (e) {
    log('retour', ref, (e as Error).message);
  }
  return new Response(null, { status: 303, headers: { Location: target, 'Cache-Control': 'no-store' } });
}

/** Recontrôle manuel d'un paiement en attente (notification perdue ou retardée). */
async function verify(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
  const user = userClient(req);
  if (!user) return fail(401, 'AUTH_REQUIRED', 'Veuillez vous connecter pour continuer.');
  const { payment_id } = (await req.json().catch(() => ({}))) as { payment_id?: string };
  if (!payment_id || !UUID_RE.test(payment_id)) return fail(400, 'PAYMENT_REQUIRED', 'Paiement manquant.');
  // La lecture passe par les droits de l'utilisateur : seul le client concerné ou l'équipe voit ce paiement.
  const { data: pay } = await user.from('payments').select('id, status, channel, provider_reference').eq('id', payment_id).maybeSingle();
  if (!pay) return fail(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
  if (!cfg) return fail(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Le paiement en ligne n’est pas encore branché.');
  if (pay.channel === 'online' && ['pending', 'failed'].includes(pay.status) && pay.provider_reference) {
    await settlePayment(pay.provider_reference);
  }
  const { data: after } = await admin.from('payments').select('status, failure_reason').eq('id', payment_id).maybeSingle();
  return json(200, { status: after?.status ?? pay.status, failure_reason: after?.failure_reason ?? null });
}

/** Contrôle le statut auprès de CinetPay puis confirme, refuse ou attend. */
async function settlePayment(reference: string) {
  if (!cfg) return;
  const check = await postJson(`${cfg.checkoutBase}/v2/payment/check`, { apikey: cfg.apiKey, site_id: cfg.siteId, transaction_id: reference });
  const outcome = cp.interpretCheck(check);
  log('contrôle', reference, outcome.kind);
  if (outcome.kind === 'refused') {
    await admin.rpc('fail_online_payment', { p_reference: reference, p_reason: outcome.reason });
    return;
  }
  if (outcome.kind !== 'accepted') return;

  const { data, error } = await admin.rpc('confirm_online_payment', {
    p_reference: reference,
    p_amount: outcome.amount,
    p_method: outcome.method,
    p_provider_tx: outcome.operatorId,
  });
  if (error) {
    log('confirmation impossible', reference, error.message);
    return;
  }
  const result = data as { status?: string; payout?: { id: string; status: string; failure_reason: string | null } | null } | null;
  if (result?.status && result.status !== 'confirmed') log('confirmation', reference, result.status);
  const payout = result?.payout;
  if (payout && payout.status === 'pending' && !payout.failure_reason) await processPayout(payout.id);
}

// ---------------------------------------------------------------------------
// Reversement au professionnel
// ---------------------------------------------------------------------------
async function transferToken(): Promise<string | null> {
  if (!cfg?.transferPassword) return null;
  const res = (await postForm(`${cfg.transferBase}/v1/auth/login?lang=fr`, { apikey: cfg.apiKey, password: cfg.transferPassword })) as {
    code?: number | string;
    data?: { token?: string };
  };
  return String(res.code) === '0' && res.data?.token ? res.data.token : null;
}

async function processPayout(payoutId: string): Promise<string> {
  if (!cfg?.transferPassword) return 'manual'; // reversement à effectuer depuis l'administration
  const { data: claimed, error } = await admin.rpc('claim_payout', { p_payout_id: payoutId });
  const payout = claimed as { id: string; amount: number; method: string; phone: string; mechanic_id: string } | null;
  if (error || !payout?.id) return 'not_claimable';

  const record = (status: string, ref: string | null, providerStatus: string | null, reason: string | null) =>
    admin.rpc('record_payout_result', { p_payout_id: payout.id, p_status: status, p_provider_reference: ref, p_provider_status: providerStatus, p_reason: reason });

  try {
    const phone = cp.splitPhone(payout.phone);
    if (!phone) {
      await record('failed', null, null, 'Numéro de versement invalide');
      return 'failed';
    }
    const token = await transferToken();
    if (!token) {
      await record('failed', null, null, 'Connexion à l’API de transfert refusée');
      return 'failed';
    }
    const { data: prof } = await admin.from('profiles').select('full_name, email').eq('id', payout.mechanic_id).maybeSingle();
    const { name, surname } = cp.splitName(prof?.full_name ?? null);
    const q = `?token=${encodeURIComponent(token)}&lang=fr`;
    // Ajout du contact (sans effet s'il existe déjà).
    await postForm(`${cfg.transferBase}/v1/transfer/contact${q}`, {
      data: JSON.stringify([{ prefix: phone.prefix, phone: phone.phone, name, surname, email: prof?.email ?? '' }]),
    });
    const item: Record<string, unknown> = {
      prefix: phone.prefix,
      phone: phone.phone,
      amount: payout.amount,
      notify_url: `${FUNCTIONS_URL}/payments/transfer-notify`,
      client_transaction_id: payout.id,
    };
    const method = cp.transferPaymentMethod(payout.method);
    if (method) item.payment_method = method;
    const sent = cp.interpretTransfer(await postForm(`${cfg.transferBase}/v1/transfer/money/send/contact${q}`, { data: JSON.stringify([item]) }));
    await record(sent.status, sent.providerReference, sent.providerStatus, sent.reason);
    return sent.status;
  } catch (e) {
    await record('failed', null, null, `Erreur technique : ${(e as Error).message}`);
    return 'failed';
  }
}

async function transferNotify(req: Request): Promise<Response> {
  if (req.method === 'GET') return new Response('ok', { status: 200, headers: CORS });
  const fields = await readFields(req);
  const payoutId = fields.client_transaction_id;
  if (!payoutId || !cfg) return new Response('ok', { status: 200 });
  const token = await transferToken();
  if (!token) return new Response('ok', { status: 200 });
  const r = await fetch(
    `${cfg.transferBase}/v1/transfer/check/money?token=${encodeURIComponent(token)}&lang=fr&client_transaction_id=${encodeURIComponent(payoutId)}`,
  );
  const outcome = cp.interpretTransfer(await r.json().catch(() => ({})));
  if (outcome.status !== 'processing') {
    await admin.rpc('record_payout_result', {
      p_payout_id: payoutId,
      p_status: outcome.status,
      p_provider_reference: outcome.providerReference,
      p_provider_status: outcome.providerStatus,
      p_reason: outcome.reason,
    });
  }
  return new Response('ok', { status: 200 });
}

async function payoutRetry(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
  const user = userClient(req);
  if (!user) return fail(401, 'AUTH_REQUIRED', 'Veuillez vous connecter pour continuer.');
  const { payout_id } = (await req.json().catch(() => ({}))) as { payout_id?: string };
  if (!payout_id) return fail(400, 'PAYOUT_REQUIRED', 'Versement manquant.');
  const { data: allowed, error } = await user.rpc('can_retry_payout', { p_payout_id: payout_id });
  if (error || !allowed) return fail(403, 'FORBIDDEN', 'Action non autorisée.');
  if (!cfg?.transferPassword) return json(200, { status: 'manual', message: 'Les virements automatiques ne sont pas encore activés : le versement sera fait par l’administration.' });
  return json(200, { status: await processPayout(payout_id) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const route = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop();
  try {
    switch (route) {
      case 'status':
        return json(200, { online_payment: Boolean(cfg), automatic_payouts: Boolean(cfg?.transferPassword), notify_token_check: Boolean(cfg?.secretKey) });
      case 'checkout':
        return await checkout(req);
      case 'notify':
        return await notify(req);
      case 'return':
        return await paymentReturn(req);
      case 'verify':
        return await verify(req);
      case 'transfer-notify':
        return await transferNotify(req);
      case 'payout-retry':
        return await payoutRetry(req);
      default:
        return fail(404, 'NOT_FOUND', 'Route inconnue.');
    }
  } catch (e) {
    log('erreur', route, (e as Error).message);
    return fail(500, 'INTERNAL_ERROR', 'Erreur technique. Réessayez dans un instant.');
  }
});
