import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { subscribeTable } from '@/services/notifications/notifications.service';

/**
 * Invalide les requêtes React Query à chaque changement temps réel de la table filtrée.
 * Ex. : useRealtimeInvalidate('service_requests', `id=eq.${id}`, [['request', id]])
 */
export function useRealtimeInvalidate(table: string, filter: string | undefined, keys: QueryKey[], enabled = true) {
  const qc = useQueryClient();
  const keysRef = useRef(keys);
  keysRef.current = keys;

  useEffect(() => {
    if (!enabled) return;
    const name = `rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;
    return subscribeTable(name, table, filter, () => {
      for (const k of keysRef.current) void qc.invalidateQueries({ queryKey: k });
    });
  }, [table, filter, enabled, qc]);
}
