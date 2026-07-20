import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserAccessContexts } from '@/lib/user-contexts';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getFanAlertOverview } from '@/lib/fan-alert-prefs';
import { isNotificationsPaused } from '@/lib/notification-pause';
import type { Capability } from '@/lib/roles';
import type { Organization } from '@/lib/types';
import type { FanCardData } from '@/components/notifications/FanAlertsCard';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from './AccountNotifications.module.css';
import accountStyles from '../account.module.css';
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
      <div className={warm.warm}>
        <div className={styles.page}>
          <div className={styles.header}>
            <h1 className={styles.title}>Notification settings</h1>
            <p className={styles.subtitle}>Sign in to manage what the platform sends you.</p>
          </div>
          <div className={accountStyles.ctaStack}>
            <Link href="/auth/login?next=%2Faccount%2Fnotifications" className={accountStyles.ctaPrimary}>Sign in</Link>
            <Link href="/discover" className={accountStyles.ctaGhost}>Browse tournaments</Link>
          </div>
          <p className={styles.signedOutNote}>
            You don&rsquo;t need an account to follow teams and watch live scores — following works on
            this device right away. <strong>Score alerts are what signing in gets you</strong> — a push
            when your teams&rsquo; games go live, on every device you sign in on.
          </p>
        </div>
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
      // Rule R4: show the tryout row only if this coach can actually receive tryout
      // notifications in this org — a head coach always can; an assistant only if granted
      // 'tryouts' on any of their teams. OR across the coach's assignments (card is per-org).
      const assignments = ctx.orgId ? await getCoachingAssignmentsForUser(ctx.orgId, user.id) : [];
      const canReceiveTryouts = assignments.some(a => a.capabilities.tryouts);
      cards.push({
        kind:              'coaches_premium',
        focusKey:          `coach-${ctx.orgSlug}`,
        orgSlug:           ctx.orgSlug,
        orgName:           ctx.title,
        role:              ctx.role ?? 'coach',
        badgeLabel:        ctx.badgeLabel,
        subtitle:          'Coaches Portal',
        modules:           [],
        canReceiveTryouts,
      });
    }
  }

  // The fan card (Slice 3): global alert switches + the honest per-event gate line.
  // Rendered whenever the account follows at least one team — a pure fan with no
  // org/coach hats sees just this card.
  const [overview, paused] = await Promise.all([
    getFanAlertOverview(user.id),
    isNotificationsPaused(user.id),
  ]);
  const fanCard: FanCardData | null = overview
    ? {
        teamCount: overview.teamCount,
        gameAlerts: overview.prefs.gameAlerts,
        eventNews: overview.prefs.eventNews,
        noAlertEvents: overview.noAlertEvents,
      }
    : null;

  return (
    <AccountNotificationsClient
      cards={cards}
      fanCard={fanCard}
      userEmail={user.email}
      focus={focus ?? null}
      paused={paused}
    />
  );
}
