'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import styles from '../../branding/branding.module.css';

interface OrgMemberOption {
  id: string;
  email: string;
  displayName: string | null;
  title: string | null;
  role: string;
}

type FeeMode = 'tournament' | 'division';
type ScorePolicyMode = 'review' | 'final';

function scorePolicyModeFromValue(value: boolean | null | undefined): ScorePolicyMode {
  // null/undefined (org inherit) is treated as admin-review in the UI
  return value === false ? 'final' : 'review';
}

function scorePolicyValue(mode: ScorePolicyMode): boolean {
  return mode === 'review';
}

export default function TournamentEventSettingsPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole } = useOrg();

  // Dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fees
  const [feeMode, setFeeMode] = useState<FeeMode>('tournament');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDueDate, setDepositDueDate] = useState('');
  const [totalFeeAmount, setTotalFeeAmount] = useState('');
  const [totalFeeDueDate, setTotalFeeDueDate] = useState('');

  // Scoring
  const [scorePolicyMode, setScorePolicyMode] = useState<ScorePolicyMode>('review');
  const [notifyTeamsOnComplete, setNotifyTeamsOnComplete] = useState(false);
  const [resultsNotifiedAt, setResultsNotifiedAt] = useState<string | null>(null);
  const [resultsNotificationSentCount, setResultsNotificationSentCount] = useState(0);

  // Contact model (Phase 3)
  const [defaultContactMemberId, setDefaultContactMemberId] = useState<string | null>(null);
  const [notifyMode, setNotifyMode] = useState<'all' | 'assigned'>('all');
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [ownerMember, setOwnerMember] = useState<OrgMemberOption | null>(null);

  // Dirty tracking
  const [saved, setSaved] = useState({
    startDate: '', endDate: '',
    feeMode: 'tournament' as FeeMode,
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
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
    feeMode !== saved.feeMode ||
    depositAmount !== saved.depositAmount ||
    depositDueDate !== saved.depositDueDate ||
    totalFeeAmount !== saved.totalFeeAmount ||
    totalFeeDueDate !== saved.totalFeeDueDate ||
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
        const fm = (t.fee_schedule_mode as FeeMode) ?? 'tournament';
        const da = t.deposit_amount != null ? String(t.deposit_amount) : '';
        const dd = t.deposit_due_date ?? '';
        const tf = t.total_fee_amount != null ? String(t.total_fee_amount) : '';
        const td = t.total_fee_due_date ?? '';
        const notify = Boolean(t.notify_teams_on_complete);
        const contactId = t.default_contact_member_id ?? null;
        const nm = (t.notify_mode === 'assigned' ? 'assigned' : 'all') as 'all' | 'assigned';
        setResultsNotifiedAt(t.results_notified_at ?? null);
        setResultsNotificationSentCount(t.results_notification_sent_count ?? 0);
        setStartDate(sd); setEndDate(ed);
        setFeeMode(fm);
        setDepositAmount(da); setDepositDueDate(dd);
        setTotalFeeAmount(tf); setTotalFeeDueDate(td);
        setNotifyTeamsOnComplete(notify);
        setDefaultContactMemberId(contactId);
        setNotifyMode(nm);
        setSaved(s => ({ ...s, startDate: sd, endDate: ed, feeMode: fm, depositAmount: da, depositDueDate: dd, totalFeeAmount: tf, totalFeeDueDate: td, notifyTeamsOnComplete: notify, defaultContactMemberId: contactId, notifyMode: nm }));
      }
      const policyMode = scorePolicyModeFromValue((branding as { requireScoreFinalization?: boolean | null }).requireScoreFinalization);
      setScorePolicyMode(policyMode);
      setSaved(s => ({ ...s, scorePolicyMode: policyMode }));

      // Populate contact picker — admin and staff only; owner shown separately as the default option
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

  async function handleSave() {
    if (!tournamentId || !currentTournament || saving) return;
    setSaving(true);
    try {
      const [tournamentRes, brandingRes] = await Promise.all([
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
              feeScheduleMode: feeMode,
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
      ]);

      if (!tournamentRes.ok) {
        const d = await tournamentRes.json();
        throw new Error(d.error ?? 'Failed to save tournament settings');
      }
      if (!brandingRes.ok) {
        const d = await brandingRes.json();
        throw new Error(d.error ?? 'Failed to save scoring settings');
      }

      setSaved({ startDate, endDate, feeMode, depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate, scorePolicyMode, notifyTeamsOnComplete, defaultContactMemberId, notifyMode });
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

  return (
    <div className={styles.page}>
      <div className={styles.settingsContent}>
      <div className={styles.settingsTitleRow}>
        <div className={styles.headerIcon}><Settings2 size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Event Settings</h1>
          <p className={styles.pageSub}>{currentTournament?.name} — dates, fees & scoring</p>
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

      {/* Fee Schedule */}
      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Fee Schedule</h2>
          <div className={styles.segmentedControl}>
            {(['tournament', 'division'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setFeeMode(mode)}
                className={`${styles.segmentButton} ${feeMode === mode ? styles.segmentButtonActive : ''}`}
              >
                {mode === 'tournament' ? 'By Tournament' : 'By Division'}
              </button>
            ))}
          </div>
        </div>
        {feeMode === 'tournament' ? (
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
        ) : (
          <p className={styles.descriptionText}>
            Fee amounts and due dates are set per division. Edit each division to configure its fee schedule.
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

      {/* Post-Event Results Notification — gated feature, last */}
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
