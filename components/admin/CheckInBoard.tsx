'use client';

/**
 * Shared gate / team check-in board. Used by the admin Check-in page and the
 * gate-volunteer surface. Takes orgSlug + tournamentId by prop (no admin
 * contexts) so it works inside or outside the admin shell.
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import { UserCheck, UserX, RotateCcw, Search, DollarSign, ClipboardList, Plus, Trash2, Check } from 'lucide-react';
import BottomSheet from '@/components/admin/BottomSheet';
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
function timeOf(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const STATUS_META: Record<CheckInStatus, { label: string; cls: string }> = {
  not_arrived: { label: 'Not arrived', cls: styles.dotIdle },
  checked_in: { label: 'Checked in', cls: styles.dotIn },
  no_show: { label: 'No-show', cls: styles.dotNo },
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

/** One team row. Memoized: re-renders only when its own team object changes
 * (the optimistic update gives only the acted-on team a new reference). */
const TeamRow = memo(function TeamRow({ team, fee, locked, busy, onOpen, onCheckIn, onNoShow, onUndo }: {
  team: CheckInTeam;
  fee: number | null;
  locked: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onCheckIn: (id: string) => void;
  onNoShow: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const meta = STATUS_META[team.checkInStatus];
  return (
    <div className={styles.row} data-status={team.checkInStatus}>
      <button type="button" className={styles.rowMain} onClick={() => onOpen(team.id)}>
        <span className={`${styles.dot} ${meta.cls}`} aria-hidden />
        <span className={styles.rowText}>
          <span className={styles.teamName}>{team.name}</span>
          <span className={styles.rowSub}>
            <span className={styles.rosterTag} data-state={team.rosterConfirmedAt ? 'confirmed' : team.roster.length > 0 ? 'submitted' : 'none'}>
              {team.rosterConfirmedAt ? `Roster ✓ ${team.roster.length}` : team.roster.length > 0 ? `Roster · ${team.roster.length}` : 'No roster'}
            </span>
            <span className={styles.payTag} data-paid={team.paymentStatus === 'paid' ? 'true' : 'false'}>
              {team.paymentStatus === 'paid' ? 'Paid' : fee ? `Owes ${formatMoney(fee)}` : 'Unpaid'}
            </span>
            {team.checkInStatus === 'checked_in' && team.checkedInAt && (
              <span className={styles.timeTag}>{timeOf(team.checkedInAt)}</span>
            )}
          </span>
        </span>
      </button>
      <div className={styles.rowActions}>
        {team.checkInStatus === 'not_arrived' ? (
          <>
            <button type="button" className={styles.noShowIconBtn} disabled={locked || busy} onClick={() => onNoShow(team.id)} title="Mark no-show" aria-label="Mark no-show">
              <UserX size={16} aria-hidden />
            </button>
            <button type="button" className={styles.checkInBtn} disabled={locked || busy} onClick={() => onCheckIn(team.id)}>
              <UserCheck size={16} aria-hidden />
              <span className={styles.checkInLabel}>Check in</span>
            </button>
          </>
        ) : (
          <>
            {team.checkInStatus === 'checked_in' ? (
              <span className={`${styles.statePill} ${styles.statePillIn}`}><Check size={14} aria-hidden /> In</span>
            ) : (
              <span className={`${styles.statePill} ${styles.statePillNo}`}>No-show</span>
            )}
            <button type="button" className={styles.undoIconBtn} disabled={locked || busy} onClick={() => onUndo(team.id)} title="Undo — reset to not arrived" aria-label="Undo">
              <RotateCcw size={15} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default function CheckInBoard({ orgSlug, tournamentId, locked }: {
  orgSlug: string;
  tournamentId: string;
  locked: boolean;
}) {
  const [teams, setTeams] = useState<CheckInTeam[]>([]);
  const [divisions, setDivisions] = useState<DivInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // WI-3: true when the last failure was a 401 (session lapsed) — drives a "sign back in" link
  // instead of a generic "Action failed." dead end. Works from both mount routes (gate + admin).
  const [authLost, setAuthLost] = useState(false);
  const [search, setSearch] = useState('');
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

  const loadBoard = useCallback(async (silent = false) => {
    if (!tournamentId) return;
    if (!silent) setLoading(true);
    // A silent revert-reload after an action failure must NOT wipe the failure message that's
    // already on screen — only a fresh (non-silent) load starts clean.
    if (!silent) { setError(null); setAuthLost(false); }
    try {
      const tid = encodeURIComponent(tournamentId);
      const [boardRes, divRes] = await Promise.all([
        fetch(`/api/admin/check-in?tournamentId=${tid}${orgParam}`, FETCH),
        fetch(`/api/admin/divisions?tournamentId=${tid}${orgParam}`, FETCH),
      ]);
      if (boardRes.status === 401) {
        markAuthLost();
        return;
      }
      if (!boardRes.ok) throw new Error((await boardRes.json().catch(() => ({})))?.error || 'Could not load check-in.');
      const board = await boardRes.json();
      setTeams(board.teams ?? []);
      const divs = divRes.ok ? await divRes.json() : [];
      setDivisions((Array.isArray(divs) ? divs : []).map((d: any) => ({ id: d.id, name: d.name, fee: d.totalFeeAmount ?? null })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load check-in.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tournamentId, orgParam, markAuthLost]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const divMap = useMemo(() => new Map(divisions.map(d => [d.id, d])), [divisions]);

  // Optimistic: flip just the affected team locally and persist in the background.
  // Only the changed team gets a new object reference, so memoized rows for every
  // other team skip re-rendering. On failure we silently resync to server truth.
  const action = useCallback(async (act: string, teamId: string, extra?: Record<string, unknown>) => {
    if (!tournamentId) return;
    const patch = optimisticPatch(act, new Date().toISOString(), extra);
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
  const quickNoShow = useCallback((id: string) => { void action('no_show', id); }, [action]);
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

  const gauges = useMemo(() => {
    const total = teams.length;
    const arrived = teams.filter(t => t.checkInStatus === 'checked_in').length;
    const noShow = teams.filter(t => t.checkInStatus === 'no_show').length;
    const unpaid = teams.filter(t => t.paymentStatus !== 'paid').length;
    return { total, arrived, noShow, unpaid };
  }, [teams]);

  const sheetTeam = sheetId ? teams.find(t => t.id === sheetId) ?? null : null;

  return (
    <>
      <div className={styles.gauges}>
        <div className={styles.gauge}>
          <span className={styles.gaugeMain}>{gauges.arrived}<span className={styles.gaugeOf}>/{gauges.total}</span></span>
          <span className={styles.gaugeLabel}>Checked in</span>
        </div>
        <div className={styles.gauge} data-tone="danger">
          <span className={styles.gaugeMain}>{gauges.noShow}</span>
          <span className={styles.gaugeLabel}>No-shows</span>
        </div>
        <div className={styles.gauge} data-tone="warning">
          <span className={styles.gaugeMain}>{gauges.unpaid}</span>
          <span className={styles.gaugeLabel}>Unpaid</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} aria-hidden />
          <input className={styles.search} placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={styles.select} value={divFilter} onChange={e => setDivFilter(e.target.value)} aria-label="Division">
          <option value="all">All divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className={styles.segmented} role="tablist" aria-label="Arrival filter">
          {(['all', 'not_arrived', 'checked_in', 'no_show'] as const).map(k => (
            <button key={k} type="button" role="tab" aria-selected={statusFilter === k}
              className={styles.segBtn} data-on={statusFilter === k ? 'true' : 'false'}
              onClick={() => setStatusFilter(k)}>
              {k === 'all' ? 'All' : STATUS_META[k].label}
            </button>
          ))}
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

      {!loading && grouped.map(([divId, divTeams]) => (
        <section key={divId} className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>{divMap.get(divId)?.name ?? 'Division'}</span>
            <span className={styles.groupCount}>{divTeams.filter(t => t.checkInStatus === 'checked_in').length}/{divTeams.length} in</span>
          </div>
          <div className={styles.rows}>
            {divTeams.map(t => (
              <TeamRow
                key={t.id}
                team={t}
                fee={divMap.get(t.divisionId)?.fee ?? null}
                locked={locked}
                busy={busyId === t.id}
                onOpen={openTeam}
                onCheckIn={quickCheckIn}
                onNoShow={quickNoShow}
                onUndo={quickUndo}
              />
            ))}
          </div>
        </section>
      ))}

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
