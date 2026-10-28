import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { listDemoOrgIdsQuietly } from './demo-org-server';
import { daysLeft, isEndingSoon, isGrantRunning, lastDayOfInstant } from './free-time';
import { planLabel, sectionLabel, subscriptionStatusLabel } from './platform-labels';
import { freeTimePortalOrgIds } from './portal-free-time-server';

/**
 * Free time given by staff, one row per club (Support console Stage 4; drawings C2 and E1). The Free time list's "Given
 * by staff" view and Today's "Free time ending" both read THIS, so the queue's number is the number of clubs the list's
 * "Ending in 14 days" filter shows (owner ruling Q7: one queue, 14 days, counting clubs). A club with a plan and a section
 * both running is one row, named by both, dated by the one that ends first.
 *
 * Founding Season is not in it: its access is the club's plan, not a grant, until its turn-off decision (owner ruling
 * Q4), and the Founding Season view counts its own days. The public demo clubs are left out, as every console count is.
 */

export type StaffFreeTimeClub = {
  orgId: string;
  name: string;
  /** A club, or a Coaches Portal given free time (Stage 4b): one queue, one list, both counted (owner ruling Q7/G). */
  kind: 'club' | 'portal';
  /** What runs, in the list's words: "Club, the whole plan · Accounting"; "Premium Coaches Portal". */
  freeOn: string;
  /** The soonest last free day among the club's grants. */
  lastDay: string;
  daysLeft: number;
  endingSoon: boolean;
  /** Who gave, and why, the grant that ends first. */
  givenBy: string;
  why: string;
};

type Row = {
  org_id: string; type: string; value: string | null; target: { addons?: string[]; plan?: string } | null;
  starts_at: string | null; expires_at: string | null; revoked_at: string | null; reason: string | null; created_by: string | null;
};

function freeOnWords(r: Row, portal: boolean): string {
  // A Coaches Portal's free time is held open by a billing-status grant (Stage 4b): it reads as what the coach has.
  if (portal) return 'Premium Coaches Portal';
  if (r.type === 'plan_tier') return `${planLabel(r.target?.plan ?? '')}, the whole plan`;
  if (r.type === 'module_addon') return (r.target?.addons ?? []).map(sectionLabel).join(', ') || 'Sections';
  return `Billing status: ${subscriptionStatusLabel(r.value ?? 'active')}`;
}

export async function getStaffFreeTime(now: Date = new Date()): Promise<StaffFreeTimeClub[]> {
  const [{ data, error }, demoIds, portalIds] = await Promise.all([
    supabaseAdmin
      .from('org_overrides')
      .select('org_id, type, value, target, starts_at, expires_at, revoked_at, reason, created_by')
      .in('type', ['plan_tier', 'module_addon', 'subscription_status'])
      .is('revoked_at', null)
      .not('expires_at', 'is', null)
      .limit(5000),
    listDemoOrgIdsQuietly(),
    freeTimePortalOrgIds(),
  ]);
  if (error) throw error;
  const demo = new Set(demoIds);
  const byOrg = new Map<string, Row[]>();
  for (const r of (data ?? []) as Row[]) {
    if (demo.has(r.org_id) || !isGrantRunning(r, now)) continue;
    byOrg.set(r.org_id, [...(byOrg.get(r.org_id) ?? []), r]);
  }
  if (byOrg.size === 0) return [];
  const { data: orgs, error: orgError } = await supabaseAdmin.from('organizations').select('id, name').in('id', [...byOrg.keys()]);
  if (orgError) throw orgError;
  const names = new Map(((orgs ?? []) as Array<{ id: string; name: string }>).map(o => [o.id, o.name]));

  const clubs: StaffFreeTimeClub[] = [];
  for (const [orgId, rows] of byOrg) {
    if (!names.has(orgId)) continue;
    const sorted = [...rows].sort((a, b) => a.expires_at!.localeCompare(b.expires_at!));
    const first = sorted[0];
    const lastDay = lastDayOfInstant(first.expires_at!);
    clubs.push({
      orgId,
      name: names.get(orgId)!,
      kind: portalIds.has(orgId) ? 'portal' : 'club',
      freeOn: [...new Set(sorted.map(r => freeOnWords(r, portalIds.has(orgId))))].join(' · '),
      lastDay,
      daysLeft: daysLeft(lastDay, now),
      endingSoon: isEndingSoon(lastDay, now),
      givenBy: first.created_by ?? 'Staff',
      why: first.reason ?? '',
    });
  }
  return clubs.sort((a, b) => a.lastDay.localeCompare(b.lastDay) || a.name.localeCompare(b.name));
}

/** Today's "Free time ending": the clubs the list's 14-day filter shows. */
export function freeTimeEndingCount(clubs: StaffFreeTimeClub[]): number {
  return clubs.filter(c => c.endingSoon).length;
}
