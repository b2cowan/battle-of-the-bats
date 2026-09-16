'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The library editors' AUTOSAVE (the plan-template room since Phase 3; the circuit editor since
 * practices re-evaluation stage 4, 2026-09-16 — the third copy of this block was the one that
 * earned the extraction): ~0.9s after the last change, STOP after a failure rather than retrying
 * for ever, a save that hasn't landed by the timeout reported as a failure rather than spinning,
 * and a signature over the WHOLE editable state so renaming and then closing the tab is as safe
 * as adding a block and closing the tab.
 *
 * ⚠ An explicit submit rejects an empty name; autosave must NOT, because the coach is mid-typing —
 * `blocked` names the reason a save is held ("Give the template a name to save it.") and nothing
 * is discarded; the status pill says why.
 *
 * The practice plan's own editor keeps its larger machine (a version token, plan tags, the recap)
 * — this is the two library rooms' shared half.
 */
const SAVE_TIMEOUT_MS = 15_000;

export function useRecordAutosave({ enabled, loading, sig, blocked, write, failText, timeoutText }: {
  /** May this viewer write at all? Disabled, a save is a no-op that reports success. */
  enabled: boolean;
  loading: boolean;
  /** The editable state, serialised — a change to it is what makes the record dirty. */
  sig: string;
  /** Why a save is held right now (an empty name), or null. */
  blocked: string | null;
  /** The PATCH itself; throws with a sentence a coach can act on. */
  write: (signal: AbortSignal) => Promise<void>;
  failText: string;
  timeoutText?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const sigRef = useRef(sig);
  useEffect(() => { sigRef.current = sig; }, [sig]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (blocked) { setSaveError(blocked); return false; }
    const sigAtSave = sigRef.current;
    setSaving(true); setSaveError('');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), SAVE_TIMEOUT_MS);
    try {
      await write(abort.signal);
      // A change typed WHILE the save was in flight keeps the record dirty for the next pass.
      if (sigRef.current === sigAtSave) setDirty(false);
      return true;
    } catch (e: unknown) {
      setSaveError(
        e instanceof DOMException && e.name === 'AbortError'
          ? (timeoutText ?? 'Saving is taking too long — check your connection.')
          : e instanceof Error ? e.message : failText,
      );
      return false;
    } finally {
      clearTimeout(timeout);
      setSaving(false);
    }
  }, [enabled, blocked, write, failText, timeoutText]);

  useEffect(() => {
    if (!dirty || saving || loading || saveError || !enabled) return;
    const t = setTimeout(() => { void handleSave(); }, 900);
    return () => clearTimeout(t);
  }, [dirty, saving, loading, saveError, enabled, sig, handleSave]);

  /** Mark the record changed — every field's onChange. */
  const touch = useCallback(() => { setDirty(true); setSaveError(''); }, []);
  /** The record was re-read from the server — nothing pending. */
  const settle = useCallback(() => { setDirty(false); setSaveError(''); }, []);

  return { saving, dirty, saveError, touch, settle, handleSave };
}

/**
 * Retire / restore from a library editor's header — one tap; the page re-reads and the editor
 * locks or unlocks. Retired, never deleted.
 *
 * ⚠ A retire FLUSHES a pending edit first (/review, 2026-09-16): the page re-reads the record
 * afterwards and settles the editor, which would have thrown away a rename typed inside the 900ms
 * debounce; and a save already in flight would otherwise land AFTER the retire on a record the
 * screen has locked. So: hold while a save is in flight, save what is dirty, and only retire when
 * that save landed — a save that fails leaves the record as it is and the error where it was.
 */
export function useRetireRestore(
  apiBase: string,
  reload: () => Promise<void>,
  onError: (message: string) => void,
  autosave?: { dirty: boolean; saving: boolean; handleSave: () => Promise<boolean> },
) {
  const [busy, setBusy] = useState(false);
  const setActive = useCallback(async (isActive: boolean) => {
    if (busy || autosave?.saving) return;
    setBusy(true);
    try {
      if (autosave?.dirty && !(await autosave.handleSave())) return;
      const res = await fetch(apiBase, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'That didn’t work.');
      await reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  }, [apiBase, busy, reload, onError, autosave]);
  return { busy: busy || !!autosave?.saving, setActive };
}
