import 'server-only';

import { supabaseAdmin } from './supabase-admin';

/**
 * The tournament-team CLAIM table's remaining readers. Signed-in family accounts Stage 2 (Part 2) removed the claim LINK
 * (the page, the dev seed, the token reader and the checkout branch): nothing in production created a claim, and a
 * tournament coach keeps their account at registration instead. The TABLE stays: Tournament Chat reads it to work out which
 * coaches are in a tournament's chat (`lib/chat-resolvers.ts`), and checkout metadata that already carries a claim id is
 * still honoured below.
 */
export type TeamWorkspaceClaimStatus = 'available' | 'claimed' | 'expired' | 'revoked';

type ClaimRow = {
  id: string;
  tournament_id: string;
  tournament_team_id: string | null;
  contact_email: string;
  status: TeamWorkspaceClaimStatus;
  team_workspace_id: string | null;
  claimed_by_user_id: string | null;
  expires_at: string | null;
  created_at: string;
  claimed_at: string | null;
};

export class TeamWorkspaceClaimError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeamWorkspaceClaimError';
    this.code = code;
  }
}

function isExpired(row: ClaimRow): boolean {
  return !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
}

async function maybeExpireClaim(row: ClaimRow): Promise<ClaimRow> {
  if (row.status !== 'available' || !isExpired(row)) return row;

  const { data, error } = await supabaseAdmin
    .from('team_workspace_claims')
    .update({ status: 'expired' })
    .eq('id', row.id)
    .select('id, tournament_id, tournament_team_id, contact_email, status, team_workspace_id, claimed_by_user_id, expires_at, created_at, claimed_at')
    .single<ClaimRow>();

  if (error) throw error;
  return data;
}

export async function assertTeamWorkspaceClaimAvailableForProvisioning(claimId: string | null | undefined): Promise<void> {
  if (!claimId) return;

  const { data, error } = await supabaseAdmin
    .from('team_workspace_claims')
    .select('id, tournament_id, tournament_team_id, contact_email, status, team_workspace_id, claimed_by_user_id, expires_at, created_at, claimed_at')
    .eq('id', claimId)
    .maybeSingle<ClaimRow>();

  if (error) throw error;
  if (!data) {
    throw new TeamWorkspaceClaimError('claim_not_found', 'This team claim link is invalid.');
  }

  const row = await maybeExpireClaim(data);
  if (row.status !== 'available') {
    throw new TeamWorkspaceClaimError('claim_unavailable', 'This team claim link has already been used or is no longer available.');
  }
}

export async function markTeamWorkspaceClaimed(params: {
  claimId: string | null | undefined;
  teamWorkspaceId: string;
  claimedByUserId: string;
}): Promise<void> {
  if (!params.claimId) return;

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('team_workspace_claims')
    .select('id, status, team_workspace_id')
    .eq('id', params.claimId)
    .maybeSingle<{ id: string; status: TeamWorkspaceClaimStatus; team_workspace_id: string | null }>();

  if (lookupError) throw lookupError;
  if (!existing) return;
  if (existing.status === 'claimed' && existing.team_workspace_id === params.teamWorkspaceId) return;
  if (existing.status !== 'available') {
    throw new TeamWorkspaceClaimError('claim_unavailable', 'This team claim is no longer available.');
  }

  const { error } = await supabaseAdmin
    .from('team_workspace_claims')
    .update({
      status: 'claimed',
      team_workspace_id: params.teamWorkspaceId,
      claimed_by_user_id: params.claimedByUserId,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', params.claimId)
    .eq('status', 'available');

  if (error) throw error;
}
