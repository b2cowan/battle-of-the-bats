'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import CoachPageSection from '@/components/coaches/CoachPageSection';
import CoachLoading from '@/components/coaches/CoachLoading';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import RecordObservationDialog from '@/components/coaches/RecordObservationDialog';
import { REMOVE_OBSERVATION_CONFIRM, fixedObservation, patchObservation, deleteObservation } from '@/components/coaches/observation-sheet-host';
import { groupPlayerNotesByMonth, type PlayerNoteEntry } from '@/lib/player-notes-timeline';
import { MAX_PLAYER_NOTE_LEN } from '@/lib/development-input';
import type { RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';
import { todayLocal, formatShortDate, formatShortInstant } from '@/lib/measurable-format';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The player's NOTES tab (roster + player page review, hub F20 — owner rulings 2026-09-13, R2-3
 * and Q7–Q10).
 *
 * Three things, top to bottom:
 *   1. The pinned ABOUT note — the record's own undated `notes` field, moved here from Details
 *      (Q8). It is still the page's form state and still saves through the page's Save bar; this
 *      component only draws it. One standing note per player: the things that are always true.
 *   2. One door — "Add a note" — for the general note that fits none of the other sources. A
 *      date (today), the words, and optionally what it is about (a goal, a game or practice).
 *      No tags, no categories, no attachments (Q10).
 *   3. The TIMELINE: every dated entry about this player — bench moments, skill observations,
 *      goal reviews, general notes — newest first, grouped by month, each marked with where it
 *      came from and who wrote it, the chip opening its source. Written once, read here. A general
 *      note is edited or removed on this tab's own form; an OBSERVATION opens in its sheet from its
 *      row — this tab is its home (re-evaluation stage 3, E2, 2026-09-15; the Observations view on
 *      Skills & Goals is gone) — and the sheet carries Remove; a moment and a review are edited
 *      where they were written.
 *
 * Who can read it: coaches with Internal notes, the same as goals (the route 403s the rest and
 * the page never draws the tab for them). Families never see it; the season recap never reads it.
 * The tab says so in one line at its foot, because a dated free-text log about a minor is the
 * surface most likely to drift into what the product's privacy posture rules out.
 */

/** What the notes route sends — the pickers are empty for a coach who cannot write. */
interface TimelinePayload {
  canWrite: boolean;
  entries: PlayerNoteEntry[];
  authors: Record<string, string>;
  goals: { id: string; focusArea: string }[];
  events: { id: string; name: string; startsAt: string }[];
  /** The records behind the observation rows and the skills they name — a writer's, for the sheet. */
  observations: RepPlayerObservation[];
  skills: RepTeamMeasurableType[];
}

/** "goal:ID" | "event:ID" | "" — one picker for what a note is about. */
type AboutKey = string;

export default function PlayerNotesTab({
  orgSlug, teamId, playerId, playerFirstName, about,
}: {
  orgSlug: string;
  teamId: string;
  playerId: string;
  playerFirstName: string;
  /** The pinned About note — the record's `notes` field, drawn here, saved by the page's Save bar. */
  about: { value: string; canEdit: boolean; onChange: (v: string) => void };
}) {
  const confirm = useConfirm();
  const [data, setData] = useState<TimelinePayload | null>(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ notedOn: todayLocal(), body: '', about: '' as AboutKey });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // The observation sheet (E2) — the same sheet the goal's history and the session grid open.
  const [obs, setObs] = useState<RepPlayerObservation | null>(null);
  const [obsBusy, setObsBusy] = useState(false);
  const [obsErr, setObsErr] = useState('');

  const api = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/notes`;
  const devApi = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/development`;

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(api, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load notes');
      setData(json as TimelinePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes.');
    }
  }, [api]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const first = playerFirstName || 'this player';
  // Every entry names who wrote it (owner ruling 2026-09-11); a name the org no longer has — a coach
  // who has since left — reads as "a coach" rather than as nobody.
  const authorName = (id: string | null) => (id && data?.authors[id]) || 'a coach';
  const months = useMemo(() => (data ? groupPlayerNotesByMonth(data.entries) : []), [data]);

  function openCompose() {
    setEditingId(null);
    setDraft({ notedOn: todayLocal(), body: '', about: '' });
    setFormError('');
    setComposing(true);
  }
  function openEdit(entry: PlayerNoteEntry) {
    // The entry carries its words and its date; what it is about is re-read from the chip's
    // source rather than stored twice — the picker starts blank on an edit and keeps the link
    // unless the coach changes it.
    setEditingId(entry.id);
    setDraft({ notedOn: entry.on, body: entry.body, about: '' });
    setFormError('');
    setComposing(true);
  }
  /** '' = leave the link as it is (edit) / nothing (create); 'none' = unlink; else one link. */
  function aboutFields(key: AboutKey): { goalId?: string | null; eventId?: string | null } {
    if (key.startsWith('goal:')) return { goalId: key.slice(5), eventId: null };
    if (key.startsWith('event:')) return { eventId: key.slice(6), goalId: null };
    if (key === 'none') return { goalId: null, eventId: null };
    return {};
  }

  async function save() {
    if (saving) return; // a second tap before React commits `disabled` must not post twice
    if (!draft.body.trim()) { setFormError('Write the note first.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = editingId
        ? { notedOn: draft.notedOn, body: draft.body, ...(draft.about ? aboutFields(draft.about) : {}) }
        : { notedOn: draft.notedOn, body: draft.body, ...aboutFields(draft.about) };
      const res = await fetch(editingId ? `${api}/${editingId}` : api, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      setComposing(false); setEditingId(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }
  /** An observation row's door (E2): the record behind it, in the sheet the session grid and the goal use. */
  function openObservation(entry: PlayerNoteEntry) {
    const record = data?.observations.find(o => o.id === entry.id) ?? null;
    if (!record) return;
    setObsErr('');
    setObs(record);
  }
  // The save and the remove are the host module's (shared with the Skills & Goals tab); the timeline
  // is re-read after either because the server shapes its entries (labels, month groups) — the same
  // reason the general note's form reloads.
  async function submitObservation(v: { measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null }) {
    if (!obs || obsBusy) return;
    setObsBusy(true); setObsErr('');
    try {
      const patched = await patchObservation(devApi, obs, v);
      setObs(null);
      if (patched) await load();
    } catch (e) {
      setObsErr(e instanceof Error ? e.message : 'Could not save the observation — try again.');
    } finally {
      setObsBusy(false);
    }
  }
  async function removeObservation() {
    if (!obs || obsBusy) return;
    if (!(await confirm(REMOVE_OBSERVATION_CONFIRM))) return;
    setObsBusy(true); setObsErr('');
    try {
      await deleteObservation(devApi, obs.id);
      setObs(null);
      await load();
    } catch (e) {
      setObsErr(e instanceof Error ? e.message : "Couldn't remove the observation — try again.");
    } finally {
      setObsBusy(false);
    }
  }
  /** A session-dated observation opens with its skill and date fixed by the session (the same sheet, C12's mode). */
  const obsSkill = obs ? data?.skills.find(s => s.id === obs.measurableTypeId) ?? null : null;
  const obsFixed = obs ? fixedObservation(obs, obsSkill, first, authorName(obs.createdBy)) : null;

  async function remove(entry: PlayerNoteEntry) {
    const ok = await confirm({
      title: 'Remove this note?',
      message: 'It comes off the timeline. Moments, observations and reviews are not affected.',
      confirmText: 'Remove', cancelText: 'Keep it', tone: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`${api}/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Failed to remove'); }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove.');
    }
  }

  return (
    <>
      {/* 1 · The pinned About note (Q8) */}
      <CoachPageSection sectionId="about" title={`About ${first}`} meta="Pinned">
        {about.canEdit ? (
          <div className={styles.field}>
            <textarea
              id="about-note"
              className={styles.textarea}
              rows={3}
              value={about.value}
              onChange={e => about.onChange(e.target.value)}
              placeholder={`The things that are always true about ${first} — private to your coaching staff, never shown to families`}
              maxLength={1000}
              aria-label={`About ${first}`}
            />
            <p className={styles.detailPlaceholder} style={{ marginBottom: 0 }}>Saves with the page’s Save bar.</p>
          </div>
        ) : (
          about.value.trim()
            ? <p className={styles.aboutNoteText}>{about.value}</p>
            : <p className={styles.detailPlaceholder} style={{ margin: 0 }}>Nothing pinned yet.</p>
        )}
      </CoachPageSection>

      {/* 2 · One door, and the timeline's own toolbar */}
      {error && <p className={styles.detailPlaceholder}>{error}</p>}
      {!data && !error && <CoachLoading label="Loading the notes…" inline />}
      {data && (
        <>
          <div className={styles.notesToolbar}>
            {data.canWrite && !composing && (
              <button type="button" className="btn btn-ghost" onClick={openCompose}>
                <Plus size={14} aria-hidden /> Add a note
              </button>
            )}
            <span className={styles.notesToolbarHint}>Newest first · grouped by month</span>
          </div>

          {/* The form is not a `?section=` address — nothing links to it, and a coach who reloads
              mid-note has not lost an address, only a draft. */}
          {composing && (
            <CoachPageSection title={editingId ? 'Edit note' : 'Add a note'}>
              <div className={styles.noteForm}>
                <div className={styles.noteFormRow}>
                  <div className={styles.field} style={{ flex: '0 0 170px' }}>
                    <label className={styles.label} htmlFor="note-date">Date</label>
                    <input id="note-date" className={styles.input} type="date" value={draft.notedOn}
                      onChange={e => setDraft(d => ({ ...d, notedOn: e.target.value }))} />
                  </div>
                  <div className={styles.field} style={{ flex: '1 1 240px' }}>
                    <label className={styles.label} htmlFor="note-about">About</label>
                    <select id="note-about" className={styles.select} value={draft.about}
                      onChange={e => setDraft(d => ({ ...d, about: e.target.value }))}>
                      {/* On an edit the blank keeps the link; "Nothing in particular" clears it — a
                          note tied to the wrong goal must be fixable without retyping it (/review). */}
                      <option value="">{editingId ? 'Leave as is' : 'Nothing in particular'}</option>
                      {editingId && <option value="none">Nothing in particular</option>}
                      {data.goals.length > 0 && (
                        <optgroup label="A goal">
                          {data.goals.map(g => <option key={g.id} value={`goal:${g.id}`}>{g.focusArea}</option>)}
                        </optgroup>
                      )}
                      {data.events.length > 0 && (
                        <optgroup label="A game or practice">
                          {data.events.map(ev => (
                            <option key={ev.id} value={`event:${ev.id}`}>{formatShortInstant(ev.startsAt)} · {ev.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="note-body">The note</label>
                  <textarea id="note-body" className={styles.textarea} rows={3} value={draft.body}
                    maxLength={MAX_PLAYER_NOTE_LEN}
                    placeholder="What you noticed, in your words"
                    onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                </div>
                {formError && <p className={styles.detailPlaceholder} style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>}
                <div className={styles.noteFormActions}>
                  <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => { setComposing(false); setEditingId(null); }}>Cancel</button>
                  <button type="button" className="btn btn-lime" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save note'}</button>
                </div>
              </div>
            </CoachPageSection>
          )}

          {/* 3 · The timeline — ONE section (the `?section=notes` address), the months inside it. */}
          <CoachPageSection sectionId="notes" title="Notes" meta={data.entries.length > 0 ? `${data.entries.length} ${data.entries.length === 1 ? 'entry' : 'entries'}` : undefined}>
            {months.length === 0 ? (
              <p className={styles.detailPlaceholder} style={{ margin: 0 }}>
                Nothing written about {first} yet. A line from the bench on game day, an observation or a goal review on Skills &amp; Goals, or a note here — they all read here.
              </p>
            ) : months.map(m => (
              <div key={m.month} className={styles.notesMonthGroup}>
                <p className={styles.notesMonth}>{m.label}</p>
                <ul className={styles.noteList}>
                  {m.entries.map(e => (
                    <li key={e.key} className={styles.noteRow}>
                      <span className={styles.noteDate}>{formatShortDate(e.on)}</span>
                      <span className={styles.noteMain}>
                        <span className={styles.noteMainHead}>
                          {e.aboutHref
                            ? <Link href={e.aboutHref} className={`${styles.noteAbout}${e.source === 'moment' ? ` ${styles.noteAboutGame}` : ''}`}>{e.about}</Link>
                            : <span className={styles.noteAbout}>{e.about}</span>}
                        </span>
                        {(e.qualifier || e.body) && (
                          <span className={styles.noteBody}>
                            {e.qualifier && <span className={styles.noteQualifier}>{e.qualifier}{e.body ? ' — ' : ''}</span>}
                            {e.body}
                          </span>
                        )}
                      </span>
                      <span className={styles.noteSide}>
                        {authorName(e.authorId)}
                        {e.editable && data.canWrite && e.source === 'note' && (
                          <>
                            <button type="button" className={styles.noteAction} onClick={() => openEdit(e)}>Edit</button>
                            <button type="button" className={styles.noteAction} onClick={() => remove(e)}>Remove</button>
                          </>
                        )}
                        {/* An observation is edited in its sheet, wherever it is read (E2) — Remove lives in the sheet's footer. */}
                        {e.editable && data.canWrite && e.source === 'observation' && (
                          <button type="button" className={styles.noteAction} onClick={() => openObservation(e)}>Edit</button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CoachPageSection>

          <p className={styles.notesFoot}>
            Who can read this: coaches with Internal notes, the same as goals. Families never see the Notes tab, and the season recap does not draw from it.
          </p>
          {obs && (
            <RecordObservationDialog key={obs.id} skills={obsSkill ? [obsSkill] : data.skills} goals={data.goals} editing={obs} fixed={obsFixed}
              busy={obsBusy} error={obsErr} onSubmit={submitObservation} onClose={() => { if (!obsBusy) setObs(null); }} onRemove={removeObservation} />
          )}
        </>
      )}
    </>
  );
}
