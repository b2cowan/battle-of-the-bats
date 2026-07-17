'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrendingUp, Plus, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import TestTypesManager from '@/components/coaches/TestTypesManager';
import { todayLocal } from '@/lib/measurable-format';
import { canViewDevelopmentGoals, canViewMeasurables, canWriteDevelopment } from '@/lib/coach-capabilities';
import styles from '../../../coaches.module.css';
import type { RepTeamEvaluationSession, RepTeamMeasurableType } from '@/lib/types';

function formatSessionDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function DevelopmentHubPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — no cross-team fetch races or stale drafts (3A key= pattern).
  return <DevelopmentHub key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

function DevelopmentHub({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const caps = assignment?.capabilities;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development`;

  const [sessions, setSessions] = useState<RepTeamEvaluationSession[] | null>(null);
  const [types, setTypes] = useState<RepTeamMeasurableType[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // ONE source for the write flag, resilient to the sessions GET 404'ing (no active program
  // year must not silently lock the Test types card for a legit head coach).
  const canWrite = caps ? canWriteDevelopment(caps) : false;

  // ONE fetch: the sessions GET carries sessions + types + canWrite (board-route precedent —
  // two separate GETs doubled the auth/capability resolution per hub load).
  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/sessions`);
      const json = await res.json().catch(() => null);
      if (res.status === 404) {
        // No active program year — the hub still renders honestly empty.
        setSessions([]);
        setTypes([]);
        setError('');
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load Development — try again.');
      setSessions(json.sessions);
      setTypes(json.types);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Development — try again.');
      setSessions(s => s ?? []);
      setTypes(t => t ?? []);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  async function newSession() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDate: todayLocal() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not start a session — try again.');
      router.push(`${base}/development/sessions/${json.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session — try again.');
      setBusy(false);
    }
  }

  async function deleteSession(session: RepTeamEvaluationSession) {
    if (busy) return;
    const ok = await confirm({
      title: 'Delete this session?',
      message: 'Every reading collected in it stays on the players — they just lose the session grouping.',
      confirmText: 'Delete session',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/sessions/${session.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setSessions(list => (list ?? []).filter(s => s.id !== session.id));
    } catch {
      setError("Couldn't delete the session — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!assignmentsLoading && assignment && caps && !canViewDevelopmentGoals(caps) && !canViewMeasurables(caps)) {
    return (
      <div className={styles.page}>
        <p className={styles.detailPlaceholder}>You do not have access to player development on this team.</p>
      </div>
    );
  }

  const loading = sessions === null || types === null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><TrendingUp size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Development</h1>
            <p className={styles.pageSub}>{assignment?.teamName ?? ''} — evaluation sessions, the team board, and your test list</p>
          </div>
        </div>
      </div>

      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {loading ? (
        <div className={styles.loadingState}>Loading development…</div>
      ) : (
        <div className={styles.devHubGrid}>
          {/* ── Evaluation sessions — the working card (the hub's ONE lime action) ── */}
          <div className={styles.detailSection}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Evaluation sessions</p>
              {canWrite && (
                <button type="button" className="btn btn-lime" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  disabled={busy} onClick={newSession}>
                  <Plus size={13} /> New session
                </button>
              )}
            </div>
            <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>
              Run your tests for the whole roster in one go — a few sessions a season is what makes the trend lines real.
            </p>
            {sessions.length === 0 ? (
              <p className={styles.detailPlaceholder}>
                {canWrite ? 'No sessions yet — start one at your next practice.' : 'No sessions yet.'}
              </p>
            ) : (
              /* While a delete is in flight the rows go inert — tapping into a session
                 that's mid-delete would land on a jarring 404. */
              <ul className={styles.miniList} style={busy ? { pointerEvents: 'none', opacity: 0.6 } : undefined}>
                {sessions.map(s => (
                  <li key={s.id} className={styles.miniRow}>
                    <span className={styles.miniRowMain}>
                      <Link href={`${base}/development/sessions/${s.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {formatSessionDate(s.sessionDate)}{s.note ? ` — ${s.note}` : ''}
                      </Link>
                    </span>
                    <span className={styles.miniRowMeta}>
                      {(s.playerCount ?? 0) > 0
                        ? `${s.playerCount} player${s.playerCount === 1 ? '' : 's'} · ${s.typeCount} test${s.typeCount === 1 ? '' : 's'}`
                        : 'no readings yet'}
                    </span>
                    {canWrite && (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}
                        aria-label="Delete this session" onClick={() => deleteSession(s)}>
                        <X size={11} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Team board door ── */}
          <Link href={`${base}/development/board`} className={styles.insightsDoor}>
            <span className={styles.insightsDoorQ}>How&apos;s everyone developing?<span aria-hidden>→</span></span>
            <span className={styles.insightsDoorSum}>
              Every player&apos;s focus areas and latest numbers, in roster order — a coverage view, not a ranking.
            </span>
          </Link>

          {/* ── Insights door (3D) — deliberately absent until the report existed (no doors
                 to nowhere); same question as the Insights tile: one phrasing, one destination. ── */}
          <Link href={`${base}/history/development`} className={styles.insightsDoor}>
            <span className={styles.insightsDoorQ}>Is everyone getting attention?<span aria-hidden>→</span></span>
            <span className={styles.insightsDoorSum}>
              The coverage report in Insights — one row per player: active focus, last evaluation, history linked.
            </span>
          </Link>

          {/* ── Test types card — the ONE shared manager ── */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Test types</p>
            <TestTypesManager
              apiBase={`${apiBase}/measurable-types`}
              types={types}
              canWrite={canWrite}
              onTypesChanged={update => setTypes(t => update(t ?? []))}
            />
          </div>

          {/* ── Practice plans slot — reserved room, honestly not built (Phase 4 fills it) ── */}
          <div className={styles.devSlotCard}>
            <p className={styles.detailSectionTitle} style={{ color: 'inherit', margin: 0 }}>Practice plans</p>
            <p>Coming in a later phase — plan practices around who&apos;s working on what.</p>
          </div>
        </div>
      )}
    </div>
  );
}
