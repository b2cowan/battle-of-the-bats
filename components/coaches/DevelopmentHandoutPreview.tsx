'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachLoading from '@/components/coaches/CoachLoading';
import CoachNotGranted from '@/components/coaches/CoachNotGranted';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useCoaches } from '@/lib/coaches-context';
import { assignmentSeasonName } from '@/lib/coach-season-label';
import { playerDevelopmentHref, returnLabel, safeReturnPath } from '@/lib/development-address';
import { groupBySession, headlineLabel, type SessionResult } from '@/lib/measurable-series';
import { logLine, handoutResultNote, handoutNextReview, observationText } from '@/lib/development-report';
import { playerName as rosterName } from '@/lib/coach-roster-name';
import { GOAL_STATUS_LABELS } from '@/lib/development-goal-history';
import { formatShortDate, todayLocal } from '@/lib/measurable-format';
import {
  buildFilename, DEFAULT_PDF_SETTINGS, downloadDevelopmentSummary, fetchResolvedPdfSettings,
  type OrgPdfSettings, type DevelopmentSummaryOptions,
} from '@/lib/export';
import type {
  RepRosterPlayer, RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepPlayerObservation,
} from '@/lib/types';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './DevelopmentHandoutPreview.module.css';

/**
 * ═══ PREVIEW DEVELOPMENT HANDOUT — "A conversation with the player" (development lifecycle
 * Phase 3, mockup screen 6; F13) ═══
 *
 * Replaces "Print summary (PDF)", which sent the whole log with no preview and no choice. The
 * coach CHOOSES what belongs in this conversation — the goals ("What we're working on"), a recent
 * observation, selected test results with the attempts behind them, a next step in their own
 * words — and may add the full dated log as an appendix. The paper is previewed as it will print;
 * Print / Save as PDF goes through the ONE PDF builder.
 *
 * ⚠ THE BOUNDARY IS THE OLD PDF'S (plan §9): current season only; no tryout evaluation, no peer
 * figures, no internal notes, no ranking language; no automatic delivery and no public link. The
 * goal and observation lines are gated exactly as the screen is — a coach without Internal notes
 * sees results only, and the handout says nothing about goals.
 *
 * ⚠ NOTHING IS STORED (build call, recommended; Q 8.1 held on the re-evaluation, stage 4): the
 * handout is a print of the record as of today, prepared fresh each time — the defaults are the
 * goals being worked on, the latest observation, each active test's latest result, never last
 * time's choices (remembering them is a stored version). A next step worth keeping is a goal REVIEW
 * — Phase 2's record — and the link beneath the box takes the coach there; this screen never grows
 * a second store.
 *
 * ⚠ NEVER A PAST DATE AS A PROMISE (owner ruling G5, 2026-09-16): "We'll look at this together
 * again on …" prints only while the chosen goal's review date is still ahead (`handoutNextReview`),
 * and the Next step section exists only with something to say — the paper and the PDF read the ONE
 * model below, so they print the same. The chooser says where the observation goes ("the family
 * reads it" — E8's push), says "nothing is stored or sent" once, and keeps the boundary line to the
 * boundary.
 */

interface HandoutData {
  showGoals: boolean;
  showMeasurables: boolean;
  // ⚠ READING A SHELF AND BEING ABLE TO FILL IT ARE DIFFERENT GRANTS, and the handout now needs
  // both: `showGoals`/`showMeasurables` decide whether an empty shelf is DRAWN, these two decide
  // whether its line may invite the coach to add something. Goals AND observations write on
  // `canWriteGoals` (the grant WITH Internal notes); results write on `canWrite`. An assistant can
  // hold Internal notes without the Development grant — they read every goal on this screen and
  // can add none of them.
  canWrite: boolean;
  canWriteGoals: boolean;
  types: RepTeamMeasurableType[];
  measurables: RepPlayerMeasurable[];
  goals: RepPlayerDevelopmentGoal[];
  observations: RepPlayerObservation[];
  // ⚠ No `authors` / `viewerId`. The route still returns both — the development screens attribute
  // every record — but the handout names nobody, so it does not read them. See `preparedLine`.
}

const resultKey = (typeId: string, rowKey: string) => `${typeId}|${rowKey}`;

/**
 * ═══ A SECTION THE PAPER CAN HOLD IS DRAWN EVEN WHEN IT IS EMPTY (owner ruling 2026-09-22) ═══
 *
 * The chooser used to render only the sections this player already had something in. A coach whose
 * players carry test results and nothing else therefore read this column as *a handout IS a table
 * of test times* — the goals and observation shelves were not hidden politely, they were invisible,
 * and a goal written next week never reached the paper because nobody knew the paper had room for
 * it. An empty shelf now keeps its heading and says what would fill it.
 *
 * ⚠ THE GATE IS PERMISSION, NOT EMPTINESS. A ghost is drawn only where this coach could actually
 * print that shelf — `showGoals` for goals and observations, `showMeasurables` for results. An
 * assistant without Internal notes gets results only, and advertising a goals shelf to them is a
 * promise the server refuses. Gate a ghost on the same flag as the shelf it stands in for, always.
 *
 * ⚠⚠ AND THE INVITATION IS A SECOND, NARROWER GATE (review finding, 2026-09-22). The first draft
 * ended every ghost line "— add one and it appears here", which reads as an instruction. Reading a
 * shelf and filling it are different grants: `canViewDevelopmentGoals` is Internal notes alone,
 * while writing a goal or an observation also needs the Development grant, and recording a result
 * needs it too. So an assistant with notes but no Development grant was being told to add a goal
 * the server would refuse. The invitation clause now rides on `canWriteGoals` / `canWrite`; without
 * it the line states the fact and stops. **A "nothing here yet" line that names an action must be
 * gated on the WRITE grant, never on the one that let the coach see the shelf.**
 *
 * ⚠ Three ghosts over a bare textarea is a shape this never draws: when NOTHING can be chosen the
 * whole chooser is replaced by the empty state (`anythingToChoose`), which already has its door.
 *
 * ⚠ NO DOOR OUT OF HERE. Nothing on this screen is stored — not the ticks, not the typed next step
 * — so an "add a goal →" link would silently discard the coach's work on the way out. The
 * masthead's `?` carries the explanation (it opens the handout's OWN help answer); the ghost is
 * only the sign that there is something to explain.
 */
function GhostGroup({ legend, line }: { legend: string; line: string }) {
  return (
    <fieldset className={`${css.group} ${css.ghost}`}>
      <legend>{legend}</legend>
      <p className={css.ghostLine}>
        <span className={css.ghostBox} aria-hidden />
        <span>{line}</span>
      </p>
    </fieldset>
  );
}

export default function DevelopmentHandoutPreview({ orgSlug, teamId, playerId }: { orgSlug: string; teamId: string; playerId: string }) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('return'), base);
  const { assignments } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const teamName = assignment?.teamName ?? '';
  const seasonName = assignment ? assignmentSeasonName(assignment) : null;

  const [player, setPlayer] = useState<RepRosterPlayer | null>(null);
  const [data, setData] = useState<HandoutData | null>(null);
  const [settings, setSettings] = useState<OrgPdfSettings>(DEFAULT_PDF_SETTINGS);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [printBusy, setPrintBusy] = useState(false);

  // ── the choices (never stored) ──
  const [goalIds, setGoalIds] = useState<Set<string> | null>(null);
  const [observationIds, setObservationIds] = useState<Set<string> | null>(null);
  const [resultKeys, setResultKeys] = useState<Set<string> | null>(null);
  const [nextStep, setNextStep] = useState('');
  const [includeLog, setIncludeLog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [playerRes, devRes, pdf] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/development`),
        fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`),
      ]);
      if (devRes.status === 403 || playerRes.status === 403) { setDenied(true); return; }
      const playerJson = await playerRes.json().catch(() => null);
      const devJson = await devRes.json().catch(() => null);
      if (!playerRes.ok || !playerJson?.player) throw new Error(playerJson?.error ?? 'Could not load this player — try again.');
      if (!devRes.ok || !devJson) throw new Error(devJson?.error ?? 'Could not load this player’s development — try again.');
      setPlayer(playerJson.player);
      setData(devJson);
      setSettings({ ...DEFAULT_PDF_SETTINGS, ...(pdf ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load — try again.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, playerId]);
  useEffect(() => { load(); }, [load]);

  // One row per session, per test, newest first — the ONE home (`groupBySession`), so the handout
  // says what the profile and the report say.
  const tests = useMemo(() => {
    if (!data) return [];
    return data.types
      .filter(t => t.kind === 'test')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(t => ({ type: t, rows: groupBySession(data.measurables.filter(m => m.measurableTypeId === t.id), t) }))
      .filter(t => t.rows.length > 0);
  }, [data]);
  const observations = useMemo(() => data?.observations ?? [], [data]);
  const skillById = useMemo(() => new Map((data?.types ?? []).map(t => [t.id, t])), [data]);

  // The starting choices: the goals being worked on, the latest observation, each test's latest result.
  const chosenGoalIds = goalIds ?? new Set((data?.goals ?? []).filter(g => g.status === 'working').map(g => g.id));
  const chosenObservationIds = observationIds ?? new Set(observations.slice(0, 1).map(o => o.id));
  // A retired test's results are still a record — offered, labelled, but not chosen by default.
  const chosenResultKeys = resultKeys ?? new Set(tests.filter(t => t.type.isActive).map(t => resultKey(t.type.id, t.rows[0].key)));

  const playerName = player ? rosterName(player) : '';
  const backTo = returnTo
    ? { href: returnTo, label: returnLabel(returnTo, base) ?? playerName }
    : { href: playerDevelopmentHref(base, playerId, { view: 'goals' }), label: playerName || 'Player' };
  // ⚠ THE HANDOUT'S OWN ANSWER, not the Development section's first sub-topic (owner ruling
  // 2026-09-22). Without `subtopicId` the masthead `?` opened on how the section is laid out, while
  // the answer that lists every part of the paper sat eleven sub-topics further down — which is
  // half the reason this screen read as unexplained. It is now the panel a coach lands on when a
  // ghost shelf makes them ask what else a handout can hold.
  //
  // ⚠ SUBTOPIC ONLY — NEVER A `label` HERE. On a masthead-hosted page the request's `label` beats
  // `helpLabel` and becomes the BUTTON's accessible name (`CoachPageHelpSlot` republishes it, and
  // the `?` is named from the published request), so naming the sub-topic renamed the control to
  // "Help: The development handout". Two consequences, both bad: this one page stops matching the
  // portal's "Help: <section>" convention, and the rendered layout gate reports the button's
  // long-accepted 34px geometry as two BRAND-NEW findings, because its baseline entries are keyed
  // by that accessible name. The drawer still opens on the handout's answer — that is `subtopicId`'s
  // job, not the label's.
  const header = (
    <CoachPageHeader
      icon={Printer}
      title="Preview development handout"
      backTo={backTo}
      helpLabel="Development"
      help={{ module: 'coaches', sectionIds: ['premium-development'], subtopicId: 'premium-development-handout', fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
    />
  );

  if (denied) {
    return (
      <div className={shared.page}>
        {header}
        <CoachNotGranted icon={<Printer size={20} aria-hidden />} section="Development"
          what="the handout — a player’s goals, observations and results for a conversation with them" />
      </div>
    );
  }
  if (loading) return <div className={shared.page}>{header}<CoachLoading label="Loading the record…" /></div>;
  if (!data || !player) {
    return (
      <div className={shared.page}>
        {header}
        <p className={shared.errorText} role="alert">
          {error || 'Could not load.'}{' '}
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }} onClick={() => load()}>Try again</button>
        </p>
      </div>
    );
  }

  /**
   * ⚠ THE DATE ONLY — THE HANDOUT NAMES NOBODY (owner ruling 2026-09-22).
   *
   * This line used to end "· <the coach>", resolved from the org membership's display name. That
   * name is written on two paths only (accepting an invitation; an admin typing one on the members
   * screen), so a head coach who signed up and created the team themselves never had one and the
   * paper a family takes home read "Prepared … · a coach". The owner ruled out BOTH halves: not the
   * blank word, and not the name either. A handout is the record of a player, not a signed
   * document — the coach handing it over is standing right there.
   *
   * ⚠ Do not re-add a byline here. Naming the VIEWER is a different feature from naming an AUTHOR;
   * the author lines (notes, observations, the session grid) are where a name belongs, and those
   * now fall back to the person's own account name when the club holds no word for them.
   */
  const preparedLine = `Prepared ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  const chosenGoals = data.showGoals ? data.goals.filter(g => chosenGoalIds.has(g.id)) : [];
  const chosenObservations = data.showGoals ? observations.filter(o => chosenObservationIds.has(o.id)) : [];
  const chosenResults = data.showMeasurables
    ? tests.flatMap(t => t.rows.filter(r => chosenResultKeys.has(resultKey(t.type.id, r.key))).map(row => ({ type: t.type, row })))
    : [];
  // ONE goal carries both the printed "we'll look at this again on …" date and the "save this next
  // step as a review" door: the chosen goal with the earliest review date, else the first chosen.
  const goalForReview = [...chosenGoals].sort((a, b) => (a.reviewOn ?? '9999').localeCompare(b.reviewOn ?? '9999'))[0] ?? null;
  // The printing rule (G5): the date prints only while it is still ahead, by the coach's local day.
  const nextReviewOn = handoutNextReview(goalForReview?.reviewOn, todayLocal());
  const anythingToChoose = (data.showGoals && (data.goals.length > 0 || observations.length > 0)) || (data.showMeasurables && tests.length > 0);
  const logChosen = includeLog && data.showMeasurables && tests.length > 0;
  const anythingChosen = chosenGoals.length > 0 || chosenObservations.length > 0 || chosenResults.length > 0 || nextStep.trim().length > 0 || logChosen;

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id); else next.delete(id);
    return next;
  };
  const pickResult = (typeId: string, rowKey: string | null) => {
    const next = new Set([...chosenResultKeys].filter(k => !k.startsWith(`${typeId}|`)));
    if (rowKey) next.add(resultKey(typeId, rowKey));
    setResultKeys(next);
  };
  const chosenRowFor = (typeId: string): SessionResult<RepPlayerMeasurable> | null =>
    chosenResults.find(r => r.type.id === typeId)?.row ?? null;

  /**
   * THE handout — one model the PDF prints and the paper previews (chart rule 8's spirit: one source
   * behind the print and the screen, so they cannot disagree). Every line is already in its printed
   * words here; the paper below only lays them out.
   */
  const handout: DevelopmentSummaryOptions = {
    playerName,
    playerNumber: player.playerNumber ? `#${player.playerNumber}` : null,
    teamName,
    seasonLabel: seasonName,
    preparedLine,
    goals: chosenGoals.map(g => ({ focusArea: g.focusArea, success: g.success })),
    observations: chosenObservations.map(o => ({ date: formatShortDate(o.observedOn), text: observationText(o) || 'Observed' })),
    results: chosenResults.map(({ type, row }) => ({
      test: type.name, result: headlineLabel(row, type), date: formatShortDate(row.recordedOn), note: handoutResultNote(row, type),
    })),
    nextStep: nextStep.trim() || null,
    nextReviewOn: nextReviewOn ? formatShortDate(nextReviewOn) : null,
    // The appendix: every session, oldest → newest, per test — a dated log, never a computed trend.
    log: logChosen
      ? tests.map(t => ({ test: t.type.name, lines: [...t.rows].reverse().map(r => logLine(r, t.type)) }))
      : null,
    settings,
  };

  async function print() {
    if (printBusy) return;
    setPrintBusy(true);
    setError('');
    try {
      await downloadDevelopmentSummary(buildFilename({ org: orgSlug, dataset: 'development', scope: playerName }, 'pdf'), handout);
    } catch {
      setError('Couldn’t build the PDF — try again.');
    } finally {
      setPrintBusy(false);
    }
  }

  return (
    <div className={`${shared.page} ${shared.pageWide}`}>
      {header}
      {error && <p className={shared.errorText} role="alert">{error}</p>}
      {!anythingToChoose ? (
        <CoachEmptyState quiet icon={<Printer size={20} aria-hidden />}
          headline="Nothing to put in a handout yet"
          description={`${playerName} has no goals, observations or results recorded this season. The handout draws only on what is on the record.`}
          primaryAction={{ href: playerDevelopmentHref(base, playerId, { view: 'goals' }), label: `Open ${player.playerFirstName}’s development →`, variant: 'ghost' }} />
      ) : (
        <div className={css.layout}>
          {/* ── The choices ── */}
          <section className={css.choose} aria-labelledby="handout-choose" id="handout-choices">
            {/* On a phone the paper sits below every choice (≤900, the layout's own breakpoint) — a
                coach ticking blind had no sign there was a paper changing underneath. The jump link
                says so; the paper's foot links back. Nothing else changes: choices first is right,
                because a phone is where you tick, not where you print. */}
            <div className={css.chooseHead}>
              <h2 id="handout-choose" className={css.chooseTitle}>Choose what belongs in this conversation</h2>
              <a href="#handout-paper" className={css.jumpLink}>See the paper ↓</a>
            </div>
            <p className={css.chooseSub}>Current season · one player · nothing is stored or sent — a print of the record as of today.</p>

            {data.showGoals && (data.goals.length === 0 ? (
              <GhostGroup legend="What we’re working on"
                line={data.canWriteGoals ? 'No goal this season — add one and it appears here.' : 'No goal this season.'} />
            ) : (
              <fieldset className={css.group}>
                <legend>What we’re working on</legend>
                {data.goals.map(g => (
                  <label key={g.id} className={css.choice}>
                    <input type="checkbox" checked={chosenGoalIds.has(g.id)} onChange={e => setGoalIds(toggle(chosenGoalIds, g.id, e.target.checked))} />
                    <span>
                      {g.focusArea}
                      <span className={css.choiceMeta}>{GOAL_STATUS_LABELS[g.status]}{g.success ? ` · ${g.success}` : ''}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}

            {data.showGoals && (observations.length === 0 ? (
              <GhostGroup legend="A recent observation"
                line={data.canWriteGoals ? 'No observation this season — record one and it appears here.' : 'No observation this season.'} />
            ) : (
              <fieldset className={css.group}>
                <legend>A recent observation</legend>
                {/* Where the sentence goes (E8's push, G5): the sheet that wrote it said "on a handout
                    only if you choose it" — this is the other half of that sentence. */}
                <p className={shared.formHint} style={{ margin: '-0.1rem 0 0.35rem' }}>Printed as written — the family reads it.</p>
                {observations.map(o => (
                  <label key={o.id} className={css.choice}>
                    <input type="checkbox" checked={chosenObservationIds.has(o.id)} onChange={e => setObservationIds(toggle(chosenObservationIds, o.id, e.target.checked))} />
                    <span>
                      {formatShortDate(o.observedOn)} · {observationText(o) || 'Observed'}
                      <span className={css.choiceMeta}>{skillById.get(o.measurableTypeId)?.name ?? 'Skill'}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}

            {data.showMeasurables && (tests.length === 0 ? (
              <GhostGroup legend="Selected test results"
                line={data.canWrite ? 'No test result this season — record one and it appears here.' : 'No test result this season.'} />
            ) : (
              <fieldset className={css.group}>
                <legend>Selected test results</legend>
                {tests.map(({ type, rows }) => {
                  const chosen = chosenRowFor(type.id);
                  return (
                    <div key={type.id}>
                      <label className={css.choice}>
                        <input type="checkbox" checked={!!chosen} onChange={e => pickResult(type.id, e.target.checked ? rows[0].key : null)} />
                        <span>
                          {type.name}{type.isActive ? '' : ' · retired'}
                          <span className={css.choiceMeta}>
                            {chosen ? `${headlineLabel(chosen, type)} · ${formatShortDate(chosen.recordedOn)}` : `latest ${headlineLabel(rows[0], type)} · ${formatShortDate(rows[0].recordedOn)}`}
                          </span>
                        </span>
                      </label>
                      {chosen && rows.length > 1 && (
                        <label className={css.sessionPick}>
                          {/* The row above has just said which — the latest; the picker is for choosing another. */}
                          <span>Use a different result</span>
                          <select className={`${shared.select} ${shared.devToolbarControl}`} value={chosen.key} onChange={e => pickResult(type.id, e.target.value)}>
                            {rows.map(r => <option key={r.key} value={r.key}>{formatShortDate(r.recordedOn)} · {headlineLabel(r, type)}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            ))}

            <label className={css.nextStep}>
              <span>Next step</span>
              <textarea value={nextStep} onChange={e => setNextStep(e.target.value)} maxLength={600}
                placeholder="In your own words — what you’ll work on together next." />
            </label>
            {nextStep.trim() && goalForReview && data.showGoals && (
              <p className={css.keepLink}>
                To keep this next step on the record, review the goal —{' '}
                <Link href={playerDevelopmentHref(base, playerId, { view: 'goals', goalId: goalForReview.id, returnTo: null })}>
                  Save this next step as a review →
                </Link>
              </p>
            )}

            {data.showMeasurables && tests.length > 0 && (
              <label className={css.choice}>
                <input type="checkbox" checked={includeLog} onChange={e => setIncludeLog(e.target.checked)} />
                <span>Include the full dated result log<span className={css.choiceMeta}>An appendix — one line per result, every attempt listed.</span></span>
              </label>
            )}

            <div className={css.actions}>
              <button type="button" className={`btn btn-lime ${shared.tapFloor}`} disabled={printBusy || !anythingChosen} onClick={print}>
                <Printer size={14} aria-hidden /> {printBusy ? 'Building PDF…' : 'Print / Save as PDF'}
              </button>
            </div>
            {/* The boundary, and only the boundary — no product history, nothing said twice. */}
            <p className={css.boundary}>
              Not on the paper: tryout evaluations, other players’ figures, internal notes.
            </p>
          </section>

          {/* ── The paper, as it will print ── */}
          <article id="handout-paper" className={css.paper} aria-label="The handout as it will print">
            <div className={css.letterhead}>
              {/* The club's crest as the PDF prints it — a data URL the org's settings already resolved. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="" />}
              <span>{settings.headerLine1 || teamName}{seasonName ? ` · ${seasonName}` : ''}</span>
            </div>
            <div className={css.eyebrow}>Player development</div>
            <h2 className={css.name}>{playerName}{player.playerNumber ? <> <span>#{player.playerNumber}</span></> : null}</h2>
            <p className={css.prepared}>{preparedLine}</p>

            {handout.goals.length > 0 && (
              <section className={css.section}>
                <h3>What we’re working on</h3>
                {handout.goals.map((g, i) => (
                  <p key={i}><strong>{g.focusArea}</strong>{g.success ? <><br />{g.success}</> : null}</p>
                ))}
              </section>
            )}
            {handout.observations.length > 0 && (
              <section className={css.section}>
                <h3>{handout.observations.length === 1 ? 'A recent observation' : 'Recent observations'}</h3>
                {handout.observations.map((o, i) => <p key={i}>{o.date} · {o.text}</p>)}
              </section>
            )}
            {handout.results.length > 0 && (
              <section className={css.section}>
                <h3>{handout.results.length === 1 ? 'Selected test result' : 'Selected test results'}</h3>
                <table>
                  <thead><tr><th>Test</th><th className={css.num}>Result</th><th>Date</th></tr></thead>
                  <tbody>
                    {handout.results.map((r, i) => (
                      <tr key={i}>
                        <td>{r.test}</td>
                        <td className={css.num}>{r.result}</td>
                        <td>{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {handout.results.map((r, i) => r.note
                  ? <p key={`n-${i}`} className={css.hint}>{handout.results.length > 1 ? `${r.test}: ` : ''}{r.note}</p>
                  : null)}
              </section>
            )}
            {(handout.nextStep || handout.nextReviewOn) && (
              <section className={css.section}>
                <h3>Next step</h3>
                {handout.nextStep && <p className={css.coachWords}>{handout.nextStep}</p>}
                {handout.nextReviewOn && <p>We’ll look at this together again on {handout.nextReviewOn}.</p>}
              </section>
            )}
            {handout.log && handout.log.length > 0 && (
              <section className={`${css.section} ${css.log}`}>
                <h3>Full dated result log{seasonName ? ` · ${seasonName}` : ''}</h3>
                {handout.log.map(t => (
                  <div key={t.test}>
                    <strong>{t.test}</strong>
                    {t.lines.map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                ))}
              </section>
            )}
            {!anythingChosen && <p className={css.empty} style={{ marginTop: '1rem' }}>Nothing chosen yet — tick what belongs in this conversation.</p>}
            <footer className={css.paperFoot}>For this player’s development conversation · A record of this season’s coaching</footer>
            <a href="#handout-choices" className={`${css.jumpLink} ${css.jumpBack}`}>↑ Back to the choices</a>
          </article>
        </div>
      )}
    </div>
  );
}
