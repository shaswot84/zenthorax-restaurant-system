'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { apiPost } from '@/lib/api';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: string | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  role: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        syncUserRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        syncUserRole(session.user.id);
      } else {
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Best-effort session invalidation on tab close.
  // Uses sendBeacon to fire a one-way request to the backend before the page unloads.
  // Not guaranteed (browser may kill the tab first), but provides a safety net.
  useEffect(() => {
    const handler = () => {
      const token = session?.access_token;
      if (token) {
        navigator.sendBeacon(
          `${window.location.origin}/api/auth/expire-session`,
          JSON.stringify({ token }),
        );
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [session]);

  async function syncUserRole(userId: string) {
    try {
      const res = await apiPost<{ id: string; role: string; created: boolean }>(
        '/api/auth/sync',
      );
      if (res.success && res.data) {
        setRole(res.data.role);
      }
    } catch {
      // Fallback: role will be set by /api/auth/me
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin === 'http://localhost:3000' ? 'http://localhost:3000' : 'https://zenthorax-restaurant-system-frontend.vercel.app'}/auth/callback`,
        queryParams: {
          prompt: 'select_account',   // Always ask which Google account to use
          access_type: 'offline',     // Get refresh token
        },
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, session, role, isLoading, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
