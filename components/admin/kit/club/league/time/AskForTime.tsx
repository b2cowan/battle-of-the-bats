'use client';

import { useState } from 'react';
import { TIME_HANDOFF_WORDS, canAskAgain } from '@/lib/league-time-handoff';
import s from './AskForTime.module.css';

const W = TIME_HANDOFF_WORDS.ask;

/**
 * "ASK FOR TIME" (Club Tier Stage 13d, Session A, A3 — lib/league-time-handoff.ts). The league admin's one quiet button where
 * the no-time sentence sits: the season line, House league's time and Generate games. Shown only where the one gate says
 * `askForTime` (a league admin on a live or getting-ready season; an owner or an admin gives time). No names (C6 A).
 *
 *   never asked, or 7 days since → the button ("Ask for time", or "Ask again" beside "Asked Nov 13.")
 *   asked inside 7 days          → "Asked Nov 13. The owner and admins see it on their Overview."
 *   sending                      → "Asking…", pressed once
 *   failed                       → the button stays, with "The ask didn't go. Try again."
 */
export default function AskForTime({ api, orgQuery, askedAt }: {
  /** `/api/admin/house-league/seasons/{id}` (the control adds `/time-ask` and `orgQuery`). */
  api: string;
  orgQuery: string;
  askedAt: string | null;
}) {
  const [mine, setMine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [given, setGiven] = useState(false);
  const asked = mine ?? askedAt;

  async function ask() {
    setBusy(true);
    setFailed(false);
    const res = await fetch(`${api}/time-ask${orgQuery}`, { method: 'POST' }).catch(() => null);
    const data = res ? await res.json().catch(() => null) as { askedAt?: string | null; code?: string } | null : null;
    setBusy(false);
    if (data?.code === 'given') { setGiven(true); return; }
    // An ask made a moment ago elsewhere reads as asked, not as a failure.
    const at = res?.ok || data?.code === 'asked_recently' ? data?.askedAt ?? null : null;
    if (!at) { setFailed(true); return; }
    setMine(at);
  }

  if (given) return <span className={`${s.ask} ${s.said}`}>{W.given}</span>;
  if (asked && !canAskAgain(asked)) {
    return <span className={`${s.ask} ${s.said}`}>{W.asked(asked)} {W.seen}</span>;
  }
  return (
    <span className={s.ask}>
      {asked && <span className={s.said}>{W.asked(asked)}</span>}
      <button type="button" className={`btn btn-outline btn-sm ${s.button}`} onClick={() => void ask()} disabled={busy} aria-busy={busy || undefined}>
        {busy ? W.asking : asked ? W.again : W.button}
      </button>
      {failed && <span className={s.failed} role="alert">{W.failed}</span>}
    </span>
  );
}
