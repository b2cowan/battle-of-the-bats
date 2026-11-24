'use client';
/**
 * OPEN SLOTS AND SHORT TEAMS — the window (owner rulings 2026-11-24, SCHEDULE_GAPS_DRAWINGS.html tab 2). Opened from the
 * page's one line ("See why ›") and the band's Short tile. A window you read: no footer, × closes it.
 *
 * A group per reason (`scheduleGaps`): the callout says the reason and offers the door to the setting that would change it
 * (Settings opens with that setting in view; nothing applies itself, ruling 4); under it, unboxed, the teams it leaves
 * short (Has · Share) and the slots it leaves open (When · Where · Who could take it). Only where a free team that is owed
 * time may take a slot does a row carry "Give it to ▾" (ruling 5).
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import KitDialog from '@/components/shared/KitDialog';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { GAP_WORDS as G, figure, teamSubject, teamsWords, type GapGroup, type Gaps, type GapTeam, type OpenSlot, type ShortTeam } from '@/lib/club-schedule-gaps';
import sch from './Schedules.module.css';

/** Where a door goes: the schedule's Settings, with this setting in view. */
export type GapDoor = 'perDay' | 'perWeek' | 'shares' | 'fieldRules' | 'rules';

/** A list folds past this many rows ("Show all N") — the lists' own fold (2026-11-14). */
const FOLD = 6;

export default function GapsWindow({ gaps, teams, eyebrow, identity, nameOf, placeOf, facilityName, onDoor, onGive, onClose }: {
  gaps: Gaps;
  teams: readonly GapTeam[];
  /** The schedule's name. */
  eyebrow: string;
  /** "Jan 3 – Mar 7 · 180 slots to hand out". */
  identity: string;
  nameOf: (teamId: string) => string;
  placeOf: (slot: OpenSlot['slot']) => string;
  facilityName: (facilityId: string) => string;
  /** Someone who can change the schedule: the doors. Absent: the reasons alone. */
  onDoor?: (door: GapDoor) => void;
  /** Someone who can change the schedule: "Give it to ▾". */
  onGive?: (slotKey: string, teamId: string) => void;
  onClose: () => void;
}) {
  return (
    <KitDialog kind="form" size="wide" eyebrow={eyebrow} title={G.windowTitle} identity={identity} onClose={onClose}>
      {gaps.groups.map((gr, i) => (
        <Group key={`${gr.kind}-${i}`} gr={gr} gaps={gaps} teams={teams} nameOf={nameOf} placeOf={placeOf} facilityName={facilityName} onDoor={onDoor} onGive={onGive} />
      ))}
    </KitDialog>
  );
}

function doorsOf(gr: GapGroup): { door: GapDoor; label: string }[] {
  switch (gr.kind) {
    case 'cap': return [{ door: gr.cap === 'day' ? 'perDay' : 'perWeek', label: gr.cap === 'day' ? G.doorPerDay : G.doorPerWeek }, { door: 'shares', label: G.doorShares }];
    case 'kept': return [{ door: 'fieldRules', label: G.doorFieldRules }];
    case 'plays': return [{ door: gr.cap === 'week' ? 'perWeek' : 'perDay', label: gr.cap === 'week' ? G.doorPerWeek : G.doorPerDay }];
    case 'other': return [{ door: 'rules', label: G.doorRules }];
    case 'spare': case 'full': return [{ door: 'shares', label: G.doorShares }];
    case 'free': return [];
  }
}

function Group({ gr, gaps, teams, nameOf, placeOf, facilityName, onDoor, onGive }: {
  gr: GapGroup; gaps: Gaps; teams: readonly GapTeam[];
  nameOf: (teamId: string) => string; placeOf: (slot: OpenSlot['slot']) => string; facilityName: (facilityId: string) => string;
  onDoor?: (door: GapDoor) => void; onGive?: (slotKey: string, teamId: string) => void;
}) {
  const head = G.head(gr, t => teamsWords(t, teams));
  const explain = G.explain(gr, gaps, t => teamSubject(t, teams), ids => ids.map(facilityName));
  const doors = onDoor ? doorsOf(gr) : [];
  const shortTeams: readonly ShortTeam[] = 'teams' in gr ? gr.teams : [];
  const slots: readonly OpenSlot[] = 'slots' in gr ? gr.slots : [];
  return (
    <section className={sch.gapGroup} aria-label={head}>
      <div className={`${sch.callout}${gr.kind === 'free' ? ` ${sch.calloutOlive}` : ''}`}>
        <div className={sch.calloutBody}>
          <span className={sch.gapHead}>{head}</span>
          <span className={sch.gapExplain}>{explain}</span>
          {doors.length > 0 && (
            <span className={sch.gapDoors}>
              {doors.map(d => (
                <button key={d.door} type="button" className={sch.door} onClick={() => onDoor!(d.door)}>{d.label}<ChevronRight size={14} aria-hidden /></button>
              ))}
            </span>
          )}
        </div>
      </div>
      {gr.kind === 'free' ? (
        <>
          <OpenTable slots={slots} perSlot nameOf={nameOf} placeOf={placeOf} onGive={onGive} />
          <ShortTable teams={gaps.short.filter(t => slots.some(o => o.takers.includes(t.teamId)))} nameOf={nameOf} />
        </>
      ) : (
        <>
          {shortTeams.length > 0 && <ShortTable teams={shortTeams} nameOf={nameOf} />}
          {slots.length > 0 && <OpenTable slots={slots} nameOf={nameOf} placeOf={placeOf} />}
        </>
      )}
    </section>
  );
}

/** Short for the season: Team · Has · Share, amber on what it has (the Fair shares table's recipe). */
function ShortTable({ teams, nameOf }: { teams: readonly ShortTeam[]; nameOf: (teamId: string) => string }) {
  const [all, setAll] = useState(false);
  if (!teams.length) return null;
  const shown = all ? teams : teams.slice(0, FOLD);
  return (
    <div>
      <h3 className={sch.gapSec}>{G.shortTitle}</h3>
      <table className={`${sch.fairTable} ${sch.gapTable}`}>
        <thead><tr><th scope="col">{G.colTeam}</th><th scope="col">{G.colHas}</th><th scope="col">{G.colShare}</th></tr></thead>
        <tbody>
          {shown.map(t => (
            <tr key={t.teamId}>
              <td className={sch.gapLeft}>{nameOf(t.teamId)}</td>
              <td className={sch.gapAmber} data-label={G.colHas}>{figure(t.has)}</td>
              <td data-label={G.colShare}>{figure(t.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {teams.length > FOLD && (
        <button type="button" className={`${sch.door} ${sch.gapMore}`} aria-expanded={all} onClick={() => setAll(v => !v)}>
          {all ? G.showFewer : G.showAll(teams.length)}
        </button>
      )}
    </div>
  );
}

/** Open slots: When · Where · Who could take it. A slot a team can take is a row of its own, with "Give it to ▾"; a
 *  day's slots nobody can take read as one row ("Sun, Mar 7 · 8:00 a.m., 9:00 a.m. and 10:00 a.m. · Fields 5 and 6"). */
function OpenTable({ slots, perSlot = false, nameOf, placeOf, onGive }: {
  slots: readonly OpenSlot[]; perSlot?: boolean;
  nameOf: (teamId: string) => string; placeOf: (slot: OpenSlot['slot']) => string; onGive?: (slotKey: string, teamId: string) => void;
}) {
  const [all, setAll] = useState(false);
  const names = (ids: readonly string[]) => ids.map(nameOf).join(', ');
  const rows = perSlot
    // A slot of an added part takes only that part's teams (the server says so), so it is never given from here.
    ? slots.map(o => ({ key: o.slot.key, when: G.when(o.slot.day, [o.slot.startClock]), where: placeOf(o.slot), who: G.who(o, names), give: o.slot.partId ? null : o }))
    : [...groupByDay(slots)].map(([day, list]) => ({
      key: day, when: G.when(day, list.map(o => o.slot.startClock)), where: G.where(list.map(o => placeOf(o.slot))), who: G.who(list[0], names), give: null as OpenSlot | null,
    }));
  const shown = all ? rows : rows.slice(0, FOLD);
  const giving = !!onGive && rows.some(r => r.give);
  return (
    <div>
      <h3 className={sch.gapSec}>{G.openTitle}</h3>
      <table className={`${sch.fairTable} ${sch.gapTable}`}>
        <thead>
          <tr>
            <th scope="col">{G.colWhen}</th><th scope="col" className={sch.gapLeft}>{G.colWhere}</th><th scope="col" className={sch.gapLeft}>{G.colWho}</th>
            {giving && <th scope="col" aria-label={G.giveIt} />}
          </tr>
        </thead>
        <tbody>
          {shown.map(r => (
            <tr key={r.key}>
              <td className={sch.gapLeft}>{r.when}</td>
              <td className={sch.gapLeft} data-label={G.colWhere}>{r.where}</td>
              <td className={`${sch.gapLeft}${r.give ? '' : ` ${sch.gapQuiet}`}`} data-label={G.colWho}>{r.who}</td>
              {giving && (
                <td>
                  {r.give && (
                    <CoachToolbarMenu label={G.giveIt} variant="secondary" overWindow>
                      {r.give.takers.map(id => <CoachToolbarMenuItem key={id} label={nameOf(id)} onSelect={() => onGive!(r.give!.slot.key, id)} />)}
                    </CoachToolbarMenu>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > FOLD && (
        <button type="button" className={`${sch.door} ${sch.gapMore}`} aria-expanded={all} onClick={() => setAll(v => !v)}>
          {all ? G.showFewer : G.showAll(rows.length)}
        </button>
      )}
    </div>
  );
}

function groupByDay(slots: readonly OpenSlot[]): Map<string, OpenSlot[]> {
  const out = new Map<string, OpenSlot[]>();
  for (const o of slots) (out.get(o.slot.day) ?? out.set(o.slot.day, []).get(o.slot.day)!).push(o);
  return out;
}
