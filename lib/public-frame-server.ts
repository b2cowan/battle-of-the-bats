import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { resolveTournamentContactEmail } from './db';
import { PUBLIC_FRAME_COOKIE, publicFrameFromCookie } from './public-frame';

/**
 * Is the public tournament pages' new frame on for this request? (Stage 1's preview switch — the rule and its reasons are
 * in lib/public-frame.ts.) Read on the server, so the page's first paint is already the right one: no flicker, no toggle
 * in the browser.
 */
export async function isPublicFrameOn(): Promise<boolean> {
  const store = await cookies();
  return publicFrameFromCookie(store.get(PUBLIC_FRAME_COOKIE)?.value, process.env.NODE_ENV === 'development');
}

/**
 * The tournament's public contact, looked up once per request. The frame's footer (the layout) asks for it on every page
 * and the Overview, Rules and News ask again with the same inputs; without this each one ran the whole lookup (the
 * tournament row, the contact member, then the auth service).
 */
export const publicTournamentContactEmail = cache((tournamentId: string, orgFallbackEmail: string | null) =>
  resolveTournamentContactEmail(tournamentId, orgFallbackEmail, 'public'),
);
