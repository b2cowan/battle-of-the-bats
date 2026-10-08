import { hasCapability, ROLE_DEFAULTS, type Capability } from './roles';
import { volunteerJobOf } from './volunteer-jobs';
import { VOLUNTEER_OPENS } from './volunteer-words';
import { hasModuleEntitlement, planCarriesModule, type EntitlementOrg } from './module-entitlements';
import type { OrgRole } from './types';

/**
 * WHAT A MEMBER CAN OPEN — the one computation (Club Tier Stage 1, plan §4A A13 / J10-024).
 *
 * Two questions decide whether a person can open a program, and every gate in the product asks
 * both: does the PERSON hold it (their role's default, or a per-member override — `hasCapability`)
 * and does the ORG carry it (the plan, a free floor or an add-on, and not cancelled —
 * `hasModuleEntitlement`). `canOpenModule` is that pair, named once. The Members screen's
 * "What they can open" rows are computed from `canOpenModule` too, so a screen and the server can
 * never disagree about the same person (tests/unit/member-access.test.ts proves it across every
 * role × plan × override).
 *
 * Client-safe: no server imports. The server half (which roles an org may hand out, which reads
 * the database) lives in lib/board-roles.ts.
 */

export type MemberAccessInput = {
  role: OrgRole;
  capabilities: Record<string, boolean> | null;
};

/** THE gate. Role default + override, AND the org's plan. Every module gate means exactly this. */
export function canOpenModule(member: MemberAccessInput, org: EntitlementOrg, cap: Capability): boolean {
  return hasCapability(member.role, member.capabilities, cap) && hasModuleEntitlement(org, cap);
}

/**
 * The club ↔ team money loop — allocations to teams, their installments, and coaches' payment
 * requests — is open to someone who can open Rep Teams OR Accounting, on an org that runs rep teams.
 *
 * ⚖ Ruling D8 + Ask 1 (2026-09-25): the treasurer runs the club's books, and "the allocation loop
 * needs" a read of the teams — which means these money records, inside Accounting, without a Rep
 * Teams door. Every route that uses this keeps its OWN role check for writes (who may mark an
 * installment paid, who may approve a request); this decides only who may reach the loop at all.
 * Before it, those routes asked for Rep Teams alone, so their `owner | treasurer` write rules were
 * owner-only in practice (B02, C03).
 */
export function canOpenRepMoney(member: MemberAccessInput, org: EntitlementOrg): boolean {
  if (!hasModuleEntitlement(org, 'module_rep_teams')) return false;
  return canOpenModule(member, org, 'module_rep_teams') || canOpenModule(member, org, 'module_accounting');
}

/**
 * WHO MAY MOVE CLUB MONEY — one rule for every club money write (⚖ Club Tier Stage 3a, Ask 1, owner
 * 2026-09-30): whoever holds the club's ACCOUNTING — the owner, the treasurer, or an admin with
 * Accounting (and anyone the owner has granted Accounting). Record received, confirm a coach's
 * "sent", undo, approve, decline, reverse, send reminders, ledger entries, transfers, payees and a
 * new allocation all ask THIS, never a role list.
 *
 * Before it the writes disagreed (C08): approve = owner/treasurer/admin, mark paid = owner/treasurer,
 * reminders = owner/admin (so the treasurer who runs the loop couldn't send one), and a coach with
 * money access posted straight to the club's General ledger. `canOpenRepMoney` stays the rule for
 * REACHING the allocation loop; this is the rule for moving money in it.
 *
 * ⚠ A coach never passes it: coaching staff hold `role = 'coach'` with no capabilities, and a coach's
 * own money move is "sent", which writes nothing to the club's books.
 */
export function canMoveClubMoney(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return canOpenModule(member, org, 'module_accounting');
}

/** The programs a member can be given, in the order the Members screen lists them (specimen 5). */
export const MEMBER_PROGRAMS: readonly { module: Capability; label: string }[] = [
  { module: 'module_rep_teams', label: 'Rep Teams' },
  { module: 'module_accounting', label: 'Accounting' },
  { module: 'module_families', label: 'Families' },
  { module: 'module_public_site', label: 'Public site' },
  { module: 'module_house_league', label: 'House league' },
  { module: 'module_tournaments', label: 'Tournaments' },
  { module: 'module_members', label: 'Members' },
];

export type ProgramAccess = {
  module: Capability;
  label: string;
  /** Does the member's ROLE open it by default? (The owner opens everything.) */
  roleDefault: boolean;
  /**
   * A per-member change from the role's default — 'on' (granted), 'off' (removed) — or null when
   * the member runs on the default. An override that merely restates the default is not a change.
   * This is the specimen-5 chip ("+ Families", "– Accounting").
   */
  override: 'on' | 'off' | null;
  /** The answer the gate gives — `canOpenModule`, never recomputed. */
  canOpen: boolean;
};

/**
 * "What they can open": one row per program the org's plan CARRIES (a program the plan does not
 * carry is not offered, so it is not listed). On a cancelled org the rows remain and every
 * `canOpen` is false — the plan still carries them; the account is what is closed.
 */
export function whatTheyCanOpen(member: MemberAccessInput, org: EntitlementOrg): ProgramAccess[] {
  return MEMBER_PROGRAMS
    .filter(p => planCarriesModule(org, p.module))
    .map(p => {
      const roleDefault = member.role === 'owner' || ROLE_DEFAULTS[member.role]?.has(p.module) === true;
      const explicit = member.role === 'owner' ? undefined : member.capabilities?.[p.module];
      const override: ProgramAccess['override'] =
        explicit === undefined || explicit === roleDefault ? null : explicit ? 'on' : 'off';
      return { module: p.module, label: p.label, roleDefault, override, canOpen: canOpenModule(member, org, p.module) };
    });
}

/**
 * The sentences a member is emailed when their access changes (J10-020): their new role, and the
 * programs they can now — or can no longer — open. Derived from `whatTheyCanOpen` on both sides, so
 * it names exactly the doors the gates open and close. Empty when nothing they can open changed.
 */
export function describeAccessChange(
  before: MemberAccessInput,
  after: MemberAccessInput,
  org: EntitlementOrg,
): string[] {
  const lines: string[] = [];
  if (before.role !== after.role) {
    lines.push(`Your role is now ${roleLabel(after.role)} (it was ${roleLabel(before.role)}).`);
  }
  const was = new Map(whatTheyCanOpen(before, org).map(r => [r.module, r.canOpen]));
  const now = whatTheyCanOpen(after, org);
  const gained = now.filter(r => r.canOpen && !was.get(r.module)).map(r => r.label);
  const lost = now.filter(r => !r.canOpen && was.get(r.module)).map(r => r.label);
  if (gained.length) lines.push(`You can now open ${listOf(gained)}.`);
  if (lost.length) lines.push(`You can no longer open ${listOf(lost)}.`);
  return lines;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Owner-only powers (J10-022). Plan & billing and organization settings stay with the owner: they
 * are never offered as a grant, and the member PATCH refuses a body that tries to grant one.
 * (The owner short-circuit in `hasCapability` is what gives the owner these; no role default does.)
 */
export const OWNER_ONLY_CAPABILITIES: readonly Capability[] = ['billing', 'org_settings'];

export function isOwnerOnlyCapability(cap: string): boolean {
  return (OWNER_ONLY_CAPABILITIES as readonly string[]).includes(cap);
}

// ─── Roles, as the Members screen and the invitee read them ──────────────────────────────────

/**
 * Which section of the Members screen a row belongs to (specimen 5, Ask 6). The board runs the
 * club; scorekeepers are game-day volunteers; coaching staff are the capability-less plumbing rows
 * every staff invite writes (2026-08-16) and are managed on each team's staff page, never here.
 */
export type MemberSection = 'board' | 'scorekeepers' | 'coaching_staff';

export function memberSection(role: OrgRole | string): MemberSection {
  if (role === 'official') return 'scorekeepers';
  if (role === 'coach') return 'coaching_staff';
  return 'board';
}

/** The role's name as the product shows it (screens, the invitation card, the accept page). */
export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  // "Volunteer" (/marketing 2026-10-07, Stage 6 A26): the role is named for both jobs. "Scorekeeper" and
  // "Gate" are its two JOB names (lib/volunteer-words.ts), never the role's.
  official: 'Volunteer',
  league_admin: 'League admin',
  league_registrar: 'League registrar',
  treasurer: 'Treasurer',
  coach: 'Coach',
};

/**
 * The role as a noun inside an email sentence ("…as a treasurer"). ONE table for the invite, the
 * resend and the added-to-org mails — the resend built its own and called a treasurer a
 * "team treasurer" (J10-005).
 */
export const ROLE_EMAIL_LABEL: Record<OrgRole, string> = {
  owner: 'owner',
  admin: 'administrator',
  staff: 'staff member',
  official: 'volunteer',
  league_admin: 'league administrator',
  league_registrar: 'league registrar',
  treasurer: 'treasurer',
  coach: 'coach',
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as OrgRole] ?? role;
}

export function roleEmailLabel(role: string): string {
  return ROLE_EMAIL_LABEL[role as OrgRole] ?? role;
}

/**
 * What the role opens, said to the person being invited (specimen 6). Words drawn from the ratified
 * hub where it drew them (Treasurer); the rest are placement words for `/marketing` to confirm.
 */
export function roleOpensSentence(role: string): string {
  switch (role) {
    case 'admin':
      return "You'd help run the organization: every program on its plan, but not its billing or settings.";
    case 'treasurer':
      return "You'd run the club's books: ledgers, the budget, and allocations to teams.";
    case 'staff':
      return "You'd help on game day: schedules, scores and check-in.";
    case 'official':
      // Before a job is chosen (the invite's role list). Once it is, `VOLUNTEER_OPENS` says the job.
      return "You'd help on game day from your phone: entering scores, checking teams in at the gate, or both.";
    case 'league_admin':
      return "You'd run the house league: seasons, registrations, teams and schedules.";
    case 'league_registrar':
      return "You'd look after house league registrations.";
    case 'coach':
      return "You'd coach a team in the Coaches Portal.";
    default:
      return '';
  }
}

/**
 * What the role opens for THIS person. A volunteer's job is on their row from the invite on (Stage 6,
 * A26), so the accept page and the invitation card name the job, not the role's either-or.
 */
export function memberOpensSentence(role: string, capabilities: Record<string, boolean> | null | undefined): string {
  if (role === 'official') {
    const job = volunteerJobOf(capabilities);
    if (job) return VOLUNTEER_OPENS[job];
  }
  return roleOpensSentence(role);
}
