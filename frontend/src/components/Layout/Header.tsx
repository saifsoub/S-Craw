import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';

export function Header() {
  const { user } = useAuthStore();
  const { mutate: logout, isPending } = useLogout();

  const username = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? '';

  return (
    <header className="app-header">
      <div className="header-brand">
        <Link to="/" className="brand-link" aria-label="CollabMD home">
          <span aria-hidden="true">✍️</span>
          <span>CollabMD</span>
        </Link>
      </div>

      {user && (
        <div className="header-user">
          <div className="user-avatar" aria-hidden="true" title={username}>
            {username.charAt(0).toUpperCase()}
          </div>
          <span className="username" aria-label={`Signed in as ${username}`}>
            {username}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => logout()}
            disabled={isPending}
            aria-label="Sign out"
          >
            {isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </header>
  );
}
