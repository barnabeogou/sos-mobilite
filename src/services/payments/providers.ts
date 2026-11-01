/**
 * Paiements en ligne — architecture d'intégration (ÉTAPE 4).
 *
 * Phase actuelle (conforme au dossier projet) : le client paie directement le
 * professionnel ; celui-ci déclare le moyen utilisé (declare_payment) et le client
 * confirme (confirm_payment). Montant = dernier devis accepté, commission calculée en base.
 *
 * Pour brancher un prestataire réel (Orange Money CI, MTN MoMo, Wave, carte) :
 *  - implémenter `OnlinePaymentProvider` dans un fichier dédié ;
 *  - faire l'appel au prestataire dans une Edge Function (clés secrètes côté serveur) ;
 *  - confirmer le paiement UNIQUEMENT via le webhook du prestataire, qui renseigne
 *    `payments.provider_reference` (jamais sur la base d'une capture d'écran) ;
 *  - passer `configured: true` une fois les contrats et les obligations réglementaires validés.
 */
export type OnlineProviderId = 'orange_money' | 'mtn_momo' | 'wave' | 'card';

export interface PaymentIntentResult {
  /** URL ou deep-link de paiement fourni par le prestataire */
  redirectUrl?: string;
  /** Référence du prestataire */
  providerReference: string;
}

export interface OnlinePaymentProvider {
  id: OnlineProviderId;
  label: string;
  configured: boolean;
  initiate(requestId: string): Promise<PaymentIntentResult>;
}

class NotConnectedProvider implements OnlinePaymentProvider {
  configured = false;
  constructor(
    public id: OnlineProviderId,
    public label: string,
  ) {}
  async initiate(): Promise<PaymentIntentResult> {
    throw new Error('PAYMENT_PROVIDER_NOT_CONNECTED');
  }
}

export const ONLINE_PAYMENT_PROVIDERS: OnlinePaymentProvider[] = [
  new NotConnectedProvider('orange_money', 'Orange Money'),
  new NotConnectedProvider('mtn_momo', 'MTN Mobile Money'),
  new NotConnectedProvider('wave', 'Wave'),
  new NotConnectedProvider('card', 'Carte bancaire'),
];

export const hasOnlinePayment = () => ONLINE_PAYMENT_PROVIDERS.some((p) => p.configured);
