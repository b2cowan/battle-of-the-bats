'use client';

/**
 * Admin-only control shown inside the standings table when a tied group needs a
 * coin toss ('coin' is the deciding breaker and no result is recorded). The
 * organizer taps the tied teams in finishing order; the result is POSTed to the
 * divisions API (action: record-coin-toss) and persisted to playoff_config, then
 * onRecorded() re-runs the standings.
 */

import { useState } from 'react';
import { Coins, Check, RotateCcw } from 'lucide-react';
import styles from './CoinTossRecorder.module.css';

interface Props {
  orgSlug: string;
  divisionId: string;
  groupKey: string;
  teams: { id: string; name: string }[];
  onRecorded: (orderedTeamIds: string[]) => void;
}

export default function CoinTossRecorder({ orgSlug, divisionId, groupKey, teams, onRecorded }: Props) {
  const [order, setOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = teams.filter(t => !order.includes(t.id));
  const complete = order.length === teams.length;
  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id;

  function pick(id: string) {
    setOrder(o => (o.includes(id) ? o : [...o, id]));
  }

  async function save() {
    if (!complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/divisions?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-coin-toss',
          id: divisionId,
          groupKey,
          orderedTeamIds: order,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || 'Failed to save coin toss');
      }
      onRecorded(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save coin toss');
      setSaving(false);
    }
  }

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <Coins size={15} aria-hidden />
        <span>Coin toss required — {teams.length} teams tied</span>
      </div>
      <p className={styles.help}>
        {teams.length === 2
          ? 'Tap the coin-toss winner first.'
          : 'Tap the tied teams in finishing order (1st, 2nd, …).'}
      </p>

      {order.length > 0 && (
        <ol className={styles.order}>
          {order.map((id, i) => (
            <li key={id}>
              <span className={styles.rank}>{i + 1}</span> {teamName(id)}
            </li>
          ))}
        </ol>
      )}

      {remaining.length > 0 && (
        <div className={styles.picks}>
          {remaining.map(t => (
            <button
              key={t.id}
              type="button"
              className={styles.pick}
              disabled={saving}
              onClick={() => pick(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        {order.length > 0 && (
          <button type="button" className="btn btn-ghost btn-data" onClick={() => setOrder([])} disabled={saving}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
        <button type="button" className="btn btn-lime btn-data" onClick={save} disabled={!complete || saving}>
          <Check size={13} /> {saving ? 'Saving…' : 'Save result'}
        </button>
      </div>
    </div>
  );
}
