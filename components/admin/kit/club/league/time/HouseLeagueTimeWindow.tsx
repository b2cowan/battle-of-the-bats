'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { RecordAction, useDeferredLoad } from '../../RepKit';
import LoadingState from '@/components/shared/LoadingState';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { houseLeagueUse } from '@/lib/club-schedule-words';
import {
  hasNotGiven, hoursAWeek, LEAGUE_TIME_WORDS as W,
  type LeagueTime, type LeagueTimeRow, type LeagueUseKind,
} from '@/lib/league-time';
import s from './LeagueTime.module.css';

/**
 * HOUSE LEAGUE'S TIME (Club Tier Stage 11b Part 3, frame k2; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md). Everything the
 * club gave house league, by the club's stretches, and how it is divided: each division's game time and practice time,
 * and Not given yet — which offers Give it to (one pair per division) to whoever runs the season. The registrar reads it
 * with no Give it to. The server (lib/league-time-server.ts) decides what is shown and refuses a give that went stale.
 *
 * ⚖ Nothing to give (k4, adapted 2026-10-27, then /ux + /design): the club gave nothing → a league admin reads who can
 * give it (no link); an owner or an admin reads the same fact with the lime Give house league time (the club's
 * Schedules). Everything divided is not empty: the divisions' rows show with no Not given yet, and an owner or an admin
 * gets k4's "no time left" with Give house league more time as the body's rare door.
 * ⚖ A give says what it saw (`from`): a row's time still Not given yet, or still that division's — else the server
 * refuses `changed` and the window reads again (never a give over time someone else just divided).
 */
export default function HouseLeagueTimeWindow({ orgSlug, seasonId, seasonName, canDivide, schedulesHref, onClose, onChanged }: {
  orgSlug: string;
  seasonId: string;
  seasonName: string;
  /** Runs this season (owner, admin, league admin on a live season): Give it to shows. */
  canDivide: boolean;
  /** The club's Schedules, when this member builds them (an owner or an admin on a plan with the scheduler). */
  schedulesHref: string | null;
  onClose: () => void;
  /** A give landed: the page reads its time line again. */
  onChanged?: () => void;
}) {
  const [time, setTime] = useState<LeagueTime | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const url = `/api/admin/house-league/seasons/${seasonId}/time?orgSlug=${encodeURIComponent(orgSlug)}`;

  const load = useCallback(async () => {
    const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !data) { setFailed((data as { error?: string } | null)?.error ?? W.loadFailed); return; }
    setTime(data as LeagueTime);
  }, [url]);

  useDeferredLoad(true, load);

  async function give(row: LeagueTimeRow, divisionId: string, kind: LeagueUseKind) {
    setBusy(true);
    setFailed(null);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotIds: row.parts.flatMap(p => p.slotIds), divisionId, kind, from: row.use }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok) setFailed((data as { error?: string } | null)?.error ?? W.giveFailed);
    await load();
    setBusy(false);
    if (r?.ok) onChanged?.();
  }

  const empty = time !== null && time.sources.length === 0;
  // Everything divided: an owner or an admin can give house league more (k4's own sentence, where it is true).
  const allDivided = !!time && !empty && !hasNotGiven(time.sources);
  const footer = empty
    ? <>
        <button type="button" className={schedulesHref ? 'btn btn-outline' : 'btn btn-lime'} onClick={onClose}>{W.close}</button>
        {schedulesHref && <Link href={schedulesHref} className="btn btn-lime">{W.giveSome}</Link>}
      </>
    : <button type="button" className="btn btn-lime" onClick={onClose}>{W.done}</button>;
  const footerStart = time && !empty ? W.foot : null;

  return (
    <KitDialog kind="form" size="medium" eyebrow={seasonName} title={W.title} onClose={onClose} busy={busy}
      footer={footer} footerStart={footerStart}>
      {failed && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{failed}</p>}
      {!time && !failed && <LoadingState inline label="Loading house league’s time…" />}
      {empty && (schedulesHref
        ? <div className={s.empty}><p className={s.emptyNote}>{W.noneGivenClub}</p><p className={ck.hint}>{W.noneGivenClubHint}</p></div>
        : <div className={s.empty}><p className={s.emptyNote}>{W.noneGivenLeagueAdmin}</p></div>)}
      {time && time.sources.map(source => (
        <section key={source.scheduleId} className={s.source}>
          <p className={ck.hint}>{W.source(source.name, source.dates, source.venues)}. {W.hoursLine}</p>
          {source.stretches.map(stretch => (
            <div key={stretch.key} className={s.stretch}>
              <h3 className={s.stretchTitle}>{stretch.title}</h3>
              <div className={ck.list}>
                {stretch.rows.map(row => (
                  <div key={row.key} className={ck.row}>
                    <div className={ck.rowMain}>
                      <span className={ck.rowTitle}>{row.label}</span>
                      <span className={s.detail}>{row.detail}</span>
                      <span className={s.hoursUnder}>{hoursAWeek(row.minutesAWeek)}</span>
                    </div>
                    <span className={s.hours}>{hoursAWeek(row.minutesAWeek)}</span>
                    {!row.use && canDivide && time.divisions.length > 0 && (
                      <CoachToolbarMenu label={W.giveItTo} overWindow align="end" disabled={busy} drawerOnPhone drawerTitle={W.giveItTo}>
                        {time.divisions.flatMap(d => (['games', 'practices'] as const).map(kind => (
                          <CoachToolbarMenuItem key={`${d.id}:${kind}`} label={houseLeagueUse(d.name, kind)}
                            onSelect={() => void give(row, d.id, kind)} />
                        )))}
                      </CoachToolbarMenu>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {allDivided && schedulesHref && (
        <div className={s.more}>
          <p className={ck.hint}>{W.noneLeftClub}</p>
          <RecordAction icon={<CalendarPlus size={13} aria-hidden />} onClick={() => router.push(schedulesHref)}>{W.giveMore}</RecordAction>
        </div>
      )}
    </KitDialog>
  );
}
