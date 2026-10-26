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

/**
 * Does this organization hold a running Founding Season comp, whatever its plan? The same once-per-page status read as
 * the lock lines. For a surface that speaks to a HOLDER rather than to a newcomer (the onboarding welcome): the offer's
 * window closed early (owner 2026-10-26), but a holder is still in its Founding Season. False while loading.
 */
export function useHoldsFoundingComp(): boolean {
  const { currentOrg } = useOrg();
  const slug = currentOrg?.slug ?? null;
  const [answer, setAnswer] = useState<{ slug: string; isFoundingSeason: boolean } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    askOnce(slug).then(isFoundingSeason => { if (live) setAnswer({ slug, isFoundingSeason }); });
    return () => { live = false; };
  }, [slug]);

  return Boolean(answer && answer.slug === slug && answer.isFoundingSeason);
}

/**
 * Is Tournament Plus still $0 for THIS organization's plan choice: the checkout's own answer
 * (`foundingSeasonOfferOnPlanChoice`), so a price card never shows a price the checkout won't charge. Read fresh on each
 * mount, never cached for the page: the answer can change as setup starts. Feed it to `showsFoundingZero`. False while
 * loading, the list price, which is what the checkout falls back to as well. `enabled` false asks nothing (a caller that
 * already holds the answer, or a panel that is closed).
 */
export function useFoundingOfferOnPlanChoice(enabled = true): boolean {
  const { currentOrg } = useOrg();
  const slug = enabled ? currentOrg?.slug ?? null : null;
  const [answer, setAnswer] = useState<{ slug: string; held: boolean } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    fetch(`/api/admin/org/founding-season-status?orgSlug=${encodeURIComponent(slug)}&planChoice=1`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { offerOnPlanChoice?: boolean } | null) => { if (live) setAnswer({ slug, held: d?.offerOnPlanChoice === true }); })
      .catch(() => {});
    return () => { live = false; };
  }, [slug]);

  return Boolean(answer && answer.slug === slug && answer.held);
}
