import { roleLabel, MEMBER_PROGRAMS } from './member-access';
import type { Capability } from './roles';

/**
 * THE BOARD'S HISTORY, AS SENTENCES (Club Tier Stage 1, specimen 11): "Invited as Admin",
 * "Role changed: Staff → Admin", "Access changed: Families turned on". Client-safe; the audit route
 * writes the sentence, the screen shows it.
 *
 * The log records what it records today — member changes, nothing wider (specimen 11: no filters,
 * no search, no logins, money or settings; widening what it logs is a separate decision).
 */

/** The member changes the board's log shows (the route's `?scope=members`). */
export const MEMBER_AUDIT_ACTIONS = [
  'member_invited',
  'member_removed',
  'role_changed',
  'capabilities_changed',
  'member_suspended',
  'member_reinstated',
  'rep_group_scope_changed',
] as const;

const PROGRAM_LABEL: Partial<Record<string, string>> = Object.fromEntries(
  MEMBER_PROGRAMS.map(p => [p.module, p.label]),
);
// Communications is a module switch the Members screen folds under Tournaments.
PROGRAM_LABEL.module_communications = 'Communications';
// The one non-tournament power Manage offers (it folds under Members) — named, never lumped in with
// "tournament controls" (/review 2026-09-26).
PROGRAM_LABEL.manage_members = 'Managing members';

type Overrides = Record<string, boolean> | null | undefined;

/**
 * What an override change DID, program by program: "Families turned on", "Accounting turned off",
 * "Rep Teams back to the role's default". The tournament fine-grained controls are one phrase —
 * they fold under Tournaments on the screen, and the log follows the screen.
 */
export function describeOverrideChange(before: Overrides, after: Overrides): string[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const phrases: string[] = [];
  let tournamentControls = false;
  // Programs in the Members screen's order, then anything else.
  const order = (k: string) => {
    const i = MEMBER_PROGRAMS.findIndex(p => p.module === k);
    return i === -1 ? 99 : i;
  };
  for (const key of keys.sort((x, y) => order(x) - order(y))) {
    if (b[key] === a[key]) continue;
    const label = PROGRAM_LABEL[key as Capability];
    if (!label) { tournamentControls = true; continue; }
    if (a[key] === true) phrases.push(`${label} turned on`);
    else if (a[key] === false) phrases.push(`${label} turned off`);
    else phrases.push(`${label} back to the role’s default`);
  }
  if (tournamentControls) phrases.push('tournament controls changed');
  return phrases;
}

export function auditChangeSentence(action: string, payload: Record<string, unknown> | null): string {
  const p = payload ?? {};
  switch (action) {
    case 'member_invited':
      return typeof p.role === 'string' ? `Invited as ${roleLabel(p.role)}` : 'Invited';
    case 'member_removed':
      return 'Removed';
    case 'role_changed':
      return typeof p.before === 'string' && typeof p.after === 'string'
        ? `Role changed: ${roleLabel(p.before)} → ${roleLabel(p.after)}`
        : 'Role changed';
    case 'capabilities_changed': {
      const phrases = describeOverrideChange(p.before as Overrides, p.after as Overrides);
      if (phrases.length === 0) return 'Access changed';
      const first = phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1);
      return `Access changed: ${[first, ...phrases.slice(1)].join(', ')}`;
    }
    case 'member_suspended':
      return 'Suspended';
    case 'member_reinstated':
      return 'Reinstated';
    case 'rep_group_scope_changed':
      return 'Rep Teams groups changed';
    default:
      return action;
  }
}
