'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DemoOrgKind } from '@/lib/demo-org';
import {
  formatResetCountdown,
  msUntilSandboxReset,
  sandboxBannerCopy,
  sandboxTourChips,
  type SandboxSide,
  type SandboxTourChip,
} from '@/lib/sandbox-chrome';
import styles from './SandboxChrome.module.css';

/**
 * SandboxChrome — the banner, the tour chips, the reset countdown and the blocked-save toast.
 * Mounted by the org shell for demo orgs only, and org-agnostic by construction: the coach
 * sandbox mounts this same component and gets its own chips from `lib/sandbox-chrome.ts`.
 *
 * Three jobs, deliberately in one component because they share one piece of state — how tall the
 * chrome is:
 *
 *  1. **The promise.** Never dismissible. The banner is the reason nothing else in the sandbox has
 *     to apologise: it said up front that nothing is saved.
 *  2. **The tour.** Three numbered beats. See "The tour, and what it took to stop it lying" below.
 *  3. **The catch-all.** A `window.fetch` wrapper watching for the sandbox rejection
 *     (`X-Sandbox-Blocked`, from `lib/demo-guard.ts`) so no screen anywhere in the portal can
 *     surface a raw failure — including screens written next year that know nothing about this.
 *
 * ── The geometry contract ───────────────────────────────────────────────────────────────────
 *
 * The chrome is `position: fixed`, so it measures itself and publishes `--sandbox-chrome-h` +
 * `data-sandbox-chrome` on `<html>`. `app/globals.css` pads the document by that height, and every
 * bar that pins itself to the viewport top adds the same term to its own offset — the operator top
 * strip, sidebar and event header, and on the public side the navbar, score ticker, side rail and
 * alert prompts. Off a demo org the var is never set and every one of those `calc()`s resolves to
 * exactly today's geometry. **If you add new top-pinned chrome, add the term to it too** — the
 * failure mode is silent and ugly: the banner keeps its space but something paints over it, so the
 * visitor sees an orphaned chip rail and never sees the promise.
 */

const SPOTLIGHT_CLASS = 'sandboxSpotlight';
/** Long enough that a visitor who looked away still sees the ring when they look back. */
const SPOTLIGHT_MS = 2400;
const TOAST_MS = 6000;
/** v2: the v1 key ticked chips on click, so old progress would read as a tour nobody took. */
const TOUR_DONE_KEY = 'flhq_sandbox_tour_done_v2';
const TOUR_PENDING_KEY = 'flhq_sandbox_tour_pending';

// ── The blocked-save bus ────────────────────────────────────────────────────────────────────
// A module-level subscriber list rather than component state, because the thing doing the
// detecting is a `window.fetch` wrapper that must be installed exactly ONCE per page — it cannot
// be torn down and reinstalled on every render without stacking wrappers. The flag rides on
// window.fetch itself (not a module variable) so it survives Fast Refresh, the same reason
// FeedbackRequestIdProvider does it that way.
type TaggedFetch = typeof window.fetch & { __flhqSandboxWrapped?: boolean };
type ListenerHost = typeof globalThis & { __flhqSandboxBlockedListeners?: Set<() => void> };

/**
 * The subscriber registry lives on `globalThis`, NOT in a module variable.
 *
 * The wrapper is installed once and stays installed. A module variable would be replaced every time
 * this file is hot-reloaded, while the already-installed wrapper kept closing over the OLD Set — so
 * the remounted component would subscribe to a registry nothing publishes to, and the "nothing is
 * saved" toast would quietly stop appearing for the rest of the dev session. Dev-only, but it is
 * the toast that proves the sandbox is honest, and a reviewer who edits this file to test it is
 * exactly the person it would fail in front of. Caught by the 2026-08-03 adversarial review.
 */
function blockedListeners(): Set<() => void> {
  const host = globalThis as ListenerHost;
  host.__flhqSandboxBlockedListeners ??= new Set<() => void>();
  return host.__flhqSandboxBlockedListeners;
}

function installSandboxFetchWatcher(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if ((window.fetch as TaggedFetch).__flhqSandboxWrapped) return;

  const original = window.fetch.bind(window);
  const wrapped = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const res = await original(...args);
    try {
      // Header read only — the body is never touched, so callers still get an unconsumed Response.
      if (res.headers.get('X-Sandbox-Blocked') === '1') {
        blockedListeners().forEach(fn => fn());
      }
    } catch {
      /* never let the sandbox hat break the app's fetch */
    }
    return res;
  }) as TaggedFetch;
  wrapped.__flhqSandboxWrapped = true;
  window.fetch = wrapped;
}

/** A chip that was clicked and is travelling: which beat, and where it was sending the visitor. */
interface PendingChip { label: string; href: string }

function readStoredList(key: string): string[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return []; // a visitor with storage disabled simply gets no ticks
  }
}

function readStoredPending(): PendingChip[] {
  try {
    const raw = window.sessionStorage.getItem(TOUR_PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Shape-check rather than trust: session storage is the visitor's to edit, and a malformed
    // entry must cost a tick, never a crash in the chrome that carries the honesty claim.
    return Array.isArray(parsed)
      ? parsed.filter((p): p is PendingChip =>
          !!p && typeof p.label === 'string' && typeof p.href === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nothing here is worth failing a click over */
  }
}

export default function SandboxChrome({
  kind,
  slug,
  landingPath,
  cycleMinutes,
  isDemoOrganizer,
}: {
  kind: DemoOrgKind;
  slug: string;
  landingPath: string;
  /** DEMO_CYCLE_MINUTES, passed from the server so the countdown and the reconcile job cannot
   *  drift apart — and so the client bundle doesn't pull in the whole seed definition. */
  cycleMinutes: number;
  /** Is this visitor holding the demo organizer's session? Decides where the operator step POINTS
   *  — straight at the dashboard for them, at the door for everybody else. */
  isDemoOrganizer: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const chromeRef = useRef<HTMLDivElement | null>(null);

  // Which half of the product is this? The org layout wraps the public pages AND the admin shell
  // and, being a Server Component, cannot read the pathname — so the side is decided here.
  const side: SandboxSide = pathname?.startsWith(`/${slug}/admin`) ? 'operator' : 'public';
  const copy = sandboxBannerCopy(side);
  const chips = useMemo(
    () => sandboxTourChips(kind, side, { slug, landingPath }, { isDemoOrganizer }),
    [kind, side, slug, landingPath, isDemoOrganizer],
  );

  // ── The countdown ───────────────────────────────────────────────────────────────────────────
  // Starts empty and fills in after mount: the cycle boundary is a function of the wall clock, so
  // rendering it on the server would guarantee a hydration mismatch every single time.
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    const paint = () => setCountdown(formatResetCountdown(msUntilSandboxReset(cycleMinutes, Date.now())));
    paint();
    const id = window.setInterval(paint, 1000);
    return () => window.clearInterval(id);
  }, [cycleMinutes]);

  // ── The geometry ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const node = chromeRef.current;
    if (!node) return;
    const root = document.documentElement;
    root.dataset.sandboxChrome = 'true';

    const publish = () => root.style.setProperty('--sandbox-chrome-h', `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);

    return () => {
      observer.disconnect();
      delete root.dataset.sandboxChrome;
      root.style.removeProperty('--sandbox-chrome-h');
    };
  }, []);

  // ── The tour, and what it took to stop it lying ─────────────────────────────────────────────
  //
  // The first build ticked a chip the instant it was clicked. That reads as "you've done the
  // tour" to somebody who has seen nothing — and because two of the three beats live on other
  // pages, a visitor could end up with three ticks and no idea what happened. So:
  //
  //   • **A chip earns its tick on DELIVERY, not on click.** An on-page beat ticks once it has
  //     been scrolled to and ringed. An off-page beat records itself as PENDING, and ticks after
  //     the navigation has landed and this component has remounted on the new page.
  //   • **A chip says which kind it is.** One that moves you somewhere carries an arrow; one that
  //     points at something here does not. Pressing a chip should never be a surprise.
  //
  // Progress lasts the visit only, which is what session storage is for.
  const [done, setDone] = useState<Set<string>>(new Set());
  /** Labels whose anchor is present on THIS page — so we know which chips look vs. go.
   *  `null` until the first measurement, which is NOT the same as "measured, none present". */
  const [onThisPage, setOnThisPage] = useState<Set<string> | null>(null);

  const markDone = useCallback((label: string) => {
    setDone(prev => {
      if (prev.has(label)) return prev;
      const next = new Set(prev).add(label);
      writeStored(TOUR_DONE_KEY, [...next]);
      return next;
    });
  }, []);

  // Load progress, and settle a chip that was mid-navigation when we left the last page — but ONLY
  // if we actually arrived where that chip was sending us.
  //
  // The first build flushed every pending label on the next route change, whatever the destination.
  // Press two travelling chips quickly, or press one and then navigate somewhere else yourself, and
  // both ticked for beats never seen — which is the same lie the click-ticking had, moved one step
  // later. The pending record now carries its destination and is only redeemed against it.
  useEffect(() => {
    const stored = new Set(readStoredList(TOUR_DONE_KEY));
    const pending = readStoredPending();
    const arrived = pending.filter(p => pathname === p.href || pathname?.startsWith(`${p.href}/`));
    const stillTravelling = pending.filter(p => !arrived.includes(p));

    if (arrived.length > 0) {
      arrived.forEach(p => stored.add(p.label));
      writeStored(TOUR_DONE_KEY, [...stored]);
      writeStored(TOUR_PENDING_KEY, stillTravelling);
    }
    setDone(stored);
  }, [pathname]);

  // Which beats are actually on this page? Re-measured per route, after paint, because the answer
  // decides whether a chip shows its "go" arrow.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOnThisPage(new Set(
        chips.filter(c => c.anchor && document.querySelector(c.anchor)).map(c => c.label),
      ));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chips, pathname]);

  const onChip = useCallback((chip: SandboxTourChip) => {
    const target = chip.anchor ? document.querySelector(chip.anchor) : null;

    if (target) {
      // Always move the page, even when the beat is already visible: a chip that produces no
      // motion at all reads as a broken button. `center` also keeps the target clear of the
      // fixed chrome at the top of the viewport.
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.remove(SPOTLIGHT_CLASS);
      // Force a reflow so the ring restarts when the same chip is pressed twice.
      void (target as HTMLElement).offsetWidth;
      target.classList.add(SPOTLIGHT_CLASS);
      window.setTimeout(() => target.classList.remove(SPOTLIGHT_CLASS), SPOTLIGHT_MS);
      markDone(chip.label); // delivered: it is on screen and ringed
      return;
    }

    if (!chip.href) return;
    // Off-page beat: bank the tick WITH its destination, and let it land only if the visitor
    // actually arrives there.
    const pending = readStoredPending().filter(p => p.label !== chip.label);
    pending.push({ label: chip.label, href: chip.href });
    writeStored(TOUR_PENDING_KEY, pending);
    router.push(chip.href);
  }, [markDone, router]);

  // ── The catch-all ───────────────────────────────────────────────────────────────────────────
  const [toastAt, setToastAt] = useState<number | null>(null);
  useEffect(() => {
    installSandboxFetchWatcher();
    const onBlocked = () => setToastAt(Date.now());
    blockedListeners().add(onBlocked);
    return () => { blockedListeners().delete(onBlocked); };
  }, []);
  useEffect(() => {
    if (toastAt === null) return;
    const id = window.setTimeout(() => setToastAt(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toastAt]);

  return (
    <>
      <div className={styles.chrome} ref={chromeRef} data-sandbox-banner>
        <div className={styles.banner}>
          <span className={styles.eyebrow}>
            <span className={styles.bulb} aria-hidden="true" />
            {/* "Demo", not "sandbox" — sandbox is our word, not a volunteer organizer's
                (/marketing, 2026-08-03). The CODE keeps the sandbox name throughout; this is the
                customer-facing label only. "Live" carries the thing that matters: it is running,
                not recorded. */}
            Live demo
          </span>
          <span className={styles.message}>
            {copy.lead}
            {copy.emphasis ? <> <strong>{copy.emphasis}</strong></> : null}
          </span>
          <span className={styles.reset}>
            {/* Reserve the row even before the first tick so the banner doesn't jump on mount. */}
            {countdown ? `Resets in ${countdown}` : ' '}
          </span>
          <Link href="/auth/signup" className={styles.cta}>Start your own — free</Link>
        </div>

        {chips.length > 0 && (
          <div className={styles.chips}>
            <span className={styles.chipsLabel}>Try this</span>
            {chips.map(chip => {
              // A chip whose beat is on this page points at it; anything else travels. UNTIL the
              // first measurement (`onThisPage === null`) an anchored chip is assumed to be an
              // on-page beat — which is true on the page it was written for. The first build
              // measured against an empty Set instead, so every anchored chip flashed the "go"
              // arrow on load and then dropped it: the exact flicker the comment claimed to avoid.
              const travels = chip.anchor
                ? (onThisPage !== null && !onThisPage.has(chip.label))
                : true;
              const isDone = done.has(chip.label);
              return (
                <button
                  key={chip.label}
                  type="button"
                  className={styles.chip}
                  aria-pressed={isDone}
                  onClick={() => onChip(chip)}
                >
                  <span className={styles.chipNum} aria-hidden="true">{chip.n}</span>
                  {chip.label}
                  {travels && <span className={styles.chipGo} aria-hidden="true">→</span>}
                  {isDone && <span className={styles.chipDone} aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {toastAt !== null && (
        // Never "error", never "failed", never the visitor's fault: the change didn't fail, it was
        // never going to be kept, and the banner said so. Mockup section 5, the Toast shape.
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastText}>
            <strong>Nothing is saved here.</strong> Starting your own tournament is free.
          </span>
          <Link href="/auth/signup" className={styles.toastCta}>Start free →</Link>
        </div>
      )}
    </>
  );
}
