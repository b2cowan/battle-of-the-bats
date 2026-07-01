'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, Pencil, Trash2, UserCheck, Eye, EyeOff } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getTryoutWindowNotice } from '@/lib/tryout-windows';
import type { RepTryout, RepTryoutSession } from '@/lib/types';
import styles from './TryoutDayCard.module.css';

interface Props {
  /** The tryout-sessions API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-sessions`.
   *  GET/POST/PATCH hit this; per-session ops hit `${apiBase}/{sessionId}`. */
  apiBase: string;
  canWrite: boolean;
  sport?: string | null;
  /** When set, shows an "Open day-of check-in" CTA linking here. */
  checkInHref?: string;
  onError?: (msg: string) => void;
}

interface SessionForm {
  startsAt: string;   // datetime-local value
  endsAt: string;     // datetime-local value (optional)
  location: string;
  fieldNumber: string;
  label: string;
}

const BLANK: SessionForm = { startsAt: '', endsAt: '', location: '', fieldNumber: '', label: '' };

/** Stored value → a `YYYY-MM-DDTHH:mm` value for <input type="datetime-local">.
 *  We store the naive wall-clock (matches rep_team_events), so SLICE it — never TZ-convert. */
function toInputValue(stored: string | null): string {
  return stored ? stored.slice(0, 16) : '';
}

/** Parse a stored wall-clock string as LOCAL (strip any trailing timezone) so display never shifts. */
function wallClock(stored: string): Date {
  return new Date(stored.slice(0, 19));
}

function formatTime(stored: string): string {
  const d = wallClock(stored);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

function formatWhen(session: RepTryoutSession): string {
  const start = wallClock(session.startsAt);
  if (isNaN(start.getTime())) return session.startsAt;
  const date = start.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  let s = `${date} · ${formatTime(session.startsAt)}`;
  if (session.endsAt) {
    const end = formatTime(session.endsAt);
    if (end) s += `–${end}`;
  }
  return s;
}

export default function TryoutDayCard({ apiBase, canWrite, sport, checkInHref, onError }: Props) {
  const base = apiBase;

  const confirm = useConfirm();
  const [tryout, setTryout] = useState<RepTryout | null>(null);
  const [sessions, setSessions] = useState<RepTryoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fail = useCallback((msg: string) => { onError ? onError(msg) : console.error(msg); }, [onError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load tryout day');
      setTryout(data.tryout ?? null);
      setSessions(data.sessions ?? []);
    } catch (e: any) {
      fail(e.message ?? 'Failed to load tryout day.');
    } finally {
      setLoading(false);
    }
  }, [base, fail]);

  useEffect(() => { load(); }, [load]);

  const isAnonymous = tryout?.isAnonymous ?? true;

  // Reveal is ONE-WAY and confirmed — once names are shown they can't be re-hidden.
  async function revealNames() {
    if (!canWrite || revealing) return;
    const ok = await confirm({
      title: 'Reveal player names?',
      message: 'Names will show on the check-in screen, scoreboard, and decision board. This can’t be undone — you can’t switch back to bib-only for this tryout.',
      confirmText: 'Reveal names',
      tone: 'warning',
    });
    if (!ok) return;
    setRevealing(true);
    try {
      const res = await fetch(`${base}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAnonymous: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to reveal names');
      setTryout(data.tryout);
    } catch (e: any) {
      fail(e.message ?? 'Failed to reveal names.');
    } finally {
      setRevealing(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm(BLANK);
    setFormError(null);
    setModalOpen(true);
  }
  function openEdit(s: RepTryoutSession) {
    setEditingId(s.id);
    setForm({
      startsAt: toInputValue(s.startsAt),
      endsAt: toInputValue(s.endsAt),
      location: s.location ?? '',
      fieldNumber: s.fieldNumber ?? '',
      label: s.label ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function saveSession() {
    if (!form.startsAt) { setFormError('Pick a date and time.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        location: form.location,
        fieldNumber: form.fieldNumber,
        label: form.label,
      };
      const res = editingId
        ? await fetch(`${base}/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch(`${base}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.startsAt ?? data.error ?? 'Failed to save session');
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSession(id: string) {
    if (!canWrite || deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Failed to remove'); }
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      fail(e.message ?? 'Failed to remove session.');
    } finally {
      setDeletingId(null);
    }
  }

  const windowNotice = form.startsAt ? getTryoutWindowNotice(new Date(form.startsAt), { sport }) : null;

  if (loading) return null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}><ClipboardList size={16} /> Tryout Day</h3>
          <p className={styles.subtitle}>Sessions appear on the team schedule.</p>
        </div>
        {isAnonymous ? (
          canWrite && (
            <button
              type="button"
              className={styles.revealBtn}
              onClick={revealNames}
              disabled={revealing}
              title="Reveal player names (one-way — can’t switch back to bib-only)"
            >
              <Eye size={14} /> Reveal names
            </button>
          )
        ) : (
          <span className={styles.revealedChip} title="Names are shown for this tryout">
            <EyeOff size={13} /> Names revealed
          </span>
        )}
      </div>

      {isAnonymous && (
        <p className={styles.blindHint}><strong>Blind evaluation is on</strong> — players show as bib numbers only. Reveal names when you’re ready to make decisions (one-way).</p>
      )}

      {sessions.length === 0 ? (
        <p className={styles.empty}>No sessions yet. Add the date(s) and time(s) of your tryout.</p>
      ) : (
        <div className={styles.sessionList}>
          {sessions.map(s => (
            <div key={s.id} className={styles.sessionRow}>
              <div className={styles.sessionMain}>
                <div className={styles.sessionWhen}>{formatWhen(s)}</div>
                {(s.location || s.fieldNumber || s.label) && (
                  <div className={styles.sessionMeta}>
                    {[s.label, s.location, s.fieldNumber && `Field ${s.fieldNumber}`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              {canWrite && (
                <div className={styles.sessionActions}>
                  <button type="button" className={styles.iconBtn} onClick={() => openEdit(s)} aria-label="Edit session"><Pencil size={15} /></button>
                  <button type="button" className={`${styles.iconBtn} ${styles.iconDanger}`} onClick={() => deleteSession(s.id)} disabled={deletingId === s.id} aria-label="Remove session"><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        {canWrite && (
          <button type="button" className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add session</button>
        )}
        {checkInHref && (
          <Link
            href={checkInHref}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          >
            <UserCheck size={15} /> Open day-of check-in
          </Link>
        )}
      </div>

      {modalOpen && (
        <div className={styles.scrim} onClick={() => !saving && setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{editingId ? 'Edit session' : 'Add session'}</h3>

            <div className={styles.field}>
              <label className={styles.label}>Date &amp; start time</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
              />
            </div>

            {windowNotice && (
              <div className={styles.warnWrap}>
                <HelpCallout variant="warning" title="Outside the usual tryout window" body={windowNotice} />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>End time <span style={{ color: 'rgba(255,255,255,0.35)' }}>· optional</span></label>
              <input
                className={styles.input}
                type="datetime-local"
                value={form.endsAt}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
              />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Location</label>
                <input className={styles.input} type="text" maxLength={120} value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Centennial Park" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Field / diamond</label>
                <input className={styles.input} type="text" maxLength={40} value={form.fieldNumber}
                  onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))} placeholder="e.g. Diamond 3" />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Label <span style={{ color: 'rgba(255,255,255,0.35)' }}>· optional</span></label>
              <input className={styles.input} type="text" maxLength={80} value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Day 1 — skills" />
            </div>

            {formError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{formError}</p>}

            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveSession} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save' : 'Add session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
