'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useDiscardGuard, touched } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { getTryoutWindowNotice } from '@/lib/tryout-windows';
import { getSportPack } from '@/lib/sports';
import type { RepTryout, RepTryoutSession } from '@/lib/types';
import type { SetupItemStatus } from './TryoutSetupChecklist';
import styles from './TryoutDayCard.module.css';

/**
 * The "Tryout dates" manager — the body of the first Get-set-up checklist row (2026-08-17; the
 * standalone card chrome, the Reveal-names control, and the check-in CTA all moved out: reveal
 * lives on the Decide tab via TryoutRevealControl, check-in on the Tryout day tab, and the row
 * bar owns the title/status). Sessions still appear on the team schedule.
 */

interface Props {
  /** The tryout-sessions API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-sessions`.
   *  GET/POST/PATCH hit this; per-session ops hit `${apiBase}/{sessionId}`. */
  apiBase: string;
  canWrite: boolean;
  sport?: string | null;
  onError?: (msg: string) => void;
  /** Reports {done, summary} to the checklist row whenever sessions change. */
  onStatus?: (s: SetupItemStatus) => void;
  /** LIVE blind state from the page's overview (refreshed on reveal). This card fetches its own
   *  copy once on mount and stays mounted for the whole session, so without this the blind hint
   *  reads stale after Reveal names fires on the Decide tab (/review 2026-08-17). */
  blind?: boolean;
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

/** The row receipt: both sessions when there are two, "+N more" past that. */
function receipt(sessions: RepTryoutSession[]): string | null {
  if (sessions.length === 0) return null;
  if (sessions.length <= 2) return sessions.map(formatWhen).join('  +  ');
  return `${formatWhen(sessions[0])} + ${sessions.length - 1} more`;
}

/** Local wall-clock `YYYY-MM-DDTHH:mm` for a Date — the shape datetime-local wants. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TryoutDayCard({ apiBase, canWrite, sport, onError, onStatus, blind }: Props) {
  const base = apiBase;

  const [tryout, setTryout] = useState<RepTryout | null>(null);
  const [sessions, setSessions] = useState<RepTryoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(BLANK);
  // ONE baseline set by every open path (add = BLANK, edit = the loaded session) so the guard
  // can't drift from what the form actually started as (Chunk A D4).
  const [formBaseline, setFormBaseline] = useState<SessionForm>(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useOverlayOpen(modalOpen);
  // In ADD mode the whole form opens seeded (start + end); clearing a seeded end back to empty is
  // not the coach's work either, so it must not trip the guard. Edit mode keeps the strict compare:
  // clearing a SAVED end time is a real change worth protecting.
  const dirtyForm = !editingId && form.endsAt === '' ? { ...form, endsAt: formBaseline.endsAt } : form;
  const guardedClose = useDiscardGuard({
    dirty: touched(dirtyForm, formBaseline),
    close: () => setModalOpen(false),
    noun: 'tryout session',
    detail: form.startsAt ? `a session on ${formatWhen({ startsAt: form.startsAt, endsAt: form.endsAt || null } as RepTryoutSession)}` : undefined,
  });

  // Latest-ref for onError so `load` never re-arms on a parent re-render (the siblings' pattern).
  // Without this, the page's focus-driven overview refresh handed down a new onError identity,
  // re-firing the load effect — the "flashes back to Loading whenever I return to the tab" bug.
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((msg: string) => { if (onErrorRef.current) onErrorRef.current(msg); else console.error(msg); }, []);

  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
  useEffect(() => {
    if (loading) return;
    onStatusRef.current?.({ done: sessions.length > 0, summary: receipt(sessions) });
  }, [loading, sessions]);

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

  // The prop is authoritative when the page provides it (it tracks reveals live); our own
  // fetched copy is the fallback for the first paint before the overview lands.
  const isAnonymous = blind ?? tryout?.isAnonymous ?? true;

  function openAdd() {
    // The form opens fully seeded to ROUND HOURS (owner 2026-08-17): start = the next full hour,
    // end = start + 2h — never the current wall-clock minutes. Seeding sets the BASELINE too: our
    // prefill is not the coach's work, so an untouched seeded form still closes silently (the
    // Chunk G rider).
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    const seeded: SessionForm = { ...BLANK, startsAt: toLocalInput(start), endsAt: toLocalInput(end) };
    setEditingId(null);
    setForm(seeded);
    setFormBaseline(seeded);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(s: RepTryoutSession) {
    const loaded: SessionForm = {
      startsAt: toInputValue(s.startsAt),
      endsAt: toInputValue(s.endsAt),
      location: s.location ?? '',
      fieldNumber: s.fieldNumber ?? '',
      label: s.label ?? '',
    };
    setEditingId(s.id);
    setForm(loaded);
    setFormBaseline(loaded);
    setFormError(null);
    setModalOpen(true);
  }

  async function saveSession() {
    if (!form.startsAt) { setFormError('Pick a date and time.'); return; }
    if (form.endsAt && new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      setFormError('The end time must be after the start time.');
      return;
    }
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

  // No window warning on the UNTOUCHED add-seed — a heads-up about a date the coach never chose
  // is noise; it appears the moment they pick their real date (and always in edit mode).
  const startTouched = editingId != null || form.startsAt !== formBaseline.startsAt;
  const windowNotice = form.startsAt && startTouched ? getTryoutWindowNotice(new Date(form.startsAt), { sport }) : null;

  // Venue vocabulary from the sport pack — a basketball tryout shouldn't say "diamond" (WI-9).
  const facility = getSportPack(sport ?? undefined).defaultFacilityType;
  const facilityLabel = facility === 'diamond' ? 'Field / diamond' : facility === 'court' ? 'Court' : 'Field / venue';
  const facilityExample = facility === 'diamond' ? 'e.g. Diamond 3' : facility === 'court' ? 'e.g. Court 2' : 'e.g. Field 3';

  return (
    <>
      {loading ? (
        <p className={styles.empty}>Loading sessions…</p>
      ) : (
        <>
          {isAnonymous && (
            <p className={styles.blindHint}><strong>Blind evaluation is on</strong> — players show as bib numbers only. Reveal names on the Decide tab when you’re ready to make picks (one-way).</p>
          )}

          {sessions.length > 0 && (
            <div className={styles.sessionList} style={{ marginTop: '0.6rem' }}>
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

          {canWrite && (
            <div className={styles.actions}>
              <button type="button" className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add session</button>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className={styles.scrim} onClick={() => !saving && guardedClose()}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{editingId ? 'Edit session' : 'Add session'}</h3>

            <div className={styles.field}>
              <label className={styles.label}>Date &amp; start time</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={form.startsAt}
                onChange={e => {
                  const next = e.target.value;
                  setForm(f => {
                    // End FOLLOWS start, keeping the session length (calendar convention,
                    // owner 2026-08-17) — moving a 6–8pm session to 4pm makes it 4–6pm.
                    if (!next || !f.startsAt || !f.endsAt) return { ...f, startsAt: next };
                    const oldStart = new Date(f.startsAt), oldEnd = new Date(f.endsAt), newStart = new Date(next);
                    if (isNaN(oldStart.getTime()) || isNaN(oldEnd.getTime()) || isNaN(newStart.getTime())) {
                      return { ...f, startsAt: next };
                    }
                    const shiftedEnd = new Date(newStart.getTime() + (oldEnd.getTime() - oldStart.getTime()));
                    return { ...f, startsAt: next, endsAt: toLocalInput(shiftedEnd) };
                  });
                }}
              />
            </div>

            {windowNotice && (
              <div className={styles.warnWrap}>
                <HelpCallout variant="warning" title="Outside the usual tryout window" body={windowNotice} />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>End time <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.35))' }}>· optional</span></label>
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
                <label className={styles.label}>{facilityLabel}</label>
                <input className={styles.input} type="text" maxLength={40} value={form.fieldNumber}
                  onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))} placeholder={facilityExample} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Label <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.35))' }}>· optional</span></label>
              <input className={styles.input} type="text" maxLength={80} value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Day 1 — skills" />
            </div>

            {formError && <p style={{ color: 'var(--danger-light)', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{formError}</p>}

            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => guardedClose()} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveSession} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save' : 'Add session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
