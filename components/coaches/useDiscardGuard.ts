'use client';
import { useConfirm } from '@/components/coaches/ConfirmProvider';

/**
 * Guards a MODAL dismiss that would throw away typed work.
 *
 * Why this exists alongside UnsavedChangesGuard: that guard protects *route* changes
 * (beforeunload + intercepted link clicks) and is used by the portal's edit *pages*.
 * Every Money form is a modal, so the moment work is actually lost is a backdrop tap,
 * an X, or Cancel — none of which a route guard can see. Readiness review f7-3 / f7-7.
 *
 * Returns a click handler, so a call site reads exactly like the unguarded
 * `onClick={() => setOpen(false)}` it replaces. A clean form closes silently: a
 * confirmation with nothing to protect is friction, not safety. Never guards Save.
 *
 * Deliberately NOT wrapped in useCallback: every call site passes an inline
 * `close: () => setX(false)`, so the dependency array would churn every render and
 * memoise nothing. A plain closure costs the same and doesn't pretend otherwise.
 *
 * `detail` should name what is at stake ("an amount and 3 payment periods") rather
 * than saying "unsaved changes" — the coach has to judge it in a second, one-handed.
 */
export function useDiscardGuard({
  dirty,
  close,
  noun,
  detail,
}: {
  dirty: boolean;
  close: () => void;
  /** What is being discarded, lower case: 'budget line', 'expense', 'payment request'. */
  noun: string;
  /** Optional specifics — omit and the copy falls back to a generic sentence. */
  detail?: string;
}): () => void | Promise<void> {
  const confirm = useConfirm();

  return async () => {
    if (!dirty) { close(); return; }
    const discard = await confirm({
      title: `Discard this ${noun}?`,
      message: detail
        ? `You've entered ${detail}. Closing now won't save any of it.`
        : `Closing now won't save what you've entered on this ${noun}.`,
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'danger',
    });
    if (discard) close();
  };
}

/**
 * True when any field of a flat form object has moved off its blank value.
 *
 * Every Money form already declares a `BLANK_*` constant it resets to, so dirtiness is
 * "does it still equal blank" — no separate baseline to keep in step. Keyed off BLANK's
 * own keys so a form object carrying extra runtime keys can't produce a false positive.
 * Selections that don't live in the form object (a payee, tag ids) are OR'd in by the
 * call site, which is the only place that knows about them.
 */
export function touched<T extends Record<string, string>>(form: T, blank: T): boolean {
  return (Object.keys(blank) as Array<keyof T>).some(k => form[k] !== blank[k]);
}
