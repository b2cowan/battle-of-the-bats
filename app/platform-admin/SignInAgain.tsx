'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import CodeAgainWindow, { type CodeAgainCheck } from '@/components/shared/CodeAgainWindow';
import type { CodeAgainProof } from '@/lib/code-again';
import { SIGN_IN_AGAIN_CODE, SIGN_IN_AGAIN_WORDS as W, type SignInAgainMethod, type SignInAgainRefusal } from '@/lib/sign-in-again';
import kit from './console.module.css';

/** What the window says for one door (tabs 3 and 4): its title, the sentence naming the change, the button, the foot. */
export type SignInAgainAsk = { title: string; lead: string; confirm: string; foot: string };

const REFUSALS = new Set<SignInAgainRefusal>(['wrong_password', 'wrong_code', 'wrong_backup_code', 'no_authenticator', 'too_many_tries', 'not_checked']);

/**
 * Whether a gated route answered "sign in again" (401 with the code), read from a copy so the caller can still read it,
 * and what to ask for: the CODE (staff have two-step on), or the password for a dev account with no authenticator.
 */
async function asksToSignInAgain(res: Response): Promise<SignInAgainMethod | null> {
  if (res.status !== 401) return null;
  const body = await res.clone().json().catch(() => null) as { code?: unknown; method?: unknown } | null;
  if (body?.code !== SIGN_IN_AGAIN_CODE) return null;
  return body.method === 'password' ? 'password' : 'code';
}

/**
 * SIGN IN AGAIN (Stage 0, Part 10, tab 2): staff's door to the ONE "type your code again" window
 * (components/shared/CodeAgainWindow.tsx; Board Ready two-step, Part 2: one window, so staff's and everyone's never
 * drift). It asks for the authenticator CODE, or a backup code (owner call 6, 2026-11-11), or the password for a dev
 * account with no authenticator. Staff keep their own words, their own 10-minute clock and their own audit lines (the
 * check is `/api/platform-admin/sign-in-again`). It opens only when the server answers "sign in again" to the press;
 * once accepted it closes and the same request goes again once, with no second press (Ask 4).
 */
function SignInAgainWindow({ ask, email, method, onDone }: {
  ask: SignInAgainAsk;
  email: string;
  method: SignInAgainMethod;
  onDone: (accepted: boolean) => void;
}) {
  async function check(proof: CodeAgainProof): Promise<CodeAgainCheck> {
    try {
      const res = await fetch('/api/platform-admin/sign-in-again', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proof),
      });
      if (res.ok) return { ok: true };
      const code = (await res.json().catch(() => null) as { code?: SignInAgainRefusal } | null)?.code;
      return { ok: false, refusal: code && REFUSALS.has(code) ? code : 'not_checked' };
    } catch {
      return { ok: false, refusal: 'not_checked' };
    }
  }
  return (
    <CodeAgainWindow
      title={ask.title}
      lead={ask.lead}
      confirm={ask.confirm}
      foot={ask.foot}
      identity={email}
      password={method === 'password'}
      check={check}
      onDone={onDone}
    />
  );
}

/**
 * A screen's door to a gated route: `send(run, ask)` makes the request; when the server answers "sign in again" it opens
 * the window, and once the password is accepted makes the same request again, once. It resolves to the final answer, or
 * null when the person said no (the screen is then exactly as it was). Render `window` anywhere on the screen.
 */
export function useSignInAgain(email: string): {
  send: (run: () => Promise<Response>, ask: SignInAgainAsk) => Promise<Response | null>;
  window: ReactNode;
  /** Reads the route's `ownerEmailed` (Ask 9): the finish notice's last sentence, and whether `ownerNotice` shows. */
  ownerEmailed: (answer: { ownerEmailed?: boolean | null }) => string;
  /** "The email to the owner could not be sent…": render it under the finish notice. */
  ownerNotice: ReactNode;
} {
  const [pending, setPending] = useState<{ ask: SignInAgainAsk; method: SignInAgainMethod; resolve: (accepted: boolean) => void } | null>(null);
  const [ownerNotEmailed, setOwnerNotEmailed] = useState(false);
  // One question at a time: a second ask answers the first one "no", so no caller waits forever.
  const answerRef = useRef<((accepted: boolean) => void) | null>(null);
  const send = useCallback(async (run: () => Promise<Response>, ask: SignInAgainAsk) => {
    setOwnerNotEmailed(false);
    const first = await run();
    const method = await asksToSignInAgain(first);
    if (!method) return first;
    answerRef.current?.(false);
    let answer: ((accepted: boolean) => void) | null = null;
    const accepted = await new Promise<boolean>(resolve => {
      answer = resolve;
      answerRef.current = resolve;
      setPending({ ask, method, resolve });
    });
    // Only this ask's own window closes: a newer one, which answered this "no", stays open.
    if (answerRef.current === answer) {
      answerRef.current = null;
      setPending(null);
    }
    return accepted ? run() : null;
  }, []);
  const ownerEmailed = useCallback((answer: { ownerEmailed?: boolean | null }) => {
    setOwnerNotEmailed(answer.ownerEmailed === false);
    return answer.ownerEmailed === true ? ` ${W.ownerEmailed}` : '';
  }, []);
  const window = pending ? <SignInAgainWindow ask={pending.ask} email={email} method={pending.method} onDone={pending.resolve} /> : null;
  const ownerNotice = ownerNotEmailed
    ? <div className={`${kit.callout} ${kit.calloutWarn}`} role="status">{W.ownerNotEmailed}</div>
    : null;
  return { send, window, ownerEmailed, ownerNotice };
}
