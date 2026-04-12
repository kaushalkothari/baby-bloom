import { createContext } from 'react';
import type { SupabaseAuthContextValue } from './auth-types';

export const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);
