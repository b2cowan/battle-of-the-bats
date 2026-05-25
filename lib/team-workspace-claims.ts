import 'server-only';

import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

export type TeamWorkspaceClaimStatus = 'available' | 'claimed' | 'expired' | 'revoked';

export type TeamWorkspaceClaimPublic = {
  id: string;
  token: string;
  status: TeamWorkspaceClaimStatus;
  contactEmail: string;
  expiresAt: string | null;
  claimedAt: string | null;
  teamWorkspaceId: string | null;
  tournament: {
    id: string;
    name: string;
    year: number | null;
    startDate: string | null;
    endDate: string | null;
  };
  tournamentTeam: {
    id: string;
    name: string;
    coachName: string | null;
    email: string | null;
    status: string | null;
  };
  ageGroup: {
    id: string | null;
    name: string | null;
  };
  seasonYear: number;
};

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

type TournamentRow = {
  id: string;
  name: string;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
};

type TournamentTeamRow = {
  id: string;
  tournament_id: string | null;
  age_group_id: string | null;
  name: string;
  coach: string | null;
  email: string | null;
  status: string | null;
};

type AgeGroupRow = {
  id: string;
  name: string;
};

export class TeamWorkspaceClaimError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeamWorkspaceClaimError';
    this.code = code;
  }
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function hashClaimToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function defaultExpiry(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + 90);
  return expires.toISOString();
}

function seasonYearFromTournament(tournament: TournamentRow): number {
  if (Number.isInteger(tournament.year) && tournament.year && tournament.year >= 2000 && tournament.year <= 2100) {
    return tournament.year;
  }

  const startYear = tournament.start_date ? new Date(tournament.start_date).getFullYear() : NaN;
  if (Number.isInteger(startYear) && startYear >= 2000 && startYear <= 2100) return startYear;

  return new Date().getFullYear();
}

function isExpired(row: ClaimRow): boolean {
  return !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
}

export function generateTeamWorkspaceClaimToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function buildTeamWorkspaceClaimUrl(token: string, origin?: string | null): string {
  const baseUrl = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://www.fieldlogichq.ca').replace(/\/+$/, '');
  return `${baseUrl}/coaches/claim/${encodeURIComponent(token)}`;
}

export async function createTournamentTeamWorkspaceClaim(input: {
  tournamentId: string;
  tournamentTeamId: string;
  contactEmail: string;
  expiresAt?: string | null;
  replaceAvailable?: boolean;
}): Promise<{ id: string; token: string; claimUrl: string }> {
  const contactEmail = normalizeEmail(input.contactEmail);
  if (!contactEmail) {
    throw new TeamWorkspaceClaimError('missing_contact_email', 'A team contact email is required to create a claim link.');
  }

  if (input.replaceAvailable) {
    await supabaseAdmin
      .from('team_workspace_claims')
      .update({ status: 'revoked' })
      .eq('tournament_id', input.tournamentId)
      .eq('tournament_team_id', input.tournamentTeamId)
      .eq('status', 'available');
  }

  const token = generateTeamWorkspaceClaimToken();
  const { data, error } = await supabaseAdmin
    .from('team_workspace_claims')
    .insert({
      tournament_id: input.tournamentId,
      tournament_team_id: input.tournamentTeamId,
      contact_email: contactEmail,
      claim_token_hash: hashClaimToken(token),
      status: 'available',
      expires_at: input.expiresAt ?? defaultExpiry(),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) throw error;

  return {
    id: data.id,
    token,
    claimUrl: buildTeamWorkspaceClaimUrl(token),
  };
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

async function buildPublicClaim(row: ClaimRow, token: string): Promise<TeamWorkspaceClaimPublic | null> {
  const [
    { data: tournament, error: tournamentError },
    { data: tournamentTeam, error: teamError },
  ] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('id, name, year, start_date, end_date')
      .eq('id', row.tournament_id)
      .maybeSingle<TournamentRow>(),
    row.tournament_team_id
      ? supabaseAdmin
          .from('teams')
          .select('id, tournament_id, age_group_id, name, coach, email, status')
          .eq('id', row.tournament_team_id)
          .maybeSingle<TournamentTeamRow>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (tournamentError) throw tournamentError;
  if (teamError) throw teamError;
  if (!tournament || !tournamentTeam) return null;

  const { data: ageGroup, error: ageGroupError } = tournamentTeam.age_group_id
    ? await supabaseAdmin
        .from('age_groups')
        .select('id, name')
        .eq('id', tournamentTeam.age_group_id)
        .maybeSingle<AgeGroupRow>()
    : { data: null, error: null };

  if (ageGroupError) throw ageGroupError;

  return {
    id: row.id,
    token,
    status: row.status,
    contactEmail: row.contact_email,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at,
    teamWorkspaceId: row.team_workspace_id,
    tournament: {
      id: tournament.id,
      name: tournament.name,
      year: tournament.year,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
    },
    tournamentTeam: {
      id: tournamentTeam.id,
      name: tournamentTeam.name,
      coachName: tournamentTeam.coach,
      email: tournamentTeam.email,
      status: tournamentTeam.status,
    },
    ageGroup: {
      id: ageGroup?.id ?? null,
      name: ageGroup?.name ?? null,
    },
    seasonYear: seasonYearFromTournament(tournament),
  };
}

export async function getTeamWorkspaceClaimByToken(token: string): Promise<TeamWorkspaceClaimPublic | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const { data, error } = await supabaseAdmin
    .from('team_workspace_claims')
    .select('id, tournament_id, tournament_team_id, contact_email, status, team_workspace_id, claimed_by_user_id, expires_at, created_at, claimed_at')
    .eq('claim_token_hash', hashClaimToken(cleanToken))
    .maybeSingle<ClaimRow>();

  if (error) throw error;
  if (!data) return null;

  const row = await maybeExpireClaim(data);
  return buildPublicClaim(row, cleanToken);
}

export async function verifyTeamWorkspaceClaimForCheckout(params: {
  token: string;
  userId: string;
  userEmail: string | null | undefined;
}): Promise<TeamWorkspaceClaimPublic> {
  const claim = await getTeamWorkspaceClaimByToken(params.token);
  if (!claim) {
    throw new TeamWorkspaceClaimError('claim_not_found', 'This team claim link is invalid.');
  }
  if (claim.status !== 'available') {
    throw new TeamWorkspaceClaimError('claim_unavailable', 'This team claim link has already been used or is no longer available.');
  }

  const userEmail = normalizeEmail(params.userEmail);
  if (!userEmail || userEmail !== claim.contactEmail) {
    throw new TeamWorkspaceClaimError('claim_email_mismatch', `This team claim is reserved for ${claim.contactEmail}. Sign in with that email to continue.`);
  }

  return claim;
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
