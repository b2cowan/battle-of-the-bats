import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserAccessContexts } from '@/lib/user-contexts';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import type { Capability } from '@/lib/roles';
import type { Organization } from '@/lib/types';
import consumerStyles from '@/components/consumer/ConsumerPage.module.css';
import AccountNotificationsClient, { type NotificationCard } from './AccountNotificationsClient';

// Auth-dependent (per-user cards) — never static, never indexed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notification settings',
  robots: { index: false, follow: false },
};

// The reserved modules that gate an org card's optional sections (rule R4 — a section
// only renders for a module the org actually has).
const RESERVED_MODULES: Capability[] = ['module_rep_teams', 'module_house_league'];

async function resolveOrgModules(orgId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, enabled_addons, subscription_status, free_floor')
    .eq('id', orgId)
    .maybeSingle();
  if (!data) return [];
  // hasModuleEntitlement only reads these four fields — build the minimal shape it needs.
  const orgLike = {
    subscriptionStatus: data.subscription_status,
    planId:             data.plan_id,
    enabledAddons:      (data.enabled_addons ?? []) as string[],
    freeFloor:          data.free_floor ?? undefined,
  } as Organization;
  return RESERVED_MODULES.filter(cap => hasModuleEntitlement(orgLike, cap));
}

export default async function AccountNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <div className={consumerStyles.page}>
        <div className={consumerStyles.header}>
          <h1 className={consumerStyles.title}>Notification settings</h1>
          <p className={consumerStyles.subtitle}>Sign in to manage what the platform sends you.</p>
        </div>
        <div className={consumerStyles.actions}>
          <Link href="/auth/login" className={consumerStyles.cta}>Sign in</Link>
          <Link href="/discover" className={consumerStyles.ctaGhost}>Browse tournaments</Link>
        </div>
        <p className={consumerStyles.note}>
          You don&rsquo;t need an account to follow teams and get live scores — following works on this
          device right away, and its alert settings live on the follow itself. Notification settings here
          are for organizers, coaches, and staff.
        </p>
      </div>
    );
  }

  const contexts = await getUserAccessContexts({ id: user.id, email: user.email });

  // Phase 1 covers the org-membership hats only: owner/admin/staff (organization) and
  // rep / team-workspace coaches (coaches_premium — they ARE org members). Basic (free)
  // coaches, officials, and fan follows land in later phases.
  const cards: NotificationCard[] = [];
  for (const ctx of contexts) {
    if (!ctx.orgSlug) continue;

    if (ctx.kind === 'organization') {
      cards.push({
        kind:       'organization',
        focusKey:   `org-${ctx.orgSlug}`,
        orgSlug:    ctx.orgSlug,
        orgName:    ctx.title,
        role:       ctx.role ?? 'staff',
        badgeLabel: ctx.badgeLabel,
        subtitle:   'Organization access',
        modules:    await resolveOrgModules(ctx.orgId ?? ''),
      });
    } else if (ctx.kind === 'coaches_premium') {
      cards.push({
        kind:       'coaches_premium',
        focusKey:   `coach-${ctx.orgSlug}`,
        orgSlug:    ctx.orgSlug,
        orgName:    ctx.title,
        role:       ctx.role ?? 'coach',
        badgeLabel: ctx.badgeLabel,
        subtitle:   'Coaches Portal',
        modules:    [],
      });
    }
  }

  return (
    <AccountNotificationsClient cards={cards} userEmail={user.email} focus={focus ?? null} />
  );
}
