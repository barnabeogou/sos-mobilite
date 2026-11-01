import type { AssignmentStatus, PaymentStatus, RequestStatus, TicketStatus, VerificationStatus } from '@/types/database';

export type Tone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

interface StatusMeta {
  label: string;
  tone: Tone;
  /** Ce que voit le client */
  client: string;
  /** Ce que voit le professionnel */
  mechanic: string;
}

export const REQUEST_STATUS: Record<RequestStatus, StatusMeta> = {
  searching: {
    label: 'Recherche en cours',
    tone: 'info',
    client: 'Nous contactons les professionnels disponibles près de vous.',
    mechanic: 'Demande en attente d’un professionnel.',
  },
  accepted: {
    label: 'Mission acceptée',
    tone: 'progress',
    client: 'Un professionnel a accepté. Il prépare votre devis.',
    mechanic: 'Envoyez votre devis au client.',
  },
  quoted: {
    label: 'Devis à valider',
    tone: 'warning',
    client: 'Consultez le devis et validez-le pour que le professionnel se déplace.',
    mechanic: 'En attente de la validation du devis par le client.',
  },
  quote_accepted: {
    label: 'Devis validé',
    tone: 'progress',
    client: 'Devis validé. Le professionnel va se mettre en route.',
    mechanic: 'Devis validé : indiquez que vous partez.',
  },
  en_route: {
    label: 'En route',
    tone: 'progress',
    client: 'Le professionnel est en route. Donnez-lui votre code à son arrivée.',
    mechanic: 'À l’arrivée, saisissez le code communiqué par le client.',
  },
  in_progress: {
    label: 'Intervention en cours',
    tone: 'progress',
    client: 'Le professionnel intervient sur votre véhicule.',
    mechanic: 'Intervention en cours. Tout supplément doit être validé par le client.',
  },
  completed: {
    label: 'À confirmer',
    tone: 'warning',
    client: 'Intervention terminée. Vérifiez puis confirmez la prestation et le paiement.',
    mechanic: 'Déclarez le paiement reçu ; le client confirmera.',
  },
  paid: {
    label: 'Payée',
    tone: 'success',
    client: 'Prestation réglée. Votre reçu est disponible. Donnez votre avis !',
    mechanic: 'Paiement confirmé par le client.',
  },
  closed: {
    label: 'Terminée',
    tone: 'success',
    client: 'Merci pour votre confiance.',
    mechanic: 'Mission clôturée.',
  },
  cancelled: {
    label: 'Annulée',
    tone: 'neutral',
    client: 'Cette demande a été annulée.',
    mechanic: 'Mission annulée.',
  },
  disputed: {
    label: 'Litige en cours',
    tone: 'danger',
    client: 'Un problème a été signalé. Le support examine la situation.',
    mechanic: 'Un problème a été signalé. Le support va vous contacter.',
  },
  expired: {
    label: 'Expirée',
    tone: 'neutral',
    client: 'Aucun professionnel n’a pu être trouvé.',
    mechanic: 'Demande expirée.',
  },
};

/** Statuts pendant lesquels une demande est « en cours ». */
export const ACTIVE_STATUSES: RequestStatus[] = [
  'searching',
  'accepted',
  'quoted',
  'quote_accepted',
  'en_route',
  'in_progress',
  'completed',
];

export const MISSION_ACTIVE_STATUSES: RequestStatus[] = ['accepted', 'quoted', 'quote_accepted', 'en_route', 'in_progress', 'completed'];

export function isActive(status: RequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Étapes affichées dans le suivi (frise). */
export const TIMELINE_STEPS: { key: RequestStatus; label: string }[] = [
  { key: 'searching', label: 'Demande envoyée' },
  { key: 'accepted', label: 'Mission acceptée' },
  { key: 'quoted', label: 'Devis reçu' },
  { key: 'quote_accepted', label: 'Devis validé' },
  { key: 'en_route', label: 'En route' },
  { key: 'in_progress', label: 'Intervention' },
  { key: 'completed', label: 'Terminée' },
  { key: 'paid', label: 'Payée' },
];

const ORDER: RequestStatus[] = TIMELINE_STEPS.map((s) => s.key).concat('closed');

/** Index de progression (0..8) ; -1 pour les statuts hors parcours. */
export function progressIndex(status: RequestStatus): number {
  if (status === 'closed') return TIMELINE_STEPS.length; // tout est fait
  return ORDER.indexOf(status);
}

/** Actions autorisées — miroir des règles SQL, pour l'affichage uniquement. */
export const CLIENT_CAN_CANCEL: RequestStatus[] = ['searching', 'accepted', 'quoted', 'quote_accepted', 'en_route'];
export const CLIENT_CAN_REPORT: RequestStatus[] = ['accepted', 'quoted', 'quote_accepted', 'en_route', 'in_progress', 'completed', 'paid'];
export const MECHANIC_CAN_WITHDRAW: RequestStatus[] = ['accepted', 'quoted', 'quote_accepted'];
export const MECHANIC_CAN_QUOTE: RequestStatus[] = ['accepted', 'quoted', 'in_progress'];

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  proposed: { label: 'Proposée', tone: 'info' },
  accepted: { label: 'Acceptée', tone: 'success' },
  declined: { label: 'Refusée', tone: 'neutral' },
  expired: { label: 'Expirée', tone: 'neutral' },
  withdrawn: { label: 'Désistement', tone: 'warning' },
  cancelled: { label: 'Close', tone: 'neutral' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  declared: { label: 'Déclaré — à confirmer', tone: 'warning' },
  confirmed: { label: 'Confirmé', tone: 'success' },
  disputed: { label: 'Contesté', tone: 'danger' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
};

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  open: { label: 'Ouverte', tone: 'warning' },
  in_progress: { label: 'En traitement', tone: 'progress' },
  resolved: { label: 'Résolue', tone: 'success' },
  closed: { label: 'Fermée', tone: 'neutral' },
};

export const VERIFICATION_STATUS: Record<VerificationStatus, { label: string; tone: Tone; help: string }> = {
  pending: {
    label: 'En attente de validation',
    tone: 'warning',
    help: 'Complétez votre profil et vos documents. L’équipe SOS MOBILITÉ vérifie chaque professionnel avant activation.',
  },
  approved: { label: 'Profil vérifié', tone: 'success', help: 'Vous pouvez activer votre disponibilité.' },
  rejected: { label: 'Non validé', tone: 'danger', help: 'Votre profil n’a pas été validé. Consultez le motif et contactez le support.' },
  suspended: { label: 'Suspendu', tone: 'danger', help: 'Votre profil est suspendu. Contactez le support.' },
};
