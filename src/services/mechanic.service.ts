import { db } from '@/lib/supabase';
import type {
  Assignment,
  DocumentType,
  MechanicDocument,
  MechanicKind,
  MechanicProfile,
  OpenProposal,
  Payment,
  PaymentMethod,
  Quote,
  Review,
  ServiceRequest,
  VehicleType,
} from '@/types/database';
import { unwrap, unwrapList } from './_helpers';
import { removeOwnFiles, signedUrl, uploadOwnFile } from './storage.service';

export function getMyMechanicProfile(userId: string): Promise<MechanicProfile | null> {
  return unwrap<MechanicProfile | null>(db().from('mechanic_profiles').select('*').eq('id', userId).maybeSingle());
}

export interface MechanicProfileUpdate {
  business_name?: string;
  kind?: MechanicKind;
  bio?: string | null;
  years_experience?: number | null;
  vehicle_types?: VehicleType[];
  service_radius_km?: number;
  base_lat?: number | null;
  base_lng?: number | null;
  commune?: string | null;
  address?: string | null;
  opening_hours?: string | null;
  payout_method?: PaymentMethod | null;
  payout_phone?: string | null;
}

export function updateMyMechanicProfile(userId: string, patch: MechanicProfileUpdate): Promise<MechanicProfile> {
  return unwrap<MechanicProfile>(db().from('mechanic_profiles').update(patch).eq('id', userId).select('*').single());
}

export async function listMySpecialties(userId: string): Promise<string[]> {
  const rows = await unwrapList<{ category_id: string }>(
    db().from('mechanic_specialties').select('category_id').eq('mechanic_id', userId),
  );
  return rows.map((r) => r.category_id);
}

export function setMySpecialties(categoryIds: string[]): Promise<number> {
  return unwrap<number>(db().rpc('set_my_specialties', { p_category_ids: categoryIds }));
}

export function setMyAvailability(available: boolean): Promise<MechanicProfile> {
  return unwrap<MechanicProfile>(db().rpc('set_my_availability', { p_available: available }));
}

// ---------------------------------------------------------------------------
// Propositions & missions
// ---------------------------------------------------------------------------
export function listOpenProposals(): Promise<OpenProposal[]> {
  return unwrapList<OpenProposal>(db().rpc('list_open_proposals'));
}

export function respondToAssignment(assignmentId: string, accept: boolean, reason?: string): Promise<Assignment> {
  return unwrap<Assignment>(
    db().rpc('respond_to_assignment', { p_assignment_id: assignmentId, p_accept: accept, p_reason: reason ?? null }),
  );
}

export function listMyMissions(userId: string): Promise<ServiceRequest[]> {
  return unwrapList<ServiceRequest>(
    db()
      .from('service_requests')
      .select('*')
      .eq('assigned_mechanic_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
  );
}

export function submitQuote(input: {
  requestId: string;
  labor: number;
  parts: number;
  travel: number;
  etaMinutes: number | null;
  notes: string | null;
}): Promise<Quote> {
  return unwrap<Quote>(
    db().rpc('submit_quote', {
      p_request_id: input.requestId,
      p_labor: input.labor,
      p_parts: input.parts,
      p_travel: input.travel,
      p_eta_minutes: input.etaMinutes,
      p_notes: input.notes,
    }),
  );
}

/** Négociation : le professionnel accepte le prix proposé par le client ou maintient son devis. */
export function respondToPriceOffer(offerId: string, accept: boolean): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(db().rpc('respond_to_price_offer', { p_offer_id: offerId, p_accept: accept }));
}

export function startRoute(requestId: string): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(db().rpc('start_route', { p_request_id: requestId }));
}

export function verifyArrivalCode(requestId: string, code: string): Promise<boolean> {
  return unwrap<boolean>(db().rpc('verify_arrival_code', { p_request_id: requestId, p_code: code }));
}

export function completeMission(requestId: string, note: string | null): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(db().rpc('complete_mission', { p_request_id: requestId, p_note: note }));
}

export function declarePayment(requestId: string, method: PaymentMethod): Promise<Payment> {
  return unwrap<Payment>(db().rpc('declare_payment', { p_request_id: requestId, p_method: method }));
}

export function withdrawFromRequest(requestId: string, reason: string | null): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(db().rpc('withdraw_from_request', { p_request_id: requestId, p_reason: reason }));
}

export function listMyPayments(userId: string): Promise<Payment[]> {
  return unwrapList<Payment>(
    db().from('payments').select('*').eq('mechanic_id', userId).order('created_at', { ascending: false }).limit(200),
  );
}

export function listMyReviews(userId: string): Promise<Review[]> {
  return unwrapList<Review>(
    db().from('reviews').select('*').eq('mechanic_id', userId).order('created_at', { ascending: false }).limit(200),
  );
}

// ---------------------------------------------------------------------------
// Documents justificatifs
// ---------------------------------------------------------------------------
export function listMyDocuments(userId: string): Promise<MechanicDocument[]> {
  return unwrapList<MechanicDocument>(
    db().from('mechanic_documents').select('*').eq('mechanic_id', userId).order('uploaded_at', { ascending: false }),
  );
}

export async function uploadDocument(userId: string, docType: DocumentType, file: File): Promise<MechanicDocument> {
  const path = await uploadOwnFile('mechanic-documents', userId, file);
  try {
    return await unwrap<MechanicDocument>(
      db().from('mechanic_documents').insert({ mechanic_id: userId, doc_type: docType, storage_path: path }).select('*').single(),
    );
  } catch (e) {
    await removeOwnFiles('mechanic-documents', [path]);
    throw e;
  }
}

export async function deleteDocument(doc: MechanicDocument): Promise<void> {
  const { error } = await db().from('mechanic_documents').delete().eq('id', doc.id);
  if (error) throw error;
  await removeOwnFiles('mechanic-documents', [doc.storage_path]);
}

export function documentUrl(path: string): Promise<string | null> {
  return signedUrl('mechanic-documents', path);
}
