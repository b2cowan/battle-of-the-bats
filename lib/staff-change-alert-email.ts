import { warmEmailButton, warmEmailDocument, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { consoleClock } from './console-dates';
import { formatStoredDate } from './timezone';
import { pluralize } from './utils';

/**
 * THE OWNER'S EMAIL after a change that asked for the password again (Stage 0, Part 10, tab 5; Ask 8): the words, pure,
 * so they are tested without sending anything (the sender is `lib/staff-change-alert.ts`). It names the person by their
 * sign-in address, never "You": Billing and Product staff run bulk changes too. It says what actually happened, a
 * partial result too, on the warm envelope, light only.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type Common = {
  /** The staff member's sign-in address. */
  actor: string;
  /** When the change ran, and when this session last proved the password (ISO). */
  at: string;
  passwordAt: string;
  reason: string | null;
};

export type BulkChangeAlert = Common & {
  kind: 'bulk';
  bulkOperationId: string;
  /** The accounts the run was asked to change. */
  accounts: number;
  action:
    | { type: 'subscription_status_override'; status: string; lastDay: string | null }
    | { type: 'plan_change'; plan: string }
    | { type: 'module_addon_enablement'; feature: string; on: boolean };
  changed: number;
  /** Extra feature only: already as asked, so untouched. */
  already: number;
  failed: number;
  /** Skipped on purpose, by why (the run's own result lines). */
  /** `waiting`: a cancel or a move to the free plan waits for its date (Plans end at renewal, Stage 2 Part C). */
  skipped: { portals: number; billed: number; ownClubs: number; waiting?: number };
  /** A plan change's side effects, counted ("Also: 1 Club trial started · …"). */
  also: { clubTrials: number; compsEnded: number; archived: number; archivedAccounts: number };
};

export type PriceSwitchAlert = Common & {
  kind: 'price';
  changeRequestId: string;
  /** "Club annual". */
  slot: string;
  /** Null when the request clears the slot: new customers then cannot buy it until a price is set. */
  newPriceId: string | null;
  /** "$660.00 a year" when Stripe was read; left out, never guessed. */
  newAmount: string | null;
  oldPriceId: string | null;
};

export type StaffChangeAlert = BulkChangeAlert | PriceSwitchAlert;

/** The audit row each kind of change writes: the email's button opens it, and "Owner email: not sent" names it. */
export const STAFF_CHANGE_AUDIT_ACTION = { bulk: 'run_bulk_operation', price: 'update_stripe_price_id' } as const;

/** What a staff member typed (a reason, a label), made safe for the body. */
const esc = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** "Nov 2", the Eastern day. The email goes as the change runs, so its year is always this one. */
const shortDay = (iso: string) => formatStoredDate(iso, { withYear: false });

function alsoLine({ clubTrials, compsEnded, archived, archivedAccounts }: BulkChangeAlert['also']): string | null {
  const parts = [
    clubTrials ? `${pluralize(clubTrials, 'Club trial')} started` : null,
    compsEnded ? `${pluralize(compsEnded, 'Founding Season comp')} ended` : null,
    archived ? `${pluralize(archived, 'tournament')} over the new limit archived across ${pluralize(archivedAccounts, 'account')}` : null,
  ].filter(Boolean);
  return parts.length ? `Also: ${parts.join(' · ')}` : null;
}

function bulkResultLine(a: BulkChangeAlert): string {
  const parts: string[] = [];
  if (a.action.type === 'module_addon_enablement') {
    const did = a.action.on ? 'turned on' : 'removed';
    parts.push(`${a.changed} ${did}`);
    if (a.already) parts.push(`${a.already} already ${did}`);
  } else {
    parts.push(`${a.changed} changed`);
  }
  const why: string[] = [];
  if (a.skipped.portals) why.push(a.skipped.portals === 1 ? 'a Coaches Portal' : 'Coaches Portals');
  if (a.skipped.billed) why.push('Stripe still bills them');
  if (a.skipped.ownClubs) why.push(`clubs ${a.actor} belongs to`);
  if (a.skipped.waiting) why.push('a cancel or move waits for its date');
  const skipped = a.skipped.portals + a.skipped.billed + a.skipped.ownClubs + (a.skipped.waiting ?? 0);
  if (skipped) parts.push(`${skipped} skipped (${why.join('; ')})`);
  if (a.failed) parts.push(`${a.failed} failed`);
  return `Result: ${parts.join(', ')}`;
}

/** The subject and the body, as drawn (tab 5). */
export function staffChangeAlertEmail(a: StaffChangeAlert): { subject: string; html: string } {
  const when = `at ${consoleClock(a.at)} Eastern on ${shortDay(a.at)}`;
  const lines: string[] = [];
  let subject: string;
  let wayBack: string;
  let stripeLine: string | null = null;

  if (a.kind === 'bulk') {
    wayBack = 'Each account can be put back from its own record.';
    const accounts = pluralize(a.accounts, 'account');
    const act = a.action;
    if (act.type === 'subscription_status_override') {
      // The subject counts what changed, not what was asked: "35 accounts now read" is true of every one it counts.
      subject = `Bulk change: ${pluralize(a.changed, 'account')} now ${a.changed === 1 ? 'reads' : 'read'} ${act.status}${act.lastDay ? ` through ${formatStoredDate(act.lastDay, { withYear: act.lastDay.slice(0, 4) !== a.at.slice(0, 4) })}` : ' with no end date'}`;
      const through = act.lastDay ? ` through ${formatStoredDate(act.lastDay)}` : ' with no end date';
      lines.push(`${esc(a.actor)} set the billing status of ${accounts} to ${esc(act.status)}${through}, ${when}.`);
    } else if (act.type === 'plan_change') {
      subject = `Bulk change: ${pluralize(a.changed, 'account')} moved to ${act.plan}`;
      lines.push(`${esc(a.actor)} moved ${accounts} to ${esc(act.plan)} ${when}.`);
    } else {
      subject = act.on
        ? `Bulk change: ${act.feature} turned on for ${accounts}`
        : `Bulk change: ${act.feature} removed from ${accounts}`;
      lines.push(act.on
        ? `${esc(a.actor)} turned on ${esc(act.feature)} as an extra feature for ${accounts} ${when}.`
        : `${esc(a.actor)} removed ${esc(act.feature)} as an extra feature from ${accounts} ${when}.`);
    }
    lines.push(esc(bulkResultLine(a)));
    const also = alsoLine(a.also);
    if (also) lines.push(also);
    if (act.type === 'subscription_status_override') stripeLine = 'Their real billing in Stripe is unchanged.';
    if (act.type === 'plan_change') stripeLine = 'Nothing in Stripe was changed.';
  } else {
    wayBack = 'Switching back is a new request with the old price.';
    subject = `Production price ${a.newPriceId ? 'switched' : 'cleared'}: ${a.slot}`;
    lines.push(a.newPriceId
      ? `${esc(a.actor)} switched the Production ${esc(a.slot)} price ${when}. New customers are charged ${esc(a.newPriceId)}${a.newAmount ? ` (${esc(a.newAmount)})` : ''} from now on.`
      : `${esc(a.actor)} cleared the Production ${esc(a.slot)} price ${when}. New customers cannot buy it until a price is set.`);
    lines.push(`Before: ${esc(a.oldPriceId ?? 'no price')}`);
    lines.push('Customers on the old price keep it.');
  }
  lines.push(`Reason: ${esc(a.reason ?? 'Not recorded')}`);
  lines.push(`Password last entered at ${consoleClock(a.passwordAt)}.`);
  if (stripeLine) lines.push(stripeLine);

  const html = warmEmailDocument([
    ...lines.map(warmEmailParagraph),
    warmEmailParagraph(`If you did not expect this, open the audit log now. ${wayBack}`),
    warmEmailButton('Open the audit log', `${SITE_URL}/platform-admin/audit?action=${STAFF_CHANGE_AUDIT_ACTION[a.kind]}`),
    warmEmailSmall('Sent to the owner after every bulk change and Production price switch.'),
  ].join('\n'));
  return { subject, html };
}
