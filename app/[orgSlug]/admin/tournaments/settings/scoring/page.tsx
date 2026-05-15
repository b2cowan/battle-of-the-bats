'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../branding/branding.module.css';

export default function TournamentScoringPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole } = useOrg();
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings`;

  const [requireFinalization, setRequireFinalization] = useState(false);
  const [savedValue, setSavedValue] = useState(false);
  const [saving, setSaving] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [errorOpen, setErrorOpen]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  const tournamentId = currentTournament?.id;
  const isDirty = requireFinalization !== savedValue;

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}`)
      .then(r => r.json())
      .then((data: { requireScoreFinalization: boolean | null }) => {
        const val = data.requireScoreFinalization ?? false;
        setRequireFinalization(val);
        setSavedValue(val);
      })
      .catch(() => { setErrorMsg('Failed to load scoring settings'); setErrorOpen(true); });
  }, [tournamentId]);

  async function handleSave() {
    if (!tournamentId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tournament-branding?tournamentId=${encodeURIComponent(tournamentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireScoreFinalization: requireFinalization }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Save failed');
      }
      setSavedValue(requireFinalization);
      setSuccessMsg('Scoring settings saved.');
      setSuccessOpen(true);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong');
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Only organization owners can manage scoring settings.</p>
      </div>
    );
  }

  if (!tournamentId) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Select a tournament from the sidebar to manage scoring settings.</p>
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
        <div className={styles.headerIcon}><SlidersHorizontal size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Score Settings</h1>
          <p className={styles.pageSub}>{currentTournament?.name} — score finalization policy</p>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Scoring</h2>

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
            When enabled, scores submitted by field officials are visible to the public immediately
            but are not marked final until an admin reviews and finalizes them in the Results page.
            Officials can correct a submitted score until it is finalized.
            When disabled, an official&apos;s submission is immediately final.
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

      <FeedbackModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="Saved" message={successMsg} type="success" />
      <FeedbackModal isOpen={errorOpen} onClose={() => setErrorOpen(false)} title="Error" message={errorMsg} type="danger" />
    </div>
  );
}
