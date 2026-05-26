import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  /** Called by the Supabase auth listener in App.tsx */
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
    }),
}));

/** Convenience selector — returns the current Supabase access token */
export const getAccessToken = (): string | null =>
  useAuthStore.getState().session?.access_token ?? null;
