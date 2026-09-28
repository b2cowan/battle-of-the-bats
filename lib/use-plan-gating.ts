'use client';
import { useEffect, useState } from 'react';
import { PLAN_CONFIG, isEffectivelyGated } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

/** true = gated (early access: no self-serve checkout). The shape `/api/plan-gating` returns. */
export type PlanGating = Record<OrgPlan, boolean>;

function fromCode(): PlanGating {
  return Object.fromEntries(
    (Object.keys(PLAN_CONFIG) as OrgPlan[]).map(k => [k, isEffectivelyGated(k)]),
  ) as PlanGating;
}

/**
 * Which plans are gated right now, as the server resolves it — the platform admin's switch
 * (`plan_gating`) plus the dev overrides; the client twin of `getPlanGatingMap()`. `null` until it
 * arrives; the code's fixed `gatingStatus` if the read fails.
 *
 * ⚠ A screen must never answer "can this be bought?" from `isEffectivelyGated()` alone: that reads
 * only the code's fixed setting, which the live switch overrides. The org billing page's "Managing
 * more than tournaments?" shelf did, and told every Tournament / Tournament Plus organizer the
 * Coaches Portal was "Coming soon · Early access only" from the day it opened on production
 * (2026-07-24) until the owner caught it on the §245 walk (2026-09-28).
 */
export function usePlanGating(): PlanGating | null {
  const [gating, setGating] = useState<PlanGating | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/plan-gating')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setGating(d ? (d as PlanGating) : fromCode()); })
      .catch(() => { if (live) setGating(fromCode()); });
    return () => { live = false; };
  }, []);
  return gating;
}
