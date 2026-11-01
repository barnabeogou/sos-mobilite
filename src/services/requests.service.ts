import { db } from '@/lib/supabase';
import type {
  Assignment,
  MechanicKind,
  NearbyMechanic,
  Payment,
  Quote,
  Review,
  ServiceRequest,
  StatusHistoryEntry,
  SupportTicket,
  Vehicle,
  VehicleType,
} from '@/types/database';
import { unwrap, unwrapList } from './_helpers';
import { signedUrls, uploadOwnFile } from './storage.service';

// ---------------------------------------------------------------------------
// Création d'une demande
// ---------------------------------------------------------------------------
export interface NewRequestInput {
  categoryId: string;
  vehicleId: string | null;
  vehicleType: VehicleType;
  symptoms: string[];
  description: string;
  photos: File[];
  lat: number;
  lng: number;
  accuracy: number | null;
  addressHint: string;
  locationConsent: boolean;
}

export async function createServiceRequest(userId: string, input: NewRequestInput): Promise<ServiceRequest> {
  const photoPaths: string[] = [];
  for (const file of input.photos.slice(0, 5)) {
    photoPaths.push(await uploadOwnFile('request-photos', userId, file));
  }
  return unwrap<ServiceRequest>(
    db().rpc('create_service_request', {
      p_category_id: input.categoryId,
      p_lat: input.lat,
      p_lng: input.lng,
      p_location_consent: input.locationConsent,
      p_vehicle_id: input.vehicleId,
      p_vehicle_type: input.vehicleType,
      p_symptoms: input.symptoms,
      p_description: input.description || null,
      p_photos: photoPaths,
      p_accuracy_m: input.accuracy,
      p_address_hint: input.addressHint || null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------
export function listMyRequests(userId: string): Promise<ServiceRequest[]> {
  return unwrapList<ServiceRequest>(
    db().from('service_requests').select('*').eq('client_id', userId).order('created_at', { ascending: false }).limit(100),
  );
}

export interface CounterpartMechanic {
  id: string;
  display_name: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  kind: MechanicKind;
  rating_avg: number;
  rating_count: number;
  completed_missions: number;
  commune: string | null;
}

export interface CounterpartClient {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
}

export interface RequestDetail {
  request: ServiceRequest;
  vehicle: Vehicle | null;
  quotes: Quote[];
  assignments: Pick<Assignment, 'id' | 'status' | 'expires_at' | 'distance_km' | 'mechanic_id' | 'proposed_at'>[];
  payment: Payment | null;
  review: Review | null;
  history: StatusHistoryEntry[];
  mechanic: CounterpartMechanic | null;
  client: CounterpartClient | null;
}

/** Détail complet d'une demande, selon les droits de l'utilisateur (RLS). */
export async function getRequestDetail(id: string): Promise<RequestDetail> {
  const request = await unwrap<ServiceRequest>(db().from('service_requests').select('*').eq('id', id).single());
  const [vehicle, quotes, assignments, payment, review, history, mechanic, client] = await Promise.all([
    request.vehicle_id
      ? unwrap<Vehicle | null>(db().from('vehicles').select('*').eq('id', request.vehicle_id).maybeSingle())
      : Promise.resolve(null),
    unwrapList<Quote>(db().from('quotes').select('*').eq('request_id', id).order('version', { ascending: false })),
    unwrapList<RequestDetail['assignments'][number]>(
      db().from('assignments').select('id, status, expires_at, distance_km, mechanic_id, proposed_at').eq('request_id', id),
    ),
    unwrap<Payment | null>(db().from('payments').select('*').eq('request_id', id).maybeSingle()),
    unwrap<Review | null>(db().from('reviews').select('*').eq('request_id', id).maybeSingle()),
    unwrapList<StatusHistoryEntry>(db().from('status_history').select('*').eq('request_id', id).order('created_at')),
    request.assigned_mechanic_id ? getCounterpartMechanic(request.assigned_mechanic_id) : Promise.resolve(null),
    getCounterpartClient(request.client_id),
  ]);
  return { request, vehicle, quotes, assignments, payment, review, history, mechanic, client };
}

async function getCounterpartMechanic(id: string): Promise<CounterpartMechanic | null> {
  const [p, m] = await Promise.all([
    unwrap<{ full_name: string; phone: string | null; avatar_url: string | null } | null>(
      db().from('profiles').select('full_name, phone, avatar_url').eq('id', id).maybeSingle(),
    ),
    unwrap<{
      business_name: string;
      kind: MechanicKind;
      rating_avg: number;
      rating_count: number;
      completed_missions: number;
      commune: string | null;
    } | null>(
      db()
        .from('mechanic_profiles')
        .select('business_name, kind, rating_avg, rating_count, completed_missions, commune')
        .eq('id', id)
        .maybeSingle(),
    ),
  ]);
  if (!p || !m) return null;
  return {
    id,
    display_name: m.business_name || p.full_name,
    full_name: p.full_name,
    phone: p.phone,
    avatar_url: p.avatar_url,
    kind: m.kind,
    rating_avg: Number(m.rating_avg),
    rating_count: m.rating_count,
    completed_missions: m.completed_missions,
    commune: m.commune,
  };
}

async function getCounterpartClient(id: string): Promise<CounterpartClient | null> {
  const p = await unwrap<CounterpartClient | null>(
    db().from('profiles').select('id, full_name, phone, avatar_url').eq('id', id).maybeSingle(),
  );
  return p;
}

export function requestPhotoUrls(paths: string[]): Promise<string[]> {
  return signedUrls('request-photos', paths);
}

// ---------------------------------------------------------------------------
// Actions client
// ---------------------------------------------------------------------------
export function getArrivalCode(requestId: string): Promise<string | null> {
  return unwrap<string | null>(db().rpc('get_arrival_code', { p_request_id: requestId }));
}

export function expandSearch(requestId: string): Promise<number> {
  return unwrap<number>(db().rpc('expand_search', { p_request_id: requestId }));
}

export function cancelRequest(requestId: string, reason: string | null): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(db().rpc('cancel_request', { p_request_id: requestId, p_reason: reason }));
}

export function respondToQuote(quoteId: string, accept: boolean): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(db().rpc('respond_to_quote', { p_quote_id: quoteId, p_accept: accept }));
}

export function confirmPayment(requestId: string): Promise<Payment> {
  return unwrap<Payment>(db().rpc('confirm_payment', { p_request_id: requestId }));
}

export function submitReview(requestId: string, rating: number, comment: string | null): Promise<Review> {
  return unwrap<Review>(db().rpc('submit_review', { p_request_id: requestId, p_rating: rating, p_comment: comment }));
}

export function reportProblem(requestId: string, message: string): Promise<SupportTicket> {
  return unwrap<SupportTicket>(db().rpc('report_problem', { p_request_id: requestId, p_message: message }));
}

export function nearbyMechanics(params: {
  lat: number;
  lng: number;
  categoryId?: string | null;
  vehicleType?: VehicleType | null;
  maxKm?: number;
}): Promise<NearbyMechanic[]> {
  return unwrapList<NearbyMechanic>(
    db().rpc('nearby_mechanics', {
      p_lat: params.lat,
      p_lng: params.lng,
      p_category_id: params.categoryId ?? null,
      p_vehicle_type: params.vehicleType ?? null,
      p_max_km: params.maxKm ?? 30,
    }),
  );
}
