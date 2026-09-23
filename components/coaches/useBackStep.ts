'use client';
import { useEffect, useRef } from 'react';
import { useLatestRef } from './useLatestRef';
import { addressOf, homeOf, popVerdict, stepOf } from './backStep';

/**
 * BACK GOES UP ONE LEVEL (owner, 2026-09-21 — "when I hit the back button it brings me back to
 * the schedule, not back to the game where I came from", and "a swipe back takes me out of the
 * practice rather than back to the drill").
 *
 * The phone's back gesture and the browser's Back button know about PAGES. Every sheet the portal
 * draws — a game's details, the edit form, a money record, a station in Run practice — is drawn ON
 * a page without telling the browser a level opened, so Back skipped every level the coach was
 * standing in and left the page. On a half-typed form it dropped the typing on the floor: the
 * route guard intercepts links and tab-close, never a popstate.
 *
 * While `active`, ONE history entry stands behind this view. Back pops it → `onBack` is asked to
 * go up one level (the same call the view's own back arrow makes); the view's own exit — its
 * arrow, X, Save, Escape — consumes the entry, so the stack never grows.
 *
 * ⚠ A STEP MAY NAME A PLACE (owner, 2026-09-22 — "back from the lineup skips the game"). Given an
 * `address`, the entry carries it in the URL bar as well: the schedule's open game sheet becomes
 * `?event=<id>&tab=<tab>`, the address the page already reopens a game from and already hands the
 * lineup builder as its way back. Without one, Back out of a door INSIDE a sheet could never
 * return to the sheet — the entry left behind said only "a level was open here", which is not a
 * place, so it was stepped over and the coach landed on the bare page (`popVerdict`). The address
 * is written silently: our entries carry Next's internals, which makes its patched
 * `pushState`/`replaceState` hand them straight to the browser — no dispatch, no traverse, no
 * refetch, and `usePathname`/`useSearchParams` are NOT updated by it (the schedule reads
 * `window.location` directly, which is why it may). A step strips its address again as it closes,
 * so a CLOSED sheet never leaves a place behind in the forward stack.
 * ⚠ The address is a consequence of the sheet being open, never a second way to open it: nothing
 * here watches the URL. The page reads it once on mount (its deep link) and that is the whole
 * contract — a step that names a place must be openable from that address on a fresh page.
 *
 * ⚠ THE STACK IS SHARED. Every active step registers here, oldest first; a popstate is answered by
 * the TOP one — a question over a room closes the question, not the room, the same rule the dialog
 * floor applies to a bare Escape. `popVerdict` (pure, pinned) decides what a landing means; the
 * dead-entry case is what keeps a "Back that does nothing" from ever happening after a page was
 * left from inside a sheet.
 *
 * ⚠ NEXT'S ROUTER OWNS THE HISTORY STATE. Its patched `pushState` copies its internals onto any
 * entry pushed here, and its popstate handler RELOADS the page on an entry without them — so the
 * internals are copied explicitly too, for the one commit where a step can open before the
 * router's patch is installed (a sheet open on first paint). With them present the router treats
 * a step entry as its own and a pop onto it as a no-op traverse of the same URL.
 * ⚠⚠ AND IT RE-STAMPS THE CURRENT ENTRY ON EVERY STATE CHANGE — `replaceState({__NA, tree})`, with
 * custom state kept only after a traverse, never after a navigation or a `router.refresh()`. The
 * schedule refreshes after every save, with the game's sheet open on top: the step's marker would
 * be wiped off its own entry, the sheet's exit would find nothing to consume, and the next Back
 * would be a press that does nothing. It re-stamps at the ROUTER's canonical URL, too — which
 * never learnt the address (above), so the same replace would take the game back out of the URL
 * bar. So `replaceState` is wrapped once (the precedent is the rules admin's pushState guard): a
 * replace over a LIVE step's entry carries the marker across and keeps the step's address. A
 * replace aimed somewhere else entirely is a navigation and inherits nothing.
 *
 * ⚠ A BUSY VIEW HOLDS. `onBack` is the consumer's GUARDED, busy-gated closer — this hook never
 * decides whether typed work may be lost (a dirty form asks "Discard?" exactly as it does on
 * Cancel; "Keep editing" leaves the entry standing).
 */

interface Step {
  seq: number;
  onBack: () => void;
  /** `pathname + search` this level answers Back with, or null for a level that names no place. */
  address: string | null;
  /** `pathname + search` of the view BEHIND it — what the entry reverts to as the step closes. */
  home: string;
}
/**
 * The registry lives on `window`, not in module scope: the dev server re-evaluates this module on
 * a hot reload, and a second copy with its own empty list would read every live entry as a dead
 * one and step the coach back off it. One registry per document, first module in wins.
 */
interface Registry { steps: Step[]; nextSeq: number }
const REGISTRY_KEY = '__coachBackSteps';
function registry(): Registry {
  const w = window as unknown as Record<string, Registry | undefined>;
  if (!w[REGISTRY_KEY]) {
    w[REGISTRY_KEY] = { steps: [], nextSeq: 1 };
    listen(w[REGISTRY_KEY]);
  }
  return w[REGISTRY_KEY];
}

function topStep(steps: Step[]): Step | null {
  let top: Step | null = null;
  for (const s of steps) if (!top || s.seq > top.seq) top = s;
  return top;
}

/** Where the browser is, in the one spelling every address here is compared in. */
function here(): string {
  return window.location.pathname + window.location.search;
}

/** The same spelling for a `pushState`/`replaceState` target, or null when it names no URL. */
function addressString(url: string | URL | null | undefined): string | null {
  if (url == null || url === '') return null;
  try {
    const next = new URL(String(url), window.location.href);
    return next.pathname + next.search;
  } catch { return null; }
}

/** The step whose entry the browser is standing on, or null (a page entry, or a dead one). */
function liveStep(steps: Step[]): Step | null {
  const seq = stepOf(window.history.state);
  return seq === null ? null : steps.find(s => s.seq === seq) ?? null;
}

/** Our own keys — what a step writes onto its entry, and what a re-stamp must carry across. */
function markers(step: Step): Record<string, unknown> {
  const data: Record<string, unknown> = { __step: step.seq, __stepHome: step.home };
  if (step.address) data.__stepAt = step.address;
  return data;
}

/** Next's two keys, copied off the current entry — see the header. */
function nextInternals(): Record<string, unknown> {
  const cur = window.history.state as Record<string, unknown> | null;
  const data: Record<string, unknown> = {};
  if (cur?.__NA) data.__NA = cur.__NA;
  if (cur?.__PRIVATE_NEXTJS_INTERNALS_TREE) data.__PRIVATE_NEXTJS_INTERNALS_TREE = cur.__PRIVATE_NEXTJS_INTERNALS_TREE;
  return data;
}

function entryState(step: Step): Record<string, unknown> {
  return { ...markers(step), ...nextInternals() };
}

/** A new level: one entry, at this step's address — or at none, which keeps the page's own URL. */
function pushStep(step: Step): void {
  window.history.pushState(entryState(step), '', step.address ?? null);
}

/**
 * Re-stamp the entry the browser is ON as this step's — taking a dead one over, following an
 * address that changed, or (with the address cleared) handing it back as the step closes. A step
 * that names no place lands on `home`, which for it is the URL it was standing on all along.
 */
function restampStep(step: Step): void {
  window.history.replaceState(entryState(step), '', step.address ?? step.home);
}

function onPop(reg: Registry): void {
  const top = topStep(reg.steps);
  const landed = window.history.state;
  const verdict = popVerdict(stepOf(landed), top?.seq ?? null, addressOf(landed) !== null);
  if (verdict === 'stay') return;
  if (verdict === 'step-back') { window.history.back(); return; }
  // close-top: hold the line first, so "Keep editing" — or a save in flight — leaves the coach
  // exactly where they were, with the entry still standing behind them (and, for a step that
  // names a place, with its address back in the URL bar).
  pushStep(top!);
  top!.onBack();
}

function listen(reg: Registry): void {
  window.addEventListener('popstate', () => onPop(reg));
  const prevReplace = window.history.replaceState.bind(window.history);
  window.history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    // ⚠ EVERY `replaceState` IN THE APP COMES THROUGH HERE, for the life of the document, and
    // Next's router re-stamps on every state change — so the cheap checks come first and the URL
    // is only PARSED once a step is actually standing on the entry being replaced.
    const step = liveStep(reg.steps);
    if (step && stepOf(data) === null) {
      // The router's re-stamp, or any other replace landing on this step's own entry — see the
      // header. `step.home` is the third case: the re-stamp carries the router's canonical URL,
      // which is the page's address, because the router never learnt this step's.
      const target = addressString(url);
      if (target === null || target === here() || target === step.home) {
        data = { ...((data && typeof data === 'object' ? data : {}) as Record<string, unknown>), ...markers(step) };
        if (step.address) url = step.address;
      }
    }
    return prevReplace(data, unused, url);
  };
}

export function useBackStep(active: boolean, onBack: () => void, address?: string | null): void {
  const onBackRef = useLatestRef(onBack);
  const addressRef = useLatestRef(address ?? null);
  const stepRef = useRef<Step | null>(null);
  useEffect(() => {
    if (!active) return;
    const reg = registry();
    // ⚠ ONE VIEW HANDING OFF TO ANOTHER IN THE SAME COMMIT — the edit form closing and the game's
    // sheet reopening behind it — must not leave the form's entry standing under the sheet's.
    // The closing step has already left the registry (cleanups run before new effects), so the
    // entry the browser is on is a DEAD one: this step takes it over rather than stacking on it.
    const landed = window.history.state;
    const dead = stepOf(landed) !== null && liveStep(reg.steps) === null;
    const step: Step = {
      seq: reg.nextSeq++,
      onBack: () => onBackRef.current(),
      address: addressRef.current,
      // Taking a dead entry over inherits the view BEHIND it: the URL showing right now belongs to
      // the step that just left, so reading `here()` would make the old sheet this one's home.
      home: (dead ? homeOf(landed) : null) ?? here(),
    };
    stepRef.current = step;
    reg.steps.push(step);
    if (dead) restampStep(step);
    else pushStep(step);
    return () => {
      stepRef.current = null;
      const at = reg.steps.indexOf(step);
      if (at >= 0) reg.steps.splice(at, 1);
      // ⚠ THE ADDRESS GOES BACK NOW, NOT ON THE TIMER (`/review` concurrency lens, 2026-09-22).
      // A sheet the coach CLOSED must not leave a place behind in the forward stack: a Forward
      // press would land on an address naming a game that is not open, and the page — never
      // unmounted — would not reopen it. Stripping it in the timer below left a window in which a
      // second popstate could move the browser off this entry, and the guarded timer would then
      // abandon the entry ADDRESSED. Here the browser has not moved yet, so the guard is the same
      // question it has always been: walking OUT of the page through one of the sheet's own doors
      // has already left this entry behind, and that entry KEEPS its address — the whole point.
      if (step.address && stepOf(window.history.state) === step.seq) restampStep({ ...step, address: null });
      // Consume the entry — but only while it is still the current one, and only once the commit
      // has settled: a route pushed on top of it (a link tapped inside the sheet) is not ours to
      // undo, and a step opening in the same commit has taken the entry over (above). `back()` is
      // asynchronous in every browser, so calling it synchronously here would land AFTER that
      // step's own push and pop the wrong entry — the sheet would open and close in one breath.
      setTimeout(() => {
        if (stepOf(window.history.state) !== step.seq) return;
        window.history.back();
      }, 0);
    };
  }, [active, onBackRef, addressRef]);

  // The place a step names can change while it stands — the game sheet's tab. Re-stamped in place
  // so Back returns the coach to what they were reading, not to what they opened on. Only while
  // the entry is the current one: a step stacked above owns the URL until it closes.
  useEffect(() => {
    const step = stepRef.current;
    if (!active || !step) return;
    // Nothing to re-stamp on the commit that OPENED this step — it was pushed carrying this very
    // address a moment ago, and writing it again would put every addressed sheet's open through
    // the wrapped `replaceState` for nothing.
    const next = address ?? null;
    if (step.address === next) return;
    step.address = next;
    if (stepOf(window.history.state) !== step.seq) return;
    restampStep(step);
  }, [active, address]);
}
