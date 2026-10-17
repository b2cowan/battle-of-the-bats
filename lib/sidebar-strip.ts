'use client';

import { useSyncExternalStore } from 'react';

/**
 * lib/sidebar-strip.ts — THE SIDEBAR STRIP SETTING, ONE FOR EVERY PORTAL ON THE DEVICE (Sidebar Strip &
 * Grid Width, Stage 2; plan `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md`).
 *
 * ⚖ The owner's rulings (2026-10-12): remembered PER DEVICE, ALWAYS A CHOICE (nothing collapses by itself
 * at any width), and ONE setting shared by every portal — the club and tournament sidebar (`AdminKitRail`),
 * the Premium coach sidebar (`CoachesSidebar`) and the free coach sidebar (`CoachPortalShell`, owner at the
 * Stage 2 build, 2026-10-16). A person who collapses it in one portal finds every portal collapsed.
 *
 * ⚠ THE ATTRIBUTE ON <html> IS THE TRUTH, AND CSS DOES THE LOOK. The no-flash script in the root layout
 * (`lib/no-flash-script.ts`) reads this key and sets `data-sidebar="strip"` before the first paint, and
 * every rail's stylesheet narrows itself under `html[data-sidebar='strip']`. So the server renders ONE
 * sidebar for everybody, the rails render the same markup in both states, and a strip user never watches
 * the sidebar snap on a cold load (the Next guide "preventing flash before hydration" — the theme's own
 * pattern). React's development remount strips the attribute with the theme's; `NoFlashRestore` puts both
 * back. What JavaScript decides is BEHAVIOUR only — whether a program's icon opens its menu — read at the
 * moment of the click (`isSidebarStrip`), or for the few accessibility attributes a strip row adds
 * (`useSidebarStrip`, which renders the full sidebar's answer during hydration).
 *
 * ⚠ `localStorage` can be empty or throw (private windows, blocked storage): unreadable means the full
 * sidebar, and a choice that cannot be stored still holds for the page in hand. Mirrored as string
 * literals inside `applyNoFlashAttributes` (an inline script cannot import) — `sidebar-strip-guard.test.ts`
 * pins the two together.
 */
export const SIDEBAR_STRIP_KEY = 'flhq-sidebar';
export const SIDEBAR_STRIP_ATTR = 'data-sidebar';
export const SIDEBAR_STRIP_VALUE = 'strip';

/** Is the sidebar a strip right now? The attribute, read live — never a value captured at render. */
export function isSidebarStrip(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(SIDEBAR_STRIP_ATTR) === SIDEBAR_STRIP_VALUE;
}

function applyStripAttr(strip: boolean) {
  const root = document.documentElement;
  if (strip) root.setAttribute(SIDEBAR_STRIP_ATTR, SIDEBAR_STRIP_VALUE);
  else root.removeAttribute(SIDEBAR_STRIP_ATTR);
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach(listener => listener());
}

/** Collapse (`true`) or expand the sidebar, in every portal on this device. */
export function setSidebarStrip(strip: boolean): void {
  applyStripAttr(strip);
  try {
    if (strip) localStorage.setItem(SIDEBAR_STRIP_KEY, SIDEBAR_STRIP_VALUE);
    else localStorage.removeItem(SIDEBAR_STRIP_KEY);
  } catch {
    /* Blocked storage: the choice holds for this page and is forgotten on reload. */
  }
  notify();
}

/** Another tab on this device changed it — follow, so two open portals never disagree. A `null` key is
 *  `localStorage.clear()`, which reads as the full sidebar like any missing value. */
function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== SIDEBAR_STRIP_KEY) return;
  applyStripAttr(e.newValue === SIDEBAR_STRIP_VALUE);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

const serverSnapshot = () => false;

/** The setting, for a component that renders differently by it. The server — and hydration — read the
 *  full sidebar, so nothing a strip row adds may change what the page LOOKS like (CSS owns that). */
export function useSidebarStrip(): boolean {
  return useSyncExternalStore(subscribe, isSidebarStrip, serverSnapshot);
}
