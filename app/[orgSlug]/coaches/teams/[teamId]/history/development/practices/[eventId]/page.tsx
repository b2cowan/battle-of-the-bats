'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Library } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import {
  blockRotates, computeBlockClocks, formatDuration, resolvePracticePlanTagNames, resolveStationTeaching,
  type PracticePlan, type PracticePlanBlock, type PracticeStation,
} from '@/lib/rep-practice-plan';
// ⚠ SIX levels: [eventId] → practices → development → history → [teamId] → teams → coaches.
// A CSS-module import path is invisible to TypeScript — Phase 2 shipped a wrong depth that
// typechecked cleanly and rendered a whole room as a build error. Copied from a verified sibling.
import styles from '../../../../../../coaches.module.css';

/**
 * A past practice plan, READ-ONLY (Practice Plans Phase 3, frame 12).
 *
 * ⚠ **A LOOK-BACK PAGE, RULED EXPLICITLY** (owner, 2026-08-01, §10.8 ruling 1; re-approved with
 * P3 C3, 2026-08-16). It is the one thing in Practice Plans that may be handed a season, and it is
 * enumerated in `HISTORY_PAGES` in `tests/unit/coach-history-endpoint-guard.test.ts` — the only
 * page besides Season's End that reads `?year=` off the URL.
 *
 * ⚠ **Reached from exactly TWO lists, and from nowhere else.** "Practices you've run" inside the
 * Development report (the original caller, which passes no year because the report is always the
 * team's working season), and the practices section on a finished season's Season's End page
 * (which passes both the year and `from=season-end`, so the back link returns there). The
 * schedule's practice-plan section stays hidden in a completed season exactly as 1b ruled — neither
 * door reopens that one.
 *
 * ⚠ **Every control is GONE, not disabled.** No edit, no delete, no "Run practice", no "Save as
 * template", no drill picker, no promotion. There is no write path to this page's data at all: the
 * route behind it is GET-only.
 *
 * ⚠ **It shows what the coach could see AT THE TIME.** Every word renders from the plan's own
 * jsonb, which copied the drill's text when the drill was added — so editing that drill since
 * cannot rewrite what June's practice says. That property is what makes an honest archive cheap,
 * and it is Phase 2's copy-on-add paying for itself.
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

const fmtDate = (iso: string) =>
  formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });

// ── Sub-components at MODULE level (never in a render body). ─────────────────

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.ppField}>
      <span className={styles.ppFieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/**
 * One station, as a record.
 *
 * ⚠ The teaching resolves through the SAME `resolveStationTeaching` the live editor, the run
 * screen and the printed sheet use — so a plan written before the drill library existed (its
 * teaching on the BLOCK) reads correctly here too, for ever. There is no "convert my old plans"
 * story and none is wanted.
 */
function ReadStation({
  station, block, nameOf,
}: {
  station: PracticeStation;
  block: PracticePlanBlock;
  nameOf: (id: string) => string | null;
}) {
  const { description, goal, coachingPoints } = resolveStationTeaching(station, block);
  const players = (station.playerIds ?? []).map(nameOf).filter(Boolean) as string[];
  return (
    <div className={styles.ppStation}>
      <div className={styles.ppStationHead}>
        <span className={styles.ppStationNameRead}>{station.name || '(untitled station)'}</span>
        {station.drillId && (
          <span className={styles.ppFromDrill}>
            <Library size={12} aria-hidden /> From your drills
            {station.drillTags?.length ? ` · ${station.drillTags.join(' · ')}` : ''}
          </span>
        )}
      </div>
      <div className={styles.ppStationBody}>
        {description && <ReadField label="What you're doing"><p className={styles.ppReadTxt}>{description}</p></ReadField>}
        {goal && <ReadField label="What you're watching for"><p className={styles.ppReadTxt}>{goal}</p></ReadField>}
        {coachingPoints.length > 0 && (
          <ReadField label="Coaching points">
            <ol className={styles.ppReadPoints}>{coachingPoints.map((p, i) => <li key={i}>{p}</li>)}</ol>
          </ReadField>
        )}
        {station.setup && <ReadField label="Setup"><p className={styles.ppReadTxt}>{station.setup}</p></ReadField>}
        {station.equipment?.length ? (
          <ReadField label="Equipment">
            <div className={styles.ppChipWrap}>
              {station.equipment.map(e => <span key={e} className={styles.ppChip}>{e}</span>)}
            </div>
          </ReadField>
        ) : null}
        {/* ⚠ **"Who was ASSIGNED", never "who ran it" or "who was at it."** An earlier draft used
            those, defending the past tense on the grounds that the writing happened in the past.
            That conflates two different things: this page is a record of what the coach PLANNED,
            and the product has never recorded who actually turned up at a station or whether the
            plan was followed (D4 — there are still no "we ran it" ticks anywhere in the schema).
            "Ran" is the literally forbidden verb in §4, and "was at it" would assert a child's
            attendance the data cannot support. The live editor says "Who runs it"; a record of it
            says "who was assigned". */}
        {station.staff?.length ? (
          <ReadField label="Who was assigned"><p className={styles.ppReadTxt}>{station.staff.join(', ')}</p></ReadField>
        ) : null}
        {players.length > 0 && (
          <ReadField label="Who was assigned"><p className={styles.ppReadTxt}>{players.join(', ')}</p></ReadField>
        )}
        {station.note && <ReadField label="On the night"><p className={styles.ppReadTxt}>{station.note}</p></ReadField>}
      </div>
    </div>
  );
}

export default function CoachPastPracticePlanPage({
  params,
}: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> }) {
  const { orgSlug, teamId, eventId } = use(params);
  const { loading: ctxLoading } = useCoaches();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // ⚠ No season lookup from the nav: the route below resolves the season and hands it back on the
  // payload, which is the only honest source — this page renders a record that may belong to a
  // season other than the one the coach's nav is on. The `useCoachSeasonPage` call that sat here
  // fed the page-title season chip, and that chip was deleted with the dial on 2026-08-16.
  const searchParams = useSearchParams();
  /**
   * ⚠ **THE ONE PAGE BESIDE SEASON'S END THAT READS A YEAR** (P3 C3), and it is enumerated in
   * `HISTORY_PAGES` in the guard test with the three questions answered. It reads one because its
   * second caller can hand it one: Season's End may be showing a year the team is no longer on,
   * and a row opened from there names an event outside the working season.
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

  const nameOf = useCallback((id: string): string | null => {
    const p = data?.roster.find(r => r.id === id);
    return p ? playerDisplayName(p) : null;
  }, [data]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;

  // Resolved to CURRENT tag names (mig 266) — see `resolvePracticePlanTagNames` and the route's
  // header note. Deliberate: this is the one place this page's own "editing since cannot rewrite
  // what June's practice says" rule doesn't hold for staff/equipment specifically.
  const plan = data?.plan
    ? resolvePracticePlanTagNames(data.plan, data.staffTags ?? [], data.equipmentTags ?? [])
    : null;
  const clocks = plan ? computeBlockClocks(plan.blocks, data?.event.startsAt, data?.event.endsAt ?? null) : [];

  /* ⚠ THE ONLY LINK OUT, and it goes back to whichever list sent the coach here, carrying the
     season. Hard-coding one destination was right while there was one caller and wrong the day
     there were two — the failure would have been silent, because both destinations render
     perfectly; the coach would simply have been moved to a different year without being told. */
  const backTo = cameFromSeasonEnd
    ? {
        href: `${base}/season-end${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`,
        label: "Season's End",
      }
    : { href: insightsSectionHref(base, 'development'), label: "Practices you've run" };

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
        <>
          {/* Page-header ruling 2026-08-11: when and where this practice was, and what it was
              tagged, are facts ABOUT the practice — they lead the record instead of hanging under
              the title. */}
          <div className={styles.pageSummaryStrip}>
            <span>
              {[
                data.event.startsAt ? `${fmtDate(data.event.startsAt)} · ${fmtTime(data.event.startsAt)}` : null,
                [data.event.location, data.event.fieldNumber].filter(Boolean).join(', ') || null,
              ].filter(Boolean).join(' · ')}
            </span>
            {data.tags.length > 0 && (
              <span className={styles.tagReadRow}>
                {data.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
              </span>
            )}
          </div>

          {!plan ? (
            <p className={styles.detailPlaceholder}>No plan was written for this practice.</p>
          ) : (
            <>
              {plan.goal && (
                <div className={styles.ppHeaderCard}>
                  <ReadField label="What this practice was for"><p className={styles.ppReadTxt}>{plan.goal}</p></ReadField>
                  {plan.equipment?.length ? (
                    <ReadField label="Equipment">
                      <div className={styles.ppChipWrap}>
                        {plan.equipment.map(e => <span key={e} className={styles.ppChip}>{e}</span>)}
                      </div>
                    </ReadField>
                  ) : null}
                </div>
              )}

              {plan.blocks.map((block, i) => {
                const clock = clocks[i];
                const stations = block.stations ?? [];
                const blockPlayers = (block.playerIds ?? []).map(nameOf).filter(Boolean) as string[];
                return (
                  <div key={block.id} className={styles.ppBlock}>
                    <div className={styles.ppBlockHead}>
                      <div className={styles.ppBlockTitleWrap}>
                        <span className={styles.ppStationNameRead}>{block.title || `Block ${i + 1}`}</span>
                        <span className={styles.ppBlockClock}>
                          {[
                            formatDuration(block.duration),
                            clock ? `${clock.startLabel}${clock.endLabel ? `–${clock.endLabel}` : ''}` : null,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </div>
                    <div className={styles.ppBlockBody}>
                      {block.description && <ReadField label="What you're doing"><p className={styles.ppReadTxt}>{block.description}</p></ReadField>}
                      {block.goal && <ReadField label="What you're watching for"><p className={styles.ppReadTxt}>{block.goal}</p></ReadField>}
                      {block.coachingPoints?.length ? (
                        <ReadField label="Coaching points">
                          <ol className={styles.ppReadPoints}>{block.coachingPoints.map((p, j) => <li key={j}>{p}</li>)}</ol>
                        </ReadField>
                      ) : null}
                      {block.staff?.length ? (
                        <ReadField label="Who was assigned"><p className={styles.ppReadTxt}>{block.staff.join(', ')}</p></ReadField>
                      ) : null}
                      {blockPlayers.length > 0 && (
                        <ReadField label="Who was assigned"><p className={styles.ppReadTxt}>{blockPlayers.join(', ')}</p></ReadField>
                      )}

                      {/* The groups as they were drawn that night — part of what the coach wrote,
                          so part of the record. Rendered only when the reader may see the roster. */}
                      {blockRotates(block) && (block.rotation?.groups.length ?? 0) > 0 && (
                        <ReadField label="Groups">
                          <div className={styles.ppChipWrap}>
                            {block.rotation!.groups.map(g => {
                              const names = g.playerIds.map(nameOf).filter(Boolean) as string[];
                              return (
                                <span key={g.id} className={styles.ppChip}>
                                  {g.name}{names.length > 0 ? ` — ${names.join(', ')}` : ''}
                                </span>
                              );
                            })}
                          </div>
                        </ReadField>
                      )}

                      {stations.map(station => (
                        <ReadStation key={station.id} station={station} block={block} nameOf={nameOf} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* "How it went" — the one thing on this page that describes what actually happened, and
              it earns that because the coach wrote it. Silence is stated, never rendered blank. */}
          <div className={styles.ppRecorded}>
            <h2 className={styles.ppRecordedTitle}>How it went</h2>
            {data.recap
              ? <p className={styles.ppReadTxt}>{data.recap}</p>
              : <p className={styles.ppRecapNone}>Nothing written down for this one.</p>}
          </div>
        </>
      )}
    </div>
  );
}
