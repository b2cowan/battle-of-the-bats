/**
 * Discovery & Orientation (help Layer 3) — lifecycle guidance content for the
 * tournament dashboard rail.
 *
 * One source of truth for: the stage-aware "what's next" card (headline + one
 * context line + one primary action), the dismissible "Did you know?" nudge, and
 * the outcome-worded "I want to…" shortcuts. The dashboard's <GuidanceRail>
 * renders whatever these helpers return — the rail itself is presentational.
 *
 * Anti-overwhelm rules baked in here: exactly one action + at most one nudge per
 * stage, copy that retires as the tournament advances, and nudges that point at
 * the moment they matter. Plan/seat nuances are honest (e.g. the volunteer nudge
 * never implies a cold walk-up handoff is instant — setup is a pre-event task).
 */
import { hasPlanFeature } from './plan-features';
import { getBillingHref } from './billing-urls';
import type { OrgPlan } from './types';

export type GuidanceStage = 'draft' | 'pre' | 'live' | 'post' | 'done';

export interface GuidanceContext {
  orgSlug: string;
  tournamentSlug?: string | null;
  planId: OrgPlan;
  daysUntil: number | null;
  checklist: { hasDates: boolean; hasDivisions: boolean; ready: boolean };
}

export interface GuidanceAction {
  label: string;
  href: string;
  /** Opens in a new tab (guide links + the public site, so admins keep their place). */
  external?: boolean;
}

export interface GuidanceNudge {
  /** Stable slug for the per-tournament dismissal key. */
  id: string;
  body: string;
  action?: GuidanceAction;
}

export interface Guidance {
  headline: string;
  context: string;
  /** e.g. "1 of 2 required items done" — shown only when meaningful (draft). */
  progress?: string;
  cta?: GuidanceAction;
  nudge?: GuidanceNudge | null;
}

export interface TaskShortcut {
  label: string;
  href: string;
  /** Plus-gated for this org — render a "Plus" marker; href points at billing. */
  locked?: boolean;
}

/** Derive the rail stage from status + game-day + countdown (used by work-page surfaces that lack the dashboard's precise flags). */
export function resolveGuidanceStage(opts: {
  status?: string | null;
  isGameDay?: boolean;
  daysUntil: number | null;
}): GuidanceStage | null {
  const { status, isGameDay, daysUntil } = opts;
  if (status === 'draft') return 'draft';
  if (status === 'completed') return 'done';
  if (status === 'archived') return null;
  // active
  if (isGameDay) return 'live';
  if (daysUntil !== null && daysUntil <= 0) return 'post';
  return 'pre';
}

function base(orgSlug: string) {
  return `/${orgSlug}/admin/tournaments`;
}
function guideHref(orgSlug: string, sectionId: string) {
  return `/${orgSlug}/admin/help/tournaments#${sectionId}`;
}

/** The stage-appropriate "what's next" card content (headline + one action + one nudge). */
export function getGuidance(stage: GuidanceStage, ctx: GuidanceContext): Guidance {
  const b = base(ctx.orgSlug);
  const previewHref = ctx.tournamentSlug ? `${b}/preview/${ctx.tournamentSlug}` : undefined;
  const publicHref = ctx.tournamentSlug ? `/${ctx.orgSlug}/${ctx.tournamentSlug}` : undefined;
  const hasSummary = hasPlanFeature(ctx.planId, 'post_tournament_summary');
  const canClone = hasPlanFeature(ctx.planId, 'tournament_cloning');
  const hasFanAlerts = hasPlanFeature(ctx.planId, 'fan_score_alerts');
  const billingHref = getBillingHref(ctx.orgSlug, ctx.planId);

  switch (stage) {
    case 'draft': {
      const done = (ctx.checklist.hasDates ? 1 : 0) + (ctx.checklist.hasDivisions ? 1 : 0);
      if (!ctx.checklist.ready) {
        const cta = !ctx.checklist.hasDivisions
          ? { label: 'Set up divisions', href: `${b}/divisions` }
          : { label: 'Set your dates', href: `${b}/settings/event?section=overview` };
        return {
          headline: 'You’re setting up your tournament',
          context:
            'Two things are required before you can go live — your dates and at least one division. Then you can preview and activate.',
          progress: `${done} of 2 required items done`,
          cta,
          nudge: {
            id: 'preview',
            body:
              'You can preview your public page any time before you go live — see exactly what teams will see, with zero risk of anything going public.',
            action: previewHref ? { label: 'Preview site', href: previewHref } : undefined,
          },
        };
      }
      return {
        headline: 'You’re ready to launch',
        context:
          'Preview exactly what teams will see, then activate when you’re set. Nothing is public until you activate.',
        cta: previewHref ? { label: 'Preview what teams will see', href: previewHref } : undefined,
        nudge: {
          id: 'activate-emails',
          body:
            'Activating doesn’t send any emails automatically — you choose when to contact teams from Communications.',
          action: { label: 'Open Communications', href: `${b}/communication` },
        },
      };
    }

    case 'pre': {
      const headline =
        ctx.daysUntil !== null && ctx.daysUntil > 0
          ? `Your event is ${ctx.daysUntil} day${ctx.daysUntil === 1 ? '' : 's'} away`
          : 'Your event is coming up';
      return {
        headline,
        context:
          'Teams are registered and your schedule is taking shape. Make sure your teams know what to expect and game-day operations are covered.',
        cta: { label: 'Message your teams', href: `${b}/communication` },
        nudge: {
          id: 'staff-kit',
          body:
            'Set your scorekeepers up before game day — invite them once and they get a phone-friendly scoring screen that shows only the games, nothing else in your admin.',
          action: { label: 'Open Staff Kit', href: `${b}/staff-kit` },
        },
      };
    }

    case 'live': {
      return {
        headline: 'It’s game day — here’s your live view',
        context:
          'Scores update everywhere the moment you enter them. Your one game-day job is clearing any games waiting in your review queue.',
        cta: { label: 'Enter & review scores', href: `${b}/results` },
        nudge: {
          id: 'live-fan',
          body: hasFanAlerts
            ? 'Parents and coaches see scores update live on your public site as you enter them — and fans with your app get a push alert the moment their team’s game is final.'
            : 'Parents and coaches see every score update live on your public site the moment you enter it.',
          action: publicHref ? { label: 'View your public site', href: publicHref, external: true } : undefined,
        },
      };
    }

    case 'post': {
      return {
        headline: 'Your event has wrapped up',
        context:
          'All the games are done. Confirm your final scores, then mark the tournament complete to lock in your results.',
        cta: { label: 'Review & finalize scores', href: `${b}/results` },
        nudge: hasSummary
          ? {
              id: 'complete-unlocks',
              body:
                'Marking your tournament complete unlocks your event summary and lets you reuse this whole setup next year.',
              action: { label: 'See what’s next', href: `${b}/summary` },
            }
          : {
              id: 'results-live',
              body:
                'Your public results and standings stay live at the same link forever — share it with teams and families.',
              action: publicHref ? { label: 'View public results', href: publicHref, external: true } : undefined,
            },
      };
    }

    case 'done': {
      return {
        headline: 'Tournament complete — nice work',
        context: hasSummary
          ? 'Your results are public and permanent. Review your event summary and get a head start on next year.'
          : 'Your results are public and permanent at the same link. Here’s how to wrap up.',
        cta: hasSummary
          ? { label: 'View your event summary', href: `${b}/summary` }
          : { label: 'View final results', href: `${b}/results` },
        nudge: canClone
          ? {
              id: 'reuse-setup',
              body:
                'Reuse this entire setup — divisions, venues, rules — to start next year in one step.',
              action: { label: 'Reuse this setup', href: `${b}/summary` },
            }
          : {
              id: 'upgrade-reuse',
              body:
                'Upgrade to Tournament Plus to reuse this whole setup next year in one step and unlock a post-event summary.',
              action: { label: 'See Tournament Plus', href: billingHref },
            },
      };
    }
  }
}

/** The lifecycle-filtered "I want to…" outcome shortcuts (4–5 per stage). */
export function getStageShortcuts(stage: GuidanceStage, ctx: GuidanceContext): TaskShortcut[] {
  const billingHref = getBillingHref(ctx.orgSlug, ctx.planId);
  const canImport = hasPlanFeature(ctx.planId, 'bulk_data_imports');
  const canClone = hasPlanFeature(ctx.planId, 'tournament_cloning');

  // Raw outcome → guide section; `plus` flags the genuinely gated ones.
  const RAW: Record<GuidanceStage, Array<{ label: string; sectionId: string; plus?: 'import' | 'clone' }>> = {
    draft: [
      { label: 'Preview what teams will see', sectionId: 'public-site-preview' },
      { label: 'Set up divisions and pool play', sectionId: 'divisions-and-pools' },
      { label: 'Import a team list from a spreadsheet', sectionId: 'data-tools-imports', plus: 'import' },
      { label: 'Understand what activating does', sectionId: 'settings-and-access' },
    ],
    pre: [
      { label: 'Get my schedule onto the public site', sectionId: 'recipe-build-tournament-schedule' },
      { label: 'Set up a playoff bracket', sectionId: 'schedule-playoffs' },
      { label: 'Hand scorekeeping to a volunteer', sectionId: 'scores-and-results' },
      { label: 'Send an announcement to all teams', sectionId: 'public-communication' },
    ],
    live: [
      { label: 'Enter or fix a score', sectionId: 'scores-and-results' },
      { label: 'View the playoff bracket', sectionId: 'schedule-playoffs' },
      { label: 'Check who’s checked in', sectionId: 'scores-and-results' },
      { label: 'Send an update to teams', sectionId: 'public-communication' },
    ],
    post: [
      { label: 'Confirm all scores are final', sectionId: 'scores-and-results' },
      { label: 'Mark the tournament complete', sectionId: 'recipe-closeout-tournament' },
      { label: 'Export results & schedule', sectionId: 'exports' },
      { label: 'Share the public results link', sectionId: 'public-site-preview' },
    ],
    done: [
      { label: 'View final results', sectionId: 'scores-and-results' },
      { label: 'Reuse this setup for next year', sectionId: 'repeat-event-setup', plus: 'clone' },
      { label: 'Export results & schedule', sectionId: 'exports' },
      { label: 'Archive this tournament', sectionId: 'recipe-closeout-tournament' },
    ],
  };

  return RAW[stage].map(item => {
    const locked =
      (item.plus === 'import' && !canImport) || (item.plus === 'clone' && !canClone);
    return {
      label: item.label,
      href: locked ? billingHref : guideHref(ctx.orgSlug, item.sectionId),
      locked,
    };
  });
}
