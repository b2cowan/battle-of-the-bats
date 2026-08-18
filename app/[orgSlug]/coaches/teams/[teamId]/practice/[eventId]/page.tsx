'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookMarked, CalendarDays, Check, ClipboardList, Copy, NotebookPen, Play, Printer, Ruler, Telescope, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import {
  buildFilename, downloadPracticeSheet, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import {
  MAX_RECAP_LEN,
  blockRotates, computeBlockClocks, computeRotation, copyPracticePlanForReuse, emptyPracticePlan,
  formatDuration, isPracticePlanEmpty, newPracticePlanId, resolveStationTeaching,
  type PracticePlan,
} from '@/lib/rep-practice-plan';
import {
  MAX_TEMPLATE_NAME_LEN, templateShapeLabel, templateToPlan,
} from '@/lib/rep-plan-templates';
import { filterTagged } from '@/lib/rep-drills';
import TagPicker from '@/components/coaches/TagPicker';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import PracticePlanEditor, {
  type PracticeFocusGoal, type PracticeRosterPlayer,
} from '../_PracticePlanEditor';
import type { DrillInput, RepTeamDrill } from '@/lib/rep-drills';
import type { PracticeWeekScoutingBridge } from '@/lib/coach-opponent-nudge';
import type { PickableTag } from '@/components/coaches/TagPicker';
import CoachBackLink from '@/components/coaches/CoachBackLink';
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
  canWrite: boolean;
  canViewFocus: boolean;
  canViewAttendance: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

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

const fmtDate = (iso: string) =>
  formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });

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
  const { tags: focusTags, setTags: setFocusTags, createTag: createFocusTag } =
    useFocusTags(orgSlug, teamId, { skipFetch: true });
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
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  // Org PDF settings (branding) — optional; the sheet falls back to defaults.
  useEffect(() => {
    fetch(`/api/admin/org/pdf-settings?orgSlug=${orgSlug}`)
      .then(r => (r.ok ? r.json() : {}))
      .then(d => setPdfSettings(d as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgSlug]);

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
      setDirty(false);
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      setLoadError(errorMessage(e, 'Could not load this practice'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
    // `setFocusTags` comes from the shared vocabulary hook rather than a local `useState`, so the
    // linter can't see that it is a stable setter — it is, and listing it re-runs nothing.
  }, [orgSlug, teamId, eventId, setFocusTags]);

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
  async function createDrill(input: DrillInput): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/drills`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error ?? 'Could not save that drill.' };
      // Fold it into the picker immediately — a coach who saves a drill and then adds a second
      // station should find it there, without a reload they have no reason to expect.
      setData(d => (d ? { ...d, drills: [...d.drills, json.drill] } : d));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorMessage(e, 'Could not save that drill.') };
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
  async function createTemplate(name: string, tagIds: string[]): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/plan-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tagIds, plan }),
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
    const clocks = computeBlockClocks(plan.blocks, event.startsAt, event.endsAt);
    const clockByBlock = new Map(clocks.map(c => [c.blockId, c]));
    const nameOf = (id: string) => {
      const p = roster.find(r => r.id === id);
      return p ? playerDisplayName(p) : '';
    };

    const blocks = plan.blocks.map(block => {
      const clock = clockByBlock.get(block.id);
      const time = clock ? `${clock.startLabel}${clock.endLabel ? `–${clock.endLabel}` : ''}` : '';
      const notes = [
        block.goal ? `Goal: ${block.goal}` : '',
        block.description ?? '',
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
      return {
        time,
        title: block.title || '(untitled)',
        duration: formatDuration(block.duration),
        staff: (block.staff ?? []).join(', '),
        players: (block.playerIds ?? []).map(nameOf).filter(Boolean).join(', '),
        notes,
      };
    });

    // One grid per rotation, plus its plain statements — the artifact a document can't produce.
    // Each block's start comes from the SAME clock walk as the time column above (`clock.startMs`),
    // never a second copy of the arithmetic — an earlier duplicate had already drifted on how a
    // "rest of practice" block advances the cursor, so the sheet and the screen disagreed.
    const rotations: NonNullable<Parameters<typeof downloadPracticeSheet>[1]['rotations']> = [];
    const groupRows: { label: string; group: string; players: string }[] = [];
    for (const block of plan.blocks) {
      if (!blockRotates(block) || !block.rotation) continue;
      const grid = computeRotation(block.rotation, block.stations, block.duration.minutes ?? null, clockByBlock.get(block.id)?.startMs);
      const label = `Rotation — ${block.title || 'Untitled'}`;
      if (grid.roundsList.length > 0) {
        rotations.push({
          label,
          groupNames: grid.roundsList[0].cells.map(c => c.groupName),
          rounds: grid.roundsList.map(r => ({
            round: `${r.round}${r.startLabel ? ` (${r.startLabel})` : ''}`,
            stations: r.cells.map(c => c.stationName || '—'),
          })),
          notes: grid.notes,
        });
      }
      for (const group of block.rotation.groups) {
        groupRows.push({
          label: block.title || 'Rotation',
          group: group.name,
          players: group.playerIds.map(nameOf).filter(Boolean).join(', '),
        });
      }
    }

    // ⚠ Focus areas print ONLY when the person generating the sheet can see them. An assistant
    // without `notes` gets the same sheet with the section absent — and the data never reached
    // their browser in the first place, so there is nothing here to forget to hide.
    const focus = canViewFocus
      ? roster.map(p => ({
          player: playerDisplayName(p),
          focusAreas: goals.filter(g => g.playerId === p.id && g.status === 'working').map(g => g.focusArea).join(', '),
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
        practiceTypes: [
          ...planTagIds.map(id => focusTags.find(t => t.id === id)?.name).filter((n): n is string => !!n),
          ...(plan.practiceTypes ?? []),
        ],
        equipment: plan.equipment ?? [],
        blocks, rotations, groups: groupRows, focus, settings,
      },
    );
  }

  // ── Render ──
  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const event = data?.event;
  const header = (
    <>
      <CoachBackLink href={`${base}/schedule${event ? `?event=${eventId}` : ''}`}>Schedule</CoachBackLink>
      {/* Page-header ruling 2026-08-11: the meta row is BODY content — below the header block,
          not inside it (its lineup-builder twin now reads identically). */}
      <CoachPageHeader
        icon={ClipboardList}
        title={event?.name || 'Practice plan'}
        helpLabel="Practice plan"
        help={practiceHelpRequest}
      />
      <div className={styles.pageSummaryStrip}>
        <span className={styles.lineupMetaText}>
          {event?.startsAt ? `${fmtDate(event.startsAt)} · ${fmtTime(event.startsAt)}` : 'Plan this practice.'}
        </span>
        {event && (
          <Link href={`${base}/schedule?event=${eventId}`} className={styles.lineupOnScheduleLink}>
            <CalendarDays size={12} aria-hidden /> View on schedule
          </Link>
        )}
      </div>
    </>
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
  const previousWithPlans = (data?.previousPlans ?? []).filter(p => p.plan);
  const hasPastSeasonPlans = data?.hasPastSeasonPlans ?? false;
  // Read once here so the picker below (which renders outside the `!data` guard) never has to
  // null-check the load state mid-JSX.
  const templates = data?.templates ?? [];
  // ONE definition of "is there a plan here", shared with the save path — otherwise a
  // whitespace-only goal reads as a plan on screen while the save path nulls the column.
  const hasPlan = !isPracticePlanEmpty(plan);

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
      return filterTagged(templates, copyQuery, null).map(template => (
        <button key={template.id} type="button" className={styles.ppPickRow}
          onClick={() => applyTemplate(template)}>
          <span className={styles.ppPickBody}>
            <span className={styles.ppPickName}>
              {template.name}
              {template.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
            </span>
            <span className={styles.ppPickMeta}>{templateShapeLabel(template.plan)}</span>
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
    <div className={`${styles.page} ${styles.pageWide} ${styles.lineupDockedPage}`}>
      {header}
      <UnsavedChangesGuard active={dirty} />

      {loading ? (
        <div className={styles.loadingState}>Loading practice…</div>
      ) : loadError ? (
        <p className={styles.errorText}>{loadError}</p>
      ) : !data ? null : (
        <>
          {/* ── The practice-week bridge (Scouting Book P3, plan §4.9) ──
              One quiet line above the blocks: Saturday's intelligence while Tuesday's plan is
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
              blocker="Only the head coach can write the plan. You'll be able to read and print it once there is one."
            />
          )}

          {!hasPlan && canWrite && data.roster.length === 0 && (
            <CoachEmptyState
              icon={<ClipboardList size={22} />}
              headline="Add your roster first"
              description="A practice plan puts your players into blocks, stations and groups."
              payoff="With a roster in place you can draw groups at random and print a sheet for whoever's running each station."
              primaryAction={{ href: `${base}/roster`, label: 'Go to the roster' }}
            />
          )}

          {(hasPlan || canWrite) && (
            <>
              <div className={styles.ppToolbar}>
                {/* The door to the field screen (1b). Rides `schedule` like the rest of this page,
                    so the assistant who runs the tee station reaches it too. ABSENT rather than
                    disabled until there is something to run — a control that exists only to refuse
                    is the shape 1a shipped three corrections for. */}
                {hasPlan && (
                  <Link href={`${base}/practice/${eventId}/run`} className={styles.btnSecondary}>
                    <Play size={14} aria-hidden /> Run practice
                  </Link>
                )}
                {/* ⚠ ONE control, now THREE sources (frame 05; P3 C2 added the third) — never a
                    second door. Offered when there is anything at all to start from, which from
                    P3 C2 includes a past season: without that clause the coach planning the first
                    practice of a brand-new season, with no templates yet, saw no button at all —
                    and they are precisely who the third source exists for. */}
                {canWrite && (previousWithPlans.length > 0 || templates.length > 0 || hasPastSeasonPlans) && (
                  <button type="button" className={styles.btnSecondary}
                    onClick={() => {
                      setCopyOpen(true);
                      // Land on the fullest source the coach has, in order of nearness to tonight.
                      openCopySource(
                        templates.length > 0 ? 'template'
                          : previousWithPlans.length > 0 ? 'previous'
                            : 'past',
                      );
                    }}>
                    <Copy size={14} aria-hidden /> Start this plan from…
                  </button>
                )}
                {/* Explicit promotion, never automatic — the "Save to my drills…" bargain, one
                    level up. Absent until there is something worth saving. */}
                {canWrite && hasPlan && (
                  <button type="button" className={styles.btnSecondary} onClick={() => setSaveTemplateOpen(true)}>
                    <BookMarked size={14} aria-hidden /> Save as template…
                  </button>
                )}
                <button type="button" className={styles.btnSecondary} disabled={!hasPlan} onClick={handlePrint}>
                  <Printer size={14} aria-hidden /> Print the sheet
                </button>
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
                  <span>
                    Started from <strong>{plan.templateName}</strong>. This plan is yours now —{' '}
                    <strong>edit anything</strong>. Changes here won&apos;t change the template.
                  </span>
                </p>
              )}

              <PracticePlanEditor
                plan={plan}
                onChange={updatePlan}
                roster={data.roster}
                goals={data.goals}
                canViewFocus={data.canViewFocus}
                attendance={data.attendance}
                canViewAttendance={data.canViewAttendance}
                staffSuggestions={data.staffSuggestions}
                equipmentSuggestions={data.equipmentSuggestions}
                drills={data.drills}
                // Absent for a viewer who can't write drills, which removes "Save to my drills…"
                // entirely rather than offering a control that only exists to refuse.
                onCreateDrill={canWrite ? createDrill : undefined}
                focusTags={focusTags}
                onCreateFocusTag={canWrite ? createFocusTag : undefined}
                planTagIds={planTagIds}
                onChangePlanTags={savePlanTags}
                eventStartsAt={event?.startsAt ?? ''}
                eventEndsAt={event?.endsAt ?? null}
                readOnly={!canWrite}
              />
            </>
          )}

          {/* ── "How it went" (D17, frame 07) ──
              A SECOND, SEPARATE section beside the plan, on the same principle as "Recorded here"
              below: the plan is what you INTENDED, this is what you thought afterwards. It is one
              of only two things on this screen allowed to describe reality, and it earns that
              because a coach sat down at home and typed it.

              ⚠ **ABOUT THE PRACTICE, NEVER ABOUT A CHILD** — D17's hard guardrail. The placeholder
              and the helper line both steer away from names, there is deliberately no per-player
              equivalent, and none may be added: per-child commentary would drift into behavioural
              profiling on minors.

              ⚠ This does NOT reopen D4. An unhurried note written at home is a different act from
              an abandoned tick-box mid-drill — nothing at the field records anything, and there
              are still no per-block "we ran it" ticks. */}
          <div className={styles.ppRecorded}>
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
              // ⚠ Silence is stated, never rendered blank — a practice with nothing written must
              // not read as a practice where nothing happened.
              <p className={styles.ppRecapNone}>Nothing written down for this one.</p>
            )}
          </div>

          {/* ── "Recorded here" (§10.2) ──
              A SECOND, SEPARATE section beside the plan, deliberately: the plan is what you
              INTENDED; this is what actually got measured. It is the one thing on this screen
              allowed to say something happened, and it earns that because a coach typed real
              numbers into it. That is why it is kept apart from the plan rather than folded in. */}
          {data.sessions.length > 0 && (
            <div className={styles.ppRecorded}>
              <h2 className={styles.ppRecordedTitle}><Ruler size={15} aria-hidden /> Recorded here</h2>
              <p className={styles.formHint}>Evaluation sessions whose readings were taken at this practice.</p>
              <ul className={styles.ppRecordedList}>
                {data.sessions.map(session => (
                  <li key={session.id}>
                    <Link href={`${base}/development/sessions/${session.id}`}>
                      {formatInOrgZone(`${session.sessionDate}T12:00:00Z`, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {session.note ? ` — ${session.note}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Save status — docked above the bottom nav on phones, same as the lineup builder. */}
      {canWrite && !loading && !loadError && (
        <div className={`${styles.attendanceFooter} ${styles.lineupDockedFooter}`}>
          {/* ⚠ THREE states, not two. Lumping "there are unsaved edits" in with "a request is in
              flight" meant the pill said "Saving…" whenever anything was pending — so a coach had
              no way to tell working from stuck, and the word was often simply untrue. Now
              "Saving…" means a request really is open, and anything waiting says so plainly. */}
          <span className={styles.saveStatus} aria-live="polite">
            {saveError
              ? <button type="button" className={styles.saveRetry} disabled={saving} onClick={handleSave}>Couldn’t save · Retry</button>
              : saving ? 'Saving…'
                : dirty ? 'Unsaved changes'
                  : <><Check size={13} /> Saved</>}
          </span>
        </div>
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
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Start this plan from"
          onClick={e => { if (e.target === e.currentTarget) setCopyOpen(false); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
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

      {/* ── "Save as template…" (frame 04) — exactly ONE question, and it's optional ── */}
      {saveTemplateOpen && (
        <SaveAsTemplateDialog
          defaultName={event?.name ?? ''}
          tags={focusTags}
          initialTagIds={planTagIds}
          onCreateTag={canWrite ? createFocusTag : undefined}
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
  defaultName, tags, initialTagIds, onCreateTag, onSave, onClose,
}: {
  defaultName: string;
  tags: PickableTag[];
  initialTagIds: string[];
  onCreateTag?: (name: string) => Promise<PickableTag | null>;
  onSave: (name: string, tagIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  // Pre-filled from what the practice is already about — the coach has answered this once tonight
  // and should not be made to answer it again. Still editable: a template is a broader thing.
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    const result = await onSave(name.trim(), tagIds);
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not save that template.'); return; }
    onClose();
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Save as template"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${styles.modal} ${styles.modalScrollBody}`}>
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

          <TagPicker
            label="Tags — optional"
            all={tags}
            selected={tagIds}
            onChange={setTagIds}
            onCreate={onCreateTag}
            emptyHint="No tags yet — type a word to make your first one."
          />
          <p className={styles.formHint}>
            Your own words, shared with your drills and your players&apos; focus areas — so tagging a
            template &ldquo;Hitting&rdquo; is the same &ldquo;Hitting&rdquo; everywhere.
          </p>

          {/* ⚠ Says what does NOT happen, on purpose. A coach saving a template mid-plan needs to
              know tonight is untouched and that later edits won't leak either way. */}
          <p className={styles.formHint}>
            Saves the blocks, stations and timings as they are now. <strong>It does not change
            tonight&apos;s practice</strong>, and editing this plan later won&apos;t change the template.
            Players and staff aren&apos;t saved — the practice supplies those.
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
