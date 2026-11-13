'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import {
  PageHelpChannelProvider, PageHelpDoor, usePageHelpPublisher, usePublishPageHelp, usePublishedPageHelp,
} from '@/components/help/PageHelpChannel';
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
 * marks a page `hosted` and hands `publish` down. A hosted page header draws NO "?" of its own, at any width.
 * ⚖ THE PHONE KEEPS ITS "?" IN THE BAR (navigation Phase 5, F3 A, owner 2026-11-12 — replacing the 4b record's "moves into
 * the More sheet's Help row" on purpose): one rule at both widths, the page's "?" in the fixed top chrome. The More sheet's
 * Help row and the account menu's Help row stay the full guide (in a new tab) — a different door from this one, which
 * opens the in-page drawer at this screen's section.
 *
 * ⚖ **THE OFF-TEAM PAGES MOVED TOO (navigation Phase 6b, T6·1, owner 2026-11-13 — crossing 4b's "team pages only" line on
 * purpose):** notifications, Plan & billing and Join a club publish to the strip on a computer like a team's pages, so help's
 * place is the same on every page of all three portals. They have no phone bar, so on a phone each keeps its own "?" on its
 * title row (host `strip`, below).
 *
 * ⚠ **A PAGE WITHOUT A HOST KEEPS DRAWING ITS OWN "?" — the fallback is the default context value,
 * not a branch anyone has to remember.** The host is `own` everywhere the provider is not mounted
 * (the free portal, a wall, the help guide), so those pages render exactly what they rendered before this existed.
 * **Never make the publisher unconditional; a page whose "?" is published to nobody has no help.**
 */

/**
 * The channel's ONE store (navigation Phase 4b): the published entry lives here, above the team layout, where the strip is. Since
 * Phase 6b it is the shared channel (`components/help/PageHelpChannel.tsx`) — the admin's strip and phone bar read the same
 * store, publisher and door, so the three portals cannot drift; its guard notes (the id-guarded clear, children as a prop) live there.
 */
export function CoachStripHelpProvider({ children }: { children: ReactNode }) {
  return <PageHelpChannelProvider>{children}</PageHelpChannelProvider>;
}

/**
 * The strip's "?" — nothing until a page publishes (a screen with no help topic leaves the corner empty). `reserve` (a team's pages,
 * where the strip is split) holds the door's width while nothing is published, so the bell and the account button do not slide a
 * door's width each time a page's help arrives after hydration or a navigation crosses a page with help and one without (/review
 * 2026-11-12) — and gives it back once the page has had its turn (the shared door's loading rule, owner 2026-11-12).
 */
export function CoachStripHelp({ reserve = false, holdMs }: { reserve?: boolean; holdMs?: number }) {
  return <PageHelpDoor help={usePublishedPageHelp()} reserve={reserve} holdMs={holdMs} className={stripStyles.stripHelp} spacerClassName={stripStyles.stripHelpSpacer} />;
}

/**
 * WHO DRAWS A PAGE'S "?":
 * - `own` — the page header, at every width (the default: no host mounted — the free portal, a wall, the help guide).
 * - `masthead` — the chrome, at every width: the strip above 900, the team bar at 900 and below (a team's pages).
 * - `strip` — the strip above 900; at 900 and below the page header keeps its own (the paid portal's off-team pages —
 *   notifications, Plan & billing, Join a club: navigation Phase 6b, T6·1, owner 2026-11-13). Those pages have no phone bar to
 *   carry it, and the drawing drew none, so the phone stays as it was rather than inventing one.
 */
export type CoachHelpHost = 'own' | 'masthead' | 'strip';

const CoachPageHelpContext = createContext<CoachHelpHost>('own');

/**
 * The portal's host mark: it exists only to say "this page HAS a host" (`host` — so a header stops drawing its own "?" where the
 * chrome draws the published one), and to hand `publish` down. It holds no state of its own; with no shell above it (no
 * `CoachStripHelpProvider`) it reports `own` and every header keeps its own "?". Two mounts: `CoachesChrome` around the paid
 * portal's pages (`strip`), and the team layout inside it (`masthead`, the inner one wins). Never the free portal (E13).
 */
export function CoachPageHelpProvider({ children, host = 'masthead' }: { children: ReactNode; host?: Exclude<CoachHelpHost, 'own'> }) {
  const publish = usePageHelpPublisher();
  return (
    <CoachPageHelpContext.Provider value={publish ? host : 'own'}>
      {children}
    </CoachPageHelpContext.Provider>
  );
}

/**
 * Called by `CoachPageHeader` on every render, request or not. Returns who draws the "?" — the caller draws its own unless
 * the masthead does (and, with `strip`, only at 900 and below).
 *
 * ⚠ It must be called UNCONDITIONALLY, including for the `embedded` and `nested` shapes that never
 * own a "?" (they pass `null`). Both of those return early in the component, and a hook behind an
 * early return is the classic ordering crash.
 */
export function useCoachPageHelp(help: HelpRequest | null, label?: string): CoachHelpHost {
  const host = useContext(CoachPageHelpContext);
  const publish = usePageHelpPublisher();
  usePublishPageHelp(host === 'own' ? null : publish, help, label);
  return host;
}

/**
 * The phone bar's end of the channel (F3 A, owner 2026-11-12: the "?" stays at the bar's right end, More → Help stays the
 * full guide). Renders nothing once a page has had its turn and published nothing — a screen with no help topic leaves the
 * corner empty rather than showing a "?" that opens the drawer at nothing. `reserve` holds the door's width meanwhile (the
 * strip's `reserve`), so the bar's two lines do not re-cut when a page's help arrives after hydration.
 */
export function CoachPageHelpSlot({ reserve = false }: { reserve?: boolean } = {}) {
  return <PageHelpDoor help={usePublishedPageHelp()} reserve={reserve} className={styles.teamHeaderHelp} spacerClassName={styles.teamHeaderHelpSpacer} />;
}
