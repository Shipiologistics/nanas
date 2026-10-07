import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppRole } from '@/constants/nanas';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type SessionContextValue = {
  configured: boolean; loading: boolean; session: Session | null; user: User | null;
  roles: AppRole[]; role: AppRole | null; chooseRole: (role: AppRole) => void;
  refreshRoles: () => Promise<void>; signOut: () => Promise<void>;
};
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const loadRoles = useCallback(async (next: Session | null) => {
    if (!next) { setRoles([]); setRole(null); return; }
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', next.user.id).is('revoked_at', null);
    if (error) throw error;
    const allowed = (data ?? []).map((item) => item.role).filter((value): value is AppRole => value === 'buyer' || value === 'seller');
    setRoles(allowed);
    setRole((current) => current && allowed.includes(current) ? current : allowed.length === 1 ? allowed[0] : null);
  }, []);
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      try { await loadRoles(data.session); } finally { if (active) setLoading(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next); setLoading(true);
      queueMicrotask(() => loadRoles(next).finally(() => { if (active) setLoading(false); }));
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadRoles]);
  const value = useMemo<SessionContextValue>(() => ({
    configured: isSupabaseConfigured, loading, session, user: session?.user ?? null, roles, role,
    chooseRole: (next) => { if (roles.includes(next)) setRole(next); },
    refreshRoles: async () => loadRoles(session), signOut: async () => { await supabase.auth.signOut(); },
  }), [loadRoles, loading, role, roles, session]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
