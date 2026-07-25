/**
 * Discovery & Orientation (help Layer 3) — lifecycle guidance for the Premium
 * Coaches Portal team Overview rail. The coach analogue of `tournament-guidance`:
 * one stage-aware "what's next" card (headline + one context line + one in-app
 * action) plus an optional dismissible nudge.
 *
 * Reuses the admin <GuidanceRail> (presentational) by returning its `Guidance`
 * shape. Convention: the primary CTA + nudge action are in-app (same tab).
 */
import type { Guidance } from './tournament-guidance';

export type CoachGuidanceStage = 'roster' | 'schedule' | 'budget' | 'ready';

export interface CoachGuidanceContext {
  /** Team base path: `/{orgSlug}/coaches/teams/{teamId}`. */
  base: string;
  /** Coach help guide base: `/{orgSlug}/coaches/help`. */
  helpHref: string;
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
