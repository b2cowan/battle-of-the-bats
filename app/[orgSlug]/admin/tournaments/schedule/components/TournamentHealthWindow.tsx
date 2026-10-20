'use client';
/**
 * SCHEDULE HEALTH'S WINDOW FROM AWAY FROM THE SCHEDULE — the dashboard's (owner 2026-10-19, A5: "it is supposed to open
 * the same modal in the middle of the screen"). The board only carries a summary, so this reads the schedule as the
 * Schedule page does (its own loader) when it opens, scores it with the one event-health call and its rules, and shows
 * the very window the Schedule's header button opens — the rules included. A clash's "Show them" can't filter a page
 * that isn't here: it opens the Schedule with that filter on (`?show=`).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { Tournament } from '@/lib/types';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout } from '@/components/admin/kit/club/RepKit';
import LoadingState from '@/components/shared/LoadingState';
import { buildEventScheduleHealth } from '@/lib/schedule-metrics';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { SCHEDULE_DAY_WORDS as W } from '@/lib/schedule-words';
import { useScheduleData } from '../useScheduleData';
import { DEFAULT_HEALTH_RULES, useScheduleHealthRules } from '../useScheduleHealthRules';
import ScheduleHealthWindow from './ScheduleHealthWindow';
import type { IssueAction, ScheduleHealthRulesDraft } from './ScheduleHealthPanel';

export default function TournamentHealthWindow({ tournament, orgSlug, scheduleHref, locked, canEditRules, onClose, onRulesSaved }: {
  tournament: Tournament;
  orgSlug: string | undefined;
  /** The Schedule page, where "Show them" lands. */
  scheduleHref: string;
  /** A locked (completed) tournament: the rules are not offered, as on the Schedule. */
  locked: boolean;
  /** May save the tournament's settings (the route's `create_tournaments`): staff read the rules' effect, never an
   *  editor the server refuses (/review 2026-10-19). */
  canEditRules: boolean;
  onClose: () => void;
  /** The rules landed: the caller keeps its tournament fresh (the Schedule seeds from it) and re-reads its summary. */
  onRulesSaved?: (rules: ScheduleHealthRulesDraft) => void;
}) {
  const router = useRouter();
  const { games, gamesLoading, loadFailed, refresh, teams, divisions } = useScheduleData({ tournamentId: tournament.id, tournamentLoading: false, orgSlug });
  const [saveError, setSaveError] = useState<string | null>(null);
  const health = useScheduleHealthRules({
    tournament,
    orgSlug,
    onSaved: saved => { setSaveError(null); onRulesSaved?.(saved); },
    onSaveError: setSaveError,
  });
  const metrics = useMemo(
    () => buildEventScheduleHealth({ games, teams, divisions, tournament, rules: health.rules }),
    [games, teams, divisions, tournament, health.rules],
  );
  const close = () => { health.close(); onClose(); };

  if (gamesLoading) {
    return (
      <KitDialog kind="form" size="wide" eyebrow={tournament.name} title={GAME_DAY_WORDS.healthTitle} onClose={onClose}>
        <LoadingState inline label="Loading schedule health…" />
      </KitDialog>
    );
  }

  // A failed read is an error, never a calm "No timed schedule" beside the board's real score (/review 2026-10-19).
  if (loadFailed) {
    return (
      <KitDialog kind="form" size="wide" eyebrow={tournament.name} title={GAME_DAY_WORDS.healthTitle} onClose={onClose}>
        <Callout
          tone="bad"
          role="alert"
          icon={<AlertTriangle size={16} aria-hidden />}
          action={<button type="button" className="btn btn-outline btn-data" onClick={() => { void refresh(); }}>Try again</button>}
        >
          The schedule couldn&apos;t be loaded, so its health can&apos;t be scored right now.
        </Callout>
      </KitDialog>
    );
  }

  // Not while rules are unsaved: leaving for the Schedule would drop them unasked (the Schedule's own rule).
  const issueAction: IssueAction = ({ conflictKind }) =>
    conflictKind && !health.dirty
      ? { label: W.showThem, onClick: () => { close(); router.push(`${scheduleHref}?show=${encodeURIComponent(conflictKind)}`); } }
      : null;

  return (
    <ScheduleHealthWindow
      eyebrow={tournament.name}
      divisionCount={new Set(games.map(g => g.divisionId)).size}
      timedGames={metrics.timedGames}
      dirty={health.dirty}
      busy={health.saving}
      notice={saveError ? <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{saveError}</Callout> : null}
      onClose={close}
      metrics={metrics}
      showTeamTable
      // The demo's invitation is to drag a game on the Schedule; there is no schedule here to drag.
      isSandbox={false}
      showRulesEditor={!locked && canEditRules}
      editing={health.editing}
      rules={health.rules}
      rulesDirty={health.dirty}
      savingRules={health.saving}
      onRuleChange={patch => health.setRules(prev => ({ ...prev, ...patch }))}
      onSaveRules={() => { void health.save(); }}
      onResetRules={health.reset}
      onRestoreDefaultRules={() => health.setRules(DEFAULT_HEALTH_RULES)}
      rulesToggle={{ label: W.adjustRules, onToggle: () => health.setEditing(e => !e) }}
      issueAction={issueAction}
    />
  );
}
