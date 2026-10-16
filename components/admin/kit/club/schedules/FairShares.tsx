'use client';
/**
 * FAIR SHARES (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimens 6, 7, 10, the By percentage frame, 14 step 3;
 * Asks 12, 18, 23), laid out as FAIR SHARES B (Sidebar Strip & Grid Width, Stage 1 — ratified 2026-10-12, design log
 * "THE SIDEBAR COLLAPSES TO AN ICON STRIP … FAIR SHARES' FIGURES GO ABOVE THE TOOLBAR, ITS TEAMS BELOW THE GRID"; built
 * with Club Tier Stage 11d part B, owner 2026-10-16: "one pass over one panel"). The grid takes the page's whole width.
 *
 *   the band  — `FairSharesBand`, ABOVE THE TOOLBAR: ONE joined band, four across (2026-10-08: tiles connected, never
 *               cards with gaps): Handed out "288 of 354" · Open (or The bill) · Short · Clashes. They answer for the whole
 *               schedule, so a lens changes only what is under them (the 2026-10-07 money-tab order, /design change 4).
 *               At its end the door "Fair shares by team ↓" scrolls to the card — a door, olive text (/design change 5).
 *   the lines — `FairSharesLines`, UNDER THE TOOLBAR, ABOVE THE GRID: the week's clashes and who is short — they change
 *               with the week on screen.
 *   the card  — `FairSharesTeams`, UNDER THE GRID: "Fair shares by team", the bill's door at its title row's right
 *               (/design change 7: above the figures it concerns), the table (a row per team: this week · all of it ·
 *               prime time, or HOURS where there is no prime time — Stage 11c Ask 3; "50 shared" under All; EARLY and the
 *               facilities when teams move around, now with the Bill too, the card has the width — 11c's departure 2
 *               undone; By percentage, group rows with their share first; with the bill, Slots · Hours · Bill), and its
 *               notes beside it.
 *
 * ⚖ THE BILL (Stage 11d part B — Not drawn: Fair shares; D4): once the schedule made its bill, each team's Bill is what
 *   it PAYS for its time (`fairBill` — billed less credited, plus corrections, less money given back), so it agrees with
 *   Money › Club; before Finalize, the bill as Bill the teams would make it. A team that handed time back with no money
 *   settled pays its bill as it was, and the card's note says so ("15U AA handed back 4 Sundays without asking for money:
 *   its bill stays $2,700.00."). ⚠ A departure from `#s11d-club-plain`, said: that frame printed the plain hand-back's Bill
 *   as $2,268.00 (its time priced now) beside the note's $2,700.00 — two numbers for one bill, which is S11D-05 itself.
 *   The Not-drawn row's "agrees with Money › Club" wins: $2,700.00, and the band's total follows ($27,000.00).
 */
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ChevronRight } from 'lucide-react';
import { SCHEDULE_SCREEN_WORDS as W, moneyCents as money } from '@/lib/club-schedule-words';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { NO_GROUP, dayHead, facilityNoun, fairBill, heldWords, perWeek, primeWords, weekCounts, weekShortfalls, type ScheduleView } from '@/lib/club-schedule-view';
import { formatTime } from '@/lib/utils';
import type { TeamResult } from '@/lib/club-schedule-engine';
import { JoinedBand, Swatch } from './ScheduleParts';
import sch from './Schedules.module.css';

/** One of the table's columns: its head, a team's cell, a group's (By percentage and the bill band teams by group). */
interface Column { head: string; cell: (r: TeamResult) => ReactNode; group: (rs: readonly TeamResult[]) => ReactNode; hours?: boolean }

/** Up to this many of a week's clashes read one by one, with their date and place. */
const CLASH_LINES_EACH = 3;
const CLASH_KIND_ORDER = ['tryout', 'game', 'practice'];
/** The card's id — the band's door scrolls to it. */
export const FAIR_TEAMS_ID = 'fair-shares-by-team';

/** A week's clashes by the kind of booking holding them — tryout days, games, practices, then any other booking — each
 *  with who holds them, in the order the week meets them. */
function clashGroups(clashes: readonly ScheduleView['slots'][number][]) {
  const groups = new Map<string | null, { kind: string | null; count: number; owners: string[] }>();
  for (const s of clashes) {
    const kind = CLASH_KIND_ORDER.includes(s.heldBy!.kind ?? '') ? s.heldBy!.kind : null;
    const g = groups.get(kind) ?? groups.set(kind, { kind, count: 0, owners: [] }).get(kind)!;
    g.count++;
    if (!g.owners.includes(s.heldBy!.ownerName)) g.owners.push(s.heldBy!.ownerName);
  }
  const rank = (k: string | null) => (k == null ? CLASH_KIND_ORDER.length : CLASH_KIND_ORDER.indexOf(k));
  return [...groups.values()].sort((a, b) => rank(a.kind) - rank(b.kind));
}

export interface FairInput {
  view: ScheduleView;
  /** The days on screen — "this week". */
  week: readonly string[];
  /** The weeks those days stand for (`weeksOnScreen`): a one-weekday schedule's seven dates are seven weeks. */
  weeks?: number;
  /** "this week" / "these Sundays" — what the short lines are short of. */
  scope?: string;
  nameOf: (teamId: string) => string;
  placeOf: (venueId: string, facilityId: string | null) => string;
}

export type FairModel = ReturnType<typeof fairShares>;

/** Fair shares, worked out once for the band, the lines and the card. */
export function fairShares({ view, week, weeks = 1, scope = W.scopeWeek, nameOf, placeOf }: FairInput) {
  const { fairness, schedule } = view;
  const settings = schedule.settings;
  const results = fairness.teams.filter(r => r.target > 0 || r.got > 0);
  const inWeek = new Set(week);
  const counts = weekCounts(view.slots, week);
  const shorts = weekShortfalls({ slots: view.slots, week, results, settings, counts, weeks });
  const teamById = new Map(view.teams.map(t => [t.id, t]));

  const billCents = fairBill(view);
  const showBill = view.canMoney && billCents.size > 0;
  const moved = settings.timeMode === 'moved';
  const hours = (r: { pricedMinutes: number }) => Math.round((r.pricedMinutes / 60) * 10) / 10;
  const used = new Set(view.slots.map(x => x.facilityId));
  const facilityWord = moved ? W.colFacilities(facilityNoun(view.places.flatMap(p => p.facilities.filter(f => used.has(f.id)).map(f => f.name)), 2)) : '';
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
  const share = (id: string) => Number(settings.split.values[id] ?? 0);

  // THE COLUMNS, one list per mode — the header, a team's row and a group's row all read it.
  const sum = (rs: readonly TeamResult[], of: (r: TeamResult) => number) => rs.reduce((n, r) => n + of(r), 0);
  const allCol: Column = { head: W.colAll, cell: r => W.sharedCount(r.got, r.shared), group: rs => sum(rs, r => r.got) };
  const hoursCol: Column = { head: W.colHours, cell: r => hours(r), group: rs => hours({ pricedMinutes: sum(rs, r => r.pricedMinutes) }), hours: true };
  const billCol: Column = { head: W.colBill, cell: r => money(billCents.get(r.teamId) ?? 0), group: rs => money(sum(rs, r => billCents.get(r.teamId) ?? 0)) };
  const columns: Column[] = moved
    ? [allCol, { head: W.colEarly, cell: r => r.early, group: rs => sum(rs, r => r.early) }, { head: facilityWord, cell: r => r.facilities, group: () => '' }, ...(showBill ? [billCol] : [])]
    : showBill
      ? [{ ...allCol, head: W.colSlots }, hoursCol, billCol]
      : [
        percent
          ? { head: W.colShare, cell: r => `${share(r.teamId)}%`, group: rs => `${Math.round(sum(rs, r => share(r.teamId)) * 100) / 100}%` }
          : { head: W.colThisWeek, cell: r => perWeek(counts.get(r.teamId) ?? 0, weeks), group: () => '' },
        allCol,
        settings.prime ? { head: W.colPrime, cell: r => r.prime, group: rs => sum(rs, r => r.prime) } : hoursCol,
      ];

  // The week's clashes: a few each with its date and what holds it; past that, one line per kind of booking, naming who
  // holds them — a draft laid over a schedule already on the books listed 71 (owner 2026-10-13), and the grid marks each
  // one. The week's short teams stay a line each: there are never more of them than teams.
  const clashes = view.slots.filter(s => inWeek.has(s.day) && s.clash && s.heldBy);
  const clashLines = clashes.length <= CLASH_LINES_EACH
    ? clashes.map(s => W.clashLine(`${dayHead(s.day)} · ${formatTime(s.startClock)}`, placeOf(s.venueId, s.facilityId), heldWords(s.heldBy!)))
    : W.clashGroupLines(clashGroups(clashes));
  const shortLines = [...shorts].map(([id, n]) => W.shortLine(nameOf(id), n, scope));
  const t = fairness.totals;
  const tiles = [
    { key: 'handed', label: W.tileHandedOut, value: W.ofSlots(t.handedOut, t.seats) },
    showBill ? { key: 'bill', label: W.tileBill, value: money(billTotal) } : { key: 'open', label: W.tileOpen, value: String(t.open) },
    { key: 'short', label: W.tileShort, value: String(t.short), amber: t.short > 0 },
    { key: 'clashes', label: W.tileClashes, value: String(t.clashes), amber: t.clashes > 0 },
  ];
  // Hours count a shared slot and a half field each half (Stage 11c Ask 3) — said once, where Hours shows and either is on
  // the schedule; "every team has 37.5 hours" when they all do.
  const hoursShown = columns.some(c => c.hours);
  const halves = view.slots.some(x => x.teamIds.length > 1 || (x.teamIds.length > 0 && x.weight < 1));
  const playing = results.filter(r => r.got > 0);
  const sameHours = playing.length > 1 && playing.every(r => hours(r) === hours(playing[0])) ? String(hours(playing[0])) : null;
  // D4: a team that handed time back with no money settled still pays its bill — said where the Bill column reads it.
  const listed = new Set(results.map(r => r.teamId));
  const kept = showBill ? view.kept.filter(k => listed.has(k.teamId)).map(k => H.keptNote({ teamName: nameOf(k.teamId), count: k.count, weekday: k.weekday, cents: billCents.get(k.teamId) ?? 0, asked: k.asked, billMoved: k.billMoved })) : [];
  const notes = [
    moved ? W.movedNote : '',
    settings.prime ? W.primeNote(primeWords(settings.prime), percent && settings.prime.share === 'same') : '',
    hoursShown && halves ? W.hoursNote(sameHours) : '',
    t.held > 0 ? W.heldNote(t.held) : '',
  ].filter(Boolean).join(' ');

  // The bill's door: "The bill · 3 payments ›" once a bill rides with the schedule, else "Bill the teams ›".
  const billDoor = view.bill ? W.billDoor(view.bill.dues.length) : W.billTeamsDoor;
  return { results, shorts, columns, groupsOf, withGroups, tiles, lines: [...clashLines, ...shortLines], kept, notes, billDoor };
}

/** THE BAND, above the toolbar: four figures across, and the door to the teams under the grid. */
export function FairSharesBand({ model, onTeams }: { model: FairModel; onTeams?: () => void }) {
  return (
    <div className={sch.fairAbove}>
      <JoinedBand label={W.fairTitle} tiles={model.tiles} across />
      {onTeams && (
        <button type="button" className={sch.door} onClick={onTeams}>{W.fairTeamsTitle}<ArrowDown size={15} aria-hidden /></button>
      )}
    </div>
  );
}

/** THE WEEK'S LINES, under the toolbar and above the grid: its clashes, and who is short. */
export function FairSharesLines({ model }: { model: FairModel }) {
  if (!model.lines.length) return null;
  return (
    <div className={sch.fairLines}>
      {model.lines.map(line => <span key={line} className={sch.fairLine}><AlertTriangle size={13} aria-hidden />{line}</span>)}
    </div>
  );
}

/** THE CARD, under the grid: Fair shares by team, the bill's door in its title row, the table and its notes. */
export function FairSharesTeams({ model, nameOf, colourOf, onBill }: {
  model: FairModel;
  nameOf: (teamId: string) => string;
  colourOf: (teamId: string) => string;
  /** The bill's door — the page passes it to a money reader only. */
  onBill?: () => void;
}) {
  const { columns, groupsOf, shorts, results } = model;
  const row = (r: TeamResult) => (
    <tr key={r.teamId} className={shorts.has(r.teamId) ? sch.amberRow : undefined}>
      <td><Swatch colour={colourOf(r.teamId)} />{nameOf(r.teamId)}</td>
      {columns.map(c => <td key={c.head}>{c.cell(r)}</td>)}
    </tr>
  );
  const byId = new Map(results.map(r => [r.teamId, r]));
  const groupRow = (key: string) => {
    const g = groupsOf.get(key)!;
    const rs = g.teamIds.map(id => byId.get(id)!);
    return (
      <tr key={`g-${key}`} className={sch.grp}>
        <td>{g.name}</td>
        {columns.map(c => <td key={c.head}>{c.group(rs)}</td>)}
      </tr>
    );
  };
  return (
    <section id={FAIR_TEAMS_ID} className={sch.fairCard} aria-labelledby="fair-teams-title" tabIndex={-1}>
      <div className={sch.fairHead}>
        <h3 id="fair-teams-title" className={sch.fairTitle}>{W.fairTeamsTitle}</h3>
        {onBill && (
          <button type="button" className={`${sch.door} ${sch.fairDoor}`} onClick={onBill}>
            {model.billDoor}<ChevronRight size={15} aria-hidden />
          </button>
        )}
      </div>
      <div className={sch.fairCols}>
        <table className={sch.fairTable}>
          <thead>
            <tr>
              <th scope="col">{W.colTeam}</th>
              {columns.map(c => <th key={c.head} scope="col">{c.head}</th>)}
            </tr>
          </thead>
          <tbody>
            {model.withGroups
              ? [...groupsOf.keys()].flatMap(key => [groupRow(key), ...groupsOf.get(key)!.teamIds.map(id => row(byId.get(id)!))])
              : results.map(row)}
          </tbody>
        </table>
        {(model.kept.length > 0 || model.notes) && (
          <div className={sch.fairSide}>
            {model.kept.map(k => <p key={k} className={sch.fairKept}>{k}</p>)}
            {model.notes && <p className={sch.fairNote}>{model.notes}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
