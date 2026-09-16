'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookMarked, CalendarDays, ClipboardList, Library, NotebookPen, Printer, Ruler, Telescope, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import {
  buildFilename, downloadPracticeSheet, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS,
  type OrgPdfSettings, type PracticeSheetBlock, type PracticeSheetRotation,
} from '@/lib/export';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { canWriteDevelopment } from '@/lib/coach-capabilities';
import { formatInOrgZone } from '@/lib/timezone';
import { useMinuteClock } from '@/lib/use-minute-clock';
import {
  practiceHasPlan, practiceLengthMinutes, practicePlanFit, practicePlannedLabel, practiceRemainderLabel,
  practiceStarted,
} from '@/lib/practice-state';
import {
  MAX_RECAP_LEN,
  blockRotates, computeBlockClocks, computeRotation, copyPracticePlanForReuse, emptyPracticePlan, rotationShape,
  formatDuration, isPracticePlanEmpty, newPracticePlanId, practiceKitBag, resolvePracticePlanTagNames,
  resolveStationTeaching, tagNamesById,
  type PracticePlan,
} from '@/lib/rep-practice-plan';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import {
  MAX_TEMPLATE_NAME_LEN, templateBlocksLine, templateShapeLabel, templateToPlan,
} from '@/lib/rep-plan-templates';
import { filterTagged } from '@/lib/rep-drills';
import { practicePlansHref } from '@/lib/practice-plans-address';
import { useFocusTags, useStaffTags, useEquipmentTags } from '@/components/coaches/use-focus-tags';
import { FOCUS_TAG_MANAGE, STAFF_TAG_MANAGE, EQUIPMENT_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import PracticePlanEditor, {
  type PracticeFocusGoal, type PracticeRosterPlayer,
} from '../_PracticePlanEditor';
import type { DrillInput, RepTeamDrill } from '@/lib/rep-drills';
import type { CircuitInput, RepTeamCircuit } from '@/lib/rep-circuits';
import type { PracticeWeekScoutingBridge } from '@/lib/coach-opponent-nudge';
import type { PickableTag } from '@/components/coaches/TagPicker';
import styles from '../../../../coaches.module.css';
import type { RepAttendanceStatus, RepTeamEvaluationSession, RepTeamEvent } from '@/lib/types';

type PreviousPlan = {
  eventId: string;
  name: string;
  startsAt: string;
  eventType: string;
  plan: PracticePlan | null;
};

/**
 * A past SEASON's practice offered by "Start this plan from…" — the picker's third source (P3 C2).
 *
 * ⚠ It carries `seasonName` and it is not optional design detail: this is the one source in the
 * picker whose rows are NOT from the season the coach is planning, so a row that cannot say which
 * year it came from is a row mistakable for this year's work.
 */
type PastSeasonPlan = {
  eventId: string;
  name: string;
  startsAt: string | null;
  seasonName: string | null;
  plan: PracticePlan;
};

/** A template offered by "Start this plan from…" — the other half of the one picker (Phase 3). */
type PlanTemplateOption = {
  id: string;
  name: string;
  plan: PracticePlan;
  tags: { id: string; name: string }[];
};

type LoadState = {
  event: RepTeamEvent;
  plan: PracticePlan | null;
  /** "How it went" (D17) — null when nothing was written, which the UI states honestly. */
  recap: string | null;
  /** What this practice is about, in the team's shared 'focus' vocabulary. */
  planTagIds: string[];
  focusTags: PickableTag[];
  /** The 'staff'/'equipment' libraries (mig 266) — same shape and reasoning as `focusTags`. */
  staffTags: PickableTag[];
  equipmentTags: PickableTag[];
  templates: PlanTemplateOption[];
  roster: PracticeRosterPlayer[];
  goals: PracticeFocusGoal[];
  attendance: { playerId: string; status: RepAttendanceStatus }[];
  previousPlans: PreviousPlan[];
  /** Is the picker's third source worth offering? One boolean off the plan GET (P3 C2). */
  hasPastSeasonPlans: boolean;
  sessions: RepTeamEvaluationSession[];
  /** The game-week scouting bridge (Scouting Book P3) — null when the week has no booked
   *  opponent with book content, which is most weeks. */
  scoutingBridge: PracticeWeekScoutingBridge | null;
  staffSuggestions: string[];
  equipmentSuggestions: string[];
  /** This team's own drills plus the club's shared set — the picker's source (Phase 2). */
  drills: RepTeamDrill[];
  /** The team's circuits (stage 4, L9) — the panel's second face, the picker's third tab. */
  circuits: RepTeamCircuit[];
  canWrite: boolean;
  canViewFocus: boolean;
  canViewAttendance: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Where the coach's dock choice is remembered (L5) — this browser, every plan. */
const LIBRARY_DOCK_KEY = 'coach-practice-library-dock';
/**
 * The working column the docked pair needs, in px: the sheet at its 816 letter width + a 20px gap
 * + the 320 panel = the header's column at 1440 exactly (plan §7.2, input 5). Measured on the
 * column, never the viewport — a 1,366 laptop's column is narrower than this and keeps the sheet.
 */
const LIBRARY_DOCK_MIN_COLUMN = 1156;

/** The three places a plan can start from (frame 05; "past" added by P3 C2). */
type CopySource = 'template' | 'previous' | 'past';

/**
 * ⚠ **ONE record per source, so a fourth cannot arrive half-dressed.** The tab label and the
 * bargain-sentence under it used to be written in two separate places — a hand-listed row of
 * buttons and a chained ternary — which meant adding "A past season" was two edits that nothing
 * tied together, and forgetting the second would have shown the wrong promise under the right tab.
 *
 * ⚠ Every hint says the same thing in its own words, deliberately: a coach must never have to
 * guess whether copying EDITS what they copied from. It does not.
 */
const COPY_SOURCES: ReadonlyArray<{ id: CopySource; label: string; hint: string }> = [
  {
    id: 'template',
    label: 'A template',
    hint: 'This copies the template onto tonight. The template is left exactly as it is, and anything you change here stays here.',
  },
  {
    id: 'previous',
    label: 'A previous practice',
    hint: 'This copies the plan onto tonight. The practice you copy from is left exactly as it is, and anything you change here stays here.',
  },
  {
    id: 'past',
    label: 'A past season',
    hint: 'This copies what you wrote onto tonight. The finished season is left exactly as it is, nothing is added to your templates, and the groups come across empty — last year’s players aren’t on this year’s roster.',
  },
];

/** A save that hasn't landed by now is reported as a failure rather than spinning for ever. */
const SAVE_TIMEOUT_MS = 15_000;

/** "Tue, May 5, 2026" — the picker rows and the printed sheet, where the year matters. */
const fmtDate = (iso: string) =>
  formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
/** "Tue, May 5" — the sheet's first line, which is about THIS week, not a year. */
const fmtDay = (iso: string) => formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' });

export default function CoachPracticePlanPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; eventId: string }>;
}) {
  const { orgSlug, teamId, eventId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const assignment = assignments.find(a => a.teamId === teamId);
  const canSchedule = assignment ? assignment.capabilities.schedule : true;
  const canOpenSessions = assignment ? canWriteDevelopment(assignment.capabilities) : false;

  const practiceHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-practice-plans'],
    label: 'Practice plan',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-practice-plans`,
  };

  const [data, setData] = useState<LoadState | null>(null);
  const [plan, setPlan] = useState<PracticePlan>(emptyPracticePlan());
  /**
   * "How it went" and what the practice is about — both live on the EVENT, not in the plan's
   * jsonb, so they are their own state and their own save path (the route's PATCH).
   *
   * ⚠ Kept out of `plan` deliberately. The plan autosaves about a second after the last keystroke;
   * folding the recap in would mean every plan edit re-sent a recap it may not have loaded.
   */
  const [recap, setRecap] = useState('');
  const [planTagIds, setPlanTagIds] = useState<string[]>([]);
  /**
   * The team's whole 'focus' vocabulary, owned here beside `drills` for the same reason: the editor
   * is a controlled component and must not fetch its own reference data.
   *
   * ⚠ Every tag the team has, NOT only the ones already on a drill — a picker built from what is on
   * screen would hide vocabulary a focus area or a template already uses, and quietly invite the
   * coach to mint a duplicate. It arrives on the plan GET, so there is no second round trip.
   */
  // ⚠ `skipFetch`: the library arrives on this page's own plan GET, so re-fetching it would be a
  // second round trip for data already in hand. The hook still owns creation and local merging,
  // which is the part that must not differ between the four surfaces that offer a tag picker.
  const { tags: focusTags, setTags: setFocusTags, createTag: createFocusTag, reload: reloadFocusTags } =
    useFocusTags(orgSlug, teamId, { skipFetch: true });
  const { tags: staffTags, setTags: setStaffTags, createTag: createStaffTag, reload: reloadStaffTags } =
    useStaffTags(orgSlug, teamId, { skipFetch: true });
  const { tags: equipmentTags, setTags: setEquipmentTags, createTag: createEquipmentTag, reload: reloadEquipmentTags } =
    useEquipmentTags(orgSlug, teamId, { skipFetch: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copyOpen, setCopyOpen] = useState(false);
  /** Which source the one picker is showing (frame 05) — see COPY_SOURCES. */
  const [copySource, setCopySource] = useState<CopySource>('template');
  const [copyQuery, setCopyQuery] = useState('');
  /**
   * The past-season rows, FETCHED ONLY WHEN THE TAB IS FIRST OPENED (P3 C2).
   *
   * ⚠ Deliberately not folded into this page's plan GET. That read walks every practice the team
   * has ever run and parses each one's jsonb; putting it on the everyday load would make opening
   * ANY practice pay for a list most coaches never ask for. `null` = never asked; `[]` = asked and
   * there is nothing, which the dialog states rather than leaving as a spinner.
   */
  const [pastPlans, setPastPlans] = useState<PastSeasonPlan[] | null>(null);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState('');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  // Same shared overlay stack as every other sheet in the portal (nav-hide + body-scroll lock).
  useOverlayOpen(copyOpen || saveTemplateOpen);
  /**
   * THE DOCKED LIBRARY (practices re-evaluation stage 4, owner ruling L5, 2026-09-16 — A).
   *
   * Two facts, kept apart on purpose. `canDock` is a WIDTH decision, made once from the WORKING
   * COLUMN — the space the page's column actually has, measured, never the viewport: from 1,156px
   * up (a 1440 display; the 220 sidebar and the main area's padding taken off) the sheet returns to
   * stage 1's 816 letter width and a 320 panel takes the rest, so the pair is exactly the header's
   * column; below it (a 1,366 laptop, a 1,280 display) the toggle is ABSENT, not disabled, and the
   * sheet stays the path. `docked` is the coach's choice — the ghost row's "a drill from your
   * library" docks it on the blank page, the toolbar's quiet Library toggle after that —
   * remembered in this browser so a coach who likes it docked finds it docked on every plan.
   * Rendered correctly with no stored value (a private window, cleared site data): undocked.
   */
  const [docked, setDocked] = useState(false);
  const [canDock, setCanDock] = useState(false);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try { setDocked(localStorage.getItem(LIBRARY_DOCK_KEY) === 'docked'); } catch { /* no storage — undocked */ }
  }, []);
  const dock = (next: boolean) => {
    setDocked(next);
    try { localStorage.setItem(LIBRARY_DOCK_KEY, next ? 'docked' : 'sheet'); } catch { /* per-viewer convenience only */ }
  };
  useEffect(() => {
    const column = columnRef.current;
    if (!column || typeof ResizeObserver === 'undefined') return;
    // The working column is the main area's content box — the parent's, because this column
    // itself is capped by `.page`/`.pageWide` and would report its own cap, not the room it has.
    const target = column.parentElement ?? column;
    const contentWidth = () => {
      const cs = getComputedStyle(target);
      return target.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    };
    setCanDock(contentWidth() >= LIBRARY_DOCK_MIN_COLUMN);
    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? contentWidth();
      setCanDock(width >= LIBRARY_DOCK_MIN_COLUMN);
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, [loading]);
  /* "Start this plan from…" stands on the portal's dialog floor (stage 2, D9) — Escape closes it
     and focus returns to the ghost row's link. The editor's three sheets and "Save as template…"
     take the same floor; leaving one would be two sheets on one page that close differently. */
  const copyPanelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(copyOpen, copyPanelRef, { onClose: () => setCopyOpen(false) });
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  // "How it went" appears once the practice has STARTED (stage 1, D7) — a plan left open on a
  // laptop through the evening grows the box at the start, not on the next reload.
  const nowMs = useMinuteClock();

  // Team-resolved PDF settings (D4: team look → club look → defaults) — optional; the
  // sheet falls back to defaults. Cleanup-guarded so a slow response for a previous team
  // can never land as this team's branding.
  useEffect(() => {
    let cancelled = false;
    void fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`)
      .then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  // Sequence guard: a slow earlier response must not stomp a newer one.
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/practice-plan`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not load this practice');
      }
      const body: LoadState = await res.json();
      if (seq !== loadSeqRef.current) return;
      setData(body);
      setPlan(body.plan ?? emptyPracticePlan());
      setRecap(body.recap ?? '');
      setPlanTagIds(body.planTagIds ?? []);
      setFocusTags(body.focusTags ?? []);
      setStaffTags(body.staffTags ?? []);
      setEquipmentTags(body.equipmentTags ?? []);
      setDirty(false);
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      setLoadError(errorMessage(e, 'Could not load this practice'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
    // `setFocusTags`/`setStaffTags`/`setEquipmentTags` come from the shared vocabulary hook rather
    // than a local `useState`, so the linter can't see they're stable setters — they are, and
    // listing them re-runs nothing.
  }, [orgSlug, teamId, eventId, setFocusTags, setStaffTags, setEquipmentTags]);

  useEffect(() => {
    if (!ctxLoading && canSchedule) void Promise.resolve().then(load);
  }, [ctxLoading, canSchedule, load]);

  const planSig = JSON.stringify(plan);
  const planSigRef = useRef(planSig);
  useEffect(() => { planSigRef.current = planSig; }, [planSig]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!data?.canWrite) return true;
    const sigAtSave = planSigRef.current;
    setSaving(true);
    setSaveError('');
    // ⚠ BOUNDED. Without this a request that never comes back leaves the status pill saying
    // "Saving…" for ever, which a coach cannot tell apart from "my plan is not being kept".
    // A save that hasn't landed in 15s is a failure and is reported as one.
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/practice-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: isPracticePlanEmpty(plan) ? null : plan }),
        signal: abort.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save the plan');
      }
      await res.json().catch(() => ({}));
      // Only clear the dirty flag if nothing changed while the request was in flight.
      if (planSigRef.current === sigAtSave) setDirty(false);
      return true;
    } catch (e: unknown) {
      setSaveError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Saving is taking too long — check your connection.'
          : errorMessage(e, 'Could not save the plan'),
      );
      return false;
    } finally {
      clearTimeout(timeout);
      setSaving(false);
    }
  }, [data?.canWrite, orgSlug, teamId, eventId, plan]);

  // Autosave ~0.9s after the last change — the portal's established "no Save button" posture.
  //
  // ⚠ It STOPS after a failure (`saveError`) rather than retrying forever. Every failed save
  // flips `saving` back to false, which re-triggers this effect; without the guard a coach whose
  // connection dropped would fire a doomed PUT every ~second indefinitely and watch the status
  // pill flicker. Nothing is lost — `dirty` stays true, the explicit Retry button is right
  // there, and the next keystroke clears the error and resumes autosaving.
  useEffect(() => {
    if (!dirty || saving || loading || saveError || !data?.canWrite) return;
    const t = setTimeout(() => { void handleSave(); }, 900);
    return () => clearTimeout(t);
  }, [dirty, saving, loading, saveError, data?.canWrite, planSig, handleSave]);

  function updatePlan(next: PracticePlan) {
    setPlan(next);
    setDirty(true);
    setSaveError('');
  }

  /**
   * "Save to my drills…" (D18) — explicit promotion, never automatic.
   *
   * ⚠ It COPIES. Tonight's station is deliberately left exactly as it is: it does not become
   * drill-backed, so it does not turn read-only under the coach's hands the moment they save it.
   * The new drill joins the picker for NEXT time, which is the whole point.
   */
  async function createDrill(input: DrillInput): Promise<{ ok: boolean; error?: string; drill?: RepTeamDrill }> {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/drills`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error ?? 'Could not save that drill.' };
      // Fold it into the picker immediately — a coach who saves a drill and then adds a second
      // station should find it there, without a reload they have no reason to expect.
      setData(d => (d ? { ...d, drills: [...d.drills, json.drill] } : d));
      return { ok: true, drill: json.drill };
    } catch (e) {
      return { ok: false, error: errorMessage(e, 'Could not save that drill.') };
    }
  }

  /**
   * "Save to my circuits…" (stage 4, L9) — the same bargain one size up: a copy, tonight's block
   * untouched, the circuit in the panel and the picker for NEXT time. The editor has already
   * created the tick's drills through `createDrill` above and pointed the shape at them.
   */
  async function createCircuit(input: CircuitInput): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/circuits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error ?? 'Could not save that circuit.' };
      setData(d => (d ? { ...d, circuits: [...d.circuits, json.circuit] } : d));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorMessage(e, 'Could not save that circuit.') };
    }
  }

  /**
   * ⚠⚠ **THE PAST-SEASON ROWS ARE CACHED, AND THE CACHE BELONGS TO ONE TEAM** (`/review` 2026-08-16).
   *
   * This page does NOT unmount when only the `[teamId]` / `[eventId]` segment changes — App Router
   * re-renders the same leaf in place, which is why the main `load()` above carries `loadSeqRef`.
   * The picker's cache needs the same discipline for a worse reason: `pastPlans` is keyed on
   * nothing, so without this it survived a team switch and the "already asked" check
   * (`pastPlans === null`) then refused to re-fetch — a coach planning team B's Tuesday would have
   * been offered TEAM A's past practices, and copying one writes A's words into B's plan through
   * the 900ms autosave. Two failures had to line up, and both were present: a cache with no owner,
   * and a request with no generation.
   */
  const pastSeqRef = useRef(0);
  useEffect(() => {
    // A new team invalidates the answer AND any request still in flight for the old one.
    pastSeqRef.current += 1;
    setPastPlans(null);
    setPastLoading(false);
    setPastError('');
  }, [orgSlug, teamId]);

  /**
   * The third source's rows, fetched the first time the tab is opened for THIS team (P3 C2).
   *
   * ⚠ Re-fetches after a FAILURE but not after a success — a coach who lost the list to a dropped
   * connection can reach it by tapping the tab again, while an ordinary reopen costs nothing.
   */
  const loadPastPlans = useCallback(async () => {
    const seq = ++pastSeqRef.current;
    setPastLoading(true);
    setPastError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/practice-plans/past-seasons`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Past seasons couldn’t be loaded');
      }
      const body: { practices?: PastSeasonPlan[] } = await res.json();
      // ⚠ Every write below is behind the generation check, the FAILURE included: a dead request
      // for the team the coach has left must not replace the list they are now reading, and must
      // not put an error under it either.
      if (seq !== pastSeqRef.current) return;
      setPastPlans(body.practices ?? []);
    } catch (e) {
      if (seq === pastSeqRef.current) setPastError(errorMessage(e, 'Past seasons couldn’t be loaded'));
    } finally {
      if (seq === pastSeqRef.current) setPastLoading(false);
    }
  }, [orgSlug, teamId]);

  function openCopySource(source: CopySource) {
    setCopySource(source);
    setCopyQuery('');
    // `pastPlans === null` means never asked FOR THIS TEAM — the effect above resets it on a switch.
    // An empty array is an ANSWER and is not re-asked.
    if (source === 'past' && pastPlans === null && !pastLoading) void loadPastPlans();
  }

  /**
   * Copy one practice's words onto tonight — the shared body of BOTH practice sources (P3 C2 made
   * it shared rather than growing a second copy of it).
   *
   * A COPY, always (D7). Nothing about this writes to the source practice or to a series.
   * ⚠ `copyPracticePlanForReuse` deliberately drops any `templateId`: this coach started from a
   * PRACTICE, not from a template, and claiming otherwise would inflate that template's count.
   *
   * ⚠ It also drops every player id the CURRENT roster does not hold — which is what makes a
   * past-season source safe without a single extra line. Last October's groups name last October's
   * players; none of them are on this year's roster rows, so the structure arrives and the people
   * do not, exactly as a coach would expect and exactly as the drill import already behaves.
   */
  function applyPlanCopy(source: PracticePlan) {
    if (!data) return;
    const rosterIds = new Set(data.roster.map(p => p.id));
    updatePlan(copyPracticePlanForReuse(source, rosterIds, newPracticePlanId));
    setCopyOpen(false);
  }

  function applyPrevious(previous: PreviousPlan) {
    if (!previous.plan) return;
    applyPlanCopy(previous.plan);
  }

  /**
   * Load a template onto this practice (D14) — **copy-on-load, fully editable**.
   *
   * ⚠ This is the opposite of the drill rule that lives one level down inside the very plan it
   * produces, and both are right: a template is SCAFFOLDING (of course a coach adapts a practice),
   * a drill is an IDENTITY CLAIM. `templateToPlan` preserves every station's `drillId`, so the
   * drill-backed stations inside a loaded template arrive read-only and still count — stripping
   * that would break every drill's count and nothing would fail loudly.
   */
  function applyTemplate(template: PlanTemplateOption) {
    if (!data) return;
    updatePlan(templateToPlan(template, newPracticePlanId));
    // The practice inherits what the template is ABOUT. Ids the team no longer has are dropped
    // rather than sent back and refused — a merged-away tag must not block loading a template.
    const known = new Set(focusTags.map(t => t.id));
    const inherited = template.tags.map(t => t.id).filter(id => known.has(id));
    if (inherited.length > 0) savePlanTags([...new Set([...planTagIds, ...inherited])]);
    setCopyOpen(false);
  }

  /**
   * What this practice is about, and how it went — both PATCH the event, never the plan.
   *
   * ⚠ Saved eagerly on change rather than through the plan's autosave: they are a different act on
   * a different schedule, and sharing the plan's debounce would let an editor that never loaded
   * the recap send it back as empty.
   */
  const patchPractice = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/practice-plan`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'That didn’t save.');
      }
      return true;
    } catch (e) {
      setSaveError(errorMessage(e, 'That didn’t save.'));
      return false;
    }
  }, [orgSlug, teamId, eventId]);

  /**
   * ⚠ Optimistic, but it PUTS THE TAGS BACK if the save fails.
   *
   * The picker shows the new state instantly, which is right — but an earlier version never
   * reverted, so a refused save left the chip on screen looking saved until the next reload
   * quietly dropped it. That is the worst shape a failure can take: the coach is told nothing and
   * believes the opposite of the truth.
   */
  function savePlanTags(next: string[]) {
    const previous = planTagIds;
    setPlanTagIds(next);
    setSaveError('');
    void patchPractice({ tagIds: next }).then(ok => {
      if (!ok) setPlanTagIds(previous);
    });
  }

  /**
   * "How it went" — autosaved on the same rhythm as the plan, because it is a paragraph a coach
   * types and then closes the phone on. `recapDirty` is separate from the plan's `dirty` so the
   * two never clear each other's unsaved state.
   */
  const [recapDirty, setRecapDirty] = useState(false);
  const [recapSaved, setRecapSaved] = useState(false);
  useEffect(() => {
    if (!recapDirty || !data?.canWrite) return;
    const t = setTimeout(async () => {
      // Trimmed to nothing is null, so "nothing written down for this one" has one representation.
      const ok = await patchPractice({ recap: recap.trim() ? recap : null });
      if (ok) { setRecapDirty(false); setRecapSaved(true); }
    }, 900);
    return () => clearTimeout(t);
  }, [recap, recapDirty, data?.canWrite, patchPractice]);

  /**
   * "Save as template…" (frame 04) — explicit promotion, exactly like "Save to my drills…".
   *
   * ⚠ It COPIES. Tonight's plan is left exactly as it is and does NOT become template-backed, so
   * nothing about the practice changes under the coach's hands the moment they save it. Editing
   * this plan later cannot change the template, and editing the template cannot change this plan.
   */
  async function createTemplate(name: string): Promise<{ ok: boolean; error?: string }> {
    try {
      // The practice's own tags travel with it, unasked (owner ruling 2026-09-14): the dialog
      // used to re-ask them pre-filled, which was the same question twice — the Templates room
      // is where a template's tags are edited when one should read broader than tonight.
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/plan-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tagIds: planTagIds, plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error ?? 'Could not save that template.' };
      // Fold it into the picker immediately — a coach who saves one and then wonders where it
      // went should find it there, without a reload they have no reason to expect.
      setData(d => (d ? { ...d, templates: [...d.templates, json.template] } : d));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorMessage(e, 'Could not save that template.') };
    }
  }

  async function handlePrint() {
    if (!data) return;
    const { event, roster, goals, canViewFocus } = data;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    // Resolved to CURRENT tag names (mig 266) — see `resolvePracticePlanTagNames`. The sheet, like
    // the run screen, only ever reads `.staff`/`.equipment` as plain strings; this is what lets a
    // station saved under the new picker still print who's running it and what to bring.
    const resolved = resolvePracticePlanTagNames(plan, staffTags, equipmentTags);
    const clocks = computeBlockClocks(resolved.blocks, event.startsAt, event.endsAt);
    const clockByBlock = new Map(clocks.map(c => [c.blockId, c]));
    const nameOf = (id: string) => {
      const p = roster.find(r => r.id === id);
      return p ? playerDisplayName(p) : '';
    };

    // ⚠ ONE PASS, ONE BLOCK AT A TIME. The run sheet prints each rotation INSIDE the block it
    // was configured on (owner-approved structure, 2026-08-22), so the grid, its honest-arithmetic
    // statements and its group membership are assembled here beside that block's own prose —
    // never flattened into document-level lists that the sheet then has to re-associate.
    //
    // Each block's start comes from the SAME clock walk as the time column (`clock.startMs`),
    // never a second copy of the arithmetic — an earlier duplicate had already drifted on how a
    // "rest of practice" block advances the cursor, so the sheet and the screen disagreed.
    const blocks: PracticeSheetBlock[] = resolved.blocks.map(block => {
      const clock = clockByBlock.get(block.id);
      const time = clock ? `${clock.startLabel}${clock.endLabel ? `–${clock.endLabel}` : ''}` : '';
      // One vocabulary at both levels (stage 2, D3): the block's line says "Watch for:" as its
      // station lines below already do — the word the field screen prints in bold.
      // The block's kit (D11) prints beside the block, where a station's already prints; the
      // block has no legacy names field to resolve into, so its ids are named here directly.
      const blockKit = tagNamesById(block.equipmentTagIds, equipmentTags);
      const notes = [
        block.goal ? `Watch for: ${block.goal}` : '',
        block.description ?? '',
        blockKit.length ? `Equipment: ${blockKit.join(', ')}` : '',
        ...(block.coachingPoints ?? []).map((p, i) => `${i + 1}. ${p}`),
        ...(block.stations ?? []).map(s => {
          // ⚠ The SAME resolver the field screen uses. The sheet is what an assistant running the
          // tee station actually carries, so a station whose teaching came from a drill must print
          // it — and a plan written before the library existed must still print the block's.
          const { description, goal } = resolveStationTeaching(s, block);
          // Read from the STATION, not the resolver: the block's own points are already printed
          // once above, and re-printing them under every station would double them on the page.
          // (Comparing the resolver's array by identity worked, but only by accident of how the
          // fallback happens to return the same reference.)
          const stationPoints = s.coachingPoints ?? [];
          return [
            s.name ? `• ${s.name}` : '',
            // Only when the station says something the block hasn't already said above, so the
            // sheet doesn't print the same sentence twice for a single-station block.
            description && description !== block.description ? description : '',
            goal && goal !== block.goal ? `Watch for: ${goal}` : '',
            s.setup ? `Setup: ${s.setup}` : '',
            // "Kit" was the pre-2026-08-01 name, and equipment is a LIST — the old template
            // interpolated the array itself, printing "Screen,Balls,Net" with no spaces.
            s.equipment?.length ? `Equipment: ${s.equipment.join(', ')}` : '',
            s.staff?.length ? `Run by ${s.staff.join(', ')}` : '',
            s.playerIds?.length ? s.playerIds.map(nameOf).filter(Boolean).join(', ') : '',
            s.rotationNote ? `Rotation: ${s.rotationNote}` : '',
            s.note ? `Tonight: ${s.note}` : '',
            ...stationPoints.map(p => `– ${p}`),
          ].filter(Boolean).join(' · ');
        }),
      ].filter(Boolean).join('\n');

      // The rotation of THIS block, when it has one.
      //
      // ⚠ An UNFINISHED rotation still prints. `computeRotation` returns no rounds but a
      // statement saying what is missing ("Add how often groups move…") — the sheet used to
      // drop the whole thing, so a coach reading only the paper had no idea a station plan was
      // ever intended. It now prints the statement and whatever groups exist, with no grid.
      let rotation: PracticeSheetRotation | null = null;
      if (blockRotates(block) && block.rotation) {
        const grid = computeRotation(
          block.rotation, block.stations, block.duration.minutes ?? null, clock?.startMs,
        );
        // Columns are the groups in the rotation's own order; each round's row reads that group's
        // station by ID — never by cell position, because a hand-arranged grid (D14) can put a
        // group anywhere in a round or sit it out, and the paper must say which.
        const { groups: printed } = rotationShape(block.rotation, block.stations, block.duration.minutes ?? null);
        rotation = {
          groupNames: printed.map(g => g.name),
          rounds: grid.roundsList.map(r => {
            const at = new Map(r.cells.map(c => [c.groupId, c.stationName || '—']));
            const out = new Set(r.out.map(o => o.groupId));
            return {
              round: `${r.round}${r.startLabel ? ` (${r.startLabel})` : ''}`,
              stations: printed.map(g => at.get(g.id) ?? (out.has(g.id) ? 'sits out' : '—')),
            };
          }),
          notes: grid.notes,
          groups: block.rotation.groups.map(g => ({
            name: g.name,
            players: g.playerIds.map(nameOf).filter(Boolean).join(', '),
          })),
        };
      }

      return {
        time,
        title: block.title || '(untitled)',
        duration: formatDuration(block.duration),
        staff: (block.staff ?? []).join(', '),
        players: (block.playerIds ?? []).map(nameOf).filter(Boolean).join(', '),
        notes,
        rotation,
      };
    });

    // ⚠ Focus areas print ONLY when the plan carries the section (the paper follows the screen —
    // 2026-09-14) AND the person generating the sheet can see them. An assistant without `notes`
    // gets the same sheet with the section absent — and the data never reached their browser in
    // the first place, so there is nothing here to forget to hide.
    const focus = plan.includeFocusAreas && canViewFocus
      ? roster.map(p => ({
          player: playerDisplayName(p),
          // Separated by a middot, not a comma: a focus area is a SENTENCE ("Backhand pickups —
          // glove out front, working through the ball"), and joining two of them with a comma made
          // one player’s two goals read as a single run-on line on the printed sheet.
          focusAreas: goals.filter(g => g.playerId === p.id && g.status === 'working').map(g => g.focusArea).join('  ·  '),
        })).filter(row => row.focusAreas)
      : [];

    const whereLabel = [
      event.startsAt ? fmtTime(event.startsAt) : '',
      event.arrivalTime ? `Arrive ${event.arrivalTime}` : '',
      [event.location, event.fieldNumber].filter(Boolean).join(', '),
    ].filter(Boolean).join('  ·  ');

    await downloadPracticeSheet(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'practice-plan', scope: event.name || 'practice' }, 'pdf'),
      {
        teamName: assignment?.teamName ?? teamId,
        dateLabel: event.startsAt ? fmtDate(event.startsAt) : '',
        whereLabel,
        goal: plan.goal ?? null,
        // What the practice is ABOUT: its tags now, plus any legacy free-text labels a plan
        // written before Phase 3 still carries. ⚠ The sheet is subject to the same vocabulary
        // rule as the screen — these describe what was PLANNED, and the sheet says nothing about
        // what was done.
        description: plan.description ?? null,
        practiceTypes: [...tagNamesById(planTagIds, focusTags), ...(plan.practiceTypes ?? [])],
        // The head prints the BAG (stage 2, D11) — everything the blocks and stations below need
        // plus the coach's extras — the same walk the sheet's About line reads on screen.
        equipment: practiceKitBag(plan, equipmentTags).all,
        blocks, focus, settings,
      },
    );
  }

  // ── Render ──
  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const event = data?.event;
  /* ⚠ THE TITLE STAYS IN THE PAGE HEADER (stage 1 build call 1). The frame drew "← Practice plans"
     as a bare link with the title inside the sheet; the house rule is ONE page header per page
     with the back arrow in it (a fourth bare back-link is drift, and the page-actions guard
     enumerates this site). The sheet's head therefore opens on the WHEN line — the ruling's own
     home for a framing line is the card it frames. D8: the way back is Practice plans. */
  const header = (
    <CoachPageHeader
      icon={ClipboardList}
      title={event?.name || 'Practice plan'}
      helpLabel="Practice plan"
      help={practiceHelpRequest}
      backTo={{ href: `${base}/practice`, label: 'Practice plans' }}
    />
  );

  if (!canSchedule) {
    return (
      <div className={`${styles.page} ${styles.pageWide}`}>
        {header}
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={22} />}
          headline="Practice plans aren't enabled for you"
          description="A practice plan lives on the practice itself — the blocks, the stations and who's where."
          blocker="Ask your head coach to give you schedule access."
        />
      </div>
    );
  }

  const canWrite = data?.canWrite ?? false;
  // The pair renders only when the width allows AND the coach chose it — the blank page docks
  // through its ghost row, which sets `docked` first.
  const isDocked = canWrite && canDock && docked;
  const previousWithPlans = (data?.previousPlans ?? []).filter(p => p.plan);
  const hasPastSeasonPlans = data?.hasPastSeasonPlans ?? false;
  // Read once here so the picker below (which renders outside the `!data` guard) never has to
  // null-check the load state mid-JSX.
  const templates = data?.templates ?? [];
  // ONE definition of "is there a plan here", shared with the save path — otherwise a
  // whitespace-only goal reads as a plan on screen while the save path nulls the column.
  const hasPlan = !isPracticePlanEmpty(plan);
  // The toolbar (stage 1, D5) reads the hub's definition of "has a plan" — at least one block. A
  // goal typed and nothing else is a savable row (`hasPlan` above), not something to run or print.
  const hasBlocks = practiceHasPlan({ practicePlan: plan });

  /* The sheet's first line (stage 1, D3): how long the practice is, and how the plan fills it.
     The length comes from the same helper the hub's "60 of 90 min" reads, so the two cannot
     disagree; the fill is timed minutes only, with a rest-of-practice block named as such. */
  const practiceLength = event?.startsAt ? practiceLengthMinutes(event.startsAt, event.endsAt) : null;
  const fit = practicePlanFit(plan, practiceLength);
  const remainderLabel = practiceRemainderLabel(fit);
  // Unplanned time and an overrun are both worth a coach's eye; the rest block is spoken for.
  const remainderTone = fit.remainder?.kind === 'rest' ? undefined : styles.ppDocWhenAmber;
  const started = practiceStarted(event?.startsAt, nowMs);

  /**
   * The sheet's first line — three shapes, one flat function (the `renderPickList` idiom: a
   * called function, never a component declared in the render body).
   *   · no start (should not happen for a loaded practice) → "Plan this practice."
   *   · no end → "20 min planned · no end set · Set it on the schedule ›"
   *   · an end → "0 of 120 min planned · 120 unplanned" (the remainder in amber)
   */
  function renderWhenLine() {
    if (!event?.startsAt) return <span className={styles.ppDocWhenLine}>Plan this practice.</span>;
    const scheduleHref = `${base}/schedule?event=${eventId}`;
    // The day and the clock share one line on a desktop; the phone stacks them (the frame's 390).
    const when = (
      <span className={styles.ppDocWhenLine}>
        <span className={styles.ppDocWhenDay}>{fmtDay(event.startsAt)}</span>
        <span className={styles.ppDocWhenSep}> · </span>
        {fmtTime(event.startsAt)}
        {practiceLength != null && event.endsAt ? `–${fmtTime(event.endsAt)} · ${practiceLength} min` : ''}
      </span>
    );
    if (practiceLength == null) {
      // Without an end the frame cannot be drawn; the fix is on the schedule. An end that IS set
      // but sits at or before the start is said so — "no end set" would be a lie about a field
      // the coach can see filled (/review, 2026-09-14).
      const why = event.endsAt ? 'the end is before the start' : 'no end set';
      return (
        <>
          {when}
          {practicePlannedLabel(fit)} · {why} ·{' '}
          <Link href={scheduleHref} className={styles.ppDocWhenLink}>
            {event.endsAt ? 'Fix it on the schedule ›' : 'Set it on the schedule ›'}
          </Link>
        </>
      );
    }
    return (
      <>
        {when}
        {practicePlannedLabel(fit)}
        {remainderLabel && <> · <span className={remainderTone}>{remainderLabel}</span></>}
      </>
    );
  }

  /** The picker's name search, shared by the two practice sources so they cannot drift. */
  const matchesQuery = (name: string) => {
    const q = copyQuery.trim().toLowerCase();
    return !q || name.toLowerCase().includes(q);
  };

  /**
   * The picker's list body — one branch per source, each with its own early return.
   *
   * ⚠ A plain FUNCTION that is called (`{renderPickList()}`), never a component rendered as
   * `<RenderPickList />`. The distinction is the one this file's own `SaveAsTemplateDialog` note
   * is about: a component declared in a render body is a new type every render and remounts its
   * subtree. A called function just returns nodes into the parent's tree, so nothing remounts and
   * the search box keeps its focus between keystrokes.
   */
  function renderPickList() {
    if (copySource === 'template') {
      if (templates.length === 0) {
        return (
          <p className={styles.formHint}>
            No templates yet — save a practice that went well as a template and next Tuesday starts from it.
          </p>
        );
      }
      // The SAME predicate the drill library and the template room use — one rule, so the three
      // lists can never drift on what the search box looks at.
      // ⚠ Only a template that HOLDS A BLOCK is offered as a start (stage 4, L4): an empty one is
      // listed on its tab reading "Nothing in it yet", one click from the editor that finishes it,
      // and never here. "Start from blank" stays where it was.
      const startable = filterTagged(templates.filter(t => t.plan.blocks.length > 0), copyQuery, null);
      if (startable.length === 0) return <p className={styles.formHint}>No template with a block in it matches that.</p>;
      return startable.map(template => (
        <button key={template.id} type="button" className={styles.ppPickRow}
          onClick={() => applyTemplate(template)}>
          <span className={styles.ppPickBody}>
            <span className={styles.ppPickName}>
              {template.name}
              {template.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
            </span>
            {/* The blocks' titles under the name, as the tab reads them (L3); the shape beside. */}
            <span className={styles.ppPickMeta}>{templateBlocksLine(template.plan)} · {templateShapeLabel(template.plan)}</span>
          </span>
        </button>
      ));
    }

    if (copySource === 'previous') {
      if (previousWithPlans.length === 0) {
        return <p className={styles.formHint}>No other practice this season has a plan yet.</p>;
      }
      return previousWithPlans.filter(p => matchesQuery(p.name)).map(previous => (
        <button key={previous.eventId} type="button" className={styles.ppPickRow}
          onClick={() => applyPrevious(previous)}>
          <span className={styles.ppPickBody}>
            <span className={styles.ppPickName}>{previous.name}</span>
            <span className={styles.ppPickMeta}>
              {fmtDate(previous.startsAt)} · {previous.plan!.blocks.length} block
              {previous.plan!.blocks.length === 1 ? '' : 's'}
            </span>
          </span>
        </button>
      ));
    }

    // ── A past season: the only source that has to be fetched, so the only one with four states.
    if (pastLoading) return <p className={styles.formHint}>Looking back…</p>;
    if (pastError) {
      return (
        <p className={styles.errorText} role="alert">
          {pastError}{' '}
          <button type="button" className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
            onClick={() => void loadPastPlans()}>
            Try again
          </button>
        </p>
      );
    }
    const past = pastPlans ?? [];
    if (past.length === 0) {
      return (
        <p className={styles.formHint}>
          Nothing from a previous season yet — the practices you plan this year will be here next year.
        </p>
      );
    }
    return past.filter(p => matchesQuery(p.name)).map(row => (
      <button key={row.eventId} type="button" className={styles.ppPickRow}
        onClick={() => applyPlanCopy(row.plan)}>
        <span className={styles.ppPickBody}>
          <span className={styles.ppPickName}>{row.name}</span>
          {/* ⚠ THE SEASON LEADS THE META LINE, ahead of the date. These are the only rows in this
              dialog that are not from the season being planned, and a row a coach could mistake
              for this year's work is the one way this source can do harm. A season whose row has
              since gone says so rather than showing a bare date that reads as recent. */}
          <span className={styles.ppPickMeta}>
            {row.seasonName ?? 'An earlier season'}
            {row.startsAt ? ` · ${fmtDate(row.startsAt)}` : ''}
            {' · '}{row.plan.blocks.length} block{row.plan.blocks.length === 1 ? '' : 's'}
          </span>
        </span>
      </button>
    ));
  }

  return (
    /* Docked (L5), the page takes the wide column so the pair — the sheet at 816 and the 320 panel —
       fills exactly what the header fills; undocked it is `.page`'s own 960, the sheet alone. */
    <div ref={columnRef} className={`${styles.page} ${styles.savePillPage}${isDocked ? ` ${styles.pageWide}` : ''}`}>
      {header}
      <UnsavedChangesGuard active={dirty} />

      {loading ? (
        <div className={styles.loadingState}>Loading practice…</div>
      ) : loadError ? (
        <p className={styles.errorText}>{loadError}</p>
      ) : !data ? null : (
        <div className={styles.ppSheetCol}>
          {/* ── The practice-week bridge (Scouting Book P3, plan §4.9) ──
              One quiet line above the sheet: Saturday's intelligence while Tuesday's plan is
              being built. Read-only glance — capture and curation stay on the book's own
              surfaces. Absent when the week has no booked opponent with book content, absent
              in archives (this screen is the LIVE planner; the read-only past-plan door is a
              different route that never assembles the bridge), and never a pop-up. */}
          {data.scoutingBridge && (
            <div className={styles.ppScoutBridge}>
              <p className={styles.ppScoutBridgeLead}>
                <Telescope size={14} aria-hidden />
                <span>
                  You play <strong>{data.scoutingBridge.opponentName}</strong>{' '}
                  {formatInOrgZone(data.scoutingBridge.gameStartsAt, { weekday: 'long' })} — the book:
                </span>
              </p>
              {data.scoutingBridge.summary && (
                <p className={styles.ppScoutBridgeLine}>&ldquo;{data.scoutingBridge.summary}&rdquo;</p>
              )}
              {data.scoutingBridge.latestObservation && (
                <p className={styles.ppScoutBridgeObs}>
                  {data.scoutingBridge.latestObservation.body}
                  {data.scoutingBridge.latestObservation.createdByName && (
                    <span> — {data.scoutingBridge.latestObservation.createdByName}</span>
                  )}
                </p>
              )}
              <Link
                href={`${base}/history/opponents/${encodeURIComponent(data.scoutingBridge.opponentKey)}`}
                className={styles.ppScoutBridgeLink}
              >
                Full book
                {data.scoutingBridge.observationCount > 0
                  ? ` · ${data.scoutingBridge.observationCount} observation${data.scoutingBridge.observationCount === 1 ? '' : 's'}`
                  : ''} ›
              </Link>
            </div>
          )}

          {/* An honest empty state: what a plan is, what it unlocks, and what's blocking. */}
          {!hasPlan && !canWrite && (
            <CoachEmptyState
              quiet
              icon={<ClipboardList size={22} />}
              headline="No plan for this practice yet"
              description="A practice plan is the blocks of this practice — how long each runs, who's running it, and who's where."
              blocker="Writing the plan comes with Schedule: View + edit — ask your head coach. You'll be able to read and print it once there is one."
            />
          )}

          {/* A nudge, not the page's action: the sheet under it carries the one lime (stage 1,
              D5), so the roster door is the quiet variant with a secondary button — two limes on
              a new team's first practice was the /review catch (2026-09-14). */}
          {!hasPlan && canWrite && data.roster.length === 0 && (
            <CoachEmptyState
              quiet
              icon={<ClipboardList size={22} />}
              headline="Add your roster first"
              description="A practice plan puts your players into blocks, stations and groups."
              payoff="With a roster in place you can draw groups at random and print a sheet for whoever's running each station."
              secondaryAction={{ href: `${base}/roster`, label: 'Go to the roster' }}
            />
          )}

          {(hasPlan || canWrite) && (
            <>
              {/* ── The toolbar — only once there is a plan (stage 1, D5) ──
                  The blank page has no toolbar and no disabled Print: its one action is the
                  first block, inside the sheet. "Start this plan from…" moved into the sheet
                  too, as the ghost row's quiet alternative. What stays up here is what a
                  written plan earns: the promotion and the paper.
                  ⚠ NO "Run practice" here (owner ruling 2026-09-14). The builder offered the
                  field door at ANY date and the run screen then counted the days; the door lives
                  where the day is known — the hub card and the Overview card, inside the run
                  window. Whether the plan page earns one back, and where, is stage 5's ruling. */}
              {hasBlocks && (
                <div className={`${styles.ppToolbar} ${styles.ppToolbarFlush}`}>
                  {/* Explicit promotion, never automatic — the "Save to my drills…" bargain, one
                      level up. */}
                  {canWrite && (
                    <button type="button" className={styles.btnSecondary} onClick={() => setSaveTemplateOpen(true)}>
                      <BookMarked size={14} aria-hidden /> Save as template…
                    </button>
                  )}
                  <button type="button" className={styles.btnSecondary} onClick={handlePrint}>
                    <Printer size={14} aria-hidden /> Print the sheet
                  </button>
                  {/* The docked library's quiet toggle (stage 4, L5), at the toolbar's right end — pressed
                      while docked. ABSENT below a 1,156px working column, not disabled: a 1,366 laptop
                      never sees it and keeps the sheet. On the blank page (no toolbar yet) the ghost
                      row's own words do this job. */}
                  {canWrite && canDock && (
                    <button type="button" className={`${styles.btnSecondary} ${styles.ppToolbarEnd}`} aria-pressed={docked}
                      data-on={docked ? 'on' : undefined} data-testid="library-toggle" onClick={() => dock(!docked)}>
                      <Library size={14} aria-hidden /> Library
                    </button>
                  )}
                </div>
              )}

              {/* ── THE PAIR (L5): the sheet, and beside it — docked, on a wide desktop — the library
                  panel's HOST. The editor renders the panel into it through a portal, so the page
                  owns the layout and the editor owns the one drag context over both. Undocked, the
                  host is empty and the sheet fills the column as it always did. ── */}
              <div className={`${styles.ppSheetPair}${isDocked ? ` ${styles.ppSheetPairDocked}` : ''}`}>

              {/* ── THE SHEET (stage 1, D2) — the page is a document. Its first line is when and
                  how long (D3); the goal, the folds and the timeline are the editor's. */}
              <div className={styles.ppDoc} data-room="practice-plan" data-room-state="loaded">
                <div className={styles.ppDocHead}>
                  <div className={styles.ppDocWhen}>{renderWhenLine()}</div>
                  {event && (
                    <Link href={`${base}/schedule?event=${eventId}`} className={styles.ppDocHeadLink}>
                      <CalendarDays size={12} aria-hidden /> View on schedule
                    </Link>
                  )}
                </div>

                {/* ── The provenance line (D14, frame 05) ──
                    ⚠ It is doing real work, not decoration: without it a coach reasonably fears that
                    fixing tonight's warm-up rewrites the template for every future Tuesday. It says
                    the quiet part out loud — every edit here is THIS practice's. It survives every
                    edit, because "this plan started from Standard Tuesday" stays true however much
                    they change; that is the opposite of a drill's provenance, and deliberately so. */}
                {plan.templateName && (
                  <p className={styles.ppProvenance}>
                    <BookMarked size={14} aria-hidden />
                    {/* One sentence (stage 4, L7): the two halves that do the work — "edit anything"
                        and "the template won't change" — and the template's name bold, because it is
                        the fact. Survives every edit, as it always has. */}
                    <span>
                      Started from <strong>{plan.templateName}</strong> — edit anything here; the template won&apos;t change.
                    </span>
                  </p>
                )}

                <PracticePlanEditor
                  // Keyed per practice so the editor's own state (which block is open, the folds)
                  // resets on a same-leaf event switch BY DESIGN, not by the loading branch's
                  // accident of unmounting it (/review, 2026-09-14).
                  key={eventId}
                  plan={plan}
                  onChange={updatePlan}
                  roster={data.roster}
                  goals={data.goals}
                  canViewFocus={data.canViewFocus}
                  attendance={data.attendance}
                  canViewAttendance={data.canViewAttendance}
                  focusManage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
                  onFocusTagsChanged={reloadFocusTags}
                  staffManage={{ ...STAFF_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/staff-tags` }}
                  onStaffTagsChanged={reloadStaffTags}
                  equipmentManage={{ ...EQUIPMENT_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/equipment-tags` }}
                  onEquipmentTagsChanged={reloadEquipmentTags}
                  drills={data.drills}
                  circuits={data.circuits}
                  onCreateCircuit={canWrite ? createCircuit : undefined}
                  library={canWrite ? { canDock, docked: isDocked, onDock: dock, panelHost, circuitsHref: practicePlansHref(base, 'circuits') } : undefined}
                  // Absent for a viewer who can't write drills, which removes "Save to my drills…"
                  // entirely rather than offering a control that only exists to refuse.
                  onCreateDrill={canWrite ? createDrill : undefined}
                  focusTags={focusTags}
                  onCreateFocusTag={canWrite ? createFocusTag : undefined}
                  staffTags={staffTags}
                  onCreateStaffTag={canWrite ? createStaffTag : undefined}
                  equipmentTags={equipmentTags}
                  onCreateEquipmentTag={canWrite ? createEquipmentTag : undefined}
                  planTagIds={planTagIds}
                  onChangePlanTags={savePlanTags}
                  eventStartsAt={event?.startsAt ?? ''}
                  eventEndsAt={event?.endsAt ?? null}
                  readOnly={!canWrite}
                  // ⚠ ONE control, THREE sources (frame 05; P3 C2 added the third) — never a
                  // second door. Offered on the blank page when there is anything at all to
                  // start from, which from P3 C2 includes a past season: without that clause the
                  // coach planning the first practice of a brand-new season, with no templates
                  // yet, saw no door at all — and they are precisely who the third source exists
                  // for. The editor hides it the moment a block exists (stage 1, D5).
                  onStartFrom={
                    canWrite && (previousWithPlans.length > 0 || templates.length > 0 || hasPastSeasonPlans)
                      ? () => {
                          setCopyOpen(true);
                          // Land on the fullest source the coach has, in order of nearness to tonight.
                          openCopySource(
                            templates.length > 0 ? 'template'
                              : previousWithPlans.length > 0 ? 'previous'
                                : 'past',
                          );
                        }
                      : undefined
                  }
                />

                {/* ── "How it went" (D17, frame 07) — ABSENT until the practice has started
                    (stage 1, D7; stage 6 owns anything finer than "the start has passed") ──
                    A SECOND, SEPARATE section under the plan, on the same principle as "Recorded
                    here" below: the plan is what you INTENDED, this is what you thought afterwards.
                    It is one of only two things on this screen allowed to describe reality, and it
                    earns that because a coach sat down at home and typed it.

                    ⚠ **ABOUT THE PRACTICE, NEVER ABOUT A CHILD** — D17's hard guardrail. The
                    placeholder and the helper line both steer away from names, there is
                    deliberately no per-player equivalent, and none may be added: per-child
                    commentary would drift into behavioural profiling on minors.

                    ⚠ This does NOT reopen D4. An unhurried note written at home is a different act
                    from an abandoned tick-box mid-drill — nothing at the field records anything,
                    and there are still no per-block "we ran it" ticks. */}
                {!started ? (
                  <p className={styles.ppDocNote}>&ldquo;How it went&rdquo; appears here once the practice has started.</p>
                ) : (
                  <div className={styles.ppDocFoot}>
                    <h2 className={styles.ppRecordedTitle}><NotebookPen size={15} aria-hidden /> How it went</h2>
                    <p className={styles.formHint}>For you and your staff. Families never see this.</p>
                    {canWrite ? (
                      <label className={styles.ppField}>
                        <span className="sr-only">How it went</span>
                        <textarea
                          className={styles.textarea}
                          rows={4}
                          value={recap}
                          maxLength={MAX_RECAP_LEN}
                          placeholder="What would you do differently next time?"
                          aria-label="How it went"
                          onChange={e => { setRecap(e.target.value); setRecapDirty(true); setRecapSaved(false); }}
                        />
                        <span className={styles.formHint} aria-live="polite">
                          {recapDirty ? 'Saving…' : recapSaved ? 'Saved · about the practice, not about a player'
                            : 'About the practice, not about a player'}
                        </span>
                      </label>
                    ) : recap ? (
                      <p className={styles.ppReadTxt}>{recap}</p>
                    ) : (
                      // ⚠ Silence is stated, never rendered blank — a practice with nothing written
                      // must not read as a practice where nothing happened.
                      <p className={styles.ppRecapNone}>Nothing written down for this one.</p>
                    )}
                  </div>
                )}
              </div>
              {isDocked && <div ref={setPanelHost} className={styles.ppLibraryHost} />}
              </div>
            </>
          )}

          {/* ── "Recorded here" (§10.2) ──
              A SECOND, SEPARATE section beside the plan, deliberately: the plan is what you
              INTENDED; this is what actually got measured. It is the one thing on this screen
              allowed to say something happened, and it earns that because a coach typed real
              numbers into it. That is why it is kept apart from the plan rather than folded in. */}
          {data.sessions.length > 0 && (
            <div className={styles.ppRecorded}>
              <h2 className={styles.ppRecordedTitle}><Ruler size={15} aria-hidden /> Recorded here</h2>
              <p className={styles.formHint}>Evaluation sessions recorded at this practice — a session here takes the practice’s date.</p>
              <ul className={styles.ppRecordedList}>
                {data.sessions.map(session => {
                  const label = `${formatInOrgZone(`${session.sessionDate}T12:00:00Z`, { month: 'short', day: 'numeric', year: 'numeric' })}${session.note ? ` — ${session.note}` : ''}`;
                  // A session's page opens with the Development grant only (stage 0, D5): the
                  // link is offered to a coach who holds it; everyone else reads the line.
                  return (
                    <li key={session.id}>
                      {canOpenSessions ? <Link href={`${base}/development/sessions/${session.id}`}>{label}</Link> : label}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* The autosave word, floating at the window's foot (owner, 2026-09-14) — the bar it
          replaced held nothing else. */}
      {canWrite && !loading && !loadError && (
        <SaveStatusPill saving={saving} dirty={dirty} error={saveError} onRetry={handleSave} />
      )}

      {/* ── "Start this plan from…" — ONE picker, THREE sources (frame 05; P3 C2) ──
          The "previous practice" half is slice 1a's control, widened rather than joined by a
          rival door: a coach reaching for last Tuesday and a coach reaching for their standard
          Tuesday are answering the same question, and two buttons would make them choose a
          filing system before they could answer it. "A past season" arrives on exactly that
          argument — a coach reaching for last October is asking the same question again, and
          before C2 the only answer was to import the practice into the template library first
          (five steps, and a library permanently grown to reuse one night). */}
      {copyOpen && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) setCopyOpen(false); }}>
          <div ref={copyPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Start this plan from"
            className={`${styles.modal} ${styles.modalScrollBody}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Start this plan from…</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={() => setCopyOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* All three tabs are always offered; a source with nothing in it says so inside
                rather than vanishing, so the routes stay learnable. ⚠ "A past season" is offered
                even when this team has none — its empty state is the sentence that teaches a
                first-year coach the feature exists for next autumn. */}
            <div className={styles.ppSourceTabs} role="tablist" aria-label="Where to start from">
              {COPY_SOURCES.map(source => (
                <button key={source.id} type="button" role="tab" className={styles.ppSourceTab}
                  aria-selected={copySource === source.id}
                  data-on={copySource === source.id ? 'on' : undefined}
                  onClick={() => openCopySource(source.id)}>
                  {source.label}
                </button>
              ))}
            </div>

            <p className={styles.formHint} style={{ padding: '0.5rem 0' }}>
              {COPY_SOURCES.find(s => s.id === copySource)?.hint}
            </p>

            <input className={styles.input} value={copyQuery} onChange={e => setCopyQuery(e.target.value)}
              placeholder={copySource === 'template' ? 'Search templates…' : 'Search practices…'}
              aria-label={copySource === 'template' ? 'Search templates' : 'Search practices'} />

            {/* ⚠ The branch dispatch lives in `renderPickList` rather than in a ternary chain here.
                With three sources it had become one 78-line expression whose last four clauses were
                all secretly the third source's states — the code no longer looked like the "three
                sources" it implements, and a fourth would have been threaded through by matching
                brackets. */}
            <div className={styles.ppPickList}>{renderPickList()}</div>
          </div>
        </div>
      )}

      {/* ── "Save as template…" (frame 04) — exactly ONE question: the name ── */}
      {saveTemplateOpen && (
        <SaveAsTemplateDialog
          defaultName={event?.name ?? ''}
          onSave={createTemplate}
          onClose={() => setSaveTemplateOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * "Save as template…" — one optional question, mirroring "Save to my drills…" from Phase 2.
 *
 * ⚠ **An empty name is REJECTED here and never in the plan editor**, and that asymmetry is
 * deliberate: this is an explicit submit, so a nameless template is a mistake worth reporting.
 * The autosaving editor never discards a row for being empty, because a coach pressed "Add" and is
 * mid-typing. Same codebase, opposite rules — the distinguishing fact is whether a human pressed
 * a button.
 *
 * ⚠ At MODULE level, never inside the page's render body: a component declared in a render body is
 * a new type on every render, so React remounts its subtree and this form would lose focus on
 * every keystroke.
 */
function SaveAsTemplateDialog({
  defaultName, onSave, onClose,
}: {
  defaultName: string;
  onSave: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /* The dialog floor (stage 2, D9), busy-gated: Escape closes, never mid-save; the name field's
     own autoFocus keeps the cursor (the floor seats focus on the panel only when nothing inside
     took it). */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose, busy });

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    const result = await onSave(name.trim());
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not save that template.'); return; }
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Save as template"
        aria-busy={busy || undefined} className={`${styles.modal} ${styles.modalScrollBody}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Save as template</h3>
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.ppDrillWrite}>
          <label className={styles.ppField}>
            <span className={styles.ppFieldLabel}>Name</span>
            <input className={styles.input} value={name} maxLength={MAX_TEMPLATE_NAME_LEN} autoFocus
              placeholder="What would you call this practice?"
              onChange={e => setName(e.target.value)} />
          </label>

          {/* ⚠ Says what does NOT happen, on purpose. A coach saving a template mid-plan needs to
              know tonight is untouched and that later edits won't leak either way. */}
          <p className={styles.formHint}>
            Saves the blocks, stations, timings and what this practice is about, as they are now.{' '}
            <strong>It does not change tonight&apos;s practice</strong>, and editing this plan later
            won&apos;t change the template. Players and staff aren&apos;t saved — the practice
            supplies those. You can change the template&apos;s name and tags on the Templates tab.
          </p>

          {error && <p className={styles.errorText} role="alert">{error}</p>}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.btnPrimary} disabled={busy || !name.trim()} onClick={submit}>
              {busy ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
