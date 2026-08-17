'use client';
import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import type { RepTryout } from '@/lib/types';
import styles from './TryoutDayCard.module.css';

/**
 * The one-way Reveal-names control — moved from the setup card's header to the Decide stage
 * (2026-08-17), where the guide has always said revealing happens. Reads/patches the same
 * tryout record the sessions manager uses.
 */
interface Props {
  /** The tryout-sessions API base — GET returns { tryout }, PATCH flips isAnonymous. */
  apiBase: string;
  canWrite: boolean;
  onError?: (msg: string) => void;
  /** Fired after a successful reveal so the page can refresh the board + overview. */
  onRevealed?: () => void;
}

export default function TryoutRevealControl({ apiBase, canWrite, onError, onRevealed }: Props) {
  const confirm = useConfirm();
  const [tryout, setTryout] = useState<RepTryout | null>(null);
  const [revealing, setRevealing] = useState(false);

  const fail = useCallback((msg: string) => { onError ? onError(msg) : console.error(msg); }, [onError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiBase);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load tryout');
        if (!cancelled) setTryout(data.tryout ?? null);
      } catch { /* non-blocking — the control simply doesn't render */ }
    })();
    return () => { cancelled = true; };
  }, [apiBase]);

  // Reveal is ONE-WAY and confirmed — once names are shown they can't be re-hidden.
  async function revealNames() {
    if (!canWrite || revealing) return;
    const ok = await confirm({
      title: 'Reveal player names?',
      message: 'Names will show on the check-in screen, scoreboard, and decision board. This can’t be undone — you can’t switch back to bib-only for this tryout.',
      confirmText: 'Reveal names',
      tone: 'warning',
    });
    if (!ok) return;
    setRevealing(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAnonymous: false }),
      });
      const data = await res.json();
      // message first: the one-way guard's 409 carries the human sentence there, and its
      // `error` field is the machine code 'already_revealed' (the siblings' pattern).
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to reveal names');
      setTryout(data.tryout);
      onRevealed?.();
    } catch (e: any) {
      fail(e.message ?? 'Failed to reveal names.');
    } finally {
      setRevealing(false);
    }
  }

  if (!tryout) return null;

  return tryout.isAnonymous ? (
    canWrite ? (
      <button
        type="button"
        className={styles.revealBtn}
        onClick={revealNames}
        disabled={revealing}
        title="Reveal player names (one-way — can’t switch back to bib-only)"
      >
        <Eye size={14} /> Reveal names
      </button>
    ) : null
  ) : (
    <span className={styles.revealedChip} title="Names are shown for this tryout">
      <EyeOff size={13} /> Names revealed
    </span>
  );
}
