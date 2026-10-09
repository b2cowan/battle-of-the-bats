'use client';
import { useEffect, useRef } from 'react';
import { useLatestRef } from './useLatestRef';
import { addressOf, clickLeavesPage, createPressGate, homeOf, popVerdict, reentryLanding, stepOf, type PressGate } from './backStep';

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
 *
 * ⚠⚠ A TAP THAT CLOSES A STEP MAY ALSO BE A TAP ON A LINK — and then the entry is NOT consumed
 * (§239 walk, 2026-09-25). A menu that holds a step closes on an outside POINTER-DOWN (the lineup
 * builder's Print and row menus sit over a lit bottom bar, by the drawer-layers ruling). Consuming
 * the entry the moment the menu closed put a `history.back()` between that press and its click: the
 * router was mid-traversal when the Schedule link asked to navigate, and the tap did nothing — the
 * history read `back → popstate → replace`, no push. So an exit taken during a press is HELD until
 * the press's click has been dispatched, and when that click left the page (`clickLeavesPage`, read
 * in the BUBBLE phase so a click the unsaved-changes guard stopped does not count) the entry is left
 * for the navigation to push over — a dead entry `popVerdict` steps over on the way back, exactly
 * what a link tapped INSIDE the sheet has always left. The rules of the hold, and why each one
 * exists, live with `createPressGate` in `backStep.ts`, where they are unit-tested as event sequences.
 * ⚠⚠ …AND IT IS READ ON `document`, NEVER `window` (§258 walk, 2026-10-02 — "Open Player Dues just
 * closes the window and keeps me on the Ledger"). A door INSIDE a floor that closes the floor as it
 * is clicked is this same tap: the close is the exit, the click is the navigation. But nearly every
 * floor's panel calls React's `stopPropagation()` on a click (QuestionShell, RoomShell, the month
 * grid), React delegates from `document` in the App Router, and a React stop is a native stop AT
 * `document` — so a `window` listener never heard the door, the exit ran `history.back()`, and the
 * router dropped the navigation mid-traversal. Every door of that shape had been dead since this
 * hook shipped. On `document` the listener is a SIBLING of React's own, which no `stopPropagation`
 * can silence; the unsaved-changes guard stops its click in the CAPTURE phase, before the event
 * reaches the target, so that click still never counts as leaving.
 * ⚠ WHILE HELD, THE ENTRY KEEPS ITS MARKER. A closing step is out of `steps` (Back must not answer to
 * it) but in `closing` until its exit settles, and the `replaceState` wrapper keeps the marker for
 * either — otherwise a router re-stamp inside the hold wiped it, the exit found nothing to consume,
 * and the next Back did nothing (/review, 2026-09-25).
 * ⚠ A button that navigates by `router.push`, or a link whose own handler stops the click, is not
 * seen as leaving; every door in the portal's chrome is a plain link, which is the case this covers.
 * ⚠ TWO STEPS MUST NOT MOUNT IN ONE COMMIT (the Schedule deep dive, 2026-09-25). A sheet and a view
 * inside it opened together from one address — `?event=…&tab=attendance` — push two steps at once,
 * and React's dev strict mode tears both down and remounts them: the outer step's second mount then
 * takes over the INNER step's dead entry and inherits its `home`, leaving a dead entry an extra Back
 * has to cross. Arm the inner step one commit later (`viewStepArmed` in `ScheduleEventSheet`) — a
 * general fix in the takeover rule was traced and rejected: it gives a middle step of three the
 * outermost step's home.
 * ⚠ …AND TWO STEPS MAY CLOSE IN ONE COMMIT (`/review`, the same day): the × on a view inside a
 * sheet closes both. The outer step's exit then finds the inner step's entry on top of its own, so
 * it could neither strip its address nor consume it — the inner step's `back()` landed on the
 * outer entry, still ADDRESSED, with the sheet closed, and a reload reopened the game the coach
 * had just closed. The outer step is BURIED instead: when the browser lands on its entry, `onPop`
 * strips the address and steps back once more. Only a step that closed in the same batch counts
 * (the one on top is still `closing`); a page left through a link is `left`, and keeps its entries.
 *
 * ⚠⚠ A BACK IS ANSWERED BY STEPPING FORWARD, NEVER BY A PUSH (owner, §285 W1, 2026-10-09 — "the second
 * closes the window and goes back to a previous page (not the ledger)"). `onPop` used to hold the line by
 * re-pushing the step's entry inside `popstate`, with no user activation. Chrome's history manipulation
 * intervention marks EVERY same-document entry skippable when a document adds an entry without an
 * activation since its last traversal, and the browser's own Back button (and the phone's gesture) then
 * skips them all: Back went up a level, and the next Back jumped past the page under the window, and past
 * every page before it in the app, to whatever came before the app. `history.back()` is exempt, which is
 * why no probe ever saw it. A TRAVERSAL creates no entry, so `onPop` now steps forward onto the step's own
 * entry — still standing right above, since a Back only moved off it — and the level answers when it lands
 * there (`reentry`, `reentryLanding`), in exactly the state the push used to leave. A push survives only as
 * the fallback: nothing to step forward onto, no landing within `REENTRY_WAIT_MS`, a landing somewhere
 * else (a press is answered once, never chased) — and a step that NAMES A PLACE, which the router would
 * hear (see `onPop`; those windows keep Chrome's skip, owed). See
 * https://chromium.googlesource.com/chromium/src/+/main/docs/history_manipulation_intervention.md
 */

/** How long a step forward may take to land before the Back is answered the old way (a push). A same-document
 *  traversal lands in a task or two; this only catches a forward with nowhere to go. */
const REENTRY_WAIT_MS = 600;

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
interface Registry {
  steps: Step[];
  nextSeq: number;
  /** A Back being answered by stepping forward onto this step's entry, and the fallback's timer — see the header. */
  reentry?: { step: Step; timer: number } | null;
  /** Steps that have closed and whose exit is held by the press gate — see the header. */
  closing?: Step[];
  /** Steps that closed UNDER another closing step in the same commit, their entry still to be
   *  consumed when the browser lands on it — see the header. */
  buried?: Step[];
  /** When an exit may run, and whether the tap that closed it left the page (`backStep.ts`). A
   *  registry kept across a hot reload may predate it, so it is attached on first use. */
  gate?: PressGate;
}
const REGISTRY_KEY = '__coachBackSteps';
function registry(): Registry {
  const w = window as unknown as Record<string, Registry | undefined>;
  if (!w[REGISTRY_KEY]) {
    w[REGISTRY_KEY] = { steps: [], nextSeq: 1 };
    listen(w[REGISTRY_KEY]);
  }
  const reg = w[REGISTRY_KEY];
  if (!reg.gate) watchPresses(reg);
  return reg;
}

/** The press gate's five inputs. Capture phase for the press, its end and the click's START — ahead
 *  of any sheet's own outside-press handler; the BUBBLE phase for "this click left the page", so a
 *  click something stopped on the way down (the unsaved-changes guard) is not counted — and on
 *  `document`, where a panel's React `stopPropagation()` cannot reach it (see the header). */
function watchPresses(reg: Registry): void {
  const gate = createPressGate({ set: (run, ms) => window.setTimeout(run, ms), clear: h => window.clearTimeout(h as number) });
  reg.gate = gate;
  reg.closing = [];
  window.addEventListener('pointerdown', () => gate.press(), true);
  window.addEventListener('pointerup', () => gate.release(), true);
  window.addEventListener('pointercancel', () => gate.cancel(), true);
  window.addEventListener('click', () => gate.clicked(), true);
  document.addEventListener('click', event => {
    const link = (event.target as Element | null)?.closest?.('a[href]');
    // An SVG <a> answers `.href` with an object, not a string — read the attribute instead.
    const href = link instanceof HTMLAnchorElement ? link.href : link?.getAttribute('href') ?? null;
    const leaves = clickLeavesPage({
      href,
      target: link?.getAttribute('target') ?? '',
      download: !!link?.hasAttribute('download'),
      button: event.button,
      modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
    }, window.location);
    if (leaves) gate.leaves();
  });
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

/** The Navigation API's word on it where the browser has one; elsewhere assume yes and let `REENTRY_WAIT_MS` decide. */
function canStepForward(): boolean {
  const nav = (window as unknown as { navigation?: { canGoForward?: boolean } }).navigation;
  return nav?.canGoForward ?? true;
}

/** A step forward is no longer awaited: its timer goes with it. */
function settleReentry(reg: Registry): void {
  if (!reg.reentry) return;
  window.clearTimeout(reg.reentry.timer);
  reg.reentry = null;
}

/** The old answer to a Back — push the step's entry back, then ask the level — kept for when stepping forward can't. */
function answerByPush(step: Step): void {
  pushStep(step);
  step.onBack();
}

function onPop(reg: Registry): void {
  const landed = window.history.state;
  const landedSeq = stepOf(landed);
  // The step forward asked for below has landed: the level the Back was pressed in answers it now, standing on its own
  // entry. Any other landing is read like any other and leaves it PENDING (/review: an unrelated popstate in the gap —
  // a menu step's exit — must not swallow the press); it settles on its own landing, on a close-top below (answered by
  // a push), or on its timer.
  const awaited = reg.reentry ?? null;
  if (awaited && reentryLanding(landedSeq, awaited.step.seq, reg.steps.includes(awaited.step)) === 'answer') {
    settleReentry(reg);
    awaited.step.onBack();
    return;
  }
  const top = topStep(reg.steps);
  // A step that closed under the one just consumed: its entry is consumed now, address first.
  const buried = landedSeq === null ? -1 : (reg.buried ?? []).findIndex(s => s.seq === landedSeq);
  if (buried >= 0) {
    const [step] = reg.buried!.splice(buried, 1);
    restampStep({ ...step, address: null });
    window.history.back();
    return;
  }
  const verdict = popVerdict(landedSeq, top?.seq ?? null, addressOf(landed) !== null);
  if (verdict === 'stay') return;
  if (verdict === 'step-back') { window.history.back(); return; }
  // close-top: hold the line first, so "Keep editing" — or a save in flight — leaves the coach
  // exactly where they were, with the entry still standing behind them (and, for a step that
  // names a place, with its address back in the URL bar). By stepping FORWARD onto it — see the
  // header: a push here is what made the browser's Back skip the page.
  const step = top!;
  // ⚠ A STEP THAT NAMES A PLACE STILL PUSHES (driven on dev, 2026-10-09). At the window the router's popstate listener
  // runs first, in registration order whatever the capture flag, so a step forward onto an ADDRESSED entry is a
  // traversal the router answers: it restores the address into `useSearchParams`, and a page that opens its window from
  // its address (Allocations' `?allocation=…&bill=…`) reopened the level the Back had just left. An unaddressed entry
  // has the page's own URL, so the same restore changes nothing. Owed: the addressed windows (Allocations, a bill, the
  // coach schedule's game sheet) keep Chrome's skip until their pages tell their own address from a new ask.
  if (awaited) settleReentry(reg);
  if (awaited || step.address !== null || !canStepForward()) { answerByPush(step); return; }
  reg.reentry = {
    step,
    timer: window.setTimeout(() => {
      if (reg.reentry?.step !== step) return;
      reg.reentry = null;
      // Only while it is still the top: a step that opened in the wait pushed over the entry the forward was for (/review).
      if (topStep(reg.steps) === step) answerByPush(step);
    }, REENTRY_WAIT_MS),
  };
  window.history.forward();
}

function listen(reg: Registry): void {
  window.addEventListener('popstate', () => onPop(reg));
  const prevReplace = window.history.replaceState.bind(window.history);
  window.history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    // ⚠ EVERY `replaceState` IN THE APP COMES THROUGH HERE, for the life of the document, and
    // Next's router re-stamps on every state change — so the cheap checks come first and the URL
    // is only PARSED once a step is actually standing on the entry being replaced.
    const step = liveStep(reg.steps) ?? liveStep(reg.closing ?? []);
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
      // ⚠ And not while the press that closed it is still under way, nor when that press was a tap
      // on a link that leaves the page — its navigation has not pushed yet (see the header). Until
      // the exit settles the entry keeps its marker: a closing copy, its address already given up.
      const closing: Step = { ...step, address: null };
      reg.closing?.push(closing);
      reg.gate!.exit(left => {
        const held = reg.closing?.indexOf(closing) ?? -1;
        if (held >= 0) reg.closing!.splice(held, 1);
        if (left) return;
        const current = stepOf(window.history.state);
        if (current === step.seq) { window.history.back(); return; }
        // Another step closing in this same commit stands on top of this one's entry (the ×
        // on a view inside a sheet) — this one's turn comes when that entry is consumed (`onPop`).
        if (current !== null && current > step.seq && reg.closing?.some(s => s.seq === current)) {
          (reg.buried ??= []).push(step);
        }
      });
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
