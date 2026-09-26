import { Lock } from 'lucide-react';
import CoachEmptyState from './CoachEmptyState';
import { getBillingHref } from '@/lib/billing-urls';

/**
 * The wall a coach meets when the CLUB'S PLAN no longer carries the Coaches Portal (B05, Stage 1
 * specimen 2). Decided on the server, in the portal layout, before any portal screen mounts.
 *
 * Same block, two causes, two sentences (specimen 2's table): "…isn't turned on for you"
 * (`CoachNotGranted`) is a person's grant and its remedy is the head coach; THIS is the club's plan,
 * and its remedy is the club's owner. The words differ because the remedies differ.
 *
 * The owner can act — "See plans" opens Plan & billing — so for them it is a full card with its
 * one action. Everyone else cannot act from here, so theirs is the quiet variant with no button
 * (house rule 2026-07-31: the quiet trigger is the absence of a CTA on the block).
 *
 * ⚠ It promises the data is kept, and that is true: a plan change deletes nothing (only a
 * cancellation's retention window ever purges). If that stops being true, this sentence changes.
 */
export default function CoachPlanWall({
  orgName,
  orgSlug,
  planId,
  teamName,
  ownerName,
  viewerIsOwner,
}: {
  orgName: string;
  orgSlug: string;
  /** The org's plan — picks the billing page "See plans" opens (a tournament tier keeps its own). */
  planId: string;
  /** The viewer's team when they coach exactly one here; otherwise null. */
  teamName: string | null;
  ownerName: string | null;
  viewerIsOwner: boolean;
}) {
  const kept = teamName
    ? `${teamName}’s roster, schedule and records are kept; nothing has been deleted.`
    : 'Every team’s roster, schedule and records are kept; nothing has been deleted.';
  const description = `${orgName}’s plan no longer includes the Coaches Portal. ${kept}`;
  const headline = `The Coaches Portal isn’t part of ${orgName}’s plan right now`;
  const icon = <Lock size={22} strokeWidth={1.75} aria-hidden />;

  if (viewerIsOwner) {
    return (
      <CoachEmptyState
        icon={icon}
        headline={headline}
        description={description}
        primaryAction={{ href: getBillingHref(orgSlug, planId), label: 'See plans' }}
      />
    );
  }

  return (
    <CoachEmptyState
      quiet
      icon={icon}
      headline={headline}
      description={description}
      blocker={ownerName
        ? `Ask your club’s owner, ${ownerName}, about the plan.`
        : 'Ask your club’s owner about the plan.'}
    />
  );
}
