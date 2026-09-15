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
import { logLine, handoutResultNote, observationText } from '@/lib/development-report';
import { playerName as rosterName } from '@/lib/coach-roster-name';
import { GOAL_STATUS_LABELS } from '@/lib/development-goal-history';
import { formatShortDate } from '@/lib/measurable-format';
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
 * ⚠ NOTHING IS STORED (build call, recommended): the handout is a print of the record as of today,
 * prepared fresh each time. A next step worth keeping is a goal REVIEW — Phase 2's record — and the
 * link beneath the box takes the coach there; this screen never grows a second store.
 */

interface HandoutData {
  showGoals: boolean;
  showMeasurables: boolean;
  types: RepTeamMeasurableType[];
  measurables: RepPlayerMeasurable[];
  goals: RepPlayerDevelopmentGoal[];
  observations: RepPlayerObservation[];
  authors: Record<string, string>;
  viewerId: string | null;
}

const resultKey = (typeId: string, rowKey: string) => `${typeId}|${rowKey}`;

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
  const header = (
    <CoachPageHeader
      icon={Printer}
      title="Preview development handout"
      backTo={backTo}
      helpLabel="Development"
      help={{ module: 'coaches', sectionIds: ['premium-development'], fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
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

  const author = (id: string | null) => (id ? (data.authors[id] ?? 'a coach') : 'a coach');
  const preparedLine = `Prepared ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · ${author(data.viewerId)}`;
  const chosenGoals = data.showGoals ? data.goals.filter(g => chosenGoalIds.has(g.id)) : [];
  const chosenObservations = data.showGoals ? observations.filter(o => chosenObservationIds.has(o.id)) : [];
  const chosenResults = data.showMeasurables
    ? tests.flatMap(t => t.rows.filter(r => chosenResultKeys.has(resultKey(t.type.id, r.key))).map(row => ({ type: t.type, row })))
    : [];
  // ONE goal carries both the printed "we'll look at this again on …" date and the "save this next
  // step as a review" door: the chosen goal with the earliest review date, else the first chosen.
  const goalForReview = [...chosenGoals].sort((a, b) => (a.reviewOn ?? '9999').localeCompare(b.reviewOn ?? '9999'))[0] ?? null;
  const nextReviewOn = goalForReview?.reviewOn ?? null;
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
          <section className={css.choose} aria-labelledby="handout-choose">
            <h2 id="handout-choose" className={css.chooseTitle}>Choose what belongs in this conversation</h2>
            <p className={css.chooseSub}>Current season · one player. Nothing here is stored or sent — the handout is a print of the record as of today.</p>

            {data.showGoals && data.goals.length > 0 && (
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
            )}

            {data.showGoals && observations.length > 0 && (
              <fieldset className={css.group}>
                <legend>A recent observation</legend>
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
            )}

            {data.showMeasurables && tests.length > 0 && (
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
                          <span>Which result</span>
                          <select className={`${shared.select} ${shared.devToolbarControl}`} value={chosen.key} onChange={e => pickResult(type.id, e.target.value)}>
                            {rows.map(r => <option key={r.key} value={r.key}>{formatShortDate(r.recordedOn)} · {headlineLabel(r, type)}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}

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
                <span>Include the full dated result log<span className={css.choiceMeta}>An appendix — one line per session, every attempt listed.</span></span>
              </label>
            )}

            <div className={css.actions}>
              <button type="button" className={`btn btn-lime ${shared.tapFloor}`} disabled={printBusy || !anythingChosen} onClick={print}>
                <Printer size={14} aria-hidden /> {printBusy ? 'Building PDF…' : 'Print / Save as PDF'}
              </button>
            </div>
            <p className={css.boundary}>
              Excludes tryout evaluations, other players’ figures and internal notes — the same boundary the previous PDF kept. No link is created and nothing is sent.
            </p>
          </section>

          {/* ── The paper, as it will print ── */}
          <article className={css.paper} aria-label="The handout as it will print">
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
          </article>
        </div>
      )}
    </div>
  );
}
