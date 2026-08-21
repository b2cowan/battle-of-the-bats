'use client';
/**
 * THE PULL EDITOR — the one write this room owns (stage B): WHICH of a deck's slides the public
 * page shows. Nothing else. No wording, no pictures, no order.
 *
 * ⚠ ORDER IS DELIBERATELY NOT A CONTROL. A pull renders in the deck's running order (the save
 * path refuses anything else), so the editor is a set of checkboxes over the deck, not a
 * drag-list — the one invariant an owner could most easily break is one the UI cannot express
 * breaking. Reordering the DECK is stage C's composer.
 *
 * The preview is derived by the SAME functions the live page uses (`derivedMeta`,
 * `derivedSeoDescription`), so what the owner reads here is what a visitor will get — the page's
 * furniture follows the pull by construction, not by promise.
 *
 * A refused save renders the API's `problems` sentences verbatim: they come from
 * `pullProblems`, the same rulebook the guard test runs, and they are written to be read by a
 * human deciding what to fix.
 */
import { useMemo, useState } from 'react';
// ⚠ Only the data-free derive module — importing lib/walkthrough-content here would ship the
// ENTIRE slide library (every answer paragraph, every caption) to the browser. The slide data
// this editor needs arrives as a small props payload from the server page instead.
import { derivedMeta, derivedSeoDescriptionFrom } from '@/lib/walkthrough-derive';
import type { WalkthroughPersona } from '@/lib/walkthrough-content';
import { useStudioSave } from './useStudioSave';
import styles from './pitch-deck-studio.module.css';

/** The slice of a slide this editor needs — built slides only, already in deck order. */
export interface PullEditorSlide {
  id: string;
  pain: string;
  seoPhrase: string;
}

export default function PullEditor({
  audience,
  subject,
  slides,
  canWrite,
  current,
  source,
  savedAt,
  savedBy,
  storeUnreachable,
}: {
  audience: WalkthroughPersona;
  /** The page's `seo.subject` clause, for the live description preview. */
  subject: string;
  slides: PullEditorSlide[];
  canWrite: boolean;
  /** The pull the page is showing right now, as the report resolved it. */
  current: string[];
  source: 'saved' | 'code';
  savedAt: string | null;
  savedBy: string | null;
  storeUnreachable: boolean;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(current));

  // ⚠ RESYNC WHEN THE SERVER'S TRUTH CHANGES — `router.refresh()` preserves client state, so
  // without this, "Return to the code default" left the just-cleared composition still ticked
  // (and `dirty` re-armed Publish with it: one reflexive click re-saved what was just removed).
  // React's render-time adjustment pattern rather than an effect — no extra committed render,
  // and the lint rule against setState-in-effect stays clean.
  const currentKey = current.join(' ');
  const [syncedTo, setSyncedTo] = useState(currentKey);
  if (syncedTo !== currentKey) {
    setSyncedTo(currentKey);
    setSelected(new Set(current));
  }
  // The save call (busy/refusals/note + router.refresh) is the shared studio hook — one home
  // for the contract this editor and the deck composer must keep identical.
  const { busy, problems, note, setNote, run: call } = useStudioSave();

  const chosen = useMemo(() => slides.filter(s => selected.has(s.id)), [slides, selected]);
  const dirty = chosen.map(s => s.id).join(' ') !== current.join(' ');

  function toggle(id: string) {
    setNote(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const save = () =>
    call(
      () =>
        fetch('/api/platform-admin/pitch-deck-studio/pull', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: audience, slideIds: chosen.map(s => s.id) }),
        }),
      'Saved — the public page is showing this pull now.',
    );

  const clearSaved = () =>
    call(
      () =>
        fetch(`/api/platform-admin/pitch-deck-studio/pull?persona=${audience}`, { method: 'DELETE' }),
      'Saved pull removed — the page is back on the code default.',
    );

  const sourceLine =
    source === 'saved'
      ? `The page is showing a saved pull${savedAt ? ` — saved ${savedAt.slice(0, 10)}` : ''}${savedBy ? ` by ${savedBy}` : ''}.`
      : 'The page is showing the code default — no saved pull.';

  return (
    <div className={styles.editor}>
      {/* ⚠ Only this screen can tell an outage from an empty table — the page falls back
          identically for both, so the sentence has to live here. */}
      {storeUnreachable && (
        <p className={styles.deckProblem}>
          ⚠ The pull store could not be read just now — the page is safely on the code default,
          and saving is unlikely to work until the store is back.
        </p>
      )}
      <p className={styles.sourceLine}>{sourceLine}</p>

      {canWrite ? (
        <>
          <p className={styles.orderLabel}>On the page · order always follows the deck</p>
          <div className={styles.pullChecks}>
            {slides.map(s => (
              <label key={s.id} className={styles.pullCheck}>
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  disabled={busy}
                  onChange={() => toggle(s.id)}
                />
                <span className={styles.pullCheckNum}>{s.id}</span>
                <span className={styles.pullCheckPain}>{s.pain}</span>
              </label>
            ))}
          </div>

          {/* No preview over an empty selection — "Zero jobs … — ." is not a sentence, and the
              warning below already owns that state. */}
          {chosen.length > 0 && (
            <div className={styles.preview}>
              <p className={styles.previewLabel}>The page will say, all by itself:</p>
              <p className={styles.previewMeta}>{derivedMeta(chosen.length)}</p>
              <p className={styles.previewDesc}>
                {derivedSeoDescriptionFrom(subject, chosen.map(s => s.seoPhrase))}
              </p>
            </div>
          )}

          {problems.map(p => (
            <p key={p} className={styles.deckProblem}>⚠ {p}</p>
          ))}
          {chosen.length === 0 && (
            <p className={styles.deckProblem}>
              ⚠ The page would show no panels at all — a pull needs at least one slide.
            </p>
          )}
          {note && <p className={styles.saveNote}>{note}</p>}

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={save}
              disabled={busy || !dirty || chosen.length === 0}
            >
              {busy ? 'Working…' : 'Publish this pull'}
            </button>
            {source === 'saved' && (
              <button type="button" className={styles.btnGhost} onClick={clearSaved} disabled={busy}>
                Return to the code default
              </button>
            )}
          </div>
        </>
      ) : (
        <p className={styles.caveat}>Your role can read this room but not change what a page shows.</p>
      )}
    </div>
  );
}
