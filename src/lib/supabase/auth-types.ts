import type { Session, User } from '@supabase/supabase-js';

export type SupabaseAuthContextValue = {
  session: Session | null;
  user: User | null;
  /** False until first onAuthStateChange (or immediately true if Supabase not configured). */
  initialized: boolean;
  /** True when a browser Supabase client exists (env URL + key); use for gating cloud sign-in/up. */
  cloudAuthReady: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
};
