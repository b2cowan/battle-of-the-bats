'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { ClipboardList, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCoachSeasonPage, useCoaches } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import type { RepTryoutRegistrationStatus } from '@/lib/types';

interface HistoryCandidate {
  id: string;
  playerFirstName: string;
  playerLastName: string | null;
  status: RepTryoutRegistrationStatus;
  offerResponse: string | null;
  averageScore: number | null;
  scoredCategories: number;
  notes: string[];
}

interface HistoryPayload {
  programYear: { id: string; name: string } | null;
  tryout: { id: string; isAnonymous: boolean } | null;
  sessions: { id: string; sessionDate: string; label: string | null }[];
  candidates: HistoryCandidate[];
  turnout: number;
  priorTurnout: number | null;
  priorSeasonName: string | null;
}

/**
 * What actually happened to a candidate, in the words a coach would use.
 *
 * ⚠ Every member of `RepTryoutRegistrationStatus` must appear here. The fallback reads "No
 * decision recorded", which is a CLAIM ABOUT THE PAST — an unhandled status silently rewrites
 * "we waitlisted them" into "we never decided", on the one screen a coach opens specifically to
 * find out what was decided. `waitlisted` and `pending_review` were missing.
 */
function decisionLabel(c: HistoryCandidate): { text: string; tone: 'made' | 'not' | 'other' } {
  switch (c.status) {
    case 'accepted':
      return { text: 'Offered · accepted', tone: 'made' };
    case 'offered':
      return c.offerResponse === 'declined'
        ? { text: 'Offered · declined', tone: 'other' }
        : { text: 'Offered', tone: 'made' };
    case 'waitlisted':
      return { text: 'Waitlisted', tone: 'other' };
    case 'declined':
      return { text: 'Not offered', tone: 'not' };
    case 'withdrawn':
      return { text: 'Withdrew', tone: 'other' };
    case 'pending_review':
      // Genuinely undecided when the season closed — distinct from "we never looked".
      return { text: 'No decision made', tone: 'other' };
    default:
      return { text: 'No decision recorded', tone: 'other' };
  }
}

/**
 * Tryout history — the RECORD of a tryout (Chunk F, owner ruling D-F1, 2026-08-01).
 *
 * Two questions this exists to answer, both of them asked a year after the fact: is turnout
 * growing, and what did we say about this candidate last time. The live tryout hub is a
 * different thing entirely — it runs a tryout (check-in, evaluator links, decisions, offer
 * emails) — and none of that machinery appears here.
 */
export default function TryoutHistoryPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { loading } = useCoaches();
  const page = useCoachSeasonPage(orgSlug, teamId);

  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [openNotes, setOpenNotes] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tryout-history`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load tryout history');
      setData(json as HistoryPayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tryout history.');
    } finally {
      setFetching(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { if (!loading) void load(); }, [loading, load]);

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const turnoutDelta = data && data.priorTurnout != null ? data.turnout - data.priorTurnout : null;
  const TrendIcon = turnoutDelta == null ? Minus : turnoutDelta > 0 ? TrendingUp : turnoutDelta < 0 ? TrendingDown : Minus;

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: retitled "Tryout history" — "Tryouts" was the live hub's
          name too, and two screens with one title is how a coach ends up on the wrong one. The
          breadcrumb retires; the session/candidate counts move into the body they summarize. */}
      <CoachPageHeader
        icon={ClipboardList}
        title="Tryout history"
        helpLabel="Tryout history"
        help={{ module: 'coaches', sectionIds: ['premium-tryout-history'], fullGuideHref: `/${orgSlug}/coaches/help#premium-tryout-history` }}
      />

      {fetching ? (
        <div className={styles.loadingState}>Looking back at this tryout…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !data?.tryout ? (
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={20} aria-hidden />}
          headline="No tryout was held this season"
          description="When a team runs a tryout, this is where its turnout, decisions and evaluations stay on the record."
          payoff="A year later it answers the question that actually comes up: have we seen this player before, and what did we say?"
        />
      ) : (
        <>
          {/* Turnout, stated as a COMPARISON. A bare count doesn't answer "is the program
              growing" — which is the reason the owner put tryouts back in scope. */}
          <div className={styles.statStrip}>
            {/* Page-header ruling 2026-08-11: the retired subtitle's "N sessions · N candidates"
                lands HERE rather than as a second strip — this row already carried the candidate
                count, and printing it twice on one screen is the thing the ruling is against. */}
            {data.sessions.length > 0 && (
              <>
                <span className={styles.statStripItem}>
                  <strong>{data.sessions.length}</strong>
                  {data.sessions.length === 1 ? 'session' : 'sessions'}
                </span>
                <span className={styles.statStripDot} aria-hidden>·</span>
              </>
            )}
            <span className={styles.statStripItem}>
              <strong>{data.turnout}</strong>
              {data.turnout === 1 ? 'candidate' : 'candidates'}
            </span>
            <span className={styles.statStripDot} aria-hidden>·</span>
            <span className={styles.statStripItem}>
              <TrendIcon size={12} aria-hidden />{' '}
              {turnoutDelta == null || !data.priorSeasonName
                ? 'first recorded tryout'
                : turnoutDelta === 0
                  ? `level with ${data.priorSeasonName}`
                  : `${turnoutDelta > 0 ? 'up' : 'down'} ${Math.abs(turnoutDelta)} from ${data.priorSeasonName}`}
            </span>
            <span className={styles.statStripDot} aria-hidden>·</span>
            <span className={styles.statStripItem}>
              <strong>{data.candidates.filter(c => decisionLabel(c).tone === 'made').length}</strong>
              offered
            </span>
          </div>

          <CoachScrollX hint="Swipe to see decisions and notes">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Score</th>
                  <th>Decision</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.candidates.map(c => {
                  const decision = decisionLabel(c);
                  const name = [c.playerFirstName, c.playerLastName].filter(Boolean).join(' ');
                  const notesOpen = openNotes === c.id;
                  return (
                    <tr key={c.id}>
                      <td data-label="Candidate">{name}</td>
                      <td data-label="Score">
                        {c.averageScore == null ? '—' : (<>{c.averageScore.toFixed(1)}{c.scoredCategories > 0 && (<span className={styles.bodyNote}> · {c.scoredCategories} {c.scoredCategories === 1 ? 'score' : 'scores'}</span>)}</>)}
                      </td>
                      <td data-label="Decision">
                        <span className={
                          decision.tone === 'made' ? `${styles.badge} ${styles.badgeActive}`
                          : decision.tone === 'not' ? `${styles.badge} ${styles.badgeDraft}`
                          : styles.badge
                        }>{decision.text}</span>
                      </td>
                      <td>
                        {c.notes.length > 0 && (
                          <>
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              aria-expanded={notesOpen}
                              onClick={() => setOpenNotes(notesOpen ? null : c.id)}
                            >
                              {notesOpen ? 'Hide notes' : `Notes (${c.notes.length})`}
                            </button>
                            {notesOpen && (
                              <ul className={styles.tryoutHistoryNotes}>
                                {c.notes.map((n, i) => <li key={i}>{n}</li>)}
                              </ul>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CoachScrollX>

          {data.sessions.length > 0 && (
            <p className={styles.bodyNote} style={{ marginTop: '0.75rem' }}>
              Sessions: {data.sessions.map(s => s.sessionDate).join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
