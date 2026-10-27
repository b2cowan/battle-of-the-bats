'use client';
/**
 * A HOUSE-LEAGUE SEASON'S TEAMS & DRAFT, ON THE CLUB KIT (Club Tier Stage 9c, Part 3; copy HOUSE_LEAGUE_STAGE9C_COPY.md
 * §1-8; drawings HOUSE_LEAGUE_STAGE9C_DRAWINGS.html a-i). The 1,074-line old-look page, with its Draft mode and Randomize
 * (both retired, 9c·5), rebuilt once:
 *
 *   the head      — "Teams & draft" under the season, its sub line counting what is published;
 *   the tabs      — one a division, with its accepted count (9c·6: each division is drafted and published on its own);
 *   the division  — its state pill (click: what is left), Run the draft / Draft again / Publish teams (absent until they
 *                   can be pressed), Tools ⋯ (Export; Take all players off teams, before publishing);
 *   the steps     — Teams · Ratings · Draft · Publish, each a line that says where it stands;
 *   the board     — Not on a team and the team cards (TeamsBoard); a phone has a list and a team's view;
 *   the windows   — Rate · the draft · a team and its coaches · Create teams · Publish · Move to… and the held move.
 *
 * WHO MAY (the one gate): `run` drags, moves, locks, drafts, publishes and edits teams; `seeRatings` / `rate` are the
 * runners' alone (9c·2a): the registrar reads the board with no rating, average, lock, "Moved by you" or button (copy §13).
 */
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Check, ChevronUp, MoreHorizontal, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useHouseLeagueAccess, useSeasonAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import ck from '../../ClubKit.module.css';
import { Callout, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead } from '../../RepKit';
import { moneyFetch } from '../../money/MoneyKit';
import HubTabBar from '@/components/shared/HubTabBar';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { dayOf } from './api';
import { divisionState, stateWords } from '@/lib/house-league-teams-words';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import ConfirmWindow from '../registrations/ConfirmWindow';
import { send, teamsRoutes, type BoardPlayer, type BoardRead } from './api';
import { draftRefusal } from '@/lib/house-league-teams-words';
import TeamsBoard, { type PlayerMenuItem } from './TeamsBoard';
import RateWindow from './RateWindow';
import DraftWindow from './DraftWindow';
import TeamWindow, { CreateTeamsWindow } from './TeamWindow';
import PublishWindow, { type PublishOutcome } from './PublishWindow';
import { HeldMoveWindow, MoveSheet } from './MoveWindow';
import { exportTeamsXlsx } from './teamsExport';
import css from './Teams.module.css';

type Act =
  | { kind: 'rate' }
  | { kind: 'draft'; again: boolean }
  | { kind: 'publish' }
  | { kind: 'create' }
  | { kind: 'team'; teamId: string; how?: 'edit' | 'coach' | 'delete' }
  | { kind: 'move'; playerId: string }
  | { kind: 'held'; playerId: string; teamId: string | null }
  | { kind: 'clear' };

interface SeasonLite { id: string; name: string; status: string }

type StepKey = 'teams' | 'ratings' | 'draft' | 'publish';

/**
 * A12: a closed steps drawer stays closed for this person on this division until they open it again — browser storage,
 * one key a division. Every read and write is wrapped: a private window, blocked storage or a thrown accessor means the
 * drawer is open, which loses nothing.
 */
const stepsKey = (divisionId: string) => `fieldlogic:teams-steps-closed:${divisionId}`;
function readStepsClosed(divisionId: string): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(stepsKey(divisionId)) === '1'; } catch { return false; }
}
function writeStepsClosed(divisionId: string, closed: boolean) {
  try {
    if (closed) window.localStorage.setItem(stepsKey(divisionId), '1');
    else window.localStorage.removeItem(stepsKey(divisionId));
  } catch { /* the drawer still folds for this visit */ }
}

export default function TeamsScreen() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { seasonId } = useParams<{ seasonId: string }>();
  const search = useSearchParams();
  const isPhone = useIsPhone();
  const orgSlug = currentOrg?.slug ?? '';
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const routes = useMemo(() => teamsRoutes(seasonId, orgQuery), [seasonId, orgQuery]);
  const base = `/${orgSlug}/admin/house-league/seasons/${seasonId}`;
  const asked = search.get('d');

  const [season, setSeason] = useState<SeasonLite | null>(null);
  const [read, setRead] = useState<BoardRead | null>(null);
  const [ratings, setRatings] = useState<Map<string, number>>(new Map());
  const [failed, setFailed] = useState(false);
  const [act, setAct] = useState<Act | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [lastPublish, setLastPublish] = useState<PublishOutcome | null>(null);
  const [resending, setResending] = useState(false);
  // Families together (A7): on by default, and the last choice holds for the visit so Draft again honours it.
  const [together, setTogether] = useState(true);
  // This visit's presses of Hide/Show steps, a division each; a division not pressed yet reads what the browser kept.
  const [stepsPressed, setStepsPressed] = useState<Record<string, boolean>>({});
  const stepsClosedFor = (divisionId: string) => stepsPressed[divisionId] ?? readStepsClosed(divisionId);
  const setStepsClosed = (divisionId: string, closed: boolean) => {
    setStepsPressed(prev => ({ ...prev, [divisionId]: closed }));
    writeStepsClosed(divisionId, closed);
  };

  const gate = useHouseLeagueAccess();
  const access = useSeasonAccess(season);
  const beginRead = useLatestRead();

  const load = useCallback(async (withSeason = true) => {
    if (!orgSlug || !seasonId) return;
    const current = beginRead();
    const [seasonRes, boardRes] = await Promise.all([
      withSeason ? moneyFetch<{ season?: SeasonLite }>(routes.season).catch(() => null) : null,
      moneyFetch<BoardRead>(routes.board(asked)).catch(() => null),
    ]);
    if (!current()) return;
    if (!boardRes?.ok || (withSeason && !seasonRes?.data.season)) { setFailed(true); return; }
    if (withSeason && seasonRes?.data.season) {
      const s = seasonRes.data.season;
      setSeason({ id: s.id, name: s.name, status: s.status });
    }
    setRead(boardRes.data);
    setRatings(new Map(Object.entries(boardRes.data.ratings ?? {})));
    setFailed(false);
  }, [orgSlug, seasonId, routes, asked, beginRead]);
  useDeferredLoad(!orgLoading && !!orgSlug && !!gate?.read, load);
  const reload = useCallback(() => { void load(false); }, [load]);

  const board = read?.board ?? null;
  const rights = { run: !!access?.run, seeRatings: !!access?.seeRatings && !!read?.ratings, rate: !!access?.rate };
  const published = !!board?.division.publishedAt;
  const teamName = useCallback((id: string | null) => board?.teams.find(t => t.id === id)?.name ?? W.pool.title, [board]);

  const header = (
    <AdminPageHeader
      eyebrow={season?.name ?? 'House league'}
      title={W.title}
      backTo={{ href: base, label: season?.name ?? 'Season' }}
      inlineActions
    />
  );
  if (orgLoading || !gate) return <PageLoading header={header} label={W.loading} />;
  if (!gate.read) return <div className={repKit.page}>{header}<EmptyCard title={W.noAccess} /></div>;
  if (!read && !failed) return <PageLoading header={header} label={W.loading} />;
  if (failed || !read || !season) {
    return <div className={repKit.page}>{header}<LoadFailed title={W.failed} onRetry={() => { setFailed(false); void load(); }} /></div>;
  }
  const tabs = read.tabs;
  const sub = <p className={css.headSub}>{W.sub(season.name, tabs.length, tabs.filter(t => t.publishedAt).length)}</p>;
  if (!board || tabs.length === 0) {
    return <div className={repKit.page}>{header}{sub}<EmptyCard title={W.noDivisions.title}>{W.noDivisions.body}</EmptyCard></div>;
  }

  // ── Derived ──────────────────────────────────────────────────────────────────────────────────
  const division = board.division;
  const players = board.players;
  const placed = players.filter(p => p.teamId);
  const familyCount = new Set(placed.map(p => p.guardianEmail).filter(Boolean)).size;
  const state = divisionState({ teams: board.teams.length, placed: placed.length, publishedAt: division.publishedAt });
  const day = division.publishedAt ? dayOf(division.publishedAt) : '';
  const words = stateWords(state, { day, familyCount });
  const rated = players.filter(p => ratings.has(p.id)).length;
  const moves = players.filter(p => !published && p.draftTeamId && p.teamId !== p.draftTeamId);
  const tab = tabs.find(t => t.id === division.id);
  const registrationsHref = `${base}/registrations?tab=review`;
  const canRun = rights.run && !published && board.teams.length > 0 && players.length > 0;
  const canPublish = rights.run && !published && placed.length > 0;
  const findPlayer = (id: string) => players.find(p => p.id === id) ?? null;

  // ── The presses ──────────────────────────────────────────────────────────────────────────────
  async function place(player: BoardPlayer, teamId: string | null, confirmed = false) {
    if (published && !confirmed) { setAct({ kind: 'held', playerId: player.id, teamId }); return; }
    const r = await send<{ emailed?: { failed: number } }>(routes.placement, 'POST', { action: 'place', registrationId: player.id, teamId, confirmed });
    if (!r.ok) {
      if (r.code === 'published') { setAct({ kind: 'held', playerId: player.id, teamId }); return; }
      setNotice(r.error);
    } else if (r.data.emailed && r.data.emailed.failed > 0) {
      setNotice(W.move.emailFailed);
    }
    setAct(null);
    reload();
  }
  async function lock(player: BoardPlayer, locked: boolean) {
    const r = await send(routes.placement, 'POST', { action: 'lock', registrationId: player.id, locked });
    if (!r.ok) setNotice(r.error);
    setAct(null);
    reload();
  }
  function onMenu(player: BoardPlayer, key: PlayerMenuItem['key']) {
    if (key === 'move') setAct({ kind: 'move', playerId: player.id });
    else if (key === 'lock') void lock(player, true);
    else if (key === 'unlock') void lock(player, false);
    else if (key === 'putBack' && player.draftTeamId) void place(player, player.draftTeamId);
  }
  async function resend() {
    setResending(true);
    const r = await send<{ outcome: { failed: number } }>(routes.publish, 'POST', { action: 'resend', divisionId: division.id });
    setResending(false);
    if (!r.ok) setNotice(r.error);
    reload();
  }
  async function clearAll() {
    const r = await send(routes.draft, 'POST', { action: 'clear', divisionId: division.id, fingerprint: board!.fingerprint });
    if (!r.ok) setNotice(r.error);
    setAct(null);
    reload();
  }

  // ── The head of the division ─────────────────────────────────────────────────────────────────
  const pillTone = state === 'published' ? css.pillDone : state === 'drafted' ? css.pillDrafted : css.pillPlain;
  const buttons = (
    <div className={css.divActions}>
      {state === 'notDrafted' && canRun && (
        <button type="button" className="btn btn-lime" onClick={() => setAct({ kind: 'draft', again: false })}>{isPhone ? W.button.runPhone : W.button.run}</button>
      )}
      {state === 'drafted' && canRun && (
        <button type="button" className="btn btn-outline" onClick={() => setAct({ kind: 'draft', again: true })}>{W.button.again}</button>
      )}
      {state === 'drafted' && canPublish && (
        <button type="button" className="btn btn-lime" onClick={() => setAct({ kind: 'publish' })}>{W.button.publish}</button>
      )}
      <CoachToolbarMenu
        label={W.tools}
        icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
        collapseOnPhone
        bareOnPhone
        drawerOnPhone
        drawerTitle={W.tools}
        triggerClassName={tb.tool}
      >
        <CoachToolbarMenuItem label={W.export} onSelect={() => void exportTeamsXlsx(board, ratings, rights.seeRatings, orgSlug)} />
        {rights.run && !published && placed.length > 0 && (
          <CoachToolbarMenuItem label={W.clear.menu} onSelect={() => setAct({ kind: 'clear' })} />
        )}
      </CoachToolbarMenu>
    </div>
  );

  // ── The steps ────────────────────────────────────────────────────────────────────────────────
  const teamNames = board.teams.map(t => t.name);
  const noCoach = board.teams.filter(t => t.coaches.length === 0).map(t => t.name);
  const steps: { key: StepKey; done: boolean; title: string; line: string; button?: React.ReactNode }[] = [
    {
      key: 'teams', done: board.teams.length > 0, title: W.stepTitle.teams,
      line: board.teams.length ? W.step.teams(teamNames, noCoach) : W.step.teamsNone,
      button: rights.run && !published ? (
        <button type="button" className={board.teams.length ? 'btn btn-outline' : 'btn btn-lime'} onClick={() => setAct({ kind: 'create' })}>
          <Plus size={14} aria-hidden />{board.teams.length ? W.button.addTeams : W.button.createTeams}
        </button>
      ) : undefined,
    },
    ...(rights.seeRatings ? [{
      key: 'ratings' as const, done: players.length > 0 && rated === players.length, title: W.stepTitle.ratings,
      line: players.length === 0 ? W.step.ratingsEmpty(tab?.capacity ?? null) : rated === 0 ? W.step.ratingsNone : W.step.ratings(rated, players.length),
      button: rights.rate && players.length > 0 && !published ? (
        <button type="button" className="btn btn-outline" onClick={() => setAct({ kind: 'rate' })}>{isPhone ? W.button.ratePhone : W.button.rate}</button>
      ) : undefined,
    }] : []),
    {
      key: 'draft', done: placed.length > 0, title: W.stepTitle.draft,
      line: board.teams.length === 0 ? draftRefusal('noTeams', { division: division.name }) : W.step.draft(players.length, board.teams.length),
    },
    { key: 'publish', done: published, title: W.stepTitle.publish, line: published ? words.says : W.step.publish(familyCount) },
  ];
  const outLine = W.notDrafted(board.notDrafted.review.length, board.notDrafted.waitlisted);
  // The drawer's closed line: how many steps are done, and the first one that isn't. Ratings is never "next" once the
  // draft has run (rating is optional: an unrated player counts as a 3), so a drafted division points at Publish.
  const doneCount = steps.filter(s => s.done).length;
  const nextStep = steps.find(s => !s.done && !(s.key === 'ratings' && (placed.length > 0 || players.length === 0))) ?? null;
  // Only a button that lives nowhere else: Create teams and Rate players. Run the draft and Publish sit in the head.
  const nextButton = nextStep && (nextStep.key === 'teams' || nextStep.key === 'ratings') ? nextStep.button : null;
  const stepsClosed = stepsClosedFor(division.id);

  // ── The result after publishing (copy §7.2) ──────────────────────────────────────────────────
  const invitedNow = lastPublish?.invited ?? board.teams.flatMap(t => t.coaches
    .filter(c => c.invitedAt && division.publishedAt && new Date(c.invitedAt).getTime() === new Date(division.publishedAt).getTime())
    .map(c => ({ name: c.name, team: t.name })));
  // The families the Publish emails reached: this press's own answer, or after a reload the rows written at Publish that went.
  const emailed = lastPublish ? lastPublish.outcome.sent + lastPublish.outcome.skipped : board.emails.atPublishSent;
  const unsent = board.emails.unsent;

  const playerFor = act && (act.kind === 'move' || act.kind === 'held') ? findPlayer(act.playerId) : null;
  const teamFor = act?.kind === 'team' ? board.teams.find(t => t.id === act.teamId) ?? null : null;

  return (
    <div className={`${repKit.page} ${repKit.moneyFrame} ${css.screen}`}>
      {header}
      {sub}
      <HubTabBar
        tabs={tabs.map(t => ({ id: t.id, label: t.name, href: `${base}/teams?d=${t.id}`, mark: <span className={css.tabCount}>{t.accepted}</span> }))}
        activeId={division.id}
        ariaLabel={W.tabsLabel}
        remeasureKey={tabs.map(t => t.accepted).join('-')}
      />

      <section className={css.panel} aria-labelledby="division-name">
        <div className={css.divHead}>
          <h2 id="division-name" className={css.divTitle}>{division.name}</h2>
          <button type="button" className={`${css.pill} ${pillTone}`} aria-expanded={whyOpen} onClick={() => setWhyOpen(v => !v)}>
            {state === 'drafted' && <span className={css.pillDot} aria-hidden />}{words.pill}
          </button>
          <span className={css.spacer} />
          {buttons}
        </div>
        {whyOpen && <p className={css.why} role="status">{words.says}</p>}

        {published && (
          <>
            <Callout tone="info" role="status">
              <b>{emailed > 0 || invitedNow.length > 0 ? W.publish.done(day, emailed, invitedNow) : W.publish.doneQuiet(day)}</b>
            </Callout>
            {unsent > 0 && rights.run && (
              <Callout tone="warn" role="alert" action={
                <button type="button" className="btn btn-outline" disabled={resending} onClick={() => void resend()}>{W.publish.sendAgain(unsent)}</button>
              }>
                <b>{W.publish.failed(unsent, Math.max(board.emails.atPublish, unsent))}</b>
              </Callout>
            )}
            {rights.run && <p className={css.quiet}>{W.publish.after}</p>}
          </>
        )}

        {/* The steps are the way TO a published division. Once it is published every button is gone and each line repeats the cards or the notice above, so the board takes the room (owner 2026-10-26). */}
        {!published && (
          <div className={css.drawer}>
            {/* The drawer (owner, round 3; A12): Hide steps folds it to one line that keeps the progress, the next step and
                that step's own button when it lives nowhere else (Run the draft and Publish teams sit in the head). */}
            <div className={css.drawerHead}>
              <span className={css.drawerTitle}>{W.drawer.steps}</span>
              <span className={css.drawerProgress}>{W.drawer.done(doneCount, steps.length)}</span>
              {stepsClosed && nextStep && <span className={css.drawerNext}>· {W.drawer.next(W.drawer.nextPhrase[nextStep.key])}</span>}
              <span className={css.spacer} />
              {stepsClosed && nextButton}
              <button type="button" className={css.drawerToggle} aria-expanded={!stepsClosed} aria-controls={stepsClosed ? undefined : 'teams-steps'}
                onClick={() => setStepsClosed(division.id, !stepsClosed)}>
                {stepsClosed ? W.drawer.show : W.drawer.hide}
                <ChevronUp size={16} aria-hidden className={stepsClosed ? css.drawerFlip : undefined} />
              </button>
            </div>
            {!stepsClosed && (
              <ol id="teams-steps" className={css.steps}>
                {steps.map((s, i) => (
                  <li key={s.key} className={css.step}>
                    <span className={`${css.stepMark}${s.done ? ` ${css.stepDone}` : ''}`} aria-hidden>{s.done ? <Check size={14} /> : i + 1}</span>
                    <div className={css.stepText}>
                      <span className={css.stepTitle}>{s.title}</span>
                      <span className={css.stepLine}>{s.line}</span>
                    </div>
                    {s.button}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {outLine && (
          <p className={css.quiet}>{outLine} {board.notDrafted.review.length > 0 && <Link href={registrationsHref} className={ck.link}>{W.reviewLink}</Link>}</p>
        )}

        {/* A10: the averages and sizes live on each card's head now; this line keeps only the moves by hand. */}
        {rights.seeRatings && moves.length > 0 && (
          <p className={css.balance}><span>{W.balance.moved} <b>{moves.length}</b></span></p>
        )}

        {board.teams.length > 0 && (
          <TeamsBoard
            key={division.id}
            teams={board.teams}
            players={players}
            ratings={ratings}
            notes={read.notes ?? null}
            divisionName={division.name}
            paymentsHref={`${base}/registrations?tab=active`}
            left={board.left}
            published={published}
            rights={rights}
            isPhone={isPhone}
            teamName={teamName}
            onDrop={(id, teamId) => { const p = findPlayer(id); if (p) void place(p, teamId); }}
            onMenu={onMenu}
            onOpenTeam={(teamId, how) => setAct({ kind: 'team', teamId, how })}
          />
        )}
      </section>

      {act?.kind === 'rate' && (
        <RateWindow division={division.name} players={players} ratings={ratings} routes={routes} isPhone={isPhone}
          onRated={(ids, rating) => setRatings(prev => {
            const next = new Map(prev);
            for (const id of ids) { if (rating == null) next.delete(id); else next.set(id, rating); }
            return next;
          })}
          onClose={() => { setAct(null); reload(); }} />
      )}
      {act?.kind === 'draft' && (
        <DraftWindow board={board} ratings={ratings} again={act.again} together={together} onTogether={setTogether} routes={routes} registrationsHref={registrationsHref}
          onDone={() => { setAct(null); reload(); }} onClose={() => { setAct(null); reload(); }} />
      )}
      {act?.kind === 'publish' && (
        <PublishWindow board={board} season={season.name} routes={routes} registrationsHref={registrationsHref}
          onDone={result => { setLastPublish(result); setAct(null); reload(); }}
          onClose={() => { setAct(null); reload(); }} />
      )}
      {act?.kind === 'create' && (
        <CreateTeamsWindow divisionId={division.id} divisionName={division.name} existing={board.teams.map(t => t.name)} routes={routes}
          onDone={() => { setAct(null); reload(); }} onClose={() => setAct(null)} />
      )}
      {act?.kind === 'team' && teamFor && rights.run && (
        <TeamWindow team={teamFor} divisionName={division.name} published={published}
          playerCount={players.filter(p => p.teamId === teamFor.id).length} routes={routes} blankCoach={act.how === 'coach'} startDeleting={act.how === 'delete' && rights.run}
          onChanged={reload} onClose={() => setAct(null)} />
      )}
      {act?.kind === 'move' && playerFor && (
        <MoveSheet player={playerFor} teams={board.teams} players={players} ratings={ratings} seeRatings={rights.seeRatings}
          divisionName={division.name} published={published}
          onPick={teamId => void place(playerFor, teamId)} onLock={locked => void lock(playerFor, locked)} onClose={() => setAct(null)} />
      )}
      {act?.kind === 'held' && playerFor && (
        <HeldMoveWindow player={playerFor} to={act.teamId} teams={board.teams}
          onConfirm={() => place(playerFor, act.teamId, true)} onClose={() => setAct(null)} />
      )}
      {act?.kind === 'clear' && (
        <ConfirmWindow title={W.clear.title(division.name)} body={W.clear.body(placed.length, division.name)} go={W.clear.button}
          onClose={() => setAct(null)} onConfirm={clearAll} />
      )}
      {notice && <NoticePill key={notice} message={notice} onDone={() => setNotice(null)} />}
    </div>
  );
}
