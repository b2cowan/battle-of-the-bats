'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings2, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import FeedbackModal from '@/components/FeedbackModal';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { DEFAULT_ROSTER_WAIVER_TEXT, ROSTER_WAIVER_TEXT_MAX_LENGTH } from '@/lib/roster-requirements';
import type { GameTimingScope, TieBreakerScope, FeeScope, TournamentStatus, TournamentFormat } from '@/lib/types';
import TieBreakerEditor from '@/components/admin/TieBreakerEditor';
import { normalizeTieBreakers, clampRunDiffCap, DEFAULT_TIE_BREAKERS, type TieBreaker } from '@/lib/tie-breakers';
import { CANADIAN_PROVINCES } from '@/lib/canadian-provinces';
import styles from '../../branding/branding.module.css';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface OrgMemberOption {
  id: string;
  email: string;
  displayName: string | null;
  title: string | null;
  role: string;
}

type ScorePolicyMode = 'review' | 'final';

function scorePolicyModeFromValue(value: boolean | null | undefined): ScorePolicyMode {
  return value === false ? 'final' : 'review';
}

function scorePolicyValue(mode: ScorePolicyMode): boolean {
  return mode === 'review';
}

function feeScopeToScheduleMode(scope: FeeScope | null): 'tournament' | 'division' {
  return scope === 'per_division' ? 'division' : 'tournament';
}

export default function TournamentEventSettingsPage() {
  const { currentTournament, refresh: refreshTournaments } = useTournament();
  const { currentOrg, userRole } = useOrg();
  const router = useRouter();
  usePageTitle('Event Settings');

  // Tournament identity
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentYear, setTournamentYear] = useState(new Date().getFullYear());
  const [tournamentSlug, setTournamentSlug] = useState('');
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>('draft');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const slugCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Organization public address (org slug) — the account-wide URL prefix shared by all
  // of this org's tournaments. Tournament tiers can't reach Org Settings (standalone-tier
  // rule), so the owner reviews/edits it here. Separate from the per-tournament slug above.
  const [orgSlugInput, setOrgSlugInput] = useState('');
  const [orgSlugSaving, setOrgSlugSaving] = useState(false);
  const [orgSlugError, setOrgSlugError] = useState('');
  const [orgSlugConfirmOpen, setOrgSlugConfirmOpen] = useState(false);

  // Dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fee scope
  const [feeScope, setFeeScope] = useState<FeeScope | null>(null);
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('round_robin_playoffs');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDueDate, setDepositDueDate] = useState('');
  const [totalFeeAmount, setTotalFeeAmount] = useState('');
  const [totalFeeDueDate, setTotalFeeDueDate] = useState('');
  // Public registration payment display
  const [showFeesOnRegister, setShowFeesOnRegister] = useState(true);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [paymentInstructionsOnForm, setPaymentInstructionsOnForm] = useState(false);

  // Game timing
  const [gameTimingScope, setGameTimingScope] = useState<GameTimingScope | null>('tournament');
  const [gameDurationMinutes, setGameDurationMinutes] = useState(90);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [venueMoveBufferMinutes, setVenueMoveBufferMinutes] = useState(0);
  const [facilityMoveBufferMinutes, setFacilityMoveBufferMinutes] = useState(0);

  // Tie-breakers
  const [tieBreakerScope, setTieBreakerScope] = useState<TieBreakerScope | null>('tournament');
  const [tieBreakers, setTieBreakers] = useState<TieBreaker[]>([...DEFAULT_TIE_BREAKERS]);
  // Max run differential per game (raw input string; '' = no cap).
  const [runDiffCap, setRunDiffCap] = useState('');

  // Scoring
  const [scorePolicyMode, setScorePolicyMode] = useState<ScorePolicyMode>('review');
  const [notifyTeamsOnComplete, setNotifyTeamsOnComplete] = useState(false);
  const [resultsNotifiedAt, setResultsNotifiedAt] = useState<string | null>(null);
  const [resultsNotificationSentCount, setResultsNotificationSentCount] = useState(0);

  // Automatic coach emails (per-tournament; default on so existing events are unchanged)
  const [coachEmailConfirmation, setCoachEmailConfirmation] = useState(true);
  const [coachEmailAcceptance, setCoachEmailAcceptance] = useState(true);
  const [coachEmailRejection, setCoachEmailRejection] = useState(true);
  const [coachEmailPayment, setCoachEmailPayment] = useState(true);
  const [coachEmailSchedule, setCoachEmailSchedule] = useState(true);
  const [coachEmailGameDay, setCoachEmailGameDay] = useState(true);
  // Master kill-switch (5n) — pause ALL automatic coach emails (default off).
  const [coachEmailPauseAll, setCoachEmailPauseAll] = useState(false);

  // Roster requirements (Phase 5f; default all-off so existing events require nothing).
  // Min/max are kept as strings for the inputs — '' = no limit (saved as null).
  const [rosterRequire, setRosterRequire] = useState(false);
  const [rosterRequireDob, setRosterRequireDob] = useState(false);
  const [rosterRequireJersey, setRosterRequireJersey] = useState(false);
  const [rosterRequireWaiver, setRosterRequireWaiver] = useState(false);
  const [rosterWaiverText, setRosterWaiverText] = useState('');
  const [rosterMinPlayers, setRosterMinPlayers] = useState('');
  const [rosterMaxPlayers, setRosterMaxPlayers] = useState('');

  // Contact
  const [defaultContactMemberId, setDefaultContactMemberId] = useState<string | null>(null);
  const [notifyMode, setNotifyMode] = useState<'all' | 'assigned'>('all');
  // Contact visibility per audience — default on so existing events are unchanged (migration 120)
  const [contactShowToCoaches, setContactShowToCoaches] = useState(true);
  const [contactShowOnPublic, setContactShowOnPublic] = useState(true);
  // Public discovery directory opt-in (migration 158) — default OFF (privacy-safe).
  const [listInDirectory, setListInDirectory] = useState(false);
  const [directoryProvince, setDirectoryProvince] = useState('');
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [ownerMember, setOwnerMember] = useState<OrgMemberOption | null>(null);

  // Saved-state snapshot (for dirty tracking and auto-save slug/status guards)
  const [saved, setSaved] = useState({
    name: '', year: new Date().getFullYear(), slug: '', status: 'draft' as TournamentStatus,
    startDate: '', endDate: '',
    format: 'round_robin_playoffs' as TournamentFormat,
    feeScope: null as FeeScope | null,
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
    showFeesOnRegister: true, paymentInstructions: '', paymentInstructionsOnForm: false,
    gameTimingScope: 'tournament' as GameTimingScope | null,
    gameDurationMinutes: 90,
    bufferMinutes: 15,
    venueMoveBufferMinutes: 0,
    facilityMoveBufferMinutes: 0,
    tieBreakerScope: 'tournament' as TieBreakerScope | null,
    tieBreakers: [...DEFAULT_TIE_BREAKERS] as TieBreaker[],
    runDiffCap: '',
    scorePolicyMode: 'review' as ScorePolicyMode,
    notifyTeamsOnComplete: false,
    coachEmailConfirmation: true,
    coachEmailAcceptance: true,
    coachEmailRejection: true,
    coachEmailPayment: true,
    coachEmailSchedule: true,
    coachEmailGameDay: true,
    coachEmailPauseAll: false,
    rosterRequire: false,
    rosterRequireDob: false,
    rosterRequireJersey: false,
    rosterRequireWaiver: false,
    rosterWaiverText: '',
    rosterMinPlayers: '',
    rosterMaxPlayers: '',
    defaultContactMemberId: null as string | null,
    notifyMode: 'all' as 'all' | 'assigned',
    contactShowToCoaches: true,
    contactShowOnPublic: true,
    listInDirectory: false,
    directoryProvince: '',
  });

  // Save lifecycle
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isInitialized, setIsInitialized] = useState(false);

  // Status confirm modal
  const [pendingStatusChange, setPendingStatusChange] = useState<TournamentStatus | null>(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  // Format change confirm (wipes the existing schedule)
  const [pendingFormat, setPendingFormat] = useState<TournamentFormat | null>(null);
  const [formatConfirmOpen, setFormatConfirmOpen] = useState(false);
  const [existingGameCount, setExistingGameCount] = useState(0);
  const [formatBusy, setFormatBusy] = useState(false);

  // Slug confirm modal
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);

  // Error feedback
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const tournamentId = currentTournament?.id;
  const canUsePostEventNotifications = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'post_tournament_summary'));
  const canUseRegistrationQuestions = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'custom_registration_fields'));
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const registrationFieldsHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/registration-fields`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const slugHasChanged = tournamentSlug !== saved.slug;

  // ── Data load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tournamentId) return;

    Promise.all([
      fetch(`/api/admin/tournaments${orgQuery}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : {}),
      fetch(`/api/admin/members${orgQuery}`).then(r => r.ok ? r.json() : []),
    ]).then(([tournaments, branding, members]) => {
      const t = Array.isArray(tournaments) ? tournaments.find((row: { id: string }) => row.id === tournamentId) : null;
      if (t) {
        const name = t.name ?? '';
        const year = typeof t.year === 'number' ? t.year : new Date().getFullYear();
        const slug = t.slug ?? '';
        const status = (t.status ?? 'draft') as TournamentStatus;
        const sd = t.start_date ?? '';
        const ed = t.end_date ?? '';
        const da = t.deposit_amount != null ? String(t.deposit_amount) : '';
        const dd = t.deposit_due_date ?? '';
        const tf = t.total_fee_amount != null ? String(t.total_fee_amount) : '';
        const td = t.total_fee_due_date ?? '';
        const notify = Boolean(t.notify_teams_on_complete);
        const contactId = t.default_contact_member_id ?? null;
        const nm = (t.notify_mode === 'assigned' ? 'assigned' : 'all') as 'all' | 'assigned';
        // Absent (legacy rows) means visible, matching the column default.
        const csCoaches = t.contact_show_to_coaches !== false;
        const csPublic = t.contact_show_on_public !== false;
        // Public directory opt-in (migration 158) — absent/false means unlisted.
        const listInDir = t.list_in_directory === true;
        const dirProvince = typeof t.directory_province === 'string' ? t.directory_province : '';
        const gd = typeof t.settings?.game_duration_minutes === 'number' ? t.settings.game_duration_minutes : 90;
        const buf = typeof t.settings?.buffer_minutes === 'number' ? t.settings.buffer_minutes : 15;
        const venueMoveBuf = typeof t.settings?.schedule_travel_venue_buffer_minutes === 'number' ? t.settings.schedule_travel_venue_buffer_minutes : 0;
        const facilityMoveBuf = typeof t.settings?.schedule_travel_facility_buffer_minutes === 'number' ? t.settings.schedule_travel_facility_buffer_minutes : 0;

        const fmt: TournamentFormat = t.settings?.format === 'playoff_only' ? 'playoff_only' : 'round_robin_playoffs';

        const rawFeeScope = t.settings?.fee_scope;
        const validFeeScopes = new Set<string>(['tournament', 'allow_override', 'per_division', 'free']);
        const fs: FeeScope | null = validFeeScopes.has(rawFeeScope)
          ? rawFeeScope as FeeScope
          : t.fee_schedule_mode === 'division' ? 'per_division'
          : t.fee_schedule_mode === 'tournament' ? 'tournament'
          : null;

        const showFees = t.settings?.show_fees_on_register !== false;
        const payInstr = typeof t.settings?.payment_instructions === 'string' ? t.settings.payment_instructions : '';
        const payInstrOnForm = t.settings?.payment_instructions_on_form === true;

        // Automatic coach emails — absent key means enabled (legacy behavior).
        const ceConfirm = t.settings?.coach_email_confirmation !== false;
        const ceAccept  = t.settings?.coach_email_acceptance !== false;
        const ceReject  = t.settings?.coach_email_rejection !== false;
        const cePay     = t.settings?.coach_email_payment !== false;
        const ceSchedule = t.settings?.coach_email_schedule !== false;
        const ceGameDay  = t.settings?.coach_email_game_day !== false;
        // Master pause — absent/false means NOT paused (opposite polarity).
        const cePauseAll = t.settings?.coach_email_pause_all === true;

        // Roster requirements — absent key means OFF (legacy events require nothing).
        const rosterReq    = t.settings?.roster_require === true;
        const rosterDob    = t.settings?.roster_require_dob === true;
        const rosterJersey = t.settings?.roster_require_jersey === true;
        const rosterWaiver = t.settings?.roster_require_waiver === true;
        const rosterWaiverTxt = typeof t.settings?.roster_waiver_text === 'string' ? t.settings.roster_waiver_text : '';
        const rosterMin    = typeof t.settings?.roster_min_players === 'number' ? String(t.settings.roster_min_players) : '';
        const rosterMax    = typeof t.settings?.roster_max_players === 'number' ? String(t.settings.roster_max_players) : '';

        const rawGTS = t.settings?.game_timing_scope;
        const validTimingScopes = new Set<string>(['tournament', 'allow_override', 'per_division']);
        const gts: GameTimingScope = validTimingScopes.has(rawGTS) ? rawGTS as GameTimingScope : 'tournament';

        const rawTBS = t.settings?.tie_breaker_scope;
        const tbs: TieBreakerScope = validTimingScopes.has(rawTBS) ? rawTBS as TieBreakerScope : 'tournament';

        const safeTb = normalizeTieBreakers(t.settings?.tie_breakers);
        const rawCap = t.settings?.max_run_diff_per_game;
        const rdCapStr = typeof rawCap === 'number' && rawCap > 0 ? String(rawCap) : '';

        setTournamentName(name);
        setTournamentYear(year);
        setTournamentSlug(slug);
        setTournamentStatus(status);
        setResultsNotifiedAt(t.results_notified_at ?? null);
        setResultsNotificationSentCount(t.results_notification_sent_count ?? 0);
        setStartDate(sd); setEndDate(ed);
        setTournamentFormat(fmt);
        setFeeScope(fs);
        setDepositAmount(da); setDepositDueDate(dd);
        setTotalFeeAmount(tf); setTotalFeeDueDate(td);
        setShowFeesOnRegister(showFees);
        setPaymentInstructions(payInstr);
        setPaymentInstructionsOnForm(payInstrOnForm);
        setGameTimingScope(gts);
        setGameDurationMinutes(gd);
        setBufferMinutes(buf);
        setVenueMoveBufferMinutes(venueMoveBuf);
        setFacilityMoveBufferMinutes(facilityMoveBuf);
        setTieBreakerScope(tbs);
        setTieBreakers(safeTb);
        setRunDiffCap(rdCapStr);
        setNotifyTeamsOnComplete(notify);
        setCoachEmailConfirmation(ceConfirm);
        setCoachEmailAcceptance(ceAccept);
        setCoachEmailRejection(ceReject);
        setCoachEmailPayment(cePay);
        setCoachEmailSchedule(ceSchedule);
        setCoachEmailGameDay(ceGameDay);
        setCoachEmailPauseAll(cePauseAll);
        setRosterRequire(rosterReq);
        setRosterRequireDob(rosterDob);
        setRosterRequireJersey(rosterJersey);
        setRosterRequireWaiver(rosterWaiver);
        setRosterWaiverText(rosterWaiverTxt);
        setRosterMinPlayers(rosterMin);
        setRosterMaxPlayers(rosterMax);
        setDefaultContactMemberId(contactId);
        setNotifyMode(nm);
        setContactShowToCoaches(csCoaches);
        setContactShowOnPublic(csPublic);
        setListInDirectory(listInDir);
        setDirectoryProvince(dirProvince);
        setSaved(s => ({
          ...s,
          name, year, slug, status,
          startDate: sd, endDate: ed,
          format: fmt,
          feeScope: fs,
          depositAmount: da, depositDueDate: dd, totalFeeAmount: tf, totalFeeDueDate: td,
          showFeesOnRegister: showFees, paymentInstructions: payInstr, paymentInstructionsOnForm: payInstrOnForm,
          gameTimingScope: gts, gameDurationMinutes: gd, bufferMinutes: buf,
          venueMoveBufferMinutes: venueMoveBuf, facilityMoveBufferMinutes: facilityMoveBuf,
          tieBreakerScope: tbs, tieBreakers: safeTb, runDiffCap: rdCapStr,
          notifyTeamsOnComplete: notify, defaultContactMemberId: contactId, notifyMode: nm,
          contactShowToCoaches: csCoaches, contactShowOnPublic: csPublic,
          listInDirectory: listInDir, directoryProvince: dirProvince,
          coachEmailConfirmation: ceConfirm, coachEmailAcceptance: ceAccept,
          coachEmailRejection: ceReject, coachEmailPayment: cePay,
          coachEmailSchedule: ceSchedule, coachEmailGameDay: ceGameDay,
          coachEmailPauseAll: cePauseAll,
          rosterRequire: rosterReq, rosterRequireDob: rosterDob,
          rosterRequireJersey: rosterJersey, rosterRequireWaiver: rosterWaiver,
          rosterWaiverText: rosterWaiverTxt,
          rosterMinPlayers: rosterMin, rosterMaxPlayers: rosterMax,
        }));
      }
      const policyMode = scorePolicyModeFromValue((branding as { requireScoreFinalization?: boolean | null }).requireScoreFinalization);
      setScorePolicyMode(policyMode);
      setSaved(s => ({ ...s, scorePolicyMode: policyMode }));

      const allMembers = Array.isArray(members) ? members : [];
      setOwnerMember(allMembers.find((m: OrgMemberOption) => m.role === 'owner') ?? null);
      const eligible = allMembers
        .filter((m: OrgMemberOption) => ['admin', 'staff'].includes(m.role))
        .sort((a: OrgMemberOption, b: OrgMemberOption) => {
          const roleOrder: Record<string, number> = { admin: 0, staff: 1 };
          const roleDiff = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
          if (roleDiff !== 0) return roleDiff;
          return (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email);
        });
      setOrgMembers(eligible);

      // Mark initialized AFTER data is loaded so auto-save doesn't fire on mount
      setIsInitialized(true);
    }).catch(() => { setErrorMsg('Failed to load settings'); setErrorOpen(true); });
  }, [tournamentId, orgParam, orgQuery]);

  // ── Slug availability check — debounced 400 ms ────────────────────────────

  useEffect(() => {
    if (!tournamentId) return;
    if (!tournamentSlug || tournamentSlug === saved.slug) {
      setSlugStatus('idle');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(tournamentSlug)) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    if (slugCheckRef.current) clearTimeout(slugCheckRef.current);
    slugCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check-slug', slug: tournamentSlug, excludeId: tournamentId }),
        });
        if (res.ok) {
          const d = await res.json();
          setSlugStatus(d.available ? 'available' : 'taken');
        } else {
          setSlugStatus('idle');
        }
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => { if (slugCheckRef.current) clearTimeout(slugCheckRef.current); };
  }, [tournamentSlug, tournamentId, orgQuery, saved.slug]);

  // Keep the org-address input in sync with the loaded org (only fires when it changes).
  useEffect(() => {
    setOrgSlugInput(currentOrg?.slug ?? '');
  }, [currentOrg?.slug]);

  // ── Core save — ref-based so auto-save always closes over latest state ────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSaveRef = useRef<((opts?: { slugOverride?: string; statusOverride?: TournamentStatus; formatOverride?: TournamentFormat }) => Promise<void>) | null>(null);

  useEffect(() => {
    performSaveRef.current = async (opts) => {
      if (!tournamentId || !currentTournament) return;
      const slugToSave = opts?.slugOverride ?? saved.slug;
      const newStatus = opts?.statusOverride;
      const formatToSave = opts?.formatOverride ?? tournamentFormat;

      setSaveStatus('saving');
      try {
        const [tournamentRes, brandingRes, schedulingRes] = await Promise.all([
          fetch(`/api/admin/tournaments${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              id: tournamentId,
              data: {
                // Year is derived from the (required) start date — no manual field.
                year: startDate ? Number(startDate.slice(0, 4)) : tournamentYear,
                name: tournamentName,
                slug: slugToSave,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                feeScheduleMode: feeScopeToScheduleMode(feeScope),
                depositAmount:   depositAmount   ? Number(depositAmount)   : null,
                depositDueDate:  depositDueDate  || null,
                totalFeeAmount:  totalFeeAmount  ? Number(totalFeeAmount)  : null,
                totalFeeDueDate: totalFeeDueDate || null,
                notifyTeamsOnComplete,
                defaultContactMemberId,
                notifyMode,
                contactShowToCoaches,
                contactShowOnPublic,
                listInDirectory,
                directoryProvince,
              },
            }),
          }),
          fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requireScoreFinalization: scorePolicyValue(scorePolicyMode) }),
          }),
          fetch(`/api/admin/tournaments${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'patch-settings',
              id: tournamentId,
              data: {
                settings: {
                  format: formatToSave,
                  game_duration_minutes: gameDurationMinutes,
                  buffer_minutes: bufferMinutes,
                  schedule_travel_venue_buffer_minutes: venueMoveBufferMinutes,
                  schedule_travel_facility_buffer_minutes: facilityMoveBufferMinutes,
                  game_timing_scope: gameTimingScope,
                  tie_breakers: tieBreakers,
                  tie_breaker_scope: tieBreakerScope,
                  max_run_diff_per_game: clampRunDiffCap(runDiffCap),
                  fee_scope: feeScope,
                  show_fees_on_register: showFeesOnRegister,
                  payment_instructions: paymentInstructions.trim(),
                  payment_instructions_on_form: paymentInstructionsOnForm,
                  coach_email_confirmation: coachEmailConfirmation,
                  coach_email_acceptance: coachEmailAcceptance,
                  coach_email_rejection: coachEmailRejection,
                  coach_email_payment: coachEmailPayment,
                  coach_email_schedule: coachEmailSchedule,
                  coach_email_game_day: coachEmailGameDay,
                  coach_email_pause_all: coachEmailPauseAll,
                  roster_require: rosterRequire,
                  roster_require_dob: rosterRequireDob,
                  roster_require_jersey: rosterRequireJersey,
                  roster_require_waiver: rosterRequireWaiver,
                  roster_waiver_text: rosterWaiverText.trim(),
                  roster_min_players: rosterMinPlayers ? Number(rosterMinPlayers) : null,
                  roster_max_players: rosterMaxPlayers ? Number(rosterMaxPlayers) : null,
                },
              },
            }),
          }),
        ]);

        if (!tournamentRes.ok) {
          const d = await tournamentRes.json();
          throw new Error(d.error ?? 'Failed to save tournament settings');
        }
        if (!brandingRes.ok) {
          const d = await brandingRes.json();
          throw new Error(d.error ?? 'Failed to save scoring settings');
        }
        if (!schedulingRes.ok) {
          const d = await schedulingRes.json();
          throw new Error(d.error ?? 'Failed to save scheduling settings');
        }

        if (newStatus) {
          const statusRes = await fetch(`/api/admin/tournaments${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set-status',
              id: tournamentId,
              data: { status: newStatus },
            }),
          });
          if (!statusRes.ok) {
            const d = await statusRes.json();
            throw new Error(d.error ?? 'Failed to update tournament status');
          }
        }

        setSaved(prev => ({
          name: tournamentName,
          year: tournamentYear,
          slug: slugToSave,
          status: newStatus ?? prev.status,
          startDate, endDate, format: formatToSave, feeScope,
          depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate,
          showFeesOnRegister, paymentInstructions, paymentInstructionsOnForm,
          gameTimingScope, gameDurationMinutes, bufferMinutes,
          venueMoveBufferMinutes, facilityMoveBufferMinutes,
          tieBreakerScope, tieBreakers: [...tieBreakers], runDiffCap,
          scorePolicyMode, notifyTeamsOnComplete, defaultContactMemberId, notifyMode,
          contactShowToCoaches, contactShowOnPublic,
          listInDirectory, directoryProvince,
          coachEmailConfirmation, coachEmailAcceptance, coachEmailRejection, coachEmailPayment,
          coachEmailSchedule, coachEmailGameDay, coachEmailPauseAll,
          rosterRequire, rosterRequireDob, rosterRequireJersey, rosterRequireWaiver,
          rosterWaiverText, rosterMinPlayers, rosterMaxPlayers,
        }));
        refreshTournaments();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } catch (err: unknown) {
        setSaveStatus('idle');
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
        setErrorOpen(true);
      }
    };
  }, [
    bufferMinutes, currentTournament, defaultContactMemberId, depositAmount,
    depositDueDate, endDate, feeScope, gameDurationMinutes, gameTimingScope,
    facilityMoveBufferMinutes, notifyMode, notifyTeamsOnComplete, orgParam, orgQuery, refreshTournaments,
    saved.slug, scorePolicyMode, startDate, tieBreakerScope, tieBreakers, runDiffCap,
    totalFeeAmount, totalFeeDueDate, tournamentId, tournamentName, tournamentFormat,
    tournamentYear, venueMoveBufferMinutes,
    showFeesOnRegister, paymentInstructions, paymentInstructionsOnForm,
    coachEmailConfirmation, coachEmailAcceptance, coachEmailRejection, coachEmailPayment,
    coachEmailSchedule, coachEmailGameDay, coachEmailPauseAll,
    rosterRequire, rosterRequireDob, rosterRequireJersey, rosterRequireWaiver,
    rosterWaiverText, rosterMinPlayers, rosterMaxPlayers,
    contactShowToCoaches, contactShowOnPublic,
    listInDirectory, directoryProvince,
  ]);

  // ── Auto-save effect — fires 1.2 s after any non-status, non-slug change ──

  useEffect(() => {
    if (!isInitialized || !tournamentId) return;
    // Hydration sets every field AND isInitialized in one batch, which would
    // otherwise look like a "change" and auto-save on load (and re-fire on every
    // tournament switch). Only save when a field actually differs from the last
    // persisted snapshot.
    const dirty =
      tournamentName !== saved.name ||
      tournamentYear !== saved.year ||
      startDate !== saved.startDate ||
      endDate !== saved.endDate ||
      feeScope !== saved.feeScope ||
      depositAmount !== saved.depositAmount ||
      depositDueDate !== saved.depositDueDate ||
      totalFeeAmount !== saved.totalFeeAmount ||
      totalFeeDueDate !== saved.totalFeeDueDate ||
      showFeesOnRegister !== saved.showFeesOnRegister ||
      paymentInstructions !== saved.paymentInstructions ||
      paymentInstructionsOnForm !== saved.paymentInstructionsOnForm ||
      gameTimingScope !== saved.gameTimingScope ||
      gameDurationMinutes !== saved.gameDurationMinutes ||
      bufferMinutes !== saved.bufferMinutes ||
      venueMoveBufferMinutes !== saved.venueMoveBufferMinutes ||
      facilityMoveBufferMinutes !== saved.facilityMoveBufferMinutes ||
      tieBreakerScope !== saved.tieBreakerScope ||
      runDiffCap !== saved.runDiffCap ||
      JSON.stringify(tieBreakers) !== JSON.stringify(saved.tieBreakers) ||
      scorePolicyMode !== saved.scorePolicyMode ||
      notifyTeamsOnComplete !== saved.notifyTeamsOnComplete ||
      defaultContactMemberId !== saved.defaultContactMemberId ||
      notifyMode !== saved.notifyMode ||
      contactShowToCoaches !== saved.contactShowToCoaches ||
      contactShowOnPublic !== saved.contactShowOnPublic ||
      listInDirectory !== saved.listInDirectory ||
      directoryProvince !== saved.directoryProvince ||
      coachEmailConfirmation !== saved.coachEmailConfirmation ||
      coachEmailAcceptance !== saved.coachEmailAcceptance ||
      coachEmailRejection !== saved.coachEmailRejection ||
      coachEmailPayment !== saved.coachEmailPayment ||
      coachEmailSchedule !== saved.coachEmailSchedule ||
      coachEmailGameDay !== saved.coachEmailGameDay ||
      coachEmailPauseAll !== saved.coachEmailPauseAll ||
      rosterRequire !== saved.rosterRequire ||
      rosterRequireDob !== saved.rosterRequireDob ||
      rosterRequireJersey !== saved.rosterRequireJersey ||
      rosterRequireWaiver !== saved.rosterRequireWaiver ||
      rosterWaiverText !== saved.rosterWaiverText ||
      rosterMinPlayers !== saved.rosterMinPlayers ||
      rosterMaxPlayers !== saved.rosterMaxPlayers;
    if (!dirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSaveRef.current?.();
    }, 1200);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [
    isInitialized, tournamentId, saved,
    tournamentName, tournamentYear, startDate, endDate,
    feeScope, depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate,
    showFeesOnRegister, paymentInstructions, paymentInstructionsOnForm,
    gameTimingScope, gameDurationMinutes, bufferMinutes,
    venueMoveBufferMinutes, facilityMoveBufferMinutes,
    tieBreakers, tieBreakerScope, runDiffCap,
    scorePolicyMode, notifyTeamsOnComplete, defaultContactMemberId, notifyMode,
    contactShowToCoaches, contactShowOnPublic,
    listInDirectory, directoryProvince,
    coachEmailConfirmation, coachEmailAcceptance, coachEmailRejection, coachEmailPayment,
    coachEmailSchedule, coachEmailGameDay, coachEmailPauseAll,
    rosterRequire, rosterRequireDob, rosterRequireJersey, rosterRequireWaiver,
    rosterWaiverText, rosterMinPlayers, rosterMaxPlayers,
  ]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function handleStatusClick(s: TournamentStatus) {
    if (s === tournamentStatus) return;
    setPendingStatusChange(s);
    setStatusConfirmOpen(true);
  }

  function handleStatusConfirm() {
    if (!pendingStatusChange) return;
    const newStatus = pendingStatusChange;
    setTournamentStatus(newStatus);
    setPendingStatusChange(null);
    setStatusConfirmOpen(false);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    performSaveRef.current?.({ statusOverride: newStatus });
  }

  // Tournament format can only change while in Draft (round robin and bracket-only
  // schedules are structurally different).
  const formatLocked = tournamentStatus !== 'draft';

  function applyFormatChange(fmt: TournamentFormat) {
    setTournamentFormat(fmt);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    performSaveRef.current?.({ formatOverride: fmt });
  }

  async function requestFormatChange(fmt: TournamentFormat) {
    if (fmt === tournamentFormat || formatLocked || formatBusy || !tournamentId) return;
    setFormatBusy(true);
    try {
      const res = await fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`);
      const games = res.ok ? await res.json() : [];
      const count = Array.isArray(games) ? games.length : 0;
      if (count > 0) {
        setPendingFormat(fmt);
        setExistingGameCount(count);
        setFormatConfirmOpen(true);
      } else {
        applyFormatChange(fmt);
      }
    } catch {
      // If we can't check, fall back to confirming so we never silently orphan a schedule.
      setPendingFormat(fmt);
      setExistingGameCount(0);
      setFormatConfirmOpen(true);
    } finally {
      setFormatBusy(false);
    }
  }

  async function confirmFormatChange() {
    if (!pendingFormat || !tournamentId) return;
    const fmt = pendingFormat;
    setFormatConfirmOpen(false);
    try {
      const delRes = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-tournament-games', tournamentId }),
      });
      if (!delRes.ok) {
        const d = await delRes.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to clear the existing schedule');
      }
      applyFormatChange(fmt);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to switch tournament format');
      setErrorOpen(true);
    } finally {
      setPendingFormat(null);
    }
  }

  async function handleOrgSlugUpdate() {
    setOrgSlugConfirmOpen(false);
    if (!currentOrg) return;
    const newSlug = orgSlugInput.trim().toLowerCase();
    if (!newSlug || !/^[a-z0-9-]+$/.test(newSlug)) {
      setOrgSlugError('Lowercase letters, numbers, and hyphens only.');
      return;
    }
    setOrgSlugSaving(true);
    setOrgSlugError('');
    try {
      const res = await fetch(`/api/admin/org-settings?orgSlug=${encodeURIComponent(currentOrg.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrgSlugError(data.error ?? 'Could not update the address.');
        setOrgSlugSaving(false);
        return;
      }
      // The current URL contains the old org slug — move to the new one.
      router.push(`/${data.slug}/admin/tournaments/settings/event`);
      router.refresh();
    } catch {
      setOrgSlugError('Could not update the address.');
      setOrgSlugSaving(false);
    }
  }

  function handleSlugConfirm() {
    const newSlug = tournamentSlug;
    setSlugConfirmOpen(false);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    performSaveRef.current?.({ slugOverride: newSlug });
  }

  // Status modal copy
  const statusModalProps = pendingStatusChange === 'active'
    ? { type: 'primary' as const, title: 'Make Tournament Active?', message: 'The tournament will be publicly visible and open for team registrations.', confirmText: 'Make Active' }
    : pendingStatusChange === 'completed'
    ? { type: 'warning' as const, title: 'Mark as Completed?', message: `This tournament will be locked. Registrations close, and all event data — scores, standings, schedules, divisions, and team registrations — becomes read-only and final.${notifyTeamsOnComplete ? ' Team contacts will receive a results summary email.' : ''} You can reopen the tournament by setting the status back to Active.`, confirmText: 'Mark Completed' }
    : { type: 'primary' as const, title: 'Move to Draft?', message: 'The tournament will be hidden from teams and the public.', confirmText: 'Move to Draft' };

  if (userRole !== 'owner' && userRole !== 'admin') {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Event settings can be managed by admins and owners.</p>
      </div>
    );
  }

  if (!tournamentId) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Select a tournament from the sidebar to manage event settings.</p>
      </div>
    );
  }

  const showFeeInputs = feeScope === 'tournament' || feeScope === 'allow_override' || feeScope === null;
  const showTimingInputs = gameTimingScope !== 'per_division';
  const showTieBreakerList = tieBreakerScope !== 'per_division';

  // Roster Requirements — what the coach-side submission (5k) will show for the current choices.
  const effectiveWaiverText = rosterWaiverText.trim() || DEFAULT_ROSTER_WAIVER_TEXT;
  const rosterSizeSummary = (() => {
    const min = rosterMinPlayers ? Number(rosterMinPlayers) : null;
    const max = rosterMaxPlayers ? Number(rosterMaxPlayers) : null;
    if (min != null && max != null) {
      // min>max is storable (warn-don't-block) — readers apply max-wins, so preview honestly does too.
      if (min > max) return `at most ${max} players (the minimum is ignored while it exceeds the maximum)`;
      return min === max ? `exactly ${min} players` : `between ${min} and ${max} players`;
    }
    if (min != null) return `at least ${min} players`;
    if (max != null) return `up to ${max} players`;
    return null;
  })();

  // ── Collapsed-header value summaries (J1-029) ───────────────────────────────
  // Each CollapsibleCard renders the matching string in its `meta` slot so the
  // page is scannable without opening every card. Keep these terse — the meta
  // slot sits beside the title and does not truncate.
  const overviewSummary = (() => {
    const status = tournamentStatus === 'active' ? 'Active'
      : tournamentStatus === 'completed' ? 'Completed' : 'Draft';
    return startDate && endDate ? `${status} · dates set` : `${status} · dates not set`;
  })();

  const scheduleRulesSummary = (() => {
    const fmt = tournamentFormat === 'playoff_only' ? 'Bracket only' : 'Round robin + playoffs';
    const timing = gameTimingScope === 'per_division' ? 'per-division timing'
      : `${gameDurationMinutes}m games`;
    return `${fmt} · ${timing}`;
  })();

  const feeSummary = (() => {
    if (feeScope === 'free') return 'Free';
    if (feeScope === 'per_division') return 'Per division';
    if (feeScope === 'allow_override') return 'Default + overrides';
    if (feeScope === 'tournament') {
      return totalFeeAmount ? `$${totalFeeAmount} / team` : 'Tournament-wide';
    }
    return 'Not set';
  })();

  // Contact card — who people reach / who you notify.
  const contactSummary = (() => {
    const visibility = contactShowOnPublic ? 'contact public' : 'contact hidden';
    return `${notifyMode === 'all' ? 'All registrations' : 'Assigned only'} · ${visibility}`;
  })();

  // Coach Emails card — what the system auto-sends.
  const coachEmailsSummary = (() => {
    if (coachEmailPauseAll) return 'Auto emails off';
    const offCount = [
      coachEmailConfirmation, coachEmailAcceptance, coachEmailRejection,
      coachEmailPayment, coachEmailSchedule, coachEmailGameDay,
    ].filter(v => v === false).length;
    return offCount > 0 ? `Auto emails on · ${offCount} off` : 'Auto emails on';
  })();

  const rosterSummary = rosterRequire
    ? `Required${rosterSizeSummary ? ` · ${rosterSizeSummary}` : ''}`
    : 'Not required';

  const registrationQuestionsSummary = canUseRegistrationQuestions
    ? 'Custom sign-up questions'
    : 'Tournament Plus';

  return (
    <div className={styles.page}>
      <div className={styles.settingsContent}>
        <div className={styles.settingsTitleRow}>
          <div className={styles.headerIcon}><Settings2 size={18} /></div>
          <div>
            <h1 className={styles.pageTitle}>Event Settings</h1>
            <p className={styles.pageSub}>{currentTournament?.name} — identity, dates & status</p>
          </div>
        </div>

        <div className={styles.cardStack}>

        {/* ── Card 1: Tournament Overview ── */}
        <CollapsibleCard title="Tournament Overview" sectionId="overview" defaultOpen={false} meta={overviewSummary}>

          <div className="form-group">
            <label className="form-label">Tournament Name</label>
            <input
              className="form-input"
              type="text"
              maxLength={80}
              value={tournamentName}
              onChange={e => setTournamentName(e.target.value)}
              placeholder="e.g. Spring Invitational 2026"
            />
          </div>

          <hr className={styles.cardDivider} />

          {/* Status */}
          <p className={styles.subSectionLabel}>Status</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div className={styles.segmentedControl} role="radiogroup" aria-label="Tournament status">
              {([
                ['draft',     'Draft'],
                ['active',    'Active'],
                ['completed', 'Completed'],
              ] as const).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={tournamentStatus === s}
                  onClick={() => handleStatusClick(s)}
                  className={`${styles.segmentButton} ${tournamentStatus === s ? styles.segmentButtonActive : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.descriptionText}>
              {tournamentStatus === 'draft'
                ? 'Draft tournaments are not visible to teams or the public. Use draft mode while setting up.'
                : tournamentStatus === 'active'
                ? 'Active tournaments are open for registration and publicly visible. Activate once your divisions, fees, and game timing are configured.'
                : 'Completed tournaments are closed to new registrations. Scores are finalized and public standings are displayed.'}
            </p>
          </div>

          <hr className={styles.cardDivider} />

          {/* Public discovery directory listing (migration 158) — opt-in, default off */}
          <div className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>List in public tournament directory</p>
              <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>
                Show this tournament on the FieldLogicHQ public directory, where anyone can discover it by sport, region, and date. Off by default.
              </p>
            </div>
            <div className={styles.segmentedControl} role="radiogroup" aria-label="List in public tournament directory">
              {([[true, 'On'], [false, 'Off']] as const).map(([val, lbl]) => (
                <button
                  key={String(val)}
                  type="button"
                  role="radio"
                  aria-checked={listInDirectory === val}
                  onClick={() => setListInDirectory(val)}
                  className={`${styles.segmentButton} ${listInDirectory === val ? styles.segmentButtonActive : ''}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {listInDirectory && (
            <>
              <p className={styles.descriptionText} style={{ margin: '0.6rem 0 0' }}>
                The directory shows your event name, dates, sport, and live scores, and links to your existing public pages. <strong>Player information always stays private.</strong> Your listing appears only once the tournament is set to Active or Completed — a draft stays hidden.
              </p>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Province / territory</label>
                <select
                  className="form-select"
                  value={directoryProvince}
                  onChange={e => setDirectoryProvince(e.target.value)}
                >
                  <option value="">— Select a region —</option>
                  {CANADIAN_PROVINCES.map(p => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
                <p className={styles.descriptionText} style={{ margin: '0.25rem 0 0' }}>
                  Lets people filter the directory by where your tournament is held.
                </p>
              </div>
            </>
          )}

          {/* Dates */}
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                className="form-input"
                type="date"
                value={startDate}
                onChange={e => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (val && (!endDate || endDate < val)) {
                    const d = new Date(val + 'T12:00:00');
                    d.setDate(d.getDate() + 2);
                    setEndDate(d.toISOString().split('T')[0]);
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                className="form-input"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Public URL — owner only */}
          {userRole === 'owner' && (
            <>
              <hr className={styles.cardDivider} />
              <div className="form-group">
                <label className="form-label">Public URL</label>
                <input
                  className="form-input"
                  type="text"
                  value={tournamentSlug}
                  onChange={e => setTournamentSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. spring-invitational-2026"
                />
                <p className={styles.urlPreview}>
                  fieldlogichq.ca/{currentOrg?.slug}/<span className={styles.urlSlug}>{tournamentSlug || '…'}</span>
                </p>
                {slugStatus === 'checking' && (
                  <p className={styles.inheritNote} style={{ marginTop: '0.35rem' }}>Checking availability…</p>
                )}
                {slugStatus === 'available' && (
                  <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', fontFamily: 'var(--font-data)', color: 'var(--success)', margin: '0.25rem 0 0' }}>✓ Available</p>
                )}
                {slugStatus === 'taken' && (
                  <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-data)', color: 'var(--danger)', margin: '0.25rem 0 0' }}>✗ That URL is already taken</p>
                )}
                {slugStatus === 'invalid' && (
                  <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-data)', color: 'var(--danger)', margin: '0.25rem 0 0' }}>Lowercase letters, numbers, and hyphens only</p>
                )}
                {slugHasChanged && (
                  <div className={styles.warningBanner} style={{ marginTop: '0.5rem' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '0.1rem' }} />
                    <p>Changing the Public URL breaks all existing registration links, coach emails, and bookmarked pages.</p>
                  </div>
                )}
                {slugHasChanged && (
                  <button
                    type="button"
                    className="btn btn-outline btn-data"
                    style={{ marginTop: '0.65rem' }}
                    disabled={slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid'}
                    onClick={() => setSlugConfirmOpen(true)}
                  >
                    Update URL
                  </button>
                )}
              </div>
            </>
          )}

          {/* Organization public address (org slug) — account-wide URL prefix, owner only.
              Single-product orgs can't reach Org Settings, so it's editable here. */}
          {userRole === 'owner' && (
            <>
              <hr className={styles.cardDivider} />
              <div className="form-group">
                <label className="form-label">Organization Address</label>
                <input
                  className="form-input"
                  type="text"
                  value={orgSlugInput}
                  onChange={e => setOrgSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. milton-softball"
                />
                <p className={styles.urlPreview}>
                  fieldlogichq.ca/<span className={styles.urlSlug}>{orgSlugInput || '…'}</span>/{tournamentSlug || 'your-tournament'}
                </p>
                <p className={styles.inheritNote} style={{ marginTop: '0.35rem' }}>
                  Your account-wide address — the start of every tournament link. Shared across all your tournaments.
                </p>
                {orgSlugInput.length > 0 && !/^[a-z0-9-]+$/.test(orgSlugInput) && (
                  <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-data)', color: 'var(--danger)', margin: '0.25rem 0 0' }}>Lowercase letters, numbers, and hyphens only</p>
                )}
                {orgSlugError && (
                  <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-data)', color: 'var(--danger)', margin: '0.25rem 0 0' }}>{orgSlugError}</p>
                )}
                {orgSlugInput !== (currentOrg?.slug ?? '') && (
                  <div className={styles.warningBanner} style={{ marginTop: '0.5rem' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '0.1rem' }} />
                    <p>Changing your organization address breaks every existing link across all your tournaments — registration pages, coach emails, and bookmarks.</p>
                  </div>
                )}
                {orgSlugInput !== (currentOrg?.slug ?? '') && (
                  <button
                    type="button"
                    className="btn btn-outline btn-data"
                    style={{ marginTop: '0.65rem' }}
                    disabled={orgSlugSaving || !orgSlugInput || !/^[a-z0-9-]+$/.test(orgSlugInput)}
                    onClick={() => setOrgSlugConfirmOpen(true)}
                  >
                    {orgSlugSaving ? 'Updating…' : 'Update Address'}
                  </button>
                )}
              </div>
            </>
          )}
        </CollapsibleCard>

        {/* ── Card 2: Registration Questions ── */}
        <CollapsibleCard title="Registration Questions" sectionId="questions" defaultOpen={false} meta={registrationQuestionsSummary}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <p className={styles.descriptionText}>
              Add custom questions to the team registration form — collect confirmations, dropdowns, text answers, and file uploads from coaches during sign-up.
            </p>
            {canUseRegistrationQuestions ? (
              <Link href={registrationFieldsHref} className="btn btn-outline btn-data" style={{ alignSelf: 'flex-start' }}>
                Manage questions →
              </Link>
            ) : (
              <div className={styles.inlineUpsell}>
                <p>{requiresTournamentPlusCopy('custom_registration_fields')}</p>
                <Link href={subscriptionHref} className="btn btn-outline btn-data">Review Tournament Plus</Link>
              </div>
            )}
          </div>
        </CollapsibleCard>

        {/* ── Card 3: Roster Requirements (Phase 5f) — read by the Coaches Portal
            event-roster submission (5h/5k). Applies to the per-event snapshot only,
            never to a coach's master roster. ── */}
        <CollapsibleCard title="Roster Requirements" sectionId="roster" defaultOpen={false} meta={rosterSummary}>
          <div className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Event roster</p>
              <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>
                Ask accepted teams to submit a roster for this event from their Coaches Portal.
                When off, teams aren&apos;t asked for a roster.
              </p>
            </div>
            <div className={styles.segmentedControl} role="radiogroup" aria-label="Event roster requirement">
              {([[true, 'On'], [false, 'Off']] as const).map(([val, lbl]) => (
                <button
                  key={String(val)}
                  type="button"
                  role="radio"
                  aria-checked={rosterRequire === val}
                  onClick={() => setRosterRequire(val)}
                  className={`${styles.segmentButton} ${rosterRequire === val ? styles.segmentButtonActive : ''}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {rosterRequire ? (
            <>
              <hr className={styles.cardDivider} />

              <p className={styles.subSectionLabel}>Required Details</p>
              <p className={styles.descriptionText} style={{ marginBottom: '0.85rem' }}>
                Coaches are asked for exactly what you require here and nothing more. These apply to this
                event&apos;s roster submission only — they never change what a coach keeps on their own team roster.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Names aren't a toggle — every submission carries them from the coach's saved roster. */}
                <div className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.subSectionLabel} style={{ margin: 0 }}>Player names</p>
                    <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>
                      Every roster submission includes each player&apos;s full name, taken from the coach&apos;s saved team roster.
                    </p>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-data)', color: 'var(--logic-lime)', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', padding: '0.35rem 0' }}>
                    Always
                  </span>
                </div>
                {([
                  ['Player birthdates', 'Each player on the submitted roster needs a date of birth (e.g. for age verification). Collected for this event only.', rosterRequireDob, setRosterRequireDob] as const,
                  ['Jersey numbers', 'Each player on the submitted roster needs a jersey number.', rosterRequireJersey, setRosterRequireJersey] as const,
                  ['Waiver acknowledgment', 'The coach must tick a waiver acknowledgment to submit. No document is uploaded or stored.', rosterRequireWaiver, setRosterRequireWaiver] as const,
                ]).map(([label, desc, value, setValue]) => (
                  <div key={label} className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className={styles.subSectionLabel} style={{ margin: 0 }}>{label}</p>
                      <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>{desc}</p>
                    </div>
                    <div className={styles.segmentedControl} role="radiogroup" aria-label={`${label} requirement`}>
                      {([[true, 'On'], [false, 'Off']] as const).map(([val, lbl]) => (
                        <button
                          key={String(val)}
                          type="button"
                          role="radio"
                          aria-checked={value === val}
                          onClick={() => setValue(val)}
                          className={`${styles.segmentButton} ${value === val ? styles.segmentButtonActive : ''}`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {rosterRequireWaiver && (
                <div style={{ marginTop: '0.85rem' }}>
                  <p className={styles.subSectionLabel} style={{ marginBottom: '0.35rem' }}>Waiver statement</p>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    maxLength={ROSTER_WAIVER_TEXT_MAX_LENGTH}
                    placeholder={DEFAULT_ROSTER_WAIVER_TEXT}
                    value={rosterWaiverText}
                    onChange={e => setRosterWaiverText(e.target.value)}
                  />
                  <p className={styles.descriptionText} style={{ marginTop: '0.4rem' }}>
                    This is exactly what the coach ticks agreement to when submitting. Leave blank to use the
                    default wording shown above.
                  </p>
                </div>
              )}

              <hr className={styles.cardDivider} />

              <p className={styles.subSectionLabel}>Roster Size</p>
              <p className={styles.descriptionText}>Leave a field blank for no limit.</p>
              <div className="form-row form-row-2" style={{ marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Minimum Players</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1" max="99" step="1"
                    placeholder="No minimum"
                    value={rosterMinPlayers}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') { setRosterMinPlayers(''); return; }
                      const n = parseInt(raw, 10);
                      if (!isNaN(n) && n >= 1 && n <= 99) setRosterMinPlayers(String(n));
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Maximum Players</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1" max="99" step="1"
                    placeholder="No maximum"
                    value={rosterMaxPlayers}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') { setRosterMaxPlayers(''); return; }
                      const n = parseInt(raw, 10);
                      if (!isNaN(n) && n >= 1 && n <= 99) setRosterMaxPlayers(String(n));
                    }}
                  />
                </div>
              </div>
              {rosterMinPlayers !== '' && rosterMaxPlayers !== '' && Number(rosterMinPlayers) > Number(rosterMaxPlayers) && (
                <p className={styles.inheritNote} style={{ marginTop: '0.35rem', color: 'var(--warning, var(--white-70))' }}>
                  Minimum is greater than maximum — no roster could satisfy both. Adjust one of the two.
                </p>
              )}

              <hr className={styles.cardDivider} />

              {/* Live sample of the coach-side submission for the current choices. */}
              <p className={styles.subSectionLabel}>What the Coach Will See</p>
              <p className={styles.descriptionText} style={{ marginBottom: '0.75rem' }}>
                A sample of the submission this event asks for — it updates as you change the requirements above.
                Coaches pick players from their saved team roster and fill in only what&apos;s required.
              </p>
              <div className={styles.questionCard}>
                <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white-40)', fontFamily: 'var(--font-data)' }}>
                  For each player
                </p>
                <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', color: 'var(--white-70)', fontSize: '0.82rem', lineHeight: 1.7, fontFamily: 'var(--font-data)' }}>
                  <li>Full name <span style={{ color: 'var(--white-35)' }}>(always included)</span></li>
                  {rosterRequireDob && <li>Date of birth</li>}
                  {rosterRequireJersey && <li>Jersey number</li>}
                </ul>
                {(rosterRequireWaiver || rosterSizeSummary) && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white-40)', fontFamily: 'var(--font-data)' }}>
                      To submit
                    </p>
                    {rosterSizeSummary && (
                      <p style={{ margin: '0.4rem 0 0', color: 'var(--white-70)', fontSize: '0.82rem', lineHeight: 1.55, fontFamily: 'var(--font-data)' }}>
                        The roster must list {rosterSizeSummary}.
                      </p>
                    )}
                    {rosterRequireWaiver && (
                      <p style={{ display: 'flex', gap: '0.5rem', margin: '0.4rem 0 0', color: 'var(--white-70)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                        <span aria-hidden="true" style={{ flexShrink: 0 }}>☐</span>
                        <em>{effectiveWaiverText}</em>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className={styles.inheritNote}>
              Teams can take part without submitting a roster. Turn this on to collect one per team before game day.
            </p>
          )}
        </CollapsibleCard>

        {/* ── Card 4: Fees & Payments ── */}
        <CollapsibleCard title="Fees & Payments" sectionId="fees" defaultOpen={false} meta={feeSummary}>
          <p className={styles.subSectionLabel}>Fee model</p>
          <div className={styles.segmentedControl} style={{ marginBottom: '1rem' }}>
            {([
              ['tournament',    'Tournament-wide'],
              ['allow_override','Allow override'],
              ['per_division',  'Per division'],
              ['free',          'Free'],
            ] as const).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                onClick={() => setFeeScope(scope)}
                className={`${styles.segmentButton} ${feeScope === scope ? styles.segmentButtonActive : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          {feeScope === 'free' ? (
            <p className={styles.descriptionText}>
              No payment schedule — teams are not charged a registration fee for this tournament.
            </p>
          ) : feeScope === 'per_division' ? (
            <p className={styles.descriptionText}>
              Fee amounts and due dates are set per division. Edit each division to configure its fee schedule.
            </p>
          ) : (
            <>
              {feeScope === 'allow_override' && (
                <p className={styles.inheritNote} style={{ marginBottom: '0.75rem' }}>
                  These are the default fee amounts. Divisions can override them individually.
                </p>
              )}
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Deposit Amount ($)</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 200" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deposit Due Date</label>
                  <input className="form-input" type="date" value={depositDueDate} onChange={e => setDepositDueDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Fee ($)</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 500" value={totalFeeAmount} onChange={e => setTotalFeeAmount(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Fee Due Date</label>
                  <input className="form-input" type="date" value={totalFeeDueDate} onChange={e => setTotalFeeDueDate(e.target.value)} />
                </div>
              </div>
            </>
          )}
          {showFeeInputs && !feeScope && (
            <p className={styles.descriptionText}>
              Choose a payment configuration above to confirm how fees are handled for this tournament.
            </p>
          )}

          {feeScope && feeScope !== 'free' && (
            <>
              <hr className={styles.cardDivider} />

              {/* Public registration form — fee display + how-to-pay instructions */}
              <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
                <p className={styles.subSectionLabel} style={{ margin: 0 }}>Fee details on registration form</p>
                <div className={styles.segmentedControl}>
                  {([
                    [true,  'Show'],
                    [false, 'Hide'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setShowFeesOnRegister(val)}
                      className={`${styles.segmentButton} ${showFeesOnRegister === val ? styles.segmentButtonActive : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.descriptionText}>
                When hidden, fee amounts and due dates stay in admin only — coaches won&apos;t see a payment panel on the public registration form.
              </p>

              <p className={styles.subSectionLabel} style={{ marginTop: '1rem' }}>Payment instructions</p>
              <textarea
                className="form-textarea"
                rows={3}
                maxLength={1000}
                placeholder="e.g. E-transfer to treasurer@club.ca with your team name in the memo. Balance due by the date above."
                value={paymentInstructions}
                onChange={e => setPaymentInstructions(e.target.value)}
              />
              <div className={styles.cardHeaderRow} style={{ marginTop: '0.75rem' }}>
                <p className={styles.descriptionText} style={{ margin: 0 }}>Where these appear</p>
                <div className={styles.segmentedControl}>
                  {([
                    [false, 'Email only'],
                    [true,  'Form & email'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setPaymentInstructionsOnForm(val)}
                      className={`${styles.segmentButton} ${paymentInstructionsOnForm === val ? styles.segmentButtonActive : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.descriptionText} style={{ marginTop: '0.4rem' }}>
                Payment instructions are always included in the acceptance email and shown to accepted coaches in their Coaches Portal. Choose &ldquo;Form &amp; email&rdquo; to also show them on the public registration form before teams register.
              </p>
            </>
          )}
        </CollapsibleCard>

        {/* ── Card 5: Contact ── */}
        <CollapsibleCard title="Contact" sectionId="contact" defaultOpen={false} meta={contactSummary}>

          {/* Public Contact */}
          <div>
            <p className={styles.subSectionLabel}>Public Contact</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <p className={styles.descriptionText}>
                Who coaches and visitors reach with questions. Defaults to the org owner. The toggles set where it shows.
              </p>
              <div className="form-group">
                <label className="form-label">Contact Member</label>
                <select
                  className="form-input"
                  value={defaultContactMemberId ?? ''}
                  onChange={e => setDefaultContactMemberId(e.target.value || null)}
                  aria-label="Default contact member"
                >
                  <option value="">
                    {ownerMember
                      ? `${ownerMember.displayName ?? ownerMember.email} (owner)`
                      : 'Organization Owner'}
                  </option>
                  {orgMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.displayName ?? m.email}
                      {m.title ? ` — ${m.title}` : ''}
                      {' '}({m.role === 'owner' ? 'owner' : m.role})
                    </option>
                  ))}
                </select>
              </div>
              {defaultContactMemberId && (() => {
                const selected = orgMembers.find(m => m.id === defaultContactMemberId);
                return selected ? (
                  <p className={styles.inheritNote}>
                    Selected contact: <strong style={{ color: 'var(--white-70)' }}>{selected.email}</strong>
                  </p>
                ) : null;
              })()}

              {/* Per-audience visibility toggles (migration 120) */}
              {([
                ['Communication with coaches', 'Show this email to registered coaches — in coach-facing emails (registration, acceptance, payment) and in the Coaches Portal.', contactShowToCoaches, setContactShowToCoaches] as const,
                ['Show on public site', 'Display this email on your public tournament pages. Turn off to keep it out of reach of spam bots.', contactShowOnPublic, setContactShowOnPublic] as const,
              ]).map(([label, desc, value, setValue]) => (
                <div key={label} className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.subSectionLabel} style={{ margin: 0 }}>{label}</p>
                    <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>{desc}</p>
                  </div>
                  <div className={styles.segmentedControl} role="radiogroup" aria-label={label}>
                    {([[true, 'On'], [false, 'Off']] as const).map(([val, lbl]) => (
                      <button
                        key={String(val)}
                        type="button"
                        role="radio"
                        aria-checked={value === val}
                        onClick={() => setValue(val)}
                        className={`${styles.segmentButton} ${value === val ? styles.segmentButtonActive : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {!contactShowToCoaches && !contactShowOnPublic && (
                <p className={styles.inheritNote} style={{ color: 'var(--warning, var(--white-70))' }}>
                  This contact email is hidden everywhere. Coaches won&apos;t see a reply-to address and no contact appears publicly.
                </p>
              )}
            </div>
          </div>

          <hr className={styles.cardDivider} />

          {/* Registration Alert Routing */}
          <div>
            <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Registration Alert Routing</p>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Notification routing mode">
                {([
                  ['all',      'All Registrations'],
                  ['assigned', 'Assigned Only'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={notifyMode === mode}
                    onClick={() => setNotifyMode(mode)}
                    className={`${styles.segmentButton} ${notifyMode === mode ? styles.segmentButtonActive : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <p className={styles.descriptionText}>
                {notifyMode === 'all'
                  ? 'Organization owners and admins are notified for every registration. If a division has an assigned contact, they are notified too.'
                  : "Only the division-assigned contact is notified. Owners and admins are not notified for divisions they've delegated."}
              </p>
              <p className={styles.inheritNote}>
                Divisions without an assigned contact always notify tournament admins regardless of this setting.
              </p>
            </div>
          </div>
        </CollapsibleCard>

        {/* ── Card 6: Coach Emails ── */}
        <CollapsibleCard title="Coach Emails" sectionId="coach-emails" defaultOpen={false} meta={coachEmailsSummary}>

          {/* Master switch — positive On/Off at the top. Persisted as
              coach_email_pause_all (true = off); the UI binds to its inverse so
              "On" reads as "sending" (no double-negative). */}
          <div className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem', marginBottom: '0.85rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Automatic coach emails</p>
              <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>
                When on, the emails below send automatically to each team&apos;s coach/contact. Turn off to handle all coach
                communication yourself — your manual tools (announcements, payment reminders, resend access) are unaffected.
              </p>
            </div>
            <div className={styles.segmentedControl} role="radiogroup" aria-label="Automatic coach emails">
              {([[false, 'On'], [true, 'Off']] as const).map(([pausedVal, lbl]) => (
                <button
                  key={lbl}
                  type="button"
                  role="radio"
                  aria-checked={coachEmailPauseAll === pausedVal}
                  onClick={() => setCoachEmailPauseAll(pausedVal)}
                  className={`${styles.segmentButton} ${coachEmailPauseAll === pausedVal ? styles.segmentButtonActive : ''}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {coachEmailPauseAll && (
            <p className={styles.inheritNote} style={{ color: 'var(--warning, var(--white-70))', marginBottom: '0.85rem' }}>
              Automatic coach emails are off. The individual settings below are ignored until you turn this on.
            </p>
          )}

          {/* Per-type toggles */}
          <div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', opacity: coachEmailPauseAll ? 0.5 : 1 }}
              aria-disabled={coachEmailPauseAll}
            >
              {([
                ['Registration received', 'Sent to the coach when they submit a registration (confirmation or waitlist receipt).', coachEmailConfirmation, setCoachEmailConfirmation] as const,
                ['Team accepted', 'Sent when a team is accepted into the tournament.', coachEmailAcceptance, setCoachEmailAcceptance] as const,
                ['Registration declined', 'Sent when a registration is declined.', coachEmailRejection, setCoachEmailRejection] as const,
                ['Payment recorded', 'Sent when a team is marked as paid.', coachEmailPayment, setCoachEmailPayment] as const,
                ['Schedule published', 'Sent to accepted teams when you publish a schedule.', coachEmailSchedule, setCoachEmailSchedule] as const,
                ['Game-day reminder', "Sent the evening before each team's first game.", coachEmailGameDay, setCoachEmailGameDay] as const,
              ]).map(([label, desc, value, setValue]) => (
                <div key={label} className={styles.cardHeaderRow} style={{ alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.subSectionLabel} style={{ margin: 0 }}>{label}</p>
                    <p className={styles.descriptionText} style={{ margin: '0.15rem 0 0' }}>{desc}</p>
                  </div>
                  <div className={styles.segmentedControl} role="radiogroup" aria-label={`${label} email`}>
                    {([[true, 'On'], [false, 'Off']] as const).map(([val, lbl]) => (
                      <button
                        key={String(val)}
                        type="button"
                        role="radio"
                        aria-checked={value === val}
                        onClick={() => setValue(val)}
                        className={`${styles.segmentButton} ${value === val ? styles.segmentButtonActive : ''}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className={styles.cardDivider} />

          {/* Post-Event Results */}
          <div>
            <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Post-Event Results</p>
              <div className={styles.segmentedControl}>
                {([
                  [true,  'Enabled'],
                  [false, 'Disabled'],
                ] as const).map(([val, label]) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => { if (canUsePostEventNotifications) setNotifyTeamsOnComplete(val); }}
                    className={`${styles.segmentButton} ${notifyTeamsOnComplete === val ? styles.segmentButtonActive : ''}`}
                    disabled={!canUsePostEventNotifications}
                    style={!canUsePostEventNotifications ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <p className={styles.descriptionText}>
                When enabled, accepted team contacts receive one email with public standings, schedule, and team links the first time this tournament is marked completed.
              </p>
              {resultsNotifiedAt && (
                <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-data)', color: 'var(--logic-lime)', lineHeight: 1.5, margin: 0 }}>
                  Results notification sent to {resultsNotificationSentCount} team contact{resultsNotificationSentCount === 1 ? '' : 's'} on {resultsNotifiedAt.slice(0, 10)}.
                </p>
              )}
              {!canUsePostEventNotifications && (
                <div className={styles.inlineUpsell}>
                  <p>{requiresTournamentPlusCopy('post_tournament_summary')}</p>
                  <Link href={subscriptionHref} className="btn btn-outline btn-data">Review Tournament Plus</Link>
                </div>
              )}
            </div>
          </div>
        </CollapsibleCard>

        {/* ── Card 7: Schedule Rules ── */}
        <CollapsibleCard title="Schedule Rules" sectionId="schedule" defaultOpen={false} meta={scheduleRulesSummary}>

          {/* Tournament Format */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Tournament Format</p>
              <div className={styles.segmentedControl}>
                {(['round_robin_playoffs', 'playoff_only'] as const).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={formatLocked || formatBusy}
                    onClick={() => requestFormatChange(fmt)}
                    className={`${styles.segmentButton} ${tournamentFormat === fmt ? styles.segmentButtonActive : ''}`}
                    style={formatLocked ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                  >
                    {fmt === 'round_robin_playoffs' ? 'Round robin + playoffs' : 'Bracket only'}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.descriptionText} style={{ marginTop: '0.5rem' }}>
              {tournamentFormat === 'round_robin_playoffs'
                ? 'Teams play a round robin, then the top teams advance to a playoff bracket seeded from the standings.'
                : 'No round robin — the event starts straight with a playoff bracket. You seed teams into the first round yourself (manually or randomized) in the Playoff Bracket Builder.'}
            </p>
            {formatLocked && (
              <p className={styles.inheritNote} style={{ marginTop: '0.35rem' }}>
                The tournament format is locked once the event leaves Draft. Set the status back to Draft to change it.
              </p>
            )}
          </div>

          {/* Game Timing */}
          <div>
            <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Game Timing</p>
              <div className={styles.segmentedControl}>
                {(['tournament', 'allow_override', 'per_division'] as const).map(scope => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setGameTimingScope(scope)}
                    className={`${styles.segmentButton} ${gameTimingScope === scope ? styles.segmentButtonActive : ''}`}
                  >
                    {scope === 'tournament' ? 'Tournament-wide'
                      : scope === 'allow_override' ? 'Allow override'
                      : 'Per division'}
                  </button>
                ))}
              </div>
            </div>
            {showTimingInputs ? (
              <>
                <div className="form-row form-row-2" style={{ marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Game Duration (minutes)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1" max="600" step="5"
                      value={gameDurationMinutes}
                      onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n > 0) setGameDurationMinutes(n); }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Buffer Between Games (minutes)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0" max="120" step="5"
                      value={bufferMinutes}
                      onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) setBufferMinutes(n); }}
                    />
                  </div>
                </div>
                <p className={styles.inheritNote} style={{ marginTop: '0.35rem' }}>
                  Example: a {gameDurationMinutes}-minute game at 8:00 AM → next game at that venue no earlier than {(() => {
                    const total = 8 * 60 + gameDurationMinutes + bufferMinutes;
                    const h = Math.floor(total / 60) % 24;
                    const m = total % 60;
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  })()}.
                  {gameTimingScope === 'allow_override' && ' Divisions can set their own values.'}
                </p>
              </>
            ) : (
              <p className={styles.descriptionText} style={{ marginTop: '0.5rem' }}>
                Each division must configure its own game timing before the tournament can be activated.
              </p>
            )}

            <div style={{ marginTop: '1rem' }}>
              <p className={styles.subSectionLabel}>Travel &amp; Setup Buffers</p>
              <p className={styles.descriptionText}>
                Optional organizer-entered estimates used by Schedule Health and the generator when teams move between facilities. FieldLogicHQ does not calculate drive time.
              </p>
              <div className="form-row form-row-2" style={{ marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Venue Move Buffer (minutes)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="240"
                    step="5"
                    value={venueMoveBufferMinutes}
                    onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) setVenueMoveBufferMinutes(n); }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Facility Move Buffer (minutes)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="240"
                    step="5"
                    value={facilityMoveBufferMinutes}
                    onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) setFacilityMoveBufferMinutes(n); }}
                  />
                </div>
              </div>
              <p className={styles.inheritNote} style={{ marginTop: '0.35rem' }}>
                Set 0 to ignore that move type. These buffers score tight team moves; they do not create hard venue conflicts.
              </p>
            </div>
          </div>

          <hr className={styles.cardDivider} />

          {/* Tie-Breaker Rules */}
          <div>
            <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Tie-Breaker Rules</p>
              <div className={styles.segmentedControl}>
                {(['tournament', 'allow_override', 'per_division'] as const).map(scope => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setTieBreakerScope(scope)}
                    className={`${styles.segmentButton} ${tieBreakerScope === scope ? styles.segmentButtonActive : ''}`}
                  >
                    {scope === 'tournament' ? 'Tournament-wide'
                      : scope === 'allow_override' ? 'Allow override'
                      : 'Per division'}
                  </button>
                ))}
              </div>
            </div>
            {showTieBreakerList ? (
              <div style={{ marginTop: '0.75rem' }}>
                <TieBreakerEditor
                  idPrefix="event"
                  value={tieBreakers}
                  onChange={setTieBreakers}
                  cap={runDiffCap}
                  onCapChange={setRunDiffCap}
                />
                {tieBreakerScope === 'allow_override' && (
                  <p className={styles.inheritNote} style={{ marginTop: '0.5rem' }}>
                    Divisions can reorder, add/remove, and cap tie-breakers individually.
                  </p>
                )}
              </div>
            ) : (
              <p className={styles.descriptionText} style={{ marginTop: '0.5rem' }}>
                Each division must set its own tie-breaker order before the tournament can be activated.
              </p>
            )}
          </div>

          <hr className={styles.cardDivider} />

          {/* Score Finalization — a results-management rule (who approves scores),
              grouped here with the other game-results decisions. */}
          <div>
            <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
              <p className={styles.subSectionLabel} style={{ margin: 0 }}>Score Finalization</p>
              <div className={styles.segmentedControl} role="radiogroup" aria-label="Score finalization policy">
                {([
                  ['review', 'Admin Review'],
                  ['final',  'Final Immediately'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={scorePolicyMode === mode}
                    onClick={() => setScorePolicyMode(mode)}
                    className={`${styles.segmentButton} ${scorePolicyMode === mode ? styles.segmentButtonActive : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.descriptionText}>
              Admin review holds scorekeeper submissions in Pending Review until an admin finalizes them in Results.
              Final immediately makes a submission final as soon as it&apos;s saved.
            </p>
          </div>

        </CollapsibleCard>

        </div>{/* .cardStack */}

        {/* ── Save status footer ── */}
        <div className={styles.formFooter}>
          {saveStatus === 'saving' && (
            <span className={styles.saveStatusLabel}>
              <Loader2 size={12} className={styles.spinIcon} />
              Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className={styles.saveStatusLabel} style={{ color: 'var(--success)' }}>
              <Check size={12} />
              Saved
            </span>
          )}
          {saveStatus === 'idle' && slugHasChanged && (
            <span className={styles.unsavedLabel}>Public URL has unsaved changes</span>
          )}
        </div>
      </div>

      {/* ── Status confirm modal ── */}
      <FeedbackModal
        isOpen={statusConfirmOpen}
        onClose={() => { setStatusConfirmOpen(false); setPendingStatusChange(null); }}
        onConfirm={handleStatusConfirm}
        title={statusModalProps.title}
        message={statusModalProps.message}
        type={statusModalProps.type}
        confirmText={statusModalProps.confirmText}
      />

      {/* ── Format change confirm modal ── */}
      <FeedbackModal
        isOpen={formatConfirmOpen}
        onClose={() => { setFormatConfirmOpen(false); setPendingFormat(null); }}
        onConfirm={confirmFormatChange}
        title="Clear the existing schedule?"
        message={`Switching to ${pendingFormat === 'playoff_only' ? '“Bracket only”' : '“Round robin + playoffs”'} will permanently delete this tournament’s existing schedule (${existingGameCount} game${existingGameCount === 1 ? '' : 's'}), because round-robin and bracket schedules are built differently. This cannot be undone.`}
        type="warning"
        confirmText="Clear schedule & switch"
      />

      {/* ── Slug confirm modal ── */}
      <FeedbackModal
        isOpen={slugConfirmOpen}
        onClose={() => setSlugConfirmOpen(false)}
        onConfirm={handleSlugConfirm}
        title="Update Public URL?"
        message="Changing the URL breaks all existing registration links, coach emails, and bookmarked pages. This cannot be undone."
        type="warning"
        confirmText="Update URL"
      />

      {/* ── Organization address confirm modal ── */}
      <FeedbackModal
        isOpen={orgSlugConfirmOpen}
        onClose={() => setOrgSlugConfirmOpen(false)}
        onConfirm={handleOrgSlugUpdate}
        title="Update Organization Address?"
        message="This changes the address for your whole account — every tournament link, registration page, coach email, and bookmark that uses the old address will break. This cannot be undone."
        type="warning"
        confirmText="Update Address"
      />

      {/* ── Error modal ── */}
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
