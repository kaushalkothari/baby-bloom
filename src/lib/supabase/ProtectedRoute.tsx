import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from './useSupabaseAuth';

/**
 * Gate all nested routes behind Supabase auth when cloud is configured.
 * Offline mode (no Supabase env) passes through without a login wall.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const { session, initialized, cloudAuthReady } = useSupabaseAuth();

  if (!cloudAuthReady) {
    return <Outlet />;
  }

  if (!initialized || !session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
