'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check, ClipboardList, Copy, Play, Printer, Ruler, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import {
  buildFilename, downloadPracticeSheet, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import {
  blockRotates, computeBlockClocks, computeRotation, copyPracticePlanForReuse, emptyPracticePlan,
  formatDuration, isPracticePlanEmpty, newPracticePlanId, resolveStationTeaching,
  type PracticePlan,
} from '@/lib/rep-practice-plan';
import PracticePlanEditor, {
  type PracticeFocusGoal, type PracticeRosterPlayer,
} from '../_PracticePlanEditor';
import type { DrillInput, RepTeamDrill } from '@/lib/rep-drills';
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

type LoadState = {
  event: RepTeamEvent;
  plan: PracticePlan | null;
  roster: PracticeRosterPlayer[];
  goals: PracticeFocusGoal[];
  attendance: { playerId: string; status: RepAttendanceStatus }[];
  previousPlans: PreviousPlan[];
  sessions: RepTeamEvaluationSession[];
  staffSuggestions: string[];
  equipmentSuggestions: string[];
  practiceTypeSuggestions: string[];
  /** This team's own drills plus the club's shared set — the picker's source (Phase 2). */
  drills: RepTeamDrill[];
  canWrite: boolean;
  canViewFocus: boolean;
  canViewAttendance: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copyOpen, setCopyOpen] = useState(false);
  // Same shared overlay stack as every other sheet in the portal (nav-hide + body-scroll lock).
  useOverlayOpen(copyOpen);
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
      setDirty(false);
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      setLoadError(errorMessage(e, 'Could not load this practice'));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [orgSlug, teamId, eventId]);

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
   * The team's whole 'focus' vocabulary, owned here beside `drills` for the same reason: the editor
   * is a controlled component and must not fetch its own reference data.
   *
   * ⚠ Every tag the team has, not only the ones already on a drill — a picker built from what is on
   * screen would hide vocabulary a focus area or a template already uses, and quietly invite the
   * coach to mint a duplicate.
   */
  const [focusTags, setFocusTags] = useState<PickableTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/focus-tags`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setFocusTags(json.tags ?? []);
      } catch { /* the picker degrades to "no tags yet"; the plan still saves */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  const createFocusTag = useCallback(async (name: string): Promise<PickableTag | null> => {
    const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/focus-tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tag: PickableTag = json.tag;
    setFocusTags(prev => (prev.some(t => t.id === tag.id) ? prev : [...prev, tag]));
    return tag;
  }, [orgSlug, teamId]);

  function applyPrevious(previous: PreviousPlan) {
    if (!previous.plan || !data) return;
    const rosterIds = new Set(data.roster.map(p => p.id));
    // A COPY, always (D7). Nothing about this writes to the source practice or to a series.
    updatePlan(copyPracticePlanForReuse(previous.plan, rosterIds, newPracticePlanId));
    setCopyOpen(false);
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
        practiceTypes: plan.practiceTypes ?? [],
        equipment: plan.equipment ?? [],
        blocks, rotations, groups: groupRows, focus, settings,
      },
    );
  }

  // ── Render ──
  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <div className={styles.notAssigned}><h2>Team not found</h2><p>You are not assigned to this team.</p></div>;
  }

  const event = data?.event;
  const header = (
    <>
      <Link href={`${base}/schedule${event ? `?event=${eventId}` : ''}`} className={styles.lineupBackLink}>
        <ArrowLeft size={14} aria-hidden /> Schedule
      </Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ClipboardList size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>{event?.name || 'Practice plan'}</h1>
            <div className={styles.lineupMetaRow}>
              <span className={styles.lineupMetaText}>
                {event?.startsAt ? `${fmtDate(event.startsAt)} · ${fmtTime(event.startsAt)}` : 'Plan this practice.'}
              </span>
              {event && (
                <Link href={`${base}/schedule?event=${eventId}`} className={styles.lineupOnScheduleLink}>
                  <CalendarDays size={12} aria-hidden /> View on schedule
                </Link>
              )}
            </div>
          </div>
        </div>
        <HelpButton iconOnly label="Practice plan" help={practiceHelpRequest} />
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
  // ONE definition of "is there a plan here", shared with the save path — otherwise a
  // whitespace-only goal reads as a plan on screen while the save path nulls the column.
  const hasPlan = !isPracticePlanEmpty(plan);

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
                {canWrite && previousWithPlans.length > 0 && (
                  <button type="button" className={styles.btnSecondary} onClick={() => setCopyOpen(true)}>
                    <Copy size={14} aria-hidden /> Copy from a previous practice
                  </button>
                )}
                <button type="button" className={styles.btnSecondary} disabled={!hasPlan} onClick={handlePrint}>
                  <Printer size={14} aria-hidden /> Print the sheet
                </button>
              </div>

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
                practiceTypeSuggestions={data.practiceTypeSuggestions}
                drills={data.drills}
                // Absent for a viewer who can't write drills, which removes "Save to my drills…"
                // entirely rather than offering a control that only exists to refuse.
                onCreateDrill={canWrite ? createDrill : undefined}
                focusTags={focusTags}
                onCreateFocusTag={canWrite ? createFocusTag : undefined}
                eventStartsAt={event?.startsAt ?? ''}
                eventEndsAt={event?.endsAt ?? null}
                readOnly={!canWrite}
              />
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

      {/* ── Copy from a previous practice — the whole reuse story for slice 1a (D5) ── */}
      {copyOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Copy from a previous practice"
          onClick={e => { if (e.target === e.currentTarget) setCopyOpen(false); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Copy from a previous practice</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={() => setCopyOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className={styles.formHint} style={{ padding: '0 0 0.5rem' }}>
              This copies the plan onto tonight. The practice you copy from is left exactly as it is,
              and anything you change here stays here.
            </p>
            <div className={styles.ppPickList}>
              {previousWithPlans.map(previous => (
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
