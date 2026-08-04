'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DemoOrgKind } from '@/lib/demo-org';
import type { DemoLiveBeat } from '@/lib/demo-tournament';
import {
  formatResetCountdown,
  msUntilSandboxReset,
  sandboxBannerCopy,
  sandboxTourSteps,
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
 * v3: v1 ticked chips on click and v2 tracked a per-side chip list. This is a single four-step
 * tour across both sides, so old progress cannot be mapped onto it and must not be inherited.
 */
const TOUR_STATE_KEY = 'flhq_sandbox_tour_v3';

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

interface TourState {
  /** The step the visitor is on, 1-based. */
  current: number;
  /** Steps delivered so far. */
  done: number[];
  /** Which step's sentence the narration strip is showing, if any. */
  narrating: number | null;
  /** A step that navigated and is waiting to arrive — carries where it was going. */
  pending: { n: number; href: string } | null;
}

const EMPTY_TOUR: TourState = { current: 1, done: [], narrating: null, pending: null };

function readTourState(): TourState {
  try {
    const raw = window.sessionStorage.getItem(TOUR_STATE_KEY);
    if (!raw) return EMPTY_TOUR;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    // Shape-check rather than trust: session storage is the visitor's to edit, and a malformed
    // entry must cost progress, never a crash in the chrome that carries the honesty claim.
    return {
      current: typeof parsed.current === 'number' ? parsed.current : 1,
      done: Array.isArray(parsed.done) ? parsed.done.filter(n => typeof n === 'number') : [],
      narrating: typeof parsed.narrating === 'number' ? parsed.narrating : null,
      pending:
        parsed.pending && typeof parsed.pending.n === 'number' && typeof parsed.pending.href === 'string'
          ? { n: parsed.pending.n, href: parsed.pending.href }
          : null,
    };
  } catch {
    return EMPTY_TOUR; // a visitor with storage disabled simply starts the tour each page
  }
}

function writeTourState(state: TourState): void {
  try {
    window.sessionStorage.setItem(TOUR_STATE_KEY, JSON.stringify(state));
  } catch {
    /* nothing here is worth failing a click over */
  }
}

/** Are we standing on the page this step lives on? */
function isOnStepPage(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const router = useRouter();
  const chromeRef = useRef<HTMLDivElement | null>(null);

  // Which half of the product is this? The org layout wraps the public pages AND the admin shell
  // and, being a Server Component, cannot read the pathname — so the side is decided here.
  const side: SandboxSide = pathname?.startsWith(`/${slug}/admin`) ? 'operator' : 'public';
  const copy = sandboxBannerCopy(side);
  const steps = useMemo(
    () => sandboxTourSteps(kind, { slug, landingPath }, { isDemoOrganizer }),
    [kind, slug, landingPath, isDemoOrganizer],
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
  }, [slug]);

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

  // ── The tour ────────────────────────────────────────────────────────────────────────────────
  // `null` until session storage has been read — NOT the same as "the tour hasn't started".
  // Rendering the default first would flash "Step 1 of 4" at a visitor who is on step 3, on every
  // single page they open.
  const [tour, setTour] = useState<TourState | null>(null);

  const update = useCallback((next: TourState) => {
    setTour(next);
    writeTourState(next);
  }, []);

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
    const settle = (target: Element) => target.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  }, []);

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
    current: Math.min(n + 1, Math.max(steps.length, 1)),
    done: state.done.includes(n) ? state.done : [...state.done, n],
    narrating: n,
    pending: null,
  }), [steps.length]);

  // Load progress, and settle a step that was mid-navigation when we left the last page — but ONLY
  // if we actually arrived where it was sending us.
  //
  // The pending record carries its destination and is redeemed only against it. An earlier build
  // flushed every pending label on the next route change whatever the destination, so pressing two
  // travelling steps quickly — or pressing one and then navigating somewhere else — ticked beats
  // that were never seen.
  useEffect(() => {
    const stored = readTourState();
    if (stored.pending && isOnStepPage(pathname, stored.pending.href)) {
      const arrived = stored.pending.n;
      const next = deliver(stored, arrived);
      // Session storage is an external system that exists only on the client, so it cannot be read
      // in a state initializer without either breaking SSR or guaranteeing a hydration mismatch.
      // This is the one-shot read on mount and on arrival, never a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only external read
      update(next);
      // Let the destination paint before reaching for its beat.
      const step = steps.find(s => s.n === arrived);
      if (step) window.requestAnimationFrame(() => ringAnchor(step));
      return;
    }
    setTour(stored);
    // `pathname` is the trigger: this runs on first mount and on every arrival.
  }, [pathname, deliver, update, ringAnchor, steps]);

  const onStep = useCallback((step: SandboxTourStep) => {
    if (!tour) return; // unreachable: the stepper only renders once progress has been read
    if (isOnStepPage(pathname, step.href)) {
      // Already here: deliver in place. The narration strip appearing is the visible change, so
      // this branch is never silent even when the anchor is absent.
      update(deliver(tour, step.n));
      ringAnchor(step);
      return;
    }
    update({ ...tour, pending: { n: step.n, href: step.href } });
    router.push(step.href);
  }, [pathname, tour, deliver, update, ringAnchor, router]);

  const jumpTo = useCallback((n: number) => {
    if (!tour) return;
    update({ ...tour, current: n, narrating: null });
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
  const narratedStep = tour?.narrating != null ? steps.find(s => s.n === tour.narrating) ?? null : null;
  const tourComplete = !!tour && steps.length > 0 && tour.done.length >= steps.length;
  // A step that travelled deserves a marked way back. The fan page is the tour's home and the one
  // place every visitor recognises, so that is where "back" means.
  const showBack = narratedStep != null && !isOnStepPage(pathname, landingPath);

  const sinceMs = beat && now != null ? now - beat.lastChangedAtMs : null;
  const untilMs = beat?.nextStartsAtMs != null && now != null ? beat.nextStartsAtMs - now : null;
  const justScored = scoredAt != null && now != null && now - scoredAt < JUST_SCORED_MS;
  // The demo's state is a pure function of the clock, so this is exact rather than a guess — which
  // is what makes it worth saying out loud. Waiting for something you've been told is coming is a
  // completely different experience from staring at a number that may never move.
  const nextRunMs = beat?.nextChangeAtMs != null && now != null ? beat.nextChangeAtMs - now : null;

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
            {/* "Replays", not "resets": a stranger reading "resets in 38:45" has no idea what
                resets, or whether it costs them something. Reserve the row even before the first
                tick so the banner doesn't jump on mount. */}
            {countdown ? `Replays in ${countdown}` : ' '}
          </span>
          <Link href="/auth/signup" className={styles.cta}>Start your own — free</Link>
        </div>

        {steps.length > 0 && tour && (
          <div className={styles.stepper}>
            <span className={styles.stepperLabel}>Guided tour</span>
            <span className={styles.stepCount}>
              {tourComplete ? 'Done' : `Step ${tour.current} of ${steps.length}`}
            </span>

            {/* The standing proof that the demo is running, between the score changes. */}
            {beat && sinceMs != null && (
              <span
                className={[
                  styles.pill,
                  beat.kind === 'between' ? styles.pillSeam : '',
                  justScored ? styles.pillScored : '',
                ].filter(Boolean).join(' ')}
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
              // The one dead end that should sell. Every other surface offers the CTA; the end of
              // the tour is where a convinced visitor actually is.
              <Link href="/auth/signup" className={styles.stepGo}>Start your own — free →</Link>
            ) : currentStep ? (
              <button type="button" className={styles.stepGo} onClick={() => onStep(currentStep)}>
                {currentStep.label} →
              </button>
            ) : null}
          </div>
        )}

        {narratedStep && (
          // The core of the redesign: what just happened, said in words, in the place the visitor
          // just pressed. A ring on a section they are not looking at was never feedback.
          <div className={styles.said} role="status" aria-live="polite">
            <span className={styles.saidTick} aria-hidden="true">✓</span>
            <span className={styles.saidText}>
              {narratedStep.said}
              {/* The payoff for a step whose reward arrives on the tournament's clock rather than
                  on the click. Without this the visitor is told to "keep this page open" and given
                  nothing to watch — which is how a working demo got reported as broken. */}
              {narratedStep.watchesLiveScore && beat?.kind === 'live' && (
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
                ← Back to the tournament
              </button>
            )}
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
