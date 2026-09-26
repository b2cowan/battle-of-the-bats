'use client';
/**
 * "What each role can open" — the Role Guide, rewritten from the role defaults (Club Tier Stage 1,
 * specimen 5; J10-004 / A13). Columns are the roles this organization can hand out (the same list
 * the invite dropdown offers), with the Owner first and the Coach last where the plan runs teams.
 * Rows are the organization's PROGRAMS, not fourteen tournament verbs — that detail belongs to the
 * Tournaments help article. Every cell comes from `roleGuideCell` (the role defaults), never typed.
 */
import { planCarriesModule } from '@/lib/module-entitlements';
import { roleLabel } from '@/lib/member-access';
import type { Organization, OrgRole } from '@/lib/types';
import { roleGuideCell, type RoleGuideRow } from './member-summary';
import type { AssignableRoleOption } from './members-types';
import ck from './ClubKit.module.css';
import styles from './Members.module.css';

export default function RoleGuide({
  org,
  roles,
  runsHouseLeague,
}: {
  org: Organization;
  /** The roles this org hands out (managers read it); null for someone who only views the board. */
  roles: AssignableRoleOption[] | null;
  runsHouseLeague: boolean;
}) {
  const carries = (cap: Parameters<typeof planCarriesModule>[1]) => planCarriesModule(org, cap);
  // Without the managers' list, the columns a viewer sees are the board roles the plan itself allows.
  const assignable: OrgRole[] = roles
    ? roles.map(r => r.role)
    : ['admin', ...(carries('module_accounting') ? ['treasurer' as const] : []), 'staff', 'official'];
  const columns: (OrgRole | 'coach')[] = ['owner', ...assignable, ...(carries('module_rep_teams') ? ['coach' as const] : [])];

  const rows: { key: RoleGuideRow; label: string }[] = [
    ...(carries('module_rep_teams') ? [{ key: 'rep-teams' as const, label: 'Rep Teams (teams, tryouts, coaches, allocations)' }] : []),
    ...(carries('module_accounting') ? [{ key: 'accounting' as const, label: 'Accounting' }] : []),
    ...(carries('module_public_site') ? [{ key: 'public-site' as const, label: 'Public site' }] : []),
    { key: 'league-tournaments', label: carries('module_house_league') ? 'House league · Tournaments' : 'Tournaments' },
    ...(carries('module_families') ? [{ key: 'families' as const, label: 'Families (household records)' }] : []),
    { key: 'members', label: 'Members' },
    { key: 'owner-only', label: 'Plan & billing · Settings · Audit log' },
  ];

  const leagueRolesOffered = assignable.includes('league_admin');
  const showLeagueNote = carries('module_house_league') && !runsHouseLeague && !leagueRolesOffered && org.planId !== 'league';

  return (
    <section className={`${ck.section} ${styles.guide}`} aria-labelledby="members-role-guide">
      <div className={ck.sectionHead}>
        <h2 id="members-role-guide" className={ck.sectionTitle}>What each role can open</h2>
      </div>
      <div className={ck.tableFrame}>
        <table className={`${ck.table} ${styles.guideTable}`}>
          <thead>
            <tr>
              <th scope="col"><span className={styles.srOnly}>Program</span></th>
              <th scope="col">On {org.name}’s plan</th>
              {columns.map(r => <th key={r} scope="col">{roleLabel(r)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <th scope="row" className={styles.guideRowHead}>{row.label}</th>
                <td>✓</td>
                {columns.map(r => {
                  const cell = roleGuideCell(r, row.key);
                  return (
                    <td key={r} className={cell === '✓' ? styles.guideYes : cell === '—' ? styles.guideNo : styles.guideWords}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showLeagueNote && (
        <p className={`${ck.lede} ${styles.guideNote}`}>
          League admin and League registrar appear here, and in the invite list, once the club runs a house league.
        </p>
      )}
    </section>
  );
}
