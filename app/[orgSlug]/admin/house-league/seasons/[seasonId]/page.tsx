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
 *   the rare door — Complete (and on a finished season Archive / Reopen) ends the body, a sentence and a link. A shell that
 *   has not opened registration and has nothing real attached ends with "Delete the season…" instead (owner 2026-10-25).
 * EVERY STATUS CHANGE ASKS (SeasonStatusWindow). A finished season (completed / archived) reads in place, every write
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
import { DELETE_DOOR, movesFrom, rareDoor, type StatusMove } from '@/lib/house-league-status-words';
import { JAN_1, type Cutoff } from '@/lib/born-years';
import { sportLabel } from '@/lib/sports';
import { pluralize } from '@/lib/utils';
import type { LeagueSeason } from '@/lib/types';

interface SeasonDetail {
  season: LeagueSeason;
  /** A shell the season may still be deleted from: not yet open, nothing real attached (decided by the server). */
  deletable?: boolean;
  birthdayCutoff?: Cutoff;
  divisions: SeasonDivision[];
  summary: {
    activeRegistrationCount: number;
    waitlistCount: number;
    pendingReviewCount: number;
    unplacedCount: number;
    unpaidFeeCount: number;
  };
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
  const [capHit, setCapHit] = useState<LeagueCapKind | null>(null);

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
    return <div className={repKit.page}>{header}<EmptyCard title="You don’t have access to this page." /></div>;
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
  const rare = canMove ? (['complete', 'archive', 'reopen'] as const).filter(m => moves.includes(m) && !(m === 'complete' && pastItsEnd)) : [];

  return (
    <div className={repKit.page}>
      {header}
      <p className={s.sub}>
        <span>{[dates ?? 'Dates not set', sport].join(' · ')}</span>
        <SeasonStatePill season={season} />
      </p>

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
                    <span className={s.stepLine}>{st.line}</span>
                  </span>
                  {door && <button type="button" className="btn btn-outline" onClick={door.onClick}>{door.label}</button>}
                </li>
              );
            })}
          </ul>
          {foot && <p className={s.emptyLine}>{foot}</p>}
        </ClubSection>
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
      {rare.map(m => {
        const door = rareDoor(m, season);
        return (
          <p key={m} className={s.rareDoor}>
            {door.sentence}{' '}
            <button type="button" className={repKit.inlineLink} onClick={() => setMove(m)}>{door.link}</button>
          </p>
        );
      })}

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
          onCapHit={kind => { setAdding(false); setCapHit(kind); }}
        />
      )}
      {capHit && <LeagueCapUpgradeModal capHit={capHit} onClose={() => setCapHit(null)} orgId={currentOrg?.id} />}
    </div>
  );
}
