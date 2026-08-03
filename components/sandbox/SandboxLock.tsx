'use client';

import { useIsSandbox } from './SandboxProvider';
import styles from './SandboxLock.module.css';

/**
 * The "locked, not broken" shape — mockups section 5.
 *
 * The rule: **disable outbound BEFORE the press, don't catch it after.** A "send" that visibly
 * fails teaches a prospect the product is flaky. A send that is honestly locked, with a line
 * underneath saying why, teaches them we are careful with other people's inboxes. The write block
 * and the three outbound chokepoints would refuse the send anyway — this is the half the visitor
 * can see.
 *
 * Used for actions that reach the outside world: send email, invite staff, take a payment. NOT for
 * ordinary edits — a dragged game or a typed score should still work on screen, because the whole
 * point of the sandbox is that the product reacts. Those get the toast, not a lock.
 *
 * Deliberately two tiny pieces rather than a wrapper component: retrofitting a lock onto an
 * existing screen is `disabled={busy || locked}` plus one line of JSX, which keeps the diff on
 * those screens honest and reviewable.
 */

/** True when this control must be disabled before it is pressed. */
export function useSandboxLock(): boolean {
  return useIsSandbox();
}

/**
 * The honest line that sits beneath a locked control. Renders nothing outside a sandbox, so a call
 * site can mount it unconditionally.
 */
export function SandboxLockNote({ children }: { children?: React.ReactNode }) {
  const locked = useIsSandbox();
  if (!locked) return null;
  return (
    <p className={styles.lockLine}>
      <span aria-hidden="true">🔒</span>
      <span>
        {/* "Demo", not "sandbox" — see the note on the banner eyebrow (/marketing, 2026-08-03). */}
        {children ?? 'The demo never sends anything to anyone. Every contact in this tournament is invented.'}
      </span>
    </p>
  );
}
