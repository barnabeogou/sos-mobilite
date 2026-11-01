import { db } from '@/lib/supabase';
import type { PlatformSetting, ServiceCategory } from '@/types/database';

export async function listCategories(includeInactive = false): Promise<ServiceCategory[]> {
  let q = db().from('service_categories').select('*').order('sort_order');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ServiceCategory[];
}

export async function listSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await db().from('platform_settings').select('key, value');
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as Pick<PlatformSetting, 'key' | 'value'>[]).map((s) => [s.key, s.value]));
}

export interface SupportContacts {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

export function supportContacts(settings: Record<string, unknown> | undefined): SupportContacts {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    phone: str(settings?.support_phone),
    whatsapp: str(settings?.support_whatsapp),
    email: str(settings?.support_email),
  };
}

export function numericSetting(settings: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const v = settings?.[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
