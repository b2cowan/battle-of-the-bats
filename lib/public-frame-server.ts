import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getAnnouncements, getDivisions, getResources, getRules, getTeams, resolveTournamentContactEmail } from './db';
import { getRegistrationState } from './registration-state';
import { tournamentFrameTabContent, type FrameTabContent } from './tournament-page-tabs';
import type { Tournament } from './types';
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

/**
 * The band's facts that come from the tournament's own records, not its row: whether registration is open (the state
 * word "Registration open") and which of the tab row's content tabs have anything behind them (Stage 6, Ask 14). ONE
 * read for the organizer's admin preview and the Branding page's Look card preview (Stage 1a Part 3), so the two never
 * show a different band. `skip` names the pages already hidden, which are not read (the preview's own rule); the Look
 * card passes none, since its draft can switch a page back on before it saves.
 */
export async function publicFrameBandFacts(
  tournament: Pick<Tournament, 'id' | 'status' | 'startDate' | 'endDate' | 'championsCrownedAt'>,
  skip: { register: boolean; news: boolean; rules: boolean },
): Promise<{ registrationOpen: boolean; frameContent: FrameTabContent }> {
  const [divisions, regTeams, announcements, rules, resources] = await Promise.all([
    getDivisions(tournament.id, { admin: true }),
    skip.register ? Promise.resolve(null) : getTeams(tournament.id, { admin: true }),
    skip.news ? Promise.resolve([]) : getAnnouncements(tournament.id, { admin: true }),
    skip.rules ? Promise.resolve([]) : getRules(tournament.id, { admin: true }),
    skip.rules ? Promise.resolve([]) : getResources(tournament.id, { admin: true }),
  ]);
  const registration = regTeams
    ? getRegistrationState(tournament, divisions, regTeams.filter(t => t.status !== 'rejected'))
    : null;
  return {
    registrationOpen: registration?.state === 'open',
    frameContent: tournamentFrameTabContent({
      announcementCount: announcements.length, ruleCount: rules.length, resourceCount: resources.length,
      registrationCta: registration?.cta ?? null, championsCrownedAt: tournament.championsCrownedAt, divisions,
    }),
  };
}
