'use client';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useHouseLeagueAccess, useSeasonAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { SavePill, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import sch from '@/components/admin/kit/club/schedules/Schedules.module.css';
import s from '@/components/admin/kit/club/league/time/LeagueTime.module.css';
import { ScheduleDateNav } from '@/components/coaches/ScheduleCalendarViews';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { dayHeading } from '@/lib/calendar-recipe';
import { mondayOfDay, tournamentToday } from '@/lib/timezone';
import { joinWithAnd } from '@/lib/utils';
import { houseLeagueUse, SCHEDULE_SCREEN_WORDS as SW } from '@/lib/club-schedule-words';
import { cellKey, dayHead, firstCursor, gridColumns, placeKey, placeRows, scheduleDates, slotsByCell, slotTime, stepGrid } from '@/lib/club-schedule-view';
import { keyOfUse, practicesRemovedBy, LEAGUE_TIME_REFUSALS as R, LEAGUE_TIME_WORDS as W, type LeagueTimeChange, type LeagueUse } from '@/lib/league-time';
import type { LeagueClubSchedule, LeagueClubSlot } from '@/lib/league-club-schedule';

/**
 * THE LEAGUE ADMIN IN THE CLUB'S SCHEDULE (Club Tier Stage 11b Part 3; drawings tab 5, ruled 2026-10-27 card 11). One week
 * of a final club schedule house league holds time in, opened from House league's time (the source line's schedule name)
 * — never the rail. House-league slots are tinted and open to a one-date Use that saves on the spot (a desk only; a phone
 * reads); a rep team's slot and an open slot read with no controls. Rep team names reach only a viewer who can open Rep
 * teams (the server strips them: "A rep team"). No bill, asks, replies or send history: the read is an allow-list
 * (lib/league-club-schedule.ts). "← House league's time" goes back to the Schedule page and reopens the window (?time=1).
 */
export default function LeagueClubSchedulePage() {
  const { orgSlug, seasonId, scheduleId } = useParams<{ orgSlug: string; seasonId: string; scheduleId: string }>();
  const { currentOrg } = useOrg();
  const orgQuery = currentOrg?.slug ? `orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const [season, setSeason] = useState<{ id: string; name: string; status: string } | null>(null);
  const canRun = !!useSeasonAccess(season)?.run;
  const hasAccess = !!useHouseLeagueAccess()?.read;
  const isPhone = useIsPhone();
  const [read, setRead] = useState<LeagueClubSchedule | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Only the newest week asked for lands (/review: two quick steps could land out of order). */
  const asked = useRef(0);

  const loadSeason = useCallback(async () => {
    const r = await fetch(`/api/admin/house-league/seasons/${seasonId}?${orgQuery}`).catch(() => null);
    const data = r?.ok ? await r.json().catch(() => null) : null;
    if (data?.season) setSeason({ id: data.season.id, name: data.season.name, status: data.season.status });
  }, [seasonId, orgQuery]);
  useDeferredLoad(!!orgQuery, loadSeason);

  const loadWeek = useCallback(async (week: string | null) => {
    const mine = ++asked.current;
    const fetchWeek = async (w: string | null) => {
      const r = await fetch(`/api/admin/house-league/seasons/${seasonId}/club-schedule/${scheduleId}?${orgQuery}${w ? `&week=${w}` : ''}`,
        { cache: 'no-store' }).catch(() => null);
      const data = r ? await r.json().catch(() => null) : null;
      return r?.ok && data ? { ok: true as const, read: data as LeagueClubSchedule } : { ok: false as const, error: (data as { error?: string } | null)?.error };
    };
    let got = await fetchWeek(week);
    // The first read opens on the week holding today while the schedule runs, else its first (the club page's rule).
    if (got.ok && week === null) {
      const first = firstCursor(got.read.schedule.startsOn, got.read.schedule.endsOn, tournamentToday());
      if (mondayOfDay(first) !== got.read.week) got = await fetchWeek(first);
    }
    if (mine !== asked.current) return;
    if (!got.ok) { setFailed(got.error ?? W.club.loadFailed); return; }
    setFailed(null);
    setRead(got.read);
  }, [seasonId, scheduleId, orgQuery]);
  const first = useCallback(() => loadWeek(null), [loadWeek]);
  useDeferredLoad(!!orgQuery, first);

  const backHref = `/${orgSlug}/admin/house-league/seasons/${seasonId}/schedule?time=1`;
  // The headings are the week the server ANSWERED, never a week still on its way: dates and slots always agree.
  const columns = read
    ? gridColumns({ startsOn: read.schedule.startsOn, endsOn: read.schedule.endsOn, oneWeekday: null, cursor: read.week })
    : null;
  const step = (dir: -1 | 1) => {
    if (!read) return;
    void loadWeek(stepGrid({ startsOn: read.schedule.startsOn, endsOn: read.schedule.endsOn, oneWeekday: null, cursor: read.week }, dir));
  };
  // The rows are the schedule's places, not the week's: they hold still from week to week (/review).
  const rows = useMemo(() => (read ? placeRows(read.places, read.placesUsed) : []), [read]);
  const byCell = useMemo(() => slotsByCell(read?.slots ?? []), [read]);
  const divisionName = useMemo(() => new Map((read?.divisions ?? []).map(d => [d.id, d.name])), [read]);
  const today = tournamentToday();
  const open = read?.slots.find(x => x.id === openId) ?? null;

  if (!hasAccess && currentOrg) return null;

  const labelOfUse = (u: LeagueUse) => houseLeagueUse(divisionName.get(u.divisionId) ?? W.aDivision, u.kind);
  const who = (x: LeagueClubSlot) => x.holder.kind === 'house_league'
    ? (x.holder.use ? labelOfUse(x.holder.use) : x.holder.otherSeason ? W.club.legend.houseLeague : W.notGiven)
    : x.holder.kind === 'rep' ? (x.holder.teams?.length ? joinWithAnd(x.holder.teams) : W.club.aRepTeam) : W.club.open;
  const chipClass = (x: LeagueClubSlot) => `${sch.slot} ${x.holder.kind === 'house_league'
    ? (x.holder.use || x.holder.otherSeason ? s.chipHl : s.chipNotGiven)
    : x.holder.kind === 'rep' ? s.chipRep : sch.slotOpen}`;
  const chip = (x: LeagueClubSlot, place?: string) => (
    <button key={x.id} type="button" className={chipClass(x)} onClick={() => setOpenId(x.id)}>
      <span className={sch.slotTime}>{slotTime(x)}</span>
      <span className={sch.slotWho}>{who(x)}</span>
      {place && <span className={s.chipPlace}>{place}</span>}
    </button>
  );
  const placeOf = (x: Pick<LeagueClubSlot, 'venueId' | 'facilityId'>) => {
    const v = read?.places.find(p => p.venueId === x.venueId);
    const f = x.facilityId ? v?.facilities.find(ff => ff.id === x.facilityId)?.name : null;
    return [v?.venueName, f].filter(Boolean).join(' · ');
  };

  const facilities = read ? [...new Set(rows.filter(r => r.facilityId).map(r => r.name))] : [];
  const venues = read ? read.places.map(p => p.venueName).filter(Boolean) : [];

  return (
    <div className={s.clubPage}>
      <AdminPageHeader eyebrow={W.club.eyebrow} title={read?.schedule.name ?? ''} backTo={{ href: backHref, label: W.club.back }} />
      {!read && !failed && <LoadingState label="Loading the club’s schedule…" />}
      {failed && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{failed}</p>}
      {read && columns && (
        <>
          <p className={s.clubFacts}>{[joinWithAnd(venues), scheduleDates(read.schedule.startsOn, read.schedule.endsOn), facilities.join(', ')].filter(Boolean).join(' · ')}</p>
          <div className={s.clubBar}>
            <ScheduleDateNav view="week" cursor={read.week} onStep={step} range={{
              long: columns.range, short: columns.rangeShort, canBack: columns.canBack, canForward: columns.canForward,
              prevLabel: W.club.prevWeek, nextLabel: W.club.nextWeek,
            }} />
            <span className={s.legend} aria-hidden>
              <span><i className={s.keyHl} />{W.club.legend.houseLeague}</span>
              <span><i className={s.keyNotGiven} />{W.club.legend.notGiven}</span>
              <span><i className={s.keyRep} />{W.club.legend.rep}</span>
              <span><i className={s.keyOpen} />{W.club.legend.open}</span>
            </span>
          </div>
          {isPhone ? (
            <div className={s.dayList}>
              {!read.slots.length && <p className={ck.hint}>{W.club.emptyWeek}</p>}
              {columns.days.map(d => {
                const list = read.slots.filter(x => x.day === d).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                return list.length ? (
                  <section key={d} className={s.dayGroup}>
                    <h3 className={s.stretchTitle}>{dayHeading(d, today)}</h3>
                    {list.map(x => chip(x, placeOf(x)))}
                  </section>
                ) : null;
              })}
            </div>
          ) : (
            <div className={sch.grid} style={{ gridTemplateColumns: `7.25rem repeat(${columns.days.length}, minmax(0, 1fr))` }}
              role="grid" aria-label={W.club.weekLabel}>
              <div className={sch.gh} role="columnheader">{SW.facilityHead}</div>
              {columns.days.map(d => (
                <div key={d} className={`${sch.gh}${d === today ? ` ${sch.ghToday}` : ''}`} role="columnheader">{dayHeading(d, today)}</div>
              ))}
              {rows.map(r => (
                <Row key={r.key} name={r.name} venue={r.facilityId ? r.venueName : null}>
                  {columns.days.map(d => {
                    const list = byCell.get(cellKey(placeKey(r.venueId, r.facilityId), d)) ?? [];
                    return list.length
                      ? <div key={d} className={sch.cc} role="gridcell">{list.map(x => chip(x))}</div>
                      : <div key={d} className={`${sch.cc} ${sch.ccNone}`} role="gridcell">{SW.noTime}</div>;
                  })}
                </Row>
              ))}
            </div>
          )}
        </>
      )}
      {open && read && (
        <SlotRead key={open.id} slot={open} read={read} scheduleName={read.schedule.name} where={placeOf(open)} who={who(open)}
          canChange={canRun && !isPhone} labelOfUse={labelOfUse} backHref={backHref} orgSlug={currentOrg?.slug ?? orgSlug}
          seasonId={seasonId} onClose={() => setOpenId(null)} onSaved={() => loadWeek(read.week)} />
      )}
    </div>
  );
}

function Row({ name, venue, children }: { name: string; venue: string | null; children: ReactNode }) {
  return <>
    <div className={sch.fc} role="rowheader">{name}{venue && <small>{venue}</small>}</div>
    {children}
  </>;
}

/**
 * A SLOT, READ (drawings tab 5, c): a rep team's slot and an open slot read with no controls; a house-league slot still to
 * come in the season gets Use — one date, saving on the spot (a transient Saved; a failure puts the radio back and its
 * reason at the foot's left). Not given yet on a date with practices still to come asks first, as the piece's level does.
 */
function SlotRead({ slot, read, scheduleName, where, who, canChange, labelOfUse, backHref, orgSlug, seasonId, onClose, onSaved }: {
  slot: LeagueClubSlot; read: LeagueClubSchedule; scheduleName: string; where: string; who: string; canChange: boolean;
  labelOfUse: (u: LeagueUse) => string; backHref: string; orgSlug: string; seasonId: string;
  onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ change: LeagueTimeChange; teams: string[]; count: number; choice: string } | null>(null);
  const holder = slot.holder;
  const current = holder.kind === 'house_league' ? holder.use : null;
  const options: (LeagueUse | null)[] = [null, ...read.divisions.flatMap(d => (['games', 'practices'] as const).map(kind => ({ divisionId: d.id, kind })))];
  const chosen = pending ?? keyOfUse(current);

  async function save(change: LeagueTimeChange) {
    setAsking(null);
    setSaving(true);
    setReason(null);
    const r = await fetch(`/api/admin/house-league/seasons/${seasonId}/time?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [change] }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok) {
      const code = (data as { code?: string } | null)?.code;
      setReason(code === 'changed' ? R.changedOneDate : (data as { error?: string } | null)?.error ?? W.giveFailed);
    }
    await onSaved();
    setPending(null);
    setSaving(false);
  }

  function pick(to: LeagueUse | null) {
    if (keyOfUse(to) === keyOfUse(current)) return;
    const change: LeagueTimeChange = { slotId: slot.id, from: current, to };
    setReason(null);
    setPending(keyOfUse(to));
    const removed = practicesRemovedBy([change], read.practices);
    if (removed.length) {
      setAsking({ change, count: removed.length, choice: to ? labelOfUse(to) : W.notGiven, teams: [...new Set(removed.map(p => p.team).filter(Boolean))].sort() });
      return;
    }
    void save(change);
  }

  const facts: [string, ReactNode][] = [[W.club.where, where]];
  if (holder.kind === 'house_league') facts.push([W.club.heldBy, W.club.houseLeague(who)]);
  else facts.push([W.club.team, who]);
  if (slot.repeats) facts.push([W.club.repeats, slot.repeats]);

  return (
    <>
      <KitDialog kind="form" eyebrow={SW.slotEyebrow(scheduleName)} title={`${dayHead(slot.day)} · ${slotTime(slot)}`} onClose={onClose}
        busy={saving} status={holder.kind === 'house_league' && slot.canUse && canChange && !reason
          ? <SavePill inline saving={saving} dirty={false} onRetry={() => {}} /> : undefined}
        footerStart={reason} footer={reason ? <button type="button" className="btn btn-outline" onClick={onClose}>{W.club.close}</button> : undefined}>
        <dl className={s.facts}>
          {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {holder.kind === 'rep' && <p className={ck.notice}>{SW.repSlotReads}</p>}
        {holder.kind === 'open' && <p className={ck.notice}>{W.club.openNote}</p>}
        {holder.kind === 'house_league' && slot.canUse && canChange && (
          <fieldset className={s.choices}>
            <legend className={s.useLabel}>{W.club.use}</legend>
            {options.map(u => (
              <label key={keyOfUse(u)} className={s.choice}>
                {/* Each its own stop: a radio GROUP fires a change on every arrow key, and each change saves (/review). */}
                <input type="radio" name={`use-${slot.id}-${keyOfUse(u)}`} checked={chosen === keyOfUse(u)} disabled={saving} onChange={() => pick(u)} />
                <span>{u ? labelOfUse(u) : W.notGiven}</span>
              </label>
            ))}
            <p className={ck.hint}>{W.club.useHint(dayHead(slot.day))}<Link href={backHref}>{W.title}</Link>.</p>
          </fieldset>
        )}
      </KitDialog>
      {asking && (
        <KitDialog kind="question" title={W.ask.titleOneDate(dayHead(slot.day), asking.choice)} busy={saving}
          onClose={() => { setAsking(null); setPending(null); }}
          footer={<>
            <button type="button" className="btn btn-outline" onClick={() => { setAsking(null); setPending(null); }}>{W.piece.cancel}</button>
            <button type="button" className="btn btn-danger" onClick={() => void save(asking.change)}>{W.ask.confirmOneDate(asking.count)}</button>
          </>}>
          <p className={ck.notice}>{W.ask.noteOneDate(asking.teams, asking.count)}</p>
        </KitDialog>
      )}
    </>
  );
}
