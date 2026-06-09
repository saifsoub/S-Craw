import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ── Register ──────────────────────────────────────────────────────────────────

export function useRegister() {
  const navigate = useNavigate();

  return useMutation<void, Error, { email: string; username: string; password: string }>({
    mutationFn: async ({ email, username, password }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // username stored in user_metadata → picked up by the DB trigger
          // that auto-creates a row in user_profiles on first sign-in
          data: { username },
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => navigate('/'),
  });
}

// ── Login ─────────────────────────────────────────────────────────────────────

export function useLogin() {
  const navigate = useNavigate();

  return useMutation<void, Error, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => navigate('/'),
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────

export function useLogout() {
  const navigate = useNavigate();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    onSettled: () => navigate('/login'),
  });
}
