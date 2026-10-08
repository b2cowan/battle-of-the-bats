'use client';

/**
 * Gate-volunteer check-in surface. Stripped-down shell (see layout) wrapping the
 * shared CheckInBoard. Lists the org's tournaments via /api/admin/check-in and
 * lets the volunteer pick one (defaults to the active one).
 *
 * Stage 6 V3 (ruled 2026-10-07): the board is Stage 1's, unchanged; what this page adds around it is
 * the head — "Check-in" with the event UNDER it (beside it, a long name wrapped the title), a 44px
 * dropdown naming each event's status in the product's words when there are two or more (J8-015) — and
 * a finished or draft event's line as a white callout with an amber edge (tinted panels are retired).
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Info } from 'lucide-react';
import CheckInBoard from '@/components/admin/CheckInBoard';
import { Callout } from '@/components/admin/kit/club/RepKit';
import { STATUS_WORD } from '@/lib/tournament-status-words';
import { GATE_WORDS } from '@/lib/volunteer-words';
import styles from './check-in-volunteer.module.css';

type Tourney = { id: string; name: string; status: string; startDate: string | null; endDate: string | null };

/** "Spring Classic 2026 · Completed" — the status in the product's one word for it. */
function optionLabel(t: Tourney): string {
  const word = STATUS_WORD[t.status as keyof typeof STATUS_WORD];
  return word ? `${t.name} · ${word}` : t.name;
}

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

  // J8-014: a completed (read-only) or not-yet-active (draft) event says so, in a volunteer's words —
  // what it means and what to do — instead of a silently-dimmed board.
  const banner = selected
    ? selected.status === 'completed' ? GATE_WORDS.finished
      : selected.status === 'draft' ? GATE_WORDS.draft
        : null
    : null;

  return (
    <div>
      <div className={styles.head}>
        <h1 className={styles.title}>{GATE_WORDS.title}</h1>
        {/* One event: its name, as drawn — a finished or draft one says so in the callout below. */}
        {tournaments.length === 1 && selected && <p className={styles.event}>{selected.name}</p>}
      </div>
      {tournaments.length > 1 && (
        <select className={styles.picker} value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)} aria-label="Tournament">
          {tournaments.map(t => <option key={t.id} value={t.id}>{optionLabel(t)}</option>)}
        </select>
      )}

      {loading && <div className={styles.msg}>Loading…</div>}
      {error && <Callout tone="bad" role="alert">{error}</Callout>}
      {!loading && !error && tournaments.length === 0 && <div className={styles.msg}>{GATE_WORDS.noEvents}</div>}
      {!loading && selected && banner && (
        <Callout tone="warn" icon={<Info size={16} aria-hidden />} role="status">{banner}</Callout>
      )}
      {!loading && selected && (
        // `pinnedFilters`: this is the volunteer shell, which carries the day-of bottom bars. The
        // admin gate screen must NOT pass it — it already has its own bottom nav.
        <CheckInBoard
          orgSlug={orgSlug}
          tournamentId={selected.id}
          locked={selected.status !== 'active'}
          pinnedFilters
        />
      )}
    </div>
  );
}
