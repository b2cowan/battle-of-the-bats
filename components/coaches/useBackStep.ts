'use client';
import { useEffect } from 'react';
import { useLatestRef } from './useLatestRef';
import { popVerdict, stepOf } from './backStep';

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
 * arrow, X, Save, Escape — consumes the entry, so the stack never grows. The entry has the page's
 * own URL: nothing here is an address, and nothing survives a reload (a station in Run practice
 * still holds nothing between opens).
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
 * would be a press that does nothing. So `replaceState` is wrapped once (the precedent is the rules
 * admin's pushState guard): a same-address replace over a LIVE step's entry carries the marker
 * across. A replace to a different address is a navigation and inherits nothing.
 *
 * ⚠ A BUSY VIEW HOLDS. `onBack` is the consumer's GUARDED, busy-gated closer — this hook never
 * decides whether typed work may be lost (a dirty form asks "Discard?" exactly as it does on
 * Cancel; "Keep editing" leaves the entry standing).
 */

interface Step { seq: number; onBack: () => void }
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

function entryState(seq: number): Record<string, unknown> {
  const cur = window.history.state as Record<string, unknown> | null;
  const data: Record<string, unknown> = { __step: seq };
  // Next's own two keys — the ones its `copyNextJsInternalHistoryState` carries (see above).
  if (cur?.__NA) data.__NA = cur.__NA;
  if (cur?.__PRIVATE_NEXTJS_INTERNALS_TREE) data.__PRIVATE_NEXTJS_INTERNALS_TREE = cur.__PRIVATE_NEXTJS_INTERNALS_TREE;
  return data;
}

function onPop(reg: Registry): void {
  const top = topStep(reg.steps);
  const verdict = popVerdict(stepOf(window.history.state), top?.seq ?? null);
  if (verdict === 'stay') return;
  if (verdict === 'step-back') { window.history.back(); return; }
  // close-top: hold the line first, so "Keep editing" — or a save in flight — leaves the coach
  // exactly where they were, with the entry still standing behind them.
  window.history.pushState(entryState(top!.seq), '');
  top!.onBack();
}

function sameAddress(url: string | URL | null | undefined): boolean {
  if (url == null || url === '') return true;
  try {
    const next = new URL(String(url), window.location.href);
    return next.pathname === window.location.pathname && next.search === window.location.search;
  } catch { return false; }
}

/** Whether the entry the browser is on belongs to a step that is still open. */
function onLiveStep(steps: Step[]): boolean {
  const seq = stepOf(window.history.state);
  return seq !== null && steps.some(s => s.seq === seq);
}

function listen(reg: Registry): void {
  window.addEventListener('popstate', () => onPop(reg));
  const prevReplace = window.history.replaceState.bind(window.history);
  window.history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    const seq = stepOf(window.history.state);
    if (seq !== null && stepOf(data) === null && onLiveStep(reg.steps) && sameAddress(url)) {
      data = { ...((data && typeof data === 'object' ? data : {}) as Record<string, unknown>), __step: seq };
    }
    return prevReplace(data, unused, url);
  };
}

export function useBackStep(active: boolean, onBack: () => void): void {
  const onBackRef = useLatestRef(onBack);
  useEffect(() => {
    if (!active) return;
    const reg = registry();
    const step: Step = { seq: reg.nextSeq++, onBack: () => onBackRef.current() };
    // ⚠ ONE VIEW HANDING OFF TO ANOTHER IN THE SAME COMMIT — the edit form closing and the game's
    // sheet reopening behind it — must not leave the form's entry standing under the sheet's.
    // The closing step has already left the registry (cleanups run before new effects), so the
    // entry the browser is on is a DEAD one: this step takes it over rather than stacking on it.
    const dead = stepOf(window.history.state) !== null && !onLiveStep(reg.steps);
    reg.steps.push(step);
    if (dead) window.history.replaceState(entryState(step.seq), '');
    else window.history.pushState(entryState(step.seq), '');
    return () => {
      const at = reg.steps.indexOf(step);
      if (at >= 0) reg.steps.splice(at, 1);
      // Consume the entry — but only while it is still the current one, and only once the commit
      // has settled: a route pushed on top of it (a link tapped inside the sheet) is not ours to
      // undo, and a step opening in the same commit has taken the entry over (above). `back()` is
      // asynchronous in every browser, so calling it synchronously here would land AFTER that
      // step's own push and pop the wrong entry — the sheet would open and close in one breath.
      setTimeout(() => { if (stepOf(window.history.state) === step.seq) window.history.back(); }, 0);
    };
  }, [active, onBackRef]);
}
