import { useQuery } from '@tanstack/react-query';
import { listCategories, listSettings } from '@/services/catalog.service';
import { env } from '@/config/env';

/** Catalogue des services (mis en cache 10 min). */
export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['categories', includeInactive],
    queryFn: () => listCategories(includeInactive),
    enabled: env.isSupabaseConfigured,
    staleTime: 10 * 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: listSettings,
    enabled: env.isSupabaseConfigured,
    staleTime: 10 * 60_000,
  });
}
