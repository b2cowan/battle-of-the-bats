'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Telescope } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { recordChip, recordTone, resultLetter, hasMeetings, hasBookContent, type OpponentBookEntry } from '@/lib/coach-opponents';
import { formatInOrgZone } from '@/lib/timezone';
import HelpButton from '@/components/help/HelpButton';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import styles from '../../../../coaches.module.css';

// "Who are we up against?" — the Opponent Scouting Book's list: every team we've faced,
// across every season, grouped by normalized name (plus coach-managed aliases, P2).
// INSTRUMENT: this page serves the live season and has no archive variant, by decision
// (owner 2026-08-04) — the per-season game facts stay in Results.
export default function CoachesOpponentsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);

  const [entries, setEntries] = useState<OpponentBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/opponents`)
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load opponents');
        return res.json();
      })
      .then(data => { if (!cancelled) { setEntries(data.opponents ?? []); setError(''); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load opponents'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) return <div className={styles.notAssigned}>You are not assigned to this team.</div>;

  const q = query.trim().toLowerCase();
  const shown = entries
    .filter(e => hasMeetings(e) || hasBookContent(e))
    .filter(e => !q || e.displayName.toLowerCase().includes(q));

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Telescope size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Who are we up against?</h1>
            <p className={styles.pageSub}>{assignment.teamName} — your book on every opponent, every season</p>
          </div>
        </div>
        <HelpButton
          iconOnly
          label="Opponents"
          help={{ module: 'coaches', sectionIds: ['premium-scouting'], fullGuideHref: `/${orgSlug}/coaches/help#premium-scouting` }}
        />
      </div>

      {loading ? (
        <div className={styles.loadingState}>Loading…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : shown.length === 0 && !q ? (
        <CoachEmptyState
          headline="No opponents on file yet"
          description="Play a game with the opponent named on the schedule and they'll appear here — record, meetings, and a page for everything you learn about them."
        />
      ) : (
        <>
          <input
            className={styles.scoutSearch}
            type="search"
            placeholder="Search opponents…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search opponents"
          />
          <div className={styles.scoutList}>
            {shown.map(e => (
              <Link key={e.key} href={`${base}/history/opponents/${encodeURIComponent(e.key)}`} className={styles.scoutRow}>
                <span
                  className={styles.scoutNoteDot}
                  data-has={hasBookContent(e) ? 'yes' : 'no'}
                  aria-hidden
                />
                <span className={styles.scoutRowMain}>
                  <span className={styles.scoutRowName}>{e.displayName}</span>
                  <span className={styles.scoutRowMeta}>
                    {e.lastMeeting
                      ? `Last met ${formatInOrgZone(e.lastMeeting.startsAt, { month: 'short', day: 'numeric', year: 'numeric' })}${e.lastMeeting.result ? ` · ${resultLetter(e.lastMeeting.result)}${e.lastMeeting.teamScore != null ? ` ${e.lastMeeting.teamScore}–${e.lastMeeting.opponentScore}` : ''}` : ''}`
                      : 'No games on file'}
                    {e.observationCount > 0 && ` · ${e.observationCount} observation${e.observationCount === 1 ? '' : 's'}`}
                  </span>
                </span>
                <span className={styles.scoutRecChip} data-tone={recordTone(e.record)} title={`Record vs ${e.displayName} (${sportPack.label.toLowerCase()} record rule — scrimmages not counted)`}>
                  {recordChip(e.record)}
                </span>
              </Link>
            ))}
            {shown.length === 0 && q && (
              <p className={styles.scoutListNone}>No opponent matches “{query}”.</p>
            )}
          </div>
          <p className={styles.scoutFootnote}>
            Records count the same games Season Wrapped counts — scrimmages are listed on each opponent’s page but never counted.
          </p>
        </>
      )}
    </div>
  );
}
