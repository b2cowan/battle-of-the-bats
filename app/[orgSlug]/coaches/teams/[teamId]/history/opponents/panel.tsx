'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Library } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { recordChip, recordTone, resultLetter, hasMeetings, hasBookContent, type OpponentBookEntry } from '@/lib/coach-opponents';
import { formatInOrgZone } from '@/lib/timezone';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import styles from '../../../../coaches.module.css';

// "Who are we up against?" — the Opponent Scouting Book's list: every team we've faced,
// across every season, grouped by normalized name (plus coach-managed aliases, P2).
// INSTRUMENT: this page serves the live season and has no archive variant, by decision
// (owner 2026-08-04) — the per-season game facts stay in Results.
export function ScoutingPanel({
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
  /** Club Shared Book: the keys the club has content on — ONE batched lookup served with the
   *  list, never a query per row. Empty unless this team is itself sharing (reciprocity).
   *  Held as a Set so typing in the search box (which re-renders) never rebuilds it. */
  const [clubKeys, setClubKeys] = useState<Set<string>>(() => new Set());
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
      .then(data => {
        if (cancelled) return;
        setEntries(data.opponents ?? []);
        setClubKeys(new Set<string>(data.clubKeys ?? []));
        setError('');
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load opponents'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) return <CoachNotOnTeam />;

  const q = query.trim().toLowerCase();
  const shown = entries
    .filter(e => hasMeetings(e) || hasBookContent(e))
    .filter(e => !q || e.displayName.toLowerCase().includes(q));

  return (
    /* ⚠ NO WRAPPER AND NO HEADER — this is a PANEL (reports portal P1, 2026-08-18). The hub owns
       `styles.page`, the <h1> and the help "?" (which serves `premium-scouting` while this tab is
       the open one, so the guide this report has always pointed at is still one tap away).

       ⚠ THE TAB IS "SCOUTING BOOK" AND THE FOLDER IS STILL `opponents` — the owner picked that
       name over "Opponents" in the mockup session, and the per-opponent book below keeps its own
       route (`history/opponents/[opponentKey]`), so renaming the folder would have moved a page
       nobody asked to move. `legacyInsightsSection` is the one place the two names are reconciled. */
    <>
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
                {/* Club Shared Book: your club knows this opponent too. A marker, not a second
                    count — the number lives on the card, where the teams are named. */}
                {clubKeys.has(e.key) && (
                  <span
                    className={styles.scoutClubBadge}
                    role="img"
                    aria-label={`Your club has shared notes on ${e.displayName}`}
                    title={`Your club has shared notes on ${e.displayName}`}
                  >
                    <Library size={13} aria-hidden />
                  </span>
                )}
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
    </>
  );
}
