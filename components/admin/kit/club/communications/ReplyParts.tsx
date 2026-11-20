'use client';
/**
 * WHERE REPLIES GO, AND THE CLUB-INBOX COPY — the same two controls in all three send windows (Club Communications R2–R4,
 * 2026-11-17; the addendum's both-modes table). Drawn from the shipped Who rows (`SendRows` / `SendRow`): a pick-one pair
 * under the message box, and one ticked row. The windows never invent a state of their own:
 *   · the club has a public contact → "Replies go to {Club}" (the default) or "Replies come to me";
 *   · the club has none → nothing is drawn, and replies go to the sender (the server's rule, `replyTarget`);
 *   · the copy tick is the family and coach windows' only, and never the board's (legal addendum 6a).
 * Both addresses are read live by the server and shown the way the statement shows them; nothing here keeps one.
 */
import { useState } from 'react';
import { WINDOW, type ReplyChoices, type ReplyMode } from '@/lib/club-group-email-words';
import { repKit } from '../RepKit';
import { SendRow, SendRows } from '../SendParts';

export interface ReplyState {
  /** The mode the window sends with and says. */
  mode: ReplyMode;
  setMode: (m: ReplyMode) => void;
  /** The address replies will reach in `mode` (the club's contact, or the sender's own); null when that mode has none. */
  address: string | null;
  copy: boolean;
  setCopy: (c: boolean) => void;
  /** The fields a send carries (R2–R4). Absent when the club has no contact: the server then replies to the sender. */
  fields: { replyTo?: ReplyMode; copyClub?: true };
}

/** `openOn` is the window's own default (the board opens on "Replies come to me", owner 2026-11-20); otherwise the server's. */
export function useReplyChoice(replies: ReplyChoices | null, openOn?: ReplyMode): ReplyState {
  const [picked, setPicked] = useState<ReplyMode | null>(null);
  const [copy, setCopy] = useState(false);
  const wanted = picked ?? openOn ?? replies?.default ?? 'sender';
  // Club mode needs the club's contact and "me" mode needs the sender's own address: a mode the club can't honour is not offered.
  const mode: ReplyMode = !replies?.club ? 'sender' : !replies.me ? 'club' : wanted;
  return {
    mode, setMode: setPicked, address: (mode === 'club' ? replies?.club?.address : replies?.me?.address) ?? null, copy: copy && !!replies?.club, setCopy,
    fields: replies?.club ? { replyTo: mode, ...(copy ? { copyClub: true as const } : {}) } : {},
  };
}

export function ReplyChoice({ idBase, replies, state, offerCopy }: {
  idBase: string;
  replies: ReplyChoices;
  state: ReplyState;
  /** The family and coach windows only. */
  offerCopy: boolean;
}) {
  const club = replies.club;
  if (!club) return null;
  const both = !!replies.me;
  return (
    <>
      {both && (
        <>
          <p className={repKit.factsLabel} id={`${idBase}-replies-label`}>{WINDOW.repliesLabel}</p>
          <SendRows group={{ radio: true, labelledBy: `${idBase}-replies-label` }}>
            <SendRow title={WINDOW.replyClub(club.name)} sub={club.address}
              pick={{ checked: state.mode === 'club', onChange: on => on && state.setMode('club'), radio: `${idBase}-replies` }} />
            <SendRow title={WINDOW.replyMe} sub={replies.me!.address}
              pick={{ checked: state.mode === 'sender', onChange: on => on && state.setMode('sender'), radio: `${idBase}-replies` }} />
          </SendRows>
        </>
      )}
      {offerCopy && (
        <SendRows>
          <SendRow title={WINDOW.copyTick(club.address)} sub={WINDOW.copyTickSub}
            pick={{ checked: state.copy, onChange: state.setCopy }} />
        </SendRows>
      )}
    </>
  );
}
