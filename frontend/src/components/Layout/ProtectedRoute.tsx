import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  return isAuthenticated ? (
    <Outlet />
  ) : (
    // Preserve the attempted URL so we can redirect back after login
    <Navigate to="/login" state={{ from: location }} replace />
  );
}
