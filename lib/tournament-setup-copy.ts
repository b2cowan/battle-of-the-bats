/**
 * A TOURNAMENT'S SETUP, COPIED — one home for both reuse paths (Tournament admin redesign Stage 5, F33 and F80):
 *
 *   the clone            a NEW draft from a past event (Stage 4's reuse step) — the new draft's rows;
 *   "into this draft"    an EXISTING draft filled from a past event (the draft board's Start from a past tournament).
 *
 * Until Stage 5 these were two copies of the same ~250 lines (lib/db.ts cloneTournament and populateTournamentFrom),
 * and the second deleted the draft's venues, rules, questions and welcome before copying, with no way back if it
 * stopped halfway (F80). Now:
 *
 *   - NOTHING IS REPLACED UNASKED (`keep`): what the draft already holds stays, and the source's is added beside it —
 *     a division, venue, rule section, resource or question the draft already has by that name is not added twice
 *     (a same-named division is the draft's own: the source's rules and welcome point at it, and its pools stay).
 *   - ONE STEP THAT FINISHES OR LEAVES THE DRAFT AS IT WAS: every top-level row written goes on the `ledger`, so a
 *     caller that fails can take back exactly those (their children cascade: a venue's facilities, a division's pools
 *     and slots, a rule's items — the schema's ON DELETE CASCADE, checked 2026-10-10).
 *   - Each parent is written one row at a time, so every copied child points at ITS parent — never paired by the
 *     position a multi-row insert happens to return its rows in (the Part 1 /review's finding, for venues; the same
 *     shape held divisions, pools and rules here).
 *
 * Server-only (supabaseAdmin). Both events are the same org's — the caller reads them by org before calling.
 */
import { supabaseAdmin } from './supabase-admin';
import { copyTournamentVenues } from './tournament-venue-copy';
import { sameKey } from './utils';

export type SetupCopyInclude = {
  divisions: boolean;
  /** A division's pools (only with its divisions). */
  pools: boolean;
  /** The pools' empty schedule slots (only with the pools). */
  slots: boolean;
  venues: boolean;
  rulesResources: boolean;
  welcome: boolean;
  registrationFields: boolean;
  /** A copied division keeps its own fee columns. */
  divisionFees: boolean;
};

export type SetupCopied = {
  venues: number;
  divisions: number;
  pools: number;
  slots: number;
  rules: number;
  resources: number;
  welcome: boolean;
  registrationFields: number;
};

/** The five areas of the reuse step (Stage 4's words, `REUSE_WORDS.areas`), as "into this draft" asks them. */
export type SetupAreas = { structure: boolean; venues: boolean; registration: boolean; publicPresence: boolean; content: boolean };

/** "Into this draft" stopped: `tookBack` = the draft is as it was (every row taken back, its fields put back). */
export class PopulateFailed extends Error {
  readonly tookBack: boolean;
  constructor(tookBack: boolean, cause: unknown) {
    super(cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String((cause as { message: unknown }).message) : 'The setup could not be brought in.');
    this.name = 'PopulateFailed';
    this.tookBack = tookBack;
  }
}

export type SetupLedgerTable = 'diamonds' | 'divisions' | 'rules' | 'resources' | 'announcements' | 'tournament_registration_fields';
/** Every top-level row a copy wrote, in the order written. */
export type SetupLedger = Array<{ table: SetupLedgerTable; id: string }>;

/** "U11 Girls" and " u11  girls " are one name (lib/utils — the one rule, the browser's too). */
export { sameKey };

function remapUuidArray(value: unknown, idMap: Map<string, string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const mapped = value
    .map(id => (typeof id === 'string' ? idMap.get(id) : null))
    .filter((id): id is string => Boolean(id));
  return mapped.length ? mapped : null;
}

/** A resource is its link (a same-named one pointing elsewhere is a different resource); one with no link, its name. */
const resourceKey = (r: { url?: unknown; label?: unknown }) => (sameKey(r.url) ? `url:${sameKey(r.url)}` : `label:${sameKey(r.label)}`);

async function insertOne(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabaseAdmin.from(table).insert(row).select('id').single();
  if (error || !data) throw error ?? new Error(`A ${table} row could not be copied.`);
  return data.id as string;
}

const maxOf = (rows: Array<Record<string, unknown>> | null | undefined, key: string) =>
  (rows ?? []).reduce((m, r) => Math.max(m, typeof r[key] === 'number' ? (r[key] as number) : -1), -1);

/**
 * Copies the chosen parts of one event's setup into another. Throws on any failed write — the ledger then holds what
 * was written, for the caller to take back.
 */
export async function copySetupRows({
  sourceId, targetId, orgId, include, keep = false, ledger,
}: {
  sourceId: string;
  targetId: string;
  orgId: string;
  include: SetupCopyInclude;
  /** Into an existing draft: what it holds stays, and the source's is added beside it. */
  keep?: boolean;
  ledger: SetupLedger;
}): Promise<SetupCopied> {
  const copied: SetupCopied = {
    venues: 0, divisions: 0, pools: 0, slots: 0, rules: 0, resources: 0, welcome: false, registrationFields: 0,
  };

  // ── Venues, with their facilities and both library links (lib/tournament-venue-copy) ─────────────────────────
  if (include.venues) {
    let skip: ((v: { name: string | null; source_org_venue_id: string | null }) => boolean) | undefined;
    if (keep) {
      const { data: held, error } = await supabaseAdmin
        .from('diamonds').select('name, source_org_venue_id').eq('tournament_id', targetId);
      if (error) throw error;
      const names = new Set((held ?? []).map(v => sameKey(v.name)));
      const library = new Set((held ?? []).map(v => v.source_org_venue_id).filter(Boolean));
      skip = v => names.has(sameKey(v.name)) || Boolean(v.source_org_venue_id && library.has(v.source_org_venue_id));
    }
    const { venueIds } = await copyTournamentVenues(sourceId, targetId, {
      skip,
      onInserted: id => ledger.push({ table: 'diamonds', id }),
    });
    copied.venues = venueIds.length;
  }

  // ── Divisions, their pools and empty slots ──────────────────────────────────────────────────────────────────
  const divisionIdMap = new Map<string, string>();
  if (include.divisions) {
    const { data: divisions, error } = await supabaseAdmin
      .from('divisions').select('*').eq('tournament_id', sourceId).order('display_order', { ascending: true });
    if (error) throw error;

    const heldByName = new Map<string, string>();
    let nextOrder: number | null = null;
    if (keep) {
      const { data: held, error: heldError } = await supabaseAdmin
        .from('divisions').select('id, name, display_order').eq('tournament_id', targetId);
      if (heldError) throw heldError;
      for (const d of held ?? []) heldByName.set(sameKey(d.name), d.id as string);
      nextOrder = maxOf(held, 'display_order') + 1;
    }

    const added: string[] = [];
    for (const group of divisions ?? []) {
      const held = heldByName.get(sameKey(group.name));
      if (held) { divisionIdMap.set(group.id, held); continue; }
      const id = await insertOne('divisions', {
        tournament_id: targetId,
        name: group.name,
        min_age: group.min_age,
        max_age: group.max_age,
        // Beside what the draft holds: after its own.
        display_order: nextOrder === null ? group.display_order : nextOrder++,
        is_closed: false,
        capacity: group.capacity,
        pool_count: group.pool_count,
        pool_names: group.pool_names,
        requires_pool_selection: group.requires_pool_selection ?? false,
        playoff_config: group.playoff_config,
        schedule_visibility: 'unpublished',
        deposit_amount: include.divisionFees ? group.deposit_amount ?? null : null,
        deposit_due_date: include.divisionFees ? group.deposit_due_date ?? null : null,
        total_fee_amount: include.divisionFees ? group.total_fee_amount ?? null : null,
        total_fee_due_date: include.divisionFees ? group.total_fee_due_date ?? null : null,
      });
      ledger.push({ table: 'divisions', id });
      divisionIdMap.set(group.id, id);
      added.push(group.id);
    }
    copied.divisions = added.length;

    // Pools and slots only for a division this copy ADDED: a same-named division the draft holds keeps its own.
    if (include.pools && added.length) {
      const { data: pools, error: poolsError } = await supabaseAdmin
        .from('pools').select('*').in('division_id', added).order('display_order', { ascending: true });
      if (poolsError) throw poolsError;
      const poolIdMap = new Map<string, string>();
      for (const pool of pools ?? []) {
        const division = divisionIdMap.get(pool.division_id);
        if (!division) continue;
        poolIdMap.set(pool.id, await insertOne('pools', { division_id: division, name: pool.name, display_order: pool.display_order }));
      }
      copied.pools = poolIdMap.size;

      if (include.slots && poolIdMap.size) {
        const { data: slots, error: slotsError } = await supabaseAdmin
          .from('pool_slots').select('*').eq('tournament_id', sourceId).order('slot_number', { ascending: true });
        if (slotsError) throw slotsError;
        const slotRows = (slots ?? [])
          .filter(slot => poolIdMap.has(slot.pool_id) && divisionIdMap.has(slot.division_id))
          .map(slot => ({
            pool_id: poolIdMap.get(slot.pool_id),
            tournament_id: targetId,
            division_id: divisionIdMap.get(slot.division_id),
            slot_number: slot.slot_number,
            display_name: slot.display_name,
            team_id: null,
          }));
        if (slotRows.length) {
          const { data: inserted, error: slotInsertError } = await supabaseAdmin.from('pool_slots').insert(slotRows).select('id');
          if (slotInsertError) throw slotInsertError;
          copied.slots = inserted?.length ?? 0;
        }
      }
    }
  }

  // A rule section or the welcome scoped to some divisions keeps that scope even when the divisions themselves aren't
  // brought in ("Content" without "Event structure" — /review 2026-10-10): each source division points at the target's
  // same-named one. A scope none of whose divisions exist in the target reads as every division, as the clone always has.
  if ((include.rulesResources || include.welcome) && divisionIdMap.size === 0) {
    const [{ data: from, error: fromError }, { data: into, error: intoError }] = await Promise.all([
      supabaseAdmin.from('divisions').select('id, name').eq('tournament_id', sourceId),
      supabaseAdmin.from('divisions').select('id, name').eq('tournament_id', targetId),
    ]);
    if (fromError) throw fromError;
    if (intoError) throw intoError;
    const byName = new Map((into ?? []).map(d => [sameKey(d.name), d.id as string]));
    for (const d of from ?? []) {
      const match = byName.get(sameKey(d.name));
      if (match) divisionIdMap.set(d.id as string, match);
    }
  }

  // ── Rules (with their items) and resources ──────────────────────────────────────────────────────────────────
  if (include.rulesResources) {
    const { data: rules, error } = await supabaseAdmin
      .from('rules').select('*').eq('tournament_id', sourceId).order('display_order', { ascending: true });
    if (error) throw error;
    let heldTitles = new Set<string>();
    let nextRule: number | null = null;
    if (keep) {
      const { data: held, error: heldError } = await supabaseAdmin
        .from('rules').select('title, display_order').eq('tournament_id', targetId);
      if (heldError) throw heldError;
      heldTitles = new Set((held ?? []).map(r => sameKey(r.title)));
      nextRule = maxOf(held, 'display_order') + 1;
    }
    const ruleIdMap = new Map<string, string>();
    for (const rule of rules ?? []) {
      if (heldTitles.has(sameKey(rule.title))) continue;
      const id = await insertOne('rules', {
        tournament_id: targetId,
        title: rule.title,
        icon: rule.icon,
        display_order: nextRule === null ? rule.display_order : nextRule++,
        division_ids: remapUuidArray(rule.division_ids, divisionIdMap),
      });
      ledger.push({ table: 'rules', id });
      ruleIdMap.set(rule.id, id);
    }
    copied.rules = ruleIdMap.size;

    if (ruleIdMap.size) {
      const { data: items, error: itemError } = await supabaseAdmin
        .from('rule_items').select('*').in('rule_id', [...ruleIdMap.keys()]).order('display_order', { ascending: true });
      if (itemError) throw itemError;
      const itemRows = (items ?? []).map(item => ({ rule_id: ruleIdMap.get(item.rule_id), content: item.content, display_order: item.display_order }));
      if (itemRows.length) {
        const { error: itemInsertError } = await supabaseAdmin.from('rule_items').insert(itemRows);
        if (itemInsertError) throw itemInsertError;
      }
    }

    const { data: resources, error: resourceError } = await supabaseAdmin
      .from('resources').select('*').eq('tournament_id', sourceId).order('display_order', { ascending: true });
    if (resourceError) throw resourceError;
    let heldResources = new Set<string>();
    let nextResource: number | null = null;
    if (keep) {
      const { data: held, error: heldError } = await supabaseAdmin
        .from('resources').select('label, url, display_order').eq('tournament_id', targetId);
      if (heldError) throw heldError;
      heldResources = new Set((held ?? []).map(resourceKey).filter(Boolean));
      nextResource = maxOf(held, 'display_order') + 1;
    }
    const resourceRows = (resources ?? [])
      .filter(r => !heldResources.has(resourceKey(r)))
      .map(r => ({
        tournament_id: targetId,
        label: r.label,
        url: r.url,
        display_order: nextResource === null ? r.display_order : nextResource++,
      }));
    if (resourceRows.length) {
      const { data: inserted, error: insertError } = await supabaseAdmin.from('resources').insert(resourceRows).select('id');
      if (insertError) throw insertError;
      for (const r of inserted ?? []) ledger.push({ table: 'resources', id: r.id as string });
      copied.resources = inserted?.length ?? 0;
    }
  }

  // ── The welcome post ────────────────────────────────────────────────────────────────────────────────────────
  if (include.welcome) {
    let held = false;
    if (keep) {
      const { count, error } = await supabaseAdmin
        .from('announcements').select('id', { count: 'exact', head: true })
        .eq('tournament_id', targetId).eq('title', 'Welcome!').is('deleted_at', null);
      if (error) throw error;
      held = (count ?? 0) > 0;
    }
    if (!held) {
      const { data: welcome, error } = await supabaseAdmin
        .from('announcements').select('*')
        .eq('tournament_id', sourceId).eq('title', 'Welcome!')
        .order('published_at', { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      if (welcome?.body) {
        const id = await insertOne('announcements', {
          tournament_id: targetId,
          title: 'Welcome!',
          body: welcome.body,
          published_at: new Date().toISOString(),
          pinned: true,
          division_ids: remapUuidArray(welcome.division_ids, divisionIdMap),
        });
        ledger.push({ table: 'announcements', id });
        copied.welcome = true;
      }
    }
  }

  // ── Registration questions ──────────────────────────────────────────────────────────────────────────────────
  if (include.registrationFields) {
    const { data: fields, error } = await supabaseAdmin
      .from('tournament_registration_fields').select('*')
      .eq('tournament_id', sourceId).eq('org_id', orgId).eq('is_archived', false)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    let heldLabels = new Set<string>();
    let nextSort: number | null = null;
    if (keep) {
      const { data: held, error: heldError } = await supabaseAdmin
        .from('tournament_registration_fields').select('label, sort_order').eq('tournament_id', targetId).eq('is_archived', false);
      if (heldError) throw heldError;
      heldLabels = new Set((held ?? []).map(f => sameKey(f.label)));
      nextSort = maxOf(held, 'sort_order') + 1;
    }
    const fieldRows = (fields ?? [])
      .filter(f => !heldLabels.has(sameKey(f.label)))
      .map(f => ({
        tournament_id: targetId,
        org_id: orgId,
        label: f.label,
        field_type: f.field_type,
        options: f.options ?? [],
        required: f.required ?? false,
        sort_order: nextSort === null ? f.sort_order ?? 0 : nextSort++,
        is_archived: false,
      }));
    if (fieldRows.length) {
      const { data: inserted, error: insertError } = await supabaseAdmin.from('tournament_registration_fields').insert(fieldRows).select('id');
      if (insertError) throw insertError;
      for (const r of inserted ?? []) ledger.push({ table: 'tournament_registration_fields', id: r.id as string });
      copied.registrationFields = inserted?.length ?? 0;
    }
  }

  return copied;
}

/**
 * Takes back what a failed copy wrote into `targetId`, newest first (each row's children cascade). Returns false when
 * any delete failed — the caller then says the draft may hold part of it.
 */
export async function takeBackSetupRows(targetId: string, ledger: SetupLedger): Promise<boolean> {
  let clean = true;
  for (const { table, id } of [...ledger].reverse()) {
    const { error } = await supabaseAdmin.from(table).delete().eq('id', id).eq('tournament_id', targetId);
    if (error) {
      clean = false;
      console.error(`[tournament-setup-copy] could not take back ${table} ${id}`, error);
    }
  }
  return clean;
}
