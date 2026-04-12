import { useContext } from 'react';
import { SupabaseAuthContext } from './supabase-auth-context';
import type { SupabaseAuthContextValue } from './auth-types';

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return ctx;
}
