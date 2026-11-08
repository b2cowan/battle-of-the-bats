'use client';
import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase-browser';
import type { Organization, OrgRole } from './types';
import type { Capability } from './roles';
import { canOpenModule } from './member-access';

interface OrgContextType {
  user: User | null;
  currentOrg: Organization | null;
  userRole: OrgRole | null;
  userCapabilities: Record<string, boolean> | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Can the signed-in person open this module HERE — their role holds the capability AND the org's
   * plan carries it (`canOpenModule`, the one gate every route asks, Club Tier Stage 1). A screen
   * that shows or hides a door asks this rather than rebuilding the member from the fields above,
   * so it can never offer a door the server refuses.
   */
  canOpen: (cap: Capability) => boolean;
  /**
   * The club has connected payouts at some time (`clubHasPayouts`, read once by the admin layout on the server, and only
   * for someone who can open Accounting): Accounting's Payouts tab exists. The admin's pinned bar names that tab on its
   * first paint from this (Admin header bar Phase 2). False wherever nobody read it (outside the admin).
   */
  clubHasPayouts: boolean;
  /**
   * The member is limited to some of the club's team groups (`repGroupIds`, read by the admin layout on the server). Such a
   * member is never given Families (`canOpenFamilies`, Stage 5a Ask 12), whatever their capability says, so the pinned bar
   * must not name Families over their refusal. False wherever nobody read it.
   */
  limitedToTeamGroups: boolean;
}

type OrgProviderProps = {
  children: ReactNode;
  initialOrg?: Organization | null;
  initialUserRole?: OrgRole | null;
  initialUserCapabilities?: Record<string, boolean> | null;
  /** See `OrgContextType.clubHasPayouts`: decided by the server, never refetched. */
  clubHasPayouts?: boolean;
  /** See `OrgContextType.limitedToTeamGroups`: decided by the server, never refetched. */
  limitedToTeamGroups?: boolean;
};

const OrgContext = createContext<OrgContextType>({
  user: null,
  currentOrg: null,
  userRole: null,
  userCapabilities: null,
  loading: true,
  refresh: async () => {},
  canOpen: () => false,
  clubHasPayouts: false,
  limitedToTeamGroups: false,
});

export function OrgProvider({
  children,
  initialOrg = null,
  initialUserRole = null,
  initialUserCapabilities = null,
  clubHasPayouts = false,
  limitedToTeamGroups = false,
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

  const canOpen = (cap: Capability): boolean => !!currentOrg && !!userRole
    && canOpenModule({ role: userRole, capabilities: userCapabilities }, currentOrg, cap);

  return (
    <OrgContext.Provider value={{ user, currentOrg, userRole, userCapabilities, loading, refresh, canOpen, clubHasPayouts, limitedToTeamGroups }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
