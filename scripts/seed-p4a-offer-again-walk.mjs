#!/usr/bin/env node
/**
 * BOARD READY STAGE 6 · PART 4a (OFFER AGAIN) — OWNER WALK FIXTURE. Dev Supabase only; never a demo world.
 *
 * Adds to Dev Club Org (owner@dev.local) a LAST fiscal year of sponsorship deals covering every row the walk reads, and the
 * seasons, divisions, teams, tournaments and packages those rows need. It changes nothing the club already has. Every
 * business address ends @p4awalk.local, which lib/email.ts never hands to the mail service, so no email leaves the machine.
 *
 *   node --env-file=.env.local --import ./tests/ts-resolver.mjs scripts/seed-p4a-offer-again-walk.mjs           (re-seed)
 *   node --env-file=.env.local --import ./tests/ts-resolver.mjs scripts/seed-p4a-offer-again-walk.mjs --teams   (next season's teams)
 *   node --env-file=.env.local --import ./tests/ts-resolver.mjs scripts/seed-p4a-offer-again-walk.mjs --clean   (remove it all)
 *
 * Re-runnable: it first removes what it made before (its fixed ids, and any deal or business the walk created on its
 * packages). Offer records, "Do not offer again" and unsubscribes can't be deleted (an offer record keeps standing
 * with no deal), so each run uses fresh addresses.
 * The paid deals post their income to the club's General ledger in last year (and in the year the old payment is from);
 * removing the fixture removes those lines.
 */
import { createClient } from '@supabase/supabase-js';
import { payLinkSecret, signSponsorDealToken, sponsorDealPath } from '../lib/sponsor-deal-link.ts';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !URL_.includes('npgnrxaitgbtbtvvykto')) { console.error('Refusing: this is not the dev Supabase project.'); process.exit(1); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY);
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

const SLUG = 'dev-club-org';
const LIVE_SEASON_OF_THE_OLD_TEAM = 'b8ef92e3-4a78-4f60-841c-224fc73d72bf'; // Dev House League 2026
const OLD_TEAM = { id: 'ff49eb5f-0f62-493d-bf38-dce8ed582f6f', name: 'Cardinals' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
const Y = Number(today.slice(0, 4));
const LAST = Y - 1, NEXT = Y + 1;
const stamp = Date.now().toString(36);

/** Fixed ids, so a re-run removes exactly what the last one made. */
const id = n => `a4a4a4a4-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEASONS = { spring: id(101), next: id(102), fall: id(103) };
const DIV = { u9Old: id(201), u11Old: id(202), u13Old: id(203), u15Old: id(204), u9: id(211), u11: id(212), u13: id(213), u11Fall: id(214), same: id(215) };
const TEAM = { owls: id(301), hawks: id(302) };
const TOURNEY = { old: id(401), next: id(402) };
const PKG = { division: id(501), tournament: id(502), team: id(503), club: id(504), program: id(505), banner: id(506) };
const SPONSOR_IDS = Array.from({ length: 20 }, (_, i) => id(601 + i));
const DEAL_IDS = Array.from({ length: 30 }, (_, i) => id(701 + i));

const org = must(await db.from('organizations').select('id, fiscal_first_month').eq('slug', SLUG).single(), 'the club');
if (Number(org.fiscal_first_month ?? 1) !== 1) throw new Error('Dev Club Org’s fiscal year no longer starts in January; the fixture’s dates assume it does.');
const users = must(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'sign-ins');
const owner = users.users.find(u => u.email === 'owner@dev.local');
if (!owner) throw new Error('owner@dev.local is missing');
const by = { id: owner.id, name: 'Dev Owner' };

async function clean() {
  const packageIds = Object.values(PKG);
  const mine = must(await db.from('club_sponsor_deals').select('id, sponsor_id').eq('org_id', org.id)
    .or(`sponsor_id.in.(${SPONSOR_IDS.join(',')}),package_id.in.(${packageIds.join(',')})`), 'old deals');
  const dealIds = mine.map(d => d.id);
  if (dealIds.length) {
    must(await db.from('accounting_entries').delete().eq('source_module', 'sponsorship_deal').in('source_entity_id', dealIds), 'ledger lines');
    must(await db.from('club_sponsor_deals').delete().in('id', dealIds), 'deals');
  }
  // Businesses: the fixture's, and any the walk made on the fixture's packages that hold nothing else.
  const made = [...new Set(mine.map(d => d.sponsor_id).filter(s => !SPONSOR_IDS.includes(s)))];
  const stillUsed = made.length ? must(await db.from('club_sponsor_deals').select('sponsor_id').in('sponsor_id', made), 'walk businesses').map(d => d.sponsor_id) : [];
  const gone = [...SPONSOR_IDS, ...made.filter(s => !stillUsed.includes(s))];
  must(await db.from('club_sponsors').delete().eq('org_id', org.id).in('id', gone), 'businesses');
  must(await db.from('club_sponsorship_packages').delete().eq('org_id', org.id).in('id', packageIds), 'packages');
  must(await db.from('tournaments').delete().eq('org_id', org.id).in('id', Object.values(TOURNEY)), 'tournaments');
  must(await db.from('league_teams').delete().in('id', Object.values(TEAM)), 'teams');
  must(await db.from('league_divisions').delete().in('id', Object.values(DIV)), 'divisions');
  must(await db.from('league_seasons').delete().eq('org_id', org.id).in('id', Object.values(SEASONS)), 'seasons');
}

async function addTeams() {
  const ready = must(await db.from('league_seasons').select('id').eq('id', SEASONS.next), 'next season');
  if (!ready.length) throw new Error('Seed first, then add the teams.');
  // Last year's team's division carries a team too, so the picker shows that division first.
  const old = must(await db.from('league_teams').select('league_divisions(name)').eq('id', OLD_TEAM.id).single(), 'last year’s team');
  const oldDivision = (Array.isArray(old.league_divisions) ? old.league_divisions[0] : old.league_divisions)?.name;
  if (!oldDivision) throw new Error('last year’s team has no division');
  must(await db.from('league_divisions').upsert({ id: DIV.same, season_id: SEASONS.next, name: oldDivision, sort_order: 4 }), 'its division next season');
  must(await db.from('league_teams').upsert([
    { id: TEAM.owls, season_id: SEASONS.next, division_id: DIV.u9, name: 'U9 Owls', sort_order: 0 },
    { id: TEAM.hawks, season_id: SEASONS.next, division_id: DIV.same, name: 'Hawks', sort_order: 1 },
  ]), 'teams');
  console.log(`Added Hawks (${oldDivision}) and U9 Owls to Spring ${NEXT}. Reload Deals and open Offer again.`);
}

async function seed() {
  must(await db.from('league_seasons').insert([
    { id: SEASONS.spring, org_id: org.id, name: `Spring ${LAST}`, slug: `p4a-spring-${LAST}`, sport: 'softball', status: 'completed' },
    { id: SEASONS.next, org_id: org.id, name: `Spring ${NEXT}`, slug: `p4a-spring-${NEXT}`, sport: 'softball', status: 'draft' },
    { id: SEASONS.fall, org_id: org.id, name: `Fall ${NEXT} mini league`, slug: `p4a-fall-${NEXT}`, sport: 'softball', status: 'draft' },
  ]), 'seasons');
  const division = (key, season, name, sort) => ({ id: DIV[key], season_id: season, name, sort_order: sort });
  must(await db.from('league_divisions').insert([
    division('u9Old', SEASONS.spring, 'U9', 0), division('u11Old', SEASONS.spring, 'U11', 1), division('u13Old', SEASONS.spring, 'U13', 2), division('u15Old', SEASONS.spring, 'U15', 3),
    division('u9', SEASONS.next, 'U9', 0), division('u11', SEASONS.next, 'U11', 1), division('u13', SEASONS.next, 'U13', 2), division('u11Fall', SEASONS.fall, 'U11', 0),
  ]), 'divisions');
  const tourney = (tid, year, status) => ({ id: tid, org_id: org.id, year, name: `Spring Classic ${year}`, slug: `p4a-spring-classic-${year}`, status, is_active: status === 'active', start_date: `${year}-05-20`, end_date: `${year}-05-22` });
  must(await db.from('tournaments').insert([tourney(TOURNEY.old, LAST, 'completed'), tourney(TOURNEY.next, NEXT, 'active')]), 'tournaments');

  const pkg = (pid, name, price, placeKind, extra = {}) => ({ id: pid, org_id: org.id, name, price, place_kind: placeKind, how_many: null, shows_until: `${NEXT}-08-31`, logo_on_site: false, items: [], archived_at: null, created_by: by.id, ...extra });
  const packages = {
    division: pkg(PKG.division, 'Division sponsor', 1000, 'division'),
    // A last day that has already passed: its row asks, filled a year on.
    tournament: pkg(PKG.tournament, 'Tournament sponsor', 750, 'tournament', { shows_until: `${Y}-09-30` }),
    team: pkg(PKG.team, 'Team sponsor', 400, 'team'),
    club: pkg(PKG.club, 'Club partner', 2500, 'club'),
    program: pkg(PKG.program, 'Program ad', 200, 'club', { archived_at: `${Y}-01-05T12:00:00Z` }),
    // Two places, both sold last year: the old count read Full; it reads free this year.
    banner: pkg(PKG.banner, 'Field banner', 300, 'club', { how_many: 2 }),
  };
  must(await db.from('club_sponsorship_packages').insert(Object.values(packages)), 'packages');

  const top = must(await db.from('club_sponsors').select('position').eq('org_id', org.id).order('position', { ascending: false }).limit(1), 'positions');
  let position = top[0]?.position ?? 0;
  let nSponsor = 0, nDeal = 0, invoice = 900;
  const printed = {};

  async function business(name, key) {
    const sponsorId = SPONSOR_IDS[nSponsor++];
    const email = `${key}.${stamp}@p4awalk.local`;
    must(await db.from('club_sponsors').insert({ id: sponsorId, org_id: org.id, name, contact_email: email, position: ++position, created_by: by.id }), name);
    return { sponsorId, name, email, key };
  }

  /** A deal offered `offeredOn`. `paid` = the day it was paid in full (invoiced, then paid through the real payment step). */
  async function deal(b, p, { offeredOn = `${LAST}-02-20`, endsOn = `${LAST}-08-31`, targetId = null, targetName = null, amount = p.price, paid = null, offeredTo = b.email } = {}) {
    const dealId = DEAL_IDS[nDeal++];
    const invoiced = paid ? { state: 'invoiced', invoice_year: Number(offeredOn.slice(0, 4)), invoice_seq: ++invoice, invoiced_at: `${offeredOn}T15:00:00Z`, invoiced_on: offeredOn, due_on: offeredOn, total: amount, business_name: b.name, contact_name: 'Pat Walker', contact_email: b.email } : { state: 'offered' };
    must(await db.from('club_sponsor_deals').insert({
      id: dealId, org_id: org.id, sponsor_id: b.sponsorId, package_id: p.id, package_name: p.name, package_items: [], logo_on_site: false,
      place_kind: p.place_kind, target_id: targetId, target_name: targetName, ends_on: endsOn, amount, charge_tax: false,
      offered_on: offeredOn, offered_at: `${offeredOn}T15:00:00Z`, offered_by: by.id, offered_by_name: by.name, offered_to: offeredTo,
      emailed_at: `${offeredOn}T15:00:00Z`, ...invoiced,
    }), `${b.name}’s deal`);
    if (paid) {
      must(await db.rpc('club_sponsor_deal_pay', { p_org: org.id, p_deal: dealId, p_amount: amount, p_on: paid, p_method: 'cheque', p_reference: String(1000 + nDeal), p_note: null, p_actor: by.id, p_actor_name: by.name }), `${b.name}’s payment`);
    }
    return dealId;
  }

  const harbour = await business('Harbour Dental', 'harbour');
  await deal(harbour, packages.division, { targetId: DIV.u13Old, targetName: 'U13', amount: 900, paid: `${LAST}-04-02` });
  const summit = await business('Summit Roofing', 'summit');
  await deal(summit, packages.tournament, { targetId: TOURNEY.old, targetName: `Spring Classic ${LAST}`, endsOn: `${LAST}-09-30`, paid: `${LAST}-04-06` });
  const oakridge = await business('Oakridge Physio', 'oakridge');
  await deal(oakridge, packages.division, { targetId: DIV.u11Old, targetName: 'U11', paid: `${LAST}-04-09` });
  const kowalski = await business('Kowalski Plumbing', 'kowalski');
  // Offered late last year for the season that has just ended.
  await deal(kowalski, packages.team, { targetId: OLD_TEAM.id, targetName: OLD_TEAM.name, offeredOn: `${LAST}-11-10`, endsOn: `${Y}-08-31`, paid: `${LAST}-11-24` });
  const pinecrest = await business('Pinecrest Realty', 'pinecrest');
  await deal(pinecrest, packages.division, { targetId: DIV.u15Old, targetName: 'U15', paid: `${LAST}-04-12` });
  // Unsubscribed on the address it was offered at; it has a new contact address since (the stop follows the business).
  const cedar = await business('Cedar Vet Clinic', 'cedar');
  await deal(cedar, packages.club, { offeredTo: `cedar.old.${stamp}@p4awalk.local`, paid: `${LAST}-03-15` });
  must(await db.from('club_sponsor_offer_stops').insert({ org_id: org.id, email: `cedar.old.${stamp}@p4awalk.local`, source: 'unsubscribe' }), 'the unsubscribe');
  // Offered last year and never answered; its last payment is more than two years old.
  const northgate = await business('Northgate Auto', 'northgate');
  await deal(northgate, packages.club, { offeredOn: `${Y - 3}-04-01`, endsOn: `${Y - 3}-08-31`, paid: `${Y - 3}-05-01` });
  await deal(northgate, packages.club);
  const lakeview = await business('Lakeview Optical', 'lakeview');
  printed.lakeview = await deal(lakeview, packages.club);
  const brennan = await business('Brennan’s Bakery', 'brennan');
  await deal(brennan, packages.program, { paid: `${LAST}-04-15` });
  const maple = await business('Maple Print', 'maple');
  await deal(maple, packages.banner, { paid: `${LAST}-03-04` });
  const birch = await business('Birch Street Bakery', 'birch');
  await deal(birch, packages.banner, { paid: `${LAST}-03-05` });
  // Two deals on one package: both are offered.
  const riverbend = await business('Riverbend Credit Union', 'riverbend');
  await deal(riverbend, packages.division, { targetId: DIV.u9Old, targetName: 'U9', paid: `${LAST}-04-20` });
  await deal(riverbend, packages.division, { targetId: DIV.u11Old, targetName: 'U11', paid: `${LAST}-04-20` });
  const allen = await business('Allen & Co. Law', 'allen');
  printed.allen = await deal(allen, packages.club, { paid: `${LAST}-05-02` });
  const fern = await business('Fern Hill Orthodontics', 'fern');
  printed.fern = await deal(fern, packages.club, { paid: `${LAST}-05-10` });

  const secret = payLinkSecret();
  const link = secret ? `http://localhost:3000${sponsorDealPath(SLUG, signSponsorDealToken(printed.lakeview, secret, 0))}` : '(no link secret set)';
  console.log(`Seeded Dev Club Org: ${nSponsor} businesses, ${nDeal} deals (last year ${LAST}), 6 packages, 3 seasons, 2 tournaments.`);
  console.log(`Deals:              http://localhost:3000/${SLUG}/admin/sponsorships`);
  console.log(`Allen’s old deal:   http://localhost:3000/${SLUG}/admin/sponsorships/${printed.allen}`);
  console.log(`Fern Hill’s deal:   http://localhost:3000/${SLUG}/admin/sponsorships/${printed.fern}`);
  console.log(`Lakeview’s deal:    http://localhost:3000/${SLUG}/admin/sponsorships/${printed.lakeview}`);
  console.log(`Lakeview’s link:    ${link}`);
}

const arg = process.argv[2];
if (arg === '--teams') await addTeams();
else if (arg && arg !== '--clean') throw new Error(`Unknown option ${arg}`);
else {
  await clean();
  if (arg === '--clean') console.log('Removed the Part 4a walk fixture from Dev Club Org.');
  else await seed();
}
