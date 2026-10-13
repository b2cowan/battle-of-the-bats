'use client';
/**
 * FAIR SHARES — beside the grid, always (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimens 6, 7, 10, the By
 * percentage frame, 14 step 3; Asks 12, 18, 23).
 *
 *   the band  — ONE joined band (2026-10-08: tiles connected, never cards with gaps): Handed out "288 of 354" · Open ·
 *               Short · Clashes. With a permit behind the schedule a money reader reads The bill in Open's place — each
 *               team's share of the permit's cost, as Bill the teams would make it (Ask 23).
 *   the table — a row per team: this week · all of it · prime time, or HOURS where there is no prime time (Stage 11c
 *               Ask 3: a shared slot and a half field each count half a facility, the bill's own hours); "50 shared"
 *               under All for a team that shares; EARLY and the facilities it used when the schedule moves teams around
 *               (Ask 4 — Team · All · Early · Fields, the drawing's four at this width). By percentage, group rows with
 *               their share first; with the bill, Slots · Hours · Bill. Short and clashing amber, with words.
 *   ⚠ The Sidebar Strip & Grid Width build moves the team table under the grid (design log 2026-10-12, "Fair shares B"):
 *     these columns ride with the rows; at that width Moved around can carry the bill's column too.
 *   the foot  — the prime-time hours in words, the slots a booking holds, and the bill's door (money readers only):
 *               "The bill · 3 payments ›" once a bill rides with the schedule, else "Bill the teams ›".
 */
import type { ReactNode } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { billShares, pricedMinutes } from '@/lib/club-schedule-bill';
import { SCHEDULE_SCREEN_WORDS as W, moneyCents as money } from '@/lib/club-schedule-words';
import { NO_GROUP, dayHead, facilityNoun, heldWords, perWeek, primeWords, viewBillSlots, weekCounts, weekShortfalls, type ScheduleView } from '@/lib/club-schedule-view';
import { formatTime } from '@/lib/utils';
import type { TeamResult } from '@/lib/club-schedule-engine';
import { JoinedBand, Swatch } from './ScheduleParts';

/** One of the table's columns: its head, a team's cell, a group's (By percentage and the bill band teams by group). */
interface Column { head: string; cell: (r: TeamResult) => ReactNode; group: (rs: readonly TeamResult[]) => ReactNode; hours?: boolean }
import sch from './Schedules.module.css';

export default function FairShares({ view, week, weeks = 1, scope = W.scopeWeek, nameOf, colourOf, placeOf, onBill }: {
  view: ScheduleView;
  /** The days on screen — "this week". */
  week: readonly string[];
  /** The weeks those days stand for (`weeksOnScreen`): a one-weekday schedule's seven dates are seven weeks. */
  weeks?: number;
  /** "this week" / "these Sundays" — what the short lines are short of. */
  scope?: string;
  nameOf: (teamId: string) => string;
  colourOf: (teamId: string) => string;
  placeOf: (venueId: string, facilityId: string | null) => string;
  /** The bill's door — the page passes it to a money reader only. */
  onBill?: () => void;
}) {
  const { fairness, schedule, bill, pricing } = view;
  const settings = schedule.settings;
  const results = fairness.teams.filter(r => r.target > 0 || r.got > 0);
  const inWeek = new Set(week);
  const counts = weekCounts(view.slots, week);
  const shorts = weekShortfalls({ slots: view.slots, week, results, settings, counts, weeks });
  const resultById = new Map(results.map(r => [r.teamId, r]));
  const teamById = new Map(view.teams.map(t => [t.id, t]));

  // The bill: what rides with the schedule, or (a permit behind it) what Bill the teams would make of it — its own rule,
  // so the teams' shares add up to the same total to the cent.
  const billCents = new Map<string, number>();
  if (bill) for (const t of bill.teams) billCents.set(t.teamId, t.cents);
  else if (pricing?.fullHour != null) {
    // The bill's own minutes (a shared slot split among its teams) in the club's team order — never the engine's per-team
    // count, which gives each team in a shared slot the whole of it (/review).
    const priced = pricedMinutes(viewBillSlots(view.slots));
    for (const [id, cents] of billShares(priced, { fullHour: pricing.fullHour, amount: null, teamOrder: view.teamOrder })?.shares ?? []) billCents.set(id, cents);
  }
  const showBill = view.canMoney && billCents.size > 0;
  const moved = settings.timeMode === 'moved';
  const hours = (r: { pricedMinutes: number }) => Math.round((r.pricedMinutes / 60) * 10) / 10;
  const facilityWord = W.colFacilities(facilityNoun(view.places.flatMap(p => p.facilities.filter(f => view.slots.some(x => x.facilityId === f.id)).map(f => f.name)), 2));
  const billTotal = [...billCents.values()].reduce((a, b) => a + b, 0);

  const percent = settings.split.method === 'percentage';
  const groupsOf = new Map<string, { name: string; teamIds: string[] }>();
  for (const r of results) {
    const t = teamById.get(r.teamId);
    const key = t?.groupId ?? NO_GROUP;
    const g = groupsOf.get(key) ?? groupsOf.set(key, { name: t?.groupName ?? W.notInGroup, teamIds: [] }).get(key)!;
    g.teamIds.push(r.teamId);
  }
  const withGroups = !moved && (percent || showBill) && [...groupsOf.keys()].some(k => k !== NO_GROUP);
  const resultOf = (id: string) => resultById.get(id)!;
  const share = (id: string) => Number(settings.split.values[id] ?? 0);

  // THE COLUMNS, one list per mode — the header, a team's row and a group's row all read it.
  const sum = (rs: readonly TeamResult[], of: (r: TeamResult) => number) => rs.reduce((n, r) => n + of(r), 0);
  const allCol: Column = { head: W.colAll, cell: r => W.sharedCount(r.got, r.shared), group: rs => sum(rs, r => r.got) };
  const hoursCol: Column = { head: W.colHours, cell: r => hours(r), group: rs => hours({ pricedMinutes: sum(rs, r => r.pricedMinutes) }), hours: true };
  const columns: Column[] = moved
    ? [allCol, { head: W.colEarly, cell: r => r.early, group: rs => sum(rs, r => r.early) }, { head: facilityWord, cell: r => r.facilities, group: () => '' }]
    : showBill
      ? [{ ...allCol, head: W.colSlots }, hoursCol,
        { head: W.colBill, cell: r => money(billCents.get(r.teamId) ?? 0), group: rs => money(sum(rs, r => billCents.get(r.teamId) ?? 0)) }]
      : [
        percent
          ? { head: W.colShare, cell: r => `${share(r.teamId)}%`, group: rs => `${Math.round(sum(rs, r => share(r.teamId)) * 100) / 100}%` }
          : { head: W.colThisWeek, cell: r => perWeek(counts.get(r.teamId) ?? 0, weeks), group: () => '' },
        allCol,
        settings.prime ? { head: W.colPrime, cell: r => r.prime, group: rs => sum(rs, r => r.prime) } : hoursCol,
      ];
  const row = (id: string) => {
    const r = resultOf(id);
    return (
      <tr key={id} className={shorts.has(id) ? sch.amberRow : undefined}>
        <td><Swatch colour={colourOf(id)} />{nameOf(id)}</td>
        {columns.map(c => <td key={c.head}>{c.cell(r)}</td>)}
      </tr>
    );
  };
  const groupRow = (key: string) => {
    const g = groupsOf.get(key)!;
    const rs = g.teamIds.map(resultOf);
    return (
      <tr key={`g-${key}`} className={sch.grp}>
        <td>{g.name}</td>
        {columns.map(c => <td key={c.head}>{c.group(rs)}</td>)}
      </tr>
    );
  };

  // The week's clashes, each with its date and what holds it; the week's short teams.
  const clashLines = view.slots.filter(s => inWeek.has(s.day) && s.clash && s.heldBy)
    .map(s => W.clashLine(`${dayHead(s.day)} · ${formatTime(s.startClock)}`, placeOf(s.venueId, s.facilityId), heldWords(s.heldBy!)));
  const shortLines = [...shorts].map(([id, n]) => W.shortLine(nameOf(id), n, scope));
  const t = fairness.totals;
  const tiles = [
    { key: 'handed', label: W.tileHandedOut, value: W.ofSlots(t.handedOut, t.seats) },
    showBill ? { key: 'bill', label: W.tileBill, value: money(billTotal) } : { key: 'open', label: W.tileOpen, value: String(t.open) },
    { key: 'short', label: W.tileShort, value: String(t.short), amber: t.short > 0 },
    { key: 'clashes', label: W.tileClashes, value: String(t.clashes), amber: t.clashes > 0 },
  ];
  const payments = bill?.dues.length ?? 0;
  // Hours count a shared slot and a half field each half (Stage 11c Ask 3) — said once, where Hours shows and either is on
  // the schedule; "every team has 37.5 hours" when they all do.
  const hoursShown = columns.some(c => c.hours);
  const halves = view.slots.some(x => x.teamIds.length > 1 || (x.teamIds.length > 0 && x.weight < 1));
  const playing = results.filter(r => r.got > 0);
  const sameHours = playing.length > 1 && playing.every(r => hours(r) === hours(playing[0])) ? String(hours(playing[0])) : null;
  const halfNote = hoursShown && halves ? W.hoursNote(sameHours) : '';

  return (
    <aside className={sch.fair} aria-labelledby="fair-title">
      <h3 id="fair-title" className={sch.fairTitle}>{W.fairTitle}</h3>
      <JoinedBand label={W.fairTitle} tiles={tiles} />
      <table className={sch.fairTable}>
        <thead>
          <tr>
            <th scope="col">{W.colTeam}</th>
            {columns.map(c => <th key={c.head} scope="col">{c.head}</th>)}
          </tr>
        </thead>
        <tbody>
          {withGroups
            ? [...groupsOf.keys()].flatMap(key => [groupRow(key), ...groupsOf.get(key)!.teamIds.map(row)])
            : results.map(r => row(r.teamId))}
        </tbody>
      </table>
      {(clashLines.length > 0 || shortLines.length > 0) && (
        <div className={sch.fairLines}>
          {[...clashLines, ...shortLines].map(line => (
            <span key={line} className={sch.fairLine}><AlertTriangle size={13} aria-hidden />{line}</span>
          ))}
        </div>
      )}
      <p className={sch.fairNote}>
        {[
          moved ? W.movedNote : '',
          settings.prime ? W.primeNote(primeWords(settings.prime), percent && settings.prime.share === 'same') : '',
          halfNote,
          t.held > 0 ? W.heldNote(t.held) : '',
        ].filter(Boolean).join(' ')}
      </p>
      {onBill && (
        <button type="button" className={`${sch.door} ${sch.fairDoor}`} onClick={onBill}>
          {bill ? W.billDoor(payments) : W.billTeamsDoor}<ChevronRight size={15} aria-hidden />
        </button>
      )}
    </aside>
  );
}
