import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { canWriteMoney, resolveCoachCapabilities } from './coach-capabilities';
import type { CanSave } from './bank-check-work-server';

/**
 * WHO ON THE TEAM MAY SAVE A BANK CHECK, asked of colleagues (S7; the work itself is lib/bank-check-work-server.ts). The
 * coach gate's own rule (`resolveLiveCoachTeamContext` + money write): a coach on the team's LIVE season whose resolved
 * capabilities hold money write. A coach reader, so it lives with the coach's bank (D1: the club never reaches it).
 */
export function teamCanSave(teamId: string, seasonId: string): CanSave {
  return async (userIds) => {
    if (!userIds.length) return new Set();
    const { data, error } = await supabaseAdmin.from('rep_team_coaches').select('user_id, coach_role, capabilities')
      .eq('team_id', teamId).eq('program_year_id', seasonId).in('user_id', [...userIds]);
    if (error) throw error;
    return new Set((data ?? [])
      .filter(r => canWriteMoney(resolveCoachCapabilities(r.coach_role as 'head_coach' | 'assistant_coach', r.capabilities ?? null)))
      .map(r => r.user_id as string));
  };
}
