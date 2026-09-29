/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SAVE REFUSED BECAUSE THE SEASON CLOSED UNDER IT (Club Tier Stage 2, specimen 4 frame C).
 *
 * A page opened AFTER the club closes a season is already safe — the season gate decides on the
 * server and sends the coach to the one door. A page opened BEFORE it is not: its next save is
 * refused, and every portal team route now answers that refusal in ONE coded shape
 * (`seasonNotLiveRefusal`, 409 `season_not_live`, session 1). There are ~84 such routes behind
 * dozens of screens, each with its own save code, so the screen-side answer is ONE watcher rather
 * than one edit per screen: a fetch wrapper (the precedent is `FeedbackRequestIdProvider`) that
 * recognises the coded answer on a portal team route and announces it to the page, which then says
 * in words what happened and offers the one door — while the screen's own form, and everything the
 * coach typed, stays exactly where it was.
 *
 * ⚠ It READS a clone; the screen still receives the untouched response, and handles it as it always
 * has (its message is the server's sentence since session 1).
 * ⚠ Installed once per window, idempotent across Fast Refresh (the flag rides on `window.fetch`).
 * ⚠ PURE parts are exported for tests; the installer touches `window` only when called.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const SEASON_NOT_LIVE_EVENT = 'flhq:season-not-live';

export interface SeasonNotLiveDetail {
  /** The request's path — the listener keeps only its own team's. */
  url: string;
  error: string;
  seasonName: string | null;
  closedBy: 'club' | 'coach';
}

/** Is this parsed body the portal's coded "no live season" refusal? */
export function isSeasonNotLiveBody(body: unknown): body is { error: string; code: 'season_not_live'; seasonName: string | null; closedBy: 'club' | 'coach' } {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return b.code === 'season_not_live' && typeof b.error === 'string';
}

/** Is this request a portal TEAM route (the only routes that answer the coded refusal)? */
export function isPortalTeamRequest(url: string): boolean {
  return /\/api\/coaches\/[^/]+\/teams\/[^/?#]+/.test(url);
}

/** Does this request belong to that team? */
export function isForTeam(url: string, teamId: string): boolean {
  return url.includes(`/teams/${teamId}/`) || url.includes(`/teams/${teamId}?`) || url.endsWith(`/teams/${teamId}`);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

type WatchWindow = Window & { __flhqSeasonWatch?: boolean };

/** Install the watcher on this window's fetch, once. */
export function installSeasonRefusalWatch(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  // ⚠ The flag rides on WINDOW, not on fetch: another wrapper installed after this one (the
  // feedback request-id stash, the demo sandbox's) replaces `window.fetch` without copying any flag,
  // and a flag on fetch would then read "not installed" and wrap a second time on the next mount.
  const w = window as WatchWindow;
  if (w.__flhqSeasonWatch) return;
  w.__flhqSeasonWatch = true;
  const original = window.fetch.bind(window);
  const wrapped = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const res = await original(...args);
    try {
      if (res.status === 409) {
        const url = requestUrl(args[0]);
        if (isPortalTeamRequest(url)) {
          void res.clone().json().then((body: unknown) => {
            if (!isSeasonNotLiveBody(body)) return;
            const detail: SeasonNotLiveDetail = { url, error: body.error, seasonName: body.seasonName ?? null, closedBy: body.closedBy };
            window.dispatchEvent(new CustomEvent<SeasonNotLiveDetail>(SEASON_NOT_LIVE_EVENT, { detail }));
          }).catch(() => { /* not JSON — not ours */ });
        }
      }
    } catch { /* the watcher must never break the app's fetch */ }
    return res;
  }) as typeof window.fetch;
  // Carry the feedback wrapper's own flag across (it rides on fetch), so it never wraps this one again.
  Object.assign(wrapped, { __flhqWrapped: (window.fetch as typeof window.fetch & { __flhqWrapped?: boolean }).__flhqWrapped });
  window.fetch = wrapped;
}
