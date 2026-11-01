import { db } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { publicUrl, uploadOwnFile } from './storage.service';

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export interface ProfileUpdate {
  full_name?: string;
  phone?: string | null;
  city?: string;
  commune?: string | null;
  avatar_url?: string | null;
}

export async function updateMyProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const { data, error } = await db().from('profiles').update(patch).eq('id', userId).select('*').single();
  if (error) throw error;
  return data as Profile;
}

export async function uploadAvatar(userId: string, file: File): Promise<Profile> {
  const path = await uploadOwnFile('avatars', userId, file);
  return updateMyProfile(userId, { avatar_url: publicUrl('avatars', path) });
}
