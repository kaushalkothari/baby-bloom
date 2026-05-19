/**
 * BabyBloomCare
 * Copyright (c) 2026 Kaushal Kothari. All rights reserved.
 * Unauthorized copying, modification or distribution
 * of this software is strictly prohibited.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';
import { isSupabaseConfigured } from './config';
import { SupabaseAuthContext } from './supabase-auth-context';
import type { SupabaseAuthContextValue } from './auth-types';
import { writeAuditLog } from '@/lib/audit/auditLogger';

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(!isSupabaseConfigured());

  const envConfigured = isSupabaseConfigured();
  const client = useMemo(() => {
    if (!envConfigured) return null;
    return getSupabaseBrowserClient();
  }, [envConfigured]);

  useEffect(() => {
    if (!client) {
      setSession(null);
      setInitialized(true);
      return;
    }
    setInitialized(false);
    let cancelled = false;
    void client.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(s);
        setInitialized(true);
      }
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!client) return { error: new Error('Supabase is not configured') };
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        await writeAuditLog(client, data.user.id, { action: 'sign_in', metadata: { method: 'email' } });
      }
      return { error: error ? new Error(error.message) : null };
    },
    [client],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      if (!client) return { error: new Error('Supabase is not configured') };
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: displayName ? { data: { display_name: displayName } } : undefined,
      });
      if (error) return { error: new Error(error.message) };
      if (data.user) {
        await writeAuditLog(client, data.user.id, { action: 'sign_up', metadata: { method: 'email' } });
      }
      return { error: null };
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    const uid = session?.user?.id;
    if (uid) {
      await writeAuditLog(client, uid, { action: 'sign_out' });
    }
    await client.auth.signOut();
  }, [client, session]);

  const resetPasswordForEmail = useCallback(
    async (email: string) => {
      if (!client) return { error: new Error('Supabase is not configured') };
      const redirect = `${window.location.origin}/login`;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      if (!error && session?.user?.id) {
        await writeAuditLog(client, session.user.id, {
          action: 'password_reset_request',
          metadata: { method: 'email' },
        });
      }
      return { error: error ? new Error(error.message) : null };
    },
    [client, session],
  );

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initialized,
      cloudAuthReady: client != null,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      resetPasswordForEmail,
    }),
    [session, initialized, client, signInWithEmail, signUpWithEmail, signOut, resetPasswordForEmail],
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}
