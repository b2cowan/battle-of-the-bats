'use client';

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { usePublicPathname } from '@/lib/use-public-pathname';
import HelpButton from './HelpButton';
import type { HelpRequest } from './help-drawer-context';

/**
 * THE PAGE'S "?" IS DRAWN BY THE CHROME, IN ALL THREE PORTALS (Coaches Portal: navigation Phase 4b/5, owner 2026-11-12; the
 * tournament admin and the club: Phase 6b, T1–T6, owner 2026-11-13). A page says what its help topic is; the top strip (a
 * computer) and the phone bar each draw ONE "?" from that answer. This module is the channel both portals use, so the two
 * cannot drift: one store, one publisher, one door. Each portal keeps its own ends (they sit in different chrome and wear its
 * styles) and decides who may publish — the Coaches Portal through its host mark (`CoachPageHelpSlot.tsx`: own · masthead ·
 * strip), the admin from the address first (`components/admin/AdminPageHelp.tsx`).
 *
 * ⚠⚠ **CLEARING IS GUARDED BY THE PUBLISHER'S OWN ID, AND THAT GUARD IS LOAD-BEARING.** Moving between two pages unmounts one
 * publisher and mounts another. React runs the outgoing cleanup before the incoming effect *in a single commit*, but nothing in
 * the framework promises that across every navigation shape — and an unguarded `publish(null)` arriving after the new page has
 * published leaves the screen with **no "?" at all**, silently, on a page that has help. Clearing only when the stored entry is
 * still MINE makes the order irrelevant.
 * ⚠ `children` ARRIVES AS A PROP FROM THE SHELL, so a state change here re-renders only real consumers — the ends and the
 * publisher — and bails out on the page subtree. Do not "tidy" this into rendering children inline. Two contexts, so the many
 * publishers (which only need the stable `publish`) never re-render on an entry change.
 */

type Entry = { id: string; req: HelpRequest } | null;
export type PublishPageHelp = (id: string, req: HelpRequest | null) => void;
/** Set, or clear only while the stored entry is still the caller's (see the guard note above). */
const nextEntry = (prev: Entry, id: string, req: HelpRequest | null): Entry => (req ? { id, req } : prev?.id === id ? null : prev);

const PublishContext = createContext<PublishPageHelp | null>(null);
const EntryContext = createContext<Entry>(null);

/** The channel's ONE store, mounted by a portal's shell around its strip, its phone bar and its pages. */
export function PageHelpChannelProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Entry>(null);
  const publish = useCallback<PublishPageHelp>((id, req) => setEntry(prev => nextEntry(prev, id, req)), []);
  return (
    <PublishContext.Provider value={publish}>
      <EntryContext.Provider value={entry}>{children}</EntryContext.Provider>
    </PublishContext.Provider>
  );
}

/** The shell's `publish`, or null where no shell mounted the channel. */
export function usePageHelpPublisher(): PublishPageHelp | null {
  return useContext(PublishContext);
}

/** What a page has published, or null. */
export function usePublishedPageHelp(): HelpRequest | null {
  return useContext(EntryContext)?.req ?? null;
}

/**
 * A page's hand-up: publishes `help` (labelled) while mounted and withdraws only its own entry on the way out. Call it
 * UNCONDITIONALLY (a hook behind an early return is the classic ordering crash) — pass `null` for "nothing to publish", and a
 * null `publish` for "nobody to publish to".
 */
export function usePublishPageHelp(publish: PublishPageHelp | null, help: HelpRequest | null, label?: string) {
  const id = useId();
  // The request is rebuilt inline by every caller on every render, so depending on the object
  // identity would republish on each one. Depend on what the drawer actually reads instead.
  const key = help ? `${help.module}|${help.sectionIds.join(',')}|${help.subtopicId ?? ''}|${help.fullGuideHref ?? ''}|${help.label ?? ''}|${label ?? ''}` : '';
  useEffect(() => {
    if (!publish || !help) return;
    publish(id, { ...help, label: help.label ?? label });
    return () => publish(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, publish]);
}

/**
 * ⚠ THE HELD WIDTH IS A LOADING STATE, NOT A PERMANENT GAP (owner 2026-11-12: a page with no help topic — a player's page — left a
 * door-sized hole between the bell and the account button). While `reserve` is on, an end with nothing to draw holds the door's
 * width only until the page has had its turn to publish: pages publish in an effect in the same commit as this one, so one short
 * tick later "no entry" really means "no topic here" and the width is given back. Keyed to the address, so each new page gets
 * its own chance and the bell still does not slide while a page's help is on its way.
 */
function useStillLoading(reserve: boolean, holdMs: number): boolean {
  const pathname = usePublicPathname() ?? '';
  const [settledFor, setSettledFor] = useState<string | null>(null);
  useEffect(() => {
    if (!reserve) return;
    const t = setTimeout(() => setSettledFor(pathname), holdMs);
    // Forgotten on the way out, so coming back to a page that settled before holds its width again (/review 2026-11-13).
    return () => { clearTimeout(t); setSettledFor(null); };
  }, [reserve, pathname, holdMs]);
  return reserve && settledFor !== pathname;
}

/**
 * One end of the channel: the "?" for `help`, inside the end's own wrapper — or nothing when there is no topic (a "?" that opens
 * an empty panel is a door that dead-ends), the door's width held meanwhile when `reserve` (above).
 */
export function PageHelpDoor({ help, reserve = false, holdMs = 120, className, spacerClassName }: {
  help: HelpRequest | null;
  reserve?: boolean;
  /** How long the width is held for a topic that has not arrived: one tick for a page that publishes as it mounts (a team's
   *  pages); longer for a page known to publish only once its data has loaded (the Coaches off-team pages, /review 2026-11-13). */
  holdMs?: number;
  className: string;
  spacerClassName: string;
}) {
  const loading = useStillLoading(reserve && !help, holdMs);
  if (!help) return loading ? <span className={spacerClassName} aria-hidden /> : null;
  return (
    <span className={className}>
      <HelpButton iconOnly label={help.label} help={help} />
    </span>
  );
}
