import type { MechanicPlan } from '@/types/database';

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 20000 → « 20 000 FCFA » */
export function formatFCFA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${fcfa.format(Math.round(amount)).replace(/ | /g, ' ')} FCFA`;
}

export interface QuoteLines {
  labor: number;
  parts: number;
  travel: number;
}

export function quoteTotal(q: QuoteLines): number {
  return clampAmount(q.labor) + clampAmount(q.parts) + clampAmount(q.travel);
}

function clampAmount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Taux par défaut — la valeur de référence est dans platform_settings. */
export const DEFAULT_COMMISSION: Record<MechanicPlan, number> = { starter: 0.12, pro: 0.05 };

/** Même arrondi que declare_payment() côté base. */
export function commissionSplit(total: number, rate: number) {
  const commission = Math.round(total * rate);
  return { commission, net: total - commission };
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

/** Fourchette indicative d'une catégorie (null si non communiquée par l'administration). */
export function priceRangeLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? formatFCFA(min) : `${formatFCFA(min)} – ${formatFCFA(max)}`;
  if (min != null) return `À partir de ${formatFCFA(min)}`;
  return `Jusqu’à ${formatFCFA(max)}`;
}

/** Paramètres de négociation par défaut — les valeurs de référence sont dans platform_settings. */
export const DEFAULT_NEGOTIATION = { maxOffers: 3, minRatio: 0.5 };

/**
 * Fourchette autorisée pour une contre-proposition du client (mêmes règles que propose_price()) :
 * inférieure au devis, au moins `minRatio` du devis et, pour un supplément, supérieure au devis déjà validé.
 * Renvoie null si aucune contre-proposition n'est possible.
 */
export function offerBounds(quoteTotal: number, minRatio: number, acceptedTotal?: number | null): { min: number; max: number } | null {
  const max = Math.round(quoteTotal) - 1;
  const min = Math.max(Math.ceil(quoteTotal * minRatio), acceptedTotal != null ? Math.round(acceptedTotal) + 1 : 1);
  return min <= max ? { min, max } : null;
}
