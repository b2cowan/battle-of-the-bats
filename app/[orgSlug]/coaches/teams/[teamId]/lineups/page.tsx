'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ListOrdered, ArrowRight, CheckCircle2, TriangleAlert, CalendarPlus,
  Plus, Pencil, Trash2, Check, X, ClipboardCheck, BarChart3, ChevronDown,
} from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent, RepTeamLineupTemplate, RepRosterPlayer, RepTeamLineupEntry } from '@/lib/types';
import type { SeasonLineupAnalytics } from '@/lib/lineup-season-analytics';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
// Cap how many games we probe for lineup-readiness so a busy season doesn't fan out dozens of
// requests — the nearest upcoming games (the ones a coach is about to coach) are what matter.
const READINESS_LIMIT = 20;

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}
function gameTitle(e: RepTeamEvent) {
  if (e.opponent) return `${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}`;
  return e.name || 'Game';
}

export default function CoachesLineupsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const confirm = useConfirm();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  // Fail-open like the nav — the server still enforces on every lineup route.
  const canLineups = assignment ? assignment.capabilities.lineups : true;

  const [upcoming, setUpcoming] = useState<RepTeamEvent[]>([]);
  const [recent, setRecent] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-game lineup readiness: true = a lineup is saved, false = not yet, undefined = not checked.
  const [ready, setReady] = useState<Record<string, boolean>>({});

  // ── Templates manager ──
  const [templates, setTemplates] = useState<RepTeamLineupTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [analytics, setAnalytics] = useState<SeasonLineupAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  // The template whose "apply to a game" picker is open (null = closed).
  const [applyTemplate, setApplyTemplate] = useState<RepTeamLineupTemplate | null>(null);
  const [applyBusyGameId, setApplyBusyGameId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error('Games could not be loaded');
      const data: { events?: RepTeamEvent[] } = await res.json();
      const games = (data.events ?? []).filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled');
      // Compute the split here (not during render) so we never call Date.now() in the render body.
      const now = Date.now();
      const isUpcoming = (e: RepTeamEvent) => new Date(e.startsAt).getTime() >= now && e.status === 'scheduled';
      setUpcoming(games.filter(isUpcoming).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
      setRecent(games.filter(e => !isUpcoming(e)).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()).slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Games could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`);
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch { /* non-blocking */ } finally {
      setTemplatesLoading(false);
    }
  }, [orgSlug, teamId]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalytics(data.analytics ?? null);
    } catch { /* non-blocking — analytics are optional */ } finally {
      setAnalyticsLoading(false);
    }
  }, [orgSlug, teamId]);

  // Wait for the assignments context to resolve before deciding whether to fetch — otherwise the
  // fail-open `canLineups` default would fire the fetch for an assistant whose access is revoked.
  useEffect(() => {
    if (ctxLoading || !canLineups) return;
    void Promise.resolve().then(load);
    void Promise.resolve().then(loadTemplates);
    void Promise.resolve().then(loadAnalytics);
  }, [ctxLoading, canLineups, load, loadTemplates, loadAnalytics]);

  // Probe lineup readiness for the nearest upcoming games (bounded).
  useEffect(() => {
    if (!canLineups || upcoming.length === 0) return;
    let cancelled = false;
    const probe = upcoming.slice(0, READINESS_LIMIT);
    Promise.all(
      probe.map(async e => {
        try {
          const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${e.id}/lineup`);
          if (!res.ok) return [e.id, undefined] as const;
          const json = await res.json();
          const entries = (json.entries ?? []) as { inningPositions?: Record<string, string> }[];
          return [e.id, entries.some(en => Object.values(en.inningPositions ?? {}).some(Boolean))] as const;
        } catch {
          return [e.id, undefined] as const;
        }
      }),
    ).then(pairs => {
      if (cancelled) return;
      setReady(prev => {
        const next = { ...prev };
        for (const [id, val] of pairs) if (typeof val === 'boolean') next[id] = val;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [canLineups, orgSlug, teamId, upcoming]);

  // ── Template actions ──
  function startRename(t: RepTeamLineupTemplate) {
    setRenamingId(t.id);
    setRenameValue(t.name);
    setNotice('');
  }
  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not rename');
      }
      setTemplates(list => list.map(t => t.id === id ? { ...t, name } : t).sort((a, b) => a.name.localeCompare(b.name)));
      setRenamingId(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not rename the template');
    } finally {
      setRenameBusy(false);
    }
  }

  async function deleteTemplate(t: RepTeamLineupTemplate) {
    if (!(await confirm({
      title: 'Delete template?',
      message: `Delete the saved template “${t.name}”? This can't be undone.`,
      confirmText: 'Delete', cancelText: 'Keep', tone: 'warning',
    }))) return;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${t.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete');
      setTemplates(list => list.filter(x => x.id !== t.id));
      setNotice(`Deleted “${t.name}”.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete the template');
    }
  }

  // Apply the open template onto a chosen game. Loads the game's lineup to (a) know if one already
  // exists (overwrite-aware confirm) and (b) map the template onto the game's current roster. The
  // lineup and template are the only things written — attendance is untouched.
  async function applyToGame(game: RepTeamEvent) {
    const t = applyTemplate;
    if (!t) return;
    setApplyBusyGameId(game.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${game.id}/lineup`);
      if (!res.ok) throw new Error('Could not open that game');
      const data: {
        players?: RepRosterPlayer[];
        lineup?: { notes?: string | null; rulesOverride?: unknown } | null;
        entries?: RepTeamLineupEntry[];
      } = await res.json();
      const rosterIds = new Set((data.players ?? []).map(p => p.id));
      const hasLineup = (data.entries ?? []).some(en => Object.values(en.inningPositions ?? {}).some(Boolean));

      const ok = await confirm(hasLineup ? {
        title: 'Overwrite this lineup?',
        message: `${gameTitle(game)} already has a lineup. Replace it with “${t.name}”?`,
        confirmText: 'Overwrite', cancelText: 'Keep current', tone: 'warning',
      } : {
        title: 'Apply template?',
        message: `Apply “${t.name}” to ${gameTitle(game)}?`,
        confirmText: 'Apply', cancelText: 'Cancel',
      });
      if (!ok) { setApplyBusyGameId(null); return; }

      // Map the template onto the game's CURRENT roster — silently skip players no longer rostered.
      const mapped = t.entries
        .filter(e => rosterIds.has(e.playerId))
        .map(e => ({ playerId: e.playerId, battingOrder: e.battingOrder, starter: e.starter, inningPositions: e.inningPositions }));
      const skipped = t.entries.length - mapped.length;
      if (mapped.length === 0) {
        setNotice(`None of “${t.name}”'s players are on ${gameTitle(game)}'s roster — nothing applied.`);
        setApplyBusyGameId(null);
        setApplyTemplate(null);
        return;
      }
      const put = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${game.id}/lineup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupMode: t.lineupMode,
          inningCount: t.inningCount,
          notes: data.lineup?.notes ?? '',
          rulesOverride: data.lineup?.rulesOverride ?? null,
          entries: mapped,
        }),
      });
      if (!put.ok) {
        const d = await put.json().catch(() => ({ error: put.statusText }));
        throw new Error(d.error ?? 'Could not apply the template');
      }
      setReady(prev => ({ ...prev, [game.id]: true }));
      setNotice(skipped > 0
        ? `Applied “${t.name}” to ${gameTitle(game)} — skipped ${skipped} player${skipped === 1 ? '' : 's'} no longer on the roster.`
        : `Applied “${t.name}” to ${gameTitle(game)}.`);
      setApplyTemplate(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not apply the template');
    } finally {
      setApplyBusyGameId(null);
    }
  }

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const header = (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderLeft}>
        <div className={styles.headerIcon}><ListOrdered size={22} /></div>
        <div>
          <h1 className={styles.pageTitle}>Lineups</h1>
          <p className={styles.pageSub}>Build game lineups and reusable templates for your team.</p>
        </div>
      </div>
      {canLineups && (
        <Link href={`${base}/lineups/templates/new`} className="btn btn-lime btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Plus size={15} /> New template
        </Link>
      )}
    </div>
  );

  if (!canLineups) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.emptyState}>
          <ListOrdered size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>Lineups aren&apos;t enabled for you</p>
          <p className={styles.emptyStateSub}>Ask your head coach to grant lineup access.</p>
        </div>
      </div>
    );
  }

  const renderRow = (e: RepTeamEvent, action: string) => {
    const r = ready[e.id];
    return (
      <Link key={e.id} href={`${base}/lineups/${e.id}`} className={styles.lineupFrontRow}>
        <span className={styles.lineupFrontDate}>
          <span className={styles.lineupFrontDay}>{new Date(e.startsAt).getDate()}</span>
          <span className={styles.lineupFrontMonth}>{new Date(e.startsAt).toLocaleDateString('en-CA', { month: 'short' })}</span>
        </span>
        <span className={styles.lineupFrontMain}>
          <span className={styles.lineupFrontTitle}>{gameTitle(e)}</span>
          <span className={styles.lineupFrontMeta}>{formatDay(e.startsAt)} · {formatTime(e.startsAt)}</span>
        </span>
        {r === true && <span className={styles.lineupFrontChip} data-tone="ok"><CheckCircle2 size={13} aria-hidden /> Lineup set</span>}
        {r === false && <span className={styles.lineupFrontChip} data-tone="warn"><TriangleAlert size={13} aria-hidden /> Not set</span>}
        <span className={styles.lineupFrontAction}>
          <span className={styles.lineupFrontActionLabel}>{action}</span>
          <ArrowRight size={14} aria-hidden />
        </span>
      </Link>
    );
  };

  const noGames = !loading && !error && upcoming.length === 0 && recent.length === 0;
  const pickerGames = [...upcoming, ...recent];

  return (
    <div className={styles.page}>
      {header}

      {notice && <p className={styles.lineupNotice} style={{ marginBottom: '1rem' }}>{notice}</p>}

      {/* ── Games ── */}
      {loading ? (
        <div className={styles.loadingState}>Loading games…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noGames ? (
        <div className={styles.emptyState}>
          <CalendarPlus size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No games yet</p>
          <p className={styles.emptyStateSub}>Add a game to your schedule, then build its lineup here.</p>
          <Link href={`${base}/schedule`} className="btn btn-outline btn-sm" style={{ marginTop: '0.9rem' }}>
            Add a game <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section aria-labelledby="lineups-upcoming">
              <p className={styles.sectionKicker} id="lineups-upcoming">Upcoming games</p>
              <div className={styles.lineupFrontList}>
                {upcoming.map(e => renderRow(e, 'Build lineup'))}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section aria-labelledby="lineups-recent">
              <p className={styles.sectionKicker} id="lineups-recent">Recent games</p>
              <div className={styles.lineupFrontList}>
                {recent.map(e => renderRow(e, 'Open lineup'))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Templates ── */}
      <section aria-labelledby="lineups-templates" style={{ marginTop: '1.75rem' }}>
        <p className={styles.sectionKicker} id="lineups-templates">Templates</p>
        {templatesLoading ? (
          <div className={styles.loadingState}>Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardCheck size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
            <p className={styles.emptyStateTitle}>No templates yet</p>
            <p className={styles.emptyStateSub}>Build a reusable “base” lineup — like a gold-medal order or a rain-day rotation — then apply it to any game in one tap.</p>
            <Link href={`${base}/lineups/templates/new`} className="btn btn-outline btn-sm" style={{ marginTop: '0.9rem' }}>
              <Plus size={14} /> New template
            </Link>
          </div>
        ) : (
          <div className={styles.lineupTplList}>
            {templates.map(t => (
              <div key={t.id} className={styles.lineupTplRow}>
                {renamingId === t.id ? (
                  <div className={styles.lineupTplRename}>
                    <input
                      className={styles.input}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(t.id); if (e.key === 'Escape') setRenamingId(null); }}
                      maxLength={80}
                      autoFocus
                      aria-label="Template name"
                    />
                    <button type="button" className={styles.lineupTplIconBtn} aria-label="Save name" disabled={!renameValue.trim() || renameBusy} onClick={() => saveRename(t.id)}>
                      <Check size={16} />
                    </button>
                    <button type="button" className={styles.lineupTplIconBtn} aria-label="Cancel rename" onClick={() => setRenamingId(null)}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Link href={`${base}/lineups/templates/${t.id}`} className={styles.lineupTplInfo}>
                      <span className={styles.lineupTplName}>{t.name}</span>
                      <span className={styles.lineupTplMeta}>
                        {t.lineupMode === 'nine_player' ? '9 player ball' : 'Everyone bats'} · {t.inningCount} {sportPack.periodLabelPlural.toLowerCase()} · {t.entries.length} player{t.entries.length === 1 ? '' : 's'}
                      </span>
                    </Link>
                    <div className={styles.lineupTplActions}>
                      <button type="button" className={styles.btnSecondary} disabled={pickerGames.length === 0} title={pickerGames.length === 0 ? 'Add a game first' : undefined} onClick={() => { setNotice(''); setApplyTemplate(t); }}>
                        Apply
                      </button>
                      <button type="button" className={styles.lineupTplIconBtn} aria-label={`Rename ${t.name}`} title="Rename" onClick={() => startRename(t)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className={styles.lineupTplIconBtn} aria-label={`Delete ${t.name}`} title="Delete" onClick={() => deleteTemplate(t)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Season analytics ── */}
      <section aria-labelledby="lineups-analytics" style={{ marginTop: '1.75rem' }}>
        <p className={styles.sectionKicker} id="lineups-analytics">Season analytics</p>
        {analyticsLoading ? (
          <div className={styles.loadingState}>Loading analytics…</div>
        ) : !analytics || analytics.gamesWithLineup === 0 ? (
          <div className={styles.emptyState}>
            <BarChart3 size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
            <p className={styles.emptyStateTitle}>No season trends yet</p>
            <p className={styles.emptyStateSub}>Save a lineup for a few games and your fair-play, position, arm-care and lineup-record trends will show up here.</p>
          </div>
        ) : (
          <>
            <p className={styles.lineupAnalyticsBasis}>Based on the {analytics.gamesWithLineup} game{analytics.gamesWithLineup === 1 ? '' : 's'} you&apos;ve saved a lineup for.</p>

            <details className={styles.lineupAnalyticsCard}>
              <summary className={styles.lineupAnalyticsSummary}>Fair playing time <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
              <div className={styles.lineupAnalyticsBody}>
                {analytics.fairPlay.map(r => {
                  const total = r.fieldInnings + r.benchInnings;
                  const pct = total > 0 ? Math.round((r.fieldInnings / total) * 100) : 0;
                  return (
                    <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                      <span className={styles.lineupAnalyticsName}>{r.name}</span>
                      <span className={styles.lineupAnalyticsBar}><i style={{ width: `${pct}%` }} /></span>
                      <span className={styles.lineupAnalyticsVal}>{r.fieldInnings} on · {r.benchInnings} bench</span>
                    </div>
                  );
                })}
              </div>
            </details>

            <details className={styles.lineupAnalyticsCard}>
              <summary className={styles.lineupAnalyticsSummary}>Bench balance <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
              <div className={styles.lineupAnalyticsBody}>
                {analytics.benchBalance.map(r => (
                  <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                    <span className={styles.lineupAnalyticsName}>{r.name}</span>
                    <span className={styles.lineupAnalyticsVal}>
                      {r.benchInnings} bench inning{r.benchInnings === 1 ? '' : 's'}
                      {r.backToBackGames > 0 && <em className={styles.lineupAnalyticsFlag}> · {r.backToBackGames} back-to-back</em>}
                    </span>
                  </div>
                ))}
              </div>
            </details>

            <details className={styles.lineupAnalyticsCard}>
              <summary className={styles.lineupAnalyticsSummary}>Position variety <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
              <div className={styles.lineupAnalyticsBody}>
                {analytics.positionVariety.map(r => (
                  <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                    <span className={styles.lineupAnalyticsName}>{r.name}</span>
                    <span className={styles.lineupAnalyticsVal}>
                      <strong>{r.count}</strong> · {r.positions.length ? r.positions.join(', ') : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </details>

            {analytics.armCare.length > 0 && (
              <details className={styles.lineupAnalyticsCard}>
                <summary className={styles.lineupAnalyticsSummary}>Arm-care / pitching load <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
                <div className={styles.lineupAnalyticsBody}>
                  {analytics.armCare.map(r => (
                    <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                      <span className={styles.lineupAnalyticsName}>{r.name}</span>
                      <span className={styles.lineupAnalyticsVal}>
                        {r.inningsPitched} IP · {r.gamesPitched} game{r.gamesPitched === 1 ? '' : 's'}
                        {r.perGameCap != null && <> · cap {r.perGameCap}/g</>}
                        {r.overCapGames > 0 && <em className={styles.lineupAnalyticsFlag}> · ⚠ {r.overCapGames} over cap</em>}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details className={styles.lineupAnalyticsCard}>
              <summary className={styles.lineupAnalyticsSummary}>Records by reused lineup <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
              <div className={styles.lineupAnalyticsBody}>
                {analytics.reusedLineups.length === 0 ? (
                  <p className={styles.lineupAnalyticsEmpty}>No batting order has been reused across multiple games yet.</p>
                ) : analytics.reusedLineups.map((r, i) => (
                  <div key={i} className={styles.lineupAnalyticsRow}>
                    <span className={styles.lineupAnalyticsName}>{r.label}</span>
                    <span className={styles.lineupAnalyticsVal}>
                      {r.scoredGames > 0
                        ? <><b className={styles.lineupAnalyticsRec}>{r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ''}</b> · {r.games} game{r.games === 1 ? '' : 's'}{r.scoredGames < r.games ? ` (${r.scoredGames} scored)` : ''}</>
                        : <>{r.games} games · no scores yet</>}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </section>

      {/* ── Apply-to-game picker ── */}
      {applyTemplate && (
        <div className={styles.modalOverlay} onClick={() => applyBusyGameId ? null : setApplyTemplate(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Apply “{applyTemplate.name}” to…</h3>
              <button className={styles.modalCloseBtn} aria-label="Close" onClick={() => setApplyTemplate(null)}><X size={18} /></button>
            </div>
            <p className={styles.pageSub} style={{ margin: '0 0 0.75rem' }}>Pick a game. You&apos;ll confirm before anything is overwritten.</p>
            <div className={styles.lineupFrontList}>
              {pickerGames.map(g => (
                <button key={g.id} type="button" className={styles.lineupFrontRow} disabled={!!applyBusyGameId} onClick={() => applyToGame(g)} style={{ textAlign: 'left', cursor: applyBusyGameId ? 'wait' : 'pointer' }}>
                  <span className={styles.lineupFrontDate}>
                    <span className={styles.lineupFrontDay}>{new Date(g.startsAt).getDate()}</span>
                    <span className={styles.lineupFrontMonth}>{new Date(g.startsAt).toLocaleDateString('en-CA', { month: 'short' })}</span>
                  </span>
                  <span className={styles.lineupFrontMain}>
                    <span className={styles.lineupFrontTitle}>{gameTitle(g)}</span>
                    <span className={styles.lineupFrontMeta}>{formatDay(g.startsAt)} · {formatTime(g.startsAt)}</span>
                  </span>
                  {ready[g.id] === true && <span className={styles.lineupFrontChip} data-tone="ok"><CheckCircle2 size={13} aria-hidden /> Has lineup</span>}
                  <span className={styles.lineupFrontAction}>
                    <span className={styles.lineupFrontActionLabel}>{applyBusyGameId === g.id ? 'Applying…' : 'Apply'}</span>
                    <ArrowRight size={14} aria-hidden />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
