import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import OrgDetailClient from './OrgDetailClient';
import styles from './orgDetail.module.css';

const ADDON_LABELS: Record<string, string> = {
  module_public_site:  'Public Site',
  module_accounting:   'Accounting',
  module_house_league: 'House League',
  module_rep_teams:    'Rep Teams',
};

async function getOrgDetail(id: string) {
  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, plan_id, tournament_limit, subscription_status, created_at, enabled_addons, internal_notes'
    )
    .eq('id', id)
    .single();

  if (error || !org) return null;
  return org;
}

async function getMembers(orgId: string) {
  const { data: rows } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', orgId);

  if (!rows || rows.length === 0) return [];

  // Fetch all auth users and filter to this org's members
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const userMap = new Map<string, { email: string; displayName: string; lastSignInAt: string | null }>();
  for (const u of usersData?.users ?? []) {
    userMap.set(u.id, {
      email:        u.email ?? '(no email)',
      displayName:  (u.user_metadata?.display_name as string) ?? '',
      lastSignInAt: u.last_sign_in_at ?? null,
    });
  }

  return rows.map(m => {
    const info = userMap.get(m.user_id as string);
    return {
      userId:      m.user_id as string,
      role:        m.role as string,
      status:      (m.status ?? 'active') as string,
      email:       info?.email ?? '(unknown)',
      displayName: info?.displayName ?? '',
      lastSignIn:  info?.lastSignInAt ?? null,
    };
  });
}

async function getTournaments(orgId: string) {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, status, start_date, end_date')
    .eq('organization_id', orgId)
    .neq('status', 'archived')
    .order('start_date', { ascending: false });

  return (data ?? []).map(t => ({
    id:        t.id as string,
    name:      t.name as string,
    status:    t.status as string,
    startDate: t.start_date as string | null,
    endDate:   t.end_date as string | null,
  }));
}

async function getOverrides(orgId: string) {
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((r: any) => ({
    id:         r.id as string,
    type:       r.type as string,
    value:      r.value as string | null,
    expiresAt:  r.expires_at as string | null,
    reason:     r.reason as string,
    createdBy:  r.created_by as string,
    createdAt:  r.created_at as string,
    revokedAt:  r.revoked_at as string | null,
    revokedBy:  r.revoked_by as string | null,
  }));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function planLabel(planId: string) {
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, members, tournaments, overrides] = await Promise.all([
    getOrgDetail(id),
    getMembers(id),
    getTournaments(id),
    getOverrides(id),
  ]);

  if (!org) notFound();

  const enabledAddons = (org.enabled_addons as string[]) ?? [];
  const addonLabels   = enabledAddons.map(a => ADDON_LABELS[a] ?? a);
  const planCfg       = PLAN_CONFIG[org.plan_id as keyof typeof PLAN_CONFIG];

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/platform-admin/orgs" className={styles.backLink}>← Organizations</Link>
      </div>

      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>{org.name}</h1>
      </header>

      {/* Identity */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.grid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <span className={styles.fieldValue}>{org.name}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Slug</span>
            <span className={`${styles.fieldValue} ${styles.mono}`}>{org.slug}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Created</span>
            <span className={styles.fieldValue}>{fmtDate(org.created_at as string)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Admin</span>
            <Link
              href={`/${org.slug}/admin`}
              target="_blank"
              rel="noreferrer"
              className={styles.adminLink}
            >
              ↗ Admin
            </Link>
          </div>
        </div>
      </section>

      {/* Plan & Entitlements */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Plan &amp; Entitlements</h2>
        <div className={styles.grid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Plan</span>
            <span className={styles.fieldValue}>{planLabel(org.plan_id as string)}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Tournament Limit</span>
            <span className={styles.fieldValue}>{org.tournament_limit}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <span className={styles.fieldValue}>{org.subscription_status}</span>
          </div>
          {planCfg && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Officials Free Seats</span>
              <span className={styles.fieldValue}>{planCfg.officialsFreeSeats ? 'Yes' : 'No'}</span>
            </div>
          )}
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>Active Add-ons</span>
            <span className={styles.fieldValue}>
              {addonLabels.length > 0 ? addonLabels.join(', ') : 'None'}
            </span>
          </div>
        </div>
      </section>

      {/* Active Overrides + Members + Tournaments + Notes — interactive via client */}
      <OrgDetailClient
        orgId={id}
        orgSlug={org.slug as string}
        internalNotes={(org.internal_notes as string | null) ?? null}
        overrides={overrides}
        members={members}
        tournaments={tournaments}
      />
    </div>
  );
}
