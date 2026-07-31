'use client';
import { useLayoutEffect } from 'react';
import { useOrgNav } from './OrgNavContext';

export function OrgNavSync({
  logoUrl,
  orgName,
  orgHomeHref = null,
  restoreLogoUrl,
  restoreOrgName,
}: {
  logoUrl: string | null;
  orgName: string;
  /** Set by the tournament layout when /{orgSlug} is a real destination (public-site
   *  module or 2+ active events) — turns the event chrome's org name into a door up
   *  (Nav Unification Stage B.2). Omitted (null) everywhere else. */
  orgHomeHref?: string | null;
  /** Nested-sync unmount target (/review 2026-07-31): when THIS sync unmounts while an
   *  ANCESTOR org layout stays mounted — the tournament→org-home trip the Stage B.2 links
   *  made reachable — the ancestor's own OrgNavSync effect never re-fires (its props didn't
   *  change), so a blank-on-cleanup left the org page's nav with no name or logo. A nested
   *  sync (the tournament layout) passes the org identity here so cleanup RESTORES it;
   *  top-level syncs omit it and keep the original blank-on-leave behavior. */
  restoreLogoUrl?: string | null;
  restoreOrgName?: string;
}) {
  const { setOrgNav } = useOrgNav();

  useLayoutEffect(() => {
    setOrgNav(logoUrl, orgName, orgHomeHref);
    return () => {
      if (restoreOrgName !== undefined) setOrgNav(restoreLogoUrl ?? null, restoreOrgName, null);
      else setOrgNav(null, '', null);
    };
  }, [logoUrl, orgName, orgHomeHref, restoreLogoUrl, restoreOrgName, setOrgNav]);

  return null;
}
