'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, Plus, EyeOff, Printer } from 'lucide-react';
import { downloadPDF, buildFilename } from '@/lib/export';
import type { RepTryoutRegistration } from '@/lib/types';
import styles from './TryoutCheckIn.module.css';

interface Props {
  /** The candidate API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-candidates`. */
  apiBase: string;
  backHref: string;
  onError?: (msg: string) => void;
}

const fullName = (c: RepTryoutRegistration) => `${c.playerFirstName} ${c.playerLastName ?? ''}`.trim();

function ageFromDob(dob: string | null): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 100 ? String(age) : '';
}

export default function TryoutCheckIn({ apiBase, backHref, onError }: Props) {
  const [candidates, setCandidates] = useState<RepTryoutRegistration[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const recentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [walkupOpen, setWalkupOpen] = useState(false);
  const [walkup, setWalkup] = useState({ first: '', last: '', email: '' });
  const [savingWalkup, setSavingWalkup] = useState(false);

  const fail = useCallback((m: string) => { onError ? onError(m) : console.error(m); }, [onError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load candidates');
      setIsAnonymous(data.isAnonymous ?? true);
      setCandidates(data.candidates ?? []);
    } catch (e: any) {
      fail(e.message ?? 'Failed to load candidates.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (recentTimer.current) clearTimeout(recentTimer.current); }, []);

  const checkedCount = candidates.filter(c => c.isCheckedIn).length;
  const total = candidates.length;

  const filtered = candidates.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const bib = (c.bibNumber ?? '').toLowerCase();
    if (isAnonymous) return bib.includes(q);
    return fullName(c).toLowerCase().includes(q) || bib.includes(q);
  });

  async function setCheckin(c: RepTryoutRegistration, value: boolean) {
    if (togglingId) return;
    setTogglingId(c.id);
    setCandidates(prev => prev.map(p => (p.id === c.id ? { ...p, isCheckedIn: value } : p)));  // optimistic
    try {
      const res = await fetch(`${apiBase}/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCheckedIn: value }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Failed'); }
      const data = await res.json();
      setCandidates(prev => prev.map(p => (p.id === c.id ? data.registration : p)));
      if (value) {
        setRecentId(c.id);
        if (recentTimer.current) clearTimeout(recentTimer.current);
        recentTimer.current = setTimeout(() => setRecentId(r => (r === c.id ? null : r)), 3500);
      } else if (recentId === c.id) {
        setRecentId(null);
      }
    } catch (e: any) {
      setCandidates(prev => prev.map(p => (p.id === c.id ? { ...p, isCheckedIn: !value } : p)));  // revert
      fail(e.message ?? 'Failed to update check-in.');
    } finally {
      setTogglingId(null);
    }
  }

  async function addWalkup() {
    if (!walkup.first.trim()) return;
    setSavingWalkup(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerFirstName: walkup.first, playerLastName: walkup.last, guardianEmail: walkup.email }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.errors?.playerFirstName ?? d.error ?? 'Failed to add'); }
      setWalkupOpen(false);
      setWalkup({ first: '', last: '', email: '' });
      await load();
    } catch (e: any) {
      fail(e.message ?? 'Failed to add walk-up.');
    } finally {
      setSavingWalkup(false);
    }
  }

  async function printSheet() {
    try {
      const blind = isAnonymous;
      const headers = blind ? ['Bib', 'Age', 'In', 'Notes'] : ['Bib', 'Player', 'Age', 'In', 'Notes'];
      const rows = candidates.map(c => {
        const age = ageFromDob(c.playerDateOfBirth);
        return blind
          ? [c.bibNumber ?? '', age, '', '']
          : [c.bibNumber ?? '', fullName(c) || `Bib ${c.bibNumber ?? ''}`, age, '', ''];
      });
      // FieldLogicHQ-branded default; org-branded settings are a later polish.
      await downloadPDF(buildFilename({ dataset: 'tryout-check-in' }, 'pdf'), 'Tryout — Check-in Sheet', undefined, headers, rows);
    } catch (e: any) {
      fail(e.message ?? 'Failed to build the sheet.');
    }
  }

  if (loading) return <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</p>;

  return (
    <div className={styles.wrap}>
      <Link href={backHref} className={styles.backLink}><ChevronLeft size={15} /> Back to Tryouts</Link>

      <div className={styles.header}>
        <div className={styles.progressRow}>
          <span className={styles.progressText}>{checkedCount} <span className={styles.total}>/ {total} checked in</span></span>
          {isAnonymous && <span className={styles.blindChip}><EyeOff size={12} /> Blind · names hidden</span>}
        </div>
        <div className={styles.bar}><div className={styles.barFill} style={{ width: total ? `${(checkedCount / total) * 100}%` : '0%' }} /></div>
        <input
          className={styles.search}
          type="text"
          inputMode="search"
          placeholder={isAnonymous ? 'Search bib #…' : 'Search name or bib…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className={styles.addBtn} onClick={() => { setWalkup({ first: '', last: '', email: '' }); setWalkupOpen(true); }}>
            <Plus size={15} /> Add walk-up
          </button>
          <button type="button" className={styles.addBtn} onClick={printSheet} disabled={candidates.length === 0}>
            <Printer size={15} /> Print sheet
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>
          {total === 0
            ? 'No candidates yet. Add a walk-up, or open registration so families can sign up.'
            : 'No matches.'}
        </p>
      ) : (
        <div className={styles.list}>
          {filtered.map(c => {
            const checked = c.isCheckedIn;
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.row} ${checked ? styles.rowChecked : ''}`}
                onClick={() => setCheckin(c, !checked)}
                disabled={togglingId === c.id}
              >
                <span className={styles.bib}>{c.bibNumber ?? '—'}</span>
                <span className={styles.main}>
                  {isAnonymous
                    ? <span className={styles.bibOnly}>Bib {c.bibNumber ?? '—'}</span>
                    : <span className={styles.name}>{fullName(c) || `Bib ${c.bibNumber ?? '—'}`}</span>}
                </span>
                {checked && recentId === c.id && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={styles.undo}
                    onClick={e => { e.stopPropagation(); setCheckin(c, false); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setCheckin(c, false); } }}
                  >
                    Undo
                  </span>
                )}
                <span className={styles.state}>
                  <span className={`${styles.stateIcon} ${checked ? styles.iconOn : styles.iconOff}`}>
                    {checked && <Check size={18} strokeWidth={3} />}
                  </span>
                  <span className={`${styles.stateLabel} ${checked ? styles.labelOn : styles.labelOff}`}>
                    {checked ? 'Checked in' : 'Tap to check in'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {walkupOpen && (
        <div className={styles.scrim} onClick={() => !savingWalkup && setWalkupOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add walk-up</h3>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>First name</label>
                <input className={styles.input} value={walkup.first} maxLength={80} onChange={e => setWalkup(w => ({ ...w, first: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Last name</label>
                <input className={styles.input} value={walkup.last} maxLength={80} onChange={e => setWalkup(w => ({ ...w, last: e.target.value }))} />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Guardian email <span style={{ color: 'rgba(255,255,255,0.35)' }}>· optional</span></label>
              <input className={styles.input} type="email" value={walkup.email} maxLength={200} onChange={e => setWalkup(w => ({ ...w, email: e.target.value }))} placeholder="Add now or later" />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setWalkupOpen(false)} disabled={savingWalkup}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={addWalkup} disabled={savingWalkup || !walkup.first.trim()}>
                {savingWalkup ? 'Adding…' : 'Add & check in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
