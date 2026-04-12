import { useLocalAppData } from '@/hooks/useLocalAppData';
import { useSupabaseAuth } from '@/lib/supabase/useSupabaseAuth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useCloudAppData } from '@/lib/supabase/useCloudAppData';

/**
 * Data layer:
 * - **Offline:** `VITE_SUPABASE_URL` + publishable/anon key missing → `localStorage` (`useLocalAppData`).
 * - **Cloud:** those env vars set + signed in → Supabase (`useCloudAppData`); inserts go to Postgres, not localStorage.
 */
export function useAppData() {
  const configured = isSupabaseConfigured();
  const auth = useSupabaseAuth();
  const local = useLocalAppData();
  const live = configured && auth.initialized && !!auth.session?.user?.id;
  const cloud = useCloudAppData(live, auth.session?.user?.id ?? null);

  const signOut = auth.signOut;

  /** Only meaningful when Supabase is configured; layout shows it when `usesRemoteData`. */
  const userEmail =
    configured && auth.session?.user?.email ? auth.session.user.email : null;

  if (!configured) {
    return {
      ...local,
      authLoading: false as const,
      usesRemoteData: false as const,
      userEmail: null as string | null,
      signOut: async () => {},
    };
  }

  if (!auth.initialized) {
    return {
      ...cloud,
      authLoading: true as const,
      usesRemoteData: true as const,
      userEmail: null as string | null,
      signOut,
    };
  }

  if (!auth.session) {
    return {
      ...cloud,
      authLoading: false as const,
      usesRemoteData: true as const,
      userEmail: null as string | null,
      signOut,
    };
  }

  return {
    ...cloud,
    authLoading: false as const,
    usesRemoteData: true as const,
    userEmail,
    signOut,
  };
}
