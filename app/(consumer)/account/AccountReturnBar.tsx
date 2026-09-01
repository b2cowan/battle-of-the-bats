'use client';

/**
 * AccountReturnBar — "← Back to your Coaches Portal / Admin Area" across the top of the
 * /account space when the visitor arrived from an operator surface (the strips' account
 * menu appends `?back=<current path>` to its outbound rows — COACH_ACCOUNT_MENU_PLAN.md,
 * 2026-09-01). Chat earned this exact bar at A3 QA for the same trip; this extends it to
 * its second surface. Sanitized to an internal path AND restricted to the two operator
 * prefixes, so the affordance can't be aimed anywhere else; absent for fans and direct
 * visits. Label vocabulary comes from the one kind→label map (workspace-labels), so a
 * family rename reaches this bar for free.
 *
 * v1 limitation, accepted in the plan: the bar lives on the arrival URL — navigating the
 * account rail drops the param and the bar. Same behavior as Chat's.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { safeNextPath } from '@/lib/safe-redirect';
import { WORKSPACE_KIND_LABEL } from '@/lib/workspace-labels';
import styles from './account.module.css';

function returnLabel(path: string): string | null {
  // Premium surfaces live at /{orgSlug}/coaches|admin/…; the free coach portal at /coaches/….
  // The bare-prefix checks can't collide with an org slug: 'coaches' and 'admin' are reserved
  // slugs (lib/reserved-slugs.ts) — but the admin check runs first anyway so this file stays
  // correct even if that reservation is ever relaxed.
  const seg = path.split('?')[0].split('/').filter(Boolean);
  if (seg[1] === 'admin') return WORKSPACE_KIND_LABEL.organization;
  if (seg[1] === 'coaches') return WORKSPACE_KIND_LABEL.coaches_premium;
  if (seg[0] === 'coaches') return WORKSPACE_KIND_LABEL.coaches_basic;
  return null;
}

function Bar() {
  const raw = useSearchParams().get('back');
  const back = raw ? safeNextPath(raw, null) : null;
  const label = back ? returnLabel(back) : null;
  if (!back || !label) return null;
  return (
    <Link href={back} className={styles.returnBar}>
      <ArrowLeft size={14} aria-hidden /> Back to your {label}
    </Link>
  );
}

export default function AccountReturnBar() {
  // useSearchParams needs a Suspense boundary under a server layout; the bar renders
  // nothing while (and after) suspending unless a valid back param is present.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
