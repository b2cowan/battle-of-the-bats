'use client';

/**
 * RECORD THE TOSS — the organizer's coin-toss result for a tied group, in the kit's form window with a record head
 * (Tournament admin redesign Stage 3, S7 / A43, ruled 2026-10-09: "today's recorder, moved").
 *
 * Opened from where the seeds wait — the schedule's Bracket view, Results' "Needs you" and the dashboard's nudge —
 * instead of a box inside the public standings' preview. Its controls are today's: tap the team that won the toss (or,
 * three or more tied, the teams in finishing order), Start again, Save the result. The result is POSTed to the
 * divisions API (`record-coin-toss`), stored on the division's playoff config, and the bracket re-seeds as today
 * (J1-084). Two teams: the winner's tap orders both; three or more: the last team takes the last place.
 */

import { useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout } from '@/components/admin/kit/club/RepKit';
import repKit from '@/components/admin/kit/club/RepKit.module.css';
import { bracketGameLabel } from '@/lib/playoff-bracket';
import type { PendingToss } from '@/lib/coin-toss';
import { COIN_TOSS_WORDS as CT, readRefusal } from '@/lib/schedule-words';
import styles from './CoinTossRecorder.module.css';

/**
 * The note that says a toss is owed, with its one action — on the Bracket view, at the top of Results' "Needs you", and
 * as the dashboard's nudge: one note, so the three never word a tie differently. `named` puts the division first where
 * the screen shows more than one ("U13 · a coin toss decides seeds 1 and 2").
 */
export function CoinTossNote({ toss, named = false, flush = false, onRecord }: {
  toss: PendingToss;
  named?: boolean;
  /** No margin of its own, for a host that spaces its notes with `gap`. */
  flush?: boolean;
  onRecord: (toss: PendingToss) => void;
}) {
  const title = CT.title(toss.places, toss.pool);
  return (
    <Callout tone="warn" role="note" icon={<AlertCircle size={16} aria-hidden />} flush={flush}>
      <b>{named ? CT.inDivision(toss.divisionName, title) : title}</b>
      <span className={repKit.calloutSub}>{CT.body(toss.teams.map(x => x.name), toss.waits.map(w => bracketGameLabel(w.bracketCode)))}</span>
      <div className={repKit.calloutActions}>
        <button type="button" className="btn btn-outline" onClick={() => onRecord(toss)}>{CT.record}</button>
      </div>
    </Callout>
  );
}

export default function CoinTossRecorder({ orgSlug, toss, onClose, onRecorded }: {
  orgSlug: string;
  toss: PendingToss;
  onClose: () => void;
  /** Saved: the finishing order (team ids, best first). The caller re-reads what the toss reseeds. */
  onRecorded: (orderedTeamIds: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = order.length === toss.teams.length;

  function pick(id: string) {
    if (order.includes(id) || saving) return;
    const next = [...order, id];
    // The last team left takes the last place: two tied, the winner's one tap orders both.
    const left = toss.teams.filter(t => !next.includes(t.id));
    setOrder(left.length === 1 ? [...next, left[0].id] : next);
    setError(null);
  }

  async function save() {
    if (!complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/divisions?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record-coin-toss', id: toss.divisionId, groupKey: toss.groupKey, orderedTeamIds: order }),
      });
      if (!res.ok) throw new Error(await readRefusal(res, CT.failed));
      onRecorded(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : CT.failed);
      setSaving(false);
    }
  }

  // The teams in the order tapped, then the rest as the table shows them.
  const shown = [...order.map(id => toss.teams.find(t => t.id === id)!), ...toss.teams.filter(t => !order.includes(t.id))];

  return (
    <KitDialog
      kind="form"
      title={CT.sheetTitle(toss.divisionName)}
      identity={CT.sheetFor(toss.places, toss.pool)}
      onClose={onClose}
      busy={saving}
      footer={(
        <button type="button" className="btn btn-lime" onClick={() => { void save(); }} disabled={!complete || saving}>
          {saving ? CT.saving : CT.save}
        </button>
      )}
    >
      <p className={styles.lead}>{toss.teams.length === 2 ? CT.tapWinner : CT.tapOrder}</p>
      <ul className={styles.teams}>
        {shown.map(t => {
          const at = order.indexOf(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className={styles.team}
                data-on={at >= 0 || undefined}
                aria-pressed={at >= 0}
                disabled={saving}
                onClick={() => pick(t.id)}
              >
                <span className={styles.rank} aria-hidden>{at >= 0 ? at + 1 : ''}</span>
                <span>{t.name}</span>
                {at >= 0 && <span className={styles.place}>{CT.placeOf(toss.places[at], toss.pool)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {order.length > 0 && (
        <button type="button" className={`btn btn-outline ${styles.again}`} onClick={() => { setOrder([]); setError(null); }} disabled={saving}>
          <RotateCcw size={14} aria-hidden /> {CT.startAgain}
        </button>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </KitDialog>
  );
}
