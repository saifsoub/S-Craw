import { useEffect, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { DocumentList } from './components/Documents/DocumentList';
import { CollaborativeEditor } from './components/Editor/CollaborativeEditor';
import { Header } from './components/Layout/Header';
import { ProtectedRoute } from './components/Layout/ProtectedRoute';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

/**
 * Subscribes to Supabase auth state changes and syncs them into Zustand.
 * This is the single source of truth for session state across the app.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const { setSession } = useAuthStore();

  useEffect(() => {
    // Hydrate from persisted session on first load
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // Keep store in sync with future auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  return <>{children}</>;
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">{children}</main>
    </div>
  );
}

function EditorPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return <CollaborativeEditor documentId={id} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppShell><DocumentList /></AppShell>} />
              <Route path="/document/:id" element={<AppShell><EditorPage /></AppShell>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  );
}
