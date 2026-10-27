/**
 * Who an email's addresses and askers are, for the Sent emails screens (Support console Stage 5, drawing E3/E4). Server
 * only; the caller has already checked the `sent_log` power.
 *
 * "No account" is decided at READ time against the sign-in lookup, never stored on the email (an invite goes to an address
 * that often has no account yet), by one batch lookup a page. Staff addresses are accounts too, so they never read as "no account".
 */
import { supabaseAdmin } from './supabase-admin';
import type { PlatformRole } from './platform-auth';
import { peopleByIds } from './platform-people-lookup';
import { listSentEmails, orgNameOf, staffEmailList, type OrgEmbed } from './sent-log';
import type { SentState } from './sent-log-words';
import type { SentLogRow } from './sent-log-view';

/** The addresses (lowercased) that belong to an account. Null when the lookup could not be read: the screen then says nothing rather than guess. */
export async function addressesWithAccounts(addresses: readonly string[]): Promise<Set<string> | null> {
  const unique = [...new Set(addresses.map(a => a.trim().toLowerCase()).filter(Boolean))].slice(0, 200);
  if (unique.length === 0) return new Set();
  try {
    // One call a page (migration 389 platform_accounts_for_emails: it answers only which addresses have an account).
    const { data, error } = await supabaseAdmin.rpc('platform_accounts_for_emails', { p_emails: unique });
    if (error) return null;
    return new Set(((data ?? []) as unknown[]).map(e => String(e).toLowerCase()));
  } catch {
    return null;
  }
}

/**
 * "Jamie Rivera, UAT Rep Club": the person whose action sent it and their club, or null when the sender did not know
 * (the product's own sends). A staff member with no display name reads as "FieldLogicHQ staff" to every role but Super
 * admin, so the address of a colleague never reaches a role that may not read staff addresses (T15).
 */
export async function askedByLine(
  role: PlatformRole, askedById: string | null, emailOrg: { id: string | null; name: string | null },
): Promise<{ name: string; club: string | null } | null> {
  if (!askedById) return null;
  try {
    const person = (await peopleByIds([askedById])).get(askedById);
    if (!person) return null;
    let name = person.displayName?.trim() || '';
    if (!name) {
      const staff = (await staffEmailList()).includes(person.email.trim().toLowerCase());
      name = staff && role !== 'super_admin' ? 'FieldLogicHQ staff' : person.email;
    }
    let club = emailOrg.name;
    if (!club) {
      const { data } = await supabaseAdmin.from('organization_members').select('organizations(name)').eq('user_id', askedById).limit(1);
      club = orgNameOf((data?.[0] as { organizations?: OrgEmbed } | undefined)?.organizations);
    }
    return { name, club };
  } catch {
    return null;
  }
}

export const SENT_LOG_PAGE = 50;

/** One page of the Sent emails list with each address marked "no account" or not. The caller has checked `sent_log`. */
export async function listSentLogRows(role: PlatformRole, opts: { to?: string | null; state?: SentState | null; offset?: number }): Promise<{ rows: SentLogRow[]; total: number }> {
  const { rows, total } = await listSentEmails(role, { to: opts.to, state: opts.state, offset: opts.offset, limit: SENT_LOG_PAGE });
  const accounts = await addressesWithAccounts(rows.map(r => r.to));
  return { rows: rows.map(r => ({ ...r, noAccount: accounts ? !accounts.has(r.to) : false })), total };
}
