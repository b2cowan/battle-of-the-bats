/**
 * league-practice-tell.ts — TELLING FAMILIES THEIR PRACTICE TIMES, decided and said (House League Stage 9d-3 Parts 2–3;
 * rulings 9d3·1, 9d3·4, 9d3·6, 9d3·7; frames c1–c4; words HOUSE_LEAGUE_STAGE9D3_COPY.md, accepted 2026-11-01, with the
 * owner's cap noun of 2026-10-31: "the season's 3"). Client-safe, pure: the Practice time window decides its Tell step and
 * its re-hand-out confirm with these, and the server decides the send with the same ones.
 *
 *   · WHAT FAMILIES WERE TOLD is a snapshot (`league_team_practices_told`, mig 415): the team's upcoming practices at the
 *     press. ⚠ ONLY FUTURE DATES ARE COMPARED: a past practice falls off the team's list while it stays in the snapshot,
 *     so a naive diff would call every old team changed (`sameUpcoming`).
 *   · A TEAM'S STATE: `none` (no practices, never told), `untold` (practices, never told — the first email), `changed`
 *     (told, and its practices now differ — the 11b change email's Now / Was), `told` (what families know is what is
 *     there). Any edit that leaves a told team different — a second hand-out, a hand edit, a cancel — is `changed`: a told
 *     team's practices never move with nobody told (9d3·6).
 *   · THE CHANGE, AS ROWS: the told practices against the current ones, the identical ones set aside, the rest paired
 *     within each week NEAREST FIRST (closest start first — the 11b pairing, lib/club-schedule-league-plan.ts): a pair is
 *     a move, a told one left over is a cancel, a new one left over is added. Moves and cancels are the built 11b rows
 *     (`leagueRows`, `familyRowLines`); an added practice is the one line 11b never needed ([marketing]).
 *   · A SECOND HAND-OUT IS PREDICTED BEFORE IT IS WRITTEN (`predictHandOut`): the hand-out removes a team's upcoming
 *     practices on the division's practice time that the plan doesn't name and writes the plan's rows with the SLOT's
 *     place (mig 393); everything else of the team's stays. So the confirm's "{c} teams' practices change. {u} team's
 *     don't." is the planner's rows against the snapshot, never a guess from the database after the rewrite.
 * House rules: the clock through `formatTime` / `formatTimeRange`; "practice" (one spelling); `possessive()`.
 */
import { formatShortWeekdayDate, mondayOfDay, orgDayKey, utcToZonedInputs } from './timezone';
import { joinWithAnd, pluralize, possessive, formatTime, formatTimeRange } from './utils';
import { weekdayOf } from './permit-time';
import { weekdaysWords } from './permit-words';
import { SCHEDULE_PUBLISH_WORDS } from './league-schedule-words';
import { leagueRows, type LeagueChange, type LeagueRow, type PracticeFace } from './club-schedule-league-plan';
import {
  familyClose, familyPartOpening, familyRowLines, familySubject, rowWhen, type LeaguePlace,
} from './club-schedule-league-words';
import type { EmailWords } from './club-schedule-words';
import type { PlannedPractice, PracticeTimeSlot } from './league-practice-time';

/** A practice as families are told it: start and end (ISO instants; `e` null when none was stored), the venue and
 *  facility ids, and the typed place when there is no venue. The shape of the snapshot (mig 415). */
export interface ToldPractice { s: string; e: string | null; v: string | null; f: string | null; l: string | null }

/** A team's practice now, with the slot it sits on (the hand-out rewrites only its own slots). */
export interface CurrentPractice extends ToldPractice { slot: string | null }

const ms = (iso: string) => Date.parse(iso);

/** One practice's identity: when it starts and ends, and where (the venue's ids, or the typed place). */
export function toldKey(p: ToldPractice): string {
  const where = p.v ? `v:${p.v}|${p.f ?? ''}` : `l:${(p.l ?? '').trim().toLowerCase()}`;
  return `${ms(p.s)}|${p.e ? ms(p.e) : ''}|${where}`;
}

/** The practices still to come, in start order. */
export function upcoming<T extends ToldPractice>(list: readonly T[], nowMs: number): T[] {
  return list.filter(p => ms(p.s) > nowMs).sort((a, b) => ms(a.s) - ms(b.s) || toldKey(a).localeCompare(toldKey(b)));
}

/** Whether families know what is there: the two lists' UPCOMING practices are the same (a past one is not a change). */
export function sameUpcoming(told: readonly ToldPractice[], now: readonly ToldPractice[], nowMs: number): boolean {
  const a = upcoming(told, nowMs).map(toldKey), b = upcoming(now, nowMs).map(toldKey);
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** The snapshot a send stores: the upcoming practices, in the stored shape (no slot). */
export function snapshotOf(now: readonly ToldPractice[], nowMs: number): ToldPractice[] {
  return upcoming(now, nowMs).map(p => ({ s: new Date(p.s).toISOString(), e: p.e ? new Date(p.e).toISOString() : null, v: p.v, f: p.f, l: p.l }));
}

export type TeamTellState = 'none' | 'untold' | 'changed' | 'told';

/** A team's state (above). `told` is null when its families were never told. */
export function tellStateOf(now: readonly ToldPractice[], told: { snapshot: readonly ToldPractice[] } | null, nowMs: number): TeamTellState {
  const has = upcoming(now, nowMs).length > 0;
  if (!told) return has ? 'untold' : 'none';
  return sameUpcoming(told.snapshot, now, nowMs) ? 'told' : 'changed';
}

/**
 * A hand-out's practices for each team, before it is written: the team's practices off the planned slots (and any already
 * started on them) stay; its upcoming ones on the planned slots are replaced by the plan's rows, each at its slot's place.
 */
export function predictHandOut(p: {
  current: ReadonlyMap<string, readonly CurrentPractice[]>;
  rows: readonly PlannedPractice[];
  slots: readonly PracticeTimeSlot[];
  slotIds: readonly string[];
  nowMs: number;
}): Map<string, ToldPractice[]> {
  const planned = new Set(p.slotIds);
  const slot = new Map(p.slots.map(s => [s.id, s]));
  const out = new Map<string, ToldPractice[]>();
  for (const [teamId, list] of p.current) {
    out.set(teamId, list.filter(x => !(x.slot && planned.has(x.slot) && ms(x.s) > p.nowMs)).map(x => ({ s: x.s, e: x.e, v: x.v, f: x.f, l: x.l })));
  }
  for (const r of p.rows) {
    const s = slot.get(r.slotId);
    const [v, f] = (s?.placeKey ?? '|').split('|');
    (out.get(r.teamId) ?? out.set(r.teamId, []).get(r.teamId)!).push({ s: r.scheduledAt, e: r.endsAt, v: v || null, f: f || null, l: null });
  }
  return out;
}

/** The re-hand-out confirm's counts: of the told teams, how many a hand-out would change and how many it leaves alone. */
export function handOutAgainCounts(p: {
  predicted: ReadonlyMap<string, readonly ToldPractice[]>;
  told: ReadonlyMap<string, { snapshot: readonly ToldPractice[] }>;
  nowMs: number;
}): { told: number; change: number; same: number } {
  let change = 0, same = 0;
  for (const [teamId, t] of p.told) {
    if (sameUpcoming(t.snapshot, p.predicted.get(teamId) ?? [], p.nowMs)) same++;
    else change++;
  }
  return { told: p.told.size, change, same };
}

// ── The change, as rows ────────────────────────────────────────────────────────────────────────────────────

/** Where a practice is, as a key the rows group by: the venue and facility ids, or the typed place. */
const placeKeyOf = (p: ToldPractice) => (p.v ? `${p.v}|${p.f ?? ''}` : `l:${p.l ?? ''}`);

/** A practice's face on the club's clock, from its instants and its place key. */
export function faceOfTold(startMs: number, endMs: number, key: string): PracticeFace {
  const start = utcToZonedInputs(new Date(startMs).toISOString());
  const end = Number.isFinite(endMs) ? utcToZonedInputs(new Date(endMs).toISOString()) : { time: '' };
  const typed = key.startsWith('l:');
  const [v, f] = typed ? [key, ''] : key.split('|');
  return { day: start.date, weekday: weekdayOf(start.date), startClock: start.time, endClock: end.time, venueId: v, facilityId: f || null };
}

/** A face's place in words, from the club's place names (a typed place is its own words). */
export function placeOfTold(names: { venue: (id: string) => string | null; facility: (id: string) => string | null }) {
  return (f: PracticeFace): LeaguePlace => (f.venueId.startsWith('l:')
    ? { venue: f.venueId.slice(2), facility: null }
    : { venue: names.venue(f.venueId) ?? '', facility: f.facilityId ? names.facility(f.facilityId) : null });
}

/** One team's change: the built 11b rows (moved, cancelled), the practices added, and the first date anything changed. */
export interface TeamChange { rows: LeagueRow[]; added: { days: string[]; face: PracticeFace }[]; firstDay: string | null }

const endMsOf = (p: ToldPractice) => (p.e ? ms(p.e) : NaN);
const faceOf = (p: ToldPractice) => faceOfTold(ms(p.s), endMsOf(p), placeKeyOf(p));

/** What changed for one team between what families were told and what is there now (upcoming only). */
export function teamChange(teamId: string, told: readonly ToldPractice[], now: readonly ToldPractice[], nowMs: number): TeamChange {
  const t = upcoming(told, nowMs), n = upcoming(now, nowMs);
  const nowKeys = new Map<string, number>();
  for (const p of n) nowKeys.set(toldKey(p), (nowKeys.get(toldKey(p)) ?? 0) + 1);
  const gone: ToldPractice[] = [], stays: ToldPractice[] = [];
  for (const p of t) {
    const k = toldKey(p), left = nowKeys.get(k) ?? 0;
    if (left > 0) { nowKeys.set(k, left - 1); stays.push(p); } else gone.push(p);
  }
  // What the told ones left over in `nowKeys` is exactly the new practices (identical keys are interchangeable).
  const fresh: ToldPractice[] = [];
  for (const p of n) {
    const k = toldKey(p), left = nowKeys.get(k) ?? 0;
    if (left > 0) { nowKeys.set(k, left - 1); fresh.push(p); }
  }

  // Paired within each week, nearest start first.
  const week = (p: ToldPractice) => mondayOfDay(utcToZonedInputs(p.s).date);
  const changes: LeagueChange[] = [];
  const added: ToldPractice[] = [];
  const weeks = new Set([...gone.map(week), ...fresh.map(week)]);
  for (const w of weeks) {
    const a = gone.filter(p => week(p) === w), b = fresh.filter(p => week(p) === w);
    const pairs: { i: number; j: number; d: number }[] = [];
    a.forEach((x, i) => b.forEach((y, j) => pairs.push({ i, j, d: Math.abs(ms(x.s) - ms(y.s)) })));
    pairs.sort((x, y) => x.d - y.d || x.i - y.i || x.j - y.j);
    const usedA = new Set<number>(), usedB = new Set<number>();
    for (const pr of pairs) {
      if (usedA.has(pr.i) || usedB.has(pr.j)) continue;
      usedA.add(pr.i); usedB.add(pr.j);
      const was = a[pr.i], to = b[pr.j];
      changes.push({
        kind: 'moved', practiceId: `${toldKey(was)}>${toldKey(to)}`, teamId, fromSlotId: placeKeyOf(was), toSlotId: placeKeyOf(to),
        fromStartMs: ms(was.s), fromEndMs: endMsOf(was), toStartMs: ms(to.s), toEndMs: endMsOf(to),
      });
    }
    a.forEach((x, i) => { if (!usedA.has(i)) changes.push({ kind: 'cancelled', practiceId: toldKey(x), teamId, slotId: placeKeyOf(x), startMs: ms(x.s), endMs: endMsOf(x) }); });
    b.forEach((y, j) => { if (!usedB.has(j)) added.push(y); });
  }

  const rows = leagueRows(changes, faceOfTold, stays.map(p => ({ teamId, face: faceOf(p) })));
  const addedGroups = new Map<string, { days: string[]; face: PracticeFace }>();
  for (const p of added) {
    const face = faceOf(p);
    const sig = `${face.weekday}|${face.startClock}|${face.endClock}|${face.venueId}|${face.facilityId ?? ''}`;
    (addedGroups.get(sig) ?? addedGroups.set(sig, { days: [], face }).get(sig)!).days.push(face.day);
  }
  const addedRows = [...addedGroups.values()].map(g => ({ ...g, days: g.days.sort() })).sort((x, y) => x.days[0].localeCompare(y.days[0]));
  const firsts = [...rows.map(r => r.days[0]), ...addedRows.map(g => g.days[0])].sort();
  return { rows, added: addedRows, firstDay: firsts[0] ?? null };
}

const fullPlace = (p: LeaguePlace) => (p.facility ? `${p.venue} · ${p.facility}` : p.venue);

/** A change's lines for the family: the 11b Now / Was lines, then each added practice ([marketing]). */
export function changeLines(c: TeamChange, placeOf: (f: PracticeFace) => LeaguePlace): string[] {
  const lines = c.rows.flatMap(r => familyRowLines(r, placeOf));
  for (const g of c.added) {
    const when = rowWhen({ days: g.days, throughEnd: false, was: g.face });
    const place = fullPlace(placeOf(g.face));
    lines.push(`Added: ${when}, ${formatTimeRange(g.face.startClock, g.face.endClock)}${place ? ` · ${place}` : ''}`);
  }
  return lines;
}

/** The first email's date lines: every upcoming date, one line each, the place on each ("Wed, Jun 23, 6:00–7:00 p.m. ·
 *  Maple Grove Park · Diamond 1" — a team's dates can span venues, so the place is never in the heading). */
export function dateLines(now: readonly ToldPractice[], nowMs: number, placeOf: (f: PracticeFace) => LeaguePlace): string[] {
  return upcoming(now, nowMs).map(p => {
    const face = faceOf(p);
    const place = fullPlace(placeOf(face));
    return `${formatShortWeekdayDate(face.day)}, ${formatTimeRange(face.startClock, face.endClock)}${place ? ` · ${place}` : ''}`;
  });
}

/**
 * A team's upcoming practices said once, for its row in the Tell window: the weekly pattern as the time line says it
 * ("Tue and Thu, 6:00–7:00 p.m.") and where, each place named once (three or more is "3 places"). Dates are not listed:
 * the email carries every date, the row only says what families are about to be told.
 */
export function practiceSummary(now: readonly ToldPractice[], nowMs: number, placeOf: (f: PracticeFace) => LeaguePlace): { when: string; where: string } {
  const faces = upcoming(now, nowMs).map(faceOf);
  // One shape per start and end (or the start alone when none was stored), the weekdays that share it gathered. Never
  // merged: these are different weeks' practices, so two touching times are two shapes, not one long practice (/review).
  const shapes = new Map<string, { days: Set<number>; words: string }>();
  for (const f of faces) {
    const words = f.endClock ? formatTimeRange(f.startClock, f.endClock) : formatTime(f.startClock);
    const shape = shapes.get(words) ?? shapes.set(words, { days: new Set(), words }).get(words)!;
    shape.days.add(f.weekday);
  }
  const when = [...shapes.values()]
    .sort((a, b) => Math.min(...a.days) - Math.min(...b.days))
    .map(s => `${weekdaysWords([...s.days])}, ${s.words}`)
    .join('; ');
  const places = [...new Set(faces.map(f => fullPlace(placeOf(f))).filter(Boolean))];
  return { when, where: places.length > 2 ? `${places.length} places` : joinWithAnd(places) };
}

// ── The family's email (frame c4; copy section C) ─────────────────────────────────────────────────────────────

/** One child's part: first (every date) or a change (Now / Was, from its first changed date). */
export interface TellPart { child: string; team: string; kind: 'first' | 'change'; lines: string[]; firstDay: string | null }

/** "{A}'s practice times" · "Practice times for {A} and {B}" · "Practice times for {A}, {B}, and {C}" (the copy's own list). */
export function firstSubject(teams: readonly string[]): string {
  const once = [...new Set(teams)];
  if (once.length === 1) return `${possessive(once[0])} practice times`;
  const list = once.length === 2 ? `${once[0]} and ${once[1]}` : `${once.slice(0, -1).join(', ')}, and ${once[once.length - 1]}`;
  return `Practice times for ${list}`;
}

/**
 * The family's email: one part per child whose team is in this send. A household with only changes reads exactly as the
 * 11b change email; one with any first part gets the first email's subject and intro, its told team's part still the
 * change opening with Now / Was (the c2 edge). No link, no button, no unsubscribe link (owner 2026-10-31). The envelope
 * adds the season sentence ("Sent by {club} because your family is registered in {season}.").
 */
export function practiceTimesEmailWords(p: { club: string; season: string; guardianFirst: string | null; parts: readonly TellPart[]; zoneSentence: string }): EmailWords {
  const teams = p.parts.map(x => x.team);
  const anyFirst = p.parts.some(x => x.kind === 'first');
  return {
    subject: anyFirst ? firstSubject(teams) : familySubject(teams),
    greeting: p.guardianFirst?.trim() ? `Hi ${p.guardianFirst.trim()},` : 'Hi,',
    paragraphs: anyFirst ? [PRACTICE_TELL_WORDS.intro(p.season)] : [],
    lists: p.parts.map(x => ({
      title: x.kind === 'first' || !x.firstDay ? PRACTICE_TELL_WORDS.firstOpening(x.child, x.team) : familyPartOpening(p.club, x.child, x.team, x.firstDay),
      items: x.lines,
    })),
    link: null,
    outro: familyClose(teams),
    foot: p.zoneSentence,
  };
}

// ── Words (copy sections A, B, C, E, G) ───────────────────────────────────────────────────────────────────────

const families = (n: number) => pluralize(n, 'family', 'families');
const teamsPossessive = (n: number) => (n === 1 ? '1 team’s' : `${n} teams’`);

export const PRACTICE_TELL_WORDS = {
  // A · the window
  title: 'Tell the families their practice times',
  titlePhone: 'Tell the families',
  /** A division whose teams aren't published tells nobody anything yet (owner 2026-11-01, /ux): the one sentence the game
   *  Publish uses for the same rule, and the door to the Teams screen where they are published. */
  teamsFirst: (division: string) => SCHEDULE_PUBLISH_WORDS.teamsFirst(division),
  teamsFirstDoor: 'Go to Teams',
  teamsFirstFoot: 'The practices stay handed out. The reminder comes back once the teams are published.',
  /** The step's opening: what pressing Send does, said as who gets what (owner 2026-10-31, the redrawn window). */
  lead: (n: number, teams: number) => `Practice times go to ${families(n)} on ${pluralize(teams, 'team')}.`,
  leadNobody: 'No family on these teams can be emailed yet.',
  rowFamilies: (n: number) => families(n),
  /** A team told about a change that leaves it no upcoming practice (every one was cancelled): a row never goes blank. */
  rowNoTimes: 'No upcoming practices',
  changedTag: 'Changed',
  totalLabel: 'Total',
  totalWords: (twoTeams: number) => (twoTeams > 0
    ? `One email per family. ${families(twoTeams)} ${twoTeams === 1 ? 'has' : 'have'} a child on more than one team, so ${twoTeams === 1 ? 'it counts' : 'they count'} once.`
    : 'One email per family.'),
  totalEmails: (n: number) => pluralize(n, 'email'),
  /** The amber row: the one thing a person can still fix before sending. "more" when others are being sent. */
  leftOutRow: (n: number, more: boolean) => `${n} ${more ? 'more ' : ''}${n === 1 ? 'family has' : 'families have'} no working email, so they won’t get this.`,
  leftOutRowPhone: (n: number) => `${n} ${n === 1 ? 'family has' : 'families have'} no working email.`,
  getsLine: 'Each email lists their child’s team practice dates and places. Nothing about fees.',
  seeExample: 'See an example',
  exampleTitle: 'An example',
  exampleTo: (to: string) => `To ${to}`,
  notYet: 'Not yet',
  send: (n: number) => `Send to ${families(n)}`,
  sendPhone: (n: number) => `Send to ${n}`,
  leftOut: (n: number) => (n === 1 ? '1 family has no email that works, so they won’t get this.' : `${n} families have no email that works, so they won’t get this.`),
  leftOutPhone: (n: number) => (n === 1 ? '1 family has no email that works.' : `${n} families have no email that works.`),
  seeThem: 'See them',
  seeThemTitle: (n: number) => `${families(n)} won’t get this email`,
  noEmailOnFile: 'no email on file',
  addEmail: 'Add an email',
  refused: (address: string) => `the address was refused (${address})`,
  fixEmail: 'Fix the email',
  seeThemHint: 'After you fix an email, Send again goes only to the families who didn’t get this one.',
  seeThemFoot: 'A family is marked as told only once its email goes.',
  done: 'Done',
  sendAgain: (n: number) => `Send again to ${n}`,
  sending: (n: number) => `Sending to ${families(n)}…`,
  sendingHint: 'Keep this window open until it finishes.',
  result: (reached: number, of: number) => `Reached ${reached} of ${of} families`,
  didntGo: (n: number) => `${n} didn’t go through.`,
  resultHistory: 'This send is in the season’s history.',
  couldntTitle: 'Couldn’t send',
  couldnt: 'Nothing was sent, and no family was marked as told. Check your connection and try again.',
  couldntFoot: 'The practices are still handed out.',
  close: 'Close',
  tryAgain: 'Try again',
  changedTitle: 'This changed while you were looking',
  changed: 'The list of families changed, so nothing was sent. Review it and send again.',
  changedFoot: 'Nobody was emailed.',
  review: 'Review the list',
  everyoneTitle: 'Everyone has been told',
  everyone: (name: string, n: number, date: string, time: string) => `${name} sent the practice times to ${families(n)} on ${date} at ${time}.`,
  everyoneFoot: 'The reminder on the schedule is gone. If you hand practices out again, this step reopens for the teams whose practices change.',
  noPractices: (teams: readonly string[], m: number) =>
    `${joinWithAnd(teams)} ${teams.length === 1 ? 'has' : 'have'} no practices handed out, so their ${m === 1 ? '1 family isn’t' : `${m} families aren’t`} included. Hand them out, then tell those families.`,
  handOutFor: 'Hand out for them',
  // B · hand out again, and the reminder
  againTitle: (perWeek: number) => `Hand out ${pluralize(perWeek, 'practice')} a week again?`,
  againTold: (a: number) => `${teamsPossessive(a)} families were already told their practice times. Handing out again replaces ${a === 1 ? 'that team’s' : 'those teams’'} upcoming practices.`,
  againChange: (change: number, same: number) =>
    [change ? `${teamsPossessive(change)} practices change.` : '', same ? `${teamsPossessive(same)} don’t.` : ''].filter(Boolean).join(' '),
  againNext: 'You’ll choose whether to tell those families next.',
  againNobody: 'Nobody is emailed until you press Send.',
  keep: 'Keep what’s there',
  again: 'Hand out again',
  changeTitle: 'Tell the families about the changes',
  changeStatement: (changed: number, told: number, fresh: number, freshFamilies: number) => [
    `${teamsPossessive(changed)} practices changed.`,
    `${families(told)} who ${told === 1 ? 'was' : 'were'} told will get the change.`,
    fresh ? `${fresh === 1 ? '1 team hasn’t' : `${fresh} teams haven’t`} been told yet, so their ${families(freshFamilies)} get their practice times for the first time.` : '',
  ].filter(Boolean).join(' '),
  reminder: (n: number) => `${teamsPossessive(n)} families haven’t been sent their practice times`,
  tellThem: 'Tell the families',
  // C · the email
  intro: (season: string) => `Here are the practice times for ${season}. Every date is listed, because the time can change from week to week.`,
  firstOpening: (child: string, team: string) => `${possessive(child)} practices with ${team}:`,
  /** [marketing] while the step reads. */
  loading: 'Loading who to tell…',
  // The route's refusals ([marketing]).
  refusals: {
    finished: 'This season is finished, so its families can’t be sent practice times.',
    teamsFirst: 'Publish this division’s teams first, so every family knows its child’s team.',
    nothing: 'There’s nobody to tell: every team’s families know their practice times.',
    sending: 'These practice times are being sent right now.',
    loadFailed: 'Who to tell didn’t load. Try again.',
    badRequest: 'Pick a division and the teams to tell.',
    notFound: 'That season or division isn’t this club’s.',
  },
} as const;

/** The season's Email families history: the Automatic row (copy section E; the shape of PRACTICES_CHANGED_NOTICE). */
export const PRACTICES_SENT_NOTICE = {
  subject: (division: string | null) => (division ? `Practice times sent: ${division}` : 'Practice times sent'),
  body: (division: string | null, cap: number) =>
    `FieldLogicHQ sent this when a league admin told ${division ? possessive(division) : 'a division’s'} families their practice times: one email per family, about their own children’s teams. Automatic emails don’t count toward the season’s ${cap} emails.`,
} as const;

// ── The coach (copy sections D and E; Session 2, frame b2) ───────────────────────────────────────────────────

/**
 * The one quiet line under the coach's Schedule heading: whether the team's families know the practices listed there.
 * `listed` is how many practices the coach's schedule shows (from the start of today, cancelled ones included); the state
 * compares only UPCOMING ones. Nothing is said about practices the coach can't see, so:
 *   · told, and nothing listed → no line (the season's last practice has passed);
 *   · none → "No practices yet. Nobody has handed any out." only when the team never had one (`everHad` false) — the
 *     schedule's own "No practices yet." stands otherwise;
 *   · changed is said even with nothing listed: every practice families were told about was taken away.
 */
export type CoachToldLine = { kind: 'told'; at: string } | { kind: 'changed'; at: string; emptied?: true } | { kind: 'untold' } | { kind: 'never' };

export function coachToldLine(p: { state: TeamTellState; toldAt: string | null; listed: number; everHad: boolean }): CoachToldLine | null {
  switch (p.state) {
    // `emptied`: nothing is listed, so "these times" would point at nothing — the words say the practices were taken away.
    case 'changed': return p.toldAt ? (p.listed > 0 ? { kind: 'changed', at: p.toldAt } : { kind: 'changed', at: p.toldAt, emptied: true }) : null;
    case 'untold': return { kind: 'untold' };
    case 'told': return p.listed > 0 && p.toldAt ? { kind: 'told', at: p.toldAt } : null;
    case 'none': return p.listed === 0 && !p.everHad ? { kind: 'never' } : null;
  }
}

/** Copy section E: the coach page's lines. The day is the club's day of the send. */
export const COACH_TOLD_WORDS = {
  told: (atIso: string) => `Families were told these practice times on ${formatShortWeekdayDate(orgDayKey(atIso))}.`,
  untold: 'Families haven’t been told these practice times yet. A club admin or league admin sends them.',
  changed: (atIso: string) => `Families were told different times on ${formatShortWeekdayDate(orgDayKey(atIso))}. They haven’t been sent these times yet.`,
  changedEmptied: (atIso: string) => `Families were told practice times on ${formatShortWeekdayDate(orgDayKey(atIso))}. Those practices have since been taken away, and families haven’t been told.`,
  never: 'No practices yet. Nobody has handed any out.',
} as const;

export function coachToldWords(line: CoachToldLine): string {
  switch (line.kind) {
    case 'told': return COACH_TOLD_WORDS.told(line.at);
    case 'changed': return line.emptied ? COACH_TOLD_WORDS.changedEmptied(line.at) : COACH_TOLD_WORDS.changed(line.at);
    case 'untold': return COACH_TOLD_WORDS.untold;
    case 'never': return COACH_TOLD_WORDS.never;
  }
}

/**
 * Copy section D: the coach's one copy, on the team's FIRST send (once per team ever — a change is the 11b coach email's).
 * One email per coach. The counts are the send's: families reached on this team, and the dates the email listed. The
 * singulars ("1 Twins family", "the date") are the build's, so a team of one family never reads "1 families".
 */
export function coachCopyWords(p: { club: string; team: string; season: string; firstName: string | null; families: number; dates: number; path: string }): EmailWords {
  const fams = `${p.families} ${p.team} ${p.families === 1 ? 'family' : 'families'}`;
  // 0 = every listed date has passed by the time the copy goes (a late first reach): never "all 0 dates".
  const dates = p.dates === 1
    ? 'The email lists the date, and the same date is on your team page.'
    : p.dates === 0
      ? 'The email lists their practice dates, and your team page has the schedule.'
      : `The email lists all ${p.dates} dates, and the same dates are on your team page.`;
  return {
    subject: `${p.team} families were sent their practice times`,
    greeting: p.firstName?.trim() ? `Hi ${p.firstName.trim()},` : 'Hi,',
    paragraphs: [`${p.club} emailed ${fams} their practice times today. ${dates}`],
    lists: [],
    link: { label: `Open ${possessive(p.team)} team page →`, path: p.path },
    outro: null,
    foot: `You’re getting this because you coach ${p.team} in ${p.season}.`,
  };
}
