import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { clearCache } from '@/lib/query-client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type Auth = {
  session: Session | null;
  /** True until the stored session has been read on launch. */
  loading: boolean;
  userId: string | null;
  email: string | null;
  /**
   * True while a password reset is mid-way: the reset code signs the user in, but the app stays on
   * the sign-in screen until the new password is saved.
   */
  recovering: boolean;
  setRecovering: (value: boolean) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // The session is stored on the device, so this resolves instantly (no network) on launch.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await clearCache();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        userId: session?.user.id ?? null,
        email: session?.user.email ?? null,
        recovering,
        setRecovering,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
