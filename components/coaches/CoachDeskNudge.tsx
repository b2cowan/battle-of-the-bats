'use client';
/**
 * ⚖ THE SCOUTING REMINDER, UNDER THE PAGE'S TOP ROW ON A COMPUTER (navigation Phase 4, C3, owner 2026-11-11; tab 17). Today
 * the team bar's second row; the bar is the phone's only now (≤900), so above 900 the reminder becomes a slim notice right
 * under the page's top row, on every team page — the same words, the same ×, the same dismissal (`useCoachNudgeDismiss`,
 * one key per game, so dismissing it on either width dismisses it on both). It scrolls with the page; the page's buttons
 * and "?" never move for it. Drawn by `CoachPageHeader` after its row; its facts ride down from the team layout's one feed
 * (`CoachDeskNudgeProvider`, no DOM), so the server's first paint has it.
 *
 * Gated as the bar's row is: only for the very game the status names, only while the status speaks for this season.
 */
import { createContext, useContext, type ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, X } from 'lucide-react';
import { useCoachNudgeDismiss } from './useCoachNudgeDismiss';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { formatInOrgZone } from '@/lib/timezone';
import type { MastheadScoutingNudge } from '@/lib/coach-masthead-status';
import type { CoachTeamFacts } from '@/lib/coach-team-masthead';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

type Nudge = { teamId: string } & Pick<CoachTeamFacts, 'status' | 'statusYearId' | 'scoutingNudge'>;
const Ctx = createContext<Nudge | null>(null);

export function CoachDeskNudgeProvider({ value, children }: { value: Nudge; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** "today" / "tomorrow" / "Saturday" — the reminder is a sentence (the bar's own words). */
function nudgeDay(startsAt: string, daysAway: number): string {
  if (daysAway === 0) return 'today';
  if (daysAway === 1) return 'tomorrow';
  return formatInOrgZone(startsAt, { weekday: 'long' });
}

/** Off a team's pages (no team layout above) there is no reminder, and nothing here runs. */
export default function CoachDeskNudge() {
  const ctx = useContext(Ctx);
  return ctx?.scoutingNudge && ctx.status ? <DeskNudge ctx={ctx} nudge={ctx.scoutingNudge} /> : null;
}

function DeskNudge({ ctx, nudge }: { ctx: Nudge; nudge: MastheadScoutingNudge }) {
  const dismiss = useCoachNudgeDismiss(ctx.teamId, `scouting_book:${nudge.eventId}`);
  const { assignments, closedAssignments } = useCoaches();
  // The bar's rule: speak only for the season the status was computed for.
  const season = resolveLiveSeason(assignments, ctx.teamId) ?? resolveClosedSeason(assignments, closedAssignments, ctx.teamId);
  const status = season?.programYearId === ctx.statusYearId ? ctx.status : null;
  if (!status || nudge.eventId !== status.event.id || dismiss.dismissed) return null;
  const n = nudge.observationCount;
  // On game day the strip already names the opponent and "today": the reminder leads with the one new fact (the bar's rule).
  const lead = status.kind === 'game_day' ? null : <>You play <b>{nudge.opponentName}</b> {nudgeDay(status.event.startsAt, status.daysAway)} — </>;
  return (
    <div className={styles.deskNudge}>
      <BookOpen size={15} aria-hidden className={styles.deskNudgeIcon} />
      <Link href={nudge.href} className={styles.deskNudgeLink}>
        {lead}<b>{n}</b> observation{n === 1 ? '' : 's'} in the book ›
      </Link>
      <button type="button" className={styles.deskNudgeDismiss} aria-label="Dismiss book reminder" title="Dismiss" onClick={dismiss.dismiss}>
        <X size={15} />
      </button>
    </div>
  );
}
