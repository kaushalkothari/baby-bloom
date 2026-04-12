import { getSupabaseBrowserClient } from './client';
import { isSupabaseConfigured, getSupabaseEnv } from './config';

export type ConnectionStep = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type SupabaseConnectionResult = {
  ok: boolean;
  steps: ConnectionStep[];
};

/**
 * Runs checks that mirror what the app needs for cloud reads/writes.
 * Use from the UI or console: `import { testSupabaseConnection } from '@/lib/supabase/connection-test'`.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionResult> {
  const steps: ConnectionStep[] = [];

  const envOk = isSupabaseConfigured();
  const env = getSupabaseEnv();
  steps.push({
    name: 'VITE_SUPABASE_URL + key',
    ok: envOk,
    detail: envOk
      ? `URL host: ${(() => {
          try {
            return new URL(env!.url).host;
          } catch {
            return '(invalid URL)';
          }
        })()}`
      : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY, then restart dev.',
  });

  const client = getSupabaseBrowserClient();
  steps.push({
    name: 'Browser client',
    ok: client != null,
    detail: client ? 'createClient succeeded' : 'getSupabaseBrowserClient() returned null',
  });

  if (!client) {
    return { ok: false, steps };
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  const uid = session?.user?.id ?? null;
  steps.push({
    name: 'Auth session',
    ok: !!uid,
    detail: sessionError?.message ?? (uid ? `user ${uid.slice(0, 8)}…` : 'Sign in required for inserts (RLS uses auth.uid()).'),
  });

  const { error: readError } = await client.from('children').select('id').limit(1);
  steps.push({
    name: 'REST read public.children',
    ok: !readError,
    detail: readError?.message ?? 'GET /rest/v1/children OK (or empty table).',
  });

  const allOk = steps.every((s) => s.ok);
  return { ok: allOk, steps };
}
