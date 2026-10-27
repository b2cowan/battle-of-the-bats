/**
 * Who an error sample hit — the five honest states and the rule that picks one (Support console Stage 5, Part 5; owner Q4,
 * threat T26). PURE: no database, no session, safe to import from the browser's table and from the unit test. The server
 * half that reads the accounts is `sample-people.ts`.
 *
 *   person   a customer account that still exists, a link to its record (when the viewer's role opens people)
 *   staff    a staff account and the viewer is not a super admin: "A staff account", no link, no name, no address
 *   gone     a user id with no account behind it any more: the stored address as plain text, no link
 *   text     only an address was stored (no account number): that address, plain text
 *   nobody   no user id and no address: a public page, or a browser error before sign-in
 *   unread   the sign-in records could not be read: a fixed sentence, never a guess (and never a link)
 */
import type { PlatformRole } from '../platform-auth';
import type { PlatformPerson } from '../platform-people-lookup';

export type SampleWho =
  | { kind: 'person'; name: string; email: string; role: string | null; href: string | null }
  | { kind: 'staff' }
  | { kind: 'gone'; email: string | null }
  | { kind: 'text'; email: string; role: string | null }
  | { kind: 'nobody' }
  | { kind: 'unread' };

export type SampleClub = { name: string; href: string | null } | null;

export interface SampleSubjectRow {
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  org_id: string | null;
  org_slug: string | null;
}

/** The person record's address, the only place it is built. */
export const personHref = (id: string) => `/platform-admin/customer-users/${id}`;
export const clubHref = (id: string) => `/platform-admin/orgs/${id}`;

/** Decide one sample's `who` from facts already read. Pure, so every state is unit-tested without a database. */
export function decideWho(
  row: Pick<SampleSubjectRow, 'user_id' | 'user_email' | 'user_role'>,
  person: Pick<PlatformPerson, 'email' | 'displayName' | 'id'> | undefined,
  viewer: { role: PlatformRole; mayOpenPeople: boolean },
  staffEmails: ReadonlySet<string>,
  lookupFailed = false,
): SampleWho {
  const stored = row.user_email?.trim() || null;
  if (!row.user_id && !stored) return { kind: 'nobody' };
  if (lookupFailed && row.user_id) return { kind: 'unread' };

  const isStaff = (email: string | null | undefined) => !!email && staffEmails.has(email.toLowerCase());
  const mayOpenStaff = viewer.role === 'super_admin';

  if (row.user_id) {
    if (!person) return isStaff(stored) && !mayOpenStaff ? { kind: 'staff' } : { kind: 'gone', email: stored };
    if (isStaff(person.email) && !mayOpenStaff) return { kind: 'staff' };
    return {
      kind: 'person',
      name: person.displayName?.trim() || person.email,
      email: person.email,
      role: row.user_role,
      href: viewer.mayOpenPeople ? personHref(person.id) : null,
    };
  }
  // Only an address was stored (no account number): plain text, unless it is a staff address.
  if (isStaff(stored) && !mayOpenStaff) return { kind: 'staff' };
  return { kind: 'text', email: stored!, role: row.user_role };
}

