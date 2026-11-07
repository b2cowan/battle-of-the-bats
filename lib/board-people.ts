import { LEAGUE_RUNNER_ROLES } from './house-league-access';
import { ROLE_LABEL } from './member-access';
import type { OrgRole } from './types';

/**
 * THE BOARD BY NAME — the client-safe half (Club Tier Stage 13a). The server read is `boardNames` (lib/member-names.ts,
 * served by GET /api/admin/board); these are the sentences every screen builds from it, so a name is said one way.
 *
 * ⚖ NAMES ONLY (owner 2026-11-06, ALSO row R1): a person and their role, never an email or a phone number.
 */

/** The roles that sit on a club's board. Coaches, staff and volunteers are not "who runs the club". */
export const BOARD_ROLES = ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer'] as const satisfies readonly OrgRole[];

export type BoardPerson = { name: string; role: OrgRole };

/** The role as a lowercase noun inside a sentence: "owner", "league admin". */
function roleNoun(role: OrgRole | string): string {
  return (ROLE_LABEL[role as OrgRole] ?? role).toLowerCase();
}

/** "a treasurer", "an admin", "a league registrar". */
export function roleWithArticle(role: OrgRole | string): string {
  const noun = roleNoun(role);
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;
}

/** The club's owner by name (the earliest owner the read returned), or null when no owner has a name. */
export function boardOwnerName(people: readonly BoardPerson[] | null | undefined): string | null {
  return people?.find(p => p.role === 'owner')?.name ?? null;
}

/** BOARD_ROLES is already in rank order; a role outside it sorts last. */
function boardRank(role: OrgRole): number {
  const i = (BOARD_ROLES as readonly OrgRole[]).indexOf(role);
  return i < 0 ? BOARD_ROLES.length : i;
}

/** The board tile's line: "Morgan Ellis (owner), Dana Kowalski (admin), Jules Moreau (league admin)". */
export function boardLine(people: readonly BoardPerson[]): string {
  return [...people].sort((a, b) => boardRank(a.role) - boardRank(b.role))
    .map(p => `${p.name} (${roleNoun(p.role)})`).join(', ');
}

/** "A", "A or B", "A, B or C". */
function orList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** The people who start a house-league season (LEAGUE_RUNNER_ROLES), the league admin first: it is their job. */
const STARTER_ORDER: readonly OrgRole[] = ['league_admin', 'owner', 'admin'];
function seasonStarters(people: readonly BoardPerson[]): BoardPerson[] {
  return people.filter(p => LEAGUE_RUNNER_ROLES.includes(p.role))
    .sort((a, b) => STARTER_ORDER.indexOf(a.role) - STARTER_ORDER.indexOf(b.role));
}

/** At most this many names in a sentence; a club can have many admins (Ask 6: never a list of every admin). */
const MAX_NAMED = 3;

/**
 * The Seasons page's empty state for someone who cannot start a season (A4, F-R1-2): who does, by name, and what
 * happens next. "Jules Moreau (league admin) or Morgan Ellis (owner) creates the season. Registrations arrive here once it
 * exists." With no names: the roles alone.
 */
export function seasonCreatorsSentence(people: readonly BoardPerson[] | null | undefined): string {
  const named = seasonStarters(people ?? []).slice(0, MAX_NAMED).map(p => `${p.name} (${roleNoun(p.role)})`);
  const who = named.length ? orList(named) : 'The club’s owner, an admin or a league admin';
  return `${who} creates the season. Registrations arrive here once it exists.`;
}

/** The Overview's quiet row, shorter (A5): "Jules Moreau or Morgan Ellis starts one". */
export function seasonStarterShort(people: readonly BoardPerson[] | null | undefined): string {
  const named = seasonStarters(people ?? []).slice(0, 2).map(p => p.name);
  return `${named.length ? orList(named) : 'The owner or an admin'} starts one`;
}
