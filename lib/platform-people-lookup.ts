/**
 * The support console's reads over sign-in records (Support console Stage 2, migration 365).
 *
 * ⚖ WHY THIS EXISTS. The sign-in service's admin API lists accounts one page at a time with no filter, so every console
 * screen read "the first 1,000" (`listUsers({ page: 1, perPage: 1000 })`) and silently stopped there: Customer users, the
 * clubs list's owner sign-ins, Overview's owner-inactive count and the Founding Season desk. These four calls go through
 * read-only database functions instead, which search and page inside the database, with no cap.
 *
 * ⚠ SERVER ONLY. The functions are SECURITY DEFINER over `auth.users` and are callable by the service role alone (the
 * migration revokes them from PUBLIC, anon and authenticated; `tests/unit/support-console-lookup-guard.test.ts`). Never
 * import this from a client component, and never hand its rows to a page a customer can reach.
 *
 * Every person row carries exactly the listed columns — id, email, name, last sign-in, created, banned-until,
 * email-confirmed-at — and staff accounts are left out of every search (platform_users in SQL, the bootstrap emails here).
 */
import { supabaseAdmin } from './supabase-admin';
import { getBootstrapAdminEmails } from './platform-auth';
import { DEMO_ORG_SLUGS } from './demo-org';

export type PlatformPerson = {
  id: string;
  email: string;
  displayName: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
  bannedUntil: string | null;
  emailConfirmedAt: string | null;
};

export type PersonAuthStatus = 'active' | 'unconfirmed' | 'banned';

export type FoundClub = {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
  subscriptionStatus: string | null;
  accountKind: string | null;
  ownAddress: string | null;
  ownerEmail: string | null;
};

type PersonRow = {
  id: string;
  email: string;
  display_name: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  total_count?: number | string | null;
};

/** The sign-in service's own refusal of the lookup, mapped to one fixed sentence by every caller that shows it. */
export class PeopleLookupError extends Error {
  constructor() {
    super('The sign-in records could not be read.');
    this.name = 'PeopleLookupError';
  }
}

function toPerson(row: PersonRow): PlatformPerson {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    lastSignInAt: row.last_sign_in_at,
    createdAt: row.created_at,
    bannedUntil: row.banned_until,
    emailConfirmedAt: row.email_confirmed_at,
  };
}

/** Active, unconfirmed or banned — the People list's filter and its chip. A ban outranks an unconfirmed email. */
export function personAuthStatus(person: Pick<PlatformPerson, 'bannedUntil' | 'emailConfirmedAt'>, now = Date.now()): PersonAuthStatus {
  if (person.bannedUntil && new Date(person.bannedUntil).getTime() > now) return 'banned';
  if (!person.emailConfirmedAt) return 'unconfirmed';
  return 'active';
}

function staffExclusions(): string[] {
  return getBootstrapAdminEmails();
}

function totalOf(rows: PersonRow[]): number {
  return rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0;
}

/**
 * The People list: every customer account, best match first, paged on the server. An empty query lists everyone in
 * email order. `matchClubs` also finds a person through the name or web name of a club they belong to.
 */
export async function searchPeople(opts: {
  query: string;
  status?: PersonAuthStatus | null;
  offset: number;
  limit: number;
  matchClubs?: boolean;
}): Promise<{ rows: PlatformPerson[]; total: number }> {
  const { data, error } = await supabaseAdmin.rpc('platform_people_search', {
    p_query: opts.query,
    p_status: opts.status ?? null,
    p_exclude_emails: staffExclusions(),
    p_clubs: opts.matchClubs ?? false,
    p_offset: opts.offset,
    p_limit: opts.limit,
  });
  if (error) throw new PeopleLookupError();
  const rows = (data ?? []) as PersonRow[];
  if (rows.length === 0 && opts.offset > 0) {
    // A page past the end still needs the total for the pager.
    const first = await searchPeople({ ...opts, offset: 0, limit: 1 });
    return { rows: [], total: first.total };
  }
  return { rows: rows.map(toPerson), total: totalOf(rows) };
}

/** How many customer accounts exist (staff left out) — Today's totals line. */
export async function countPeople(): Promise<number> {
  return (await searchPeople({ query: '', offset: 0, limit: 1 })).total;
}

/** Find's People group: 2–120 characters, at most 8 rows (the LIMIT is in the database). */
export async function findPeople(query: string): Promise<{ rows: PlatformPerson[]; total: number }> {
  const { data, error } = await supabaseAdmin.rpc('platform_find_people', {
    p_query: query,
    p_exclude_emails: staffExclusions(),
  });
  if (error) throw new PeopleLookupError();
  const rows = (data ?? []) as PersonRow[];
  return { rows: rows.map(toPerson), total: totalOf(rows) };
}

/** Find's Clubs group: name, web name, own web address or owner email; demo sandboxes left out; at most 8 rows. */
export async function findClubs(query: string): Promise<{ rows: FoundClub[]; total: number }> {
  const { data, error } = await supabaseAdmin.rpc('platform_find_clubs', {
    p_query: query,
    p_exclude_slugs: [...DEMO_ORG_SLUGS],
  });
  if (error) throw new PeopleLookupError();
  const rows = (data ?? []) as Array<{
    id: string; name: string; slug: string; plan_id: string | null; subscription_status: string | null;
    account_kind: string | null; own_address: string | null; owner_email: string | null; total_count: number | string | null;
  }>;
  return {
    rows: rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      planId: r.plan_id,
      subscriptionStatus: r.subscription_status,
      accountKind: r.account_kind,
      ownAddress: r.own_address,
      ownerEmail: r.owner_email,
    })),
    total: rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0,
  };
}

const BY_IDS_CHUNK = 1000; // the function's own LIMIT

/** The sign-in facts for a set of account ids, keyed by id. Chunks past the function's 1,000-row limit; no cap. */
export async function peopleByIds(ids: Iterable<string>): Promise<Map<string, PlatformPerson>> {
  const unique = [...new Set([...ids].filter(Boolean))];
  const out = new Map<string, PlatformPerson>();
  for (let i = 0; i < unique.length; i += BY_IDS_CHUNK) {
    const { data, error } = await supabaseAdmin.rpc('platform_people_by_ids', { p_ids: unique.slice(i, i + BY_IDS_CHUNK) });
    if (error) throw new PeopleLookupError();
    for (const row of (data ?? []) as PersonRow[]) out.set(row.id, toPerson(row));
  }
  return out;
}

/** One person by account id, or null. */
export async function personById(id: string): Promise<PlatformPerson | null> {
  return (await peopleByIds([id])).get(id) ?? null;
}
