'use client';
/**
 * DIVISIONS — Tournament admin redesign Stage 5 (E4, A50 record A, A52; F28, F88), built to hub v45, ruled 2026-10-10.
 *
 *   phone   one white frame, a row per division: its name, "Ages 9–11 · pools Red and Blue · registration open",
 *           and "6 of 6 · full" on the right — the good news it is, in the row's own ink (never red, Q 3.1)
 *   desk    a table (a column answers each question): Division · Ages · Pools · Registration ("Open · full") · Teams
 *           (the figure alone, right-aligned)
 *   foot    "18 of 18 spots taken"
 *
 * Every row opens the division's record (DivisionRecord): it reads first, the pencil edits all of it with autosave,
 * Delete ends it and asks once with what goes. Add division is the title band's button (a boxed + on a phone); it
 * opens the same window to create, with Cancel. Edit and Delete left the row (delete is never a row action), and so did
 * the browser's alert box. A completed event's divisions read only.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability } from '@/lib/roles';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { ClubRow, ClubRowList, EmptyCard, LoadFailed, repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { DIVISION_WORDS as W, agesLine, divisionCaption, teamsFigure } from '@/lib/division-words';
import { hasPlayoffs } from '@/lib/tournament-phase';
import DivisionRecord, { type DivisionMember, type DivisionRow } from './DivisionRecord';
import styles from './divisions.module.css';
import LoadingState from '@/components/shared/LoadingState';

/** Divisions' "?" — its own help topic (kept from before Stage 5: the only setup screen that had one). */
const DIVISIONS_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['divisions-and-pools'] };

export default function DivisionsPage() {
  const { currentTournament, isLocked } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Divisions');
  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug || 'admin'}/admin/tournaments`;
  const canWrite = !isLocked && Boolean(userRole && hasCapability(userRole, userCapabilities, 'create_tournaments'));

  const [groups, setGroups] = useState<DivisionRow[]>([]);
  const [members, setMembers] = useState<DivisionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const tournamentId = currentTournament?.id;
  const load = useCallback(async () => {
    if (!tournamentId) return;
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    try {
      const [groupsRes, membersRes] = await Promise.all([
        fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}&counts=1${orgParam}`, { cache: 'no-store' }),
        fetch(`/api/admin/members${orgQuery}`),
      ]);
      if (!groupsRes.ok) throw new Error('The divisions didn’t load.');
      setGroups(await groupsRes.json() as DivisionRow[]);
      const all = membersRes.ok ? await membersRes.json() as DivisionMember[] : [];
      setMembers(all
        .filter(m => ['owner', 'admin', 'staff'].includes(m.role))
        .sort((a, b) => (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email)));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The divisions didn’t load.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, orgSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own divisions
    setLoading(true);
    setOpenId(null);
    void load();
  }, [load]);

  const totalAccepted = groups.reduce((n, g) => n + (g.acceptedCount ?? 0), 0);
  const totalSpots = groups.reduce((n, g) => n + (g.capacity != null && g.capacity > 0 ? g.capacity : 0), 0);
  const allCapped = groups.length > 0 && groups.every(g => g.capacity != null && g.capacity > 0);
  const poolsOf = (g: DivisionRow) => (g.pools?.length ?? 0) >= 2 ? g.pools!.map(p => p.name) : [];
  const full = (g: DivisionRow) => g.capacity != null && g.capacity > 0 && (g.acceptedCount ?? 0) >= g.capacity;

  const idx = openId ? groups.findIndex(g => g.id === openId) : -1;
  const open = idx >= 0 ? groups[idx] : null;

  const addButton = canWrite && tournamentId ? (
    <button
      type="button"
      className={`btn btn-outline btn-data ${screenParts.headerButton}`}
      onClick={() => setCreating(true)}
      aria-label={W.add}
      title={W.add}
      aria-haspopup="dialog"
    >
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{W.add}</span>
    </button>
  ) : null;

  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={W.title}
        inlineActions
        actions={<>{addButton}<HelpButton help={DIVISIONS_HELP} label={W.title} iconOnly /></>}
      />

      {!tournamentId ? null : error && groups.length === 0 ? (
        <LoadFailed title={error} onRetry={() => { setLoading(true); void load(); }} />
      ) : loading ? (
        <LoadingState label="Loading divisions…" />
      ) : groups.length === 0 ? (
        <EmptyCard
          title={W.none}
          action={canWrite ? <button type="button" className="btn btn-outline" onClick={() => setCreating(true)}>{W.add}</button> : undefined}
        >
          {W.noneLine}
        </EmptyCard>
      ) : (
        <>
          <div className={repKit.phoneOnly}>
            <ClubRowList label={W.title}>
              {groups.map(g => (
                <ClubRow
                  key={g.id}
                  as="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpenId(g.id)}
                  title={g.name}
                  caption={divisionCaption({ minAge: g.minAge, maxAge: g.maxAge, poolNames: poolsOf(g), isClosed: Boolean(g.isClosed) })}
                  trail={<span className={styles.figure}>{teamsFigure(g.acceptedCount ?? 0, g.capacity)}</span>}
                  chevron
                />
              ))}
            </ClubRowList>
          </div>
          <div className={`${repKit.deskOnly} ${repKit.tableFrame}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">{W.colDivision}</th>
                  <th scope="col">{W.colAges}</th>
                  <th scope="col">{W.colPools}</th>
                  <th scope="col">{W.colRegistration}</th>
                  <th scope="col" className={repKit.num}>{W.colTeams}</th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className={repKit.rowOpens} onClick={() => setOpenId(g.id)}>
                    <td>
                      <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                        onClick={ev => { ev.stopPropagation(); setOpenId(g.id); }}>{g.name}</button>
                    </td>
                    <td className={repKit.dim}>{agesLine(g.minAge, g.maxAge) ?? '—'}</td>
                    <td className={repKit.dim}>{poolsOf(g).length ? poolsOf(g).join(' · ') : '—'}</td>
                    <td className={repKit.dim}>{[g.isClosed ? W.registrationClosed : W.registrationOpen, full(g) ? 'full' : null].filter(Boolean).join(' · ')}</td>
                    <td className={repKit.num}>{g.capacity != null && g.capacity > 0 ? `${g.acceptedCount ?? 0} of ${g.capacity}` : g.acceptedCount ?? 0}</td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.foot}>{allCapped ? W.spotsTaken(totalAccepted, totalSpots) : W.teamsAccepted(totalAccepted)}</p>
        </>
      )}

      {currentTournament && (open || creating) && (
        <DivisionRecord
          division={creating ? null : open}
          base={base}
          orgSlug={orgSlug}
          tournament={{
            id: currentTournament.id,
            settings: currentTournament.settings,
            sport: currentTournament.sport ?? null,
            exhibition: !hasPlayoffs(currentTournament),
          }}
          members={members}
          canWrite={canWrite}
          order={creating ? groups.length + 1 : open?.order ?? idx + 1}
          prev={idx > 0 ? { id: groups[idx - 1].id, name: groups[idx - 1].name } : null}
          next={idx >= 0 && idx < groups.length - 1 ? { id: groups[idx + 1].id, name: groups[idx + 1].name } : null}
          position={`${idx + 1} of ${groups.length}`}
          onStep={id => setOpenId(id)}
          onClose={() => { setOpenId(null); setCreating(false); }}
          onChanged={load}
        />
      )}
    </div>
  );
}
