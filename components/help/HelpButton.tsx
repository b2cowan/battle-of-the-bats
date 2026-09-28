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
 *
 * `iconOnly` renders a bare "?" glyph with no label at every width — the coaches portal's one
 * help trigger (owner, 2026-09-24: the phone's bare glyph became the look at every width). It
 * drops the ghost-button classes rather than overriding them: the HelpCircle icon draws its own
 * ring, the ghost fill drew a second one around it, and the warm skin re-applies that fill at a
 * specificity a module rule cannot reach — so the fill is never asked for instead of fought.
 */
export default function HelpButton({
  help,
  label,
  iconOnly,
}: {
  help: HelpRequest;
  label?: string;
  iconOnly?: boolean;
}) {
  const { openHelp } = useHelpDrawer();
  return (
    <button
      type="button"
      className={iconOnly
        ? `${styles.helpButton} ${styles.helpButtonIconOnly}`
        : `btn btn-ghost btn-data ${styles.helpButton}`}
      onClick={() => openHelp({ ...help, label: help.label ?? label })}
      aria-haspopup="dialog"
      aria-label={label ? `Help: ${label}` : 'Help'}
    >
      <HelpCircle size={iconOnly ? 20 : 13} aria-hidden />
      {!iconOnly && <span className={styles.helpButtonLabel}>Help</span>}
    </button>
  );
}
