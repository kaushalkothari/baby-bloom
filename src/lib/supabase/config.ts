/** Prefer publishable key (`sb_publishable_...`); legacy anon JWT still supported. */
function getSupabasePublicKey(): string {
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable) return publishable;
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
}

/** Central Supabase env checks — use before creating the client. */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = getSupabasePublicKey();
  return Boolean(url && key);
}

/** URL + client-safe API key for `createClient` (publishable or legacy anon). */
export function getSupabaseEnv(): { url: string; supabaseKey: string } | null {
  if (!isSupabaseConfigured()) return null;
  return {
    url: import.meta.env.VITE_SUPABASE_URL!.trim(),
    supabaseKey: getSupabasePublicKey(),
  };
}
