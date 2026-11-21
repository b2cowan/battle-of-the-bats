import { roleLabel, MEMBER_PROGRAMS } from './member-access';
import type { Capability } from './roles';
import { volunteerJobOf, type VolunteerJob } from './volunteer-jobs';
import { HELPING_WITH } from './volunteer-words';

/**
 * THE BOARD'S HISTORY, AS SENTENCES (Club Tier Stage 1, specimen 11): "Invited as Admin",
 * "Role changed: Staff → Admin", "Access changed: Families turned on". Client-safe; the audit route
 * writes the sentence, the screen shows it.
 *
 * The log records what it records today — member changes, nothing wider (specimen 11: no filters,
 * no search, no logins, money or settings; widening what it logs is a separate decision). One widening
 * was ruled: the two-step switches (Board Ready, owner 2026-11-10), because they decide who may sign in. A second:
 * a team's pay link emailed, replaced or stopped (Board Ready P8c, owner 2026-11-19).
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
  // Two-step sign-in (Board Ready, Part 3; owner ruling 2026-11-10: every switch change is a club audit line).
  'two_step_reset',
  'two_step_requirement_on',
  'two_step_requirement_off',
] as const;

/**
 * A team's pay link emailed, replaced or stopped (Board Ready leftover 8 writes them; owner ruling 2026-11-19, P8c:
 * "Owner only, as recommended" — they show on the owner's log, who reads it is unchanged). Not member changes, so a
 * list of their own; the log shows both in ONE list (specimen 11: no filters). Their "To" is the team and its
 * tournament, named by the route at read time (the row holds only ids, never an address).
 */
export const PAY_LINK_AUDIT_ACTIONS = ['pay_link_emailed', 'pay_link_replaced', 'pay_link_stopped'] as const;

/**
 * A family's file opened by the club, and the one export that carries health answers (Board Ready Stage 4 Part 3,
 * rulings 6 and 13). The row holds ids only — the registration and the file's id, or the season — never a file's name or
 * an answer; the route names the child and the season at read time, inside this organization.
 */
export const FILE_OPENED_ACTION = 'club_form_file_opened';
export const HEALTH_EXPORT_ACTION = 'club_form_health_exported';
export const FORM_AUDIT_ACTIONS = [FILE_OPENED_ACTION, HEALTH_EXPORT_ACTION] as const;

export const isFormAuditAction = (action: string): boolean =>
  (FORM_AUDIT_ACTIONS as readonly string[]).includes(action);

/** Everything the owner's log lists (the route's `?scope=members`): the member changes, the pay-link and the form actions. */
export const AUDIT_LOG_ACTIONS = [...MEMBER_AUDIT_ACTIONS, ...PAY_LINK_AUDIT_ACTIONS, ...FORM_AUDIT_ACTIONS] as const;

export const isPayLinkAuditAction = (action: string): boolean =>
  (PAY_LINK_AUDIT_ACTIONS as readonly string[]).includes(action);

/** A pay-link email that went while a stop or replace landed (`linkWorks: false`): its link never worked. */
const DEAD_ON_ARRIVAL = '(stopped at the same moment, so it doesn’t work)';

const PROGRAM_LABEL: Partial<Record<string, string>> = Object.fromEntries(
  MEMBER_PROGRAMS.map(p => [p.module, p.label]),
);
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

/** The two keys a volunteer's job is made of (lib/volunteer-jobs.ts) — the log has no other name for them. */
const VOLUNTEER_JOB_KEYS = new Set(['submit_scores', 'check_in_teams']);

const isVolunteerJob = (v: unknown): v is VolunteerJob =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(HELPING_WITH.option, v);

/**
 * A volunteer's job change in the words Manage used to make it — "Helping with: Both → The gate" — or
 * null when it isn't one: the member is not a volunteer (`role`, written since 2026-10-08), or the change
 * touched more than the two job keys. Without this the two keys have no program label and read as
 * "tournament controls changed", which is not what the organizer did.
 */
function volunteerJobChange(p: Record<string, unknown>): string | null {
  if (p.role !== 'official') return null;
  const b = (p.before as Overrides) ?? {};
  const a = (p.after as Overrides) ?? {};
  const changed = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => b[k] !== a[k]);
  if (changed.length === 0 || changed.some(k => !VOLUNTEER_JOB_KEYS.has(k))) return null;
  const from = volunteerJobOf(b);
  const to = volunteerJobOf(a);
  if (!from || !to || from === to) return null;
  return `${HELPING_WITH.label}: ${HELPING_WITH.option[from]} → ${HELPING_WITH.option[to]}`;
}

export function auditChangeSentence(action: string, payload: Record<string, unknown> | null): string {
  const p = payload ?? {};
  switch (action) {
    case 'member_invited':
      if (typeof p.role !== 'string') return 'Invited';
      // A volunteer's invite carries the job chosen under Helping with (`purpose`, officials only).
      return isVolunteerJob(p.purpose)
        ? `Invited as ${roleLabel(p.role)} — ${HELPING_WITH.label}: ${HELPING_WITH.option[p.purpose]}`
        : `Invited as ${roleLabel(p.role)}`;
    case 'member_removed':
      // A withdrawn invitation (trust close-out 13 and P2b) is not a removal: the person never held the role. One the
      // nightly sweep removed after it ran out (P2c) was withdrawn by nobody, and says so.
      if (p.pendingInvite === true) return p.lapsed === true ? 'Invitation removed after it ran out' : 'Invitation cancelled';
      return 'Removed';
    case 'role_changed':
      return typeof p.before === 'string' && typeof p.after === 'string'
        ? `Role changed: ${roleLabel(p.before)} → ${roleLabel(p.after)}`
        : 'Role changed';
    case 'capabilities_changed': {
      const job = volunteerJobChange(p);
      if (job) return job;
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
      return 'Rep teams groups changed';
    case 'two_step_reset':
      return 'Reset two-step sign-in';
    case 'two_step_requirement_on':
      return p.which === 'coaches' ? 'Two-step sign-in required for coaches' : 'Two-step sign-in required for the board';
    case 'two_step_requirement_off':
      return p.which === 'coaches' ? 'Two-step sign-in no longer required for coaches' : 'Two-step sign-in no longer required for the board';
    case 'pay_link_emailed':
      return p.linkWorks === false ? `Emailed the pay link ${DEAD_ON_ARRIVAL}` : 'Emailed the pay link';
    case 'pay_link_replaced':
      return p.linkWorks === false ? `Sent a new pay link ${DEAD_ON_ARRIVAL}` : 'Sent a new pay link (the old one stopped)';
    case 'pay_link_stopped':
      // `asked: 'send'` = a "Send a new link" whose new link did not go: recorded as what it was.
      return p.asked === 'send' ? 'Stopped the pay link (the new one didn’t go out)' : 'Stopped the pay link';
    case FILE_OPENED_ACTION:
      return 'Opened a file a family attached';
    case HEALTH_EXPORT_ACTION:
      return 'Exported registrations with health answers';
    default:
      return action;
  }
}
