'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { OPPONENT_OBSERVATION_MAX } from '@/lib/coach-opponents';
import { claimEscape } from './escapeOwnership';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/** "Pitching, Hitting, Defense, Baserunning or Coaching" — the sport's own vocabulary, read out. */
function readOut(tags: string[]): string {
  if (tags.length <= 1) return tags.join('');
  return `${tags.slice(0, -1).join(', ')} or ${tags[tags.length - 1]}`;
}

/**
 * The scouting book's capture form — ONE component for its two homes (the schedule game
 * card's Scouting tab and the full opponent page), so the two entry forms can never drift.
 *
 * ⚖ A DOOR, THEN A SHEET — ABOVE THE NOTES (owner, mockup round 2, 2026-09-11). At rest the
 * form is one quiet "+ Log an observation" button on the RIGHT of the tag-filter row (owner,
 * 2026-09-11: the right edge is where this app's add buttons live, and sharing the filter's row
 * saves one); it opens IN PLACE as a lifted sheet above that row, and the notes it produces land
 * directly beneath it. Round 1 left the framed form permanently open under
 * the notes, and the owner's verdict was that it cluttered the card and would be dragged out of
 * sight as the log grew. The door sits ABOVE the notes for exactly that reason: the notes can only
 * push down what is under them, so the door is in the same place with zero notes or fifty. Not a
 * dialog — the game card already is one, and a window that closes on save breaks the loop below.
 *
 * Framed (owner, §168 walk side-finding): a helper opening the game card could not tell what the
 * box, the dropdown or the save link were for — picking "Pitching" changed nothing on screen, and
 * nothing said it belonged to the note above. So the sheet has a heading, the never-names rule
 * beside it where it survives typing (the placeholder is an example, not the instructions), the
 * tag select carries a visible label, one line says what a tag DOES, and Save is a button beside
 * the fields.
 *
 * ⚖ A DROPDOWN, NOT A PILL ROW (owner, §129 walk F2, 2026-09-02 — the standing
 * form-selects-are-dropdowns ruling). The vocabulary is the FIXED sport-pack list; a tag is
 * optional, and "No tag" is a complete answer.
 *
 * Owns the one-sitting loop (S5, mockup 1b): save, confirm in place, hand the keyboard back —
 * several observations in a row without re-finding the input. Save keeps the sheet open; Cancel
 * (which reads "Done" once something has been saved — closing is not discarding) or Escape closes
 * it. ⚠ Escape inside the sheet is CLAIMED so the game card beneath does not close with it — see
 * `escapeOwnership.ts` for why neither stopPropagation nor the marker alone is enough.
 */
export default function ScoutObservationForm({ tags, heading, onSave, filter }: {
  /** The sport-pack vocabulary, as the card route serves it. */
  tags: string[];
  /** "Log an observation from this game" on the card; "Log an observation" on the page. */
  heading: string;
  /** Persists one observation; throws (with a readable message) when the server refuses. */
  onSave: (body: string, tag: string | null) => Promise<void>;
  /** The tag filter that shares the door's row (left; the door takes the right). Renders null
   *  when no tag is in use — the door then keeps the right edge alone. */
  filter?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** How many observations went in THIS sitting — the saved-line + add-another cue. */
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const doorRef = useRef<HTMLButtonElement>(null);
  // Synchronous re-entry guard: `disabled` reflects committed state, so a fast double-tap
  // fires twice before the re-render — and the POST is not idempotent.
  const busyRef = useRef(false);
  // The card's tab unmounts on every tab/event switch; a slow save resolving afterwards must
  // not call setState on the corpse.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // The cursor lands in the box the moment the sheet opens; on close, focus returns to the door
  // — which only exists AFTER that render, hence the flag rather than a direct call in close().
  // Not on mount: a tab that opens must not steal focus.
  const returnFocusRef = useRef(false);
  useEffect(() => {
    if (open) { inputRef.current?.focus(); return; }
    if (returnFocusRef.current) { returnFocusRef.current = false; doorRef.current?.focus(); }
  }, [open]);

  /** Close and forget the sitting — a reopened sheet starts clean, not on a stale "Saved". */
  function close() {
    returnFocusRef.current = true;
    setOpen(false);
    setBody('');
    setTag(null);
    setError('');
    setSavedCount(0);
  }

  async function save() {
    const trimmed = body.trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(trimmed, tag);
      if (!mountedRef.current) return;
      setBody('');
      setTag(null);
      setSavedCount(c => c + 1);
      inputRef.current?.focus();
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Could not save the observation');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  // The bar is always rendered so the filter keeps its place; the door leaves it while the
  // sheet is open (the sheet IS the door, opened).
  const bar = (
    <div className={styles.scoutLogBar}>
      {filter}
      {!open && (
        <button ref={doorRef} type="button" className={styles.scoutLogDoor} onClick={() => setOpen(true)}>
          <Plus size={14} aria-hidden /> Log an observation
        </button>
      )}
    </div>
  );

  if (!open) return bar;

  return (<>
    <div
      className={styles.scoutLog}
      data-escape-owner=""
      onKeyDown={e => {
        if (e.key !== 'Escape' || saving) return;
        claimEscape(e);
        close();
      }}
    >
      <div className={styles.scoutLogHead}>
        <span className={styles.scoutLogTitle}>{heading}</span>
        <span className={styles.scoutLogRule}>Numbers and positions, never opposing players’ names.</span>
      </div>
      {savedCount > 0 && (
        <p className={styles.scoutSavedLine} aria-live="polite">
          <Check size={12} aria-hidden /> {savedCount === 1 ? 'Saved' : `${savedCount} saved this sitting`} — add another?
        </p>
      )}
      <textarea
        ref={inputRef}
        className={styles.scoutLogInput}
        value={body}
        maxLength={OPPONENT_OBSERVATION_MAX}
        aria-label={heading}
        placeholder="e.g. “their SS cheats up with runners on”"
        onChange={e => setBody(e.target.value)}
        rows={2}
      />
      <div className={styles.scoutLogRow}>
        <label className={styles.scoutLogField}>
          <span className={styles.scoutLogLabel}>Tag <em>(optional)</em></span>
          <select
            className={styles.select}
            value={tag ?? ''}
            onChange={e => setTag(e.target.value || null)}
          >
            <option value="">No tag</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div className={styles.scoutLogActions}>
          <button type="button" className={styles.scoutLogCancel} disabled={saving} onClick={close}>
            {savedCount > 0 ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn btn-lime ${styles.scoutLogSave}`}
            disabled={saving || body.trim().length === 0}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save observation'}
          </button>
        </div>
      </div>
      {tags.length > 0 && (
        <p className={styles.scoutFootnote}>
          A tag files this under {readOut(tags)}, so the book can be read one heading at a time.
        </p>
      )}
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
    {filter && bar}
  </>);
}
