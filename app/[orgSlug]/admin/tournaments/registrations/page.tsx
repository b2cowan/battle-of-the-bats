'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Users, X, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Plus, SlidersHorizontal, Trash2, ArrowLeftRight, Mail, Pencil, ClipboardList, ExternalLink, ListChecks, Check, Lock, Unlock } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import {
  buildRegistrationAttentionSummary,
  getRegistrationAttentionBucket,
  isRegistrationAttentionKey,
  teamMatchesRegistrationAttentionKey,
  type RegistrationAttentionContext,
  type RegistrationAttentionField,
  type RegistrationAttentionKey,
} from '@/lib/registration-attention';
import { Division } from '@/lib/types';
import { buildFilename, downloadPDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings } from '@/lib/export';
import s from '../../admin-common.module.css';
import styles from './teams-admin.module.css';
import FeedbackModal from '@/components/FeedbackModal';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  SelectionActionBar,
  ToolbarGroup,
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
  division_id: string;
  division_name: string;
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
  divisionId: string;
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
type ActivePaymentFilter = Exclude<PaymentFilter, 'all'>;
type FeeMode = 'tournament' | 'division';
type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';
type BulkAction = 'accept' | 'reject' | 'waitlist' | 'mark_deposit_paid' | 'mark_paid';

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
const APPROVAL_STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  waitlist: 'Waitlist',
  rejected: 'Rejected',
};
const APPROVAL_STATUS_INITIAL: Record<Status, string> = {
  pending: 'P',
  accepted: 'A',
  waitlist: 'W',
  rejected: 'R',
};
const APPROVAL_STATUS_ORDER: Record<Status, number> = {
  pending: 1,
  accepted: 2,
  waitlist: 3,
  rejected: 4,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

function getEffectiveFee(team: TeamRecord, divisions: Division[], feeMode: FeeMode, feeSchedule: FeeSchedule): FeeSchedule {
  const agFee = divisions.find(g => g.id === team.division_id);
  if (feeMode === 'division' && agFee?.totalFeeAmount != null) {
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

function hasDepositStep(fee: FeeSchedule) {
  return Boolean(fee.depositAmount && fee.totalFeeAmount && fee.depositAmount < fee.totalFeeAmount);
}

function getPaymentTooltip(team: TeamRecord, fee: FeeSchedule, status: PaymentStatus) {
  if (!fee.totalFeeAmount) return 'No payment schedule configured';
  const parts = [PAYMENT_STATUS_LABEL[status]];
  if (fee.depositAmount) {
    parts.push(`Deposit ${formatMoney(team.depositPaid)} / ${formatMoney(fee.depositAmount)}`);
  }
  parts.push(`Total ${formatMoney(team.totalPaid)} / ${formatMoney(fee.totalFeeAmount)}`);
  const due = getPaymentDue(team, fee);
  if (due) {
    const dueDate = due.dueDate ? ` by ${new Date(due.dueDate + 'T12:00:00').toLocaleDateString()}` : '';
    parts.push(`${due.label}: ${formatMoney(due.amount)}${dueDate}`);
  }
  return parts.join(' - ');
}

function getPaymentSymbolSteps(team: TeamRecord, fee: FeeSchedule, today: string) {
  if (!fee.totalFeeAmount) return [];

  const fullPaid = team.totalPaid >= fee.totalFeeAmount;
  const totalPastDue = Boolean(fee.totalFeeDueDate && today > fee.totalFeeDueDate && !fullPaid);

  if (!hasDepositStep(fee)) {
    return [{
      key: 'total',
      label: fullPaid ? 'Paid in full' : totalPastDue ? 'Past due' : 'Payment pending',
      tone: fullPaid ? 'paid' : totalPastDue ? 'danger' : 'pending',
    }];
  }

  const depositAmount = fee.depositAmount ?? 0;
  const depositPaid = fullPaid || team.depositPaid >= depositAmount;
  const depositPastDue = Boolean(fee.depositDueDate && today > fee.depositDueDate && !depositPaid);

  return [
    {
      key: 'deposit',
      label: depositPaid ? 'Deposit paid' : depositPastDue ? 'Deposit past due' : 'Deposit pending',
      tone: depositPaid ? 'paid' : depositPastDue ? 'danger' : 'pending',
    },
    {
      key: 'total',
      label: fullPaid ? 'Paid in full' : totalPastDue ? 'Balance past due' : 'Balance pending',
      tone: fullPaid ? 'paid' : totalPastDue ? 'danger' : 'pending',
    },
  ];
}

function matchesPaymentFilter(status: PaymentStatus, filter: PaymentFilter) {
  if (filter === 'all') return true;
  if (filter === 'unpaid') return status === 'pending' || status === 'past-due';
  return status === filter;
}

export default function UnifiedTeamsPage() {
  const { currentTournament, isLocked, loading: tournamentLoading } = useTournament();
  const { currentOrg } = useOrg();
  const searchParams = useSearchParams();
  usePageTitle('Teams');
  const [regs, setRegs] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(['pending', 'accepted', 'waitlist']);
  const [search, setSearch] = useState('');
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    coach: '',
    email: '',
    divisionId: '',
    paymentStatus: 'pending' as 'pending' | 'paid',
    notifyTeam: false,
  });
  const [stableSortedIds, setStableSortedIds] = useState<string[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'pools'>('pools');
  const [feeMode, setFeeMode] = useState<FeeMode>('tournament');
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule>({ depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null });
  const [poolSlots, setPoolSlots] = useState<PoolSlot[]>([]);
  const [allPoolSlots, setAllPoolSlots] = useState<PoolSlot[]>([]);
  const [registrationFields, setRegistrationFields] = useState<RegistrationAttentionField[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstSlotId, setSwapFirstSlotId] = useState<string | null>(null);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<Set<string>>(new Set());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [paymentFilters, setPaymentFilters] = useState<ActivePaymentFilter[]>([]);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [activeAttentionKey, setActiveAttentionKey] = useState<RegistrationAttentionKey | null>(null);
  const attentionQueryAppliedRef = useRef<string | null>(null);
  const divisionQueryAppliedRef = useRef<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [editingTeam, setEditingTeam] = useState<TeamRecord | null>(null);
  const [editForm, setEditForm] = useState({ name: '', coach: '', email: '' });
  const [feedback, setFeedback] = useState<{
    isOpen: boolean; title: string; message: string;
    items?: Array<{ label: string; note?: string }>;
    confirmText?: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'primary' });
  const orgQuery = useMemo(() => currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '', [currentOrg?.slug]);
  const orgParam = useMemo(() => currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '', [currentOrg?.slug]);

  const load = useCallback(async () => {
    if (tournamentLoading) return;
    if (!currentTournament) {
      setRegs([]);
      setDivisions([]);
      setPoolSlots([]);
      setAllPoolSlots([]);
      setRegistrationFields([]);
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
      const canLoadRegistrationFields = currentOrg ? hasPlanFeature(currentOrg.planId, 'custom_registration_fields') : false;
      const fieldsRequest = canLoadRegistrationFields
        ? fetch(`/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/registration-fields${orgOnlyParam}`, SAME_ORIGIN_FETCH)
        : Promise.resolve(null);
      const [rRes, adminTeamsRes, groupsRes, tRes, allSlotsRes, fieldsRes] = await Promise.all([
        fetch(`/api/registrations?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/teams?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/divisions?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/tournaments${orgOnlyParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/pool-slots?${tournamentParam}${orgParam}`, SAME_ORIGIN_FETCH),
        fieldsRequest,
      ]);

      const groups = await readJsonArray<Division>(groupsRes, 'Divisions');
      const allSlots = await readJsonArray<PoolSlot>(allSlotsRes, 'Pool slots');
      const adminTeams = await readJsonArray<any>(adminTeamsRes, 'Teams');
      const adminMap = new Map(adminTeams.map((t: any) => [t.id, t]));
      let fields: RegistrationAttentionField[] = [];
      if (fieldsRes) {
        const fieldPayload = await readJsonResponse<{ fields?: RegistrationAttentionField[] }>(fieldsRes, 'Registration questions').catch(() => ({ fields: [] }));
        fields = (fieldPayload.fields ?? []).map(field => ({
          id: field.id,
          label: field.label,
          fieldType: field.fieldType,
          required: Boolean(field.required),
        }));
      }

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

      setDivisions(groups);
      setAllPoolSlots(allSlots);
      setRegistrationFields(fields);
      if (groups.length) {
        if (!selectedDivisionId || selectedDivisionId === 'all') {
          setSelectedDivisionId(groups[0].id);
        }
        if (!addForm.divisionId) {
          setAddForm(f => ({ ...f, divisionId: groups[0].id }));
        }
      }

      const tournaments = await readJsonArray<any>(tRes, 'Tournaments');
      const t = tournaments.find((x: any) => x.id === currentTournament.id);
      if (t) {
        setFeeMode(t.fee_schedule_mode === 'division' ? 'division' : 'tournament');
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
          if (APPROVAL_STATUS_ORDER[a.status as Status] !== APPROVAL_STATUS_ORDER[b.status as Status]) {
            return APPROVAL_STATUS_ORDER[a.status as Status] - APPROVAL_STATUS_ORDER[b.status as Status];
          }
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
  }, [tournamentLoading, currentTournament?.id, currentOrg?.slug, currentOrg?.planId, selectedDivisionId, stableSortedIds.length, addForm.divisionId]);

  const loadPoolSlots = useCallback(async () => {
    if (!selectedDivisionId || !currentTournament) { setPoolSlots([]); return; }
    try {
      const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/pool-slots?tournamentId=${encodeURIComponent(currentTournament.id)}&divisionId=${encodeURIComponent(selectedDivisionId)}${orgParam}`, SAME_ORIGIN_FETCH);
      setPoolSlots(await readJsonArray<PoolSlot>(res, 'Pool slots'));
    } catch { setPoolSlots([]); }
  }, [selectedDivisionId, currentTournament?.id, currentOrg?.slug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPoolSlots(); }, [loadPoolSlots]);

  useEffect(() => {
    setSelectedRegistrationIds(prev => {
      if (prev.size === 0) return prev;
      const validIds = new Set(regs.filter(reg => reg.division_id === selectedDivisionId).map(reg => reg.id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [regs, selectedDivisionId]);

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

  function openEditModal(team: TeamRecord) {
    setEditingTeam(team);
    setEditForm({ name: team.name, coach: team.coach, email: team.email ?? '' });
  }

  function closeEditModal() {
    setEditingTeam(null);
    setEditForm({ name: '', coach: '', email: '' });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeam) return;
    const updates = {
      name: editForm.name.trim(),
      coach: editForm.coach.trim(),
      email: editForm.email.trim(),
    };
    if (!updates.name) return; // guarded by required attr but just in case
    closeEditModal();
    await patch(editingTeam.id, updates);
  }

  function resendAccessLink(team: TeamRecord) {
    if (!currentTournament) return;
    setFeedback({
      isOpen: true,
      title: 'Resend Access Link?',
      message: `${team.name} will receive an email with a link to their registration dashboard.`,
      items: [{ label: team.name, note: team.email }],
      confirmText: 'Send Link',
      type: 'primary',
      onConfirm: async () => {
        setWorking('resend-access');
        try {
          const res = await fetch(
            `/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/registrations/${encodeURIComponent(team.id)}/resend-access${orgQuery}`,
            { credentials: 'same-origin', method: 'POST' },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Access link could not be sent.');
          setFeedback({
            isOpen: true,
            title: 'Access Link Sent',
            message: `An email with the dashboard link was sent to ${team.email}.`,
            type: 'success',
          });
        } catch (error) {
          setFeedback({
            isOpen: true,
            title: 'Send Failed',
            message: error instanceof Error ? error.message : 'Access link could not be sent.',
            type: 'danger',
          });
        } finally {
          setWorking(null);
        }
      },
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
    if (!selectedDivisionId) return;
    const group = divisions.find(g => g.id === selectedDivisionId);
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
          const acceptedTeams = regs.filter(r => r.division_id === selectedDivisionId && r.status === 'accepted');
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
            divisionId: addForm.divisionId,
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
      divisionId: selectedDivisionId || divisions[0]?.id || '',
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

  function openDataTools() {
    if (!currentOrg?.slug) return;
    window.location.assign(`/${currentOrg.slug}/admin/tournaments/data-tools`);
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

  async function doPdfExport() {
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
      const div = r.division_name || 'Uncategorized';
      if (!groupMap.has(div)) groupMap.set(div, []);
      groupMap.get(div)!.push(r);
    }

    const groups = Array.from(groupMap.entries()).map(([label, divRegs]) => ({
      label,
      rows: divRegs.map(r => [
        r.name,
        r.division_name,
        r.coach,
        r.email,
        r.status.charAt(0).toUpperCase() + r.status.slice(1),
        r.slotId ? `Slot ${r.slotId}` : (r.waitlistPosition != null ? `Waitlist #${r.waitlistPosition}` : '—'),
        r.paymentStatus === 'paid' ? 'Paid' : r.depositPaid > 0 ? 'Deposit' : 'Pending',
      ]),
    }));

    // Flat fallback for orgs without divisions
    const flatRows = acceptedRegs.map(r => [
      r.name, r.division_name, r.coach, r.email,
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

  async function handleExportPDF() {
    if (
      canUsePDF &&
      pdfSettings !== null &&
      Object.keys(pdfSettings).length === 0 &&
      !localStorage.getItem('flhq-pdf-setup-warned')
    ) {
      setPdfWarningOpen(true);
      return;
    }
    await doPdfExport();
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

  function clearRegistrationSelection() {
    setSelectedRegistrationIds(new Set());
    setMultiSelectMode(false);
  }

  async function runBulkAction(action: BulkAction) {
    if (!currentTournament || selectedRegistrationIds.size === 0) return;
    const selectedCount = selectedRegistrationIds.size;

    const selectedTeamNames = regs
      .filter(r => selectedRegistrationIds.has(r.id))
      .map(r => ({ label: r.name }));

    const titleMap: Record<BulkAction, string> = {
      accept:            `Accept ${selectedCount} Team${selectedCount === 1 ? '' : 's'}?`,
      reject:            `Reject ${selectedCount} Team${selectedCount === 1 ? '' : 's'}?`,
      waitlist:          `Move to Waitlist?`,
      mark_deposit_paid: 'Mark Deposit Paid?',
      mark_paid:         'Mark Paid in Full?',
    };

    const messageMap: Record<BulkAction, string> = {
      accept:            `The following ${selectedCount} team${selectedCount === 1 ? '' : 's'} will be accepted. Each team contact will receive an automated confirmation email.`,
      reject:            `The following ${selectedCount} team${selectedCount === 1 ? '' : 's'} will be rejected. Each team contact will receive an automated email.`,
      waitlist:          `The following ${selectedCount} team${selectedCount === 1 ? '' : 's'} will be moved to the waitlist.`,
      mark_deposit_paid: `Deposit will be marked as paid for the following ${selectedCount} team${selectedCount === 1 ? '' : 's'}.`,
      mark_paid:         `The following ${selectedCount} team${selectedCount === 1 ? '' : 's'} will be marked as paid in full.`,
    };

    const confirmMap: Record<BulkAction, string> = {
      accept:            'Accept Teams',
      reject:            'Reject Teams',
      waitlist:          'Move to Waitlist',
      mark_deposit_paid: 'Mark Deposit Paid',
      mark_paid:         'Mark Paid in Full',
    };

    setFeedback({
      isOpen: true,
      title: titleMap[action],
      message: messageMap[action],
      items: selectedTeamNames,
      confirmText: confirmMap[action],
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
          setMultiSelectMode(false);
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

  const today = new Date().toISOString().split('T')[0];
  const selectedGroup = divisions.find(g => g.id === selectedDivisionId);
  const slotConfigured = poolSlots.length > 0;

  const [closingDivision, setClosingDivision] = useState(false);

  async function doToggleRegistration(nextClosed: boolean) {
    if (!selectedDivisionId) return;
    setClosingDivision(true);
    try {
      const res = await fetch(`/api/admin/divisions${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-closed', id: selectedDivisionId, data: { isClosed: nextClosed } }),
      });
      if (!res.ok) throw new Error('Failed to update registration status');
      setDivisions(prev => prev.map(d => d.id === selectedDivisionId ? { ...d, isClosed: nextClosed } : d));
    } catch {
      // silent — user can retry
    } finally {
      setClosingDivision(false);
    }
  }

  function handleToggleRegistration() {
    if (!selectedDivisionId || closingDivision) return;
    const nextClosed = !selectedGroup?.isClosed;
    // Warn before reopening a division whose schedule is already published with real names
    if (!nextClosed && selectedGroup?.scheduleVisibility === 'published_teams') {
      setFeedback({
        isOpen: true,
        title: 'Reopen Registration?',
        message: 'The public schedule for this division is already showing real team names. Newly accepted teams won\'t appear on the schedule until they\'re assigned to games.',
        type: 'warning',
        confirmText: 'Reopen Registration',
        onConfirm: () => doToggleRegistration(false),
      });
      return;
    }
    void doToggleRegistration(nextClosed);
  }
  const waitlistAutomationAvailable = currentOrg ? hasPlanFeature(currentOrg.planId, 'waitlist_automation') : false;
  const paymentToolsAvailable = currentOrg ? hasPlanFeature(currentOrg.planId, 'payment_readiness_tools') : false;
  const commandCenterAvailable = paymentToolsAvailable;
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);
  const canUsePDF = currentOrg ? hasPlanFeature(currentOrg.planId, 'pdf_exports') : false;
  const [pdfWarningOpen, setPdfWarningOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/org/pdf-settings${orgQuery}`, SAME_ORIGIN_FETCH)
      .then(r => r.ok ? r.json() : {})
      .then(data => setPdfSettings(data as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgQuery]);

  // Restore view settings from localStorage when tournament changes.
  useEffect(() => {
    const tid = currentTournament?.id;
    if (!tid) return;
    try {
      const raw = localStorage.getItem(`flhq-teams-${tid}`);
      if (!raw) return;
      const cached = JSON.parse(raw) as Partial<{ viewMode: 'flat' | 'pools'; selectedStatuses: Status[]; selectedDivisionId: string }>;
      if (cached.viewMode === 'flat' || cached.viewMode === 'pools') setViewMode(cached.viewMode);
      if (Array.isArray(cached.selectedStatuses) && cached.selectedStatuses.length > 0) setSelectedStatuses(cached.selectedStatuses);
      if (cached.selectedDivisionId) setSelectedDivisionId(cached.selectedDivisionId);
    } catch {}
  }, [currentTournament?.id]);

  // Persist view settings. Guard: only write once divisions are loaded.
  useEffect(() => {
    const tid = currentTournament?.id;
    if (!tid || !selectedDivisionId || divisions.length === 0) return;
    try {
      localStorage.setItem(`flhq-teams-${tid}`, JSON.stringify({ viewMode, selectedStatuses, selectedDivisionId }));
    } catch {}
  }, [currentTournament?.id, viewMode, selectedStatuses, selectedDivisionId, divisions.length]);

  const divRegs = regs.filter(r => r.division_id === selectedDivisionId);
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
      const fee = getEffectiveFee(team, divisions, feeMode, feeSchedule);
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
  }, [divisions, divRegs, feeMode, feeSchedule, today]);

  const slotConfiguredDivisionIds = useMemo(() => {
    const ids = new Set(allPoolSlots.map(slot => slot.divisionId).filter(Boolean));
    if (slotConfigured && selectedDivisionId) ids.add(selectedDivisionId);
    return ids;
  }, [allPoolSlots, selectedDivisionId, slotConfigured]);

  const attentionContext = useMemo<RegistrationAttentionContext>(() => ({
    divisions: divisions.map(group => ({
      id: group.id,
      name: group.name,
      depositAmount: group.depositAmount,
      depositDueDate: group.depositDueDate,
      totalFeeAmount: group.totalFeeAmount,
      totalFeeDueDate: group.totalFeeDueDate,
    })),
    requiredFields: registrationFields.filter(field => field.required),
    feeMode,
    feeSchedule,
    slotConfiguredDivisionIds,
    today,
  }), [divisions, feeMode, feeSchedule, registrationFields, slotConfiguredDivisionIds, today]);

  const attentionSummary = useMemo(() => buildRegistrationAttentionSummary(
    regs.map(team => ({
      id: team.id,
      divisionId: team.division_id,
      status: team.status,
      paymentStatus: team.paymentStatus,
      depositPaid: team.depositPaid,
      totalPaid: team.totalPaid,
      slotId: team.slotId,
      waitlistPosition: team.waitlistPosition,
      customAnswers: team.customAnswers,
    })),
    attentionContext,
  ), [attentionContext, regs]);
  const activeAttentionBucket = activeAttentionKey ? getRegistrationAttentionBucket(attentionSummary, activeAttentionKey) : null;
  const activeAttentionLocked = Boolean(activeAttentionBucket?.plusOnly && !commandCenterAvailable);

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
    const effectiveFee = getEffectiveFee(team, divisions, feeMode, feeSchedule);
    const pStatus = computePaymentStatus(team, effectiveFee, today);
    const due = getPaymentDue(team, effectiveFee);
    const busy = working === team.id;

    return (
      <div className={`${s.expandedRow} ${styles.compactExpandedRow}`}>
        <div className={styles.teamDetailShell}>
          {/* ── Single row: meta left, actions right ── */}
          <div className={styles.teamDetailMetaRow}>
            <div className={styles.teamDetailMeta}>
              {team.email ? <a href={`mailto:${team.email}`}>{team.email}</a> : <span>Email not provided</span>}
              <span>Registered {new Date(team.registered_at).toLocaleDateString()}</span>
            </div>
            <div className={styles.teamQuickActions}>
              {team.status !== 'accepted' && (
                <button className="btn btn-primary btn-data" onClick={() => patch(team.id, { status: 'accepted' }, `Accept "${team.name}"? An automated email will be sent.`)} disabled={busy}>Accept</button>
              )}
              {team.status !== 'rejected' && (
                <button className="btn btn-ghost btn-data" style={{ color: 'rgba(var(--danger-rgb), 0.65)', borderColor: 'transparent', background: 'transparent' }} onClick={() => patch(team.id, { status: 'rejected' }, `Reject "${team.name}"? An automated email will be sent.`)} disabled={busy}>Reject</button>
              )}
              {team.status === 'accepted' && !effectiveFee.totalFeeAmount ? (
                <button className="btn btn-ghost btn-data" onClick={() => patch(team.id, { paymentStatus: team.paymentStatus === 'paid' ? 'pending' : 'paid' })} disabled={busy}>
                  {team.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                </button>
              ) : null}
              {team.email?.trim() && (
                <button className="btn btn-ghost btn-data" onClick={() => resendAccessLink(team)} disabled={busy || working === 'resend-access'} style={{ borderColor: 'transparent', background: 'transparent', padding: '0.3rem 0.45rem' }} aria-label={`Resend dashboard access link to ${team.name}`} title="Resend access link">
                  <ExternalLink size={12} />
                </button>
              )}
              <button className="btn btn-ghost btn-data" onClick={() => openEditModal(team)} disabled={busy} style={{ borderColor: 'transparent', background: 'transparent', padding: '0.3rem 0.45rem' }} aria-label={`Edit ${team.name}`}>
                <Pencil size={12} />
              </button>
              <button className="btn btn-ghost btn-data" onClick={() => handleDelete(team.id, team.name)} disabled={busy} style={{ color: 'rgba(var(--danger-rgb), 0.45)', borderColor: 'transparent', background: 'transparent', padding: '0.3rem 0.45rem' }} aria-label={`Delete ${team.name}`}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* ── Collapsible sections ── */}
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
    const pStatus = computePaymentStatus(r, getEffectiveFee(r, divisions, feeMode, feeSchedule), today);
    const matchesPayment = !paymentToolsAvailable || paymentFilters.length === 0 || paymentFilters.some(f => matchesPaymentFilter(pStatus, f));
    const matchesAttention = !activeAttentionKey || activeAttentionLocked || teamMatchesRegistrationAttentionKey({
      id: r.id,
      divisionId: r.division_id,
      status: r.status,
      paymentStatus: r.paymentStatus,
      depositPaid: r.depositPaid,
      totalPaid: r.totalPaid,
      slotId: r.slotId,
      waitlistPosition: r.waitlistPosition,
      customAnswers: r.customAnswers,
    }, activeAttentionKey, attentionContext);
    return matchesStatus && matchesSearch && matchesPayment && matchesAttention;
  });
  const stableRank = new Map(stableSortedIds.map((id, index) => [id, index]));
  const flatDisplay = [...filtered].sort((a, b) => {
    const statusDelta = APPROVAL_STATUS_ORDER[a.status] - APPROVAL_STATUS_ORDER[b.status];
    if (statusDelta !== 0) return statusDelta;
    if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'paid' ? -1 : 1;
    const rankDelta = (stableRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (stableRank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    if (rankDelta !== 0) return rankDelta;
    return new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime();
  });
  const selectableRows = slotConfigured && !activeAttentionKey
    ? divRegs.filter(row => row.waitlistPosition != null || poolSlots.some(slot => slot.teamId === row.id))
    : flatDisplay;
  const visibleSelectableIds = selectableRows.map(row => row.id);
  const allVisibleSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every(id => selectedRegistrationIds.has(id));
  const selectionModeActive = multiSelectMode || selectedRegistrationIds.size > 0;
  const divisionOptions = divisions.length
    ? divisions.map(g => ({ value: g.id, label: g.name }))
    : [{ value: '', label: 'No divisions' }];

  const applyAttentionFilterState = useCallback((key: RegistrationAttentionKey) => {
    setActiveAttentionKey(key);
    setMobileSettingsOpen(false);
    setSearch('');

    if (key === 'pending_review') {
      setSelectedStatuses(['pending']);
      setPaymentFilters([]);
      return;
    }

    if (key === 'waitlist') {
      setSelectedStatuses(['waitlist']);
      setPaymentFilters([]);
      return;
    }

    if (key === 'unpaid') {
      setSelectedStatuses(['accepted']);
      setPaymentFilters(['unpaid']);
      return;
    }

    if (key === 'past_due') {
      setSelectedStatuses(['accepted']);
      setPaymentFilters(['past-due']);
      return;
    }

    if (key === 'unplaced') {
      setSelectedStatuses(['accepted']);
      setPaymentFilters([]);
      return;
    }

    setSelectedStatuses(['pending', 'accepted', 'waitlist']);
    setPaymentFilters([]);
  }, []);

  const showCommandCenterUpgrade = useCallback(() => {
    setFeedback({
      isOpen: true,
      title: 'Tournament Plus Command Center',
      message: 'Tournament Plus turns payment, required intake, and placement follow-ups into one focused command center.',
      type: 'warning',
    });
  }, []);

  const focusAttentionBucket = useCallback((key: RegistrationAttentionKey, divisionId?: string) => {
    const bucket = getRegistrationAttentionBucket(attentionSummary, key);
    if (bucket?.plusOnly && !commandCenterAvailable) {
      setActiveAttentionKey(key);
      showCommandCenterUpgrade();
      return;
    }

    setActiveAttentionKey(key);
    const divisionCounts = bucket?.divisionCounts ?? [];
    const selectedDivisionHasCount = divisionCounts.some(row => row.divisionId === selectedDivisionId);
    const targetDivisionId = divisionId
      ?? (divisionCounts.length === 1 ? divisionCounts[0].divisionId : selectedDivisionHasCount ? selectedDivisionId : '');

    if (!targetDivisionId && divisionCounts.length > 1) {
      applyAttentionFilterState(key);
      return;
    }

    if (targetDivisionId) {
      setSelectedDivisionId(targetDivisionId);
      setSwapMode(false);
      setSwapFirstSlotId(null);
    }

    applyAttentionFilterState(key);
  }, [applyAttentionFilterState, attentionSummary, commandCenterAvailable, selectedDivisionId, showCommandCenterUpgrade]);

  const clearAttentionFocus = useCallback(() => {
    setActiveAttentionKey(null);
    setSelectedStatuses(['pending', 'accepted', 'waitlist']);
    setPaymentFilters([]);
  }, []);

  const attentionParam = searchParams.get('attention');
  const divisionParam = searchParams.get('division');
  useEffect(() => {
    if (!hasLoadedInitial || !currentTournament?.id || !divisionParam) return;
    if (!divisions.some(group => group.id === divisionParam)) return;
    const token = `${currentTournament.id}:${divisionParam}`;
    if (divisionQueryAppliedRef.current === token) return;
    divisionQueryAppliedRef.current = token;
    setSelectedDivisionId(divisionParam);
    setSwapMode(false);
    setSwapFirstSlotId(null);
  }, [currentTournament?.id, divisionParam, divisions, hasLoadedInitial]);

  useEffect(() => {
    if (!hasLoadedInitial || !currentTournament?.id || !isRegistrationAttentionKey(attentionParam)) return;
    const validDivisionParam = divisionParam && divisions.some(group => group.id === divisionParam) ? divisionParam : undefined;
    const token = `${currentTournament.id}:${attentionParam}:${validDivisionParam ?? ''}`;
    if (attentionQueryAppliedRef.current === token) return;
    attentionQueryAppliedRef.current = token;
    focusAttentionBucket(attentionParam, validDivisionParam);
  }, [attentionParam, currentTournament?.id, divisionParam, divisions, focusAttentionBucket, hasLoadedInitial]);

  const hasNonDefaultFilters = paymentFilters.length > 0 ||
    selectedStatuses.length !== 3 ||
    !selectedStatuses.includes('pending') ||
    !selectedStatuses.includes('accepted') ||
    !selectedStatuses.includes('waitlist');

  // Settings summary shown in the strip below the toolbar on mobile
  const settingsSummary = !slotConfigured ? (() => {
    const parts: string[] = [viewMode === 'pools' ? 'Pools' : 'Flat'];
    const defaultSet = new Set<Status>(['pending', 'accepted', 'waitlist']);
    const statusIsDefault = selectedStatuses.length === 3 && selectedStatuses.every(s => defaultSet.has(s));
    if (!statusIsDefault && selectedStatuses.length > 0)
      parts.push(selectedStatuses.map(s => APPROVAL_STATUS_INITIAL[s]).join(' '));
    if (paymentFilters.length > 0) {
      const SHORT: Record<ActivePaymentFilter, string> = { unpaid: 'Unpaid', 'deposit-paid': 'Deposit', paid: 'Paid', 'past-due': 'Past Due' };
      parts.push(paymentFilters.map(f => SHORT[f]).join(' · '));
    }
    return parts.join(' · ');
  })() : null;

  const renderFlatRow = (r: TeamRecord) => {
    const isExpanded = expanded.has(r.id);
    const isSelected = selectedRegistrationIds.has(r.id);
    const effectiveFee = getEffectiveFee(r, divisions, feeMode, feeSchedule);
    const pStatus = computePaymentStatus(r, effectiveFee, today);
    const paymentTooltip = getPaymentTooltip(r, effectiveFee, pStatus);
    const paymentSteps = getPaymentSymbolSteps(r, effectiveFee, today);

    return (
      <div key={r.id} className={`${s.row} ${isSelected ? s.rowSelected : ''}`}>
        <div className={`${s.rowMain} ${styles.teamRowMain} ${selectionModeActive ? styles.teamRowSelecting : ''}`}>
          {selectionModeActive && (
            <div className={styles.selectionCell}>
              <input
                type="checkbox"
                className={styles.selectionCheckbox}
                checked={isSelected}
                onChange={() => toggleRegistrationSelection(r.id)}
                aria-label={`Select ${r.name}`}
              />
            </div>
          )}
          <div className={`${s.primaryCell} ${styles.registrationNameCell}`}><strong>{r.name}</strong></div>
          <div className={`${s.secondaryCell} ${styles.registrationCoachCell}`}>{r.coach}</div>
          <div className={styles.registrationStatusCell}>
            <span
              className={styles.mobileStatusMarker}
              data-status={r.status}
              title={APPROVAL_STATUS_LABEL[r.status]}
              aria-label={APPROVAL_STATUS_LABEL[r.status]}
            >
              {APPROVAL_STATUS_INITIAL[r.status]}
            </span>
            <span className={`badge badge-${r.status === 'accepted' ? 'neutral' : r.status === 'rejected' ? 'danger' : 'warning'} ${styles.desktopStatusBadge}`}>
              {r.status}
            </span>
          </div>
          <div className={styles.registrationPaymentCell}>
            {r.status === 'accepted' && pStatus !== 'no-schedule' ? (
              <>
                <span className={`badge badge-${PAYMENT_STATUS_STYLE[pStatus]} ${styles.desktopPaymentBadge}`} title={paymentTooltip}>
                  {PAYMENT_STATUS_LABEL[pStatus]}
                </span>
                <span className={styles.paymentSymbolGroup} title={paymentTooltip} aria-label={paymentTooltip}>
                  {paymentSteps.map(step => (
                    <span key={step.key} className={styles.paymentSymbol} data-tone={step.tone} aria-hidden>
                      $
                    </span>
                  ))}
                </span>
              </>
            ) : r.status === 'accepted' ? (
              <>
                <span className={`badge badge-${r.paymentStatus === 'paid' ? 'success' : 'warning'} ${styles.desktopPaymentBadge}`}>
                  {r.paymentStatus}
                </span>
                <span className={styles.paymentSymbolGroup} title={r.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'} aria-label={r.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'}>
                  <span className={styles.paymentSymbol} data-tone={r.paymentStatus === 'paid' ? 'paid' : 'pending'} aria-hidden>
                    $
                  </span>
                </span>
              </>
            ) : (
              <span className={styles.paymentPlaceholder}>-</span>
            )}
          </div>
          <div className={styles.registrationExpandCell}>
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
        title="Teams"
        subtitle="Manage all teams and signups in one place"
        mobileActionsInline
        locked={isLocked}
        actions={(
          <>
            <ExportMenu
              className={styles.registrationUtilityStart}
              formats={['xlsx', 'csv', 'pdf']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              planId={currentOrg?.planId}
              pdfFeatureKey="pdf_exports"
              disabled={!currentTournament}
              exportDisabled={regs.length === 0}
              hasImportOption
              onImport={openDataTools}
              importLabel="Data tools"
              importHint="Templates, imports, and bulk exports"
            />
            {!isLocked && currentOrg && hasPlanFeature(currentOrg.planId, 'custom_registration_fields') && (
              <Link
                href={`/${currentOrg.slug}/admin/tournaments/settings/registration-fields?from=registrations`}
                className="btn btn-ghost btn-data"
                title="Configure registration questions"
                aria-label="Configure registration questions"
                style={{ borderColor: 'transparent', background: 'transparent', padding: '0.3rem 0.45rem', color: 'var(--logic-lime)' }}
              >
                <ClipboardList size={15} />
              </Link>
            )}
            {!isLocked && (
              <button
                className={`btn btn-lime btn-data ${styles.addTeamButton}`}
                onClick={openAddTeamModal}
                disabled={!currentTournament}
                aria-label="Add team"
                title="Add team"
              >
                <Plus size={14} />
                <span className={styles.addTeamLabel}>Add Team</span>
              </button>
            )}
          </>
        )}
      />


      {errorMsg && (
        <div className="alert alert-danger" style={{ margin: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={18} /><span>{errorMsg}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => load()} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}


      <TournamentAdminToolbar ariaLabel="Registration controls" className={styles.registrationToolbar}>
        {/* ── Row 1: controls + end actions ── */}
        <ToolbarGroup grow className={`${styles.registrationContextGroup} ${styles.teamsStartGroup}`}>
          <ToolbarSelect
            label="Division"
            value={selectedDivisionId}
            options={divisionOptions}
            disabled={divisions.length === 0}
            onChange={value => { setSelectedDivisionId(value); setSwapMode(false); setSwapFirstSlotId(null); }}
          />
          {/* Desktop only — fills left gap; hidden on mobile where it moves to the action group */}
          {!slotConfigured && (
            <div className={styles.segmentedDesktop}>
              <ToolbarSegmentedControl
                ariaLabel="Registration view"
                value={viewMode}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'pools', label: 'Pools' },
                ]}
                onChange={setViewMode}
              />
            </div>
          )}
        </ToolbarGroup>

        <ToolbarGroup align="end" className={`${styles.registrationActionGroup} ${styles.teamsActionGroup}`}>
          {visibleSelectableIds.length > 0 && (
            <button
              type="button"
              className={styles.multiSelectToggle}
              data-active={selectionModeActive || undefined}
              aria-label={selectionModeActive ? (allVisibleSelected ? 'Clear visible registrations' : 'Select visible registrations') : 'Select many registrations'}
              title={selectionModeActive ? (allVisibleSelected ? 'Clear visible' : 'Select visible') : 'Select many'}
              onClick={() => {
                if (!selectionModeActive) {
                  setMultiSelectMode(true);
                  return;
                }
                if (allVisibleSelected) setSelectedRegistrations([]);
                else setSelectedRegistrations(visibleSelectableIds);
              }}
            >
              <ListChecks size={13} aria-hidden />
              <span className={styles.multiSelectLabel}>
                {selectionModeActive ? (allVisibleSelected ? 'Clear visible' : 'Select visible') : 'Select many'}
              </span>
            </button>
          )}
          {selectionModeActive && (
            <button
              type="button"
              className={styles.multiSelectDone}
              onClick={clearRegistrationSelection}
              aria-label="Done selecting registrations"
              title="Done"
            >
              <X size={13} aria-hidden />
              <span className={styles.multiSelectLabel}>Done</span>
            </button>
          )}
          {slotConfigured ? (
            <>
              <button
                type="button"
                className={styles.multiSelectToggle}
                data-active={swapMode ? 'true' : undefined}
                onClick={() => { setSwapMode(m => !m); setSwapFirstSlotId(null); }}
                aria-label={swapMode ? 'Turn off swap mode' : 'Swap mode'}
                title={swapMode ? 'Turn off swap mode' : 'Swap mode'}
              >
                <ArrowLeftRight size={13} aria-hidden />
                <span className={styles.multiSelectLabel}>{swapMode ? 'Swapping' : 'Swap'}</span>
              </button>
              <button
                type="button"
                className={styles.multiSelectToggle}
                onClick={randomizeSlots}
                disabled={loading || working === 'randomizing'}
                aria-label="Randomize slots"
                title="Shuffle teams across slots"
              >
                <RefreshCw size={13} className={working === 'randomizing' ? 'spin' : ''} aria-hidden />
                <span className={styles.multiSelectLabel}>Randomize</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.multiSelectToggle}
              onClick={randomizePools}
              disabled={loading || working === 'randomizing'}
              aria-label="Randomize pools"
              title="Distribute accepted teams across pools"
            >
              <RefreshCw size={13} className={working === 'randomizing' ? 'spin' : ''} aria-hidden />
              <span className={styles.multiSelectLabel}>Randomize</span>
            </button>
          )}
        </ToolbarGroup>

        {/* ── Row 2: filter dropdowns (desktop) + search ── */}
        {(!slotConfigured || activeAttentionKey) && (
          <ToolbarGroup fullWidth className={styles.registrationFilterGroup}>
            {!slotConfigured && (
              <div className={styles.desktopFilterChips}>
                <RegistrationFilterMenu
                  heading="Status"
                  allLabel="All statuses"
                  options={(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(st => ({
                    key: st,
                    label: APPROVAL_STATUS_LABEL[st],
                    count: divRegs.filter(r => r.status === st).length,
                  }))}
                  selectedKeys={selectedStatuses}
                  isDefault={
                    selectedStatuses.length === 3 &&
                    selectedStatuses.includes('pending') &&
                    selectedStatuses.includes('accepted') &&
                    selectedStatuses.includes('waitlist')
                  }
                  onToggle={key => setSelectedStatuses(prev =>
                    prev.includes(key as Status) ? prev.filter(x => x !== key) : [...prev, key as Status]
                  )}
                  onReset={() => setSelectedStatuses(['pending', 'accepted', 'waitlist'])}
                />
                {paymentToolsAvailable && (
                  <RegistrationFilterMenu
                    heading="Payment"
                    allLabel="All payments"
                    options={(['unpaid', 'deposit-paid', 'paid', 'past-due'] as ActivePaymentFilter[]).map(f => ({
                      key: f,
                      label: PAYMENT_FILTER_LABEL[f],
                      count: divRegs.filter(r => {
                        const ps = computePaymentStatus(r, getEffectiveFee(r, divisions, feeMode, feeSchedule), today);
                        return matchesPaymentFilter(ps, f as PaymentFilter);
                      }).length,
                    }))}
                    selectedKeys={paymentFilters}
                    isDefault={paymentFilters.length === 0}
                    onToggle={key => setPaymentFilters(prev =>
                      prev.includes(key as ActivePaymentFilter) ? prev.filter(x => x !== key) : [...prev, key as ActivePaymentFilter]
                    )}
                    onReset={() => setPaymentFilters([])}
                  />
                )}
              </div>
            )}
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search teams or coaches..." />
          </ToolbarGroup>
        )}
      </TournamentAdminToolbar>

      {/* ── Division capacity + registration status strip (single row) ─── */}
      {currentTournament && selectedGroup && !isLocked && (() => {
        const accepted = paymentSummary.accepted;
        const cap = selectedGroup.capacity;
        const closed = !!selectedGroup.isClosed;
        const atCap = cap != null && accepted >= cap;
        const spotsLeft = cap != null ? Math.max(0, cap - accepted) : null;
        const warnColor = '#fbbf24';
        const rowStyle: React.CSSProperties = {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          padding: '0.45rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: atCap && !closed ? 'rgba(251,191,36,0.05)' : 'var(--white-3)',
        };
        const btnStyle: React.CSSProperties = {
          background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem 0',
          fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem',
          color: atCap && !closed ? warnColor : 'var(--white-40)',
          flexShrink: 0,
        };
        return (
          <div style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', minWidth: 0 }}>
              {cap != null ? (
                <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, color: atCap ? warnColor : 'var(--white-70)', whiteSpace: 'nowrap' }}>
                  {accepted}/{cap}
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, color: 'var(--white-70)', whiteSpace: 'nowrap' }}>
                  {accepted} accepted
                </span>
              )}
              <span style={{ color: atCap && !closed ? warnColor : 'var(--white-40)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {atCap && !closed
                  ? 'Full — close registration to stop new submissions'
                  : atCap && closed
                    ? 'at capacity'
                    : cap != null
                      ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`
                      : ''}
              </span>
              {closed && (
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--danger)', background: 'rgba(var(--danger-rgb),0.1)',
                  border: '1px solid rgba(var(--danger-rgb),0.25)', padding: '1px 5px', borderRadius: '2px',
                  flexShrink: 0,
                }}>Closed</span>
              )}
            </div>
            <button type="button" style={btnStyle} onClick={handleToggleRegistration} disabled={closingDivision}>
              {closed ? <Unlock size={11} /> : <Lock size={11} />}
              {closingDivision ? '…' : closed ? 'Reopen' : 'Close Registration'}
            </button>
          </div>
        );
      })()}

      {/* ── Filters / settings bottom sheet ─────────────────── */}
      {mobileSettingsOpen && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setMobileSettingsOpen(false)} aria-hidden />
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="View filters">
            <div className={styles.sheetHandle} />
            <div className={styles.sheetBody}>
              {!slotConfigured && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>Grouping</div>
                  <div className={styles.sheetSegments}>
                    {(['flat', 'pools'] as const).map(v => (
                      <button
                        key={v}
                        type="button"
                        className={`${styles.sheetSeg} ${viewMode === v ? styles.sheetSegActive : ''}`}
                        onClick={() => setViewMode(v)}
                      >
                        {v === 'flat' ? 'Flat' : 'Pools'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>Registration status</div>
                <div className={styles.sheetSegments}>
                  {(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(st => (
                    <button
                      key={st}
                      type="button"
                      className={`${styles.sheetSeg} ${selectedStatuses.includes(st) ? styles.sheetSegActive : ''}`}
                      onClick={() => setSelectedStatuses(prev =>
                        prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
                      )}
                    >
                      {APPROVAL_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>

              {paymentToolsAvailable && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>Payment status</div>
                  <div className={styles.sheetSegments} style={{ flexWrap: 'wrap' }}>
                    {(['unpaid', 'deposit-paid', 'paid', 'past-due'] as ActivePaymentFilter[]).map(f => (
                      <button
                        key={f}
                        type="button"
                        className={`${styles.sheetSeg} ${paymentFilters.includes(f) ? styles.sheetSegActive : ''}`}
                        style={{ flex: '1 1 calc(50% - 0.35rem)' }}
                        onClick={() => setPaymentFilters(prev =>
                          prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
                        )}
                      >
                        {PAYMENT_FILTER_LABEL[f]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasNonDefaultFilters && (
                <button
                  type="button"
                  className={styles.attentionSheetClear}
                  onClick={() => { setSelectedStatuses(['pending', 'accepted', 'waitlist']); setPaymentFilters([]); }}
                >
                  Reset filters
                </button>
              )}

              <button type="button" className={styles.sheetDone} onClick={() => setMobileSettingsOpen(false)}>Done</button>
            </div>
          </div>
        </>
      )}

      {currentTournament && !slotConfigured && !mobileSettingsOpen && settingsSummary && (
        <button
          type="button"
          className={styles.activeSettingsSummary}
          onClick={() => setMobileSettingsOpen(true)}
          aria-label={`View settings: ${settingsSummary}`}
        >
          <span className={styles.activeSettingsSummaryText}>{settingsSummary}</span>
          <SlidersHorizontal size={12} className={styles.activeSettingsSummaryIcon} aria-hidden />
        </button>
      )}

      {!isLocked && (
        <SelectionActionBar
          selectedCount={selectedRegistrationIds.size}
          label={`${selectedRegistrationIds.size} selected`}
          onClear={clearRegistrationSelection}
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
          <button type="button" className="btn btn-outline btn-data" style={{ color: 'var(--danger)' }} onClick={() => runBulkAction('reject')} disabled={working === 'bulk'}>
            Reject
          </button>
        </SelectionActionBar>
      )}

      {/* ── SLOT BOARD (divisions with pool slots configured) ─────────────────── */}
      {slotConfigured && !activeAttentionKey ? (
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
                  ? computePaymentStatus(team, getEffectiveFee(team, divisions, feeMode, feeSchedule), today)
                  : null;

                return (
                  <div
                    key={slot.id}
                    className={`${styles.slotRow} ${!team ? styles.slotRowEmpty : ''} ${team && selectedRegistrationIds.has(team.id) ? s.rowSelected : ''} ${isSwapSelected ? styles.slotRowSwapSelected : ''}`}
                    onClick={swapMode ? () => handleSwapSlots(slot.id) : undefined}
                    style={swapMode ? { cursor: 'pointer' } : undefined}
                  >
                    <div className={styles.slotRowMain}>
                      {team && selectionModeActive && (
                        <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            className={styles.selectionCheckbox}
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
                <div key={team.id} className={`${styles.waitlistRow} ${selectedRegistrationIds.has(team.id) ? s.rowSelected : ''}`}>
                  {selectionModeActive && (
                    <input
                      type="checkbox"
                      className={styles.selectionCheckbox}
                      checked={selectedRegistrationIds.has(team.id)}
                      onChange={() => toggleRegistrationSelection(team.id)}
                      aria-label={`Select ${team.name}`}
                    />
                  )}
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
              <p>{!currentTournament ? 'No tournament selected.' : divisions.length === 0 ? 'No divisions configured yet.' : 'No teams matching filters.'}</p>
            </div>
          ) : (
            <div className={s.compactList}>
              {/* Column header + rows wrapped in flatList so compactList's
                  gap:2.5rem applies to the whole table block, not each row */}
              <div className={styles.flatList}>
                {/* ── Column headers ── */}
                <div className={styles.colHeader}>
                  {selectionModeActive && <div className={styles.selectionCell} />}
                  <div className={styles.registrationNameCell}>Team</div>
                  <div className={styles.registrationCoachCell}>Coach</div>
                  <div className={styles.registrationStatusCell}>Status</div>
                  <div className={styles.registrationPaymentCell}>Payment</div>
                  <div className={styles.registrationExpandCell} />
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
              <button className="btn btn-ghost btn-data" onClick={closeAddTeamModal}><X size={16} /></button>
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
                  <select className="form-select" value={addForm.divisionId} onChange={e => setAddForm(f => ({ ...f, divisionId: e.target.value }))} required>
                    {divisions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                <button type="button" className="btn btn-ghost btn-data" onClick={closeAddTeamModal}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-data" disabled={!!working}>Save Team</button>
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
              <button className="btn btn-ghost btn-data" onClick={() => setShowReminderModal(false)}><X size={16} /></button>
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
              <button type="button" className="btn btn-ghost btn-data" onClick={() => setShowReminderModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary btn-data"
                onClick={sendPaymentReminders}
                disabled={working === 'payment-reminders' || paymentInstructions.trim().length === 0}
              >
                {working === 'payment-reminders' ? 'Sending...' : 'Send Reminders'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Details modal */}
      {editingTeam && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Team Details</h3>
              <button className="btn btn-ghost btn-data" onClick={closeEditModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div style={{ padding: '1.5rem 2rem', display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Team Name *</label>
                  <input
                    className="form-input"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Coach</label>
                    <input
                      className="form-input"
                      value={editForm.coach}
                      onChange={e => setEditForm(f => ({ ...f, coach: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="coach@example.com"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-data" disabled={!!working}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FeedbackModal {...feedback} onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined, items: undefined, confirmText: undefined }))} />
      <FeedbackModal
        isOpen={pdfWarningOpen}
        onClose={() => { localStorage.setItem('flhq-pdf-setup-warned', '1'); setPdfWarningOpen(false); }}
        onConfirm={() => { localStorage.setItem('flhq-pdf-setup-warned', '1'); void doPdfExport(); }}
        title="PDF settings not configured"
        message="This export will use default FieldLogicHQ styling — no custom header, logo, or footer. Visit Org Settings → PDF Settings to customize all future exports."
        confirmText="Download anyway"
        cancelText="Not now"
        type="info"
      />
    </div>
  );
}

function RegistrationFilterMenu({
  heading,
  allLabel,
  options,
  selectedKeys,
  isDefault,
  onToggle,
  onReset,
}: {
  heading: string;
  allLabel: string;
  options: Array<{ key: string; label: string; count?: number }>;
  selectedKeys: string[];
  isDefault: boolean;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const buttonText = isDefault
    ? allLabel
    : selectedKeys.length === 1
      ? (options.find(o => o.key === selectedKeys[0])?.label ?? allLabel)
      : `${selectedKeys.length} ${heading.toLowerCase()}`;

  return (
    <div className={styles.regFilterRoot} ref={rootRef}>
      <button
        type="button"
        className={`${styles.regFilterButton} ${!isDefault ? styles.regFilterButtonActive : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SlidersHorizontal size={12} aria-hidden />
        <span>{buttonText}</span>
      </button>
      {open && (
        <div className={styles.regFilterPanel} role="menu">
          <div className={styles.regFilterHeader}>
            <span>{heading}</span>
            {!isDefault && (
              <button type="button" onClick={() => { onReset(); setOpen(false); }}>
                <X size={12} /> Reset
              </button>
            )}
          </div>
          <div className={styles.regFilterList}>
            {options.map(opt => {
              const isSelected = selectedKeys.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`${styles.regFilterOption} ${isSelected ? styles.regFilterOptionActive : ''}`}
                  onClick={() => onToggle(opt.key)}
                  role="menuitemcheckbox"
                  aria-checked={isSelected}
                >
                  <span className={styles.regFilterCheck}>{isSelected ? <Check size={12} /> : null}</span>
                  <span className={styles.regFilterName}>{opt.label}</span>
                  {opt.count !== undefined && <span className={styles.regFilterCount}>{opt.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
