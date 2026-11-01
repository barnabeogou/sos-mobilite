import { db } from '@/lib/supabase';

export type Bucket = 'request-photos' | 'mechanic-documents' | 'avatars';

const MAX_IMAGE_SIDE = 1600;

/**
 * Réduit les photos avant envoi (réseaux mobiles) : JPEG ~80 %, 1600 px max.
 * Les PDF et formats non pris en charge par le canvas sont envoyés tels quels.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function extensionFor(blob: Blob, fallbackName: string): string {
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/png') return 'png';
  if (blob.type === 'image/webp') return 'webp';
  if (blob.type === 'application/pdf') return 'pdf';
  return fallbackName.split('.').pop()?.toLowerCase() ?? 'bin';
}

/** Dépose un fichier dans <bucket>/<uid>/<uuid>.<ext> et renvoie le chemin. */
export async function uploadOwnFile(bucket: Bucket, userId: string, file: File): Promise<string> {
  const body = bucket === 'mechanic-documents' && file.type === 'application/pdf' ? file : await compressImage(file);
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(body, file.name)}`;
  const { error } = await db().storage.from(bucket).upload(path, body, {
    contentType: body.type || file.type,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  return path;
}

export async function removeOwnFiles(bucket: Bucket, paths: string[]) {
  if (!paths.length) return;
  await db().storage.from(bucket).remove(paths);
}

/** URL temporaire (10 min) pour un fichier privé. */
export async function signedUrl(bucket: Bucket, path: string, expiresIn = 600): Promise<string | null> {
  const { data, error } = await db().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function signedUrls(bucket: Bucket, paths: string[], expiresIn = 600): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await db().storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}

export function publicUrl(bucket: Bucket, path: string): string {
  return db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
