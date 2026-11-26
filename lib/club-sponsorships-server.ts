import 'server-only';
/**
 * THE CLUB'S SPONSORSHIPS — READS AND WRITES (Board Ready Stage 6, Part 1; mig 525). Service role only, as every club
 * money table: the routes have asked `opensSponsorships` (lib/club-sponsorships-auth.ts) before they reach here, and the
 * public pages' loaders read only what a family may see (`publicSponsorsFor`, `divisionSponsorsFor`).
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { upsertOrgPublicSiteContent } from './db';
import { ORG_LOGO_BUCKET } from './org-image-limits';
import { parseSponsorLogoUrl } from './sponsor-logo';
import { hasPlanFeature } from './plan-features';
import { tournamentToday, ORG_TIME_ZONE } from './timezone';
import {
  EMPTY_SETTINGS, homeStrip, placeShowing,
  type ClubSponsor, type PackageInput, type SponsorInput, type SponsorPlace, type SponsorPlaceKind, type SponsorshipPackage,
  type PlaceTargets, type SponsorshipSettings, type PublicSponsor,
} from './club-sponsorships';
import type { OrgPlan } from './types';

// ── Sponsors and their places ──────────────────────────────────────────────────────────────────────

type PlaceRow = { id: string; sponsor_id: string; kind: SponsorPlaceKind; target_id: string | null; ends_on: string | null; source: 'typed' | 'deal'; deal_id: string | null; created_at: string };
type SponsorRow = { id: string; name: string; logo_url: string | null; link: string | null; position: number };

const placeOf = (r: PlaceRow): SponsorPlace => ({ id: r.id, kind: r.kind, targetId: r.target_id, endsOn: r.ends_on, source: r.source, dealId: r.deal_id });

/** Every sponsor of the club, in the club's order, each with its places (oldest first). */
export async function readSponsors(orgId: string): Promise<ClubSponsor[]> {
  const [s, p] = await Promise.all([
    supabaseAdmin.from('club_sponsors').select('id, name, logo_url, link, position').eq('org_id', orgId).order('position').order('created_at'),
    supabaseAdmin.from('club_sponsor_places').select('id, sponsor_id, kind, target_id, ends_on, source, deal_id, created_at').eq('org_id', orgId).order('created_at'),
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  const by = new Map<string, SponsorPlace[]>();
  for (const r of (p.data ?? []) as PlaceRow[]) by.set(r.sponsor_id, [...(by.get(r.sponsor_id) ?? []), placeOf(r)]);
  return ((s.data ?? []) as SponsorRow[]).map(r => ({
    id: r.id, name: r.name, logoUrl: r.logo_url, link: r.link, position: r.position, places: by.get(r.id) ?? [],
  }));
}

export async function readSponsor(orgId: string, id: string): Promise<ClubSponsor | null> {
  const [s, p] = await Promise.all([
    supabaseAdmin.from('club_sponsors').select('id, name, logo_url, link, position').eq('org_id', orgId).eq('id', id).maybeSingle(),
    supabaseAdmin.from('club_sponsor_places').select('id, sponsor_id, kind, target_id, ends_on, source, deal_id, created_at').eq('org_id', orgId).eq('sponsor_id', id).order('created_at'),
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  const r = s.data as SponsorRow | null;
  return r ? { id: r.id, name: r.name, logoUrl: r.logo_url, link: r.link, position: r.position, places: ((p.data ?? []) as PlaceRow[]).map(placeOf) } : null;
}

/** How many club places show today: the home strip's count, without reading the list. */
export async function homePlacesShowingNow(orgId: string, today: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_places').select('sponsor_id, ends_on').eq('org_id', orgId).eq('kind', 'club');
  if (error) throw error;
  return new Set(((data ?? []) as { sponsor_id: string; ends_on: string | null }[]).filter(r => placeShowing({ endsOn: r.ends_on }, today)).map(r => r.sponsor_id)).size;
}

/** The places a sponsor may be shown on: this club's divisions, teams and tournaments (a target of another club is refused). */
export async function targetsBelong(orgId: string, places: readonly { kind: SponsorPlaceKind; targetId: string | null }[]): Promise<boolean> {
  const ids = (kind: SponsorPlaceKind) => [...new Set(places.filter(p => p.kind === kind && p.targetId).map(p => p.targetId!))];
  const [divisions, teams, tournaments] = [ids('division'), ids('team'), ids('tournament')];
  // Each kind is one query, joined to its season for the club (a division and a team have no org_id of their own).
  const count = async (ids: string[], q: () => PromiseLike<{ data: unknown[] | null; error: unknown }>) => {
    if (!ids.length) return true;
    const { data, error } = await q();
    if (error) throw error;
    return (data ?? []).length === ids.length;
  };
  const results = await Promise.all([
    count(divisions, () => supabaseAdmin.from('league_divisions').select('id, s:league_seasons!league_divisions_season_id_fkey!inner(org_id)').eq('s.org_id', orgId).in('id', divisions)),
    count(teams, () => supabaseAdmin.from('league_teams').select('id, s:league_seasons!league_teams_season_id_fkey!inner(org_id)').eq('s.org_id', orgId).in('id', teams)),
    count(tournaments, () => supabaseAdmin.from('tournaments').select('id').eq('org_id', orgId).in('id', tournaments)),
  ]);
  return results.every(Boolean);
}

export class SponsorCapReached extends Error {}

export async function createSponsor(orgId: string, userId: string, input: SponsorInput): Promise<string> {
  const { data: last } = await supabaseAdmin.from('club_sponsors').select('position').eq('org_id', orgId).order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from('club_sponsors').insert({
    org_id: orgId, name: input.name, link: input.link, logo_url: input.logoUrl, position: ((last as { position: number } | null)?.position ?? 0) + 1, created_by: userId,
  }).select('id').single();
  if (error) {
    if (/club_sponsors_cap/.test(error.message)) throw new SponsorCapReached();
    throw error;
  }
  const id = (data as { id: string }).id;
  await replaceTypedPlaces(orgId, id, input.places);
  return id;
}

/** The sponsor's own fields and its TYPED places (a deal's place is the deal's: never touched here). */
export async function updateSponsor(orgId: string, id: string, input: SponsorInput): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsors')
    .update({ name: input.name, link: input.link, logo_url: input.logoUrl, updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('id', id);
  if (error) throw error;
  await replaceTypedPlaces(orgId, id, input.places);
}

async function replaceTypedPlaces(orgId: string, sponsorId: string, places: SponsorInput['places']): Promise<void> {
  const { data, error } = await supabaseAdmin.from('club_sponsor_places').select('id').eq('org_id', orgId).eq('sponsor_id', sponsorId).eq('source', 'typed');
  if (error) throw error;
  // Only this sponsor's own typed places are kept by id; an id sent that isn't one of them is a new place.
  const mine = new Set(((data ?? []) as { id: string }[]).map(r => r.id));
  const keep = new Set(places.map(p => p.id).filter((x): x is string => !!x && mine.has(x)));
  const gone = [...mine].filter(x => !keep.has(x));
  if (gone.length) {
    const del = await supabaseAdmin.from('club_sponsor_places').delete().eq('org_id', orgId).in('id', gone);
    if (del.error) throw del.error;
  }
  const now = new Date().toISOString();
  const row = (p: SponsorInput['places'][number]) => ({ kind: p.kind, target_id: p.targetId, ends_on: p.endsOn, updated_at: now });
  // An existing place is updated by its id, inside this sponsor and typed only (never another sponsor's row, never a deal's).
  for (const p of places.filter(x => x.id && keep.has(x.id))) {
    const r = await supabaseAdmin.from('club_sponsor_places').update(row(p)).eq('org_id', orgId).eq('sponsor_id', sponsorId).eq('id', p.id!).eq('source', 'typed');
    if (r.error) throw r.error;
  }
  const fresh = places.filter(x => !x.id || !keep.has(x.id)).map(p => ({ ...row(p), org_id: orgId, sponsor_id: sponsorId, source: 'typed' as const }));
  if (fresh.length) {
    const r = await supabaseAdmin.from('club_sponsor_places').insert(fresh);
    if (r.error) throw r.error;
  }
}

/** Remove a sponsor and its logo file. The caller has refused a sponsor a deal shows (round 1 tab 8). */
export async function deleteSponsor(orgId: string, id: string): Promise<void> {
  const { data, error } = await supabaseAdmin.from('club_sponsors').delete().eq('org_id', orgId).eq('id', id).select('logo_url').maybeSingle();
  if (error) throw error;
  await removeLogoFile(orgId, (data as { logo_url: string | null } | null)?.logo_url ?? null);
}

/** A logo file nobody names any more is deleted; one still named by a sponsor is kept (best effort: an orphan is harmless). */
export async function removeLogoFile(orgId: string, url: string | null): Promise<void> {
  const parsed = url ? parseSponsorLogoUrl(url, orgId) : null;
  if (!parsed || !url) return;
  // Compared by the file each names, not the string (the logo route's own rule), so another spelling still counts as in use.
  const { data } = await supabaseAdmin.from('club_sponsors').select('logo_url').eq('org_id', orgId).not('logo_url', 'is', null);
  if (((data ?? []) as { logo_url: string }[]).some(s => parseSponsorLogoUrl(s.logo_url, orgId)?.objectPath === parsed.objectPath)) return;
  await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).remove([parsed.objectPath]).catch(() => undefined);
}

// ── The names of the places (the Sponsors tab's captions and its "Shows on" picker) ──────────────────


const FINISHED = new Set(['completed', 'archived']);

/** Every division, team and tournament of the club, each marked `live` when a new place may be put on it. */
export async function readPlaceTargets(orgId: string): Promise<PlaceTargets> {
  // Paged: a big association's teams pass one page across its seasons, and a team that fell off couldn't be picked.
  const seasonRows = await fetchAll<{ id: string; name: string; status: string }>((from, to) =>
    supabaseAdmin.from('league_seasons').select('id, name, status').eq('org_id', orgId).order('created_at', { ascending: false }).order('id').range(from, to));
  const seasonIds = seasonRows.map(s => s.id);
  const seasonBy = new Map(seasonRows.map(s => [s.id, s]));
  const [divs, teams, tours] = await Promise.all([
    fetchAllIn<{ id: string; name: string; season_id: string }>(seasonIds, (ids, from, to) =>
      supabaseAdmin.from('league_divisions').select('id, name, season_id, sort_order').in('season_id', ids).order('sort_order').order('id').range(from, to)),
    fetchAllIn<{ id: string; name: string; season_id: string; division_id: string }>(seasonIds, (ids, from, to) =>
      supabaseAdmin.from('league_teams').select('id, name, season_id, division_id, sort_order').in('season_id', ids).order('sort_order').order('id').range(from, to)),
    fetchAll<{ id: string; name: string; status: string }>((from, to) =>
      supabaseAdmin.from('tournaments').select('id, name, status').eq('org_id', orgId).order('start_date', { ascending: false }).order('id').range(from, to)),
  ]);
  const divBy = new Map(divs.map(x => [x.id, x]));
  const live = (seasonId: string) => !FINISHED.has(seasonBy.get(seasonId)?.status ?? 'completed');
  return {
    divisions: divs.map(x => ({ id: x.id, name: x.name, seasonId: x.season_id, seasonName: seasonBy.get(x.season_id)?.name ?? '', live: live(x.season_id) })),
    teams: teams.map(x => ({
      id: x.id, name: x.name, divisionName: divBy.get(x.division_id)?.name ?? '', seasonId: x.season_id, seasonName: seasonBy.get(x.season_id)?.name ?? '', live: live(x.season_id),
    })),
    tournaments: tours.map(x => ({ id: x.id, name: x.name, live: x.status !== 'completed' && x.status !== 'archived' })),
  };
}

// ── Packages ───────────────────────────────────────────────────────────────────────────────────────

type PackageRow = {
  id: string; name: string; price: number | string; place_kind: SponsorPlaceKind; how_many: number | null; shows_until: string | null;
  logo_on_site: boolean; items: { id: string; text: string }[]; document_name: string | null; document_size: number | null; archived_at: string | null;
};
const PACKAGE_COLUMNS = 'id, name, price, place_kind, how_many, shows_until, logo_on_site, items, document_name, document_size, archived_at';
const packageOf = (r: PackageRow): SponsorshipPackage => ({
  id: r.id, name: r.name, price: Number(r.price), placeKind: r.place_kind, howMany: r.how_many, showsUntil: r.shows_until,
  logoOnSite: r.logo_on_site, items: Array.isArray(r.items) ? r.items : [],
  document: r.document_name && r.document_size ? { name: r.document_name, size: r.document_size } : null, archivedAt: r.archived_at,
});

export async function readPackages(orgId: string): Promise<SponsorshipPackage[]> {
  const { data, error } = await supabaseAdmin.from('club_sponsorship_packages').select(PACKAGE_COLUMNS).eq('org_id', orgId).order('created_at');
  if (error) throw error;
  return ((data ?? []) as PackageRow[]).map(packageOf);
}

export async function readPackage(orgId: string, id: string): Promise<(SponsorshipPackage & { documentPath: string | null }) | null> {
  const { data, error } = await supabaseAdmin.from('club_sponsorship_packages').select(`${PACKAGE_COLUMNS}, document_path`).eq('org_id', orgId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as PackageRow & { document_path: string | null };
  return { ...packageOf(row), documentPath: row.document_path };
}

const packageRow = (v: PackageInput) => ({
  name: v.name, price: v.price, place_kind: v.placeKind, how_many: v.howMany, shows_until: v.showsUntil, logo_on_site: v.logoOnSite, items: v.items,
});

export async function createPackage(orgId: string, userId: string, v: PackageInput): Promise<string> {
  const { data, error } = await supabaseAdmin.from('club_sponsorship_packages').insert({ ...packageRow(v), org_id: orgId, created_by: userId }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updatePackage(orgId: string, id: string, v: PackageInput): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsorship_packages').update({ ...packageRow(v), updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', id);
  if (error) throw error;
}

export async function setPackageArchived(orgId: string, id: string, archived: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsorship_packages')
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', id);
  if (error) throw error;
}

export async function setPackageDocument(orgId: string, id: string, doc: { path: string; name: string; size: number } | null): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsorship_packages').update({
    document_path: doc?.path ?? null, document_name: doc?.name ?? null, document_size: doc?.size ?? null, updated_at: new Date().toISOString(),
  }).eq('org_id', orgId).eq('id', id);
  if (error) throw error;
}

// ── Invoice details ────────────────────────────────────────────────────────────────────────────────

type SettingsRow = {
  gst_hst_registered: boolean; gst_hst_number: string | null; etransfer_to: string | null; cheques_payable_to: string | null;
  payment_due_days: number; sponsor_contact_name: string | null; sponsor_contact_email: string | null;
};

export async function readSettings(orgId: string): Promise<SponsorshipSettings> {
  const [s, site] = await Promise.all([
    supabaseAdmin.from('club_sponsorship_settings').select('gst_hst_registered, gst_hst_number, etransfer_to, cheques_payable_to, payment_due_days, sponsor_contact_name, sponsor_contact_email').eq('org_id', orgId).maybeSingle(),
    supabaseAdmin.from('org_public_site_content').select('mailing_address').eq('org_id', orgId).maybeSingle(),
  ]);
  if (s.error) throw s.error;
  if (site.error) throw site.error;
  const r = s.data as SettingsRow | null;
  const mailingAddress = (site.data as { mailing_address: string | null } | null)?.mailing_address ?? null;
  if (!r) return { ...EMPTY_SETTINGS, mailingAddress };
  return {
    registered: r.gst_hst_registered, gstHstNumber: r.gst_hst_number, etransferTo: r.etransfer_to, chequesPayableTo: r.cheques_payable_to,
    paymentDueDays: r.payment_due_days, contactName: r.sponsor_contact_name, contactEmail: r.sponsor_contact_email, mailingAddress,
  };
}

/** Invoice details; the mailing address goes to the one column the offer email and every invoice read (mig 454). */
export async function saveSettings(orgId: string, userId: string, next: SponsorshipSettings, before: SponsorshipSettings): Promise<void> {
  const { error } = await supabaseAdmin.from('club_sponsorship_settings').upsert({
    org_id: orgId, gst_hst_registered: next.registered, gst_hst_number: next.gstHstNumber, etransfer_to: next.etransferTo,
    cheques_payable_to: next.chequesPayableTo, payment_due_days: next.paymentDueDays, sponsor_contact_name: next.contactName,
    sponsor_contact_email: next.contactEmail, updated_by: userId, updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id' });
  if (error) throw error;
  if (next.mailingAddress !== before.mailingAddress) await upsertOrgPublicSiteContent(orgId, { mailingAddress: next.mailingAddress });
}

// ── The public pages ───────────────────────────────────────────────────────────────────────────────

/** What a public page shows of a sponsor: the name, the logo, the link. Nothing else ever leaves the server. */
const publicOf = (s: ClubSponsor): PublicSponsor => ({ id: s.id, name: s.name, ...(s.logoUrl ? { logoUrl: s.logoUrl } : {}), ...(s.link ? { link: s.link } : {}) });

/**
 * The club's public sponsors, showing today: `home` = the club places (the strip, at most 20, ask 11); `about` = every
 * sponsor with a place showing, once (About lists the club's places, ask 1 — a team place shows here only, owner
 * 2026-11-22; a tournament place only where the tournament passes the branding gate, ask 2).
 */
export async function publicSponsorsFor(orgId: string, planId: OrgPlan | null | undefined, now: Date = new Date()): Promise<{ home: PublicSponsor[]; about: PublicSponsor[] }> {
  const today = tournamentToday(now, ORG_TIME_ZONE);
  const list = await readSponsors(orgId);
  const tournamentsShow = !!planId && hasPlanFeature(planId, 'advanced_tournament_branding');
  const about = list.filter(s => s.places.some(p => placeShowing(p, today) && (p.kind !== 'tournament' || tournamentsShow)));
  return { home: homeStrip(list, today).map(publicOf), about: about.map(publicOf) };
}

/** Each division's sponsors showing today, for the "Sponsored by" line under its name (ask 1). */
export async function divisionSponsorsFor(orgId: string, divisionIds: readonly string[], now: Date = new Date()): Promise<Record<string, PublicSponsor[]>> {
  if (!divisionIds.length) return {};
  const today = tournamentToday(now, ORG_TIME_ZONE);
  const { data, error } = await supabaseAdmin.from('club_sponsor_places').select('sponsor_id, target_id, ends_on')
    .eq('org_id', orgId).eq('kind', 'division').in('target_id', divisionIds as string[]);
  if (error) throw error;
  const rows = ((data ?? []) as { sponsor_id: string; target_id: string; ends_on: string | null }[]).filter(r => placeShowing({ endsOn: r.ends_on }, today));
  if (!rows.length) return {};
  const { data: s, error: se } = await supabaseAdmin.from('club_sponsors').select('id, name, logo_url, link, position').eq('org_id', orgId).in('id', [...new Set(rows.map(r => r.sponsor_id))]).order('position');
  if (se) throw se;
  const by = new Map(((s ?? []) as SponsorRow[]).map(r => [r.id, r]));
  const out: Record<string, PublicSponsor[]> = {};
  for (const r of rows) {
    const sp = by.get(r.sponsor_id);
    if (!sp) continue;
    (out[r.target_id] ??= []).push({ id: sp.id, name: sp.name, ...(sp.logo_url ? { logoUrl: sp.logo_url } : {}), ...(sp.link ? { link: sp.link } : {}) });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => (by.get(a.id)?.position ?? 0) - (by.get(b.id)?.position ?? 0));
  return out;
}
