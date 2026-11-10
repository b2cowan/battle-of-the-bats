// House League team-change emails (TC·1 to TC·8, HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PLAN.md).
//
// After a division is published a move emails nobody. Which families still need telling is DERIVED from the children, never
// queued: each accepted child remembers the team their family was last told (`told_team_id`, written only by Publish and
// the Send / Don't email transaction). This module is that rule and nothing else (no server import, no database), so it is
// tested on its own and the screen and the sender read the same answer.
//
//   untold  = accepted, on a team, and the team differs from the told team.
//             told team null  -> "placed" (new);  otherwise -> "moved" (from the told team).
//   quiet   = a family none of whose children is untold, but one moved since they were told (moved and moved back).
//   noEmail = an untold child with no family address: nobody to write to.
//   family  = the first parent's address, lower-cased and trimmed, the same grouping Publish uses (a second parent's address
//             is never used here; the second parents' copies are made at send time).
//
// The SQL function league_division_tell_changes recomputes the same untold set under lock and refuses a stale list, so a
// change here must be matched there (and in lib/house-league-teams.ts's board read, which uses this file).
import { householdKey } from './house-league-board-pool';


export type ChangeChild = {
  id: string;
  firstName: string;
  lastName: string;
  guardianEmail: string | null;
  /** The team the child stands on now; null = not on a team (never untold, never emailed: TC·5). */
  teamId: string | null;
  /** The team their family was last told; null = never told. */
  toldTeamId: string | null;
  toldAt: string | null;
  teamChangedAt: string | null;
};

export type ChangedChild = {
  id: string;
  name: string;
  kind: 'placed' | 'moved';
  fromTeamId: string | null;
  toTeamId: string;
};

export type ChangeFamily = {
  /** Lower-cased, trimmed first-parent address: the family's key. */
  email: string;
  /** The first changed child's last name, for "the {family} family". */
  lastName: string;
  children: ChangedChild[];
};

export type QuietFamily = {
  email: string;
  lastName: string;
  /** The children who moved and are back where they were told: name and the team they stand on. */
  children: { id: string; name: string; teamId: string }[];
};

export type TeamChanges = {
  families: ChangeFamily[];
  quiet: QuietFamily[];
  /** Untold children with no address on file. */
  noEmail: { id: string; name: string; kind: 'placed' | 'moved'; toTeamId: string }[];
};

export const familyKey = (email: string | null | undefined): string => householdKey(email) ?? '';

const childName = (c: Pick<ChangeChild, 'firstName' | 'lastName'>): string =>
  `${c.firstName} ${c.lastName}`.replace(/\s+/g, ' ').trim();

const byName = (a: ChangeChild, b: ChangeChild): number =>
  a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName) || a.id.localeCompare(b.id);

const time = (iso: string | null): number => {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NaN : t;
};

/** Is this child untold (on a team their family was not last told)? The board's chip and the count both read this. */
export function isUntold(c: Pick<ChangeChild, 'teamId' | 'toldTeamId'>): boolean {
  return c.teamId !== null && c.teamId !== c.toldTeamId;
}

/** Moved since they were told, but standing on the team they were told: nothing to send. */
function movedAndBack(c: ChangeChild): boolean {
  if (c.teamId === null || c.teamId !== c.toldTeamId) return false;
  const changed = time(c.teamChangedAt);
  const told = time(c.toldAt);
  return !Number.isNaN(changed) && !Number.isNaN(told) && changed > told;
}

/**
 * The division's accepted children in, the families to email out. Pass only the division's ACCEPTED children (the caller
 * filters); a division that is not published has nothing to tell and the caller does not ask.
 */
export function teamChanges(children: ChangeChild[]): TeamChanges {
  const sorted = [...children].sort(byName);
  const byFamily = new Map<string, ChangeChild[]>();
  const noEmail: TeamChanges['noEmail'] = [];

  for (const c of sorted) {
    const key = familyKey(c.guardianEmail);
    if (key === '') {
      if (isUntold(c)) {
        noEmail.push({
          id: c.id,
          name: childName(c),
          kind: c.toldTeamId === null ? 'placed' : 'moved',
          toTeamId: c.teamId as string,
        });
      }
      continue;
    }
    const list = byFamily.get(key);
    if (list) list.push(c);
    else byFamily.set(key, [c]);
  }

  const families: ChangeFamily[] = [];
  const quiet: QuietFamily[] = [];
  for (const [email, kids] of byFamily) {
    const untold = kids.filter(isUntold);
    if (untold.length > 0) {
      families.push({
        email,
        lastName: untold[0].lastName,
        children: untold.map((c) => ({
          id: c.id,
          name: childName(c),
          kind: c.toldTeamId === null ? 'placed' : 'moved',
          fromTeamId: c.toldTeamId,
          toTeamId: c.teamId as string,
        })),
      });
      continue;
    }
    const back = kids.filter(movedAndBack);
    if (back.length > 0) {
      quiet.push({
        email,
        lastName: back[0].lastName,
        children: back.map((c) => ({ id: c.id, name: childName(c), teamId: c.teamId as string })),
      });
    }
  }

  const order = (a: { lastName: string; email: string }, b: { lastName: string; email: string }) =>
    a.lastName.localeCompare(b.lastName) || a.email.localeCompare(b.email);
  families.sort(order);
  quiet.sort(order);
  return { families, quiet, noEmail };
}
