'use client';
/**
 * A FAMILY'S NOTES (Club Tier Stage 5c, P3 — owner Ask 29, 2026-10-19; hub K4MPu4ni53Ct7yrDcmWJd9 v121 → Stage 5c → P3).
 * The coaches' player notes are the recipe — a signed, dated list — never the club's single unsigned boxes.
 *
 *   the section (after Children) — a 16 px heading with Add a note (the white outline act) at its right; the once-line
 *     ("Staff only…"); the notes newest first, the newest TWO, then Show all (as History does: Contact and Forms stay
 *     put — /design D4). With none: the heading, Add a note and "No notes yet." — no empty frame, no once-line.
 *   Add a note — a create, so it asks: the kit's form window (520), raised over the record; one required field; the hint;
 *     Save note is the lime.
 *   a note — its own small record (the 10-01 standard, one note at a time), raised over the record at the kit's 640 (the
 *     drawing has 520, but a record window is 640 on every path — One Window Q3/S4, build-guarded; a departure recorded
 *     in the Club plan's Stage 5 record): it READS first; its
 *     author's pencil ↔ ✓ in the head flips it to edit, and an edit autosaves (the transient pill at the body's
 *     bottom-right, riding Delete's line — /design D3). Delete note ENDS the body in BOTH modes (an action, not an edit:
 *     /design D4) for its author or the owner, and asks once. The record keeps who and when, never the words.
 * The family record itself keeps no pencil (Ask 15).
 */
import { useCallback, useRef, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { RecordDelete, SavePill, repKit } from '../RepKit';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { formatStoredDate } from '@/lib/timezone';
import { FAMILY_NOTE_MAX, FAMILY_NOTE_WORDS as W, FAMILY_RECORD_WORDS, noteProblem } from '@/lib/families-words';
import type { FamilyNoteView } from '@/lib/families-notes';
import fam from './Families.module.css';

const SHOWN = 2;

export function NotesSection({ notes, onAdd, onOpen }: {
  notes: readonly FamilyNoteView[];
  onAdd: () => void;
  onOpen: (noteId: string) => void;
}) {
  const [all, setAll] = useState(false);
  return (
    <>
      <div className={fam.secRow}>
        <h3 className={fam.h}>{W.heading}</h3>
        <button type="button" className={`btn btn-outline ${fam.secAct}`} aria-haspopup="dialog" onClick={onAdd}>
          <Plus size={14} aria-hidden />{W.add}
        </button>
      </div>
      {notes.length === 0 ? <p className={repKit.dim}>{W.none}</p> : (
        <>
          <p className={fam.once}>{W.once}</p>
          <ul className={fam.notes}>
            {(all ? notes : notes.slice(0, SHOWN)).map(n => (
              <li key={n.id}>
                <button type="button" className={fam.note} aria-haspopup="dialog" onClick={() => onOpen(n.id)}
                  aria-label={W.openNote(formatStoredDate(n.createdAt))}>
                  <span className={fam.noteBody}>{n.body}</span>
                  <small className={fam.noteSigned}>{W.signed(n.author, n.createdAt, n.editedAt)}</small>
                  <ChevronRight size={16} aria-hidden className={fam.noteGo} />
                </button>
              </li>
            ))}
          </ul>
          {notes.length > SHOWN && (
            <button type="button" className={repKit.inlineLink} onClick={() => setAll(v => !v)}>
              {all ? FAMILY_RECORD_WORDS.showFewer : FAMILY_RECORD_WORDS.showAll(notes.length)}
            </button>
          )}
        </>
      )}
    </>
  );
}

const notesUrl = (personId: string, q: string, noteId?: string) =>
  // org-slug-ok: `q` IS the org ("orgSlug=…", passed down from the Families tab like every fetch in the record window).
  `/api/admin/families/${encodeURIComponent(personId)}/notes${noteId ? `/${encodeURIComponent(noteId)}` : ''}?${q}`;

/** Add a note — a create, so it asks (Save note is the lime). */
export function AddNoteWindow({ q, personId, familyName, onClose, onSaved }: {
  q: string; personId: string; familyName: string; onClose: () => void; onSaved: () => void;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy) return;
    const problem = noteProblem(body);
    if (problem) { setError(problem); return; }
    const text = body.trim();
    setBusy(true); setError('');
    try {
      const r = await moneyFetch(notesUrl(personId, q), jsonInit('POST', { body: text }));
      if (r.ok) { onSaved(); return; }
      setError(refusalText(r.data, W.failed));
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="form"
      raised
      eyebrow={familyName}
      title={W.addTitle}
      onClose={onClose}
      busy={busy}
      dirty={body.trim() !== ''}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.saving : W.save}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="family-note-new">
        <span className={ck.label}>{W.field}<span className={repKit.req} aria-hidden>*</span></span>
        <textarea id="family-note-new" className={`${ck.textarea} ${fam.noteArea}`} rows={6} maxLength={FAMILY_NOTE_MAX}
          value={body} onChange={e => setBody(e.target.value)} />
        <p className={ck.hint}>{W.hint}</p>
      </label>
    </KitDialog>
  );
}

/** One note, opened on its own: it reads first; its author's pencil edits it (autosave); Delete note ends the body. */
export function NoteWindow({ q, personId, familyName, note, onClose, onChanged }: {
  q: string; personId: string; familyName: string; note: FamilyNoteView;
  onClose: () => void;
  /** The note changed or went: the record re-reads behind the window. */
  onChanged: (said?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [held, setHeld] = useState({ body: note.body, editedAt: note.editedAt });
  const [body, setBody] = useState(note.body);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = useRef(false);
  const text = body.trim();
  const blocked = noteProblem(body);

  const write = useCallback(async (signal: AbortSignal) => {
    if (text === held.body) return;
    const res = await fetch(notesUrl(personId, q, note.id), { ...jsonInit('PATCH', { body: text }), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, W.failed));
    saved.current = true;
    setHeld({ body: data?.saved?.body ?? text, editedAt: data?.saved?.editedAt ?? new Date().toISOString() });
  }, [personId, q, note.id, text, held.body]);
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: editing && note.mine, loading: false, sig: text, blocked, write, failText: W.failed,
  });

  // ✓ saves what is pending first, and stays while the note is held (empty) or the save fails.
  const toggleEdit = async () => {
    if (!editing) { setBody(held.body); setEditing(true); return; }
    if (blocked) return;
    if (dirty && !(await handleSave())) return;
    setEditing(false);
  };
  // A refused save holds the window ONCE, with the reason in its pill; leaving again leaves it unsaved.
  const closeRefused = useRef(false);
  const close = async () => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (saved.current) onChanged();
    onClose();
  };
  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch(notesUrl(personId, q, note.id), { method: 'DELETE' });
      if (r.ok) { onChanged(W.deleted); onClose(); return; }
      setAsking(false);
      setError(refusalText(r.data, W.deleteFailed));
    } catch {
      setAsking(false);
      setError(W.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  const signed = W.signed(note.author, note.createdAt, held.editedAt);
  return (
    <>
      <KitDialog
        kind="form"
        size="medium"
        raised
        record
        eyebrow={W.eyebrow(familyName)}
        title={formatStoredDate(note.createdAt)}
        onClose={() => void close()}
        busy={busy}
        edit={note.mine ? { editing, onToggle: () => void toggleEdit(), label: editing ? W.done : W.edit } : undefined}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} /> : undefined}
      >
        <FormError>{error}</FormError>
        {editing ? (
          <label className={ck.field} htmlFor={`family-note-${note.id}`}>
            <span className={ck.label}>{W.field}</span>
            <textarea id={`family-note-${note.id}`} className={`${ck.textarea} ${fam.noteArea}`} rows={6} maxLength={FAMILY_NOTE_MAX}
              value={body} onChange={e => { setBody(e.target.value); touch(); }} />
          </label>
        ) : <p className={fam.noteRead}>{held.body}</p>}
        <p className={ck.hint}>{signed}</p>
        {note.canDelete && (
          <div className={fam.noteDoor}>
            <RecordDelete onClick={() => setAsking(true)} disabled={busy}>{W.delete}</RecordDelete>
          </div>
        )}
      </KitDialog>
      {asking && (
        <KitDialog
          kind="question"
          raised
          title={W.deleteTitle}
          onClose={() => setAsking(false)}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>{W.deleteNo}</button>
              <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={busy}>{busy ? W.deleting : W.deleteYes}</button>
            </>
          )}
        >
          <p>{W.deleteAsk}</p>
        </KitDialog>
      )}
    </>
  );
}
