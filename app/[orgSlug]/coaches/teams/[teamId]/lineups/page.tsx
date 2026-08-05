'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ListOrdered, ArrowRight, CheckCircle2, TriangleAlert, CalendarPlus,
  Plus, Pencil, Trash2, Check, X, ClipboardCheck, HelpCircle,
} from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachSeasonChip from '@/components/coaches/CoachSeasonChip';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { canManageSchedule } from '@/lib/coach-capabilities';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import styles from '../../../coaches.module.css';
import { gameDayEntryHref } from '@/lib/coach-game-day';
import type { RepTeamEvent, RepTeamLineupTemplate, RepRosterPlayer, RepTeamLineupEntry } from '@/lib/types';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
// Games-tab scope filter chips — a chip only renders when the team actually has games of that
// type (data honesty: no dead filters).
const TYPE_CHIPS = [
  { key: 'league_game', label: 'League' },
  { key: 'tournament_game', label: 'Tournament' },
  { key: 'scrimmage', label: 'Scrimmage' },
] as const;

// Weekday only — the row's date tile already carries the day number and month directly beside this
// line, so repeating them spent the card's scarcest resource on something already on screen (and on
// a phone it pushed the time onto a second line). The weekday earns its place; the tile has no room
// for it. One string at every width: redundancy is redundancy on desktop too.
function formatWeekday(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { weekday: 'short' });
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
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const initialSearch = use(searchParamsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const confirm = useConfirm();
  const { openHelp } = useHelpDrawer();
  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  // Clock snapshot, once per mount (render must stay pure) — see the schedule page's twin note.
  const [gameDayNowMs] = useState(() => Date.now());
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  // Fail-open like the nav — the server still enforces on every lineup route.
  const canLineups = assignment ? page.capabilities?.lineups : true;
  // Viewing a lineup is a READ; building one is a write, so it folds in read-only (Chunk F).
  const canBuildLineups = page.canWrite(canLineups);
  // Adding a game is a SCHEDULE grant, not a lineup one — so a coach with lineups but no schedule
  // must never be handed an "Add a game" button they can't use. Fails CLOSED.
  const canAddGames = page.canWrite(page.capabilities ? canManageSchedule(page.capabilities) : false);
  const periodWord = sportPack.periodLabel.toLowerCase();
  // `label` is required here (unlike the HelpButton-only pages, which fall back to the button's own
  // label): this object also goes straight to openHelp() from the empty states, where there is no
  // button to fall back to. Don't "de-duplicate" it away.
  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-lineups'],
    label: 'Lineups',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-lineups`,
  };

  const [upcoming, setUpcoming] = useState<RepTeamEvent[]>([]);
  const [recent, setRecent] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-game lineup readiness (true = a lineup is saved) from the events read's bulk
  // lineupSetEventIds — definitive for every listed game, no per-game probing.
  const [ready, setReady] = useState<Record<string, boolean>>({});

  // Tabs (Games | Templates) + Games-tab filters. The tab is deep-linkable via ?tab=templates —
  // seeded from the server-provided searchParams so no effect / no hydration mismatch.
  const [tab, setTab] = useState<'games' | 'templates'>(initialSearch.tab === 'templates' ? 'templates' : 'games');
  const [filterType, setFilterType] = useState<string>('all');
  const [needsOnly, setNeedsOnly] = useState(false);

  // ── Templates manager ──
  const [templates, setTemplates] = useState<RepTeamLineupTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [notice, setNotice] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  // The template whose "apply to a game" picker is open (null = closed).
  const [applyTemplate, setApplyTemplate] = useState<RepTeamLineupTemplate | null>(null);
  const [applyBusyGameId, setApplyBusyGameId] = useState<string | null>(null);
  // Nav-hide + body-scroll-lock while the apply-template picker is open (Coach Portal Batch 1,
  // Phase 1.2-1.6 sweep) — this page had no scroll lock at all before; the hook adds one.
  useOverlayOpen(!!applyTemplate);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events${seasonQuery}`);
      if (!res.ok) throw new Error('Games could not be loaded');
      const data: { events?: RepTeamEvent[]; lineupSetEventIds?: string[] } = await res.json();
      const games = (data.events ?? []).filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled');
      // Compute the split here (not during render) so we never call Date.now() in the render body.
      const now = Date.now();
      const isUpcoming = (e: RepTeamEvent) => new Date(e.startsAt).getTime() >= now && e.status === 'scheduled';
      setUpcoming(games.filter(isUpcoming).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
      setRecent(games.filter(e => !isUpcoming(e)).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()).slice(0, 6));
      if (data.lineupSetEventIds) {
        // Field present ⇒ the server let us see lineups; membership is definitive per game.
        const setIds = new Set(data.lineupSetEventIds);
        setReady(Object.fromEntries(games.map(g => [g.id, setIds.has(g.id)])));
      } else {
        // Field omitted ⇒ lineup visibility denied server-side (stale client capabilities) —
        // show no readiness badges rather than asserting a false "Not set" on every game.
        setReady({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Games could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates${seasonQuery}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setTemplatesError('Templates couldn’t be loaded — refresh to try again.');
    } finally {
      setTemplatesLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  // Wait for the assignments context to resolve before deciding whether to fetch — otherwise the
  // fail-open `canLineups` default would fire the fetch for an assistant whose access is revoked.
  useEffect(() => {
    if (ctxLoading || !canLineups) return;
    void Promise.resolve().then(load);
    void Promise.resolve().then(loadTemplates);
  }, [ctxLoading, canLineups, load, loadTemplates]);

  function switchTab(next: 'games' | 'templates') {
    setTab(next);
    // A pane switch is a context switch: close any in-progress rename and clear the pane-scoped
    // notice so Templates feedback doesn't hang over the Games list.
    setRenamingId(null);
    setNotice('');
    // Keep the URL shareable without triggering a navigation.
    try {
      const url = new URL(window.location.href);
      if (next === 'templates') url.searchParams.set('tab', 'templates');
      else url.searchParams.delete('tab');
      window.history.replaceState(null, '', url.toString());
    } catch { /* ignore */ }
  }

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
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${game.id}/lineup${seasonQuery}`);
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
  if (!page.hasAccess) {
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
          <h1 className={styles.pageTitle}>Lineups<CoachSeasonChip season={page.season} teamBase={page.teamBase} /></h1>
          <p className={styles.pageSub}>Build game lineups and reusable templates for your team.</p>
        </div>
      </div>
      <HelpButton iconOnly label="Lineups" help={helpRequest} />
    </div>
  );

  if (!canLineups) {
    return (
      <div className={styles.page}>
        {header}
        {/* No-action empty → the quiet variant. Still teaches what lineups do, so a coach knows
            what they'd be asking for rather than just being told "no". */}
        <CoachEmptyState
          quiet
          icon={<ListOrdered size={20} aria-hidden />}
          headline="Lineups aren't turned on for you"
          description={`A lineup sets your playing order and field positions for one game, ${periodWord} by ${periodWord}.`}
          payoff="Whoever builds them here feeds the game sheet, attendance, and the playing-time report in Insights — so the team's numbers stay in one place."
          blocker="Ask your head coach to turn on lineup access for you."
        />
      </div>
    );
  }

  // ── Games-tab filtering (design log 2026-07-08: scope chips + one "Needs lineup" toggle) ──
  const allGames = [...upcoming, ...recent];
  const typeChips = TYPE_CHIPS.filter(c => allGames.some(e => e.eventType === c.key));
  const inScope = (e: RepTeamEvent) => filterType === 'all' || e.eventType === filterType;
  // needsTotal decides whether the toggle exists at all; needsInScope is the count it shows.
  const needsTotal = allGames.filter(e => ready[e.id] === false).length;
  const needsInScope = allGames.filter(e => inScope(e) && ready[e.id] === false).length;
  const matchesFilters = (e: RepTeamEvent) => inScope(e) && (!needsOnly || ready[e.id] === false);
  const upcomingShown = upcoming.filter(matchesFilters);
  const recentShown = recent.filter(matchesFilters);
  // The Games pane's single lime action: the nearest visible upcoming game without a lineup (no
  // qualifying game → no lime on this pane; lime is earned).
  const primaryGameId = upcomingShown.find(e => ready[e.id] === false)?.id ?? null;

  const renderRow = (e: RepTeamEvent, action: string) => {
    const r = ready[e.id];
    const isPrimary = e.id === primaryGameId;
    // Game-Day Mode entry (P1): inside a game's live window the row gains a sibling `Game day`
    // link (the row itself keeps one destination — the builder). Absent outside the window and
    // in an archived season: the console is a live-season instrument.
    const gameDayHref = page.isReadOnly ? null : gameDayEntryHref(orgSlug, teamId, e, gameDayNowMs);
    const row = (
      <Link key={e.id} href={`${base}/lineups/${e.id}${seasonQuery}`} className={styles.lineupFrontRow}>
        <span className={styles.lineupFrontDate}>
          <span className={styles.lineupFrontDay}>{new Date(e.startsAt).getDate()}</span>
          <span className={styles.lineupFrontMonth}>{new Date(e.startsAt).toLocaleDateString('en-CA', { month: 'short' })}</span>
        </span>
        <span className={styles.lineupFrontMain}>
          <span className={styles.lineupFrontTitle}>{gameTitle(e)}</span>
          <span className={styles.lineupFrontMeta}>{formatWeekday(e.startsAt)} · {formatTime(e.startsAt)}</span>
        </span>
        {r === true && <span className={styles.lineupFrontChip} data-tone="ok"><CheckCircle2 size={13} aria-hidden /> Lineup set</span>}
        {r === false && <span className={styles.lineupFrontChip} data-tone="warn"><TriangleAlert size={13} aria-hidden /> Not set</span>}
        {isPrimary ? (
          <span className={`btn btn-lime btn-sm ${styles.lineupFrontPrimary}`}>Build lineup <ArrowRight size={14} aria-hidden /></span>
        ) : (
          <span className={styles.lineupFrontAction}>
            {action}
            <ArrowRight size={14} aria-hidden />
          </span>
        )}
      </Link>
    );
    if (!gameDayHref) return row;
    return (
      <div key={e.id} className={styles.eventChipRow}>
        {row}
        <Link href={gameDayHref} className={styles.gdEntryBtn}>Game day</Link>
      </div>
    );
  };

  const noGames = !loading && !error && upcoming.length === 0 && recent.length === 0;
  const noMatches = !loading && !error && !noGames && upcomingShown.length === 0 && recentShown.length === 0;
  const pickerGames = allGames;

  return (
    <div className={styles.page}>
      {header}

      {notice && <p className={styles.lineupNotice} style={{ marginBottom: '1rem' }}>{notice}</p>}

      {/* ── Games | Templates tabs (Roster list⇄depth segmented idiom) ── */}
      <div className={`${styles.segChoice} ${styles.lineupTabs}`} role="group" aria-label="Lineups sections" style={{ marginBottom: '1.15rem' }}>
        <button
          type="button"
          aria-pressed={tab === 'games'}
          className={`${styles.segBtn} ${tab === 'games' ? styles.segBtnActive : ''}`}
          onClick={() => switchTab('games')}
        >
          Games
        </button>
        <button
          type="button"
          aria-pressed={tab === 'templates'}
          className={`${styles.segBtn} ${tab === 'templates' ? styles.segBtnActive : ''}`}
          onClick={() => switchTab('templates')}
        >
          Templates
        </button>
      </div>

      {/* ── Games tab ── */}
      {tab === 'games' && (loading ? (
        <div className={styles.loadingState}>Loading games…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noGames ? (
        <CoachEmptyState
          icon={<CalendarPlus size={22} aria-hidden />}
          eyebrow="Lineups"
          headline="Set who plays where, once"
          description={`A lineup is your playing order and field positions for a single game, ${periodWord} by ${periodWord} — build it in advance, then reuse it as a template all season.`}
          payoff="Your game sheet and attendance fill in from it instead of asking you again, and Insights uses it to answer whether playing time has been fair across the season."
          blocker={canAddGames
            ? 'A lineup attaches to a real game, so add one to your schedule first.'
            : 'A lineup attaches to a real game, and none are on the schedule yet. Adding games needs schedule access — ask your head coach.'}
          primaryAction={canAddGames
            ? { label: 'Add a game', icon: <CalendarPlus size={15} aria-hidden />, href: `${base}/schedule` }
            : undefined}
          secondaryAction={{ label: 'How lineups work', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
        />
      ) : (
        <>
          <div className={styles.lineupFilterBar} role="group" aria-label="Filter games">
            <button
              type="button"
              aria-pressed={filterType === 'all'}
              className={`${styles.lineupFilterChip} ${filterType === 'all' ? styles.lineupFilterChipActive : ''}`}
              onClick={() => setFilterType('all')}
            >
              {filterType === 'all' && <Check size={12} aria-hidden />} All
            </button>
            {typeChips.map(c => (
              <button
                key={c.key}
                type="button"
                aria-pressed={filterType === c.key}
                className={`${styles.lineupFilterChip} ${filterType === c.key ? styles.lineupFilterChipActive : ''}`}
                onClick={() => setFilterType(c.key)}
              >
                {filterType === c.key && <Check size={12} aria-hidden />} {c.label}
              </button>
            ))}
            {/* Stays mounted while toggled on even at zero — otherwise saving the last missing
                lineup would unmount the only control that can turn the filter back off. */}
            {(needsTotal > 0 || needsOnly) && (
              <button
                type="button"
                aria-pressed={needsOnly}
                className={`${styles.lineupFilterChip} ${styles.lineupFilterNeeds} ${needsOnly ? styles.lineupFilterNeedsActive : ''}`}
                onClick={() => setNeedsOnly(v => !v)}
              >
                <TriangleAlert size={12} aria-hidden /> Needs lineup <b className={styles.lineupFilterCount}>{needsInScope}</b>
              </button>
            )}
          </div>

          {upcomingShown.length > 0 && (
            <section aria-labelledby="lineups-upcoming">
              <p className={styles.sectionKicker} id="lineups-upcoming">Upcoming games</p>
              <div className={styles.lineupFrontList}>
                {upcomingShown.map(e => renderRow(e, 'Build lineup'))}
              </div>
            </section>
          )}
          {recentShown.length > 0 && (
            <section aria-labelledby="lineups-recent">
              <p className={styles.sectionKicker} id="lineups-recent">Recent games</p>
              <div className={styles.lineupFrontList}>
                {recentShown.map(e => renderRow(e, 'Open lineup'))}
              </div>
            </section>
          )}
          {noMatches && (
            <p className={styles.lineupFilterNoMatch}>
              {needsOnly ? 'All caught up — every game here has a lineup.' : 'No games match this filter.'}
            </p>
          )}

          {/* Season read-outs live in the Insights hub (2026-07-08 consolidation). */}
          <p className={styles.lineupInsightsLink}>
            <Link href={`${base}/history`}>Season insights <ArrowRight size={13} aria-hidden /></Link>
          </p>
        </>
      ))}

      {/* ── Templates tab ── */}
      {tab === 'templates' && (
        <section aria-label="Templates">
          {templatesLoading ? (
            <div className={styles.loadingState}>Loading templates…</div>
          ) : templatesError ? (
            <p className={styles.errorText}>{templatesError}</p>
          ) : templates.length === 0 ? (
            <CoachEmptyState
              compact
              icon={<ClipboardCheck size={20} aria-hidden />}
              headline="No templates yet"
              description="A template is a reusable “base” lineup with no game attached — your usual order, a rain-day rotation, the arrangement you run at tournaments."
              payoff="Apply one to any game in a tap and it maps onto that game’s current roster, quietly skipping anyone who has left the team — so you’re not rebuilding the same lineup every week."
              primaryAction={canBuildLineups ? { label: 'New template', icon: <Plus size={15} aria-hidden />, href: `${base}/lineups/templates/new` } : undefined}
              secondaryAction={{ label: 'How templates work', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
            />
          ) : (
            <>
              <div className={styles.lineupTplHeader}>
                <p className={styles.lineupTplHint}>Reusable “base” lineups you can apply to any game.</p>
                {canBuildLineups && (
                  <Link href={`${base}/lineups/templates/new`} className="btn btn-lime btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Plus size={15} /> New template
                  </Link>
                )}
              </div>
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
            </>
          )}
        </section>
      )}

      {/* ── Apply-to-game picker ── */}
      {applyTemplate && (
        <div className={`${styles.modalOverlay} ${styles.sheetOnMobile}`} onClick={() => applyBusyGameId ? null : setApplyTemplate(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title={<>Apply &ldquo;{applyTemplate.name}&rdquo; to&hellip;</>} onClose={() => setApplyTemplate(null)} closeIconSize={18} closeAriaLabel="Close" />
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
                    <span className={styles.lineupFrontMeta}>{formatWeekday(g.startsAt)} · {formatTime(g.startsAt)}</span>
                  </span>
                  {ready[g.id] === true && <span className={styles.lineupFrontChip} data-tone="ok"><CheckCircle2 size={13} aria-hidden /> Has lineup</span>}
                  <span className={styles.lineupFrontAction}>
                    {applyBusyGameId === g.id ? 'Applying…' : 'Apply'}
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
