'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import CodeAgainWindow, { type CodeAgainCheck } from './CodeAgainWindow';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import {
  CODE_AGAIN_REFUSALS, CODE_AGAIN_ROUTE, CODE_AGAIN_WORDS as W, TWO_STEP_FRESH_CODE, TWO_STEP_SET_UP_REFUSAL,
  type CodeAgainProof, type CodeAgainRefusal,
} from '@/lib/code-again';
import styles from './CodeAgainWindow.module.css';

/**
 * THE PRODUCT-WIDE "TYPE YOUR CODE AGAIN" (Board Ready · two-step sign-in, Part 2; owner call 4, 2026-11-11). Mounted once
 * in the root layout. Every request the page makes to our own server passes through it; when one is refused because the
 * session needs a code —
 *   - `two_step_fresh_code`: one of the actions that ask for a code, last code over 15 minutes ago;
 *   - `two_step_code`: the 30-day re-ask, reached by a page that was already open —
 * it opens the one window in place, and once the code is accepted it sends THE SAME request again, once. Cancel hands
 * the screen the original refusal, so nothing ran. Several refusals at once share one window.
 *
 * `two_step_set_up` (a seat that requires two-step, past its 14 days, with it off) cannot be answered in a window: a
 * notice with the link to the set-up step shows instead, and the screen gets its refusal.
 *
 * Quiet by design (/review of Part 2): a refusal that lands within a few seconds AFTER a code was accepted (a request
 * that was already on its way) is simply sent again, never asked twice; after a Cancel on the 30-day ask, or after the
 * set-up notice is closed, a page that checks in the background does not bring it straight back for two minutes; and a
 * request that could not be sent again (a streamed body) is never asked about at all.
 *
 * A screen that must do something in between (the payouts card reserves a Stripe tab before it asks the server) sends
 * the header `x-code-again: manual` and calls `askForCodeAgain()` itself.
 */

export const CODE_AGAIN_MANUAL_HEADER = 'x-code-again';

type Kind = 'fresh' | 'reask';
type Pending = { kind: Kind; resolvers: Array<(accepted: boolean) => void> };

/** A refusal this soon after an accepted code is a request that was already on its way: send it again, don't ask. */
const JUST_ACCEPTED_MS = 5_000;
/** After a Cancel on the 30-day ask, or a closed set-up notice: background refusals stay quiet this long. */
const QUIET_AFTER_NO_MS = 2 * 60_000;

/**
 * Everything the patched fetch needs lives on the page itself, not in this module: a hot reload (or a second copy of the
 * module) makes a new module, while the patched fetch stays the first one — it must still find the window mounted now.
 */
type PageHooks = {
  __flhqCodeAgainFetch?: typeof fetch;
  __flhqCodeAgainOpen?: ((kind: Kind) => Promise<boolean>) | null;
  __flhqCodeAgainSetUp?: ((destination: string) => void) | null;
  __flhqCodeAgainAcceptedAt?: number;
  __flhqCodeAgainDeclinedAt?: number;
  __flhqCodeAgainSetUpClosedAt?: number;
};
const page = () => window as unknown as PageHooks;

/** Open the window by hand (resolves true once a code was accepted, false on Cancel or when nothing is mounted). */
export function askForCodeAgain(kind: Kind = 'fresh'): Promise<boolean> {
  const open = typeof window === 'undefined' ? null : page().__flhqCodeAgainOpen;
  return open ? open(kind) : Promise.resolve(false);
}

/** The refusal code of a 401 from our own server, read from a copy so the screen can still read the original. */
async function refusalOf(res: Response): Promise<{ code: string | null; destination: string | null }> {
  if (res.status !== 401) return { code: null, destination: null };
  if (!(res.headers.get('content-type') ?? '').includes('json')) return { code: null, destination: null };
  const body = await res.clone().json().catch(() => null) as { code?: unknown; destination?: unknown } | null;
  return {
    code: typeof body?.code === 'string' ? body.code : null,
    destination: typeof body?.destination === 'string' ? body.destination : null,
  };
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

/** Our own server's API, but never the window's own checks (everyone's, and staff's "sign in again"). */
const OWN_CHECKS = new Set([CODE_AGAIN_ROUTE, '/api/platform-admin/sign-in-again']);
function isOurs(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(urlOf(input), window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/') && !OWN_CHECKS.has(url.pathname);
  } catch {
    return false;
  }
}

function saysManual(input: RequestInfo | URL, init?: RequestInit): boolean {
  const fromInit = init?.headers ? new Headers(init.headers).get(CODE_AGAIN_MANUAL_HEADER) : null;
  const fromRequest = input instanceof Request ? input.headers.get(CODE_AGAIN_MANUAL_HEADER) : null;
  return (fromInit ?? fromRequest) === 'manual';
}

/** A streamed body is read once and cannot be sent again: such a request gets its refusal and no window. */
function canResend(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (init?.body && typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream) return false;
  return !(input instanceof Request && input.bodyUsed);
}

/**
 * Patch the page's fetch ONCE, as soon as this module loads in the browser — before any screen's first request, so a
 * request made while the page mounts is answered too (an effect would run after the screens' own).
 */
function installOnce() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const w = page();
  if (w.__flhqCodeAgainFetch) return;
  const original = window.fetch.bind(window);
  w.__flhqCodeAgainFetch = original;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const ours = isOurs(input) && !saysManual(input, init);
    // A Request's body can be read once: keep a copy to send again.
    const again = ours && input instanceof Request ? input.clone() : input;
    const res = await original(input, init);
    if (!ours || res.status !== 401) return res;
    const { code, destination } = await refusalOf(res);
    const now = Date.now();
    if (code === TWO_STEP_SET_UP_REFUSAL) {
      const closedAt = page().__flhqCodeAgainSetUpClosedAt ?? 0;
      if (now - closedAt > QUIET_AFTER_NO_MS) page().__flhqCodeAgainSetUp?.(destination ?? '/auth/two-step');
      return res;
    }
    if (!code || !CODE_AGAIN_REFUSALS.includes(code) || !canResend(again, init)) return res;
    // Already on its way when a code was accepted a moment ago: send it again, never ask twice.
    if (now - (page().__flhqCodeAgainAcceptedAt ?? 0) < JUST_ACCEPTED_MS) return original(again, init);
    const kind: Kind = code === TWO_STEP_FRESH_CODE ? 'fresh' : 'reask';
    // A background check right after "no" to the 30-day ask stays quiet (a press for a fresh code always asks).
    if (kind === 'reask' && now - (page().__flhqCodeAgainDeclinedAt ?? 0) < QUIET_AFTER_NO_MS) return res;
    const opener = page().__flhqCodeAgainOpen;
    if (!opener) return res;
    const accepted = await opener(kind);
    if (!accepted) return res;
    return original(again, init);
  };
}
installOnce();

async function checkProof(proof: CodeAgainProof): Promise<CodeAgainCheck> {
  const res = await fetch(CODE_AGAIN_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proof),
  });
  if (res.ok) return { ok: true };
  const code = (await res.json().catch(() => null) as { code?: CodeAgainRefusal } | null)?.code;
  return { ok: false, refusal: code ?? 'not_checked' };
}

/**
 * ⚠ THE WINDOW WEARS THE THEME OF THE SCREEN IT OPENED OVER. This provider is mounted in the ROOT layout, a sibling of
 * every portal, so no theme marker reaches it: left where it is, the window read the page's base colours — the old dark
 * navy and lime — over a warm admin or coaches screen (owner, 2026-11-12, the Manage-member window). The warm / dark
 * palette and the admin kit's rules hang off the shell's marker, so the window is drawn INSIDE the open shell (the admin's
 * and the volunteer shells' `[data-admin-kit]`, else the coaches portal's `[data-coach-warm-enabled]`). The lookup is
 * limited to the page's `<main>`: every shell lives in it, while the help, feedback and notification panels carry the same
 * coach marker on a wrapper OUTSIDE it, and a window drawn into one of those would vanish when the panel closed. Where
 * no shell is open (a public page, the family app, the account pages) it carries the coach marker itself, as the feedback
 * window does, so the person's Warm / Dark setting still decides. Guarded:
 * `tests/unit/code-again-theme-guard.test.ts`. Read at the moment the window opens, never on first render (no hydration).
 */
function InTheme({ children }: { children: ReactNode }) {
  const host = document.querySelector('#main-content [data-admin-kit]') ?? document.querySelector('#main-content [data-coach-warm-enabled]');
  if (host) return createPortal(children, host);
  return <div style={{ display: 'contents' }} {...coachWarmAttr}>{children}</div>;
}

export default function CodeAgainProvider() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [setUpAt, setSetUpAt] = useState<string | null>(null);

  useEffect(() => {
    installOnce();
    const open = (kind: Kind) => new Promise<boolean>(resolve => {
      if (pendingRef.current) { pendingRef.current.resolvers.push(resolve); return; }
      const next: Pending = { kind, resolvers: [resolve] };
      pendingRef.current = next;
      setPending(next);
    });
    const w = page();
    w.__flhqCodeAgainOpen = open;
    w.__flhqCodeAgainSetUp = setSetUpAt;
    return () => {
      if (w.__flhqCodeAgainOpen === open) w.__flhqCodeAgainOpen = null;
      if (w.__flhqCodeAgainSetUp === setSetUpAt) w.__flhqCodeAgainSetUp = null;
      // Nobody waits forever on a window that is gone.
      const current = pendingRef.current;
      pendingRef.current = null;
      current?.resolvers.forEach(resolve => resolve(false));
    };
  }, []);

  function finish(accepted: boolean) {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    const w = page();
    if (accepted) w.__flhqCodeAgainAcceptedAt = Date.now();
    else if (current?.kind === 'reask') w.__flhqCodeAgainDeclinedAt = Date.now();
    current?.resolvers.forEach(resolve => resolve(accepted));
  }

  return (
    <>
      {pending && (
        <InTheme>
          <CodeAgainWindow
            title={pending.kind === 'fresh' ? W.freshTitle : W.reaskTitle}
            lead={pending.kind === 'fresh' ? W.freshLead : W.reaskLead}
            confirm={W.confirm}
            check={checkProof}
            onDone={finish}
          />
        </InTheme>
      )}
      {setUpAt && (
        <InTheme>
          <div className={styles.setUpNotice} role="status">
            <span>{W.setUpNotice}</span>
            <Link href={setUpAt} onClick={() => setSetUpAt(null)}>{W.setUpLink}</Link>
            <button
              type="button"
              className={styles.setUpClose}
              onClick={() => { page().__flhqCodeAgainSetUpClosedAt = Date.now(); setSetUpAt(null); }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </InTheme>
      )}
    </>
  );
}
