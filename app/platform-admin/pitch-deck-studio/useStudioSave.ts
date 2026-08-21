'use client';
/**
 * THE STUDIO'S ONE SAVE CALL — busy/refusals/saved-note state around a fetch, shared by the
 * pull editor (stage B) and the deck composer (stage C). Extracted when the composer became the
 * second hand-copy: the refusal contract (`problems` sentences from the shared rulebooks,
 * rendered verbatim) and the post-save `router.refresh()` are exactly the pieces that must not
 * drift between the two editors — a fix to either (a retry, a new error shape) lands once here.
 *
 * `router.refresh()` preserves client state by design — the RESYNC of each editor's own fields
 * against the refreshed server truth deliberately stays IN the editor (render-time adjustment
 * pattern; the fields differ per editor and generalizing them would just move the state shape
 * into an options bag).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function useStudioSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function run(init: () => Promise<Response>, savedNote: string, after?: () => void) {
    setBusy(true);
    setProblems([]);
    setNote(null);
    try {
      const res = await init();
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setProblems(
          Array.isArray(body?.problems) && body.problems.length > 0
            ? body.problems
            : [body?.error ?? 'The save failed — nothing was changed.'],
        );
        return;
      }
      setNote(savedNote);
      after?.();
      // Re-render the server page so chips, placements and totals follow the new state.
      router.refresh();
    } catch {
      setProblems(['The save could not reach the server — nothing was changed.']);
    } finally {
      setBusy(false);
    }
  }

  return { busy, problems, note, setNote, run };
}
