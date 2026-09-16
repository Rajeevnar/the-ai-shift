'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

interface Me {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  isPlatformAdmin: boolean;
  tenant: { name: string; isActive: boolean; emailFromName: string | null };
}

interface AuthContextValue {
  user: Me | null;
  // True only for the brief synchronous localStorage check on first mount
  // — never waits on a network round trip. See hasToken below for why.
  loading: boolean;
  // True the instant a token is found in localStorage, well before
  // `/auth/me` has actually confirmed it's still valid. Pages should gate
  // rendering on this (near-instant) rather than on `user` being populated
  // (which waits on a real API call) — otherwise every navigation shows a
  // "Loading…" screen for the length of that round trip, even though the
  // token was already sitting there the whole time.
  hasToken: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (tenantName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    // Render as authenticated immediately — don't block on /auth/me
    // resolving first. It still runs, in the background, to populate the
    // real user/tenant data and to catch a token that's actually expired
    // or revoked (in which case it clears the token and bounces to login,
    // same as before).
    setHasToken(true);
    setLoading(false);
    api
      .get<Me>('/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('accessToken');
        setHasToken(false);
        router.replace('/login');
      });
  }, [router]);

  async function afterToken(accessToken: string) {
    localStorage.setItem('accessToken', accessToken);
    setHasToken(true);
    const me = await api.get<Me>('/auth/me');
    setUser(me);
    router.push('/dashboard');
  }

  async function login(email: string, password: string) {
    const { accessToken } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
    await afterToken(accessToken);
  }

  async function register(tenantName: string, email: string, password: string) {
    const { accessToken } = await api.post<{ accessToken: string }>('/auth/register', {
      tenantName,
      email,
      password,
    });
    await afterToken(accessToken);
  }

  function logout() {
    localStorage.removeItem('accessToken');
    setUser(null);
    setHasToken(false);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasToken, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
