/**
 * Types des lignes de la base (miroir de supabase/migrations).
 * Pour une génération automatique : `npx supabase gen types typescript --project-id <id>`.
 */
export type UserRole = 'client' | 'mechanic' | 'admin';
export type AdminLevel = 'support' | 'operations' | 'super_admin';
export type VehicleType = 'auto' | 'moto' | 'marine';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type MechanicKind = 'independant' | 'garage' | 'depanneur';
export type MechanicPlan = 'starter' | 'pro';
export type RequestStatus =
  | 'searching'
  | 'accepted'
  | 'quoted'
  | 'quote_accepted'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'closed'
  | 'cancelled'
  | 'disputed'
  | 'expired';
export type AssignmentStatus = 'proposed' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'cancelled';
export type QuoteStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type PaymentMethod = 'cash' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'wave' | 'card' | 'other';
export type PaymentStatus = 'pending' | 'declared' | 'confirmed' | 'failed' | 'disputed' | 'refunded';
export type PaymentChannel = 'direct' | 'online';
export type PayoutStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'not_required';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketCategory = 'intervention' | 'paiement' | 'litige' | 'compte' | 'securite' | 'autre';
export type MaintenanceKind = 'vidange' | 'pneus' | 'batterie' | 'freins' | 'revision' | 'assurance' | 'autre';
export type DocumentType = 'piece_identite' | 'registre_commerce' | 'photo_atelier' | 'attestation' | 'autre';
export type DocumentStatus = 'pending' | 'accepted' | 'rejected';

export interface Profile {
  id: string;
  role: UserRole;
  admin_level: AdminLevel | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string;
  commune: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number | null;
  plate: string | null;
  color: string | null;
  insurance_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  owner_id: string;
  kind: MaintenanceKind;
  performed_at: string;
  mileage_km: number | null;
  cost: number | null;
  next_due_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  vehicle_types: VehicleType[];
  base_price_min: number | null;
  base_price_max: number | null;
  travel_fee: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface MechanicProfile {
  id: string;
  business_name: string;
  kind: MechanicKind;
  bio: string | null;
  years_experience: number | null;
  vehicle_types: VehicleType[];
  service_radius_km: number;
  base_lat: number | null;
  base_lng: number | null;
  commune: string | null;
  address: string | null;
  opening_hours: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  rejection_reason: string | null;
  is_available: boolean;
  plan: MechanicPlan;
  rating_avg: number;
  rating_count: number;
  completed_missions: number;
  /** Compte Mobile Money sur lequel le pro reçoit ses versements. */
  payout_method: PaymentMethod | null;
  payout_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface MechanicDocument {
  id: string;
  mechanic_id: string;
  doc_type: DocumentType;
  storage_path: string;
  status: DocumentStatus;
  uploaded_at: string;
}

export interface ServiceRequest {
  id: string;
  reference: string;
  client_id: string;
  vehicle_id: string | null;
  vehicle_type: VehicleType;
  category_id: string;
  symptoms: string[];
  description: string | null;
  photos: string[];
  lat: number;
  lng: number;
  location_accuracy_m: number | null;
  address_hint: string | null;
  location_consent_at: string;
  status: RequestStatus;
  search_radius_km: number;
  assigned_mechanic_id: string | null;
  accepted_at: string | null;
  quote_accepted_at: string | null;
  en_route_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  request_id: string;
  mechanic_id: string;
  status: AssignmentStatus;
  distance_km: number | null;
  is_manual: boolean;
  proposed_at: string;
  expires_at: string;
  responded_at: string | null;
  decline_reason: string | null;
}

export interface Quote {
  id: string;
  request_id: string;
  mechanic_id: string;
  version: number;
  labor_amount: number;
  parts_amount: number;
  travel_amount: number;
  total_amount: number;
  eta_minutes: number | null;
  notes: string | null;
  status: QuoteStatus;
  created_at: string;
  responded_at: string | null;
  /** Devis issu d'une négociation : proposition de prix du client acceptée. */
  offer_id: string | null;
}

export type PriceOfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

/** Contre-proposition de prix du client sur un devis. */
export interface PriceOffer {
  id: string;
  request_id: string;
  quote_id: string;
  client_id: string;
  amount: number;
  message: string | null;
  status: PriceOfferStatus;
  created_at: string;
  responded_at: string | null;
}

export interface StatusHistoryEntry {
  id: number;
  request_id: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  request_id: string;
  client_id: string;
  mechanic_id: string;
  quote_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  commission_rate: number;
  commission_amount: number;
  mechanic_net: number;
  receipt_number: string | null;
  provider_reference: string | null;
  /** direct = réglé au pro (espèces…), online = payé dans l'application. */
  channel: PaymentChannel;
  provider: string | null;
  provider_transaction_id: string | null;
  failure_reason: string | null;
  /** Commission encaissée (en ligne) ou réglée par le pro (espèces) ; null = encore due. */
  commission_settled_at: string | null;
  commission_settlement_note: string | null;
  commission_settled_by: string | null;
  declared_at: string;
  confirmed_at: string | null;
  created_at: string;
}

/** Versement de sa part au professionnel après un paiement en ligne. */
export interface Payout {
  id: string;
  payment_id: string;
  mechanic_id: string;
  gross_amount: number;
  deducted_commissions: number;
  rounding_amount: number;
  amount: number;
  method: PaymentMethod | null;
  phone: string | null;
  status: PayoutStatus;
  provider_reference: string | null;
  failure_reason: string | null;
  attempts: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface Review {
  id: string;
  request_id: string;
  client_id: string;
  mechanic_id: string;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  request_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  created_by: string;
  request_id: string | null;
  category: TicketCategory;
  subject: string;
  message: string;
  status: TicketStatus;
  assigned_admin: string | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

/** Ligne renvoyée par list_open_proposals() */
export interface OpenProposal {
  assignment_id: string;
  request_id: string;
  reference: string;
  category_slug: string;
  category_name: string;
  vehicle_type: VehicleType;
  vehicle_label: string | null;
  symptoms: string[];
  description: string | null;
  photo_count: number;
  approx_lat: number;
  approx_lng: number;
  address_hint: string | null;
  distance_km: number;
  created_at: string;
  expires_at: string;
}

/** Ligne renvoyée par nearby_mechanics() */
export interface NearbyMechanic {
  id: string;
  display_name: string;
  kind: MechanicKind;
  commune: string | null;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  completed_missions: number;
  is_available: boolean;
  distance_km: number;
  vehicle_types: VehicleType[];
  specialties: string[];
}

export interface AdminStats {
  clients: number;
  mechanics: number;
  mechanics_approved: number;
  mechanics_pending: number;
  mechanics_available: number;
  requests_total: number;
  requests_today: number;
  requests_active: number;
  requests_searching: number;
  requests_disputed: number;
  interventions_done: number;
  acceptance_rate: number | null;
  median_accept_minutes: number | null;
  volume_confirmed: number;
  commission_confirmed: number;
  tickets_open: number;
  rating_avg: number | null;
}
