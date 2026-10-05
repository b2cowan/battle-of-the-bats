'use client';
/**
 * Rep Teams › Teams — THE FRANCHISE HEALTH BOARD (Club Tier Stage 2, specimen 1; hub v15, Ask 5 as
 * drawn). One row per team, one rule per number (B08), and the one thing only the club can fix — a
 * team with no head coach, a live season with nobody on it — in red, in its own row (J4-006, J4-008,
 * J4-035). It replaced a grid of cards whose roster added up every season a team ever had.
 *
 * Built to the Coaches Portal benchmark (plan §6 "Across every stage — formatting"):
 *   · the header carries the page's one create, lime, with the team-cap window (Stage 1b);
 *   · the toolbar: a lede that is a count, never a verdict; Team groups, Rename team URLs and the
 *     group filter (with Ungrouped — B06, fixed in Stage 0) pinned right. The five door tiles are gone:
 *     the rail carries every one of them (and the phone's "In Rep Teams" row);
 *   · the table: display-face uppercase headings in secondary ink (NOT the admin restyle's S2-06
 *     override), figures right with their headings, groups as band rows, the NAME is the link, the
 *     whole row opens (owner 2026-09-29) and ONE chevron closes it — no links or buttons in cells
 *     (owner ruling 2026-09-28);
 *   · at ≤ 640 the table becomes white cards with a corner chevron (it does not fit a phone);
 *   · the Upcoming bills panel LEFT this page (Club Tier Stage 3a, Ask 2): its lanes are Accounting ›
 *     Allocations › Coming due and Accounting › Payment requests. A team's money with the club is on its
 *     own page ("With the club"); the board gains a money column with 3b.
 * ⚠ Departure, told at build time: an "Archived" choice joins the group filter. The drawing shows no
 * way to reach an archived team, and its page is where "Bring back" lives (specimen 2).
 */
import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Layers, Link2, Plus, Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import { CoachListToolbar } from '@/components/coaches/kit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowList, EmptyCard, LoadFailed, PageLoading, RepChip, repKit,
  useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import TeamGroupsSection from '@/components/admin/kit/club/TeamGroupsSection';
import {
  boardBands, boardLede, boardPhoneLine, boardSeasonCell, documentsText, headCoachCell, isEmptyLiveRoster,
  nextEventLines,
} from '@/lib/club-board-view';
import type { ClubBoardRow } from '@/lib/club-team-board';
import type { RepTeam, RepTeamGroup } from '@/lib/types';

const AddTeamDialog = dynamic(() => import('@/components/admin/kit/club/AddTeamDialog'));

interface BoardTeam { team: RepTeam; board: ClubBoardRow }
/** The filter's special values beside a group id. */
const ALL = '';
const UNGROUPED = 'none';
const ARCHIVED = 'archived';

export default function RepTeamsBoardPage() {
  const { currentOrg, user, userRole, loading: orgLoading } = useOrg();
  usePageTitle('Rep Teams');
  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug}/admin/rep-teams`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [teams, setTeams] = useState<BoardTeam[]>([]);
  const [groups, setGroups] = useState<RepTeamGroup[]>([]);
  const [filter, setFilter] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!orgSlug) return;
    const current = beginRead();
    setLoadError(null);
    try {
      const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
      // Every team, archived ones included: the group counts (a group holding an archived team can't
      // be deleted) and the Archived filter read the same list the board draws from.
      const [teamsRes, groupsRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/teams?archived=true&${q}`, { cache: 'no-store' }),
        fetch(`/api/admin/rep-teams/groups?${q}`, { cache: 'no-store' }),
      ]);
      const teamsData = await teamsRes.json().catch(() => ({}));
      if (!teamsRes.ok) throw new Error(teamsData.error ?? 'The teams could not be loaded.');
      const groupsData = await groupsRes.json().catch(() => ({}));
      if (!current()) return;
      setTeams(((teamsData.teams ?? []) as BoardTeam[]).filter(t => t.board));
      setGroups(Array.isArray(groupsData.groups) ? groupsData.groups : []);
    } catch (e) {
      if (current()) setLoadError(e instanceof Error ? e.message : 'The teams could not be loaded.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [orgSlug, beginRead]);

  useDeferredLoad(!orgLoading && !!orgSlug, load);

  const active = useMemo(() => teams.filter(t => !t.team.isArchived), [teams]);
  const shown = useMemo(() => {
    if (filter === ARCHIVED) return teams.filter(t => t.team.isArchived);
    if (filter === UNGROUPED) return active.filter(t => !t.team.groupId);
    if (filter) return active.filter(t => t.team.groupId === filter);
    return active;
  }, [teams, active, filter]);
  // Each group's teams, archived ones apart: the board's bands count active teams, and the groups
  // window must agree with them, while a delete is refused for an archived team too (/review).
  const groupCounts = useMemo(() => {
    const m = new Map<string, { active: number; archived: number }>();
    for (const t of teams) {
      if (!t.team.groupId) continue;
      const c = m.get(t.team.groupId) ?? { active: 0, archived: 0 };
      if (t.team.isArchived) c.archived += 1; else c.active += 1;
      m.set(t.team.groupId, c);
    }
    return m;
  }, [teams]);
  const viewerId = user?.id ?? null;
  const bands = useMemo(
    () => boardBands(
      shown.map(t => ({ ...t, groupId: t.team.groupId, view: rowView(t.board, viewerId) })),
      groups.map(g => ({ id: g.id, name: g.name })),
    ),
    [shown, groups, viewerId],
  );

  const limit = currentOrg && currentOrg.teamLimit < 9999 ? currentOrg.teamLimit : null;
  const lede = boardLede({ teams: active.length, groups: groups.length, used: active.length, limit });
  const hasArchived = teams.some(t => t.team.isArchived);

  const header = (
    // No eyebrow: the club's name is already in the bar above (owner, 2026-10-01).
    <AdminPageHeader
      title="Rep Teams"
      actions={canWrite ? (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setAdding(true)} aria-label="Add team">
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add team</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} />;

  return (
    <div className={repKit.page}>
      {header}
      {notice && <PageNotice notice={notice} />}
      {loadError && <LoadFailed title="We couldn’t load your teams." onRetry={() => { setLoading(true); void load(); }} />}

      {!loadError && (
        <CoachListToolbar
          lede={lede}
          actions={
            <>
              {/* Icon-only on a phone (the mobile admin rule); the label stays for a reader. */}
              {canWrite && (
                <button type="button" className={`btn btn-ghost ${ck.iconOnlyPhone}`} onClick={() => setGroupsOpen(o => !o)} aria-expanded={groupsOpen} aria-label="Team groups">
                  <Layers size={14} aria-hidden /><span className={ck.btnWord}>Team groups</span>
                </button>
              )}
              {canWrite && (
                <Link href={`${base}/rename-slugs`} className={`btn btn-ghost ${ck.iconOnlyPhone}`} aria-label="Rename team URLs">
                  <Link2 size={14} aria-hidden /><span className={ck.btnWord}>Rename team URLs</span>
                </Link>
              )}
              {(groups.length > 0 || hasArchived) && (
                <select
                  className={`${ck.select} ${ck.toolbarSelect}`}
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  aria-label="Show teams in"
                  style={{ width: 'auto' }}
                >
                  <option value={ALL}>All groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  {groups.length > 0 && <option value={UNGROUPED}>Ungrouped</option>}
                  {hasArchived && <option value={ARCHIVED}>Archived</option>}
                </select>
              )}
            </>
          }
        />
      )}

      {groupsOpen && canWrite && (
        <TeamGroupsSection
          orgSlug={orgSlug}
          groups={groups}
          teamCounts={groupCounts}
          onClose={() => setGroupsOpen(false)}
          onError={text => setNotice({ tone: 'bad', text })}
          onChanged={async deletedId => {
            if (deletedId && filter === deletedId) setFilter(ALL);
            await load();
          }}
        />
      )}

      {!loadError && active.length === 0 && filter === ALL && (
        <EmptyCard
          icon={<Users size={20} aria-hidden />}
          title="Add your first team"
          action={canWrite ? <button type="button" className="btn btn-lime" onClick={() => setAdding(true)}>Add team</button> : undefined}
        >
          Each rep team gets its own Coaches Portal. The club names its coaches, starts and closes its seasons, and reads how every team is doing here.
        </EmptyCard>
      )}

      {!loadError && shown.length === 0 && filter !== ALL && (
        <p className={repKit.notes}>No teams here. Choose another group to see them.</p>
      )}

      {!loadError && shown.length > 0 && (
        <>
          <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Season</th>
                  <th scope="col">Head coach</th>
                  <th scope="col" className={repKit.num}>Roster</th>
                  <th scope="col">Next event</th>
                  <th scope="col" className={repKit.num}>Documents</th>
                  <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                </tr>
              </thead>
              <tbody>
                {bands.map(band => (
                  <BandRows key={band.key} label={band.label} rows={band.rows} base={base} />
                ))}
              </tbody>
            </table>
          </div>

          <div className={repKit.phoneOnly}>
            <ClubRowList label="Teams">
              {bands.map(band => (
                <PhoneBand key={band.key} label={band.label} rows={band.rows} base={base} />
              ))}
            </ClubRowList>
          </div>
        </>
      )}

      {adding && currentOrg && (
        <AddTeamDialog
          orgSlug={orgSlug}
          org={currentOrg}
          isOwner={userRole === 'owner'}
          groups={groups}
          defaultGroupId={filter && filter !== UNGROUPED && filter !== ARCHIVED ? filter : null}
          onClose={() => setAdding(false)}
          onCreated={async team => {
            setAdding(false);
            setNotice({
              tone: 'good',
              text: `${team.name} added. Start its first season and invite its head coach from its page.`,
              link: team.id ? { href: `${base}/teams/${team.id}`, label: `Open ${team.name}` } : undefined,
            });
            await load();
          }}
        />
      )}
    </div>
  );
}

/** A row's cells, derived once for both the table and the phone's cards. */
function rowView(board: ClubBoardRow, viewerId: string | null) {
  return {
    season: boardSeasonCell(board.season),
    coach: headCoachCell(board, viewerId),
    next: board.nextEvent ? nextEventLines(board.nextEvent) : null,
    docs: documentsText(board),
    noPlayers: isEmptyLiveRoster(board),
  };
}

type Row = BoardTeam & { groupId: string | null; view: ReturnType<typeof rowView> };

/** One band of the desktop table: its band row (when the club has groups), then its teams. The whole
 *  row opens the team (standard §3.6, owner 2026-09-29): the name stays the real link — the keyboard's,
 *  a reader's, a new tab's — and the row is the pointer shortcut on top of it; a click that ends a text
 *  selection is a copy gesture, not a door. */
function BandRows({ label, rows, base }: { label: string; rows: Row[]; base: string }) {
  const router = useRouter();
  return (
    <>
      {label && (
        <tr className={repKit.band}>
          <td colSpan={7}>{label}</td>
        </tr>
      )}
      {rows.map(({ team, board, view: { season, coach, next, docs, noPlayers } }) => {
        const href = `${base}/teams/${team.id}`;
        return (
          <tr key={team.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
            <td>
              <span className={repKit.nameCell}>
                {team.color && <i className={repKit.swatch} style={{ background: team.color }} aria-hidden />}
                <Link href={href} className={repKit.nameLink} onClick={e => { e.stopPropagation(); if (window.getSelection()?.toString()) e.preventDefault(); }}>{team.name}</Link>
                {team.isArchived && <RepChip>Archived</RepChip>}
              </span>
              {team.division && <span className={repKit.cellSub}>{team.division}</span>}
            </td>
            <td>
              {season ? (
                <>
                  <RepChip tone={season.tone}>{season.chip}</RepChip>
                  <span className={repKit.cellSub}>{season.caption}</span>
                </>
              ) : <span className={repKit.dim}>No season yet</span>}
            </td>
            <td>
              {coach.kind === 'people' && (
                <>{coach.names.join(', ')}{coach.you && <> <RepChip>You</RepChip></>}</>
              )}
              {coach.kind === 'invited' && (
                <><RepChip tone="warn">Invited</RepChip><span className={repKit.cellSub}>{coach.email}</span></>
              )}
              {coach.kind === 'none' && !team.isArchived && <RepChip tone="bad">No head coach</RepChip>}
              {coach.kind === 'none' && team.isArchived && <span className={repKit.dim}>—</span>}
            </td>
            <td className={repKit.num}>
              {noPlayers ? <RepChip tone="bad">No players</RepChip>
                : board.rosterCount == null ? <span className={repKit.dim}>—</span>
                : board.rosterCount}
            </td>
            <td>
              {next ? <>{next.day}<span className={repKit.cellSub}>{next.line}</span></> : <span className={repKit.dim}>—</span>}
            </td>
            <td className={`${repKit.num}${docs ? '' : ` ${repKit.dim}`}`}>{docs ?? '—'}</td>
            <td className={repKit.go}>
              {/* The row's mark, not a second door: the row is the pointer's target, the name the keyboard's. */}
              <span className={repKit.goLink} aria-hidden>
                <ChevronRight size={16} />
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** One band as the phone's white cards: name + the one state chip, one quiet line, a corner chevron. */
function PhoneBand({ label, rows, base }: { label: string; rows: Row[]; base: string }) {
  return (
    <>
      {label && <ClubRowBand>{label}</ClubRowBand>}
      {rows.map(({ team, board, view: { season, coach, next, noPlayers } }) => {
        // The ONE state chip a card carries: what only the club can fix comes first.
        const chip = team.isArchived ? <RepChip>Archived</RepChip>
          : coach.kind === 'none' ? <RepChip tone="bad">No head coach</RepChip>
          : noPlayers ? <RepChip tone="bad">No players</RepChip>
          : coach.kind === 'invited' ? <RepChip tone="warn">Invited</RepChip>
          : season ? <RepChip tone={season.tone}>{season.chip}</RepChip> : null;
        const who = coach.kind === 'people' ? (coach.you ? 'You' : coach.names.join(', ')) : null;
        const line = boardPhoneLine({
          coach: who,
          roster: board.rosterCount,
          nextDay: next?.day ?? null,
        });
        return (
          <ClubRow
            key={team.id}
            as="link"
            href={`${base}/teams/${team.id}`}
            title={<>{team.name} {chip}</>}
            caption={line || undefined}
            chevron
          />
        );
      })}
    </>
  );
}
