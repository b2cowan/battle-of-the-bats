'use client';
/**
 * MEMBERS on the kit (Club Tier Stage 1, screens session; ratified specimen 5, club hub v8). Rendered
 * by the Members page, whose old page is dead since the release and goes in Admin Design Continuity
 * Part B's Organization pass.
 *
 *   The board first — the people who run the organization — with "What they can open", computed by
 *   the one access computation (`whatTheyCanOpen`), never typed, and a chip per change from the
 *   role's defaults (J10-024). Scorekeepers and coaching staff are their own collapsed sections
 *   (Ask 6; S1-03 — coaching staff are managed on each team's staff page). The Role Guide is
 *   rewritten from the role defaults (J10-004 / A13).
 *
 *   Invite / Manage / Resend / Remove render only for someone who can manage members (J10-012);
 *   a treasurer reads the board. Suspend asks first (J10-018). Manage has ONE Save (J10-021).
 *
 * ⚠ Deliberately not as drawn (flagged at build time): Resend and Remove live in Manage's footer
 * (the drawing's rows show only Manage); the coaching-staff count has no "across N teams" (the
 * members read does not carry a coach's teams); the Role Guide is open, below the lists, as drawn.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ScrollText, UserPlus, ChevronRight, AlertTriangle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability, countsAsSeat } from '@/lib/roles';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { hasModuleEntitlement, planCarriesModule, isClubPlan } from '@/lib/module-entitlements';
import { roleLabel } from '@/lib/member-access';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import { formatStoredDate, orgDayKey, tournamentToday } from '@/lib/timezone';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { kit } from '@/components/coaches/kit';
import { useClubBrief } from './ClubBriefProvider';
import { accessSummary, accessShort, overrideChips } from './member-summary';
import { boardOrder, memberName, type KitMember, type AssignableRoleOption, type TournamentOption, type RepGroupOption } from './members-types';
import InviteMemberDialog from './InviteMemberDialog';
import PageNotice, { useNotice } from './PageNotice';
import ManageMemberDialog from './ManageMemberDialog';
import RoleGuide from './RoleGuide';
import ck from './ClubKit.module.css';
import styles from './Members.module.css';

const EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Display Name', key: 'displayName', format: 'text' },
  { label: 'Email',        key: 'email',        format: 'text' },
  { label: 'Role',         key: 'roleLabel',    format: 'text' },
  { label: 'Status',       key: 'statusLabel',  format: 'text' },
  { label: 'Last Sign In', key: 'lastSignIn',   format: 'text' },
  { label: 'Invited',      key: 'invitedAt',    format: 'text' },
];
const STATUS_WORD = { invited: 'Invited', active: 'Active', suspended: 'Suspended' } as const;

/** "Today" or "Sep 24" — the org's calendar day, never the reader's. */
function dayLabel(iso: string | null): string {
  if (!iso) return '—';
  return orgDayKey(iso) === tournamentToday() ? 'Today' : formatStoredDate(iso, { withYear: false });
}

export default function MembersKit() {
  const { currentOrg, userRole, userCapabilities, user, loading, canOpen } = useOrg();
  usePageTitle('Members');
  const slug = currentOrg?.slug ?? '';
  const orgQuery = slug ? `?orgSlug=${encodeURIComponent(slug)}` : '';
  const { shape } = useClubBrief();

  // The ONE gate the hub and the rail ask too (role + plan — `canOpenModule`), never a rebuild of it.
  const canSee = canOpen('module_members');
  const canManage = !!userRole && hasCapability(userRole, userCapabilities, 'manage_members');
  const isOwner = userRole === 'owner';

  const [members, setMembers] = useState<KitMember[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [roles, setRoles] = useState<AssignableRoleOption[] | null>(null);
  const [rolesFailed, setRolesFailed] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [repGroups, setRepGroups] = useState<RepGroupOption[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [notice, setNotice] = useNotice();

  const loadMembers = useCallback(async () => {
    if (!orgQuery) return;
    try {
      const res = await fetch(`/api/admin/members${orgQuery}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setMembers(await res.json());
      setListState('ready');
    } catch {
      setListState(prev => (prev === 'ready' ? prev : 'error'));
    }
  }, [orgQuery]);

  const loadRoles = useCallback(async () => {
    if (!orgQuery || !canManage) return;
    setRolesFailed(false);
    try {
      const res = await fetch(`/api/admin/members/roles${orgQuery}`);
      if (!res.ok) throw new Error();
      setRoles(((await res.json()) as { roles: AssignableRoleOption[] }).roles);
    } catch {
      setRolesFailed(true);
    }
  }, [orgQuery, canManage]);

  useEffect(() => {
    if (!currentOrg || !canSee) return;
    void loadMembers();
    void loadRoles();
    if (canManage) {
      // Manage's Tournaments › access list and Rep Teams › groups (optional; a failed read hides them).
      fetch(`/api/admin/tournaments${orgQuery}`)
        .then(r => (r.ok ? r.json() : []))
        .then((rows: { id: string; name: string; year: number | null }[]) => setTournaments(rows.map(r => ({ id: r.id, name: r.name, year: r.year ?? null }))))
        .catch(() => {});
      if (hasModuleEntitlement(currentOrg, 'module_rep_teams')) {
        fetch(`/api/admin/rep-teams/groups${orgQuery}`)
          .then(r => (r.ok ? r.json() : null))
          .then(d => setRepGroups(((d?.groups ?? []) as { id: string; name: string }[]).map(g => ({ id: g.id, name: g.name }))))
          .catch(() => {});
      }
    }
  }, [currentOrg, canSee, canManage, orgQuery, loadMembers, loadRoles]);

  if (loading || !currentOrg || !userRole) return <div className={ck.loading}>Loading…</div>;

  if (!canSee) {
    return (
      <div className={ck.pageNarrow}>
        <AdminPageHeader eyebrow="Organization" title="Members" />
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Members isn’t turned on for you</h2>
          <p className={styles.emptyBody}>Ask the organization’s owner if you need to see who is on the board.</p>
        </div>
      </div>
    );
  }

  const planCfg = PLAN_CONFIG[currentOrg.planId];
  const tournamentTier = isTournamentTier(currentOrg.planId);
  const noun = isClubPlan(currentOrg.planId) ? 'club' : currentOrg.planId === 'league' ? 'league' : 'organization';
  const billingHref = getBillingHref(currentOrg.slug, currentOrg.planId);
  const auditHref = tournamentTier
    ? `/${slug}/admin/tournaments/settings/members/audit`
    : `/${slug}/admin/org/members/audit`;

  const board = members.filter(m => m.section === 'board').sort(boardOrder);
  const scorekeepers = members.filter(m => m.section === 'scorekeepers').sort(boardOrder);
  const coaching = members.filter(m => m.section === 'coaching_staff').sort(boardOrder);

  // Seats: shown only where the limit is real (Tournament); unlimited plans drop the banner (specimen 5).
  const seatLimited = planCfg.seatLimit < 9999;
  const seatCount = members.filter(m => countsAsSeat(m.role, planCfg)).length;
  const atSeatLimit = seatLimited && seatCount >= planCfg.seatLimit;

  const manageTarget = manageId ? members.find(m => m.id === manageId) ?? null : null;
  const canManageRow = (m: KitMember) => {
    const isSelf = m.userId === user?.id;
    if (m.section === 'coaching_staff') return false; // S1-03: the team's staff page, never here
    if (m.role === 'owner') return isSelf;            // an owner edits their own name and title only
    return canManage && !isSelf;
  };

  function exportRows() {
    return members.map(m => ({
      displayName: m.displayName ?? '',
      email: m.email,
      roleLabel: roleLabel(m.role),
      statusLabel: STATUS_WORD[m.status],
      lastSignIn: m.lastSignIn ? formatStoredDate(m.lastSignIn) : '—',
      invitedAt: formatStoredDate(m.invitedAt),
    }));
  }
  const handleExportXLSX = () => downloadXLSX(
    buildFilename({ org: slug, dataset: 'members' }, 'xlsx'),
    serializeHeaders(EXPORT_COLS), serializeRows(exportRows(), EXPORT_COLS), 'Members');
  const handleExportCSV = () => downloadCSVBlob(
    buildFilename({ org: slug, dataset: 'members' }, 'csv'),
    generateCSV(serializeHeaders(EXPORT_COLS), serializeRows(exportRows(), EXPORT_COLS)));

  const personCell = (m: KitMember) => {
    const isSelf = m.userId === user?.id;
    const name = memberName(m);
    const second = [m.displayName ? m.email : null, m.title].filter(Boolean).join(' · ');
    return (
      <>
        <span className={styles.person}>
          <span className={ck.cellTitle}>{name}</span>
          {isSelf && <span className={ck.chip}>You</span>}
        </span>
        {second && <span className={ck.cellSub}>{second}</span>}
      </>
    );
  };

  const canOpenCell = (m: KitMember) => (
    <span className={styles.opens}>
      <span>{accessSummary(m.role, m.access)}</span>
      {overrideChips(m.access).map(c => (
        <span key={c.key} className={`${ck.chip} ${c.tone === 'on' ? ck.chipGood : ck.chipWarn}`}>{c.text}</span>
      ))}
    </span>
  );

  const statusCell = (m: KitMember) =>
    m.status === 'invited'
      ? `Invited ${dayLabel(m.invitedAt)}`
      : m.status === 'suspended'
        ? <span className={`${ck.chip} ${ck.chipWarn}`}>Suspended</span>
        : 'Active';

  /** The desktop table and the phone row list — one set of rows, two layouts (CSS picks). */
  const renderRows = (rows: KitMember[], caption: string) => (
    <>
      <div className={`${ck.tableFrame} ${styles.desk}`}>
        <table className={ck.table}>
          <caption className={styles.srOnly}>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Role</th>
              <th scope="col">What they can open</th>
              <th scope="col">Status</th>
              <th scope="col">Last sign-in</th>
              <th scope="col"><span className={styles.srOnly}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id} className={m.status === 'suspended' ? ck.rowMuted : undefined}>
                <td>{personCell(m)}</td>
                <td>{roleLabel(m.role)}</td>
                <td>{canOpenCell(m)}</td>
                <td>{statusCell(m)}</td>
                <td>{m.status === 'invited' ? '—' : dayLabel(m.lastSignIn)}</td>
                <td className={ck.actions}>
                  {canManageRow(m) && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setManageId(m.id)}>
                      Manage
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${ck.list} ${styles.phone}`} aria-label={caption}>
        {rows.map(m => {
          const isSelf = m.userId === user?.id;
          const line = m.status === 'invited'
            ? `${roleLabel(m.role)} · invited ${dayLabel(m.invitedAt)}`
            : `${roleLabel(m.role)} · ${accessShort(m.role, m.access)}${overrideChips(m.access).map(c => ` ${c.text}`).join('')}`;
          const body = (
            <>
              <span className={ck.rowMain}>
                <span className={ck.rowTitle}>
                  {memberName(m)}
                  {isSelf && <span className={ck.chip}>You</span>}
                  {m.status === 'suspended' && <span className={`${ck.chip} ${ck.chipWarn}`}>Suspended</span>}
                </span>
                <span className={ck.rowSub}>{line}</span>
              </span>
              {canManageRow(m) && <ChevronRight size={16} className={ck.rowEnd} aria-hidden />}
            </>
          );
          return canManageRow(m)
            ? <button key={m.id} type="button" className={ck.row} onClick={() => setManageId(m.id)} aria-label={`Manage ${memberName(m)}`}>{body}</button>
            : <div key={m.id} className={ck.row}>{body}</div>;
        })}
      </div>
    </>
  );

  return (
    <div className={ck.page}>
      <AdminPageHeader
        eyebrow={tournamentTier ? 'Tournament settings' : 'Organization'}
        title="Members"
        actions={
          <>
            {isOwner && (
              <Link href={auditHref} className={`btn btn-outline ${ck.iconOnlyPhone}`} aria-label="Audit log">
                <ScrollText size={15} aria-hidden /> <span className={ck.btnWord}>Audit log</span>
              </Link>
            )}
            <ExportMenu
              formats={['xlsx', 'csv']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              disabled={members.length === 0}
              planId={currentOrg.planId}
            />
            {canManage && (
              <button
                type="button"
                className={`btn btn-lime ${ck.iconOnlyPhone}`}
                onClick={() => setInviteOpen(true)}
                aria-label="Invite"
                id="members-invite-btn"
              >
                <UserPlus size={15} aria-hidden /> <span className={ck.btnWord}>Invite</span>
              </button>
            )}
          </>
        }
      />

      {notice && <PageNotice notice={notice} />}

      {seatLimited && (
        <p className={ck.lede}>
          <span className={ck.strong}>{seatCount} of {planCfg.seatLimit}</span> staff seats used
          {planCfg.officialsFreeSeats && scorekeepers.length > 0 ? ` · ${scorekeepers.length} scorekeeper${scorekeepers.length === 1 ? '' : 's'}, free on this plan` : ''}.
          {atSeatLimit && isOwner && <> <Link href={billingHref} className={ck.link}>Upgrade to add more</Link></>}
        </p>
      )}

      {listState === 'error' ? (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>
            The member list didn’t load.{' '}
            <button type="button" className={ck.link} onClick={() => { setListState('loading'); void loadMembers(); }}>Try again</button>
          </div>
        </div>
      ) : listState === 'loading' ? (
        <div className={ck.loading}>Loading…</div>
      ) : (
        <>
          <section className={ck.section} aria-labelledby="members-board">
            <div className={ck.sectionHead}>
              <span id="members-board" className={kit.eye}>The board · {board.length} {board.length === 1 ? 'person' : 'people'}</span>
            </div>
            {board.length <= 1 && scorekeepers.length === 0 && canManage && (
              <p className={ck.lede}>
                Nobody else is on the board yet.{' '}
                <button type="button" className={ck.link} onClick={() => setInviteOpen(true)}>Invite someone</button>{' '}
                so the work isn’t all yours.
              </p>
            )}
            {renderRows(board, 'The board')}
          </section>

          {scorekeepers.length > 0 && (
            <details className={ck.collapse}>
              <summary className={ck.collapseHead}>
                <span>
                  Scorekeepers · {scorekeepers.length}
                  <span className={ck.collapseNote}>
                    Volunteers who submit scores and check teams in.{planCfg.officialsFreeSeats ? ' Free on your plan.' : ''}
                  </span>
                </span>
                <ChevronRight size={16} className={ck.collapseChevron} aria-hidden />
              </summary>
              <div className={`${ck.collapseBody} ${styles.collapseRows}`}>{renderRows(scorekeepers, 'Scorekeepers')}</div>
            </details>
          )}

          {coaching.length > 0 && (
            <details className={ck.collapse}>
              <summary className={ck.collapseHead}>
                <span>
                  Coaching staff · {coaching.length}
                  <span className={ck.collapseNote}>Coaches are added and removed on each team’s staff page.</span>
                </span>
                <ChevronRight size={16} className={ck.collapseChevron} aria-hidden />
              </summary>
              <div className={ck.collapseBody}>
                <div className={ck.list} aria-label="Coaching staff">
                  {coaching.map(m => (
                    <div key={m.id} className={ck.row}>
                      <span className={ck.rowMain}>
                        <span className={ck.rowTitle}>{memberName(m)}</span>
                        <span className={ck.rowSub}>{m.displayName ? `${m.email} · ` : ''}Managed on the team’s staff page</span>
                      </span>
                    </div>
                  ))}
                </div>
                {planCarriesModule(currentOrg, 'module_rep_teams') && (
                  <p className={`${ck.lede} ${styles.collapseFoot}`}>
                    <Link href={`/${slug}/admin/rep-teams`} className={ck.link}>View by team</Link>
                  </p>
                )}
              </div>
            </details>
          )}

          <RoleGuide
            org={currentOrg}
            roles={roles}
            runsHouseLeague={shape.runsHouseLeague}
          />
        </>
      )}

      {inviteOpen && (
        <InviteMemberDialog
          orgName={currentOrg.name}
          orgQuery={orgQuery}
          noun={noun}
          roles={roles}
          rolesFailed={rolesFailed}
          onRetryRoles={() => void loadRoles()}
          billingHref={isOwner ? billingHref : null}
          onClose={() => setInviteOpen(false)}
          onInvited={(text) => {
            setInviteOpen(false);
            setNotice({ tone: 'good', text });
            void loadMembers();
          }}
        />
      )}

      {manageTarget && (
        <ManageMemberDialog
          member={manageTarget}
          org={currentOrg}
          orgQuery={orgQuery}
          noun={noun}
          viewerRole={userRole}
          isSelf={manageTarget.userId === user?.id}
          canManage={canManage}
          roles={roles}
          tournaments={tournaments}
          repGroups={repGroups}
          billingHref={isOwner ? billingHref : null}
          onClose={() => setManageId(null)}
          onChanged={async (text, closeDialog) => {
            if (closeDialog) setManageId(null);
            if (text) setNotice({ tone: 'good', text });
            await loadMembers();
          }}
        />
      )}
    </div>
  );
}
