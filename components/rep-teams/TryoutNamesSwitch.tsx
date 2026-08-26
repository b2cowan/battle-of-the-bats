'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './TryoutNamesSwitch.module.css';

/**
 * The names switch — hide or show player names on this tryout, from wherever the coach is standing.
 *
 * ⚠ **It replaced the one-way `TryoutRevealControl` (owner ruling 2026-08-25).** Revealing used to
 * be permanent, offered in exactly one place (Decide), and confirmed with "this can't be undone" —
 * while the four screens that TOLD you names were hidden offered nowhere to go. A head coach who
 * simply didn't want blind scoring had to hunt three stages forward to switch it off, and the chip
 * that reported the state read as decoration. So the state and the control became the same object,
 * and it is mounted at every place the state is shown: check-in, the live board, Set up, Decide.
 *
 * ⚠ **This changes the tryout, not one person's view.** Helpers scoring on their phones and the
 * printed check-in sheet follow it. That is the point — coaches asked for names and bib numbers
 * together — but it is why an assistant coach gets `.static`, the same words with no control.
 *
 * ⚠ **No confirmation dialog, deliberately.** The old one warned that reveal was irreversible; once
 * it isn't, that dialog is friction attached to a false statement. What survives instead is the
 * server's write-once `namesShownAt` stamp (mig 263): flipping to names-visible is remembered
 * forever, so the tryout report can only claim "blind throughout" when it actually was. The honesty
 * lives in the record, not in a dialog nobody reads twice.
 */
interface Props {
  /** The tryout-sessions API base — GET returns { tryout }, PATCH flips `isAnonymous`. */
  apiBase: string;
  /** Head coach (the `tryouts` capability). False renders the state without the control. */
  canWrite: boolean;
  /**
   * The blind state when the host already knows it — check-in and the live board both load it with
   * their own data, and passing it here keeps the pill in step with the rows beside it. Omit and
   * the switch fetches its own copy (Set up and Decide, which have nothing else to read).
   */
  blind?: boolean;
  /** Fired after a successful switch with the NEW blind state, so the host can refresh its rows. */
  onChanged?: (blind: boolean) => void;
  onError?: (msg: string) => void;
}

export default function TryoutNamesSwitch({ apiBase, canWrite, blind, onChanged, onError }: Props) {
  // `own` is only consulted when the host passes nothing — null means "still loading, render
  // nothing", which is why this is a tri-state rather than a boolean defaulting to true. A pill
  // that flashed "Names hidden" before its fetch landed would be a lie half the time.
  const [own, setOwn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  /** Which tryout this instance is currently pointed at — read after every await, never closed over. */
  const apiBaseRef = useRef(apiBase);
  useEffect(() => { apiBaseRef.current = apiBase; }, [apiBase]);
  const fail = useCallback((msg: string) => {
    if (onErrorRef.current) onErrorRef.current(msg); else console.error(msg);
  }, []);

  useEffect(() => {
    if (blind !== undefined) return;   // the host is authoritative — don't spend a request
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiBase);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load tryout');
        if (!cancelled) setOwn(data.tryout?.isAnonymous ?? true);
      } catch { /* non-blocking — the switch simply doesn't render */ }
    })();
    return () => { cancelled = true; };
  }, [apiBase, blind]);

  const hidden = blind !== undefined ? blind : own;
  if (hidden == null) return null;

  async function toggle() {
    if (!canWrite || saving) return;
    const next = !hidden;
    // ⚠ The coach portal does NOT remount when a coach switches team — the standing hazard in this
    // codebase, and the reason every sibling loader here carries a sequence token. Without this,
    // a PATCH fired on team A that resolves after the switch to team B would apply team A's answer
    // to team B's pill and fire the host's refresh for the wrong team (/review 2026-08-25).
    const firedFor = apiBase;
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAnonymous: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to switch names');
      if (firedFor !== apiBaseRef.current) return;   // superseded: a different tryout is on screen
      // Track the server's answer, not our optimistic guess — the two diverge if another coach
      // switched it on their own device a second earlier.
      const settled = data.tryout?.isAnonymous ?? next;
      setOwn(settled);
      onChanged?.(settled);
    } catch (e: any) {
      if (firedFor === apiBaseRef.current) fail(e.message ?? 'Failed to switch names.');
    } finally {
      setSaving(false);
    }
  }

  const label = hidden ? 'Names hidden' : 'Names showing';

  if (!canWrite) {
    return (
      <span className={`${styles.static} ${hidden ? '' : styles.staticShown}`}
        title={hidden ? 'Players show as bib numbers on this tryout' : 'Player names are showing on this tryout'}>
        {hidden ? <EyeOff size={12} /> : <Eye size={12} />} {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.switch} ${hidden ? '' : styles.shown}`}
      onClick={toggle}
      disabled={saving}
      aria-pressed={!hidden}
      title={hidden
        ? 'Show player names — on the board, on your helpers’ phones and on the printed sheet'
        : 'Hide player names — everyone goes back to bib numbers'}
    >
      <span className={styles.track}><span className={styles.knob} /></span>
      <span>{label}</span>
      <span className={styles.verb}>{saving ? '· saving…' : hidden ? '· show' : '· hide'}</span>
    </button>
  );
}
