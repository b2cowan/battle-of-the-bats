import clsx from 'clsx';
import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import kit from './CoachKit.module.css';

/**
 * THE LIST TOOLBAR — the row above a list (plan §4, decision E, 2026-09-16): a lede or a lens on
 * the left, the actions pinned right, wrapping, one rem of air below, the table under it.
 *
 *   lede      — a count or a sentence in ONE type role ("6 sessions this season"; "Tests record
 *               numbers. Skills describe behaviour."). Rendered first.
 *   children  — the lens: a View pill, a search field, a segmented view switch. A segmented switch
 *               that LEADS the row wears `kit.toolbarView` beside its own class (equal pills sized
 *               to the longest label — owner 2026-08-26; leading — owner 2026-09-13).
 *   actions   — Export, the create, a filter: pinned right by an auto margin; every control in it
 *               takes the tap floor at ≤ 768, ONCE, here. `actionsClassName` is for the one caller
 *               whose slot stacks its doors full-width on a phone (a player's Results) — worn
 *               beside the kit's class, never composed from it. A caller with its own two-deck
 *               layout (the Ledger) renders the decks as children and puts `kit.toolbarActions` on
 *               the deck's right slot itself.
 *   sticky    — docks under the sticky tab row (the Ledger's register). `stickyTop` is the MEASURED
 *               height the caller passes; the stylesheet never hard-codes it.
 *
 * Replaces three live recipes (`.panelToolbar` ×6 tabs, `.listToolbar` ×2, `.insightsPanelToolbar`)
 * and retires two dead ones. Money's geometry is the kit's — there is deliberately no spacing prop:
 * a band that wants its toolbar closer or farther sets that on its own section, not on this row.
 * `.ppToolbar` — the practice document's action row — is not a list toolbar and stays where it is.
 */
type Props = {
  lede?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  sticky?: boolean;
  /** The measured/computed height the toolbar docks under — a number or a CSS length (`calc(…)`). */
  stickyTop?: number | string;
  className?: string;
  'aria-label'?: string;
};

const CoachListToolbar = forwardRef<HTMLDivElement, Props>(function CoachListToolbar(
  { lede, children, actions, actionsClassName, sticky, stickyTop, className, ...rest },
  ref,
) {
  const style: CSSProperties | undefined = sticky && stickyTop != null ? { top: stickyTop } : undefined;
  return (
    <div ref={ref} className={clsx(kit.toolbar, sticky && kit.toolbarSticky, className)} style={style} {...rest}>
      {lede ? <p className={kit.toolbarLede}>{lede}</p> : null}
      {children}
      {actions ? <div className={clsx(kit.toolbarActions, actionsClassName)}>{actions}</div> : null}
    </div>
  );
});

export default CoachListToolbar;
