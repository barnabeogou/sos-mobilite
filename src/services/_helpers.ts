import type { PostgrestError } from '@supabase/supabase-js';

interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Renvoie les données ou lève l'erreur Supabase (traduite plus haut par errorMessage). */
export async function unwrap<T>(query: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data as T;
}

export async function unwrapList<T>(query: PromiseLike<Result<T[]>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function uniq<T>(arr: (T | null | undefined)[]): T[] {
  return Array.from(new Set(arr.filter((x): x is T => x != null)));
}
