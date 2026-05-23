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

  // Fetches fresh org/role data from the API. Called by refresh() on explicit user actions
  // (billing changes, settings saves, etc.) — NOT on every auth state event.
  const doFetchOrgContext = useCallback(async () => {
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
  }, [initialOrg]);

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

    // When the server already provided initialOrg, auth was already verified server-side.
    // Skip the redundant client-side fetch — auth state events (INITIAL_SESSION,
    // TOKEN_REFRESHED, etc.) firing after hydration would otherwise generate a storm of
    // 401s in deployed environments where SSR cookies aren't forwarded to API routes.
    if (!initialOrg) {
      await doFetchOrgContext();
    }

    setLoading(false);
  }, [initialOrg, doFetchOrgContext]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    setUser(authUser);
    if (authUser) await doFetchOrgContext();
  }, [doFetchOrgContext]);

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
