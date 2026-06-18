'use client';

import { HelpCircle } from 'lucide-react';
import { useHelpDrawer, type HelpRequest } from './help-drawer-context';
import styles from './help.module.css';

/**
 * The "?" Help trigger for a work-page header. Opens the in-context HelpDrawer
 * with the guide section(s) this page maps to. Styled with the shared ghost
 * action-button classes so it sits in the header actions row exactly like the
 * existing Scorekeeper button. Pure pull: it never opens on its own.
 *
 * `label` is the work-page name; it becomes the drawer header and the button's
 * accessible name unless the help request supplies its own label.
 */
export default function HelpButton({ help, label }: { help: HelpRequest; label?: string }) {
  const { openHelp } = useHelpDrawer();
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-data ${styles.helpButton}`}
      onClick={() => openHelp({ ...help, label: help.label ?? label })}
      aria-haspopup="dialog"
      aria-label={label ? `Help: ${label}` : 'Help'}
    >
      <HelpCircle size={13} aria-hidden />
      <span className={styles.helpButtonLabel}>Help</span>
    </button>
  );
}
