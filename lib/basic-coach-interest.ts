import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { normalizeGuardianEmailRequired } from './guardian-email';
import { isWorkedLead } from './early-access-refill';
import { captureError } from './observability';

/**
 * Scope-ceiling interest capture for org-less Basic coach teams (free-tier Phase 4d).
 *
 * This is NOT a checkout, entitlement, Premium unlock, or upgrade mutation. It writes a
 * platform early-access lead so FieldLogicHQ can follow up about lineups, attendance, documents,
 * budget, and dues automation. The caller must ownership-gate the team first.
 */

export const BASIC_COACH_INTEREST_OPTIONS = [
  'lineups',
  'attendance',
  'documents',
  'budget',
  'dues_automation',
  'development',
  'practice_plans',
] as const;

export type BasicCoachInterestOption = (typeof BASIC_COACH_INTEREST_OPTIONS)[number];

type BasicCoachTeamInterestRow = {
  id: string;
  name: string;
  primary_coach_name: string | null;
  sport: string | null;
  age_group: string | null;
};

type EarlyAccessLeadRow = {
  id: string;
  submission_count: number | null;
  plan_interest: string[] | null;
  features_interested: string[] | null;
  notes: string | null;
  release_notifications_consent: boolean | null;
  internal_status: string | null;
  source: string | null;
  source_words: string | null;
  linked_at: string | null;
  converted_org_id: string | null;
  last_contacted_at: string | null;
  next_action: string | null;
  follow_up_due_at: string | null;
};

const LABELS: Record<BasicCoachInterestOption, string> = {
  lineups: 'lineups',
  attendance: 'attendance',
  documents: 'documents',
  budget: 'budget',
  dues_automation: 'dues automation',
  development: 'player development',
  practice_plans: 'practice plans',
};

const FEATURE_VALUES: Record<BasicCoachInterestOption, string> = {
  lineups: 'team_lineups',
  attendance: 'team_attendance',
  documents: 'team_documents',
  budget: 'team_budget',
  dues_automation: 'team_dues_automation',
  development: 'team_player_development',
  practice_plans: 'team_practice_plans',
};

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function mergeValues(existing: string[] | null | undefined, next: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...next])).slice(0, 8);
}

function appendNote(existing: string | null | undefined, next: string): string {
  const combined = [existing?.trim(), next.trim()].filter(Boolean).join('\n');
  return combined.slice(-1200);
}

export function normalizeBasicCoachInterestOptions(value: unknown): BasicCoachInterestOption[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(BASIC_COACH_INTEREST_OPTIONS);
  return Array.from(new Set(value.filter((item): item is string => (
    typeof item === 'string' && allowed.has(item)
  )))) as BasicCoachInterestOption[];
}

export async function submitBasicCoachTeamScopeInterest(params: {
  basicCoachTeamId: string;
  userEmail: string;
  interests: BasicCoachInterestOption[];
  userAgent?: string | null;
}): Promise<void> {
  if (params.interests.length === 0) throw new Error('Choose at least one area.');

  const email = normalizeGuardianEmailRequired(params.userEmail);
  if (!email) throw new Error('A signed-in coach email is required.');

  const { data: team, error: teamError } = await supabaseAdmin
    .from('basic_coach_teams')
    .select('id, name, primary_coach_name, sport, age_group')
    .eq('id', params.basicCoachTeamId)
    .maybeSingle<BasicCoachTeamInterestRow>();

  if (teamError) throw teamError;
  if (!team) throw new Error('Team not found.');

  const now = new Date().toISOString();
  const selected = params.interests.map(interest => LABELS[interest]).join(', ');
  const selectedFeatures = params.interests.map(interest => FEATURE_VALUES[interest]);
  const teamBits = [team.sport, team.age_group].filter(Boolean).join(' / ');
  const nextNote = [
    `Basic Coaches Portal interest (${now.slice(0, 10)}): ${selected}.`,
    `Team: ${team.name} (${team.id}).`,
    teamBits ? `Program: ${teamBits}.` : '',
  ].filter(Boolean).join(' ');

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('early_access_leads')
    .select('id, submission_count, plan_interest, features_interested, notes, release_notifications_consent, internal_status, source, source_words, linked_at, converted_org_id, last_contacted_at, next_action, follow_up_due_at')
    .eq('email_normalized', email)
    .maybeSingle<EarlyAccessLeadRow>();

  if (existingError) throw existingError;

  // A coach asking from inside the product is a signed-in person on their own address, but the same rule holds as for
  // the public form (early-access-refill.ts): a lead staff have worked keeps every field as staff left it, and the
  // coach's ask lands on the timeline. Its consent is never touched here (the button carries no box).
  if (existing) {
    const { count: noteCount, error: notesError } = await supabaseAdmin
      .from('early_access_lead_notes')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', existing.id);
    if (notesError) throw notesError;

    const worked = isWorkedLead(existing, (noteCount ?? 0) > 0);
    const { error } = await supabaseAdmin
      .from('early_access_leads')
      .update(worked
        ? { updated_at: now, last_submitted_at: now, submission_count: (existing.submission_count ?? 1) + 1 }
        : {
            updated_at: now,
            last_submitted_at: now,
            submission_count: (existing.submission_count ?? 1) + 1,
            name: cleanText(team.primary_coach_name, 120) || email,
            organization_name: cleanText(team.name, 160) || 'Basic coach team',
            role: 'Coach',
            sports: cleanText(teamBits, 160),
            plan_interest: mergeValues(existing.plan_interest, ['team']),
            features_interested: mergeValues(existing.features_interested, ['coach_portal', ...selectedFeatures]),
            notes: appendNote(existing.notes, nextNote),
          })
      .eq('id', existing.id);
    if (error) throw error;

    // The dated entry comes after the update, so a failure never leaves a stray entry; it goes to the error log.
    const { error: entryError } = await supabaseAdmin.from('early_access_lead_submissions').insert({
      lead_id: existing.id,
      submitted_at: now,
      kind: 'coach_button',
      source_path: `/coaches/team/${team.id}`,
      their_words: `Asked about ${selected}. Team: ${team.name}.`.slice(0, 1200),
    });
    if (entryError) await captureError(entryError);
    return;
  }

  const result = await supabaseAdmin.from('early_access_leads').insert({
    updated_at: now,
    last_submitted_at: now,
    name: cleanText(team.primary_coach_name, 120) || email,
    email,
    email_normalized: email,
    organization_name: cleanText(team.name, 160) || 'Basic coach team',
    role: 'Coach',
    sports: cleanText(teamBits, 160),
    plan_interest: ['team'],
    features_interested: mergeValues(null, ['coach_portal', ...selectedFeatures]),
    notes: appendNote(null, nextNote),
    source_path: `/coaches/team/${team.id}`,
    user_agent: params.userAgent?.slice(0, 500) ?? null,
    release_notifications_consent: false,
    created_at: now,
    submission_count: 1,
    status: 'new',
  });

  if (result.error) throw result.error;
}
