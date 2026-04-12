import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const BABYBLOOM_BUCKET = 'babybloom';

const SIGNED_URL_TTL = 3600;

export async function uploadDataUrl(
  client: SupabaseClient<Database>,
  userId: string,
  childId: string,
  folder: string,
  fileName: string,
  dataUrl: string,
  fileType: string,
): Promise<{ path: string; size: number }> {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${childId}/${folder}/${crypto.randomUUID()}-${safe}`;

  const { error } = await client.storage.from(BABYBLOOM_BUCKET).upload(path, binary, {
    contentType: fileType || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return { path, size: binary.length };
}

export async function getSignedUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(BABYBLOOM_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error) throw error;
  return data.signedUrl;
}
