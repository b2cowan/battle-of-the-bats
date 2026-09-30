'use client';

/**
 * Shared gate / team check-in board. Used by the admin Check-in page and the
 * gate-volunteer surface. Takes orgSlug + tournamentId by prop (no admin
 * contexts) so it works inside or outside the admin shell.
 *
 * Tournament admin redesign Stage 1 · G7 (hub v5, ruled 2026-09-29) — the organizer's board and the
 * gate volunteer's are THIS board, so every change here reaches the gate:
 *   · the filter is the gate's own bucket bar (All · Not arrived · Checked in · No-show — single
 *     choice, All first and the default): inline at the top of the organizer's board, pinned at the
 *     bottom of the gate's phone (owner Option C, 2026-08-07). The three count tiles and the 24px
 *     segmented filter are gone — the bar's counts ARE the scoreboard;
 *   · payment is not a bucket: "N of M teams still owe" is a count under the bar, and each row says
 *     what it owes ("Owes $475" amber — money owed; "Paid" plain);
 *   · a row carries ONE worded Check in (olive on white, A12) beside its chevron (A11 Option 1), or a
 *     worded Undo once the team is in or a no-show; the row opens the team's sheet, where No-show now
 *     lives (twin person icons one mis-tap apart were F11). The sheet is unchanged; its big Check in is
 *     the screen's one lime;
 *   · a phone draws one frame with the divisions as band rows; a desk draws a table (Team · Roster ·
 *     Payment) with the divisions as band rows;
 *   · it stays current by itself (G6): every 30 s while visible, never while a team's sheet is open or
 *     an action is in flight.
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { usePathname } from 'next/navigation';
import { UserCheck, UserX, RotateCcw, Search, DollarSign, ClipboardList, Plus, Trash2, Check, ChevronRight } from 'lucide-react';
import BottomSheet from '@/components/admin/BottomSheet';
import { DayOfFilterBar, DayOfFilterButton } from '@/components/volunteer/DayOfBottomBars';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, RepChip, RowAction, repKit } from '@/components/admin/kit/club/RepKit';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { formatTime } from '@/lib/utils';
import { formatInOrgZone } from '@/lib/timezone';
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll';
import styles from './CheckInBoard.module.css';

const FETCH: RequestInit = { credentials: 'same-origin' };

type RosterPlayer = { id?: string; name: string; jerseyNumber: string | null; dateOfBirth: string | null; position: string | null };
type CheckInStatus = 'not_arrived' | 'checked_in' | 'no_show';
type CheckInTeam = {
  id: string;
  name: string;
  divisionId: string;
  paymentStatus: 'pending' | 'paid';
  depositPaid: number | null;
  totalPaid: number | null;
  checkInStatus: CheckInStatus;
  checkedInAt: string | null;
  checkedInByName: string | null;
  rosterSubmittedAt: string | null;
  rosterConfirmedAt: string | null;
  paymentCollectedAt: string | null;
  checkInNotes: string | null;
  roster: RosterPlayer[];
};
type DivInfo = { id: string; name: string; fee: number | null };

function formatMoney(v: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);
}
/** "9:58 a.m." — an instant's clock in the org's zone, in the house spelling (it used to print the
 *  device's own "9:58 AM", in the device's zone). */
function timeOf(iso: string | null) {
  if (!iso) return '';
  return formatTime(formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' }));
}

const STATUS_META: Record<CheckInStatus, { label: string }> = {
  not_arrived: { label: 'Not arrived' },
  checked_in: { label: 'Checked in' },
  no_show: { label: 'No-show' },
};

/** The local patch to apply optimistically for an action (mirrors the server write). */
function optimisticPatch(act: string, now: string, extra?: Record<string, unknown>): Partial<CheckInTeam> {
  switch (act) {
    case 'check_in': return { checkInStatus: 'checked_in', checkedInAt: now };
    case 'no_show': return { checkInStatus: 'no_show', checkedInAt: null };
    case 'undo': return { checkInStatus: 'not_arrived', checkedInAt: null, checkedInByName: null };
    case 'mark_paid': return { paymentStatus: 'paid', paymentCollectedAt: now };
    case 'unmark_paid': {
      // J8-016: optimistic restore of the prior amounts the caller captured.
      const prior = extra?.prior as Partial<CheckInTeam> | undefined;
      return {
        paymentStatus: prior?.paymentStatus === 'paid' ? 'paid' : 'pending',
        depositPaid: typeof prior?.depositPaid === 'number' ? prior.depositPaid : 0,
        totalPaid: typeof prior?.totalPaid === 'number' ? prior.totalPaid : 0,
        paymentCollectedAt: typeof prior?.paymentCollectedAt === 'string' ? prior.paymentCollectedAt : null,
      };
    }
    case 'confirm_roster': return { rosterConfirmedAt: now };
    case 'save_gate_roster': {
      const players = (extra?.players as Array<{ name?: string; jerseyNumber?: string; dateOfBirth?: string; position?: string }> | undefined) ?? [];
      const roster: RosterPlayer[] = players
        .map(p => ({ name: (p.name ?? '').trim(), jerseyNumber: p.jerseyNumber || null, dateOfBirth: p.dateOfBirth || null, position: p.position || null }))
        .filter(p => p.name.length > 0);
      return { roster, rosterSubmittedAt: now, rosterConfirmedAt: now };
    }
    default: return {};
  }
}

/** The team's roster fact, as the row says it. */
function rosterFact(team: CheckInTeam) {
  return team.rosterConfirmedAt ? `Roster ✓ ${team.roster.length}` : team.roster.length > 0 ? `Roster · ${team.roster.length}` : 'No roster';
}

/** The team's payment fact: what it owes in the amber of money owed, or a plain "Paid". */
function PaymentFact({ team, fee }: { team: CheckInTeam; fee: number | null }) {
  if (team.paymentStatus === 'paid') return <span>Paid</span>;
  return <span className={styles.owes}>{fee ? `Owes ${formatMoney(fee)}` : 'Unpaid'}</span>;
}

/** Where the team is: in at a time, or a no-show; nothing while it has not arrived. */
function ArrivalChip({ team }: { team: CheckInTeam }) {
  if (team.checkInStatus === 'checked_in') {
    return <span className={styles.inChip}>{team.checkedInAt ? GAME_DAY_WORDS.arrivedAt(timeOf(team.checkedInAt)) : STATUS_META.checked_in.label}</span>;
  }
  if (team.checkInStatus === 'no_show') return <RepChip tone="bad">{STATUS_META.no_show.label}</RepChip>;
  return null;
}

/** The row's one worded action: Check in while the team has not arrived, Undo once it has (or no-showed). */
function ArrivalAction({ team, disabled, onCheckIn, onUndo }: {
  team: CheckInTeam;
  disabled: boolean;
  onCheckIn: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  return team.checkInStatus === 'not_arrived' ? (
    <RowAction onClick={e => { e.stopPropagation(); onCheckIn(team.id); }} disabled={disabled} icon={<Check size={14} aria-hidden />}>
      {GAME_DAY_WORDS.checkIn}
    </RowAction>
  ) : (
    <RowAction
      quiet
      onClick={e => { e.stopPropagation(); onUndo(team.id); }}
      disabled={disabled}
      aria-label={`${GAME_DAY_WORDS.undo} — reset ${team.name} to not arrived`}
    >
      {GAME_DAY_WORDS.undo}
    </RowAction>
  );
}

type RowProps = {
  team: CheckInTeam;
  fee: number | null;
  locked: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onCheckIn: (id: string) => void;
  onUndo: (id: string) => void;
};

/** A phone row (the frame's): the name, its facts, the action beside the chevron. Memoized: re-renders
 *  only when its own team object changes (the optimistic update gives only the acted-on team a new
 *  reference). */
const PhoneRow = memo(function PhoneRow({ team, fee, locked, busy, onOpen, onCheckIn, onUndo }: RowProps) {
  const arrived = team.checkInStatus !== 'not_arrived';
  return (
    <ClubRow
      as="button"
      onClick={() => onOpen(team.id)}
      aria-haspopup="dialog"
      title={team.name}
      caption={
        <span className={styles.facts}>
          {arrived && <><ArrivalChip team={team} /><span aria-hidden> · </span></>}
          {rosterFact(team)} · <PaymentFact team={team} fee={fee} />
        </span>
      }
      chevron
      beside={<ArrivalAction team={team} disabled={locked || busy} onCheckIn={onCheckIn} onUndo={onUndo} />}
    />
  );
});

/** A desk row (the table's): the name opens the team's sheet, as does the whole row. */
const DeskRow = memo(function DeskRow({ team, fee, locked, busy, onOpen, onCheckIn, onUndo }: RowProps) {
  return (
    <tr className={repKit.rowOpens} onClick={() => onOpen(team.id)}>
      <td>
        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink} ${styles.deskName}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(team.id); }}>
          {team.name}
        </button>
      </td>
      <td className={repKit.dim}>{rosterFact(team)}</td>
      <td><PaymentFact team={team} fee={fee} /></td>
      <td className={styles.actionCell}>
        <span className={styles.actionCellInner}>
          <ArrivalChip team={team} />
          <ArrivalAction team={team} disabled={locked || busy} onCheckIn={onCheckIn} onUndo={onUndo} />
        </span>
      </td>
      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
    </tr>
  );
});

export default function CheckInBoard({ orgSlug, tournamentId, locked, pinnedFilters = false }: {
  orgSlug: string;
  tournamentId: string;
  locked: boolean;
  /**
   * Host opt-in: the arrival bar rides the day-of shell's pinned bottom bar (phone only — above 640px
   * it renders in the flow either way). The gate volunteer's shell passes it; the organizer's board,
   * which carries the admin's own bottom nav, draws the bar inline at the top instead.
   */
  pinnedFilters?: boolean;
}) {
  const [teams, setTeams] = useState<CheckInTeam[]>([]);
  const [divisions, setDivisions] = useState<DivInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // WI-3: true when the last failure was a 401 (session lapsed) — drives a "sign back in" link
  // instead of a generic "Action failed." dead end. Works from both mount routes (gate + admin).
  const [authLost, setAuthLost] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [divFilter, setDivFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CheckInStatus>('all');
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';

  const pathname = usePathname();
  // next= returns the volunteer to the same check-in surface after re-auth (works from the gate
  // route and the admin route alike, since it reads the live pathname).
  const signInHref = `/auth/login?next=${encodeURIComponent(pathname || `/${orgSlug}/check-in`)}`;

  // WI-3: one place to raise the session-lapsed banner (load + action both hit it on a 401).
  const markAuthLost = useCallback(() => {
    setAuthLost(true);
    setError('Signed out — sign back in to continue check-in.');
  }, []);

  // Only the newest read may paint: a refresh already in flight when a volunteer taps Check in (`action`
  // bumps this) or overtaken by a newer read would otherwise put the team back to "not arrived".
  const loadSeqRef = useRef(0);
  /** The tournament whose divisions are on screen — a refresh skips them once they are. */
  const divisionsForRef = useRef<string | null>(null);
  const loadBoard = useCallback(async (silent = false) => {
    if (!tournamentId) return;
    const seq = ++loadSeqRef.current;
    const current = () => seq === loadSeqRef.current;
    if (!silent) setLoading(true);
    // A silent revert-reload after an action failure must NOT wipe the failure message that's
    // already on screen — only a fresh (non-silent) load starts clean.
    if (!silent) { setError(null); setAuthLost(false); }
    try {
      const tid = encodeURIComponent(tournamentId);
      // The divisions don't change on game day: once they are on screen, a silent read (the refresh, a
      // revert) takes the board only.
      const withDivisions = !silent || divisionsForRef.current !== tournamentId;
      const [boardRes, divRes] = await Promise.all([
        fetch(`/api/admin/check-in?tournamentId=${tid}${orgParam}`, FETCH),
        withDivisions ? fetch(`/api/admin/divisions?tournamentId=${tid}${orgParam}`, FETCH) : null,
      ]);
      if (boardRes.status === 401) {
        markAuthLost();
        return;
      }
      if (!boardRes.ok) throw new Error((await boardRes.json().catch(() => ({})))?.error || 'Could not load check-in.');
      const board = await boardRes.json();
      const divs = divRes?.ok ? await divRes.json() : [];
      if (!current()) return;
      setTeams(board.teams ?? []);
      if (divRes) {
        divisionsForRef.current = tournamentId;
        setDivisions((Array.isArray(divs) ? divs : []).map((d: { id: string; name: string; totalFeeAmount?: number | null }) => ({ id: d.id, name: d.name, fee: d.totalFeeAmount ?? null })));
      }
    } catch (e) {
      // A failed background refresh keeps the board as it is; the next tick tries again.
      if (!silent && current()) setError(e instanceof Error ? e.message : 'Could not load check-in.');
    } finally {
      // The read that paints ends the loading line (a silent one too, when it overtook the first read).
      if (current()) setLoading(false);
    }
  }, [tournamentId, orgParam, markAuthLost]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  // G6 · game day stays current: a second gate volunteer's check-in reaches this board within 30 s,
  // with no reload — while the page is visible, and never while a team's sheet is open or an action
  // is in flight (a refresh would move the team the volunteer has in hand).
  useVisiblePoll(() => { void loadBoard(true); }, {
    enabled: Boolean(tournamentId),
    paused: sheetId !== null || busyId !== null,
  });

  const divMap = useMemo(() => new Map(divisions.map(d => [d.id, d])), [divisions]);

  // Optimistic: flip just the affected team locally and persist in the background.
  // Only the changed team gets a new object reference, so memoized rows for every
  // other team skip re-rendering. On failure we silently resync to server truth.
  const action = useCallback(async (act: string, teamId: string, extra?: Record<string, unknown>) => {
    if (!tournamentId) return;
    const patch = optimisticPatch(act, new Date().toISOString(), extra);
    loadSeqRef.current++; // a read already in flight predates this change — it must not paint over it
    setBusyId(teamId);
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...patch } : t));
    try {
      const res = await fetch(`/api/admin/check-in?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ action: act, teamId, ...extra }),
      });
      if (res.status === 401) {
        // WI-3: a lapsed session mid-action is recoverable — surface the sign-in link, then revert
        // the optimistic flip to server truth (the silent reload leaves this message in place).
        markAuthLost();
        void loadBoard(true);
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Action failed.');
      // A successful action proves the session recovered — clear any lingering "signed out" / failure
      // banner (otherwise only a non-silent load clears it, and that never re-runs after mount). Both
      // setters no-op via React's bail-out when already clear, so no dependency on the current values.
      setError(null);
      setAuthLost(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
      void loadBoard(true); // revert optimistic change to server truth (keeps the message visible)
    } finally {
      setBusyId(null);
    }
  }, [tournamentId, orgParam, loadBoard, markAuthLost]);

  const openTeam = useCallback((id: string) => setSheetId(id), []);
  const quickCheckIn = useCallback((id: string) => { void action('check_in', id); }, [action]);
  const quickUndo = useCallback((id: string) => { void action('undo', id); }, [action]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter(t =>
      (divFilter === 'all' || t.divisionId === divFilter) &&
      (statusFilter === 'all' || t.checkInStatus === statusFilter) &&
      (!q || t.name.toLowerCase().includes(q)),
    );
  }, [teams, search, divFilter, statusFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, CheckInTeam[]>();
    for (const t of filtered) {
      const list = m.get(t.divisionId) ?? [];
      list.push(t); m.set(t.divisionId, list);
    }
    return Array.from(m.entries()).sort((a, b) => (divMap.get(a[0])?.name ?? '').localeCompare(divMap.get(b[0])?.name ?? ''));
  }, [filtered, divMap]);

  // Every team's arrival in one division, whatever the filter — the band's "2 of 6 in".
  const inByDivision = useMemo(() => {
    const m = new Map<string, { in: number; total: number }>();
    for (const t of teams) {
      const c = m.get(t.divisionId) ?? { in: 0, total: 0 };
      c.total++;
      if (t.checkInStatus === 'checked_in') c.in++;
      m.set(t.divisionId, c);
    }
    return m;
  }, [teams]);
  const owing = useMemo(() => teams.filter(t => t.paymentStatus !== 'paid').length, [teams]);

  const sheetTeam = sheetId ? teams.find(t => t.id === sheetId) ?? null : null;

  const ARRIVAL_FILTERS = ['all', 'not_arrived', 'checked_in', 'no_show'] as const;
  const arrivalLabel = (k: (typeof ARRIVAL_FILTERS)[number]) => (k === 'all' ? 'All' : STATUS_META[k].label);
  // How many teams each bucket holds — the bar leads on the count on a phone, because it is where the
  // numbers live (the count tiles are gone).
  const arrivalCount = (k: (typeof ARRIVAL_FILTERS)[number]) =>
    k === 'all' ? teams.length : teams.filter(t => t.checkInStatus === k).length;
  const bandCount = (divId: string) => {
    const c = inByDivision.get(divId);
    return c ? `${c.in} of ${c.total} in` : '';
  };
  const rowProps = (t: CheckInTeam): RowProps => ({
    team: t,
    fee: divMap.get(t.divisionId)?.fee ?? null,
    locked,
    busy: busyId === t.id,
    onOpen: openTeam,
    onCheckIn: quickCheckIn,
    onUndo: quickUndo,
  });

  return (
    <>
      <div className={styles.toolbar}>
        {/* The gate's own bucket bar — inline here, pinned to a phone's foot on the gate. */}
        <DayOfFilterBar label="Arrival filter" inline={!pinnedFilters}>
          {ARRIVAL_FILTERS.map(k => (
            <DayOfFilterButton
              key={k}
              label={arrivalLabel(k)}
              count={arrivalCount(k)}
              active={statusFilter === k}
              onClick={() => setStatusFilter(k)}
            />
          ))}
        </DayOfFilterBar>
        {teams.length > 0 && (
          <p className={styles.owe}>{owing > 0 ? GAME_DAY_WORDS.stillOwe(owing, teams.length) : GAME_DAY_WORDS.allPaid}</p>
        )}
        <div className={styles.narrow}>
          <label className={styles.selectField}>
            <span className="sr-only">Division</span>
            <select className={styles.select} value={divFilter} onChange={e => setDivFilter(e.target.value)}>
              <option value="all">All divisions</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {/* Search: always a field at a desk; behind its icon on a phone until opened (or in use). */}
          <button
            type="button"
            className={styles.searchToggle}
            aria-label="Search teams"
            aria-expanded={searchOpen || search !== ''}
            data-on={searchOpen || search !== '' || undefined}
            onClick={() => setSearchOpen(o => !o)}
          >
            <Search size={18} aria-hidden />
          </button>
          <label className={styles.searchWrap} data-open={searchOpen || search !== '' || undefined}>
            <span className="sr-only">Search teams</span>
            <Search size={15} className={styles.searchIcon} aria-hidden />
            <input className={styles.search} type="search" placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          {authLost && <a href={signInHref} className={styles.errorAction}>Sign in</a>}
        </div>
      )}
      {loading && <div className={styles.loading}>Loading check-in…</div>}

      {!loading && filtered.length === 0 && (
        <div className={styles.empty}>
          {teams.length === 0 ? 'No teams to check in yet. Teams appear here once an admin accepts their registration.' : 'No teams match these filters.'}
        </div>
      )}

      {!loading && grouped.length > 0 && (
        <>
          {/* Phone: one frame, the divisions as band rows, the action beside each chevron. */}
          <div className={repKit.phoneOnly}>
            <ClubRowFrame>
              {grouped.map(([divId, divTeams]) => (
                <ClubRowList key={divId} inset label={divMap.get(divId)?.name ?? 'Division'}>
                  <ClubRowBand count={bandCount(divId)}>{divMap.get(divId)?.name ?? 'Division'}</ClubRowBand>
                  {divTeams.map(t => <PhoneRow key={t.id} {...rowProps(t)} />)}
                </ClubRowList>
              ))}
            </ClubRowFrame>
          </div>
          {/* Desk: a table (a gate reads roster and payment down the column), the divisions as band rows. */}
          <div className={`${repKit.deskOnly} ${repKit.tableFrame}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Roster</th>
                  <th scope="col">Payment</th>
                  <th scope="col"><span className="sr-only">Arrival</span></th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([divId, divTeams]) => [
                  <tr key={`band-${divId}`} className={repKit.band}>
                    <td colSpan={5}>
                      {divMap.get(divId)?.name ?? 'Division'} <span className={repKit.rowBandCount}>{bandCount(divId)}</span>
                    </td>
                  </tr>,
                  ...divTeams.map(t => <DeskRow key={t.id} {...rowProps(t)} />),
                ])}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sheetTeam && (
        <CheckInSheet
          team={sheetTeam}
          fee={divMap.get(sheetTeam.divisionId)?.fee ?? null}
          divisionName={divMap.get(sheetTeam.divisionId)?.name ?? ''}
          locked={locked}
          busy={busyId === sheetTeam.id}
          onAction={action}
          onClose={() => setSheetId(null)}
        />
      )}
    </>
  );
}

// ── detail / roster sheet ───────────────────────────────────────────────────
function CheckInSheet({ team, fee, divisionName, locked, busy, onAction, onClose }: {
  team: CheckInTeam;
  fee: number | null;
  divisionName: string;
  locked: boolean;
  busy: boolean;
  onAction: (act: string, teamId: string, extra?: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<RosterPlayer[]>(() => team.roster.length > 0 ? team.roster : []);
  // J8-016: capture the team's payment state the moment "Mark paid" is tapped, so "Un-pay" can
  // restore the prior amounts (not blanket-zero) even after a refetch overwrites the live values.
  const [paidSnapshot, setPaidSnapshot] = useState<Partial<CheckInTeam> | null>(null);

  function handleMarkPaid() {
    setPaidSnapshot({
      paymentStatus: team.paymentStatus,
      depositPaid: team.depositPaid,
      totalPaid: team.totalPaid,
      paymentCollectedAt: team.paymentCollectedAt,
    });
    void onAction('mark_paid', team.id);
  }
  function handleUnmarkPaid() {
    void onAction('unmark_paid', team.id, { prior: paidSnapshot ?? {} });
  }

  function setRow(i: number, patch: Partial<RosterPlayer>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function addRow() { setRows(prev => [...prev, { name: '', jerseyNumber: '', dateOfBirth: '', position: '' }]); }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)); }

  async function saveRoster() {
    // J8-010: send each row's id so the server updates existing players in place (preserving coach
    // provenance) and deletes only removed rows, instead of wiping + re-inserting the whole roster.
    await onAction('save_gate_roster', team.id, { players: rows.map(r => ({ id: r.id, name: r.name, jerseyNumber: r.jerseyNumber, dateOfBirth: r.dateOfBirth, position: r.position })) });
    setEditing(false);
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={team.name}
      footer={
        <div className={styles.sheetFooter}>
          {team.checkInStatus === 'not_arrived' ? (
            <>
              <button type="button" className={styles.noShowBtn} disabled={locked || busy} onClick={() => onAction('no_show', team.id)}>
                <UserX size={16} aria-hidden /> No-show
              </button>
              <button type="button" className={styles.bigCheckIn} disabled={locked || busy} onClick={() => onAction('check_in', team.id)}>
                <UserCheck size={18} aria-hidden /> Check in
              </button>
            </>
          ) : (
            <button type="button" className={styles.undoBtn} disabled={locked || busy} onClick={() => onAction('undo', team.id)}>
              <RotateCcw size={15} aria-hidden /> Reset to not arrived
            </button>
          )}
        </div>
      }
    >
      <div className={styles.sheetMeta}>
        <span>{divisionName}</span>
        <span className={styles.sheetStatus} data-status={team.checkInStatus}>{STATUS_META[team.checkInStatus].label}</span>
        {team.checkInStatus === 'checked_in' && team.checkedInByName && (
          <span className={styles.sheetBy}>by {team.checkedInByName} {team.checkedInAt ? `· ${timeOf(team.checkedInAt)}` : ''}</span>
        )}
      </div>

      <div className={styles.sheetSection}>
        <span className={styles.sheetLabel}><DollarSign size={13} aria-hidden /> Payment</span>
        {team.paymentStatus === 'paid' ? (
          <div className={styles.paidRow}>
            <span><Check size={15} aria-hidden /> Paid{team.paymentCollectedAt ? ` · collected at gate ${timeOf(team.paymentCollectedAt)}` : ''}</span>
            {/* J8-016: gate mark-paid is now reversible like every other gate action. */}
            <button type="button" className={styles.unpayBtn} disabled={locked || busy} onClick={handleUnmarkPaid}>
              Un-pay
            </button>
          </div>
        ) : (
          <button type="button" className={styles.markPaidBtn} disabled={locked || busy} onClick={handleMarkPaid}>
            Mark paid {fee ? `· ${formatMoney(fee)}` : ''}
          </button>
        )}
      </div>

      <div className={styles.sheetSection}>
        <span className={styles.sheetLabel}><ClipboardList size={13} aria-hidden /> Roster</span>

        {!editing && team.roster.length > 0 && (
          <>
            <ul className={styles.rosterList}>
              {team.roster.map((p, i) => (
                <li key={p.id ?? i} className={styles.rosterItem}>
                  <span className={styles.rosterNum}>{p.jerseyNumber || '—'}</span>
                  <span className={styles.rosterName}>{p.name}</span>
                  {p.dateOfBirth && <span className={styles.rosterDob}>{p.dateOfBirth}</span>}
                </li>
              ))}
            </ul>
            <div className={styles.rosterActions}>
              {!team.rosterConfirmedAt && (
                <button type="button" className={styles.confirmBtn} disabled={locked || busy} onClick={() => onAction('confirm_roster', team.id)}>
                  <Check size={15} aria-hidden /> Confirm roster
                </button>
              )}
              {team.rosterConfirmedAt && <span className={styles.rosterConfirmed}><Check size={14} aria-hidden /> Confirmed</span>}
              <button type="button" className={styles.editRosterBtn} disabled={locked} onClick={() => { setRows(team.roster); setEditing(true); }}>Edit</button>
            </div>
          </>
        )}

        {!editing && team.roster.length === 0 && (
          <button type="button" className={styles.addRosterBtn} disabled={locked} onClick={() => { setRows([{ name: '', jerseyNumber: '', dateOfBirth: '', position: '' }]); setEditing(true); }}>
            <Plus size={15} aria-hidden /> Add roster at the gate
          </button>
        )}

        {editing && (
          <div className={styles.rosterEditor}>
            {rows.map((r, i) => (
              <div key={i} className={styles.editRow}>
                <input className={styles.numInput} placeholder="#" value={r.jerseyNumber ?? ''} onChange={e => setRow(i, { jerseyNumber: e.target.value })} />
                <input className={styles.nameInput} placeholder="Player name" value={r.name} onChange={e => setRow(i, { name: e.target.value })} />
                <button type="button" className={styles.removeRow} onClick={() => removeRow(i)} aria-label="Remove player"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className={styles.addRowBtn} onClick={addRow}><Plus size={14} aria-hidden /> Add player</button>
            <div className={styles.editorActions}>
              <button type="button" className={styles.cancelEdit} onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className={styles.saveRoster} disabled={busy} onClick={saveRoster}>Save roster</button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
