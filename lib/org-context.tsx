'use client';
import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase-browser';
import type { Organization, OrgRole } from './types';

interface OrgContextType {
  user: User | null;
  currentOrg: Organization | null;
  userRole: OrgRole | null;
  userCapabilities: Record<string, boolean> | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

type OrgProviderProps = {
  children: ReactNode;
  initialOrg?: Organization | null;
  initialUserRole?: OrgRole | null;
  initialUserCapabilities?: Record<string, boolean> | null;
};

const OrgContext = createContext<OrgContextType>({
  user: null,
  currentOrg: null,
  userRole: null,
  userCapabilities: null,
  loading: true,
  refresh: async () => {},
});

export function OrgProvider({
  children,
  initialOrg = null,
  initialUserRole = null,
  initialUserCapabilities = null,
}: OrgProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(initialOrg);
  const [userRole, setUserRole] = useState<OrgRole | null>(initialUserRole);
  const [userCapabilities, setUserCapabilities] = useState<Record<string, boolean> | null>(initialUserCapabilities);
  const [loading, setLoading] = useState(!initialOrg || !initialUserRole);

  const load = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setUser(null);
      setCurrentOrg(null);
      setUserRole(null);
      setUserCapabilities(null);
      setLoading(false);
      return;
    }
    setUser(authUser);

    try {
      const orgParam = initialOrg?.slug ? `?orgSlug=${encodeURIComponent(initialOrg.slug)}` : '';
      const res = await fetch(`/api/org-context${orgParam}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCurrentOrg(data.org ?? null);
        setUserRole(data.userRole ?? null);
        setUserCapabilities(data.userCapabilities ?? null);
      } else if (!initialOrg) {
        setCurrentOrg(null);
        setUserRole(null);
        setUserCapabilities(null);
      }
    } catch {
      if (!initialOrg) {
        setCurrentOrg(null);
        setUserRole(null);
        setUserCapabilities(null);
      }
    }
    setLoading(false);
  }, [initialOrg]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    await load(authUser);
  }, [load]);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      load(authUser);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { load(session?.user ?? null); }
    );

    return () => subscription.unsubscribe();
  }, [load]);

  return (
    <OrgContext.Provider value={{ user, currentOrg, userRole, userCapabilities, loading, refresh }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
