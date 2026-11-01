/**
 * Paiements dans l'application.
 *
 *  - Le client paie en ligne (Mobile Money, Wave, carte) via l'Edge Function « payments » :
 *    elle crée le paiement, ouvre le guichet du prestataire (CinetPay) et, à la notification,
 *    CONTRÔLE le statut auprès du prestataire avant de confirmer. Aucun paiement n'est validé
 *    côté navigateur, ni sur la base d'une capture d'écran.
 *  - Le professionnel reçoit automatiquement sa part (versement Mobile Money).
 *  - Espèces en secours : le pro déclare, le client confirme ; la commission est alors due par le pro
 *    et déduite de ses prochains versements.
 *  - Disponibilité : le paramètre `online_payment_provider` (administration) doit être renseigné ET
 *    les clés du prestataire configurées côté serveur. Sinon, le paiement en ligne est indisponible.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { db } from '@/lib/supabase';
import type { Payment, Payout } from '@/types/database';
import { unwrap, unwrapList } from '../_helpers';

/** Le paiement en ligne est-il activé par l'administration ? */
export function onlinePaymentEnabled(settings: Record<string, unknown> | undefined): boolean {
  const v = settings?.online_payment_provider;
  return typeof v === 'string' && v.trim().length > 0;
}

/** Erreur renvoyée par l'Edge Function, avec son code et son message en français. */
export class PaymentServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(code);
    this.hint = message;
  }
  hint: string;
}

async function invoke<T>(route: string, body?: unknown): Promise<T> {
  const { data, error } = await db().functions.invoke(`payments/${route}`, { body: body ?? {} });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { code?: string; message?: string } | null;
      throw new PaymentServiceError(payload?.code ?? 'PAYMENT_ERROR', payload?.message ?? 'Le service de paiement est momentanément indisponible.');
    }
    throw new PaymentServiceError('PAYMENT_UNREACHABLE', 'Service de paiement injoignable. Vérifiez votre connexion puis réessayez.');
  }
  return data as T;
}

/** Ouvre le guichet de paiement : renvoie l'URL vers laquelle rediriger le client. */
export async function startOnlinePayment(requestId: string): Promise<string> {
  const res = await invoke<{ payment_url: string }>('checkout', { request_id: requestId });
  return res.payment_url;
}

/** Recontrôle un paiement en ligne auprès du prestataire (client concerné ou administration). */
export function verifyOnlinePayment(paymentId: string): Promise<{ status: string; failure_reason: string | null }> {
  return invoke('verify', { payment_id: paymentId });
}

/** Relance un versement (le pro concerné après avoir renseigné son compte, ou l'administration). */
export function retryPayout(payoutId: string): Promise<{ status: string; message?: string }> {
  return invoke('payout-retry', { payout_id: payoutId });
}

/** État de la configuration serveur (aucun secret) — pour l'administration. */
export async function providerStatus(): Promise<{ online_payment: boolean; automatic_payouts: boolean; notify_token_check: boolean } | null> {
  try {
    const { data, error } = await db().functions.invoke('payments/status', { method: 'GET' });
    if (error) return null;
    return data as { online_payment: boolean; automatic_payouts: boolean; notify_token_check: boolean };
  } catch {
    return null;
  }
}

export function listMyPayouts(mechanicId: string): Promise<Payout[]> {
  return unwrapList<Payout>(db().from('payouts').select('*').eq('mechanic_id', mechanicId).order('created_at', { ascending: false }).limit(100));
}

/** Versement lié à un paiement (le pro concerné ou l'administration). */
export async function getPayoutForPayment(paymentId: string): Promise<Payout | null> {
  const list = await unwrapList<Payout>(db().from('payouts').select('*').eq('payment_id', paymentId).order('created_at', { ascending: false }).limit(1));
  return list[0] ?? null;
}

export function listPayouts(): Promise<Payout[]> {
  return unwrapList<Payout>(db().from('payouts').select('*').order('created_at', { ascending: false }).limit(200));
}

export function adminSetPayoutStatus(payoutId: string, status: 'sent' | 'cancelled' | 'pending', note: string): Promise<Payout> {
  return unwrap<Payout>(db().rpc('admin_set_payout_status', { p_payout_id: payoutId, p_status: status, p_note: note }));
}

export function adminSettleCommission(paymentId: string, note: string): Promise<Payment> {
  return unwrap<Payment>(db().rpc('admin_settle_commission', { p_payment_id: paymentId, p_note: note }));
}

/** Commissions encore dues par un pro sur ses paiements en espèces. */
export function commissionDue(payments: Payment[]): { amount: number; count: number } {
  const due = payments.filter((p) => p.channel === 'direct' && p.status === 'confirmed' && !p.commission_settled_at && p.commission_amount > 0);
  return { amount: due.reduce((s, p) => s + p.commission_amount, 0), count: due.length };
}
