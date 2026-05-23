import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDestinationForMembership } from '@/lib/auth-destination';
import type { MemberRow, OrgRelation } from '@/lib/auth-destination';
import type { OrgPlan } from '@/lib/types';
import authStyles from '../auth.module.css';
import styles from './select-org.module.css';

// ── Plan display helpers ────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  tournament:      'Tournament',
  tournament_plus: 'Tournament+',
  league:          'League',
  club:            'Club',
  team:            'Team',
};

// Same palette as app/platform-admin/dev-tools/page.tsx PLAN_COLORS
const PLAN_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  tournament:      { text: '#86efac', border: 'rgba(34,197,94,0.45)',   bg: 'rgba(34,197,94,0.1)'  },
  tournament_plus: { text: '#93c5fd', border: 'rgba(59,130,246,0.45)',  bg: 'rgba(59,130,246,0.1)' },
  league:          { text: '#fde68a', border: 'rgba(251,191,36,0.45)',  bg: 'rgba(251,191,36,0.1)' },
  club:            { text: '#a5b4fc', border: 'rgba(99,102,241,0.45)',  bg: 'rgba(99,102,241,0.1)' },
  team:            { text: '#f9a8d4', border: 'rgba(236,72,153,0.45)',  bg: 'rgba(236,72,153,0.1)' },
};

const ROLE_LABELS: Record<string, string> = {
  owner:             'Owner',
  admin:             'Admin',
  staff:             'Staff',
  official:          'Scorekeeper',
  league_admin:      'League Admin',
  league_registrar:  'Registrar',
  treasurer:         'Treasurer',
  coach:             'Coach',
};

// ── Types ───────────────────────────────────────────────────────────────────

type SelectMemberRow = MemberRow & {
  organizations: (OrgRelation & { name?: string | null }) | (OrgRelation & { name?: string | null })[] | null;
};

type OrgEntry = {
  orgName: string;
  planId: OrgPlan | string;
  role: string;
  destination: string;
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function SelectOrgPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: rawMembers } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role, organizations(id, slug, name, plan_id, enabled_addons, account_kind, team_workspace_status, onboarding_completed_at)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const members = (rawMembers ?? []) as SelectMemberRow[];

  // Edge-cases: 0 or 1 member shouldn't normally land here, but handle gracefully.
  if (members.length === 0) {
    redirect('/auth/signup');
  }

  if (members.length === 1) {
    const dest = await getDestinationForMembership(members[0]);
    redirect(dest);
  }

  // Compute destination for every org in parallel.
  const entries: OrgEntry[] = await Promise.all(
    members.map(async (member) => {
      const orgRelation = member.organizations;
      const org = Array.isArray(orgRelation) ? orgRelation[0] : orgRelation;
      const destination = await getDestinationForMembership(member);

      return {
        orgName:     org?.name ?? org?.slug ?? 'Unknown Organization',
        planId:      org?.plan_id ?? 'tournament',
        role:        member.role,
        destination,
      };
    })
  );

  return (
    <div className={authStyles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            {/* Grid / workspace icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="0.5" />
              <rect x="14" y="3" width="7" height="7" rx="0.5" />
              <rect x="3" y="14" width="7" height="7" rx="0.5" />
              <rect x="14" y="14" width="7" height="7" rx="0.5" />
            </svg>
          </div>
          <h1 className={styles.title}>Select Workspace</h1>
          <p className={styles.sub}>You belong to {entries.length} organizations — choose one to continue</p>
        </div>

        {/* Org list */}
        <div className={styles.orgList}>
          {entries.map((entry, idx) => {
            const pc = PLAN_COLORS[entry.planId] ?? PLAN_COLORS.tournament;
            const planLabel = PLAN_LABELS[entry.planId] ?? String(entry.planId).toUpperCase();
            const roleLabel = ROLE_LABELS[entry.role] ?? entry.role;

            return (
              <div key={idx} className={styles.orgItem}>
                <div className={styles.orgInfo}>
                  <div className={styles.orgNameRow}>
                    <span className={styles.orgName}>{entry.orgName}</span>
                    <span
                      className={styles.planBadge}
                      style={{ color: pc.text, borderColor: pc.border, background: pc.bg }}
                    >
                      {planLabel}
                    </span>
                  </div>
                  <div className={styles.roleMeta}>
                    Role: <span className={styles.roleHighlight}>{roleLabel}</span>
                  </div>
                </div>

                <Link href={entry.destination} className={styles.enterBtn}>
                  Enter
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          Logged in as {user.email}
        </div>
      </div>
    </div>
  );
}
