'use client';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import KitDialog, { DialogReason } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit, useDeferredLoad } from '../../RepKit';
import LoadingState from '@/components/shared/LoadingState';
import { hoursAWeek, partsShapes } from '@/lib/league-time';
import {
  planPractices, PRACTICE_MINUTES, PRACTICES_A_WEEK, TEAMS_AT_ONCE, PRACTICE_TIME_WORDS as W,
  type PracticeSettings, type PracticeTimeRead,
} from '@/lib/league-practice-time';
import { facilityListWords } from '@/lib/permit-words';
import { joinWithAnd } from '@/lib/utils';
import s from './LeagueTime.module.css';
import p from './PracticeTime.module.css';

/**
 * PRACTICE TIME (Club Tier Stage 11b Part 4, frame h1; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Practice time (h1)"). A
 * division's practice time, from house league's time, handed to its teams: each practice's length and teams at once are
 * two dropdowns, and the result line answers as they change — the window plans with the same pure planner the server
 * plans with again (lib/league-practice-time.ts). The lime hands them out; families aren't emailed (the first notice is
 * 9d-3's call, a later change is Part 5's).
 *
 * ⚖ "+ Give U12 more time" is House league's time opened on U12 practice time's piece — the page mounts that window and
 * brings this one back after it (`onGiveMore`), never a second copy of its logic.
 * ⚖ The owner, an admin and a league admin on a live season reach it (Tools › Practice time); a registrar never does.
 * ⚖ A hand-out says what it saw (its slots and teams): when either changed underneath, the server refuses `changed` and
 * the window reads again, so the practices written are the ones the lime counted.
 */
export default function PracticeTimeWindow({ orgSlug, seasonId, seasonName, divisionId, divisionName, onClose, onGiveMore, onHandedOut }: {
  orgSlug: string;
  seasonId: string;
  seasonName: string;
  divisionId: string;
  divisionName: string;
  onClose: () => void;
  /** Opens House league's time on this division's practice time; this window comes back when it closes. */
  onGiveMore: () => void;
  /** The practices landed: the page reads its practices again. */
  onHandedOut: () => void;
}) {
  const [read, setRead] = useState<PracticeTimeRead | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const url = `/api/admin/house-league/seasons/${seasonId}/practice-time?orgSlug=${encodeURIComponent(orgSlug)}`;

  const load = useCallback(async () => {
    const r = await fetch(`${url}&divisionId=${encodeURIComponent(divisionId)}`, { cache: 'no-store' }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !data) { setFailed((data as { error?: string } | null)?.error ?? W.loadFailed); return null; }
    setRead(data as PracticeTimeRead);
    return data as PracticeTimeRead;
  }, [url, divisionId]);

  useDeferredLoad(true, useCallback(async () => {
    const data = await load();
    if (data) setSettings(data.settings);
  }, [load]));

  const plan = useMemo(() => (read && settings ? planPractices({ slots: read.slots, teams: read.teams, settings }) : null), [read, settings]);

  async function handOut() {
    if (!read || !settings) return;
    setBusy(true);
    setFailed(null);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId, settings, saw: { slotIds: read.slots.map(x => x.id), teamIds: read.teams.map(t => t.id) } }),
    }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as { error?: string; code?: string } | null;
    setBusy(false);
    if (r?.ok) { onHandedOut(); return; }
    setFailed(data?.error ?? W.saveFailed);
    // The time or the teams moved underneath (or the floors refused a plan made on them): read again, keep the settings.
    if (data?.code === 'changed' || data?.code === 'slot_full' || data?.code === 'team_twice') await load();
  }

  const rows = useMemo(() => {
    if (!read) return [];
    return partsShapes(read.slots.map(x => ({ weekday: x.weekday, start: x.start, end: x.end, place: x.place }))).map(shape => {
      const venues = [...new Set(read.slots.filter(x => shape.places.includes(x.place) && shape.days.includes(x.weekday)).map(x => x.venue ?? ''))].filter(Boolean);
      const isVenue = venues.length === shape.places.length && venues.every(v => shape.places.includes(v));
      return { ...shape, where: isVenue ? facilityListWords(shape.places) : `${joinWithAnd(venues)} · ${facilityListWords(shape.places)}` };
    });
  }, [read]);

  const empty = !!read && read.slots.length === 0;
  const noTeams = !!read && !empty && read.teams.length === 0;
  const count = plan?.practicesAWeek ?? 0;

  let result: ReactNode = null;
  if (plan && !empty && !noTeams) {
    if (!plan.seatsAWeek) {
      result = <div className={`${ck.notice} ${ck.noticeWarn} ${p.result}`}><b>{W.tooLong(divisionName)}</b></div>;
    } else if (plan.goWithout) {
      result = (
        <div className={`${ck.notice} ${ck.noticeWarn} ${p.result}`}>
          <b>{W.shortLead(plan.practicesAWeek, read!.teams.length)}</b>
          <span>{W.shortTurns(plan.goWithout)}</span>
        </div>
      );
    } else {
      // The time holds fewer than the pick: the line says so, in amber.
      const fewer = settings && plan.perTeam < settings.practicesAWeek;
      result = (
        <div className={`${ck.notice} ${fewer ? ck.noticeWarn : ''} ${p.result}`}>
          <b>{W.everyTeam(plan.perTeam)}{plan.openAWeek > 0 && <span className={p.desk}> {W.open(plan.openAWeek)}</span>}</b>
          {fewer && <span>{W.notRoomFor(settings.practicesAWeek)}</span>}
          {plan.openAWeek > 0 && <span className={p.phone}>{W.open(plan.openAWeek)}</span>}
          {plan.turns && <span className={p.desk}>{W.turns}</span>}
        </div>
      );
    }
  }

  const minutes = settings ? [...new Set([...PRACTICE_MINUTES, settings.practiceMinutes])].sort((a, b) => a - b) : [...PRACTICE_MINUTES];

  return (
    <KitDialog kind="form" size="medium" eyebrow={W.eyebrow(seasonName, divisionName)} title={W.title} onClose={onClose} busy={busy}
      footerStart={count > 0 ? <><span className={p.desk}>{W.foot}</span><span className={p.phone}>{W.footPhone}</span></> : null}
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{count > 0 ? W.cancel : W.close}</button>
        {count > 0 && (
          <button type="button" className="btn btn-lime" onClick={() => void handOut()} disabled={busy}>
            <span className={p.desk}>{W.handOut(count)}</span><span className={p.phone}>{W.handOutPhone}</span>
          </button>
        )}
      </>}>
      {failed && (read
        ? <DialogReason className={repKit.formError}>{failed}</DialogReason>
        : <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{failed}</p>)}
      {!read && !failed && <LoadingState inline label={W.loading} />}
      {empty && (
        <div className={s.empty}>
          <p className={s.emptyNote}>{W.empty(divisionName)}</p>
          <button type="button" className={`${ck.link} ${p.door}`} onClick={onGiveMore}>{W.emptyDoor}</button>
        </div>
      )}
      {read && !empty && (
        <>
          <section className={p.section}>
            <h3 className={p.head}>{W.timeHead(divisionName)}<span className={p.from}>{W.timeFrom}</span></h3>
            <div className={ck.list}>
              {rows.map(r => (
                <div key={`${r.when}|${r.where}`} className={ck.row}>
                  <div className={ck.rowMain}>
                    <span className={ck.rowTitle}>{r.when}</span>
                    <span className={s.detail}>{r.where}</span>
                    <span className={s.hoursUnder}>{hoursAWeek(r.minutesAWeek)}</span>
                  </div>
                  <span className={s.hours}>{hoursAWeek(r.minutesAWeek)}</span>
                </div>
              ))}
            </div>
            <button type="button" className={`${ck.link} ${p.door}`} onClick={onGiveMore} disabled={busy}>{W.giveMore(divisionName)}</button>
          </section>
          <section className={p.section}>
            <h3 className={p.head}>{W.handHead}</h3>
            {noTeams ? <p className={ck.hint}>{W.noTeams(divisionName)}</p> : settings && (
              <>
                <div className={p.grid2}>
                  <label className={ck.field}>
                    <span className={ck.label}>{W.eachPractice}</span>
                    <select className={ck.select} value={settings.practiceMinutes} disabled={busy}
                      onChange={e => setSettings({ ...settings, practiceMinutes: Number(e.target.value) })}>
                      {minutes.map(m => <option key={m} value={m}>{W.minutes(m)}</option>)}
                    </select>
                  </label>
                  <label className={ck.field}>
                    <span className={ck.label}>{W.teamsAtOnce}</span>
                    <select className={ck.select} value={settings.teamsAtOnce} disabled={busy}
                      onChange={e => setSettings({ ...settings, teamsAtOnce: Number(e.target.value) })}>
                      {TEAMS_AT_ONCE.map(n => <option key={n} value={n}>{W.perFacility(n)}</option>)}
                    </select>
                  </label>
                  <label className={ck.field}>
                    <span className={ck.label}>{W.practicesAWeek}</span>
                    <select className={ck.select} value={settings.practicesAWeek} disabled={busy}
                      onChange={e => setSettings({ ...settings, practicesAWeek: Number(e.target.value) })}>
                      {PRACTICES_A_WEEK.map(n => <option key={n} value={n}>{W.aWeek(n)}</option>)}
                    </select>
                  </label>
                </div>
                <div aria-live="polite">{result}</div>
                {plan && plan.tooShort > 0 && plan.seatsAWeek > 0 && <p className={ck.hint}>{W.tooShort(plan.tooShort)}</p>}
              </>
            )}
          </section>
        </>
      )}
    </KitDialog>
  );
}
