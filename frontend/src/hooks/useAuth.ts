import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { User, AuthTokens } from '../types';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export function useLogin() {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  return useMutation<AuthResponse, Error, { emailOrUsername: string; password: string }>({
    mutationFn: async (creds) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: (data) => {
      login(data.user, data.tokens);
      navigate('/');
    },
  });
}

export function useRegister() {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  return useMutation<AuthResponse, Error, { email: string; username: string; password: string }>({
    mutationFn: async (creds) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: (data) => {
      login(data.user, data.tokens);
      navigate('/');
    },
  });
}

export function useLogout() {
  const { logout, refreshToken, accessToken } = useAuthStore();
  const navigate = useNavigate();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });
    },
    onSettled: () => {
      logout();
      navigate('/login');
    },
  });
}
