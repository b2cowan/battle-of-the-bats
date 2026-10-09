'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useDiscardGuard, touched } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { getTryoutWindowNotice } from '@/lib/tryout-windows';
import { utcToZonedInputs, addCalendarDays } from '@/lib/timezone';
import { formatTryoutSessionWhen } from '@/lib/tryout-session-label';
import { surfaceLabel } from '@/lib/sports';
import WhereField, { WhereLine } from '@/components/venue/WhereField';
import { useClashCheck, readFindingsPerDate, countFindings } from '@/components/venue/useClashCheck';
import { EMPTY_WHERE, whereBody, whereOf, type WhereValue } from '@/lib/where-field';
import { clashLine } from '@/lib/venue-clash-words';
import type { ClubVenueOption, RepTryout, RepTryoutSession } from '@/lib/types';
import type { SetupItemStatus } from './TryoutSetupChecklist';
import TryoutNamesSwitch from './TryoutNamesSwitch';
import styles from './TryoutDayCard.module.css';

/**
 * The "Tryout dates" manager — the body of the first Get-set-up checklist row (2026-08-17; the
 * standalone card chrome and the check-in CTA moved out: check-in lives on the Tryout day tab and
 * the row bar owns the title/status). Sessions still appear on the team schedule.
 *
 * The names control came BACK here on 2026-08-25 — as a two-way switch beside the hint, because
 * the stage where a coach configures the tryout is the stage where "do I want blind scoring at
 * all?" is actually asked. It is the same TryoutNamesSwitch the board and Decide mount.
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
  /** Fired after the names switch changes. ⚠ REQUIRED for the pill to stick: `blind` above is the
   *  PAGE's overview value and outranks this card's own fetch, and the overview only refreshes when
   *  a session's status moves — so without this the pill visibly snapped back to its pre-toggle
   *  state after a successful save (/review 2026-08-25). */
  onBlindChanged?: () => void;
}

interface SessionForm {
  startsAt: string;   // datetime-local value
  endsAt: string;     // datetime-local value (optional)
  /** Where (Club Tier Stage 6a, Ask 13): one of the club's venues and its facility, or typed words. */
  where: WhereValue;
  label: string;
}

const BLANK: SessionForm = { startsAt: '', endsAt: '', where: EMPTY_WHERE, label: '' };

/**
 * Stored instant → the `YYYY-MM-DDTHH:mm` value `<input type="datetime-local">` wants, read in
 * the CLUB's zone.
 *
 * ⚠ It used to SLICE the stored string, back when a session was written as a bare wall clock.
 * Both halves changed together on 2026-08-24 (see the create route): a session is a real moment
 * now, so re-opening one has to convert it back — slicing would put the UTC clock in the field,
 * and a coach who saved without touching it would move their own tryout by the zone offset.
 */
function toInputValue(stored: string | null): string {
  if (!stored) return '';
  const { date, time } = utcToZonedInputs(stored);
  return date && time ? `${date}T${time}` : '';
}

/** The row receipt: both sessions when there are two, "+N more" past that. */
function receipt(sessions: RepTryoutSession[]): string | null {
  if (sessions.length === 0) return null;
  if (sessions.length <= 2) return sessions.map(formatTryoutSessionWhen).join('  +  ');
  return `${formatTryoutSessionWhen(sessions[0])} + ${sessions.length - 1} more`;
}

/** Local wall-clock `YYYY-MM-DDTHH:mm` for a Date — the shape datetime-local wants. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Minutes between two datetime-local values — null when either is missing or the pair is
 *  backwards, so callers fall back to the 2-hour default rather than seeding a negative length. */
function minutesBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 60_000);
}

/** A datetime-local value plus N minutes, still as a datetime-local value. */
function addMinutes(value: string, minutes: number): string {
  const t = new Date(value).getTime();
  if (isNaN(t)) return '';
  return toLocalInput(new Date(t + minutes * 60_000));
}

export default function TryoutDayCard({ apiBase, canWrite, sport, onError, onStatus, blind, onBlindChanged }: Props) {
  const base = apiBase;

  const [tryout, setTryout] = useState<RepTryout | null>(null);
  const [sessions, setSessions] = useState<RepTryoutSession[]>([]);
  // The club's venues (Club Tier Stage 6a): read with the sessions, offered in the Venue field — in a club only.
  const [clubVenues, setClubVenues] = useState<{ inClub: boolean; venues: ClubVenueOption[] }>({ inClub: false, venues: [] });
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
    detail: form.startsAt ? `a session on ${formatTryoutSessionWhen({ startsAt: form.startsAt, endsAt: form.endsAt || null } as RepTryoutSession)}` : undefined,
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
      setClubVenues(data.clubVenues?.inClub ? { inClub: true, venues: data.clubVenues.venues ?? [] } : { inClub: false, venues: [] });
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
    // The form opens fully seeded. With sessions ALREADY on the list it FOLLOWS them — same time
    // of day, next calendar day, same length — because a tryout is a run of near-identical
    // evenings and retyping the date for day 2 is pure friction (owner 2026-08-25). Only the
    // FIRST session falls back to ROUND HOURS (owner 2026-08-17): start = the next full hour,
    // end = start + 2h — never the current wall-clock minutes. Seeding sets the BASELINE too: our
    // prefill is not the coach's work, so an untouched seeded form still closes silently (the
    // Chunk G rider).
    // ⚠ The follow-on seed steps the CLUB wall clock (the strings the field shows) by a CALENDAR
    // day, not an instant by 86_400_000ms — across a DST boundary the latter arrives an hour off,
    // which is exactly the class of bug `addCalendarDays` exists to prevent.
    // ⚠ The ROUNDING is the device's next full hour; the VALUE is then rendered in the club's
    // zone, which is the zone it will be read back in. On a device whose offset from the club is a
    // whole number of hours — every North American one — those are the same thing. On a half-hour
    // offset the prefill simply is not a round hour in club terms, which costs a coach one edit and
    // nothing else: whatever they submit is converted correctly on save either way.
    // (Comment corrected /review 2026-08-24 — it used to claim the rounding itself was club-side.)
    let seeded: SessionForm;
    // The list arrives ordered by start, so the last row is the latest session.
    const previous = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const prevStart = previous ? toInputValue(previous.startsAt) : '';
    if (previous && prevStart) {
      const [prevDate, prevTime] = prevStart.split('T');
      const startsAt = `${addCalendarDays(prevDate, 1)}T${prevTime}`;
      const prevEnd = toInputValue(previous.endsAt);
      seeded = { ...BLANK, startsAt, endsAt: addMinutes(startsAt, minutesBetween(prevStart, prevEnd) ?? 120) };
    } else {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      const end = new Date(start);
      end.setHours(end.getHours() + 2);
      seeded = {
        ...BLANK,
        startsAt: toInputValue(start.toISOString()),
        endsAt: toInputValue(end.toISOString()),
      };
    }
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
      where: whereOf(s),
      label: s.label ?? '',
    };
    setEditingId(s.id);
    setForm(loaded);
    setFormBaseline(loaded);
    setFormError(null);
    setModalOpen(true);
  }

  // The live clash check (Club Tier Stage 6a — the owner's "Join the check"): a tryout day on one of the club's
  // venues takes the diamond as surely as a practice. The coach's own check, so the line reads the same words.
  // The tryout-sessions base sits beside the team's other routes; the coach's check is the schedule's own.
  const { result: clashResults, checking, lineIsCurrent } = useClashCheck(
    modalOpen && form.where.source === 'club' && form.startsAt ? {
      path: base.replace(/\/tryout-sessions$/, '/venue-clashes'),
      body: { orgVenueId: form.where.orgVenueId, orgVenueFacilityId: form.where.orgVenueFacilityId, occurrences: [{ startsAt: form.startsAt, endsAt: form.endsAt }] },
    } : null,
    readFindingsPerDate,
    countFindings,
  );
  const said = clashLine(clashResults?.[0] ?? [], { sport, venueName: form.where.location, facilityName: form.where.orgVenueFacilityId ? form.where.fieldNumber : null });
  const whereLine = said ? <WhereLine tone={said.tone} lead={said.lead} rest={said.rest} /> : null;

  async function saveSession() {
    if (!form.startsAt) { setFormError('Pick a date and time.'); return; }
    if (form.endsAt && new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      setFormError('The end time must be after the start time.');
      return;
    }
    // Save checks again first (Ask 5): a booking made since the line was read comes back as the line, and the
    // window stays open on it; a second press saves anyway. Never refuses.
    if (!(await lineIsCurrent())) return;
    setSaving(true);
    setFormError(null);
    try {
      const where = whereBody(form.where);
      const payload = {
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        // A club venue's links (the server copies its words) or typed words. A tryout day has no place book.
        location: where.location,
        locationAddress: where.locationAddress,
        fieldNumber: where.fieldNumber,
        orgVenueId: where.orgVenueId,
        orgVenueFacilityId: where.orgVenueFacilityId,
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

  // ⚰ `facilityLabel` / `facilityExample` (→ 2026-10-08, Club Tier Stage 6a): the Venue field reads the sport's own
  // word itself (`fieldNounFor`) — "Diamond", "Court", "Field" — the one derivation every form shares (Ask 13).

  return (
    <>
      {loading ? (
        <p className={styles.empty}>Loading sessions…</p>
      ) : (
        <>
          {/* The switch lives HERE too (owner 2026-08-25), not only on Decide: a coach who never
              wanted blind scoring was being made to walk three stages forward to turn it off, at
              the one moment they are actually configuring the tryout. */}
          <div className={styles.blindHint}>
            <p>
              {isAnonymous
                ? <><strong>Names are hidden</strong> — players show as bib numbers on the board, on your helpers’ phones and on the printed sheet.</>
                : <><strong>Names are showing</strong> — players appear by name everywhere, including your helpers’ phones.</>}
            </p>
            <TryoutNamesSwitch
              apiBase={base}
              canWrite={canWrite}
              blind={isAnonymous}
              onChanged={() => { load(); onBlindChanged?.(); }}
              onError={fail}
            />
          </div>

          {sessions.length > 0 && (
            <div className={styles.sessionList} style={{ marginTop: '0.6rem' }}>
              {sessions.map(s => (
                <div key={s.id} className={styles.sessionRow}>
                  <div className={styles.sessionMain}>
                    <div className={styles.sessionWhen}>{formatTryoutSessionWhen(s)}</div>
                    {(s.location || s.fieldNumber || s.label) && (
                      <div className={styles.sessionMeta}>
                        {[s.label, s.location, surfaceLabel(sport, s.fieldNumber)].filter(Boolean).join(' · ')}
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
                    // With NO length to keep — an empty end field — it fills to start + 2h
                    // (owner 2026-08-25) rather than staying blank, which is what a coach who
                    // cleared it, or opened a session saved without one, used to be left with.
                    // The two are deliberately NOT collapsed into "always +2h": that would eat a
                    // deliberate 3-hour end the moment the coach corrected the date.
                    if (!next) return { ...f, startsAt: next };
                    // ⚠ ONLY an EMPTY end gets filled. This read `!f.startsAt || !f.endsAt`, which
                    // also fired when the START was blank and the end held a real value — clearing
                    // and re-picking the date on a 6:00–9:30pm session silently shrank it to two
                    // hours, the exact clobber the comment above swears off (/review 2026-08-25).
                    if (!f.endsAt) return { ...f, startsAt: next, endsAt: addMinutes(next, 120) };
                    // No old start to measure a length from — keep the end the coach chose.
                    if (!f.startsAt) return { ...f, startsAt: next };
                    const oldStart = new Date(f.startsAt), oldEnd = new Date(f.endsAt), newStart = new Date(next);
                    if (isNaN(oldStart.getTime()) || isNaN(oldEnd.getTime()) || isNaN(newStart.getTime())) {
                      return { ...f, startsAt: next, endsAt: addMinutes(next, 120) };
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

            {/* Where — the one Venue field (Club Tier Stage 6a, Ask 13): the club's venues (in a club), or typed
                words; the facility under the sport's word beside it; the clash line under them. ⚰ "Location" and
                the "Field / diamond" box (→ 2026-10-08). */}
            <div className={styles.field}>
              <WhereField
                idPrefix="tryout"
                sport={sport}
                value={form.where}
                onChange={w => setForm(f => ({ ...f, where: w }))}
                clubVenues={clubVenues.venues}
                inClub={clubVenues.inClub}
                classes={{ field: styles.field, label: styles.label, input: styles.input, select: styles.input }}
                line={whereLine}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Label <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.35))' }}>· optional</span></label>
              <input className={styles.input} type="text" maxLength={80} value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Day 1 — skills" />
            </div>

            {formError && <p style={{ color: 'var(--danger-light)', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{formError}</p>}

            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => guardedClose()} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveSession} disabled={saving || checking}>
                {saving ? 'Saving…' : editingId ? 'Save' : 'Add session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
