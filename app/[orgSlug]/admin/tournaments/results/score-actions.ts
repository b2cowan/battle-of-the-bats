/**
 * THE SCORE'S WRITES — one home for the two screens that open the score editor (`ScoreEditor`): Results, in its row's
 * place, and the schedule's game window, in its Score section (owner, 2026-10-19: "Enter the score" no longer leaves the
 * schedule). Both send the same four actions to the games route; each page keeps its own refresh and its own confirm.
 */

export type ScoreAction =
  | { action: 'submit-score'; id: string; homeScore: number; awayScore: number }
  | { action: 'forfeit'; id: string; winningSide: 'home' | 'away' }
  | { action: 'finalize'; id: string }
  | { action: 'revert-score'; id: string };

/** Send one score action; a refusal throws the server's reason, which the editor shows under its buttons. */
export async function sendScoreAction(orgSlug: string | undefined, body: ScoreAction): Promise<void> {
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const res = await fetch(`/api/admin/games${orgQuery}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data?.error === 'string' ? data.error : 'Score update failed');
  }
}

/**
 * Signal that a game's score just became public (finalize / forfeit) so the mobile AdminContextStrip
 * can offer a one-tap "See it live" nudge to that game on the public schedule (The Flip). The event
 * carries the game's OWN tournament context so the deep-link can't drift if the admin switches
 * tournaments or navigates away before the save resolves and this fires.
 */
export function emitScorePublished(detail: { gameId: string; orgSlug: string; tournamentSlug: string; isDraft: boolean }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('flhq:score-published', { detail }));
}
