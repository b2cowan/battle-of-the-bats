'use client';
/**
 * Results & scoring — Tournament admin redesign Stage 1 (G4 · G5 · G6), built to hub v5, ruled
 * 2026-09-29.
 *
 * It opens on "Needs you" — waiting and unscored games, EVERY division — with "All games" one tap
 * away (A10). The toolbar is the schedule's one line (the Teams toolbar ruling, owner 2026-10-01, applied here
 * 2026-10-17): the lens · Search · Filter (Division · Stage) — no Tools, since Results has nothing rare to put there.
 * The list is `ResultsList` (one frame, banded; each row opens its score editor in place).
 * It stays current by itself (G6): every 30 s while the page is visible, the same way the board does,
 * and never while an editor or a confirm is open — a refresh never moves a game out
 * from under the organizer. A link with `?gameId=` (the board's rows, a notification) opens THAT game's
 * editor, once per id; `?view=all` opens on All games.
 *
 * A coin toss still owed (Stage 3, S7) opens Needs you as the bracket's note; Record the toss opens the same recorder
 * as the schedule's Bracket view and the dashboard.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, Trophy } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { usePageTitle } from '@/lib/usePageTitle';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import { hasPlanFeature } from '@/lib/plan-features';
import { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { Game, Team, Division, Venue } from '@/lib/types';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import { formatScoreSubmittedAt, scoreSubmissionSourceLabel } from '@/lib/tournament-score-audit';
import { TournamentAdminHeader } from '@/components/admin/tournament/TournamentAdminUI';
import { tournamentToday } from '@/lib/timezone';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll';
import s from '../../admin-common.module.css';
import styles from './results-admin.module.css';
import { emitScorePublished, sendScoreAction, type ScoreAction } from './score-actions';
import ResultsList, { ALL_BANDS, NEEDS_YOU_BANDS, bandFor, gameStateWord, type ResultsBand } from './ResultsList';
import { pendingCoinTosses, type PendingToss } from '@/lib/coin-toss';
import { SCHEDULE_DAY_WORDS as SW } from '@/lib/schedule-words';
import type { ScheduleStage } from '@/lib/schedule-day';
import { hasPlayoffs, hasRoundRobin } from '@/lib/tournament-phase';
import CoinTossRecorder, { CoinTossNote } from '@/components/admin/CoinTossRecorder';
import FilterMenu, { FilterLine, pickedLabels, type FilterGroupDef } from '@/components/admin/tournament/FilterMenu';
import ScheduleToolbar from '../schedule/components/ScheduleToolbar';
import LoadingState from '@/components/shared/LoadingState';
import ViewPills from '@/components/shared/ViewPills';

// ── Export column definitions ─────────────────────────────────────────────
// Admin-only export includes score submission audit metadata for review.
const RESULTS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',       key: 'date'      },
  { label: 'Time',       key: 'time'      },
  { label: 'Division',   key: 'division'  },
  { label: 'Home Team',  key: 'homeTeam'  },
  { label: 'Home Score', key: 'homeScore' },
  { label: 'Away Team',  key: 'awayTeam'  },
  { label: 'Away Score', key: 'awayScore' },
  { label: 'Status',     key: 'status'    },
  { label: 'Submitted By', key: 'submittedBy' },
  { label: 'Submitted At', key: 'submittedAt' },
  { label: 'Submission Source', key: 'submissionSource' },
];

/**
 * What the PDF prints — the same report on a diet (PDF Export Quality decision 5, owner
 * 2026-08-21, built in the Phase 2 Registers pass).
 *
 * ⚠ THE THREE AUDIT COLUMNS ARE GONE FROM PAPER FOR GOOD. Who submitted a score, when, and
 * through which door is working data an admin reconciles a dispute with — it belongs in a
 * spreadsheet, and `RESULTS_EXPORT_COLS` above still carries all three into xlsx and csv.
 *
 * ⚠ WITH THE DIET THIS IS A FIXED-COLUMN REPORT, so the standing rule applies: it must fit by
 * construction, and the fit contract's "didn't fit this page" line appearing on it is a BUG,
 * not a shrug. Adding a column here means re-proving that on rendered paper.
 */
const RESULTS_AUDIT_KEYS = new Set(['submittedBy', 'submittedAt', 'submissionSource']);
const RESULTS_PDF_COLS: ExportColumnDef[] = RESULTS_EXPORT_COLS.filter(c => !RESULTS_AUDIT_KEYS.has(c.key));

type Lens = 'needs' | 'all';
/** The Filter's ticks — the schedule's Division and Stage groups; an empty group narrows nothing. */
type ResultsFilter = { divisions: string[]; stages: ScheduleStage[] };
const NO_FILTER: ResultsFilter = { divisions: [], stages: [] };

export default function AdminResultsPage() {
  const { currentTournament, loading: tournamentLoading } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Results & scoring');
  // Finalizing a pending score and changing a final one are the same power (the games route enforces it).
  const canFinalize = !!userRole && hasCapability(userRole, userCapabilities, 'seal_tournaments');
  const tournamentId = currentTournament?.id;
  const orgSlug = currentOrg?.slug;
  const searchParams = useSearchParams();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  /** When the list last read the games — the clock the bands (overdue / live / to come) are judged by. */
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [lens, setLens] = useState<Lens>(() => (searchParams.get('view') === 'all' ? 'all' : 'needs'));
  const [filter, setFilter] = useState<ResultsFilter>(NO_FILTER);
  const [searchQuery, setSearchQuery] = useState('');
  const [openGameId, setOpenGameId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [tossOpen, setTossOpen] = useState<PendingToss | null>(null);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const loadSeqRef = useRef(0);
  /** The tournament whose divisions and venues are on screen — a refresh skips them once they are. */
  const setupForRef = useRef<string | null>(null);

  // PDF settings — fetched once; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  /** Reads the games. `silent` (the 30 s refresh, and after a save) keeps the list on screen instead of
   *  swapping it for the loading line, and reads only what changes on game day — the games and the
   *  teams (a no-show); the divisions and venues are read once per tournament. */
  const load = useCallback(async (silent: boolean) => {
    if (tournamentLoading) return;
    // Only the newest read may paint: a slow refresh that lands after a newer one, after a tournament
    // switch, or after a score was written (`patchGame` bumps this too) is dropped.
    const seq = ++loadSeqRef.current;
    const current = () => seq === loadSeqRef.current;
    if (!tournamentId) {
      setGames([]);
      setTeams([]);
      setDivisions([]);
      setVenues([]);
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const withSetup = !silent || setupForRef.current !== tournamentId;
      const q = `?tournamentId=${encodeURIComponent(tournamentId)}${orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : ''}`;
      const [gamesRes, teamsRes, groupsRes, venuesRes] = await Promise.all([
        fetch(`/api/admin/games${q}`),
        fetch(`/api/admin/teams${q}`),
        withSetup ? fetch(`/api/admin/divisions${q}`) : null,
        withSetup ? fetch(`/api/admin/venues${q}`) : null,
      ]);
      if (!current()) return;
      // A silent refresh that fails keeps what is on screen; the next tick tries again.
      if (silent && !gamesRes.ok) return;
      const allGames = gamesRes.ok ? await gamesRes.json() : [];
      const allTeams = teamsRes.ok ? await teamsRes.json() : [];
      const groups = groupsRes?.ok ? await groupsRes.json() : [];
      const allVenues = venuesRes?.ok ? await venuesRes.json() : [];
      if (!current()) return;
      setGames(allGames);
      setTeams(allTeams.filter((t: Team) => t.status === 'accepted'));
      if (groupsRes) setDivisions(groups);
      if (venuesRes) setVenues(allVenues);
      if (withSetup) setupForRef.current = tournamentId;
      setNowMs(Date.now());
    } catch {
      /* a failed silent refresh keeps the list; a failed first read shows the empty state */
    } finally {
      // The read that paints ends the loading line (a silent one too, when it overtook the first read).
      if (current()) setLoading(false);
    }
  }, [tournamentId, tournamentLoading, orgSlug]);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // G6 · game day stays current — never while the organizer is in something (an editor, the view sheet,
  // a confirm): a refresh would move that game between bands under their thumb.
  useVisiblePoll(refresh, {
    enabled: Boolean(tournamentId),
    paused: openGameId !== null || finalizingId !== null || feedback.isOpen || tossOpen !== null,
  });

  useEffect(() => {
    // D4: server-resolved — org-name header fallback + the org's uploaded logo, print-ready.
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}&resolve=1` : '?resolve=1';
    void fetchResolvedPdfSettings(`/api/admin/org/pdf-settings${orgQuery}`).then(setPdfSettings);
  }, [orgSlug]);

  // A new tournament starts on the opening view (reset while rendering, React's pattern for state that
  // follows a prop — no effect, so no extra render with the old tournament's filters).
  const [viewFor, setViewFor] = useState(tournamentId);
  if (viewFor !== tournamentId) {
    setViewFor(tournamentId);
    setLens('needs');
    setFilter(NO_FILTER);
    setSearchQuery('');
    setOpenGameId(null);
  }

  const today = tournamentToday();
  /** Each game's band, judged once per read (the clock math is not free) — not once per count, per list
   *  and per keystroke in the search. */
  const bandById = useMemo(() => {
    const m = new Map<string, ResultsBand | null>();
    for (const g of games) m.set(g.id, bandFor(g, divisions, currentTournament, nowMs, today));
    return m;
  }, [games, divisions, currentTournament, nowMs, today]);
  const bandOf = useCallback((g: Game) => bandById.get(g.id) ?? null, [bandById]);
  // A coin toss still owed: the standings engine's flags, the one reading the bracket and the dashboard use.
  const tosses = useMemo(
    () => pendingCoinTosses({ divisions, teams, games, settings: currentTournament?.settings }),
    [divisions, teams, games, currentTournament?.settings],
  );

  // G3 · a game opens that game: `?gameId=` (the board's rows, a notification) opens its score editor,
  // once per id (ref-guarded, so the refresh never fights the organizer's later choices). The filters
  // widen to hold it, and All games is chosen when its band is not one of Needs you's.
  const focusGameId = searchParams.get('gameId');
  const focusedRef = useRef<string | null>(null);
  const scrollToOpenRef = useRef(false);
  useEffect(() => {
    if (!focusGameId || focusedRef.current === focusGameId) return;
    const target = games.find(g => g.id === focusGameId);
    if (!target) return; // wait until the games have loaded
    focusedRef.current = focusGameId;
    const band = bandOf(target);
    if (!band) return; // a cancelled game has no editor
    if (!NEEDS_YOU_BANDS.includes(band)) setLens('all');
    setFilter(NO_FILTER);
    setSearchQuery('');
    scrollToOpenRef.current = true;
    setOpenGameId(focusGameId);
  }, [focusGameId, games, bandOf]);
  useEffect(() => {
    if (!openGameId || !scrollToOpenRef.current) return;
    scrollToOpenRef.current = false;
    const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(openGameId) : openGameId;
    document.querySelector(`[data-game-id="${sel}"]`)?.scrollIntoView({ block: 'center' });
  }, [openGameId]);

  function getTeamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'TBD';
  }

  function getGroupName(id: string) {
    return divisions.find(g => g.id === id)?.name ?? '—';
  }

  async function patchGame(body: ScoreAction) {
    loadSeqRef.current++; // a read already in flight predates this write — it must not paint
    await sendScoreAction(orgSlug, body);
  }

  const published = (id: string) => emitScorePublished({
    gameId: id, orgSlug: orgSlug ?? '', tournamentSlug: currentTournament?.slug ?? '', isDraft: currentTournament?.status === 'draft',
  });

  async function handleSaveScore(id: string, homeScore: number, awayScore: number) {
    await patchGame({ action: 'submit-score', id, homeScore, awayScore });
    void refresh();
  }

  async function handleForfeit(id: string, winningSide: 'home' | 'away') {
    await patchGame({ action: 'forfeit', id, winningSide });
    published(id);
    void refresh();
  }

  async function handleFinalize(id: string) {
    await patchGame({ action: 'finalize', id });
    published(id);
    void refresh();
  }

  /** The row's Finalize: the same action, with its own failure line (there is no editor to hold one). */
  async function finalizeFromRow(id: string) {
    setFinalizingId(id);
    try {
      await handleFinalize(id);
    } catch (err) {
      setFeedback({ isOpen: true, title: 'Finalize failed', message: err instanceof Error ? err.message : 'Finalize failed — please try again.', type: 'danger' });
    } finally {
      setFinalizingId(null);
    }
  }

  function markScheduled(id: string) {
    setFeedback({
      isOpen: true,
      title: 'Revert score?',
      message: 'This will clear the score and mark the game as scheduled. This action cannot be undone.',
      type: 'warning',
      onConfirm: async () => {
        await patchGame({ action: 'revert-score', id });
        setOpenGameId(null);
        void refresh();
      },
    });
  }

  // Division, stage and search narrow the games; the lens picks the bands.
  const q = searchQuery.trim().toLowerCase();
  const searched = q ? games.filter(g => {
    const names = [getTeamName(g.homeTeamId), getTeamName(g.awayTeamId), g.homePlaceholder ?? '', g.awayPlaceholder ?? ''];
    return names.some(n => n.toLowerCase().includes(q));
  }) : games;
  const stageOf = (g: Game): ScheduleStage => (g.isPlayoff ? 'playoff' : 'pool');
  const narrowed = searched.filter(g =>
    (filter.divisions.length === 0 || filter.divisions.includes(g.divisionId))
    && (filter.stages.length === 0 || filter.stages.includes(stageOf(g))));
  const needsCount = narrowed.filter(g => { const b = bandOf(g); return b != null && NEEDS_YOU_BANDS.includes(b); }).length;
  const allCount = narrowed.filter(g => bandOf(g) != null).length;
  const bands = lens === 'needs' ? NEEDS_YOU_BANDS : ALL_BANDS;
  const inLens = (g: Game) => { const b = bandOf(g); return b != null && bands.includes(b); };
  const listed = narrowed.filter(inLens);
  const narrowing = Boolean(filter.divisions.length || filter.stages.length || q);

  // The Filter: the schedule's Division and Stage groups, counted over what the lens reads (the schedule counts over
  // its view). A group with one choice is absent — one division, or an event with only one stage.
  const countBase = searched.filter(inLens);
  const countBy = (pick: (g: Game) => string) => countBase.reduce((m, g) => m.set(pick(g), (m.get(pick(g)) ?? 0) + 1), new Map<string, number>());
  const divisionCounts = countBy(g => g.divisionId);
  const stageCounts = countBy(stageOf);
  const toggle = <K extends keyof ResultsFilter>(group: K, key: string) => setFilter(prev => {
    const list = prev[group] as readonly string[];
    return { ...prev, [group]: list.includes(key) ? list.filter(k => k !== key) : [...list, key] };
  });
  const filterGroups: FilterGroupDef[] = [
    {
      key: 'division', label: SW.groups.division, selected: filter.divisions, onToggle: k => toggle('divisions', k),
      options: divisions.length > 1 ? divisions.map(d => ({ key: d.id, label: d.name, count: divisionCounts.get(d.id) ?? 0 })) : [],
    },
    {
      key: 'stage', label: SW.groups.stage, selected: filter.stages, onToggle: k => toggle('stages', k),
      options: hasRoundRobin(currentTournament ?? undefined) && hasPlayoffs(currentTournament ?? undefined)
        ? (['pool', 'playoff'] as const).map(st => ({ key: st, label: SW.stages[st], count: stageCounts.get(st) ?? 0 }))
        : [],
    },
  ];

  // ── Export handlers ────────────────────────────────────────────────────
  // The export takes what the screen lists; its Status column says each game's one word (G5).
  function buildResultsRows() {
    return listed.map(g => ({
      date:      g.date ?? '',
      time:      formatTime(g.time),
      division:  getGroupName(g.divisionId),
      homeTeam:  getTeamName(g.homeTeamId),
      homeScore: g.homeScore != null ? g.homeScore : '',
      awayTeam:  getTeamName(g.awayTeamId),
      awayScore: g.awayScore != null ? g.awayScore : '',
      status:    gameStateWord(g, bandOf(g)),
      submittedBy: g.scoreSubmittedByEmail ?? '',
      submittedAt: formatScoreSubmittedAt(g.scoreSubmittedAt),
      submissionSource: g.scoreSubmissionSource ? scoreSubmissionSourceLabel(g.scoreSubmissionSource) : '',
    }));
  }

  async function handleExportXLSX() {
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug, dataset: 'results', scope: String(currentTournament?.year ?? '') }, 'xlsx'),
      serializeHeaders(RESULTS_EXPORT_COLS),
      serializeRows(buildResultsRows(), RESULTS_EXPORT_COLS),
      'Results',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(RESULTS_EXPORT_COLS);
    const rows    = serializeRows(buildResultsRows(), RESULTS_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug, dataset: 'results', scope: String(currentTournament?.year ?? '') }, 'csv'),
      generateCSV(headers, rows),
    );
  }

  async function handleExportPDF() {
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };

    // One table per division: every listed-stage game that is not cancelled.
    const allFiltered = games.filter(g => {
      const matchesStage = filter.stages.length === 0 || filter.stages.includes(stageOf(g));
      return matchesStage && g.status !== 'cancelled';
    });

    const groupMap = new Map<string, typeof allFiltered>();
    for (const ag of divisions) {
      const divGames = allFiltered.filter(g => g.divisionId === ag.id);
      if (divGames.length > 0) groupMap.set(ag.id, divGames);
    }

    const headers = serializeHeaders(RESULTS_PDF_COLS);

    // Champions callout: find winner of the last completed game per division
    const champLines: string[] = [];
    for (const ag of divisions) {
      const divGames = (groupMap.get(ag.id) ?? []).filter(g => g.status === 'completed' || g.status === 'forfeit');
      if (divGames.length === 0) continue;
      const last = divGames[divGames.length - 1];
      if (last.homeScore != null && last.awayScore != null) {
        const winner = last.homeScore > last.awayScore
          ? getTeamName(last.homeTeamId)
          : last.awayScore > last.homeScore
            ? getTeamName(last.awayTeamId)
            : null;
        if (winner) champLines.push(`${ag.name}: ${winner}`);
      }
    }
    const subtitle = champLines.length > 0
      ? `Champions — ${champLines.join('  ·  ')}`
      : currentTournament?.name;

    const groups = divisions
      .filter(ag => groupMap.has(ag.id))
      .map(ag => ({
        label: ag.name,
        rows: (groupMap.get(ag.id) ?? []).map(g => [
          g.date ?? '',
          formatTime(g.time),
          getGroupName(g.divisionId),
          getTeamName(g.homeTeamId),
          g.homeScore != null ? g.homeScore : '—',
          getTeamName(g.awayTeamId),
          g.awayScore != null ? g.awayScore : '—',
          gameStateWord(g, bandOf(g)),
        ]),
      }));

    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'results', scope: String(currentTournament?.year ?? '') },
      'pdf',
    );

    // Flat fallback if no groups resolved — the SAME diet, or the two shapes of this one
    // document would disagree about what the PDF contains.
    const flatRows = serializeRows(buildResultsRows(), RESULTS_PDF_COLS);

    await downloadPDF(
      filename,
      'Tournament results',
      subtitle,
      headers,
      flatRows,
      settings,
      {
        groups: groups.length > 0 ? groups : undefined,
        identity: currentOrg?.name,
        // 8 columns after the audit diet: landscape is the report's own shape (D2), and at
        // that width every column clears its legible floor with room to spare — which is what
        // makes the "didn't fit" line a bug here rather than a possibility.
        shape: { orientation: 'landscape' },
      },
    );
  }

  // The lens — the one view pill with its count (Toolbar Rules, Rule 6: this lens was its drawing). Single choice;
  // the chosen one wears the kit's olive.
  const lensPills = (
    <ViewPills
      label="Which games"
      views={[
        { id: 'needs', label: GAME_DAY_WORDS.lensNeedsYou, count: needsCount },
        { id: 'all', label: GAME_DAY_WORDS.lensAllGames, count: allCount },
      ]}
      value={lens}
      onChange={next => { setLens(next); setOpenGameId(null); }}
    />
  );
  // The toss note opens Needs you — the bracket's note, named by its division when the screen shows more than one.
  // It is the toss's only signal here: the Filter's rows are plain ticks (the division picker's amber count left with
  // the picker, 2026-10-17).
  const tossNotes = lens === 'needs' && tosses.length > 0 ? (
    <div className={styles.tossNotes}>
      {tosses.filter(t => filter.divisions.length === 0 || filter.divisions.includes(t.divisionId)).map(t => (
        <CoinTossNote key={t.groupKey} toss={t} named={divisions.length > 1} flush onRecord={setTossOpen} />
      ))}
    </div>
  ) : null;

  return (
    <div className={`${s.page} ${s.pageWide}`}>
      <TournamentAdminHeader
        title="Results & scoring"
        help={{
          module: 'tournaments',
          sectionIds: ['scores-and-results', 'recipe-finalize-tournament-scores'],
          label: 'Results',
          fullGuideHref: currentOrg ? `/${currentOrg.slug}/admin/help/tournaments#scores-and-results` : undefined,
        }}
        actions={(
          <>
            <ExportMenu
              formats={['xlsx', 'csv', 'pdf']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              planId={currentOrg?.planId}
              disabled={listed.length === 0}
              // PDFs on a plan without them: the Tools-menu lock, no sentence under it (specimen 8, the free tournament tier).
              planLock={currentOrg && !hasPlanFeature(currentOrg.planId, 'pdf_exports') ? { href: tournamentPlusPanelHref(currentOrg), rows: 'pdf' } : undefined}
            />
            {currentOrg?.slug && (
              <button
                type="button"
                className={`btn btn-ghost btn-data ${styles.headerIconButton}`}
                onClick={() => window.open(`/${currentOrg!.slug}/scorekeeper`, '_blank', 'noopener,noreferrer')}
                title="Open scorekeeper view"
                aria-label="Open scorekeeper view"
              >
                <ExternalLink size={14} aria-hidden />
                <span className={styles.headerButtonLabel}>Scorekeeper</span>
              </button>
            )}
          </>
        )}
      />

      {/* ── The schedule's one toolbar line (the Teams toolbar ruling, 1 October): the lens · Search · Filter ── */}
      {currentTournament && games.length > 0 && (
        <ScheduleToolbar
          viewPill={lensPills}
          search={searchQuery}
          onSearch={setSearchQuery}
          searchLabel={SW.search}
          // One division and one stage: nothing to filter, so no Filter (absent, never an empty menu).
          filter={filterGroups.some(g => g.options.length > 0) && (
            <FilterMenu
              groups={filterGroups}
              label={SW.filter}
              onLabel={SW.filtersOn}
              resetLabel={SW.resetFilters}
              onReset={() => setFilter(NO_FILTER)}
              align="end"
            />
          )}
          filterLine={<FilterLine picks={pickedLabels(filterGroups)} label={SW.filter} />}
          tools={null}
        />
      )}

      {!loading && currentTournament && games.length === 0 && (
        // No games exist yet → point the organizer to build the schedule first (J1-087). Say what
        // this page is for, and nothing about timing (F08 — "no refresh needed" is gone for good).
        <HelpCallout
          variant="info"
          title="No schedule built yet"
          body="There are no games to score yet. Build your schedule first — then you’ll enter scores here and check the ones your scorekeepers send in from the field."
          cta={currentOrg?.slug ? { label: 'Go to Schedule', href: `/${currentOrg.slug}/admin/tournaments/schedule?tournamentId=${currentTournament.id}` } : undefined}
        />
      )}

      {tournamentLoading || loading ? (
        <LoadingState label="Loading games…" />
      ) : !currentTournament ? (
        <div className="empty-state">
          <Trophy size={40} style={{ opacity: 0.2 }} />
          <p>No tournament selected.</p>
        </div>
      ) : games.length > 0 ? (
        <>
        {tossNotes}
        <ResultsList
          games={narrowed}
          bands={bands}
          bandOf={bandOf}
          teams={teams}
          divisions={divisions}
          venues={venues}
          today={today}
          openGameId={openGameId}
          onOpen={setOpenGameId}
          finalizingId={finalizingId}
          canFinalize={canFinalize}
          actions={{
            onSaveScore: handleSaveScore,
            onForfeit: handleForfeit,
            onFinalize: handleFinalize,
            onRevert: markScheduled,
            onRowFinalize: id => { void finalizeFromRow(id); },
          }}
          empty={
            <div className={styles.empty}>
              {narrowing ? (
                <>
                  <p>{q ? `No games match “${searchQuery}”.` : 'No games match these filters.'}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setFilter(NO_FILTER); setSearchQuery(''); }}>
                    Show all games
                  </button>
                </>
              ) : lens === 'needs' ? (
                <>
                  <p>{GAME_DAY_WORDS.needsYouEmpty}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setLens('all')}>
                    {GAME_DAY_WORDS.lensAllGames}
                  </button>
                </>
              ) : (
                <p>No games to show.</p>
              )}
            </div>
          }
        />
        </>
      ) : null}

      {tossOpen && (
        <CoinTossRecorder
          orgSlug={orgSlug ?? ''}
          toss={tossOpen}
          onClose={() => setTossOpen(null)}
          // Saved: the division's tie-breaker order and the bracket's seeds changed — read both again.
          onRecorded={() => { setTossOpen(null); setupForRef.current = null; void load(true); }}
        />
      )}

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))}
      />
    </div>
  );
}
