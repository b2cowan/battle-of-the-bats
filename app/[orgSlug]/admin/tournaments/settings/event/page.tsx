'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings2, ChevronUp, ChevronDown, Trophy } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import type { GameTimingScope, TieBreakerScope, FeeScope } from '@/lib/types';
import styles from '../../branding/branding.module.css';

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

/** Maps FeeScope → legacy fee_schedule_mode column value (kept for backward compat). */
function feeScopeToScheduleMode(scope: FeeScope | null): 'tournament' | 'division' {
  return scope === 'per_division' ? 'division' : 'tournament';
}

export default function TournamentEventSettingsPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole } = useOrg();

  // Dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fee scope (replaces old 'tournament' | 'division' feeMode)
  const [feeScope, setFeeScope] = useState<FeeScope | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDueDate, setDepositDueDate] = useState('');
  const [totalFeeAmount, setTotalFeeAmount] = useState('');
  const [totalFeeDueDate, setTotalFeeDueDate] = useState('');

  // Game timing scope + values
  const [gameTimingScope, setGameTimingScope] = useState<GameTimingScope | null>(null);
  const [gameDurationMinutes, setGameDurationMinutes] = useState(90);
  const [bufferMinutes, setBufferMinutes] = useState(15);

  // Tie-breaker scope + order
  const [tieBreakerScope, setTieBreakerScope] = useState<TieBreakerScope | null>(null);
  const [tieBreakers, setTieBreakers] = useState<TieBreaker[]>(['h2h', 'rd', 'rf', 'ra']);

  // Scoring
  const [scorePolicyMode, setScorePolicyMode] = useState<ScorePolicyMode>('review');
  const [notifyTeamsOnComplete, setNotifyTeamsOnComplete] = useState(false);
  const [resultsNotifiedAt, setResultsNotifiedAt] = useState<string | null>(null);
  const [resultsNotificationSentCount, setResultsNotificationSentCount] = useState(0);

  // Contact model
  const [defaultContactMemberId, setDefaultContactMemberId] = useState<string | null>(null);
  const [notifyMode, setNotifyMode] = useState<'all' | 'assigned'>('all');
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [ownerMember, setOwnerMember] = useState<OrgMemberOption | null>(null);

  // Dirty tracking
  const [saved, setSaved] = useState({
    startDate: '', endDate: '',
    feeScope: null as FeeScope | null,
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
    gameTimingScope: null as GameTimingScope | null,
    gameDurationMinutes: 90,
    bufferMinutes: 15,
    tieBreakerScope: null as TieBreakerScope | null,
    tieBreakers: ['h2h', 'rd', 'rf', 'ra'] as TieBreaker[],
    scorePolicyMode: 'review' as ScorePolicyMode,
    notifyTeamsOnComplete: false,
    defaultContactMemberId: null as string | null,
    notifyMode: 'all' as 'all' | 'assigned',
  });

  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const tournamentId = currentTournament?.id;
  const canUsePostEventNotifications = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'post_tournament_summary'));
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const isDirty =
    startDate !== saved.startDate ||
    endDate !== saved.endDate ||
    feeScope !== saved.feeScope ||
    depositAmount !== saved.depositAmount ||
    depositDueDate !== saved.depositDueDate ||
    totalFeeAmount !== saved.totalFeeAmount ||
    totalFeeDueDate !== saved.totalFeeDueDate ||
    gameTimingScope !== saved.gameTimingScope ||
    gameDurationMinutes !== saved.gameDurationMinutes ||
    bufferMinutes !== saved.bufferMinutes ||
    tieBreakerScope !== saved.tieBreakerScope ||
    JSON.stringify(tieBreakers) !== JSON.stringify(saved.tieBreakers) ||
    scorePolicyMode !== saved.scorePolicyMode ||
    notifyTeamsOnComplete !== saved.notifyTeamsOnComplete ||
    defaultContactMemberId !== saved.defaultContactMemberId ||
    notifyMode !== saved.notifyMode;

  useEffect(() => {
    if (!tournamentId) return;

    Promise.all([
      fetch(`/api/admin/tournaments${orgQuery}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : {}),
      fetch(`/api/admin/members${orgQuery}`).then(r => r.ok ? r.json() : []),
    ]).then(([tournaments, branding, members]) => {
      const t = Array.isArray(tournaments) ? tournaments.find((row: { id: string }) => row.id === tournamentId) : null;
      if (t) {
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

        // Scope fields — prefer settings.* (backfilled by migration 102), fall back from legacy column
        const rawFeeScope = t.settings?.fee_scope;
        const validFeeScopes = new Set<string>(['tournament', 'allow_override', 'per_division', 'free']);
        const fs: FeeScope | null = validFeeScopes.has(rawFeeScope)
          ? rawFeeScope as FeeScope
          : t.fee_schedule_mode === 'division' ? 'per_division'
          : t.fee_schedule_mode === 'tournament' ? 'tournament'
          : null;

        const rawGTS = t.settings?.game_timing_scope;
        const validTimingScopes = new Set<string>(['tournament', 'allow_override', 'per_division']);
        const gts: GameTimingScope | null = validTimingScopes.has(rawGTS) ? rawGTS as GameTimingScope : null;

        const rawTBS = t.settings?.tie_breaker_scope;
        const tbs: TieBreakerScope | null = validTimingScopes.has(rawTBS) ? rawTBS as TieBreakerScope : null;

        const validBreakers = new Set<string>(['h2h', 'rf', 'ra', 'rd']);
        const tb: TieBreaker[] = Array.isArray(t.settings?.tie_breakers)
          ? (t.settings.tie_breakers as string[]).filter(b => validBreakers.has(b)) as TieBreaker[]
          : ['h2h', 'rd', 'rf', 'ra'];
        const safeTb = tb.length > 0 ? tb : (['h2h', 'rd', 'rf', 'ra'] as TieBreaker[]);

        setResultsNotifiedAt(t.results_notified_at ?? null);
        setResultsNotificationSentCount(t.results_notification_sent_count ?? 0);
        setStartDate(sd); setEndDate(ed);
        setFeeScope(fs);
        setDepositAmount(da); setDepositDueDate(dd);
        setTotalFeeAmount(tf); setTotalFeeDueDate(td);
        setGameTimingScope(gts);
        setGameDurationMinutes(gd);
        setBufferMinutes(buf);
        setTieBreakerScope(tbs);
        setTieBreakers(safeTb);
        setNotifyTeamsOnComplete(notify);
        setDefaultContactMemberId(contactId);
        setNotifyMode(nm);
        setSaved(s => ({
          ...s,
          startDate: sd, endDate: ed,
          feeScope: fs,
          depositAmount: da, depositDueDate: dd, totalFeeAmount: tf, totalFeeDueDate: td,
          gameTimingScope: gts, gameDurationMinutes: gd, bufferMinutes: buf,
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
    }).catch(() => { setErrorMsg('Failed to load settings'); setErrorOpen(true); });
  }, [tournamentId, orgParam, orgQuery]);

  function moveTieBreaker(index: number, direction: 'up' | 'down') {
    setTieBreakers(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!tournamentId || !currentTournament || saving) return;
    setSaving(true);
    try {
      const [tournamentRes, brandingRes, schedulingRes] = await Promise.all([
        fetch(`/api/admin/tournaments${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: tournamentId,
            data: {
              year: currentTournament.year,
              name: currentTournament.name,
              slug: currentTournament.slug,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              // Keep fee_schedule_mode column in sync for backward compat
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
                game_duration_minutes: gameDurationMinutes,
                buffer_minutes: bufferMinutes,
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

      setSaved({
        startDate, endDate,
        feeScope,
        depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate,
        gameTimingScope, gameDurationMinutes, bufferMinutes,
        tieBreakerScope, tieBreakers,
        scorePolicyMode, notifyTeamsOnComplete, defaultContactMemberId, notifyMode,
      });
      setSuccessOpen(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Only organization owners can manage event settings.</p>
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

  // Fee inputs are shown when scope is tournament, allow_override, or null (unset)
  const showFeeInputs = feeScope === 'tournament' || feeScope === 'allow_override' || feeScope === null;
  // Timing inputs are shown when scope is not per_division
  const showTimingInputs = gameTimingScope !== 'per_division';
  // Tie-breaker list shown when scope is not per_division
  const showTieBreakerList = tieBreakerScope !== 'per_division';

  return (
    <div className={styles.page}>
      <div className={styles.settingsContent}>
      <div className={styles.settingsTitleRow}>
        <div className={styles.headerIcon}><Settings2 size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Event Settings</h1>
          <p className={styles.pageSub}>{currentTournament?.name} — dates, fees & competition rules</p>
        </div>
      </div>

      {/* Dates */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Tournament Dates</h2>
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
      </div>

      {/* Match & Competition Rules */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Match &amp; Competition Rules</h2>

        {/* ── Game Timing ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--white-80)' }}>Game Timing</p>
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
        </div>

        {/* ── Tie-Breaker Rules ── */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <div className={styles.cardHeaderRow} style={{ marginBottom: '0.5rem' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--white-80)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={14} style={{ color: 'var(--logic-lime)' }} /> Tie-Breaker Rules
            </p>
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
                  <div key={b} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-inset)', padding: '0.5rem 0.75rem', borderRadius: '2px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--logic-lime)', minWidth: '14px' }}>{i + 1}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{breakerLabels[b]}</span>
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
              <p className={styles.inheritNote} style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
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
      </div>

      {/* Fee Schedule */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Fee Schedule</h2>
          <div className={styles.segmentedControl}>
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
          <p className={styles.descriptionText} style={{ marginTop: feeScope === null ? '0' : '0.5rem' }}>
            Choose a payment configuration above to confirm how fees are handled for this tournament.
          </p>
        )}
      </div>

      {/* Scoring */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Score Finalization</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
          <p className={styles.descriptionText}>
            Admin review sends scorekeeper submissions to Pending Review until an admin finalizes them in Results.
            Final immediately makes scorekeeper submissions final as soon as they are saved.
          </p>
        </div>
      </div>

      {/* Public Contact */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Public Contact</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <p className={styles.descriptionText}>
            This member's email appears in coach-facing registration emails and on the public tournament page.
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
                Emails will show: <strong style={{ color: 'var(--white-70, rgba(255,255,255,0.7))' }}>{selected.email}</strong>
              </p>
            ) : null;
          })()}
        </div>
      </div>

      {/* Registration Notifications */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Registration Notifications</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
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
          <p className={styles.descriptionText}>
            {notifyMode === 'all'
              ? 'Organization owners and admins are notified for every registration. If a division has an assigned contact, they are notified too.'
              : 'Only the division-assigned contact is notified. Owners and admins are not notified for divisions they\'ve delegated.'}
          </p>
          <p className={styles.inheritNote}>
            Divisions without an assigned contact always notify tournament admins regardless of this setting.
          </p>
        </div>
      </div>

      {/* Post-Event Results Notification */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Post-Event Results Notification</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <label className={`${styles.toggleRow} ${!canUsePostEventNotifications ? styles.toggleRowDisabled : ''}`}>
            <span className={styles.toggleLabel}>
              Email accepted teams when results are finalized
            </span>
            <input
              type="checkbox"
              checked={notifyTeamsOnComplete}
              disabled={!canUsePostEventNotifications}
              onChange={e => setNotifyTeamsOnComplete(e.target.checked)}
              style={{ cursor: canUsePostEventNotifications ? 'pointer' : 'not-allowed' }}
            />
          </label>
          <p className={styles.descriptionText}>
            When enabled, accepted team contacts receive one email with public standings, schedule, and team links the first time this tournament is marked completed.
          </p>
          {resultsNotifiedAt && (
            <p style={{ fontSize: '0.8rem', color: 'var(--logic-lime)', lineHeight: 1.5, margin: 0 }}>
              Results notification sent to {resultsNotificationSentCount} team contact{resultsNotificationSentCount === 1 ? '' : 's'} on {resultsNotifiedAt.slice(0, 10)}.
            </p>
          )}
          {!canUsePostEventNotifications && (
            <div className={styles.inlineUpsell}>
              <p>
                {requiresTournamentPlusCopy('post_tournament_summary')}
              </p>
              <Link href={subscriptionHref} className="btn btn-outline btn-data">Review Tournament Plus</Link>
            </div>
          )}
        </div>
      </div>

      <div className={styles.formFooter}>
        {isDirty && <span className={styles.unsavedLabel}>Unsaved changes</span>}
        <button type="button" className="btn btn-lime btn-data" onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      </div>{/* /settingsContent */}

      <FeedbackModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="Saved" message="Event settings updated." type="success" />
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
