'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DemoOrgKind } from '@/lib/demo-org';
import type { DemoLiveBeat } from '@/lib/demo-tournament';
import { useScrollCollapsed } from '@/lib/use-scroll-collapsed';
import {
  formatResetCountdown,
  msUntilSandboxReset,
  sandboxBackLabel,
  sandboxBannerCopy,
  sandboxMoments,
  sandboxTourSteps,
  SANDBOX_MOMENT_KEYS,
  SANDBOX_SELECT_TOURNAMENT_EVENT,
  SANDBOX_TOURNAMENT_CHANGED_EVENT,
  SANDBOX_TOURNAMENT_DATASET_KEY,
  type SandboxMoment,
  type SandboxMomentKey,
  type SandboxSide,
  type SandboxTourStep,
} from '@/lib/sandbox-chrome';
import styles from './SandboxChrome.module.css';

/**
 * SandboxChrome — the banner, the guided tour, the reset countdown and the blocked-save toast.
 * Mounted by the org shell for demo orgs only, and org-agnostic by construction: the coach
 * sandbox mounts this same component and gets its own steps from `lib/sandbox-chrome.ts`.
 *
 * ── Why this was rebuilt (2026-08-03) ───────────────────────────────────────────────────────
 *
 * The first build was a rail of numbered chips that scrolled to a beat and ringed it. The owner's
 * verdict after using it: *"I don't know what these buttons are supposed to accomplish, they
 * don't seem to do anything."* Measured against the running app, that was literally true. Two of
 * the chips anchored to panels the product removes whenever no game is live — the fan page's Live
 * Now section and the dashboard's Now Playing strip. With the anchor gone each chip fell back to
 * its href, which for both was the page the visitor was already on, so pressing it produced no
 * scroll, no navigation and no feedback at all.
 *
 * Three things changed, and they are the whole design:
 *
 *  1. **Narration, not rings.** Every step now ends in a sentence in the chrome saying what just
 *     happened — where the finger just was, not on a section the visitor isn't looking at. The
 *     strip appearing is itself a visible change, so no step can read as dead again.
 *  2. **One tour across both halves.** Four steps, not two disconnected sets of three, so the
 *     flip into the organizer's seat arrives having watched a score come in as a parent. The
 *     continuity is the sale.
 *  3. **A live pill that proves the demo is running between score changes.** Measured, the score
 *     moves about nine times in the semifinal's eighty-eight minutes; a prospect watching for
 *     ninety seconds usually sees nothing at all. "Changed 1:12 ago" is a claim that re-proves
 *     itself every second without anyone having to wait.
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
 * visitor sees an orphaned tour rail and never sees the promise. The narration strip changes the
 * chrome's height as it appears, which the ResizeObserver below already republishes.
 *
 * ── The claim stands, the guidance yields (2026-08-07) ──────────────────────────────────────
 *
 * Measured on a 390×844 phone on the game-day fan page, this hat was 183px — and the product's own
 * event header and score ticker sit under it, so 357px of an 844px screen was fixed chrome before a
 * word of the demo. Forty-two per cent of the screen spent proving the demo is a demo.
 *
 * The rule that resolves it WITHOUT touching the never-dismissible invariant above: the banner is
 * the honesty claim and never moves; the moments dock and the guided tour are GUIDANCE, and
 * guidance stands down while the visitor is reading the product. Below 640px, scrolling past 64px
 * folds the guidance away and scrolling back expands it — the behaviour every app on the phone
 * already has, which is the point: the demo's whole argument is "this IS the product".
 *
 * ⚠ THE HANDLE IS NOT POLISH — IT IS THE ONLY WAY BACK. Whatever folds the guidance away must
 * offer a visible control that returns it, in the same unit of work. The 2026-08-06 review found
 * the dock hiding itself during a tour step with nothing on screen able to bring it back for the
 * rest of the session: a visitor lost the demo's entire navigation the moment they accepted its
 * invitation. That defect is one `display: none` away at all times on a surface this small.
 */

const SPOTLIGHT_CLASS = 'sandboxSpotlight';
/** Long enough that a visitor who looked away still sees the ring when they look back. */
const SPOTLIGHT_MS = 2400;
const TOAST_MS = 6000;
/**
 * How often the live pill re-asks what is on the field.
 *
 * Ten seconds, not thirty. The whole promise of step one is "keep this open and you'll see it move",
 * so up to half a minute of lag between the run landing and the pill noticing is exactly the wrong
 * place to economise. The endpoint touches no database — it computes the answer from the clock — so
 * the extra polling costs essentially nothing.
 */
const BEAT_POLL_MS = 10_000;
/** How long the pill celebrates a run after it lands. Long enough to catch a glance back. */
const JUST_SCORED_MS = 12_000;
/**
 * v4: the tour grew from four steps to six (the moments dock, Phase 2), and progress gained the
 * dock's own pending/narration records. v3's four-step shape cannot be mapped onto it.
 * (v1 ticked chips on click; v2 tracked a per-side chip list.)
 */
const TOUR_STATE_KEY = 'flhq_sandbox_tour_v4';

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

// ── Tour progress ───────────────────────────────────────────────────────────────────────────

/**
 * What the narration strip is saying — one union, because the strip has ONE voice. Encoding the
 * exclusivity in the type (rather than two nullable fields every transition must remember to
 * null out) is what makes "a step's sentence displaces a moment's" impossible to get wrong.
 */
type StripVoice =
  | { kind: 'step'; n: number }
  | { kind: 'moment'; key: SandboxMomentKey };

/**
 * A press that navigated and is waiting to arrive — carries where it was going, and (for an
 * operator destination) WHICH event's screen counts as arriving. Redeemed only against its own
 * destination, never against the next route change.
 */
type PendingNav =
  | { kind: 'step'; n: number; href: string; slug: string | null }
  | { kind: 'moment'; key: SandboxMomentKey; href: string; slug: string | null };

interface TourState {
  /** The step the visitor is on, 1-based. */
  current: number;
  /** Steps delivered so far. */
  done: number[];
  /** What the strip is narrating, if anything. */
  strip: StripVoice | null;
  /** The one navigation waiting to be delivered, if any. */
  pendingNav: PendingNav | null;
  /**
   * Has the visitor accepted the invitation (pressed "Walk the year")? Distinct from `done`,
   * because the opening press TRAVELS without delivering — the tour is armed at step 1 with no
   * checks yet, a state `done` alone cannot represent. Absent in stored v4 records; reads false.
   */
  started: boolean;
}

const EMPTY_TOUR: TourState = { current: 1, done: [], strip: null, pendingNav: null, started: false };

function isMomentKey(value: unknown): value is SandboxMomentKey {
  return typeof value === 'string' && (SANDBOX_MOMENT_KEYS as readonly string[]).includes(value);
}

/** Shape-check one union member from untrusted storage; anything malformed reads as null. */
function parseStrip(value: unknown): StripVoice | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<StripVoice> & { n?: unknown; key?: unknown };
  if (v.kind === 'step' && typeof v.n === 'number') return { kind: 'step', n: v.n };
  if (v.kind === 'moment' && isMomentKey(v.key)) return { kind: 'moment', key: v.key };
  return null;
}

function parsePendingNav(value: unknown): PendingNav | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { kind?: unknown; n?: unknown; key?: unknown; href?: unknown; slug?: unknown };
  if (typeof v.href !== 'string') return null;
  const slug = typeof v.slug === 'string' ? v.slug : null;
  if (v.kind === 'step' && typeof v.n === 'number') return { kind: 'step', n: v.n, href: v.href, slug };
  if (v.kind === 'moment' && isMomentKey(v.key)) return { kind: 'moment', key: v.key, href: v.href, slug };
  return null;
}

function readTourState(storageKey: string): TourState {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return EMPTY_TOUR;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    // Shape-check rather than trust: session storage is the visitor's to edit, and a malformed
    // entry must cost progress, never a crash in the chrome that carries the honesty claim.
    return {
      current: typeof parsed.current === 'number' ? parsed.current : 1,
      done: Array.isArray(parsed.done) ? parsed.done.filter(n => typeof n === 'number') : [],
      strip: parseStrip(parsed.strip),
      pendingNav: parsePendingNav(parsed.pendingNav),
      started: parsed.started === true,
    };
  } catch {
    return EMPTY_TOUR; // a visitor with storage disabled simply starts the tour each page
  }
}

function writeTourState(storageKey: string, state: TourState): void {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* nothing here is worth failing a click over */
  }
}

/**
 * Are we standing on the page this step lives on?
 *
 * `exact` is opted into per step (see `SandboxTourStep.exactPath`): a prefix match is right when a
 * step owns a section, and wrong when a visitor can reach a page BELOW the step's destination on
 * their own — there, "you're already here" is a lie that makes the button do nothing.
 *
 * A destination may carry a query string (the Money hub addresses its tabs as `?section=…`, so
 * step 4 and the off-season chip are query-addressed since the standalone Money pages became
 * redirects). The pathname must match as before AND every param the destination names must hold
 * its value — standing in the hub on the WRONG tab is not "already here": the panel the sentence
 * describes is hidden, and delivering in place would ring an anchor the visitor cannot see.
 * Params the destination does NOT name are ignored, so season-read or stray params don't block.
 */
function isOnStepPage(
  pathname: string | null,
  search: URLSearchParams | null,
  href: string,
  exact = false,
): boolean {
  if (!pathname) return false;
  const [hrefPath, hrefQuery] = href.split('?');
  const pathOk = exact
    ? pathname === hrefPath
    : pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  if (!pathOk || !hrefQuery) return pathOk;
  for (const [key, value] of new URLSearchParams(hrefQuery)) {
    if (search?.get(key) !== value) return false;
  }
  return true;
}

/** `m:ss` since the score last moved. Unpadded — this is prose ("1:31 ago"), not a scoreboard. */
const formatSince = (ms: number) => formatResetCountdown(ms, false);

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
  /** Is this visitor holding the demo organizer's session? Decides where the operator steps POINT
   *  — straight at the real screens for them, at the door for everybody else. */
  isDemoOrganizer: boolean;
}) {
  const pathname = usePathname();
  // Reactive, unlike window.location: a query-only navigation (a Money-hub tab switch) changes no
  // pathname, and arrival at a query-addressed destination must still settle. Requires a Suspense
  // boundary above (the org layout provides one around this component).
  const searchParams = useSearchParams();
  const router = useRouter();
  const chromeRef = useRef<HTMLDivElement | null>(null);

  // Which half of the product is this? The org layout wraps the public pages AND the admin shell
  // and, being a Server Component, cannot read the pathname — so the side is decided here.
  const side: SandboxSide = pathname?.startsWith(`/${slug}/admin`) ? 'operator' : 'public';
  const copy = sandboxBannerCopy(side, kind);
  const steps = useMemo(
    () => sandboxTourSteps(kind, { slug, landingPath }, { isDemoOrganizer }),
    [kind, slug, landingPath, isDemoOrganizer],
  );
  const moments = useMemo(
    () => sandboxMoments(kind, { slug, landingPath }, { isDemoOrganizer }),
    [kind, slug, landingPath, isDemoOrganizer],
  );

  // ── Which moment is the visitor standing in? ────────────────────────────────────────────────
  // Fan side: the event is named by the URL's second segment. Operator side: the admin half
  // addresses screens by CONTEXT, not URL, so the tournament provider stamps its selection on
  // <html> and announces changes — the dock highlights what is actually being edited, including
  // when the visitor switches through the sidebar's own dropdown.
  const [adminTournamentSlug, setAdminTournamentSlug] = useState<string | null>(null);
  useEffect(() => {
    const read = () =>
      setAdminTournamentSlug(document.documentElement.dataset[SANDBOX_TOURNAMENT_DATASET_KEY] || null);
    read();
    window.addEventListener(SANDBOX_TOURNAMENT_CHANGED_EVENT, read);
    return () => window.removeEventListener(SANDBOX_TOURNAMENT_CHANGED_EVENT, read);
  }, []);

  const activeMoment: SandboxMoment | null = useMemo(() => {
    if (moments.length === 0) return null;
    if (kind === 'coach') {
      // The coach dock's moments are TEAMS, and the URL names the team — no provider contract
      // needed. A page outside any team (the portal root, mid-redirect) highlights nothing.
      return moments.find(m => m.teamId && pathname?.includes(`/teams/${m.teamId}`)) ?? null;
    }
    if (side === 'operator') {
      return moments.find(m => m.tournamentSlug === adminTournamentSlug)
        ?? moments.find(m => m.key === 'game-day')  // the door and the flip both land on game day
        ?? null;
    }
    const eventSegment = pathname?.split('/')[2] ?? '';
    return moments.find(m => m.tournamentSlug === eventSegment) ?? null;
  }, [moments, kind, side, adminTournamentSlug, pathname]);

  /**
   * ── Keep the moment you are STANDING IN on screen ─────────────────────────────────────────
   *
   * The dock scrolls sideways when its chips outrun the viewport, and its scrollbar is hidden by
   * design. Measured on a 390×844 phone with the coach sandbox's five moments: the row is 510px,
   * so 120px sits off the right edge — and the two chips out there were Mid-season (the moment
   * the door lands on) and Season's End. A visitor would arrive to a dock whose highlighted tab
   * they cannot see, which reads as no highlight at all.
   *
   * So the row is scrolled to bring the active chip into the middle whenever it would otherwise
   * be out of sight. It also does the honest second job: with chips clipped at BOTH edges, the
   * row visibly continues in both directions, which is the affordance the hidden scrollbar isn't.
   *
   * ⚠ Deliberately not `scrollIntoView` — on an element inside a horizontally scrolling strip it
   * is free to scroll the PAGE vertically as well, which on arrival would jump a visitor past the
   * banner they are meant to read first. Setting `scrollLeft` can only ever move this one row.
   *
   * ⚠ Layout effect, not `useEffect` (house pattern: `OrgNavSync`, `ChatPanel`,
   * `CoachPortalShell`). A dock's native scroll position on mount is 0 — the far left — so with a
   * post-paint effect the visitor gets one frame of exactly the state this exists to prevent (no
   * highlighted chip anywhere on screen) followed by a visible snap. Measuring before paint means
   * the row simply arrives correct.
   */
  const dockRef = useRef<HTMLDivElement | null>(null);
  const activeMomentRef = useRef<HTMLButtonElement | null>(null);
  // The effect itself lives further down, where the narration state it now depends on exists.

  // ── The countdown ───────────────────────────────────────────────────────────────────────────
  // Starts empty and fills in after mount: the cycle boundary is a function of the wall clock, so
  // rendering it on the server would guarantee a hydration mismatch every single time.
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    // The replay cycle is the TOURNAMENT sandbox's clock. The coach sandbox re-anchors nightly —
    // a "Replays in 38:12" there would be a countdown to nothing, the exact false claim the
    // banner-note slot exists to avoid (its moments all carry their own note instead). No state
    // write needed on this branch: countdown starts null and this effect is its only writer.
    if (kind !== 'tournament') return;
    const paint = () => setCountdown(formatResetCountdown(msUntilSandboxReset(cycleMinutes, Date.now())));
    paint();
    const id = window.setInterval(paint, 1000);
    return () => window.clearInterval(id);
  }, [cycleMinutes, kind]);

  // ── The live pill ───────────────────────────────────────────────────────────────────────────
  // What is on the field, and how long since the score moved. Polled rather than passed as a prop
  // because a visitor sits on one page for minutes: a value baked in at render would freeze while
  // its "N ago" kept climbing, which would make the pill lie about the one thing it exists to
  // prove. `now` ticks every second so the reading counts up between polls.
  const [beat, setBeat] = useState<DemoLiveBeat | null>(null);
  const [now, setNow] = useState<number | null>(null);
  /**
   * When a run landed while the visitor was watching. This is the payoff the whole first step is
   * built around and it used to pass in complete silence — the pill simply held a different number
   * the next time anyone looked. Announcing it is the difference between "this is live" as a claim
   * and as something the visitor saw happen.
   */
  const [scoredAt, setScoredAt] = useState<number | null>(null);
  /** The previous reading, so a run can be told apart from the story simply moving on. */
  const lastBeatRef = useRef<DemoLiveBeat | null>(null);
  /** Set while the tab is hidden: the first reading after returning re-baselines, silently. */
  const skipCelebrationRef = useRef(false);
  /** Monotonic request id — a slow response that lands after a newer one must not overwrite it. */
  const beatRequestRef = useRef(0);

  useEffect(() => {
    // The live pill is the tournament sandbox's proof-of-motion; the coach sandbox has no ticking
    // score to poll, so it never spends the fetch.
    if (kind !== 'tournament') return;
    let cancelled = false;
    const load = async () => {
      const request = ++beatRequestRef.current;
      try {
        const res = await fetch(`/api/sandbox/live-beat?org=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as DemoLiveBeat;
        // Ignore a response overtaken by a newer one — otherwise a slow reply can put an older
        // score back on screen, on the one element whose whole job is being current.
        if (cancelled || request !== beatRequestRef.current) return;

        /**
         * Announce a RUN — not merely a different reading.
         *
         * Keying on "the score string changed" was wrong in three ways, all of which fire every
         * single cycle: at the semifinal→final handover the reading goes 14–6 → 0–0, at the replay
         * rollover it goes 9–7 → 0–0, and returning to a backgrounded tab shows a score that moved
         * while nobody was watching. Each announced "There it is — now 0–0", which is the exact
         * class of false claim this whole redesign exists to remove.
         *
         * A run is: the same two teams, still playing, with more runs on the board than last time.
         */
        const previous = lastBeatRef.current;
        lastBeatRef.current = data;
        const sameGameStillLive =
          previous !== null &&
          previous.kind === 'live' && data.kind === 'live' &&
          previous.homeName === data.homeName && previous.awayName === data.awayName;
        const scored = sameGameStillLive &&
          data.homeScore + data.awayScore > previous.homeScore + previous.awayScore;

        if (scored && !skipCelebrationRef.current) setScoredAt(Date.now());
        skipCelebrationRef.current = false;

        // Stamped together so the pill's score and its freshness reading can never come from two
        // different instants — and so the clock is seeded from a callback rather than
        // synchronously in the effect body.
        setBeat(data); setNow(Date.now());
      } catch {
        // A demo whose pill is missing is still a working demo; never surface a fetch failure in
        // the chrome that carries the honesty claim.
      }
    };
    // A backgrounded tab has nobody watching the pill, and this runs for as long as a visitor
    // leaves the demo open — a fetch every ten seconds and a re-render of the whole chrome every
    // second, forever. Stop both while hidden and resync on return, so coming back shows the
    // current score rather than a stale one catching up. Starting is guarded on visibility too,
    // so an effect that re-runs while the tab is already hidden stays paused.
    let poll = 0;
    let tick = 0;
    const start = () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
      if (document.hidden) return;
      poll = window.setInterval(load, BEAT_POLL_MS);
      tick = window.setInterval(() => setNow(Date.now()), 1000);
    };

    if (!document.hidden) load();
    start();

    const onVisibility = () => {
      if (document.hidden) {
        // Whatever happens next happened off-screen; the reading on return re-baselines quietly.
        skipCelebrationRef.current = true;
        window.clearInterval(poll);
        window.clearInterval(tick);
        return;
      }
      load();
      start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [slug, kind]);

  // ── The geometry ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const node = chromeRef.current;
    if (!node) return;
    const root = document.documentElement;
    root.dataset.sandboxChrome = 'true';
    // Which half the visitor is standing in, published for CSS that must differ between them —
    // notably reclaiming the phone's bottom tab bar, which the demo hides on the fan side (every
    // one of its tabs leaves the sandbox) but not on the operator side, where the admin shell
    // owns that bar and already handles itself.
    root.dataset.sandboxSide = side;

    const publish = () => root.style.setProperty('--sandbox-chrome-h', `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);

    return () => {
      observer.disconnect();
      delete root.dataset.sandboxChrome;
      delete root.dataset.sandboxSide;
      root.style.removeProperty('--sandbox-chrome-h');
    };
  }, [side]);

  /**
   * Has the visitor scrolled far enough that the guidance should stand down?
   *
   * Every width (owner call 2026-08-10, superseding the phones-only 640px gate): four bands of
   * chrome crowd a desktop assessment too. The banner never moves; the handle in it is the way
   * back at all widths.
   */
  const { collapsed: condensed, scrollToTop: showGuidance } = useScrollCollapsed();

  /**
   * The fold must never eat the keyboard. `inert` on the folding layer blurs whatever control the
   * visitor was standing on (a dot, the step button) to nowhere — a silent focus drop, mid-press,
   * for exactly the visitor using a keyboard or screen reader. When the fold fires while focus is
   * inside the layer, focus moves to the handle: the control that brings the guidance back,
   * rendered in the same commit that set `condensed`.
   */
  const guideRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!condensed) return;
    const guide = guideRef.current;
    const active = document.activeElement;
    if (guide && active instanceof HTMLElement && guide.contains(active)) {
      handleRef.current?.focus();
    }
  }, [condensed]);

  // ── The tour ────────────────────────────────────────────────────────────────────────────────
  // `null` until session storage has been read — NOT the same as "the tour hasn't started".
  // Rendering the default first would flash "Step 1 of 4" at a visitor who is on step 3, on every
  // single page they open.
  const [tour, setTour] = useState<TourState | null>(null);

  // Progress is PER SANDBOX. One shared key let a walk between the two demos (a sanctioned path —
  // the doors swap sessions silently) overwrite the other sandbox's strip/pending records, and
  // the day the coach tour ships its own numbered steps a shared key would inherit the
  // tournament's done-list as false progress. Keyed by kind, each demo remembers its own story.
  const tourStorageKey = `${TOUR_STATE_KEY}_${kind}`;

  const update = useCallback((next: TourState) => {
    setTour(next);
    writeTourState(tourStorageKey, next);
  }, [tourStorageKey]);

  /**
   * Ring the step's beat if it happens to be on this page. Supporting act — never the proof.
   *
   * Two pieces of patience, both earned the hard way. The beat a step points at is usually rendered
   * from data the page fetches AFTER it routes, so looking for it on the next frame finds nothing
   * (the bracket, in particular, arrives late). And even once it exists, the page keeps growing for
   * a moment — a single scroll lands the target far from centre, which for the bracket meant a
   * visitor arriving with the thing they were promised half below the fold. So: wait for it to
   * appear, then settle it again once the layout has stopped moving.
   */
  const ringTimersRef = useRef<number[]>([]);

  const ringAnchor = useCallback((step: SandboxTourStep) => {
    // Abandon any ring still in flight. Without this, a visitor who presses two steps quickly (or
    // navigates away mid-retry) leaves a search running that can ring whatever the same selector
    // happens to match on the page they have already moved to.
    ringTimersRef.current.forEach(window.clearTimeout);
    ringTimersRef.current = [];
    if (!step.anchor) return;

    const selector = step.anchor;
    const later = (fn: () => void, ms: number) => ringTimersRef.current.push(window.setTimeout(fn, ms));
    /**
     * Centre a beat that fits; align a tall one to its top.
     *
     * Centring is right for a panel and wrong for a list. Measured on the coach tour's first step:
     * the tryout decision board is 28 rows, and centring it put its top 669px ABOVE the viewport —
     * the visitor arrived staring at candidates 14 through 20, with the card's own title and the
     * "ranked by score" line that the narration is about scrolled off. `scroll-margin-top` on the
     * beat (globals.css) keeps the fixed hat from covering it.
     */
    const settle = (target: Element) => target.scrollIntoView({
      behavior: 'smooth',
      // ⚠ Coach sandbox only. The tournament tour is shipped and approved, and its own tall beat
      // (the playoff bracket) has never been measured under this rule — changing where an approved
      // tour lands, unmeasured, is the sort of quiet regression this whole chrome exists to avoid.
      block: kind === 'coach' && target.getBoundingClientRect().height > window.innerHeight * 0.8
        ? 'start' : 'center',
    });
    let attempts = 0;

    const tryFind = () => {
      const target = document.querySelector(selector);
      if (!target) {
        // ~3 seconds of looking. Beyond that the beat genuinely isn't on this page, and the
        // narration has already delivered the step on its own.
        if (attempts++ < 12) later(tryFind, 250);
        return;
      }
      settle(target);
      target.classList.remove(SPOTLIGHT_CLASS);
      // Force a reflow so the ring restarts when the same step is delivered twice.
      void (target as HTMLElement).offsetWidth;
      target.classList.add(SPOTLIGHT_CLASS);
      // Re-centre once the rest of the page has finished arriving.
      later(() => settle(target), 600);
      later(() => target.classList.remove(SPOTLIGHT_CLASS), SPOTLIGHT_MS);
    };

    tryFind();
    // `kind` decides the scroll alignment for a tall beat (see `settle`) — a prop, stable for the
    // life of the mount, but a dependency all the same so the closure can never go stale.
  }, [kind]);

  // And drop them whenever the page changes, not just on unmount. This component is mounted once by
  // the org shell and survives every client-side navigation inside the demo, so a search still
  // retrying when the visitor leaves under their own steam would keep hunting — and could scroll
  // and ring whatever the same selector happens to match on the page they moved to.
  useEffect(() => () => {
    ringTimersRef.current.forEach(window.clearTimeout);
    ringTimersRef.current = [];
  }, [pathname]);

  /** Mark a step delivered: narrate it, bank it, and move the tour on. */
  const deliver = useCallback((state: TourState, n: number): TourState => ({
    ...state,
    current: Math.min(n + 1, Math.max(steps.length, 1)),
    done: state.done.includes(n) ? state.done : [...state.done, n],
    strip: { kind: 'step', n },
    pendingNav: null,
  }), [steps.length]);

  /** The admin half's current event, read fresh — state can lag the change event by a render. */
  const currentAdminSlug = () =>
    document.documentElement.dataset[SANDBOX_TOURNAMENT_DATASET_KEY] || null;

  /**
   * Has the visitor arrived at this destination? With three events in the org, "arrived" means
   * being on the page AND — for an operator destination — editing the right event: the same
   * admin pathname serving the wrong tournament has not delivered.
   */
  const arrivedAt = (href: string, slug: string | null, exact = false) =>
    isOnStepPage(pathname, searchParams, href, exact) && (slug === null || currentAdminSlug() === slug);

  // Load progress, and settle a press that was mid-navigation when we left the last page — but
  // ONLY if we actually arrived where it was sending us.
  //
  // A pending record carries its destination and is redeemed only against it. An earlier build
  // flushed every pending label on the next route change whatever the destination, so pressing two
  // travelling steps quickly — or pressing one and then navigating somewhere else — ticked beats
  // that were never seen. This settlement runs on BOTH route changes and the provider's
  // tournament-changed announcements (a same-pathname jump changes only the edited event).
  const settleArrivals = useCallback(() => {
    const stored = readTourState(tourStorageKey);
    const nav = stored.pendingNav;
    // A step's arrival is judged by ITS OWN matching rule, looked up rather than stored — so the
    // saved record keeps its shape (no storage version bump) and a step whose rule changes takes
    // effect for a navigation already in flight.
    const pendingStep = nav?.kind === 'step' ? steps.find(s => s.n === nav.n) : undefined;

    if (nav && arrivedAt(nav.href, nav.slug, pendingStep?.exactPath)) {
      if (nav.kind === 'step') {
        update(deliver(stored, nav.n));
        // Let the destination paint before reaching for its beat.
        if (pendingStep) window.requestAnimationFrame(() => ringAnchor(pendingStep));
      } else {
        update({ ...stored, strip: { kind: 'moment', key: nav.key }, pendingNav: null });
      }
      return;
    }

    setTour(stored);
    // arrivedAt closes over pathname and searchParams, which are already dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, deliver, update, ringAnchor, steps, tourStorageKey]);

  // `pathname` (via settleArrivals) is the trigger: first mount and every route arrival.
  // Session storage is an external system that exists only on the client, so it cannot be read in
  // a state initializer without either breaking SSR or guaranteeing a hydration mismatch. This is
  // the one-shot read on mount and on arrival, never a render loop.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only external read
  useEffect(() => { settleArrivals(); }, [settleArrivals]);
  // And the provider's announcement is the second trigger, for jumps that change only the
  // edited tournament while the pathname stays put (e.g. Teams screen → Teams screen).
  useEffect(() => {
    const onChanged = () => settleArrivals();
    window.addEventListener(SANDBOX_TOURNAMENT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SANDBOX_TOURNAMENT_CHANGED_EVENT, onChanged);
  }, [settleArrivals]);

  /** Navigate to an operator screen, pinning WHICH event it should be editing. */
  const goToOperatorScreen = useCallback((href: string, tournamentSlug: string | null) => {
    router.push(tournamentSlug ? `${href}?tournamentSlug=${encodeURIComponent(tournamentSlug)}` : href);
    if (tournamentSlug) {
      // The URL param only resolves on a full load; the live provider listens for this instead.
      window.dispatchEvent(new CustomEvent(SANDBOX_SELECT_TOURNAMENT_EVENT, {
        detail: { slug: tournamentSlug },
      }));
    }
  }, [router]);

  const onStep = useCallback((step: SandboxTourStep) => {
    if (!tour) return; // unreachable: the stepper only renders once progress has been read
    const slug = step.tournamentSlug ?? null;
    if (arrivedAt(step.href, slug, step.exactPath)) {
      // Already here: deliver in place. The narration strip appearing is the visible change, so
      // this branch is never silent even when the anchor is absent.
      update(deliver(tour, step.n));
      ringAnchor(step);
      return;
    }
    update({ ...tour, pendingNav: { kind: 'step', n: step.n, href: step.href, slug } });
    goToOperatorScreen(step.href, slug);
    // arrivedAt closes over pathname and searchParams, which are already dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, tour, deliver, update, ringAnchor, goToOperatorScreen]);

  /**
   * The invitation's press: travel to the SEASON'S start and deliver no step (owner calls,
   * 2026-08-10, two rounds).
   *
   * Round one delivered step 1 on this press, which read as "step 1 is skipped": one press
   * produced a row already claiming step 2 and a check the visitor never chose. Round two armed
   * the tour on step 1's own page — and that collapsed the walk's first two presses into the same
   * screen, so step 1's button appeared to do nothing ("the data is the same").
   *
   * So the opening press is the Tryout day chip wearing the tour's handle: it lands on the
   * moment's front door (the mid-flight scoring board) with that moment's own arrival sentence,
   * and arms the tour at "Step 1 of 7", unchecked. Step 1's press then travels one level deeper
   * to the ranked board — the walk's every press changes the screen, and the "one level deeper
   * than the chip" rule now covers the opening too.
   */
  const startWalk = useCallback(() => {
    if (!tour) return;
    const armed = { ...tour, started: true, current: 1 };
    const first = moments[0];
    if (!first) { update({ ...armed, strip: null, pendingNav: null }); return; }
    const target = side === 'operator' ? first.operatorPath : first.fanPath;
    // exact=true + query-aware: a destination may be a hub TAB (`?section=…`), where the raw
    // pathname comparison is always false and the press becomes a silent no-op (caught in review).
    if (isOnStepPage(pathname, searchParams, target, true)) {
      update({ ...armed, strip: { kind: 'moment', key: first.key }, pendingNav: null });
      return;
    }
    update({ ...armed, strip: null, pendingNav: { kind: 'moment', key: first.key, href: target, slug: null } });
    goToOperatorScreen(target, null);
  }, [pathname, searchParams, tour, moments, side, update, goToOperatorScreen]);

  /** A dock press: same jumps as tour steps 5–6, wearing the self-serve handle. */
  const onMoment = useCallback((moment: SandboxMoment) => {
    if (!tour) return;
    const target = side === 'operator' ? moment.operatorPath : moment.fanPath;
    // Only a real operator screen can be pinned to an event — the door (the non-organizer
    // fallback) takes no tournament and hands out its own session flow.
    const navSlug = side === 'operator' && target.startsWith(`/${slug}/`) ? moment.tournamentSlug ?? null : null;
    // "Already standing in it" means THIS page exactly — not any page of the moment. Prefix
    // matching here made "Game day" a silent no-op from the Classic's own subpages: a visitor on
    // /standings was told "Back to game day" while nothing moved, which is precisely the false
    // claim this chrome exists to remove (caught in review). A subpage press navigates home.
    // Query-aware (exact=true) because a destination may be a hub TAB (`?section=…`) — a raw
    // pathname comparison is always false there, making the chip press the same silent no-op
    // from the OTHER direction (caught in review, 2026-08-13).
    const here = isOnStepPage(pathname, searchParams, target, true)
      && (navSlug === null || currentAdminSlug() === navSlug);
    if (here) {
      update({ ...tour, strip: { kind: 'moment', key: moment.key }, pendingNav: null });
      return;
    }
    update({ ...tour, pendingNav: { kind: 'moment', key: moment.key, href: target, slug: navSlug } });
    goToOperatorScreen(target, navSlug);
  }, [tour, side, slug, pathname, searchParams, update, goToOperatorScreen]);

  const jumpTo = useCallback((n: number) => {
    if (!tour) return;
    // A dot press is a deliberate choice of position, so it also STARTS an unstarted tour.
    // Without this, the press landed in a state the invitation row never shows — and the very
    // next "Walk the year" discarded it silently (2026-08-11 review finding).
    update({ ...tour, current: n, strip: null, started: true });
  }, [tour, update]);

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

  const currentStep = tour ? steps.find(s => s.n === tour.current) ?? null : null;
  // One strip, one voice — the union guarantees at most one of these is non-null.
  const strip = tour?.strip ?? null;

  /**
   * Keep the moment you are STANDING IN on screen — see the note beside `dockRef` above.
   *
   * ⚠ `strip` is a dependency, and it is not decoration. On a narrow screen the dock is
   * `display: none` while the chrome is narrating, and a hidden element reports
   * `clientWidth`/`scrollWidth` of 0 — so every run during a tour walk hits the early return and
   * never moves `scrollLeft`. Without re-running when the narration clears, the dock would come
   * back scrolled to wherever it stood when the walk STARTED, with the team the visitor is now
   * standing in off-screen: precisely the "no highlighted chip anywhere" state this exists to
   * prevent. (Found by the 2026-08-06 review; the dock is hidden for the whole walk, so this was
   * not a corner case.)
   */
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const chip = activeMomentRef.current;
    if (!dock || !chip) return;
    if (dock.scrollWidth <= dock.clientWidth) return; // hidden, or everything already visible
    const offsetLeft = chip.getBoundingClientRect().left - dock.getBoundingClientRect().left + dock.scrollLeft;
    dock.scrollLeft = Math.max(0, offsetLeft - (dock.clientWidth - chip.offsetWidth) / 2);
  }, [activeMoment?.key, moments.length, strip]);
  const narratedStep = strip?.kind === 'step' ? steps.find(s => s.n === strip.n) ?? null : null;
  const jumpMoment = strip?.kind === 'moment' ? moments.find(m => m.key === strip.key) ?? null : null;
  const tourComplete = !!tour && steps.length > 0 && tour.done.length >= steps.length;
  /**
   * Nothing has been pressed yet — the tour's INVITATION state (Phase 3).
   *
   * It answers "does the tour open itself?" with no: a demo that has promised nothing moves while
   * you watch must not move a stranger. It introduces itself once and waits. Coach sandbox only —
   * the tournament tour's opening is already approved and shipped, and changing it here would be
   * a silent edit to a surface nobody asked me to touch.
   *
   * A dock press does NOT end the invitation (owner call 2026-08-10). The door lands on Mid-season
   * and the walk starts back at Tryout day, so surfacing step 1's beat ("See how 28 kids got
   * ranked") after a season jump read as a non-sequitur beside a Mid-season highlight. The
   * invitation stands until the visitor accepts it — `started`, set by the invitation's own press
   * (which travels to step 1 without delivering it; see `startWalk`).
   */
  const tourUntouched = kind === 'coach' && !!tour && tour.done.length === 0 && !tour.started;
  // A step that travelled deserves a marked way back — on the TOURNAMENT side, where "back" names
  // a real place: game day's fan page, the tour's home and the one page every visitor recognises.
  // The coach walk spans five teams and has no such home, so its generic "Back to the demo" named
  // nowhere and, pressed mid-walk, yanked the visitor to the Mid-season overview with no framing.
  // Cut (owner call 2026-08-10); the sentence's ✕ and the season dock are the coach demo's ways
  // onward.
  const showBack = kind === 'tournament'
    && (narratedStep != null || jumpMoment != null) && !isOnStepPage(pathname, searchParams, landingPath);

  /**
   * Which of the tour's three states we are in, decided ONCE.
   *
   * Two places need it and they need different words for it — the stepper's own line ("Done" / "The
   * season, guided" / "Step 2 of 6") and the condensed handle ("2/6" / "Tour"). Classifying twice
   * meant a fourth state, or any change to what "in progress" means, had to be found in two places
   * that never mention each other.
   *
   * `'active'` is the only one that can name a position: "6/6" reads as a score and "0/6" as a
   * scolding, so the other two fall back to a word.
   */
  const tourPhase: 'none' | 'done' | 'untouched' | 'active' =
    !tour || steps.length === 0 ? 'none'
      : tourComplete ? 'done'
        : tourUntouched ? 'untouched'
          : 'active';

  const sinceMs = beat && now != null ? now - beat.lastChangedAtMs : null;
  const untilMs = beat?.nextStartsAtMs != null && now != null ? beat.nextStartsAtMs - now : null;
  const justScored = scoredAt != null && now != null && now - scoredAt < JUST_SCORED_MS;
  // The demo's state is a pure function of the clock, so this is exact rather than a guess — which
  // is what makes it worth saying out loud. Waiting for something you've been told is coming is a
  // completely different experience from staring at a number that may never move.
  const nextRunMs = beat?.nextChangeAtMs != null && now != null ? beat.nextChangeAtMs - now : null;

  return (
    <>
      {/* data-kind picks the coat: the tournament chrome is dark over the dark admin world; the
          coach chrome is warm over the warm portal (approved mockups 2026-08-04) — same bones,
          same behavior, different palette. */}
      {/* data-narrating publishes WHETHER the strip is speaking, so the narrow-screen rules can
          stand the dock down while it is. Four rows of chrome (banner + dock + stepper + sentence)
          measured 226px on a 390px phone — a quarter of the screen before the portal's own header
          — and the sentence always names the moment anyway, so the dock is the row that gives. */}
      <div className={styles.chrome} ref={chromeRef} data-sandbox-banner data-kind={kind}
        data-narrating={strip ? 'true' : undefined}
        data-condensed={condensed ? 'true' : undefined}>
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
            {/* The lead is its own element so a narrow screen can drop it and keep the half that
                matters. The bold clause is the honesty claim and is never the part that gives. */}
            <span className={styles.messageLead}>{copy.lead}</span>
            {copy.emphasis ? (
              <>
                {' '}
                <strong>
                  {/* Two spellings of one claim; the stylesheet picks by width, and the SHORT one
                      is what a phone's two-column banner has room for. They are a pair — the full
                      form only stands down where a short form exists to replace it. */}
                  <span className={styles.claimFull}>{copy.emphasis}</span>
                  {copy.emphasisShort ? (
                    <span className={styles.claimShort}>{copy.emphasisShort}</span>
                  ) : null}
                </strong>
              </>
            ) : null}
          </span>
          <span className={styles.reset}>
            {/* "Replays", not "resets": a stranger reading "resets in 38:45" has no idea what
                resets, or whether it costs them something. Reserve the row even before the first
                tick so the banner doesn't jump on mount. In the two still moments this slot tells
                THAT moment's truth instead — a visitor at a finished event must never read a
                countdown that belongs to the Summer Classic's replay loop. */}
            {activeMoment?.bannerNote ?? (countdown ? `Replays in ${countdown}` : ' ')}
          </span>
          {/* One right-hand slot, so the phone's two-column banner has a single thing to pin.
              On a desktop this is simply the CTA where it has always been. */}
          <span className={styles.bannerActions}>
            {/* ⚠ The way back. Rendered ONLY while the guidance is folded away, and it carries the
                tour's position rather than a generic word, so it says what it will give back.
                See the header note: a fold with no visible handle cost a visitor the demo's whole
                navigation once already. */}
            {condensed && (steps.length > 0 || moments.length > 0) && (
              <button
                type="button"
                ref={handleRef}
                className={styles.handle}
                aria-expanded={false}
                aria-label={tourPhase === 'active'
                  ? `Show the guided tour and moments — step ${tour!.current} of ${steps.length}`
                  : 'Show the guided tour and moments'}
                onClick={showGuidance}
              >
                {tourPhase === 'active' ? `${tour!.current}/${steps.length}` : 'Tour'}
                <span className={styles.handleChev} aria-hidden="true">▾</span>
              </button>
            )}
            <Link href="/auth/signup" className={styles.cta}>{copy.cta}</Link>
          </span>
        </div>

        {/* The guidance layer — what it holds and why it may fold is documented once, on `.guide`
            in SandboxChrome.module.css, next to the animation that does it.

            `inert` is the half that cannot live in CSS: an element at zero height with overflow
            hidden is still in the tab order, so without this a visitor tabbing through a condensed
            page would land on invisible controls. */}
        <div className={styles.guide} inert={condensed} ref={guideRef}>
          <div className={styles.guideInner}>

        {moments.length > 0 && (
          // The moments dock (Phase 2): the year as tabs. Plain navigation — same demo, same
          // session, a different event or team of the same association — with the active moment
          // underlined and Game day carrying the only live dot, because it is the only moment
          // that moves.
          <div ref={dockRef} className={styles.dock} role="group" aria-label={copy.dockAriaLabel}>
            <span className={styles.dockLabel}>{copy.dockLabel}</span>
            {moments.map(moment => (
              <button
                key={moment.key}
                type="button"
                ref={activeMoment?.key === moment.key ? activeMomentRef : undefined}
                className={styles.moment}
                aria-current={activeMoment?.key === moment.key ? 'true' : undefined}
                onClick={() => onMoment(moment)}
              >
                <span className={styles.momentLabel}>
                  {moment.isLive && <span className={styles.momentLive} aria-hidden="true" />}
                  {moment.label}
                </span>
                <span className={styles.momentSub}>{moment.sub}</span>
              </button>
            ))}
          </div>
        )}

        {steps.length > 0 && tour && (
          <div className={styles.stepper}>
            <span className={styles.stepperLabel}>Guided tour</span>
            <span className={styles.stepCount}>
              {/* The counter tracks the next step to take, advancing the moment a step delivers —
                  in agreement with the dots and the button. It can never read ahead of what the
                  visitor has pressed, because the invitation press arms the tour at step 1
                  without delivering it (see startWalk). */}
              {tourPhase === 'done' ? 'Done'
                : tourPhase === 'untouched' ? 'The season, guided'
                : `Step ${tour.current} of ${steps.length}`}
            </span>

            {/* The standing proof that the demo is running, between the score changes. */}
            {beat && sinceMs != null && (
              <span
                className={[
                  styles.pill,
                  beat.kind === 'between' ? styles.pillSeam : '',
                  justScored ? styles.pillScored : '',
                ].filter(Boolean).join(' ')}
                /* Which claim this pill is making, so the stylesheet can stand the REPEATED one
                   down where the product's own ticker already makes it, and keep the one the
                   ticker cannot make ("between games, final in 4:12"). */
                data-beat={beat.kind}
                title={beat.kind === 'between'
                  ? 'The semifinal has ended and the final has not started yet.'
                  : `${beat.label} in progress`}
              >
                <span className={styles.pillBulb} aria-hidden="true" />
                {beat.kind === 'between' ? (
                  <>
                    <span className={styles.pillScore}>Between games</span>
                    <span className={styles.pillFresh}>
                      {untilMs != null && untilMs > 0 ? `final in ${formatSince(untilMs)}` : 'final about to start'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.pillScore}>
                      <span className={styles.pillTeam}>{beat.homeName}</span>
                      {' '}{beat.homeScore}–{beat.awayScore}{' '}
                      <span className={styles.pillTeam}>{beat.awayName}</span>
                    </span>
                    <span className={styles.pillFresh}>
                      {justScored ? 'just scored' : `changed ${formatSince(sinceMs)} ago`}
                    </span>
                  </>
                )}
              </span>
            )}

            <span className={styles.dots}>
              {steps.map(step => (
                <button
                  key={step.n}
                  type="button"
                  className={styles.dot}
                  aria-current={step.n === tour.current && !tourComplete ? 'step' : undefined}
                  data-done={tour.done.includes(step.n) ? 'true' : undefined}
                  aria-label={`Step ${step.n}: ${step.label}${tour.done.includes(step.n) ? ' (done)' : ''}`}
                  onClick={() => jumpTo(step.n)}
                >
                  {tour.done.includes(step.n) ? '✓' : step.n}
                </button>
              ))}
            </span>

            {tourComplete ? (
              // A finished tour offers a second lap, not a second pitch (owner call 2026-08-10).
              // The banner's signup CTA is pinned on screen at every moment including this one, so
              // a copy of it here was asking twice within 40px — and it left the tour a dead end
              // for the rest of the session (the dots stop rendering a control once complete).
              // Restart clears the checks; revisiting a single step never does — the visitor HAS
              // seen it, and the demo never claims otherwise.
              <button type="button" className={styles.restart} onClick={() => update(EMPTY_TOUR)}>
                ↺ Walk it again
              </button>
            ) : currentStep ? (
              <button
                type="button"
                className={styles.stepGo}
                onClick={() => (tourUntouched ? startWalk() : onStep(currentStep))}
              >
                {/* The opening press names the WHOLE walk, not its first beat. "See how 28 kids got
                    ranked" is a fine second sentence and a poor invitation: it offers a feature
                    where the tour is offering a season. It travels to the walk's start and delivers
                    nothing (see startWalk); every press after it names its beat and delivers it. */}
                {tourUntouched ? 'Walk the year' : currentStep.label} →
              </button>
            ) : null}
          </div>
        )}

          </div>
        </div>

        {(narratedStep || jumpMoment) && (
          // The core of the redesign: what just happened, said in words, in the place the visitor
          // just pressed. A ring on a section they are not looking at was never feedback. Dock
          // jumps share the strip — one voice — and their sentences always name the time first,
          // because the thing that just changed is WHEN the visitor is standing.
          //
          // ⚠ DELIBERATELY OUTSIDE THE FOLDING LAYER. It sat inside it for one build, and that
          // quietly destroyed the thing this chrome was rebuilt for. The sequence: press a step →
          // the strip is written → `ringAnchor` smooth-scrolls the page to the step's target →
          // those programmatic scroll events are indistinguishable from a visitor's, so the fold
          // fired → the sentence explaining what just happened folded to zero height AND went
          // `inert`, so `aria-live` never announced it either. The visitor arrived at the
          // spotlighted thing with no idea why, which is precisely the "these buttons don't seem to
          // do anything" verdict the narration exists to answer.
          //
          // The rule that falls out, and it is the honest split: the banner is the CLAIM, the dock
          // and the tour are NAVIGATION and may stand down, and this is a RESPONSE to something the
          // visitor just did. A response does not get out of the way of the action that caused it.
          <div className={styles.said} role="status" aria-live="polite">
            <span className={styles.saidTick} aria-hidden="true">✓</span>
            <span className={styles.saidText}>
              {narratedStep ? narratedStep.said
                : side === 'operator' ? (jumpMoment!.saidOperator ?? jumpMoment!.said) : jumpMoment!.said}
              {/* The payoff for a step whose reward arrives on the tournament's clock rather than
                  on the click. Without this the visitor is told to "keep this page open" and given
                  nothing to watch — which is how a working demo got reported as broken. */}
              {narratedStep?.watchesLiveScore && beat?.kind === 'live' && (
                justScored ? (
                  <strong className={styles.saidNow}>
                    {' '}There it is — now {beat.homeScore}–{beat.awayScore}.
                  </strong>
                ) : nextRunMs != null && nextRunMs > 0 ? (
                  <span className={styles.saidWait}>
                    {' '}Next run in about <strong>{formatSince(nextRunMs)}</strong>
                    {/* Under two minutes it is worth waiting for; beyond that, telling somebody to
                        wait is telling them to leave. Measured gaps run four to seven minutes. */}
                    {nextRunMs <= 120_000 ? ' — watch it land.' : ' — carry on, and it will flag itself.'}
                  </span>
                ) : null
              )}
            </span>
            {showBack && (
              <button
                type="button"
                className={styles.saidBack}
                onClick={() => router.push(landingPath)}
              >
                {sandboxBackLabel(kind)}
              </button>
            )}
            {/**
              * Dismiss the sentence — and, on a phone, get the moments dock back.
              *
              * ⚠ This is not tidiness, it is the only way out. Below 640px the dock stands down
              * while the strip is speaking, and the strip is only ever cleared by pressing a
              * numbered dot — which that same breakpoint hides. Measured on a 390px screen: after
              * the first tour step the dock was gone and NOTHING on screen could bring it back for
              * the rest of the session, so a visitor lost the demo's whole navigation the moment
              * they accepted its invitation. (2026-08-06 review.)
              *
              * Rendered at every width, because a sentence you have finished reading should be
              * dismissible on a desktop too; it is simply load-bearing on a phone.
              */}
            <button
              type="button"
              className={styles.saidDismiss}
              aria-label="Dismiss this note and show the moments again"
              onClick={() => tour && update({ ...tour, strip: null })}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {toastAt !== null && (
        // Never "error", never "failed", never the visitor's fault: the change didn't fail, it was
        // never going to be kept, and the banner said so. Mockup section 5, the Toast shape.
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastText}>
            <strong>Nothing is saved here.</strong> {copy.toastText}
          </span>
          <Link href="/auth/signup" className={styles.toastCta}>Start free →</Link>
        </div>
      )}
    </>
  );
}
