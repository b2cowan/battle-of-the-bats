'use client';

/**
 * Discovery & Orientation (help Layer 3) — the lifecycle "what's next" rail.
 *
 * A single pinned card at the top of the tournament dashboard: one headline, one
 * context line, one primary action, plus an optional dismissible "Did you know?"
 * nudge and a collapsed "See common tasks" shortcut list. Stage-aware content
 * comes from lib/tournament-guidance — this component is presentational and owns
 * only the (per-tournament) nudge-dismissal + collapsed + tasks-expanded UI state.
 *
 * The card itself is never dismissible (it's the persistent orientation anchor);
 * only the nudge is. Dismissal reuses the established HelpCallout localStorage
 * convention (flhq-help-dismissed-{slug}), scoped per tournament. SSR-safe: the
 * dismissed flag is read after mount so it never mismatches hydration.
 *
 * `collapsible` stages (live, pre) can shrink to the one-line strip so a returning
 * admin isn't shown the full card on every visit; `ready` stays full/expanded per
 * the 2026-07-06 design decision (a call to act must not hide). The collapsed
 * choice is remembered per tournament; each stage falls back to its own default
 * (live starts collapsed, pre starts expanded) until the admin toggles it.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Guidance, GuidanceAction, TaskShortcut } from '@/lib/tournament-guidance';
import styles from './GuidanceRail.module.css';

const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function GuidanceRail({
  guidance,
  shortcuts,
  tournamentId,
  live = false,
  ready = false,
  collapsible,
  onAction,
}: {
  guidance: Guidance;
  shortcuts: TaskShortcut[];
  tournamentId: string;
  /** Game-day tone — amber accent to match the live alert language. */
  live?: boolean;
  /**
   * "Ready to finalize" tone — lime accent, full/expanded (never collapses). A
   * positive end-of-event milestone, distinct from the amber live view. `live` and
   * `ready` are mutually exclusive; when `ready` the rail never enters the collapsed
   * strip (a call to act must not hide).
   */
  ready?: boolean;
  /**
   * Allows the admin to collapse this card to a one-line strip (icon + headline +
   * CTA), same as the game-day treatment. Defaults to `live` for backward compat;
   * pass `true` explicitly for other collapsible stages (e.g. pre-event).
   */
  collapsible?: boolean;
  /** Handler for a CTA/nudge action with an `actionId` (e.g. the one-click complete confirm). */
  onAction?: (actionId: NonNullable<GuidanceAction['actionId']>) => void;
}) {
  const nudge = guidance.nudge ?? null;
  const dismissKey = nudge ? `flhq-help-dismissed-${nudge.id}-${tournamentId}` : '';
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  // Collapse: on a live event the board is the real "live view", so this
  // orientation rail can shrink to a one-line strip (icon + headline + the primary
  // CTA) to keep the metrics above the fold. The same strip is available on the
  // pre-event stage so a returning admin isn't shown the full card on every visit.
  // `ready` (and other non-collapsible stages) never collapse — the rail is their
  // persistent anchor. Default = collapsed once live, expanded otherwise; the
  // choice is then remembered per tournament. Initial state matches the server
  // render (collapsed only when live) so hydration is stable; a stored preference
  // overrides the default after mount.
  const canCollapse = collapsible ?? live;
  const collapseKey = `flhq-help-guiderail-${tournamentId}`;
  const [collapsed, setCollapsed] = useState(live);

  useEffect(() => {
    if (!canCollapse) { setCollapsed(false); return; }
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(collapseKey) : null;
      setCollapsed(stored === 'open' ? false : stored === 'closed' ? true : live);
    } catch {
      setCollapsed(live);
    }
  }, [collapseKey, canCollapse, live]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(collapseKey, next ? 'closed' : 'open');
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!nudge) return;
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(dismissKey) === '1') {
        setNudgeDismissed(true);
      }
    } catch {
      /* localStorage blocked — show the nudge, no harm */
    }
  }, [nudge, dismissKey]);

  function dismissNudge() {
    try {
      localStorage.setItem(dismissKey, '1');
    } catch {
      /* ignore */
    }
    setNudgeDismissed(true);
  }

  function actionLink(action: GuidanceAction, className: string) {
    // An action with an `actionId` fires an in-page handler (e.g. the complete
    // confirm) rather than navigating — render a button when a handler is wired.
    if (action.actionId && onAction) {
      const id = action.actionId;
      return (
        <button type="button" className={className} onClick={() => onAction(id)}>
          {action.label} →
        </button>
      );
    }
    return (
      <Link href={action.href} className={className} {...(action.external ? NEW_TAB : {})}>
        {action.label} →
      </Link>
    );
  }

  // Collapsed strip: one line, primary action still reachable. The expand
  // chevron sits at the row's true trailing edge (after the CTA, its own small
  // button) so it reads as the row's disclosure control rather than an arrow
  // glued onto the action button.
  if (canCollapse && collapsed) {
    return (
      <section className={`${styles.rail} ${live ? styles.railLive : ''} ${styles.railCompact}`} aria-label="What's next">
        <button
          type="button"
          className={styles.compactToggle}
          aria-expanded={false}
          onClick={toggleCollapsed}
        >
          <Compass size={16} className={styles.icon} aria-hidden />
          <span className={styles.compactHeadline}>{guidance.headline}</span>
        </button>
        <div className={styles.compactActions}>
          {guidance.cta && actionLink(guidance.cta, `btn btn-lime btn-data ${styles.compactCta}`)}
          <button
            type="button"
            className={styles.compactChevronBtn}
            aria-expanded={false}
            aria-label={live ? 'Expand game-day guidance' : 'Expand guidance'}
            onClick={toggleCollapsed}
          >
            <ChevronDown size={15} className={styles.compactChevron} aria-hidden />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.rail} ${live ? styles.railLive : ready ? styles.railReady : ''}`} aria-label="What's next">
      <div className={styles.head}>
        <Compass size={18} className={styles.icon} aria-hidden />
        <div className={styles.body}>
          <h2 className={styles.headline}>{guidance.headline}</h2>
          <p className={styles.context}>{guidance.context}</p>
          {guidance.cta && actionLink(guidance.cta, `btn btn-lime btn-data ${styles.cta}`)}
          {guidance.progress && <p className={styles.progress}>{guidance.progress}</p>}
        </div>
        {canCollapse && (
          <button
            type="button"
            className={styles.collapseBtn}
            aria-expanded={true}
            aria-label={live ? 'Collapse game-day guidance' : 'Collapse guidance'}
            onClick={toggleCollapsed}
          >
            <ChevronUp size={16} aria-hidden />
          </button>
        )}
      </div>

      {nudge && !nudgeDismissed && (
        <div className={styles.nudge}>
          <span className={styles.nudgeDyk}>Did you know?</span>
          <div className={styles.nudgeBody}>
            <p className={styles.nudgeText}>{nudge.body}</p>
            <div className={styles.nudgeActions}>
              {nudge.action && actionLink(nudge.action, styles.nudgeShow)}
              <button type="button" className={styles.nudgeDismiss} onClick={dismissNudge}>
                Dismiss <X size={11} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {shortcuts.length > 0 && (
        <div className={styles.tasks}>
          <button
            type="button"
            className={styles.tasksToggle}
            aria-expanded={showTasks}
            onClick={() => setShowTasks(s => !s)}
          >
            {showTasks ? 'Hide common tasks' : 'See common tasks'}
          </button>
          {showTasks && (
            <ul className={styles.taskList}>
              {shortcuts.map((s, i) => (
                <li key={i}>
                  <Link href={s.href} className={styles.taskLink} {...(s.locked ? {} : NEW_TAB)}>
                    <span className={styles.taskLabel}>{s.label}</span>
                    {s.locked ? (
                      <span className={styles.plusTag}>Plus</span>
                    ) : (
                      <span className={styles.taskArrow} aria-hidden>→</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
