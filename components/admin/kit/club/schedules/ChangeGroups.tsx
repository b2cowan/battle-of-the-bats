'use client';
/**
 * ⚖ A TEAM'S CHANGES, SAID AS GROUPS (owner 2026-11-17, artifact YLos6rKun1mA612uRsChsG, asks 1–7 as recommended): the one
 * block the Needs attention row and the Send the changes window both show, so the coach confirms in the window exactly
 * what the page said. A run of identical changes is one line ("Gains 17 practices") over its pattern, opening to its dates
 * by month; a change unlike the others is its own line. The grouping is `changeGroups` (lib/club-schedule-words.ts).
 */
import type { ChangeGroup, ChangeTeam } from '@/lib/club-schedule-words';
import { SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import sch from './Schedules.module.css';

/** A head after the team's name: "gains 18 practices", "no longer Thu, …". A weekday keeps its capital ("Sun, Jan 10", a
 *  move's line; house league's "Sundays from Nov 8"). */
const afterName = (s: string) => (s && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function Group({ g, lead }: { g: ChangeGroup; lead?: string }) {
  const head = lead ? <><b>{lead}</b> {afterName(g.head)}</> : g.head;
  if (!g.pattern) return <div className={sch.chGroup}><span className={sch.chHead}>{head}</span></div>;
  return (
    <details className={sch.chGroup}>
      <summary>
        <span className={sch.chHead}>{head}</span>
        <span className={sch.chToggle}><span>{W.showDates}</span><span>{W.hideDates}</span></span>
        <span className={sch.chPattern}>{g.pattern}</span>
      </summary>
      <div className={sch.chDates}>
        {g.kind === 'moved' && <i>{W.movedDates}</i>}
        {g.months.map((m, i) => <div key={`${m.month}|${i}`}><b>{m.month}</b> {m.days}</div>)}
      </div>
    </details>
  );
}

/** One team's groups. `named`: the team's name leads (Needs attention); the Send window's row title names the team already. */
export function ChangeTeamBlock({ team, named }: { team: Pick<ChangeTeam, 'teamName' | 'groups'>; named?: boolean }) {
  if (named && team.groups.length === 1) return <Group g={team.groups[0]} lead={team.teamName} />;
  return (
    <div className={sch.chTeam}>
      {named && <b className={sch.chTeamName}>{team.teamName}</b>}
      {team.groups.map((g, i) => <Group key={i} g={g} />)}
    </div>
  );
}
