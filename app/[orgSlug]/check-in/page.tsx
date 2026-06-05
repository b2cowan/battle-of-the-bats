'use client';

/**
 * Gate-volunteer check-in surface. Stripped-down shell (see layout) wrapping the
 * shared CheckInBoard. Lists the org's tournaments via /api/admin/check-in and
 * lets the volunteer pick one (defaults to the active one).
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CheckInBoard from '@/components/admin/CheckInBoard';
import styles from './check-in-volunteer.module.css';

type Tourney = { id: string; name: string; status: string; startDate: string | null; endDate: string | null };

export default function CheckInVolunteerPage() {
  const params = useParams();
  const orgSlug = typeof params.orgSlug === 'string' ? params.orgSlug : Array.isArray(params.orgSlug) ? params.orgSlug[0] : '';

  const [tournaments, setTournaments] = useState<Tourney[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/admin/check-in?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Could not load tournaments.');
        const data = await res.json();
        const list: Tourney[] = data.tournaments ?? [];
        if (!active) return;
        setTournaments(list);
        setSelectedId((list.find(t => t.status === 'active') ?? list[0] ?? null)?.id ?? null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load tournaments.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [orgSlug]);

  const selected = tournaments.find(t => t.id === selectedId) ?? null;

  return (
    <div>
      <div className={styles.head}>
        <h1 className={styles.title}>Check-in</h1>
        {tournaments.length > 1 ? (
          <select className={styles.picker} value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)} aria-label="Tournament">
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : tournaments.length === 1 && selected ? (
          <span className={styles.single}>{selected.name}</span>
        ) : null}
      </div>

      {loading && <div className={styles.msg}>Loading…</div>}
      {error && <div className={styles.err}>{error}</div>}
      {!loading && !error && tournaments.length === 0 && <div className={styles.msg}>No tournaments to check in for right now.</div>}
      {!loading && selected && (
        <CheckInBoard orgSlug={orgSlug} tournamentId={selected.id} locked={selected.status === 'completed'} />
      )}
    </div>
  );
}
