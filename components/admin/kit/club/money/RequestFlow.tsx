'use client';
/**
 * ONE REQUEST, OPEN OVER THE PAGE YOU ARE ON (Club Accounting · Teams, Ask 5 as drawn — "the request (Approve) over the
 * page"; the Stage 3d rule "a record opens where you are: from a page, over it").
 *
 * The request's window and the questions before money moves, wired ONCE: a waiting hand-back opens the one Answer window
 * (Stage 11d — every door opens it); any other request opens `RequestWindow`, whose Approve / Decline / Reverse each ask
 * first (`ApproveWindow`, `DeclineWindow`, `ReverseWindow`) and come back to the request on Cancel. Payment requests and a
 * team's account both mount this, so the two can never answer a request two ways (it was Payment requests' own wiring
 * until 2026-10-16; lifted whole, nothing changed in it).
 *
 * The host owns which request is open and what an answer does to the page: `onDone(text, keepOpen)` — a sentence for the
 * page's notice, and `keepOpen` when the server refused a stale tap (the question stays open with the server's sentence in
 * it while the host re-reads underneath — closing it would throw that sentence away). Mount it keyed by the request's id,
 * so a different request starts on its own window.
 */
import { useState } from 'react';
import AnswerWindow from './AnswerWindow';
import { ApproveWindow, DeclineWindow, RequestWindow, ReverseWindow, type RequestRow } from './RequestWindows';

export type RequestDone = (text: string | null, keepOpen?: boolean) => void;

export default function RequestFlow({ request: r, q, canMove, onClose, onDone }: {
  request: RequestRow;
  q: string;
  /** Whether this member may answer requests (the read's `canMove`) — Approve, Decline and Reverse show only then. */
  canMove: boolean;
  onClose: () => void;
  onDone: RequestDone;
}) {
  const [ask, setAsk] = useState<'approve' | 'decline' | 'reverse' | null>(null);
  if (!ask && r.handBack && r.status === 'pending') {
    return <AnswerWindow q={q} handBackId={r.handBack.id} onClose={onClose} onDone={text => onDone(text)} />;
  }
  if (!ask) return <RequestWindow r={r} canMove={canMove} onAsk={setAsk} onClose={onClose} />;
  if (ask === 'approve') return <ApproveWindow r={r} q={q} onClose={() => setAsk(null)} onDone={onDone} />;
  if (ask === 'decline') return <DeclineWindow r={r} q={q} onClose={() => setAsk(null)} onDone={onDone} />;
  return <ReverseWindow r={r} q={q} onClose={() => setAsk(null)} onDone={onDone} />;
}
