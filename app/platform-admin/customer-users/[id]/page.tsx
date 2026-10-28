import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlatformPower, isPlatformAdminEmail, requirePlatformAreaView, type PlatformRole } from '@/lib/platform-auth';
import { personAuthStatus, personById } from '@/lib/platform-people-lookup';
import { buildPersonStory, type PersonMembership } from '@/lib/platform-story';
import { recordOpened } from '@/lib/platform-record-opens';
import { planLabel } from '@/lib/platform-labels';
import { listSentEmails, recordingStartedAt } from '@/lib/sent-log';
import { readCoachPortalTab } from '@/lib/portal-free-time-tab';
import type { PersonEmails } from '../../sent-emails/SentParts';
import PersonRecord, { type PersonRecordProps } from './PersonRecord';

/**
 * A person's record (Support console Stage 2, owner ruling A8; drawings "A person's record (new)"). New: a person had no
 * record — their actions sat in a menu on each row of Customer users. The same shape as a club, smaller: a band (Clubs,
 * Last signed in, Account created) and three tabs, Story · Clubs · Account. Name and email change through the one pencil;
 * the everyday action is Send a reset link; the rare doors end the Account tab.
 *
 * Staff accounts are not customers: they are left out of People and Find, and only a super admin opens one here.
 * Opening it writes one row to the trail of records opened (A3).
 */
export const metadata = { title: 'Person — Support console' };

export default async function PersonRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  const auth = await requirePlatformAreaView('customer_users');
  const { id } = await params;
  const { via } = await searchParams;
  // A failed read is an error, never "no such person" (a 404 would tell support the account does not exist).
  const person = await personById(id);
  if (!person) notFound();
  if (auth.role !== 'super_admin' && await isPlatformAdminEmail(person.email)) notFound();

  // The memberships are read once: the Clubs tab and the Story's joins both come from them. The trail row (A3) is
  // written alongside, best effort.
  const [membersRes] = await Promise.all([
    supabaseAdmin.from('organization_members')
      .select('role, status, invited_at, accepted_at, organizations(id, name, slug, plan_id, subscription_status)')
      .eq('user_id', id).limit(500),
    recordOpened({ actorUserId: auth.user.id, actorEmail: auth.user.email, kind: 'person', recordId: id, viaFind: via === 'find' }),
  ]);
  const memberships = (membersRes.data ?? []) as unknown as Array<PersonMembership & {
    status: string | null; organizations: { id: string; name: string; slug: string; plan_id: string | null; subscription_status: string | null } | null;
  }>;
  // The sent log is the `sent_log` power's (Super admin, Support, Billing), decided HERE on the server: the Story and the
  // Emails tab are open to every role that opens a person, so a role without the power is handed no email rows and no tab
  // (absent beats disabled; T14). The Story is given the role, not a flag, and checks the power again.
  const sentLog = hasPlatformPower(auth.role, 'sent_log');
  // The Coaches Portal tab (Stage 4b): every role that opens a person reads it; only a giver is handed the door.
  const canGive = hasPlatformPower(auth.role, 'portal_free_time');
  const [story, emails, coachesPortal] = await Promise.all([
    buildPersonStory({ id: person.id, email: person.email, createdAt: person.createdAt }, memberships, { emailsAs: sentLog ? auth.role : null }),
    sentLog ? readPersonEmails(auth.role, person.email) : Promise.resolve(null),
    // A failed read is said on the tab, never "no team" (and never the door: the give would decide from nothing).
    readCoachPortalTab(person.id, { id: auth.user.id, email: auth.user.email ?? '', role: auth.role }, canGive).catch(() => 'failed' as const),
  ]);

  const clubs = memberships
    .filter(m => m.organizations)
    .map(m => ({
      id: m.organizations!.id,
      name: m.organizations!.name,
      slug: m.organizations!.slug,
      planLabel: planLabel(m.organizations!.plan_id ?? 'tournament'),
      role: m.role,
      status: m.status ?? 'active',
    }));

  const props: PersonRecordProps = {
    person: {
      id: person.id,
      email: person.email,
      name: person.displayName,
      lastSignInAt: person.lastSignInAt,
      createdAt: person.createdAt,
      emailConfirmed: !!person.emailConfirmedAt,
      status: personAuthStatus(person),
    },
    clubs,
    story,
    emails,
    coachesPortal,
    can: {
      support: hasPlatformPower(auth.role, 'person_support'),
      delete: hasPlatformPower(auth.role, 'delete_records'),
    },
  };
  return <PersonRecord {...props} />;
}

/** The person's own emails by their CURRENT address, newest first, with when recording began for the empty state (E6). */
async function readPersonEmails(role: PlatformRole, address: string): Promise<PersonEmails | null> {
  try {
    const [{ rows, total }, startedAt] = await Promise.all([
      listSentEmails(role, { to: address, limit: 100 }),
      recordingStartedAt(),
    ]);
    return { rows, total, startedAt };
  } catch {
    // A failed read is an error, never "no emails recorded": the tab then says it could not be read.
    return { rows: [], total: 0, startedAt: null, failed: true };
  }
}
