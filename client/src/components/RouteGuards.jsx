import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';
import { ErrorState, PageLoader } from './ui/States';

function BootError() {
  const { retry, logout } = useAuth();
  return (
    <div className="not-found">
      <div className="card">
        <ErrorState
          title="We couldn't load your account"
          error={{ message: 'The server may be unavailable. Please try again in a moment.' }}
          onRetry={retry}
        >
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            Sign out
          </Button>
        </ErrorState>
      </div>
    </div>
  );
}

/** Only logged-in users (optionally limited to `roles`) can see child routes. */
export function RequireAuth({ roles }) {
  const { user, status, keepReturnPath } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Loading your workspace…" />;
  if (status === 'error') return <BootError />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={keepReturnPath ? { from: location } : undefined} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Login page: already logged-in users are sent to where they came from. */
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  return <Outlet />;
}
