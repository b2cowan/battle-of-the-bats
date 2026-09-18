// The INNING LENS over a lineup grid — pure, testable, no React (Coach Lineups Deep Dive F12,
// Phase 4, 2026-09-18). `analyzeLineup` answers "is anything open or clashing, anywhere"; this
// answers the field-side question for ONE inning: who holds each role, who is idle, who COULD take
// an open role, and — only where the facts prove it — why a role is still open.
//
// ⚠ It states facts a coach's own depth chart can back (Best / Never / pitches / cap headroom).
// It never invents a cause: an open role with an eligible idle player is simply "open", and the
// two causes it does name (every idle player has the role set to Never; every idle pitcher is at
// cap) are the only ones the inputs can prove. F07 (manual-edit violations on FILLED cells —
// a Never assignment, a pitcher over cap) extends this same eligibility read; it does not replace it.

import { BENCH_POSITION } from './lineup-analysis';

/** A player's standing for a role, read from their depth chart (Best ranked, Never, or neither). */
export type RoleStanding = 'best' | 'available' | 'never';

export interface InningPlayer {
  playerId: string;
  /** '' = no decision yet, `Bench` = deliberately sitting, else a field position code. */
  position: string;
  /** Ranked Best list and the Never list — `playerPositionPrefs()`'s shape (mound already stripped). */
  preferred: string[];
  never: string[];
  /** The pitching profile, or null for a player who does not pitch. */
  pitcher: { rank: number; maxInnings: number | null } | null;
  /** Innings this player is at the pitcher position across the WHOLE lineup (this inning included). */
  pitchedInnings: number;
  /** The effective per-game pitching cap (player and team caps already reconciled by the caller); null = uncapped. */
  pitcherCap: number | null;
}

export interface InningRoleHolder {
  playerId: string;
  standing: RoleStanding;
  /** 1-based rank in the player's Best list when `standing === 'best'`. */
  bestRank: number | null;
}

export interface InningRole {
  code: string;
  /** Usually zero or one; two or more is the clash `analyzeLineup` also reports. */
  holders: InningRoleHolder[];
  /** Who could take the role right now: every idle player, ordered best → available → never. */
  candidates: InningCandidate[];
  /** Named only when the inputs prove it; an open role with an eligible candidate has no cause. */
  openCause: OpenRoleCause | null;
}

export interface InningCandidate {
  playerId: string;
  /** Idle how: no decision yet, or deliberately benched. */
  idleAs: 'open' | 'bench';
  standing: RoleStanding;
  bestRank: number | null;
  /** Present for the pitcher role on a team that keeps a pitching chart. */
  pitching: { pitches: boolean; used: number; cap: number | null; atCap: boolean } | null;
}

export type OpenRoleCause =
  /** Every player in the lineup already holds a field role — the roster is short for the field. */
  | 'no_idle_players'
  /** Every idle player has this role set to Never on the depth chart. */
  | 'all_never'
  /** The team keeps a pitching chart and every idle pitcher has used their innings. */
  | 'pitchers_at_cap'
  /** The team keeps a pitching chart and no idle player is on it. */
  | 'no_idle_pitchers';

/** The facts behind one player who has no decision this inning — what the "why" panel reads out. */
export interface OpenDecisionFacts {
  playerId: string;
  pitching: { rank: number; used: number; cap: number | null } | null;
  /** This player's standing for each role that is still open this inning. */
  openRoles: { code: string; standing: RoleStanding; bestRank: number | null }[];
}

export interface InningInspection {
  inning: number;
  roles: InningRole[];
  /** Field roles with no holder, in field order. */
  openRoles: string[];
  /** Roles held by more than one player (the clash). */
  clashRoles: string[];
  assignedCount: number;
  /** Players deliberately sitting this inning, in lineup order. */
  bench: string[];
  /** Players with no decision this inning, in lineup order. */
  undecided: string[];
  /** Players assigned somewhere that is not a field role this inning (DH, EH, generic OF) — neither idle nor holding a role. */
  elsewhere: { playerId: string; position: string }[];
  facts: OpenDecisionFacts[];
  /** Whether any player on the team pitches — when false, the mound has no eligibility rule. */
  hasPitchingChart: boolean;
}

/** A cell change the lens asks the editor to make; several from one gesture are ONE undo step. */
export interface InningCellChange { playerId: string; position: string }

/**
 * The cell changes behind one pick on a role's control. `choice` is the control's value:
 *   `assign:<id>` — an idle player takes the role; whoever held it is left open;
 *   `move:<id>`   — an on-field player moves here and the current holder takes THEIR old role
 *                   (a swap, so the inning stays whole; on an open role the mover's old role opens);
 *   `keep:<id>`   — on a clash, that player keeps the role and the others are left open;
 *   `clear`       — the holder(s) come off the role, left open.
 * Anything else (the control's resting value) is no change.
 */
export function inningChoiceChanges(
  role: Pick<InningRole, 'code' | 'holders'>,
  choice: string,
  positionOf: (playerId: string) => string,
): InningCellChange[] {
  const holders = role.holders.map(h => h.playerId);
  const [kind, playerId] = choice.split(':');
  if (kind === 'clear') return holders.map(id => ({ playerId: id, position: '' }));
  if (!playerId) return [];
  if (kind === 'keep') return holders.filter(id => id !== playerId).map(id => ({ playerId: id, position: '' }));
  if (kind === 'assign') {
    return [...holders.map(id => ({ playerId: id, position: '' })), { playerId, position: role.code }];
  }
  if (kind === 'move') {
    const from = positionOf(playerId);
    return [...holders.map(id => ({ playerId: id, position: from })), { playerId, position: role.code }];
  }
  return [];
}

/**
 * The cell changes behind one pick on a PLAYER's control — the Open / Bench rows under the roles
 * (owner, 2026-09-18: "it tells me who is open but gives me no way to action it"). `choice`:
 *   `bench`        — a deliberate sit this inning (the player's own decision, not an inference);
 *   `take:<code>`  — the player takes that role; whoever held it SITS (stated in the option the
 *                    coach picked, so it is their decision, not an inference — and the inning ends
 *                    whole rather than moving the open decision onto the displaced player);
 * anything else is no change.
 */
export function playerChoiceChanges(
  playerId: string,
  choice: string,
  roles: ReadonlyArray<Pick<InningRole, 'code' | 'holders'>>,
): InningCellChange[] {
  if (choice === 'bench') return [{ playerId, position: BENCH_POSITION }];
  const [kind, code] = choice.split(':');
  if (kind !== 'take' || !code) return [];
  const role = roles.find(r => r.code === code);
  if (!role) return [];
  return [
    ...role.holders.filter(h => h.playerId !== playerId).map(h => ({ playerId: h.playerId, position: BENCH_POSITION })),
    { playerId, position: code },
  ];
}

export function standingFor(player: Pick<InningPlayer, 'preferred' | 'never'>, code: string): { standing: RoleStanding; bestRank: number | null } {
  if (player.never.includes(code)) return { standing: 'never', bestRank: null };
  const idx = player.preferred.indexOf(code);
  if (idx >= 0) return { standing: 'best', bestRank: idx + 1 };
  return { standing: 'available', bestRank: null };
}

const STANDING_ORDER: Record<RoleStanding, number> = { best: 0, available: 1, never: 2 };

export function inspectInning(
  players: InningPlayer[],
  inning: number,
  fieldPositions: string[],
  pitcherPosition: string | null,
): InningInspection {
  const hasPitchingChart = players.some(p => p.pitcher != null);
  const idle = players.filter(p => !p.position || p.position === BENCH_POSITION);

  const pitchingFor = (p: InningPlayer): InningCandidate['pitching'] => {
    if (!hasPitchingChart) return null;
    const cap = p.pitcherCap;
    const atCap = cap != null && p.pitchedInnings >= cap;
    return { pitches: p.pitcher != null, used: p.pitchedInnings, cap, atCap };
  };

  const roles: InningRole[] = fieldPositions.map(code => {
    const isMound = pitcherPosition != null && code === pitcherPosition;
    const holders: InningRoleHolder[] = players
      .filter(p => p.position === code)
      .map(p => ({ playerId: p.playerId, ...standingFor(p, code) }));

    const candidates: InningCandidate[] = idle.map(p => ({
      playerId: p.playerId,
      idleAs: p.position === BENCH_POSITION ? 'bench' : 'open',
      ...standingFor(p, code),
      pitching: isMound ? pitchingFor(p) : null,
    }));
    if (isMound && hasPitchingChart) {
      // Pitchers with innings left, by rank; then pitchers at cap; then everyone else. A non-pitcher
      // stays selectable — the rule is named, never enforced (the coach may know something).
      candidates.sort((a, b) => {
        const tier = (c: InningCandidate) => !c.pitching?.pitches ? 2 : c.pitching.atCap ? 1 : 0;
        const dt = tier(a) - tier(b);
        if (dt) return dt;
        const ra = players.find(p => p.playerId === a.playerId)?.pitcher?.rank ?? Infinity;
        const rb = players.find(p => p.playerId === b.playerId)?.pitcher?.rank ?? Infinity;
        return ra - rb;
      });
    } else {
      candidates.sort((a, b) => {
        const ds = STANDING_ORDER[a.standing] - STANDING_ORDER[b.standing];
        if (ds) return ds;
        return (a.bestRank ?? Infinity) - (b.bestRank ?? Infinity);
      });
    }

    let openCause: OpenRoleCause | null = null;
    if (holders.length === 0) {
      if (candidates.length === 0) openCause = 'no_idle_players';
      else if (isMound && hasPitchingChart) {
        const pitchers = candidates.filter(c => c.pitching?.pitches);
        if (pitchers.length === 0) openCause = 'no_idle_pitchers';
        else if (pitchers.every(c => c.pitching?.atCap)) openCause = 'pitchers_at_cap';
      } else if (candidates.every(c => c.standing === 'never')) openCause = 'all_never';
    }
    return { code, holders, candidates, openCause };
  });

  const openRoles = roles.filter(r => r.holders.length === 0).map(r => r.code);
  const clashRoles = roles.filter(r => r.holders.length > 1).map(r => r.code);
  const undecided = players.filter(p => !p.position).map(p => p.playerId);
  const bench = players.filter(p => p.position === BENCH_POSITION).map(p => p.playerId);
  const fieldSet = new Set(fieldPositions);
  const elsewhere = players
    .filter(p => p.position && p.position !== BENCH_POSITION && !fieldSet.has(p.position))
    .map(p => ({ playerId: p.playerId, position: p.position }));

  const facts: OpenDecisionFacts[] = players.filter(p => !p.position).map(p => ({
    playerId: p.playerId,
    pitching: p.pitcher ? { rank: p.pitcher.rank, used: p.pitchedInnings, cap: p.pitcherCap } : null,
    openRoles: openRoles
      .filter(code => !(pitcherPosition != null && code === pitcherPosition))
      .map(code => ({ code, ...standingFor(p, code) })),
  }));

  return {
    inning,
    roles,
    openRoles,
    clashRoles,
    assignedCount: roles.filter(r => r.holders.length > 0).length,
    bench,
    undecided,
    elsewhere,
    facts,
    hasPitchingChart,
  };
}
