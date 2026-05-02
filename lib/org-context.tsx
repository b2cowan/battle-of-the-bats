'use client';
import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase-browser';
import { getOrganizationByUserId, getOrgMembership } from './db';
import type { Organization, OrgRole } from './types';

interface OrgContextType {
  user: User | null;
  currentOrg: Organization | null;
  userRole: OrgRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
  user: null,
  currentOrg: null,
  userRole: null,
  loading: true,
  refresh: async () => {},
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole]   = useState<OrgRole | null>(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setUser(null);
      setCurrentOrg(null);
      setUserRole(null);
      setLoading(false);
      return;
    }
    setUser(authUser);
    const org = await getOrganizationByUserId(authUser.id);
    setCurrentOrg(org);
    if (org) {
      const membership = await getOrgMembership(authUser.id, org.id);
      setUserRole(membership?.role ?? null);
    }
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    await load(authUser);
  }, [load]);

  useEffect(() => {
    const supabase = createClient();

    // Initial load
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      load(authUser);
    });

    // Keep in sync with auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { load(session?.user ?? null); }
    );

    return () => subscription.unsubscribe();
  }, [load]);

  return (
    <OrgContext.Provider value={{ user, currentOrg, userRole, loading, refresh }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
