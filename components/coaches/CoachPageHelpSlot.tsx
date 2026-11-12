'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import stripStyles from './CoachTopStrip.module.css';

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
 * ⚠ **ON A PHONE IT NO LONGER FOLDS.** Until 2026-09-21 `.teamHeaderCollapsed` hid the whole right
 * slot at ≤900px once the page scrolled, so *"help stops scrolling away"* was TRUE ON DESKTOP AND
 * FALSE ON A PHONE (stated here because that sentence was this option's original justification and
 * it was only half right). The phone re-evaluation's stage 1 · B2 (owner ruling 2026-09-21) deleted
 * the scroll collapse at every width — the masthead is one 36px line on a phone that never changes
 * shape — so the sentence is now true everywhere.
 *
 * ⚖ **ON A COMPUTER THE "?" LIVES IN THE STRIP, BESIDE THE BELL (owner 2026-11-12, navigation Phase 4b; REVERSES the 2026-07-31
 * "not `CoachTopStrip`" boundary, on purpose).** That ruling kept the strip for doors that leave the place you are in and
 * removed the chat icon for being a duplicate door; the owner chose the strip for the page's help because it is fixed (help
 * never scrolls away), one corner on every page — with buttons or without, loading or behind a wall — and it gives back
 * the 50px row a lone "?" took. ONE publisher, TWO ends: the page header publishes its topic once, and BOTH the phone's team
 * bar (`CoachPageHelpSlot`, ≤900) and the strip (`CoachStripHelp`, above 900) read the ONE entry, held by
 * `CoachStripHelpProvider` (mounted by the shell, outside the team layout where the strip is); the team layout's provider only
 * marks a page `hosted` and hands `publish` down. A hosted page header draws NO "?" of its own, at any width. The phone is
 * unchanged this phase; its single help door moves to the More sheet in Phase 5 (owner 2026-11-12, recorded in the plan).
 * ⚠ Still true: the account menu keeps its own Help row (the full guide, in a new tab) — a different door from this one,
 * which opens the in-page drawer at this screen's section.
 *
 * ⚠ **A PAGE WITHOUT A HOST KEEPS DRAWING ITS OWN "?" — the fallback is the default context value,
 * not a branch anyone has to remember.** `hosted` is false everywhere the provider is not mounted
 * (the team-picker hub, notifications, the portal-level shells, and the team layout's own
 * no-auth early return), so those pages render exactly what they rendered before this existed.
 * **Never make the publisher unconditional; a page whose "?" is published to nobody has no help.**
 */

type Entry = { id: string; req: HelpRequest } | null;
type Publish = (id: string, req: HelpRequest | null) => void;
/** Set, or clear only while the stored entry is still the caller's (see the guard note on the provider). */
const nextEntry = (prev: Entry, id: string, req: HelpRequest | null): Entry => (req ? { id, req } : prev?.id === id ? null : prev);

/**
 * The channel's ONE store (navigation Phase 4b): the published entry lives here, above the team layout, where the strip is. Two
 * contexts so the many publishers (which only need the stable `publish`) never re-render on an entry change.
 * ⚠⚠ **CLEARING IS GUARDED BY THE PUBLISHER'S OWN ID, AND THAT GUARD IS LOAD-BEARING.** Moving between two team pages unmounts one
 * `CoachPageHeader` and mounts another. React runs the outgoing cleanup before the incoming effect *in a single commit*, but
 * nothing in the framework promises that across every navigation shape — and an unguarded `publish(null)` arriving after the
 * new page has published leaves the screen with **no "?" at all**, silently, on a page that has help. Clearing only when the
 * stored entry is still MINE makes the order irrelevant.
 * ⚠ `children` ARRIVES AS A PROP FROM THE SERVER LAYOUT, so a state change here re-renders only real consumers — the two ends
 * below and the publishing header — and bails out on the page subtree. Do not "tidy" this into rendering children inline.
 */
const StripHelpPublishContext = createContext<Publish | null>(null);
const StripHelpEntryContext = createContext<Entry>(null);

export function CoachStripHelpProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Entry>(null);
  const publish = useCallback<Publish>((id, req) => setEntry(prev => nextEntry(prev, id, req)), []);
  return (
    <StripHelpPublishContext.Provider value={publish}>
      <StripHelpEntryContext.Provider value={entry}>{children}</StripHelpEntryContext.Provider>
    </StripHelpPublishContext.Provider>
  );
}

/**
 * The strip's "?" — nothing until a page publishes (a screen with no help topic leaves the corner empty). `reserve` (a team's pages,
 * where the strip is split) holds the door's width while nothing is published, so the bell and the account button do not slide a
 * door's width each time a page's help arrives after hydration or a navigation crosses a page with help and one without (/review 2026-11-12).
 */
export function CoachStripHelp({ reserve = false }: { reserve?: boolean }) {
  const entry = useContext(StripHelpEntryContext);
  if (!entry) return reserve ? <span className={stripStyles.stripHelpSpacer} aria-hidden /> : null;
  return (
    <span className={stripStyles.stripHelp}>
      <HelpButton iconOnly label={entry.req.label} help={entry.req} />
    </span>
  );
}

const CoachPageHelpContext = createContext<{ hosted: boolean; publish: Publish }>({ hosted: false, publish: () => {} });

/**
 * The team layout's provider: it exists only to say "this page HAS a host" (`hosted` — so a header stops drawing its own "?", and the
 * phone's team bar draws the published one), and to hand `publish` down. It holds no state of its own; with no shell above it (no
 * `CoachStripHelpProvider`) it reports unhosted and every header keeps its own "?".
 */
export function CoachPageHelpProvider({ children }: { children: ReactNode }) {
  const publish = useContext(StripHelpPublishContext);
  const value = useMemo(() => ({ hosted: !!publish, publish: publish ?? (() => {}) }), [publish]);
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
  const entry = useContext(StripHelpEntryContext);
  if (!entry) return null;
  return (
    <span className={styles.teamHeaderHelp}>
      <HelpButton iconOnly label={entry.req.label} help={entry.req} />
    </span>
  );
}
