'use client';
/**
 * MoreSheetFoot — the last row of every phone More sheet: Help, Send feedback, Download app, Sign out, in that order (the
 * nav standard's N7, owner 2026-10-17). ONE component for the club and tournament admin's sheet, the Premium coach's and
 * the free coach's, so the order — and the rules below — are written once rather than copied into three bars that had
 * already begun to differ.
 *
 *   · Send feedback and Sign out are the account menu's (N4), which the demo sandbox hides: a shared demo user is never
 *     signed out, and a prospect is never led out of the demo. So both rows are absent there (the binding sandbox rule:
 *     hide the entry point). The free portal is never a sandbox, so it reads false.
 *   · Download app shows only where a phone or tablet browser can install the app (`isInstallEligibleBrowser`, the ONE
 *     definition of install eligibility) — read after hydration, since the server cannot know — and never in the demo
 *     (the installed app opens outside it). It asks the page's InstallAppPrompt to show itself; every shell that renders
 *     a sheet mounts one.
 *   · The feedback window is the BAR's, outside the sheet (`onFeedback`): the sheet unmounts as it closes, and the
 *     window must outlive it.
 * `children` follow Sign out: the admin's live-site door, where its nav has no Public site program (N4).
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HelpCircle, MessageSquarePlus, Download, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { isInstallEligibleBrowser } from '@/lib/device';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import styles from './CoachesBottomNav.module.css';

const noSubscribe = () => () => {};

export default function MoreSheetFoot({ idPrefix, helpHref, onClose, onFeedback, children }: {
  /** The bar's id family ('admin-mob', 'coaches-mob', 'free-mob') — tours and tests anchor on the rows' ids. */
  idPrefix: string;
  /** The guide for where you are, opened in a new tab. */
  helpHref: string;
  /** Closes the sheet. */
  onClose: () => void;
  /** Opens the bar's feedback window. */
  onFeedback: () => void;
  children?: ReactNode;
}) {
  const router = useRouter();
  const inSandbox = useIsSandbox();
  const canInstall = useSyncExternalStore(noSubscribe, isInstallEligibleBrowser, () => false);

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  return (
    <div className={styles.dropGrid} data-cols="2">
      {/* The sheet closes a beat after the tap: removing the link in the same tick can cancel its new tab in some browsers. */}
      <Link className={styles.dropItem} href={helpHref} role="menuitem" id={`${idPrefix}-help`} target="_blank" rel="noopener noreferrer" onClick={() => window.setTimeout(onClose)}>
        <HelpCircle size={17} aria-hidden /><span>Help</span>
      </Link>
      {!inSandbox && (
        <button type="button" className={styles.dropItem} role="menuitem" id={`${idPrefix}-feedback`} onClick={() => { onClose(); onFeedback(); }}>
          <MessageSquarePlus size={17} aria-hidden /><span>Send feedback</span>
        </button>
      )}
      {canInstall && !inSandbox && (
        <button
          type="button"
          className={styles.dropItem}
          role="menuitem"
          id={`${idPrefix}-download-app`}
          onClick={() => { onClose(); window.dispatchEvent(new Event('flhq:show-install')); }}
        >
          <Download size={17} aria-hidden /><span>Download app</span>
        </button>
      )}
      {!inSandbox && (
        // "Sign out", not "Logout": one name for one action everywhere a customer reads it (2026-09-01).
        <button type="button" className={`${styles.dropItem} ${styles.dropLogout}`} role="menuitem" id={`${idPrefix}-logout`} onClick={handleSignOut}>
          <LogOut size={17} aria-hidden /><span>Sign out</span>
        </button>
      )}
      {children}
    </div>
  );
}
