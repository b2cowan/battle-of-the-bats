'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, X, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Download, Plus, Trash2, Search, LayoutDashboard, ArrowLeftRight } from 'lucide-react';
import { saveTeam } from '@/lib/db';
import { downloadCSV, formatPoolName } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { AgeGroup } from '@/lib/types';
import s from '../../admin-common.module.css';
import styles from './teams-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';

interface TeamRecord {
  id: string;
  name: string;
  coach: string;
  email: string;
  age_group_id: string;
  age_group_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlist';
  paymentStatus: 'pending' | 'paid';
  depositPaid: number;
  totalPaid: number;
  registered_at: string;
  poolId?: string;
  adminNotes?: string;
  slotId?: string | null;
  waitlistPosition?: number | null;
}

interface PoolSlot {
  id: string;
  poolId: string;
  slotNumber: number;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
}

type PaymentStatus = 'paid' | 'deposit-paid' | 'pending' | 'past-due' | 'no-schedule';
type FeeMode = 'tournament' | 'age_group';
type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';

interface FeeSchedule {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
}

function computePaymentStatus(team: TeamRecord, fee: FeeSchedule, today: string): PaymentStatus {
  const { depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate } = fee;
  if (!totalFeeAmount) return 'no-schedule';
  if (team.totalPaid >= totalFeeAmount) return 'paid';
  if (totalFeeDueDate && today > totalFeeDueDate) return 'past-due';
  if (depositAmount && depositDueDate && today > depositDueDate && team.depositPaid < depositAmount) return 'past-due';
  if (depositAmount && team.depositPaid >= depositAmount) return 'deposit-paid';
  return 'pending';
}

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  'paid': 'success', 'deposit-paid': 'primary', 'pending': 'warning', 'past-due': 'danger', 'no-schedule': 'neutral',
};
const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  'paid': 'Paid', 'deposit-paid': 'Deposit Paid', 'pending': 'Pending', 'past-due': 'Past Due', 'no-schedule': 'No Schedule',
};

export default function UnifiedTeamsPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const [regs, setRegs] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(['pending', 'accepted', 'waitlist']);
  const [search, setSearch] = useState('');
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>('');
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', coach: '', email: '', ageGroupId: '' });
  const [stableSortedIds, setStableSortedIds] = useState<string[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'pools'>('pools');
  const [feeMode, setFeeMode] = useState<FeeMode>('tournament');
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule>({ depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null });
  const [poolSlots, setPoolSlots] = useState<PoolSlot[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstSlotId, setSwapFirstSlotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });

  const load = useCallback(async () => {
    if (!currentTournament) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [rRes, adminTeamsRes, groupsRes, tRes] = await Promise.all([
        fetch('/api/registrations'),
        fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(currentTournament.id)}`),
        fetch(`/api/admin/age-groups?tournamentId=${encodeURIComponent(currentTournament.id)}`),
        fetch(`/api/admin/tournaments`),
      ]);

      const groups: AgeGroup[] = groupsRes.ok ? await groupsRes.json() : [];
      const adminTeams: any[] = adminTeamsRes.ok ? await adminTeamsRes.json() : [];
      const adminMap = new Map(adminTeams.map((t: any) => [t.id, t]));

      const rData = (await rRes.json()).map((r: any) => {
        const admin = adminMap.get(r.id) ?? {};
        return {
          ...r,
          poolId: r.pool_id,
          paymentStatus: r.payment_status,
          depositPaid: Number(r.deposit_paid ?? 0),
          totalPaid: Number(r.total_paid ?? 0),
          adminNotes: r.admin_notes,
          slotId: admin.slotId ?? null,
          waitlistPosition: admin.waitlistPosition ?? null,
        };
      });

      setAgeGroups(groups);
      if (groups.length) {
        if (!selectedAgeGroupId || selectedAgeGroupId === 'all') {
          setSelectedAgeGroupId(groups[0].id);
        }
        if (!addForm.ageGroupId) {
          setAddForm(f => ({ ...f, ageGroupId: groups[0].id }));
        }
      }

      if (tRes.ok) {
        const tournaments: any[] = await tRes.json();
        const t = tournaments.find((x: any) => x.id === currentTournament.id);
        if (t) {
          setFeeMode(t.fee_schedule_mode === 'age_group' ? 'age_group' : 'tournament');
          setFeeSchedule({
            depositAmount: t.deposit_amount != null ? Number(t.deposit_amount) : null,
            depositDueDate: t.deposit_due_date ?? null,
            totalFeeAmount: t.total_fee_amount != null ? Number(t.total_fee_amount) : null,
            totalFeeDueDate: t.total_fee_due_date ?? null,
          });
        }
      }

      setRegs(rData);

      if (stableSortedIds.length === 0) {
        const initialSorted = [...rData].sort((a: any, b: any) => {
          const statusOrder: any = { accepted: 1, waitlist: 2, pending: 3, rejected: 4 };
          if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
          if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'paid' ? -1 : 1;
          return new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime();
        });
        setStableSortedIds(initialSorted.map((x: any) => x.id));
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
      setHasLoadedInitial(true);
    }
  }, [currentTournament?.id, stableSortedIds.length, addForm.ageGroupId]);

  const loadPoolSlots = useCallback(async () => {
    if (!selectedAgeGroupId || !currentTournament) { setPoolSlots([]); return; }
    try {
      const res = await fetch(`/api/admin/pool-slots?tournamentId=${encodeURIComponent(currentTournament.id)}&ageGroupId=${encodeURIComponent(selectedAgeGroupId)}`);
      if (res.ok) setPoolSlots(await res.json());
    } catch { setPoolSlots([]); }
  }, [selectedAgeGroupId, currentTournament?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPoolSlots(); }, [loadPoolSlots]);

  async function patch(id: string, updates: any, confirmMsg?: string) {
    const execute = async () => {
      setWorking(id);
      try {
        const res = await fetch('/api/admin/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id], updates }),
        });
        if (!res.ok) throw new Error('Update failed');
        setRegs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      } catch (e: any) {
        setFeedback({ isOpen: true, title: 'Update Error', message: e.message, type: 'danger' });
      } finally {
        setWorking(null);
      }
    };
    if (confirmMsg) {
      setFeedback({ isOpen: true, title: 'Confirm Action', message: confirmMsg, type: 'warning', onConfirm: execute });
    } else {
      execute();
    }
  }

  async function handleDelete(id: string, name: string) {
    setFeedback({
      isOpen: true,
      title: 'Delete Registration?',
      message: `Permanently delete the registration for "${name}"? This cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        setWorking(id);
        try {
          const res = await fetch('/api/admin/teams', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [id] }),
          });
          if (!res.ok) throw new Error('Delete failed');
          setRegs(prev => prev.filter(r => r.id !== id));
          await Promise.all([load(), loadPoolSlots()]);
        } catch (e: any) {
          setFeedback({ isOpen: true, title: 'Delete Error', message: e.message, type: 'danger' });
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function handleSwapSlots(slotBId: string) {
    if (swapFirstSlotId === slotBId) {
      setSwapFirstSlotId(null);
      return;
    }
    if (!swapFirstSlotId) {
      setSwapFirstSlotId(slotBId);
      return;
    }
    const slotA = poolSlots.find(s => s.id === swapFirstSlotId);
    const slotB = poolSlots.find(s => s.id === slotBId);
    const captured = swapFirstSlotId;
    setSwapFirstSlotId(null);

    setFeedback({
      isOpen: true,
      title: 'Swap Slots?',
      message: `Swap "${slotA?.displayName ?? 'Slot A'}" (${slotA?.teamName ?? 'Empty'}) with "${slotB?.displayName ?? 'Slot B'}" (${slotB?.teamName ?? 'Empty'})?`,
      type: 'primary',
      onConfirm: async () => {
        setWorking('swap');
        try {
          const res = await fetch('/api/admin/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'swap-slots', slotAId: captured, slotBId }),
          });
          if (!res.ok) throw new Error('Swap failed');
          await Promise.all([load(), loadPoolSlots()]);
        } catch (e: any) {
          setFeedback({ isOpen: true, title: 'Swap Error', message: e.message, type: 'danger' });
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function handlePromote(teamId: string, teamName: string) {
    setFeedback({
      isOpen: true,
      title: 'Promote from Waitlist?',
      message: `Move "${teamName}" from the waitlist to the next available slot?`,
      type: 'primary',
      onConfirm: async () => {
        setWorking(teamId);
        try {
          const res = await fetch('/api/admin/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'promote-from-waitlist', teamId }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Promote failed');
          }
          await Promise.all([load(), loadPoolSlots()]);
        } catch (e: any) {
          setFeedback({ isOpen: true, title: 'Promote Error', message: e.message, type: 'danger' });
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function randomizeSlots() {
    const filledSlots = poolSlots.filter(s => s.teamId !== null);
    if (filledSlots.length < 2) {
      setFeedback({ isOpen: true, title: 'Not Enough Teams', message: 'At least 2 filled slots are needed to randomize.', type: 'warning' });
      return;
    }
    setFeedback({
      isOpen: true,
      title: 'Randomize Slots?',
      message: `Randomly shuffle ${filledSlots.length} teams across their slots. Manual swaps can adjust afterward.`,
      type: 'primary',
      onConfirm: async () => {
        setWorking('randomizing');
        try {
          const slots = [...filledSlots];
          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            if (i !== j) {
              await fetch('/api/admin/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'swap-slots', slotAId: slots[i].id, slotBId: slots[j].id }),
              });
              [slots[i], slots[j]] = [slots[j], slots[i]];
            }
          }
          await Promise.all([load(), loadPoolSlots()]);
          setFeedback({ isOpen: true, title: 'Randomized!', message: 'Slot assignments have been shuffled.', type: 'success' });
        } catch (e: any) {
          setFeedback({ isOpen: true, title: 'Error', message: e.message, type: 'danger' });
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function randomizePools() {
    if (!selectedAgeGroupId) return;
    const group = ageGroups.find(g => g.id === selectedAgeGroupId);
    if (!group?.pools || group.pools.length <= 1) {
      setFeedback({ isOpen: true, title: 'Action Required', message: 'This division needs at least 2 pools to randomize.', type: 'warning' });
      return;
    }
    setFeedback({
      isOpen: true,
      title: 'Randomize Pools?',
      message: `Randomly distribute all accepted teams in ${group.name} across ${group.pools.length} pools?`,
      type: 'primary',
      onConfirm: async () => {
        setWorking('randomizing');
        try {
          const acceptedTeams = regs.filter(r => r.age_group_id === selectedAgeGroupId && r.status === 'accepted');
          const shuffled = [...acceptedTeams].sort(() => Math.random() - 0.5);
          const pools = group.pools || [];
          const updates = shuffled.map((team, i) => ({ id: team.id, updates: { poolId: pools[i % pools.length].id } }));
          const res = await fetch('/api/admin/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
          });
          if (!res.ok) throw new Error('Update failed');
          load();
        } catch (e: any) {
          setFeedback({ isOpen: true, title: 'Error', message: e.message, type: 'danger' });
        } finally {
          setWorking(null);
        }
      }
    });
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    setWorking('new');
    try {
      const id = crypto.randomUUID();
      await saveTeam({
        id, name: addForm.name, coach: addForm.coach, email: addForm.email,
        ageGroupId: addForm.ageGroupId, tournamentId: currentTournament.id,
        status: 'accepted', paymentStatus: 'paid',
        registeredAt: new Date().toISOString(), players: [],
      });
      setShowAddModal(false);
      setAddForm({ name: '', coach: '', email: '', ageGroupId: ageGroups[0]?.id || '' });
      load();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setWorking(null);
    }
  }

  function exportCSV() {
    const divTeams = regs.filter(r => r.age_group_id === selectedAgeGroupId);
    const headers = ['Team', 'Coach', 'Email', 'Status', 'Slot', 'Waitlist #', 'Payment'];
    const rows = divTeams.map(r => [
      r.name, r.coach, r.email, r.status,
      poolSlots.find(s => s.id === r.slotId)?.displayName ?? '-',
      r.waitlistPosition ?? '-',
      r.paymentStatus,
    ]);
    downloadCSV(`teams-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  const today = new Date().toISOString().split('T')[0];
  const selectedGroup = ageGroups.find(g => g.id === selectedAgeGroupId);
  const slotConfigured = poolSlots.length > 0;
  const divRegs = regs.filter(r => r.age_group_id === selectedAgeGroupId);
  const waitlistTeams = divRegs.filter(r => r.waitlistPosition != null).sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const filledSlotCount = poolSlots.filter(s => s.teamId !== null).length;
  const pendingCount = divRegs.filter(r => r.status === 'pending').length;

  const slotsByPool = useMemo(() => {
    if (!selectedGroup?.pools) return [];
    return (selectedGroup.pools as any[])
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map(pool => ({
        pool,
        slots: poolSlots.filter(s => s.poolId === pool.id).sort((a, b) => a.slotNumber - b.slotNumber),
      }));
  }, [poolSlots, selectedGroup]);

  function renderExpandedTeamDetails(team: TeamRecord) {
    const agFee = ageGroups.find(g => g.id === team.age_group_id);
    const effectiveFee: FeeSchedule = feeMode === 'age_group' && agFee?.totalFeeAmount != null
      ? { depositAmount: agFee.depositAmount ?? null, depositDueDate: agFee.depositDueDate ?? null, totalFeeAmount: agFee.totalFeeAmount ?? null, totalFeeDueDate: agFee.totalFeeDueDate ?? null }
      : feeSchedule;
    const pStatus = computePaymentStatus(team, effectiveFee, today);
    const busy = working === team.id;

    return (
      <div className={s.expandedRow}>
        <div className={s.expandedContent}>
          <div className={s.expandedInfo}>
            <div className={styles.infoLine}>
              <span>Email: <a href={`mailto:${team.email}`}>{team.email}</a></span>
              <span style={{ marginLeft: '1rem' }}>Reg: {new Date(team.registered_at).toLocaleDateString()}</span>
            </div>
            <div className={styles.notesArea}>
              <label>Admin Notes</label>
              <textarea placeholder="Private notes..." defaultValue={team.adminNotes} onBlur={e => e.target.value !== team.adminNotes && patch(team.id, { adminNotes: e.target.value })} />
            </div>
          </div>
          <div className={s.expandedActions}>
            <div className={styles.buttonGroup}>
              {team.status !== 'accepted' && (
                <button className="btn btn-primary btn-xs" onClick={() => patch(team.id, { status: 'accepted' }, `Accept "${team.name}"? An automated email will be sent.`)} disabled={busy}>Accept</button>
              )}
              {team.status !== 'rejected' && (
                <button className="btn btn-outline btn-xs" style={{ color: 'var(--danger-light)' }} onClick={() => patch(team.id, { status: 'rejected' }, `Reject "${team.name}"? An automated email will be sent.`)} disabled={busy}>Reject</button>
              )}
              {team.status === 'accepted' && effectiveFee.totalFeeAmount ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid var(--border-2)', paddingTop: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--data-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deposit Paid ($)</label>
                    <input type="number" min="0" step="0.01" defaultValue={team.depositPaid || ''} placeholder="0.00"
                      style={{ width: '90px', padding: '0.2rem 0.4rem', fontSize: '0.85rem', background: 'var(--hud-surface)', border: '1px solid var(--border-2)', color: 'var(--fl-text)' }}
                      onBlur={e => { const val = parseFloat(e.target.value) || 0; if (val !== team.depositPaid) patch(team.id, { depositPaid: val }); }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--data-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Paid ($)</label>
                    <input type="number" min="0" step="0.01" defaultValue={team.totalPaid || ''} placeholder="0.00"
                      style={{ width: '90px', padding: '0.2rem 0.4rem', fontSize: '0.85rem', background: 'var(--hud-surface)', border: '1px solid var(--border-2)', color: 'var(--fl-text)' }}
                      onBlur={e => { const val = parseFloat(e.target.value) || 0; if (val !== team.totalPaid) patch(team.id, { totalPaid: val }); }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignSelf: 'flex-end' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--data-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>of ${effectiveFee.totalFeeAmount}</span>
                    <span className={`badge badge-${PAYMENT_STATUS_STYLE[pStatus]}`}>{PAYMENT_STATUS_LABEL[pStatus]}</span>
                  </div>
                </div>
              ) : team.status === 'accepted' ? (
                <button className="btn btn-outline btn-xs" onClick={() => patch(team.id, { paymentStatus: team.paymentStatus === 'paid' ? 'pending' : 'paid' })} disabled={busy}>
                  {team.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                </button>
              ) : null}
              <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(team.id, team.name)} disabled={busy} style={{ color: 'var(--danger-light)' }}>
                <Trash2 size={14} />
              </button>
              {team.status === 'accepted' && (
                <a href={`/${currentOrg?.slug ?? ''}/teams/${team.id}`} target="_blank" className="btn btn-ghost btn-xs">Profile ↗</a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Flat list state (non-slot-configured divisions)
  const filtered = divRegs.filter(r => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
    const matchesSearch = search === '' || r.name.toLowerCase().includes(search.toLowerCase()) || r.coach.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });
  const sorted = stableSortedIds.map(id => filtered.find(r => r.id === id)).filter(Boolean) as TeamRecord[];
  const flatDisplay = [...sorted, ...filtered.filter(r => !stableSortedIds.includes(r.id))];

  const renderFlatRow = (r: TeamRecord) => {
    const isExpanded = expanded.has(r.id);
    const agFee = ageGroups.find(g => g.id === r.age_group_id);
    const effectiveFee: FeeSchedule = feeMode === 'age_group' && agFee?.totalFeeAmount != null
      ? { depositAmount: agFee.depositAmount ?? null, depositDueDate: agFee.depositDueDate ?? null, totalFeeAmount: agFee.totalFeeAmount ?? null, totalFeeDueDate: agFee.totalFeeDueDate ?? null }
      : feeSchedule;
    const pStatus = computePaymentStatus(r, effectiveFee, today);

    return (
      <div key={r.id} className={s.row}>
        <div className={s.rowMain}>
          <div style={{ width: 12 }} />
          <div style={{ flex: 2 }} className={s.primaryCell}><strong>{r.name}</strong></div>
          <div style={{ flex: 1.5 }} className={s.secondaryCell}>{r.coach}</div>
          <div style={{ width: 120 }}>
            <span className={`badge badge-${r.status === 'accepted' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span>
          </div>
          <div style={{ width: 120, paddingLeft: '1rem' }}>
            {r.status === 'accepted' && pStatus !== 'no-schedule'
              ? <span className={`badge badge-${PAYMENT_STATUS_STYLE[pStatus]}`}>{PAYMENT_STATUS_LABEL[pStatus]}</span>
              : r.status === 'accepted'
              ? <span className={`badge badge-${r.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{r.paymentStatus}</span>
              : '-'}
          </div>
          <div style={{ width: 40, textAlign: 'right' }}>
            <button className={s.iconBtn} onClick={() => setExpanded(prev => { const set = new Set(prev); set.has(r.id) ? set.delete(r.id) : set.add(r.id); return set; })}>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        {isExpanded && renderExpandedTeamDetails(r)}
      </div>
    );
  };

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div className={s.headerLeft}>
          <div className={s.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={s.pageTitle}>Registrations</h1>
            <p className={s.pageSub}>Manage all teams and signups in one place</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={regs.length === 0}><Download size={14} /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} disabled={!currentTournament}><Plus size={16} /> Add Team</button>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger" style={{ margin: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={18} /><span>{errorMsg}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => load()} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      <div className={s.controlsBar}>
        <div className={s.controlsLeft}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSummaryModal(true)} style={{ color: 'var(--logic-lime)', gap: '0.5rem' }}>
            <LayoutDashboard size={14} /> Summary
          </button>
          {slotConfigured ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={randomizeSlots} disabled={loading || working === 'randomizing'} style={{ color: 'var(--logic-lime)', gap: '0.5rem' }}>
                <RefreshCw size={14} className={working === 'randomizing' ? 'spin' : ''} /> Randomize Slots
              </button>
              <button
                className={`btn btn-sm ${swapMode ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSwapMode(m => !m); setSwapFirstSlotId(null); }}
                style={{ gap: '0.5rem', ...(swapMode ? {} : { color: 'var(--logic-lime)' }) }}
              >
                <ArrowLeftRight size={14} /> {swapMode ? (swapFirstSlotId ? 'Select 2nd Slot…' : 'Select a Slot…') : 'Swap Mode'}
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={randomizePools} disabled={loading || working === 'randomizing'} style={{ color: 'var(--logic-lime)', gap: '0.5rem' }}>
              <RefreshCw size={14} className={working === 'randomizing' ? 'spin' : ''} /> Randomize Pools
            </button>
          )}
        </div>
        <div className={s.controlsRight}>
          <div className={s.controlGroup}>
            <label className={s.controlLabel}>Division:</label>
            <select className={`${s.controlSelect} form-input`} value={selectedAgeGroupId} onChange={e => { setSelectedAgeGroupId(e.target.value); setSwapMode(false); setSwapFirstSlotId(null); }}>
              {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {!slotConfigured && (
            <>
              <div className={s.viewToggle}>
                <button className={`${s.toggleBtn} ${viewMode === 'flat' ? s.toggleActive : ''}`} onClick={() => setViewMode('flat')}>Flat</button>
                <button className={`${s.toggleBtn} ${viewMode === 'pools' ? s.toggleActive : ''}`} onClick={() => setViewMode('pools')}>Pools</button>
              </div>
              <div className={s.searchWrapper}>
                <Search size={16} className={s.searchIcon} />
                <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className={s.searchInput} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary modal */}
      {showSummaryModal && (
        <div className="modal-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <LayoutDashboard size={20} style={{ color: 'var(--logic-lime)' }} />
                <h3 style={{ margin: 0 }}>Tournament Summary</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSummaryModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '2rem' }}>
              <div className={styles.summaryGridModal}>
                {ageGroups.map(g => {
                  const groupRegs = regs.filter(r => r.age_group_id === g.id);
                  const accepted = groupRegs.filter(r => r.status === 'accepted').length;
                  const capacity = g.capacity || 0;
                  return (
                    <div key={g.id} className={styles.summaryCardModal} onClick={() => { setSelectedAgeGroupId(g.id); setShowSummaryModal(false); }}>
                      <div className={styles.summaryHeader}>
                        <strong>{g.name}</strong>
                        {capacity > 0 && <span className={accepted >= capacity ? styles.fullBadge : styles.capacityBadge}>{accepted}/{capacity}</span>}
                      </div>
                      <div className={styles.summaryStats}>{groupRegs.filter(r => r.status === 'pending').length} Pending · {groupRegs.filter(r => r.status === 'waitlist').length} Waitlist</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-primary" onClick={() => setShowSummaryModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {/* ── SLOT BOARD (divisions with pool slots configured) ─────────────────── */}
      {slotConfigured ? (
        <div className={styles.slotBoard}>
          <div className={styles.slotBoardCounts}>
            <span><strong>{filledSlotCount}</strong> / {poolSlots.length} slots filled</span>
            {pendingCount > 0 && <span className={styles.countChip} data-variant="warning">{pendingCount} pending review</span>}
            {waitlistTeams.length > 0 && <span className={styles.countChip} data-variant="neutral">{waitlistTeams.length} waitlisted</span>}
          </div>

          {slotsByPool.map(({ pool, slots }) => (
            <div key={pool.id} className={styles.slotPoolSection}>
              <div className={styles.slotPoolHeader}>
                <div className={styles.slotPoolDot} />
                <span>{formatPoolName(pool.name)} Pool</span>
                <span className={styles.slotPoolCount}>{slots.filter(s => s.teamId).length}/{slots.length}</span>
              </div>

              {slots.map(slot => {
                const team = slot.teamId ? divRegs.find(r => r.id === slot.teamId) : null;
                const isExpanded = expanded.has(slot.id);
                const isSwapSelected = swapFirstSlotId === slot.id;

                return (
                  <div
                    key={slot.id}
                    className={`${styles.slotRow} ${!team ? styles.slotRowEmpty : ''} ${isSwapSelected ? styles.slotRowSwapSelected : ''}`}
                    onClick={swapMode ? () => handleSwapSlots(slot.id) : undefined}
                    style={swapMode ? { cursor: 'pointer' } : undefined}
                  >
                    <div className={styles.slotRowMain}>
                      <span className={styles.slotName}>{slot.displayName}</span>
                      {team ? (
                        <>
                          <span className={styles.slotTeamName}>{team.name}</span>
                          <span className={styles.slotCoach}>{team.coach}</span>
                          <span className={`badge badge-${team.status === 'accepted' ? 'success' : team.status === 'rejected' ? 'danger' : 'warning'}`} style={{ flexShrink: 0 }}>{team.status}</span>
                        </>
                      ) : (
                        <span className={styles.slotEmpty}>— Empty —</span>
                      )}
                      <div className={styles.slotRowActions} onClick={e => e.stopPropagation()}>
                        {swapMode ? (
                          <span className={styles.swapIndicator} style={{ color: isSwapSelected ? 'var(--logic-lime)' : 'var(--white-20)' }}>
                            <ArrowLeftRight size={14} />
                          </span>
                        ) : team ? (
                          <button className={s.iconBtn} onClick={() => setExpanded(prev => { const set = new Set(prev); set.has(slot.id) ? set.delete(slot.id) : set.add(slot.id); return set; })}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {isExpanded && team && !swapMode && renderExpandedTeamDetails(team)}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Waitlist section */}
          {waitlistTeams.length > 0 && (
            <div className={styles.waitlistSection}>
              <div className={styles.waitlistHeader}>
                <span>Waitlist</span>
                <span className={styles.slotPoolCount}>{waitlistTeams.length} team{waitlistTeams.length !== 1 ? 's' : ''}</span>
              </div>
              {waitlistTeams.map(team => (
                <div key={team.id} className={styles.waitlistRow}>
                  <span className={styles.waitlistPosition}>#{team.waitlistPosition}</span>
                  <span className={styles.slotTeamName}>{team.name}</span>
                  <span className={styles.slotCoach}>{team.coach}</span>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => handlePromote(team.id, team.name)}
                    disabled={working === team.id || filledSlotCount >= poolSlots.length}
                  >
                    {filledSlotCount >= poolSlots.length ? 'No Slots' : 'Promote'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (
        /* ── FLAT LIST (divisions without pool slots configured) ──────────────── */
        <>
          <div className={s.filtersRow}>
            <div className={s.statusFilters}>
              {(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(st => (
                <button
                  key={st}
                  className={`${s.filterChip} ${s[`chip_${st}`]} ${selectedStatuses.includes(st) ? s.chipActive : ''}`}
                  onClick={() => setSelectedStatuses(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}
                >
                  {st.toUpperCase()}
                  <span className={s.chipCount}>{divRegs.filter(r => r.status === st).length}</span>
                </button>
              ))}
            </div>
            <div className={s.searchWrapper}>
              <Search size={16} className={s.searchIcon} />
              <input type="text" placeholder="Search teams or coaches..." value={search} onChange={e => setSearch(e.target.value)} className={s.searchInput} />
            </div>
          </div>

          {!hasLoadedInitial ? (
            <div className="empty-state"><RefreshCw size={32} className="spin" style={{ opacity: 0.4 }} /><p>Loading…</p></div>
          ) : flatDisplay.length === 0 ? (
            <div className="empty-state"><Users size={40} style={{ opacity: 0.2 }} /><p>No teams matching filters.</p></div>
          ) : (
            <div className={s.compactList}>
              {viewMode === 'flat' ? (
                flatDisplay.map(r => renderFlatRow(r))
              ) : (
                (() => {
                  const pools = selectedGroup?.pools || [];
                  const byPool = flatDisplay.reduce((acc, r) => {
                    const pid = r.poolId || 'unassigned';
                    if (!acc[pid]) acc[pid] = [];
                    acc[pid].push(r);
                    return acc;
                  }, {} as Record<string, TeamRecord[]>);

                  return [{ id: 'unassigned', name: 'Unassigned' }, ...pools].map(p => {
                    const teamsInPool = byPool[p.id] || [];
                    if (teamsInPool.length === 0) return null;
                    return (
                      <div key={p.id} className={s.poolSubSection}>
                        <div className={s.poolSubHeader}>
                          <div className={s.poolDot} style={{ background: p.id === 'unassigned' ? 'var(--danger-light)' : 'var(--logic-lime)' }} />
                          <span className={s.poolSubLabel} style={{ color: p.id === 'unassigned' ? 'var(--danger-light)' : undefined }}>
                            {p.id === 'unassigned' ? 'UNASSIGNED' : `${p.name.replace(/^Pool\s+/i, '').trim().toUpperCase()} POOL`}
                          </span>
                          <span className={s.poolSubCount}>({teamsInPool.length})</span>
                        </div>
                        {teamsInPool.map(r => renderFlatRow(r))}
                      </div>
                    );
                  });
                })()
              )}
            </div>
          )}
        </>
      )}

      {/* Add Team modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Team Manually</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddTeam}>
              <div className="form-group"><label className="form-label">Team Name *</label><input className="form-input" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group"><label className="form-label">Coach</label><input className="form-input" value={addForm.coach} onChange={e => setAddForm(f => ({ ...f, coach: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select className="form-select" value={addForm.ageGroupId} onChange={e => setAddForm(f => ({ ...f, ageGroupId: e.target.value }))} required>
                    {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!!working}>Save Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FeedbackModal {...feedback} onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} />
    </div>
  );
}
