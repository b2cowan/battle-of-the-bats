'use client';
/**
 * EVENT SETTINGS — one event's seven cards, each saving as you go (Tournament admin redesign Stage 5, E3: "the model"
 * for how a setup screen saves). In the Fees card's look since the Stage 5 addendum (A71–A77, owner 2026-10-12):
 *
 *   the look     every card on the kit's fields (ClubKit: a 12/650 label in sentence case, 40px boxes, 12px hints, no
 *                italics) — the public-site screen's stylesheet and the global form classes left this page; card
 *                titles 16px in sentence case (CollapsibleCard's kit title)
 *   switches     every on/off setting is one switch row whose whole width is the switch (SwitchRows, P1) — 16 of them,
 *                the Fees card's one included; the six coach emails dim while Automatic coach emails is off
 *   dropdowns    a choice of one value is a dropdown with its sentence under it; Tournament format reads as its value
 *                with a lock once the event leaves Draft
 *   tie-breakers the portal's reorder standard (TieBreakerEditor on ReorderList: Move up · Move down · Remove · Cancel)
 *   questions    the list lives in its card, each question a window over this page (RegistrationQuestions, A74)
 *   asking       the kit's question window (KitDialog) for a format change, a link change and a failure
 *   the address  the workspace's web address left for Settings & access (A75); the owner reads where, under Public URL
 *
 * On a phone a card opens in place, as at a desk (A77 — the portal's settings standard; full screen is a window's).
 * What any setting does, its default, who can change it and the order of the cards are unchanged.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, ClubRow, ClubRowList, RepChip, SavePill } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { SwitchFixedRow, SwitchRow, SwitchRows } from '@/components/admin/tournament/SwitchRows';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import RecordFromList from '@/components/admin/tournament/RecordFromList';
import { useTournamentLists } from '@/components/admin/tournament/useTournamentLists';
import { hasPlanFeature } from '@/lib/plan-features';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { INVITE_SETTINGS_WORDS, LOCK_WORDS } from '@/lib/invite-only-words';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { DEFAULT_ROSTER_WAIVER_TEXT, ROSTER_WAIVER_TEXT_MAX_LENGTH } from '@/lib/roster-requirements';
import type { GameTimingScope, TieBreakerScope, FeeScope, TournamentStatus, TournamentFormat } from '@/lib/types';
import { TOURNAMENT_FORMAT_OPTIONS, getTournamentFormat, tournamentFormatLabel, tournamentFormatSettingsDescription } from '@/lib/tournament-phase';
import TieBreakerEditor from '@/components/admin/TieBreakerEditor';
import { normalizeTieBreakers, clampRunDiffCap, DEFAULT_TIE_BREAKERS, type TieBreaker } from '@/lib/tie-breakers';
import { CANADIAN_PROVINCES } from '@/lib/canadian-provinces';
import { STATUS_WORD, statusSentence } from '@/lib/tournament-status-words';
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
import { EVENT_SETTINGS_WORDS as W } from '@/lib/event-settings-words';
import { WEB_ADDRESS_WORDS as WA } from '@/lib/web-address-words';
import { getWebAddressHref, isTournamentTier } from '@/lib/billing-urls';
import { cleanSlugInput, isSlug } from '@/lib/slug';
import { boardMoney } from '@/lib/tournament-board-words';
import { hasFiniteSlots } from '@/lib/tournament-slot';
import { DEFAULT_BOOKING_MINUTES } from '@/lib/booking-length';
import { formatTime } from '@/lib/utils';
import { fieldNounFor } from '@/lib/sports';
import { minutesToTime } from '@/lib/schedule-conflict';
import es from './event-settings.module.css';
import { RegistrationQuestionsList, useRegistrationQuestions } from './RegistrationQuestions';
import LoadingState from '@/components/shared/LoadingState';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/** Event settings' "?" (A56): its own help sub-topic. */
const EVENT_SETTINGS_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['settings-and-access'], subtopicId: 'event-settings-cards' };

type DivisionFee = { id: string; name: string; totalFeeAmount: number | null; depositAmount: number | null };

/**
 * The event's record, opened from Event settings' status (Stage 5, P5 / ask A49): the one home for every status change,
 * each asking first and naming the public site and the slot. It reads the club's events once it is asked for, and
 * opens on this event alone (no neighbours to step to — this page is about one event).
 */
function EventRecordWindow({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { currentOrg } = useOrg();
  const lists = useTournamentLists(currentOrg?.slug, currentOrg?.planId);
  const order = lists.events.filter(e => e.id === eventId);
  return <RecordFromList openId={eventId} order={order} lists={lists} onOpen={() => {}} onClose={onClose} />;
}

interface OrgMemberOption {
  id: string;
  email: string;
  displayName: string | null;
  title: string | null;
  role: string;
}

type ScorePolicyMode = 'review' | 'final';

/** Game timing's and the tie-breakers' scope: the same three choices, in this order. */
const SCOPES = ['tournament', 'allow_override', 'per_division'] as const;

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
  const { currentTournament, loading: tournamentLoading, refresh: refreshTournaments } = useTournament();
  const { currentOrg, userRole } = useOrg();
  usePageTitle('Event Settings');

  // Tournament identity
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentYear, setTournamentYear] = useState(new Date().getFullYear());
  const [tournamentSlug, setTournamentSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const slugCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // Public discovery directory — default ON (opt-out; mig 197). Organizers can hide an event here.
  const [listInDirectory, setListInDirectory] = useState(true);
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
    listInDirectory: true,
    directoryProvince: '',
  });

  // Save lifecycle — the floating pill (2026-09-20 / 2026-10-01): "Saving…", then "✓ Saved" fades; only a failure stays.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // The event's record, opened by the status's Change (Stage 5, P5).
  const [recordOpen, setRecordOpen] = useState(false);

  // The divisions and their own fees — Fees & Payments names the ones that set their own (J1-042).
  // undefined while the read is in flight; null when it failed (the row stays a door, with no caption — /review 2026-10-10).
  const [divisionFees, setDivisionFees] = useState<DivisionFee[] | null | undefined>(undefined);

  // Format change confirm (wipes the existing schedule)
  const [pendingFormat, setPendingFormat] = useState<TournamentFormat | null>(null);
  const [formatConfirmOpen, setFormatConfirmOpen] = useState(false);
  const [existingGameCount, setExistingGameCount] = useState(0);
  const [formatBusy, setFormatBusy] = useState(false);

  // Slug confirm modal
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);

  // A failure, said in the kit's asking window (it was a box titled "Error").
  const [failure, setFailure] = useState<{ title: string; body: string } | null>(null);

  const tournamentId = currentTournament?.id;
  // The status is the event's (the frame's read, re-read when the record changes it).
  const tournamentStatus: TournamentStatus = currentTournament?.status ?? 'draft';
  // An invite-only event (the free plan, a Premium coach's event — the free tournament tier, 2026-10-16): no
  // Registration questions or Fees & payments card, no registration alert routing, and Coach emails as three lock lines
  // (screen 3; M5 as ruled at the build start — the game-day reminder is Tournament Plus, A46). Every paid plan carries
  // the questions and the post-event email, so they need no lock of their own here.
  const inviteOnly = runsInviteOnlyEvents(currentOrg?.planId);
  const canUseRegistrationQuestions = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'custom_registration_fields'));
  const plusPanelHref = tournamentPlusPanelHref(currentOrg?.slug ?? 'admin');
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  // The questions live in their card (A74): read here, so the page's one pill also says their order's save.
  const questions = useRegistrationQuestions(tournamentId, orgQuery, canUseRegistrationQuestions);

  const slugHasChanged = tournamentSlug !== saved.slug;

  // ── Data load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tournamentId) return;
    // Another event: nothing auto-saves until its own read lands — the fields still hold the last event's values, and
    // a pause armed for them must never fire into this one.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event waits for its own read
    setIsInitialized(false);

    Promise.all([
      fetch(`/api/admin/tournaments${orgQuery}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : {}),
      fetch(`/api/admin/members${orgQuery}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([tournaments, branding, members, divisions]) => {
      setDivisionFees(Array.isArray(divisions)
        ? (divisions as DivisionFee[]).map(d => ({ id: d.id, name: d.name, totalFeeAmount: d.totalFeeAmount ?? null, depositAmount: d.depositAmount ?? null }))
        : null);
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
        const gd = typeof t.settings?.game_duration_minutes === 'number' ? t.settings.game_duration_minutes : DEFAULT_BOOKING_MINUTES;
        const buf = typeof t.settings?.buffer_minutes === 'number' ? t.settings.buffer_minutes : 15;
        const venueMoveBuf = typeof t.settings?.schedule_travel_venue_buffer_minutes === 'number' ? t.settings.schedule_travel_venue_buffer_minutes : 0;
        const facilityMoveBuf = typeof t.settings?.schedule_travel_facility_buffer_minutes === 'number' ? t.settings.schedule_travel_facility_buffer_minutes : 0;

        // Validated by the shared helper — never "anything else is round robin", which would have
        // read a third style as the wrong one silently.
        const fmt: TournamentFormat = getTournamentFormat(t);

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
    }).catch(() => { setFailure({ title: W.loadFailedTitle, body: W.loadFailedLine }); });
  }, [tournamentId, orgParam, orgQuery]);

  // ── Slug availability check — debounced 400 ms ────────────────────────────

  useEffect(() => {
    if (!tournamentId) return;
    if (!tournamentSlug || tournamentSlug === saved.slug) {
      setSlugStatus('idle');
      return;
    }
    if (!isSlug(tournamentSlug)) {
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

  // ── Core save — ref-based so auto-save always closes over latest state ────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A change is waiting out the pause (the timer above is armed for it): what leaving the screen sends at once.
  const autoSavePendingRef = useRef(false);

  // `flush`: the screen is going (another screen, another event, the tab closing) — send what is waiting, keepalive, and
  // touch nothing on the page: the page that would hear back is gone, or shows another event (as Public site's flush).
  const performSaveRef = useRef<((opts?: { slugOverride?: string; formatOverride?: TournamentFormat; flush?: boolean }) => Promise<void>) | null>(null);
  // What the last save was asked to carry (a confirmed public link, a style): the pill's Retry replays it — a plain save
  // would say "Saved" while the new public link was never written (/review 2026-10-10).
  const lastSaveOptsRef = useRef<{ slugOverride?: string; formatOverride?: TournamentFormat } | undefined>(undefined);

  useEffect(() => {
    performSaveRef.current = async (opts) => {
      if (!tournamentId || !currentTournament) return;
      const flush = opts?.flush === true;
      if (!flush) lastSaveOptsRef.current = opts;
      const slugToSave = opts?.slugOverride ?? saved.slug;
      const formatToSave = opts?.formatOverride ?? tournamentFormat;

      if (!flush) {
        setSaveStatus('saving');
        setSaveError('');
      }
      try {
        const [tournamentRes, brandingRes, schedulingRes] = await Promise.all([
          fetch(`/api/admin/tournaments${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: flush,
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
            keepalive: flush,
            body: JSON.stringify({ requireScoreFinalization: scorePolicyValue(scorePolicyMode) }),
          }),
          fetch(`/api/admin/tournaments${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: flush,
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
        if (flush) return;

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

        setSaved(prev => ({
          name: tournamentName,
          year: tournamentYear,
          slug: slugToSave,
          status: prev.status,
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
      } catch (err: unknown) {
        if (flush) return;
        // The pill says it and offers Retry; it stays until a save lands.
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : 'Couldn’t save');
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

  // ── Unsaved changes: a field differs from the last saved snapshot (the auto-save's trigger, and the floating
  // pill's "Unsaved changes" while the 1.2 s pause runs). Hydration sets every field AND isInitialized in one batch;
  // only a real difference counts. The public link saves through its own Change, which asks first.
  const fieldsDirty = isInitialized && (
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
    rosterMaxPlayers !== saved.rosterMaxPlayers
  );

  // ── Auto-save effect — fires 1.2 s after any non-status, non-slug change ──

  useEffect(() => {
    autoSavePendingRef.current = false;
    if (!isInitialized || !tournamentId) return;
    // Hydration sets every field AND isInitialized in one batch, which would
    // otherwise look like a "change" and auto-save on load (and re-fire on every
    // tournament switch). Only save when a field actually differs from the last
    // persisted snapshot.
    if (!fieldsDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSavePendingRef.current = true;
    autoSaveTimerRef.current = setTimeout(() => {
      autoSavePendingRef.current = false;
      performSaveRef.current?.();
    }, 1200);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [
    isInitialized, tournamentId, saved, fieldsDirty,
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

  // ── Leaving with a change still waiting: send it now, to its own event (walk §292, owner 2026-10-12) ──
  // A change made inside the 1.2 s pause was dropped without a word when the screen went — another screen, another
  // event, the tab closing — while Public site sends its waiting change as the page goes. Now this one does too. The
  // cleanup runs before this render re-binds the save, so the save it calls still carries the old event and its values.
  const flushPendingSave = useCallback(() => {
    if (!autoSavePendingRef.current) return;
    autoSavePendingRef.current = false;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    void performSaveRef.current?.({ flush: true });
  }, []);
  useEffect(() => () => flushPendingSave(), [tournamentId, flushPendingSave]);
  useEffect(() => {
    window.addEventListener('pagehide', flushPendingSave);
    return () => window.removeEventListener('pagehide', flushPendingSave);
  }, [flushPendingSave]);

  // ── Helpers ───────────────────────────────────────────────────────────────

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
      setFailure({ title: W.formatFailedTitle, body: err instanceof Error ? err.message : 'Nothing was changed.' });
    } finally {
      setPendingFormat(null);
    }
  }

  function handleSlugConfirm() {
    const newSlug = tournamentSlug;
    setSlugConfirmOpen(false);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    performSaveRef.current?.({ slugOverride: newSlug });
  }

  // The status, said once in the event record's own sentence (Stage 5, P5: the Draft / Active / Completed switch went —
  // its record is the one home for a status change, each asking first). A draft adds what Activate needs (J1-032: never
  // fees or game timing).
  const statusLine = statusSentence({
    status: tournamentStatus,
    startDate: startDate || null,
    endDate: endDate || null,
    today: tournamentToday(),
    finiteSlots: hasFiniteSlots(currentOrg?.tournamentLimit),
    sealed: false,
  });

  if (userRole !== 'owner' && userRole !== 'admin') {
    return (
      <div className={es.page}>
        <p className={es.quiet}>Event settings can be managed by admins and owners.</p>
      </div>
    );
  }

  if (!tournamentId) {
    // The tournament itself still loading is a wait, not "no tournament".
    if (tournamentLoading) return <div className={es.page}><LoadingState label="Loading event settings…" /></div>;
    return (
      <div className={es.page}>
        <p className={es.quiet}>Select a tournament from the sidebar to manage event settings.</p>
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
    const fmt = tournamentFormatLabel(tournamentFormat);
    const timing = gameTimingScope === 'per_division' ? 'per-division timing'
      : `${gameDurationMinutes}m games`;
    return `${fmt} · ${timing}`;
  })();

  const feeSummary = (() => {
    if (feeScope === 'free') return W.feeSummaryNotTracked;
    if (feeScope === 'per_division') return W.feeOptions.per_division;
    if (feeScope === 'allow_override') return 'Default + overrides';
    if (feeScope === 'tournament') {
      return totalFeeAmount ? `$${totalFeeAmount} / team` : 'Tournament-wide';
    }
    return 'Not set';
  })();

  // Contact card — who people reach / who you notify.
  const contactSummary = (() => {
    if (inviteOnly) return INVITE_SETTINGS_WORDS.contactSummary(contactShowOnPublic);
    const visibility = contactShowOnPublic ? 'contact public' : 'contact hidden';
    return `${notifyMode === 'all' ? 'All registrations' : 'Assigned only'} · ${visibility}`;
  })();

  // Coach Emails card — what the system auto-sends.
  const coachEmailsSummary = (() => {
    if (inviteOnly) return INVITE_SETTINGS_WORDS.coachEmailsSummary;
    if (coachEmailPauseAll) return 'Auto emails off';
    const offCount = [
      coachEmailConfirmation, coachEmailAcceptance, coachEmailRejection,
      ...(feeScope === 'free' ? [] : [coachEmailPayment]), coachEmailSchedule, coachEmailGameDay,
    ].filter(v => v === false).length;
    return offCount > 0 ? `Auto emails on · ${offCount} off` : 'Auto emails on';
  })();

  const rosterSummary = rosterRequire
    ? `Required${rosterSizeSummary ? ` · ${rosterSizeSummary}` : ''}`
    : 'Not required';

  // What the card holds ("No questions yet", "3 questions"), not what it is for (A74).
  const registrationQuestionsSummary = questions.summary;

  // The web address lives where the plan keeps it (A75): the owner reads where, under Public URL.
  const webAddressHref = getWebAddressHref(currentOrg?.slug ?? 'admin', currentOrg?.planId);
  const webAddressLine = isTournamentTier(currentOrg?.planId) ? WA.publicUrlTournament : WA.publicUrlClub;

  // The page's one floating pill says both saves: the settings' and the questions' order.
  const pillError = saveStatus === 'error' ? saveError || 'Couldn’t save' : questions.order.error;
  const retrySave = () => {
    if (saveStatus === 'error') void performSaveRef.current?.(lastSaveOptsRef.current);
    else questions.order.retry();
  };

  return (
    <div className={es.page}>
      {/* F3: the tournament's name moves to the eyebrow (a link to its dashboard, as every tournament page's does). */}
      <AdminPageHeader
        inlineActions
        title={W.title}
        actions={<HelpButton help={EVENT_SETTINGS_HELP} label={W.title} iconOnly />}
      />

      <div className={es.cards}>

        {/* ── Card 1: Tournament overview ── */}
        <CollapsibleCard title={W.cards.overview} sectionId="overview" defaultOpen={false} meta={overviewSummary}>

          <label className={ck.field} htmlFor="event-name">
            <span className={ck.label}>Tournament name</span>
            <input
              id="event-name"
              className={ck.input}
              type="text"
              maxLength={80}
              value={tournamentName}
              onChange={e => setTournamentName(e.target.value)}
              placeholder="e.g. Spring Invitational 2026"
            />
          </label>

          <hr className={es.rule} />

          {/* The status, said once — Change opens the event's record (Stage 5, P5) */}
          <div className={ck.field}>
            <span className={ck.label}>{W.status}</span>
            <div className={es.status}>
              <RepChip tone={tournamentStatus === 'active' ? 'good' : 'neutral'}>{STATUS_WORD[tournamentStatus as keyof typeof STATUS_WORD] ?? STATUS_WORD.draft}</RepChip>
              <p className={es.statusText}>
                {statusLine}{tournamentStatus === 'draft' ? ` ${W.activateNeeds}` : ''}
              </p>
              <button type="button" className={`btn btn-outline ${es.change}`} aria-haspopup="dialog" onClick={() => setRecordOpen(true)}>
                {W.change}
              </button>
            </div>
          </div>

          <hr className={es.rule} />

          {/* Public discovery directory listing (mig 158; default flipped ON / opt-out in mig 197) */}
          <div className={es.switches}>
            <SwitchRows>
              <SwitchRow
                on={listInDirectory}
                onToggle={() => setListInDirectory(v => !v)}
                name="List in the public tournament directory"
                caption="Show this tournament on the FieldLogicHQ public directory, where anyone can discover it by sport, region, and date."
              />
            </SwitchRows>
          </div>

          {listInDirectory && (
            <>
              <p className={es.note}>
                The directory shows your event name, dates, sport, and live scores, and links to your existing public pages. <strong>Player information always stays private.</strong> Your listing appears only once the tournament is set to Active or Completed — a draft stays hidden.
              </p>
              <label className={ck.field} htmlFor="directory-province">
                <span className={ck.label}>Province / territory</span>
                <select
                  id="directory-province"
                  className={`${ck.select} ${es.choice}`}
                  value={directoryProvince}
                  onChange={e => setDirectoryProvince(e.target.value)}
                >
                  <option value="">— Select a region —</option>
                  {CANADIAN_PROVINCES.map(p => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
                <span className={ck.hint}>Lets people filter the directory by where your tournament is held.</span>
              </label>
            </>
          )}

          {/* Dates */}
          <div className={es.two}>
            <label className={ck.field} htmlFor="event-start">
              <span className={ck.label}>Start date</span>
              <input
                id="event-start"
                className={ck.input}
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
            </label>
            <label className={ck.field} htmlFor="event-end">
              <span className={ck.label}>End date</span>
              <input
                id="event-end"
                className={ck.input}
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
              />
            </label>
          </div>

          {/* Public URL — owner only. The first part, the workspace's web address, is changed on Settings & access
              (Tournament, Tournament Plus) or the organization's Settings (League, Club) — A75. */}
          {userRole === 'owner' && (
            <>
              <hr className={es.rule} />
              <div className={ck.field}>
                <label className={ck.label} htmlFor="event-url">Public URL</label>
                <input
                  id="event-url"
                  className={ck.input}
                  type="text"
                  value={tournamentSlug}
                  onChange={e => setTournamentSlug(cleanSlugInput(e.target.value))}
                  placeholder="e.g. spring-invitational-2026"
                />
                <p className={es.url}>
                  fieldlogichq.ca/{currentOrg?.slug}/<b>{tournamentSlug || '…'}</b>
                </p>
                {slugStatus === 'checking' && <p className={ck.hint}>Checking availability…</p>}
                {slugStatus === 'available' && <p className={es.good}>✓ Available</p>}
                {slugStatus === 'taken' && <p className={es.bad}>✗ That URL is already taken</p>}
                {slugStatus === 'invalid' && <p className={es.bad}>Lowercase letters, numbers, and hyphens only</p>}
                <p className={ck.hint}>
                  {WA.publicUrlLead(currentOrg?.slug ?? '')} <Link href={webAddressHref} className={es.inlineLink}>{webAddressLine}</Link>
                </p>
              </div>
              {slugHasChanged && (
                <>
                  <Callout tone="warn" icon={<AlertTriangle size={16} aria-hidden />}>
                    Changing the Public URL breaks all existing registration links, coach emails, and bookmarked pages.
                  </Callout>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid'}
                    aria-haspopup="dialog"
                    onClick={() => setSlugConfirmOpen(true)}
                  >
                    {W.changeUrl}
                  </button>
                </>
              )}
            </>
          )}
        </CollapsibleCard>

        {/* ── Card 2: Registration questions — the list lives in its card (A74). Absent on an invite-only event: no
            registration form for questions to sit on (it was a lock callout, F09). ── */}
        {!inviteOnly && (
          <CollapsibleCard title={W.cards.questions} sectionId="questions" defaultOpen={false} meta={registrationQuestionsSummary}>
            <RegistrationQuestionsList key={questions.apiBase} q={questions} orgQuery={orgQuery} />
          </CollapsibleCard>
        )}

        {/* ── Card 3: Roster requirements (Phase 5f) — read by the Coaches Portal event-roster submission (5h/5k).
            Applies to the per-event snapshot only, never to a coach's master roster. ── */}
        <CollapsibleCard title={W.cards.roster} sectionId="roster" defaultOpen={false} meta={rosterSummary}>
          <div className={es.switches}>
            <SwitchRows>
              <SwitchRow
                on={rosterRequire}
                onToggle={() => setRosterRequire(v => !v)}
                name="Event roster"
                caption="Ask accepted teams to submit a roster for this event from their Coaches Portal. When off, teams aren’t asked for a roster."
              />
            </SwitchRows>
          </div>

          {rosterRequire ? (
            <>
              <hr className={es.rule} />

              <p className={es.group}>Required details</p>
              <p className={es.note}>
                Coaches are asked for exactly what you require here and nothing more. These apply to this
                event&apos;s roster submission only — they never change what a coach keeps on their own team roster.
              </p>
              <div className={es.switches}>
                <SwitchRows>
                  {/* Names aren't a switch — every submission carries them from the coach's saved roster. */}
                  <SwitchFixedRow
                    name="Player names"
                    caption="Every roster submission includes each player’s full name, taken from the coach’s saved team roster."
                    word="Always"
                  />
                  <SwitchRow
                    on={rosterRequireDob}
                    onToggle={() => setRosterRequireDob(v => !v)}
                    name="Player birthdates"
                    caption="Each player on the submitted roster needs a date of birth (e.g. for age verification). Collected for this event only."
                  />
                  <SwitchRow
                    on={rosterRequireJersey}
                    onToggle={() => setRosterRequireJersey(v => !v)}
                    name="Jersey numbers"
                    caption="Each player on the submitted roster needs a jersey number."
                  />
                  <SwitchRow
                    on={rosterRequireWaiver}
                    onToggle={() => setRosterRequireWaiver(v => !v)}
                    name="Waiver acknowledgment"
                    caption="The coach must tick a waiver acknowledgment to submit. No document is uploaded or stored."
                  />
                </SwitchRows>
              </div>

              {rosterRequireWaiver && (
                <label className={ck.field} htmlFor="roster-waiver">
                  <span className={ck.label}>Waiver statement</span>
                  <textarea
                    id="roster-waiver"
                    className={ck.textarea}
                    rows={3}
                    maxLength={ROSTER_WAIVER_TEXT_MAX_LENGTH}
                    placeholder={DEFAULT_ROSTER_WAIVER_TEXT}
                    value={rosterWaiverText}
                    onChange={e => setRosterWaiverText(e.target.value)}
                  />
                  <span className={ck.hint}>
                    This is exactly what the coach ticks agreement to when submitting. Leave blank to use the
                    default wording shown above.
                  </span>
                </label>
              )}

              <hr className={es.rule} />

              <p className={es.group}>Roster size</p>
              <p className={es.note}>Leave a field blank for no limit.</p>
              <div className={es.two}>
                <label className={ck.field} htmlFor="roster-min">
                  <span className={ck.label}>Minimum players</span>
                  <input
                    id="roster-min"
                    className={ck.input}
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
                </label>
                <label className={ck.field} htmlFor="roster-max">
                  <span className={ck.label}>Maximum players</span>
                  <input
                    id="roster-max"
                    className={ck.input}
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
                </label>
              </div>
              {rosterMinPlayers !== '' && rosterMaxPlayers !== '' && Number(rosterMinPlayers) > Number(rosterMaxPlayers) && (
                <p className={es.warn}>
                  Minimum is greater than maximum — no roster could satisfy both. Adjust one of the two.
                </p>
              )}

              <hr className={es.rule} />

              {/* Live sample of the coach-side submission for the current choices. */}
              <p className={es.group}>What the coach will see</p>
              <p className={es.note}>
                A sample of the submission this event asks for — it updates as you change the requirements above.
                Coaches pick players from their saved team roster and fill in only what&apos;s required.
              </p>
              <div className={es.sample}>
                <p className={es.sampleHead}>For each player</p>
                <ul className={es.sampleList}>
                  <li>Full name <span className={es.sampleQuiet}>(always included)</span></li>
                  {rosterRequireDob && <li>Date of birth</li>}
                  {rosterRequireJersey && <li>Jersey number</li>}
                </ul>
                {(rosterRequireWaiver || rosterSizeSummary) && (
                  <>
                    <p className={es.sampleHead}>To submit</p>
                    {rosterSizeSummary && (
                      <p className={es.sampleLine}>The roster must list {rosterSizeSummary}.</p>
                    )}
                    {rosterRequireWaiver && (
                      <p className={`${es.sampleLine} ${es.sampleTick}`}>
                        <span aria-hidden="true">☐</span>
                        <span>{effectiveWaiverText}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p className={ck.hint}>
              Teams can take part without submitting a roster. Turn this on to collect one per team before game day.
            </p>
          )}
        </CollapsibleCard>

        {/* ── Card 4: Fees & payments — absent on an invite-only event (no fees or payment tracking, R3) ── */}
        {!inviteOnly && (
        <CollapsibleCard title={W.cards.fees} sectionId="fees" defaultOpen={false} meta={feeSummary}>
          {/* A choice of one value is a dropdown, at every width (2026-08-22); its fourth choice says the fees aren't
              tracked here — never "Free" (F92). The stored value `free` is unchanged. */}
          <label className={ck.field} htmlFor="fee-model">
            <span className={ck.label}>{W.feeModel}</span>
            <select
              id="fee-model"
              className={`${ck.select} ${es.choice}`}
              value={feeScope ?? ''}
              onChange={e => setFeeScope((e.target.value || null) as FeeScope | null)}
            >
              {!feeScope && <option value="">{W.feeModelChoose}</option>}
              {(['tournament', 'allow_override', 'per_division', 'free'] as const).map(scope => (
                <option key={scope} value={scope}>{W.feeOptions[scope]}</option>
              ))}
            </select>
            {feeScope && feeScope !== 'tournament' && <span className={ck.hint}>{W.feeLine[feeScope]}</span>}
          </label>
          {feeScope !== 'free' && feeScope !== 'per_division' && (
            <>
              <div className={es.two}>
                <label className={ck.field} htmlFor="fee-deposit">
                  <span className={ck.label}>Deposit amount ($)</span>
                  <input id="fee-deposit" className={ck.input} type="number" min="0" step="0.01" placeholder="e.g. 200" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                </label>
                <label className={ck.field} htmlFor="fee-deposit-due">
                  <span className={ck.label}>Deposit due date</span>
                  <input id="fee-deposit-due" className={ck.input} type="date" value={depositDueDate} onChange={e => setDepositDueDate(e.target.value)} />
                </label>
                <label className={ck.field} htmlFor="fee-total">
                  <span className={ck.label}>Total fee ($)</span>
                  <input id="fee-total" className={ck.input} type="number" min="0" step="0.01" placeholder="e.g. 500" value={totalFeeAmount} onChange={e => setTotalFeeAmount(e.target.value)} />
                </label>
                <label className={ck.field} htmlFor="fee-total-due">
                  <span className={ck.label}>Total fee due date</span>
                  <input id="fee-total-due" className={ck.input} type="date" value={totalFeeDueDate} onChange={e => setTotalFeeDueDate(e.target.value)} />
                </label>
              </div>
            </>
          )}
          {showFeeInputs && !feeScope && (
            <p className={ck.hint}>{W.feeChoose}</p>
          )}

          {/* Which divisions set their own fee — said here, a door to Divisions (J1-042). */}
          {(feeScope === 'per_division' || feeScope === 'allow_override') && (() => {
            const money = (n: number | null) => (n != null && n > 0 ? boardMoney(n) : null);
            const own = (divisionFees ?? []).filter(d => money(d.totalFeeAmount));
            const caption = divisionFees === undefined ? W.divisionsLoading
              : divisionFees === null ? undefined
              : feeScope === 'per_division'
                ? (divisionFees.length
                  ? divisionFees.map(d => `${d.name} ${money(d.totalFeeAmount) ?? `(${W.noFeeYet})`}`).join(' · ')
                  : W.noneYet)
                : (own.length ? own.map(d => `${d.name} ${money(d.totalFeeAmount)}`).join(' · ') : W.noneYet);
            return (
              <div className={es.feeDoor}>
                {/* Inset: the card paints the ground (one painter); the door's outline is the door's own. */}
                <ClubRowList inset label={feeScope === 'per_division' ? W.eachDivisionsFee : W.divisionsWithOwnFee}>
                  <ClubRow
                    as="link"
                    href={`/${currentOrg?.slug ?? 'admin'}/admin/tournaments/divisions`}
                    title={feeScope === 'per_division' ? W.eachDivisionsFee : W.divisionsWithOwnFee}
                    caption={caption}
                    chevron
                  />
                </ClubRowList>
              </div>
            );
          })()}

          {feeScope && feeScope !== 'free' && (
            <>
              <hr className={es.rule} />

              {/* Public registration form — fee display (an on/off is a switch) + how-to-pay instructions */}
              <div className={es.switches}>
                <SwitchRows>
                  <SwitchRow
                    on={showFeesOnRegister}
                    onToggle={() => setShowFeesOnRegister(v => !v)}
                    name={W.feeDetails}
                    caption={W.feeDetailsLine}
                  />
                </SwitchRows>
              </div>
              {!showFeesOnRegister && <p className={es.note}>{W.feeDetailsHidden}</p>}

              <label className={ck.field} htmlFor="payment-instructions">
                <span className={ck.label}>Payment instructions</span>
                <textarea
                  id="payment-instructions"
                  className={ck.textarea}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. E-transfer to treasurer@club.ca with your team name in the memo. Balance due by the date above."
                  value={paymentInstructions}
                  onChange={e => setPaymentInstructions(e.target.value)}
                />
              </label>
              <label className={ck.field} htmlFor="instructions-where">
                <span className={ck.label}>{W.whereTheyAppear}</span>
                <select
                  id="instructions-where"
                  className={`${ck.select} ${es.choice}`}
                  value={paymentInstructionsOnForm ? 'form' : 'email'}
                  onChange={e => setPaymentInstructionsOnForm(e.target.value === 'form')}
                >
                  <option value="email">{W.appearOptions.email}</option>
                  <option value="form">{W.appearOptions.form}</option>
                </select>
                <span className={ck.hint}>
                  Payment instructions are always included in the acceptance email and shown to accepted coaches in their Coaches Portal. Choose &ldquo;The registration form and the email&rdquo; to also show them on the public registration form before teams register.
                </span>
              </label>
            </>
          )}
        </CollapsibleCard>
        )}

        {/* ── Card 5: Contact ── */}
        <CollapsibleCard title={W.cards.contact} sectionId="contact" defaultOpen={false} meta={contactSummary}>

          {/* Public contact */}
          <p className={es.group}>Public contact</p>
          <p className={es.note}>{W.publicContactLine}</p>
          <label className={ck.field} htmlFor="contact-member">
            <span className={ck.label}>Contact member</span>
            <select
              id="contact-member"
              className={`${ck.select} ${es.choice}`}
              value={defaultContactMemberId ?? ''}
              onChange={e => setDefaultContactMemberId(e.target.value || null)}
            >
              <option value="">
                {ownerMember
                  ? `${ownerMember.displayName ?? ownerMember.email} (owner)`
                  : 'Organization owner'}
              </option>
              {orgMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.displayName ?? m.email}
                  {m.title ? ` — ${m.title}` : ''}
                  {' '}({m.role === 'owner' ? 'owner' : m.role})
                </option>
              ))}
            </select>
            {defaultContactMemberId && (() => {
              const selected = orgMembers.find(m => m.id === defaultContactMemberId);
              return selected ? (
                <span className={ck.hint}>Selected contact: <strong className={es.strong}>{selected.email}</strong></span>
              ) : null;
            })()}
          </label>

          {/* Per-audience visibility (migration 120) */}
          <div className={es.switches}>
            <SwitchRows>
              <SwitchRow
                on={contactShowToCoaches}
                onToggle={() => setContactShowToCoaches(v => !v)}
                name="Communication with coaches"
                caption="Show this email to registered coaches — in coach-facing emails (registration, acceptance, payment) and in the Coaches Portal."
              />
              <SwitchRow
                on={contactShowOnPublic}
                onToggle={() => setContactShowOnPublic(v => !v)}
                name="Show on public site"
                caption="Display this email on your public tournament pages. Turn off to keep it out of reach of spam bots."
              />
            </SwitchRows>
          </div>
          {!contactShowToCoaches && !contactShowOnPublic && (
            <p className={es.warn}>
              This contact email is hidden everywhere. Coaches won&apos;t see a reply-to address and no contact appears publicly.
            </p>
          )}

          {/* Registration alert routing — not on an invite-only event: no registration arrives to route. */}
          {!inviteOnly && (<>
          <hr className={es.rule} />

          <label className={ck.field} htmlFor="alert-routing">
            <span className={ck.label}>Registration alert routing</span>
            <select
              id="alert-routing"
              className={`${ck.select} ${es.choice}`}
              value={notifyMode}
              onChange={e => setNotifyMode(e.target.value === 'assigned' ? 'assigned' : 'all')}
            >
              <option value="all">All registrations</option>
              <option value="assigned">Assigned only</option>
            </select>
            <span className={ck.hint}>
              {notifyMode === 'all'
                ? 'Organization owners and admins are notified for every registration. If a division has an assigned contact, they are notified too.'
                : "Only the division-assigned contact is notified. Owners and admins are not notified for divisions they've delegated."}
              {' '}Divisions without an assigned contact always notify tournament admins regardless of this setting.
            </span>
          </label>
          </>)}
        </CollapsibleCard>

        {/* ── Card 6: Coach emails ── */}
        <CollapsibleCard title={W.cards.coachEmails} sectionId="coach-emails" defaultOpen={false} meta={coachEmailsSummary}>
          {inviteOnly ? (
            // Every automatic coach email is Tournament Plus or never fires on an invite-only event (the invitation is
            // sent from Add team): one lock line each for what Tournament Plus sends — no switch (M5, A46).
            <div className={es.switches}>
              <PlanLockLine href={plusPanelHref}>{LOCK_WORDS.publishEmail}</PlanLockLine>
              <PlanLockLine href={plusPanelHref}>{LOCK_WORDS.gameDayEmail}</PlanLockLine>
              <PlanLockLine href={plusPanelHref}>{LOCK_WORDS.resultsEmail}</PlanLockLine>
            </div>
          ) : (<>

          {/* The master switch, positive at the top. Persisted as coach_email_pause_all (true = off); the switch
              binds to its inverse so "on" reads as "sending" (no double-negative). The six follow it straight
              after; with it off they dim and keep their own settings (D4). */}
          <div className={es.switches}>
            <SwitchRows>
              <SwitchRow
                on={!coachEmailPauseAll}
                onToggle={() => setCoachEmailPauseAll(v => !v)}
                name="Automatic coach emails"
                caption="When on, the emails below send automatically to each team’s coach/contact. Turn off to handle all coach communication yourself — your manual tools (announcements, payment reminders, resend access) are unaffected."
              />
            </SwitchRows>
          </div>
          {coachEmailPauseAll && <p className={es.warn}>{W.coachEmailsOff}</p>}
          <div className={es.switches}>
            <SwitchRows label="Automatic emails">
              {([
                ['Registration received', 'Sent to the coach when they submit a registration (confirmation or waitlist receipt).', coachEmailConfirmation, setCoachEmailConfirmation] as const,
                ['Team accepted', 'Sent when a team is accepted into the tournament.', coachEmailAcceptance, setCoachEmailAcceptance] as const,
                ['Registration declined', 'Sent when a registration is declined.', coachEmailRejection, setCoachEmailRejection] as const,
                // "Not tracked here": no payment is recorded on the platform, so the email has no switch (it never sends).
                ...(feeScope === 'free' ? [] : [['Payment recorded', 'Sent when a team is marked as paid.', coachEmailPayment, setCoachEmailPayment] as const]),
                ['Schedule published', 'Sent to accepted teams when you publish a schedule.', coachEmailSchedule, setCoachEmailSchedule] as const,
                ['Game-day reminder', 'Sent the evening before each team’s first game.', coachEmailGameDay, setCoachEmailGameDay] as const,
              ]).map(([label, desc, value, setValue]) => (
                <SwitchRow key={label} on={value} onToggle={() => setValue(!value)} name={label} caption={desc} dim={coachEmailPauseAll} />
              ))}
            </SwitchRows>
          </div>

          <hr className={es.rule} />

          {/* Post-event results — On / Off like the rest (it said Enabled / Disabled) */}
          <div className={es.switches}>
            <SwitchRows>
              <SwitchRow
                on={notifyTeamsOnComplete}
                onToggle={() => setNotifyTeamsOnComplete(v => !v)}
                name="Post-event results"
                caption={W.postEventLine}
              />
            </SwitchRows>
          </div>
          {resultsNotifiedAt && (
            <p className={es.sent}>
              Results notification sent to {resultsNotificationSentCount} team contact{resultsNotificationSentCount === 1 ? '' : 's'} on {formatStoredDate(resultsNotifiedAt, { withYear: true })}.
            </p>
          )}
          </>)}
        </CollapsibleCard>

        {/* ── Card 7: Schedule rules ── */}
        <CollapsibleCard title={W.cards.schedule} sectionId="schedule" defaultOpen={false} meta={scheduleRulesSummary}>

          {/* Tournament format — a dropdown while the event is a draft; once it leaves Draft, its value, locked. */}
          {formatLocked ? (
            <div className={ck.field}>
              <span className={ck.label}>Tournament format</span>
              <span className={es.readValue}><Lock size={14} aria-hidden /> {tournamentFormatLabel(tournamentFormat)}</span>
              <span className={ck.hint}>
                {tournamentFormatSettingsDescription(tournamentFormat)} The tournament format is locked once the event leaves Draft. Set the status back to Draft to change it.
              </span>
            </div>
          ) : (
            <label className={ck.field} htmlFor="tournament-format">
              <span className={ck.label}>Tournament format</span>
              <select
                id="tournament-format"
                className={`${ck.select} ${es.choice}`}
                value={tournamentFormat}
                disabled={formatBusy}
                onChange={e => void requestFormatChange(e.target.value as TournamentFormat)}
              >
                {TOURNAMENT_FORMAT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.title}</option>
                ))}
              </select>
              <span className={ck.hint}>{tournamentFormatSettingsDescription(tournamentFormat)}</span>
            </label>
          )}

          <hr className={es.rule} />

          {/* Game timing */}
          <label className={ck.field} htmlFor="game-timing">
            <span className={ck.label}>Game timing</span>
            <select
              id="game-timing"
              className={`${ck.select} ${es.choice}`}
              value={gameTimingScope ?? 'tournament'}
              onChange={e => setGameTimingScope(e.target.value as GameTimingScope)}
            >
              {SCOPES.map(scope => <option key={scope} value={scope}>{W.scopeOptions[scope]}</option>)}
            </select>
            {!showTimingInputs && <span className={ck.hint}>{W.timingPerDivision}</span>}
          </label>
          {showTimingInputs && (
            <>
              <div className={es.two}>
                <label className={ck.field} htmlFor="game-duration">
                  <span className={ck.label}>Game duration (minutes)</span>
                  <input
                    id="game-duration"
                    className={ck.input}
                    type="number"
                    min="1" max="600" step="5"
                    value={gameDurationMinutes}
                    onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n > 0) setGameDurationMinutes(n); }}
                  />
                </label>
                {/* "Turnover", the generator's word for the gap between games on one diamond (walk §294, one word). */}
                <label className={ck.field} htmlFor="game-turnover">
                  <span className={ck.label}>Turnover between games (minutes)</span>
                  <input
                    id="game-turnover"
                    className={ck.input}
                    type="number"
                    min="0" max="120" step="5"
                    value={bufferMinutes}
                    onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) setBufferMinutes(n); }}
                  />
                </label>
              </div>
              <p className={es.note}>
                {/* The house clock ("9:45 a.m."), which ends the sentence: no second period (F114, "a.m.."). */}
                Example: a {gameDurationMinutes}-minute game at 8:00 a.m. → the next game on that {fieldNounFor(currentTournament?.sport).toLowerCase()} no earlier than {formatTime(minutesToTime(8 * 60 + gameDurationMinutes + bufferMinutes))}
                {gameTimingScope === 'allow_override' && ' Divisions can set their own values.'}
              </p>
            </>
          )}

          <p className={es.group}>Travel and setup buffers</p>
          <p className={es.note}>
            Optional organizer-entered estimates used by Schedule Health and the generator when teams move between facilities. FieldLogicHQ does not calculate drive time.
          </p>
          <div className={es.two}>
            <label className={ck.field} htmlFor="venue-buffer">
              <span className={ck.label}>Venue move buffer (minutes)</span>
              <input
                id="venue-buffer"
                className={ck.input}
                type="number"
                min="0"
                max="240"
                step="5"
                value={venueMoveBufferMinutes}
                onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) setVenueMoveBufferMinutes(n); }}
              />
            </label>
            <label className={ck.field} htmlFor="facility-buffer">
              <span className={ck.label}>Facility move buffer (minutes)</span>
              <input
                id="facility-buffer"
                className={ck.input}
                type="number"
                min="0"
                max="240"
                step="5"
                value={facilityMoveBufferMinutes}
                onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 0) setFacilityMoveBufferMinutes(n); }}
              />
            </label>
          </div>
          <p className={es.note}>
            Set 0 to ignore that move type. These buffers score tight team moves; they do not create hard venue conflicts.
          </p>

          <hr className={es.rule} />

          {/* Tie-breaker rules — the list on the portal's reorder standard (A73) */}
          <label className={ck.field} htmlFor="tie-breaker-scope">
            <span className={ck.label}>Tie-breaker rules</span>
            <select
              id="tie-breaker-scope"
              className={`${ck.select} ${es.choice}`}
              value={tieBreakerScope ?? 'tournament'}
              onChange={e => setTieBreakerScope(e.target.value as TieBreakerScope)}
            >
              {SCOPES.map(scope => <option key={scope} value={scope}>{W.scopeOptions[scope]}</option>)}
            </select>
            {!showTieBreakerList && (
              <span className={ck.hint}>Each division must set its own tie-breaker order before the tournament can be activated.</span>
            )}
            {showTieBreakerList && tieBreakerScope === 'allow_override' && (
              <span className={ck.hint}>Divisions can reorder, add/remove, and cap tie-breakers individually.</span>
            )}
          </label>
          {showTieBreakerList && (
            <TieBreakerEditor
              idPrefix="event"
              value={tieBreakers}
              onChange={setTieBreakers}
              cap={runDiffCap}
              onCapChange={setRunDiffCap}
            />
          )}

          <hr className={es.rule} />

          {/* Score finalization — a results-management rule (who approves scores), grouped here with the other
              game-results decisions. */}
          <label className={ck.field} htmlFor="score-finalization">
            <span className={ck.label}>Score finalization</span>
            <select
              id="score-finalization"
              className={`${ck.select} ${es.choice}`}
              value={scorePolicyMode}
              onChange={e => setScorePolicyMode(e.target.value === 'final' ? 'final' : 'review')}
            >
              <option value="review">Admin review</option>
              <option value="final">Final immediately</option>
            </select>
            <span className={ck.hint}>
              Admin review holds scorekeeper submissions in Pending Review until an admin finalizes them in Results.
              Final immediately makes a submission final as soon as it&apos;s saved.
            </span>
          </label>

        </CollapsibleCard>

      </div>

      {/* The save word — the floating pill every autosaving admin screen uses (the 1.2 s pause before a save is unchanged);
          it says the questions' order too, so two saves never stack two pills. */}
      <SavePill
        saving={saveStatus === 'saving' || questions.order.saving}
        dirty={fieldsDirty}
        error={pillError}
        onRetry={retrySave}
      />

      {recordOpen && tournamentId && (
        <EventRecordWindow eventId={tournamentId} onClose={() => setRecordOpen(false)} />
      )}

      {/* ── A format change that clears the schedule asks first ── */}
      {formatConfirmOpen && (
        <KitDialog
          kind="question"
          title="Clear the existing schedule?"
          onClose={() => { setFormatConfirmOpen(false); setPendingFormat(null); }}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => { setFormatConfirmOpen(false); setPendingFormat(null); }}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void confirmFormatChange()}>Clear schedule &amp; switch</button>
            </>
          )}
        >
          <p>{`Switching to “${tournamentFormatLabel(pendingFormat ?? 'round_robin_playoffs')}” will permanently delete this tournament’s existing schedule (${existingGameCount} game${existingGameCount === 1 ? '' : 's'}), because the schedule is built for the style you pick. This cannot be undone.`}</p>
        </KitDialog>
      )}

      {/* ── A new public link asks first ── */}
      {slugConfirmOpen && (
        <KitDialog
          kind="question"
          title={W.changeUrlTitle}
          onClose={() => setSlugConfirmOpen(false)}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setSlugConfirmOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-lime" onClick={handleSlugConfirm}>{W.changeUrl}</button>
            </>
          )}
        >
          <p>Changing the URL breaks all existing registration links, coach emails, and bookmarked pages. This cannot be undone.</p>
        </KitDialog>
      )}

      {/* ── A failure, said in the kit's window ── */}
      {failure && (
        <KitDialog
          kind="question"
          title={failure.title}
          onClose={() => setFailure(null)}
          footer={<button type="button" className="btn btn-outline" onClick={() => setFailure(null)}>Close</button>}
        >
          <p>{failure.body}</p>
        </KitDialog>
      )}
    </div>
  );
}
