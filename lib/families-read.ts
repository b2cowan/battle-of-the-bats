import 'server-only';
import { formOnFile, templatesForTeam as templatesForTeamRule } from './forms-coverage';
import { supabaseAdmin } from './supabase-admin';
import { attachPeopleForOrg } from './org-people';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { seasonDuesFigures, duesCreditFromRow, type PlayerDuesFigures } from './dues-ladder';
import type { CreditApplicationMode } from './dues-credits';
import type { DuesCreditKind } from './coach-dues-actual';
import { getFamilySuppressionList } from './family-email';
import { resolvePersonNamer, getRepDuesPaidBackByCredit } from './db';
import { FAMILY_MESSAGE_CAP, FAMILY_PAGE_WORDS as PW, FAMILY_DUPLICATE_WORDS } from './families-words';
import { fmt } from './coach-money-summary';
import { proposeDuplicates, unionFind, type DuplicateChildIn, type DuplicatePersonIn, type DuplicateProposal } from './families-duplicates';
import { isCurrentLeagueSeason, isCurrentRepYear, isLiveRegStatus, type AudiencePerson } from './families-audience';
import { listsByPerson } from './families-lists';
import { registrationOwes } from './league-price';
import { loadOrgLeagueReceivedCents } from './league-money-read';
import { orgDayKey } from './timezone';

/**
 * lib/families-read.ts — server-side assembly for the Families area (P2 chunks C–E; Club Tier Stage 5a).
 *
 * Every function takes an orgId that the CALLER has already authorized (the three-check rule — lib/families-auth.ts:
 * module_families, the plan carries it, and the member is not limited to a group of teams); every query here
 * re-scopes to that org anyway, so a leaked personId from another org reads as "not found", never as data.
 *
 * Assembly is deliberately in-process: one walk, one place where "owes money" means something.
 *
 * ⚠⚠ MONEY IS READ, NEVER RECOMPUTED (plan §1.3, E03). A child's Dues · Paid · Balance are the coach's Player dues
 * figures from the ONE derivation the team's book shows (`seasonDuesFigures`, lib/dues-ladder.ts) over the money
 * module's own rows: payments (`rep_dues_payments`), credits by kind, hand-backs. Until Stage 5a this file read the
 * installment paid STAMP — a projection stamped only once a whole installment is covered — so a part payment read as
 * nothing and a family with recorded payments could read differently here than on the team's Money hub. A house-league
 * fee is a paid / not-paid flag and is never summed into the rep figures.
 *
 * ⚠ EVERY READ IS PAGED AND ORDERED (E05): a Supabase select stops at 1,000 rows without an error, and paging without
 * an order on a column unique in the org is half of paging (lib/supabase-paging.ts).
 *
 * ⚠ THE ATTACH RUNS ONCE PER VISIT — the worklist's read, the area's entry — and never fails a read
 * (`attachPeopleForOrg` logs a failure and returns). It used to run on every read of the area (the family page, the
 * duplicates, the export), so each of them wrote before it read.
 */

// ── Types (the API payloads) ──────────────────────────────────────────────────

export interface FamilyChildRow {
  source: 'rep_roster' | 'league';
  sourceRowId: string;
  /** One child, however many seasons (E08): rep rows a CONFIRMED continuity link joins share a key; a league row is
   *  never folded into a rep row. */
  childKey: string;
  childName: string;
  /** Team name (rep) or "Season · Division" (league). */
  where: string;
  year: number | null;
  current: boolean;
  /** A house-league registration this season whose fee is not marked paid — the list's FEE NOT PAID chip on the child's
   *  line (Stage 5b). Never a dollar figure: a league fee is a paid / not-paid record. */
  feeUnpaid: boolean;
}

export interface WorklistFamily {
  personId: string;
  name: string;          // best-known guardian name, or the address when unnamed
  email: string;         // current address
  /** Every address ever seen, current AND former — what makes search find a
   *  family by an email the parent no longer uses (the project's founding job). */
  allEmails: string[];
  phone: string | null;
  children: FamilyChildRow[];
  /** What the family OWES in rep dues this season, in cents — each current child's Player dues Balance where it is above
   *  zero, summed. ⚠ Never the signed sum (/review 2026-10-17): a credit one child holds on one team's book does not pay
   *  another child's dues on another team's book, and netting them dropped a family that owes out of "Owes money". */
  repOwedCents: number;
  chasedAt: string | null;       // newest reminder stamp on an unpaid installment
  leagueUnpaidCount: number;     // current-season league regs with a fee, not marked paid
  /** What the family owes in house-league fees this season, in cents — the unpaid fees summed. With
   *  `repOwedCents`, the list's Balance (owner 2026-10-18: a family on "Owes money" never reads a dash there). */
  leagueOwedCents: number;
  missingFormsCount: number;     // rep children missing an active required template type
  hasConsent: boolean;           // any live family_consents row on any address
  optedOut: boolean;             // any address on the suppression list (through the PERSON)
  notBack: boolean;              // has only non-current children rows
}

/**
 * A child whose row names no family (Stage 5b, Ask 4): grouped under its team (a rep roster) or its season (house
 * league). ⚠ Since Club Stage 2 a rep roster is the COACH's: nothing on the club side can add a rep child's guardian, so a
 * rep row has no door (`href` null) and the list's "Ask the coaches" is the club's move. A house-league registration is
 * the club's own, so its row opens the season's registrations.
 */
export interface NoFamilyChild {
  source: 'rep_roster' | 'league';
  childName: string;
  /** The group the row sits under: a team's id (rep) or a season's (league). */
  groupId: string;
  /** The team's name, or the season's ("Summer 2026"). */
  groupName: string;
  reason: 'no_email' | 'unattached';
  /** Where the club fixes it, or null where only the team's coaches can (every rep row). */
  href: string | null;
}

export interface WorklistPayload {
  families: WorklistFamily[];
  noFamilyChildren: NoFamilyChild[];
  /** How many duplicate proposals stand (a group of three or more is ONE) — the Duplicates tab's waiting count. */
  duplicateCount: number;
}

/** One child's rep dues this season, in cents, in the coach's ladder words (E03). Event terms are zero when absent. */
export interface FamilyChildMoney {
  childKey: string;
  childName: string;
  where: string;
  year: number | null;
  /** The season's roster row, team and season — where a payment for this line is handed (Stage 5c, Record a payment). */
  rosterRowId: string;
  teamId: string;
  programYearId: string;
  duesCents: number;
  fundraisingCents: number;
  otherCreditsCents: number;
  paidCents: number;
  handedBackCents: number;
  balanceCents: number;
}

export interface FamilyMessageState {
  /** Guardians a message would reach (club email on, an address on file). Zero = no door, and the opted-out reason. */
  reachable: number;
  /** Today's three are spent (the cap — mig 334's `v_cap`), and when the next can go. */
  capped: boolean;
  nextAt: string | null;
  lastMessaged: { at: string; by: string | null } | null;
}

/**
 * One child on the family's record (Stage 5b, P2): each child ONCE (E08), this season's line where there is one — a rep
 * child with this season's Dues · Paid · Balance (`money`, null when the team keeps no dues for them), a house-league
 * child with its fee read into the same three columns (`league`) — and, after them, a child who is not back this
 * season, at the season they were last in.
 */
export interface FamilyChildLine {
  key: string;
  childName: string;
  source: 'rep_roster' | 'league';
  /** The team (rep) or "Season · Division" (league). */
  where: string;
  year: number | null;
  current: boolean;
  money: FamilyChildMoney | null;
  /** A house-league fee as a dues line; null figures when the season sets no fee. */
  league: LeagueFeeLine | null;
  /** The registration a house-league line is (Stage 5c: Record a payment marks its fee paid). */
  leagueReg: { id: string; seasonId: string } | null;
}

export interface FamilyPagePayload {
  person: { id: string; name: string; firstName: string | null; lastName: string | null; email: string; phone: string | null; createdAt: string };
  addresses: { email: string; isCurrent: boolean; firstSeenAt: string; lastSeenAt: string }[];
  children: FamilyChildRow[];
  /** The record's Children table (Stage 5b): each child once, this season first. */
  childLines: FamilyChildLine[];
  /** Distinct children (E08) — never the count of registration rows. */
  childCount: number;
  money: {
    children: FamilyChildMoney[];
    /** The family's figures, summed over every line of its Children table — rep dues and this season's house-league fees
     *  (owner 2026-10-18, §329 W3: the band adds up what the table shows, and counts what "Owes money" counts). Each rep
     *  child's line is still the team's own book (5a's parity); only the family total gains the fees. */
    duesCents: number;
    paidCents: number;
    /** What the family OWES — each line's balance above zero, summed: the list's Balance and the band's (never a credit
     *  one child holds on one team's book netted against another child's dues on another's — the 5a /review ruling). */
    owedCents: number;
    /** The children who owe, by name — the band's Balance caption. */
    owingChildren: string[];
    /** Distinct rep children the dues are for, and the house-league registrations with a fee — the band's Dues caption
     *  (a line per child-season would count twice). */
    repChildCount: number;
    leagueFeeCount: number;
    /** How many payments the team books recorded for these children this season, and how many house-league fees are
     *  marked paid — the band's Paid caption. */
    paymentCount: number;
    leagueFeesPaid: number;
    /** The rep seasons the figures are this season's of ("2026") — the band's Dues caption. */
    repYears: number[];
  };
  /** Where the family's contact details are typed (Ask 15: a detail is changed where it is typed, and the record names
   *  where) — this season's rows that name this person: each child's first name and the kind of row. */
  namedOn: { childFirstName: string; source: 'rep_roster' | 'league' }[];
  guardians: { personId: string; name: string; email: string; provenance: string }[];
  contact: { optedOut: boolean; optedOutVia: string | null };
  message: FamilyMessageState;
  forms: { childName: string; templateName: string; documentType: string; status: 'on_file' | 'missing' }[];
  consents: { basis: string; scope: string; startedAt: string; withdrawnAt: string | null }[];
  history: { at: string; what: string }[];
}

// The duplicate rule and its proposals live in lib/families-duplicates.ts (pure — one home, unit-tested).
export type { DuplicateProposal, DuplicateSide } from './families-duplicates';

// ── Shared raw reads ──────────────────────────────────────────────────────────

const toCents = (n: unknown): number => Math.round(Number(n ?? 0) * 100);

/** A house-league registration's fee in the Dues · Paid · Balance columns (owner 2026-10-18, §329 W3: the record's
 *  table reads one way for every child, and its band counts what the "Owes money" list counts). The fee is the price
 *  FIXED on the registration, else the season's (Club Tier 9b-1, lib/league-price.ts). Paid is what the season's book has
 *  received for it (Club Tier 9b-2: posted in − posted out, so a part payment after a price rise, or a refund, reads true —
 *  `receivedCents` from `loadOrgLeagueReceivedCents`); only an ACCEPTED child owes (Q1), so a child in review or on the
 *  waitlist has no balance yet. Null figures when no price is set (nothing is owed on it). */
export interface LeagueFeeLine {
  feeCents: number | null; paidCents: number; balanceCents: number;
  /** The club's day the price was fixed (the sign-up), for "Price fixed at sign-up, Oct 24" (9b-2 copy §13). */
  fixedOn: string | null;
}
export function leagueFeeLine(r: any): LeagueFeeLine {
  const fee = leagueRegOwes(r);
  const fixedOn = r.registered_at ? orgDayKey(r.registered_at) : null;
  if (fee == null) return { feeCents: null, paidCents: 0, balanceCents: 0, fixedOn };
  const feeCents = toCents(fee);
  const paidCents = typeof r.__receivedCents === 'number' ? r.__receivedCents : r.registration_fee_paid === true ? feeCents : 0;
  const owes = r.status === undefined || r.status === 'active';
  return { feeCents, paidCents, balanceCents: owes ? Math.max(0, feeCents - paidCents) : 0, fixedOn };
}

/** What a raw league_registrations row (with its league_seasons join) owes, in dollars: the one rule. */
export function leagueRegOwes(r: any): number | null {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return registrationOwes({ feeAmount: n(r.fee_amount) }, { registrationFee: n(r.league_seasons?.registration_fee) });
}

/** Every row of one org's table, paged, ordered on `id` (unique). */
function orgRows<T>(table: string, select: string, orgId: string, narrow?: (q: any) => any): Promise<T[]> {
  return fetchAll<T>((from, to) => {
    let q: any = supabaseAdmin.from(table).select(select).eq('org_id', orgId);
    if (narrow) q = narrow(q);
    return q.order('id').range(from, to);
  });
}

/**
 * `forDuplicates`: the duplicate rule's read (the club brief's count, the Duplicates tab, the merge route's re-check) —
 * it never reads consents or continuity links, so those two org-wide reads are skipped (and every child is its own key).
 */
async function loadOrgFamilyWorld(orgId: string, opts: { attach?: boolean; forDuplicates?: boolean } = {}) {
  // One idempotent attach per VISIT, so rows written since the last visit join their person the moment an admin
  // opens the area (mig 333 — the single home for the matching rules). Never fatal: it logs and the read goes on.
  if (opts.attach) await attachPeopleForOrg(orgId);
  const unless = <T>(skip: boolean | undefined, read: () => Promise<T[]>): Promise<T[]> => (skip ? Promise.resolve([]) : read());

  const [people, addresses, rosterRows, leagueRegs, links, optouts, consents, continuity] = await Promise.all([
    orgRows<any>('org_people', 'id, email_normalized, first_name, last_name, phone, created_at', orgId),
    orgRows<any>('org_person_emails', 'id, person_id, email_normalized, is_current, first_seen_at, last_seen_at', orgId),
    /**
     * ⚠⚠ **CALL-UPS ARE EXCLUDED HERE** (mig 309). The Families desk reads the roster RAW, org-wide, and filters with
     * `isLiveRegStatus` — "not declined, not withdrawn" — which happily admits `'callup'`. So every borrowed player
     * landed on the desk as **a child with no family**, and the admin could never clear the row: a call-up has no
     * `person_id`, the database forbids giving them a guardian email, and the player page 404s on one.
     */
    orgRows<any>('rep_roster_players',
      'id, person_id, player_first_name, player_last_name, player_date_of_birth, guardian_email, status, team_id, program_year_id, tryout_registration_id, created_at, rep_teams(name, slug), rep_program_years(year, status, name, credit_application)',
      orgId, q => q.neq('status', 'callup')),
    orgRows<any>('league_registrations',
      'id, person_id, player_first_name, player_last_name, player_date_of_birth, guardian_email, status, registration_fee_paid, fee_amount, waiver_accepted_at, registered_at, season_id, league_seasons(name, slug, status, registration_fee), league_divisions(name)',
      orgId),
    orgRows<any>('family_links', 'id, person_id, player_id, user_id, status, role, relationship, invited_email, claimed_email, updated_at', orgId),
    orgRows<any>('family_email_optouts', 'id, email, source, opted_out_at', orgId),
    unless(opts.forDuplicates, () => orgRows<any>('family_consents', 'id, guardian_email, basis, scope, basis_started_at, withdrawn_at', orgId)),
    // E08: a child's rep seasons are ONE child only where a person confirmed it (suggested and rejected links never join).
    unless(opts.forDuplicates, () => orgRows<any>('rep_player_continuity_links', 'id, current_roster_id, current_registration_id, prior_roster_id, prior_registration_id', orgId,
      q => q.eq('status', 'confirmed'))),
  ]);
  // What the season books have received for each registration (9b-2): the fee line reads it, never the paid flag alone.
  const received = opts.forDuplicates ? new Map<string, number>() : await loadOrgLeagueReceivedCents(orgId);
  for (const r of leagueRegs) r.__receivedCents = received.get(r.id) ?? 0;
  const byKey = <T>(rows: T[], key: (r: T) => string | null | undefined) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const k = key(r); if (!k) continue; const l = m.get(k); if (l) l.push(r); else m.set(k, [r]); }
    return m;
  };
  return {
    people, addresses, rosterRows, leagueRegs, links, optouts, consents, childKeyOf: childKeys(rosterRows, continuity),
    // Looked up per person on every page of the area — built once, never a scan of the org's rows per person.
    personById: new Map(people.map((p: any) => [p.id as string, p])),
    rosterByPerson: byKey(rosterRows, r => r.person_id),
    leagueByPerson: byKey(leagueRegs, r => r.person_id),
    linksByPerson: byKey(links, (l: any) => l.person_id),
    linksByPlayer: byKey(links, (l: any) => l.player_id),
  };
}

type World = Awaited<ReturnType<typeof loadOrgFamilyWorld>>;

/**
 * E08 — which rep roster rows are ONE child. Union over CONFIRMED `rep_player_continuity_links`, minding the alias
 * rule (DATA_DICTIONARY gotcha 4): a link's side may name the tryout REGISTRATION a roster row came from, never
 * rewritten when the registration was accepted, so a registration id resolves to the roster row that carries it as
 * `tryout_registration_id`. A side naming a registration no roster row came from joins nothing.
 */
function childKeys(rosterRows: any[], links: any[]): (rosterId: string) => string {
  const { find, union } = unionFind();
  const rosterIds = new Set(rosterRows.map(r => r.id as string));
  const rosterOfRegistration = new Map<string, string>();
  for (const r of rosterRows) if (r.tryout_registration_id) rosterOfRegistration.set(r.tryout_registration_id, r.id);
  const side = (rosterId: string | null, registrationId: string | null) =>
    rosterId && rosterIds.has(rosterId) ? rosterId : registrationId ? rosterOfRegistration.get(registrationId) ?? null : null;
  for (const l of links) {
    const a = side(l.current_roster_id, l.current_registration_id);
    const b = side(l.prior_roster_id, l.prior_registration_id);
    if (a && b) union(a, b);
  }
  return (rosterId: string) => `rep:${find(rosterId)}`;
}

// The three row predicates live in lib/families-audience.ts (pure, so Email families' audience is unit-tested against
// the SAME definitions this file reads with) — imported, never restated.

function childRowFromRoster(r: any, keyOf: (id: string) => string): FamilyChildRow {
  return {
    source: 'rep_roster', sourceRowId: r.id, childKey: keyOf(r.id),
    childName: fullName(r.player_first_name, r.player_last_name),
    where: r.rep_teams?.name ?? 'Rep team',
    year: r.rep_program_years?.year ?? null,
    current: isCurrentRepYear(r),
    feeUnpaid: false,
  };
}
function childRowFromLeague(r: any): FamilyChildRow {
  const div = r.league_divisions?.name ? ` · ${r.league_divisions.name}` : '';
  const current = isCurrentLeagueSeason(r);
  return {
    source: 'league', sourceRowId: r.id, childKey: `league:${r.id}`,
    childName: fullName(r.player_first_name, r.player_last_name),
    where: `${r.league_seasons?.name ?? 'House league'}${div}`,
    year: null,
    current,
    // Owed only when the season sets a fee (/review 2026-10-18): a free season marked unpaid owes nothing.
    feeUnpaid: current && leagueFeeLine(r).balanceCents > 0,
  };
}

function personDisplayName(p: any): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return name || p.email_normalized;
}

const fullName = (first: string | null, last: string | null) =>
  `${first ?? ''} ${last ?? ''}`.trim();

/** ONE comparator for a family's child rows — the worklist and the family page
 *  must never drift on this order. */
function buildChildRows(roster: any[], league: any[], keyOf: (id: string) => string): FamilyChildRow[] {
  return [
    ...roster.map(r => childRowFromRoster(r, keyOf)),
    ...league.map(childRowFromLeague),
  ].sort((a, b) => a.childName.localeCompare(b.childName) || (b.year ?? 0) - (a.year ?? 0));
}

/** Distinct children among a family's rows (E08). */
export const countChildren = (rows: readonly FamilyChildRow[]) => new Set(rows.map(r => r.childKey)).size;

/** Newest of the three reminder stamp columns on an installment row. */
function latestReminderStamp(i: any): string | null {
  let latest: string | null = null;
  for (const s of [i.reminder_sent_at, i.reminder_30_sent_at, i.reminder_7_sent_at]) {
    if (s && (!latest || s > latest)) latest = s;
  }
  return latest;
}

/** Forms coverage for a set of roster rows — the one home for the
 *  "org-wide OR this team's templates, minus documents on file" rule. */
async function loadFormsData(orgId: string, rosterIds: string[]) {
  const [templates, docs] = await Promise.all([
    orgRows<any>('rep_document_templates', 'id, team_id, name, document_type, is_active', orgId, q => q.eq('is_active', true)),
    fetchAllIn<any>(rosterIds, (chunk, from, to) => supabaseAdmin.from('rep_player_documents')
      .select('id, player_id, document_type').eq('org_id', orgId).in('player_id', chunk).order('id').range(from, to)),
  ]);
  const docTypesByPlayer = new Map<string, Set<string>>();
  for (const d of docs) {
    const set = docTypesByPlayer.get(d.player_id) ?? new Set<string>();
    set.add(d.document_type); docTypesByPlayer.set(d.player_id, set);
  }
  return {
    // The applies-to rule is shared with the club's Rep Teams board (lib/forms-coverage.ts).
    templatesForTeam: (teamId: string) => templatesForTeamRule(templates, teamId),
    docTypesByPlayer,
  };
}

// ── Money: the money module's own rows, the team's own derivation (E03) ───────────────────────────

export interface RepMoneyRows {
  /** Each roster row's Player dues figures, as the team's book shows them. */
  figures: Map<string, PlayerDuesFigures>;
  payments: { id: string; playerId: string; amount: number; receivedDate: string; method: string | null }[];
  credits: { id: string; playerId: string; kind: DuesCreditKind; amount: number; creditDate: string | null; description: string | null }[];
  /** Each installment with every reminder stamp it carries (the export lists each one) and the newest of them. */
  installments: { playerId: string; installmentNumber: number; dueDate: string; paidAt: string | null; reminders: string[]; lastReminderAt: string | null }[];
}

/**
 * The dues rows for a set of roster rows (any seasons), read the money module's way, and each row's figures from
 * `seasonDuesFigures` — called once per season with that season's credit direction, exactly as the coach's dues route
 * calls it. Roster rows are per season, so a row's figures never mix two seasons.
 */
export async function readRepMoney(orgId: string, rosterRows: readonly any[]): Promise<RepMoneyRows> {
  const ids = [...new Set(rosterRows.map(r => r.id as string))];
  if (ids.length === 0) return { figures: new Map(), payments: [], credits: [], installments: [] };
  const byIds = <T>(table: string, select: string, scoped = true) => fetchAllIn<T>(ids, (chunk, from, to) => {
    let q: any = supabaseAdmin.from(table).select(select).in('player_id', chunk);
    if (scoped) q = q.eq('org_id', orgId);
    return q.order('id').range(from, to);
  });
  // The paid-back links by the coach's own read (`getRepDuesPaidBackByCredit`, per season) — the input the team's book
  // gives the derivation, never a second reading of it.
  const seasonIds = [...new Set(rosterRows.map(r => r.program_year_id as string))];
  const [schedules, payments, payouts, credits, installments, paidBackBySeason] = await Promise.all([
    byIds<any>('rep_player_dues_schedules', 'id, player_id, total_amount'),
    byIds<any>('rep_dues_payments', 'id, player_id, amount, received_date, method'),
    byIds<any>('rep_dues_payouts', 'id, player_id, amount'),
    // ⚠ rep_dues_credits carries no org_id; the ids are this org's own roster rows (read org-scoped above), which is
    // what scopes it.
    byIds<any>('rep_dues_credits', 'id, player_id, amount, credit_type, credit_date, created_at, description, fundraiser_entry_id, expense_id', false),
    byIds<any>('rep_player_dues_installments', 'id, player_id, installment_number, due_date, paid_at, reminder_sent_at, reminder_30_sent_at, reminder_7_sent_at'),
    Promise.all(seasonIds.map(getRepDuesPaidBackByCredit)),
  ]);
  const paidBack = new Map<string, number>(paidBackBySeason.flatMap(m => [...m]));

  const figures = new Map<string, PlayerDuesFigures>();
  const seasons = new Map<string, { mode: CreditApplicationMode; playerIds: Set<string> }>();
  for (const r of rosterRows) {
    const s = seasons.get(r.program_year_id) ?? { mode: (r.rep_program_years?.credit_application ?? 'next_first') as CreditApplicationMode, playerIds: new Set<string>() };
    s.playerIds.add(r.id); seasons.set(r.program_year_id, s);
  }
  for (const { mode, playerIds } of seasons.values()) {
    const mine = <T extends { player_id: string }>(list: T[]) => list.filter(x => playerIds.has(x.player_id));
    const season = seasonDuesFigures({
      schedules: mine(schedules).map(s => ({ playerId: s.player_id, total: Number(s.total_amount) })),
      payments: mine(payments).map(p => ({ playerId: p.player_id, amount: Number(p.amount) })),
      payouts: mine(payouts).map(p => ({ playerId: p.player_id, amount: Number(p.amount) })),
      credits: mine(credits).map(c => duesCreditFromRow(c, paidBack)),
      mode,
    }, [...playerIds]);
    for (const [k, v] of season) figures.set(k, v);
  }
  return {
    figures,
    payments: payments.map(p => ({ id: p.id, playerId: p.player_id, amount: Number(p.amount), receivedDate: p.received_date, method: p.method ?? null })),
    credits: credits.map(c => ({ id: c.id, playerId: c.player_id, kind: c.credit_type as DuesCreditKind, amount: Number(c.amount), creditDate: c.credit_date ?? null, description: c.description ?? null })),
    installments: installments.map(i => ({
      playerId: i.player_id, installmentNumber: i.installment_number, dueDate: i.due_date, paidAt: i.paid_at ?? null,
      reminders: [i.reminder_30_sent_at, i.reminder_7_sent_at, i.reminder_sent_at].filter(Boolean) as string[],
      lastReminderAt: latestReminderStamp(i),
    })),
  };
}

/** One child's figures in cents, summed across the child's rows this season (a child on two teams this season). */
function childMoney(rows: readonly any[], figures: Map<string, PlayerDuesFigures>, keyOf: (id: string) => string): FamilyChildMoney[] {
  const out = new Map<string, FamilyChildMoney>();
  for (const r of rows) {
    const f = figures.get(r.id);
    if (!f) continue;
    // One line per child PER SEASON: a confirmed continuity link joins a child's seasons, but a season's figures are that
    // season's book — two live seasons never sum into one line (/review 2026-10-17).
    const key = `${keyOf(r.id)}|${r.program_year_id}`;
    const m = out.get(key) ?? {
      childKey: key, childName: fullName(r.player_first_name, r.player_last_name), where: r.rep_teams?.name ?? 'Rep team',
      year: r.rep_program_years?.year ?? null,
      rosterRowId: r.id, teamId: r.team_id, programYearId: r.program_year_id,
      duesCents: 0, fundraisingCents: 0, otherCreditsCents: 0, paidCents: 0, handedBackCents: 0, balanceCents: 0,
    };
    m.duesCents += toCents(f.ladder.dues);
    m.fundraisingCents += toCents(f.ladder.fundraising);
    m.otherCreditsCents += toCents(f.ladder.otherCredits);
    m.paidCents += toCents(f.ladder.paid);
    m.handedBackCents += toCents(f.ladder.handedBack);
    m.balanceCents += toCents(f.balance);
    out.set(key, m);
  }
  // A child with no schedule and no money moved has nothing to show.
  return [...out.values()].filter(m => m.duesCents || m.paidCents || m.balanceCents || m.fundraisingCents || m.otherCreditsCents || m.handedBackCents)
    .sort((a, b) => a.childName.localeCompare(b.childName));
}

// ── The worklist (chunk C) ────────────────────────────────────────────────────

export async function buildWorklist(orgId: string, orgSlug: string): Promise<WorklistPayload> {
  // The area's entry: the one read that runs the attach.
  const world = await loadOrgFamilyWorld(orgId, { attach: true });
  const [families, duplicatePairs] = await Promise.all([worklistFamilies(orgId, world), buildDuplicatePairs(orgId, world)]);
  const noFamilyChildren = childrenWithNoFamily(world.rosterRows, world.leagueRegs, orgSlug);
  return { families, noFamilyChildren, duplicateCount: duplicatePairs.length };
}

/** Every person of the club as the list shows them — the ONE place a family's money, forms and consent are worked out
 *  (the Families tab and Email families' lists both read it). */
async function worklistFamilies(orgId: string, world: Awaited<ReturnType<typeof loadOrgFamilyWorld>>): Promise<WorklistFamily[]> {
  const { people, addresses, rosterRows, optouts, consents, childKeyOf } = world;

  const addressesByPerson = new Map<string, any[]>();
  for (const a of addresses) {
    const list = addressesByPerson.get(a.person_id) ?? [];
    list.push(a); addressesByPerson.set(a.person_id, list);
  }
  const optoutSet = new Set(optouts.map((o: any) => o.email));
  const liveConsentEmails = new Set(
    consents.filter((c: any) => !c.withdrawn_at).map((c: any) => c.guardian_email),
  );

  // Dues + forms for current rep years — independent reads, one batch.
  const currentRoster = rosterRows.filter(isCurrentRepYear);
  const currentRosterIds = currentRoster.map(r => r.id);
  const [money, formsData] = await Promise.all([
    readRepMoney(orgId, currentRoster),
    loadFormsData(orgId, currentRosterIds),
  ]);
  const { templatesForTeam, docTypesByPlayer } = formsData;

  const chasedByPlayer = new Map<string, string>();
  for (const i of money.installments) {
    if (i.paidAt || !i.lastReminderAt) continue;
    const cur = chasedByPlayer.get(i.playerId);
    if (!cur || i.lastReminderAt > cur) chasedByPlayer.set(i.playerId, i.lastReminderAt);
  }

  const families: WorklistFamily[] = [];
  for (const p of people) {
    const myAddresses = (addressesByPerson.get(p.id) ?? []).map(a => a.email_normalized);
    const myRoster = (world.rosterByPerson.get(p.id) ?? []).filter(r => isLiveRegStatus(r.status ?? 'active'));
    const myLeague = (world.leagueByPerson.get(p.id) ?? []).filter(r => isLiveRegStatus(r.status));
    // Tryout-only people (kept deliberately, §5-P1) stay IN the list with no
    // children — they carry no lens work (every predicate needs child rows) but
    // must be reachable: search and the All lens are their only doors, and a
    // person the UI cannot reach cannot answer "what do you hold about me".

    const children = buildChildRows(myRoster, myLeague, childKeyOf);
    const myCurrentRoster = myRoster.filter(isCurrentRepYear);

    let repOwedCents = 0; let chasedAt: string | null = null;
    for (const r of myCurrentRoster) {
      const f = money.figures.get(r.id);
      if (f) repOwedCents += Math.max(0, toCents(f.balance));
      const c = chasedByPlayer.get(r.id);
      if (c && (!chasedAt || c > chasedAt)) chasedAt = c;
    }

    let missingFormsCount = 0;
    for (const r of myCurrentRoster) {
      const have = docTypesByPlayer.get(r.id) ?? new Set();
      for (const t of templatesForTeam(r.team_id)) {
        if (!formOnFile(have, t)) missingFormsCount++;
      }
    }

    const hasCurrent = children.some(c => c.current);
    families.push({
      personId: p.id,
      name: personDisplayName(p),
      email: p.email_normalized,
      allEmails: myAddresses,
      phone: p.phone ?? null,
      children,
      repOwedCents,
      chasedAt,
      leagueUnpaidCount: myLeague.filter(r => isCurrentLeagueSeason(r) && leagueFeeLine(r).balanceCents > 0).length,
      leagueOwedCents: myLeague.filter(isCurrentLeagueSeason).reduce((s, r) => s + leagueFeeLine(r).balanceCents, 0),
      missingFormsCount,
      hasConsent: myAddresses.some(a => liveConsentEmails.has(a)),
      optedOut: myAddresses.some(a => optoutSet.has(a)),
      notBack: !hasCurrent && children.length > 0,
    });
  }
  families.sort((a, b) => a.name.localeCompare(b.name));
  return families;
}

/**
 * The children whose rows name no family this season (Stage 5b, Ask 4) — rep rows grouped under their team, league rows
 * under their season. A rep row has no door: since Club Stage 2 only the team's coaches can add a guardian to a rep roster
 * (the list says so, and "Ask the coaches" asks them). A house-league registration is the club's own: its row opens the
 * season's registrations (no single registration has an address of its own). Shared by the worklist and Ask the coaches,
 * so the list and the emails name the same children.
 */
function childrenWithNoFamily(rosterRows: readonly any[], leagueRegs: readonly any[], orgSlug: string): NoFamilyChild[] {
  const out: NoFamilyChild[] = [];
  const reason = (r: any): NoFamilyChild['reason'] => (r.guardian_email && String(r.guardian_email).trim() ? 'unattached' : 'no_email');
  for (const r of rosterRows) {
    if (r.person_id || !isCurrentRepYear(r) || !isLiveRegStatus(r.status ?? 'active')) continue;
    out.push({
      source: 'rep_roster', childName: fullName(r.player_first_name, r.player_last_name),
      groupId: r.team_id, groupName: r.rep_teams?.name ?? 'Rep team', reason: reason(r), href: null,
    });
  }
  for (const r of leagueRegs) {
    if (r.person_id || !isCurrentLeagueSeason(r) || !isLiveRegStatus(r.status)) continue;
    out.push({
      source: 'league', childName: fullName(r.player_first_name, r.player_last_name),
      groupId: r.season_id, groupName: r.league_seasons?.name ?? 'House league', reason: reason(r),
      href: `/${orgSlug}/admin/house-league/seasons/${r.season_id}/registrations`,
    });
  }
  // Rep teams first, then league seasons; each group by name (then its id, so two teams that share a name stay two
  // bands), each child by name.
  return out.sort((a, b) => (a.source === b.source ? 0 : a.source === 'rep_roster' ? -1 : 1)
    || a.groupName.localeCompare(b.groupName) || a.groupId.localeCompare(b.groupId) || a.childName.localeCompare(b.childName));
}

/** Ask the coaches' read (Stage 5b, Ask 4): this season's rep children with no family on file, by team. */
export async function repChildrenWithNoFamily(orgId: string, orgSlug: string): Promise<{ teamId: string; teamName: string; children: string[] }[]> {
  const rosterRows = await orgRows<any>('rep_roster_players',
    'id, person_id, player_first_name, player_last_name, guardian_email, status, team_id, rep_teams(name), rep_program_years(status)',
    orgId, q => q.neq('status', 'callup').is('person_id', null));
  const byTeam = new Map<string, { teamId: string; teamName: string; children: string[] }>();
  for (const c of childrenWithNoFamily(rosterRows, [], orgSlug)) {
    const t = byTeam.get(c.groupId) ?? { teamId: c.groupId, teamName: c.groupName, children: [] };
    t.children.push(c.childName);
    byTeam.set(c.groupId, t);
  }
  return [...byTeam.values()];
}

// ── The household (the page, the message window and the send share ONE read) ─────────────────────

export interface Household {
  person: any;
  /** This person's live rep rows and league rows. */
  roster: any[];
  league: any[];
  /** The person, then every other person holding a VERIFIED family link on one of the same children. */
  guardians: { personId: string; name: string; email: string; provenance: string }[];
}

/**
 * Guardians: this person + any other person holding a VERIFIED family_link on one of the same children (the data's
 * own second guardian — a READ, plan §5.3 gap 6; adding one is P3's write).
 * ⚠ status === 'verified' is LOAD-BEARING, not a nicety: declined and revoked links exist precisely to record that a
 * coach REJECTED or REMOVED someone (custody disputes are the canonical case), and the attach function gives those rows
 * a person_id like any other. Without this filter a removed guardian appears on the page, rides the export, and gets
 * the household's email — the player-documents-leak class of failure (review 2026-08-17).
 */
function householdOf(world: World, p: any): Household {
  const roster = (world.rosterByPerson.get(p.id) ?? []).filter(r => isLiveRegStatus(r.status ?? 'active'));
  const league = (world.leagueByPerson.get(p.id) ?? []).filter(r => isLiveRegStatus(r.status));
  // E09: a person known only through a family portal invitation says so — they were labelled "Named on a tryout".
  // A person with no roster, registration or link row came from a tryout application.
  const ownLinks = world.linksByPerson.get(p.id) ?? [];
  const provenance = roster.length ? 'Named on rosters' : league.length ? 'Named on registrations'
    : ownLinks.length ? PW.linkOnly : 'Named on a tryout';
  const guardians: Household['guardians'] = [{ personId: p.id, name: personDisplayName(p), email: p.email_normalized, provenance }];
  // ⚠ A co-guardian is judged by their NEWEST link to this family's children, across every season and team
  // (/review 2026-10-17): a guardian a coach revoked this season, still "verified" on last season's roster row, is NOT the
  // household. A revocation is the coach's latest word (the custody case); an older approval never outvotes it.
  const newestByPerson = new Map<string, any>();
  for (const l of roster.flatMap(r => world.linksByPlayer.get(r.id) ?? [])) {
    if (!l.person_id || l.person_id === p.id) continue;
    const cur = newestByPerson.get(l.person_id);
    if (!cur || String(l.updated_at ?? '') > String(cur.updated_at ?? '')) newestByPerson.set(l.person_id, l);
  }
  for (const [personId, l] of newestByPerson) {
    if (l.status !== 'verified') continue;
    const other: any = world.personById.get(personId);
    if (!other) continue;
    guardians.push({
      personId: other.id, name: personDisplayName(other), email: other.email_normalized,
      provenance: l.relationship ? `Connected guardian · ${l.relationship}` : 'Connected guardian',
    });
  }
  return { person: p, roster, league, guardians };
}

/** One family's send log as the door needs it (Ask 9): the last 24 hours (the cap's window) and the newest send, its
 *  sender named. Bounded — never the family's whole history. */
async function readMessageLog(orgId: string, personId: string) {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [recent, newest] = await Promise.all([
    supabaseAdmin.from('family_messages').select('id, sent_at').eq('org_id', orgId).eq('person_id', personId)
      .gt('sent_at', dayAgo).order('sent_at', { ascending: true }).limit(FAMILY_MESSAGE_CAP * 4),
    supabaseAdmin.from('family_messages').select('id, sent_at, sent_by').eq('org_id', orgId).eq('person_id', personId)
      .order('sent_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (recent.error) throw recent.error;
  if (newest.error) throw newest.error;
  const nameOf = await resolvePersonNamer(orgId, [newest.data?.sent_by]);
  return {
    recent: (recent.data ?? []) as { sent_at: string }[],
    last: newest.data ? { at: newest.data.sent_at as string, by: nameOf(newest.data.sent_by) } : null,
  };
}

/** The door's state: who it reaches, the cap, the last send. Mirrors family_message_claim — the next slot opens 24 hours
 *  after the send that filled the window (the claim, not this, decides a press). */
function messageState(log: Awaited<ReturnType<typeof readMessageLog>>, guardians: Household['guardians'], suppressed: Set<string>): FamilyMessageState {
  const capped = log.recent.length >= FAMILY_MESSAGE_CAP;
  const filler = capped ? log.recent[log.recent.length - FAMILY_MESSAGE_CAP] : null;
  return {
    reachable: guardians.filter(g => g.email && !suppressed.has(g.email)).length,
    capped,
    nextAt: filler ? new Date(new Date(filler.sent_at).getTime() + 24 * 3600 * 1000).toISOString() : null,
    lastMessaged: log.last,
  };
}

// ── The family page (chunk D) ─────────────────────────────────────────────────

export async function buildFamilyPage(orgId: string, personId: string): Promise<FamilyPagePayload | null> {
  const world = await loadOrgFamilyWorld(orgId);
  const p: any = world.personById.get(personId);
  if (!p) return null; // wrong org or unknown id — indistinguishable on purpose

  const myAddresses = world.addresses
    .filter((a: any) => a.person_id === p.id)
    .sort((a: any, b: any) => Number(b.is_current) - Number(a.is_current) || (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''));
  const addressSet = new Set(myAddresses.map((a: any) => a.email_normalized));

  const household = householdOf(world, p);
  const { roster: myRoster, league: myLeague, guardians } = household;
  const children = buildChildRows(myRoster, myLeague, world.childKeyOf);

  // Money — READ through the team's own derivation (header note). Current rep years only.
  const currentRoster = myRoster.filter(isCurrentRepYear);
  const [money, formsData, suppressed, log] = await Promise.all([
    readRepMoney(orgId, currentRoster),
    loadFormsData(orgId, currentRoster.map(r => r.id)),
    getFamilySuppressionList(orgId),
    readMessageLog(orgId, p.id),
  ]);
  const message = messageState(log, guardians, suppressed);

  const moneyChildren = childMoney(currentRoster, money.figures, world.childKeyOf);

  const myOptouts = world.optouts.filter((o: any) => addressSet.has(o.email));
  const forms: FamilyPagePayload['forms'] = [];
  for (const r of currentRoster) {
    const have = formsData.docTypesByPlayer.get(r.id) ?? new Set<string>();
    for (const t of formsData.templatesForTeam(r.team_id)) {
      forms.push({
        childName: fullName(r.player_first_name, r.player_last_name),
        templateName: t.name, documentType: t.document_type,
        status: formOnFile(have, t) ? 'on_file' : 'missing',
      });
    }
  }

  const consents = world.consents
    .filter((c: any) => addressSet.has(c.guardian_email))
    .map((c: any) => ({ basis: c.basis, scope: c.scope, startedAt: c.basis_started_at, withdrawnAt: c.withdrawn_at ?? null }));

  // History: what is actually RECORDED — registrations, payment rows (the money module's own, with the dollar sign),
  // address changes, consents. Reminders and messages are not history lines (the message window says the last send).
  const history: FamilyPagePayload['history'] = [];
  for (const r of myRoster) history.push({ at: r.created_at, what: `Rostered ${r.player_first_name} · ${r.rep_teams?.name ?? 'rep team'} ${r.rep_program_years?.year ?? ''}`.trim() });
  for (const r of myLeague) history.push({ at: r.registered_at, what: `Registered ${r.player_first_name} · ${r.league_seasons?.name ?? 'house league'}` });
  for (const pay of money.payments) {
    const child = currentRoster.find(r => r.id === pay.playerId);
    history.push({ at: pay.receivedDate, what: PW.payment(fmt(pay.amount), child?.player_first_name ?? 'dues') });
  }
  for (const a of myAddresses) {
    if (!a.is_current) history.push({ at: a.last_seen_at, what: `Address changed from ${a.email_normalized}` });
  }
  for (const c of consents) history.push({ at: c.startedAt, what: `Consent recorded (${c.basis})` });
  history.sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''));

  const sum = (f: (m: FamilyChildMoney) => number) => moneyChildren.reduce((s, m) => s + f(m), 0);

  // The record's Children table: each child once (E08), this season's line first.
  const childLines: FamilyChildLine[] = [];
  const shown = new Set<string>();
  const childKeyOfLine = (k: string) => k.split('|')[0];
  for (const m of moneyChildren) {
    childLines.push({ key: m.childKey, childName: m.childName, source: 'rep_roster', where: m.where, year: m.year, current: true, money: m, league: null, leagueReg: null });
    shown.add(childKeyOfLine(m.childKey));
  }
  for (const c of children.filter(x => x.current && x.source === 'rep_roster')) {
    if (shown.has(c.childKey)) continue;
    shown.add(c.childKey);
    childLines.push({ key: c.childKey, childName: c.childName, source: 'rep_roster', where: c.where, year: c.year, current: true, money: null, league: null, leagueReg: null });
  }
  for (const r of myLeague.filter(isCurrentLeagueSeason)) {
    const c = childRowFromLeague(r);
    shown.add(c.childKey);
    childLines.push({
      key: c.childKey, childName: c.childName, source: 'league', where: c.where, year: null, current: true, money: null,
      league: leagueFeeLine(r), leagueReg: { id: r.id, seasonId: r.season_id },
    });
  }
  // This season's house-league fees — the band adds them to the rep figures (owner 2026-10-18).
  const feeLines = childLines.filter(l => l.league?.feeCents != null);
  const feeSum = (f: (l: LeagueFeeLine) => number) => feeLines.reduce((s, l) => s + f(l.league!), 0);
  // Not back this season: each such child once, at the season they were last in (`children` is newest year first).
  // ⚠ A league registration is its own key every season, and a rep row joins its earlier seasons only through a
  // CONFIRMED continuity link — so a child who IS back under a new row would read "not back" beside this season's line.
  // Within one family a name already on this season's lines is that child (/review 2026-10-17).
  const currentNames = new Set(childLines.map(l => l.childName.trim().toLowerCase()));
  for (const c of children) {
    if (c.current || shown.has(c.childKey) || currentNames.has(c.childName.trim().toLowerCase())) continue;
    shown.add(c.childKey);
    childLines.push({ key: c.childKey, childName: c.childName, source: c.source, where: c.where, year: c.year, current: false, money: null, league: null, leagueReg: null });
  }
  childLines.sort((a, b) => Number(b.current) - Number(a.current) || a.childName.localeCompare(b.childName));

  const namedOn: FamilyPagePayload['namedOn'] = [
    ...currentRoster.map(r => ({ childFirstName: (r.player_first_name ?? '').trim(), source: 'rep_roster' as const })),
    ...myLeague.filter(isCurrentLeagueSeason).map(r => ({ childFirstName: (r.player_first_name ?? '').trim(), source: 'league' as const })),
  ].filter(n => n.childFirstName);

  return {
    person: {
      id: p.id, name: personDisplayName(p),
      firstName: p.first_name ?? null, lastName: p.last_name ?? null,
      email: p.email_normalized, phone: p.phone ?? null, createdAt: p.created_at,
    },
    addresses: myAddresses.map((a: any) => ({
      email: a.email_normalized, isCurrent: a.is_current,
      firstSeenAt: a.first_seen_at, lastSeenAt: a.last_seen_at,
    })),
    children,
    childLines,
    childCount: countChildren(children),
    money: {
      children: moneyChildren,
      duesCents: sum(m => m.duesCents) + feeSum(f => f.feeCents ?? 0),
      paidCents: sum(m => m.paidCents) + feeSum(f => f.paidCents),
      owedCents: sum(m => Math.max(0, m.balanceCents)) + feeSum(f => f.balanceCents),
      // One child, however many live seasons owe (a child-season line each in `children`).
      owingChildren: [...new Set([
        ...moneyChildren.filter(m => m.balanceCents > 0).map(m => m.childName),
        ...feeLines.filter(l => l.league!.balanceCents > 0).map(l => l.childName),
      ])],
      repChildCount: new Set(moneyChildren.map(m => m.childKey.split('|')[0])).size,
      // Children, not registrations: the caption says "1 house league" for one child however many fees (/review).
      leagueFeeCount: new Set(feeLines.map(l => l.childName)).size,
      paymentCount: money.payments.length,
      leagueFeesPaid: feeLines.filter(l => l.league!.paidCents > 0).length,
      repYears: [...new Set(moneyChildren.map(m => m.year).filter((y): y is number => y != null))].sort(),
    },
    namedOn,
    guardians,
    contact: {
      optedOut: myOptouts.length > 0,
      optedOutVia: myOptouts.length ? (myOptouts[0] as any).email : null,
    },
    message,
    forms,
    consents,
    history: history.slice(0, 30),
  };
}


// ── Duplicates (chunk E; the rule redrawn in Stage 5b — lib/families-duplicates.ts) ─────────────────────────────────

/**
 * The standing duplicate proposals for an org: the rows read here, the rule applied there (one home). Rejections
 * ("not the same person") and the edited-email moves (E02) are read with them. ⚠ No attach here: the area's entry ran it.
 */
export async function buildDuplicatePairs(orgId: string, preloaded?: World): Promise<DuplicateProposal[]> {
  // The rule's own two reads run beside the world's (one round trip, not two).
  const [world, rejections, reattachments] = await Promise.all([
    preloaded ?? loadOrgFamilyWorld(orgId, { forDuplicates: true }),
    orgRows<{ person_a_id: string; person_b_id: string }>('org_person_match_rejections', 'id, person_a_id, person_b_id', orgId),
    orgRows<{ from_person_id: string; to_person_id: string; source_table: string; source_id: string; at: string }>(
      'org_person_reattachments', 'id, from_person_id, to_person_id, source_table, source_id, at', orgId),
  ]);
  const { people, addresses, rosterRows, leagueRegs, optouts } = world;
  const rejected = new Set(rejections.map(r => (r.person_a_id < r.person_b_id ? `${r.person_a_id}|${r.person_b_id}` : `${r.person_b_id}|${r.person_a_id}`)));

  const optoutSet = new Set(optouts.map((o: any) => o.email));
  const addressesByPerson = new Map<string, string[]>();
  for (const a of addresses) {
    const list = addressesByPerson.get(a.person_id) ?? [];
    list.push(a.email_normalized); addressesByPerson.set(a.person_id, list);
  }
  // Live rows only — a declined/withdrawn registration is not evidence of a shared child.
  const childrenByPerson = new Map<string, DuplicateChildIn[]>();
  const add = (personId: string, c: DuplicateChildIn) => {
    const list = childrenByPerson.get(personId) ?? [];
    if (!list.some(x => x.name === c.name && x.context === c.context)) list.push(c);
    childrenByPerson.set(personId, list);
  };
  for (const r of rosterRows) {
    if (!r.person_id || !isLiveRegStatus(r.status ?? 'active')) continue;
    const year = r.rep_program_years?.year;
    add(r.person_id, {
      name: fullName(r.player_first_name, r.player_last_name), birthDate: r.player_date_of_birth ?? null,
      context: `rep:${r.team_id}:${r.program_year_id}`,
      where: `${r.rep_teams?.name ?? 'Rep team'}${year ? ` · ${year}` : ''}`,
    });
  }
  for (const r of leagueRegs) {
    if (!r.person_id || !isLiveRegStatus(r.status)) continue;
    const c = childRowFromLeague(r);
    add(r.person_id, { name: c.childName, birthDate: r.player_date_of_birth ?? null, context: `league:${r.season_id}`, where: c.where });
  }

  // (E02) The sentence for each move: the child's first name and the row whose email changed.
  const firstNameOfSource = (table: string, id: string): string | null => {
    if (table === 'rep_roster_players') return rosterRows.find((x: any) => x.id === id)?.player_first_name ?? null;
    if (table === 'league_registrations') return leagueRegs.find((x: any) => x.id === id)?.player_first_name ?? null;
    if (table === 'family_links') {
      const l = world.links.find((x: any) => x.id === id);
      return l?.player_id ? rosterRows.find((x: any) => x.id === l.player_id)?.player_first_name ?? null : null;
    }
    return null;
  };

  return proposeDuplicates({
    people: people.map((p: any): DuplicatePersonIn => ({
      id: p.id, firstName: p.first_name ?? null, lastName: p.last_name ?? null, name: personDisplayName(p),
      email: p.email_normalized, phone: p.phone ?? null, createdAt: p.created_at ?? '',
      addressCount: (addressesByPerson.get(p.id) ?? []).length,
      optedOut: (addressesByPerson.get(p.id) ?? []).some(addr => optoutSet.has(addr)),
      children: childrenByPerson.get(p.id) ?? [],
    })),
    rejected,
    moves: reattachments.map(ra => ({
      fromPersonId: ra.from_person_id, toPersonId: ra.to_person_id, at: ra.at,
      sentence: FAMILY_DUPLICATE_WORDS.emailChanged(firstNameOfSource(ra.source_table, ra.source_id) ?? 'a child', ra.source_table as any, ra.at),
    })),
  });
}

// ── The message window's read and the send's (one household read for both) ───────────────

export interface HouseholdReach {
  familyName: string;
  /** Every guardian of the household, and whether a message reaches them (suppression through the person). */
  recipients: { name: string; email: string; optedOut: boolean }[];
  /** The suppression list the reach was read against — the send hands the SAME set to the choke point. */
  suppressed: Set<string>;
}

/** Who a message reaches — the send decides on this, on the press (the window only shows it). */
export async function loadHouseholdReach(orgId: string, personId: string, opts: { attach?: boolean } = {}): Promise<HouseholdReach | null> {
  const [world, suppressed] = await Promise.all([loadOrgFamilyWorld(orgId, opts), getFamilySuppressionList(orgId)]);
  const p: any = world.personById.get(personId);
  if (!p) return null;
  const { guardians } = householdOf(world, p);
  return {
    familyName: personDisplayName(p),
    recipients: guardians.map(g => ({ name: g.name, email: g.email, optedOut: !g.email || suppressed.has(g.email) })),
    suppressed,
  };
}

/** What the message window shows before anything is typed (P4): the reach, then the last send and the cap. */
export async function loadMessageWindow(orgId: string, personId: string): Promise<{ familyName: string; recipients: HouseholdReach['recipients']; state: FamilyMessageState } | null> {
  const [reach, log] = await Promise.all([loadHouseholdReach(orgId, personId), readMessageLog(orgId, personId)]);
  if (!reach) return null;
  const reached = reach.recipients.filter(r => !r.optedOut).length;
  return {
    familyName: reach.familyName,
    recipients: reach.recipients,
    state: { ...messageState(log, [], reach.suppressed), reachable: reached },
  };
}

// ── Email families' audience (Club Tier Stage 7c) ─────────────────────────────

export interface FamilyAudienceWorld {
  /** Every person of the club with their live rows and household (lib/families-audience.ts decides who is in a scope). */
  people: AudiencePerson[];
  /** The suppression list the audience was read against — the send hands the SAME set to the choke point. */
  suppressed: Set<string>;
  /** This season's children with no family on file (the window's "Nobody to send to"), by team or season. */
  noFamily: NoFamilyChild[];
}

/**
 * The one read behind Email families: Families' world, each person's household (`householdOf`, the rule the page, the
 * one-household message and the file share) and the suppression list. `attach` on the press — a send is an action, as
 * the one-household message's is, so a registration whose person was minted since the last visit is in the count and
 * the send; the window's read stays attach-free (the worklist is the visit's one attach).
 */
export async function loadFamilyAudience(orgId: string, orgSlug: string, opts: { attach?: boolean; lists?: boolean } = {}): Promise<FamilyAudienceWorld> {
  const [world, suppressed] = await Promise.all([loadOrgFamilyWorld(orgId, { attach: opts.attach }), getFamilySuppressionList(orgId)]);
  // The lists ("Owes money" …) are the Families tab's own predicates over the same worklist rows — read only when asked
  // (the window's choices and a send to a list), since they cost the dues and forms reads.
  const lists = opts.lists ? listsByPerson(await worklistFamilies(orgId, world)) : null;
  const people: AudiencePerson[] = world.people.map((p: any) => {
    const h = householdOf(world, p);
    return {
      personId: p.id,
      email: p.email_normalized,
      lists: lists?.get(p.id) ?? [],
      roster: h.roster.map(r => ({ teamId: r.team_id, teamName: r.rep_teams?.name ?? 'Rep team', current: isCurrentRepYear(r) })),
      league: h.league.map(r => ({ seasonId: r.season_id, seasonName: r.league_seasons?.name ?? 'House league', current: isCurrentLeagueSeason(r) })),
      coGuardians: h.guardians.slice(1).map(g => g.personId),
    };
  });
  return { people, suppressed, noFamily: childrenWithNoFamily(world.rosterRows, world.leagueRegs, orgSlug) };
}

// ── Merge (chunk E write) ─────────────────────────────────────────────────────

/**
 * Merge person `mergeId` INTO person `keepId` — ONE TRANSACTION, in the
 * families_merge_people database function (mig 254, revised by mig 334 to carry the family's message dates). The first
 * cut ran the five writes from here and a partial failure left a half-merged person; the function commits
 * all-or-nothing and serializes concurrent merges of the same pair (review fix 2026-08-17).
 *
 * Joins the PARENT records only: addresses move (all become former — keep's
 * current address stays current), person_id repoints on the four source
 * tables, the merged row is snapshotted to org_person_merges and deleted.
 * NO child row is modified. Strictest contact preference wins BY CONSTRUCTION:
 * preferences stay keyed on (org, email) and the kept person unions both
 * address sets.
 */
export async function mergePeople(orgId: string, keepId: string, mergeId: string, mergedBy: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin.rpc('families_merge_people', {
    p_org_id: orgId, p_keep_id: keepId, p_merge_id: mergeId, p_merged_by: mergedBy,
  });
  if (error) {
    // The function raises readable messages ('Person not found', 'Cannot merge
    // a person into themselves'); pass them through as the route's 400 body.
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Remember "not the same person" so the pair never resurfaces (tombstone).
 *  Both persons must exist IN THIS ORG — the same two-check discipline as
 *  mergePeople; a leaked foreign personId must not become a tombstone row
 *  misattributed to this org (review 2026-08-17). */
export async function rejectMatch(orgId: string, personId1: string, personId2: string, rejectedBy: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (personId1 === personId2) return { ok: false, error: 'A person cannot be rejected against themselves' };
  const { data: both, error: lookupErr } = await supabaseAdmin.from('org_people')
    .select('id').eq('org_id', orgId).in('id', [personId1, personId2]);
  if (lookupErr) throw lookupErr;
  if ((both ?? []).length !== 2) return { ok: false, error: 'Person not found' };

  const [a, b] = personId1 < personId2 ? [personId1, personId2] : [personId2, personId1];
  const { error } = await supabaseAdmin.from('org_person_match_rejections')
    .insert({ org_id: orgId, person_a_id: a, person_b_id: b, rejected_by: rejectedBy });
  if (error && error.code !== '23505') throw error; // already remembered = success
  return { ok: true };
}

// The family file (lib/families-export.ts) reads the same world and the same household rule.
export { loadOrgFamilyWorld, householdOf, fullName, personDisplayName };
