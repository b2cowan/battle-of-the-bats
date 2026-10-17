/**
 * A PAGE'S DOOR, WHEN WHAT IT WAS OPENED FOR IS SETTLED (Needs attention clears itself, A5 — owner 2026-10-16). The
 * schedule's `?answer=` and Payment requests' `?request=` read this when the ask or request isn't waiting any more,
 * and say the exact outcome in the page's note — "You accepted 15U AAA’s ask on Fri, Oct 16 at 5:10 p.m." — never a
 * guess at three causes. Client-side: the day and the clock are the reader's own, the stamp's spelling.
 */
import { DOOR_WORDS } from './needs-attention-words';
import { notificationDayAndClock } from './notification-view';

type Door =
  | { kind: 'ask'; verb: 'accepted' | 'declined' | 'withdrew'; team: string; at: string | null; who: string | null; you: boolean }
  | { kind: 'askClosed'; team: string; at: string | null; who: string | null; you: boolean }
  | { kind: 'requestWithdrawn'; who: string | null; you: boolean };

/** The note for a settled door, or null when the outcome can't be read (the page then says its own fallback). */
export function doorNote(door: Door | null): string | null {
  if (!door) return null;
  if (door.kind === 'requestWithdrawn') return DOOR_WORDS.requestWithdrawn;
  const when = door.at ? notificationDayAndClock(door.at) : null;
  if (door.kind === 'askClosed') return DOOR_WORDS.askClosed(door.team, when?.day ?? null);
  return DOOR_WORDS.askAnswered({ who: door.who, you: door.you, verb: door.verb, team: door.team, day: when?.day ?? null, time: when?.clock ?? null });
}

/** Ask the server what happened to an ask (by its hand-back) or a request, and word it. Null when it still waits,
 *  the reader was never told about it, or the read fails. */
export async function fetchDoorNote(q: { handBackId: string } | { requestId: string }): Promise<string | null> {
  try {
    const param = 'handBackId' in q ? `handBackId=${encodeURIComponent(q.handBackId)}` : `requestId=${encodeURIComponent(q.requestId)}`;
    const res = await fetch(`/api/notifications/outcome?${param}`);
    if (!res.ok) return null;
    const body = await res.json() as { waiting?: boolean; door?: Door | null };
    return body.waiting ? null : doorNote(body.door ?? null);
  } catch {
    return null;
  }
}
