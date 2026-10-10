'use client';
/**
 * PUBLISH THE SCHEDULE — one window that says what publishing does (Tournament admin redesign Stage 3, S8 / A46,
 * ruled 2026-10-09; the words are /marketing's, 2026-10-09).
 *
 * Publishing is per division and does three things the old window only half said:
 *   - the public site and the app show the division's games with the teams' names;
 *   - its registration CLOSES — the route writes `schedule_visibility` and `is_closed` together
 *     (`/api/admin/schedule-publish`), so the row says it ("Registration is open — publishing closes it") instead
 *     of a second "Close registration and publish?" screen;
 *   - each linked coach team gets the games on its own schedule ("From {event} · organizer's schedule").
 * After it, a moved game alerts its teams' followers (Tournament Plus) and the coach schedules follow (every plan).
 *
 * The email is Tournament Plus (`schedule_notification`); the game-day reminder sentence shows only when the publish
 * will really schedule it (`willScheduleGameDayReminder` — the route's own checks, F73). Whether every publish
 * SHOULD schedule it is A46's packaging question for /strategy: not changed here.
 *
 * Every unpublished division starts ticked; the lime counts what it publishes. Done, the window closes and the
 * page's notice says what happened.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Division, Game, OrgPlan, Team, Tournament } from '@/lib/types';
import { willScheduleGameDayReminder } from '@/lib/schedule-publish-rules';
import { GAME_DAY_REMINDER_SENTENCE, PUBLISH_WORDS as PW, SCHEDULE_DAY_WORDS as W, readRefusal } from '@/lib/schedule-words';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout } from '@/components/admin/kit/club/RepKit';
import { CheckChoice, RecordSection } from '@/components/admin/tournament/ScreenParts';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import ps from './PublishSchedule.module.css';

export default function PublishScheduleModal({
  divisions,
  games,
  teams,
  tournament,
  canNotify,
  canAlertFollowers,
  planId,
  orgSlug,
  onClose,
  onPublished,
}: {
  divisions: Division[];
  games: Game[];
  /** The accepted teams (the email goes to each one's contact). */
  teams: Team[];
  tournament: Tournament;
  /** The "schedule is live" email (Tournament Plus). */
  canNotify: boolean;
  /** A later move alerts followers (Tournament Plus) — the third "Who sees them" sentence. */
  canAlertFollowers: boolean;
  /** Read by the reminder sentence's rule — the same checks the publish route makes (F73). */
  planId: OrgPlan | null;
  orgSlug: string;
  onClose: () => void;
  /** Published: the divisions, and how many teams were emailed. */
  onPublished: (divisionIds: string[], emailed: number) => void;
}) {
  const publishable = divisions.filter(g => !g.scheduleVisibility || g.scheduleVisibility === 'unpublished');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => publishable.map(d => d.id));
  const [notify, setNotify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = publishable.filter(g => selectedIds.includes(g.id));
  const acceptedTeams = teams.filter(t => t.status === 'accepted' && selectedIds.includes(t.divisionId)).length;
  // F73: the reminder sentence shows only when this publish will really schedule the reminder.
  const willRemind = willScheduleGameDayReminder({ notify, planId, settings: tournament.settings });

  function toggleDivision(id: string, on: boolean) {
    setSelectedIds(prev => (on ? [...prev, id] : prev.filter(x => x !== id)));
    setError(null);
  }

  async function doPublish() {
    if (targets.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const divisionIds = targets.map(g => g.id);
      // One request: the route publishes and closes registration together (mig 129), so a refusal changes nothing.
      const res = await fetch(`/api/admin/schedule-publish${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, divisionIds, visibility: 'published', notify: notify && canNotify }),
      });
      if (!res.ok) throw new Error(await readRefusal(res, PW.failed));
      const data = await res.json().catch(() => ({})) as { notified?: number };
      onPublished(divisionIds, data.notified ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : PW.failed);
      setLoading(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={PW.title}
      identity={PW.caption(tournament.name, publishable.length)}
      onClose={onClose}
      busy={loading}
      footer={(
        <button type="button" className="btn btn-lime" onClick={() => { void doPublish(); }} disabled={loading || targets.length === 0}>
          {loading ? PW.publishing : targets.length === 0 ? PW.goNone : PW.go(targets.map(t => t.name))}
        </button>
      )}
    >
      <RecordSection title={PW.divisions}>
        {publishable.map(d => (
          <CheckChoice
            key={d.id}
            checked={selectedIds.includes(d.id)}
            onChange={on => toggleDivision(d.id, on)}
            disabled={loading}
            title={d.name}
            caption={`${PW.games(games.filter(g => g.divisionId === d.id).length)} · ${d.isClosed ? PW.registrationClosed : PW.registrationOpen}`}
          />
        ))}
      </RecordSection>

      <RecordSection title={PW.whoSees}>
        <p className={ps.say}>{PW.seesPublic}</p>
        <p className={ps.say}>{PW.seesCoaches(tournament.name)}</p>
        <p className={ps.say}>{PW.seesMoves(canAlertFollowers)}</p>
      </RecordSection>

      <RecordSection title={PW.email}>
        {canNotify ? (
          <CheckChoice
            checked={notify}
            onChange={setNotify}
            disabled={loading || targets.length === 0}
            title={PW.emailBox(acceptedTeams)}
            caption={(targets.length > 0 && willRemind && (GAME_DAY_REMINDER_SENTENCE)) || undefined}
          />
        ) : (
          <PlanLockLine href={tournamentPlusPanelHref(orgSlug)} plan={W.lockedPlan}>{PW.emailLocked}</PlanLockLine>
        )}
      </RecordSection>

      {error && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />} flush>{error}</Callout>}
    </KitDialog>
  );
}
