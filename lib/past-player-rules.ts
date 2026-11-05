/**
 * THE PAST-PLAYER RULES — pure, client-safe and unit-tested (Club Tier Stage 14 S3; owner rulings 2026-11-04, Asks 4,
 * 5, 9, 12). Which entries are this team's past players, what each row shows (and hides without the roster-details
 * grant), what a returning child's new entry copies, and the one decision every add door re-checks on the server (the
 * window asked first; this is what makes it true). The reads and writes are `lib/past-players.ts`; the words are
 * `lib/past-player-words.ts`.
 */
import { bornWarning, sameName, sameNameCandidates, type PastPlayer, type WorkingSeason } from './past-player-words';
import { playerName } from './coach-roster-name';
import type { BornYears, Cutoff } from './born-years';
import type { PlayerDuesFigures } from './dues-ladder';
import type { RepProgramYear, RepRosterPlayer } from './types';

/** The unique index of mig 438: a child is on a season's roster once. */
const ONE_CHILD_PER_SEASON_INDEX = 'rep_roster_players_one_child_per_season';

/** True when a write failed because the child is already on that season's roster (mig 438's index). */
export function isChildAlreadyOnSeason(e: unknown): boolean {
  const err = e as { code?: string; message?: string; details?: string } | null;
  return err?.code === '23505'
    && `${err.message ?? ''} ${err.details ?? ''}`.includes(ONE_CHILD_PER_SEASON_INDEX);
}

export interface PastPlayersRead {
  /** Children of this team's earlier seasons who are not on the working season — newest season first, then name. */
  past: PastPlayer[];
  /** The full latest entry per listed child (the copy source and the history link's prior side). Server only. */
  latest: Map<string, RepRosterPlayer>;
  /** The working season's entries by child, every status (a child here is "already on the roster"). */
  onWorking: Map<string, RepRosterPlayer>;
  /** Past children a coach already said "no" to for a SAME-NAME player on this season — the add doors never ask again
   *  ("a no is stored and never asked again, anywhere", Ask 4). Optional so a bare read (tests) means "none". */
  answeredNo?: ReadonlySet<string>;
  /** True when this team has any earlier season at all (the picker's two empty states). */
  hasEarlierSeasons: boolean;
  workingSeason: WorkingSeason;
}

export interface PastPlayersAccess {
  /** Birth date and family (the roster-details grant). */
  rosterPii: boolean;
  /** That season's dues (money access AND the roster-details grant: the drawing's "no birth date, no family, no dues"). */
  money: boolean;
}

/**
 * Split a team's entries (every season) into the working season's (by child, every status) and the LATEST earlier entry
 * of every child who is not on the working season — newest season, then newest written (entries come oldest-written
 * first). A season newer than the working one is never "earlier".
 */
export function partitionEntries(
  entries: readonly RepRosterPlayer[],
  seasons: readonly RepProgramYear[],
  working: Pick<RepProgramYear, 'id' | 'year'>,
) {
  const seasonById = new Map(seasons.map(s => [s.id, s]));
  const onWorking = new Map<string, RepRosterPlayer>();
  for (const e of entries) if (e.programYearId === working.id) onWorking.set(e.childId, e);
  const latest = new Map<string, RepRosterPlayer>();
  for (const e of entries) {
    if (e.programYearId === working.id || onWorking.has(e.childId)) continue;
    const s = seasonById.get(e.programYearId);
    if (!s || s.year > working.year) continue;
    const prev = latest.get(e.childId);
    const prevYear = prev ? seasonById.get(prev.programYearId)?.year ?? -Infinity : -Infinity;
    if (!prev || s.year >= prevYear) latest.set(e.childId, e);
  }
  return { seasonById, onWorking, latest };
}

/**
 * The picker's rows. ⚠ Without the roster-details grant a row carries names, number, status and season only — no birth
 * date, no family, no dues, no birth-year warning (the grant that hides them on the roster). Dues are that season's book
 * read as it reads them (`balance` from `seasonDuesFigures`): owing when the balance is above zero, settled when a
 * schedule existed and the balance is zero, nothing otherwise (no schedule, or the team owes the family).
 */
export function toPastPlayers(p: {
  latest: ReadonlyMap<string, RepRosterPlayer>;
  seasonById: ReadonlyMap<string, RepProgramYear>;
  callUpGames: ReadonlyMap<string, number>;
  figures: ReadonlyMap<string, Pick<PlayerDuesFigures, 'balance' | 'ladder'>> | null;
  access: PastPlayersAccess;
  born: BornYears;
  cutoff: Cutoff;
}): PastPlayer[] {
  const past: PastPlayer[] = [...p.latest.values()].map(e => {
    const s = p.seasonById.get(e.programYearId)!;
    const f = p.figures?.get(e.id) ?? null;
    const family = [e.guardianFirstName, e.guardianLastName].map(x => x?.trim()).filter(Boolean).join(' ') || null;
    const dues: PastPlayer['dues'] = !f
      ? null
      : f.balance > 0.004
        ? { kind: 'owing', amount: Math.round(f.balance * 100) / 100 }
        : f.ladder.dues > 0 && Math.abs(f.balance) <= 0.004
          ? { kind: 'settled', amount: 0 }
          : null;
    const pii = p.access.rosterPii;
    return {
      childId: e.childId,
      entryId: e.id,
      firstName: e.playerFirstName,
      lastName: e.playerLastName,
      number: e.playerNumber,
      status: e.status as PastPlayer['status'],
      season: { id: s.id, name: s.name, year: s.year },
      callUpGames: e.status === 'callup' ? p.callUpGames.get(e.id) ?? 0 : null,
      dateOfBirth: pii ? e.playerDateOfBirth : null,
      family: pii ? family : null,
      dues: pii && p.access.money ? dues : null,
      bornWarning: pii ? bornWarning(e.playerDateOfBirth, p.born, p.cutoff) : null,
    };
  });
  return past.sort((a, b) => b.season.year - a.season.year
    || playerName({ playerFirstName: a.firstName, playerLastName: a.lastName })
      .localeCompare(playerName({ playerFirstName: b.firstName, playerLastName: b.lastName })));
}

/**
 * The fields a returning child's new entry copies from their latest entry — the roll's own list (the season roll and
 * the picker bring a child forward the same way). `adminNotes` and `tryoutRegistrationId` are never copied (stale
 * staff/tryout provenance).
 */
export function carriedEntryFields(p: RepRosterPlayer) {
  return {
    childId: p.childId,
    playerFirstName: p.playerFirstName,
    playerLastName: p.playerLastName,
    playerDateOfBirth: p.playerDateOfBirth,
    playerNumber: p.playerNumber,
    primaryPosition: p.primaryPosition,
    secondaryPosition: p.secondaryPosition,
    guardianFirstName: p.guardianFirstName,
    guardianLastName: p.guardianLastName,
    guardianEmail: p.guardianEmail,
    guardianPhone: p.guardianPhone,
    notes: p.notes,
    medicalNotes: p.medicalNotes,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
    bats: p.bats,
    throws: p.throws,
    jerseySize: p.jerseySize,
    lineupProfile: p.lineupProfile,
  };
}

// ── The add doors' question (single add, paste a list) ──────────────────────────────────────────────────────────────

/** What a window sent back about "Same child?": the child it said yes to, and the ones it said no to. */
export interface SameChildAnswer { sameChildId: string | null; notSameChildIds: string[] }

export function parseSameChildAnswer(body: { sameChildId?: unknown; notSameChildIds?: unknown } | null | undefined): SameChildAnswer {
  const yes = typeof body?.sameChildId === 'string' && body.sameChildId ? body.sameChildId : null;
  const no = Array.isArray(body?.notSameChildIds)
    ? [...new Set(body.notSameChildIds.filter((x): x is string => typeof x === 'string' && x.length > 0))].slice(0, 50)
    : [];
  return { sameChildId: yes, notSameChildIds: no };
}

export type AddDoorDecision =
  /** Bring this child back (the coach said yes). */
  | { kind: 'same'; prior: RepRosterPlayer }
  /** A same-name past player nobody has answered for yet — the window must ask first. */
  | { kind: 'ask'; candidate: PastPlayer }
  /** A new child; then store "no" against these (only real past children of this team). */
  | { kind: 'new'; notSameChildIds: string[] }
  /** The yes names a child already on the working season (another door got there first). */
  | { kind: 'already_here'; entry: RepRosterPlayer }
  /** The yes names a child who is not one of this team's past players. */
  | { kind: 'unknown' };

/**
 * THE ONE RULE every add door re-checks on the server (the window asked first; this is what makes it true). Same first
 * and last name against this team's earlier seasons (`sameNameCandidates`), minus the children the window said "no" to;
 * a "yes" must name a listed child.
 */
export function decideAddDoor(
  read: Pick<PastPlayersRead, 'past' | 'latest' | 'onWorking' | 'answeredNo'>,
  first: string | null | undefined,
  last: string | null | undefined,
  answer: SameChildAnswer,
): AddDoorDecision {
  if (answer.sameChildId) {
    const prior = read.latest.get(answer.sameChildId);
    if (prior) return { kind: 'same', prior };
    const here = read.onWorking.get(answer.sameChildId);
    return here ? { kind: 'already_here', entry: here } : { kind: 'unknown' };
  }
  const candidates = sameNameCandidates(first, last, read.past, new Set([...answer.notSameChildIds, ...(read.answeredNo ?? [])]));
  if (candidates.length > 0) return { kind: 'ask', candidate: candidates[0] };
  // A stored "no" is only ever about a pair that could have been asked: a past child whose name matches what was typed
  // (a name edited after the answer drops the stale answer, so "Jonas" is never recorded as "not Jonah").
  const asked = answer.notSameChildIds.filter(id => {
    const e = read.latest.get(id);
    return !!e && sameName(first, last, e.playerFirstName, e.playerLastName);
  });
  return { kind: 'new', notSameChildIds: asked };
}

// ── The tryout accept's question (tab 4 + the 416 refusal) ──────────────────────────────────────────────────────────

/** What the accept window sent back: a past child said yes to, ones said no to, and the "a different child — add anyway"
 *  answer against a same-name entry already on this season (owner ruling 2026-11-04, S3 Part 0). */
export interface AcceptAnswer extends SameChildAnswer { differentFromChildId: string | null }

export function parseAcceptAnswer(body: Record<string, unknown> | null | undefined): AcceptAnswer {
  const base = parseSameChildAnswer(body as { sameChildId?: unknown; notSameChildIds?: unknown });
  const diff = typeof body?.differentFromChildId === 'string' && body.differentFromChildId ? body.differentFromChildId : null;
  return { ...base, differentFromChildId: diff };
}

export type AcceptDecision =
  /** The sign-up's own child is already on this season's roster — provably the same child. No way through. */
  | { kind: 'refuse_same'; entry: RepRosterPlayer }
  /** A same-NAME entry on this season, a different record — the refusal, with the quiet "add anyway". */
  | { kind: 'refuse_name'; entry: RepRosterPlayer }
  /** A same-name past player nobody has answered for — the window asks first. */
  | { kind: 'ask'; candidate: PastPlayer }
  /** Go: confirm the returning link to `confirmPrior` first (a "yes"), store "no" against `notSameChildIds`. */
  | { kind: 'go'; confirmPrior: RepRosterPlayer | null; notSameChildIds: string[] };

/** The entries this season and the past players a sign-up's name matches (its own child left out). */
function acceptMatches(
  read: Pick<PastPlayersRead, 'past' | 'onWorking'>,
  reg: { childId: string; playerFirstName: string; playerLastName: string | null },
) {
  const sameNameHere = [...read.onWorking.values()].filter(e =>
    e.status !== 'callup' && e.childId !== reg.childId
    && sameName(reg.playerFirstName, reg.playerLastName, e.playerFirstName, e.playerLastName));
  const past = sameNameCandidates(reg.playerFirstName, reg.playerLastName, read.past).filter(p => p.childId !== reg.childId);
  return { sameNameHere, past };
}

/** The children whose stored "no" against the sign-up's child the accept rule needs to know. */
export function acceptLookupIds(
  read: Pick<PastPlayersRead, 'past' | 'onWorking'>,
  reg: { childId: string; playerFirstName: string; playerLastName: string | null },
): string[] {
  const { sameNameHere, past } = acceptMatches(read, reg);
  return [...sameNameHere.map(e => e.childId), ...past.map(p => p.childId)];
}

/**
 * THE ACCEPT RULE (tab 4). A sign-up the head coach already confirmed as a returning player carries that child (S2), so
 * the accept attaches silently. Otherwise: its child already here → refuse; a same-name entry here → refuse with a way
 * through; a same-name past player → ask. Stored "no"s are never asked again.
 */
export function decideAcceptWith(
  read: Pick<PastPlayersRead, 'past' | 'latest' | 'onWorking'>,
  reg: { childId: string; playerFirstName: string; playerLastName: string | null },
  answer: AcceptAnswer,
  /** The stored "no"s between the sign-up's child and the children in `acceptLookupIds`. */
  stored: ReadonlySet<string>,
): AcceptDecision {
  const own = read.onWorking.get(reg.childId);
  if (own) return { kind: 'refuse_same', entry: own };

  const { sameNameHere, past } = acceptMatches(read, reg);

  // "Add anyway" is remembered by the window as a "no" for that entry, so a later request (after the past-player
  // question) skips it too; without that the refusal came straight back.
  const notSame = new Set(answer.notSameChildIds);
  const here = sameNameHere.find(e => !stored.has(e.childId) && !notSame.has(e.childId) && e.childId !== answer.differentFromChildId);
  if (here) return { kind: 'refuse_name', entry: here };

  // A "no" is stored only against children this sign-up's name actually matched — never the child just said yes to, and
  // never an id the window made up (the table has no org column; the pair must be this team's own namesakes).
  const askable = new Set([...past.map(p => p.childId), ...sameNameHere.map(e => e.childId)]);
  const noIds = [...answer.notSameChildIds, ...(answer.differentFromChildId ? [answer.differentFromChildId] : [])]
    .filter(id => askable.has(id) && id !== answer.sameChildId);

  if (answer.sameChildId) {
    const prior = read.latest.get(answer.sameChildId);
    if (prior && past.some(p => p.childId === answer.sameChildId)) {
      return { kind: 'go', confirmPrior: prior, notSameChildIds: noIds };
    }
  }
  const open = past.filter(p => !stored.has(p.childId) && !notSame.has(p.childId));
  if (open.length > 0) return { kind: 'ask', candidate: open[0] };
  return { kind: 'go', confirmPrior: null, notSameChildIds: noIds };
}

