import type { OrgRole } from '@/lib/types';
import type { MemberSection, ProgramAccess } from '@/lib/member-access';

/** One row of GET /api/admin/members (session 1 added `section` + `access`). */
export interface KitMember {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  title: string | null;
  role: OrgRole;
  status: 'invited' | 'active' | 'suspended';
  capabilities: Record<string, boolean> | null;
  invitedAt: string;
  acceptedAt: string | null;
  lastSignIn: string | null;
  assignedTournamentIds: string[];
  repGroupIds: string[];
  section: MemberSection;
  access: ProgramAccess[];
}

/** One role of GET /api/admin/members/roles — the list the invite and role-change routes accept. */
export interface AssignableRoleOption {
  role: OrgRole;
  label: string;
  hint: string;
  group: 'runs_the_club' | 'house_league' | 'volunteers';
  opens: string;
}

export interface TournamentOption { id: string; name: string; year: number | null }
export interface RepGroupOption { id: string; name: string }

/** The name a person goes by on this screen, and their email when that is all there is. */
export function memberName(m: Pick<KitMember, 'displayName' | 'email'>): string {
  return m.displayName?.trim() || m.email;
}

/** "Sam" for a sentence about Sam — their first name, or "They" when only an email is known. */
export function memberFirstName(m: Pick<KitMember, 'displayName'>): string {
  const name = m.displayName?.trim();
  return name ? name.split(/\s+/)[0] : 'They';
}

/** Board order (specimen 5): the owner, then the roles that run the club, then the helpers — and an
 *  unanswered invitation after the people who have joined. A stable order (the old list had none,
 *  so two loads of an unchanged screen drew the rows in two orders — ADC slice 0). */
const ROLE_RANK: Record<string, number> = {
  owner: 0, admin: 1, treasurer: 2, league_admin: 3, league_registrar: 4, staff: 5, official: 6, coach: 7,
};

export function boardOrder(a: KitMember, b: KitMember): number {
  const invited = (m: KitMember) => (m.status === 'invited' ? 1 : 0);
  return invited(a) - invited(b)
    || (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9)
    || memberName(a).localeCompare(memberName(b))
    || a.id.localeCompare(b.id);
}
