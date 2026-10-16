import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import {
  getCoachTeamContextsForUser,
  getPendingTournamentRegistrationForUser,
  linkTournamentRegistrationToBasicCoachTeam,
  canUserAccessTournamentRegistration,
  findBasicCoachTeamIdForTournamentRegistration,
} from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';
import { getRegistrableTeamsForUser } from '@/lib/registrable-teams-server';
import { alreadyInClaimRefusal, findRegistrableTeam, TEAM_ALREADY_REGISTERED } from '@/lib/registrable-teams';
import { findTeamEntriesInTournament, markTeamsAlreadyInTournament } from '@/lib/team-registration-duplicates';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import { nameFromAccountMetadata } from '@/lib/db';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** The entry's tournament, asked only for the coach the entry was sent to (its own invitation), never for a stranger's
 *  entry id — so the claim's answer can't be used to learn where some other entry sits. */
async function tournamentOfEntryFor(user: { id: string; email: string }, registrationId: string): Promise<string | null> {
  if (!(await getPendingTournamentRegistrationForUser(user.id, user.email, registrationId))) return null;
  return tournamentOfEntry(registrationId);
}

/** The tournament an entry belongs to — the claim's cards are marked against it (one team, one entry). */
async function tournamentOfEntry(registrationId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('teams').select('tournament_id').eq('id', registrationId).maybeSingle<{ tournament_id: string }>();
  if (error) throw error;
  return data?.tournament_id ?? null;
}

async function requireCoachUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;
  // FieldLogicHQ staff are NOT coaches. Never expose a platform-admin session as a
  // coach identity: this endpoint feeds the public register form's email prefill, the
  // portal shell, and the join flow — a staff email must not leak into any of them.
  if (await isPlatformAdminEmail(user.email)) return null;
  // The account's name — "Registering as" and Review on the register form. The same rule
  // `/api/register` records (Register Your Existing Team, Stage 1b: a signed-in person is their
  // account and is never asked for a name), so the form never shows one name and stores another.
  return { id: user.id, email: user.email, name: nameFromAccountMetadata(user.user_metadata) ?? '' };
}

export const GET = withObservability(async (req: NextRequest) => {
  try {
    const user = await requireCoachUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);

    const url = new URL(req.url);
    const registrationId = url.searchParams.get('registrationId');
    // The team-scoped shell passes ?context=1 for the richer per-team context (lifecycle
    // chip, activated features, registration ids). The register-prefill / join callers omit
    // it and don't pay for the extra tournament-dates lookup.
    const wantContext = url.searchParams.get('context') === '1';
    // The register form names its tournament by the page's own address, so each card can say whether its
    // team is already in it (one team, one entry — owner, 2026-10-16). Resolved here by the page's own
    // resolver, beside the teams: the form's two loads stay side by side, and the cards are marked against
    // exactly the tournament the page shows.
    const orgSlug = url.searchParams.get('orgSlug');
    const tournamentSlug = url.searchParams.get('tournamentSlug');

    // The team-scoped shell (?context=1) reads only `teamContexts` and refetches on every navigation,
    // so it never pays for the registrable-teams computation; the register form and join page do.
    const [teamContexts, pendingRegistration, access, registrableTeams, linkedTeamId, forTournament] = await Promise.all([
      wantContext
        ? getCoachTeamContextsForUser({ userId: user.id, email: user.email })
        : Promise.resolve(null),
      registrationId
        ? getPendingTournamentRegistrationForUser(user.id, user.email, registrationId)
        : Promise.resolve(null),
      registrationId
        ? canUserAccessTournamentRegistration({ userId: user.id, email: user.email, registrationId })
        : Promise.resolve(null),
      // Fails soft to null ("could not load"): the form must still know WHO is signed in, and says
      // it could not load their teams rather than reading the failure as "you have none" — an empty
      // list leaves only "A different team", the very trap this list exists to close (F4).
      wantContext
        ? Promise.resolve(null)
        : getRegistrableTeamsForUser(user.id).catch(err => {
            console.error('[coaches basic-teams GET] registrable teams unavailable:', err);
            return null;
          }),
      registrationId ? findBasicCoachTeamIdForTournamentRegistration(registrationId) : Promise.resolve(null),
      !wantContext && orgSlug && tournamentSlug
        ? getPublicTournamentPageData(orgSlug, tournamentSlug).then(page => page?.tournament?.id ?? null).catch(err => {
            console.error('[coaches basic-teams GET] tournament unavailable:', err);
            return null;
          })
        // The claim (`/coaches/join`) names its entry, not the page: its cards are marked against the entry's
        // tournament (one team, one entry at the claim — owner 2026-10-16). Fails soft, as the form's does.
        : !wantContext && registrationId
          ? tournamentOfEntryFor(user, registrationId).catch(err => {
              console.error('[coaches basic-teams GET] entry tournament unavailable:', err);
              return null;
            })
          : Promise.resolve(null),
    ]);

    // An entry already filed under a team this person may register — their own free team, or a
    // Premium team they are staff on (D1) — needs no "choose team" step. (The free record it then
    // opens forwards a Premium entry to that portal's record — B6, 2026-10-13.)
    const linkedTeam = linkedTeamId && registrableTeams ? findRegistrableTeam(registrableTeams, linkedTeamId) : null;

    // Fails soft to the plain cards: Submit asks the same question again before it creates anything, so
    // a card that could not be marked is refused there with the reason, never entered twice.
    const cards = registrableTeams && forTournament
      ? await markTeamsAlreadyInTournament(registrableTeams, forTournament).catch(err => {
          console.error('[coaches basic-teams GET] tournament entries unavailable:', err);
          return registrableTeams;
        })
      : registrableTeams;

    return json({
      user: { id: user.id, email: user.email, name: user.name },
      // The register form's team cards and the join page's list — ONE computation (D1, owner
      // 2026-10-13; `lib/registrable-teams.ts`), the same one the server checks before it links.
      ...(wantContext ? { teamContexts } : { registrableTeams: cards }),
      pendingRegistration,
      // Already linked to this account → the join page skips the "choose team" interstitial.
      alreadyLinked: Boolean(access) || Boolean(linkedTeam),
    });
  } catch (error) {
    console.error('[coaches basic-teams GET] error:', error);
    return json({ error: 'Could not load coach teams.' }, 500);
  }
}, { route: '/api/coaches/basic-teams' });

export const POST = withObservability(async (req: NextRequest) => {
  try {
    const user = await requireCoachUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);

    const body = await req.json().catch(() => ({})) as {
      registrationId?: unknown;
      basicCoachTeamId?: unknown;
    };

    const registrationId = typeof body.registrationId === 'string' ? body.registrationId.trim() : '';
    const basicCoachTeamId = typeof body.basicCoachTeamId === 'string' && body.basicCoachTeamId.trim()
      ? body.basicCoachTeamId.trim()
      : null;

    if (!registrationId) {
      return json({ error: 'Registration is required.' }, 400);
    }

    // One team, one entry at the claim (owner 2026-10-16, every plan): a team already in this tournament under
    // another entry is never linked to this one too — the coach's Tournaments page would show the event twice. The
    // extra entry is the organizer's to remove. A team made new for this claim (no team chosen) can't be in already.
    // The teams are loaded once, the way the link asks (`forCheck`), and handed to it.
    const teams = basicCoachTeamId ? await getRegistrableTeamsForUser(user.id, { forCheck: true }) : undefined;
    if (basicCoachTeamId && teams) {
      const tournamentId = await tournamentOfEntryFor(user, registrationId);
      const card = findRegistrableTeam(teams, basicCoachTeamId);
      if (tournamentId && card) {
        const entry = (await findTeamEntriesInTournament({ tournamentId, teams: [card] })).get(card.basicCoachTeamId);
        if (entry && entry.registrationId !== registrationId) {
          return json({ error: alreadyInClaimRefusal(card.name, entry), code: TEAM_ALREADY_REGISTERED }, 409);
        }
      }
    }

    const result = await linkTournamentRegistrationToBasicCoachTeam({
      userId: user.id,
      userEmail: user.email,
      registrationId,
      basicCoachTeamId,
      linkSource: 'registration_flow',
      registrableTeams: teams,
    });

    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not link registration.';
    const status = message.includes('already been claimed')
      ? 409
      : message.includes('not linked')
        ? 403
        : 500;
    console.error('[coaches basic-teams POST] error:', error);
    return json({ error: message }, status);
  }
}, { route: '/api/coaches/basic-teams' });
