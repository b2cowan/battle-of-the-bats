'use client';
/**
 * THE COMPOSER — stage C's one instrument: a DECK's running order, name and purpose.
 *
 * ⚠⚠ IT MOVES SLIDE NUMBERS AND DECK METADATA, AND NOTHING ELSE. No slide sentence, picture,
 * plan or price passes through here (owner ruling 1 — decks are data, slides are code). The
 * refusal sentences it renders come verbatim from `deckProblems`, the same rulebook the guard
 * test runs.
 *
 * ⚠ REORDERING A STANDING DECK RE-ORDERS ITS LIVE PAGE, BY DESIGN (plan decision 1): a saved
 * pull is a SET and render normalises to deck order. The composer's job is to SAY that — the
 * sentence above the Publish button — never to ask permission for it.
 *
 * Up/down buttons rather than drag: platform-admin renders in a scrolling container where drag
 * ghosts fight the scroll, buttons are keyboard-accessible for free, and the mobile rule
 * (icon-only actions with aria-labels) applies cleanly. Same render-time resync pattern as
 * PullEditor — `router.refresh()` preserves client state, and stale order rows re-armed against
 * a fresh server truth is the exact High-severity bug stage B shipped and fixed.
 *
 * One component, three postures: a STANDING deck (persona, code fallback behind it), a CUSTOM
 * deck (owner-created row — the club deck, a prospect deck), and NEW (the creation form).
 */
import { useState, type ReactNode } from 'react';
import type { WalkthroughPersona } from '@/lib/walkthrough-content';
import { useStudioSave } from './useStudioSave';
import styles from './pitch-deck-studio.module.css';

/** The slice of a slide the composer needs — small props, never the library module. */
export interface ComposerSlide {
  id: string;
  pain: string;
}

export type ComposerTarget =
  | { kind: 'standing'; persona: WalkthroughPersona; publishedPath: string }
  | { kind: 'custom'; id: string; name: string; purpose: string; shareSlug: string | null }
  | { kind: 'new' };

export default function DeckComposer({
  target,
  library,
  current,
  source,
  savedAt,
  savedBy,
  storeUnreachable,
  canWrite,
  stages,
}: {
  target: ComposerTarget;
  /** Every BUILT slide in the library, in number order — the add-picker's menu. */
  library: ComposerSlide[];
  /** The deck's resolved running order right now (empty for a new deck). */
  current: string[];
  /** Standing decks only: whether the order is the owner's row or the code default. */
  source?: 'saved' | 'code';
  savedAt?: string | null;
  savedBy?: string | null;
  storeUnreachable?: boolean;
  canWrite: boolean;
  /** id → the slide rendered in the REAL frame (SlideStage), server-rendered — the live preview. */
  stages: Record<string, ReactNode>;
}) {
  const painOf = new Map(library.map(s => [s.id, s.pain]));

  const [order, setOrder] = useState<string[]>(() => [...current]);
  const [name, setName] = useState(target.kind === 'custom' ? target.name : '');
  const [purpose, setPurpose] = useState(target.kind === 'custom' ? target.purpose : '');
  // ⚠ Resync when the server's truth changes — the PullEditor pattern, and for the same bug.
  const serverKey =
    current.join(' ') +
    (target.kind === 'custom' ? `|${target.name}|${target.purpose}` : '');
  const [syncedTo, setSyncedTo] = useState(serverKey);
  if (syncedTo !== serverKey) {
    setSyncedTo(serverKey);
    setOrder([...current]);
    if (target.kind === 'custom') {
      setName(target.name);
      setPurpose(target.purpose);
    }
  }

  const [previewId, setPreviewId] = useState<string | null>(null);
  const { busy, problems, note, setNote, run: call } = useStudioSave();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dirty =
    order.join(' ') !== current.join(' ') ||
    (target.kind === 'custom' && (name !== target.name || purpose !== target.purpose)) ||
    target.kind === 'new';
  const addable = library.filter(s => !order.includes(s.id));

  function move(id: string, d: -1 | 1) {
    setNote(null);
    setOrder(prev => {
      const at = prev.indexOf(id);
      const to = at + d;
      if (at < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      next[at] = next[to];
      next[to] = id;
      return next;
    });
  }

  function remove(id: string) {
    setNote(null);
    setOrder(prev => prev.filter(x => x !== id));
    setPreviewId(p => (p === id ? null : p));
  }

  function add(id: string) {
    setNote(null);
    setOrder(prev => (prev.includes(id) ? prev : [...prev, id]));
    setPreviewId(id);
  }

  const save = () => {
    if (target.kind === 'standing') {
      return call(
        () =>
          fetch('/api/platform-admin/pitch-deck-studio/deck', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ persona: target.persona, slideIds: order }),
          }),
        'Published — the page, its present mode and its pull follow this order now.',
      );
    }
    if (target.kind === 'custom') {
      return call(
        () =>
          fetch('/api/platform-admin/pitch-deck-studio/deck', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: target.id, name, purpose, slideIds: order }),
          }),
        'Saved — the deck’s link and PDF render this order now.',
      );
    }
    return call(
      () =>
        fetch('/api/platform-admin/pitch-deck-studio/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, purpose, slideIds: order }),
        }),
      'Deck created — its unlisted link is below its new card.',
      () => {
        setOrder([]);
        setName('');
        setPurpose('');
        setPreviewId(null);
      },
    );
  };

  const revert = () =>
    target.kind === 'standing' &&
    call(
      () =>
        fetch(`/api/platform-admin/pitch-deck-studio/deck?persona=${target.persona}`, {
          method: 'DELETE',
        }),
      'Saved deck removed — the page is back on the code running order.',
    );

  const destroy = () =>
    target.kind === 'custom' &&
    call(
      () =>
        fetch(`/api/platform-admin/pitch-deck-studio/deck?id=${target.id}`, { method: 'DELETE' }),
      'Deck deleted — its link is dead.',
      () => setConfirmingDelete(false),
    );

  if (!canWrite) {
    return (
      <p className={styles.caveat}>Your role can read this room but not compose a deck.</p>
    );
  }

  return (
    <div className={styles.editor}>
      {storeUnreachable && (
        <p className={styles.deckProblem}>
          ⚠ The deck store could not be read just now — the page is safely on the code running
          order, and saving is unlikely to work until the store is back.
        </p>
      )}
      {target.kind === 'standing' && (
        <p className={styles.sourceLine}>
          {source === 'saved'
            ? `The running order is a saved deck${savedAt ? ` — saved ${savedAt.slice(0, 10)}` : ''}${savedBy ? ` by ${savedBy}` : ''}.`
            : 'The running order is the code default — no saved deck.'}
        </p>
      )}

      {(target.kind === 'custom' || target.kind === 'new') && (
        <div className={styles.deckFields}>
          <label className={styles.deckField}>
            <span className={styles.fieldLabel}>Name · internal only, never rendered publicly</span>
            <input
              className={styles.textInput}
              value={name}
              maxLength={120}
              disabled={busy}
              onChange={e => { setNote(null); setName(e.target.value); }}
              placeholder="e.g. Riverdale pitch — June call"
            />
          </label>
          <label className={styles.deckField}>
            <span className={styles.fieldLabel}>Purpose · what this deck is for</span>
            <input
              className={styles.textInput}
              value={purpose}
              maxLength={500}
              disabled={busy}
              onChange={e => { setNote(null); setPurpose(e.target.value); }}
              placeholder="e.g. A club asking about the coach portal first"
            />
          </label>
        </div>
      )}

      <p className={styles.orderLabel}>
        Running order · top is first{order.length > 0 ? ` · ${order.length} slides` : ''}
      </p>
      {order.length === 0 && (
        <p className={styles.caveat}>No slides yet — add them from the picker below.</p>
      )}
      <ol className={styles.composerRows}>
        {order.map((id, i) => (
          <li key={id} className={styles.composerRow}>
            <button
              type="button"
              className={`${styles.rowMain} ${previewId === id ? styles.rowMainActive : ''}`}
              onClick={() => setPreviewId(p => (p === id ? null : id))}
              title="Preview this slide in the real frame"
            >
              <span className={styles.pullCheckNum}>{id}</span>
              <span className={styles.pullCheckPain}>
                {painOf.get(id) ?? 'Not built yet — renders nothing until its artwork lands'}
              </span>
            </button>
            <span className={styles.rowBtns}>
              <button type="button" className={styles.iconBtn} onClick={() => move(id, -1)} disabled={busy || i === 0} aria-label={`Move ${id} up`}>↑</button>
              <button type="button" className={styles.iconBtn} onClick={() => move(id, 1)} disabled={busy || i === order.length - 1} aria-label={`Move ${id} down`}>↓</button>
              <button type="button" className={styles.iconBtn} onClick={() => remove(id)} disabled={busy} aria-label={`Remove ${id} from the deck`}>✕</button>
            </span>
          </li>
        ))}
      </ol>

      {addable.length > 0 && (
        <label className={styles.addRow}>
          <span className={styles.fieldLabel}>Add a slide · any built slide in the library</span>
          <select
            className={styles.select}
            value=""
            disabled={busy}
            onChange={e => e.target.value && add(e.target.value)}
          >
            <option value="">Pick a slide…</option>
            {addable.map(s => (
              <option key={s.id} value={s.id}>{s.id} — {s.pain}</option>
            ))}
          </select>
        </label>
      )}

      {/* The live preview — the slide in the page's own frame, rendered server-side and simply
          shown here, so the composer can never frame a slide differently from the page. */}
      {previewId && stages[previewId] && (
        <figure className={styles.composerPreview}>
          <figcaption className={styles.previewLabel}>
            {previewId} in the real frame — exactly as a page or present mode shows it
          </figcaption>
          {stages[previewId]}
        </figure>
      )}
      {/* A selected row with nothing to show would read as a broken preview — say why instead
          (a slide declared but not yet captured, or a planned number with no artwork). */}
      {previewId && !stages[previewId] && (
        <p className={styles.caveat}>
          No picture resolves for {previewId} yet — a page would render its words over an empty
          stage.
        </p>
      )}

      {problems.map(p => (
        <p key={p} className={styles.deckProblem}>⚠ {p}</p>
      ))}
      {note && <p className={styles.saveNote}>{note}</p>}

      {target.kind === 'standing' && (
        // Decision 1, said out loud rather than asked about: the pull is a set, render
        // normalises, so this order IS the page's order the moment it is published.
        <p className={styles.caveat}>
          This deck is published on <strong>{target.publishedPath}</strong> — the page, its pull
          and present mode will follow this order as soon as you publish.
        </p>
      )}

      <div className={styles.editorActions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={save}
          disabled={busy || !dirty || order.length === 0 || (target.kind !== 'standing' && !name.trim())}
        >
          {busy ? 'Working…' : target.kind === 'new' ? 'Create this deck' : 'Publish this running order'}
        </button>
        {target.kind === 'standing' && source === 'saved' && (
          <button type="button" className={styles.btnGhost} onClick={revert} disabled={busy}>
            Return to the code default
          </button>
        )}
        {target.kind === 'custom' && (
          confirmingDelete ? (
            <>
              <button type="button" className={styles.btnDanger} onClick={destroy} disabled={busy}>
                Really delete — its link dies with it
              </button>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirmingDelete(false)} disabled={busy}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className={styles.btnGhost} onClick={() => setConfirmingDelete(true)} disabled={busy}>
              Delete this deck
            </button>
          )
        )}
      </div>
    </div>
  );
}
