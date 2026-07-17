export const EARLY_ACCESS_STATUSES = [
  'new',
  'qualified',
  'contacted',
  'pilot_candidate',
  'waiting_for_launch',
  'converted',
  'not_a_fit',
  'do_not_contact',
] as const;

export type EarlyAccessStatus = (typeof EARLY_ACCESS_STATUSES)[number];

export const EARLY_ACCESS_STATUS_LABELS: Record<EarlyAccessStatus, string> = {
  new: 'New',
  qualified: 'Qualified',
  contacted: 'Contacted',
  pilot_candidate: 'Pilot candidate',
  waiting_for_launch: 'Waiting for launch',
  converted: 'Converted',
  not_a_fit: 'Not a fit',
  do_not_contact: 'Do not contact',
};

export const EARLY_ACCESS_PLAN_LABELS: Record<string, string> = {
  team: 'Coaches Portal',
  league: 'League Plus',
  club: 'Club',
  club_large: 'Club · Association',
};

export const EARLY_ACCESS_FEATURE_LABELS: Record<string, string> = {
  house_league: 'House League',
  registration: 'Registration',
  public_site: 'Public site',
  accounting: 'Accounting',
  rep_teams: 'Rep Teams',
  coach_portal: 'Coach portal',
  communications: 'Communications',
  team_lineups: 'Team lineups',
  team_attendance: 'Team attendance',
  team_documents: 'Team documents',
  team_budget: 'Team budget',
  team_dues_automation: 'Team dues automation',
  team_player_development: 'Player development',
};

export const EARLY_ACCESS_SELECT = [
  'id',
  'created_at',
  'updated_at',
  'last_submitted_at',
  'submission_count',
  'status',
  'internal_status',
  'internal_notes',
  'name',
  'email',
  'organization_name',
  'role',
  'sports',
  'plan_interest',
  'features_interested',
  'notes',
  'source_path',
  'release_notifications_consent',
  'last_contacted_at',
  'last_contacted_by',
  'converted_org_id',
  'converted_at',
  'follow_up_due_at',
  'next_action',
].join(', ');

export type EarlyAccessFilters = {
  q: string;
  plan: string;
  feature: string;
  status: string;
  consent: string;
  dateFrom: string;
  dateTo: string;
};

export function parseEarlyAccessFilters(searchParams: URLSearchParams): EarlyAccessFilters {
  return {
    q: cleanSearch(searchParams.get('q')),
    plan: cleanToken(searchParams.get('plan')),
    feature: cleanToken(searchParams.get('feature')),
    status: cleanToken(searchParams.get('status')),
    consent: cleanToken(searchParams.get('consent')),
    dateFrom: cleanDate(searchParams.get('dateFrom')),
    dateTo: cleanDate(searchParams.get('dateTo')),
  };
}

export function parseLimit(value: string | null, fallback = 100, max = 500): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function parseOffset(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function isEarlyAccessStatus(value: string): value is EarlyAccessStatus {
  return EARLY_ACCESS_STATUSES.includes(value as EarlyAccessStatus);
}

export function cleanInternalNotes(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 4000);
}

export function cleanNextAction(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

export function cleanOptionalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function toCsvCell(value: unknown): string {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join('; ') : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function cleanSearch(value: string | null): string {
  return (value ?? '').replace(/[%,()]/g, ' ').trim().slice(0, 80);
}

function cleanToken(value: string | null): string {
  return (value ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
}

function cleanDate(value: string | null): string {
  const raw = (value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}
