'use client';
/**
 * A HOUSE-LEAGUE SEASON'S OWN PAGE — its Overview (Club Tier Stage 9a, Part 4; owner 9a·4, 9a·6, Q16, S1·b; frames B, C, D;
 * words HOUSE_LEAGUE_STAGE9A_COPY.md §3–§5).
 *
 *   the header — the season's name, dates · sport, what is happening (the pill), View public page;
 *   one next step — a getting-ready season leads with its checklist and "Open registration" (absent until the three steps
 *     are done); a closed one with "Start season"; Close / Reopen registration sit on the Registration block;
 *   the figures band — Players · To review · Waitlist · Teams, one joined band (the money figure is 9b-2's, not built);
 *   Divisions — a table on the kit (Add, and a pencil per row, open today's window; prices are 9b-1's);
 *   Season and Registration — each reads first and edits whole;
 *   the rare door — Complete (and on a finished season Archive / Reopen) ends the body, a sentence and a link.
 * EVERY STATUS CHANGE ASKS (SeasonStatusWindow). A finished season (completed / archived) reads in place, every write
 * control absent, through the one gate (Q16): `houseLeagueAccess(…, season)` says `run: false` and the page renders from
 * it. The registrar reads it all with no pencils and no doors (frame C).
 */
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, ExternalLink, Pencil, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { LeagueCapUpgradeModal } from '@/components/admin/LeagueCapUpgrade';
import { ClubSection, EmptyCard, LoadFailed, PageLoading, repKit, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import SeasonStatePill from '@/components/admin/kit/club/SeasonStatePill';
import SeasonStatusWindow from '@/components/admin/kit/club/league/SeasonStatusWindow';
import DivisionWindow, { type SeasonDivision } from '@/components/admin/kit/club/league/DivisionWindow';
import { RegistrationBlock, SeasonBlock } from '@/components/admin/kit/club/league/SeasonRecordBlocks';
import s from '@/components/admin/kit/club/league/LeagueSeason.module.css';
import { announceSeasonsChanged, useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { isFreeFloorLeague, type LeagueCapKind } from '@/lib/free-floor';
import { fireLeagueEvent } from '@/lib/league-events-client';
import { seasonChecklist, seasonDates } from '@/lib/house-league-season';
import { movesFrom, rareDoor, type StatusMove } from '@/lib/house-league-status-words';
import { JAN_1, bornLine, type Cutoff } from '@/lib/born-years';
import { sportLabel } from '@/lib/sports';
import { pluralize } from '@/lib/utils';
import type { LeagueSeason } from '@/lib/types';

interface SeasonDetail {
  season: LeagueSeason;
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

  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  const [move, setMove] = useState<StatusMove | null>(null);
  const [divisionOpen, setDivisionOpen] = useState<SeasonDivision | 'new' | null>(null);
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
  const steps = seasonChecklist({ ...season, divisionCount: divisions.length, spotCount });
  const moves = movesFrom(season.status);
  const facts = {
    seasonName: season.name,
    seasonStartDate: season.seasonStartDate,
    seasonEndDate: season.seasonEndDate,
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
      {moves.includes('close') ? 'Close registration' : 'Reopen registration'}
    </button>
  ) : undefined;
  const rare = canMove ? (['complete', 'archive', 'reopen'] as const).filter(m => moves.includes(m)) : [];

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
          actions={canMove && steps.every(st => st.done)
            ? <button type="button" className="btn btn-lime" onClick={() => setMove('open')}>Open registration</button>
            : undefined}
        >
          <ul className={s.checklist}>
            {steps.map(st => (
              <li key={st.key} className={`${s.step}${st.done ? '' : ` ${s.stepOpen}`}`}>
                <span className={`${s.tick}${st.done ? ` ${s.tickDone}` : ''}`} role="img" aria-label={st.done ? 'Done' : 'Not done'}>
                  {st.done && <Check size={13} aria-hidden />}
                </span>
                <span>{st.line}</span>
              </li>
            ))}
          </ul>
        </ClubSection>
      )}
      {season.status === 'registration_closed' && canMove && (
        <ClubSection
          title="Next step"
          actions={<button type="button" className="btn btn-lime" onClick={() => setMove('start')}>Start season</button>}
        >
          <p className={s.emptyLine}>Registration is closed. Start the season when its teams and schedule are ready.</p>
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

      <ClubSection
        title="Divisions"
        actions={canRun ? (
          <button type="button" className={`btn btn-outline ${ck.iconOnlyPhone}`} onClick={() => setDivisionOpen('new')} aria-label="Add division">
            <Plus size={14} aria-hidden /><span className={ck.btnWord}>Add division</span>
          </button>
        ) : undefined}
      >
        {divisions.length === 0 ? (
          <p className={s.emptyLine}>No divisions yet.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={ck.table}>
              <thead>
                <tr>
                  <th scope="col">Division</th>
                  <th scope="col">Ages</th>
                  <th scope="col">Players</th>
                  <th scope="col" className={ck.num}>Teams</th>
                  {canRun && <th scope="col"><span className={repKit.srOnly}>Edit</span></th>}
                </tr>
              </thead>
              <tbody>
                {divisions.map(d => {
                  const pct = d.capacity ? Math.min(100, Math.round((d.activeCount / d.capacity) * 100)) : 0;
                  const full = d.capacity != null && d.activeCount >= d.capacity;
                  // What families read beside the division (4c-2's one line), or a dash when it has no birth years.
                  const ages = bornLine({ from: d.bornFromYear, to: d.bornToYear }, cutoff) ?? '—';
                  return (
                    <tr key={d.id}>
                      <td data-label="Division"><span className={ck.cellTitle}>{d.name}</span></td>
                      <td data-label="Ages">{ages}</td>
                      <td data-label="Players">
                        {d.capacity != null && (
                          <span className={s.meter} aria-hidden><span className={`${s.meterFill}${full ? ` ${s.meterFull}` : ''}`} style={{ width: `${pct}%` }} /></span>
                        )}
                        {d.capacity != null ? `${d.activeCount} / ${d.capacity}` : pluralize(d.activeCount, 'player')}
                        {d.waitlistCount > 0 && ` · ${d.waitlistCount} waitlisted`}
                      </td>
                      <td data-label="Teams" className={ck.num}>{d.teamCount}</td>
                      {canRun && (
                        <td className={ck.actions}>
                          <button type="button" className={s.iconButton} onClick={() => setDivisionOpen(d)} aria-label={`Edit ${d.name}`}>
                            <Pencil size={15} aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ClubSection>

      <SeasonBlock season={season} canEdit={canRun} orgSlug={orgSlug} onSaved={changed} />
      <RegistrationBlock season={season} canEdit={canRun} orgSlug={orgSlug} onSaved={changed} door={regDoor} />

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

      {move && (
        <SeasonStatusWindow
          move={move}
          seasonId={season.id}
          orgSlug={orgSlug}
          facts={facts}
          onClose={() => setMove(null)}
          onDone={() => { setMove(null); changed(); }}
        />
      )}
      {divisionOpen && (
        <DivisionWindow
          orgSlug={orgSlug}
          seasonId={season.id}
          division={divisionOpen === 'new' ? null : divisionOpen}
          cutoff={cutoff}
          sport={sport}
          onClose={() => setDivisionOpen(null)}
          onSaved={() => { setDivisionOpen(null); changed(); }}
          onCapHit={kind => { setDivisionOpen(null); setCapHit(kind); }}
        />
      )}
      {capHit && <LeagueCapUpgradeModal capHit={capHit} onClose={() => setCapHit(null)} orgId={currentOrg?.id} />}
    </div>
  );
}
