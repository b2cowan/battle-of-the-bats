'use client';

import { useEffect, useState } from 'react';
import { COACHES_HOME_PATH } from './coaches-portal-routes';

export interface OrgCoachAccess {
  /** Rep (paid) coaching assignment in THIS org — coach home is `/${orgSlug}/coaches`. */
  hasRepAccess: boolean;
  /** Coaches a free (Basic) team anywhere — coach home is the global launchpad `/coaches`. */
  hasBasicCoachTeam: boolean;
}

const NONE: OrgCoachAccess = { hasRepAccess: false, hasBasicCoachTeam: false };

/**
 * The admin shell's coach-view door for a given access result: whether to show it and where it
 * points (rep coach → this org's portal; Basic-only coach → the global launchpad). Single source
 * of truth so the desktop sidebar + mobile nav can't drift on the rule.
 */
export function coachDoorFor(access: OrgCoachAccess, orgSlug: string | null | undefined) {
  return {
    show: access.hasRepAccess || access.hasBasicCoachTeam,
    href: access.hasRepAccess && orgSlug ? `/${orgSlug}/coaches` : COACHES_HOME_PATH,
  };
}

/**
 * Whether the signed-in user coaches — rep (in this org) and/or Basic (anywhere) — for the admin
 * shell's coach-view door. Returns BOTH signals so each caller routes correctly (see `coachDoorFor`
 * for the shared door rule; the rep-only tiles read `hasRepAccess` directly). `enabled` gates the
 * fetch (pass `!isCanceled` to detect any coach; pass a rep-only condition where only rep matters).
 *
 * Fetches per hook instance (aborted on unmount). NOT shared through a module-level cache: the
 * admin logout path is a client navigation, not a full reload, so a cache surviving the sign-out
 * boundary could replay one user's result to the next on a shared device (/review 2026-07-22).
 */
export function useCurrentOrgCoachAccess(
  orgSlug: string | null | undefined,
  enabled: boolean,
): OrgCoachAccess {
  const [result, setResult] = useState<{ orgSlug: string | null; access: OrgCoachAccess }>({
    orgSlug: null,
    access: NONE,
  });

  useEffect(() => {
    if (!enabled || !orgSlug) return;

    const controller = new AbortController();
    fetch(`/api/coaches/${orgSlug}/assignments`, { cache: 'no-store', signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!controller.signal.aborted) {
          setResult({
            orgSlug,
            access: {
              hasRepAccess: Array.isArray(data?.assignments) && data.assignments.length > 0,
              hasBasicCoachTeam: Boolean(data?.hasBasicCoachTeam),
            },
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ orgSlug, access: NONE });
      });

    return () => controller.abort();
  }, [enabled, orgSlug]);

  if (!enabled || !orgSlug || result.orgSlug !== orgSlug) return NONE;
  return result.access;
}
