'use client';
/**
 * A HOUSE-LEAGUE SEASON'S OWN PAGE — its Overview (Club Tier Stage 9a, Part 4; owner 9a·4, 9a·6, Q16, S1·b; frames B, C, D;
 * words HOUSE_LEAGUE_STAGE9A_COPY.md §3–§5).
 *
 *   the header — the season's name, dates · sport, what is happening (the pill), View public page;
 *   one next step — a getting-ready season leads with its checklist and "Open registration" (absent until the three steps
 *     are done); a closed one with "Start season"; Close / Reopen registration sit on the Registration block;
 *   the figures band — Players · To review · Waitlist · Teams, one joined band (the money figure is 9b-2's, not built);
 *   Divisions — Born in · Players · Price · Early bird; "+ Add age groups" asks in its window, a division's pencil flips
 *     its whole record in place (9b-1, Part 2; the checklist's five lines are lib/house-league-season.ts seasonChecklist,
 *     the same function the server refuses Open registration with);
 *   Season and Registration — each reads first and edits whole;
 *   the rare door — Complete (and on a finished season Reopen) ends the body, a sentence and a link. A shell that
 *   has not opened registration and has nothing real attached ends with "Delete the season…" instead (owner 2026-10-25).
 * EVERY STATUS CHANGE ASKS (SeasonStatusWindow). A finished season (completed, or archived before Archive was retired in
 * 9f·4 — it reads exactly as a completed one) reads in place, every write
 * control absent, through the one gate (Q16): `houseLeagueAccess(…, season)` says `run: false` and the page renders from
 * it. The registrar reads it all with no pencils and no doors (frame C).
 */
import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, ExternalLink, Minus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { LeagueCapUpgradeModal } from '@/components/admin/LeagueCapUpgrade';
import { ClubSection, EmptyCard, LoadFailed, PageLoading, repKit, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
import { NotYours } from '@/components/admin/kit/club/NotYours';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import SeasonStatePill from '@/components/admin/kit/club/SeasonStatePill';
import SeasonStatusWindow from '@/components/admin/kit/club/league/SeasonStatusWindow';
import DeleteSeasonWindow from '@/components/admin/kit/club/league/DeleteSeasonWindow';
import DivisionsBlock, { type SeasonDivision } from '@/components/admin/kit/club/league/DivisionsBlock';
import AddAgeGroupsWindow from '@/components/admin/kit/club/league/AddAgeGroupsWindow';
import { RegistrationBlock, SeasonBlock } from '@/components/admin/kit/club/league/SeasonRecordBlocks';
import s from '@/components/admin/kit/club/league/LeagueSeason.module.css';
import { announceSeasonsChanged, useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { isFreeFloorLeague, type LeagueCapKind } from '@/lib/free-floor';
import { fireLeagueEvent } from '@/lib/league-events-client';
import { checklistFoot, checklistLeft, isPastItsEnd, seasonChecklist, seasonDates } from '@/lib/house-league-season';
import { registrationState } from '@/lib/league-registration-state';
import { seasonCharges } from '@/lib/league-price';
import { DELETE_DOOR, START_DOOR, movesFrom, rareDoor, type StatusMove } from '@/lib/house-league-status-words';
import { START_FROM_WORDS as SF, markedLines, readStartedFrom, startedLine } from '@/lib/house-league-start-from';
import { isFinishedLeagueSeason } from '@/lib/house-league-access';
import CreateLeagueSeasonDialog from '@/components/admin/kit/club/CreateLeagueSeasonDialog';
import type { SeasonSlotHolder } from '@/lib/free-floor';
import { JAN_1, type Cutoff } from '@/lib/born-years';
import { sportLabel } from '@/lib/sports';
import { pluralize } from '@/lib/utils';
import type { LeagueSeason } from '@/lib/types';
import Link from 'next/link';
import { formatLeagueMoney, type SeasonMoney } from '@/lib/league-money';
import { TILE_WORDS } from '@/lib/house-league-money-words';

interface SeasonDetail {
  season: LeagueSeason;
  /** A shell the season may still be deleted from: not yet open, nothing real attached (decided by the server). */
  deletable?: boolean;
  /** A finished season's Reopen facts (9f-1): the newer seasons it leaves alone, and the free plan's holder that blocks it. */
  reopen?: { newer: string[]; blockedBy: { name: string; status: string } | null };
  birthdayCutoff?: Cutoff;
  divisions: SeasonDivision[];
  summary: {
    activeRegistrationCount: number;
    waitlistCount: number;
    pendingReviewCount: number;
    unplacedCount: number;
    unpaidFeeCount: number;
  };
  /** The season's money band (9b-2, lib/league-money.ts seasonMoney): the Owed · Still owing tiles. */
  money?: SeasonMoney;
  /** Has the club given this season any of its time (9f-2 mk.noTime), and has any of it been divided into a division's
   *  games or practices (Stage 13 fix-now 4)? Null where the club's schedule does not exist. */
  clubTime?: { given: boolean; divided: boolean } | null;
}

export default function SeasonOverviewPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const { seasonId } = useParams<{ seasonId: string }>();
  const orgSlug = currentOrg?.slug ?? '';
  const router = useRouter();

  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  const [move, setMove] = useState<StatusMove | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openRegistration, setOpenRegistration] = useState(0);
  const [capHit, setCapHit] = useState<{ kind: LeagueCapKind; holder?: SeasonSlotHolder } | null>(null);
  const [startingNext, setStartingNext] = useState(false);

  const access = useHouseLeagueAccess(detail?.season ?? null);

  const load = useCallback(async () => {
    if (!orgSlug || !seasonId) return;
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${seasonId}?orgSlug=${encodeURIComponent(orgSlug)}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) { setFailed('missing'); return; }
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      setFailed(null);
      setDetail(data);
    } catch {
      setFailed('error');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, seasonId]);
  useDeferredLoad(!!currentOrg && !!seasonId, load);

  // A change here re-reads the page AND the season frame (the rail's pill, the phone header's).
  const changed = useCallback(() => { void load(); announceSeasonsChanged(); }, [load]);

  const season = detail?.season;
  const header = (
    <AdminPageHeader
      eyebrow="House league · season"
      title={season?.name ?? 'Season'}
      backTo={{ href: `/${orgSlug}/admin/house-league`, label: 'Seasons' }}
      inlineActions
      actions={season && season.status !== 'draft' && orgSlug ? (
        <a
          href={`/${orgSlug}/league/${season.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-outline ${ck.iconOnlyPhone}`}
          aria-label="View public page"
          onClick={() => {
            // §13 League Starter first-value signal (share), the free floor only. Fire-and-forget.
            if (currentOrg && isFreeFloorLeague(currentOrg)) {
              fireLeagueEvent('league_public_page_shared', { orgId: currentOrg.id, metadata: { seasonId: season.id } });
            }
          }}
        >
          <ExternalLink size={14} aria-hidden /><span className={ck.btnWord}>View public page</span>
        </a>
      ) : undefined}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} label="Loading the season…" />;
  if (access && !access.read) {
    return <NotYours page="houseLeague" />;
  }
  if (failed === 'missing') return <div className={repKit.page}>{header}<EmptyCard title="We couldn’t find this season." /></div>;
  if (failed || !detail || !season) {
    return <div className={repKit.page}>{header}<LoadFailed title="We couldn’t load the season." onRetry={() => { setLoading(true); void load(); }} /></div>;
  }

  const { divisions, summary } = detail;
  const canRun = !!access?.run;
  const canMove = !!access?.changeStatus;
  const cutoff = detail.birthdayCutoff ?? JAN_1;
  const sport = sportLabel(season.sport);
  const dates = seasonDates(season);
  const spotCount = divisions.length > 0 && divisions.every(d => d.capacity != null && d.capacity > 0)
    ? divisions.reduce((n, d) => n + (d.capacity ?? 0), 0) : null;
  const steps = seasonChecklist(season, divisions);
  const foot = checklistFoot(steps);
  const charges = seasonCharges(divisions, season);
  // The checklist's "Set dates" / "Add instructions" open the Registration block where the answer is typed.
  const editRegistration = () => {
    setOpenRegistration(n => n + 1);
    document.getElementById('registration-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const stepDoor: Record<string, { label: string; onClick: () => void } | undefined> = {
    ageGroups: { label: 'Add age groups', onClick: () => setAdding(true) },
    dates: { label: 'Set dates', onClick: editRegistration },
    pay: { label: 'Add instructions', onClick: editRegistration },
  };
  // The dates run the form (9b-1 Part 4): a season its close date closed offers Start season and Reopen until….
  const regState = registrationState(season);
  const moves = movesFrom(season.status, regState);
  const facts = {
    seasonName: season.name,
    seasonStartDate: season.seasonStartDate,
    seasonEndDate: season.seasonEndDate,
    registrationOpenAt: season.registrationOpenAt,
    registrationCloseAt: season.registrationCloseAt,
    autoApproveUnderCapacity: season.autoApproveUnderCapacity,
    pendingReviewCount: summary.pendingReviewCount,
    waitlistCount: summary.waitlistCount,
    unpaidFeeCount: summary.unpaidFeeCount,
    reopen: detail.reopen,
  };
  const teams = divisions.reduce((n, d) => n + d.teamCount, 0);

  // Close / Reopen registration sit on the Registration block (9a·4); the others are the next step or the rare door.
  const regDoor = canMove && (moves.includes('close') || moves.includes('reopenRegistration')) ? (
    <button type="button" className="btn btn-outline" onClick={() => setMove(moves.includes('close') ? 'close' : 'reopenRegistration')}>
      {moves.includes('close') ? 'Close registration' : 'Reopen until…'}
    </button>
  ) : undefined;
  const pastItsEnd = canMove && moves.includes('complete') && isPastItsEnd(season);
  // Once Complete has its own Next step card above, the door at the end of the page would only repeat it.
  const rare = canMove ? (['complete', 'reopen'] as const).filter(m => moves.includes(m) && !(m === 'complete' && pastItsEnd)) : [];
  // Start next season (9f-2, 9f·8): every season but a getting-ready one, for whoever moves a season; never on the free League
  // plan, whose window has no Start from. It sits after Complete and before Reopen (copy §12).
  const startDoor = canMove && season.status !== 'draft' && !!currentOrg && !isFreeFloorLeague(currentOrg);
  // A season started from another (mig 432): its line and marks while it is getting ready, for the people who run it.
  const startedFrom = season.status === 'draft' && canRun ? readStartedFrom(season.startedFrom) : null;
  const marks = startedFrom ? markedLines(startedFrom, season, divisions) : new Set<string>();
  const markFor = (key: string) => {
    if (!startedFrom || !marks.has(key)) return null;
    // Every highlight opens something: "Moved 52 weeks" opens the registration dates; "From …" opens the season it came from.
    if (key === 'dates') {
      return startedFrom.shiftDays == null ? null
        : <button type="button" className={`${ck.chip} ${s.stepMark}`} onClick={editRegistration}>{SF.markMoved(startedFrom.shiftDays)}</button>;
    }
    return <Link href={`/${orgSlug}/admin/house-league/seasons/${startedFrom.sourceId}`} className={`${ck.chip} ${s.stepMark}`}>{SF.markFrom(startedFrom.sourceName)}</Link>;
  };
  // The club's time (copy §11 mk.noTime; Stage 13 fix-now 4, F-O3-7), for the people who run a live season — who are the
  // people who divide it (House league's time saves on `run`). Three states: none given (where the club's schedule exists,
  // placing a game anywhere is exactly the owner's and the admin's, the people who give time; a league admin is told to
  // ask, never sent to Schedules, which they can't open); given but not divided (the door to House league's time);
  // divided (no line).
  const clubTime = canRun && !isFinishedLeagueSeason(season) ? detail.clubTime ?? null : null;
  const showNoTime = !!clubTime && !clubTime.given;
  const showUndivided = !!clubTime && clubTime.given && !clubTime.divided;

  return (
    <div className={repKit.page}>
      {header}
      <p className={s.sub}>
        <span>{[dates ?? 'Dates not set', sport].join(' · ')}</span>
        <SeasonStatePill season={season} />
      </p>
      {startedFrom && (
        <p className={s.startedLine}>
          <span className={s.deskOnly}>{startedLine(startedFrom, false)}</span>
          <span className={s.phoneOnly}>{startedLine(startedFrom, true)}</span>
        </p>
      )}

      {/* The next step: a getting-ready season's checklist, with Open registration once it is done (9a·4). */}
      {season.status === 'draft' && (
        <ClubSection
          title="Before you open registration"
          actions={canMove && checklistLeft(steps).length === 0
            ? <button type="button" className="btn btn-lime" onClick={() => setMove('open')}>Open registration</button>
            : undefined}
        >
          <ul className={s.checklist}>
            {steps.map(st => {
              const door = canRun && !st.done ? stepDoor[st.key] : undefined;
              return (
                <li key={st.key} className={`${s.step}${st.done ? '' : ` ${s.stepOpen}`}`}>
                  <span
                    className={`${s.tick}${st.done ? ` ${s.tickDone}` : ''}${!st.done && st.optional ? ` ${s.tickOptional}` : ''}`}
                    role="img"
                    aria-label={st.done ? 'Done' : st.optional ? 'Optional' : 'Not done'}
                  >
                    {st.done ? <Check size={13} aria-hidden /> : st.optional ? <Minus size={13} aria-hidden /> : null}
                  </span>
                  <span className={s.stepText}>
                    <span className={s.stepTitle}>{st.title}</span>
                    <span className={s.stepLine}>
                      {st.line}
                      {/* mk.ageLine (desk only): the birth years that moved, while the line is as it arrived. */}
                      {st.key === 'ageGroups' && startedFrom && marks.has('ageGroups') && startedFrom.bornShift > 0 && (
                        <span className={s.deskOnly}> · {SF.ageLineMoved(startedFrom.bornShift)}</span>
                      )}
                    </span>
                  </span>
                  {markFor(st.key)}
                  {door && <button type="button" className="btn btn-outline" onClick={door.onClick}>{door.label}</button>}
                </li>
              );
            })}
          </ul>
          {foot && <p className={s.emptyLine}>{foot}</p>}
        </ClubSection>
      )}
      {showNoTime && (
        <p className={s.timeNote}>
          {SF.noTime}
          <span className={s.deskOnly}> {access?.placeAnywhere ? SF.noTimeHowAdmin : SF.noTimeHowLeagueAdmin}</span>
        </p>
      )}
      {showUndivided && (
        <p className={s.timeNote}>
          {SF.timeNotDivided}{' '}
          <Link href={`/${orgSlug}/admin/house-league/seasons/${seasonId}/schedule?time=1`} className={ck.link}>{SF.timeNotDividedDoor}</Link>
        </p>
      )}
      {moves.includes('start') && canMove && (
        <ClubSection
          title="Next step"
          actions={<button type="button" className="btn btn-lime" onClick={() => setMove('start')}>Start season</button>}
        >
          <p className={s.emptyLine}>Registration is closed. Start the season when its teams and schedule are ready.</p>
        </ClubSection>
      )}

      {/* A season past its last day: completing it IS the next step, so it sits up here with the others, not down in the rare door. */}
      {pastItsEnd && (
        <ClubSection
          title="Next step"
          actions={<button type="button" className="btn btn-lime" onClick={() => setMove('complete')}>Complete the season</button>}
        >
          <p className={s.emptyLine}>{rareDoor('complete', season).sentence} Complete it when the games are done. It moves to Past seasons, and nobody is emailed.</p>
        </ClubSection>
      )}

      {season.status !== 'draft' && (
        <div className={s.band} role="group" aria-label="This season">
          <div className={s.tile}>
            <span className={s.tileLabel}>Players</span>
            <span className={s.tileValue}>{summary.activeRegistrationCount}</span>
            {spotCount != null && <span className={s.tileHint}>of {pluralize(spotCount, 'spot')}</span>}
          </div>
          <div className={s.tile}>
            <span className={s.tileLabel}>To review</span>
            <span className={`${s.tileValue}${summary.pendingReviewCount ? ` ${s.amber}` : ''}`}>{summary.pendingReviewCount}</span>
            <span className={s.tileHint}>Registrations</span>
          </div>
          <div className={s.tile}>
            <span className={s.tileLabel}>Waitlist</span>
            <span className={s.tileValue}>{summary.waitlistCount}</span>
          </div>
          <div className={s.tile}>
            <span className={s.tileLabel}>Teams</span>
            <span className={s.tileValue}>{teams}</span>
            {summary.unplacedCount > 0 && <span className={s.tileHint}>{pluralize(summary.unplacedCount, 'player')} unplaced</span>}
          </div>
          {/* The two money tiles 9b-1 left out (copy §11): each opens the Money page; absent on a free season. */}
          {charges && detail.money && access?.readMoney && (
            <>
              <Link
                href={`/${orgSlug}/admin/house-league/seasons/${season.id}/money`}
                className={`${s.tile} ${s.tileLink}`}
                aria-label={TILE_WORDS.aria(TILE_WORDS.owed, formatLeagueMoney(detail.money.owed), detail.money.owedPlayers)}
              >
                <span className={s.tileLabel}>{TILE_WORDS.owed}</span>
                <span className={s.tileValue}>{formatLeagueMoney(detail.money.owed)}</span>
                <span className={s.tileHint}>{pluralize(detail.money.owedPlayers, 'player')}</span>
              </Link>
              <Link
                href={`/${orgSlug}/admin/house-league/seasons/${season.id}/money`}
                className={`${s.tile} ${s.tileLink}`}
                aria-label={TILE_WORDS.aria(TILE_WORDS.owing, formatLeagueMoney(detail.money.owing), detail.money.owingPlayers)}
              >
                <span className={s.tileLabel}>{TILE_WORDS.owing}</span>
                <span className={`${s.tileValue}${detail.money.owing > 0 ? ` ${s.amber}` : ''}`}>{formatLeagueMoney(detail.money.owing)}</span>
                <span className={s.tileHint}>{pluralize(detail.money.owingPlayers, 'player')}</span>
              </Link>
            </>
          )}
        </div>
      )}

      {/* The season, then how it takes registrations, then the divisions inside it — the order a coach sets it up. */}
      <SeasonBlock season={season} canEdit={canRun} orgSlug={orgSlug} onSaved={changed} />
      <RegistrationBlock season={season} canEdit={canRun} orgSlug={orgSlug} onSaved={changed} door={regDoor} charges={charges} openSignal={openRegistration} />

      <DivisionsBlock
        season={season}
        divisions={divisions}
        cutoff={cutoff}
        canEdit={canRun}
        orgSlug={orgSlug}
        onChanged={changed}
        onAdd={() => setAdding(true)}
      />

      {/* The rare doors end the body (a sentence and a link that asks), never a pinned row. */}
      {/* In order: Complete, Start next season, Reopen (copy §12: Start next season comes before Reopen). */}
      {[
        ...(rare.includes('complete') ? [{ key: 'complete', ...rareDoor('complete', season), open: () => setMove('complete') }] : []),
        ...(startDoor ? [{ key: 'start', ...START_DOOR, open: () => setStartingNext(true) }] : []),
        ...(rare.includes('reopen') ? [{ key: 'reopen', ...rareDoor('reopen', season), open: () => setMove('reopen') }] : []),
      ].map(door => (
        <p key={door.key} className={s.rareDoor}>
          {door.sentence}{' '}
          <button type="button" className={repKit.inlineLink} onClick={door.open}>{door.link}</button>
        </p>
      ))}

      {canRun && detail.deletable && (
        <p className={s.rareDoor}>
          {DELETE_DOOR.sentence}{' '}
          <button type="button" className={repKit.inlineLink} onClick={() => setDeleting(true)}>{DELETE_DOOR.link}</button>
        </p>
      )}

      {deleting && (
        <DeleteSeasonWindow
          seasonId={season.id}
          seasonName={season.name}
          orgSlug={orgSlug}
          onClose={() => setDeleting(false)}
          // ⚠ Leave with the window STILL OPEN (KitDialog's header): the page unmounts and takes it along.
          onDeleted={() => { announceSeasonsChanged(); router.push(`/${orgSlug}/admin/house-league`); }}
        />
      )}
      {move && (
        <SeasonStatusWindow
          move={move}
          seasonId={season.id}
          orgSlug={orgSlug}
          facts={facts}
          status={season.status}
          onClose={() => setMove(null)}
          onDone={() => { setMove(null); changed(); }}
        />
      )}
      {adding && canRun && (
        <AddAgeGroupsWindow
          orgSlug={orgSlug}
          seasonId={season.id}
          seasonName={season.name}
          sport={sport}
          cutoff={cutoff}
          hasEarlyDate={!!season.earlyBirdUntil}
          existing={divisions.map(d => ({ name: d.name, born: { from: d.bornFromYear, to: d.bornToYear } }))}
          // Size and price start from the season: the last division's size, the season's price or the last division's.
          defaultSize={divisions.length ? divisions[divisions.length - 1].capacity : null}
          defaultPrice={season.registrationFee ?? (divisions.length ? divisions[divisions.length - 1].price : null)}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); changed(); }}
          onCapHit={kind => { setAdding(false); setCapHit({ kind }); }}
        />
      )}
      {startingNext && (
        <CreateLeagueSeasonDialog
          orgSlug={orgSlug}
          startFromId={season.id}
          onClose={() => setStartingNext(false)}
          onCapHit={(kind, holder) => { setStartingNext(false); setCapHit({ kind, holder }); }}
          // ⚠ Navigate with the window STILL OPEN (the house-league home's reason): the page unmounts and takes it along.
          onCreated={made => { announceSeasonsChanged(); router.push(`/${orgSlug}/admin/house-league/seasons/${made.id}`); }}
        />
      )}
      {capHit && <LeagueCapUpgradeModal capHit={capHit.kind} holder={capHit.holder} onClose={() => setCapHit(null)} orgId={currentOrg?.id} />}
    </div>
  );
}
