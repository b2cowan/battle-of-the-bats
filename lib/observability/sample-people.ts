/**
 * Who an error sample hit, and whether this viewer may open them (Support console Stage 5, Part 5; owner Q4, threat T26).
 *
 * ⚖ THE LINK FOLLOWS THE PERSON RECORD'S OWN RULE — it is not a second rule. `app/platform-admin/customer-users/[id]/page.tsx`
 * opens a record for `customer_users` readers (`canViewPlatformArea`) and turns a staff account away unless the viewer is a
 * super admin (`isPlatformAdminEmail`: the PLATFORM_ADMIN_EMAILS bootstrap list plus an active `platform_users` row). This
 * module asks those same two functions, so a Support or Product reader is never handed a link that 404s, and a staff
 * account is never named to a role that may not open it.
 *
 * The five honest states and the pure rule that picks one live in `sample-who.ts` (unit-tested without a database). The IP
 * address and browser a client error also stores are NEVER read here (T27); neither column is selected anywhere on the way.
 *
 * SERVER ONLY (service-role reads; the people lookup is revoked from everyone else).
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canViewPlatformArea } from '@/lib/platform-areas';
import { isPlatformAdminEmail, type PlatformRole } from '@/lib/platform-auth';
import { peopleByIds, type PlatformPerson } from '@/lib/platform-people-lookup';

import { decideWho, clubHref, type SampleWho, type SampleClub, type SampleSubjectRow } from './sample-who';

/**
 * One batched read for the whole page of samples: the accounts by id (the Stage 2 lookup), the clubs by id, and the staff
 * test (the person record's own `isPlatformAdminEmail`) once per distinct address.
 */
export async function resolveSampleSubjects<T extends SampleSubjectRow>(
  rows: readonly T[],
  viewerRole: PlatformRole,
): Promise<{ who: Map<T, SampleWho>; club: Map<T, SampleClub> }> {
  const viewer = { role: viewerRole, mayOpenPeople: canViewPlatformArea(viewerRole, 'customer_users') };
  const mayOpenClubs = canViewPlatformArea(viewerRole, 'organizations');

  const userIds = [...new Set(rows.map(r => r.user_id).filter((v): v is string => !!v))];
  const orgIds = [...new Set(rows.map(r => r.org_id).filter((v): v is string => !!v))];

  let lookupFailed = false;
  const [people, orgs] = await Promise.all([
    userIds.length > 0
      ? peopleByIds(userIds).catch(() => { lookupFailed = true; return new Map<string, PlatformPerson>(); })
      : Promise.resolve(new Map<string, PlatformPerson>()),
    orgIds.length > 0
      ? supabaseAdmin.from('organizations').select('id, name').in('id', orgIds).then(res => res.data ?? [])
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  // Staff test: every address that could be shown (the account's, and a stored address with no account behind it).
  const addresses = new Set<string>();
  for (const r of rows) {
    const person = r.user_id ? people.get(r.user_id) : undefined;
    if (person?.email) addresses.add(person.email.toLowerCase());
    if (r.user_email) addresses.add(r.user_email.trim().toLowerCase());
  }
  const staffEmails = new Set<string>();
  if (viewerRole !== 'super_admin') {
    await Promise.all([...addresses].map(async a => { if (await isPlatformAdminEmail(a).catch(() => true)) staffEmails.add(a); }));
  }

  const orgName = new Map(orgs.map(o => [o.id, o.name] as const));
  const who = new Map<T, SampleWho>();
  const club = new Map<T, SampleClub>();
  for (const r of rows) {
    who.set(r, decideWho(r, r.user_id ? people.get(r.user_id) : undefined, viewer, staffEmails, lookupFailed));
    const name = (r.org_id ? orgName.get(r.org_id) : undefined) ?? r.org_slug;
    club.set(r, name ? { name, href: r.org_id && orgName.has(r.org_id) && mayOpenClubs ? clubHref(r.org_id) : null } : null);
  }
  return { who, club };
}
