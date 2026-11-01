import type { RealtimeChannel } from '@supabase/supabase-js';
import { db, supabase } from '@/lib/supabase';
import type { AppNotification } from '@/types/database';
import { unwrap, unwrapList } from '../_helpers';

export function listNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  return unwrapList<AppNotification>(
    db().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
  );
}

export function markNotificationsRead(ids?: string[]): Promise<number> {
  return unwrap<number>(db().rpc('mark_notifications_read', { p_ids: ids ?? null }));
}

/**
 * Abonnement temps réel aux changements d'une table filtrée (RLS respectée par Supabase Realtime).
 * Renvoie une fonction de désabonnement.
 */
export function subscribeTable(
  channelName: string,
  table: string,
  filter: string | undefined,
  onChange: () => void,
): () => void {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel: RealtimeChannel = client
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => onChange())
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
