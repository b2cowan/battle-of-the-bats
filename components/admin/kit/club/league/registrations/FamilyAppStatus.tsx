'use client';
import { useState } from 'react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import css from './Registrations.module.css';
import { FAMILY_HOME_WORDS } from '@/lib/family-home-words';
import { regDay } from '@/lib/house-league-registrations';
import type { FamilyAddressStatus, FamilyAppFacts } from '@/lib/types';

const W = FAMILY_HOME_WORDS.club;

/** What the window hands these pieces: Send again for one address, Remove for one connection (null without the right). */
export interface FamilyAppActions {
  sendAgain: (which: 'first' | 'second') => Promise<{ sentTo: string } | { error: string }>;
  remove: (linkId: string) => Promise<string | null>;
}

/**
 * ONE STATUS UNDER AN ADDRESS on the registration record window (Signed-in family accounts Stage 4a, Part 8.1; drawing 7.2):
 * In the app since {date} · Invited {date} with Send again · Not invited yet · Left / Removed with Send again. Absent while
 * the guardian tier is off (the read attaches nothing), and for a player 18 or older.
 */
export function FamilyAppStatusLine({ status, which, today, actions }: {
  status: FamilyAddressStatus | null | undefined;
  which: 'first' | 'second';
  today: string;
  actions: FamilyAppActions | null;
}) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  if (!status) return null;

  const label = status.kind === 'joined' ? W.inApp(regDay(status.at, today))
    : status.kind === 'invited' ? W.invited(regDay(status.at, today))
      : status.kind === 'notInvited' ? W.notInvited
        : status.kind === 'left' ? W.left(regDay(status.at, today)) : W.removed(regDay(status.at, today));
  const canSend = status.kind !== 'joined' && status.canSend && !!actions;

  async function send() {
    if (!actions || busy) return;
    setBusy(true);
    setSaid(null);
    const r = await actions.sendAgain(which);
    setBusy(false);
    setSaid('sentTo' in r ? W.sent(r.sentTo) : r.error);
  }

  return (
    <span className={css.familyStatus}>
      <span className={`${ck.chip} ${status.kind === 'joined' ? ck.chipGood : ''}`}>{label}</span>
      {canSend && (
        <button type="button" className={`${ck.link} ${css.secondDoor}`} onClick={() => void send()} disabled={busy}>
          {busy ? W.sending : W.sendAgain}
        </button>
      )}
      {said && <span className={ck.hint} role="status">{said}</span>}
    </span>
  );
}

/** The Actions row "Remove a parent from {child}'s team" and the question it asks once (not drawn: the one connected address
 *  is named; with two, the club picks which). The parent is not emailed. */
export function RemoveParentAction({ child, facts, actions }: {
  child: string;
  facts: FamilyAppFacts | undefined;
  actions: FamilyAppActions | null;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!actions || !facts || facts.connected.length === 0) return null;
  const connected = facts.connected;
  const chosen = connected.length === 1 ? connected[0] : connected.find(c => c.linkId === pick) ?? null;

  async function remove() {
    if (!actions || !chosen || busy) return;
    setBusy(true);
    setError(null);
    const refused = await actions.remove(chosen.linkId);
    setBusy(false);
    if (refused) { setError(refused); return; }
    setOpen(false);
  }

  return (
    <>
      <li>
        <button type="button" className={css.doRow} onClick={() => { setOpen(true); setPick(null); setError(null); }}>
          <span className={css.doName}>{W.removeAction(child)}</span>
          <span className={css.doHint}>{W.removeHint(child)}</span>
        </button>
      </li>
      {open && (
        <KitDialog
          kind="question"
          title={W.removeTitle(child)}
          onClose={() => setOpen(false)}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} disabled={busy}>
                {FAMILY_HOME_WORDS.leave.cancel}
              </button>
              <button type="button" className="btn btn-lime" onClick={() => void remove()} disabled={busy || !chosen}>
                {W.removeConfirm}
              </button>
            </>
          )}
        >
          {connected.length > 1 && (
            <fieldset style={{ border: 0, padding: 0, margin: '0 0 0.75rem' }}>
              {connected.map(c => (
                <label key={c.linkId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '44px' }}>
                  <input type="radio" name="remove-parent" checked={pick === c.linkId} onChange={() => setPick(c.linkId)} />
                  {c.email}
                </label>
              ))}
            </fieldset>
          )}
          <p>{W.removeBody(chosen?.email ?? connected.map(c => c.email).join(' or '), child)}</p>
          {error && <p className={ck.hint} role="alert">{error}</p>}
        </KitDialog>
      )}
    </>
  );
}
