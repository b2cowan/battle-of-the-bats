import type { MoveHistoryState } from './team-move-words';

/**
 * Where a team-move request stands, read from its link row (Club Tier Stage 2, B04). Pure, so the
 * screens, the server and the unit tests ask one function.
 *
 * An OPEN request is `ownership_pending` with exactly one side's yes recorded; that side ASKED, and
 * the other answers. Everything else is history — including every row of the retired Basic
 * visibility link (`link_type` visibility/billing, B12), whatever its status says.
 */

/** Who asked, for a request still open; null once it has an answer. */
export type TeamMoveAskedBy = 'club' | 'coach' | null;

type LinkState = {
  status: string;
  link_type: string;
  approved_by_org_user_id?: string | null;
  approved_by_team_user_id?: string | null;
};

export function askedByOf(row: LinkState): TeamMoveAskedBy {
  if (row.status !== 'ownership_pending' || row.link_type !== 'ownership') return null;
  if (row.approved_by_org_user_id && !row.approved_by_team_user_id) return 'club';
  if (row.approved_by_team_user_id && !row.approved_by_org_user_id) return 'coach';
  return null;
}

export function historyStateOf(row: Pick<LinkState, 'status' | 'link_type'>): MoveHistoryState | null {
  if (row.status === 'org_owned') return 'moved';
  if (row.link_type !== 'ownership') return 'retired_link';
  if (row.status === 'declined') return 'declined';
  if (row.status === 'revoked') return 'withdrawn';
  if (row.status === 'ownership_pending') return null;
  return 'retired_link';
}
