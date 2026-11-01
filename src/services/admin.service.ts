import { db } from '@/lib/supabase';
import type {
  AdminLevel,
  AdminStats,
  DocumentStatus,
  MechanicDocument,
  MechanicPlan,
  MechanicProfile,
  Payment,
  PaymentStatus,
  Profile,
  RequestStatus,
  Review,
  ServiceCategory,
  ServiceRequest,
  SupportTicket,
  TicketStatus,
  UserRole,
  VerificationStatus,
} from '@/types/database';
import { uniq, unwrap, unwrapList } from './_helpers';

export function getStats(): Promise<AdminStats> {
  return unwrap<AdminStats>(db().rpc('admin_dashboard_stats'));
}

export type ProfileMap = Record<string, Pick<Profile, 'id' | 'full_name' | 'phone' | 'email' | 'role' | 'is_suspended'>>;

export async function profilesByIds(ids: string[]): Promise<ProfileMap> {
  const list = uniq(ids);
  if (!list.length) return {};
  const rows = await unwrapList<ProfileMap[string]>(
    db().from('profiles').select('id, full_name, phone, email, role, is_suspended').in('id', list),
  );
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

// ---------------------------------------------------------------------------
// Professionnels
// ---------------------------------------------------------------------------
export interface MechanicRow extends MechanicProfile {
  profile: ProfileMap[string] | undefined;
}

export async function listMechanics(status?: VerificationStatus | 'all'): Promise<MechanicRow[]> {
  let q = db().from('mechanic_profiles').select('*').order('created_at', { ascending: false }).limit(500);
  if (status && status !== 'all') q = q.eq('verification_status', status);
  const rows = await unwrapList<MechanicProfile>(q);
  const profiles = await profilesByIds(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, profile: profiles[r.id] }));
}

export function verifyMechanic(id: string, decision: VerificationStatus, reason: string | null): Promise<MechanicProfile> {
  return unwrap<MechanicProfile>(
    db().rpc('admin_verify_mechanic', { p_mechanic_id: id, p_decision: decision, p_reason: reason }),
  );
}

export function setMechanicPlan(id: string, plan: MechanicPlan): Promise<MechanicProfile> {
  return unwrap<MechanicProfile>(db().rpc('admin_set_mechanic_plan', { p_mechanic_id: id, p_plan: plan }));
}

export function listMechanicDocuments(mechanicId: string): Promise<MechanicDocument[]> {
  return unwrapList<MechanicDocument>(
    db().from('mechanic_documents').select('*').eq('mechanic_id', mechanicId).order('uploaded_at', { ascending: false }),
  );
}

export function reviewDocument(id: string, status: DocumentStatus): Promise<MechanicDocument> {
  return unwrap<MechanicDocument>(db().rpc('admin_review_document', { p_document_id: id, p_status: status }));
}

export async function mechanicSpecialties(mechanicId: string): Promise<string[]> {
  const rows = await unwrapList<{ category_id: string }>(
    db().from('mechanic_specialties').select('category_id').eq('mechanic_id', mechanicId),
  );
  return rows.map((r) => r.category_id);
}

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------
export function listUsers(params: { role?: UserRole; search?: string }): Promise<Profile[]> {
  let q = db().from('profiles').select('*').order('created_at', { ascending: false }).limit(300);
  if (params.role) q = q.eq('role', params.role);
  const s = params.search?.trim();
  if (s) {
    const safe = s.replace(/[%,()]/g, ' ');
    q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  return unwrapList<Profile>(q);
}

export function setSuspension(userId: string, suspended: boolean, reason: string | null): Promise<Profile> {
  return unwrap<Profile>(db().rpc('admin_set_suspension', { p_user_id: userId, p_suspended: suspended, p_reason: reason }));
}

export function setRole(userId: string, role: UserRole, level: AdminLevel | null): Promise<Profile> {
  return unwrap<Profile>(db().rpc('admin_set_role', { p_user_id: userId, p_role: role, p_admin_level: level }));
}

// ---------------------------------------------------------------------------
// Demandes
// ---------------------------------------------------------------------------
export function listRequests(params: { status?: RequestStatus | 'active' | 'all'; search?: string }): Promise<ServiceRequest[]> {
  let q = db().from('service_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (params.status === 'active') {
    q = q.in('status', ['searching', 'accepted', 'quoted', 'quote_accepted', 'en_route', 'in_progress', 'completed', 'disputed']);
  } else if (params.status && params.status !== 'all') {
    q = q.eq('status', params.status);
  }
  if (params.search?.trim()) q = q.ilike('reference', `%${params.search.trim().replace(/[%,]/g, '')}%`);
  return unwrapList<ServiceRequest>(q);
}

export function assignMechanic(requestId: string, mechanicId: string, note: string | null): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(
    db().rpc('admin_assign_mechanic', { p_request_id: requestId, p_mechanic_id: mechanicId, p_note: note }),
  );
}

export function setRequestStatus(requestId: string, status: RequestStatus, note: string): Promise<ServiceRequest> {
  return unwrap<ServiceRequest>(
    db().rpc('admin_set_request_status', { p_request_id: requestId, p_status: status, p_note: note }),
  );
}

export async function listApprovedMechanics(): Promise<MechanicRow[]> {
  return listMechanics('approved');
}

// ---------------------------------------------------------------------------
// Paiements, réclamations, avis
// ---------------------------------------------------------------------------
export function listPayments(status?: PaymentStatus | 'all'): Promise<Payment[]> {
  let q = db().from('payments').select('*').order('created_at', { ascending: false }).limit(500);
  if (status && status !== 'all') q = q.eq('status', status);
  return unwrapList<Payment>(q);
}

export function resolvePayment(id: string, status: PaymentStatus, note: string): Promise<Payment> {
  return unwrap<Payment>(db().rpc('admin_resolve_payment', { p_payment_id: id, p_status: status, p_note: note }));
}

export function listTickets(status?: TicketStatus | 'all'): Promise<SupportTicket[]> {
  let q = db().from('support_tickets').select('*').order('created_at', { ascending: false }).limit(300);
  if (status && status !== 'all') q = q.eq('status', status);
  return unwrapList<SupportTicket>(q);
}

export function updateTicket(id: string, status: TicketStatus, response: string | null): Promise<SupportTicket> {
  return unwrap<SupportTicket>(db().rpc('admin_update_ticket', { p_ticket_id: id, p_status: status, p_response: response }));
}

export function listReviews(): Promise<Review[]> {
  return unwrapList<Review>(db().from('reviews').select('*').order('created_at', { ascending: false }).limit(300));
}

export function setReviewHidden(id: string, hidden: boolean): Promise<Review> {
  return unwrap<Review>(db().rpc('admin_set_review_visibility', { p_review_id: id, p_hidden: hidden }));
}

// ---------------------------------------------------------------------------
// Catalogue & paramètres (super_admin)
// ---------------------------------------------------------------------------
export type CategoryInput = Pick<
  ServiceCategory,
  'name' | 'description' | 'icon' | 'vehicle_types' | 'base_price_min' | 'base_price_max' | 'travel_fee' | 'is_active' | 'sort_order'
>;

export function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<ServiceCategory> {
  return unwrap<ServiceCategory>(db().from('service_categories').update(patch).eq('id', id).select('*').single());
}

export function createCategory(input: CategoryInput & { slug: string }): Promise<ServiceCategory> {
  return unwrap<ServiceCategory>(db().from('service_categories').insert(input).select('*').single());
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  const { error } = await db().from('platform_settings').update({ value }).eq('key', key);
  if (error) throw error;
}

export function listAllSettings() {
  return unwrapList<{ key: string; value: unknown; description: string | null; updated_at: string }>(
    db().from('platform_settings').select('key, value, description, updated_at').order('key'),
  );
}
