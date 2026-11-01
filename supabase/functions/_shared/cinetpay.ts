/**
 * Adaptateur CinetPay — fonctions pures (sans accès réseau ni à Deno), testées par Vitest.
 *
 * Références :
 *  - Initialisation : POST {checkout}/v2/payment (JSON) → data.payment_url
 *  - Notification   : POST sur notify_url (formulaire), en-tête x-token = HMAC-SHA256(secret, champs concaténés)
 *  - Vérification   : POST {checkout}/v2/payment/check (JSON) — seule source de vérité du statut
 *  - Transfert      : {transfer}/v1/auth/login, /v1/transfer/contact, /v1/transfer/money/send/contact,
 *                     /v1/transfer/check/money (formulaire, champ `data` en JSON)
 */

export interface CinetPayConfig {
  apiKey: string;
  siteId: string;
  /** Clé secrète (menu « Intégrations ») pour vérifier le x-token des notifications. */
  secretKey: string | null;
  /** Mot de passe de l'API de transfert : sans lui, les reversements restent à faire depuis l'administration. */
  transferPassword: string | null;
  checkoutBase: string;
  transferBase: string;
}

export function readConfig(get: (key: string) => string | undefined): CinetPayConfig | null {
  const apiKey = get('CINETPAY_API_KEY')?.trim();
  const siteId = get('CINETPAY_SITE_ID')?.trim();
  if (!apiKey || !siteId) return null;
  return {
    apiKey,
    siteId,
    secretKey: get('CINETPAY_SECRET_KEY')?.trim() || null,
    transferPassword: get('CINETPAY_TRANSFER_PASSWORD')?.trim() || null,
    checkoutBase: (get('CINETPAY_CHECKOUT_URL') ?? 'https://api-checkout.cinetpay.com').replace(/\/$/, ''),
    transferBase: (get('CINETPAY_TRANSFER_URL') ?? 'https://client.cinetpay.com').replace(/\/$/, ''),
  };
}

/** CinetPay refuse certains caractères spéciaux dans la description. */
export function sanitizeDescription(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function splitName(fullName: string | null | undefined): { name: string; surname: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { name: 'Client', surname: 'SOS' };
  if (parts.length === 1) return { name: parts[0], surname: parts[0] };
  return { name: parts[0], surname: parts.slice(1).join(' ') };
}

/** « +225 07 00 00 00 01 » → { prefix: '225', phone: '0700000001' } (Côte d'Ivoire par défaut). */
export function splitPhone(raw: string | null | undefined): { prefix: string; phone: string } | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('225') && digits.length === 13) return { prefix: '225', phone: digits.slice(3) };
  if (digits.length === 10) return { prefix: '225', phone: digits };
  if (digits.length > 10) return { prefix: digits.slice(0, digits.length - 10), phone: digits.slice(-10) };
  return null;
}

export interface InitInput {
  reference: string;
  amount: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  requestId: string;
  customer: { id: string; full_name: string | null; phone: string | null; email: string | null };
}

export function buildInitBody(cfg: CinetPayConfig, p: InitInput): Record<string, unknown> {
  const { name, surname } = splitName(p.customer.full_name);
  const phone = splitPhone(p.customer.phone);
  return {
    apikey: cfg.apiKey,
    site_id: cfg.siteId,
    transaction_id: p.reference,
    amount: Math.round(p.amount),
    currency: 'XOF',
    description: sanitizeDescription(p.description),
    notify_url: p.notifyUrl,
    return_url: p.returnUrl,
    channels: 'ALL',
    lang: 'fr',
    metadata: p.requestId,
    customer_id: p.customer.id,
    customer_name: name,
    customer_surname: surname,
    customer_email: p.customer.email ?? '',
    customer_phone_number: phone ? `+${phone.prefix}${phone.phone}` : '',
    // Champs exigés pour le paiement par carte (lancement à Abidjan).
    customer_address: 'Abidjan',
    customer_city: 'Abidjan',
    customer_country: 'CI',
    customer_state: 'CI',
    customer_zip_code: '00225',
  };
}

/** Champs de la notification, dans l'ordre exigé pour le x-token. */
export const NOTIFY_TOKEN_FIELDS = [
  'cpm_site_id',
  'cpm_trans_id',
  'cpm_trans_date',
  'cpm_amount',
  'cpm_currency',
  'signature',
  'payment_method',
  'cel_phone_num',
  'cpm_phone_prefixe',
  'cpm_language',
  'cpm_version',
  'cpm_payment_config',
  'cpm_page_action',
  'cpm_custom',
  'cpm_designation',
  'cpm_error_message',
] as const;

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function computeXToken(fields: Record<string, string | undefined>, secretKey: string): Promise<string> {
  const data = NOTIFY_TOKEN_FIELDS.map((k) => fields[k] ?? '').join('');
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Comparaison à temps constant. */
export async function verifyXToken(fields: Record<string, string | undefined>, received: string | null, secretKey: string): Promise<boolean> {
  if (!received) return false;
  const expected = await computeXToken(fields, secretKey);
  const a = received.trim().toLowerCase();
  if (a.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export type PaymentMethodCode = 'orange_money' | 'mtn_momo' | 'moov_money' | 'wave' | 'card' | 'other';

export function mapPaymentMethod(code: string | null | undefined): PaymentMethodCode {
  const c = (code ?? '').toUpperCase();
  if (c.includes('WAVE')) return 'wave';
  if (c.startsWith('OM') || c.includes('ORANGE')) return 'orange_money';
  if (c.includes('MOMO') || c.includes('MTN')) return 'mtn_momo';
  if (c.includes('FLOOZ') || c.includes('MOOV')) return 'moov_money';
  if (c.includes('VISA') || c.includes('MASTER') || c.includes('CARD') || c.includes('CB')) return 'card';
  return 'other';
}

export type CheckOutcome =
  | { kind: 'accepted'; amount: number; method: PaymentMethodCode; operatorId: string | null }
  | { kind: 'refused'; reason: string }
  | { kind: 'pending'; reason: string };

/**
 * Interprète la réponse de /v2/payment/check.
 * Prudence : tout ce qui n'est ni explicitement accepté ni explicitement refusé reste « en attente »
 * (certains opérateurs renvoient d'abord WAITING_FOR_CUSTOMER).
 */
export function interpretCheck(json: unknown): CheckOutcome {
  const r = (json ?? {}) as { code?: string | number; message?: string; data?: Record<string, unknown> };
  const code = String(r.code ?? '');
  const data = r.data ?? {};
  const status = String(data.status ?? '').toUpperCase();
  const message = String(r.message ?? status ?? '');
  if (code === '00' && status === 'ACCEPTED') {
    return {
      kind: 'accepted',
      amount: Math.round(Number(data.amount)),
      method: mapPaymentMethod(String(data.payment_method ?? '')),
      operatorId: data.operator_id ? String(data.operator_id) : null,
    };
  }
  if (status === 'REFUSED' || status === 'CANCELED' || status === 'CANCELLED' || code === '627') {
    return { kind: 'refused', reason: message || 'Paiement refusé' };
  }
  return { kind: 'pending', reason: message || 'En attente' };
}

export type TransferOutcome = { status: 'processing' | 'sent' | 'failed'; providerReference: string | null; providerStatus: string | null; reason: string | null };

/** Interprète l'envoi (/money/send/contact) ou la vérification (/check/money) d'un transfert. */
export function interpretTransfer(json: unknown): TransferOutcome {
  const r = (json ?? {}) as { code?: string | number; message?: string; description?: string; data?: unknown };
  const code = String(r.code ?? '');
  let item = r.data as unknown;
  while (Array.isArray(item)) item = item[0];
  const d = (item ?? {}) as Record<string, unknown>;
  const treatment = d.treatment_status ? String(d.treatment_status).toUpperCase() : null;
  const ref = d.transaction_id ? String(d.transaction_id) : d.lot ? String(d.lot) : null;
  if (code !== '0' && code !== '00') {
    return { status: 'failed', providerReference: ref, providerStatus: code, reason: String(r.description ?? r.message ?? 'Transfert refusé') };
  }
  if (treatment === 'VAL') return { status: 'sent', providerReference: ref, providerStatus: treatment, reason: null };
  if (treatment === 'REJ') return { status: 'failed', providerReference: ref, providerStatus: treatment, reason: String(d.comment ?? 'Transfert rejeté') };
  if (d.status && String(d.status).toLowerCase() !== 'success' && !treatment) {
    return { status: 'failed', providerReference: ref, providerStatus: String(d.status), reason: String(d.message ?? d.status) };
  }
  return { status: 'processing', providerReference: ref, providerStatus: treatment, reason: null };
}

/** Wave nécessite d'être précisé ; Orange, MTN et Moov sont déduits du numéro. */
export function transferPaymentMethod(method: string | null | undefined): string | undefined {
  return method === 'wave' ? 'WAVECI' : undefined;
}

export function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}
