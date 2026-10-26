import { joinWithAnd as nameList, possessive } from './utils';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TEAMS & DRAFT, IN ITS OWN WORDS (Club Tier Stage 9c; docs/projects/active/HOUSE_LEAGUE_STAGE9C_COPY.md).
 *
 * Every string a 9c screen, route or email shows, as functions of their facts. Keys follow the copy's (`teams.state.*` →
 * `TEAMS_STATE`, `draft.err.*` → `draftRefusal`). Staff counts say "players"; families read "child" (copy §0). No "the"
 * before a team name in a template (copy §15, owner 2026-10-25). Client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const players = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`;
export const families = (n: number) => `${n} ${n === 1 ? 'family' : 'families'}`;
export const emails = (n: number) => `${n} ${n === 1 ? 'email' : 'emails'}`;

/** "Nora", "Nora and Jaya", "Nora, Jaya and Liam"; a fourth and on are counted ("…, Liam and 2 more"). */
export function namesCapped(names: readonly string[], cap = 3): string {
  if (names.length <= cap) return nameList(names);
  return `${names.slice(0, cap).join(', ')} and ${names.length - cap} more`;
}

/** "Coach Pat Volunteer" / "Coaches Pat Volunteer and Sam Lee" (copy §1.4 teams.card.coach). */
export function coachesLine(names: readonly string[]): string {
  if (names.length === 0) return '';
  return `${names.length === 1 ? 'Coach' : 'Coaches'} ${nameList(names)}`;
}

/** A family's name in a result line: "the Macdonald family", or "the family of Avery Macdonald" (copy §7.2). */
export function familyName(guardianLastName: string, childName: string): string {
  const last = guardianLastName.trim();
  return last ? `the ${last} family` : `the family of ${childName}`;
}

// ── 1.2 The division's state ──────────────────────────────────────────────────────────────────

export type DivisionState = 'noTeams' | 'notDrafted' | 'drafted' | 'published';

export function divisionState(d: { teams: number; placed: number; publishedAt: string | null }): DivisionState {
  if (d.publishedAt) return 'published';
  if (d.teams === 0) return 'noTeams';
  return d.placed > 0 ? 'drafted' : 'notDrafted';
}

export function stateWords(state: DivisionState, f: { day: string; familyCount: number }): { pill: string; says: string } {
  switch (state) {
    case 'noTeams': return { pill: 'No teams', says: 'Make the teams first.' };
    case 'notDrafted': return { pill: 'Not drafted', says: 'Run the draft, or drag players onto teams. Nothing is sent until you publish.' };
    case 'drafted': return { pill: 'Drafted · not published', says: `Publish tells ${families(f.familyCount)} their child’s team.` };
    case 'published': return { pill: `Published ${f.day}`, says: `Families were told on ${f.day}. A move now emails that family.` };
  }
}

// ── 4.3 Draft refusals ────────────────────────────────────────────────────────────────────────

export type DraftRefusalCode = 'tooFew' | 'noTeams' | 'noPlayers' | 'lockedFull' | 'changed' | 'published';

export function draftRefusal(code: DraftRefusalCode, f: { division: string; players?: number; teams?: number }): string {
  switch (code) {
    case 'tooFew':
      return `${f.division} has ${players(f.players ?? 0)} and ${f.teams ?? 0} teams, so one team would have nobody. Remove a team, or wait for more players to be accepted.`;
    case 'noTeams': return 'Make the teams first.';
    case 'noPlayers': return 'No players to draft yet.';
    case 'lockedFull': return 'Every player is locked, so there is nothing to deal. Unlock some, or publish as it is.';
    case 'changed': return `${f.division} changed while this window was open. Close it and look again.`;
    case 'published': return `${f.division} is published, so it can’t be drafted again. Move players one at a time; each family is told.`;
  }
}

// ── 6 Moving a player, and its refusals ───────────────────────────────────────────────────────

/** Said when a move can't land. `published` never reaches a person: the screen asks first (copy §6.2). */
export function placeRefusal(code: 'not_accepted' | 'no_division' | 'team' | 'published' | 'finished', name: string, division: string): string {
  switch (code) {
    case 'not_accepted': return `${name} isn’t accepted, so they can’t be on a team.`;
    case 'no_division': return `${name} isn’t in a division yet.`;
    case 'team': return `That team isn’t in ${division}.`;
    case 'published': return `${division} is published. Moving ${name} emails their family.`;
    case 'finished': return 'This season is finished. Reopen it to change it.';
  }
}

export const lockWords = {
  menu: 'Lock to this team',
  menuOff: 'Unlock',
  badge: 'Locked',
  hint: 'A locked player stays on this team when you run the draft, and their rating counts toward the team’s average.',
  noTeam: (first: string) => `Put ${first} on a team first, then lock them there.`,
} as const;

// ── 7.3 Publish refusals ──────────────────────────────────────────────────────────────────────

export function publishRefusal(
  code: 'notReady' | 'changed' | 'already',
  f: { division: string; by?: string | null; at?: string | null },
): string {
  switch (code) {
    case 'notReady': return 'Put players on teams first.';
    case 'changed': return `${f.division} changed while this window was open. Close it and look again.`;
    case 'already':
      // A clock time ends in its own period ("8:14 p.m."), so the sentence does not add a second one.
      return `${f.by ?? 'Someone'} published ${f.division}${f.at ? ` at ${f.at}` : ''}${f.at?.endsWith('.') ? '' : '.'} Nothing more was sent.`;
  }
}

// ── 9 Emails ──────────────────────────────────────────────────────────────────────────────────

/** A team's coaches in a family sentence: "coach Pat Volunteer", "coaches Pat Volunteer and Sam Lee", or "coach to be announced". */
export function familyCoachClause(names: readonly string[]): string {
  if (names.length === 0) return 'coach to be announced';
  return `${names.length === 1 ? 'coach' : 'coaches'} ${nameList(names)}`;
}

export const placedMail = {
  subject: (season: string) => `The teams are set — ${season}`,
  heading: 'The teams are set',
  lead: (division: string, season: string) => `The ${division} teams for ${season} are set.`,
  next: (anyCoach: boolean, manyTeams: boolean) =>
    !anyCoach ? null : manyTeams ? 'Each coach will be in touch about getting started.' : 'The coach will be in touch about getting started.',
  button: 'See your registration',
} as const;

export const movedMail = {
  subject: (first: string, season: string) => `${possessive(first)} new team — ${season}`,
  heading: (first: string) => `A new team for ${first}`,
  lead: (child: string, from: string, to: string, division: string) => `${child} has moved from ${from} to ${to} in ${division}.`,
  coach: (names: readonly string[]) => (names.length === 0 ? 'Coach to be announced.' : `${names.length === 1 ? 'Coach' : 'Coaches'}: ${nameList(names)}`),
  button: 'See your registration',
} as const;

export const coachInviteMail = {
  subject: (team: string, season: string) => `You’re coaching ${team} — ${season}`,
  heading: (club: string, team: string) => `${club} added you as a coach of ${team}`,
  line: (count: number, division: string, club: string) =>
    `Your team page lists your ${players(count)} in ${division} and how to reach their families. The season’s schedule is on ${possessive(club)} site.`,
  button: 'Accept and open your team',
  foot: (email: string) =>
    `This link works for 7 days and signs in with ${email}. If you don’t have a FieldLogicHQ account, you’ll set one up first. If you weren’t expecting this, you can safely ignore this email.`,
} as const;
