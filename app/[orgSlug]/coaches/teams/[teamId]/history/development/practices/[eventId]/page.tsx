'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { ClipboardList, Library } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import {
  blockRotates, computeBlockClocks, formatDuration, resolveStationTeaching,
  type PracticePlan, type PracticePlanBlock, type PracticeStation,
} from '@/lib/rep-practice-plan';
// ⚠ SIX levels: [eventId] → practices → development → history → [teamId] → teams → coaches.
// A CSS-module import path is invisible to TypeScript — Phase 2 shipped a wrong depth that
// typechecked cleanly and rendered a whole room as a build error. Copied from a verified sibling.
import styles from '../../../../../../coaches.module.css';

/**
 * A past practice plan, READ-ONLY (Practice Plans Phase 3, frame 12).
 *
 * ⚠ **THE NEW ARCHIVE DOOR — ruled explicitly** (owner, 2026-08-01, §10.8 ruling 1). The archive
 * is OPT-IN, and this is the one thing in Practice Plans that opts in.
 *
 * ⚠ **Reached ONLY from the looking-back list**, and that is structural rather than a promise: the
 * page lives inside the report's own subtree, and the only link out of it goes back to that list.
 * The schedule's practice-plan section stays hidden in a completed season exactly as 1b ruled —
 * this door does not reopen that one.
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
 * ⚠ **The container rule:** an archive is a container, and the unit of work is every page
 * reachable from the door. This page carries the viewed season on its one outbound link.
 */

type LoadState = {
  event: {
    id: string; name: string; startsAt: string; endsAt: string | null;
    location: string | null; fieldNumber: string | null;
  };
  plan: PracticePlan | null;
  recap: string | null;
  tags: { id: string; name: string }[];
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
  // Page-header ruling 2026-08-11: the archive chip is the SHARED one, in the h1, like every other
  // page in the portal — this page had hand-rolled its own read-only span, which meant it also had
  // no way OUT of the archive from the chip (the shared component is the exit too).
  const page = useCoachSeasonPage(orgSlug, teamId);

  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/practice-plan/read`,
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not open that plan.');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that plan.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, eventId]);
  useEffect(() => { load(); }, [load]);

  const nameOf = useCallback((id: string): string | null => {
    const p = data?.roster.find(r => r.id === id);
    return p ? playerDisplayName(p) : null;
  }, [data]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;

  const plan = data?.plan ?? null;
  const clocks = plan ? computeBlockClocks(plan.blocks, data?.event.startsAt, data?.event.endsAt ?? null) : [];

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* ⚠ The ONLY link out, and it carries the viewed season — an archive is a container, and a
          page inside one must not drop the season on the way back. */}
      <CoachBackLink href={`${base}/history/development`}>Practices you&apos;ve run</CoachBackLink>

      {loading ? (
        <div className={styles.loadingState}>Opening the plan…</div>
      ) : error || !data ? (
        <p className={styles.errorText} role="alert">{error || 'Could not open that plan.'}</p>
      ) : (
        <>
          <CoachPageHeader
            icon={ClipboardList}
            title={data.event.name || 'Practice plan'}
            helpLabel="Practice plans"
            help={{ module: 'coaches', sectionIds: ['premium-practice-plans'], fullGuideHref: `/${orgSlug}/coaches/help#premium-practice-plans` }}
          />

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
