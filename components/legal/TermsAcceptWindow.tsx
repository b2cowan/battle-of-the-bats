'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import KitDialog from '@/components/shared/KitDialog';
import {
  ACCEPTANCE_WORDS,
  SCREEN_WORDS,
  WINDOW_WORDS as W,
  termsStopOf,
  type TermsSend,
  type TermsStop,
} from '@/lib/legal-acceptance-rules';
import { legalPagePath } from '@/lib/legal-paths';
import { LegalLinksProvider, useLegalLinks } from './LegalLinksProvider';
import TermsTickRow, { LinkedLine, useTermsTick } from './TermsTickRow';

/**
 * THE PURCHASE WINDOW (GST/HST Stage 6 step 6.3, Chunk C, ruling R6; drawing tab 6, asks 4A and 5A).
 *
 * Someone who has not agreed to the current Terms presses a button that starts an organization or a paid plan — most often
 * because their app was open when the Terms went live (a layout check runs on a full page load only), or because the "updated"
 * screen let them through to their billing page to cancel. The gated route refuses with 409 `terms_required`; this window opens
 * OVER whatever is there (the move window stays underneath — the house question window, on the same layer, mounted after it),
 * "Before you continue", §20 (5d)'s first line by the person's history, the one box, Cancel and Continue (off until ticked).
 *
 *   · Continue → the tick is recorded through the accept route (door `purchase_window`), the window closes, and THE ORIGINAL
 *     REQUEST IS SENT AGAIN WITH THE SAME BODY — the purchase carries on by itself, nothing chosen twice.
 *   · Cancel (or Escape, or a tap outside) → only this window closes; the page and its choices are as they were.
 *   · A failed save: (5a) in the foot's refusal slot, the box stays ticked, Continue comes back.
 *   · The Terms moved while it was open: §20 (2)'s line, the box un-ticked; the next tick agrees to the version now current.
 *
 * ⚖ DARK MEANS INVISIBLE. With the pages off no gated route ever answers `terms_required` (`requireAcceptance` passes without
 * reading anything), so the window can never open; the callers' bodies are unchanged.
 */
export function TermsAcceptWindow(props: { stop: TermsStop; onDone: (agreed: boolean) => void }) {
  // ⚠ A page loaded while the pages were OFF holds no links for its whole life — and that is exactly the person this window
  // exists for (their app was open when the Terms went live). The refusal proved the pages are on, so the window brings its own
  // links (platform-relative: every page that can open it is on the platform's own address) rather than rendering an empty box.
  const known = useLegalLinks();
  const links = known ?? { termsHref: legalPagePath('terms'), privacyHref: legalPagePath('privacy'), termsVersion: props.stop.termsVersion };
  return <LegalLinksProvider links={links}><TermsAcceptWindowBody {...props} /></LegalLinksProvider>;
}

function TermsAcceptWindowBody({ stop, onDone }: { stop: TermsStop; onDone: (agreed: boolean) => void }) {
  // The version the next tick agrees to starts as the one the refusal said is current; a `terms_changed` answer moves it (and
  // un-ticks the box) through the tick's own reading of the refusal.
  const tick = useTermsTick(stop.termsVersion);
  const { ticked } = tick;
  const [phase, setPhase] = useState<'idle' | 'saving' | 'failed' | 'changed'>('idle');
  const saving = phase === 'saving';

  async function accept() {
    if (!ticked || saving) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termsVersion: tick.fields.termsVersion, door: 'purchase_window' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { onDone(true); return; }
      // The window shows its own (§20 (2)) line, so the page wording `refusal` returns is not used.
      if (tick.refusal(data) === ACCEPTANCE_WORDS.refuseChangedPage) {
        setPhase('changed');
        return;
      }
      setPhase('failed');
    } catch {
      setPhase('failed');
    }
  }

  const reason = phase === 'failed' ? SCREEN_WORDS.saveFailed : phase === 'changed' ? ACCEPTANCE_WORDS.refuseChangedWindow : null;

  return (
    <KitDialog
      kind="question"
      title={W.title}
      onClose={() => onDone(false)}
      busy={saving}
      openOn="panel"
      footerStart={reason && <p role="alert" data-terms-window-reason>{reason}</p>}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={() => onDone(false)} disabled={saving}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={accept} disabled={!ticked || saving}>
            {saving ? SCREEN_WORDS.saving : SCREEN_WORDS.continue}
          </button>
        </>
      }
    >
      <p><LinkedLine parts={stop.hadEarlier ? W.updated : W.published} /></p>
      <TermsTickRow tick={tick} id="terms-window-box" disabled={saving} />
    </KitDialog>
  );
}

/**
 * The gate's rule, apart from React (the unit test drives it): send; on a Terms stop, `ask` (the window) and, once agreed, send
 * THE SAME `input` and `init` again. Null when the person closed the window. Any other answer — a 2xx, another 409 ("slug
 * taken", `portal_exists`) — is returned untouched and never asks. With no `ask` (the pages are off on this page) a stop is
 * handed back, and its text is §20 (5c). At most two rounds: a second stop after agreeing means the version moved again in
 * that instant; it asks once more, then hands the answer back rather than loop.
 */
export async function sendThroughTerms(
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
  ask: ((stop: TermsStop) => Promise<boolean>) | null,
  input: string,
  init?: RequestInit,
): Promise<Response | null> {
  let res = await fetcher(input, init);
  for (let round = 0; round < 2; round++) {
    if (!ask || res.status !== 409) return res;
    const stop = termsStopOf(res.status, await res.clone().json().catch(() => null));
    if (!stop) return res;
    if (!(await ask(stop))) return null;
    res = await fetcher(input, init);
  }
  return res;
}

export interface TermsGate {
  /**
   * `fetch`, for a route that may stop on the Terms (`requireAcceptance`). On a Terms stop it opens the window and, once the
   * person agrees, sends THE SAME REQUEST again and resolves with that answer; null when they closed the window (leave the page
   * as it was). Any other answer is returned untouched. `init.body` must be re-sendable (a string — every caller's JSON is).
   */
  send: TermsSend;
  /** Mount it beside the caller's own UI (after any window it should open over). Null while nothing is asked. */
  window: ReactNode;
}

export function useTermsGate(): TermsGate {
  // No read of the legal-links switch here: a Terms stop can only come from a server whose pages are on, so a stop always has a
  // window to open — which brings its own links when this page was loaded while the pages were off. (It also keeps the gate to
  // the hooks every caller already uses — the billing tests drive these components through a hook stand-in.)
  const [asked, setAsked] = useState<TermsStop | null>(null);
  // The open window's answer. A window still open when the caller goes away answers "no", so nothing waits forever.
  const pending = useRef<((agreed: boolean) => void) | null>(null);
  useEffect(() => () => pending.current?.(false), []);

  const send = useCallback((input: string, init?: RequestInit): Promise<Response | null> =>
    sendThroughTerms(fetch, async stop => {
      const agreed = await new Promise<boolean>(resolve => {
        pending.current?.(false); // a second stop while one window is open closes the first ask, so it never waits forever
        pending.current = resolve;
        setAsked(stop);
      });
      pending.current = null;
      setAsked(null);
      return agreed;
    }, input, init), []);

  return {
    send,
    window: asked ? <TermsAcceptWindow key={asked.termsVersion} stop={asked} onDone={agreed => pending.current?.(agreed)} /> : null,
  };
}
