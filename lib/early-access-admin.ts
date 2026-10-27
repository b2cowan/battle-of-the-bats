/**
 * A lead's step (Support console Stage 7, owner Q9 a 2026-10-27): seven, in the order the work happens. ⚠ Stored values
 * keep their spelling (migration 398 pins them with a CHECK): `converted` reads "Signed up", `pilot_candidate` "Pilot".
 * A Lost lead always carries one of LOST_REASONS; a Signed up lead is exactly one with a linked club (`linked_at`).
 */
export const EARLY_ACCESS_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'pilot_candidate',
  'waiting_for_launch',
  'converted',
  'lost',
] as const;

export type EarlyAccessStatus = (typeof EARLY_ACCESS_STATUSES)[number];

export const EARLY_ACCESS_STATUS_LABELS: Record<EarlyAccessStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  pilot_candidate: 'Pilot',
  waiting_for_launch: 'Waiting for launch',
  converted: 'Signed up',
  lost: 'Lost',
};

/** The steps staff pick in the edit form. Signed up is not one: it comes only from linking a club. */
export const PICKABLE_STATUSES = EARLY_ACCESS_STATUSES.filter(s => s !== 'converted');

/** Why a lead was lost (Q9 a; words /marketing 2026-10-27). The last also keeps it out of Copy emails and the export's email cell. */
export const LOST_REASONS = ['not_a_fit', 'chose_another_tool', 'price', 'not_this_season', 'no_reply', 'asked_not_to_contact'] as const;
export type LostReason = (typeof LOST_REASONS)[number];
export const LOST_REASON_LABELS: Record<LostReason, string> = {
  not_a_fit: 'Not a fit',
  chose_another_tool: 'Chose another tool',
  price: 'Price',
  not_this_season: 'Not this season',
  no_reply: 'No reply after three tries',
  asked_not_to_contact: 'Asked not to be contacted',
};

/** Where a lead came from, staff's short list (Q4 B). Null is "Not set", never a choice. */
export const LEAD_SOURCES = ['referral_club', 'tournament', 'search', 'social', 'event', 'pitch_deck', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral_club: 'Referral from a club',
  tournament: 'A tournament on FieldLogicHQ',
  search: 'Search',
  social: 'Social media',
  event: 'An event or conference',
  pitch_deck: 'A pitch deck',
  other: 'Other',
};
export const SOURCE_NOT_SET = 'Not set';

export function isLostReason(value: unknown): value is LostReason {
  return typeof value === 'string' && (LOST_REASONS as readonly string[]).includes(value);
}
export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === 'string' && (LEAD_SOURCES as readonly string[]).includes(value);
}

/** The page a lead's form sat on, in words (the form sends path + hash; the hash is dropped). */
export function leadPageLabel(sourcePath: string | null | undefined): string {
  const path = (sourcePath ?? '').split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
  if (path.startsWith('/coaches/team/')) return 'Inside the product (a coach asked)';
  const named: Record<string, string> = {
    '/start/league': 'The League Plus page',
    '/start/club': 'The Club page',
    '/pricing': 'The pricing page',
    '/for-clubs': 'For clubs',
    '/for-leagues': 'For leagues',
    '/for-coaches': 'For coaches',
    '/for-tournament-organizers': 'For tournament organizers',
    '/coaches/start': 'Coach start',
  };
  return named[path] ?? 'Other pages';
}

export const EARLY_ACCESS_PLAN_LABELS: Record<string, string> = {
  team: 'Coaches Portal',
  league: 'League Plus',
  club: 'Club',
  club_large: 'Club · Association',
};

export const EARLY_ACCESS_FEATURE_LABELS: Record<string, string> = {
  house_league: 'House league',
  registration: 'Registration',
  public_site: 'Public site',
  accounting: 'Accounting',
  rep_teams: 'Rep teams',
  coach_portal: 'Coach portal',
  communications: 'Communications',
  team_lineups: 'Team lineups',
  team_attendance: 'Team attendance',
  team_documents: 'Team documents',
  team_budget: 'Team budget',
  team_dues_automation: 'Team dues automation',
  team_player_development: 'Player development',
  team_practice_plans: 'Practice plans',
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

/**
 * What a lead edit's audit entry keeps (Support console Stage 7 Part 0, owner Q10 2026-10-27): which fields changed and
 * the step before and after, never a value a stranger typed or a staff member wrote (name, email, organization, words,
 * notes). The Audit log is open to every staff role; a lead's details are the growth power's alone.
 */
export function leadAuditValues(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changed = Object.keys(after)
    .filter(key => key !== 'updated_at' && key !== 'step_changed_at' && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .sort();
  // The source and the Lost reason are values from fixed lists, never anyone's words, so the timeline can say "set the
  // source: Referral from a club" (Stage 7 Part 4). Kept only when they changed.
  const codes = (row: Record<string, unknown>) => Object.fromEntries(
    (['source', 'lost_reason'] as const).filter(k => changed.includes(k)).map(k => [k, row[k] ?? null]));
  return {
    oldValue: { internal_status: before.internal_status ?? null, ...codes(before) },
    newValue: { changed, internal_status: after.internal_status ?? null, ...codes(after) },
  };
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
