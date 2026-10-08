/**
 * THE MEMBERS SCREEN'S WORDS FOR ACCESS (Club Tier Stage 1, specimen 5) — computed from the one
 * access computation (`whatTheyCanOpen`, lib/member-access.ts), never typed by hand, so the screen
 * can never tell the owner something the gates do not do.
 *
 *   accessSummary    — the "What they can open" cell ("Every program on the plan", "Accounting · the
 *                      team names it allocates to", "Tournaments on game day").
 *   overrideChips    — one chip per change from the role's defaults: "+ Families", "– Accounting"
 *                      (J10-024 — readable at a glance, without opening every row).
 *   consequence      — the sentence under a program row in Manage when a change would open or close
 *                      it ("Sam will no longer see the club's ledgers, budget or allocations.", J10-023).
 *   roleGuideCell    — the Role Guide matrix, from the role defaults (J10-004 / A13).
 *
 * Client-safe and pure — `tests/unit/member-summary.test.ts` holds it.
 */
// Relative, not `@/`: the unit runner (tests/unit/member-summary.test.ts) imports this file directly.
import { ROLE_DEFAULTS, type Capability } from '../../../../lib/roles';
import type { ProgramAccess } from '../../../../lib/member-access';
import type { OrgRole } from '../../../../lib/types';
import { volunteerJobOf } from '../../../../lib/volunteer-jobs';
import { VOLUNTEER_ACCESS } from '../../../../lib/volunteer-words';

/** The programs that make up "every program on the plan" — Families is an explicit grant for every
 *  role (so it is a chip, never part of a role's default), and Members is the board, not a program. */
const NOT_A_PROGRAM: readonly Capability[] = ['module_families', 'module_members'];

export function accessSummary(role: OrgRole, access: ProgramAccess[], capabilities?: Record<string, boolean> | null): string {
  if (role === 'owner') return 'Everything, including plan & billing';
  // A volunteer's answer is their job (Stage 6, A26) — what "Helping with" left them, not the role's both.
  if (role === 'official') return VOLUNTEER_ACCESS[volunteerJobOf(capabilities) ?? 'none'].long;
  const programs = access.filter(a => !NOT_A_PROGRAM.includes(a.module));
  const defaults = programs.filter(a => a.roleDefault);
  if (programs.length > 0 && defaults.length === programs.length) return 'Every program on the plan';
  const carriesRepTeams = access.some(a => a.module === 'module_rep_teams');
  switch (role) {
    // ⚖ D8 + Ask 1: a treasurer runs the books and reads team names inside Accounting — no Rep Teams door.
    case 'treasurer': return carriesRepTeams ? 'Accounting · the team names it allocates to' : 'Accounting';
    case 'staff': return 'Tournaments on game day';
    case 'league_admin': return 'The house league';
    case 'league_registrar': return 'House league registrations';
    case 'coach': return 'Their team, in the Coaches Portal';
    default:
      return defaults.length > 0 ? defaults.map(a => a.label).join(' · ') : 'Nothing on this plan yet';
  }
}

/** The phone row's second line: the same answer, in a few words. */
export function accessShort(role: OrgRole, access: ProgramAccess[], capabilities?: Record<string, boolean> | null): string {
  if (role === 'official') return VOLUNTEER_ACCESS[volunteerJobOf(capabilities) ?? 'none'].short;
  const long = accessSummary(role, access, capabilities);
  switch (long) {
    case 'Everything, including plan & billing': return 'everything';
    case 'Every program on the plan': return 'every program';
    case 'Tournaments on game day': return 'game day';
    case 'The house league': return 'house league';
    case 'House league registrations': return 'registrations';
    default: return long.split(' · ')[0];
  }
}

export type OverrideChip = { key: string; text: string; tone: 'on' | 'off' };

/** "+ Families" / "– Accounting": each change from the role's default, in the programs' order. */
export function overrideChips(access: ProgramAccess[]): OverrideChip[] {
  return access
    .filter(a => a.override !== null)
    .map(a => ({ key: a.module, text: `${a.override === 'on' ? '+' : '–'} ${a.label}`, tone: a.override as 'on' | 'off' }));
}

/** What losing a program means for the person — the sentence Manage shows before Save (J10-023). */
const LOSES: Partial<Record<Capability, (org: string) => string>> = {
  module_rep_teams: org => `the ${org}’s teams, tryouts, rosters or allocations`,
  module_accounting: org => `the ${org}’s ledgers, budget or allocations`,
  module_families: () => 'any household’s contact details, consent or balances',
  module_public_site: org => `the ${org}’s public page editor`,
  module_house_league: () => 'the house league',
  module_tournaments: () => 'any tournament',
  module_members: () => 'the member list',
};
const GAINS: Partial<Record<Capability, (org: string) => string>> = {
  // Families concentrates every household's personal information (plan §5.3) — say so, every time.
  module_families: () => 'every household’s contact details, consent and balances',
  module_rep_teams: org => `the ${org}’s teams, tryouts, rosters and allocations`,
  module_accounting: org => `the ${org}’s ledgers, budget and allocations`,
  module_public_site: org => `the ${org}’s public page editor`,
  module_house_league: () => 'the house league',
  module_tournaments: () => 'the tournaments',
  module_members: () => 'the member list',
};

/**
 * The sentence under a program row when the draft CHANGES whether the person can open it — and only
 * then (a change that restates what they already have says nothing). `name` is who it is about.
 */
export function consequence(
  module: Capability,
  wasOpen: boolean,
  willOpen: boolean,
  name: string,
  orgNoun: string,
): string | null {
  if (wasOpen === willOpen) return null;
  if (willOpen) {
    const what = GAINS[module]?.(orgNoun);
    return what ? `${name} will see ${what}.` : null;
  }
  const what = LOSES[module]?.(orgNoun);
  return what ? `${name} will no longer see ${what}.` : null;
}

// ─── The Role Guide ─────────────────────────────────────────────────────────────────────────────

export type RoleGuideRow =
  | 'rep-teams'
  | 'accounting'
  | 'public-site'
  | 'league-tournaments'
  | 'families'
  | 'members'
  | 'owner-only';

const has = (role: OrgRole, cap: Capability) => ROLE_DEFAULTS[role]?.has(cap) === true;

/**
 * One cell of "What each role can open" (specimen 5): "✓", "—", or the few words the drawing
 * gives a partial answer ("team names only", "game day", "if you turn it on", "view"). Derived from
 * the role defaults; the words are the drawing's.
 */
export function roleGuideCell(role: OrgRole | 'coach', row: RoleGuideRow): string {
  if (role === 'owner') return '✓';
  if (role === 'coach') {
    if (row === 'rep-teams') return 'their team, in the portal';
    if (row === 'accounting') return 'their team’s money';
    return '—';
  }
  switch (row) {
    case 'rep-teams':
      if (has(role, 'module_rep_teams')) return '✓';
      return role === 'treasurer' ? 'team names only' : '—';
    case 'accounting':
      return has(role, 'module_accounting') ? '✓' : '—';
    case 'public-site':
      return has(role, 'module_public_site') ? '✓' : '—';
    case 'league-tournaments':
      if (has(role, 'module_house_league') && has(role, 'module_tournaments') && has(role, 'create_tournaments')) return '✓';
      if (role === 'staff') return 'game day';
      if (role === 'official') return 'scores & gate';
      if (role === 'league_admin') return 'the house league';
      if (role === 'league_registrar') return 'registrations';
      return '—';
    case 'families':
      // Off for every role by default (Families plan §5.3); the board roles can be given it.
      return role === 'staff' || role === 'official' ? '—' : 'if you turn it on';
    case 'members':
      if (has(role, 'manage_members')) return '✓';
      return has(role, 'module_members') ? 'view' : '—';
    case 'owner-only':
      return '—';
  }
}
