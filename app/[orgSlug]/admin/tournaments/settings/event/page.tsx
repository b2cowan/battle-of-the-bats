'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Settings2, ChevronUp, ChevronDown, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import FeedbackModal from '@/components/FeedbackModal';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import type { GameTimingScope, TieBreakerScope, FeeScope, TournamentStatus, TournamentFormat } from '@/lib/types';
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
type TieBreaker = 'h2h' | 'rf' | 'ra' | 'rd';

const breakerLabels: Record<TieBreaker, string> = {
  h2h: 'Head-to-Head',
  rd:  'Run Diff',
  rf:  'Runs For',
  ra:  'Runs Against',
};

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
  usePageTitle('Event Settings');

  // Tournament identity
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentYear, setTournamentYear] = useState(new Date().getFullYear());
  const [tournamentSlug, setTournamentSlug] = useState('');
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>('draft');
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

  // Game timing
  const [gameTimingScope, setGameTimingScope] = useState<GameTimingScope | null>('tournament');
  const [gameDurationMinutes, setGameDurationMinutes] = useState(90);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [venueMoveBufferMinutes, setVenueMoveBufferMinutes] = useState(0);
  const [facilityMoveBufferMinutes, setFacilityMoveBufferMinutes] = useState(0);

  // Tie-breakers
  const [tieBreakerScope, setTieBreakerScope] = useState<TieBreakerScope | null>('tournament');
  const [tieBreakers, setTieBreakers] = useState<TieBreaker[]>(['h2h', 'rd', 'rf', 'ra']);

  // Scoring
  const [scorePolicyMode, setScorePolicyMode] = useState<ScorePolicyMode>('review');
  const [notifyTeamsOnComplete, setNotifyTeamsOnComplete] = useState(false);
  const [resultsNotifiedAt, setResultsNotifiedAt] = useState<string | null>(null);
  const [resultsNotificationSentCount, setResultsNotificationSentCount] = useState(0);

  // Contact
  const [defaultContactMemberId, setDefaultContactMemberId] = useState<string | null>(null);
  const [notifyMode, setNotifyMode] = useState<'all' | 'assigned'>('all');
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [ownerMember, setOwnerMember] = useState<OrgMemberOption | null>(null);

  // Saved-state snapshot (for dirty tracking and auto-save slug/status guards)
  const [saved, setSaved] = useState({
    name: '', year: new Date().getFullYear(), slug: '', status: 'draft' as TournamentStatus,
    startDate: '', endDate: '',
    format: 'round_robin_playoffs' as TournamentFormat,
    feeScope: null as FeeScope | null,
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
    gameTimingScope: 'tournament' as GameTimingScope | null,
    gameDurationMinutes: 90,
    bufferMinutes: 15,
    venueMoveBufferMinutes: 0,
    facilityMoveBufferMinutes: 0,
    tieBreakerScope: 'tournament' as TieBreakerScope | null,
    tieBreakers: ['h2h', 'rd', 'rf', 'ra'] as TieBreaker[],
    scorePolicyMode: 'review' as ScorePolicyMode,
    notifyTeamsOnComplete: false,
    defaultContactMemberId: null as string | null,
    notifyMode: 'all' as 'all' | 'assigned',
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

        const rawGTS = t.settings?.game_timing_scope;
        const validTimingScopes = new Set<string>(['tournament', 'allow_override', 'per_division']);
        const gts: GameTimingScope = validTimingScopes.has(rawGTS) ? rawGTS as GameTimingScope : 'tournament';

        const rawTBS = t.settings?.tie_breaker_scope;
        const tbs: TieBreakerScope = validTimingScopes.has(rawTBS) ? rawTBS as TieBreakerScope : 'tournament';

        const validBreakers = new Set<string>(['h2h', 'rf', 'ra', 'rd']);
        const tb: TieBreaker[] = Array.isArray(t.settings?.tie_breakers)
          ? (t.settings.tie_breakers as string[]).filter(b => validBreakers.has(b)) as TieBreaker[]
          : ['h2h', 'rd', 'rf', 'ra'];
        const safeTb = tb.length > 0 ? tb : (['h2h', 'rd', 'rf', 'ra'] as TieBreaker[]);

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
        setGameTimingScope(gts);
        setGameDurationMinutes(gd);
        setBufferMinutes(buf);
        setVenueMoveBufferMinutes(venueMoveBuf);
        setFacilityMoveBufferMinutes(facilityMoveBuf);
        setTieBreakerScope(tbs);
        setTieBreakers(safeTb);
        setNotifyTeamsOnComplete(notify);
        setDefaultContactMemberId(contactId);
        setNotifyMode(nm);
        setSaved(s => ({
          ...s,
          name, year, slug, status,
          startDate: sd, endDate: ed,
          format: fmt,
          feeScope: fs,
          depositAmount: da, depositDueDate: dd, totalFeeAmount: tf, totalFeeDueDate: td,
          gameTimingScope: gts, gameDurationMinutes: gd, bufferMinutes: buf,
          venueMoveBufferMinutes: venueMoveBuf, facilityMoveBufferMinutes: facilityMoveBuf,
          tieBreakerScope: tbs, tieBreakers: safeTb,
          notifyTeamsOnComplete: notify, defaultContactMemberId: contactId, notifyMode: nm,
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
                  fee_scope: feeScope,
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
          gameTimingScope, gameDurationMinutes, bufferMinutes,
          venueMoveBufferMinutes, facilityMoveBufferMinutes,
          tieBreakerScope, tieBreakers: [...tieBreakers],
          scorePolicyMode, notifyTeamsOnComplete, defaultContactMemberId, notifyMode,
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
    saved.slug, scorePolicyMode, startDate, tieBreakerScope, tieBreakers,
    totalFeeAmount, totalFeeDueDate, tournamentId, tournamentName, tournamentFormat,
    tournamentYear, venueMoveBufferMinutes,
  ]);

  // ── Auto-save effect — fires 1.2 s after any non-status, non-slug change ──

  useEffect(() => {
    if (!isInitialized || !tournamentId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSaveRef.current?.();
    }, 1200);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [
    isInitialized, tournamentId,
    tournamentName, tournamentYear, startDate, endDate,
    feeScope, depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate,
    gameTimingScope, gameDurationMinutes, bufferMinutes,
    venueMoveBufferMinutes, facilityMoveBufferMinutes,
    tieBreakers, tieBreakerScope,
    scorePolicyMode, notifyTeamsOnComplete, defaultContactMemberId, notifyMode,
  ]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function moveTieBreaker(index: number, direction: 'up' | 'down') {
    setTieBreakers(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

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
        <CollapsibleCard title="Tournament Overview" defaultOpen={false}>

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
        </CollapsibleCard>

        {/* ── Card 2: Schedule Rules ── */}
        <CollapsibleCard title="Schedule Rules" defaultOpen={false}>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '420px' }}>
                  {tieBreakers.map((b, i) => (
                    <div key={b} className={styles.tieBreakerRow}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--logic-lime)', minWidth: '14px', fontFamily: 'var(--font-data)' }}>{i + 1}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'var(--font-data)' }}>{breakerLabels[b]}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.2rem' }}>
                        <button type="button" className="btn btn-ghost btn-data" style={{ padding: '0.2rem' }} onClick={() => moveTieBreaker(i, 'up')} disabled={i === 0}>
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" className="btn btn-ghost btn-data" style={{ padding: '0.2rem' }} onClick={() => moveTieBreaker(i, 'down')} disabled={i === tieBreakers.length - 1}>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={styles.inheritNote} style={{ marginTop: '0.5rem' }}>
                  If 3+ teams are tied, Head-to-Head is automatically skipped.
                  {tieBreakerScope === 'allow_override' && ' Divisions can reorder tie-breakers individually.'}
                </p>
              </div>
            ) : (
              <p className={styles.descriptionText} style={{ marginTop: '0.5rem' }}>
                Each division must set its own tie-breaker order before the tournament can be activated.
              </p>
            )}
          </div>

        </CollapsibleCard>

        {/* ── Card 3: Fee Schedule ── */}
        <CollapsibleCard title="Fee Schedule" defaultOpen={false}>
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
        </CollapsibleCard>

        {/* ── Card 4: Notifications & Contact ── */}
        <CollapsibleCard title="Notifications & Contact" defaultOpen={false}>

          {/* Public Contact */}
          <div>
            <p className={styles.subSectionLabel}>Public Contact</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <p className={styles.descriptionText}>
                This member&apos;s email appears in coach-facing registration emails and on the public tournament page.
                Defaults to the organization owner if not set.
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
                    Emails will show: <strong style={{ color: 'var(--white-70)' }}>{selected.email}</strong>
                  </p>
                ) : null;
              })()}
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

          <hr className={styles.cardDivider} />

          {/* Score Finalization — moved here from Schedule Rules: it's a results-management
              decision (who approves scores) not a scheduling rule. */}
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
              Admin review sends scorekeeper submissions to Pending Review until an admin finalizes them in Results.
              Final immediately makes scorekeeper submissions final as soon as they are saved.
            </p>
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

        {/* Registration Questions */}
        <CollapsibleCard title="Registration Questions" defaultOpen={false}>
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

      {/* ── Error modal ── */}
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
