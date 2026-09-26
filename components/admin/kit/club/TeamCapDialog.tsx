'use client';
/**
 * The team-cap refusal, OFFERING THE MOVE IN PLACE (Club Tier Stage 1b, specimen 7, third frame).
 * Rep Teams › Add team at the plan's limit used to say "Upgrade to Club · Association" with nowhere to
 * go (A05). Now it names both ways out: move up a band (the SAME move window as the plan page —
 * `PlanMoveDialog`), or archive a team the club no longer runs. The move is the owner's (billing);
 * anyone else is told who can make it. Above the largest band, the way out is to contact us.
 *
 * Reads the structured refusal session 1's team cap answers with (`lib/team-cap.ts`):
 *   { code: 'team_limit_reached', teamLimit, activeTeams, moveUp: { planKey, label, teamLimit } | null, contactUs }
 */
import { useState } from 'react';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { ordinal } from '@/lib/playoff-bracket';
import type { OrgPlan } from '@/lib/types';
import KitDialog from './KitDialog';
import PlanMoveDialog, { CONTACT_HREF } from './PlanMoveDialog';

export type TeamCapRefusal = {
  teamLimit: number;
  activeTeams: number;
  moveUp: { planKey: OrgPlan; label: string; teamLimit: number } | null;
  contactUs: boolean;
};

export default function TeamCapDialog({
  refusal,
  org,
  isOwner,
  onClose,
  onArchive,
  onMoved,
}: {
  refusal: TeamCapRefusal;
  org: { slug: string; name: string; planId: OrgPlan; subscriptionPeriod?: 'monthly' | 'annual' };
  isOwner: boolean;
  onClose: () => void;
  /** "Archive a team": the way out that happens on the team list, so the caller closes its form too. */
  onArchive?: () => void;
  onMoved: (notice: string) => void;
}) {
  const [moving, setMoving] = useState(false);
  const plan = PLAN_CONFIG[org.planId];
  const next = ordinal(refusal.teamLimit + 1);

  if (moving && refusal.moveUp) {
    return (
      <PlanMoveDialog
        org={org}
        toPlan={refusal.moveUp.planKey}
        onClose={onClose}
        onMoved={onMoved}
      />
    );
  }

  return (
    <KitDialog
      kind="question"
      title={`${org.name} holds ${refusal.teamLimit} teams on ${plan.label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onArchive ?? onClose}>Archive a team</button>
          {refusal.moveUp && isOwner && (
            <button type="button" className="btn btn-lime" onClick={() => setMoving(true)} data-autofocus="">
              Move to {refusal.moveUp.label}
            </button>
          )}
          {!refusal.moveUp && <a href={CONTACT_HREF} className="btn btn-lime">Contact us</a>}
        </>
      }
    >
      {refusal.moveUp ? (
        <p>
          To add a {next} team, move to {refusal.moveUp.label} (up to {refusal.moveUp.teamLimit}), or archive a team you
          no longer run.
          {!isOwner && ` Moving is ${org.name}’s owner’s to do — ask them.`}
        </p>
      ) : (
        <p>
          To add a {next} team, archive a team you no longer run, or contact us and we’ll raise your limit for a
          larger association.
        </p>
      )}
    </KitDialog>
  );
}
