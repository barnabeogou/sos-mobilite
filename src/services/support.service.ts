import { db } from '@/lib/supabase';
import type { SupportTicket, TicketCategory } from '@/types/database';
import { unwrap, unwrapList } from './_helpers';

export function listMyTickets(userId: string): Promise<SupportTicket[]> {
  return unwrapList<SupportTicket>(
    db().from('support_tickets').select('*').eq('created_by', userId).order('created_at', { ascending: false }),
  );
}

export function createTicket(
  userId: string,
  input: { category: TicketCategory; subject: string; message: string; requestId?: string | null },
): Promise<SupportTicket> {
  return unwrap<SupportTicket>(
    db()
      .from('support_tickets')
      .insert({
        created_by: userId,
        category: input.category,
        subject: input.subject,
        message: input.message,
        request_id: input.requestId ?? null,
      })
      .select('*')
      .single(),
  );
}
