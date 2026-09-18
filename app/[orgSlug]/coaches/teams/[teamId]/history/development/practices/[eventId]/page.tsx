'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Printer } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import { buildFilename, downloadPracticeSheet, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings } from '@/lib/export';
import { buildPracticeSheet } from '@/lib/practice-sheet';
import { practiceHasPlan } from '@/lib/practice-state';
import { emptyPracticePlan, type PracticePlan } from '@/lib/rep-practice-plan';
import { HowItWent, NoPlanRecord, PracticeWhenLine } from '@/components/coaches/PracticeSheetChrome';
import PracticePlanEditor from '../../../../practice/_PracticePlanEditor';
// ⚠ SIX levels: [eventId] → practices → development → history → [teamId] → teams → coaches.
// A CSS-module import path is invisible to TypeScript — Phase 2 shipped a wrong depth that
// typechecked cleanly and rendered a whole room as a build error. Copied from a verified sibling.
import styles from '../../../../../../coaches.module.css';

/**
 * A past practice plan, READ-ONLY (Practice Plans Phase 3, frame 12) — the RECORD'S FACE
 * (practices re-evaluation stage 6, owner ruling R5, 2026-09-18).
 *
 * ⚠ **A LOOK-BACK PAGE, RULED EXPLICITLY** (owner, 2026-08-01, §10.8 ruling 1; re-approved with
 * P3 C3, 2026-08-16). It is the one thing in Practice Plans that may be handed a season, and it is
 * enumerated in `HISTORY_PAGES` in `tests/unit/coach-history-endpoint-guard.test.ts` — the only
 * page besides Season's End that reads `?year=` off the URL.
 *
 * ⚠ **Reached from the finished season's shelf — "Practices" on Season's End (which passes both
 * the year and `from=season-end`, so the back link returns there).** Insights → Practice review used
 * to send a LIVE-season row here too; since stage 6 (R5) it opens the practice's own page, which IS
 * the record's face for a finished practice — so a working-season practice has one face, not two,
 * and this page serves finished seasons only. The schedule's practice-plan section stays hidden in
 * a completed season exactly as 1b ruled.
 *
 * ⚠ **ONE DOCUMENT, NOT A THIRD RENDERER (R5).** This page used to draw its own document — its own
 * labels ("What this practice was for" · "Who was assigned" · "On the night"), every station as a
 * stacked card with all five fields, a station with no words of its own printing the BLOCK's
 * words again, no grid, no rounds, no "Whole team", no block kit, 2,196px for a circuit the sheet
 * draws in 1,284. It now mounts the SHEET in its read mode — the same rows-that-open-to-read face
 * the plan page shows for a finished practice and an assistant sees on a live one — with "How it
 * went" first. What was missing from the record is here because the record IS the sheet.
 *
 * ⚠ **Every write control is GONE, not disabled.** No edit door, no delete, no "Run practice", no
 * "Save as template", no drill picker, no promotion. There is no write path to this page's data at
 * all: the route behind it is GET-only. "How it went" is READ here for everyone, the head coach
 * included — a closed season is a record, and writing into it is the one thing the whole ruling
 * forbids. Print the sheet is the one control: paper is not a write.
 *
 * ⚠ **It shows what the coach could see AT THE TIME.** Every word renders from the plan's own
 * jsonb, which copied the drill's text when the drill was added — so editing that drill since
 * cannot rewrite what June's practice says. That property is what makes an honest archive cheap,
 * and it is Phase 2's copy-on-add paying for itself. (The staff/equipment libraries are the one
 * deliberate exception — see the route's header.)
 *
 * ⚠ **The container rule:** the unit of work is every page reachable from the door, never the door
 * alone. This page IS the bottom — it has no level down for a defect to hide on — and its one
 * outbound link carries both the season and where the coach came from.
 */

type LoadState = {
  event: {
    id: string; name: string; startsAt: string; endsAt: string | null;
    location: string | null; fieldNumber: string | null;
  };
  plan: PracticePlan | null;
  recap: string | null;
  tags: { id: string; name: string }[];
  /** The 'staff'/'equipment' libraries, CURRENT (mig 266) — see the route's header note on why
   *  this one archive page resolves them live rather than trusting a frozen snapshot. */
  staffTags: { id: string; name: string }[];
  equipmentTags: { id: string; name: string }[];
  roster: { id: string; playerFirstName: string; playerLastName: string; playerNumber: string | null }[];
  season: { programYearId: string; name: string; isReadOnly: boolean };
};

/** Nothing on this page changes the plan; the editor's `onChange` is required and never called. */
const NEVER_CHANGES = () => {};

export default function CoachPastPracticePlanPage({
  params,
}: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> }) {
  const { orgSlug, teamId, eventId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // ⚠ No season lookup from the nav: the route below resolves the season and hands it back on the
  // payload, which is the only honest source — this page renders a record that may belong to a
  // season other than the one the coach's nav is on. The `useCoachSeasonPage` call that sat here
  // fed the page-title season chip, and that chip was deleted with the dial on 2026-08-16.
  const searchParams = useSearchParams();
  /**
   * ⚠ **THE ONE PAGE BESIDE SEASON'S END THAT READS A YEAR** (P3 C3), and it is enumerated in
   * `HISTORY_PAGES` in the guard test with the three questions answered. It reads one because its
   * caller can hand it one: Season's End may be showing a year the team is no longer on, and a row
   * opened from there names an event outside the working season.
   */
  const yearParam = searchParams.get('year');
  /**
   * ⚠ **WHERE THE COACH CAME FROM, so the back link can take them there** (plan §5 risk 4). The
   * link used to hard-code the Development report, which was correct while that list was the only
   * caller and became a lie the moment there were two: a coach who opened this from a finished
   * season's own page would have been returned to a report about the team's WORKING season.
   *
   * ⚠ Explicit, not inferred from the presence of `year`. Season's End showing the team's own
   * working season carries no year at all, so "has a year ⇒ came from Season's End" would drop
   * exactly the everyday between-seasons case back onto the wrong page.
   */
  const cameFromSeasonEnd = searchParams.get('from') === 'season-end';

  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  /**
   * ⚠⚠ **A RUN GENERATION, because this page can now cross SEASONS as well as events** (`/review`
   * 2026-08-16). Like its siblings it does not unmount when only the `[eventId]` segment changes,
   * and it had no guard at all — so a slow answer for the practice a coach just left could replace
   * the one they are reading. Before C3 the worst case was two events inside one season; adding
   * `?year=` gave the page a second caller and a second season, so the same race now paints a
   * 2022 plan under a header and back link that say 2021 — the page disagreeing with itself about
   * which year it is showing, which is precisely what the look-back discipline exists to prevent.
   *
   * ⚠ The generation is stamped INSIDE `load`, not left to whichever caller remembers a predicate —
   * the awards page's own guard note records why an opt-in version gets forgotten.
   */
  const runRef = useRef(0);
  const load = useCallback(async () => {
    const myRun = ++runRef.current;
    /* ⚠⚠ THE OLD PLAN IS DROPPED BEFORE THE NEW ONE IS ASKED FOR, and that became REQUIRED when
       the header was hoisted above the fork below (back-in-header spread, 2026-08-26; found by
       `/review`). `load` fires only when the IDENTITY changes — its deps are the event and the
       year, and nothing else calls it — so surviving `data` is always about a DIFFERENT practice,
       in possibly a different season. While the header lived inside the loaded branch that was
       invisible; hoisted, it printed the PREVIOUS practice's name over the new one's spinner —
       the header disagreeing with the page about which event it is showing, which is the exact
       failure the run generation above was written to prevent, re-entered through the title.
       ⚠ Moving an affordance INTO a component makes every state that component now renders in
       its problem. */
    setData(null);
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/practice-plan/read`
        + (yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''),
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not open that plan.');
      const body = await res.json();
      if (runRef.current !== myRun) return;
      setData(body);
    } catch (e) {
      // A stale FAILURE matters as much as a stale success: a dead request for the practice the
      // coach has left must not replace the plan they are reading with "couldn't open that".
      if (runRef.current === myRun) setError(e instanceof Error ? e.message : 'Could not open that plan.');
    } finally {
      if (runRef.current === myRun) setLoading(false);
    }
  }, [orgSlug, teamId, eventId, yearParam]);
  useEffect(() => { load(); }, [load]);

  // Team-resolved PDF settings (team look → club look → defaults) — the same read the plan page
  // makes; the team's paper is not season-scoped. Optional; the sheet falls back to defaults.
  // Cleanup-guarded so a slow response for a previous team can never land as this team's branding.
  useEffect(() => {
    let cancelled = false;
    void fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`)
      .then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;

  const plan = data?.plan ?? emptyPracticePlan();
  // The hub's one definition of "has a plan" — at least one block (stage 0); a goal-only row is a
  // record with no plan, exactly as the plan page reads it.
  const hasBlocks = practiceHasPlan({ practicePlan: data?.plan ?? null });
  const teamName = assignments.find(a => a.teamId === teamId)?.teamName ?? teamId;

  /** "Print the sheet" — the record on paper, through the ONE builder the plan page prints through. */
  async function handlePrint() {
    if (!data) return;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    await downloadPracticeSheet(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'practice-plan', scope: data.event.name || 'practice' }, 'pdf'),
      buildPracticeSheet({
        plan, event: data.event, teamName,
        roster: data.roster,
        // The read route never fetches focus areas for a finished season: the section is absent.
        goals: [], canViewFocus: false,
        staffTags: data.staffTags, equipmentTags: data.equipmentTags,
        planTagIds: data.tags.map(t => t.id), focusTags: data.tags, settings,
      }),
    );
  }

  /* ⚠ THE ONLY LINK OUT, and it goes back to whichever list sent the coach here, carrying the
     season. Hard-coding one destination was right while there was one caller and wrong the day
     there were two — the failure would have been silent, because both destinations render
     perfectly; the coach would simply have been moved to a different year without being told. */
  const backTo = cameFromSeasonEnd
    ? {
        href: `${base}/season-end${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`,
        label: "Season's End",
      }
    : { href: insightsSectionHref(base, 'development'), label: 'Practice review' };

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* ⚠⚠ THE HEADER IS HOISTED ABOVE THE LOADING/ERROR FORK, and that is why this screen took
          more than a prop (back-in-header amendment, 2026-08-26). The way out used to sit on its
          own row ABOVE the fork, so it survived all three states. An arrow lives INSIDE the
          header — so leaving the header in the content branch would have silently stripped the
          way back off a plan that is still loading or failed to open, on the one screen whose
          own comment calls its link "THE ONLY LINK OUT". The title falls back for the same
          reason; every other state already renders its own words below. */}
      <CoachPageHeader
        icon={ClipboardList}
        title={data?.event.name || 'Practice plan'}
        helpLabel="Practice plans"
        help={{ module: 'coaches', sectionIds: ['premium-practice-plans'], fullGuideHref: `/${orgSlug}/coaches/help#premium-practice-plans` }}
        backTo={backTo}
      />

      {loading ? (
        <div className={styles.loadingState}>Opening the plan…</div>
      ) : error || !data ? (
        <p className={styles.errorText} role="alert">{error || 'Could not open that plan.'}</p>
      ) : (
        <div className={styles.ppSheetCol}>
          {/* The one control a record on a closed season has: paper. Nothing to run (the field is
              a live team's), nothing to save from, nothing to edit. Absent, like the plan page's
              toolbar, when there is no plan to print. */}
          {hasBlocks && (
            <div className={`${styles.ppToolbar} ${styles.ppToolbarFlush}`}>
              <button type="button" className={styles.btnSecondary} onClick={handlePrint}>
                <Printer size={14} aria-hidden /> Print the sheet
              </button>
            </div>
          )}

          {/* ── THE SHEET, as the record's face (stage 6, R2 · R5) ── the head as a fact (the year
              matters here, and where it was), the recap first and READ, then the sheet read-only in
              its own shape — or, with no plan, the reader's one sentence. */}
          <div className={styles.ppDoc} data-room="practice-plan" data-room-state="loaded" data-record="closed-season">
            <div className={styles.ppDocHead}>
              <div className={styles.ppDocWhen}>
                <PracticeWhenLine
                  startsAt={data.event.startsAt} endsAt={data.event.endsAt} plan={plan} record withYear
                  where={[data.event.location, data.event.fieldNumber].filter(Boolean).join(', ') || null}
                />
              </div>
            </div>

            <HowItWent first recap={data.recap ?? ''} />

            {hasBlocks ? (
              <PracticePlanEditor
                key={`${eventId}:${yearParam ?? ''}`}
                plan={plan}
                onChange={NEVER_CHANGES}
                roster={data.roster}
                // The read route never fetches focus areas or attendance for a finished season.
                goals={[]}
                canViewFocus={false}
                attendance={[]}
                canViewAttendance={false}
                drills={[]}
                focusTags={data.tags}
                planTagIds={data.tags.map(t => t.id)}
                // Present so the About fold can NAME the tags (a read-only chip list); never called.
                onChangePlanTags={NEVER_CHANGES}
                staffTags={data.staffTags}
                equipmentTags={data.equipmentTags}
                eventStartsAt={data.event.startsAt}
                eventEndsAt={data.event.endsAt}
                readOnly
                record
              />
            ) : (
              <NoPlanRecord />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
