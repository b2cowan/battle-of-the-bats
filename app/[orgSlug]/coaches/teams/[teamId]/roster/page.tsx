'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Users, Plus, GripVertical, AlertTriangle, ChevronUp, ChevronDown, ClipboardPaste, HelpCircle, Upload, Phone } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import FeedbackModal from '@/components/FeedbackModal';
import PositionSelect from '@/components/coaches/PositionSelect';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import DepthChartBoard from '@/components/coaches/DepthChartBoard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachNotGranted from '@/components/coaches/CoachNotGranted';
import { hasRecordAccess } from '@/lib/coach-capabilities';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import RosterBulkAddSheet from '@/components/coaches/RosterBulkAddSheet';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { pitcherRankLabel } from '@/lib/lineup-profile';
import { cleanNamePart, playerName, telHref, isCallUp } from '@/lib/coach-roster-name';
import { playerTabHref } from '@/lib/coach-player-tabs';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
  ROSTER_WALL_HEADERS, rosterContactHeaders,
} from '@/lib/export';
import CoachExportButton from '@/components/coaches/CoachExportButton';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../coaches.module.css';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import type { RepRosterPlayer, RepProgramYear } from '@/lib/types';

// ── Export definition ─────────────────────────────────────────────────────────

const ROSTER_EXPORT_COLS: ExportColumnDef[] = [
  { label: '#',              key: 'playerNumber',      format: 'text' },
  { label: 'First Name',     key: 'playerFirstName',   format: 'text' },
  { label: 'Last Name',      key: 'playerLastName',    format: 'text' },
  { label: 'Primary Position', key: 'primaryPosition',  format: 'text' },
  { label: 'Secondary Position', key: 'secondaryPosition', format: 'text' },
  { label: 'Date of Birth',  key: 'playerDateOfBirth', format: 'date',     sensitive: true },
  { label: 'Guardian Name',  key: 'guardianName',      format: 'text',     sensitive: true },
  { label: 'Guardian Email', key: 'guardianEmail',     format: 'text',     sensitive: true },
  { label: 'Guardian Phone', key: 'guardianPhone',     format: 'text',     sensitive: true },
  { label: 'Status',         key: 'status',            format: 'text' },
  { label: 'Notes',          key: 'notes',             format: 'text',     sensitive: true },
];

interface AddForm {
  playerFirstName: string; playerLastName: string;
  playerDateOfBirth: string; playerNumber: string;
  // One position on this form — see the "Best Position" field. Further ranks, Never,
  // pitching and A-squad are set on the player's profile.
  primaryPosition: string;
  guardianFirstName: string; guardianLastName: string;
  guardianEmail: string; guardianPhone: string;
  notes: string;
}

const BLANK: AddForm = {
  playerFirstName: '', playerLastName: '', playerDateOfBirth: '',
  playerNumber: '', primaryPosition: '',
  guardianFirstName: '', guardianLastName: '',
  guardianEmail: '', guardianPhone: '', notes: '',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}


export default function RosterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const { openHelp } = useHelpDrawer();
  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const searchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  // Quick-add position dropdowns offer the sport's assignable FIELD positions (the ones auto-fill
  // uses) — not the OF catch-all or DH. PositionSelect keeps a "Custom…" escape for edge cases.
  const rosterPositions = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT).fieldPositions;

  // Depth chart is the second VIEW of Roster (?view=depth) rather than a separate page. The URL is
  // the single source of truth so the view is shareable + back-button friendly.
  const router = useRouter();
  const pathname = usePathname();
  const view = searchParams.get('view') === 'depth' ? 'depth' : 'list';
  const setView = (v: 'list' | 'depth') => {
    router.replace(v === 'depth' ? `${pathname}?view=depth` : pathname, { scroll: false });
  };

  const [players, setPlayers] = useState<RepRosterPlayer[]>([]);
  const [programYear, setProgramYear] = useState<RepProgramYear | null>(null);
  const [fetching, setFetching] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  useOverlayOpen(addOpen);
  // Bulk intake (Batch 2 P0 #7) — its own sheet; it registers with the overlay counter itself.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(BLANK);
  const [adding, setAdding] = useState(false);
  // Running count for "Save & add another", so a coach entering a few in a row can see progress
  // without the sheet closing between each one.
  const [addedInRun, setAddedInRun] = useState(0);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  /** Call-ups (mig 309): playerId → games they have been called up to, this season. */
  const [callUpGames, setCallUpGames] = useState<Record<string, number>>({});
  const [removingCallUpId, setRemovingCallUpId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  /**
   * ⚠ Sequence-tokened, and the reason is the EXPORTS (Rosters pass, /review finding). The coach
   * portal does NOT remount when the coach switches team — this page keeps its state across a
   * `[teamId]` change — so a slow response for the previous team could land after the new team's
   * and overwrite `players`. That used to be a transient on-screen glitch; it stops being one the
   * moment the roster can be exported, because "Roster with contacts" turns the wrong team's
   * children's birthdates and guardian emails into a downloaded file titled for THIS team.
   *
   * The pdf-settings effect below already guards its own fetch for exactly this reason (branding).
   * The roster itself — the part that carries the families — did not.
   */
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setFetching(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`);
      // A failure that isn't JSON (an HTML 404/error page, a gateway timeout) must not surface as a
      // raw parser message — parse defensively and let the status decide what the coach is told.
      const data = await res.json().catch(() => null);
      if (seq !== loadSeq.current) return;
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load roster');
      if (!data) throw new Error('Failed to load roster');
      setPlayers(data.players ?? []);
      setProgramYear(data.programYear ?? null);

      /* Call-up games-played (mig 309). A second, tiny request rather than folding the counts into
         the roster payload: the roster read is the busiest on this page and is shared by surfaces
         that have no call-up section at all. A failure here leaves the counts at zero and the
         section still renders — the names are the point, the counts are the extra.
         ⚠ ONLY when this roster actually holds one. The answer is already in the payload we just
         read, and for almost every team on almost every load it is "none" — an unconditional fetch
         spent six queries per roster load, per team switch, and on every return from the depth
         chart, to learn that. */
      try {
        if (!(data.players ?? []).some((p: RepRosterPlayer) => isCallUp(p))) return;
        const cuRes = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/call-ups`);
        if (cuRes.ok && seq === loadSeq.current) {
          const cu = await cuRes.json().catch(() => null);
          const counts: Record<string, number> = {};
          for (const row of cu?.callUps ?? []) counts[row.playerId] = row.gamesCalledUp ?? 0;
          setCallUpGames(counts);
        }
      } catch { /* counts are the extra, not the point */ }
    } catch (e: unknown) {
      if (seq !== loadSeq.current) return;
      showFeedback('danger', errorMessage(e, 'Failed to load.'));
    } finally {
      if (seq === loadSeq.current) setFetching(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { if (!assignmentsLoading) void Promise.resolve().then(load); }, [assignmentsLoading, load]);

  // Depth chart is a VIEW of this page. Close the Add drawer when entering it (so a half-open drawer
  // can't hang over the board), and refetch the list when returning FROM it so the roster's Positions
  // column reflects any edits made in the depth chart.
  const prevViewRef = useRef<'list' | 'depth'>(view);
  useEffect(() => {
    if (view === 'depth') setAddOpen(false);
    else if (prevViewRef.current === 'depth' && !assignmentsLoading) void load();
    prevViewRef.current = view;
  }, [view, assignmentsLoading, load]);

  useEffect(() => {
    // D4: team paper resolves its identity server-side — team look → club look → defaults,
    // with the TEAM's name as the header identity. Cleanup-guarded so a slow response for a
    // previous team can never land as this team's branding.
    let cancelled = false;
    void fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`)
      .then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  /**
   * Remove a call-up from the list (mig 309). Only reachable for one with no games — the button is
   * absent otherwise, and the server refuses it anyway, because after the first game their name is
   * on a saved lineup that must not change.
   */
  async function handleRemoveCallUp(player: RepRosterPlayer) {
    const firstName = cleanNamePart(player.playerFirstName) || 'this call-up';
    const ok = await confirm({
      title: `Remove ${firstName} from your call-ups?`,
      message: 'They have not played a game, so nothing is affected. You can call them up again any time.',
      confirmText: 'Remove',
      cancelText: 'Keep',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingCallUpId(player.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/call-ups?playerId=${encodeURIComponent(player.id)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Could not remove that call-up');
      }
      await load();
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Could not remove that call-up'));
    } finally {
      setRemovingCallUpId(null);
    }
  }

  async function handleToggleStatus(player: RepRosterPlayer) {
    const newStatus = player.status === 'active' ? 'inactive' : 'active';
    setTogglingId(player.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/${player.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setPlayers(prev => prev.map(p => p.id === player.id ? data.player : p));
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to update status.'));
    } finally {
      setTogglingId(null);
    }
  }

  // Persist a new player order (optimistic, reverts on failure). Shared by the
  // desktop drag handler and the mobile up/down move buttons.
  async function persistOrder(next: RepRosterPlayer[], prev: RepRosterPlayer[]) {
    setPlayers(next); // optimistic
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/reorder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: next.map(p => p.id) }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save the new order.');
      }
    } catch (e: unknown) {
      setPlayers(prev); // revert
      showFeedback('danger', errorMessage(e, 'Could not save the new order.'));
    }
  }

  /* ⚠⚠ REORDERING WORKS ON THE VISIBLE LIST, AND IS KEYED BY ID, NOT BY POSITION.
     Since 2026-08-26 the table renders only players who are ON the roster — the rest sit in the
     shelf beneath it — so an index into what the coach can see is NOT an index into `players`.
     Left position-keyed, the arrows would have moved the wrong player the moment a team had
     someone off the roster sorting above an active one, silently and with no error. This is the
     same positional-match trap that once rewrote a paid installment on Payables; the rule it
     earned is that a list which can be filtered must be addressed by id.
     The off-roster rows are appended to the write so every player still ends up with a
     deterministic order rather than a stale one left over from before they were removed.
     ⚠ Call-ups (mig 309) ride along here too — not because their order means anything (they are
     never in this table and never in a roster order), but because this write replaces the whole
     list and omitting them would blank their position. They keep whatever they had. */
  function withOffRosterAppended(nextActive: RepRosterPlayer[]) {
    return [...nextActive, ...players.filter(p => p.status !== 'active')];
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const shown = players.filter(p => p.status === 'active');
    const oldIndex = shown.findIndex(p => p.id === active.id);
    const newIndex = shown.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    await persistOrder(withOffRosterAppended(arrayMove(shown, oldIndex, newIndex)), players);
  }

  /* Up/down reorder. ⚠ CSS-hidden at every width since 2026-08-26 — desktop reorders by drag and
     a phone no longer reorders at all (owner call: a coach sets the order once, at a desk) — but
     kept correct rather than left to rot, because the put-back is one line of CSS. */
  async function movePlayer(playerId: string, dir: -1 | 1) {
    const shown = players.filter(p => p.status === 'active');
    const from = shown.findIndex(p => p.id === playerId);
    if (from < 0) return;
    const to = from + dir;
    if (to < 0 || to >= shown.length) return;
    await persistOrder(withOffRosterAppended(arrayMove(shown, from, to)), players);
  }

  async function handleAdd(keepOpen = false) {
    if (!addForm.playerFirstName.trim()) return; // first name required; last + guardian optional

    setAdding(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:   addForm.playerFirstName.trim(),
            playerLastName:    addForm.playerLastName.trim() || null,
            playerDateOfBirth: addForm.playerDateOfBirth || null,
            playerNumber:      addForm.playerNumber.trim() || null,
            primaryPosition:   addForm.primaryPosition.trim() || null,
            secondaryPosition: null, // set on the player's profile, not at add-time
            guardianFirstName: addForm.guardianFirstName.trim() || null,
            guardianLastName:  addForm.guardianLastName.trim() || null,
            guardianEmail:     addForm.guardianEmail.trim() || null,
            guardianPhone:     addForm.guardianPhone.trim() || null,
            notes:             addForm.notes.trim() || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add player');
      const addedName = [addForm.playerFirstName.trim(), addForm.playerLastName.trim()].filter(Boolean).join(' ');
      setAddForm(BLANK);
      // Append the created player to local state (it appends server-side too) rather than refetching —
      // a refetch here could stomp an in-flight reorder's optimistic state.
      if (data.player) setPlayers(prev => [...prev, data.player]);
      if (keepOpen) {
        // Stay put with a cleared form so the next player can be typed straight away — the
        // one-at-a-time companion to bulk add. No modal feedback: the running count in the
        // header is the acknowledgement, and a dialog here would break the typing rhythm.
        setAddedInRun(n => n + 1);
      } else {
        setAddOpen(false);
        // Include anyone already saved via "Save & add another" this session — otherwise finishing
        // a run of five with the primary button would report only the last player.
        const total = addedInRun + 1;
        setAddedInRun(0);
        showFeedback('success', total > 1
          ? `${total} players added to roster.`
          : `${addedName} added to roster.`);
      }
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to add player.'));
    } finally {
      setAdding(false);
    }
  }

  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const confirm = useConfirm();

  const addDirty = addOpen && JSON.stringify(addForm) !== JSON.stringify(BLANK);
  function openAdd() {
    setAddForm(BLANK);
    setAddedInRun(0);
    setBulkOpen(false);
    setAddOpen(true);
  }
  async function requestCloseAdd() {
    if (addDirty && !(await confirm({
      title: 'Discard new player?',
      message: 'You haven’t added this player yet. Discard what you’ve entered?',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'danger',
    }))) return;
    setAddOpen(false);
    // Acknowledge a "save & add another" run on the way out — each individual save stayed quiet
    // on purpose, so without this the coach would never get a confirmation for the batch.
    if (addedInRun > 0) {
      showFeedback('success', `${addedInRun} ${addedInRun === 1 ? 'player' : 'players'} added to roster.`);
      setAddedInRun(0);
    }
  }

  // ── Export helpers ───────────────────────────────────────────────────────────

  function buildRosterExportSrc() {
    return players.map(p => ({
      playerNumber:      p.playerNumber ?? '',
      primaryPosition:   p.primaryPosition ?? '',
      secondaryPosition: p.secondaryPosition ?? '',
      playerFirstName:   cleanNamePart(p.playerFirstName),
      playerLastName:    cleanNamePart(p.playerLastName),
      playerDateOfBirth: p.playerDateOfBirth ?? '',
      guardianName:      [p.guardianFirstName, p.guardianLastName].filter(Boolean).join(' '),
      guardianEmail:     p.guardianEmail ?? '',
      guardianPhone:     p.guardianPhone ?? '',
      status:            p.status === 'active' ? 'Active' : 'Inactive',
      notes:             p.notes ?? '',
    }));
  }

  async function handleExportXLSX() {
    if (!players.length) return;
    const headers = serializeHeaders(ROSTER_EXPORT_COLS);
    const rows = serializeRows(buildRosterExportSrc(), ROSTER_EXPORT_COLS);
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster', scope: assignment?.teamName ?? teamId }, 'xlsx'),
      headers, rows, 'Roster',
    );
  }

  async function handleExportXLSXWithSensitive() {
    if (!players.length) return;
    const headers = serializeHeaders(ROSTER_EXPORT_COLS, true);
    const rows = serializeRows(buildRosterExportSrc(), ROSTER_EXPORT_COLS, true);
    await downloadXLSX(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster-with-contacts', scope: assignment?.teamName ?? teamId }, 'xlsx'),
      headers, rows, 'Roster',
    );
  }

  function handleExportCSV() {
    const headers = serializeHeaders(ROSTER_EXPORT_COLS);
    const rows = serializeRows(buildRosterExportSrc(), ROSTER_EXPORT_COLS);
    downloadCSVBlob(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster', scope: assignment?.teamName ?? teamId }, 'csv'),
      generateCSV(headers, rows),
    );
  }

  /**
   * The roster prints as TWO DOCUMENTS with two readers (owner ruling, Phase 2 Rosters pass,
   * 2026-08-23 — decided from rendered options).
   *
   * A roster is the one document this product prints that gets PINNED where strangers walk past:
   * a dugout, a rink board, a check-in table. Until this pass there was only one roster PDF and
   * it carried every child's full date of birth plus every guardian's email and phone — and a
   * STANDALONE coach could not turn any of it off, because the guardian-contacts switch lives in
   * club admin settings and a standalone team has no club. So:
   *
   *  - `handleExportPDF` — the WALL COPY, the default. Number, player, positions, status.
   *    Nothing on it is private. Portrait, readable density, one page for a normal roster.
   *  - `handleExportContactsPDF` — the CONTACTS SHEET, a second document row in the same Export
   *    menu (never a second format). Date of birth + guardian columns; the sheet a club submits
   *    to an association or insurer. Offered ONLY to a coach cleared for family contacts.
   *
   * ⚠ Two content variants of ONE engine call, per plan §5 — never a per-report renderer fork.
   */
  const rosterPdfMeta = () => ({
    settings: {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    } as OrgPdfSettings,
    teamName: assignment?.teamName ?? teamId,
    // D1: the header carries the team's name; the subtitle keeps only the season.
    programYearName: programYear?.name ?? assignment?.programYearName ?? '',
  });

  async function handleExportPDF() {
    if (!players.length) return;
    const { settings, teamName, programYearName } = rosterPdfMeta();

    await downloadPDF(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster', scope: teamName }, 'pdf'),
      'Team Roster',
      programYearName || undefined,
      [...ROSTER_WALL_HEADERS],
      buildRosterExportSrc().map(r => [
        r.playerNumber,
        [r.playerFirstName, r.playerLastName].filter(Boolean).join(' '),
        r.primaryPosition,
        r.secondaryPosition,
        r.status,
      ]),
      settings,
      // Five columns fit portrait at readable density with room to spare — the shape a coach
      // actually pins up. (The big-type dugout document is the lineup poster; this is the list.)
      { identity: teamName, shape: { orientation: 'portrait' } },
    );
  }

  async function handleExportContactsPDF() {
    if (!players.length || !canSeePii) return;
    const { settings, teamName, programYearName } = rosterPdfMeta();
    // The club's guardian-contacts switch keeps meaning exactly what it means: off drops the
    // three guardian columns from this sheet. Date of birth stays — it is the submission fact
    // this document exists for, and this sheet is never the one pinned to a wall.
    const includeGuardian = settings.includeGuardianContacts;

    await downloadPDF(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'roster-with-contacts', scope: teamName }, 'pdf'),
      'Team Roster — with contacts',
      programYearName || undefined,
      rosterContactHeaders(includeGuardian),
      buildRosterExportSrc().map(r => [
        r.playerNumber,
        [r.playerFirstName, r.playerLastName].filter(Boolean).join(' '),
        r.playerDateOfBirth,
        r.primaryPosition,
        ...(includeGuardian ? [r.guardianName, r.guardianEmail, r.guardianPhone] : []),
        r.status,
      ]),
      settings,
      /* Landscape, READABLE — not compact. The §82 compact guard on the old ten-column sheet is
         retired with this: merging First/Last into one `Player` column and dropping `Secondary`
         (which no association asks for) buys back enough width that eight columns print at
         honest widths with every value whole. Rendered before it was written: nine columns at
         this density shredded every date of birth across two lines ("2013-01-1 / 0"), which is
         why Secondary is not here. A second page costs nothing on a sheet nobody pins. */
      { identity: teamName, shape: { orientation: 'landscape' } },
    );
  }

  if (assignmentsLoading) return <CoachLoading label="Loading the roster…" />;
  // Chunk F: `hasAccess` covers the archive too — a coach whose season has ended, or who has
  // switched back to a past year, still belongs here. Keying this off the live assignment alone
  // is what shut them out in the first place.
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  /**
   * ⚠ THE PAGE GATES ON THE SAME PREDICATE AS ITS NAV DOOR (staff access review, 2026-09-10).
   * Without this, a coach the Roster door hides for — a schedule-only helper — reached the page
   * by URL or by an old link, the read was refused, and the page reported "Your roster is empty"
   * beside an Export button: a false statement about the team. Placed after every hook above.
   */
  if (page.capabilities && !hasRecordAccess(page.capabilities)) {
    return (
      <div className={`${styles.page} ${styles.pageWide}`}>
        <CoachPageHeader icon={Users} title="Roster" helpLabel="Roster" help={{ module: 'coaches', sectionIds: ['recipe-add-player'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-add-player` }} />
        <CoachNotGranted
          icon={<Users size={20} aria-hidden />}
          section="The roster"
          what="Every player on the team, with their numbers and positions — and, for coaches with contact access, their families."
          blocker="The roster opens for anyone with a team duty — attendance, lineups, notes, money, documents or tryouts. Ask your head coach to grant one."
        />
      </div>
    );
  }

  // ── Roster summary + data-quality signals ─────────────────────────────────
  /* The list shows the TEAM. Players taken off it fold into a shelf at the foot (owner ruling
     2026-08-26) instead of sitting inline in batting order told apart by a grey pill — which was
     the only thing the Status column was ever really doing. */
  const activePlayers = players.filter(p => p.status === 'active');
  /* ⚠ `!== 'active'` USED TO CATCH CALL-UPS TOO, and that was the single worst fail-open site in
     this feature: a borrowed player would have been shelved under "Off the roster" beside players
     who left the team, which is a different thing entirely and reads as one. Call-ups get their own
     section below (mig 309), and this one keeps its original meaning: people who were on the team
     and are not now. */
  const offRoster = players.filter(p => p.status === 'inactive');
  const callUps = players.filter(isCallUp);
  // Assistant Coaches: only the head coach (or an assistant granted it) edits the roster; guardian
  // contact + DOB are hidden from assistants without the PII grant. The API enforces both — these
  // just keep the UI honest (no broken buttons, no blank sensitive columns).
  const canWriteRoster = !!page.capabilities?.rosterWrite;
  /* The call-up shelf's own capability (mig 309, owner ruling R5). Both the games-played counts and
     the Remove it gates are served by routes gated on `lineups`, not on roster-write — so the shelf
     has to read the same flag the server does, or it offers a button that answers 403. */
  const canLineups = !!page.capabilities?.lineups;
  const canSeePii = !!page.capabilities?.rosterPii;
  // `label` is required here — this object also goes straight to openHelp() from the empty state,
  // where there is no HelpButton label to fall back to.
  const rosterHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['recipe-add-player', 'premium-bulk-roster'],
    label: 'Roster',
    fullGuideHref: `/${orgSlug}/coaches/help#recipe-add-player`,
  };

  // Jersey numbers worn by more than one player (flagged inline, not blocked).
  const dupNumbers = (() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const p of players) {
      const n = (p.playerNumber ?? '').trim();
      if (!n) continue;
      if (seen.has(n)) dup.add(n); else seen.add(n);
    }
    return dup;
  })();

  /* ⚠ THE GAP SUMMARY IS GONE, AND NOTHING FILTERS (owner ruling 2026-08-26). It counted players
     without a position and without a contact, then left the coach to find them — on a list of
     twelve rows that fits on one screen. Chips that filter twelve rows to three are slower than
     reading twelve. The gaps now sit in the ROWS, as a quiet prompt where the value would be
     (see `rosterAddPrompt` below), which is where a coach is already looking when they notice one.
     ⚠ Dim, not amber: on a brand-new roster EVERY row is missing a position, and twelve warnings
     about a roster that is merely new is how you teach someone to ignore warnings. */

  // Page-header ruling 2026-08-11: header actions, extracted so the CoachPageHeader call
  // stays scannable (same shape as the Money panels' headerActions consts).
  /**
   * ⚠ THE "ATTENDANCE" BUTTON IS GONE (owner call 2026-08-15, /review finding).
   *
   * The attendance report has ONE parent now — the Insights hub, where it is the
   * "Who's showing up?" door. This button was its SECOND, and it is the reason the report's
   * back link was still wrong half the time: a coach arriving from here was told to go "back"
   * to Insights, a page they had never been on. That is the exact defect the nav change
   * existed to retire, surviving in a narrower form — and the review caught the project
   * asserting "one parent now" in three documents while this was still on screen.
   *
   * It was also the report's ORIGINAL door, from before Attendance had a nav item at all
   * (Batch 4's own note called it out: "its only door was a secondary button on Roster that
   * disappears in the depth-chart view"). It never stopped doing that — `view === 'list'`
   * below still gates the rest of this row — so it was a door that vanished depending on
   * which toggle the coach had last pressed.
   */
  /**
   * ⚠ THE HEADER HOLDS THE CREATE AND THE IMPORT, AND NOTHING ELSE (house rules 1 and 4, owner
   * ruling 2026-08-23). Two changes from what shipped before, both of them defects rather than
   * drift:
   *
   *  - **It is no longer gated on `view === 'list'`.** The whole group used to vanish in the
   *    depth-chart view, including an export whose contents are identical in both. A coach who
   *    had last pressed the other toggle simply had no actions.
   *  - **Import is here at all.** Bulk-add existed only in the empty state — gone the moment one
   *    player exists — and behind a door inside the Add Player sheet. A coach entering fifteen
   *    tryout graduates in September could not find it.
   *
   * Export is deliberately absent: it lives in the list toolbar with the list it exports.
   */
  const rosterHeaderActions = (
    <>
      {canWriteRoster && (
        <button
          type="button"
          className={`${styles.btnPrimary} ${styles.headerPrimaryBtn}`}
          /* House rule 3: the words go on a phone and the aria-label carries them. */
          aria-label="Add player"
          onClick={openAdd}
        >
          <Plus size={15} aria-hidden />
          <span className={styles.headerBtnLabel}>Add Player</span>
        </button>
      )}
      {/* House rule 1 — picking a file is desktop work, so this hides below 640px while the
          create keeps the corner. The path is NOT lost: the empty state's own paste door stays
          at every width, which is the condition the rule depends on. */}
      {canWriteRoster && (
        <span className={styles.headerActionWideOnly}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setBulkOpen(true)}
          >
            <Upload size={14} aria-hidden /> Import
          </button>
        </span>
      )}
    </>
  );

  /**
   * House rule 2 — the export sits above the list it exports, pinned right in that list's own
   * toolbar, at every width. Being in a row that renders in BOTH views is also what stops it
   * disappearing into the depth chart.
   *
   * The phone rule is per choice: the wall copy and the contacts sheet survive (a coach shows or
   * sends a PDF), the two spreadsheets do not.
   */
  const rosterExport = (
    <CoachExportButton
      label="Roster"
      disabled={players.length === 0}
      /* TWO DOCUMENTS, and the picker in the dialog is what separates them (owner ruling
         2026-08-24). The SAFE one is listed first because the dialog opens on the first — so
         "Export → Excel" and the wall copy stay one tap, and the contacts sheet takes a
         deliberate change of document.

         ⚠ No row carries a hint any more. The document names say what the two documents are
         ("Team roster" / "Roster with contacts"), which is the whole reason the picker earns its
         place; a sentence under "Excel" explaining what Excel is for never did. */
      choices={[
        { id: 'xlsx', document: 'Team roster', name: 'Excel', ext: '.xlsx', run: handleExportXLSX },
        { id: 'csv', document: 'Team roster', name: 'CSV', ext: '.csv', run: handleExportCSV },
        {
          id: 'pdf', document: 'Team roster', name: 'PDF', ext: '.pdf',
          phone: 'keep', feature: 'pdf_exports', run: handleExportPDF,
        },
        /* The contacts sheet is a second DOCUMENT, and only for a coach cleared for family
           contacts. Withholding it is also what retires the old defect where an assistant
           without that grant printed four empty columns: the wall copy has no private columns
           to leave blank, and these rows are simply absent — which also means that coach gets
           no document picker at all, because for them there is only one document. */
        ...(canSeePii ? [
          {
            id: 'contacts-pdf', document: 'Roster with contacts', name: 'PDF', ext: '.pdf',
            phone: 'keep' as const, feature: 'pdf_exports' as const,
            run: handleExportContactsPDF,
          },
          /* No plan gate on this one: these are the coach's OWN team's families. Locking a
             standalone coach out of their own contact list would be the wrong fix — the
             `rosterPii` grant above is the right gate. Checked alongside the rep-teams row
             that the Rosters pass DID lock. */
          {
            id: 'xlsx-contacts', document: 'Roster with contacts', name: 'Excel', ext: '.xlsx',
            run: handleExportXLSXWithSensitive,
          },
        ] : []),
      ]}
    />
  );

  return (
    /* BOTH views are wide (desktop shell D1, owner-ratified 2026-08-01): the roster list is
       a data table, and data-dense surfaces take `.pageWide` unconditionally — supersedes the
       earlier depth-only opt-in (f9-2 remainder, Chunk E WI-4). */
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Header (page-header ruling 2026-08-11): title + actions + "?" in its fixed corner,
          nothing under the title — the roster counts lead the list toolbar below, beside the
          view toggle, so the fact sits on the thing it counts. */}
      <CoachPageHeader
        icon={Users}
        title="Roster"
        actions={rosterHeaderActions}
        /* House rule 4: the one create keeps the title line's corner beside the "?" on a phone,
           rather than taking a row of its own — Import is the only sibling and it has already
           gone by that width. A read-only assistant has no create either, so the row drops. */
        actionsPhoneInTitleRow
        actionsPhoneHidden={!canWriteRoster}
        helpLabel="Roster"
        help={rosterHelpRequest}
      />

      {/* List ⇄ Depth chart — two views of the same roster (positions/pitching/A-squad live
          here) — plus the counts that used to be the header subtitle (page-header ruling
          2026-08-11: a live fact leads the body it counts, not the chrome above it). */}
      {/* The kit's list toolbar (components/coaches/kit, 2026-09-16) — the row Money's tabs, Skills &
          Goals and Insights already draw. ⚠ THE COUNT IS GONE ENTIRELY (owner ruling 2026-08-26):
          a roster is twelve rows on one screen, and counting something a coach can see is chrome
          charging rent. ⚠ THE VIEW SWITCH LEADS THE ROW (owner ruling 2026-09-13, hub R2-4) —
          every other view switch in the portal sits at the LEFT of its row, and the table standard
          (§3.9) puts the arrangement control left with only the export pinned right;
          `kit.toolbarView` carries the equal-pill grid and the phone floor. */}
      <CoachListToolbar actions={rosterExport}>
        <div className={`${styles.segChoice} ${kit.toolbarView}`} aria-label="Roster view">
          <button type="button" aria-pressed={view === 'list'}
            className={`${styles.segBtn}${view === 'list' ? ' ' + styles.segBtnActive : ''}`}
            onClick={() => setView('list')}>List</button>
          <button type="button" aria-pressed={view === 'depth'}
            className={`${styles.segBtn}${view === 'depth' ? ' ' + styles.segBtnActive : ''}`}
            onClick={() => setView('depth')}>Depth chart</button>
        </div>
      </CoachListToolbar>

      {view === 'depth' ? (
        <DepthChartBoard orgSlug={orgSlug} teamId={teamId} />
      ) : fetching ? (
        <CoachLoading label="Loading the roster…" />
      ) : players.length === 0 ? (
        // Lead with the fast path: a coach's team list already exists somewhere as text, and
        // pasting it is the difference between two minutes and fifteen modal round trips.
        <CoachEmptyState
          icon={<Users size={22} aria-hidden />}
          eyebrow="Roster"
          headline="Your roster is empty"
          description={canWriteRoster
            ? 'Paste your team list and add everyone at once — names and numbers are enough to start. Players accepted from tryouts arrive here automatically.'
            : 'This is every player on the team, with their numbers, positions and contacts. Players accepted from tryouts arrive here automatically.'}
          payoff="Almost everything else reads from it: lineups, attendance, dues, who your announcements reach, and every player report in Insights. It's the one thing worth doing first."
          blocker={canWriteRoster ? undefined : 'Adding and editing players is the head coach’s job — ask them if someone is missing.'}
          primaryAction={canWriteRoster
            ? { label: 'Paste your roster', icon: <ClipboardPaste size={15} aria-hidden />, onClick: () => setBulkOpen(true) }
            : undefined}
          secondaryAction={canWriteRoster
            ? { label: 'Add one player', icon: <Plus size={15} aria-hidden />, onClick: openAdd }
            : { label: 'How the roster works', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(rosterHelpRequest) }}
        />
      ) : (
        <>
          {/*
            ⚠ ONLY THE NUDGE LEADS THE LIST NOW — the reorder tip moved BELOW it (design review
            2026-08-24). The two lines were doing different jobs from the same slot: the nudge is
            actionable STATE about this coach's data ("11 without a position"), while the tip
            explains a control that is drawn on every row underneath it, so reading it before
            seeing a row was premature. On a phone they never shared a line, which cost the list
            two rows of chrome for one row of information.
          */}
          <DndContext id={`rep-roster-dnd-${teamId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className={`${styles.tableWrap} ${styles.rosterWrap}`}>
              <table className={`${styles.table} ${styles.rosterTable}`}>
                <thead>
                  <tr>
                    <th className={styles.th} style={{ width: 28 }} aria-hidden />
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th}>Positions</th>
                    {/* "Family", not "Guardian": the column now leads with the PERSON rather than
                        with a 40-character address. See the cell for why. */}
                    <th className={styles.th}>Family</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={activePlayers.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {activePlayers.map((p, i) => (
                      <SortableRow
                        key={p.id}
                        player={p}
                        base={base}
                        dragDisabled={activePlayers.length < 2 || !canWriteRoster}
                        isDuplicateNumber={!!p.playerNumber && dupNumbers.has(p.playerNumber.trim())}
                        index={i}
                        count={activePlayers.length}
                        onMove={movePlayer}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </div>
          </DndContext>

          {/* ⚠ PLAYERS WHO ARE OFF THE ROSTER GET A SHELF, NOT A ROW (owner ruling 2026-08-26).
              They used to sit INLINE among the team in batting order, separated from a playing
              player by a grey pill in a column nobody reads — which is precisely why that column
              had to exist. Put them below the list and position carries the meaning, so the badge
              and the column both stop having a job.
              ⚠ Native <details>, so the shelf's contents stay mounted and the browser owns the
              open state — the portal's own CollapsibleCard convention. */}
          {offRoster.length > 0 && (
            <details className={styles.offRoster}>
              <summary className={styles.offRosterSummary}>
                Off the roster ({offRoster.length})
              </summary>
              <ul className={styles.offRosterList}>
                {offRoster.map(p => (
                  <li key={p.id} className={styles.offRosterRow}>
                    <Link href={`${base}/roster/${p.id}`} className={styles.offRosterName}>
                      {playerName(p)}
                    </Link>
                    {p.playerNumber && <span className={styles.offRosterNum}>#{p.playerNumber}</span>}
                    {/* Only the head coach (or an assistant granted roster-write) may put someone
                        back — the API refuses the rest, and a button that always fails is worse
                        than no button. */}
                    {canWriteRoster && (
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.offRosterAdd}`}
                        disabled={togglingId === p.id}
                        onClick={() => handleToggleStatus(p)}
                      >
                        {togglingId === p.id ? '…' : 'Add back'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* ── Call-ups (mig 309) ─────────────────────────────────────────────────────────────
              Players borrowed for a game. ⚠⚠ **BELOW THE ROSTER AND BELOW EVEN THE DEPARTED, AND
              COLLAPSED** — the binding constraint on this section is that it must never make the
              live roster noisier. It is the only place the saved list is visible without being
              asked for; the lineup builder shows none of it until a coach presses "Call up a
              player" (owner ruling R3, 2026-09-22).
              ⚠ NO row is a link. A call-up has no profile — that page is the portal's busiest
              instrument (dues, documents, development, guardians, medical) and its route 404s on a
              call-up rather than offering to move a borrowed player onto the roster. */}
          {callUps.length > 0 && (
            <details className={styles.offRoster}>
              <summary className={styles.offRosterSummary}>
                Call-ups ({callUps.length})
              </summary>
              <p className={styles.callUpNote}>
                Players you borrowed for a game. They are not on your roster and never appear in
                dues, skills &amp; goals or awards.
              </p>
              <ul className={styles.offRosterList}>
                {callUps.map(p => {
                  const games = callUpGames[p.id] ?? 0;
                  return (
                    <li key={p.id} className={styles.offRosterRow}>
                      <span className={styles.offRosterName}>{playerName(p)}</span>
                      {p.playerNumber && <span className={styles.offRosterNum}>#{p.playerNumber}</span>}
                      {/* The count several leagues cap, and the reason removal is or isn't offered. */}
                      <span className={styles.callUpGames}>
                        {games === 0 ? 'No games yet' : `${games} game${games === 1 ? '' : 's'}`}
                      </span>
                      {/* ⚠ Removal is offered ONLY before their first game. After that their name
                          is on a saved lineup, and deleting the row would take that lineup entry
                          with it — a card printed last month would stop matching the card printed
                          today. A coach who wants the name gone takes them off each game first. */}
                      {/* ⚠ `canLineups`, not `canWriteRoster`: the DELETE is gated on lineups
                          (owner ruling R5), and the games count that decides this button comes from
                          a route gated the same way. Gated on roster-write, a coach without lineups
                          saw "No games yet" for everyone — the counts fetch having 403'd silently —
                          and a Remove button that answered with a bare access error. */}
                      {canLineups && games === 0 && (
                        <button
                          type="button"
                          className={`btn btn-ghost ${styles.offRosterAdd}`}
                          disabled={removingCallUpId === p.id}
                          onClick={() => handleRemoveCallUp(p)}
                        >
                          {removingCallUpId === p.id ? '…' : 'Remove'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {/* The reorder tip, in its new home under the rows it describes. Same copy, same two
              variants (drag on desktop, arrows where drag is disabled) — only the position moved,
              and it moved at EVERY width rather than only on a phone: one control, one place to
              read about it, is worth more than the few pixels a width-gated version would save. */}
          {activePlayers.length >= 2 && (
            <div className={styles.rosterHintBelow}>
              <span className={styles.rosterHint}>
                <span className={styles.rosterHintDrag}>
                  <GripVertical size={13} /> Drag to set the order players appear in
                </span>
                <span className={styles.rosterHintMove}>
                  <ChevronUp size={12} /><ChevronDown size={12} /> Use the arrows to set the order players appear in
                </span>
              </span>
            </div>
          )}
        </>
      )}

      {/* ⚠ NOTHING BELOW THE ROSTER, deliberately. The "Team family access" card (the family
          link, its approval queue and Schedule visibility) sat here until 2026-09-12, when the
          link and the follower tier were removed (owner). Schedule visibility moved to Team
          settings → Sharing. Do not put a settings surface back under this list — it was moved
          below the fold once (2026-08-24) for outranking the roster, and then retired. */}

      {/* Add player modal */}
      <UnsavedChangesGuard active={addDirty} />

      {addOpen && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (requestCloseAdd)?.(); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title="Add Player" onClose={requestCloseAdd}>
              {addedInRun > 0 && <span className={styles.discToggleMeta}>{addedInRun} added</span>}
            </CoachModalHeader>

            {/* The bulk door, on the first line — the "* Required" legend that used to lead it came off
                every form on 2026-09-21 (the asterisk on a label is the whole signal). */}
            <p className={styles.formHint}>
              <button
                type="button"
                className={`${styles.linkBtn} ${styles.linkBtnAccent}`}
                onClick={() => { setAddOpen(false); setAddedInRun(0); setBulkOpen(true); }}
              >
                Adding several? Paste a list →
              </button>
            </p>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-pfn">
                  First Name *
                </label>
                <input id="add-pfn" className={styles.input} type="text" autoFocus
                  value={addForm.playerFirstName}
                  onChange={e => setAddForm(f => ({ ...f, playerFirstName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-pln">
                  Last Name
                </label>
                <input id="add-pln" className={styles.input} type="text"
                  value={addForm.playerLastName}
                  onChange={e => setAddForm(f => ({ ...f, playerLastName: e.target.value }))}
                  maxLength={60} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-num">Jersey #</label>
                <input id="add-num" className={styles.input} type="text"
                  value={addForm.playerNumber}
                  onChange={e => setAddForm(f => ({ ...f, playerNumber: e.target.value }))}
                  maxLength={10} />
              </div>
              {/* ONE position at add-time — the player's first "Best" pick. It's the same setting
                  the profile's tap-to-rank grid edits, which is the better place to add further
                  choices, Never, pitching and A-squad. Two dropdowns here gave one setting two
                  vocabularies (readiness review f1-5); owner call 2026-07-28 to drop the second. */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="add-primary-position">Best Position</label>
                <PositionSelect id="add-primary-position" positions={rosterPositions}
                  selectClass={styles.select} inputClass={styles.input}
                  value={addForm.primaryPosition}
                  onChange={v => setAddForm(f => ({ ...f, primaryPosition: v }))} />
                <p className={styles.formHint}>Rank more positions on the player&apos;s profile after adding.</p>
              </div>

              {/* Everything below opens on demand (Batch 2, P0 #8 — D2 Variant A). Jersey + primary
                  position stay visible because lineups, the depth chart, and game sheets fill
                  themselves in from them. `defaultOpen` is mount-only, so re-renders can never
                  re-collapse a group the coach opened. */}
              <div className={styles.formGridFull}>
                <CoachFormDisclosure
                  label="Add parent / guardian contact"
                  title="Parent / guardian contact"
                  note="Dues reminders and announcements are sent to this address."
                  defaultOpen={Boolean(addForm.guardianFirstName || addForm.guardianLastName || addForm.guardianEmail || addForm.guardianPhone)}
                >
                  <div className={styles.formSectionGrid}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="add-gfn">Guardian First Name</label>
                      <input id="add-gfn" className={styles.input} type="text"
                        value={addForm.guardianFirstName}
                        onChange={e => setAddForm(f => ({ ...f, guardianFirstName: e.target.value }))}
                        maxLength={60} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="add-gln">Guardian Last Name</label>
                      <input id="add-gln" className={styles.input} type="text"
                        value={addForm.guardianLastName}
                        onChange={e => setAddForm(f => ({ ...f, guardianLastName: e.target.value }))}
                        maxLength={60} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="add-gem">Guardian Email</label>
                      <input id="add-gem" className={styles.input} type="email"
                        value={addForm.guardianEmail}
                        onChange={e => setAddForm(f => ({ ...f, guardianEmail: e.target.value }))}
                        maxLength={120} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="add-gph">Guardian Phone</label>
                      <input id="add-gph" className={styles.input} type="tel"
                        value={addForm.guardianPhone}
                        onChange={e => setAddForm(f => ({ ...f, guardianPhone: e.target.value }))}
                        maxLength={20} />
                    </div>
                  </div>
                </CoachFormDisclosure>
              </div>

              <div className={styles.formGridFull}>
                <CoachFormDisclosure
                  label="More details"
                  defaultOpen={Boolean(addForm.playerDateOfBirth || addForm.notes)}
                >
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="add-dob">Date of Birth</label>
                    <input id="add-dob" className={styles.input} type="date"
                      value={addForm.playerDateOfBirth}
                      onChange={e => setAddForm(f => ({ ...f, playerDateOfBirth: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="add-notes">Notes</label>
                    <textarea id="add-notes" className={styles.textarea} rows={2}
                      value={addForm.notes}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Experience, availability, anything worth remembering."
                      maxLength={500} />
                  </div>
                </CoachFormDisclosure>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleAdd(true)}
                disabled={adding || !addForm.playerFirstName.trim()}
              >
                Save &amp; add another
              </button>
              <button
                type="button"
                className="btn btn-lime"
                onClick={() => handleAdd(false)}
                disabled={adding || !addForm.playerFirstName.trim()}
              >
                {adding ? 'Adding…' : 'Add Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <RosterBulkAddSheet
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={page.teamName}
          existingPlayers={players}
          onClose={() => setBulkOpen(false)}
          onAdded={(created, message) => {
            setBulkOpen(false);
            // Append rather than refetch, same reason as the single-player add: a refetch could
            // stomp an in-flight reorder's optimistic state.
            if (created.length) setPlayers(prev => [...prev, ...created]);
            showFeedback('success', message);
          }}
        />
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />
    </div>
  );
}

function SortableRow({
  player: p,
  base,
  dragDisabled,
  isDuplicateNumber,
  index,
  count,
  onMove,
}: {
  player: RepRosterPlayer;
  /** Chunk F: keeps a player link inside the season the roster is showing. */
  base: string;
  dragDisabled: boolean;
  isDuplicateNumber: boolean;
  index: number;
  count: number;
  onMove: (playerId: string, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const fullName = playerName(p);
  const guardianName = [p.guardianFirstName, p.guardianLastName].filter(Boolean).join(' ').trim();
  const playerHref = `${base}/roster/${p.id}`;
  // ⚠ PITCHING COUNTS AS A POSITION (hub F04, 2026-09-13). The mound is deliberately not in the
  // position picker, so a player whose whole job is pitching has no field positions — and this
  // column used to tell the coach to "Add a position" on the team's ace, forever. The pitching
  // chip leads the cell, worded the way the editor words it (`pitcherRankLabel`: "Ace", "P2"…),
  // then the field positions; the prompt only when there is neither.
  const pitcherRank = p.lineupProfile?.pitcher?.rank ?? null;
  const pitchLabel = pitcherRank ? pitcherRankLabel(pitcherRank) : null;
  const pitchTitle = pitcherRank === 1 ? 'Pitcher, the ace' : `Pitcher, rank ${pitcherRank}`;
  const fieldPositions = [p.primaryPosition, p.secondaryPosition].filter(Boolean).join(' / ');
  const hasPositions = Boolean(pitchLabel || fieldPositions);
  return (
    <tr ref={setNodeRef} style={style} className={styles.tr}>
      <td className={`${styles.td} ${styles.gripTd}`}>
        <button
          type="button"
          aria-label="Drag to reorder"
          disabled={dragDisabled}
          className={styles.rosterGripBtn}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
      </td>
      {/* The jersey number in the data face, tabular, secondary ink — the same treatment the
          off-roster shelf and the depth chart already give it (hub F02). It carried an inline
          13.6px and an off-tier ink here, which no CSS-reading guard could see. */}
      <td className={`${styles.td} ${styles.rosterNumTd}`} data-label="#">
        {p.playerNumber
          ? (isDuplicateNumber
              ? <span className={styles.jerseyDup} title="Another player wears this number"><AlertTriangle size={12} /> {p.playerNumber}</span>
              : p.playerNumber)
          : <span className={styles.cellEmpty}>—</span>}
      </td>
      <td className={`${styles.td} ${styles.playerCellTd}`} data-label="Player">
        <span className={styles.playerCell}>
          <Link href={playerHref} className={styles.playerNameLink}>{fullName}</Link>
          {/* ⚠ TWO MARKERS, BOTH FROM DATA ALREADY ON THIS ROW — no extra call, nothing new for a
              coach to enter: who starts, and who the trainer needs to know about. Each carries a
              title AND an accessible label, because a coloured square is not information to a
              screen reader and colour alone is not information to anyone (the portal's own
              contrast ruling). The pitcher marker moved to the Positions cell (hub F05) — it is
              about a position, not the person, and beside the name it rendered a bare "P" whenever
              the rank was unset. */}
          {(p.lineupProfile?.aSquad || p.medicalNotes) && (
            <span className={styles.rosterFlags}>
              {p.lineupProfile?.aSquad && (
                <span className={`${styles.rosterFlag} ${styles.rosterFlagSquad}`}
                  title="A-squad — gold-medal starter" aria-label="A-squad">★</span>
              )}
              {p.medicalNotes && (
                <span className={`${styles.rosterFlag} ${styles.rosterFlagMed}`}
                  title="Medical notes on file" aria-label="Medical notes on file">✚</span>
              )}
            </span>
          )}
          {/* Mobile only: jersey # + positions fold into the card (their own rows are hidden). */}
          <span className={styles.playerCellMeta}>
            {p.playerNumber && (
              <span
                className={`${styles.playerNumBadge}${isDuplicateNumber ? ` ${styles.playerNumBadgeDup}` : ''}`}
                title={isDuplicateNumber ? 'Another player wears this number' : undefined}
              >
                #{p.playerNumber}
              </span>
            )}
            {/* Positions ride the card on a phone; their own card line is hidden at 640. Pitching
                leads here too, so the ace's card does not read as a player with no position. */}
            {hasPositions && (
              <span className={styles.playerPosChip}>
                {[pitchLabel, fieldPositions].filter(Boolean).join(' · ')}
              </span>
            )}
            {/* Reorder arrows live here on mobile (drag is disabled on touch); hidden on desktop. */}
            {!dragDisabled && (
              <span className={styles.rosterMoveControls}>
                <button
                  type="button"
                  className={styles.rosterMoveBtn}
                  aria-label={`Move ${fullName} up`}
                  disabled={index === 0}
                  onClick={() => onMove(p.id, -1)}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  className={styles.rosterMoveBtn}
                  aria-label={`Move ${fullName} down`}
                  disabled={index === count - 1}
                  onClick={() => onMove(p.id, 1)}
                >
                  <ChevronDown size={15} />
                </button>
              </span>
            )}
          </span>
        </span>
      </td>
      {/* ⚠ THE PROMPTS LINK TO THE TAB THEY NAME. The player page's tabs carry a `?tab=` address
          (hub F13); a bare player URL lands on the default tab, which for a contact was two clicks
          from the field it named. `?section=` still scrolls-and-flashes within the tab. */}
      <td className={styles.td} data-label="Positions">
        {hasPositions
          ? <span className={styles.rosterPosCell}>
              {pitchLabel && (
                <span className={styles.rosterPitchChip} title={pitchTitle} aria-label={pitchTitle}>{pitchLabel}</span>
              )}
              {fieldPositions && <span>{fieldPositions}</span>}
            </span>
          : <Link href={playerTabHref(playerHref, 'details', { section: 'player' })} className={styles.rosterAddPrompt}><span aria-hidden="true">+</span> Add a position</Link>}
      </td>
      {/* ⚠ THE COLUMN LEADS WITH THE PERSON, NOT THE ADDRESS (owner ruling 2026-08-26). It used to
          print the guardian's email as the whole cell — the widest thing on the page, and the least
          glanceable: at a glance a coach wants "can I reach this family", not a 40-character string
          they will copy rather than read. The name leads; the address and phone stay one tap away
          beneath it.
          ⚠ AND THERE IS NO "on the family app" BADGE HERE, deliberately. The per-player guardian
          tier is shipped SWITCHED OFF pending privacy counsel review. This cell is shaped so that
          badge drops in later rather than forcing a rebuild — see the plan §2.
          ⚠ Redaction is unchanged: a coach without guardian-contact access has these fields
          stripped by the API before they reach here, so the cell simply falls to its prompt. */}
      <td className={styles.td} data-label="Family">
        {(guardianName || p.guardianEmail || p.guardianPhone)
          ? <span className={styles.guardianStack}>
              {guardianName && <span className={styles.familyName}>{guardianName}</span>}
              {p.guardianEmail && (
                <a href={`mailto:${p.guardianEmail}`} className={styles.guardianEmail}>{p.guardianEmail}</a>
              )}
              {p.guardianPhone && (
                <a href={telHref(p.guardianPhone)} className={styles.guardianPhone}>{p.guardianPhone}</a>
              )}
            </span>
          : <Link href={playerTabHref(playerHref, 'family', { section: 'guardian' })} className={styles.rosterAddPrompt}><span aria-hidden="true">+</span> Add a contact</Link>}
      </td>
      {/* ⚠ THE PHONE CARD'S ONE ACTION (hub F06, register F-23). At ≤640 the Family cell above is
          hidden and the whole card becomes the door to the player (the name link stretches over
          the card — see the roster reflow block). A parent's phone number is the one thing a coach
          at the field wants from this list, so when one is on file the card carries a 44px Call
          button, corner-pinned above the stretched link (standard K-09). Desktop never draws it —
          the Family cell already has the tel: link there. PII-gated the same way as that cell: a
          coach without guardian-contact access gets `guardianPhone` nulled by the API. */}
      {p.guardianPhone && (
        <td className={`${styles.td} ${styles.rosterCallTd}`}>
          <a
            href={telHref(p.guardianPhone)}
            className={styles.rosterCallBtn}
            aria-label={`Call ${guardianName || fullName + '’s family'}`}
            title={`Call ${guardianName || 'the family'} · ${p.guardianPhone}`}
          >
            <Phone size={17} />
          </a>
        </td>
      )}
    </tr>
  );
}
