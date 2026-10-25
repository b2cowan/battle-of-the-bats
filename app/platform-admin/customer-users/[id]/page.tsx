import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlatformPower, isPlatformAdminEmail, requirePlatformAreaView } from '@/lib/platform-auth';
import { personAuthStatus, personById } from '@/lib/platform-people-lookup';
import { buildPersonStory } from '@/lib/platform-story';
import { recordOpened } from '@/lib/platform-record-opens';
import { planLabel } from '@/lib/platform-metrics';
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
  const person = await personById(id).catch(() => null);
  if (!person) notFound();
  if (auth.role !== 'super_admin' && await isPlatformAdminEmail(person.email)) notFound();

  const [membersRes, story] = await Promise.all([
    supabaseAdmin.from('organization_members')
      .select('role, status, organizations(id, name, slug, plan_id, subscription_status)')
      .eq('user_id', id).limit(500),
    buildPersonStory({ id: person.id, email: person.email, createdAt: person.createdAt }),
  ]);
  await recordOpened({ actorUserId: auth.user.id, actorEmail: auth.user.email, kind: 'person', recordId: id, viaFind: via === 'find' });

  const clubs = ((membersRes.data ?? []) as unknown as Array<{
    role: string; status: string | null; organizations: { id: string; name: string; slug: string; plan_id: string | null; subscription_status: string | null } | null;
  }>)
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
    can: {
      support: hasPlatformPower(auth.role, 'person_support'),
      delete: hasPlatformPower(auth.role, 'delete_records'),
    },
  };
  return <PersonRecord {...props} />;
}
