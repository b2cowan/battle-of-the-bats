import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { attachPeopleForOrg } from './org-people';

/**
 * lib/families-read.ts — server-side assembly for the Families area (P2 chunks C–E).
 *
 * Every function takes an orgId that the CALLER has already authorized (the
 * two-check rule: module_families capability AND org membership — plan §5.3);
 * every query here re-scopes to that org anyway, so a leaked personId from
 * another org reads as "not found", never as data.
 *
 * Assembly is deliberately in-process over small result sets: a club is a few
 * hundred source rows, and SQL-side aggregation would spread the lens
 * definitions across queries that must then agree with each other. One walk,
 * one place where "owes money" means something.
 *
 * ⚠ MONEY IS READ, NEVER RECOMPUTED (plan §5-P2 money note). "Owing" here is
 * the sum of UNPAID INSTALLMENT amounts — the payable instrument as recorded.
 * Credits are surfaced as their own line, NOT netted: how credits apply is the
 * money module's policy (rep_program_years.credit_application), and restating
 * it here would fork the exact logic the two-doors rule forbids forking. A
 * house-league child's money is a paid/unpaid flag and is never summed.
 */

// ── Types (the API payloads) ──────────────────────────────────────────────────

export interface FamilyChildRow {
  source: 'rep_roster' | 'league';
  sourceRowId: string;
  childName: string;
  /** Team name (rep) or "Season · Division" (league). */
  where: string;
  year: number | null;
  current: boolean;
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
  owingCents: number;            // unpaid rep installments, current program years
  chasedAt: string | null;       // newest reminder stamp on an unpaid installment
  leagueUnpaidCount: number;     // current-season league regs not marked paid
  missingFormsCount: number;     // rep children missing an active required template type
  hasConsent: boolean;           // any live family_consents row on any address
  optedOut: boolean;             // any address on the suppression list (through the PERSON)
  notBack: boolean;              // has only non-current children rows
}

export interface NoFamilyChild {
  source: 'rep_roster' | 'league';
  childName: string;
  where: string;
  reason: 'no_email' | 'unattached';
  /** Where the fix lives — the existing surface that edits guardian details. */
  fixHref: string;
}

export interface WorklistPayload {
  families: WorklistFamily[];
  noFamilyChildren: NoFamilyChild[];
  duplicatePairCount: number;
}

export interface FamilyPagePayload {
  person: { id: string; name: string; firstName: string | null; lastName: string | null; email: string; phone: string | null; createdAt: string };
  addresses: { email: string; isCurrent: boolean; firstSeenAt: string; lastSeenAt: string }[];
  children: FamilyChildRow[];
  money: {
    repLines: { childName: string; year: number; totalCents: number; paidCents: number; unpaidCents: number; lastReminderAt: string | null }[];
    creditCents: number;   // recorded credits, informational — never netted here
    owingCents: number;    // sum of unpaid installments (current years)
    leagueLines: { childName: string; seasonName: string; feeCents: number | null; paid: boolean }[];
  };
  guardians: { personId: string; name: string; email: string; provenance: string; portalActive: boolean }[];
  contact: { optedOut: boolean; optedOutVia: string | null };
  forms: { childName: string; templateName: string; documentType: string; status: 'on_file' | 'missing' }[];
  consents: { basis: string; scope: string; startedAt: string; withdrawnAt: string | null }[];
  history: { at: string; what: string }[];
}

export interface DuplicatePair {
  a: { personId: string; name: string; email: string; phone: string | null; childNames: string[]; addressCount: number; optedOut: boolean };
  b: { personId: string; name: string; email: string; phone: string | null; childNames: string[]; addressCount: number; optedOut: boolean };
  reasons: string[];  // 'surname+phone' | 'surname+shared-child'
  /** Which side survives a merge — decided HERE, where the pair is assembled,
   *  so the rule has one home if it is ever refined (portal activity, recency…).
   *  Today: the side with more on file (more addresses) keeps. */
  keep: 'a' | 'b';
}

// ── Shared raw reads ──────────────────────────────────────────────────────────

const toCents = (n: unknown): number => Math.round(Number(n ?? 0) * 100);

async function loadOrgFamilyWorld(orgId: string) {
  // One idempotent attach so rows written since the last visit join their person
  // the moment an admin looks (mig 252 — the single home for the matching rules).
  await attachPeopleForOrg(orgId);

  const [people, addresses, rosterRows, leagueRegs, links, optouts, consents] = await Promise.all([
    supabaseAdmin.from('org_people')
      .select('id, email_normalized, first_name, last_name, phone, created_at')
      .eq('org_id', orgId),
    supabaseAdmin.from('org_person_emails')
      .select('person_id, email_normalized, is_current, first_seen_at, last_seen_at')
      .eq('org_id', orgId),
    supabaseAdmin.from('rep_roster_players')
      .select('id, person_id, player_first_name, player_last_name, guardian_email, status, team_id, program_year_id, created_at, rep_teams(name, slug), rep_program_years(year, status)')
      .eq('org_id', orgId),
    supabaseAdmin.from('league_registrations')
      .select('id, person_id, player_first_name, player_last_name, guardian_email, status, registration_fee_paid, waiver_accepted_at, registered_at, season_id, league_seasons(name, slug, status, registration_fee), league_divisions(name)')
      .eq('org_id', orgId),
    supabaseAdmin.from('family_links')
      .select('person_id, player_id, user_id, status, role, relationship, invited_email, claimed_email')
      .eq('org_id', orgId),
    supabaseAdmin.from('family_email_optouts')
      .select('email, source, opted_out_at')
      .eq('org_id', orgId),
    supabaseAdmin.from('family_consents')
      .select('guardian_email, basis, scope, basis_started_at, withdrawn_at')
      .eq('org_id', orgId),
  ]);

  for (const r of [people, addresses, rosterRows, leagueRegs, links, optouts, consents]) {
    if (r.error) throw r.error;
  }
  return {
    people: people.data ?? [],
    addresses: addresses.data ?? [],
    rosterRows: (rosterRows.data ?? []) as any[],
    leagueRegs: (leagueRegs.data ?? []) as any[],
    links: (links.data ?? []) as any[],
    optouts: optouts.data ?? [],
    consents: consents.data ?? [],
  };
}

const isCurrentRepYear = (row: any) => row.rep_program_years?.status === 'active';
const isCurrentLeagueSeason = (row: any) =>
  ['registration_open', 'active'].includes(row.league_seasons?.status ?? '');
const isLiveRegStatus = (s: string) => !['declined', 'withdrawn'].includes(s);

function childRowFromRoster(r: any): FamilyChildRow {
  return {
    source: 'rep_roster', sourceRowId: r.id,
    childName: fullName(r.player_first_name, r.player_last_name),
    where: r.rep_teams?.name ?? 'Rep team',
    year: r.rep_program_years?.year ?? null,
    current: isCurrentRepYear(r),
  };
}
function childRowFromLeague(r: any): FamilyChildRow {
  const div = r.league_divisions?.name ? ` · ${r.league_divisions.name}` : '';
  return {
    source: 'league', sourceRowId: r.id,
    childName: fullName(r.player_first_name, r.player_last_name),
    where: `${r.league_seasons?.name ?? 'House league'}${div}`,
    year: null,
    current: isCurrentLeagueSeason(r),
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
function buildChildRows(roster: any[], league: any[]): FamilyChildRow[] {
  return [
    ...roster.map(childRowFromRoster),
    ...league.map(childRowFromLeague),
  ].sort((a, b) => a.childName.localeCompare(b.childName) || (b.year ?? 0) - (a.year ?? 0));
}

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
    supabaseAdmin.from('rep_document_templates')
      .select('team_id, name, document_type, is_active')
      .eq('org_id', orgId).eq('is_active', true),
    rosterIds.length
      ? supabaseAdmin.from('rep_player_documents')
          .select('player_id, document_type')
          .eq('org_id', orgId).in('player_id', rosterIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (templates.error) throw templates.error;
  if (docs.error) throw docs.error;
  const docTypesByPlayer = new Map<string, Set<string>>();
  for (const d of docs.data ?? []) {
    const set = docTypesByPlayer.get(d.player_id) ?? new Set<string>();
    set.add(d.document_type); docTypesByPlayer.set(d.player_id, set);
  }
  return {
    templatesForTeam: (teamId: string) =>
      ((templates.data ?? []) as any[]).filter(t => t.team_id === null || t.team_id === teamId),
    docTypesByPlayer,
  };
}

// ── The worklist (chunk C) ────────────────────────────────────────────────────

export async function buildWorklist(orgId: string, orgSlug: string): Promise<WorklistPayload> {
  const world = await loadOrgFamilyWorld(orgId);
  const { people, addresses, rosterRows, leagueRegs, links, optouts, consents } = world;

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
  const currentRosterIds = rosterRows.filter(isCurrentRepYear).map(r => r.id);
  const [installments, formsData] = await Promise.all([
    currentRosterIds.length
      ? supabaseAdmin.from('rep_player_dues_installments')
          .select('player_id, amount, paid_at, reminder_sent_at, reminder_30_sent_at, reminder_7_sent_at')
          .eq('org_id', orgId)
          .in('player_id', currentRosterIds)
      : Promise.resolve({ data: [], error: null } as any),
    loadFormsData(orgId, currentRosterIds),
  ]);
  if (installments.error) throw installments.error;
  const { templatesForTeam, docTypesByPlayer } = formsData;

  const unpaidByPlayer = new Map<string, { cents: number; chased: string | null }>();
  for (const i of installments.data ?? []) {
    if (i.paid_at) continue;
    const cur = unpaidByPlayer.get(i.player_id) ?? { cents: 0, chased: null };
    cur.cents += toCents(i.amount);
    const stamp = latestReminderStamp(i);
    if (stamp && (!cur.chased || stamp > cur.chased)) cur.chased = stamp;
    unpaidByPlayer.set(i.player_id, cur);
  }

  const families: WorklistFamily[] = [];
  for (const p of people) {
    const myAddresses = (addressesByPerson.get(p.id) ?? []).map(a => a.email_normalized);
    const myRoster = rosterRows.filter(r => r.person_id === p.id && isLiveRegStatus(r.status ?? 'active'));
    const myLeague = leagueRegs.filter(r => r.person_id === p.id && isLiveRegStatus(r.status));
    // Tryout-only people (kept deliberately, §5-P1) stay IN the list with no
    // children — they carry no lens work (every predicate needs child rows) but
    // must be reachable: search and the All lens are their only doors, and a
    // person the UI cannot reach cannot answer "what do you hold about me".

    const children = buildChildRows(myRoster, myLeague);
    const myCurrentRoster = myRoster.filter(isCurrentRepYear);

    let owingCents = 0; let chasedAt: string | null = null;
    for (const r of myCurrentRoster) {
      const u = unpaidByPlayer.get(r.id);
      if (u) { owingCents += u.cents; if (u.chased && (!chasedAt || u.chased > chasedAt)) chasedAt = u.chased; }
    }

    let missingFormsCount = 0;
    for (const r of myCurrentRoster) {
      const have = docTypesByPlayer.get(r.id) ?? new Set();
      for (const t of templatesForTeam(r.team_id)) {
        if (!have.has(t.document_type)) missingFormsCount++;
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
      owingCents,
      chasedAt,
      leagueUnpaidCount: myLeague.filter(r => isCurrentLeagueSeason(r) && !r.registration_fee_paid).length,
      missingFormsCount,
      hasConsent: myAddresses.some(a => liveConsentEmails.has(a)),
      optedOut: myAddresses.some(a => optoutSet.has(a)),
      notBack: !hasCurrent && children.length > 0,
    });
  }
  families.sort((a, b) => a.name.localeCompare(b.name));

  // The lens the concept mockups missed: children with NO family at all.
  // Rows are CHILDREN; the fix lives on the surface that edits guardian details.
  const noFamilyChildren: NoFamilyChild[] = [];
  for (const r of rosterRows) {
    if (r.person_id || !isCurrentRepYear(r) || !isLiveRegStatus(r.status ?? 'active')) continue;
    noFamilyChildren.push({
      source: 'rep_roster',
      childName: fullName(r.player_first_name, r.player_last_name),
      where: r.rep_teams?.name ?? 'Rep team',
      reason: r.guardian_email && r.guardian_email.trim() ? 'unattached' : 'no_email',
      fixHref: `/${orgSlug}/admin/rep-teams`,
    });
  }
  for (const r of leagueRegs) {
    if (r.person_id || !isCurrentLeagueSeason(r) || !isLiveRegStatus(r.status)) continue;
    noFamilyChildren.push({
      source: 'league',
      childName: fullName(r.player_first_name, r.player_last_name),
      where: r.league_seasons?.name ?? 'House league',
      reason: r.guardian_email && r.guardian_email.trim() ? 'unattached' : 'no_email',
      fixHref: `/${orgSlug}/admin/house-league`,
    });
  }
  noFamilyChildren.sort((a, b) => a.childName.localeCompare(b.childName));

  const duplicatePairCount = (await buildDuplicatePairs(orgId, world)).length;

  return { families, noFamilyChildren, duplicatePairCount };
}

// ── The family page (chunk D) ─────────────────────────────────────────────────

export async function buildFamilyPage(orgId: string, personId: string): Promise<FamilyPagePayload | null> {
  const world = await loadOrgFamilyWorld(orgId);
  const p: any = world.people.find((x: any) => x.id === personId);
  if (!p) return null; // wrong org or unknown id — indistinguishable on purpose

  const myAddresses = world.addresses
    .filter((a: any) => a.person_id === p.id)
    .sort((a: any, b: any) => Number(b.is_current) - Number(a.is_current) || (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''));
  const addressSet = new Set(myAddresses.map((a: any) => a.email_normalized));

  const myRoster = world.rosterRows.filter(r => r.person_id === p.id && isLiveRegStatus(r.status ?? 'active'));
  const myLeague = world.leagueRegs.filter(r => r.person_id === p.id && isLiveRegStatus(r.status));
  const children = buildChildRows(myRoster, myLeague);

  // Money — READ, never recomputed (header note). Current rep years only.
  // Money and forms are independent; one batch, one round trip.
  const currentRoster = myRoster.filter(isCurrentRepYear);
  const rosterIds = currentRoster.map(r => r.id);
  const [schedules, installments, credits, formsData] = await Promise.all([
    rosterIds.length
      ? supabaseAdmin.from('rep_player_dues_schedules')
          .select('player_id, total_amount').eq('org_id', orgId).in('player_id', rosterIds)
      : Promise.resolve({ data: [], error: null } as any),
    rosterIds.length
      ? supabaseAdmin.from('rep_player_dues_installments')
          .select('player_id, amount, paid_at, reminder_sent_at, reminder_30_sent_at, reminder_7_sent_at')
          .eq('org_id', orgId).in('player_id', rosterIds)
      : Promise.resolve({ data: [], error: null } as any),
    rosterIds.length
      ? supabaseAdmin.from('rep_dues_credits')
          .select('player_id, amount').in('player_id', rosterIds)
      : Promise.resolve({ data: [], error: null } as any),
    loadFormsData(orgId, rosterIds),
  ]);
  for (const r of [schedules, installments, credits]) if (r.error) throw r.error;

  const repLines = currentRoster.map(r => {
    const total = (schedules.data ?? []).filter((s: any) => s.player_id === r.id)
      .reduce((sum: number, s: any) => sum + toCents(s.total_amount), 0);
    const mine = (installments.data ?? []).filter((i: any) => i.player_id === r.id);
    const paid = mine.filter((i: any) => i.paid_at).reduce((s: number, i: any) => s + toCents(i.amount), 0);
    const unpaid = mine.filter((i: any) => !i.paid_at).reduce((s: number, i: any) => s + toCents(i.amount), 0);
    let lastReminderAt: string | null = null;
    for (const i of mine) {
      const stamp = latestReminderStamp(i);
      if (stamp && (!lastReminderAt || stamp > lastReminderAt)) lastReminderAt = stamp;
    }
    return {
      childName: fullName(r.player_first_name, r.player_last_name),
      year: r.rep_program_years?.year ?? 0,
      totalCents: total, paidCents: paid, unpaidCents: unpaid, lastReminderAt,
    };
  }).filter(l => l.totalCents > 0 || l.paidCents > 0 || l.unpaidCents > 0);

  const creditCents = (credits.data ?? []).reduce((s: number, c: any) => s + toCents(c.amount), 0);

  const leagueLines = myLeague.filter(isCurrentLeagueSeason).map(r => ({
    childName: fullName(r.player_first_name, r.player_last_name),
    seasonName: r.league_seasons?.name ?? 'House league',
    feeCents: r.league_seasons?.registration_fee != null ? toCents(r.league_seasons.registration_fee) : null,
    paid: r.registration_fee_paid === true,
  }));

  // Guardians: this person + any other person holding a VERIFIED family_link on
  // one of the same children (the data's own second guardian — a READ, plan §5.3
  // gap 6; adding one is P3's write).
  // ⚠ status === 'verified' is LOAD-BEARING, not a nicety: declined and revoked
  // links exist precisely to record that a coach REJECTED or REMOVED someone
  // (custody disputes are the canonical case), and the attach function gives
  // those rows a person_id like any other. Without this filter a removed
  // guardian appears on the page, rides the export, and gets the household's
  // email — the player-documents-leak class of failure (review 2026-08-17).
  const myPlayerIds = new Set(myRoster.map(r => r.id));
  const coGuardianLinks = world.links.filter((l: any) =>
    l.status === 'verified' && l.person_id && l.person_id !== p.id && l.player_id && myPlayerIds.has(l.player_id));
  const guardians: FamilyPagePayload['guardians'] = [{
    personId: p.id,
    name: personDisplayName(p),
    email: p.email_normalized,
    provenance: myRoster.length ? 'Named on rosters' : myLeague.length ? 'Named on registrations' : 'Named on a tryout',
    portalActive: world.links.some((l: any) => l.person_id === p.id && l.status === 'verified' && l.user_id),
  }];
  for (const l of coGuardianLinks) {
    const other: any = world.people.find((x: any) => x.id === l.person_id);
    if (!other || guardians.some(g => g.personId === other.id)) continue;
    guardians.push({
      personId: other.id,
      name: personDisplayName(other),
      email: other.email_normalized,
      provenance: l.relationship ? `Family link · ${l.relationship}` : 'Family link',
      portalActive: l.status === 'verified' && !!l.user_id,
    });
  }

  const myOptouts = world.optouts.filter((o: any) => addressSet.has(o.email));
  const forms: FamilyPagePayload['forms'] = [];
  for (const r of currentRoster) {
    const have = formsData.docTypesByPlayer.get(r.id) ?? new Set<string>();
    for (const t of formsData.templatesForTeam(r.team_id)) {
      forms.push({
        childName: fullName(r.player_first_name, r.player_last_name),
        templateName: t.name, documentType: t.document_type,
        status: have.has(t.document_type) ? 'on_file' : 'missing',
      });
    }
  }

  const consents = world.consents
    .filter((c: any) => addressSet.has(c.guardian_email))
    .map((c: any) => ({ basis: c.basis, scope: c.scope, startedAt: c.basis_started_at, withdrawnAt: c.withdrawn_at ?? null }));

  // History: what is actually RECORDED — money events, address changes,
  // registrations, reminders. Never sent emails (nothing records them — §5.3 gap 3).
  const history: FamilyPagePayload['history'] = [];
  for (const r of myRoster) history.push({ at: r.created_at, what: `Rostered ${r.player_first_name} · ${r.rep_teams?.name ?? 'rep team'} ${r.rep_program_years?.year ?? ''}`.trim() });
  for (const r of myLeague) history.push({ at: r.registered_at, what: `Registered ${r.player_first_name} · ${r.league_seasons?.name ?? 'house league'}` });
  for (const i of (installments.data ?? []) as any[]) {
    if (i.paid_at) {
      const child = currentRoster.find(r => r.id === i.player_id);
      history.push({ at: i.paid_at, what: `Payment ${(toCents(i.amount) / 100).toFixed(2)} · ${child?.player_first_name ?? 'dues'}` });
    }
  }
  for (const a of myAddresses) {
    if (!a.is_current) history.push({ at: a.last_seen_at, what: `Address changed from ${a.email_normalized}` });
  }
  for (const c of consents) history.push({ at: c.startedAt, what: `Consent recorded (${c.basis})` });
  history.sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''));

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
    money: {
      repLines,
      creditCents,
      owingCents: repLines.reduce((s, l) => s + l.unpaidCents, 0),
      leagueLines,
    },
    guardians,
    contact: {
      optedOut: myOptouts.length > 0,
      optedOutVia: myOptouts.length ? (myOptouts[0] as any).email : null,
    },
    forms,
    consents,
    history: history.slice(0, 30),
  };
}

// ── Duplicates (chunk E) ──────────────────────────────────────────────────────

type World = Awaited<ReturnType<typeof loadOrgFamilyWorld>>;

const normPhone = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

export async function buildDuplicatePairs(orgId: string, preloaded?: World): Promise<DuplicatePair[]> {
  const world = preloaded ?? (await loadOrgFamilyWorld(orgId));
  const { people, addresses, rosterRows, leagueRegs, optouts } = world;

  const { data: rejections, error: rejErr } = await supabaseAdmin
    .from('org_person_match_rejections')
    .select('person_a_id, person_b_id')
    .eq('org_id', orgId);
  if (rejErr) throw rejErr;
  const rejected = new Set((rejections ?? []).map(r => `${r.person_a_id}|${r.person_b_id}`));

  const optoutSet = new Set(optouts.map((o: any) => o.email));
  const addressesByPerson = new Map<string, string[]>();
  for (const a of addresses) {
    const list = addressesByPerson.get(a.person_id) ?? [];
    list.push(a.email_normalized); addressesByPerson.set(a.person_id, list);
  }
  const childNamesByPerson = new Map<string, Set<string>>();
  for (const r of [...rosterRows, ...leagueRegs]) {
    // Live rows only — a declined/withdrawn registration is not evidence of a
    // shared child (consistent with every other status-filtered read here).
    if (!r.person_id || !isLiveRegStatus(r.status ?? 'active')) continue;
    const set = childNamesByPerson.get(r.person_id) ?? new Set<string>();
    set.add(fullName(r.player_first_name, r.player_last_name).toLowerCase());
    childNamesByPerson.set(r.person_id, set);
  }

  const pairs: DuplicatePair[] = [];
  const seenPair = new Set<string>();
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a: any = people[i]; const b: any = people[j];
      const surnameA = (a.last_name ?? '').trim().toLowerCase();
      const surnameB = (b.last_name ?? '').trim().toLowerCase();
      if (!surnameA || surnameA !== surnameB) continue;

      const reasons: string[] = [];
      if (normPhone(a.phone) && normPhone(a.phone) === normPhone(b.phone)) reasons.push('surname+phone');
      const kidsA = childNamesByPerson.get(a.id) ?? new Set();
      const kidsB = childNamesByPerson.get(b.id) ?? new Set();
      if ([...kidsA].some(k => kidsB.has(k))) reasons.push('surname+shared-child (matched by NAME only)');
      if (reasons.length === 0) continue;

      const [idA, idB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      const key = `${idA}|${idB}`;
      if (rejected.has(key) || seenPair.has(key)) continue;
      seenPair.add(key);

      const side = (p: any) => ({
        personId: p.id, name: personDisplayName(p), email: p.email_normalized,
        phone: p.phone ?? null,
        childNames: [...(childNamesByPerson.get(p.id) ?? new Set<string>())] as string[],
        addressCount: (addressesByPerson.get(p.id) ?? []).length,
        optedOut: (addressesByPerson.get(p.id) ?? []).some(addr => optoutSet.has(addr)),
      });
      const sideA = side(a); const sideB = side(b);
      pairs.push({ a: sideA, b: sideB, reasons, keep: sideA.addressCount >= sideB.addressCount ? 'a' : 'b' });
    }
  }
  return pairs;
}

// ── The household's recipients (the message door's narrow read) ───────────────

/**
 * Just enough to message a household: does the person exist in this org, and the
 * distinct current addresses of every guardian in it. Two small reads —
 * deliberately NOT buildFamilyPage, which assembles money/forms/history a send
 * would throw away, and deliberately no attach RPC: messaging starts from a page
 * that already ran it.
 *
 * This used to also return every address the person had ever used, so the caller
 * could hand them to the send guard for suppression-through-the-person. It no
 * longer needs to: the suppression list itself now expands through the person
 * (`getFamilySuppressionList`), which covers every sender rather than the ones
 * that remembered to ask. The read went with the argument.
 */
export async function loadHouseholdRecipients(orgId: string, personId: string): Promise<{
  recipientEmails: string[];
} | null> {
  const [person, links] = await Promise.all([
    supabaseAdmin.from('org_people')
      .select('id, email_normalized').eq('org_id', orgId).eq('id', personId).maybeSingle(),
    supabaseAdmin.from('family_links')
      .select('person_id, player_id, status').eq('org_id', orgId),
  ]);
  if (person.error) throw person.error;
  if (!person.data) return null;
  if (links.error) throw links.error;

  // Co-guardians: other persons holding a VERIFIED link on one of this person's
  // children. ⚠ The status filter is load-bearing — declined/revoked rows are a
  // coach's explicit "this person is NOT this child's guardian", and a removed
  // guardian must never receive the household's mail (see buildFamilyPage note).
  const { data: myRoster, error: rosterErr } = await supabaseAdmin
    .from('rep_roster_players').select('id').eq('org_id', orgId).eq('person_id', personId);
  if (rosterErr) throw rosterErr;
  const myPlayerIds = new Set((myRoster ?? []).map(r => r.id));
  const coGuardianIds = [...new Set((links.data ?? [])
    .filter((l: any) => l.status === 'verified' && l.person_id && l.person_id !== personId && l.player_id && myPlayerIds.has(l.player_id))
    .map((l: any) => l.person_id as string))];
  const coEmails = coGuardianIds.length
    ? await supabaseAdmin.from('org_people')
        .select('email_normalized').eq('org_id', orgId).in('id', coGuardianIds)
    : { data: [], error: null };
  if (coEmails.error) throw coEmails.error;

  return {
    recipientEmails: [...new Set([
      person.data.email_normalized,
      ...(coEmails.data ?? []).map((p: any) => p.email_normalized),
    ])],
  };
}

// ── Merge (chunk E write) ─────────────────────────────────────────────────────

/**
 * Merge person `mergeId` INTO person `keepId` — ONE TRANSACTION, in the
 * families_merge_people database function (mig 254). The first cut ran the
 * five writes from here and a partial failure left a half-merged person; the
 * function commits all-or-nothing and serializes concurrent merges of the
 * same pair (review fix 2026-08-17).
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
