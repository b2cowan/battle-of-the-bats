'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, X, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Plus, Trash2, LayoutDashboard, ArrowLeftRight, Mail } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { AgeGroup } from '@/lib/types';
import { buildFilename, downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings } from '@/lib/export';
import s from '../../admin-common.module.css';
import styles from './teams-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import ExportMenu from '@/components/admin/ExportMenu';
import HelpCallout from '@/components/help/HelpCallout';
import {
  SelectionActionBar,
  ToolbarGroup,
  ToolbarMenu,
  ToolbarMenuItem,
  ToolbarMenuSeparator,
  ToolbarSearch,
  ToolbarSegmentedControl,
  ToolbarSelect,
  TournamentAdminHeader,
  TournamentAdminToolbar,
} from '@/components/admin/tournament';

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
  customAnswers?: Array<{
    fieldId: string;
    label: string;
    fieldType: string;
    value: string;
  }>;
}

interface PoolSlot {
  id: string;
  poolId: string;
  slotNumber: number;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
}

const SAME_ORIGIN_FETCH: RequestInit = { credentials: 'same-origin' };

async function readJsonResponse<T>(res: Response, label: string): Promise<T> {
  const data = await res.json().catch(() => null) as T | { error?: string; message?: string } | null;
  if (!res.ok) {
    const detail = data && typeof data === 'object' && 'error' in data
      ? data.error
      : data && typeof data === 'object' && 'message' in data
        ? data.message
        : null;
    const message = res.status === 401
      ? 'Your admin session is not available to the registrations API. Refresh the page or sign in again.'
      : detail ?? `${label} could not be loaded.`;
    throw new Error(message);
  }
  return data as T;
}

async function readJsonArray<T>(res: Response, label: string): Promise<T[]> {
  const data = await readJsonResponse<unknown>(res, label);
  if (!Array.isArray(data)) {
    throw new Error(`${label} returned an unexpected response.`);
  }
  return data as T[];
}

type PaymentStatus = 'paid' | 'deposit-paid' | 'pending' | 'past-due' | 'no-schedule';
type PaymentFilter = 'all' | 'unpaid' | 'deposit-paid' | 'paid' | 'past-due';
type FeeMode = 'tournament' | 'age_group';
type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';
type BulkAction = 'accept' | 'reject' | 'waitlist' | 'mark_deposit_paid' | 'mark_paid';

type TeamClaimInviteResult = {
  teamId: string;
  teamName: string;
  email: string;
  ageGroupName: string;
  claimUrl: string;
  emailed: boolean;
};

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

const PAYMENT_FILTER_LABEL: Record<PaymentFilter, string> = {
  all: 'All payment states',
  unpaid: 'Unpaid',
  'deposit-paid': 'Deposit paid',
  paid: 'Paid in full',
  'past-due': 'Past due',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

function getEffectiveFee(team: TeamRecord, ageGroups: AgeGroup[], feeMode: FeeMode, feeSchedule: FeeSchedule): FeeSchedule {
  const agFee = ageGroups.find(g => g.id === team.age_group_id);
  if (feeMode === 'age_group' && agFee?.totalFeeAmount != null) {
    return {
      depositAmount: agFee.depositAmount ?? null,
      depositDueDate: agFee.depositDueDate ?? null,
      totalFeeAmount: agFee.totalFeeAmount ?? null,
      totalFeeDueDate: agFee.totalFeeDueDate ?? null,
    };
  }
  return feeSchedule;
}

function getPaymentDue(team: TeamRecord, fee: FeeSchedule) {
  if (!fee.totalFeeAmount || team.totalPaid >= fee.totalFeeAmount) return null;
  if (fee.depositAmount && team.depositPaid < fee.depositAmount) {
    return {
      amount: Math.max(fee.depositAmount - team.depositPaid, 0),
      dueDate: fee.depositDueDate,
      label: 'Deposit due',
    };
  }
  return {
    amount: Math.max(fee.totalFeeAmount - team.totalPaid, 0),
    dueDate: fee.totalFeeDueDate,
    label: 'Balance due',
  };
}

function matchesPaymentFilter(status: PaymentStatus, filter: PaymentFilter) {
  if (filter === 'all') return true;
  if (filter === 'unpaid') return status === 'pending' || status === 'past-due';
  return status === filter;
}

export default function UnifiedTeamsPage() {
  const { currentTournament, loading: tournamentLoading } = useTournament();
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
  const [addForm, setAddForm] = useState({
    name: '',
    coach: '',
    email: '',
    ageGroupId: '',
    paymentStatus: 'pending' as 'pending' | 'paid',
    notifyTeam: false,
  });
  const [stableSortedIds, setStableSortedIds] = useState<string[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'pools'>('pools');
  const [feeMode, setFeeMode] = useState<FeeMode>('tournament');
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule>({ depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null });
  const [poolSlots, setPoolSlots] = useState<PoolSlot[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstSlotId, setSwapFirstSlotId] = useState<string | null>(null);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<Set<string>>(new Set());
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [claimInviteResults, setClaimInviteResults] = useState<TeamClaimInviteResult[]>([]);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });
  const orgQuery = useMemo(() => currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '', [currentOrg?.slug]);
  const orgParam = useMemo(() => currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '', [currentOrg?.slug]);

  const load = useCallback(async () => {
    if (tournamentLoading) return;
    if (!currentTournament) {
      setRegs([]);
      setAgeGroups([]);
      setPoolSlots([]);
      setErrorMsg(null);
      setLoading(false);
      setHasLoadedInitial(true);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const tournamentParam = `tournamentId=${encodeURIComponent(currentTournament.id)}`;
      const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const orgOnlyParam = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const [rRes, adminTeamsRes, groupsRes, tRes] = await Promise.all([
        fetch(`/api/registrations?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/teams?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/age-groups?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/tournaments${orgOnlyParam}`, SAME_ORIGIN_FETCH),
      ]);

      const groups = await readJsonArray<AgeGroup>(groupsRes, 'Divisions');
      const adminTeams = await readJsonArray<any>(adminTeamsRes, 'Teams');
      const adminMap = new Map(adminTeams.map((t: any) => [t.id, t]));

      const registrations = await readJsonArray<any>(rRes, 'Registrations');
      const rData = registrations.map((r: any) => {
        const admin = adminMap.get(r.id) ?? {};
        return {
          ...r,
          poolId: r.pool_id,
          paymentStatus: r.payment_status ?? 'pending',
          depositPaid: Number(r.deposit_paid ?? 0),
          totalPaid: Number(r.total_paid ?? 0),
          adminNotes: r.admin_notes,
          slotId: admin.slotId ?? null,
          waitlistPosition: admin.waitlistPosition ?? null,
          customAnswers: admin.customAnswers ?? [],
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

      const tournaments = await readJsonArray<any>(tRes, 'Tournaments');
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
  }, [tournamentLoading, currentTournament?.id, currentOrg?.slug, selectedAgeGroupId, stableSortedIds.length, addForm.ageGroupId]);

  const loadPoolSlots = useCallback(async () => {
    if (!selectedAgeGroupId || !currentTournament) { setPoolSlots([]); return; }
    try {
      const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/pool-slots?tournamentId=${encodeURIComponent(currentTournament.id)}&ageGroupId=${encodeURIComponent(selectedAgeGroupId)}${orgParam}`, SAME_ORIGIN_FETCH);
      setPoolSlots(await readJsonArray<PoolSlot>(res, 'Pool slots'));
    } catch { setPoolSlots([]); }
  }, [selectedAgeGroupId, currentTournament?.id, currentOrg?.slug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPoolSlots(); }, [loadPoolSlots]);

  useEffect(() => {
    setSelectedRegistrationIds(prev => {
      if (prev.size === 0) return prev;
      const validIds = new Set(regs.filter(reg => reg.age_group_id === selectedAgeGroupId).map(reg => reg.id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [regs, selectedAgeGroupId]);

  useEffect(() => {
    if (paymentInstructions || !currentTournament) return;
    setPaymentInstructions(`Please send payment for ${currentTournament.name} using the payment instructions provided by the tournament organizer. Include your team name and division in the memo or note.`);
  }, [currentTournament, paymentInstructions]);

  async function patch(id: string, updates: any, confirmMsg?: string) {
    const execute = async () => {
      setWorking(id);
      try {
        const res = await fetch(`/api/admin/teams${orgQuery}`, {
          credentials: 'same-origin',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id], updates }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Update failed');
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
          const res = await fetch(`/api/admin/teams${orgQuery}`, {
            credentials: 'same-origin',
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
          const res = await fetch(`/api/admin/teams${orgQuery}`, {
            credentials: 'same-origin',
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
          const res = await fetch(`/api/admin/teams${orgQuery}`, {
            credentials: 'same-origin',
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
              await fetch(`/api/admin/teams${orgQuery}`, {
                credentials: 'same-origin',
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
          const res = await fetch(`/api/admin/teams${orgQuery}`, {
            credentials: 'same-origin',
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
      const res = await fetch(`/api/admin/teams${orgQuery}`, {
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-team',
          team: {
            name: addForm.name,
            coach: addForm.coach,
            email: addForm.email,
            ageGroupId: addForm.ageGroupId,
            tournamentId: currentTournament.id,
            status: 'accepted',
            paymentStatus: addForm.paymentStatus,
            notifyTeam: addForm.notifyTeam,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Team could not be created.');
      closeAddTeamModal();
      load();
    } catch (e: any) {
      setFeedback({ isOpen: true, title: 'Add Team Failed', message: e.message, type: 'danger' });
    } finally {
      setWorking(null);
    }
  }

  function resetAddTeamForm() {
    setAddForm({
      name: '',
      coach: '',
      email: '',
      ageGroupId: selectedAgeGroupId || ageGroups[0]?.id || '',
      paymentStatus: 'pending',
      notifyTeam: false,
    });
  }

  function openAddTeamModal() {
    resetAddTeamForm();
    setShowAddModal(true);
  }

  function closeAddTeamModal() {
    setShowAddModal(false);
    resetAddTeamForm();
  }

  // ── Export handlers (server-side — registration data has custom fields) ──
  function guardExport(): boolean {
    if (!currentTournament) return false;
    if (!currentOrg || !hasPlanFeature(currentOrg.planId, 'registration_export')) {
      setFeedback({
        isOpen: true,
        title: 'Export Requires Tournament Plus',
        message: requiresTournamentPlusCopy('registration_export'),
        type: 'warning',
      });
      return false;
    }
    return true;
  }

  function handleExportXLSX() {
    if (!guardExport()) return;
    window.location.href = `/api/admin/tournaments/${encodeURIComponent(currentTournament!.id)}/registrations/export?format=xlsx${orgParam}`;
  }

  function handleExportCSV() {
    if (!guardExport()) return;
    window.location.href = `/api/admin/tournaments/${encodeURIComponent(currentTournament!.id)}/registrations/export?format=csv${orgParam}`;
  }

  async function handleExportPDF() {
    if (!guardExport()) return;

    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };

    const headers = ['Team', 'Division', 'Coach', 'Email', 'Status', 'Slot / Pool', 'Payment'];

    // Group all accepted/waitlisted regs by division for page breaks
    const acceptedRegs = regs.filter(r => r.status === 'accepted' || r.status === 'waitlist' || r.status === 'pending');
    const groupMap = new Map<string, typeof acceptedRegs>();
    for (const r of acceptedRegs) {
      const div = r.age_group_name || 'Uncategorized';
      if (!groupMap.has(div)) groupMap.set(div, []);
      groupMap.get(div)!.push(r);
    }

    const groups = Array.from(groupMap.entries()).map(([label, divRegs]) => ({
      label,
      rows: divRegs.map(r => [
        r.name,
        r.age_group_name,
        r.coach,
        r.email,
        r.status.charAt(0).toUpperCase() + r.status.slice(1),
        r.slotId ? `Slot ${r.slotId}` : (r.waitlistPosition != null ? `Waitlist #${r.waitlistPosition}` : '—'),
        r.paymentStatus === 'paid' ? 'Paid' : r.depositPaid > 0 ? 'Deposit' : 'Pending',
      ]),
    }));

    // Flat fallback for orgs without divisions
    const flatRows = acceptedRegs.map(r => [
      r.name, r.age_group_name, r.coach, r.email,
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
      r.slotId ? `Slot ${r.slotId}` : '—',
      r.paymentStatus === 'paid' ? 'Paid' : r.depositPaid > 0 ? 'Deposit' : 'Pending',
    ]);

    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'registrations', scope: String(currentTournament?.year ?? '') },
      'pdf',
    );

    await downloadPDF(
      filename,
      'Tournament Registrations',
      currentTournament?.name,
      headers,
      flatRows,
      settings,
      groups.length > 0 ? groups : undefined,
    );
  }

  function toggleRegistrationSelection(id: string) {
    setSelectedRegistrationIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setSelectedRegistrations(ids: string[]) {
    setSelectedRegistrationIds(new Set(ids));
  }

  async function runBulkAction(action: BulkAction) {
    if (!currentTournament || selectedRegistrationIds.size === 0) return;
    const selectedCount = selectedRegistrationIds.size;

    const label: Record<BulkAction, string> = {
      accept: 'accept',
      reject: 'reject',
      waitlist: 'move to the waitlist',
      mark_deposit_paid: 'mark deposit paid',
      mark_paid: 'mark paid',
    };

    setFeedback({
      isOpen: true,
      title: 'Run Bulk Action?',
      message: `This will ${label[action]} ${selectedCount} selected registration${selectedCount === 1 ? '' : 's'}.`,
      type: action === 'reject' ? 'warning' : 'primary',
      onConfirm: async () => {
        setWorking('bulk');
        try {
          const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/registrations/bulk${orgQuery}`, {
            credentials: 'same-origin',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ids: [...selectedRegistrationIds] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Bulk action failed.');
          setSelectedRegistrationIds(new Set());
          await Promise.all([load(), loadPoolSlots()]);
          setFeedback({
            isOpen: true,
            title: 'Bulk Action Complete',
            message: `${data.count ?? selectedCount} registration${(data.count ?? selectedCount) === 1 ? '' : 's'} updated.`,
            type: 'success',
          });
        } catch (error) {
          setFeedback({
            isOpen: true,
            title: 'Bulk Action Failed',
            message: error instanceof Error ? error.message : 'Bulk action failed.',
            type: 'danger',
          });
        } finally {
          setWorking(null);
        }
      },
    });
  }

  async function sendPaymentReminders() {
    if (!currentTournament || selectedRegistrationIds.size === 0) return;

    if (!currentOrg || !hasPlanFeature(currentOrg.planId, 'payment_readiness_tools')) {
      setFeedback({
        isOpen: true,
        title: 'Payment Tools Require Tournament Plus',
        message: requiresTournamentPlusCopy('payment_readiness_tools'),
        type: 'warning',
      });
      setShowReminderModal(false);
      return;
    }

    setWorking('payment-reminders');
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/registrations/payment-reminders${orgQuery}`, {
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [...selectedRegistrationIds],
          paymentInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Payment reminders could not be sent.');
      setShowReminderModal(false);
      setFeedback({
        isOpen: true,
        title: 'Payment Reminders Sent',
        message: `${data.emailsSent ?? 0} reminder${(data.emailsSent ?? 0) === 1 ? '' : 's'} sent. ${data.skippedCount ?? 0} selected registration${(data.skippedCount ?? 0) === 1 ? ' was' : 's were'} skipped because no payment is currently due.`,
        type: 'success',
      });
    } catch (error) {
      setFeedback({
        isOpen: true,
        title: 'Reminder Send Failed',
        message: error instanceof Error ? error.message : 'Payment reminders could not be sent.',
        type: 'danger',
      });
    } finally {
      setWorking(null);
    }
  }

  async function sendTeamClaimInvites() {
    if (!currentTournament || selectedRegistrationIds.size === 0) return;

    const selectedIds = [...selectedRegistrationIds];
    const selectedTeams = regs.filter(team => selectedRegistrationIds.has(team.id));
    const withEmail = selectedTeams.filter(team => team.email?.trim()).length;
    const eligibleWithEmail = selectedTeams.filter(team => (team.status === 'accepted' || team.status === 'pending') && team.email?.trim()).length;

    if (withEmail === 0) {
      setFeedback({
        isOpen: true,
        title: 'No Team Contacts',
        message: 'Select at least one pending or accepted registration with an email address before sending Team workspace claim invites.',
        type: 'warning',
      });
      return;
    }
    if (eligibleWithEmail === 0) {
      setFeedback({
        isOpen: true,
        title: 'No Eligible Teams',
        message: 'Team workspace claim invites can be sent to pending or accepted teams with an email address. Waitlisted and rejected teams are skipped.',
        type: 'warning',
      });
      return;
    }

    setFeedback({
      isOpen: true,
      title: 'Send Team Claim Invites?',
      message: `This will create secure Team workspace claim links for ${selectedIds.length} selected registration${selectedIds.length === 1 ? '' : 's'} and email eligible team contacts. Pending and accepted teams are eligible; waitlist, rejected, missing-email, and already-claimed teams are skipped. ${eligibleWithEmail} selected registration${eligibleWithEmail === 1 ? ' has' : 's have'} both an email and an eligible status.`,
      type: 'primary',
      onConfirm: async () => {
        setWorking('team-claims');
        setClaimInviteResults([]);
        try {
          const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/team-claims${orgQuery}`, {
            credentials: 'same-origin',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds, sendEmail: true }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Team claim invites could not be sent.');

          const skippedCount = data.skippedCount ?? 0;
          const linksCreated = data.linksCreated ?? 0;
          setClaimInviteResults(Array.isArray(data.results) ? data.results : []);
          setFeedback({
            isOpen: true,
            title: linksCreated > 0 ? 'Team Claim Invites Sent' : 'No Invites Sent',
            message: `${linksCreated} claim link${linksCreated === 1 ? '' : 's'} created. ${data.emailsSent ?? 0} email${(data.emailsSent ?? 0) === 1 ? '' : 's'} sent. ${skippedCount} selected registration${skippedCount === 1 ? ' was' : 's were'} skipped.`,
            type: linksCreated > 0 ? 'success' : 'warning',
          });
        } catch (error) {
          setFeedback({
            isOpen: true,
            title: 'Team Claim Invites Failed',
            message: error instanceof Error ? error.message : 'Team claim invites could not be sent.',
            type: 'danger',
          });
        } finally {
          setWorking(null);
        }
      },
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const selectedGroup = ageGroups.find(g => g.id === selectedAgeGroupId);
  const slotConfigured = poolSlots.length > 0;
  const waitlistAutomationAvailable = currentOrg ? hasPlanFeature(currentOrg.planId, 'waitlist_automation') : false;
  const paymentToolsAvailable = currentOrg ? hasPlanFeature(currentOrg.planId, 'payment_readiness_tools') : false;

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;
  const showPdfNudge = canUsePDF && pdfSettings !== null && Object.keys(pdfSettings).length === 0;

  useEffect(() => {
    fetch(`/api/admin/org/pdf-settings${orgQuery}`, SAME_ORIGIN_FETCH)
      .then(r => r.ok ? r.json() : {})
      .then(data => setPdfSettings(data as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgQuery]);
  const divRegs = regs.filter(r => r.age_group_id === selectedAgeGroupId);
  const waitlistTeams = divRegs.filter(r => r.waitlistPosition != null).sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const filledSlotCount = poolSlots.filter(s => s.teamId !== null).length;
  const pendingCount = divRegs.filter(r => r.status === 'pending').length;
  const paymentSummary = useMemo(() => {
    const accepted = divRegs.filter(team => team.status === 'accepted');
    let expected = 0;
    let collected = 0;
    let outstanding = 0;
    let depositComplete = 0;
    let pastDue = 0;
    let scheduled = 0;

    for (const team of accepted) {
      const fee = getEffectiveFee(team, ageGroups, feeMode, feeSchedule);
      const status = computePaymentStatus(team, fee, today);
      if (fee.totalFeeAmount) {
        scheduled++;
        expected += fee.totalFeeAmount;
        collected += Math.min(team.totalPaid, fee.totalFeeAmount);
        outstanding += Math.max(fee.totalFeeAmount - team.totalPaid, 0);
      }
      if (fee.depositAmount && team.depositPaid >= fee.depositAmount) depositComplete++;
      if (status === 'past-due') pastDue++;
    }

    return {
      accepted: accepted.length,
      scheduled,
      expected,
      collected,
      outstanding,
      depositComplete,
      pastDue,
    };
  }, [ageGroups, divRegs, feeMode, feeSchedule, today]);

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
    const effectiveFee = getEffectiveFee(team, ageGroups, feeMode, feeSchedule);
    const pStatus = computePaymentStatus(team, effectiveFee, today);
    const due = getPaymentDue(team, effectiveFee);
    const busy = working === team.id;

    return (
      <div className={`${s.expandedRow} ${styles.compactExpandedRow}`}>
        <div className={styles.teamDetailShell}>
          <div className={styles.teamDetailMeta}>
            {team.email ? <a href={`mailto:${team.email}`}>{team.email}</a> : <span>Email not provided</span>}
            <span>Registered {new Date(team.registered_at).toLocaleDateString()}</span>
          </div>
          <div className={styles.teamQuickActions}>
              {team.status !== 'accepted' && (
                <button className="btn btn-primary btn-data" onClick={() => patch(team.id, { status: 'accepted' }, `Accept "${team.name}"? An automated email will be sent.`)} disabled={busy}>Accept</button>
              )}
              {team.status !== 'rejected' && (
                <button className="btn btn-outline btn-data" style={{ color: 'var(--danger)' }} onClick={() => patch(team.id, { status: 'rejected' }, `Reject "${team.name}"? An automated email will be sent.`)} disabled={busy}>Reject</button>
              )}
              {team.status === 'accepted' && !effectiveFee.totalFeeAmount ? (
                <button className="btn btn-ghost btn-data" onClick={() => patch(team.id, { paymentStatus: team.paymentStatus === 'paid' ? 'pending' : 'paid' })} disabled={busy}>
                  {team.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                </button>
              ) : null}
              <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(team.id, team.name)} disabled={busy} style={{ color: 'var(--danger)' }} aria-label={`Delete ${team.name}`}>
                <Trash2 size={13} />
              </button>
              {team.status === 'accepted' && (
                <a href={`/${currentOrg?.slug ?? ''}/teams/${team.id}`} target="_blank" className="btn btn-ghost btn-data">Profile ↗</a>
              )}
            </div>

            {team.status === 'accepted' && effectiveFee.totalFeeAmount ? (
              <details className={styles.teamDetailSection}>
                <summary className={styles.teamDetailSummary}>
                  Payment
                  <span className={`badge badge-${PAYMENT_STATUS_STYLE[pStatus]}`}>{PAYMENT_STATUS_LABEL[pStatus]}</span>
                </summary>
                <div className={styles.teamDetailPanel}>
                  <div className={styles.paymentEditor}>
                    <label className={styles.paymentField}>
                      <span>Deposit Paid ($)</span>
                      <input type="number" min="0" step="0.01" defaultValue={team.depositPaid || ''} placeholder="0.00"
                        onBlur={e => { const val = parseFloat(e.target.value) || 0; if (val !== team.depositPaid) patch(team.id, { depositPaid: val }); }} />
                    </label>
                    <label className={styles.paymentField}>
                      <span>Total Paid ($)</span>
                      <input type="number" min="0" step="0.01" defaultValue={team.totalPaid || ''} placeholder="0.00"
                        onBlur={e => { const val = parseFloat(e.target.value) || 0; if (val !== team.totalPaid) patch(team.id, { totalPaid: val }); }} />
                    </label>
                  </div>
                  {due && (
                    <p className={styles.paymentDue}>
                      {due.label}: <strong>{formatMoney(due.amount)}</strong>
                      {due.dueDate ? ` by ${new Date(due.dueDate).toLocaleDateString()}` : ''}
                    </p>
                  )}
                </div>
              </details>
            ) : null}

            <details className={styles.teamDetailSection}>
              <summary className={styles.teamDetailSummary}>Admin notes</summary>
              <div className={styles.teamDetailPanel}>
                <div className={styles.notesArea}>
                  <textarea placeholder="Private notes..." defaultValue={team.adminNotes} onBlur={e => e.target.value !== team.adminNotes && patch(team.id, { adminNotes: e.target.value })} />
                </div>
              </div>
            </details>

            {team.customAnswers && team.customAnswers.length > 0 && (
              <details className={styles.teamDetailSection}>
                <summary className={styles.teamDetailSummary}>Registration answers</summary>
                <div className={styles.teamDetailPanel}>
                  <div className={styles.answerList}>
                    {team.customAnswers.map(answer => (
                      <div key={answer.fieldId} className={styles.answerItem}>
                        <strong>{answer.label}</strong>
                        <span>{answer.value || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
    );
  }

  // Flat list state (non-slot-configured divisions)
  const filtered = divRegs.filter(r => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
    const matchesSearch = search === '' || r.name.toLowerCase().includes(search.toLowerCase()) || r.coach.toLowerCase().includes(search.toLowerCase());
    const pStatus = computePaymentStatus(r, getEffectiveFee(r, ageGroups, feeMode, feeSchedule), today);
    const matchesPayment = !paymentToolsAvailable || matchesPaymentFilter(pStatus, paymentFilter);
    return matchesStatus && matchesSearch && matchesPayment;
  });
  const sorted = stableSortedIds.map(id => filtered.find(r => r.id === id)).filter(Boolean) as TeamRecord[];
  const flatDisplay = [...sorted, ...filtered.filter(r => !stableSortedIds.includes(r.id))];
  const selectableRows = slotConfigured
    ? divRegs.filter(row => row.waitlistPosition != null || poolSlots.some(slot => slot.teamId === row.id))
    : flatDisplay;
  const visibleSelectableIds = selectableRows.map(row => row.id);
  const allVisibleSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every(id => selectedRegistrationIds.has(id));
  const divisionOptions = ageGroups.length
    ? ageGroups.map(g => ({ value: g.id, label: g.name }))
    : [{ value: '', label: 'No divisions' }];

  const renderFlatRow = (r: TeamRecord) => {
    const isExpanded = expanded.has(r.id);
    const effectiveFee = getEffectiveFee(r, ageGroups, feeMode, feeSchedule);
    const pStatus = computePaymentStatus(r, effectiveFee, today);

    return (
      <div key={r.id} className={s.row}>
        <div className={`${s.rowMain} ${styles.teamRowMain}`}>
          <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={selectedRegistrationIds.has(r.id)}
              onChange={() => toggleRegistrationSelection(r.id)}
              aria-label={`Select ${r.name}`}
            />
          </div>
          <div style={{ flex: 2 }} className={s.primaryCell}><strong>{r.name}</strong></div>
          <div style={{ flex: 1.5 }} className={s.secondaryCell}>{r.coach}</div>
          <div style={{ width: 120 }}>
            <span className={`badge badge-${r.status === 'accepted' ? 'neutral' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span>
          </div>
          <div style={{ width: 120, paddingLeft: '1rem' }}>
            {r.status === 'accepted' && pStatus !== 'no-schedule'
              ? <span className={`badge badge-${PAYMENT_STATUS_STYLE[pStatus]}`}>{PAYMENT_STATUS_LABEL[pStatus]}</span>
              : r.status === 'accepted'
              ? <span className={`badge badge-${r.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{r.paymentStatus}</span>
              : '-'}
          </div>
          <div style={{ width: 40, textAlign: 'right' }}>
            <button className={s.iconBtn} onClick={() => setExpanded(prev => {
              const set = new Set(prev);
              if (set.has(r.id)) set.delete(r.id);
              else set.add(r.id);
              return set;
            })}>
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
      <TournamentAdminHeader
        icon={<Users size={20} />}
        title="Registrations"
        subtitle="Manage all teams and signups in one place"
        actions={(
          <>
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            planId={currentOrg?.planId}
            pdfFeatureKey="pdf_exports"
            disabled={regs.length === 0}
          />
          <button className="btn btn-lime btn-data" onClick={openAddTeamModal} disabled={!currentTournament}><Plus size={14} /> Add Team</button>
          </>
        )}
      />

      {showPdfNudge && (
        <HelpCallout
          variant="info"
          title="PDF settings not configured"
          body="Your PDF export will use default styling. Set up your header, logo, and footer once and all future PDFs will use those settings."
          cta={{ label: 'Configure PDF Settings', href: `/${currentOrg?.slug}/admin/org/settings/pdf` }}
          dismissible
          localStorageKey="flhq-pdf-nudge-registrations"
        />
      )}

      {errorMsg && (
        <div className="alert alert-danger" style={{ margin: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={18} /><span>{errorMsg}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => load()} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      <TournamentAdminToolbar ariaLabel="Registration controls">
        {/* ── Row 1: controls + end actions ── */}
        <ToolbarGroup grow>
          <ToolbarSelect
            label="Division"
            value={selectedAgeGroupId}
            options={divisionOptions}
            disabled={ageGroups.length === 0}
            onChange={value => { setSelectedAgeGroupId(value); setSwapMode(false); setSwapFirstSlotId(null); }}
          />
          {!slotConfigured && (
            <ToolbarSegmentedControl
              ariaLabel="Registration view"
              value={viewMode}
              options={[
                { value: 'flat', label: 'Flat' },
                { value: 'pools', label: 'Pools' },
              ]}
              onChange={setViewMode}
            />
          )}
        </ToolbarGroup>

        <ToolbarGroup align="end">
          {visibleSelectableIds.length > 0 && (
          <label className={styles.selectCurrent}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={visibleSelectableIds.length === 0}
              onChange={() => {
                if (allVisibleSelected) setSelectedRegistrations([]);
                else setSelectedRegistrations(visibleSelectableIds);
              }}
            />
            Select all visible
          </label>
          )}
          <ToolbarMenu label="Tools">
            <ToolbarMenuItem
              icon={<LayoutDashboard size={14} />}
              label="Division summary"
              hint="Review registrations and capacity by division"
              onSelect={() => setShowSummaryModal(true)}
            />
            {slotConfigured ? (
              <>
                <ToolbarMenuItem
                  icon={<RefreshCw size={14} className={working === 'randomizing' ? 'spin' : ''} />}
                  label="Randomize slots"
                  hint="Shuffle teams across configured slots"
                  disabled={loading || working === 'randomizing'}
                  onSelect={randomizeSlots}
                />
                <ToolbarMenuItem
                  icon={<ArrowLeftRight size={14} />}
                  label={swapMode ? 'Turn off swap mode' : 'Swap mode'}
                  hint={swapMode ? 'Slot swapping is currently active' : 'Pick two slots to swap assignments'}
                  onSelect={() => { setSwapMode(m => !m); setSwapFirstSlotId(null); }}
                />
              </>
            ) : (
              <ToolbarMenuItem
                icon={<RefreshCw size={14} className={working === 'randomizing' ? 'spin' : ''} />}
                label="Randomize pools"
                hint="Distribute accepted teams across pools"
                disabled={loading || working === 'randomizing'}
                onSelect={randomizePools}
              />
            )}
            <ToolbarMenuSeparator />
            {paymentToolsAvailable ? (
              <>
                <div className={styles.toolsSection} role="none">
                  <div className={styles.toolsSectionTitle}>Payment readiness</div>
                  <div className={styles.toolsMetrics}>
                    <span><strong>{formatMoney(paymentSummary.collected)}</strong> collected</span>
                    <span><strong>{formatMoney(paymentSummary.outstanding)}</strong> outstanding</span>
                    <span><strong>{paymentSummary.pastDue}</strong> past due</span>
                  </div>
                </div>
                {!slotConfigured && (
                  <div className={styles.toolsSection} role="none">
                    <div className={styles.toolsSectionTitle}>Payment filter</div>
                    <div className={styles.toolsFilterGrid}>
                      {(['all', 'unpaid', 'deposit-paid', 'paid', 'past-due'] as PaymentFilter[]).map(filter => (
                        <button
                          key={filter}
                          type="button"
                          className={`${styles.toolsFilterButton} ${paymentFilter === filter ? styles.toolsFilterButtonActive : ''}`}
                          onClick={() => setPaymentFilter(filter)}
                        >
                          {PAYMENT_FILTER_LABEL[filter]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <ToolbarMenuItem
                locked
                label="Payment readiness"
                hint={requiresTournamentPlusCopy('payment_readiness_tools')}
                onSelect={() => setFeedback({
                  isOpen: true,
                  title: 'Payment Tools Require Tournament Plus',
                  message: requiresTournamentPlusCopy('payment_readiness_tools'),
                  type: 'warning',
                })}
              />
            )}
          </ToolbarMenu>
        </ToolbarGroup>

        {/* ── Row 2: filter chips + search — always on their own full-width row ── */}
        {!slotConfigured && (
          <ToolbarGroup fullWidth>
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
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search teams or coaches..." />
            {paymentToolsAvailable && paymentFilter !== 'all' && (
              <span className={styles.activeFilterBadge}>Payment: {PAYMENT_FILTER_LABEL[paymentFilter]}</span>
            )}
          </ToolbarGroup>
        )}
      </TournamentAdminToolbar>

      <SelectionActionBar
        selectedCount={selectedRegistrationIds.size}
        label={`${selectedRegistrationIds.size} selected`}
        onClear={() => setSelectedRegistrations([])}
        className={styles.registrationSelectionBar}
      >
        <button type="button" className="btn btn-primary btn-data" onClick={() => runBulkAction('accept')} disabled={working === 'bulk'}>
          Accept
        </button>
        <button type="button" className="btn btn-outline btn-data" onClick={() => runBulkAction('waitlist')} disabled={working === 'bulk'}>
          Waitlist
        </button>
        <button type="button" className="btn btn-outline btn-data" onClick={() => runBulkAction('mark_deposit_paid')} disabled={working === 'bulk'}>
          Deposit
        </button>
        <button type="button" className="btn btn-outline btn-data" onClick={() => runBulkAction('mark_paid')} disabled={working === 'bulk'}>
          Paid
        </button>
        {paymentToolsAvailable && (
          <button
            type="button"
            className="btn btn-outline btn-data"
            onClick={() => setShowReminderModal(true)}
            disabled={working === 'payment-reminders'}
          >
            <Mail size={12} /> Reminder
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-data"
          onClick={sendTeamClaimInvites}
          disabled={working === 'team-claims'}
        >
          <Mail size={12} /> Team Claim
        </button>
        <button type="button" className="btn btn-outline btn-data" style={{ color: 'var(--danger)' }} onClick={() => runBulkAction('reject')} disabled={working === 'bulk'}>
          Reject
        </button>
      </SelectionActionBar>

      {claimInviteResults.length > 0 && (
        <div className={styles.claimInvitePanel}>
          <div className={styles.claimInviteHeader}>
            <div>
              <strong>Team claim invites ready</strong>
              <p>{claimInviteResults.length} secure claim link{claimInviteResults.length === 1 ? '' : 's'} generated from the last send.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setClaimInviteResults([])}>
              <X size={14} /> Clear
            </button>
          </div>
          <div className={styles.claimInviteList}>
            {claimInviteResults.slice(0, 6).map(result => (
              <div key={result.teamId} className={styles.claimInviteItem}>
                <div>
                  <strong>{result.teamName}</strong>
                  <span>{result.ageGroupName} - {result.email} - {result.emailed ? 'emailed' : 'link only'}</span>
                </div>
                <a href={result.claimUrl} target="_blank" rel="noreferrer">Open claim</a>
              </div>
            ))}
            {claimInviteResults.length > 6 && (
              <p className={styles.claimInviteMore}>Showing 6 of {claimInviteResults.length}. Emails were sent to every generated contact.</p>
            )}
          </div>
        </div>
      )}

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
                <span>{formatPoolName(pool.name)}</span>
                <span className={styles.slotPoolCount}>{slots.filter(s => s.teamId).length}/{slots.length}</span>
              </div>

              {slots.map(slot => {
                const team = slot.teamId ? divRegs.find(r => r.id === slot.teamId) : null;
                const isExpanded = expanded.has(slot.id);
                const isSwapSelected = swapFirstSlotId === slot.id;
                const teamPaymentStatus = team
                  ? computePaymentStatus(team, getEffectiveFee(team, ageGroups, feeMode, feeSchedule), today)
                  : null;

                return (
                  <div
                    key={slot.id}
                    className={`${styles.slotRow} ${!team ? styles.slotRowEmpty : ''} ${isSwapSelected ? styles.slotRowSwapSelected : ''}`}
                    onClick={swapMode ? () => handleSwapSlots(slot.id) : undefined}
                    style={swapMode ? { cursor: 'pointer' } : undefined}
                  >
                    <div className={styles.slotRowMain}>
                      {team && (
                        <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedRegistrationIds.has(team.id)}
                            onChange={() => toggleRegistrationSelection(team.id)}
                            aria-label={`Select ${team.name}`}
                          />
                        </span>
                      )}
                      <span className={styles.slotName}>{slot.displayName}</span>
                      {team ? (
                        <>
                          <span className={styles.slotTeamName}>{team.name}</span>
                          <span className={styles.slotCoach}>{team.coach}</span>
                          <span className={`badge badge-${team.status === 'accepted' ? 'neutral' : team.status === 'rejected' ? 'danger' : 'warning'}`} style={{ flexShrink: 0 }}>{team.status}</span>
                          {team.status === 'accepted' && teamPaymentStatus && teamPaymentStatus !== 'no-schedule' && (
                            <span className={`badge badge-${PAYMENT_STATUS_STYLE[teamPaymentStatus]}`} style={{ flexShrink: 0 }}>
                              {PAYMENT_STATUS_LABEL[teamPaymentStatus]}
                            </span>
                          )}
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
                          <button className={s.iconBtn} onClick={() => setExpanded(prev => {
                            const set = new Set(prev);
                            if (set.has(slot.id)) set.delete(slot.id);
                            else set.add(slot.id);
                            return set;
                          })}>
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
                  <input
                    type="checkbox"
                    checked={selectedRegistrationIds.has(team.id)}
                    onChange={() => toggleRegistrationSelection(team.id)}
                    aria-label={`Select ${team.name}`}
                  />
                  <span className={styles.waitlistPosition}>#{team.waitlistPosition}</span>
                  <span className={styles.slotTeamName}>{team.name}</span>
                  <span className={styles.slotCoach}>{team.coach}</span>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => waitlistAutomationAvailable
                      ? handlePromote(team.id, team.name)
                      : setFeedback({
                        isOpen: true,
                        title: 'Waitlist Automation Requires Tournament Plus',
                        message: requiresTournamentPlusCopy('waitlist_automation'),
                        type: 'warning',
                      })}
                    disabled={working === team.id || (waitlistAutomationAvailable && filledSlotCount >= poolSlots.length)}
                  >
                    {!waitlistAutomationAvailable ? 'Tournament Plus' : filledSlotCount >= poolSlots.length ? 'No Slots' : 'Promote'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (
        /* ── FLAT LIST (divisions without pool slots configured) ──────────────── */
        <>
          {!hasLoadedInitial ? (
            <div className="empty-state"><RefreshCw size={32} className="spin" style={{ opacity: 0.4 }} /><p>Loading…</p></div>
          ) : flatDisplay.length === 0 ? (
            <div className="empty-state">
              <Users size={40} style={{ opacity: 0.2 }} />
              <p>{!currentTournament ? 'No tournament selected.' : ageGroups.length === 0 ? 'No divisions configured yet.' : 'No teams matching filters.'}</p>
            </div>
          ) : (
            <div className={s.compactList}>
              {/* Column header + rows wrapped in flatList so compactList's
                  gap:2.5rem applies to the whole table block, not each row */}
              <div className={styles.flatList}>
                {/* ── Column headers ── */}
                <div className={styles.colHeader}>
                  <div style={{ width: 32 }} />
                  <div style={{ flex: 2 }}>Team</div>
                  <div style={{ flex: 1.5 }}>Coach</div>
                  <div style={{ width: 120 }}>Status</div>
                  <div style={{ width: 120, paddingLeft: '1rem' }}>Payment</div>
                  <div style={{ width: 40 }} />
                </div>

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
                        <div key={p.id} className={s.poolSubSection} style={{ marginTop: 0 }}>
                          <div className={s.poolSubHeader}>
                            <div className={s.poolDot} style={{ background: p.id === 'unassigned' ? 'var(--danger-light)' : 'var(--logic-lime)' }} />
                            <span className={s.poolSubLabel} style={{ color: p.id === 'unassigned' ? 'var(--danger-light)' : undefined }}>
                              {p.id === 'unassigned' ? 'Unassigned' : formatPoolName(p.name)}
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
            </div>
          )}
        </>
      )}

      {/* Add Team modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddTeamModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Team Manually</h3>
              <button className="btn btn-ghost btn-sm" onClick={closeAddTeamModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddTeam}>
              <div className="form-group"><label className="form-label">Team Name *</label><input className="form-input" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group"><label className="form-label">Coach</label><input className="form-input" value={addForm.coach} onChange={e => setAddForm(f => ({ ...f, coach: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} required={addForm.notifyTeam} /></div>
              </div>
              <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select className="form-select" value={addForm.ageGroupId} onChange={e => setAddForm(f => ({ ...f, ageGroupId: e.target.value }))} required>
                    {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={addForm.paymentStatus} onChange={e => setAddForm(f => ({ ...f, paymentStatus: e.target.value as 'pending' | 'paid' }))}>
                    <option value="pending">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <label className={styles.notifyToggle}>
                <input
                  type="checkbox"
                  checked={addForm.notifyTeam}
                  onChange={e => setAddForm(f => ({ ...f, notifyTeam: e.target.checked }))}
                />
                <span>Notify team that they have been registered in this tournament</span>
              </label>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeAddTeamModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!!working}>Save Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Mail size={18} style={{ color: 'var(--logic-lime)' }} />
                <h3 style={{ margin: 0 }}>Send Payment Reminders</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReminderModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.5rem 2rem', display: 'grid', gap: '1rem' }}>
              <div className="alert alert-info" style={{ margin: 0 }}>
                {selectedRegistrationIds.size} selected. Reminders are sent only to accepted teams with an outstanding amount.
              </div>
              <div className="form-group">
                <label className="form-label">Payment Instructions</label>
                <textarea
                  className="form-textarea"
                  value={paymentInstructions}
                  onChange={e => setPaymentInstructions(e.target.value)}
                  rows={6}
                  placeholder="E-transfer, cheque, or payment-link instructions..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowReminderModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={sendPaymentReminders}
                disabled={working === 'payment-reminders' || paymentInstructions.trim().length === 0}
              >
                {working === 'payment-reminders' ? 'Sending...' : 'Send Reminders'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal {...feedback} onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} />
    </div>
  );
}
