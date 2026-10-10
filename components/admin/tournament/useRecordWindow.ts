'use client';
/**
 * A RECORD WINDOW'S LEAVING RULE — one home for the four record windows Tournament admin redesign Stage 5 built
 * (VenueRecord, RuleSectionRecord, ResourceRecord, QuestionRecord), which carried it as four copies (/simplify).
 * It sits beside `useRecordAutosave` (which saves); this decides what leaving, stepping and ✓ do with what is unsaved:
 *
 *   flush       nothing pending → go. A HELD edit (a required field emptied) or a REFUSED save holds the window ONCE,
 *               the reason in the pill; leaving again leaves it unsaved — never a window that can't be left (the
 *               library's rule, and the held half the venue record lacked)
 *   leave       flush, settle, re-read the list if anything saved, then go
 *   toggleEdit  the pencil opens the form; ✓ saves what is pending (stays while held or refused), re-reads, and says
 *               whether the re-read landed — the record re-seeds from the list only when it did
 *
 * The record keeps its draft, its `held` reason and its own resets, and says whether anything saved since it was last
 * asked (`consumeChanged`: its write sets a flag; asking reads and clears it).
 */
import { useCallback, useState } from 'react';

export function useRecordWindow({ editing, setEditing, dirty, held, handleSave, settle, consumeChanged, onChanged, onHeld, onAfterSave }: {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  dirty: boolean;
  /** Why the edit can't save right now (a required field emptied), or null. */
  held: string | null;
  handleSave: () => Promise<boolean>;
  settle: () => void;
  /** Did anything save since the last ask? (Reading clears it.) */
  consumeChanged: () => boolean;
  /** Re-reads the list; false when it didn't load. */
  onChanged: () => Promise<boolean>;
  /** A held edit was refused (show its mistake under its field). */
  onHeld?: () => void;
  /** After ✓: `reread` — the list re-read, so the record may re-seed from it; false — keep what was saved. */
  onAfterSave: (reread: boolean) => void;
}) {
  const [refusedOnce, setRefusedOnce] = useState(false);
  const resetRefused = useCallback(() => setRefusedOnce(false), []);

  const flush = async (): Promise<boolean> => {
    if (!editing || !dirty || refusedOnce) return true;
    if (held) { onHeld?.(); setRefusedOnce(true); return false; }
    if (await handleSave()) return true;
    setRefusedOnce(true);
    return false;
  };
  const leave = async (then: () => void) => {
    if (!(await flush())) return;
    settle();
    setRefusedOnce(false);
    if (consumeChanged()) await onChanged();
    then();
  };
  const toggleEdit = async () => {
    if (!editing) { setEditing(true); return; }
    if (held) { onHeld?.(); return; }
    if (dirty && !(await handleSave())) return;
    const reread = consumeChanged() ? await onChanged() : true;
    setEditing(false);
    onAfterSave(reread);
  };

  return { refusedOnce, resetRefused, leave, toggleEdit };
}
