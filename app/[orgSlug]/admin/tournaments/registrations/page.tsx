'use client';
/**
 * TEAMS — the organizer's registration desk (Tournament admin redesign Stage 2, ruled 2026-09-30, hub v16;
 * plan §6b T1–T7). Built to the drawing:
 *
 *   T1  Teams opens on the teams: the title band, ONE toolbar line, the "At a glance" card of three closed
 *       rows (Registration health · Payments · Registration), then the division's teams in one frame.
 *   T2  A team waiting for a decision is on the screen — the first band, "To review", with its Accept —
 *       and Teams opens on the first division that has one (else the remembered one), so the context
 *       strip's and the rail's "to review" land on the work (F41).
 *   T3  The whole row opens the team's record in the kit's form window (TeamRecord).
 *   T4  The pool board is that same frame: a band per pool with its fill; swap and selection modes.
 *   T5  One colour per status, words not glyphs: the band says the status; Check-in's payment words.
 *   T6  A division without slots bands by status; what does not apply is ABSENT (no Pools grouping
 *       without pools, no Randomize, no "Pools aren't turned on" note). Exhibition loses only Seed.
 *   T7  The Club seams as today: Payments (Stage 7's), "Add my team" (a star), the rep-team picker.
 *
 * Every question on this screen is the kit's question window, so one opened over a team's record stacks
 * above it and the phone's Back closes only the question.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeftRight, Check, ChevronDown, ClipboardList, Link2, ListChecks, MoreHorizontal, Plus, RefreshCw, Search, Shuffle, SlidersHorizontal, Star, Users, X } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { useDismissable } from '@/lib/overlay-hooks';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { hasPlayoffs } from '@/lib/tournament-phase';
import {
  buildRegistrationAttentionSummary,
  getRegistrationAttentionBucket,
  isRegistrationAttentionKey,
  teamMatchesRegistrationAttentionKey,
  type RegistrationAttentionContext,
  type RegistrationAttentionField,
  type RegistrationAttentionKey,
} from '@/lib/registration-attention';
import { buildRegistrationHealth, type RegistrationHealthCapacityGap } from '@/lib/registration-health';
import { calendarDaysBetween, formatStoredDate, tournamentToday } from '@/lib/timezone';
import { coachEmailBlock, resolveCoachRecipient, type CoachEmailBlock } from '@/lib/coach-email-rules';
import { TEAMS_WORDS, TEAM_RECORD_WORDS, TEAM_STATUS_CHIP } from '@/lib/registration-words';
import { Division } from '@/lib/types';
import { buildFilename, downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings } from '@/lib/export';
import s from '../../admin-common.module.css';
import styles from './teams-admin.module.css';
import ExportMenu from '@/components/admin/ExportMenu';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, RepChip, RowAction, repKit } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { TournamentAdminHeader } from '@/components/admin/tournament';
import { joinDots, screenParts } from '@/components/admin/tournament/ScreenParts';
import BottomSheet from '@/components/admin/BottomSheet';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import DivisionPicker from './components/DivisionPicker';
import RegistrationHealthPanel from './components/RegistrationHealthPanel';
import TeamsGlance, { type PaymentSummary } from './components/TeamsGlance';
import TeamList, { type ListMode, type RowFacts } from './components/TeamList';
import TeamRecordWindow, { type TeamRecordUpdates } from './components/TeamRecord';
import {
  buildListBands, buildSlotBands, computePaymentStatus, getEffectiveFee, hasDepositStep,
  narrowSlotBands, nextOpenSlot, paymentFact, recordOrder, sortedPools,
  type BandKind, type FeeMode, type FeeSchedule, type PoolInfo, type PoolSlot, type Status, type TeamRecord,
} from '@/lib/tournament-teams';

const SAME_ORIGIN_FETCH: RequestInit = { credentials: 'same-origin' };

// J1-075: Accept/Reject's confirm says an email goes only when the route will send one — read
// through the route's own rule (lib/coach-email-rules), and says why when it won't. The words name
// the Event settings switches by their own labels so the organizer can find them (/marketing 09-29).
type StatusEmailType = 'acceptance' | 'rejection';
const STATUS_EMAIL_OFF: Record<StatusEmailType, string> = {
  acceptance: 'the Team accepted email is off in Event settings',
  rejection: 'the Registration declined email is off in Event settings',
};
function noEmailReason(block: CoachEmailBlock, type: StatusEmailType, teamCount = 1): string {
  if (block === 'paused') return 'automatic coach emails are off in Event settings';
  if (block === 'off') return STATUS_EMAIL_OFF[type];
  return teamCount === 1 ? 'this team has no email address' : 'none of them has an email address';
}

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

type PaymentFilter = 'all' | 'unpaid' | 'deposit-paid' | 'paid' | 'past-due';
type ActivePaymentFilter = Exclude<PaymentFilter, 'all'>;
type BulkAction = 'accept' | 'reject' | 'waitlist' | 'mark_deposit_paid' | 'mark_paid';

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
const DEFAULT_STATUSES: Status[] = ['pending', 'accepted', 'waitlist'];

function matchesPaymentFilter(status: ReturnType<typeof computePaymentStatus>, filter: PaymentFilter) {
  if (filter === 'all') return true;
  if (filter === 'unpaid') return status === 'pending' || status === 'past-due';
  return status === filter;
}

/** A question (or a notice) on this screen — the kit's question window. */
type Ask = {
  title: string;
  message: string;
  items?: Array<{ label: string; note?: string }>;
  confirmText?: string;
  type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
  onConfirm?: () => void;
};

export default function UnifiedTeamsPage() {
  const { currentTournament, isLocked, loading: tournamentLoading } = useTournament();
  const { currentOrg } = useOrg();
  const searchParams = useSearchParams();
  usePageTitle('Teams');
  const [regs, setRegs] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(DEFAULT_STATUSES);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [working, setWorking] = useState<string | null>(null);
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
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'pools'>('pools');
  const [feeMode, setFeeMode] = useState<FeeMode>('tournament');
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule>({ depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null });
  const [poolSlots, setPoolSlots] = useState<PoolSlot[]>([]);
  // Which division's slots `poolSlots` holds: until they arrive the list waits, so a slot division is
  // never drawn for a moment as one without slots (the old page flashed its flat list first).
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  const slotsRead = useRef(0);
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
  const paymentQueryAppliedRef = useRef<string | null>(null);
  const landedRef = useRef<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  // T3 — the team whose record is open (the kit's form window), or null.
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  // WI-2C.3 — passive rep-team linking (League/Club orgs only). repTeams = this org's rep
  // teams for the picker; repLinks = registrationId → linked rep team. repLinkPickerId =
  // which registration's picker popover is open; repLinkSearch = its filter text.
  const [repTeams, setRepTeams] = useState<Array<{ id: string; name: string; sport: string | null; division: string | null }>>([]);
  const [repLinks, setRepLinks] = useState<Map<string, { repTeamId: string; repTeamName: string }>>(new Map());
  const [repLinkPickerId, setRepLinkPickerId] = useState<string | null>(null);
  const [repLinkSearch, setRepLinkSearch] = useState('');
  const orgHasRepTeams = useMemo(() => (currentOrg ? hasModuleEntitlement(currentOrg, 'module_rep_teams') : false), [currentOrg]);
  // "Add my team" (2026-09-13) — a tournament run from a coaches PORTAL has exactly one team that
  // is the host's own; the rep-link picker above is gated off for it on purpose (a one-team org
  // needs no picker), and this is that picker collapsed to a button. `ownTeam` is null off a
  // portal; `registrationId` set means the team is already in (button gone, record wears the chip).
  const isHostPortal = useMemo(() => isTeamWorkspaceOrg(currentOrg), [currentOrg]);
  const [ownTeam, setOwnTeam] = useState<{ teamName: string; registrationId: string | null } | null>(null);
  const [showOwnTeamModal, setShowOwnTeamModal] = useState(false);
  const [ownTeamForm, setOwnTeamForm] = useState<{ divisionId: string; paymentStatus: 'paid' | 'pending' }>({ divisionId: '', paymentStatus: 'paid' });
  const [feedback, setFeedback] = useState<Ask | null>(null);
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
      const rData: TeamRecord[] = registrations.map((r: any) => {
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
          seed: r.seed ?? null,
          customAnswers: admin.customAnswers ?? [],
        };
      });

      setDivisions(groups);
      setAllPoolSlots(allSlots);
      setRegistrationFields(fields);
      if (groups.length) {
        // Read the CURRENT choice, not this read's: a division chosen (or remembered, or landed on)
        // while this read was in flight must not be overwritten by it (/review 2026-09-30). The teams
        // are the whole event's, so choosing a division never needs a re-read.
        setSelectedDivisionId(cur => (!cur || cur === 'all' || !groups.some(g => g.id === cur) ? groups[0].id : cur));
        setAddForm(f => (f.divisionId ? f : { ...f, divisionId: groups[0].id }));
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
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
      setHasLoadedInitial(true);
    }
  }, [tournamentLoading, currentTournament?.id, currentOrg?.slug, currentOrg?.planId]);

  const loadPoolSlots = useCallback(async () => {
    const mine = ++slotsRead.current;
    if (!selectedDivisionId || !currentTournament) { setPoolSlots([]); setSlotsFor(selectedDivisionId || null); return; }
    const division = selectedDivisionId;
    try {
      const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/pool-slots?tournamentId=${encodeURIComponent(currentTournament.id)}&divisionId=${encodeURIComponent(division)}${orgParam}`, SAME_ORIGIN_FETCH);
      const slots = await readJsonArray<PoolSlot>(res, 'Pool slots');
      // Only the newest read paints — one begun since (another division, or this one again after a
      // change) must not be overwritten by this older one.
      if (slotsRead.current !== mine) return;
      setPoolSlots(slots);
    } catch {
      if (slotsRead.current !== mine) return;
      setPoolSlots([]);
    }
    setSlotsFor(division);
  }, [selectedDivisionId, currentTournament?.id, currentOrg?.slug]);

  // WI-2C.3 — load this org's rep teams (picker options) + existing registration links.
  // Only for rep-capable orgs; both endpoints self-gate the module server-side too.
  const loadRepLinks = useCallback(async () => {
    if (!orgHasRepTeams || !currentTournament) { setRepTeams([]); setRepLinks(new Map()); return; }
    const orgOnlyParam = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
    const tParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
    try {
      const [teamsRes, linksRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/teams${orgOnlyParam}`, SAME_ORIGIN_FETCH),
        fetch(`/api/admin/teams/rep-team-link?tournamentId=${encodeURIComponent(currentTournament.id)}${tParam}`, SAME_ORIGIN_FETCH),
      ]);
      if (teamsRes.ok) {
        const data = await teamsRes.json().catch(() => ({ teams: [] }));
        const rows = Array.isArray(data.teams) ? data.teams : [];
        setRepTeams(rows.map((r: any) => ({
          id: r.team?.id, name: r.team?.name ?? '', sport: r.team?.sport ?? null, division: r.team?.division ?? null,
        })).filter((t: any) => t.id));
      } else {
        setRepTeams([]);
      }
      if (linksRes.ok) {
        const data = await linksRes.json().catch(() => ({ links: [] }));
        const links = Array.isArray(data.links) ? data.links : [];
        setRepLinks(new Map(links.map((l: any) => [l.registrationId, { repTeamId: l.repTeamId, repTeamName: l.repTeamName }])));
      } else {
        setRepLinks(new Map());
      }
    } catch {
      setRepTeams([]);
      setRepLinks(new Map());
    }
  }, [orgHasRepTeams, currentTournament?.id, currentOrg?.slug]);

  const loadOwnTeam = useCallback(async () => {
    if (!isHostPortal || !currentTournament) { setOwnTeam(null); return; }
    try {
      const res = await fetch(`/api/admin/teams/own-team?tournamentId=${encodeURIComponent(currentTournament.id)}${orgParam}`, SAME_ORIGIN_FETCH);
      if (!res.ok) { setOwnTeam(null); return; }
      const data = await res.json().catch(() => ({ ownTeam: null }));
      setOwnTeam(data.ownTeam ?? null);
    } catch {
      setOwnTeam(null);
    }
  }, [isHostPortal, currentTournament?.id, orgParam]);

  // Email-aware Add Team (2026-09-13, Part B): when the typed address belongs to a coach who is
  // already on the platform, the form says so and turns the notify on — that email IS how the
  // coach accepts the entry into their portal. `known` / `new` / `unknown` (no answer, said
  // nothing); keyed by the address it answers so a stale answer never sits under a new email.
  const [coachAccount, setCoachAccount] = useState<{ email: string; state: 'known' | 'new' | 'unknown' } | null>(null);
  const checkCoachAccount = useCallback(async (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setCoachAccount(null); return; }
    if (coachAccount?.email === email) return;
    try {
      const res = await fetch(`/api/admin/teams/coach-account?email=${encodeURIComponent(email)}${orgParam}`, SAME_ORIGIN_FETCH);
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      const state: 'known' | 'new' | 'unknown' = data.exists === true ? 'known' : data.exists === false ? 'new' : 'unknown';
      setCoachAccount({ email, state });
      if (state === 'known') setAddForm(f => ({ ...f, notifyTeam: true }));
    } catch {
      setCoachAccount({ email, state: 'unknown' });
    }
  }, [coachAccount?.email, orgParam]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPoolSlots(); }, [loadPoolSlots]);
  useEffect(() => { loadRepLinks(); }, [loadRepLinks]);
  useEffect(() => { loadOwnTeam(); }, [loadOwnTeam]);

  useEffect(() => {
    setSelectedRegistrationIds(prev => {
      if (prev.size === 0) return prev;
      const validIds = new Set(regs.filter(reg => reg.division_id === selectedDivisionId).map(reg => reg.id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [regs, selectedDivisionId]);

  // J1-069: pre-fill the reminder message with the payment instructions the
  // organizer already saved in Event Settings (tournament.settings.payment_instructions
  // — the exact field the reminder email sends), so they don't retype their
  // e-transfer details every send. Fall back to a generic prompt only when none
  // is saved. Still editable per send.
  useEffect(() => {
    if (paymentInstructions || !currentTournament) return;
    const saved = currentTournament.settings?.payment_instructions;
    if (typeof saved === 'string' && saved.trim()) {
      setPaymentInstructions(saved.trim());
      return;
    }
    setPaymentInstructions(`Please send payment for ${currentTournament.name} using the payment instructions provided by the tournament organizer. Include your team name and division in the memo or note.`);
  }, [currentTournament, paymentInstructions]);

  /** One team's change through the teams route; the list takes it at once. Throws with the reason. */
  const saveTeam = useCallback(async (id: string, updates: TeamRecordUpdates | Record<string, unknown>, signal?: AbortSignal) => {
    const res = await fetch(`/api/admin/teams${orgQuery}`, {
      credentials: 'same-origin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], updates }),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Couldn’t save');
    setRegs(prev => prev.map(r => r.id === id ? { ...r, ...(updates as Partial<TeamRecord>) } : r));
  }, [orgQuery]);

  /** One organizer action, the shape every button on this screen shares: marks what is busy, runs it,
   *  and says why in a question window if it fails. */
  async function withWorking(key: string, failTitle: string, task: () => Promise<void>) {
    setWorking(key);
    try {
      await task();
    } catch (e) {
      setFeedback({ title: failTitle, message: e instanceof Error ? e.message : String(e), type: 'danger' });
    } finally {
      setWorking(null);
    }
  }

  /** A status or payment change: asks first when `confirm` is given, then re-reads (a slot may move). */
  function patch(id: string, updates: Record<string, unknown>, confirm?: { title: string; message: string; confirmText?: string; type?: Ask['type'] }) {
    const execute = async () => {
      await withWorking(id, 'That didn’t save', async () => {
        await saveTeam(id, updates);
        await Promise.all([load(), loadPoolSlots()]);
      });
    };
    if (confirm) {
      setFeedback({ title: confirm.title, message: confirm.message, confirmText: confirm.confirmText, type: confirm.type ?? 'primary', onConfirm: execute });
    } else {
      void execute();
    }
  }

  // The one-team Accept/Reject question, with the email clause (J1-075). The buttons render only
  // for a team whose status would change, which is the route's other condition for sending. The
  // switches are the held tournament's `settings`; saving Event settings refreshes it.
  function statusConfirm(team: TeamRecord, type: StatusEmailType): { title: string; message: string; confirmText: string; type: Ask['type'] } {
    const block = coachEmailBlock(currentTournament?.settings, type, team);
    return {
      title: `${type === 'acceptance' ? 'Accept' : 'Reject'} “${team.name}”?`,
      message: block ? `No email will go out — ${noEmailReason(block, type)}.` : `An email will go to ${resolveCoachRecipient(team)}.`,
      confirmText: type === 'acceptance' ? TEAMS_WORDS.accept : TEAM_RECORD_WORDS.reject,
      type: type === 'acceptance' ? 'primary' : 'warning',
    };
  }
  const acceptTeam = (team: TeamRecord) => patch(team.id, { status: 'accepted' }, statusConfirm(team, 'acceptance'));
  const rejectTeam = (team: TeamRecord) => patch(team.id, { status: 'rejected' }, statusConfirm(team, 'rejection'));

  // The bulk twin: the route emails each selected team whose status CHANGES, by the same rule.
  // A reason is given only when one cause explains every selected team.
  function bulkStatusEmailLine(type: StatusEmailType, selected: TeamRecord[]): string {
    if (selected.length === 0) return '';
    const target = type === 'acceptance' ? 'accepted' : 'rejected';
    const blocks = selected.map(r => (r.status === target ? undefined : coachEmailBlock(currentTournament?.settings, type, r)));
    const emailed = blocks.filter(b => b === null).length;
    if (emailed === selected.length) return selected.length === 1 ? ' It will get an email.' : ' Each one will get an email.';
    if (emailed > 0) return ` ${emailed} of them will get an email.`;
    const none = selected.length === 1 ? 'No email will go out' : 'No emails will go out';
    const first = blocks[0];
    return first && blocks.every(b => b === first)
      ? ` ${none} — ${noEmailReason(first, type, selected.length)}.`
      : ` ${none}.`;
  }

  function handleDelete(team: TeamRecord) {
    // Two-step when the team has history. The API refuses to delete a team that still appears in
    // a game (409 TEAM_HAS_GAMES) unless `force` is passed — the guard added alongside migration
    // 200, when deleting a team stopped DESTROYING its games and started stranding them instead.
    const id = team.id;
    const doDelete = async (force: boolean) => {
      await withWorking(id, 'Delete failed', async () => {
        const res = await fetch(`/api/admin/teams${orgQuery}`, {
          credentials: 'same-origin',
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id], force }),
        });
        if (res.status === 409) {
          const info = await res.json().catch(() => null);
          if (info?.error === 'TEAM_HAS_GAMES') {
            setFeedback({ title: 'This team has games', message: info.message, type: 'danger', confirmText: TEAM_RECORD_WORDS.deleteConfirm, onConfirm: () => doDelete(true) });
            return;
          }
          throw new Error(info?.message || info?.error || 'Delete failed');
        }
        if (!res.ok) throw new Error('Delete failed');
        setOpenTeamId(prev => (prev === id ? null : prev));
        setRegs(prev => prev.filter(r => r.id !== id));
        await Promise.all([load(), loadPoolSlots()]);
      });
    };
    setFeedback({
      title: TEAM_RECORD_WORDS.deleteTitle,
      message: TEAM_RECORD_WORDS.deleteBody(team.name),
      type: 'danger',
      confirmText: TEAM_RECORD_WORDS.deleteConfirm,
      onConfirm: () => doDelete(false),
    });
  }

  function resendAccessLink(team: TeamRecord) {
    if (!currentTournament) return;
    setFeedback({
      title: TEAM_RECORD_WORDS.resendTitle,
      message: TEAM_RECORD_WORDS.resendBody(team.name),
      items: [{ label: team.name, note: team.email }],
      confirmText: TEAM_RECORD_WORDS.resendConfirm,
      type: 'primary',
      onConfirm: async () => {
        await withWorking('resend-access', 'Send failed', async () => {
          const res = await fetch(
            `/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/registrations/${encodeURIComponent(team.id)}/resend-access${orgQuery}`,
            { credentials: 'same-origin', method: 'POST' },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Access link could not be sent.');
          setFeedback({ title: 'Access link sent', message: `An email with the dashboard link went to ${team.email}.`, type: 'success' });
        });
      },
    });
  }

  // WI-2C.3 — link a registration to one of this org's rep teams (or relink). Optimistic-ish:
  // reflects the new link locally on success. Server asserts rep_teams.org_id === ctx.org.id.
  async function handleLinkRepTeam(registrationId: string, repTeamId: string) {
    if (!currentTournament) return;
    const repTeam = repTeams.find(t => t.id === repTeamId);
    await withWorking(registrationId, 'Link failed', async () => {
      const res = await fetch(`/api/admin/teams/rep-team-link${orgQuery}`, {
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: currentTournament.id, registrationId, repTeamId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not link the rep team.');
      setRepLinks(prev => {
        const next = new Map(prev);
        next.set(registrationId, { repTeamId, repTeamName: repTeam?.name ?? '' });
        return next;
      });
      // Only close the picker if THIS registration's is still the open one.
      setRepLinkPickerId(prev => (prev === registrationId ? null : prev));
      setRepLinkSearch('');
    });
  }

  function handleUnlinkRepTeam(registrationId: string) {
    const link = repLinks.get(registrationId);
    setFeedback({
      title: 'Remove the rep-team link?',
      message: `Unlink this registration from “${link?.repTeamName ?? 'the rep team'}”? The team's coaches will still be recognized on the public page if their email is on the registration.`,
      type: 'warning',
      confirmText: 'Unlink',
      onConfirm: async () => {
        if (!currentTournament) return;
        await withWorking(registrationId, 'Unlink failed', async () => {
          const res = await fetch(`/api/admin/teams/rep-team-link${orgQuery}`, {
            credentials: 'same-origin',
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId: currentTournament.id, registrationId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? 'Could not unlink.');
          setRepLinks(prev => {
            const next = new Map(prev);
            next.delete(registrationId);
            return next;
          });
          setRepLinkPickerId(prev => (prev === registrationId ? null : prev));
        });
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
    const slotA = poolSlots.find(x => x.id === swapFirstSlotId);
    const slotB = poolSlots.find(x => x.id === slotBId);
    const captured = swapFirstSlotId;
    setSwapFirstSlotId(null);
    const nameA = slotA?.teamName ?? null;
    const nameB = slotB?.teamName ?? null;
    // A swap exchanges the two spots' teams: say where each one goes (an open spot moves one team).
    const message = nameA
      ? TEAMS_WORDS.swapMoves(nameA, slotB?.displayName ?? '', nameB, slotA?.displayName ?? '')
      : nameB ? TEAMS_WORDS.swapMoves(nameB, slotA?.displayName ?? '', null, slotB?.displayName ?? '') : '';

    setFeedback({
      title: TEAMS_WORDS.swapTitle,
      message,
      confirmText: TEAMS_WORDS.swap,
      type: 'primary',
      onConfirm: async () => {
        await withWorking('swap', 'Swap failed', async () => {
          const res = await fetch(`/api/admin/teams${orgQuery}`, {
            credentials: 'same-origin',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'swap-slots', slotAId: captured, slotBId }),
          });
          if (!res.ok) throw new Error('Swap failed');
          await Promise.all([load(), loadPoolSlots()]);
        });
      },
    });
  }

  function handlePromote(team: TeamRecord) {
    const waitlisted = team.status === 'waitlist';
    setFeedback({
      title: waitlisted ? 'Promote from the waitlist?' : 'Place in the open spot?',
      message: `Move “${team.name}” into the next open spot?`,
      confirmText: waitlisted ? TEAMS_WORDS.promote : TEAMS_WORDS.place,
      type: 'primary',
      onConfirm: async () => {
        await withWorking(team.id, 'That didn’t work', async () => {
          const res = await fetch(`/api/admin/teams${orgQuery}`, {
            credentials: 'same-origin',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'promote-from-waitlist', teamId: team.id }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Promote failed');
          }
          await Promise.all([load(), loadPoolSlots()]);
        });
      },
    });
  }

  async function randomizeSlots() {
    const filledSlots = poolSlots.filter(x => x.teamId !== null);
    if (filledSlots.length < 2) {
      setFeedback({ title: 'Not enough teams', message: 'At least 2 filled slots are needed to randomize.', type: 'warning' });
      return;
    }
    setFeedback({
      title: 'Randomize the slots?',
      message: `Randomly shuffle ${filledSlots.length} teams across their slots. Manual swaps can adjust afterward.`,
      confirmText: TEAMS_WORDS.randomize,
      type: 'primary',
      onConfirm: async () => {
        await withWorking('randomizing', 'That didn’t work', async () => {
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
        });
      },
    });
  }

  async function randomizePools() {
    const group = divisions.find(g => g.id === selectedDivisionId);
    if (!group?.pools || group.pools.length <= 1) return;
    setFeedback({
      title: 'Randomize the pools?',
      message: `Randomly distribute all accepted teams in ${group.name} across ${group.pools.length} pools?`,
      confirmText: TEAMS_WORDS.randomize,
      type: 'primary',
      onConfirm: async () => {
        await withWorking('randomizing', 'That didn’t work', async () => {
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
          await load();
        });
      },
    });
  }

  // Bulk-assign every selected team to one pool (or clear it). Reuses the teams
  // endpoint's shared `{ ids, updates }` form — poolId '' clears to null server-side.
  async function moveSelectedToPool(poolId: string) {
    if (selectedRegistrationIds.size === 0) return;
    const ids = [...selectedRegistrationIds];
    await withWorking('bulk', 'Move failed', async () => {
      const res = await fetch(`/api/admin/teams${orgQuery}`, {
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates: { poolId } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Move failed');
      setRegs(prev => prev.map(r => selectedRegistrationIds.has(r.id) ? { ...r, poolId: poolId || undefined } : r));
      clearRegistrationSelection();
    });
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    await withWorking('new', 'Add team failed', async () => {
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
      await Promise.all([load(), loadPoolSlots()]);
    });
  }

  function openOwnTeamModal() {
    setOwnTeamForm({ divisionId: selectedDivisionId || divisions[0]?.id || '', paymentStatus: 'paid' });
    setShowOwnTeamModal(true);
  }

  async function handleAddOwnTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    await withWorking('own-team', 'Add my team failed', async () => {
      const res = await fetch(`/api/admin/teams/own-team${orgQuery}`, {
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: currentTournament.id,
          divisionId: ownTeamForm.divisionId,
          paymentStatus: ownTeamForm.paymentStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Your team could not be added.');
      setShowOwnTeamModal(false);
      void load();
      void loadOwnTeam();
    });
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
    setCoachAccount(null);
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
      setFeedback({ title: 'Export is on Tournament Plus', message: requiresTournamentPlusCopy('registration_export'), type: 'warning' });
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
      { groups: groups.length > 0 ? groups : undefined, identity: currentOrg?.name },
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

  function clearRegistrationSelection() {
    setSelectedRegistrationIds(new Set());
    setMultiSelectMode(false);
  }

  async function runBulkAction(action: BulkAction) {
    if (!currentTournament || selectedRegistrationIds.size === 0) return;
    const selectedCount = selectedRegistrationIds.size;

    const selectedTeams = regs.filter(r => selectedRegistrationIds.has(r.id));
    const selectedTeamNames = selectedTeams.map(r => ({ label: r.name }));
    const teamsWord = `${selectedCount} team${selectedCount === 1 ? '' : 's'}`;

    const titleMap: Record<BulkAction, string> = {
      accept:            `Accept ${teamsWord}?`,
      reject:            `Reject ${teamsWord}?`,
      waitlist:          `Move ${teamsWord} to the waitlist?`,
      mark_deposit_paid: 'Mark the deposit paid?',
      mark_paid:         'Mark paid in full?',
    };

    // Only Accept and Reject send the status email the line describes.
    const emailLine = action === 'accept' ? bulkStatusEmailLine('acceptance', selectedTeams)
      : action === 'reject' ? bulkStatusEmailLine('rejection', selectedTeams) : '';
    const messageMap: Record<BulkAction, string> = {
      accept:            `The following ${teamsWord} will be accepted.${emailLine}`,
      reject:            `The following ${teamsWord} will be rejected.${emailLine}`,
      waitlist:          `The following ${teamsWord} will be moved to the waitlist.`,
      mark_deposit_paid: `Deposit will be marked as paid for the following ${teamsWord}.`,
      mark_paid:         `The following ${teamsWord} will be marked as paid in full.`,
    };

    const confirmMap: Record<BulkAction, string> = {
      accept:            TEAMS_WORDS.accept,
      reject:            TEAMS_WORDS.bulkReject,
      waitlist:          TEAMS_WORDS.bulkWaitlist,
      mark_deposit_paid: TEAMS_WORDS.depositPaid,
      mark_paid:         TEAMS_WORDS.paidInFull,
    };

    setFeedback({
      title: titleMap[action],
      message: messageMap[action],
      items: selectedTeamNames,
      confirmText: confirmMap[action],
      type: action === 'reject' ? 'warning' : 'primary',
      onConfirm: async () => {
        await withWorking('bulk', 'That didn’t work', async () => {
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
          const n = data.count ?? selectedCount;
          setFeedback({ title: 'Done', message: `${n} registration${n === 1 ? '' : 's'} updated.`, type: 'success' });
        });
      },
    });
  }

  async function sendPaymentReminders() {
    if (!currentTournament || selectedRegistrationIds.size === 0) return;

    if (!currentOrg || !hasPlanFeature(currentOrg.planId, 'payment_readiness_tools')) {
      setFeedback({ title: 'Payment reminders are on Tournament Plus', message: requiresTournamentPlusCopy('payment_readiness_tools'), type: 'warning' });
      setShowReminderModal(false);
      return;
    }

    await withWorking('payment-reminders', 'Reminders didn’t send', async () => {
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
        title: 'Payment reminders sent',
        message: `${data.emailsSent ?? 0} reminder${(data.emailsSent ?? 0) === 1 ? '' : 's'} sent. ${data.skippedCount ?? 0} selected registration${(data.skippedCount ?? 0) === 1 ? ' was' : 's were'} skipped because no payment is currently due.`,
        type: 'success',
      });

    });
  }

  const today = tournamentToday();
  const selectedGroup = divisions.find(g => g.id === selectedDivisionId);
  const slotsReady = slotsFor === selectedDivisionId;
  const slotConfigured = slotsReady && poolSlots.length > 0;
  const poolsForDivision = useMemo(() => sortedPools((selectedGroup?.pools ?? []) as PoolInfo[]), [selectedGroup]);
  // Manual pool assignment applies to pool-enabled divisions that are NOT running the
  // fixed slot board (those keep their own place/swap flow).
  const poolAssignable = !slotConfigured && poolsForDivision.length > 0;

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
      if (!res.ok) throw new Error('Registration could not be changed.');
      // Reopening registration also takes the public schedule offline (the server does
      // this atomically) — mirror that in local state so the UI matches.
      setDivisions(prev => prev.map(d => d.id === selectedDivisionId
        ? { ...d, isClosed: nextClosed, scheduleVisibility: nextClosed ? d.scheduleVisibility : 'unpublished' }
        : d));
    } catch (e: any) {
      setFeedback({ title: 'That didn’t work', message: e.message, type: 'danger' });
    } finally {
      setClosingDivision(false);
    }
  }

  function handleToggleRegistration() {
    if (!selectedDivisionId || closingDivision) return;
    const nextClosed = !selectedGroup?.isClosed;
    // Warn before reopening a division whose schedule is already published — reopening
    // takes the public schedule back offline so the two states never conflict.
    if (!nextClosed && selectedGroup?.scheduleVisibility === 'published') {
      setFeedback({
        title: 'Reopen Registration?',
        message: 'This division\'s schedule is published. Reopening registration will take the public schedule offline (back to "coming soon"). You can publish it again after registration closes.',
        type: 'warning',
        confirmText: 'Reopen & Unpublish',
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
  const planHref = `${subscriptionHref}?plan=tournament_plus`;

  // PDF settings — fetched once on mount; used in handleExportPDF
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  useEffect(() => {
    // D4: server-resolved — org-name header fallback + the org's uploaded logo, print-ready.
    const q = orgQuery ? `${orgQuery}&resolve=1` : '?resolve=1';
    void fetchResolvedPdfSettings(`/api/admin/org/pdf-settings${q}`).then(setPdfSettings);
  }, [orgQuery]);

  // Restore view settings from localStorage when tournament changes. (Payments no longer remembers
  // being open — T1: it opens closed every time.) The grouping and the division are remembered; a
  // FILTER is not (the Teams toolbar ruling, 2026-10-01): a filter now narrows a pool board to a list,
  // so one left on last visit would open the board as a list with nothing on screen saying why.
  useEffect(() => {
    const tid = currentTournament?.id;
    if (!tid) return;
    try {
      const raw = localStorage.getItem(`flhq-teams-${tid}`);
      if (!raw) return;
      const cached = JSON.parse(raw) as Partial<{ viewMode: 'flat' | 'pools'; selectedDivisionId: string }>;
      if (cached.viewMode === 'flat' || cached.viewMode === 'pools') setViewMode(cached.viewMode);
      if (cached.selectedDivisionId) setSelectedDivisionId(cached.selectedDivisionId);
    } catch {}
  }, [currentTournament?.id]);

  // Persist view settings. Guard: only write once divisions are loaded.
  useEffect(() => {
    const tid = currentTournament?.id;
    if (!tid || !selectedDivisionId || divisions.length === 0) return;
    try {
      localStorage.setItem(`flhq-teams-${tid}`, JSON.stringify({ viewMode, selectedDivisionId }));
    } catch {}
  }, [currentTournament?.id, viewMode, selectedDivisionId, divisions.length]);

  // T2 — Teams opens on the first division with a team to review, else the remembered one. Once per
  // event, after the first read, and never over a link that names its own division or bucket — so the
  // context strip's and the rail's "N to review" (which link to Teams with no division) land on the work.
  const reviewByDivision = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of regs) if (r.status === 'pending') m.set(r.division_id, (m.get(r.division_id) ?? 0) + 1);
    return m;
  }, [regs]);
  useEffect(() => {
    const tid = currentTournament?.id;
    if (!hasLoadedInitial || !tid || landedRef.current === tid) return;
    landedRef.current = tid;
    if (searchParams.get('division') || searchParams.get('attention')) return;
    const withReview = divisions.find(d => (reviewByDivision.get(d.id) ?? 0) > 0);
    if (withReview) setSelectedDivisionId(withReview.id);
  }, [hasLoadedInitial, currentTournament?.id, divisions, reviewByDivision, searchParams]);

  const divRegs = useMemo(() => regs.filter(r => r.division_id === selectedDivisionId), [regs, selectedDivisionId]);
  const feeOf = useCallback((team: Pick<TeamRecord, 'division_id'>) => getEffectiveFee(team, divisions, feeMode, feeSchedule), [divisions, feeMode, feeSchedule]);

  const paymentSummary = useMemo<PaymentSummary & { accepted: number }>(() => {
    const accepted = divRegs.filter(team => team.status === 'accepted');
    let expected = 0;
    let collected = 0;
    let outstanding = 0;
    let depositRequired = 0;
    let depositComplete = 0;
    let paidInFull = 0;
    let pastDue = 0;
    let pastDueAmount = 0;
    let scheduled = 0;

    for (const team of accepted) {
      const fee = feeOf(team);
      const status = computePaymentStatus(team, fee, today);
      const paidFull = fee.totalFeeAmount != null && team.totalPaid >= fee.totalFeeAmount;
      if (fee.totalFeeAmount) {
        scheduled++;
        expected += fee.totalFeeAmount;
        collected += Math.min(team.totalPaid, fee.totalFeeAmount);
        outstanding += Math.max(fee.totalFeeAmount - team.totalPaid, 0);
        if (paidFull) paidInFull++;
      }
      if (hasDepositStep(fee)) {
        depositRequired++;
        if (paidFull || team.depositPaid >= (fee.depositAmount ?? 0)) depositComplete++;
      }
      if (status === 'past-due') {
        pastDue++;
        // Dollars actually overdue: once the total-fee due date has passed, the whole
        // remaining balance is past due; if only the deposit deadline has slipped, just
        // the deposit shortfall is.
        const totalOverdue = Boolean(fee.totalFeeDueDate && today > fee.totalFeeDueDate);
        pastDueAmount += totalOverdue
          ? Math.max((fee.totalFeeAmount ?? 0) - team.totalPaid, 0)
          : Math.max((fee.depositAmount ?? 0) - team.depositPaid, 0);
      }
    }

    return { accepted: accepted.length, scheduled, expected, collected, outstanding, depositRequired, depositComplete, paidInFull, pastDue, pastDueAmount };
  }, [divRegs, feeOf, today]);

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
      email: team.email,
    })),
    attentionContext,
  ), [attentionContext, regs]);
  const activeAttentionBucket = activeAttentionKey ? getRegistrationAttentionBucket(attentionSummary, activeAttentionKey) : null;
  const activeAttentionLocked = Boolean(activeAttentionBucket?.plusOnly && !commandCenterAvailable);

  // ── Registration Health (tournament-wide, independent of the selected division) ──
  const registrationHealthCapacity = useMemo(() => {
    const acceptedByDivision = new Map<string, number>();
    for (const team of regs) {
      if (team.status !== 'accepted' || !team.division_id) continue;
      acceptedByDivision.set(team.division_id, (acceptedByDivision.get(team.division_id) ?? 0) + 1);
    }
    const daysUntilStart = currentTournament?.startDate
      ? calendarDaysBetween(new Date(), new Date(`${currentTournament.startDate}T12:00:00`))
      : null;
    const gaps: RegistrationHealthCapacityGap[] = [];
    // Fill ratio across only the divisions that HAVE a capacity set.
    let capacityTotal = 0;
    let capacityAccepted = 0;
    for (const division of divisions) {
      if (division.capacity == null || division.capacity <= 0) continue;
      const accepted = acceptedByDivision.get(division.id) ?? 0;
      capacityTotal += division.capacity;
      capacityAccepted += accepted;
      if (accepted >= division.capacity) continue;
      if (division.isClosed) {
        gaps.push({ divisionId: division.id, divisionName: division.name, accepted, capacity: division.capacity, reason: 'closed_under' });
      } else if (daysUntilStart != null && daysUntilStart <= 3) {
        gaps.push({ divisionId: division.id, divisionName: division.name, accepted, capacity: division.capacity, reason: 'soon_under' });
      }
    }
    return { gaps, capacityTotal, capacityAccepted };
  }, [regs, divisions, currentTournament?.startDate]);

  const registrationHealth = useMemo(() => {
    let teamsTotal = 0;
    let accepted = 0;
    for (const team of regs) {
      if (!team.status || team.status === 'rejected') continue;
      teamsTotal++;
      if (team.status === 'accepted') accepted++;
    }
    return buildRegistrationHealth({
      attention: attentionSummary,
      teamsTotal,
      accepted,
      paymentsTracked: commandCenterAvailable,
      capacityGaps: registrationHealthCapacity.gaps,
    });
  }, [attentionSummary, regs, commandCenterAvailable, registrationHealthCapacity]);

  // ── The list the division shows ──
  const filtered = useMemo(() => divRegs.filter(r => {
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
    const matchesSearch = search === '' || r.name.toLowerCase().includes(search.toLowerCase()) || r.coach.toLowerCase().includes(search.toLowerCase());
    // Only an accepted team pays (T5): a payment filter never lists a team whose Payment reads "—".
    const matchesPayment = !paymentToolsAvailable || paymentFilters.length === 0
      || (r.status === 'accepted' && paymentFilters.some(f => matchesPaymentFilter(computePaymentStatus(r, feeOf(r), today), f)));
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
      email: r.email,
    }, activeAttentionKey, attentionContext);
    return matchesStatus && matchesSearch && matchesPayment && matchesAttention;
  }), [divRegs, selectedStatuses, search, feeOf, today, paymentToolsAvailable, paymentFilters, activeAttentionKey, activeAttentionLocked, attentionContext]);
  const hasNonDefaultFilters = paymentFilters.length > 0 ||
    selectedStatuses.length !== 3 ||
    !selectedStatuses.includes('pending') ||
    !selectedStatuses.includes('accepted') ||
    !selectedStatuses.includes('waitlist');
  // A search, a filter or a dashboard bucket narrows the division. On a slot board the matches keep
  // their pools and spots and the open spots go (the Teams toolbar ruling, 2026-10-01); the whole
  // board — every spot, the one Swap needs — is drawn only when nothing narrows it.
  const narrowed = Boolean(activeAttentionKey) || search !== '' || hasNonDefaultFilters;
  const onSlotBoard = slotConfigured && !narrowed;
  const listGrouping = poolAssignable && viewMode === 'pools' ? 'pools' : 'status';
  const bands = useMemo(() => {
    if (!slotConfigured) return buildListBands({ teams: filtered, grouping: listGrouping, pools: poolsForDivision });
    const board = buildSlotBands({ divRegs, pools: poolsForDivision, poolSlots });
    return narrowed ? narrowSlotBands(board, filtered) : board;
  }, [slotConfigured, narrowed, divRegs, poolsForDivision, poolSlots, filtered, listGrouping]);
  const order = useMemo(() => recordOrder(bands), [bands]);
  const openSlot = useMemo(() => nextOpenSlot(poolsForDivision, poolSlots), [poolsForDivision, poolSlots]);
  const slotOf = useMemo(() => new Map(poolSlots.filter(x => x.teamId).map(x => [x.teamId as string, x])), [poolSlots]);
  const poolNameOf = (team: TeamRecord, slot: PoolSlot | null): string | null => {
    const poolId = slot?.poolId ?? team.poolId;
    const pool = poolId ? poolsForDivision.find(p => p.id === poolId) : undefined;
    return pool ? formatPoolName(pool.name) : null;
  };

  const selectionModeActive = !isLocked && (multiSelectMode || selectedRegistrationIds.size > 0);
  const visibleSelectableIds = order.map(t => t.id);
  const allVisibleSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every(id => selectedRegistrationIds.has(id));
  const listMode: ListMode = selectionModeActive ? 'select' : swapMode && onSlotBoard && !isLocked ? 'swap' : 'normal';
  // Select many and Swap are picked from Tools, and the mode's note replaces the toolbar that held the
  // menu — so the keyboard would land at the top of the page. It lands on the mode's Done instead.
  const modeDoneRef = useRef<HTMLButtonElement>(null);
  const lastListModeRef = useRef<ListMode>('normal');
  useEffect(() => {
    const was = lastListModeRef.current;
    lastListModeRef.current = listMode;
    if (was === 'normal' && listMode !== 'normal') modeDoneRef.current?.focus({ preventScroll: true });
  }, [listMode]);

  /** What a row says: its caption (Check-in's words for money), a chip where its status differs from its
   *  band, and its one worded action (A13; the Tournament plan's Promote/Place is a lock in the record, P1). */
  const rowFacts = (team: TeamRecord, slot: PoolSlot | null, band: BandKind): RowFacts => {
    const pay = paymentFact(team, feeOf(team));
    const payNode = pay ? <span className={pay.owes ? styles.owes : undefined}>{pay.text}</span> : null;
    const coach = team.coach?.trim() ? team.coach.trim() : null;
    const spotWords = openSlot ? TEAMS_WORDS.spotOpen : TEAMS_WORDS.waitsForSpot;
    const differs = (band === 'pool' || band === 'nopool') && team.status !== 'accepted';
    const chipInfo = TEAM_STATUS_CHIP[team.status];
    const chip = differs ? <RepChip tone={chipInfo.tone}>{chipInfo.label}</RepChip> : null;
    const busy = working === team.id || isLocked;
    let parts: React.ReactNode[] = [];
    let action: React.ReactNode | null = null;
    let place: React.ReactNode = <span className={repKit.dim}>—</span>;
    const acceptAction = team.status === 'pending' && !isLocked
      ? <RowAction onClick={() => acceptTeam(team)} disabled={busy} aria-label={`${TEAMS_WORDS.accept} ${team.name}`}>{TEAMS_WORDS.accept}</RowAction>
      : null;
    if (team.status === 'pending' && !slot) {
      parts = [coach, TEAMS_WORDS.registeredOn(formatStoredDate(team.registered_at, { withYear: false }))];
      action = acceptAction;
    } else if (band === 'waitlist') {
      const pos = team.waitlistPosition != null ? TEAMS_WORDS.waitlistPosition(team.waitlistPosition) : null;
      parts = slotConfigured ? [pos, coach, spotWords] : [pos, coach];
      place = pos ?? place;
      if (slotConfigured && openSlot && waitlistAutomationAvailable && !isLocked) {
        action = <RowAction onClick={() => handlePromote(team)} disabled={busy} aria-label={`${TEAMS_WORDS.promote} ${team.name}`}>{TEAMS_WORDS.promote}</RowAction>;
      }
    } else if (band === 'unplaced') {
      parts = [coach, spotWords];
      if (openSlot && waitlistAutomationAvailable && !isLocked) {
        action = <RowAction onClick={() => handlePromote(team)} disabled={busy} aria-label={`${TEAMS_WORDS.place} ${team.name}`}>{TEAMS_WORDS.place}</RowAction>;
      }
    } else if (slot) {
      parts = [slot.displayName, coach, payNode];
      place = slot.displayName;
      // A team waiting for a decision that already holds its spot keeps its row, with its Accept (P2).
      action = acceptAction;
    } else {
      const poolName = poolAssignable && viewMode !== 'pools' ? poolNameOf(team, null) : null;
      parts = [poolName, coach, payNode];
      if (poolAssignable) place = poolNameOf(team, null) ?? place;
    }
    const caption = joinDots(parts);
    return { caption, chip, action, place, payment: payNode ?? <span className={repKit.dim}>—</span> };
  };

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
    setSelectedStatuses(DEFAULT_STATUSES);
    setPaymentFilters([]);
  }, []);

  const showCommandCenterUpgrade = useCallback(() => {
    setFeedback({
      title: 'Payment tracking is on Tournament Plus',
      message: 'Tournament Plus turns payment, required intake, and placement follow-ups into one focused list.',
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
    // F41 — the bucket's teams live in this division when it has any, else in the first division that
    // does, so the list under the banner is never empty while the banner counts teams elsewhere.
    const targetDivisionId = divisionId
      ?? (selectedDivisionHasCount ? selectedDivisionId : divisionCounts[0]?.divisionId ?? '');

    if (targetDivisionId) {
      setSelectedDivisionId(targetDivisionId);
      setSwapMode(false);
      setSwapFirstSlotId(null);
    }

    applyAttentionFilterState(key);
  }, [applyAttentionFilterState, attentionSummary, commandCenterAvailable, selectedDivisionId, showCommandCenterUpgrade]);

  const clearAttentionFocus = useCallback(() => {
    setActiveAttentionKey(null);
    setSelectedStatuses(DEFAULT_STATUSES);
    setPaymentFilters([]);
  }, []);

  const jumpToDivision = useCallback((divisionId: string) => {
    setActiveAttentionKey(null);
    setSelectedDivisionId(divisionId);
    setSwapMode(false);
    setSwapFirstSlotId(null);
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

  // J1-067: honor dashboard payment deep-links (?payment=paid|deposit|pending).
  const paymentParam = searchParams.get('payment');
  useEffect(() => {
    if (!hasLoadedInitial || !currentTournament?.id || !paymentParam || !paymentToolsAvailable) return;
    const filter: ActivePaymentFilter | null =
      paymentParam === 'paid' ? 'paid'
      : paymentParam === 'deposit' ? 'deposit-paid'
      : paymentParam === 'pending' ? 'unpaid'
      : paymentParam === 'past-due' ? 'past-due'
      : null;
    if (!filter) return;
    const token = `${currentTournament.id}:${paymentParam}`;
    if (paymentQueryAppliedRef.current === token) return;
    paymentQueryAppliedRef.current = token;
    setActiveAttentionKey(null);
    setSelectedStatuses(['accepted']);
    setPaymentFilters([filter]);
  }, [currentTournament?.id, hasLoadedInitial, paymentParam, paymentToolsAvailable]);

  const chooseDivision = (id: string) => {
    setSelectedDivisionId(id);
    setSwapMode(false);
    setSwapFirstSlotId(null);
    setActiveAttentionKey(null);
  };

  // WI-2C.3 — the passive "Link to rep team" control, now the record's "Rep team" line (T7), in its two
  // faces: the linked team's NAME while the record reads, and while it is edited a linked name (opens the
  // picker to relink, ✕ unlinks) or "Link to a rep team", and the org-scoped picker. Only for
  // rep-capable orgs — called only behind `orgHasRepTeams` (coach-own-team-entry-guard).
  function renderRepLinkControl(team: TeamRecord, busy: boolean): { name: string | null; control: React.ReactNode; closePicker: () => void } {
    const link = repLinks.get(team.id);
    const pickerOpen = repLinkPickerId === team.id;
    const togglePicker = () => {
      setRepLinkPickerId(pickerOpen ? null : team.id);
      setRepLinkSearch('');
    };
    const q = repLinkSearch.trim().toLowerCase();
    const matches = repTeams.filter(t => !q || t.name.toLowerCase().includes(q));

    const control = (
      <div className={styles.repLinkWrap}>
        {link ? (
          <span className={styles.repLinkChip} title={`Linked to rep team ${link.repTeamName}`}>
            <Link2 size={12} aria-hidden />
            <button type="button" className={styles.repLinkChipName} onClick={togglePicker} disabled={busy}
              aria-expanded={pickerOpen} title="Change linked rep team">
              {link.repTeamName || 'Rep team'}
            </button>
            <button type="button" className={styles.repLinkChipX} onClick={() => handleUnlinkRepTeam(team.id)}
              disabled={busy} aria-label={`Unlink ${team.name} from rep team`}>
              <X size={11} aria-hidden />
            </button>
          </span>
        ) : (
          <button type="button" className={styles.repLinkButton} onClick={togglePicker} disabled={busy}
            aria-expanded={pickerOpen} aria-label={`Link ${team.name} to a rep team`}>
            <Link2 size={13} aria-hidden /><span>{TEAM_RECORD_WORDS.linkRepTeam}</span>
          </button>
        )}
        {pickerOpen && (
          <div className={styles.repLinkPopover} role="dialog" aria-label={`Link ${team.name} to a rep team`}>
            <div className={styles.repLinkPopHead}>
              <div className={styles.repLinkPopTitle}>Link &ldquo;{team.name}&rdquo; to a rep team</div>
              <div className={styles.repLinkPopSub}>Your organization&rsquo;s rep teams only</div>
            </div>
            <div className={styles.repLinkSearch}>
              <Search size={13} aria-hidden />
              <input autoFocus value={repLinkSearch} onChange={e => setRepLinkSearch(e.target.value)}
                placeholder="Search rep teams…" aria-label="Search rep teams" />
            </div>
            <div className={styles.repLinkList}>
              {repTeams.length === 0 ? (
                <div className={styles.repLinkEmpty}>No rep teams in this organization yet.</div>
              ) : matches.length === 0 ? (
                <div className={styles.repLinkEmpty}>No rep teams match &ldquo;{repLinkSearch}&rdquo;.</div>
              ) : (
                matches.map(t => {
                  const isCurrent = t.id === link?.repTeamId;
                  const meta = [t.division, t.sport].filter(Boolean).join(' · ');
                  return (
                    <button key={t.id} type="button" className={styles.repLinkItem}
                      onClick={() => handleLinkRepTeam(team.id, t.id)} disabled={busy || isCurrent}>
                      <span className={styles.repLinkItemText}>
                        <span className={styles.repLinkItemName}>{t.name}</span>
                        {meta && <span className={styles.repLinkItemMeta}>{meta}</span>}
                      </span>
                      <span className={isCurrent ? styles.repLinkItemCurrent : styles.repLinkItemPick}>
                        {isCurrent ? 'Linked' : 'Link →'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className={styles.repLinkPopFoot}>
              <span>{matches.length} of {repTeams.length} team{repTeams.length === 1 ? '' : 's'}</span>
              <button type="button" className={styles.repLinkPopClose} onClick={() => setRepLinkPickerId(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
    return { name: link?.repTeamName || null, control, closePicker: () => setRepLinkPickerId(null) };
  }

  // ── The team's record (T3): the list's order is the foot's order ──
  const openIndex = openTeamId ? order.findIndex(t => t.id === openTeamId) : -1;
  const openTeam = openTeamId ? (order[openIndex] ?? regs.find(r => r.id === openTeamId) ?? null) : null;
  const openSlotOfTeam = openTeam ? slotOf.get(openTeam.id) ?? null : null;
  const slotFill = slotConfigured ? { filled: poolSlots.filter(x => x.teamId).length, total: poolSlots.length } : null;

  const divisionChoices = divisions.map(g => ({ id: g.id, name: g.name, waiting: reviewByDivision.get(g.id) ?? 0 }));
  const showRandomize = !isLocked && (slotConfigured || (poolAssignable && poolsForDivision.length > 1));
  const showViewTools = slotsReady;
  const questionsHref = !isLocked && currentOrg && hasPlanFeature(currentOrg.planId, 'custom_registration_fields')
    ? `/${currentOrg.slug}/admin/tournaments/settings/registration-fields?from=registrations`
    : null;
  const canSelectMany = !isLocked && order.length > 0;
  const canSwap = !isLocked && onSlotBoard;
  const hasTools = canSelectMany || canSwap || showRandomize || Boolean(questionsHref);
  const bulkBar = (
    <div className={styles.bulkBar} role="toolbar" aria-label="Actions for the selected teams">
      <div className={styles.bulkLine}>
        <button type="button" className={styles.bulkBtn} onClick={() => runBulkAction('accept')} disabled={working === 'bulk'}>{TEAMS_WORDS.accept}</button>
        <button type="button" className={styles.bulkBtn} onClick={() => runBulkAction('waitlist')} disabled={working === 'bulk'}>{TEAMS_WORDS.bulkWaitlist}</button>
        <span className={styles.bulkGap} aria-hidden />
        <button type="button" className={`${styles.bulkBtn} ${styles.bulkQuiet}`} onClick={() => runBulkAction('reject')} disabled={working === 'bulk'}>{TEAMS_WORDS.bulkReject}</button>
      </div>
      <div className={styles.bulkLine}>
        <button type="button" className={styles.bulkBtn} onClick={() => runBulkAction('mark_deposit_paid')} disabled={working === 'bulk'}>{TEAMS_WORDS.depositPaid}</button>
        <button type="button" className={styles.bulkBtn} onClick={() => runBulkAction('mark_paid')} disabled={working === 'bulk'}>{TEAMS_WORDS.paidInFull}</button>
        {paymentToolsAvailable && (
          <button type="button" className={styles.bulkBtn} onClick={() => setShowReminderModal(true)} disabled={working === 'payment-reminders'}>{TEAMS_WORDS.sendReminder}</button>
        )}
        {poolAssignable && (
          <select
            className={`${styles.bulkBtn} ${styles.bulkSelect}`}
            value=""
            disabled={working === 'bulk'}
            onChange={e => {
              const v = e.target.value;
              if (!v) return;
              moveSelectedToPool(v === '__unassigned__' ? '' : v);
            }}
            aria-label="Move the selected teams to a pool"
          >
            <option value="">{TEAMS_WORDS.moveToPool}</option>
            {poolsForDivision.map(p => (
              <option key={p.id} value={p.id}>{formatPoolName(p.name)}</option>
            ))}
            <option value="__unassigned__">{TEAMS_WORDS.noPoolYet}</option>
          </select>
        )}
      </div>
    </div>
  );

  return (
    <div className={`${s.page} ${styles.teamsPage}`} data-selecting={selectionModeActive && selectedRegistrationIds.size > 0 ? '' : undefined}>
      <TournamentAdminHeader
        icon={<Users size={20} />}
        title="Teams"
        mobileActionsInline
        locked={isLocked}
        help={{
          module: 'tournaments',
          sectionIds: ['registrations-and-teams', 'recipe-review-tournament-teams', 'assign-teams-to-pools'],
          fullGuideHref: currentOrg ? `/${currentOrg.slug}/admin/help/tournaments#registrations-and-teams` : undefined,
        }}
        actions={(
          <>
            <ExportMenu
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
              importHint={
                currentOrg && !hasPlanFeature(currentOrg.planId, 'bulk_data_imports')
                  ? 'Tournament Plus imports and registration exports'
                  : 'Templates, imports, and bulk exports'
              }
            />
            {!isLocked && ownTeam && !ownTeam.registrationId && (
              <button
                className={`btn btn-ghost btn-data ${screenParts.headerButton}`}
                onClick={openOwnTeamModal}
                disabled={!currentTournament}
                aria-label={`Add ${ownTeam.teamName} to this tournament`}
                title="Add my team"
              >
                <Star size={15} aria-hidden />
                <span className={screenParts.headerButtonLabel}>Add my team</span>
              </button>
            )}
            {!isLocked && (
              <button
                className={`btn btn-lime btn-data ${screenParts.headerButton}`}
                onClick={openAddTeamModal}
                disabled={!currentTournament}
                aria-label="Add team"
                title="Add team"
              >
                <Plus size={15} aria-hidden />
                <span className={screenParts.headerButtonLabel}>Add team</span>
              </button>
            )}
          </>
        )}
      />

      {errorMsg && (
        <Callout tone="bad" role="alert" icon={<AlertCircle size={16} aria-hidden />}>
          <span>{errorMsg}</span>{' '}
          <button type="button" className={styles.inlineLink} onClick={() => load()}>Try again</button>
        </Callout>
      )}

      {/* ── One toolbar line (T1) — replaced by the mode's note while swapping or selecting (T4, A17) ── */}
      {listMode === 'swap' ? (
        <Callout role="status">
          <div className={styles.modeNote}>
            <span>{swapFirstSlotId
              ? TEAMS_WORDS.swapChosen(poolSlots.find(x => x.id === swapFirstSlotId)?.teamName ?? poolSlots.find(x => x.id === swapFirstSlotId)?.displayName ?? '')
              : TEAMS_WORDS.swapNote}</span>
            <button ref={modeDoneRef} type="button" className={styles.modeDone} onClick={() => { setSwapMode(false); setSwapFirstSlotId(null); }}>{TEAMS_WORDS.done}</button>
          </div>
        </Callout>
      ) : listMode === 'select' ? (
        <div className={styles.selectHead}>
          <Callout role="status">
            <div className={styles.modeNote}>
              <span className={styles.modeCount}>{TEAMS_WORDS.selected(selectedRegistrationIds.size)}</span>
              <button type="button" className={styles.inlineLink}
                onClick={() => setSelectedRegistrationIds(allVisibleSelected ? new Set() : new Set(visibleSelectableIds))}>
                {allVisibleSelected ? TEAMS_WORDS.clearVisible : TEAMS_WORDS.selectVisible}
              </button>
              <button ref={modeDoneRef} type="button" className={styles.modeDone} onClick={clearRegistrationSelection}>{TEAMS_WORDS.done}</button>
            </div>
          </Callout>
          {/* At a desk the bulk actions sit under the note; on a phone they dock above the bar (below). */}
          {selectedRegistrationIds.size > 0 && <div className={styles.bulkInline}>{bulkBar}</div>}
        </div>
      ) : (
        <div className={styles.toolbar}>
          <DivisionPicker divisions={divisionChoices} value={selectedDivisionId} onChange={chooseDivision} />
          {showViewTools && (
            <div className={styles.deskFilters}>
              <label className={styles.searchField}>
                <Search size={14} aria-hidden />
                <span className="sr-only">{TEAMS_WORDS.search}</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${TEAMS_WORDS.search}…`} />
              </label>
              <TeamsFilterMenu
                statuses={(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(st => ({
                  key: st,
                  label: APPROVAL_STATUS_LABEL[st],
                  count: divRegs.filter(r => r.status === st).length,
                }))}
                selectedStatuses={selectedStatuses}
                statusesNarrowed={!(selectedStatuses.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(x => selectedStatuses.includes(x)))}
                onToggleStatus={st => setSelectedStatuses(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}
                payments={paymentToolsAvailable ? (['unpaid', 'deposit-paid', 'paid', 'past-due'] as ActivePaymentFilter[]).map(p => ({
                  key: p,
                  label: PAYMENT_FILTER_LABEL[p],
                  count: divRegs.filter(r => r.status === 'accepted' && matchesPaymentFilter(computePaymentStatus(r, feeOf(r), today), p)).length,
                })) : null}
                selectedPayments={paymentFilters}
                onTogglePayment={p => setPaymentFilters(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                grouping={poolAssignable ? viewMode : null}
                onGrouping={setViewMode}
                onReset={() => { setSelectedStatuses(DEFAULT_STATUSES); setPaymentFilters([]); }}
              />
            </div>
          )}
          <span className={styles.toolbarSpacer} aria-hidden />
          {showViewTools && (
            <>
              <button type="button" className={`${styles.tool} ${styles.phoneTool}`} onClick={() => setSearchOpen(o => !o)}
                aria-expanded={searchOpen || search !== ''} aria-label={TEAMS_WORDS.search} data-on={search !== '' || undefined}>
                <Search size={18} aria-hidden />
              </button>
              <button type="button" className={`${styles.tool} ${styles.phoneTool}`} onClick={() => setMobileSettingsOpen(true)}
                aria-label={TEAMS_WORDS.filter} data-on={hasNonDefaultFilters || undefined}>
                <SlidersHorizontal size={18} aria-hidden />
              </button>
            </>
          )}
          {/* Tools: what an event uses a few times, grouped by what it acts on, each only where it
              applies (Swap needs the whole board; Randomize two pools or numbered spots; Registration
              questions Tournament Plus). At a desk a menu; on a phone the ⋯ square opens it as a sheet
              over the bar's top, the practice plan's toolbar form (E1). */}
          {hasTools && (
            <CoachToolbarMenu
              label={TEAMS_WORDS.tools}
              icon={working === 'randomizing'
                ? <RefreshCw size={18} className="spin" aria-hidden />
                : <MoreHorizontal size={18} className={styles.toolsGlyph} aria-hidden />}
              disabled={working === 'randomizing'}
              collapseOnPhone
              bareOnPhone
              drawerOnPhone
              drawerTitle={TEAMS_WORDS.tools}
              triggerClassName={styles.tool}
            >
              {canSelectMany && (
                <>
                  <CoachToolbarMenuHeading>{TEAMS_WORDS.toolsTeams}</CoachToolbarMenuHeading>
                  <CoachToolbarMenuItem icon={<ListChecks size={16} aria-hidden />} label={TEAMS_WORDS.selectMany} onSelect={() => setMultiSelectMode(true)} />
                </>
              )}
              {(canSwap || showRandomize) && (
                <>
                  <CoachToolbarMenuHeading>{TEAMS_WORDS.toolsPools}</CoachToolbarMenuHeading>
                  {canSwap && (
                    <CoachToolbarMenuItem icon={<ArrowLeftRight size={16} aria-hidden />} label={TEAMS_WORDS.swap}
                      onSelect={() => { setSwapMode(true); setSwapFirstSlotId(null); }} />
                  )}
                  {showRandomize && (
                    <CoachToolbarMenuItem icon={<Shuffle size={16} aria-hidden />} label={TEAMS_WORDS.randomize} disabled={loading}
                      onSelect={() => void (slotConfigured ? randomizeSlots() : randomizePools())} />
                  )}
                </>
              )}
              {questionsHref && (
                <>
                  <CoachToolbarMenuHeading>{TEAMS_WORDS.toolsSetup}</CoachToolbarMenuHeading>
                  <CoachToolbarMenuItem icon={<ClipboardList size={16} aria-hidden />} label={TEAMS_WORDS.registrationQuestions}
                    href={questionsHref} />
                </>
              )}
            </CoachToolbarMenu>
          )}
        </div>
      )}
      {listMode === 'normal' && showViewTools && (searchOpen || search !== '') && (
        <label className={`${styles.searchField} ${styles.phoneSearch}`}>
          <Search size={14} aria-hidden />
          <span className="sr-only">{TEAMS_WORDS.search}</span>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={`${TEAMS_WORDS.search}…`} />
          {search !== '' && (
            <button type="button" className={styles.searchClear} onClick={() => { setSearch(''); setSearchOpen(false); }} aria-label="Clear the search">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
      )}

      {/* ── At a glance (T1) ── */}
      {currentTournament && listMode === 'normal' && (
        <TeamsGlance
          health={!isLocked ? (
            <RegistrationHealthPanel
              metrics={registrationHealth}
              capacityTotal={registrationHealthCapacity.capacityTotal}
              capacityAccepted={registrationHealthCapacity.capacityAccepted}
              onJumpToBucket={key => focusAttentionBucket(key)}
              onJumpToCapacity={jumpToDivision}
              onUpgrade={showCommandCenterUpgrade}
            />
          ) : null}
          payments={paymentToolsAvailable && selectedGroup && !isLocked && paymentSummary.scheduled > 0
            ? { divisionName: selectedGroup.name, summary: paymentSummary, fee: feeOf({ division_id: selectedGroup.id }), today }
            : null}
          registration={selectedGroup && !isLocked ? {
            divisionName: selectedGroup.name,
            accepted: paymentSummary.accepted,
            capacity: selectedGroup.capacity ?? null,
            closed: Boolean(selectedGroup.isClosed),
            busy: closingDivision,
            onToggle: handleToggleRegistration,
          } : null}
        />
      )}

      {/* ── The attention banner (a dashboard link or a health line) — this division's count, and where
          the rest are (F41: it used to say "(2)" over one row) ── */}
      {activeAttentionKey && activeAttentionBucket && (() => {
        const here = activeAttentionBucket.divisionCounts?.find(d => d.divisionId === selectedDivisionId)?.count ?? 0;
        const elsewhere = Math.max(activeAttentionBucket.count - here, 0);
        const label = activeAttentionKey === 'pending_review' ? TEAMS_WORDS.toReview : activeAttentionBucket.label;
        return (
          <Callout role="status" icon={<AlertCircle size={16} aria-hidden />}>
            <div className={styles.modeNote}>
              <span>
                <b>{activeAttentionLocked ? `${label} — Tournament Plus` : TEAMS_WORDS.attentionHere(label, here, selectedGroup?.name ?? '')}</b>
                {!activeAttentionLocked && elsewhere > 0 && <span className={styles.modeSub}>{TEAMS_WORDS.attentionElsewhere(elsewhere)}</span>}
                {activeAttentionLocked && <span className={styles.modeSub}>{activeAttentionBucket.description}</span>}
              </span>
              {activeAttentionLocked && <Link href={planHref} className={styles.modeDone}>{TEAMS_WORDS.upgrade}</Link>}
              <button type="button" className={styles.modeDone} onClick={clearAttentionFocus}>{TEAMS_WORDS.clear}</button>
            </div>
          </Callout>
        );
      })()}

      {/* ── The division's teams (T2, T4, T6) ── */}
      {!hasLoadedInitial || (divisions.length > 0 && !slotsReady) ? (
        <p className={styles.quiet}>Loading…</p>
      ) : !currentTournament ? (
        <p className={styles.quiet}>No tournament selected.</p>
      ) : divisions.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>No divisions set up yet.</p>
          {!isLocked && currentOrg && (
            <Link href={`/${currentOrg.slug}/admin/tournaments/divisions`} className="btn btn-outline">Set up divisions</Link>
          )}
        </div>
      ) : bands.length === 0 ? (
        <div className={styles.emptyCard}>
          {divRegs.length === 0 ? (
            <>
              <p>No teams have registered yet.</p>
              {!isLocked && ownTeam && !ownTeam.registrationId && (
                <button type="button" className="btn btn-outline" onClick={openOwnTeamModal}>Add my team</button>
              )}
            </>
          ) : (
            <>
              <p>No teams match the current filters.</p>
              {(hasNonDefaultFilters || search) && (
                <button type="button" className="btn btn-outline" onClick={() => { clearAttentionFocus(); setSearch(''); }}>Clear filters</button>
              )}
            </>
          )}
        </div>
      ) : (
        <TeamList
          bands={bands}
          mode={listMode}
          placeColumn={slotConfigured ? 'Slot' : poolAssignable ? 'Pool' : null}
          facts={rowFacts}
          selectedIds={selectedRegistrationIds}
          swapFirstSlotId={swapFirstSlotId}
          onOpen={id => setOpenTeamId(id)}
          onToggle={toggleRegistrationSelection}
          onSwap={id => void handleSwapSlots(id)}
        />
      )}

      {/* On a phone the bulk actions DOCK above the bar while selecting (D8), so they stay reachable at
          the foot of a thirty-team list. */}
      {listMode === 'select' && selectedRegistrationIds.size > 0 && <div className={styles.bulkDock}>{bulkBar}</div>}

      {/* ── The view sheet (phone): status and payment filters, the grouping where a division has pools ── */}
      {/* The shared admin sheet: backdrop, handle, Escape, scroll-lock and the safe area are its. */}
      <BottomSheet
        open={mobileSettingsOpen}
        onClose={() => setMobileSettingsOpen(false)}
        ariaLabel={TEAMS_WORDS.filter}
        footer={<button type="button" className={styles.sheetDone} onClick={() => setMobileSettingsOpen(false)}>Done</button>}
      >
              {poolAssignable && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>{TEAMS_WORDS.groupBy}</div>
                  <div className={styles.sheetSegments}>
                    {(['pools', 'flat'] as const).map(v => (
                      <button key={v} type="button" className={styles.sheetSeg} aria-pressed={viewMode === v} onClick={() => setViewMode(v)}>
                        {v === 'pools' ? 'Pools' : 'Status'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.sheetSection}>
                <div className={styles.sheetSectionLabel}>Registration status</div>
                <div className={styles.sheetSegments}>
                  {(['pending', 'accepted', 'waitlist', 'rejected'] as Status[]).map(st => (
                    <button key={st} type="button" className={styles.sheetSeg} aria-pressed={selectedStatuses.includes(st)}
                      onClick={() => setSelectedStatuses(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}>
                      {APPROVAL_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>

              {paymentToolsAvailable && (
                <div className={styles.sheetSection}>
                  <div className={styles.sheetSectionLabel}>Payment status</div>
                  <div className={`${styles.sheetSegments} ${styles.sheetSegmentsWrap}`}>
                    {(['unpaid', 'deposit-paid', 'paid', 'past-due'] as ActivePaymentFilter[]).map(f => (
                      <button key={f} type="button" className={styles.sheetSeg} aria-pressed={paymentFilters.includes(f)}
                        onClick={() => setPaymentFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}>
                        {PAYMENT_FILTER_LABEL[f]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasNonDefaultFilters && (
                <button type="button" className={styles.sheetReset}
                  onClick={() => { setSelectedStatuses(DEFAULT_STATUSES); setPaymentFilters([]); }}>
                  {TEAMS_WORDS.resetFilters}
                </button>
              )}
      </BottomSheet>

      {/* ── The team's record (T3) ── */}
      {openTeam && selectedGroup && (
        <TeamRecordWindow
          team={openTeam}
          divisionName={selectedGroup.name}
          slot={openSlotOfTeam}
          poolName={poolNameOf(openTeam, openSlotOfTeam)}
          fee={feeOf(openTeam)}
          today={today}
          canWrite={!isLocked}
          showSeed={hasPlayoffs(currentTournament ?? undefined)}
          poolChoices={poolAssignable ? poolsForDivision : null}
          slotDivision={slotConfigured}
          slotFill={slotFill}
          openSpot={openSlot != null}
          canPlace={waitlistAutomationAvailable}
          planHref={planHref}
          isOwnTeam={ownTeam?.registrationId === openTeam.id}
          repLink={orgHasRepTeams ? renderRepLinkControl(openTeam, working === openTeam.id) : null}
          prev={openIndex > 0 ? order[openIndex - 1] : null}
          next={openIndex >= 0 && openIndex < order.length - 1 ? order[openIndex + 1] : null}
          position={openIndex >= 0 ? `${openIndex + 1} of ${order.length}` : ''}
          positionWide={openIndex >= 0 ? TEAM_RECORD_WORDS.positionWide(`${openIndex + 1} of ${order.length}`, selectedGroup.name) : ''}
          busy={working === openTeam.id || working === 'bulk'}
          onStep={id => setOpenTeamId(id)}
          onClose={() => setOpenTeamId(null)}
          onSave={saveTeam}
          onAccept={acceptTeam}
          onReject={rejectTeam}
          onPromote={handlePromote}
          onMarkPaid={team => patch(team.id, { paymentStatus: 'paid' })}
          onMarkUnpaid={team => patch(team.id, { paymentStatus: 'pending' })}
          onResend={resendAccessLink}
          onDelete={handleDelete}
        />
      )}

      {/* Add my team — the host's own team, already connected to the portal (no name, coach or
          email to type: the portal holds every one of those). The registration is written as the
          head coach whoever clicks, and the entry lands on the coach Tournaments page at once. */}
      {showOwnTeamModal && ownTeam && (
        <div className="modal-overlay" onClick={() => setShowOwnTeamModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add {ownTeam.teamName} to this tournament</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setShowOwnTeamModal(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddOwnTeam}>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select className="form-select" value={ownTeamForm.divisionId} onChange={e => setOwnTeamForm(f => ({ ...f, divisionId: e.target.value }))} required>
                    {divisions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={ownTeamForm.paymentStatus} onChange={e => setOwnTeamForm(f => ({ ...f, paymentStatus: e.target.value as 'paid' | 'pending' }))}>
                    <option value="paid">Paid</option>
                    <option value="pending">Unpaid</option>
                  </select>
                </div>
              </div>
              <p className={styles.ownTeamHint}>
                Registered under your head coach. It shows on your team&rsquo;s Tournaments page right away.
              </p>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={() => setShowOwnTeamModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-lime btn-data" disabled={!!working || !ownTeamForm.divisionId}>Add my team</button>
              </div>
            </form>
          </div>
        </div>
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
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                    onBlur={e => checkCoachAccount(e.target.value)}
                    required={addForm.notifyTeam} />
                  {coachAccount && coachAccount.email === addForm.email.trim().toLowerCase() && coachAccount.state !== 'unknown' && (
                    <p className={`${styles.coachAccountLine} ${coachAccount.state === 'known' ? styles.coachAccountKnown : ''}`} role="status">
                      {coachAccount.state === 'known'
                        ? 'This coach is on FieldLogicHQ. The notification is on — they’ll see this entry in their portal the moment they accept.'
                        : 'When you notify them, this email becomes their sign-in and the entry lands in their free Coaches Portal.'}
                    </p>
                  )}
                </div>
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
                <button type="submit" className="btn btn-lime btn-data" disabled={!!working}>Save Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReminderModal && (
        <KitDialog
          kind="form"
          title="Send payment reminders"
          onClose={() => setShowReminderModal(false)}
          busy={working === 'payment-reminders'}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setShowReminderModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-lime"
                onClick={sendPaymentReminders}
                disabled={working === 'payment-reminders' || paymentInstructions.trim().length === 0}
              >
                {working === 'payment-reminders' ? 'Sending…' : 'Send reminders'}
              </button>
            </>
          )}
        >
          <Callout role="note" flush>
            {selectedRegistrationIds.size} selected. Reminders are sent only to accepted teams with an outstanding amount.
          </Callout>
          <label className={`${ck.field} ${styles.reminderField}`}>
            <span className={ck.label}>Payment instructions</span>
            <textarea
              className={ck.textarea}
              value={paymentInstructions}
              onChange={e => setPaymentInstructions(e.target.value)}
              rows={6}
              placeholder="E-transfer, cheque, or payment-link instructions..."
            />
          </label>
        </KitDialog>
      )}

      {/* Every question and notice on this screen — the kit's question window, stacked over the record. */}
      {feedback && (
        <KitDialog
          kind="question"
          title={feedback.title}
          onClose={() => setFeedback(null)}
          footer={feedback.onConfirm ? (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setFeedback(null)}>Cancel</button>
              <button
                type="button"
                className={`btn ${feedback.type === 'danger' ? 'btn-danger' : 'btn-lime'}`}
                onClick={() => { const run = feedback.onConfirm!; setFeedback(null); run(); }}
              >
                {feedback.confirmText ?? 'Confirm'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => setFeedback(null)}>Close</button>
          )}
        >
          {feedback.message && <p>{feedback.message}</p>}
          {feedback.items && feedback.items.length > 0 && (
            <ul className={styles.askItems}>
              {feedback.items.map((item, i) => (
                <li key={i}>
                  <span>{item.label}</span>
                  {item.note && <span className={styles.askNote}>{item.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </KitDialog>
      )}
    </div>
  );
}

type FilterChoice<K extends string> = { key: K; label: string; count: number };

/**
 * The desk's ONE Filter menu (the Teams toolbar ruling, owner 2026-10-01): Status, Payment and, where
 * the division has pools to group by, Group by — under one button in every division, a pool board's
 * too. The phone's Filter square opens the same three as a sheet. The ticks are checkboxes, so the menu
 * stays open while they change; the button counts the filters on (Group by arranges the list, it
 * filters nothing, so it is not counted).
 */
function TeamsFilterMenu({
  statuses,
  selectedStatuses,
  statusesNarrowed,
  onToggleStatus,
  payments,
  selectedPayments,
  onTogglePayment,
  grouping,
  onGrouping,
  onReset,
}: {
  statuses: FilterChoice<Status>[];
  selectedStatuses: Status[];
  statusesNarrowed: boolean;
  onToggleStatus: (key: Status) => void;
  /** Null where payments are not tracked (the Tournament plan) — the section is absent. */
  payments: FilterChoice<ActivePaymentFilter>[] | null;
  selectedPayments: ActivePaymentFilter[];
  onTogglePayment: (key: ActivePaymentFilter) => void;
  /** Null without pools to group by — the section is absent. */
  grouping: 'pools' | 'flat' | null;
  onGrouping: (value: 'pools' | 'flat') => void;
  onReset: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // A click away just closes; Escape hands focus back to the button (the keyboard is still driving).
  useDismissable(open, rootRef, () => setOpen(false), () => { setOpen(false); triggerRef.current?.focus(); });

  // `role="menu"` promises the arrows: open lands on the first row, Up / Down / Home / End move between
  // rows (the division picker's pattern), and the rows are not Tab stops of their own.
  const ITEM = '[role^="menuitem"]';
  React.useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>(ITEM)?.focus();
  }, [open]);
  const onPanelKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(ITEM) ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
        : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  const on = (statusesNarrowed ? 1 : 0) + (selectedPayments.length > 0 ? 1 : 0);
  const row = (key: string, label: string, checked: boolean, onPick: () => void, count?: number, radio = false) => (
    <button
      key={key}
      type="button"
      className={styles.regFilterOption}
      data-on={checked || undefined}
      onClick={onPick}
      role={radio ? 'menuitemradio' : 'menuitemcheckbox'}
      aria-checked={checked}
      tabIndex={-1}
    >
      <span className={styles.regFilterCheck}>{checked ? <Check size={12} aria-hidden /> : null}</span>
      <span className={styles.regFilterName}>{label}</span>
      {count !== undefined && <span className={styles.regFilterCount}>{count}</span>}
    </button>
  );

  return (
    <div className={styles.regFilterRoot} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.regFilterButton}
        data-active={on > 0 || undefined}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={on > 0 ? `${TEAMS_WORDS.filter}, ${TEAMS_WORDS.filtersOn(on)}` : TEAMS_WORDS.filter}
      >
        <SlidersHorizontal size={14} aria-hidden />
        <span>{TEAMS_WORDS.filter}</span>
        {on > 0 && <span className={styles.filterOn} aria-hidden>{on}</span>}
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div ref={panelRef} className={`${styles.regFilterPanel} ${styles.filterPanel}`} role="menu" aria-label={TEAMS_WORDS.filter} onKeyDown={onPanelKey}>
          <div className={styles.regFilterHeader}><span>{TEAMS_WORDS.filterStatus}</span></div>
          <div className={styles.regFilterList}>
            {statuses.map(o => row(o.key, o.label, selectedStatuses.includes(o.key), () => onToggleStatus(o.key), o.count))}
          </div>
          {payments && (
            <>
              <div className={styles.regFilterHeader}><span>{TEAMS_WORDS.filterPayment}</span></div>
              <div className={styles.regFilterList}>
                {payments.map(o => row(o.key, o.label, selectedPayments.includes(o.key), () => onTogglePayment(o.key), o.count))}
              </div>
            </>
          )}
          {grouping && (
            <>
              <div className={styles.regFilterHeader}><span>{TEAMS_WORDS.groupBy}</span></div>
              <div className={styles.regFilterList}>
                {(['pools', 'flat'] as const).map(v => row(v, v === 'pools' ? TEAMS_WORDS.toolsPools : TEAMS_WORDS.filterStatus, grouping === v, () => onGrouping(v), undefined, true))}
              </div>
            </>
          )}
          {on > 0 && (
            <button type="button" role="menuitem" tabIndex={-1} className={styles.filterReset} onClick={() => { onReset(); setOpen(false); triggerRef.current?.focus(); }}>
              <X size={12} aria-hidden /> {TEAMS_WORDS.resetFilters}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
