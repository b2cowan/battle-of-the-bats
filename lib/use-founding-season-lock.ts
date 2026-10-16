'use client';
/**
 * "Free for you through September 30, 2027" — does this organization's Tournament Plus lock carry the Founding Season
 * line (R10, M9)? The rule is `foundingSeasonLockUntil` (lib/plan-config.ts); this hook only asks the status route
 * once per organization per page load, and only for an organization on the free plan (nobody else can be told it).
 * Returns the date label, or null — while loading too, so a lock line never flickers a wrong claim.
 */
import { useEffect, useState } from 'react';
import { useOrg } from './org-context';
import { foundingSeasonLockUntil, isFreePlan } from './plan-config';

const asked = new Map<string, Promise<boolean>>();

function askOnce(orgSlug: string): Promise<boolean> {
  let pending = asked.get(orgSlug);
  if (!pending) {
    pending = fetch(`/api/admin/org/founding-season-status?orgSlug=${encodeURIComponent(orgSlug)}&compOnly=1`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { isFoundingSeason?: boolean } | null) => Boolean(d?.isFoundingSeason))
      .catch(() => false);
    asked.set(orgSlug, pending);
  }
  return pending;
}

export function useFoundingSeasonLock(): string | null {
  const { currentOrg } = useOrg();
  const slug = currentOrg?.slug ?? null;
  const onFree = Boolean(currentOrg) && isFreePlan(currentOrg?.planId);
  const [answer, setAnswer] = useState<{ slug: string; isFoundingSeason: boolean } | null>(null);

  useEffect(() => {
    if (!slug || !onFree) return;
    let live = true;
    askOnce(slug).then(isFoundingSeason => { if (live) setAnswer({ slug, isFoundingSeason }); });
    return () => { live = false; };
  }, [slug, onFree]);

  return foundingSeasonLockUntil(currentOrg?.planId, Boolean(onFree && answer && answer.slug === slug && answer.isFoundingSeason));
}
