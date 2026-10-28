/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SEND THE CHANGES, HOUSE LEAGUE'S HALF (Club Tier Stage 11b Part 5; frames h4 and k5; rulings 9d2·2, 9d2·16; plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h). The club's edits never touch a house-league practice: a moved slot is soft-removed
 * with its use (league_slot_uses) still waiting on it, a slot taken back or cleared stays live without its program row
 * (migs 392–393). Send the changes makes them land, in the one step `club_schedule_apply_changes`, through its
 * `p_league` — and this is the plan of it, from the schedule as sent (the uses and practices) and as it is now (the slots).
 *
 *   · A USE FOLLOWS ITS TIME. A use on time house league lost (a removed slot, or one the club gave away or cleared) is a
 *     loss; house-league time GAINED SINCE THE LAST SEND with no use is a gain; a loss and a gain in the same week are one
 *     move — the rep side's same-week rule, but paired NEAREST FIRST (closest start times first), not in time order: with
 *     a Thursday taken back and a Sunday moved in one week, time order gave the new Sunday to Thursday's use and cancelled
 *     Sunday's own (found by the Part 5 end-to-end probe, 2026-10-27). The use is carried to its new slot first, so the
 *     moved practices land on their division's practice time. ⚠ A hand drag on the grid is a holder swap
 *     (the old slot opens, the new one becomes house league's), never a new slot — so the pairing reads gained time by when
 *     house league came to hold it, not by when the slot was made (/review of the walk, 2026-10-27).
 *   · ⚖ TIME TAKEN BACK (9d2·16): with nothing gained that week, its practices go. Older time with no use is Not given yet,
 *     never a gain — a division is never carried onto time the club didn't move it to.
 *   · A PRACTICE MOVES WITH ITS USE by the slot's own shift (h4: "11:00 a.m. → 12:30 p.m."), its length kept, its place
 *     the new slot's. One that would not fit inside the new slot, or that the use no longer covers (another division, a
 *     game use), is CANCELLED rather than asked of the step, which refuses such a move (`changed`) — choosing a new time
 *     is a hand-out, the league admin's, never the club's send.
 *   · Every other practice STILL TO COME on time house league no longer has is cancelled, so the step's last check never
 *     finds one. One already held is history: untouched (the step clears its link).
 *   · ⚖ GAMES FOLLOW THEIR DIVISION'S GAME TIME (House League 9d-2b Part 5; 9d2·13, 9d2·16). A game sits on a use by
 *     `league_games.slot_use_id`; carried, its use takes the game's link with it (ON UPDATE CASCADE), and the plan moves
 *     the game by the slot's shift, as a practice. One that won't fit, or whose time was taken back or cleared, LEAVES:
 *     a published division's game is postponed (Needs a new date, waiting in the division's Changes to send — families
 *     hear once, from the league admin), a draft's comes off the draft (deleted; nobody was told of it). A game played,
 *     started, cancelled or already postponed stays exactly as it is. Never a new time chosen for it: that is the league
 *     admin's, never the club's send.
 * Pure and client-safe: the send module reads, this plans, the words say it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** A slot of the schedule, removed ones included (they are where a moved use waits). `isNew`: house league came to hold it
 *  since the last send (the slot was made, or given to house league, since) — only such time is where a moved use can have
 *  gone (an older one with no use is time not given yet, never a move). */
export interface LeagueSlot { id: string; startMs: number; endMs: number; venueId: string; facilityId: string | null; removed: boolean; houseLeague: boolean; isNew: boolean }
/** How a league admin divided a house-league slot (one per slot). */
export interface LeagueUse { slotId: string; seasonId: string; divisionId: string | null; kind: 'games' | 'practices' }
/** A house-league practice on the schedule's time. `endMs` null: no end was stored — read as running to its slot's end. */
export interface LeaguePractice { id: string; teamId: string; seasonId: string; divisionId: string | null; slotId: string; startMs: number; endMs: number | null; cancelled: boolean }

/** A house-league game on the schedule's time, by its division game time (9d-2b; `slotId` = its `slot_use_id`).
 *  `endMs` null: no end was stored. `published`: its division's schedule is published (9d2·1). */
export interface LeagueSlotGame {
  id: string; seasonId: string; divisionId: string; slotId: string; startMs: number; endMs: number | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'postponed'; published: boolean;
}

/** The step's `p_league` (mig 392 §6, made whole by mig 393; `games` by mig 411). */
export interface LeagueStepArg {
  uses: { from: string; to: string }[];
  cancel: string[];
  updates: { practiceId: string; slotId: string; scheduledAt: string; endsAt: string; location: string }[];
  /** 9d-2b Part 5: games moved with their time; a published division's postponed, a draft's removed. */
  games: { move: { gameId: string; slotId: string; scheduledAt: string; endsAt: string | null; location: string }[]; postpone: string[]; remove: string[] };
}

export type LeagueChange =
  | { kind: 'moved'; practiceId: string; teamId: string; fromSlotId: string; toSlotId: string; fromStartMs: number; fromEndMs: number; toStartMs: number; toEndMs: number }
  | { kind: 'cancelled'; practiceId: string; teamId: string; slotId: string; startMs: number; endMs: number };

/** What the send does to one game: moved with its time, to Needs a new date (published), or off the draft. */
export interface LeagueGameChange {
  kind: 'moved' | 'needsDate' | 'removed';
  gameId: string; seasonId: string; divisionId: string; published: boolean;
  fromSlotId: string;
  /** A move's new slot; null when the game leaves. */
  toSlotId: string | null;
}

export interface LeaguePlan { step: LeagueStepArg; changes: LeagueChange[]; gameChanges: LeagueGameChange[] }

export const isEmptyLeagueStep = (s: LeagueStepArg) => !s.uses.length && !s.cancel.length && !s.updates.length
  && !s.games.move.length && !s.games.postpone.length && !s.games.remove.length;

export function planLeagueChanges(p: {
  slots: readonly LeagueSlot[];
  uses: readonly LeagueUse[];
  practices: readonly LeaguePractice[];
  /** 9d-2b Part 5: the games on the schedule's time (absent: none). */
  games?: readonly LeagueSlotGame[];
  nowMs: number;
  weekOfMs: (ms: number) => string;
  /** The display place a moved practice is written with (the hand-out's cache: venue — facility). */
  locationOf: (slotId: string) => string;
}): LeaguePlan {
  const slotById = new Map(p.slots.map(s => [s.id, s]));
  const useBySlot = new Map(p.uses.map(u => [u.slotId, u]));
  // The time house league holds that the pairing reads: a slot with a use (never gained), and a NEW slot with none (where
  // a moved use can go). An older slot with no use is Not given yet — pairing to it would carry a division onto time the
  // club never moved it to (/review 2026-10-27).
  const isHeld = (s: LeagueSlot) => !s.removed && s.houseLeague;
  const lost = p.uses.map(u => slotById.get(u.slotId)).filter((s): s is LeagueSlot => !!s && !isHeld(s));
  const gained = p.slots.filter(s => isHeld(s) && s.isNew && !useBySlot.has(s.id));
  // Every same-week pair, closest start times first (ties by id, so the plan is the same on every read); each loss and
  // each gain is used once.
  const pairs = lost.flatMap(l => gained.filter(g => p.weekOfMs(g.startMs) === p.weekOfMs(l.startMs))
    .map(g => ({ from: l.id, to: g.id, gap: Math.abs(g.startMs - l.startMs) })))
    .sort((a, b) => a.gap - b.gap || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const carried = new Map<string, string>(), taken = new Set<string>();
  for (const pr of pairs) {
    if (carried.has(pr.from) || taken.has(pr.to)) continue;
    carried.set(pr.from, pr.to);
    taken.add(pr.to);
  }

  const step: LeagueStepArg = { uses: [...carried].map(([from, to]) => ({ from, to })), cancel: [], updates: [], games: { move: [], postpone: [], remove: [] } };
  const changes: LeagueChange[] = [];
  for (const pr of [...p.practices].sort((a, b) => a.teamId.localeCompare(b.teamId) || a.startMs - b.startMs)) {
    const from = slotById.get(pr.slotId);
    if (!from || pr.cancelled || pr.startMs <= p.nowMs) continue;
    if (!from.removed && from.houseLeague) continue;
    const toId = carried.get(from.id);
    const to = toId ? slotById.get(toId) : undefined;
    const use = useBySlot.get(from.id);
    const shift = to ? to.startMs - from.startMs : 0;
    const fromEndMs = pr.endMs ?? from.endMs;
    const startMs = pr.startMs + shift, endMs = fromEndMs + shift;
    const fits = !!to && !!use && use.kind === 'practices' && use.seasonId === pr.seasonId && use.divisionId === pr.divisionId
      && startMs >= to.startMs && endMs <= to.endMs && endMs > startMs;
    if (fits) {
      step.updates.push({ practiceId: pr.id, slotId: to!.id, scheduledAt: new Date(startMs).toISOString(), endsAt: new Date(endMs).toISOString(), location: p.locationOf(to!.id) });
      // A slot replaced by one at the same time and place (shortened, or saved again): the practice's link follows the
      // slot, but nothing a coach or a family reads changed, so nobody is told.
      const same = shift === 0 && pr.endMs != null && to!.venueId === from.venueId && to!.facilityId === from.facilityId;
      if (!same) changes.push({ kind: 'moved', practiceId: pr.id, teamId: pr.teamId, fromSlotId: from.id, toSlotId: to!.id, fromStartMs: pr.startMs, fromEndMs, toStartMs: startMs, toEndMs: endMs });
    } else {
      step.cancel.push(pr.id);
      changes.push({ kind: 'cancelled', practiceId: pr.id, teamId: pr.teamId, slotId: from.id, startMs: pr.startMs, endMs: fromEndMs });
    }
  }

  // Games (9d-2b Part 5): only one still to come and on (`scheduled`) follows; the rest is history or already off its time.
  const gameChanges: LeagueGameChange[] = [];
  for (const g of [...(p.games ?? [])].sort((a, b) => a.divisionId.localeCompare(b.divisionId) || a.startMs - b.startMs || a.id.localeCompare(b.id))) {
    const from = slotById.get(g.slotId);
    if (!from || g.status !== 'scheduled' || g.startMs <= p.nowMs) continue;
    if (!from.removed && from.houseLeague) continue;
    const toId = carried.get(from.id);
    const to = toId ? slotById.get(toId) : undefined;
    const use = useBySlot.get(from.id);
    const shift = to ? to.startMs - from.startMs : 0;
    const startMs = g.startMs + shift, endMs = g.endMs == null ? null : g.endMs + shift;
    const fits = !!to && !!use && use.kind === 'games' && use.seasonId === g.seasonId && use.divisionId === g.divisionId
      && startMs >= to.startMs && startMs < to.endMs && (endMs ?? startMs) <= to.endMs;
    const base = { gameId: g.id, seasonId: g.seasonId, divisionId: g.divisionId, published: g.published, fromSlotId: from.id };
    if (fits) {
      // The same time and place (a slot saved again): the game's link follows its use, and there is nothing to write.
      if (shift === 0 && to!.venueId === from.venueId && to!.facilityId === from.facilityId) continue;
      step.games.move.push({
        gameId: g.id, slotId: to!.id, scheduledAt: new Date(startMs).toISOString(),
        endsAt: endMs == null ? null : new Date(endMs).toISOString(), location: p.locationOf(to!.id),
      });
      gameChanges.push({ ...base, kind: 'moved', toSlotId: to!.id });
    } else if (g.published) {
      step.games.postpone.push(g.id);
      gameChanges.push({ ...base, kind: 'needsDate', toSlotId: null });
    } else {
      step.games.remove.push(g.id);
      gameChanges.push({ ...base, kind: 'removed', toSlotId: null });
    }
  }
  return { step, changes, gameChanges };
}

// ── A team's changes as rows (h4: "Sundays from Nov 8: Field 1 → Field 3, 11:00 a.m. → 12:30 p.m.") ─────────────────

/** A practice's when and where, on the club's clock. */
export interface PracticeFace { day: string; weekday: number; startClock: string; endClock: string; venueId: string; facilityId: string | null }

/** One row: the practices of one team that changed the same way, on one weekday, time and place. */
export interface LeagueRow {
  teamId: string;
  kind: 'moved' | 'cancelled';
  /** The changed practices' dates as they WERE, in order. */
  days: string[];
  /** True when none of the team's practices on that weekday, time and place stays after the last of them: "from Nov 8". */
  throughEnd: boolean;
  was: PracticeFace;
  /** Where and when they are now (a move's first). */
  now: PracticeFace | null;
}

const sig = (f: PracticeFace) => `${f.weekday}|${f.startClock}|${f.endClock}|${f.venueId}|${f.facilityId ?? ''}`;

/**
 * Group a plan's changes into rows, team by team: a move groups by where it was and where it went, a cancel by where it
 * was. `stays` are the team's practices still to come that the send leaves where they are (to tell "from Nov 8" from a
 * run that stops: a family must never read every later Sunday as moved).
 */
export function leagueRows(changes: readonly LeagueChange[], faceOf: (startMs: number, endMs: number, slotId: string) => PracticeFace, stays: readonly { teamId: string; face: PracticeFace }[]): LeagueRow[] {
  const groups = new Map<string, LeagueRow>();
  for (const c of changes) {
    const was = c.kind === 'moved' ? faceOf(c.fromStartMs, c.fromEndMs, c.fromSlotId) : faceOf(c.startMs, c.endMs, c.slotId);
    const now = c.kind === 'moved' ? faceOf(c.toStartMs, c.toEndMs, c.toSlotId) : null;
    // A move's group also keeps how many days it shifted, so Sun → Mon and Sun → Tue never share a row.
    const shift = now ? Math.round((Date.parse(`${now.day}T12:00:00Z`) - Date.parse(`${was.day}T12:00:00Z`)) / 86_400_000) : 0;
    const key = `${c.teamId}|${c.kind}|${sig(was)}|${now ? `${shift}|${now.startClock}|${now.endClock}|${now.venueId}|${now.facilityId ?? ''}` : ''}`;
    const row = groups.get(key) ?? groups.set(key, { teamId: c.teamId, kind: c.kind, days: [], throughEnd: true, was, now }).get(key)!;
    row.days.push(was.day);
  }
  const rows = [...groups.values()];
  for (const r of rows) {
    r.days.sort();
    const last = r.days[r.days.length - 1];
    r.throughEnd = !stays.some(s => s.teamId === r.teamId && sig(s.face) === sig(r.was) && s.face.day > last);
  }
  return rows.sort((a, b) => a.teamId.localeCompare(b.teamId) || a.days[0].localeCompare(b.days[0]) || a.kind.localeCompare(b.kind));
}

/** A plan's fingerprint: what the owner saw in the preview, compared again at the press (a league admin's hand-out does
 *  not move the schedule's version, so the version alone can't say the plan changed under the window). */
export function leagueFingerprint(step: LeagueStepArg): string {
  const parts = [
    ...step.uses.map(u => `u:${u.from}>${u.to}`),
    ...step.cancel.map(id => `c:${id}`),
    ...step.updates.map(u => `m:${u.practiceId}>${u.slotId}@${u.scheduledAt}`),
    ...step.games.move.map(g => `gm:${g.gameId}>${g.slotId}@${g.scheduledAt}`),
    ...step.games.postpone.map(id => `gp:${id}`),
    ...step.games.remove.map(id => `gr:${id}`),
  ].sort();
  // FNV-1a, 32 bits: a short tag, not a secret.
  let h = 0x811c9dc5;
  for (const ch of parts.join(';')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${parts.length}-${h.toString(36)}`;
}
