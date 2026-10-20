'use client';
/**
 * Schedule health's rules — the organizer's "healthy schedule" thresholds — as the Schedule page and the dashboard both
 * edit them in the one health window (owner 2026-10-19, A5: one window from either place). `rules` is the live draft
 * the score previews; `saved` is the last-persisted baseline (dirty detection, Discard). Moved out of the Schedule page
 * as it was, so the dashboard's window saves the same way rather than through a second copy.
 */
import { useEffect, useState } from 'react';
import type { Tournament } from '@/lib/types';
import { getScheduleHealthRules } from '@/lib/schedule-metrics';
import { writeFailure } from '@/lib/coach-sandbox-refusal';
import type { ScheduleHealthRulesDraft } from './components/ScheduleHealthPanel';

export const DEFAULT_HEALTH_RULES: ScheduleHealthRulesDraft = { maxGamesPerDay: 2, minRestMinutes: 15, targetGamesPerTeam: null };

export function useScheduleHealthRules({ tournament, orgSlug, onSaved, onSaveError }: {
  tournament: Tournament | null | undefined;
  orgSlug: string | undefined;
  /** The rules landed: the caller keeps its own copy of the tournament fresh. */
  onSaved?: (rules: ScheduleHealthRulesDraft) => void;
  /** The server's refusal, in its words (or a plain fallback). */
  onSaveError: (message: string) => void;
}) {
  const [rules, setRules] = useState<ScheduleHealthRulesDraft>(() => getScheduleHealthRules(tournament));
  const [saved, setSaved] = useState<ScheduleHealthRulesDraft>(rules);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Re-seed from the tournament's saved settings when the tournament changes.
  useEffect(() => {
    const resolved = getScheduleHealthRules(tournament);
    setRules(resolved);
    setSaved(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);

  const dirty =
    rules.maxGamesPerDay !== saved.maxGamesPerDay ||
    rules.minRestMinutes !== saved.minRestMinutes ||
    rules.targetGamesPerTeam !== saved.targetGamesPerTeam;

  async function save() {
    if (!tournament?.id) return;
    setSaving(true);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'patch-settings', id: tournament.id, data: { settings: { schedule_health_rules: rules } } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // The demo's refusal in its own sentence, never its code name (/review 2026-10-19).
        onSaveError(writeFailure(res, data, 'The schedule health rules could not be saved. Please try again.'));
        return;
      }
      setSaved(rules);
      onSaved?.(rules);
    } finally {
      setSaving(false);
    }
  }

  return {
    rules, setRules, saved, saving, dirty, editing, setEditing, save,
    /** Discard: back to the saved rules. */
    reset: () => setRules(saved),
    restoreDefaults: () => setRules(DEFAULT_HEALTH_RULES),
    /** The window closed: an unsaved draft is dropped (the window asked first) and the editor folds. */
    close: () => { setRules(saved); setEditing(false); },
  };
}
