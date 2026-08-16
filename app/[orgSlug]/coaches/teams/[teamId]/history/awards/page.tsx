'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { Award, Check, Printer, Trash2 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import AwardTypeManagerModal from '@/components/coaches/AwardTypeManagerModal';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { canManageAwards } from '@/lib/coach-capabilities';
import styles from '../../../../coaches.module.css';
import type { RepPlayerAward, RepTeamAwardType } from '@/lib/types';

// "Who's earning it?" — a new report (not a metric folded into an existing one, unlike the
// "vs tag" report) because a player leaderboard is a genuinely different shape: players ranked
// by recognition, not games. Owner-confirmed placement as the Insights hub's 5th tile,
// 2026-07-12 (see COACH_TAGS_AWARDS_PLAN.md P2).
export default function CoachesAwardsReportPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  /**
   * ⚠⚠ AN ARCHIVE DOOR SINCE 2026-08-16 (archive rail Phase 2, owner-approved with the phase).
   * This page is BOTH a record and an instrument — it gives awards, manages the type library and
   * removes rows — so becoming season-aware meant three separate things, not one:
   *
   *   1. **Read the season** and send it to both fetches (the routes have been on the season-read
   *      rail since Chunk F; the page simply never asked).
   *   2. **Put the instruments away in a record.** Give / Manage / Remove are absent in a finished
   *      season — CLAUDE.md rule 1, records in, instruments out. The server refuses them anyway:
   *      every write verb here resolves the ACTIVE year and cannot address a past season at all.
   *   3. **Stop the report spanning seasons.** Fixed at the route, not here — see the awards GET.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const caps = page.capabilities;
  const isRecord = page.isReadOnly;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const { loading: ctxLoading } = useCoaches();
  const confirm = useConfirm();

  const [awardTypes, setAwardTypes] = useState<RepTeamAwardType[]>([]);
  const [awards, setAwards] = useState<RepPlayerAward[]>([]);
  const [players, setPlayers] = useState<{ id: string; name: string; number: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [giveOpen, setGiveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [noSeason, setNoSeason] = useState(false);

  /**
   * ⚠ The key carries the season, and every write is guarded against a stale run — the switcher
   * rewrites this page's own URL and the page does not remount, so a team-only key paints one
   * season's leaderboard under another's chip, and an unguarded write from a superseded run can
   * strand the page on "Loading report…" for good. Same shape as the results page and the hub.
   */
  const loadKey = teamId;

  /**
   * ⚠⚠ STALENESS IS INTERNAL, BECAUSE AN OPT-IN GUARD GETS FORGOTTEN — and it was, three times
   * (`/review` 2026-08-16).
   *
   * This started as `load(isStale)` with a no-op default, so only the caller that remembered to
   * pass a predicate was protected. The mount effect remembered. The three WRITE-triggered reloads
   * — after removing an award, and the two modals' `onChanged` — did not, and Phase 2 is what made
   * that reachable: it put a season chip on this page for the first time, and the chip re-navigates
   * without remounting. Delete an award, switch season before the reload lands, and the superseded
   * run stamps ITS key into `loadedFor` — the page falls back to "Loading report…" and **stays
   * there forever**, because nothing in the effect's deps has changed so it never re-fires.
   *
   * A generation counter makes every run stale the moment a newer one starts, whoever started it.
   * The caller cannot opt out, and a fourth caller added later is protected without knowing this
   * comment exists — which is the only kind of guard that survives.
   */
  const runRef = useRef(0);
  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    const myRun = ++runRef.current;
    // Superseded by a newer run (any caller), or cancelled by the effect (unmount / season change).
    const isStale = () => isCancelled() || runRef.current !== myRun;
    setLoading(true);
    setError('');
    try {
      const [typesRes, awardsRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`),
      ]);
      // No active program year is a legitimate state, not a retryable failure — the same
      // honest-empty branch this report's three siblings already have (WI-7). ⚠ Far RARER now:
      // with a season on the request the routes resolve that season and answer normally, which is
      // what gives a coach with no live assignment their own past season's awards at all.
      if (typesRes.status === 404 || awardsRes.status === 404) {
        if (isStale()) return;
        setNoSeason(true);
        setAwardTypes([]);
        setAwards([]);
        setPlayers([]);
        return;
      }
      if (!typesRes.ok || !awardsRes.ok) throw new Error();
      const types = await typesRes.json();
      const data = await awardsRes.json();
      if (isStale()) return;
      setNoSeason(false);
      setAwardTypes(types.awardTypes ?? []);
      setAwards(data.awards ?? []);
      setPlayers(data.players ?? []);
    } catch {
      if (!isStale()) setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      if (!isStale()) {
        setLoadedFor(loadKey);
        setLoading(false);
      }
    }
  }, [orgSlug, teamId, loadKey]);

  useEffect(() => {
    if (ctxLoading) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() => load(isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  // ⚠ `hasAccess` covers live AND archived assignments — the live-assignment test that stood here
  // told a coach with no live assignment their own finished season's team was "not found".
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }
  // ⚠ THAT season's grant (governing rule 1), never the coach's current one — a coach cleared for
  // awards today but not in 2024 must not read 2024's leaderboard. The API re-decides this
  // independently and is the authority; this only keeps the page from drawing onto a 403.
  if (!caps || !canManageAwards(caps)) {
    return (
      <div className={styles.notAssigned}>
        <h2>No access</h2>
        <p>You don’t have access to awards for this team.</p>
      </div>
    );
  }

  // Filter chips are built from types with at least one award (self-hides an unused type,
  // same convention as the "vs tag" report's per-tag chip self-hide).
  const typeChips = awardTypes
    .map(t => ({ type: t, count: awards.filter(a => a.awardTypeId === t.id).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const activeType = typeChips.find(c => c.type.id === activeTypeId)?.type ?? null;
  const visibleAwards = activeType ? awards.filter(a => a.awardTypeId === activeType.id) : awards;

  const leaderboard = (() => {
    const byPlayer = new Map<string, { playerId: string; playerName: string; total: number; byType: Map<string, { type: RepTeamAwardType | undefined; count: number }> }>();
    for (const a of visibleAwards) {
      const entry = byPlayer.get(a.playerId) ?? { playerId: a.playerId, playerName: a.playerName ?? 'Unknown player', total: 0, byType: new Map() };
      entry.total += 1;
      const t = entry.byType.get(a.awardTypeId) ?? { type: a.awardType, count: 0 };
      t.count += 1;
      entry.byType.set(a.awardTypeId, t);
      byPlayer.set(a.playerId, entry);
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.total - a.total);
  })();

  async function handleDelete(award: RepPlayerAward) {
    const ok = await confirm({
      title: 'Remove this award?',
      message: `Undo ${award.awardType?.name ?? 'this award'} for ${award.playerName}? This can’t be undone.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleteError('');
    setBusyId(award.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards/${award.id}`, { method: 'DELETE' });
      if (res.ok) {
        void load();
      } else {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        setDeleteError(d.error ?? 'Could not remove this award');
      }
    } catch {
      setDeleteError('Could not remove this award — check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.page}>
      {/* ⚠ The back link carries the year. The hub is this page's parent in EVERY season now, and
          a bare link would return a coach reading 2024 to the live season's hub — the "link one
          level down" defect this rail has already sprung twice. */}
      <CoachBackLink href={`${base}/history`}>Insights</CoachBackLink>
      {/* Page-header ruling 2026-08-11: "Every award given this season" deleted — the list below
          IS every award given this season, and the season is the masthead's to state. */}
      <CoachPageHeader
        icon={Award}
        title="Who's earning it?"
        helpLabel="Awards"
        help={{ module: 'coaches', sectionIds: ['recipe-game-day-details'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-game-day-details` }}
      />

      {loading || loadedFor !== loadKey ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noSeason ? (
        <div className={styles.emptyState}>
          <Award size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No season set up yet</p>
          <p className={styles.emptyStateSub}>Awards live inside a season — start one from your team settings and this report fills in.</p>
        </div>
      ) : (
        <>
          {/* ⚠⚠ THE INSTRUMENTS GO AWAY IN A RECORD, THE KEEPSAKE STAYS. Giving an award, managing
              the type library and removing a row all ACT on a season — CLAUDE.md rule 1 keeps them
              live-only, and the server refuses them regardless (every write verb here resolves the
              ACTIVE year). Printing a certificate is the opposite: it reproduces something that
              already happened, which is exactly what a coach opens a finished season to do. */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isRecord && (
              <>
                {/* A rosterless team gets a reason, not a blank player picker (WI-7). */}
                {players.length === 0 ? (
                  <p className={styles.insightsBasis} style={{ margin: 0 }}>🏆 Add players to your roster first — then you can give awards.</p>
                ) : (
                  <button className={styles.btnPrimary} onClick={() => setGiveOpen(true)}>🏆 Give an award</button>
                )}
                <button className={styles.tagManageLink} onClick={() => setManageOpen(true)}>Manage award types</button>
              </>
            )}
            {/* Chunk D 3.4 — awards night, printed. Offered only for a chosen award TYPE:
                "print every award this season" is a stack of mismatched certificates, not a
                thing a coach wants. ⚠ Carries the year: the certificate names the season it was
                won in, and that page reads it from the URL. */}
            {activeType && visibleAwards.length > 0 && (
              <Link
                href={`${base}/history/awards/certificate?typeId=${activeType.id}`}
                className={styles.tagManageLink}
              >
                <Printer size={13} aria-hidden /> Print {visibleAwards.length} certificate{visibleAwards.length === 1 ? '' : 's'}
              </Link>
            )}
          </div>

          {awards.length === 0 ? (
            <div className={styles.emptyState}>
              <Award size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
              {/* ⚠ Past tense in a record, and no button to point at — there isn't one. */}
              <p className={styles.emptyStateTitle}>{isRecord ? 'No awards were given' : 'No awards given yet'}</p>
              <p className={styles.emptyStateSub}>
                {isRecord
                  ? 'Nobody was recognised with an award in this season.'
                  : 'Hand out your first one right after a game wraps, or use the button above.'}
              </p>
            </div>
          ) : (
            <>
              {activeType ? (
                <div className={styles.insightsTagSummary}>
                  <span className={styles.insightsTagSummaryLbl}>{activeType.emoji ? `${activeType.emoji} ` : ''}{activeType.name}:</span>
                  <span className={styles.insightsTagSummaryRec}>{visibleAwards.length} given</span>
                </div>
              ) : (
                <p className={styles.insightsBasis}>
                  {/* ⚠ "this season" is now TRUE. Until 2026-08-16 this line counted every award
                      the team had ever given, because the route filtered by team and not by the
                      season's roster — a wrong number on a live screen, not just an archive one. */}
                  {awards.length} award{awards.length === 1 ? '' : 's'} given {isRecord ? 'that season' : 'this season'} across {typeChips.length} award type{typeChips.length === 1 ? '' : 's'}
                </p>
              )}

              {typeChips.length > 1 && (
                <div className={styles.lineupFilterBar} role="group" aria-label="Filter by award">
                  <button
                    type="button"
                    aria-pressed={!activeType}
                    className={`${styles.lineupFilterChip} ${!activeType ? styles.lineupFilterChipActive : ''}`}
                    onClick={() => setActiveTypeId(null)}
                  >
                    {!activeType && <Check size={12} aria-hidden />} All
                  </button>
                  {typeChips.map(c => (
                    <button
                      key={c.type.id}
                      type="button"
                      aria-pressed={activeType?.id === c.type.id}
                      className={`${styles.lineupFilterChip} ${activeType?.id === c.type.id ? styles.lineupFilterChipActive : ''}`}
                      onClick={() => setActiveTypeId(c.type.id)}
                    >
                      {activeType?.id === c.type.id && <Check size={12} aria-hidden />} {c.type.emoji ? `${c.type.emoji} ` : ''}{c.type.name} <b className={styles.lineupFilterCount}>{c.count}</b>
                    </button>
                  ))}
                </div>
              )}

              <section style={{ marginBottom: '1.75rem' }}>
                <p className={styles.sectionKicker}>Leaderboard</p>
                {leaderboard.map((row, i) => (
                  <div key={row.playerId} className={styles.tagManagerRow}>
                    <span className={styles.mutedInline} style={{ width: '1.5rem', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{row.playerName}</div>
                      <div className={styles.lineupChips} style={{ marginTop: '0.25rem' }}>
                        {Array.from(row.byType.values()).map((t, ti) => (
                          <span key={ti} className={styles.lineupChip}>{t.type?.emoji ? `${t.type.emoji} ` : ''}{t.count}× {t.type?.name ?? 'Award'}</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)' }}>{row.total}</span>
                  </div>
                ))}
              </section>

              <section>
                <p className={styles.sectionKicker}>Full history</p>
                {deleteError && <p className={styles.errorText}>{deleteError}</p>}
                <div className={styles.insightsTableWrap}>
                  <table className={styles.insightsTable}>
                    <thead><tr><th>Player</th><th>Award</th><th>For</th><th>Date</th><th>Note</th><th aria-hidden /></tr></thead>
                    <tbody>
                      {visibleAwards.map(a => (
                        <tr key={a.id}>
                          <td>{a.playerName}</td>
                          <td>{a.awardType?.emoji ? `${a.awardType.emoji} ` : ''}{a.awardType?.name ?? '—'}</td>
                          <td className={styles.mutedInline}>{a.eventOpponent ? `vs ${a.eventOpponent}` : (a.tournamentLabel || 'General')}</td>
                          <td className={styles.insightsNum}>{new Date(`${a.awardedAt}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</td>
                          <td className={styles.mutedInline}>{a.note || '—'}</td>
                          <td>
                            {/* Two clicks from the history the coach already keeps (3.4). */}
                            <Link
                              title="Print certificate"
                              href={`${base}/history/awards/certificate?awardId=${a.id}`}
                              style={{ color: 'var(--white-45)', padding: '0.2rem', display: 'inline-block' }}
                            >
                              <Printer size={13} aria-hidden />
                            </Link>
                            {/* ⚠ Removing an award UNDOES a night that has happened — an instrument,
                                absent in a record. The DELETE route resolves the active year and
                                would refuse it anyway; this is the door, not the lock. */}
                            {!isRecord && (
                              <button
                                title="Remove"
                                disabled={busyId === a.id}
                                onClick={() => handleDelete(a)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--white-45)', padding: '0.2rem' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {giveOpen && (
        <GiveAwardModal
          orgSlug={orgSlug}
          teamId={teamId}
          players={players}
          awardTypes={awardTypes}
          eventContext={null}
          onClose={() => setGiveOpen(false)}
          onChanged={() => { void load(); }}
        />
      )}
      {manageOpen && (
        <AwardTypeManagerModal
          orgSlug={orgSlug}
          teamId={teamId}
          /* Team's OWN types only — org-shared types (teamId null, Phase 3) are managed by the
             org admin in the Shared Library, not editable/retirable from a team. The give-award
             picker above still offers shared types; only management is team-scoped. */
          awardTypes={awardTypes.filter(t => t.teamId !== null)}
          onClose={() => setManageOpen(false)}
          onChanged={() => { void load(); }}
        />
      )}
    </div>
  );
}
