'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The channel that lets a PAGE's help "?" be drawn by the team MASTHEAD above it
 * (owner ruling 2026-08-25 — `COACH_PAGE_TITLE_BAND_PLAN.md` §5, option 3).
 *
 * The "?" is chrome, and the 2026-08-11 ruling fixes it as *"its own slot, always LAST, top-right
 * at every width — one findable home"*. It has now moved home: out of the page-title band, into the
 * masthead's right slot, **at every width**, rendered after the status stack and the public-site
 * flip so *"always last, top-right"* stays literally true rather than approximately true.
 *
 * ⚠⚠ **THE MOVE IS A HELP-PLACEMENT CHANGE, NOT A SPACE SAVING, AND THE PIXELS ARE NOT THE POINT.**
 * On a phone it takes the band from its 44px tap floor down to the 36px icon tile — **8px**. On a
 * desktop it saves **exactly nothing** (the band is a 36px tile and the "?" is 34px). What it buys
 * is that on a desktop, where the masthead never collapses (ruling 2026-08-19), contextual help is
 * permanently on screen instead of scrolling away with the band.
 *
 * ⚠ **ON A PHONE IT FOLDS WITH THE COLLAPSE, DELIBERATELY.** `.teamHeaderCollapsed` hides the whole
 * right slot at ≤900px, so a scrolled phone loses the "?" exactly as it loses the flip and the
 * season. That is ruled: the 2026-08-02 bare-name collapse is NOT reopened (it was re-affirmed on
 * 2026-08-24 when the status slot came off phones). It also means *"help stops scrolling away"* is
 * TRUE ON DESKTOP AND FALSE ON A PHONE — stated here because that sentence was this option's
 * original justification and it was only half right.
 *
 * ⚠⚠ **NOT `CoachTopStrip`, AND THAT IS A SETTLED BOUNDARY.** The strip keeps *"only genuine
 * leave-this-place doors (wordmark · account · workspaces)"*, and the CHAT door was removed from it
 * by owner ruling 2026-07-31 for the two faults a "?" would repeat: it is not an exit, and it
 * duplicated a door already reachable at the same width — `CoachesSidebar` carries a `Help` item.
 * Do not re-propose the strip for contextual help.
 *
 * ⚠ **A PAGE WITHOUT A HOST KEEPS DRAWING ITS OWN "?" — the fallback is the default context value,
 * not a branch anyone has to remember.** `hosted` is false everywhere the provider is not mounted
 * (the team-picker hub, notifications, the portal-level shells, and the team layout's own
 * no-auth early return), so those pages render exactly what they rendered before this existed.
 * **Never make the publisher unconditional; a page whose "?" is published to nobody has no help.**
 */

type Entry = { id: string; req: HelpRequest } | null;

const CoachPageHelpContext = createContext<{
  hosted: boolean;
  entry: Entry;
  publish: (id: string, req: HelpRequest | null) => void;
}>({ hosted: false, entry: null, publish: () => {} });

export function CoachPageHelpProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Entry>(null);
  /**
   * ⚠⚠ **CLEARING IS GUARDED BY THE PUBLISHER'S OWN ID, AND THAT GUARD IS LOAD-BEARING.** Moving
   * between two team pages unmounts one `CoachPageHeader` and mounts another. React runs the
   * outgoing cleanup before the incoming effect *in a single commit*, but nothing in the framework
   * promises that across every navigation shape — and an unguarded `publish(null)` arriving after
   * the new page has published leaves the masthead with **no "?" at all**, silently, on a screen
   * that has help. Clearing only when the stored entry is still MINE makes the order irrelevant.
   */
  const publish = useCallback((id: string, req: HelpRequest | null) => {
    setEntry(prev => (req ? { id, req } : prev?.id === id ? null : prev));
  }, []);
  /**
   * ⚠ `children` ARRIVES AS A PROP FROM THE SERVER LAYOUT, WHICH IS WHY PUTTING A PROVIDER ABOVE
   * THE MASTHEAD COSTS NOTHING. When this state changes, React re-renders this component but bails
   * out on `children` — same element identity, so `CoachTeamHeader` and the whole page subtree are
   * untouched. Only real context consumers re-render: the slot below and the page header that
   * published. Memoised so even those two re-render on an actual change rather than on identity
   * churn. ⚠ Do not "tidy" this into rendering the masthead inline here — that turns a bail-out
   * into a full re-render of the busiest client component in the portal, on every page change.
   */
  const value = useMemo(() => ({ hosted: true, entry, publish }), [entry, publish]);
  return (
    <CoachPageHelpContext.Provider value={value}>
      {children}
    </CoachPageHelpContext.Provider>
  );
}

/**
 * Called by `CoachPageHeader` on every render, request or not. Returns whether a host exists — the
 * caller draws its own "?" when it does not.
 *
 * ⚠ It must be called UNCONDITIONALLY, including for the `embedded` and `nested` shapes that never
 * own a "?" (they pass `null`). Both of those return early in the component, and a hook behind an
 * early return is the classic ordering crash.
 */
export function useCoachPageHelp(help: HelpRequest | null, label?: string): boolean {
  const { hosted, publish } = useContext(CoachPageHelpContext);
  const id = useId();
  // The request is rebuilt inline by every caller on every render, so depending on the object
  // identity would republish on each one. Depend on what the drawer actually reads instead.
  const key = help ? `${help.module}|${help.sectionIds.join(',')}|${help.subtopicId ?? ''}|${help.fullGuideHref ?? ''}|${help.label ?? ''}|${label ?? ''}` : '';
  useEffect(() => {
    if (!hosted || !help) return;
    publish(id, { ...help, label: help.label ?? label });
    return () => publish(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosted, id, key, publish]);
  return hosted;
}

/**
 * The masthead's end of the channel. Renders nothing until a page publishes — a screen with no help
 * topic leaves the corner empty rather than showing a "?" that opens the drawer at nothing.
 */
export function CoachPageHelpSlot() {
  const { entry } = useContext(CoachPageHelpContext);
  if (!entry) return null;
  return (
    <span className={styles.teamHeaderHelp}>
      <HelpButton iconOnly label={entry.req.label} help={entry.req} />
    </span>
  );
}
