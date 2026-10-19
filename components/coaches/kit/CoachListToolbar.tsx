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
 *   filters   — FIND AND NARROW (Toolbar Rules, Rule 2 — owner 2026-10-17): a coach room's search, then the
 *               quiet `restQuiet` pills or a `FilterGroup`. On a desk they lead the right-hand group, after
 *               the gap and before `actions`; on a phone the group steps aside (`display: contents`), so
 *               each pill sits where it always did — left, after the lens (Ask 5: phones keep what each
 *               side has). Never a child: the lede's 64ch cap means only this group's ONE auto margin
 *               can carry it right (two auto margins split the space and strand it).
 *   actions   — Export, the create, Tools: pinned right by an auto margin; every control in it
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
  filters?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  sticky?: boolean;
  /** The measured/computed height the toolbar docks under — a number or a CSS length (`calc(…)`). */
  stickyTop?: number | string;
  className?: string;
  'aria-label'?: string;
};

const CoachListToolbar = forwardRef<HTMLDivElement, Props>(function CoachListToolbar(
  { lede, children, filters, actions, actionsClassName, sticky, stickyTop, className, ...rest },
  ref,
) {
  const style: CSSProperties | undefined = sticky && stickyTop != null ? { top: stickyTop } : undefined;
  const actionsBox = actions ? <div className={clsx(kit.toolbarActions, actionsClassName)}>{actions}</div> : null;
  // A caller that passes `filters` always gets the box, even while they are off (`cond && …`), so the actions keep one
  // parent — a parent that came and went with a filter would remount an open Export menu.
  return (
    <div ref={ref} className={clsx(kit.toolbar, sticky && kit.toolbarSticky, className)} style={style} {...rest}>
      {lede ? <p className={kit.toolbarLede}>{lede}</p> : null}
      {children}
      {filters !== undefined ? <div className={kit.toolbarEnd}>{filters}{actionsBox}</div> : actionsBox}
    </div>
  );
});

export default CoachListToolbar;

/**
 * A list's count, the toolbar's lede where no view choice leads (Toolbar Rules, Rule 1): "24 drills", and "2 of 24
 * drills" while a search or a filter narrows the list — the caller passes `shown` only then, so a search that matches
 * everything still says it is on ("12 of 12 opponents"). The noun follows the whole list.
 */
export function ToolbarCount({ total, shown, one, many }: { total: number; shown?: number; one: string; many: string }) {
  const noun = total === 1 ? one : many;
  return shown == null ? <><strong>{total}</strong> {noun}</> : <><strong>{shown}</strong> of {total} {noun}</>;
}
