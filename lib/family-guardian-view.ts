import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getActiveRepProgramYear } from './db';
import type { FamilyLink } from './family-access';

/**
 * lib/family-guardian-view.ts — what a VERIFIED GUARDIAN sees that a follower does not.
 *
 * THE TIER BOUNDARY LIVES IN THIS FILE'S EXISTENCE. The follower payload
 * (`lib/family-view.ts`) has no player field at all; this is a SEPARATE type reached only
 * after a caller has proven a verified guardian link. The boundary is therefore structural —
 * a follower cannot receive a partially-filled guardian payload, because there is no shared
 * shape for one to be filled into. Never merge these two modules, and never add a player
 * field to `FamilyScheduleEntry` to "reuse" this.
 *
 * ⚠ Every function here returns null/empty while `GUARDIAN_TIER_ENABLED` is off.
 *
 * What a guardian gets: their own child's identity as the coach records it, the team's next
 * event, the last result, and the coach's announcement archive.
 *
 * What is structurally EXCLUDED — not filtered, absent from the shape: medical notes, admin
 * notes, dues and fees, attendance detail beyond a rate, other children, and any other
 * family's contact details.
 */

export interface GuardianPlayerBand {
  playerId: string;
  /** First name only. The surname adds nothing a parent needs and is the field most likely
   *  to end up somewhere it should not. */
  playerFirstName: string;
  playerNumber: string | null;
  primaryPosition: string | null;
  /** How the coach labelled this adult ('Mom', 'Grandpa') — their own words, display only. */
  relationship: string | null;
}

export interface GuardianAnnouncement {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface GuardianPayload {
  player: GuardianPlayerBand | null;
  /**
   * The coach's sent announcements for this season.
   *
   * Guardian-only by recommendation of the discovery review and the approved mockup: coach
   * emails routinely carry money asks and registration matters, which are the accountable
   * adult's business and not a team follower's.
   */
  announcements: GuardianAnnouncement[];
}

/**
 * THE TIER BOUNDARY, as one predicate.
 *
 * "Is this link allowed to receive data about a child?" — three conditions that must never be
 * written out by hand again. The season recap (Chunk D 3.2) resolves a DIFFERENT season from
 * the payload below (the family reads their own past season, the approved decision-#2
 * exemption), so it cannot reuse the resolver — but it must ask exactly the same question, and
 * a second hand-typed copy of a security condition is how the two quietly stop agreeing.
 */
export function guardianLinkEarnsPlayerData(
  link: Pick<FamilyLink, 'role' | 'playerId'>,
): link is Pick<FamilyLink, 'role' | 'playerId'> & { playerId: string } {
  if (!GUARDIAN_TIER_ENABLED) return false;
  return link.role === 'guardian' && !!link.playerId;
}

/**
 * The ONE place that decides whether a link earns the guardian payload.
 *
 * Both readers — the SSR family team page and the family team API — previously wrote this
 * condition by hand. That is duplicated TIER-BOUNDARY logic, which is the last thing that
 * should live in two files: the next person tightening it has two places to remember and
 * nothing telling them so. A follower reaches this and gets null, because the role check and
 * the payload build are the same function.
 */
export async function resolveGuardianPayloadForLink(
  link: Pick<FamilyLink, 'role' | 'playerId' | 'relationship'>,
  repTeamId: string,
): Promise<GuardianPayload | null> {
  if (!guardianLinkEarnsPlayerData(link)) return null;

  const programYear = await getActiveRepProgramYear(repTeamId);
  if (!programYear) return null;

  return getGuardianPayload({
    playerId: link.playerId,
    programYearId: programYear.id,
    relationship: link.relationship,
  });
}

/**
 * Build the guardian-only half of a family's view.
 *
 * `playerId` and `programYearId` are supplied by the CALLER, which must already have
 * resolved a verified guardian link from the session. This function does not re-authorize —
 * it is unreachable without that proof, and duplicating the check here would invite a future
 * caller to believe this function is the gate.
 */
export async function getGuardianPayload(params: {
  playerId: string;
  programYearId: string;
  relationship: string | null;
}): Promise<GuardianPayload> {
  if (!GUARDIAN_TIER_ENABLED) return { player: null, announcements: [] };

  const [playerResult, announcementResult] = await Promise.all([
    // An explicit column list, not `select('*')`: this row also holds medical notes, admin
    // notes and emergency contacts, and naming the four fields we want is what guarantees
    // the rest cannot travel. A `select('*')` here would be the whole leak.
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_number, primary_position')
      .eq('id', params.playerId)
      .maybeSingle(),
    supabaseAdmin
      .from('rep_team_announcements')
      .select('id, subject, body, sent_at')
      .eq('program_year_id', params.programYearId)
      .order('sent_at', { ascending: false })
      .limit(25),
  ]);
  if (playerResult.error) throw playerResult.error;
  if (announcementResult.error) throw announcementResult.error;

  const row = playerResult.data as {
    id: string; player_first_name: string;
    player_number: string | null; primary_position: string | null;
  } | null;

  return {
    player: row
      ? {
          playerId: row.id,
          playerFirstName: row.player_first_name,
          playerNumber: row.player_number,
          primaryPosition: row.primary_position,
          relationship: params.relationship,
        }
      : null,
    announcements: (announcementResult.data ?? []).map(a => {
      const r = a as { id: string; subject: string; body: string; sent_at: string };
      return { id: r.id, subject: r.subject, body: r.body, sentAt: r.sent_at };
    }),
  };
}
