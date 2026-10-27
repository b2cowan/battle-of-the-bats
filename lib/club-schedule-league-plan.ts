import { diffAgainstSent, type DiffSlot, type SentPractice } from './club-schedule-engine';
import { HOUSE_LEAGUE } from './club-schedule-holders';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SEND THE CHANGES, HOUSE LEAGUE'S HALF (Club Tier Stage 11b Part 5; frames h4 and k5; rulings 9d2·2, 9d2·16; plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h). The club's edits never touch a house-league practice: a moved slot is soft-removed
 * with its use (league_slot_uses) still waiting on it, a slot taken back or cleared stays live without its program row
 * (migs 392–393). Send the changes makes them land, in the one step `club_schedule_apply_changes`, through its
 * `p_league` — and this is the plan of it, from the schedule as sent (the uses and practices) and as it is now (the slots).
 *
 *   · A USE FOLLOWS ITS TIME. `diffAgainstSent`, with house league as the one holder (`HOUSE_LEAGUE`) and each USE as the
 *     thing that was sent: a use on a removed slot is a loss, a live house-league slot with no use a gain, and a loss and
 *     a gain in the same week are one move (paired in time order) — exactly the rep side's rule for a team's practice. The
 *     use is carried to its new slot first, so the moved practices land on their division's practice time.
 *   · ⚖ TIME TAKEN BACK NEVER CARRIES (9d2·16): a use on a slot the club took back or cleared (live, house league no
 *     longer holding it) is kept out of the pairing — its practices go, even when house league gained a slot that week.
 *   · A PRACTICE MOVES WITH ITS USE by the slot's own shift (h4: "11:00 a.m. → 12:30 p.m."), its length kept, its place
 *     the new slot's. One that would not fit inside the new slot, or that the use no longer covers (another division, a
 *     game use), is CANCELLED rather than asked of the step, which refuses such a move (`changed`) — choosing a new time
 *     is a hand-out, the league admin's, never the club's send.
 *   · Every other practice STILL TO COME on time house league no longer has is cancelled, so the step's last check never
 *     finds one. One already held is history: untouched (the step clears its link).
 * Pure and client-safe: the send module reads, this plans, the words say it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** A slot of the schedule, removed ones included (they are where a moved use waits). `isNew`: made since the last send —
 *  only such a slot is where a moved use can have gone (an older one with no use is time not given yet, never a move). */
export interface LeagueSlot { id: string; startMs: number; endMs: number; venueId: string; facilityId: string | null; removed: boolean; houseLeague: boolean; isNew: boolean }
/** How a league admin divided a house-league slot (one per slot). */
export interface LeagueUse { slotId: string; seasonId: string; divisionId: string | null; kind: 'games' | 'practices' }
/** A house-league practice on the schedule's time. `endMs` null: no end was stored — read as running to its slot's end. */
export interface LeaguePractice { id: string; teamId: string; seasonId: string; divisionId: string | null; slotId: string; startMs: number; endMs: number | null; cancelled: boolean }

/** The step's `p_league` (mig 392 §6, made whole by mig 393). */
export interface LeagueStepArg {
  uses: { from: string; to: string }[];
  cancel: string[];
  updates: { practiceId: string; slotId: string; scheduledAt: string; endsAt: string; location: string }[];
}

export type LeagueChange =
  | { kind: 'moved'; practiceId: string; teamId: string; fromSlotId: string; toSlotId: string; fromStartMs: number; fromEndMs: number; toStartMs: number; toEndMs: number }
  | { kind: 'cancelled'; practiceId: string; teamId: string; slotId: string; startMs: number; endMs: number };

export interface LeaguePlan { step: LeagueStepArg; changes: LeagueChange[] }

export const isEmptyLeagueStep = (s: LeagueStepArg) => !s.uses.length && !s.cancel.length && !s.updates.length;

export function planLeagueChanges(p: {
  slots: readonly LeagueSlot[];
  uses: readonly LeagueUse[];
  practices: readonly LeaguePractice[];
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
  const held = p.slots.filter(s => !s.removed && s.houseLeague && (useBySlot.has(s.id) || s.isNew));
  // The uses the pairing reads: on a removed slot (it may follow its time) or on time house league still holds (so that
  // slot is never read as gained). A use on time taken back is left out: it never carries (9d2·16).
  const paired = p.uses.filter(u => { const s = slotById.get(u.slotId); return s && (s.removed || s.houseLeague); });
  const diff = diffAgainstSent(
    held.map((s): DiffSlot => ({ id: s.id, key: s.id, week: p.weekOfMs(s.startMs), startMs: s.startMs })),
    new Map(held.map(s => [s.id, [HOUSE_LEAGUE]])),
    paired.map((u): SentPractice => ({ id: u.slotId, teamId: HOUSE_LEAGUE, slotId: u.slotId, cancelled: false, startMs: slotById.get(u.slotId)!.startMs })),
    p.weekOfMs,
  );
  const carried = new Map(diff.moves.map(m => [m.practiceId, m.toKey]));

  const step: LeagueStepArg = { uses: [...carried].map(([from, to]) => ({ from, to })), cancel: [], updates: [] };
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
  return { step, changes };
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
  ].sort();
  // FNV-1a, 32 bits: a short tag, not a secret.
  let h = 0x811c9dc5;
  for (const ch of parts.join(';')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${parts.length}-${h.toString(36)}`;
}
