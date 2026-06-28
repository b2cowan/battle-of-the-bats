/**
 * Discovery & Orientation (help Layer 3) — lifecycle guidance for the Premium
 * Coaches Portal team Overview rail. The coach analogue of `tournament-guidance`:
 * one stage-aware "what's next" card (headline + one context line + one in-app
 * action), an optional dismissible nudge, and a set of "how do I…" shortcuts that
 * deep-link into the coach help guide.
 *
 * Reuses the admin <GuidanceRail> (presentational) by returning its `Guidance` /
 * `TaskShortcut` shapes. Convention: the primary CTA + nudge action are in-app
 * (same tab); the shortcuts are help-guide anchors (the rail opens non-locked
 * shortcuts in a new tab, which is correct for a guide link and surfaces the
 * otherwise-buried guide).
 */
import type { Guidance, TaskShortcut } from './tournament-guidance';

export type CoachGuidanceStage = 'roster' | 'schedule' | 'budget' | 'ready';

export interface CoachGuidanceContext {
  /** Team base path: `/{orgSlug}/coaches/teams/{teamId}`. */
  base: string;
  /** Coach help guide base: `/{orgSlug}/coaches/help`. */
  helpHref: string;
}

/** Pick the stage from setup progress — earliest unmet step wins, so the rail
 *  always points at the one next thing rather than a wall of tasks. */
export function getCoachGuidanceStage(opts: {
  activeRosterCount: number;
  eventCount: number;
  budgetSet: boolean;
}): CoachGuidanceStage {
  if (opts.activeRosterCount === 0) return 'roster';
  if (opts.eventCount === 0) return 'schedule';
  if (!opts.budgetSet) return 'budget';
  return 'ready';
}

export function getCoachGuidance(stage: CoachGuidanceStage, ctx: CoachGuidanceContext): Guidance {
  switch (stage) {
    case 'roster':
      return {
        headline: 'Start by building your roster',
        context:
          'Add your players first — your schedule, dues, lineups, and announcements all build on the roster. Jersey numbers and parent contacts can come now or later.',
        cta: { label: 'Add players', href: `${ctx.base}/roster` },
        nudge: {
          id: 'coach-rail-roster',
          body: 'Players from your free team home are already here. Open the Roster to fill in any missing parent emails so dues reminders and announcements can reach them.',
          action: { label: 'Open roster', href: `${ctx.base}/roster` },
        },
      };
    case 'schedule':
      return {
        headline: 'Add your first practice or game',
        context:
          'Build your season calendar — practices, games, and events in one place. Once games are scheduled you can set lineups and take attendance from each one.',
        cta: { label: 'Add an event', href: `${ctx.base}/schedule` },
        nudge: {
          id: 'coach-rail-schedule',
          body: 'On Premium you can set a repeating weekly practice once and sync the whole calendar to your phone.',
          action: { label: 'Open schedule', href: `${ctx.base}/schedule` },
        },
      };
    case 'budget':
      return {
        headline: 'Set up team dues and a budget',
        context:
          'Add dues and a season budget to track who has paid and send automatic overdue reminders — it replaces the spreadsheet. Optional, but most teams set it up here.',
        cta: { label: 'Set up accounting', href: `${ctx.base}/accounting` },
        nudge: null,
      };
    case 'ready':
      return {
        headline: "You're all set — run your season",
        context:
          'Your team is set up. From here: set lineups and take attendance on game day, keep dues moving, and keep parents in the loop.',
        cta: { label: 'View your schedule', href: `${ctx.base}/schedule` },
        nudge: {
          id: 'coach-rail-ready',
          body: 'Send a season-kickoff note to every parent at once from Announcements.',
          action: { label: 'Open announcements', href: `${ctx.base}/announcements` },
        },
      };
  }
}

/** "How do I…" shortcuts → coach help guide anchors (open in a new tab via the
 *  rail, which is correct for guide links and surfaces the guide). */
export function getCoachShortcuts(ctx: CoachGuidanceContext): TaskShortcut[] {
  return [
    { label: 'How to build your roster', href: `${ctx.helpHref}#recipe-add-player` },
    { label: 'How to build your schedule', href: `${ctx.helpHref}#recipe-build-coach-schedule` },
    { label: 'How to track team dues', href: `${ctx.helpHref}#recipe-track-dues` },
    { label: 'How to message your team', href: `${ctx.helpHref}#recipe-announcements` },
    { label: 'How to start your next season', href: `${ctx.helpHref}#recipe-start-next-season` },
  ];
}
