'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../branding/branding.module.css';

type FeeMode = 'tournament' | 'age_group';

export default function TournamentEventSettingsPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings`;

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
  const [requireFinalization, setRequireFinalization] = useState(false);

  // Dirty tracking
  const [saved, setSaved] = useState({
    startDate: '', endDate: '',
    feeMode: 'tournament' as FeeMode,
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
    requireFinalization: false,
  });

  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const tournamentId = currentTournament?.id;

  const isDirty =
    startDate !== saved.startDate ||
    endDate !== saved.endDate ||
    feeMode !== saved.feeMode ||
    depositAmount !== saved.depositAmount ||
    depositDueDate !== saved.depositDueDate ||
    totalFeeAmount !== saved.totalFeeAmount ||
    totalFeeDueDate !== saved.totalFeeDueDate ||
    requireFinalization !== saved.requireFinalization;

  useEffect(() => {
    if (!tournamentId) return;

    Promise.all([
      fetch(`/api/admin/tournaments`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}`).then(r => r.ok ? r.json() : {}),
    ]).then(([tournaments, branding]) => {
      const t = Array.isArray(tournaments) ? tournaments.find((row: { id: string }) => row.id === tournamentId) : null;
      if (t) {
        const sd = t.start_date ?? '';
        const ed = t.end_date ?? '';
        const fm = (t.fee_schedule_mode as FeeMode) ?? 'tournament';
        const da = t.deposit_amount != null ? String(t.deposit_amount) : '';
        const dd = t.deposit_due_date ?? '';
        const tf = t.total_fee_amount != null ? String(t.total_fee_amount) : '';
        const td = t.total_fee_due_date ?? '';
        setStartDate(sd); setEndDate(ed);
        setFeeMode(fm);
        setDepositAmount(da); setDepositDueDate(dd);
        setTotalFeeAmount(tf); setTotalFeeDueDate(td);
        setSaved(s => ({ ...s, startDate: sd, endDate: ed, feeMode: fm, depositAmount: da, depositDueDate: dd, totalFeeAmount: tf, totalFeeDueDate: td }));
      }
      const rf = (branding as { requireScoreFinalization?: boolean }).requireScoreFinalization ?? false;
      setRequireFinalization(rf);
      setSaved(s => ({ ...s, requireFinalization: rf }));
    }).catch(() => { setErrorMsg('Failed to load settings'); setErrorOpen(true); });
  }, [tournamentId]);

  async function handleSave() {
    if (!tournamentId || !currentTournament || saving) return;
    setSaving(true);
    try {
      const [tournamentRes, brandingRes] = await Promise.all([
        fetch('/api/admin/tournaments', {
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
            },
          }),
        }),
        fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requireScoreFinalization: requireFinalization }),
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

      setSaved({ startDate, endDate, feeMode, depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate, requireFinalization });
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
      <div className={styles.pageHeader}>
        <Link href={base} className={styles.backBtn}>
          <ArrowLeft size={13} /> Settings
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div className={styles.headerIcon}><Settings2 size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Event Settings</h1>
          <p className={styles.pageSub}>{currentTournament?.name} — dates, fees & scoring</p>
        </div>
      </div>

      {/* Dates */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
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
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Fee Schedule</h2>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--white-5)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
            {(['tournament', 'age_group'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setFeeMode(mode)}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: feeMode === mode ? 'var(--blueprint-blue)' : 'transparent',
                  color: feeMode === mode ? '#fff' : 'var(--data-gray)',
                }}
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
          <p style={{ fontSize: '0.82rem', color: 'var(--data-gray)', lineHeight: 1.55, margin: 0 }}>
            Fee amounts and due dates are set per division. Edit each division to configure its fee schedule.
          </p>
        )}
      </div>

      {/* Scoring */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Score Finalization</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white-80)' }}>Require admin finalization</span>
            <input
              type="checkbox"
              checked={requireFinalization}
              onChange={e => setRequireFinalization(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
          </label>
          <p style={{ fontSize: '0.83rem', color: 'var(--white-40)', lineHeight: 1.55, margin: 0 }}>
            When enabled, scores submitted by field officials are visible immediately but are not marked final
            until an admin reviews them in the Results page. When disabled, submissions are immediately final.
          </p>
          <p className={styles.inheritNote} style={{ marginTop: '0.5rem' }}>
            When not set, this tournament inherits the organization-level finalization setting.
          </p>
        </div>
      </div>

      <div className={styles.formFooter}>
        {isDirty && <span className={styles.unsavedLabel}>Unsaved changes</span>}
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <FeedbackModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="Saved" message="Event settings updated." type="success" />
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
