import { supabase } from './supabase';
import { supabaseAdmin } from './supabase-admin';
import { getEffectiveTournamentLimit, getEffectiveTeamLimit, PLAN_CONFIG } from './plan-config';
import { createClient as createBrowserSupabaseClient } from './supabase-browser';
import { getActiveTeamEntitledRepTeamIds } from './team-workspace-entitlements';
import { applyEntitlementGrants } from './entitlement-grants';
import { Tournament, TournamentStatus, Venue, VenueFacility, OrgVenue, OrgVenueFacility, FacilityType, Division, Pool, PoolSlot, Team, Game, Announcement, PlayoffConfig, RuleSection, RuleItem, Resource, Organization, OrganizationMember, OrgPlan, OrgRole, TournamentArchive, OrgPublicSiteContent, AccountingLedger, AccountingEntry, LedgerSummary, AccountingEntryStatus, AccountingEntryType, LeagueSeason, LeagueDivision, LeagueTeam, LeagueRegistration, LeagueGame, LeagueStandingsRow, LeagueSeasonSummary, LeagueRegistrationStatus, LeagueSeasonStatus, LeaguePractice, LeaguePracticeStatus, RepTeam, RepProgramYear, RepProgramYearStatus, RepTeamCoach, RepTryoutRegistration, RepTryoutRegistrationStatus, RepTryout, RepTryoutSession, RepTryoutRubric, RepTryoutRubricCategory, RepTryoutEvaluatorSession, RepTryoutScore, RepRosterPlayer, RepRosterStatus, RepTeamEvent, RepEventType, RepTeamEventAttendance, RepAttendanceStatus, RepLineupMode, RepTeamLineup, RepTeamLineupEntry, RepTeamLineupTemplate, RepTeamLineupTemplateEntry, RepDocumentTemplate, RepDocumentType, RepPlayerDocument, RepCostAllocation, RepAllocationSplit, RepAllocationInstallment, RepPlayerDuesSchedule, RepPlayerDuesInstallment, RepTeamExpense, OrgPayee, TournamentRegistrationField, TournamentRegistrationFieldAnswer, TournamentRegistrationFieldType } from './types';
import { computeTournamentStandings, type DivisionStandingRow } from './tie-breakers';
import { resolvePlayoffWinner } from './playoff-bracket';
import { DEFAULT_SPORT } from './sports';
import { generateOfferToken, hashOfferToken } from './tryout-offer-token';
import { resolveCoachCapabilities, type CoachCapabilities, type AssistantCapabilityGrants } from './coach-capabilities';
// Re-export so existing import sites (e.g. '@/lib/db') keep working.
export { computeTournamentStandings } from './tie-breakers';
export type { DivisionStandingRow } from './tie-breakers';

// Use the SSR browser client (cookie-based session) for writes that need auth;
// falls back to anon client on the server where there is no window.
function authClient() {
  return typeof window !== 'undefined' ? createBrowserSupabaseClient() : supabase;
}

type ReadOptions = {
  admin?: boolean;
};

function readClient(options: ReadOptions = {}) {
  return options.admin || typeof window === 'undefined' ? supabaseAdmin : supabase;
}

// --- Tournaments ---
export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await readClient().from('tournaments').select('*').order('year', { ascending: false });
  if (error || !data) {
    if (error) console.error('getTournaments error', error);
    return [];
  }
  return data.map(mapTournament);
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await readClient().from('tournaments').select('*').eq('id', id).single();
  if (error || !data) {
    if (error) console.error('getTournament error', error);
    return null;
  }
  return mapTournament(data);
}

export async function saveTournament(t: Omit<Tournament, 'id'>): Promise<Tournament | null> {
  if (t.isActive && t.organizationId) {
    await authClient().from('tournaments')
      .update({ is_active: false, status: 'completed' })
      .eq('org_id', t.organizationId);
  }

  const { data, error } = await authClient()
    .from('tournaments')
    .insert({
      year: t.year,
      name: t.name,
      slug: t.slug,
      sport: t.sport ?? DEFAULT_SPORT,
      status: t.status ?? (t.isActive ? 'active' : 'draft'),
      is_active: t.isActive,
      start_date: t.startDate,
      end_date: t.endDate,
    })
    .select()
    .single();

  if (error) {
    console.error('saveTournament error', error);
    return null;
  }

  return mapTournament(data);
}

export async function cloneVenues(targetTid: string, sourceVenues: Venue[]): Promise<void> {
  if (sourceVenues.length === 0) return;
  const rows = sourceVenues.map(d => ({
    tournament_id: targetTid,
    name: d.name,
    address: d.address,
    notes: d.notes
  }));
  await authClient().from('diamonds').insert(rows);
}

export async function initializeDivisions(targetTid: string, selectedDivisions: { name: string, capacity: number, poolCount: number, poolNames?: string, requiresPoolSelection: boolean }[]): Promise<void> {
  if (selectedDivisions.length === 0) return;

  const defaults: Record<string, { min: number, max: number, order: number }> = {
    'U11': { min: 9, max: 11, order: 1 },
    'U13': { min: 11, max: 13, order: 2 },
    'U15': { min: 13, max: 15, order: 3 },
    'U17': { min: 15, max: 17, order: 4 },
    'U19': { min: 17, max: 19, order: 5 },
  };

  const rows = selectedDivisions.map(div => {
    const config = defaults[div.name] || { min: 0, max: 99, order: 10 };
    return {
      tournament_id: targetTid,
      name: div.name,
      min_age: config.min,
      max_age: config.max,
      display_order: config.order,
      is_closed: false,
      capacity: div.capacity,
      pool_count: div.poolCount,
      pool_names: div.poolNames,
      requires_pool_selection: div.requiresPoolSelection
    };
  });

  const { data: groups, error } = await authClient().from('divisions').insert(rows).select();
  if (error) {
    console.error('initializeDivisions error:', error);
    throw error;
  }

  // 3. Create real pool records for each group (Batch)
  if (groups && groups.length > 0) {
    const poolRows: any[] = [];
    for (const g of groups) {
      const pCount = g.pool_count || 1;
      const names = (g.pool_names || '').split(',').map((n: string) => n.trim()).filter(Boolean);
      for (let i = 0; i < pCount; i++) {
        const name = names[i] || String.fromCharCode(65 + i);
        poolRows.push({
          division_id: g.id,
          name: name.startsWith('Pool ') ? name.replace('Pool ', '') : name, // Normalize: store 'A' instead of 'Pool A'
          display_order: i
        });
      }
    }

    if (poolRows.length > 0) {
      const { error: poolError } = await authClient().from('pools').insert(poolRows);
      if (poolError) {
        console.error('Pool initialization error:', poolError);
        throw poolError;
      }
    }
  }
}

export async function updateTournament(id: string, t: Partial<Tournament>): Promise<void> {
  if (t.isActive) {
    const { data: existing } = await supabase.from('tournaments').select('org_id').eq('id', id).single();
    if (existing?.org_id) {
      await authClient().from('tournaments')
        .update({ is_active: false, status: 'completed' })
        .eq('org_id', existing.org_id)
        .neq('id', id);
    }
  }

  const updates: any = {};
  if (t.year !== undefined) updates.year = t.year;
  if (t.name !== undefined) updates.name = t.name;
  if (t.slug !== undefined) updates.slug = t.slug;
  if (t.status !== undefined) { updates.status = t.status; updates.is_active = t.status === 'active'; }
  if (t.isActive !== undefined) updates.is_active = t.isActive;
  if (t.startDate !== undefined) updates.start_date = t.startDate;
  if (t.endDate !== undefined) updates.end_date = t.endDate;
  await authClient().from('tournaments').update(updates).eq('id', id);
}

export async function deleteTournament(id: string): Promise<void> {
  await authClient().from('tournaments').delete().eq('id', id);
}

export async function setActiveTournament(id: string): Promise<void> {
  const { data: t } = await supabase.from('tournaments').select('org_id').eq('id', id).single();
  if (t?.org_id) {
    await authClient().from('tournaments')
      .update({ is_active: false, status: 'completed' })
      .eq('org_id', t.org_id)
      .neq('id', id);
  }
  await authClient().from('tournaments').update({ is_active: true, status: 'active' }).eq('id', id);
}

export type CloneTournamentOptions = {
  name: string;
  slug: string;
  year: number;
  startDate?: string | null;
  endDate?: string | null;
  includeDivisions?: boolean;
  includePools?: boolean;
  includeSlots?: boolean;
  includeVenues?: boolean;
  includeBranding?: boolean;
  includePublicPages?: boolean;
  includeWelcome?: boolean;
  includeRulesResources?: boolean;
  includeRegistrationFields?: boolean;
  includeFeeSchedule?: boolean;
};

export type CloneTournamentResult = {
  tournament: Tournament;
  copied: {
    venues: number;
    divisions: number;
    pools: number;
    slots: number;
    rules: number;
    resources: number;
    welcome: boolean;
    registrationFields: number;
  };
};

/**
 * Coerce a tournament `settings` JSONB value into a plain object before copying it.
 * The column defaults to '{}' and the write path enforces object shape, but a malformed
 * value (array/scalar from a direct DB write or legacy row) must not propagate through a
 * clone/populate — fall back to an empty object. Mirrors the defensive read pattern used
 * elsewhere (e.g. tournament-dashboard route).
 */
function toSettingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function remapUuidArray(value: unknown, idMap: Map<string, string>): string[] | null {
  if (!Array.isArray(value)) return null;
  const mapped = value
    .map(id => typeof id === 'string' ? idMap.get(id) : null)
    .filter((id): id is string => Boolean(id));
  return mapped.length ? mapped : null;
}

export async function cloneTournament(
  sourceTournamentId: string,
  orgId: string,
  options: CloneTournamentOptions,
): Promise<CloneTournamentResult> {
  let targetTournamentId: string | null = null;

  try {
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', sourceTournamentId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source) throw new Error('Source tournament not found.');

    // Carry the event's configuration DNA (tie-breakers, game timing, roster rules,
    // coach-email toggles, format) so a clone reproduces last year's setup. Respect the
    // granular include flags: when the organizer opts out of fees or rules/resources,
    // don't silently carry those domains' settings keys either. settings holds only
    // enums/booleans/strings (no entity ids), so the copy is reference-safe.
    const clonedSettings = toSettingsObject(source.settings);
    if (!options.includeFeeSchedule) {
      delete clonedSettings.fee_scope;
      delete clonedSettings.show_fees_on_register;
      delete clonedSettings.payment_instructions;
      delete clonedSettings.payment_instructions_on_form;
    }
    if (!options.includeRulesResources) {
      delete clonedSettings.rulesLayout;
      delete clonedSettings.resourcesLayout;
    }

    const tournamentInsert: Record<string, unknown> = {
      org_id: orgId,
      year: options.year,
      name: options.name,
      slug: options.slug,
      // Carry the source event's sport (multi-sport, Phase 1). Defaults to softball for
      // pre-migration sources; the column default covers brand-new tournaments.
      sport: source.sport ?? DEFAULT_SPORT,
      status: 'draft',
      is_active: false,
      start_date: options.startDate ?? null,
      end_date: options.endDate ?? null,
      contact_email: source.contact_email ?? null,
      // Inherit the source event's public contact so the cloned draft is never contactless.
      default_contact_member_id: source.default_contact_member_id ?? null,
      // Inherit per-audience contact visibility (mig 120) so a clone can't silently re-expose
      // a contact the organizer had hidden on the source event.
      contact_show_to_coaches: source.contact_show_to_coaches ?? true,
      contact_show_on_public: source.contact_show_on_public ?? true,
      require_score_finalization: source.require_score_finalization ?? null,
      settings: clonedSettings,
    };

    if (options.includeFeeSchedule) {
      tournamentInsert.fee_schedule_mode = source.fee_schedule_mode ?? 'tournament';
      tournamentInsert.deposit_amount = source.deposit_amount ?? null;
      tournamentInsert.deposit_due_date = source.deposit_due_date ?? null;
      tournamentInsert.total_fee_amount = source.total_fee_amount ?? null;
      tournamentInsert.total_fee_due_date = source.total_fee_due_date ?? null;
    }

    if (options.includeBranding) {
      tournamentInsert.logo_url = source.logo_url ?? null;
      tournamentInsert.hero_banner_url = source.hero_banner_url ?? null;
      tournamentInsert.theme_preset = source.theme_preset ?? null;
      tournamentInsert.theme_primary = source.theme_primary ?? null;
      tournamentInsert.theme_accent = source.theme_accent ?? null;
      tournamentInsert.theme_font = source.theme_font ?? null;
      tournamentInsert.theme_card_style = source.theme_card_style ?? null;
      tournamentInsert.color_mode = source.color_mode ?? null;
      tournamentInsert.icon_bg_color = source.icon_bg_color ?? null;
      tournamentInsert.app_name = source.app_name ?? null;
      tournamentInsert.app_icon_scale = source.app_icon_scale ?? null;
    }

    if (options.includePublicPages) {
      tournamentInsert.public_hidden_pages = Array.isArray(source.public_hidden_pages)
        ? source.public_hidden_pages
        : [];
      // Carry the coach-name visibility choice with the rest of the public-site config (mig 150).
      tournamentInsert.coach_names_show_on_public = source.coach_names_show_on_public === true;
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('tournaments')
      .insert(tournamentInsert)
      .select()
      .single();

    if (targetError) throw targetError;
    targetTournamentId = target.id;

    const copied: CloneTournamentResult['copied'] = {
      venues: 0,
      divisions: 0,
      pools: 0,
      slots: 0,
      rules: 0,
      resources: 0,
      welcome: false,
      registrationFields: 0,
    };

    if (options.includeVenues) {
      const { data: venues, error } = await supabaseAdmin
        .from('diamonds')
        .select('*')
        .eq('tournament_id', sourceTournamentId)
        .order('name', { ascending: true });
      if (error) throw error;

      if (venues?.length) {
        const { data: insertedVenues, error: insertError } = await supabaseAdmin
          .from('diamonds')
          .insert(venues.map(venue => ({
            tournament_id: targetTournamentId,
            name: venue.name,
            address: venue.address,
            notes: venue.notes,
          })))
          .select('id');
        if (insertError) throw insertError;
        copied.venues = insertedVenues?.length ?? 0;
      }
    }

    const divisionIdMap = new Map<string, string>();
    const poolIdMap = new Map<string, string>();

    if (options.includeDivisions) {
      const { data: divisions, error } = await supabaseAdmin
        .from('divisions')
        .select('*')
        .eq('tournament_id', sourceTournamentId)
        .order('display_order', { ascending: true });
      if (error) throw error;

      if (divisions?.length) {
        const { data: insertedGroups, error: insertError } = await supabaseAdmin
          .from('divisions')
          .insert(divisions.map(group => ({
            tournament_id: targetTournamentId,
            name: group.name,
            min_age: group.min_age,
            max_age: group.max_age,
            display_order: group.display_order,
            is_closed: false,
            capacity: group.capacity,
            pool_count: group.pool_count,
            pool_names: group.pool_names,
            requires_pool_selection: group.requires_pool_selection ?? false,
            playoff_config: group.playoff_config,
            schedule_visibility: 'unpublished',
            deposit_amount: options.includeFeeSchedule ? group.deposit_amount ?? null : null,
            deposit_due_date: options.includeFeeSchedule ? group.deposit_due_date ?? null : null,
            total_fee_amount: options.includeFeeSchedule ? group.total_fee_amount ?? null : null,
            total_fee_due_date: options.includeFeeSchedule ? group.total_fee_due_date ?? null : null,
          })))
          .select('id');
        if (insertError) throw insertError;
        divisions.forEach((group, index) => {
          const inserted = insertedGroups?.[index];
          if (inserted?.id) divisionIdMap.set(group.id, inserted.id);
        });
        copied.divisions = insertedGroups?.length ?? 0;

        if (options.includePools) {
          const { data: pools, error: poolsError } = await supabaseAdmin
            .from('pools')
            .select('*')
            .in('division_id', divisions.map(group => group.id))
            .order('display_order', { ascending: true });
          if (poolsError) throw poolsError;

          if (pools?.length) {
            const { data: insertedPools, error: poolInsertError } = await supabaseAdmin
              .from('pools')
              .insert(pools.map(pool => ({
                division_id: divisionIdMap.get(pool.division_id),
                name: pool.name,
                display_order: pool.display_order,
              })))
              .select('id');
            if (poolInsertError) throw poolInsertError;
            pools.forEach((pool, index) => {
              const inserted = insertedPools?.[index];
              if (inserted?.id) poolIdMap.set(pool.id, inserted.id);
            });
            copied.pools = insertedPools?.length ?? 0;

            if (options.includeSlots) {
              const { data: slots, error: slotsError } = await supabaseAdmin
                .from('pool_slots')
                .select('*')
                .eq('tournament_id', sourceTournamentId)
                .order('slot_number', { ascending: true });
              if (slotsError) throw slotsError;

              const slotRows = (slots ?? [])
                .map(slot => ({
                  pool_id: poolIdMap.get(slot.pool_id),
                  tournament_id: targetTournamentId,
                  division_id: divisionIdMap.get(slot.division_id),
                  slot_number: slot.slot_number,
                  display_name: slot.display_name,
                  team_id: null,
                }))
                .filter(slot => slot.pool_id && slot.division_id);

              if (slotRows.length) {
                const { data: insertedSlots, error: slotInsertError } = await supabaseAdmin
                  .from('pool_slots')
                  .insert(slotRows)
                  .select('id');
                if (slotInsertError) throw slotInsertError;
                copied.slots = insertedSlots?.length ?? 0;
              }
            }
          }
        }
      }
    }

    if (options.includeRulesResources) {
      const { data: rules, error } = await supabaseAdmin
        .from('rules')
        .select('*')
        .eq('tournament_id', sourceTournamentId)
        .order('display_order', { ascending: true });
      if (error) throw error;

      if (rules?.length) {
        const { data: insertedRules, error: insertError } = await supabaseAdmin
          .from('rules')
          .insert(rules.map(rule => ({
            tournament_id: targetTournamentId,
            title: rule.title,
            icon: rule.icon,
            display_order: rule.display_order,
            division_ids: remapUuidArray(rule.division_ids, divisionIdMap),
          })))
          .select('id');
        if (insertError) throw insertError;
        copied.rules = insertedRules?.length ?? 0;

        const ruleIdMap = new Map<string, string>();
        rules.forEach((rule, index) => {
          const inserted = insertedRules?.[index];
          if (inserted?.id) ruleIdMap.set(rule.id, inserted.id);
        });

        const { data: ruleItems, error: itemError } = await supabaseAdmin
          .from('rule_items')
          .select('*')
          .in('rule_id', rules.map(rule => rule.id))
          .order('display_order', { ascending: true });
        if (itemError) throw itemError;

        const itemRows = (ruleItems ?? [])
          .map(item => ({
            rule_id: ruleIdMap.get(item.rule_id),
            content: item.content,
            display_order: item.display_order,
          }))
          .filter(item => item.rule_id);
        if (itemRows.length) {
          const { error: itemInsertError } = await supabaseAdmin.from('rule_items').insert(itemRows);
          if (itemInsertError) throw itemInsertError;
        }
      }

      const { data: resources, error: resourceError } = await supabaseAdmin
        .from('resources')
        .select('*')
        .eq('tournament_id', sourceTournamentId)
        .order('display_order', { ascending: true });
      if (resourceError) throw resourceError;

      if (resources?.length) {
        const { data: insertedResources, error: insertError } = await supabaseAdmin
          .from('resources')
          .insert(resources.map(resource => ({
            tournament_id: targetTournamentId,
            label: resource.label,
            url: resource.url,
            display_order: resource.display_order,
          })))
          .select('id');
        if (insertError) throw insertError;
        copied.resources = insertedResources?.length ?? 0;
      }
    }

    if (options.includeWelcome) {
      const { data: welcome, error } = await supabaseAdmin
        .from('announcements')
        .select('*')
        .eq('tournament_id', sourceTournamentId)
        .eq('title', 'Welcome!')
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (welcome?.body) {
        const { error: welcomeInsertError } = await supabaseAdmin.from('announcements').insert({
          tournament_id: targetTournamentId,
          title: 'Welcome!',
          body: welcome.body,
          published_at: new Date().toISOString(),
          pinned: true,
          division_ids: remapUuidArray(welcome.division_ids, divisionIdMap),
        });
        if (welcomeInsertError) throw welcomeInsertError;
        copied.welcome = true;
      }
    }

    if (options.includeRegistrationFields) {
      const { data: fields, error } = await supabaseAdmin
        .from('tournament_registration_fields')
        .select('*')
        .eq('tournament_id', sourceTournamentId)
        .eq('org_id', orgId)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });
      if (error) throw error;

      if (fields?.length) {
        const { data: insertedFields, error: insertError } = await supabaseAdmin
          .from('tournament_registration_fields')
          .insert(fields.map(field => ({
            tournament_id: targetTournamentId,
            org_id: orgId,
            label: field.label,
            field_type: field.field_type,
            options: field.options ?? [],
            required: field.required ?? false,
            sort_order: field.sort_order ?? 0,
            is_archived: false,
          })))
          .select('id');
        if (insertError) throw insertError;
        copied.registrationFields = insertedFields?.length ?? 0;
      }
    }

    return {
      tournament: mapTournament(target),
      copied,
    };
  } catch (error) {
    if (targetTournamentId) {
      await supabaseAdmin.from('tournaments').delete().eq('id', targetTournamentId).eq('org_id', orgId);
    }
    throw error;
  }
}

// --- Populate Tournament From Source ---
export type PopulateTournamentResult = {
  copied: {
    venues: number;
    divisions: number;
    pools: number;
    slots: number;
    rules: number;
    resources: number;
    welcome: boolean;
    registrationFields: number;
  };
};

/**
 * Wipes the setup data of an existing draft tournament and repopulates it
 * from a source tournament in the same org. The destination's name, slug,
 * year, and dates are left untouched — only setup content is replaced.
 */
export async function populateTournamentFrom(
  destinationTournamentId: string,
  sourceTournamentId: string,
  orgId: string,
): Promise<PopulateTournamentResult> {
  if (destinationTournamentId === sourceTournamentId) {
    throw new Error('Source and destination must be different tournaments.');
  }

  const [{ data: destination, error: destError }, { data: source, error: sourceError }] = await Promise.all([
    supabaseAdmin.from('tournaments').select('*').eq('id', destinationTournamentId).eq('org_id', orgId).maybeSingle(),
    supabaseAdmin.from('tournaments').select('*').eq('id', sourceTournamentId).eq('org_id', orgId).maybeSingle(),
  ]);
  if (destError) throw destError;
  if (sourceError) throw sourceError;
  if (!destination) throw new Error('Destination tournament not found.');
  if (!source) throw new Error('Source tournament not found.');
  if (destination.status !== 'draft') throw new Error('Can only populate a draft tournament.');

  // ── Clear existing destination data ───────────────────────────────────────
  const { data: existingDivisions } = await supabaseAdmin
    .from('divisions').select('id').eq('tournament_id', destinationTournamentId);
  const existingDivisionIds = (existingDivisions ?? []).map(g => g.id);

  let existingPoolIds: string[] = [];
  if (existingDivisionIds.length > 0) {
    const { data: existingPools } = await supabaseAdmin
      .from('pools').select('id').in('division_id', existingDivisionIds);
    existingPoolIds = (existingPools ?? []).map(p => p.id);
  }

  const { data: existingRules } = await supabaseAdmin
    .from('rules').select('id').eq('tournament_id', destinationTournamentId);
  const existingRuleIds = (existingRules ?? []).map(r => r.id);

  // Delete in dependency order
  if (existingPoolIds.length > 0) {
    const { error } = await supabaseAdmin.from('pool_slots').delete().in('pool_id', existingPoolIds);
    if (error) throw error;
  }
  await supabaseAdmin.from('pool_slots').delete().eq('tournament_id', destinationTournamentId);

  if (existingPoolIds.length > 0) {
    const { error } = await supabaseAdmin.from('pools').delete().in('id', existingPoolIds);
    if (error) throw error;
  }
  if (existingDivisionIds.length > 0) {
    const { error } = await supabaseAdmin.from('divisions').delete().in('id', existingDivisionIds);
    if (error) throw error;
  }
  if (existingRuleIds.length > 0) {
    await supabaseAdmin.from('rule_items').delete().in('rule_id', existingRuleIds);
    await supabaseAdmin.from('rules').delete().in('id', existingRuleIds);
  }

  await Promise.all([
    supabaseAdmin.from('diamonds').delete().eq('tournament_id', destinationTournamentId),
    supabaseAdmin.from('resources').delete().eq('tournament_id', destinationTournamentId),
    supabaseAdmin.from('tournament_registration_fields').delete().eq('tournament_id', destinationTournamentId),
    supabaseAdmin.from('announcements').delete().eq('tournament_id', destinationTournamentId).eq('title', 'Welcome!'),
  ]);

  // ── Copy tournament-level fields from source ───────────────────────────────
  const { error: updateError } = await supabaseAdmin.from('tournaments').update({
    // Carry the source event's sport (multi-sport, Phase 1).
    sport: source.sport ?? DEFAULT_SPORT,
    contact_email: source.contact_email ?? null,
    // Carry the selected contact member too (source & destination are same-org, so the
    // member id is valid here) — without it, populating drops the primary contact and the
    // launch checklist/activation would flag "no contact" even though the source had one.
    default_contact_member_id: source.default_contact_member_id ?? null,
    // Carry per-audience contact visibility (mig 120) so populating from a source can't silently
    // re-expose a contact the organizer had hidden.
    contact_show_to_coaches: source.contact_show_to_coaches ?? true,
    contact_show_on_public: source.contact_show_on_public ?? true,
    require_score_finalization: source.require_score_finalization ?? null,
    // Carry the event's configuration DNA (tie-breakers, game timing, roster rules,
    // coach-email toggles, format) — previously dropped, so populating a draft from a
    // source silently lost all of it. populate is a wholesale replace (it already deletes
    // + recreates divisions/pools/rules), so settings are copied in full. settings holds
    // only enums/booleans/strings (no entity ids), so the copy is reference-safe.
    settings: toSettingsObject(source.settings),
    fee_schedule_mode: source.fee_schedule_mode ?? 'tournament',
    deposit_amount: source.deposit_amount ?? null,
    deposit_due_date: source.deposit_due_date ?? null,
    total_fee_amount: source.total_fee_amount ?? null,
    total_fee_due_date: source.total_fee_due_date ?? null,
    logo_url: source.logo_url ?? null,
    hero_banner_url: source.hero_banner_url ?? null,
    theme_preset: source.theme_preset ?? null,
    theme_primary: source.theme_primary ?? null,
    theme_accent: source.theme_accent ?? null,
    theme_font: source.theme_font ?? null,
    theme_card_style: source.theme_card_style ?? null,
    color_mode: source.color_mode ?? null,
    icon_bg_color: source.icon_bg_color ?? null,
    app_name: source.app_name ?? null,
    app_icon_scale: source.app_icon_scale ?? null,
    public_hidden_pages: Array.isArray(source.public_hidden_pages) ? source.public_hidden_pages : [],
    // Carry coach-name visibility (mig 150) so populating from a source can't silently re-expose
    // (or hide) coach names against the organizer's saved choice.
    coach_names_show_on_public: source.coach_names_show_on_public === true,
  }).eq('id', destinationTournamentId);
  if (updateError) throw updateError;

  // ── Copy related data from source to destination ───────────────────────────
  const copied: PopulateTournamentResult['copied'] = {
    venues: 0, divisions: 0, pools: 0, slots: 0,
    rules: 0, resources: 0, welcome: false, registrationFields: 0,
  };

  const divisionIdMap = new Map<string, string>();
  const poolIdMap = new Map<string, string>();

  // Venues + facilities (copy parent venues then their facilities)
  const { data: venues, error: venuesError } = await supabaseAdmin
    .from('diamonds').select('*').eq('tournament_id', sourceTournamentId).order('name');
  if (venuesError) throw venuesError;
  if (venues?.length) {
    const { data: ins, error } = await supabaseAdmin.from('diamonds').insert(
      venues.map(v => ({
        tournament_id: destinationTournamentId,
        name: v.name,
        address: v.address,
        notes: v.notes,
        // source_org_venue_id intentionally not copied — new tournament gets a fresh local copy
      }))
    ).select('id');
    if (error) throw error;
    copied.venues = ins?.length ?? 0;

    // Copy venue_facilities for each cloned venue
    if (ins?.length) {
      const sourceVenueIds = venues.map(v => v.id);
      const { data: srcFacilities } = await supabaseAdmin
        .from('venue_facilities')
        .select('*')
        .in('venue_id', sourceVenueIds);

      if (srcFacilities?.length) {
        // Build old→new venue id map
        const venueIdMap = new Map<string, string>();
        venues.forEach((v, i) => { if (ins[i]) venueIdMap.set(v.id, ins[i].id); });

        const facilityRows = srcFacilities
          .filter(f => venueIdMap.has(f.venue_id))
          .map(f => ({
            venue_id:      venueIdMap.get(f.venue_id)!,
            tournament_id: destinationTournamentId,
            name:          f.name,
            facility_type: f.facility_type,
            display_order: f.display_order,
            notes:         f.notes ?? null,
            // source_org_facility_id intentionally not copied
          }));

        if (facilityRows.length) {
          const { error: fErr } = await supabaseAdmin.from('venue_facilities').insert(facilityRows);
          if (fErr) throw fErr;
        }
      }
    }
  }

  // Divisions + pools + slots
  const { data: divisions, error: divisionsError } = await supabaseAdmin
    .from('divisions').select('*').eq('tournament_id', sourceTournamentId).order('display_order');
  if (divisionsError) throw divisionsError;
  if (divisions?.length) {
    const { data: ins, error } = await supabaseAdmin.from('divisions').insert(
      divisions.map(g => ({
        tournament_id: destinationTournamentId,
        name: g.name, min_age: g.min_age, max_age: g.max_age,
        display_order: g.display_order,
        is_closed: false,
        capacity: g.capacity,
        pool_count: g.pool_count, pool_names: g.pool_names,
        requires_pool_selection: g.requires_pool_selection ?? false,
        playoff_config: g.playoff_config,
        schedule_visibility: 'unpublished',
        deposit_amount: g.deposit_amount ?? null,
        deposit_due_date: g.deposit_due_date ?? null,
        total_fee_amount: g.total_fee_amount ?? null,
        total_fee_due_date: g.total_fee_due_date ?? null,
      }))
    ).select('id');
    if (error) throw error;
    divisions.forEach((g, i) => { if (ins?.[i]?.id) divisionIdMap.set(g.id, ins[i].id); });
    copied.divisions = ins?.length ?? 0;

    const { data: pools, error: poolsError } = await supabaseAdmin
      .from('pools').select('*').in('division_id', divisions.map(g => g.id)).order('display_order');
    if (poolsError) throw poolsError;
    if (pools?.length) {
      const { data: insPools, error: poolError } = await supabaseAdmin.from('pools').insert(
        pools.map(p => ({ division_id: divisionIdMap.get(p.division_id), name: p.name, display_order: p.display_order }))
      ).select('id');
      if (poolError) throw poolError;
      pools.forEach((p, i) => { if (insPools?.[i]?.id) poolIdMap.set(p.id, insPools[i].id); });
      copied.pools = insPools?.length ?? 0;

      const { data: slots, error: slotsError } = await supabaseAdmin
        .from('pool_slots').select('*').eq('tournament_id', sourceTournamentId).order('slot_number');
      if (slotsError) throw slotsError;
      const slotRows = (slots ?? [])
        .map(s => ({
          pool_id: poolIdMap.get(s.pool_id),
          tournament_id: destinationTournamentId,
          division_id: divisionIdMap.get(s.division_id),
          slot_number: s.slot_number, display_name: s.display_name, team_id: null,
        }))
        .filter(s => s.pool_id && s.division_id);
      if (slotRows.length) {
        const { data: insSlots, error: slotError } = await supabaseAdmin.from('pool_slots').insert(slotRows).select('id');
        if (slotError) throw slotError;
        copied.slots = insSlots?.length ?? 0;
      }
    }
  }

  // Rules & resources
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('rules').select('*').eq('tournament_id', sourceTournamentId).order('display_order');
  if (rulesError) throw rulesError;
  if (rules?.length) {
    const { data: insRules, error: ruleError } = await supabaseAdmin.from('rules').insert(
      rules.map(r => ({
        tournament_id: destinationTournamentId,
        title: r.title, icon: r.icon, display_order: r.display_order,
        division_ids: remapUuidArray(r.division_ids, divisionIdMap),
      }))
    ).select('id');
    if (ruleError) throw ruleError;
    copied.rules = insRules?.length ?? 0;
    const ruleIdMap = new Map<string, string>();
    rules.forEach((r, i) => { if (insRules?.[i]?.id) ruleIdMap.set(r.id, insRules[i].id); });
    const { data: ruleItems, error: itemError } = await supabaseAdmin
      .from('rule_items').select('*').in('rule_id', rules.map(r => r.id)).order('display_order');
    if (itemError) throw itemError;
    const itemRows = (ruleItems ?? [])
      .map(item => ({ rule_id: ruleIdMap.get(item.rule_id), content: item.content, display_order: item.display_order }))
      .filter(item => item.rule_id);
    if (itemRows.length) {
      const { error: itemInsertError } = await supabaseAdmin.from('rule_items').insert(itemRows);
      if (itemInsertError) throw itemInsertError;
    }
  }

  const { data: resources, error: resourcesError } = await supabaseAdmin
    .from('resources').select('*').eq('tournament_id', sourceTournamentId).order('display_order');
  if (resourcesError) throw resourcesError;
  if (resources?.length) {
    const { data: ins, error } = await supabaseAdmin.from('resources').insert(
      resources.map(r => ({ tournament_id: destinationTournamentId, label: r.label, url: r.url, display_order: r.display_order }))
    ).select('id');
    if (error) throw error;
    copied.resources = ins?.length ?? 0;
  }

  // Welcome announcement
  const { data: welcome, error: welcomeError } = await supabaseAdmin
    .from('announcements').select('*')
    .eq('tournament_id', sourceTournamentId).eq('title', 'Welcome!').order('published_at').limit(1).maybeSingle();
  if (welcomeError) throw welcomeError;
  if (welcome?.body) {
    const { error } = await supabaseAdmin.from('announcements').insert({
      tournament_id: destinationTournamentId,
      title: 'Welcome!', body: welcome.body,
      published_at: new Date().toISOString(), pinned: true,
      division_ids: remapUuidArray(welcome.division_ids, divisionIdMap),
    });
    if (error) throw error;
    copied.welcome = true;
  }

  // Registration fields
  const { data: fields, error: fieldsError } = await supabaseAdmin
    .from('tournament_registration_fields').select('*')
    .eq('tournament_id', sourceTournamentId).eq('org_id', orgId).eq('is_archived', false).order('sort_order');
  if (fieldsError) throw fieldsError;
  if (fields?.length) {
    const { data: ins, error } = await supabaseAdmin.from('tournament_registration_fields').insert(
      fields.map(f => ({
        tournament_id: destinationTournamentId, org_id: orgId,
        label: f.label, field_type: f.field_type, options: f.options ?? [],
        required: f.required ?? false, sort_order: f.sort_order ?? 0, is_archived: false,
      }))
    ).select('id');
    if (error) throw error;
    copied.registrationFields = ins?.length ?? 0;
  }

  return { copied };
}

// --- Venues (tournament-scoped) ---

function mapVenueRow(d: any, facilities?: VenueFacility[]): Venue {
  return {
    id:               d.id,
    tournamentId:     d.tournament_id,
    name:             d.name,
    address:          d.address ?? undefined,
    notes:            d.notes   ?? undefined,
    sourceOrgVenueId: d.source_org_venue_id ?? undefined,
    ...(facilities !== undefined ? { facilities } : {}),
  };
}

function mapFacilityRow(f: any): VenueFacility {
  return {
    id:                   f.id,
    venueId:              f.venue_id,
    tournamentId:         f.tournament_id,
    name:                 f.name,
    facilityType:         f.facility_type as FacilityType,
    displayOrder:         f.display_order,
    notes:                f.notes ?? undefined,
    sourceOrgFacilityId:  f.source_org_facility_id ?? undefined,
  };
}

/**
 * Returns tournament venues. Pass `includeFacilities: true` to get nested
 * facilities[] on each venue — used by schedule builder and game editing.
 */
export async function getVenues(
  tournamentId?: string,
  options: ReadOptions & { includeFacilities?: boolean } = {},
): Promise<Venue[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  let query = client.from('diamonds').select('*').order('name', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('getVenues error', error);
    return [];
  }

  if (!options.includeFacilities) {
    return data.map((d: any) => mapVenueRow(d));
  }

  // Fetch facilities for all returned venue IDs in one query
  const venueIds = data.map((d: any) => d.id);
  if (venueIds.length === 0) return [];

  const { data: facData, error: facError } = await client
    .from('venue_facilities')
    .select('*')
    .in('venue_id', venueIds)
    .order('display_order', { ascending: true });

  if (facError) console.error('getVenues facilities error', facError);

  const facilityByVenue = new Map<string, VenueFacility[]>();
  for (const f of facData ?? []) {
    const mapped = mapFacilityRow(f);
    const arr = facilityByVenue.get(mapped.venueId) ?? [];
    arr.push(mapped);
    facilityByVenue.set(mapped.venueId, arr);
  }

  return data.map((d: any) => mapVenueRow(d, facilityByVenue.get(d.id) ?? []));
}

export async function saveVenue(d: Omit<Venue, 'id'>): Promise<string> {
  const { data, error } = await supabaseAdmin.from('diamonds').insert({
    tournament_id:        d.tournamentId,
    name:                 d.name,
    address:              d.address ?? null,
    notes:                d.notes   ?? null,
    source_org_venue_id:  d.sourceOrgVenueId ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateVenue(id: string, d: Partial<Omit<Venue, 'facilities'>>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (d.name             !== undefined) updates.name                = d.name;
  if (d.address          !== undefined) updates.address             = d.address ?? null;
  if (d.notes            !== undefined) updates.notes               = d.notes   ?? null;
  if (d.sourceOrgVenueId !== undefined) updates.source_org_venue_id = d.sourceOrgVenueId ?? null;
  await supabaseAdmin.from('diamonds').update(updates).eq('id', id);
}

export async function deleteVenue(id: string): Promise<void> {
  // venue_facilities cascade-deletes via FK ON DELETE CASCADE
  await supabaseAdmin.from('diamonds').delete().eq('id', id);
}

// --- Venue Facilities ---

export async function getVenueFacilities(venueId: string, options: ReadOptions = {}): Promise<VenueFacility[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  const { data, error } = await client
    .from('venue_facilities')
    .select('*')
    .eq('venue_id', venueId)
    .order('display_order', { ascending: true });
  if (error) { console.error('getVenueFacilities error', error); return []; }
  return (data ?? []).map(mapFacilityRow);
}

export async function addVenueFacility(f: Omit<VenueFacility, 'id'>): Promise<string> {
  const { data, error } = await supabaseAdmin.from('venue_facilities').insert({
    venue_id:               f.venueId,
    tournament_id:          f.tournamentId,
    name:                   f.name,
    facility_type:          f.facilityType,
    display_order:          f.displayOrder,
    notes:                  f.notes ?? null,
    source_org_facility_id: f.sourceOrgFacilityId ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateVenueFacility(id: string, f: Partial<VenueFacility>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (f.name          !== undefined) updates.name          = f.name;
  if (f.facilityType  !== undefined) updates.facility_type = f.facilityType;
  if (f.displayOrder  !== undefined) updates.display_order = f.displayOrder;
  if (f.notes         !== undefined) updates.notes         = f.notes ?? null;
  await supabaseAdmin.from('venue_facilities').update(updates).eq('id', id);
}

export async function deleteVenueFacility(id: string): Promise<void> {
  await supabaseAdmin.from('venue_facilities').delete().eq('id', id);
}

// --- Org Venue Library ---

function mapOrgVenueRow(v: any, facilities?: OrgVenueFacility[]): OrgVenue {
  return {
    id:       v.id,
    orgId:    v.org_id,
    name:     v.name,
    address:  v.address  ?? undefined,
    notes:    v.notes    ?? undefined,
    isActive: v.is_active,
    ...(facilities !== undefined ? { facilities } : {}),
  };
}

function mapOrgFacilityRow(f: any): OrgVenueFacility {
  return {
    id:           f.id,
    orgVenueId:   f.org_venue_id,
    orgId:        f.org_id,
    name:         f.name,
    facilityType: f.facility_type as FacilityType,
    displayOrder: f.display_order,
    notes:        f.notes ?? undefined,
  };
}

export async function getOrgVenues(orgId: string): Promise<OrgVenue[]> {
  const { data, error } = await supabaseAdmin
    .from('org_venues')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) { console.error('getOrgVenues error', error); return []; }

  const venueIds = (data ?? []).map((v: any) => v.id);
  if (venueIds.length === 0) return [];

  const { data: facData, error: facError } = await supabaseAdmin
    .from('org_venue_facilities')
    .select('*')
    .in('org_venue_id', venueIds)
    .order('display_order', { ascending: true });
  if (facError) console.error('getOrgVenues facilities error', facError);

  const facilityByVenue = new Map<string, OrgVenueFacility[]>();
  for (const f of facData ?? []) {
    const mapped = mapOrgFacilityRow(f);
    const arr = facilityByVenue.get(mapped.orgVenueId) ?? [];
    arr.push(mapped);
    facilityByVenue.set(mapped.orgVenueId, arr);
  }

  return (data ?? []).map((v: any) => mapOrgVenueRow(v, facilityByVenue.get(v.id) ?? []));
}

export async function saveOrgVenue(v: Omit<OrgVenue, 'id' | 'facilities'>): Promise<string> {
  const { data, error } = await supabaseAdmin.from('org_venues').insert({
    org_id:    v.orgId,
    name:      v.name,
    address:   v.address ?? null,
    notes:     v.notes   ?? null,
    is_active: v.isActive,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateOrgVenue(id: string, v: Partial<Omit<OrgVenue, 'id' | 'orgId' | 'facilities'>>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (v.name      !== undefined) updates.name      = v.name;
  if (v.address   !== undefined) updates.address   = v.address ?? null;
  if (v.notes     !== undefined) updates.notes     = v.notes   ?? null;
  if (v.isActive  !== undefined) updates.is_active = v.isActive;
  await supabaseAdmin.from('org_venues').update(updates).eq('id', id);
}

export async function deleteOrgVenue(id: string): Promise<void> {
  // org_venue_facilities cascade via FK; mark inactive instead of hard-delete if preferred
  await supabaseAdmin.from('org_venues').delete().eq('id', id);
}

export async function addOrgVenueFacility(f: Omit<OrgVenueFacility, 'id'>): Promise<string> {
  const { data, error } = await supabaseAdmin.from('org_venue_facilities').insert({
    org_venue_id:  f.orgVenueId,
    org_id:        f.orgId,
    name:          f.name,
    facility_type: f.facilityType,
    display_order: f.displayOrder,
    notes:         f.notes ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function updateOrgVenueFacility(id: string, f: Partial<OrgVenueFacility>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (f.name          !== undefined) updates.name          = f.name;
  if (f.facilityType  !== undefined) updates.facility_type = f.facilityType;
  if (f.displayOrder  !== undefined) updates.display_order = f.displayOrder;
  if (f.notes         !== undefined) updates.notes         = f.notes ?? null;
  await supabaseAdmin.from('org_venue_facilities').update(updates).eq('id', id);
}

export async function deleteOrgVenueFacility(id: string): Promise<void> {
  await supabaseAdmin.from('org_venue_facilities').delete().eq('id', id);
}

/**
 * Imports an org venue (and all its facilities) into a tournament.
 * Creates a local copy in the diamonds + venue_facilities tables.
 * Changes to the copy don't affect the org library.
 * Returns the new tournament venue id.
 */
export async function importOrgVenueToTournament(
  orgVenueId: string,
  tournamentId: string,
): Promise<string> {
  // Fetch org venue + facilities
  const { data: ov, error: ovErr } = await supabaseAdmin
    .from('org_venues')
    .select('*, org_venue_facilities(*)')
    .eq('id', orgVenueId)
    .single();
  if (ovErr || !ov) throw ovErr ?? new Error('Org venue not found');

  // Create tournament-scoped venue (diamond)
  const { data: newVenue, error: vErr } = await supabaseAdmin.from('diamonds').insert({
    tournament_id:        tournamentId,
    name:                 ov.name,
    address:              ov.address ?? null,
    notes:                ov.notes   ?? null,
    source_org_venue_id:  orgVenueId,
  }).select('id').single();
  if (vErr || !newVenue) throw vErr ?? new Error('Failed to create tournament venue');

  // Copy each facility
  const facilities: any[] = ov.org_venue_facilities ?? [];
  if (facilities.length > 0) {
    const { error: fErr } = await supabaseAdmin.from('venue_facilities').insert(
      facilities.map((f: any) => ({
        venue_id:               newVenue.id,
        tournament_id:          tournamentId,
        name:                   f.name,
        facility_type:          f.facility_type,
        display_order:          f.display_order,
        notes:                  f.notes ?? null,
        source_org_facility_id: f.id,
      }))
    );
    if (fErr) throw fErr;
  }

  return newVenue.id as string;
}

// --- Divisions ---
export async function getDivisions(tournamentId?: string, options: ReadOptions = {}): Promise<Division[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  let query = client.from('divisions').select('*, pools(*)').order('display_order', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('getDivisions error', error);
    return [];
  }
  return data.map((g: any) => ({
    id: g.id,
    tournamentId: g.tournament_id,
    name: g.name,
    minAge: g.min_age,
    maxAge: g.max_age,
    order: g.display_order,
    isClosed: g.is_closed,
    capacity: g.capacity,
    poolCount: g.pool_count,
    poolNames: g.pool_names,
    requiresPoolSelection: g.requires_pool_selection,
    playoffConfig: g.playoff_config,
    scheduleVisibility: g.schedule_visibility,
    depositAmount: g.deposit_amount != null ? Number(g.deposit_amount) : null,
    depositDueDate: g.deposit_due_date ?? null,
    totalFeeAmount: g.total_fee_amount != null ? Number(g.total_fee_amount) : null,
    totalFeeDueDate: g.total_fee_due_date ?? null,
    pools: (g.pools || []).map((p: any) => ({
      id: p.id,
      divisionId: p.division_id,
      name: p.name,
      order: p.display_order
    })).sort((a: any, b: any) => a.order - b.order)
  }));
}

export async function saveDivision(g: Omit<Division, 'id'>): Promise<void> {
  await authClient().from('divisions').insert({
    tournament_id: g.tournamentId,
    name: g.name,
    min_age: g.minAge,
    max_age: g.maxAge,
    display_order: g.order,
    is_closed: g.isClosed || false,
    capacity: g.capacity,
    pool_count: g.poolCount || 1,
    pool_names: g.poolNames,
    playoff_config: g.playoffConfig || { type: 'single', crossover: 'standard', hasThirdPlace: false, teamsQualifying: 4 },
    schedule_visibility: g.scheduleVisibility ?? 'unpublished'
  });
}

export async function updateTournamentDivision(id: string, g: Partial<Division>): Promise<void> {
  const updates: any = {};
  if (g.tournamentId !== undefined) updates.tournament_id = g.tournamentId;
  if (g.name !== undefined) updates.name = g.name;
  if (g.minAge !== undefined) updates.min_age = g.minAge;
  if (g.maxAge !== undefined) updates.max_age = g.maxAge;
  if (g.order !== undefined) updates.display_order = g.order;
  if (g.isClosed !== undefined) updates.is_closed = g.isClosed;
  if (g.capacity !== undefined) updates.capacity = g.capacity;
  if (g.poolCount !== undefined) updates.pool_count = g.poolCount;
  if (g.poolNames !== undefined) updates.pool_names = g.poolNames;
  if (g.requiresPoolSelection !== undefined) updates.requires_pool_selection = g.requiresPoolSelection;
  if (g.playoffConfig !== undefined) updates.playoff_config = g.playoffConfig;
  if (g.scheduleVisibility !== undefined) updates.schedule_visibility = g.scheduleVisibility;
  await authClient().from('divisions').update(updates).eq('id', id);
}

export async function deleteTournamentDivision(id: string): Promise<void> {
  await authClient().from('divisions').delete().eq('id', id);
}

// --- Pools ---
export async function getPools(divisionId: string): Promise<Pool[]> {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq('division_id', divisionId)
    .order('display_order', { ascending: true });
  if (error || !data) return [];
  return data.map((p: any) => ({
    id: p.id,
    divisionId: p.division_id,
    name: p.name,
    order: p.display_order
  }));
}

export async function savePool(p: Omit<Pool, 'id'>): Promise<string> {
  const { data, error } = await authClient().from('pools').insert({
    division_id: p.divisionId,
    name: p.name,
    display_order: p.order
  }).select().single();
  if (error) throw error;
  return data.id;
}

export async function updatePool(id: string, name: string): Promise<void> {
  await authClient().from('pools').update({ name }).eq('id', id);
}

export async function deletePool(id: string): Promise<void> {
  await authClient().from('pools').delete().eq('id', id);
}

// --- Teams ---
export async function getTeams(tournamentId?: string, options: ReadOptions = {}): Promise<Team[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  let query = client.from('teams').select('*').order('name', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('getTeams error', error);
    return [];
  }
  return data.map((t: any) => ({
    id: t.id,
    tournamentId: t.tournament_id,
    divisionId: t.division_id,
    name: t.name,
    coach: t.coach,
    email: t.email,
    players: t.players || [],
    status: t.status || 'accepted',
    paymentStatus: t.payment_status || 'paid',
    registered_at: t.registered_at, // Map to registeredAt if needed
    registeredAt: t.registered_at,
    adminNotes: t.admin_notes,
    poolId: t.pool_id,
    waitlistPosition: t.waitlist_position ?? null,
    slotId: t.slot_id ?? null,
    seed: t.seed ?? null,
  }));
}

export async function saveTeam(t: Omit<Team, 'id'> & { id?: string }): Promise<void> {
  const payload: any = {
    tournament_id: t.tournamentId,
    division_id: t.divisionId,
    name: t.name,
    coach: t.coach,
    email: t.email,
    status: t.status || 'accepted',
    payment_status: t.paymentStatus || 'paid',
    registered_at: t.registeredAt || new Date().toISOString(),
    admin_notes: t.adminNotes,
    pool_id: t.poolId,
    waitlist_position: t.waitlistPosition ?? null,
    slot_id: t.slotId ?? null
  };
  if (t.id) payload.id = t.id;
  const { error } = await authClient().from('teams').insert(payload);
  if (error) throw error;
}

export async function updateTeam(id: string, t: Partial<Team>): Promise<void> {
  const updates: any = {};
  if (t.tournamentId !== undefined) updates.tournament_id = t.tournamentId;
  if (t.divisionId !== undefined)   updates.division_id = t.divisionId;
  if (t.name !== undefined)         updates.name = t.name;
  if (t.coach !== undefined)        updates.coach = t.coach;
  if (t.email !== undefined)        updates.email = t.email;
  if (t.status !== undefined)       updates.status = t.status;
  if (t.paymentStatus !== undefined) updates.payment_status = t.paymentStatus;
  if (t.registeredAt !== undefined) updates.registered_at = t.registeredAt;
  if (t.adminNotes !== undefined)        updates.admin_notes       = t.adminNotes;
  if (t.poolId !== undefined)            updates.pool_id            = t.poolId;
  if (t.waitlistPosition !== undefined)  updates.waitlist_position  = t.waitlistPosition;
  if (t.slotId !== undefined)            updates.slot_id            = t.slotId;
  const { error } = await authClient().from('teams').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  await authClient().from('teams').delete().eq('id', id);
}

// --- Tournament Registration Fields ---
export type TournamentRegistrationFieldInput = {
  label: string;
  fieldType: TournamentRegistrationFieldType;
  options?: string[];
  required?: boolean;
  sortOrder?: number;
};

function normalizeRegistrationFieldOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
}

function mapTournamentRegistrationField(row: any): TournamentRegistrationField {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    orgId: row.org_id,
    label: row.label,
    fieldType: row.field_type,
    options: normalizeRegistrationFieldOptions(row.options),
    required: row.required ?? false,
    sortOrder: row.sort_order ?? 0,
    isArchived: row.is_archived ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTournamentRegistrationFieldAnswer(row: any): TournamentRegistrationFieldAnswer {
  return {
    id: row.id,
    registrationId: row.registration_id,
    fieldId: row.field_id,
    valueText: row.value_text ?? null,
    valueJson: row.value_json ?? null,
    fileUrl: row.file_url ?? null,
    createdAt: row.created_at,
  };
}

export async function getTournamentRegistrationFields(
  tournamentId: string,
  options: { includeArchived?: boolean } = {},
): Promise<TournamentRegistrationField[]> {
  let query = supabaseAdmin
    .from('tournament_registration_fields')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!options.includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query;
  if (error) {
    console.error('getTournamentRegistrationFields error', error);
    return [];
  }
  return (data ?? []).map(mapTournamentRegistrationField);
}

export async function createTournamentRegistrationField(
  tournamentId: string,
  orgId: string,
  input: TournamentRegistrationFieldInput,
): Promise<TournamentRegistrationField> {
  const { data, error } = await supabaseAdmin
    .from('tournament_registration_fields')
    .insert({
      tournament_id: tournamentId,
      org_id: orgId,
      label: input.label.trim(),
      field_type: input.fieldType,
      options: input.fieldType === 'dropdown' ? normalizeRegistrationFieldOptions(input.options) : [],
      required: input.required ?? false,
      sort_order: input.sortOrder ?? 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapTournamentRegistrationField(data);
}

export async function updateTournamentRegistrationField(
  fieldId: string,
  input: Partial<TournamentRegistrationFieldInput> & { isArchived?: boolean },
): Promise<TournamentRegistrationField> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.label !== undefined) updates.label = input.label.trim();
  if (input.fieldType !== undefined) updates.field_type = input.fieldType;
  if (input.options !== undefined) updates.options = normalizeRegistrationFieldOptions(input.options);
  if (input.required !== undefined) updates.required = input.required;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
  if (input.isArchived !== undefined) updates.is_archived = input.isArchived;

  const { data, error } = await supabaseAdmin
    .from('tournament_registration_fields')
    .update(updates)
    .eq('id', fieldId)
    .select('*')
    .single();

  if (error) throw error;
  return mapTournamentRegistrationField(data);
}

export async function archiveTournamentRegistrationField(fieldId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tournament_registration_fields')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', fieldId);
  if (error) throw error;
}

export async function reorderTournamentRegistrationFields(
  fields: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  for (const field of fields) {
    const { error } = await supabaseAdmin
      .from('tournament_registration_fields')
      .update({ sort_order: field.sortOrder, updated_at: new Date().toISOString() })
      .eq('id', field.id);
    if (error) throw error;
  }
}

export async function saveTournamentRegistrationFieldAnswers(
  registrationId: string,
  answers: Array<{
    fieldId: string;
    valueText?: string | null;
    valueJson?: unknown;
    fileUrl?: string | null;
  }>,
): Promise<void> {
  if (answers.length === 0) return;
  const rows = answers.map(answer => ({
    registration_id: registrationId,
    field_id: answer.fieldId,
    value_text: answer.valueText ?? null,
    value_json: answer.valueJson ?? null,
    file_url: answer.fileUrl ?? null,
  }));
  const { error } = await supabaseAdmin
    .from('tournament_registration_field_answers')
    .upsert(rows, { onConflict: 'registration_id,field_id' });
  if (error) throw error;
}

export async function getTournamentRegistrationFieldAnswersForRegistrations(
  registrationIds: string[],
): Promise<TournamentRegistrationFieldAnswer[]> {
  if (registrationIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('tournament_registration_field_answers')
    .select('*')
    .in('registration_id', registrationIds);
  if (error) {
    console.error('getTournamentRegistrationFieldAnswersForRegistrations error', error);
    return [];
  }
  return (data ?? []).map(mapTournamentRegistrationFieldAnswer);
}

// --- Games ---
export async function getGames(tournamentId?: string, options: ReadOptions = {}): Promise<Game[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  let query = client.from('games').select('*').order('game_date', { ascending: true }).order('game_time', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('getGames error', error);
    return [];
  }
  return data.map((g: any) => ({
    id: g.id,
    tournamentId: g.tournament_id,
    divisionId: g.division_id,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    date: g.game_date,
    time: g.game_time,
    durationMinutes: g.duration_minutes ?? null,
    location: g.location,
    venueId: g.diamond_id,
    venueFacilityId: g.venue_facility_id,
    scheduleFacilityLaneId: g.schedule_facility_lane_id ?? null,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    isPlayoff: g.is_playoff,
    generatorLocked: g.generator_locked ?? false,
    bracketId: g.bracket_id,
    bracketCode: g.bracket_code,
    bracketLabel: g.bracket_label ?? null,
    roundLabel: g.round_label ?? null,
    homePlaceholder: g.home_placeholder,
    awayPlaceholder: g.away_placeholder,
    homeSlotId: g.home_slot_id,
    awaySlotId: g.away_slot_id,
    notes: g.notes
  }));
}

export async function saveGame(g: Omit<Game, 'id'>): Promise<void> {
  const row: Record<string, unknown> = {
    tournament_id: g.tournamentId,
    division_id: g.divisionId,
    home_team_id: g.homeTeamId,
    away_team_id: g.awayTeamId,
    game_date: g.date,
    game_time: g.time,
    duration_minutes: g.durationMinutes ?? null,
    location: g.location,
    diamond_id: g.venueId,
    venue_facility_id: g.venueFacilityId ?? null,
    home_score: g.homeScore,
    away_score: g.awayScore,
    status: g.status || 'scheduled',
    is_playoff: g.isPlayoff || false,
    bracket_id: g.bracketId,
    bracket_code: g.bracketCode,
    bracket_label: g.bracketLabel ?? null,
    round_label: g.roundLabel ?? null,
    home_placeholder: g.homePlaceholder,
    away_placeholder: g.awayPlaceholder,
    home_slot_id: g.homeSlotId,
    away_slot_id: g.awaySlotId,
    notes: g.notes
  };
  if (g.scheduleFacilityLaneId !== undefined) row.schedule_facility_lane_id = g.scheduleFacilityLaneId ?? null;
  if (g.generatorLocked !== undefined) row.generator_locked = Boolean(g.generatorLocked);
  // Surface failures (incl. RLS WITH CHECK violations) instead of silently
  // swallowing them — a non-member operator would otherwise see "nothing happened".
  const { error } = await authClient().from('games').insert(row);
  if (error) throw error;
}

export async function updateGame(id: string, g: Partial<Game>, options: ReadOptions = {}): Promise<void> {
  const updates: any = {};
  if (g.tournamentId !== undefined) updates.tournament_id = g.tournamentId;
  if (g.divisionId !== undefined) updates.division_id = g.divisionId;
  if (g.homeTeamId !== undefined) updates.home_team_id = g.homeTeamId;
  if (g.awayTeamId !== undefined) updates.away_team_id = g.awayTeamId;
  if (g.date !== undefined) updates.game_date = g.date;
  if (g.time !== undefined) updates.game_time = g.time;
  if (g.durationMinutes !== undefined) updates.duration_minutes = g.durationMinutes ?? null;
  if (g.location !== undefined) updates.location = g.location;
  if (g.venueId          !== undefined) updates.diamond_id        = g.venueId;
  if (g.venueFacilityId !== undefined) updates.venue_facility_id = g.venueFacilityId ?? null;
  if (g.scheduleFacilityLaneId !== undefined) updates.schedule_facility_lane_id = g.scheduleFacilityLaneId ?? null;
  if (g.homeScore !== undefined) updates.home_score = g.homeScore;
  if (g.awayScore !== undefined) updates.away_score = g.awayScore;
  if (g.status !== undefined) updates.status = g.status;
  if (g.isPlayoff !== undefined) updates.is_playoff = g.isPlayoff;
  if (g.generatorLocked !== undefined) updates.generator_locked = Boolean(g.generatorLocked);
  if (g.bracketId !== undefined) updates.bracket_id = g.bracketId;
  if (g.bracketCode !== undefined) updates.bracket_code = g.bracketCode;
  if (g.bracketLabel !== undefined) updates.bracket_label = g.bracketLabel ?? null;
  if (g.homePlaceholder !== undefined) updates.home_placeholder = g.homePlaceholder;
  if (g.awayPlaceholder !== undefined) updates.away_placeholder = g.awayPlaceholder;
  if (g.homeSlotId !== undefined) updates.home_slot_id = g.homeSlotId;
  if (g.awaySlotId !== undefined) updates.away_slot_id = g.awaySlotId;
  if (g.notes !== undefined) updates.notes = g.notes;
  if (g.scoreSubmittedByUserId !== undefined) updates.score_submitted_by_user_id = g.scoreSubmittedByUserId;
  if (g.scoreSubmittedByEmail !== undefined) updates.score_submitted_by_email = g.scoreSubmittedByEmail;
  if (g.scoreSubmittedAt !== undefined) updates.score_submitted_at = g.scoreSubmittedAt;
  if (g.scoreSubmissionSource !== undefined) updates.score_submission_source = g.scoreSubmissionSource;

  const writeClient = options.admin ? supabaseAdmin : authClient();
  const { data: updated, error } = await writeClient.from('games').update(updates).eq('id', id).select('id');
  if (error) throw error;
  // RLS-denied updates return 0 rows with no error. Surface that to the browser
  // operator (server/admin paths keep their existing silent behavior).
  if (typeof window !== 'undefined' && !options.admin && (!updated || updated.length === 0)) {
    throw new Error("Couldn't update the game — you may not have permission to modify this tournament.");
  }

  // Trigger advancement. A forfeit is terminal like 'completed', so it must also
  // advance the bracket / re-resolve seeds — otherwise marking a forfeit would
  // leave the downstream slot stuck on a placeholder (J1-091).
  if (g.status === 'completed' || g.status === 'forfeit'
    || (g.homeScore !== undefined && g.awayScore !== undefined)) {
    const fullGame = (await getGames(undefined, options)).find(x => x.id === id);
    if (fullGame?.status === 'completed' || fullGame?.status === 'forfeit') {
      await advancePlayoffs(fullGame, options);
    }
  }
}

export async function deleteGame(id: string): Promise<void> {
  // .select() so we can detect an RLS-denied delete (0 rows, no error) and tell
  // the operator, instead of silently doing nothing.
  const { data, error } = await authClient().from('games').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Couldn't remove the game — it may already be gone, or you may not have permission to modify this tournament.");
  }
}

/** Async wrapper: fetch teams+games (filtered inside) then rank one division. */
export async function getStandings(divisionId: string, config?: PlayoffConfig, options: ReadOptions = {}, tournamentSettings?: import('./types').TournamentSettings): Promise<DivisionStandingRow[]> {
  const games = await getGames(undefined, options);
  const teams = await getTeams(undefined, options);
  return computeTournamentStandings(divisionId, teams, games, config, tournamentSettings);
}

// --- Announcements ---
export async function getAnnouncements(tournamentId?: string, options: ReadOptions = {}): Promise<Announcement[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  let query = client.from('announcements').select('*')
    // Only return records that are posted to the site.
    // Email-only communications (channel_site=false) are admin-internal and must not appear publicly.
    // The column defaults to true, so existing rows are unaffected.
    .eq('channel_site', true)
    // Exclude soft-deleted posts. Rows pre-migration-098 have deleted_at = null → unaffected.
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('getAnnouncements error', error);
    return [];
  }
  return data.map((a: any) => ({
    id: a.id,
    tournamentId: a.tournament_id,
    title: a.title,
    body: a.body,
    date: a.published_at,
    pinned: a.pinned,
    divisionIds: a.division_ids ?? null,
  }));
}

export async function saveAnnouncement(a: Omit<Announcement, 'id'>): Promise<void> {
  await authClient().from('announcements').insert({
    tournament_id: a.tournamentId,
    title: a.title,
    body: a.body,
    published_at: a.date,
    pinned: a.pinned || false,
    division_ids: a.divisionIds?.length ? a.divisionIds : null,
  });
}

export async function updateAnnouncement(id: string, a: Partial<Announcement>): Promise<void> {
  const updates: any = {};
  if (a.tournamentId !== undefined) updates.tournament_id = a.tournamentId;
  if (a.title !== undefined) updates.title = a.title;
  if (a.body !== undefined) updates.body = a.body;
  if (a.date !== undefined) updates.published_at = a.date;
  if (a.pinned !== undefined) updates.pinned = a.pinned;
  if (a.divisionIds !== undefined) updates.division_ids = a.divisionIds?.length ? a.divisionIds : null;
  const { error } = await authClient().from('announcements').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await authClient().from('announcements').delete().eq('id', id);
}

// --- Seeding ---
export async function seedTournamentData(tid: string, options: {
  venues?: boolean, registrations?: boolean, schedule?: boolean, results?: boolean
}) {
  const divisions = await getDivisions(tid);
  if (divisions.length === 0) return;

  if (options.venues) {
    const names = ['Memorial Park D1', 'Memorial Park D2', 'Lions Field', 'South Common', 'Milton Sports Center'];
    const rows = names.map((name, i) => ({
      tournament_id: tid,
      name,
      address: `${100 + i} Main St, Milton, ON`,
      notes: i % 2 === 0 ? 'Lighted field' : ''
    }));
    await authClient().from('diamonds').insert(rows);
  }

  if (options.registrations) {
    const defaultTeamNames = ['Milton Bats', 'Oakville Angels', 'Burlington Bulls', 'Mississauga Tigers', 'Hamilton Heat', 'Brampton Blazers', 'Toronto Titans', 'Guelph Gryphons', 'Kitchener Panthers', 'London Badgers', 'Windsor Selects', 'Whitby Eagles'];
    const defaultCoaches = ['Coach Bob', 'Coach Alice', 'Coach Charlie', 'Coach Diana', 'Coach Ed', 'Coach Fiona', 'Coach Greg', 'Coach Heather', 'Coach Ian', 'Coach Jack', 'Coach Ken', 'Coach Leo'];

    for (const group of divisions) {
      const capacity = group.capacity || 8;
      const teamRows: any[] = [];

      // Seed up to capacity
      for (let i = 0; i < capacity; i++) {
        const nameBase = defaultTeamNames[i % defaultTeamNames.length];
        const coachBase = defaultCoaches[i % defaultCoaches.length];

        teamRows.push({
          tournament_id: tid,
          division_id: group.id,
          name: `${nameBase} ${group.name} ${i + 1}`,
          coach: coachBase,
          email: `coach${i}@example.com`,
          status: 'accepted',
          payment_status: 'paid',
          registered_at: new Date().toISOString()
        });
      }

      // Add 2 waitlist teams per division
      for (let i = 0; i < 2; i++) {
        teamRows.push({
          tournament_id: tid,
          division_id: group.id,
          name: `Waitlist Team ${i + 1} ${group.name}`,
          coach: `Waitlist Coach ${i + 1}`,
          email: `waitlist${i + 1}@example.com`,
          status: 'waitlist',
          payment_status: 'pending',
          registered_at: new Date().toISOString()
        });
      }

      const { error: teamError } = await authClient().from('teams').insert(teamRows);
      if (teamError) {
        console.error('Team seeding error:', teamError);
        throw teamError;
      }
    }
  }

  if (options.schedule || options.results) {
    const teams = await getTeams(tid);
    const venues = await getVenues(tid);
    if (teams.length < 2 || venues.length === 0) return;

    const gameRows = [];
    const tnt = await supabase.from('tournaments').select('*').eq('id', tid).single();
    const baseDate = tnt.data?.start_date || new Date().toISOString().split('T')[0];

    for (const group of divisions) {
      const groupTeams = teams.filter(t => t.divisionId === group.id);
      if (groupTeams.length < 2) continue;

      // Simple 2 games per division for seed
      for (let i = 0; i < 2; i++) {
        const home = groupTeams[i % groupTeams.length];
        const away = groupTeams[(i + 1) % groupTeams.length];
        const venue = venues[i % venues.length];

        gameRows.push({
          tournament_id: tid,
          division_id: group.id,
          home_team_id: home.id,
          away_team_id: away.id,
          game_date: baseDate,
          game_time: `${9 + i}:00`,
          location: venue.name,
          diamond_id: venue.id,
          status: options.results ? 'final' : 'scheduled',
          home_score: options.results ? Math.floor(Math.random() * 10) : null,
          away_score: options.results ? Math.floor(Math.random() * 10) : null
        });
      }
    }
    await authClient().from('games').insert(gameRows);
  }
}

export async function advancePlayoffs(game: Game, options: ReadOptions = {}) {
  // A forfeit is terminal too — it advances the present (winning) team just like
  // a completed game. Anything else (scheduled/submitted/cancelled) does not advance.
  if (game.status !== 'completed' && game.status !== 'forfeit') return;

  const games = await getGames(game.tournamentId, options);
  const playoffGames = games.filter(g => g.isPlayoff && g.divisionId === game.divisionId);

  if (playoffGames.length === 0) return;

  // 1. Advance winners/losers within the bracket
  if (game.isPlayoff && game.bracketCode) {
    // An elimination game CANNOT end in a tie — a tied score has no winner, so
    // advancing either side would silently (and arbitrarily) crown a team (J1-083).
    // On a tie, do NOT advance: leave the downstream "Winner/Loser <code>"
    // placeholders intact so the bracket visibly stalls until the organizer
    // resolves it (re-score, extra inning, or forfeit). Forfeits always carry a
    // decisive nominal margin, so resolvePlayoffWinner never reads them as a tie.
    const outcome = resolvePlayoffWinner(game);
    if (outcome.tie) return;
    const winnerId = outcome.winner;
    const loserId = outcome.loser;

    for (const pg of playoffGames) {
      // Scope advancement to the SAME bracket. Split-pool (crossover='none')
      // tournaments run an independent bracket per pool, so identical bracket
      // codes (e.g. WB1-1, SF1) exist in every pool — without this guard, one
      // pool's result would leak into another pool's "Winner <code>" slot. The
      // guard only skips when both games carry a bracketId and they differ, so
      // single-bracket and legacy (null bracketId) play are unaffected.
      if (game.bracketId && pg.bracketId && pg.bracketId !== game.bracketId) continue;

      const updates: Partial<Game> = {};
      if (pg.homePlaceholder === 'Winner ' + game.bracketCode) updates.homeTeamId = winnerId;
      if (pg.awayPlaceholder === 'Winner ' + game.bracketCode) updates.awayTeamId = winnerId;
      if (pg.homePlaceholder === 'Loser ' + game.bracketCode) updates.homeTeamId = loserId;
      if (pg.awayPlaceholder === 'Loser ' + game.bracketCode) updates.awayTeamId = loserId;

      if (Object.keys(updates).length > 0) {
        await updateGame(pg.id, updates, options);
      }
    }

    // Double-elimination grand final: the "if necessary" reset (bracketCode GF2)
    // is only played when the losers-bracket team wins the first grand final.
    // The generator always sets GF.home = winners-bracket champion and
    // GF.away = losers-bracket champion, so if the home side wins, the reset is
    // unnecessary (cancel it); otherwise keep it scheduled. Re-runs on re-scoring.
    if (game.bracketCode === 'GF') {
      const winnersBracketWon = winnerId === game.homeTeamId;
      const nextStatus = winnersBracketWon ? 'cancelled' : 'scheduled';
      for (const pg of playoffGames) {
        if (pg.bracketCode !== 'GF2') continue;
        if (game.bracketId && pg.bracketId && pg.bracketId !== game.bracketId) continue;
        if (pg.status === 'completed' || pg.status === 'submitted') continue;
        if (pg.status !== nextStatus) {
          await updateGame(pg.id, { status: nextStatus }, options);
        }
      }
    }
  }

  // 2. Once pool play is decided, (re-)fill the seed/pool-rank placeholders.
  await resolveAndFillPlayoffSeeds(game.tournamentId, game.divisionId, options);
}

/**
 * Resolve standings-based playoff placeholders ("Seed #N", "Nth Pool X") into
 * real team ids once pool play is decided, and write them onto the bracket's
 * first-round games. Safe to re-run: a first-round game that has ALREADY started
 * (submitted / completed / forfeit) is skipped, so re-seeding never retroactively
 * swaps the participants of a game that was already played — the placeholder
 * string (e.g. 'Seed #1') is a descriptor that is never cleared, so without this
 * guard a re-run would clobber live results.
 *
 * Extracted from advancePlayoffs so the coin-toss record action can re-run seed
 * resolution after an organizer breaks an unresolved tie — otherwise the toss
 * persists but the bracket, already filled in arbitrary tied order, never updates
 * (J1-084). A forfeited pool game counts as decided, so it satisfies allPoolDone.
 */
export async function resolveAndFillPlayoffSeeds(
  tournamentId: string,
  divisionId: string,
  options: ReadOptions = {},
) {
  const games = await getGames(tournamentId, options);
  const playoffGames = games.filter(g => g.isPlayoff && g.divisionId === divisionId);
  if (playoffGames.length === 0) return;

  const poolGames = games.filter(g => g.divisionId === divisionId && !g.isPlayoff);
  const allPoolDone = poolGames.every(g => g.status === 'completed' || g.status === 'forfeit');
  if (!allPoolDone || poolGames.length === 0) return;

  const division = (await getDivisions(tournamentId, options)).find(g => g.id === divisionId);
  // Pass tournament settings so the tournament-level tie-breaker order + run-diff cap
  // apply to playoff SEEDING (not just the public standings view). Division-level
  // playoffConfig still takes priority inside getStandings.
  const tournament = await getTournament(tournamentId);
  const standings = await getStandings(divisionId, division?.playoffConfig, options, tournament?.settings);
  const pools = division?.pools || [];

  for (const pg of playoffGames) {
    // Never re-point a game that has already started/finished — a re-seed (e.g.
    // after a coin toss) must not retroactively swap the participants of a played
    // game. Only fill slots that are still waiting (scheduled / cancelled).
    if (pg.status === 'submitted' || pg.status === 'completed' || pg.status === 'forfeit') continue;

    const updates: Partial<Game> = {};

    const resolvePlaceholder = (ph?: string) => {
      if (!ph) return null;

      if (ph.startsWith('Seed #')) {
        const rank = parseInt(ph.replace('Seed #', ''));
        return standings[rank - 1]?.teamId;
      }

      const match = ph.match(/(\d+)\w+ Pool (.+)/);
      if (match) {
        const rank = parseInt(match[1]);
        const poolName = match[2];
        const pool = pools.find(p => p.name === poolName);
        const poolStandings = standings.filter(s => s.poolId === pool?.id);
        return poolStandings[rank - 1]?.teamId;
      }

      return null;
    };

    const hId = resolvePlaceholder(pg.homePlaceholder);
    const aId = resolvePlaceholder(pg.awayPlaceholder);

    if (hId) updates.homeTeamId = hId;
    if (aId) updates.awayTeamId = aId;

    if (Object.keys(updates).length > 0) {
      await updateGame(pg.id, updates, options);
    }
  }
}

// --- Rules ---
export async function getRules(tournamentId: string, options: ReadOptions = {}): Promise<RuleSection[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  const { data, error } = await client
    .from('rules')
    .select('*, rule_items(*)')
    .eq('tournament_id', tournamentId)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    tournamentId: r.tournament_id,
    title: r.title,
    icon: r.icon,
    order: r.display_order,
    items: (r.rule_items || []).map((i: any) => ({
      id: i.id,
      ruleId: i.rule_id,
      content: i.content,
      order: i.display_order
    })).sort((a: any, b: any) => a.order - b.order),
    divisionIds: r.division_ids ?? null,
  }));
}

export async function saveRuleSection(r: Omit<RuleSection, 'id' | 'items'>): Promise<string | null> {
  const { data, error } = await authClient()
    .from('rules')
    .insert({
      tournament_id: r.tournamentId,
      title: r.title,
      icon: r.icon,
      display_order: r.order,
      division_ids: r.divisionIds?.length ? r.divisionIds : null,
    })
    .select()
    .single();

  if (error) {
    console.error('saveRuleSection error', error);
    return null;
  }
  return data.id;
}

export async function updateRuleSection(id: string, r: Partial<RuleSection>): Promise<void> {
  const updates: any = {};
  if (r.title !== undefined) updates.title = r.title;
  if (r.icon !== undefined) updates.icon = r.icon;
  if (r.order !== undefined) updates.display_order = r.order;
  if (r.divisionIds !== undefined) updates.division_ids = r.divisionIds?.length ? r.divisionIds : null;
  const { error } = await authClient().from('rules').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteRuleSection(id: string): Promise<void> {
  await authClient().from('rules').delete().eq('id', id);
}

// ── Public Site Module ────────────────────────────────────────────────────────

export async function getOrgPublicSiteContent(orgId: string): Promise<OrgPublicSiteContent | null> {
  const { data } = await readClient()
    .from('org_public_site_content')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (!data) return null;
  return {
    id:                       data.id,
    orgId:                    data.org_id,
    tagline:                  data.tagline             ?? null,
    description:              data.description         ?? null,
    contactEmail:             data.contact_email       ?? null,
    socialInstagram:          data.social_instagram    ?? null,
    socialFacebook:           data.social_facebook     ?? null,
    socialX:                  data.social_x            ?? null,
    socialWebsite:            data.social_website      ?? null,
    showUpcomingTournaments:  data.show_upcoming_tournaments,
    showArchivesLink:         data.show_archives_link,
    createdAt:                data.created_at,
    updatedAt:                data.updated_at,
  };
}

export async function upsertOrgPublicSiteContent(
  orgId: string,
  content: Partial<Omit<OrgPublicSiteContent, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  await supabaseAdmin
    .from('org_public_site_content')
    .upsert(
      {
        org_id:                   orgId,
        tagline:                  content.tagline             ?? null,
        description:              content.description         ?? null,
        contact_email:            content.contactEmail        ?? null,
        social_instagram:         content.socialInstagram     ?? null,
        social_facebook:          content.socialFacebook      ?? null,
        social_x:                 content.socialX             ?? null,
        social_website:           content.socialWebsite       ?? null,
        show_upcoming_tournaments: content.showUpcomingTournaments ?? true,
        show_archives_link:        content.showArchivesLink   ?? true,
        updated_at:               new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
}

export async function saveRuleItem(item: Omit<RuleItem, 'id'>): Promise<void> {
  await authClient().from('rule_items').insert({
    rule_id: item.ruleId,
    content: item.content,
    display_order: item.order
  });
}

export async function updateRuleItem(id: string, item: Partial<RuleItem>): Promise<void> {
  const updates: any = {};
  if (item.content !== undefined) updates.content = item.content;
  if (item.order !== undefined) updates.display_order = item.order;
  await authClient().from('rule_items').update(updates).eq('id', id);
}

export async function deleteRuleItem(id: string): Promise<void> {
  await authClient().from('rule_items').delete().eq('id', id);
}

// --- Resources ---
export async function getResources(tournamentId: string, options: ReadOptions = {}): Promise<Resource[]> {
  const client = options.admin ? supabaseAdmin : supabase;
  const { data, error } = await client
    .from('resources')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    tournamentId: r.tournament_id,
    label: r.label,
    url: r.url,
    order: r.display_order
  }));
}

export async function saveResource(r: Omit<Resource, 'id'>): Promise<void> {
  await authClient().from('resources').insert({
    tournament_id: r.tournamentId,
    label: r.label,
    url: r.url,
    display_order: r.order
  });
}

export async function updateResource(id: string, r: Partial<Resource>): Promise<void> {
  const updates: any = {};
  if (r.label !== undefined) updates.label = r.label;
  if (r.url !== undefined) updates.url = r.url;
  if (r.order !== undefined) updates.display_order = r.order;
  await authClient().from('resources').update(updates).eq('id', id);
}

export async function deleteResource(id: string): Promise<void> {
  // Get the resource first to see if it has a file to delete
  const { data: res } = await supabase.from('resources').select('*').eq('id', id).single();

  if (res && res.url.includes('supabase.co')) {
    try {
      // Extract filename from public URL
      // Format: .../public/resources/filename.ext
      const parts = res.url.split('/');
      const fileName = parts[parts.length - 1].split('?')[0]; // Remove query params

      await authClient().storage.from('resources').remove([fileName]);
    } catch (err) {
      console.error('Error removing file from storage:', err);
    }
  }

  const { error } = await authClient().from('resources').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadResourceFile(file: File): Promise<string | null> {
  try {
    const cleanName = file.name.replace(/[^\w\s\.\-]/gi, '').replace(/\s+/g, '_');
    const fileName = `${Date.now()}-${cleanName}`;
    const filePath = fileName;

    const { error } = await authClient().storage
      .from('resources')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase Storage Error:', error);
      throw error;
    }

    const { data: { publicUrl } } = authClient().storage
      .from('resources')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('uploadResourceFile catch:', err);
    return null;
  }
}

export async function seedRulesAndResources(tournamentId: string) {
  console.log('Seeding rules for tournament:', tournamentId);
  // Neutral starter content; organizers should customize before publishing.
  const RULES_SECTIONS = [
    {
      icon: 'Shield',
      title: 'General Tournament Rules',
      items: [
        'Tournament-specific rules should be reviewed and published before the event goes live.',
        'Teams must be ready to play before their scheduled game time.',
        'Final eligibility, roster, scoring, and protest rules are set by the tournament organizer.',
      ],
    },
    {
      icon: 'BookOpen',
      title: 'Eligibility & Divisions',
      items: [
        'Division eligibility should be confirmed by the tournament organizer.',
        'Roster limits, player eligibility, and team documentation requirements should be published before registration opens.',
      ],
    },
    {
      icon: 'AlertCircle',
      title: 'Code of Conduct',
      items: [
        'Respect for all players, coaches, umpires, and spectators is mandatory.',
        'Any player, coach, or spectator ejected from a game may not return to the facility that day.',
        'Aggressive or threatening behaviour will result in immediate removal from the tournament.',
        'All disputes must be handled through official channels.',
        'Coaches are responsible for the behaviour of their players and spectators.',
      ],
    },
    {
      icon: 'CheckCircle',
      title: 'Equipment & Uniforms',
      items: [
        'Teams are responsible for meeting equipment requirements set by the tournament organizer.',
        'Uniform and identification requirements should be published before the event.',
      ],
    },
  ];

  const RESOURCES = [
    { label: 'Tournament Rules', url: '#' },
    { label: 'Venue Map & Directions', url: '#' },
    { label: 'Registration Requirements', url: '#' },
  ];
  try {
    // Seed Rules
    for (let i = 0; i < RULES_SECTIONS.length; i++) {
      const s = RULES_SECTIONS[i];
      const ruleId = await saveRuleSection({
        tournamentId,
        title: s.title,
        icon: s.icon,
        order: i
      });
      console.log('Saved section:', s.title, 'ID:', ruleId);
      if (ruleId) {
        for (let j = 0; j < s.items.length; j++) {
          await saveRuleItem({
            ruleId,
            content: s.items[j],
            order: j
          });
        }
      }
    }

    // Seed Resources
    for (let i = 0; i < RESOURCES.length; i++) {
      const r = RESOURCES[i];
      await saveResource({
        tournamentId,
        label: r.label,
        url: r.url,
        order: i
      });
    }
    console.log('Seeding complete');
  } catch (err) {
    console.error('Seeding error:', err);
    throw err;
  }
}

// ── Organizations ─────────────────────────────────────────────────────────────

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const { data, error } = await readClient()
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return applyEntitlementGrants(mapOrg(data));
}

export async function getOrganizationByUserId(userId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  const org = (data as any).organizations;
  return org ? applyEntitlementGrants(mapOrg(org)) : null;
}

export async function getOrgMembership(
  userId: string,
  orgId: string
): Promise<OrganizationMember | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single();
  if (error || !data) return null;
  return mapMember(data);
}

export async function getTournamentsByOrg(orgId: string, options: ReadOptions = {}): Promise<Tournament[]> {
  const { data, error } = await readClient(options)
    .from('tournaments')
    .select('*')
    .eq('org_id', orgId)
    .order('year', { ascending: false });
  if (error) return [];
  return (data || []).map(mapTournament);
}

export async function getActiveTournamentByOrg(orgId: string): Promise<Tournament | null> {
  const ts = await getTournamentsByOrg(orgId);
  return ts.find(t => t.status === 'active') ?? null;
}

export async function getTournamentBySlug(orgId: string, slug: string): Promise<Tournament | null> {
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .neq('status', 'archived')
    .single();
  if (error || !data) {
    if (error) console.error('getTournamentBySlug error', error);
    return null;
  }
  return mapTournament(data);
}

export async function getPublicTournamentBySlug(orgId: string, slug: string): Promise<Tournament | null> {
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .in('status', ['active', 'completed'])
    .maybeSingle();
  if (error || !data) return null;
  return mapTournament(data);
}

// Server-side only (uses service role key) ────────────────────────────────────

/**
 * Generate a URL-safe, globally-unique organization slug from a display name.
 * Slugifies the name, then appends -2/-3/… on collision; falls back to a short
 * random suffix if the name yields an empty base (e.g. non-Latin names). Lets the
 * signup + add-workspace flows skip asking the user for a URL up front — they refine
 * it later in settings (Event Settings for Tournament tiers; Org Settings for League/Club).
 */
export async function generateUniqueOrgSlug(name: string): Promise<string> {
  const base = (name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')) || 'org';

  const isTaken = async (slug: string) => {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  };

  if (!(await isTaken(base))) return base;
  for (let n = 2; n <= 50; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Extremely unlikely fallback — guarantee uniqueness with a short token.
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('Could not generate a unique organization URL.');
}

export async function createOrganization(
  name: string,
  slug: string,
  planId: OrgPlan = 'tournament',
  options: {
    accountKind?: Organization['accountKind'];
    teamWorkspaceStatus?: Organization['teamWorkspaceStatus'] | null;
    isDiscoverable?: boolean;
    freeFloor?: Organization['freeFloor'];
  } = {},
): Promise<Organization> {
  const limit = PLAN_CONFIG[planId]?.tournamentLimit ?? 1;
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert({
      name,
      slug,
      plan_id: planId,
      tournament_limit: limit,
      account_kind: options.accountKind ?? 'organization',
      team_workspace_status: options.teamWorkspaceStatus ?? null,
      is_discoverable: options.isDiscoverable ?? true,
      free_floor: options.freeFloor ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapOrg(data);
}

export async function createOrganizationMember(
  orgId: string,
  userId: string,
  role: OrgRole = 'owner'
): Promise<OrganizationMember> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .insert({ organization_id: orgId, user_id: userId, role, accepted_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapMember(data);
}

export async function updateOrgSubscription(orgId: string, fields: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string;
  planId?: string;
  tournamentLimit?: number;
  subscriptionPeriod?: string | null;
  currentPeriodEnd?: string | null;
  repTeamSubscriptionItemId?: string | null;
}): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.stripeCustomerId !== undefined)        update.stripe_customer_id = fields.stripeCustomerId;
  if (fields.stripeSubscriptionId !== undefined)    update.stripe_subscription_id = fields.stripeSubscriptionId;
  if (fields.subscriptionStatus !== undefined)      update.subscription_status = fields.subscriptionStatus;
  if (fields.planId !== undefined)                  update.plan_id = fields.planId;
  if (fields.tournamentLimit !== undefined)         update.tournament_limit = fields.tournamentLimit;
  if (fields.subscriptionPeriod !== undefined)      update.subscription_period = fields.subscriptionPeriod;
  if (fields.currentPeriodEnd !== undefined)        update.current_period_end = fields.currentPeriodEnd;
  if (fields.repTeamSubscriptionItemId !== undefined) update.rep_team_subscription_item_id = fields.repTeamSubscriptionItemId;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabaseAdmin.from('organizations').update(update).eq('id', orgId);
  if (error) throw new Error(error.message);
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapOrg(r: any): Organization {
  return {
    id:                   r.id,
    name:                 r.name,
    slug:                 r.slug,
    logoUrl:              r.logo_url ?? undefined,
    planId:               r.plan_id,
    stripeCustomerId:            r.stripe_customer_id ?? undefined,
    stripeSubscriptionId:        r.stripe_subscription_id ?? undefined,
    subscriptionStatus:          r.subscription_status ?? 'active',
    subscriptionPeriod:          r.subscription_period ?? undefined,
    currentPeriodEnd:            r.current_period_end ?? null,
    repTeamSubscriptionItemId:   r.rep_team_subscription_item_id ?? null,
    tournamentLimit:             getEffectiveTournamentLimit(r.plan_id, r.tournament_limit),
    teamLimit:                   getEffectiveTeamLimit(r.plan_id, r.team_limit),
    isPublic:             r.is_public ?? true,
    createdAt:            r.created_at,
    themePreset:          r.theme_preset ?? undefined,
    themePrimary:         r.theme_primary ?? undefined,
    themeAccent:          r.theme_accent ?? undefined,
    heroBannerUrl:        r.hero_banner_url ?? undefined,
    themeFont:            r.theme_font ?? 'system',
    themeCardStyle:       r.theme_card_style ?? 'default',
    requireScoreFinalization: r.require_score_finalization ?? false,
    onboardingCompletedAt: r.onboarding_completed_at ?? null,
    enabledAddons:        r.enabled_addons ?? [],
    contactEmail:          r.contact_email ?? null,
    accountKind:           r.account_kind ?? 'organization',
    teamWorkspaceStatus:   r.team_workspace_status ?? null,
    isDiscoverable:        r.is_discoverable ?? true,
    freeFloor:             r.free_floor ?? null,
    privacyPolicyUrl:      r.privacy_policy_url ?? null,
  };
}

function mapMember(r: any): OrganizationMember {
  return {
    id:             r.id,
    organizationId: r.organization_id,
    userId:         r.user_id,
    role:           r.role,
    invitedAt:      r.invited_at,
    acceptedAt:     r.accepted_at ?? undefined,
  };
}

function mapTournament(r: any): Tournament {
  const status: TournamentStatus = r.status ?? (r.is_active ? 'active' : 'completed');
  return {
    id:             r.id,
    organizationId: r.organization_id ?? undefined,
    year:           r.year,
    name:           r.name,
    slug:           r.slug ?? '',
    sport:          r.sport ?? DEFAULT_SPORT,
    status,
    isActive:       status === 'active',
    startDate:      r.start_date ?? undefined,
    endDate:        r.end_date ?? undefined,
    contactEmail:   r.contact_email ?? undefined,
    feeScheduleMode:          (r.fee_schedule_mode === 'division' ? 'division' : 'tournament'),
    depositAmount:            r.deposit_amount != null ? Number(r.deposit_amount) : null,
    depositDueDate:           r.deposit_due_date ?? null,
    totalFeeAmount:           r.total_fee_amount != null ? Number(r.total_fee_amount) : null,
    totalFeeDueDate:          r.total_fee_due_date ?? null,
    logoUrl:                  r.logo_url ?? null,
    heroBannerUrl:            r.hero_banner_url ?? null,
    themePreset:              r.theme_preset ?? null,
    themePrimary:             r.theme_primary ?? null,
    themeAccent:              r.theme_accent ?? null,
    themeFont:                r.theme_font ?? null,
    themeCardStyle:           r.theme_card_style ?? null,
    colorMode:                (r.color_mode === 'light' ? 'light' : null) as 'light' | null,
    iconBgColor:              r.icon_bg_color ?? null,
    appName:                  r.app_name ?? null,
    iconScale:                r.app_icon_scale ?? null,
    publicHiddenPages:        Array.isArray(r.public_hidden_pages) ? r.public_hidden_pages : [],
    coachNamesShowOnPublic:   r.coach_names_show_on_public === true,
    listInDirectory:          r.list_in_directory === true,
    directoryProvince:        r.directory_province ?? null,
    requireScoreFinalization: r.require_score_finalization ?? null,
    settings:                 (r.settings && typeof r.settings === 'object') ? r.settings : {},
  };
}

/**
 * Resolve the contact email to show for a tournament, honoring the per-audience
 * visibility toggles (migration 120). The contact reaches two audiences:
 *   - `'public'` → public (anonymous) tournament pages, gated by `contact_show_on_public`
 *   - `'coach'`  → registered coaches (coach-facing emails + the Coaches Portal),
 *                  gated by `contact_show_to_coaches`
 *
 * Returns null when the organizer has hidden the contact from that audience — the caller
 * must NOT fall back to its own org email in that case, or the toggle would be a no-op.
 * When shown, the selected contact member's email is preferred (resolved via auth.users),
 * then the legacy `tournaments.contact_email`, then the audience-appropriate `orgFallbackEmail`
 * the caller supplies (org public contact for `'public'`; org owner for `'coach'`).
 */
export async function resolveTournamentContactEmail(
  tournamentId: string,
  orgFallbackEmail: string | null,
  audience: 'public' | 'coach',
): Promise<string | null> {
  const { data: t } = await supabaseAdmin
    .from('tournaments')
    .select('default_contact_member_id, contact_email, contact_show_on_public, contact_show_to_coaches')
    .eq('id', tournamentId)
    .single();
  if (!t) return orgFallbackEmail ?? null;
  // Hidden from this audience → suppress entirely (including the org fallback).
  const visible = audience === 'public' ? t.contact_show_on_public !== false : t.contact_show_to_coaches !== false;
  if (!visible) return null;

  let memberEmail: string | null = null;
  if (t.default_contact_member_id) {
    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('id', t.default_contact_member_id)
      .single();
    if (member?.user_id) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      memberEmail = user?.user?.email ?? null;
    }
  }
  return memberEmail || t.contact_email || orgFallbackEmail || null;
}

/**
 * Merge-patch the tournament settings JSONB column.
 * Only supplied keys are changed; all other existing keys are preserved.
 */
export async function updateTournamentSettings(
  tournamentId: string,
  patch: import('./types').TournamentSettings,
): Promise<void> {
  // Read-merge-write: safe for settings (low-contention, admin-only, small payload).
  const { data: current, error: readErr } = await authClient()
    .from('tournaments')
    .select('settings')
    .eq('id', tournamentId)
    .single();
  if (readErr) throw readErr;

  const merged = { ...(current?.settings ?? {}), ...patch };

  const { error } = await authClient()
    .from('tournaments')
    .update({ settings: merged })
    .eq('id', tournamentId);
  if (error) throw error;
}

function mapArchive(r: any): TournamentArchive {
  return {
    id:              r.id,
    tournamentId:    r.tournament_id ?? null,
    orgId:           r.org_id,
    tournamentName:  r.tournament_name,
    season:          r.season,
    division:        r.division ?? undefined,
    finalSnapshot:   r.final_snapshot,
    winnerTeamId:    r.winner_team_id ?? undefined,
    winnerTeamName:  r.winner_team_name ?? undefined,
    runnerUpName:    r.runner_up_name ?? undefined,
    totalTeams:      r.total_teams ?? undefined,
    totalGames:      r.total_games ?? undefined,
    integrityHash:   r.integrity_hash,
    sealedAt:        r.sealed_at,
    sealedBy:        r.sealed_by ?? undefined,
  };
}

// ── Tournament Archives ───────────────────────────────────────────────────────

export async function getArchivesByOrg(orgId: string): Promise<TournamentArchive[]> {
  const { data, error } = await readClient()
    .from('tournament_archives')
    .select('*')
    .eq('org_id', orgId)
    .order('sealed_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('getArchivesByOrg error', error);
    return [];
  }
  return data.map(mapArchive);
}

export async function getArchiveById(id: string): Promise<TournamentArchive | null> {
  const { data, error } = await supabase
    .from('tournament_archives')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) {
    if (error) console.error('getArchiveById error', error);
    return null;
  }
  return mapArchive(data);
}

// ── Accounting Module ─────────────────────────────────────────────────────────

export async function getOrgLedger(orgId: string): Promise<AccountingLedger | null> {
  // J4-020: the General ledger is the singular (org,'org',NULL) row. Migration 127 dedupes
  // strays and a partial unique index keeps it singular, but DON'T use `.maybeSingle()` here —
  // it throws on >1 row and the old code swallowed that to null, which made getOrCreateOrgLedger
  // insert ANOTHER General on every call (the corruption snowball). Order by created_at and take
  // the oldest (the canonical one the migration merges into) so a transient duplicate can never
  // re-trigger create-on-read.
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'org')
    .is('entity_id', null)
    .order('created_at', { ascending: true })
    .limit(1);
  return data && data.length ? mapLedger(data[0]) : null;
}

export async function getOrCreateOrgLedger(orgId: string, orgName: string): Promise<AccountingLedger> {
  const existing = await getOrgLedger(orgId);
  if (existing) return existing;
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'org', entity_id: null, name: `${orgName} — General` })
    .select()
    .single();
  return mapLedger(data!);
}

export async function getOrgAllLedgers(orgId: string): Promise<AccountingLedger[]> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLedger);
}

export async function getLedgerById(ledgerId: string, orgId: string): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('id', ledgerId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateTournamentLedger(
  orgId: string,
  tournamentId: string,
  tournamentName: string
): Promise<AccountingLedger> {
  const { data: existing } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'tournament')
    .eq('entity_id', tournamentId)
    .maybeSingle();
  if (existing) return mapLedger(existing);
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'tournament', entity_id: tournamentId, name: tournamentName })
    .select()
    .single();
  return mapLedger(data!);
}

export async function getOrCreateRepTeamLedger(
  orgId: string,
  teamId: string,
  teamName: string,
): Promise<AccountingLedger> {
  const { data: existing } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'team')
    .eq('entity_id', teamId)
    .maybeSingle();
  if (existing) return mapLedger(existing);
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'team', entity_id: teamId, name: teamName })
    .select()
    .single();
  return mapLedger(data!);
}

export async function getLedgerEntries(
  ledgerId: string,
  opts: { status?: AccountingEntryStatus; limit?: number; offset?: number } = {}
): Promise<AccountingEntry[]> {
  let q = supabaseAdmin
    .from('accounting_entries')
    .select('*')
    .eq('ledger_id', ledgerId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit)  q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  const { data } = await q;
  return (data ?? []).map(mapEntry);
}

export async function createEntry(
  ledgerId: string,
  input: Pick<AccountingEntry, 'entryDate' | 'description' | 'amount' | 'entryType' | 'status' | 'category'> &
    Partial<Pick<AccountingEntry, 'paymentMethod' | 'payeeId' | 'payeePayer' | 'notes'>>,
  createdBy: string
): Promise<AccountingEntry> {
  const { data } = await supabaseAdmin
    .from('accounting_entries')
    .insert({
      ledger_id:      ledgerId,
      entry_date:     input.entryDate,
      description:    input.description,
      amount:         input.amount,
      entry_type:     input.entryType,
      status:         input.status,
      category:       input.category ?? null,
      payment_method: input.paymentMethod ?? null,
      payee_id:       input.payeeId ?? null,
      payee_payer:    input.payeePayer ?? null,
      notes:          input.notes ?? null,
      created_by:     createdBy,
    })
    .select()
    .single();
  return mapEntry(data!);
}

export async function updateEntry(
  entryId: string,
  ledgerId: string,
  input: Partial<Pick<AccountingEntry, 'entryDate' | 'description' | 'amount' | 'entryType' | 'status' | 'category' | 'paymentMethod' | 'payeeId' | 'payeePayer' | 'notes'>>
): Promise<void> {
  await supabaseAdmin
    .from('accounting_entries')
    .update({
      ...(input.entryDate     !== undefined && { entry_date:      input.entryDate }),
      ...(input.description   !== undefined && { description:     input.description }),
      ...(input.amount        !== undefined && { amount:          input.amount }),
      ...(input.entryType     !== undefined && { entry_type:      input.entryType }),
      ...(input.status        !== undefined && { status:          input.status }),
      ...(input.category      !== undefined && { category:        input.category }),
      ...(input.paymentMethod !== undefined && { payment_method:  input.paymentMethod }),
      ...(input.payeeId       !== undefined && { payee_id:        input.payeeId }),
      ...(input.payeePayer    !== undefined && { payee_payer:     input.payeePayer }),
      ...(input.notes         !== undefined && { notes:           input.notes }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('ledger_id', ledgerId);
}

export async function voidEntry(entryId: string, ledgerId: string): Promise<void> {
  await supabaseAdmin
    .from('accounting_entries')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('ledger_id', ledgerId);
}

export async function getLedgerSummary(
  ledger: AccountingLedger,
  opts: { from?: string; to?: string } = {}
): Promise<LedgerSummary> {
  let q = supabaseAdmin
    .from('accounting_entries')
    .select('entry_type, status, amount')
    .eq('ledger_id', ledger.id)
    .neq('status', 'void');
  if (opts.from) q = q.gte('entry_date', opts.from);
  if (opts.to)   q = q.lte('entry_date', opts.to);
  const { data } = await q;
  const rows: { entry_type: string; status: string; amount: number }[] = (data ?? []) as any;
  const sum = (type: AccountingEntryType, status: AccountingEntryStatus) =>
    rows.filter(r => r.entry_type === type && r.status === status)
        .reduce((acc: number, r) => acc + Number(r.amount), 0);
  const postedIncome   = sum('income',  'posted') + sum('transfer_in',  'posted');
  const postedExpenses = sum('expense', 'posted') + sum('transfer_out', 'posted');
  return {
    ledger,
    postedIncome,
    postedExpenses,
    pendingIncome:   sum('income',  'pending'),
    pendingExpenses: sum('expense', 'pending'),
    netPosted:       postedIncome - postedExpenses,
    incomeOnly:      sum('income',  'posted'),
    expensesOnly:    sum('expense', 'posted'),
  };
}

function mapLedger(row: any): AccountingLedger {
  return {
    id:         row.id,
    orgId:      row.org_id,
    entityType: row.entity_type,
    entityId:   row.entity_id ?? null,
    name:       row.name,
    currency:   row.currency,
    isArchived: row.is_archived,
    createdAt:  row.created_at,
  };
}

function mapEntry(row: any): AccountingEntry {
  return {
    id:             row.id,
    ledgerId:       row.ledger_id,
    entryDate:      row.entry_date,
    description:    row.description,
    amount:         Number(row.amount),
    entryType:      row.entry_type,
    status:         row.status,
    category:       row.category ?? null,
    linkedEntryId:  row.linked_entry_id ?? null,
    sourceModule:   row.source_module ?? null,
    sourceEntityId: row.source_entity_id ?? null,
    paymentMethod:  row.payment_method ?? null,
    payeeId:        row.payee_id ?? null,
    payeePayer:     row.payee_payer ?? null,
    notes:          row.notes ?? null,
    createdBy:      row.created_by,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

// ── House League Module ───────────────────────────────────────────────────────

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface LeagueSeasonInput {
  name: string;
  slug: string;
  sport?: string;
  division?: string | null;
  description?: string | null;
  registrationFee?: number | null;
  autoGenerateFees?: boolean;
  autoApproveUnderCapacity?: boolean;
  autoPromoteWaitlist?: boolean;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  seasonStartDate?: string | null;
  seasonEndDate?: string | null;
  waiverText?: string | null;
}

export interface LeagueTeamInput {
  name: string;
  color?: string | null;
  coachName?: string | null;
  sortOrder?: number;
}

export interface LeagueGameInput {
  orgId: string;
  seasonId: string;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface PublicRegistrationInput {
  seasonId: string;
  divisionId: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth?: string | null;
  playerJerseyPref?: string | null;
  playerPositionPref?: string | null;
  playerNotes?: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone?: string | null;
  status?: LeagueRegistrationStatus;
  waitlistPosition?: number | null;
  source?: 'public_form' | 'admin_manual';
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapLeagueSeason(row: any): LeagueSeason {
  return {
    id:                        row.id,
    orgId:                     row.org_id,
    name:                      row.name,
    slug:                      row.slug,
    sport:                     row.sport,
    division:                  row.division ?? null,
    status:                    row.status,
    description:               row.description ?? null,
    registrationFee:           row.registration_fee != null ? Number(row.registration_fee) : null,
    autoGenerateFees:          row.auto_generate_fees,
    autoApproveUnderCapacity:  row.auto_approve_under_capacity,
    autoPromoteWaitlist:       row.auto_promote_waitlist,
    registrationOpenAt:        row.registration_open_at ?? null,
    registrationCloseAt:       row.registration_close_at ?? null,
    seasonStartDate:           row.season_start_date ?? null,
    seasonEndDate:             row.season_end_date ?? null,
    waiverText:                row.waiver_text ?? null,
    draftState:                row.draft_state ?? null,
    createdAt:                 row.created_at,
    updatedAt:                 row.updated_at,
  };
}

function mapLeagueDivision(row: any): LeagueDivision {
  return {
    id:        row.id,
    seasonId:  row.season_id,
    name:      row.name,
    capacity:  row.capacity ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapLeagueTeam(row: any): LeagueTeam {
  return {
    id:         row.id,
    seasonId:   row.season_id,
    divisionId: row.division_id,
    name:       row.name,
    color:      row.color ?? null,
    coachName:  row.coach_name ?? null,
    sortOrder:  row.sort_order,
    createdAt:  row.created_at,
  };
}

function mapLeagueRegistration(row: any): LeagueRegistration {
  return {
    id:                  row.id,
    seasonId:            row.season_id,
    divisionId:          row.division_id ?? null,
    playerFirstName:     row.player_first_name,
    playerLastName:      row.player_last_name,
    playerDateOfBirth:   row.player_date_of_birth ?? null,
    playerJerseyPref:    row.player_jersey_pref ?? null,
    playerPositionPref:  row.player_position_pref ?? null,
    playerNotes:         row.player_notes ?? null,
    guardianFirstName:   row.guardian_first_name,
    guardianLastName:    row.guardian_last_name,
    guardianEmail:       row.guardian_email,
    guardianPhone:       row.guardian_phone ?? null,
    status:              row.status,
    waitlistPosition:    row.waitlist_position ?? null,
    teamId:              row.team_id ?? null,
    registrationFeePaid: row.registration_fee_paid,
    feeEntryId:          row.fee_entry_id ?? null,
    adminNotes:          row.admin_notes ?? null,
    source:              row.source,
    registeredAt:        row.registered_at,
    updatedAt:           row.updated_at,
  };
}

function mapLeagueGame(row: any): LeagueGame {
  return {
    id:          row.id,
    seasonId:    row.season_id,
    divisionId:  row.division_id,
    homeTeamId:  row.home_team_id,
    awayTeamId:  row.away_team_id,
    scheduledAt: row.scheduled_at ?? null,
    location:    row.location ?? null,
    homeScore:   row.home_score ?? null,
    awayScore:   row.away_score ?? null,
    status:      row.status,
    notes:       row.notes ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── Season helpers ───────────────────────────────────────────────────────────

export async function getLeagueSeasons(orgId: string): Promise<LeagueSeason[]> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapLeagueSeason);
}

export async function getLeagueSeasonBySlug(orgId: string, slug: string): Promise<LeagueSeason | null> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .maybeSingle();
  return data ? mapLeagueSeason(data) : null;
}

export async function getLeagueSeasonById(seasonId: string, orgId: string): Promise<LeagueSeason | null> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('*')
    .eq('id', seasonId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data ? mapLeagueSeason(data) : null;
}

export async function createLeagueSeason(orgId: string, input: LeagueSeasonInput): Promise<LeagueSeason> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .insert({
      org_id:                      orgId,
      name:                        input.name,
      slug:                        input.slug,
      sport:                       input.sport ?? DEFAULT_SPORT,
      division:                   input.division ?? null,
      description:                 input.description ?? null,
      registration_fee:            input.registrationFee ?? null,
      auto_generate_fees:          input.autoGenerateFees ?? false,
      auto_approve_under_capacity: input.autoApproveUnderCapacity ?? false,
      auto_promote_waitlist:       input.autoPromoteWaitlist ?? false,
      registration_open_at:        input.registrationOpenAt ?? null,
      registration_close_at:       input.registrationCloseAt ?? null,
      season_start_date:           input.seasonStartDate ?? null,
      season_end_date:             input.seasonEndDate ?? null,
      waiver_text:                 input.waiverText ?? null,
    })
    .select()
    .single();
  return mapLeagueSeason(data!);
}

export async function updateLeagueSeason(
  seasonId: string,
  orgId: string,
  input: Partial<LeagueSeasonInput> & { status?: LeagueSeasonStatus }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name                      !== undefined) patch.name                        = input.name;
  if (input.slug                      !== undefined) patch.slug                        = input.slug;
  if (input.sport                     !== undefined) patch.sport                       = input.sport;
  if (input.division                  !== undefined) patch.division                   = input.division;
  if (input.description               !== undefined) patch.description                 = input.description;
  if (input.registrationFee           !== undefined) patch.registration_fee            = input.registrationFee;
  if (input.autoGenerateFees          !== undefined) patch.auto_generate_fees          = input.autoGenerateFees;
  if (input.autoApproveUnderCapacity  !== undefined) patch.auto_approve_under_capacity = input.autoApproveUnderCapacity;
  if (input.autoPromoteWaitlist       !== undefined) patch.auto_promote_waitlist       = input.autoPromoteWaitlist;
  if (input.registrationOpenAt        !== undefined) patch.registration_open_at        = input.registrationOpenAt;
  if (input.registrationCloseAt       !== undefined) patch.registration_close_at       = input.registrationCloseAt;
  if (input.seasonStartDate           !== undefined) patch.season_start_date           = input.seasonStartDate;
  if (input.seasonEndDate             !== undefined) patch.season_end_date             = input.seasonEndDate;
  if (input.waiverText                !== undefined) patch.waiver_text                 = input.waiverText;
  if (input.status                    !== undefined) patch.status                      = input.status;
  await supabaseAdmin
    .from('league_seasons')
    .update(patch)
    .eq('id', seasonId)
    .eq('org_id', orgId);
}

// ─── Division helpers ─────────────────────────────────────────────────────────

export async function getDivisionsForSeason(seasonId: string): Promise<LeagueDivision[]> {
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .select('*')
    .eq('season_id', seasonId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLeagueDivision);
}

export async function createDivision(
  seasonId: string,
  input: { name: string; capacity?: number | null; sortOrder?: number }
): Promise<LeagueDivision> {
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .insert({
      season_id:  seasonId,
      name:       input.name,
      capacity:   input.capacity ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  return mapLeagueDivision(data!);
}

export async function updateDivision(
  divisionId: string,
  input: Partial<{ name: string; capacity: number | null; sortOrder: number }>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name      !== undefined) patch.name       = input.name;
  if (input.capacity  !== undefined) patch.capacity   = input.capacity;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  await supabaseAdmin.from('league_divisions').update(patch).eq('id', divisionId);
}

export async function deleteDivision(divisionId: string): Promise<void> {
  // Guard: caller must verify no active registrations before calling
  await supabaseAdmin.from('league_divisions').delete().eq('id', divisionId);
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

export async function getTeamsForSeason(seasonId: string): Promise<LeagueTeam[]> {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('*')
    .eq('season_id', seasonId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLeagueTeam);
}

export async function getTeamsForDivision(divisionId: string): Promise<LeagueTeam[]> {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('*')
    .eq('division_id', divisionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLeagueTeam);
}

export async function createLeagueTeam(
  seasonId: string,
  divisionId: string,
  input: LeagueTeamInput
): Promise<LeagueTeam> {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .insert({
      season_id:   seasonId,
      division_id: divisionId,
      name:        input.name,
      color:       input.color ?? null,
      coach_name:  input.coachName ?? null,
      sort_order:  input.sortOrder ?? 0,
    })
    .select()
    .single();
  return mapLeagueTeam(data!);
}

export async function updateLeagueTeam(teamId: string, input: Partial<LeagueTeamInput>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name      !== undefined) patch.name       = input.name;
  if (input.color     !== undefined) patch.color      = input.color;
  if (input.coachName !== undefined) patch.coach_name = input.coachName;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  await supabaseAdmin.from('league_teams').update(patch).eq('id', teamId);
}

export async function deleteLeagueTeam(teamId: string): Promise<void> {
  // Guard: caller must verify no assigned players before calling
  await supabaseAdmin.from('league_teams').delete().eq('id', teamId);
}

// ─── League email log ─────────────────────────────────────────────────────────

export interface LeagueEmailLogEntry {
  id: string;
  orgId: string;
  seasonId: string;
  sentBy: string;
  sentAt: string;
  subject: string;
  scope: string;
  audience: string;
  countSent: number;
  countSkipped: number;
}

export async function insertLeagueEmailLog(entry: {
  orgId: string;
  seasonId: string;
  sentBy: string;
  subject: string;
  scope: string;
  audience: string;
  countSent: number;
  countSkipped: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('league_email_log').insert({
    org_id:        entry.orgId,
    season_id:     entry.seasonId,
    sent_by:       entry.sentBy,
    subject:       entry.subject,
    scope:         entry.scope,
    audience:      entry.audience,
    count_sent:    entry.countSent,
    count_skipped: entry.countSkipped,
  });
  if (error) throw error;
}

export async function getLeagueEmailLog(seasonId: string): Promise<LeagueEmailLogEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('league_email_log')
    .select('*')
    .eq('season_id', seasonId)
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(row => ({
    id:           row.id,
    orgId:        row.org_id,
    seasonId:     row.season_id,
    sentBy:       row.sent_by,
    sentAt:       row.sent_at,
    subject:      row.subject,
    scope:        row.scope,
    audience:     row.audience,
    countSent:    row.count_sent,
    countSkipped: row.count_skipped,
  }));
}

// ─── Registration helpers ─────────────────────────────────────────────────────

export async function getRegistrationsForSeason(
  seasonId: string,
  opts: { status?: LeagueRegistrationStatus } = {}
): Promise<LeagueRegistration[]> {
  let q = supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('season_id', seasonId)
    .order('registered_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const { data } = await q;
  return (data ?? []).map(mapLeagueRegistration);
}

export async function getRegistrationsForDivision(
  divisionId: string,
  opts: { status?: LeagueRegistrationStatus } = {}
): Promise<LeagueRegistration[]> {
  let q = supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('division_id', divisionId)
    .order('registered_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const { data } = await q;
  return (data ?? []).map(mapLeagueRegistration);
}

export async function createRegistration(input: PublicRegistrationInput): Promise<LeagueRegistration> {
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .insert({
      season_id:            input.seasonId,
      division_id:          input.divisionId ?? null,
      player_first_name:    input.playerFirstName,
      player_last_name:     input.playerLastName,
      player_date_of_birth: input.playerDateOfBirth ?? null,
      player_jersey_pref:   input.playerJerseyPref ?? null,
      player_position_pref: input.playerPositionPref ?? null,
      player_notes:         input.playerNotes ?? null,
      guardian_first_name:  input.guardianFirstName,
      guardian_last_name:   input.guardianLastName,
      guardian_email:       input.guardianEmail,
      guardian_phone:       input.guardianPhone ?? null,
      status:               input.status ?? 'pending_review',
      waitlist_position:    input.waitlistPosition ?? null,
      source:               input.source ?? 'public_form',
    })
    .select()
    .single();
  return mapLeagueRegistration(data!);
}

export async function updateRegistrationStatus(
  registrationId: string,
  status: LeagueRegistrationStatus,
  adminNotes?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  // Clear waitlist_position when moving out of waitlist
  if (status !== 'waitlisted') patch.waitlist_position = null;
  await supabaseAdmin.from('league_registrations').update(patch).eq('id', registrationId);
}

export async function assignRegistrationToTeam(registrationId: string, teamId: string): Promise<void> {
  await supabaseAdmin
    .from('league_registrations')
    .update({ team_id: teamId, updated_at: new Date().toISOString() })
    .eq('id', registrationId);
}

export async function bulkAssignTeams(
  assignments: Array<{ registrationId: string; teamId: string }>
): Promise<void> {
  await Promise.all(assignments.map(a => assignRegistrationToTeam(a.registrationId, a.teamId)));
}

export async function getWaitlistForDivision(divisionId: string): Promise<LeagueRegistration[]> {
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('division_id', divisionId)
    .eq('status', 'waitlisted')
    .order('waitlist_position', { ascending: true });
  return (data ?? []).map(mapLeagueRegistration);
}

export async function promoteFromWaitlist(registrationId: string): Promise<void> {
  await supabaseAdmin
    .from('league_registrations')
    .update({ status: 'active', waitlist_position: null, updated_at: new Date().toISOString() })
    .eq('id', registrationId);
}

// ─── Game helpers ─────────────────────────────────────────────────────────────

export async function getGamesForDivision(divisionId: string): Promise<LeagueGame[]> {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('*')
    .eq('division_id', divisionId)
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeagueGame);
}

export async function getGamesForSeason(seasonId: string): Promise<LeagueGame[]> {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('*')
    .eq('season_id', seasonId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeagueGame);
}

// ─── League practices ─────────────────────────────────────────────────────────

function mapLeaguePractice(row: Record<string, unknown>): LeaguePractice {
  return {
    id:                row.id as string,
    seasonId:          row.season_id as string,
    divisionId:        row.division_id as string | null,
    teamId:            row.team_id as string,
    scheduledAt:       row.scheduled_at as string | null,
    endsAt:            row.ends_at as string | null,
    location:          row.location as string | null,
    notes:             row.notes as string | null,
    status:            row.status as LeaguePracticeStatus,
    recurrenceGroupId: row.recurrence_group_id as string | null,
    createdAt:         row.created_at as string,
    updatedAt:         row.updated_at as string,
  };
}

export async function getPracticesForTeam(teamId: string): Promise<LeaguePractice[]> {
  const { data } = await supabaseAdmin
    .from('league_practices')
    .select('*')
    .eq('team_id', teamId)
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeaguePractice);
}

export async function getPracticesForSeason(seasonId: string): Promise<LeaguePractice[]> {
  const { data } = await supabaseAdmin
    .from('league_practices')
    .select('*')
    .eq('season_id', seasonId)
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeaguePractice);
}

interface LeaguePracticeInput {
  orgId: string;
  seasonId: string;
  divisionId: string | null;
  teamId: string;
  scheduledAt: string | null;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  recurrenceGroupId?: string | null;
}

export async function createPractices(inputs: LeaguePracticeInput[]): Promise<LeaguePractice[]> {
  const { data } = await supabaseAdmin
    .from('league_practices')
    .insert(inputs.map(i => ({
      org_id:              i.orgId,
      season_id:           i.seasonId,
      division_id:         i.divisionId ?? null,
      team_id:             i.teamId,
      scheduled_at:        i.scheduledAt ?? null,
      ends_at:             i.endsAt ?? null,
      location:            i.location ?? null,
      notes:               i.notes ?? null,
      recurrence_group_id: i.recurrenceGroupId ?? null,
    })))
    .select();
  return (data ?? []).map(mapLeaguePractice);
}

export async function cancelPractice(
  practiceId: string,
  scope: 'one' | 'remaining' | 'all',
): Promise<void> {
  const patch = { status: 'cancelled', updated_at: new Date().toISOString() };

  if (scope === 'one') {
    await supabaseAdmin.from('league_practices').update(patch).eq('id', practiceId);
    return;
  }

  const { data: p } = await supabaseAdmin
    .from('league_practices')
    .select('recurrence_group_id, scheduled_at')
    .eq('id', practiceId)
    .single();

  if (!p?.recurrence_group_id) {
    await supabaseAdmin.from('league_practices').update(patch).eq('id', practiceId);
    return;
  }

  if (scope === 'all') {
    await supabaseAdmin
      .from('league_practices')
      .update(patch)
      .eq('recurrence_group_id', p.recurrence_group_id);
  } else {
    await supabaseAdmin
      .from('league_practices')
      .update(patch)
      .eq('recurrence_group_id', p.recurrence_group_id)
      .gte('scheduled_at', p.scheduled_at!);
  }
}

export async function createLeagueGame(input: LeagueGameInput): Promise<LeagueGame> {
  const { data } = await supabaseAdmin
    .from('league_games')
    .insert({
      org_id:       input.orgId,
      season_id:    input.seasonId,
      division_id:  input.divisionId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      scheduled_at: input.scheduledAt ?? null,
      location:     input.location ?? null,
      notes:        input.notes ?? null,
    })
    .select()
    .single();
  return mapLeagueGame(data!);
}

export async function updateLeagueGame(
  gameId: string,
  input: Partial<LeagueGameInput> & { homeScore?: number | null; awayScore?: number | null; status?: string; notes?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;
  if (input.location    !== undefined) patch.location     = input.location;
  if (input.homeScore   !== undefined) patch.home_score   = input.homeScore;
  if (input.awayScore   !== undefined) patch.away_score   = input.awayScore;
  if (input.status      !== undefined) patch.status       = input.status;
  if (input.notes       !== undefined) patch.notes        = input.notes;
  await supabaseAdmin.from('league_games').update(patch).eq('id', gameId);
}

export async function enterGameResult(gameId: string, homeScore: number, awayScore: number): Promise<void> {
  await supabaseAdmin
    .from('league_games')
    .update({ home_score: homeScore, away_score: awayScore, status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', gameId);
}

// ─── Standings (computed, not stored) ────────────────────────────────────────

export async function computeStandings(divisionId: string): Promise<LeagueStandingsRow[]> {
  const [teams, games] = await Promise.all([
    getTeamsForDivision(divisionId),
    getGamesForDivision(divisionId),
  ]);
  const completedGames = games.filter(g => g.status === 'completed');

  const rows: LeagueStandingsRow[] = teams.map(team => {
    let wins = 0, losses = 0, ties = 0, runsFor = 0, runsAgainst = 0;
    for (const g of completedGames) {
      const isHome = g.homeTeamId === team.id;
      const isAway = g.awayTeamId === team.id;
      if (!isHome && !isAway) continue;
      const tf = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const ta = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      runsFor     += tf;
      runsAgainst += ta;
      if      (tf > ta) wins++;
      else if (tf < ta) losses++;
      else              ties++;
    }
    return {
      team,
      gamesPlayed:     wins + losses + ties,
      wins,
      losses,
      ties,
      points:          wins * 2 + ties,
      runsFor,
      runsAgainst,
      runDifferential: runsFor - runsAgainst,
    };
  });

  return rows.sort((a, b) =>
    b.points - a.points ||
    b.runDifferential - a.runDifferential ||
    b.runsFor - a.runsFor
  );
}

// ─── Season summary ───────────────────────────────────────────────────────────

export async function getLeagueSeasonSummary(season: LeagueSeason): Promise<LeagueSeasonSummary> {
  const [divisions, teams, regs] = await Promise.all([
    getDivisionsForSeason(season.id),
    getTeamsForSeason(season.id),
    getRegistrationsForSeason(season.id),
  ]);
  return {
    season,
    divisionCount:           divisions.length,
    activeRegistrationCount: regs.filter(r => r.status === 'active').length,
    waitlistCount:           regs.filter(r => r.status === 'waitlisted').length,
    pendingReviewCount:      regs.filter(r => r.status === 'pending_review').length,
    teamCount:               teams.length,
  };
}

// ─── League season ledger helpers ─────────────────────────────────────────────

export async function getLeagueSeasonLedger(
  orgId: string,
  seasonId: string,
): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'league_season')
    .eq('entity_id', seasonId)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateLeagueSeasonLedger(
  orgId: string,
  seasonId: string,
  seasonName: string
): Promise<AccountingLedger> {
  const { data: existing } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'league_season')
    .eq('entity_id', seasonId)
    .maybeSingle();
  if (existing) return mapLedger(existing);
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'league_season', entity_id: seasonId, name: seasonName })
    .select()
    .single();
  return mapLedger(data!);
}

export async function createLeagueRegistrationFeeEntry(
  orgId: string,
  seasonId: string,
  seasonName: string,
  regId: string,
  playerName: string,
  amount: number,
  status: AccountingEntryStatus,
  createdBy: string,
): Promise<AccountingEntry> {
  const ledger = await getOrCreateLeagueSeasonLedger(orgId, seasonId, seasonName);
  const { data } = await supabaseAdmin
    .from('accounting_entries')
    .insert({
      ledger_id:        ledger.id,
      entry_date:       new Date().toISOString().slice(0, 10),
      description:      `${playerName} — registration fee`,
      amount,
      entry_type:       'income',
      status,
      category:         'registration_fee',
      source_module:    'league_registration',
      source_entity_id: regId,
      created_by:       createdBy,
    })
    .select()
    .single();
  await supabaseAdmin
    .from('league_registrations')
    .update({ fee_entry_id: data!.id, updated_at: new Date().toISOString() })
    .eq('id', regId);
  return mapEntry(data!);
}

// ── Rep Teams Module ──────────────────────────────────────────────────────────

function mapRepTeam(r: any): RepTeam {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    slug: r.slug,
    sport: r.sport,
    division: r.division ?? null,
    groupId: r.group_id ?? null,
    groupName: r.rep_team_groups?.name ?? null,
    description: r.description ?? null,
    color: r.color ?? null,
    isArchived: r.is_archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeams(orgId: string, groupId?: string | null, scopeGroupIds?: string[]): Promise<RepTeam[]> {
  let query = supabaseAdmin
    .from('rep_teams')
    .select('*, rep_team_groups(name)')
    .eq('org_id', orgId)
    .order('name');
  if (scopeGroupIds && scopeGroupIds.length > 0) {
    query = query.in('group_id', scopeGroupIds);
  } else if (groupId !== undefined && groupId !== null) {
    query = query.eq('group_id', groupId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRepTeam);
}

// ── Rep Team Groups ────────────────────────────────────────────────────────────

import type { RepTeamGroup, RepEventResource, LineupProfile, LineupSettings, LineupRulesOverride } from './types';

function mapRepTeamGroup(r: any): RepTeamGroup {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    displayOrder: r.display_order,
    createdAt: r.created_at,
  };
}

export async function getRepTeamGroups(orgId: string): Promise<RepTeamGroup[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_groups')
    .select('*')
    .eq('org_id', orgId)
    .order('display_order')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapRepTeamGroup);
}

export async function createRepTeamGroup(
  orgId: string,
  name: string,
  displayOrder = 0,
): Promise<RepTeamGroup> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_groups')
    .insert({ org_id: orgId, name: name.trim(), display_order: displayOrder })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamGroup(data);
}

export async function updateRepTeamGroup(
  id: string,
  fields: { name?: string; displayOrder?: number },
): Promise<RepTeamGroup> {
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.displayOrder !== undefined) patch.display_order = fields.displayOrder;
  const { data, error } = await supabaseAdmin
    .from('rep_team_groups')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamGroup(data);
}

export async function deleteRepTeamGroup(id: string): Promise<void> {
  // Block deletion if any teams are still assigned to this group
  const { count } = await supabaseAdmin
    .from('rep_teams')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', id);
  if ((count ?? 0) > 0) {
    throw Object.assign(new Error('Cannot delete a group that has teams assigned to it'), { code: 'GROUP_HAS_TEAMS' });
  }
  const { error } = await supabaseAdmin.from('rep_team_groups').delete().eq('id', id);
  if (error) throw error;
}

export async function setRepTeamGroup(teamId: string, groupId: string | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_teams')
    .update({ group_id: groupId })
    .eq('id', teamId);
  if (error) throw error;
}

export interface OpenTryout {
  teamId: string;
  teamName: string;
  teamSlug: string;
  programYearId: string;
  programYearName: string;
}

export async function getOpenTryoutsByOrg(orgId: string): Promise<OpenTryout[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, name, team_id, rep_teams!team_id(name, slug)')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .eq('tryout_open', true);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    teamId: r.team_id,
    teamName: r.rep_teams?.name ?? '',
    teamSlug: r.rep_teams?.slug ?? '',
    programYearId: r.id,
    programYearName: r.name,
  }));
}

export async function getRepTeam(teamId: string): Promise<RepTeam | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('*, rep_team_groups(name)')
    .eq('id', teamId)
    .single();
  if (error) return null;
  return mapRepTeam(data);
}

export async function getRepTeamBySlug(orgId: string, slug: string): Promise<RepTeam | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('*, rep_team_groups(name)')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single();
  if (error) return null;
  return mapRepTeam(data);
}

export async function createRepTeam(orgId: string, fields: {
  name: string;
  slug: string;
  sport: string;
  division?: string | null;
  description?: string | null;
  color?: string | null;
  groupId?: string | null;
}): Promise<RepTeam> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .insert({
      org_id: orgId,
      name: fields.name,
      slug: fields.slug,
      sport: fields.sport,
      division: fields.division ?? null,
      description: fields.description ?? null,
      color: fields.color ?? null,
      group_id: fields.groupId ?? null,
    })
    .select('*, rep_team_groups(name)')
    .single();
  if (error) throw error;
  return mapRepTeam(data);
}

export async function updateRepTeam(teamId: string, fields: {
  name?: string;
  sport?: string;
  division?: string | null;
  description?: string | null;
  color?: string | null;
  isArchived?: boolean;
}): Promise<RepTeam> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.sport !== undefined) patch.sport = fields.sport;
  if (fields.division !== undefined) patch.division = fields.division;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.color !== undefined) patch.color = fields.color;
  if (fields.isArchived !== undefined) patch.is_archived = fields.isArchived;
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .update(patch)
    .eq('id', teamId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeam(data);
}

export async function deleteRepTeam(teamId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_teams').delete().eq('id', teamId);
  if (error) throw error;
}

/**
 * Returns the number of rep teams in an org that have at least one program year
 * in 'draft' or 'active' status. Used to determine the billable quantity for the
 * Club plan rep-team add-on (first 3 free, $19/month per additional).
 */
export async function getActiveRepTeamCount(orgId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('team_id')
    .eq('org_id', orgId)
    .in('status', ['draft', 'active']);
  if (error) throw error;
  const uniqueTeamIds = new Set((data ?? []).map((r: any) => r.team_id as string));
  return uniqueTeamIds.size;
}

/**
 * Authoritative team count for the Club capacity band (Club Repackaging): every
 * non-archived rep team counts equally — all team types (rep/select/development),
 * regardless of program-year status. This is the count enforced against teamLimit.
 */
export async function getNonArchivedRepTeamCount(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_archived', false);
  if (error) throw error;
  return count ?? 0;
}

export async function bulkRenameTeamSlugs(
  orgId: string,
  renames: Array<{ teamId: string; newSlug: string }>,
): Promise<void> {
  if (renames.length === 0) return;

  // Snapshot current slugs for best-effort rollback on failure
  const { data: snapshot } = await supabaseAdmin
    .from('rep_teams')
    .select('id, slug')
    .in('id', renames.map(r => r.teamId))
    .eq('org_id', orgId);
  const original = new Map((snapshot ?? []).map(r => [r.id as string, r.slug as string]));

  try {
    // Phase 1: move every changing team to a guaranteed-unique temp slug.
    // This resolves any circular dependency (A→B, B→C, C→A) by vacating
    // all "departing" slugs before any "arriving" ones are written.
    for (const { teamId } of renames) {
      const { error } = await supabaseAdmin
        .from('rep_teams')
        .update({ slug: `__tmp_${teamId}` })
        .eq('id', teamId)
        .eq('org_id', orgId);
      if (error) throw error;
    }

    // Phase 2: apply final slugs — all target slots are now free
    for (const { teamId, newSlug } of renames) {
      const { error } = await supabaseAdmin
        .from('rep_teams')
        .update({ slug: newSlug, updated_at: new Date().toISOString() })
        .eq('id', teamId)
        .eq('org_id', orgId);
      if (error) throw error;
    }
  } catch (err) {
    // Best-effort rollback: restore original slugs so no team is stuck with a __tmp_ slug
    for (const { teamId } of renames) {
      const prev = original.get(teamId);
      if (prev) {
        try {
          await supabaseAdmin
            .from('rep_teams')
            .update({ slug: prev })
            .eq('id', teamId)
            .eq('org_id', orgId);
        } catch {
          // ignore rollback errors — the admin will see teams with __tmp_ slugs
          // and can re-run the rename to recover
        }
      }
    }
    throw err;
  }
}

// Program Years

function mapRepProgramYear(r: any): RepProgramYear {
  return {
    id: r.id,
    teamId: r.team_id,
    orgId: r.org_id,
    name: r.name,
    year: r.year,
    status: r.status,
    tryoutOpen: r.tryout_open,
    tryoutDescription: r.tryout_description,
    budgetAmount: r.budget_amount != null ? Number(r.budget_amount) : null,
    autoRemindersEnabled: r.auto_reminders_enabled ?? true,
    lineupSettings: (r.lineup_settings ?? null) as LineupSettings | null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepProgramYears(teamId: string): Promise<RepProgramYear[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepProgramYear);
}

export async function getRepProgramYear(yearId: string): Promise<RepProgramYear | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('id', yearId)
    .single();
  if (error) return null;
  return mapRepProgramYear(data);
}

export async function createRepProgramYear(teamId: string, orgId: string, fields: {
  name: string;
  year: number;
  tryoutOpen?: boolean;
  tryoutDescription?: string | null;
}): Promise<RepProgramYear> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .insert({
      team_id: teamId,
      org_id: orgId,
      name: fields.name,
      year: fields.year,
      tryout_open: fields.tryoutOpen ?? false,
      tryout_description: fields.tryoutDescription ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepProgramYear(data);
}

export async function updateRepProgramYear(yearId: string, fields: {
  name?: string;
  status?: RepProgramYearStatus;
  tryoutOpen?: boolean;
  tryoutDescription?: string | null;
  budgetAmount?: number | null;
  lineupSettings?: LineupSettings | null;
}): Promise<RepProgramYear> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.tryoutOpen !== undefined) patch.tryout_open = fields.tryoutOpen;
  if (fields.tryoutDescription !== undefined) patch.tryout_description = fields.tryoutDescription;
  if (fields.budgetAmount !== undefined) patch.budget_amount = fields.budgetAmount;
  if (fields.lineupSettings !== undefined) patch.lineup_settings = fields.lineupSettings;
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .update(patch)
    .eq('id', yearId)
    .select()
    .single();
  if (error) throw error;
  return mapRepProgramYear(data);
}

// Team Coaches

function mapRepTeamCoach(r: any): RepTeamCoach {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    userId: r.user_id,
    coachRole: r.coach_role,
    capabilities: (r.capabilities as AssistantCapabilityGrants | null) ?? null,
    createdAt: r.created_at,
  };
}

export async function getRepTeamCoaches(programYearId: string): Promise<RepTeamCoach[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapRepTeamCoach);
}

export async function addRepTeamCoach(
  programYearId: string,
  teamId: string,
  orgId: string,
  userId: string,
  coachRole: 'head_coach' | 'assistant_coach' = 'head_coach',
): Promise<RepTeamCoach> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .insert({ program_year_id: programYearId, team_id: teamId, org_id: orgId, user_id: userId, coach_role: coachRole })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamCoach(data);
}

export async function removeRepTeamCoach(coachId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_team_coaches').delete().eq('id', coachId);
  if (error) throw error;
}

export async function getRepTeamCoachById(coachId: string): Promise<RepTeamCoach | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('*')
    .eq('id', coachId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTeamCoach(data) : null;
}

/** After removing an assistant, drop their capability-less `coach` org membership if they no longer
 *  coach any team in that org — keeps guest memberships from lingering. Never touches other roles. */
export async function cleanupOrphanedCoachMembership(orgId: string, userId: string): Promise<void> {
  const { data: remaining } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .limit(1);
  if (remaining && remaining.length > 0) return; // still coaches something in this org
  await supabaseAdmin
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('role', 'coach');
}

/** Set an assistant coach's per-assistant capability grants (Assistant Coaches Phase 2). */
export async function updateRepTeamCoachCapabilities(
  coachId: string,
  grants: AssistantCapabilityGrants,
): Promise<RepTeamCoach> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .update({ capabilities: grants })
    .eq('id', coachId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamCoach(data);
}

export interface RepTeamStaffMember {
  coachId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  displayName: string | null;
  email: string | null;
  capabilities: AssistantCapabilityGrants | null;
  createdAt: string;
}

/** The full coaching staff for a program year, enriched with each coach's display name + email
 *  (name from `organization_members`, email from auth). Head coach first, then assistants. */
export async function getRepTeamStaffForYear(
  programYearId: string,
  orgId: string,
): Promise<RepTeamStaffMember[]> {
  const coaches = await getRepTeamCoaches(programYearId);
  if (coaches.length === 0) return [];

  const { data: memberRows } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, display_name')
    .eq('organization_id', orgId)
    .in('user_id', coaches.map(c => c.userId));
  const nameByUser = new Map((memberRows ?? []).map((r: any) => [r.user_id as string, (r.display_name as string | null) ?? null]));

  const staff = await Promise.all(coaches.map(async c => {
    let email: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(c.userId);
      email = data.user?.email ?? null;
    } catch { /* best-effort — email is display-only */ }
    return {
      coachId: c.id,
      userId: c.userId,
      coachRole: c.coachRole,
      displayName: nameByUser.get(c.userId) ?? null,
      email,
      capabilities: c.capabilities,
      createdAt: c.createdAt,
    };
  }));

  // Head coach(es) first, then assistants, each oldest-first.
  return staff.sort((a, b) => {
    if (a.coachRole !== b.coachRole) return a.coachRole === 'head_coach' ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export interface OrgAssistantCoach {
  coachId: string;
  teamId: string;
  teamName: string;
  teamGroupId: string | null;
  programYearId: string;
  programYearName: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  capabilities: AssistantCapabilityGrants | null;
}

/** Every ASSISTANT coach across an org's draft/active seasons — the admin oversight list.
 *  Enriched with team + name/email + their capability grants. Head coaches are excluded. */
export async function getOrgAssistantCoaches(orgId: string): Promise<OrgAssistantCoach[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .select(`
      id, team_id, program_year_id, user_id, capabilities,
      rep_teams!team_id ( name, group_id ),
      rep_program_years!program_year_id ( name, status )
    `)
    .eq('org_id', orgId)
    .eq('coach_role', 'assistant_coach');
  if (error) throw error;

  const rows = (data ?? []).filter((r: any) => {
    const s = r.rep_program_years?.status;
    return s === 'draft' || s === 'active';
  });
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r: any) => r.user_id as string))];
  const { data: memberRows } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, display_name')
    .eq('organization_id', orgId)
    .eq('status', 'active') // only name active members — an invited-but-unaccepted row shouldn't lend a name
    .in('user_id', userIds);
  const nameByUser = new Map((memberRows ?? []).map((m: any) => [m.user_id as string, (m.display_name as string | null) ?? null]));

  // Resolve email per unique user (bounded — a handful of assistants per org). Avoids listUsers()
  // pagination truncation on large platforms; email is display-only and best-effort.
  const emailByUser = new Map<string, string | null>();
  await Promise.all(userIds.map(async (uid) => {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
      emailByUser.set(uid, data.user?.email ?? null);
    } catch { emailByUser.set(uid, null); }
  }));

  return rows.map((r: any) => ({
    coachId: r.id as string,
    teamId: r.team_id as string,
    teamName: (r.rep_teams?.name as string | null) ?? '',
    teamGroupId: (r.rep_teams?.group_id as string | null) ?? null,
    programYearId: r.program_year_id as string,
    programYearName: (r.rep_program_years?.name as string | null) ?? '',
    userId: r.user_id as string,
    displayName: nameByUser.get(r.user_id) ?? null,
    email: emailByUser.get(r.user_id) ?? null,
    capabilities: (r.capabilities as AssistantCapabilityGrants | null) ?? null,
  }));
}

export interface CoachingAssignment {
  coachId: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  teamColor: string | null;
  teamSport: string;
  programYearId: string;
  programYearName: string;
  programYearStatus: RepProgramYearStatus;
  coachRole: 'head_coach' | 'assistant_coach';
  /** Effective capabilities on THIS team (head coach = full; assistant = defaults + grants). */
  capabilities: CoachCapabilities;
  overdueInstallments: number;
  upcomingEventsCount: number;
}

type CoachingAssignmentRow = {
  id: string;
  team_id: string;
  program_year_id: string;
  coach_role: string;
  capabilities?: AssistantCapabilityGrants | null;
  rep_teams?: { name?: string | null; slug?: string | null; color?: string | null; sport?: string | null } | null;
  rep_program_years?: { name?: string | null; status?: RepProgramYearStatus | null } | null;
};

async function getCoachingBadges(
  programYearIds: string[],
): Promise<Map<string, { overdueInstallments: number; upcomingEventsCount: number }>> {
  const result = new Map<string, { overdueInstallments: number; upcomingEventsCount: number }>();
  if (programYearIds.length === 0) return result;
  for (const id of programYearIds) result.set(id, { overdueInstallments: 0, upcomingEventsCount: 0 });

  const today      = new Date().toISOString().split('T')[0];
  const sevenDays  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Overdue allocation installments (org→team splits)
  const { data: splitRows } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select('id, program_year_id')
    .in('program_year_id', programYearIds);
  const splitIds = (splitRows ?? []).map((r: any) => r.id as string);
  const splitToYear = Object.fromEntries((splitRows ?? []).map((r: any) => [r.id, r.program_year_id]));

  if (splitIds.length > 0) {
    const { data: allocInst } = await supabaseAdmin
      .from('rep_allocation_installments')
      .select('split_id')
      .in('split_id', splitIds)
      .lt('due_date', today)
      .is('paid_at', null);
    for (const row of allocInst ?? []) {
      const yearId = splitToYear[(row as any).split_id];
      if (yearId && result.has(yearId)) result.get(yearId)!.overdueInstallments++;
    }
  }

  // Overdue player dues installments
  const { data: scheduleRows } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, program_year_id')
    .in('program_year_id', programYearIds);
  const scheduleIds = (scheduleRows ?? []).map((r: any) => r.id as string);
  const scheduleToYear = Object.fromEntries((scheduleRows ?? []).map((r: any) => [r.id, r.program_year_id]));

  if (scheduleIds.length > 0) {
    const { data: duesInst } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('schedule_id')
      .in('schedule_id', scheduleIds)
      .lt('due_date', today)
      .is('paid_at', null);
    for (const row of duesInst ?? []) {
      const yearId = scheduleToYear[(row as any).schedule_id];
      if (yearId && result.has(yearId)) result.get(yearId)!.overdueInstallments++;
    }
  }

  // Upcoming events in next 7 days
  const { data: events } = await supabaseAdmin
    .from('rep_team_events')
    .select('program_year_id')
    .in('program_year_id', programYearIds)
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', sevenDays);
  for (const row of events ?? []) {
    const yearId = (row as any).program_year_id;
    if (yearId && result.has(yearId)) result.get(yearId)!.upcomingEventsCount++;
  }

  return result;
}

export async function getCoachingAssignmentsForUser(
  orgId: string,
  userId: string,
): Promise<CoachingAssignment[]> {
  const { data: orgAccessRow, error: orgAccessError } = await supabaseAdmin
    .from('organizations')
    .select('account_kind, plan_id')
    .eq('id', orgId)
    .maybeSingle();

  if (orgAccessError) throw orgAccessError;
  const isTeamWorkspace =
    orgAccessRow?.account_kind === 'team_workspace' ||
    orgAccessRow?.plan_id === 'team';

  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .select(`
      id,
      team_id,
      program_year_id,
      coach_role,
      capabilities,
      rep_teams!team_id ( name, slug, color, sport ),
      rep_program_years!program_year_id ( name, status )
    `)
    .eq('org_id', orgId)
    .eq('user_id', userId);
  if (error) throw error;

  const rows = (data ?? []) as CoachingAssignmentRow[];
  const filtered = rows.filter(r => {
    const s = r.rep_program_years?.status;
    return s === 'draft' || s === 'active';
  });

  const entitledTeamIds = isTeamWorkspace
    ? await getActiveTeamEntitledRepTeamIds(orgId)
    : null;
  const accessible = entitledTeamIds
    ? filtered.filter(r => entitledTeamIds.has(r.team_id))
    : filtered;

  const programYearIds = accessible.map(r => r.program_year_id);
  const badges = await getCoachingBadges(programYearIds);

  return accessible.map(r => ({
    coachId: r.id,
    teamId: r.team_id,
    teamName: r.rep_teams?.name ?? '',
    teamSlug: r.rep_teams?.slug ?? '',
    teamColor: r.rep_teams?.color ?? null,
    teamSport: r.rep_teams?.sport ?? DEFAULT_SPORT,
    programYearId: r.program_year_id,
    programYearName: r.rep_program_years?.name ?? '',
    programYearStatus: r.rep_program_years?.status as RepProgramYearStatus,
    coachRole: r.coach_role as 'head_coach' | 'assistant_coach',
    capabilities: resolveCoachCapabilities(
      r.coach_role as 'head_coach' | 'assistant_coach',
      r.capabilities ?? null,
    ),
    overdueInstallments:  badges.get(r.program_year_id)?.overdueInstallments  ?? 0,
    upcomingEventsCount:  badges.get(r.program_year_id)?.upcomingEventsCount   ?? 0,
  }));
}

export async function getActiveRepProgramYear(teamId: string): Promise<RepProgramYear | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('team_id', teamId)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return mapRepProgramYear(data);
}

// Tryout Registrations

function mapRepTryoutRegistration(r: any): RepTryoutRegistration {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    playerFirstName: r.player_first_name,
    playerLastName: r.player_last_name,
    playerDateOfBirth: r.player_date_of_birth,
    playerNotes: r.player_notes,
    guardianFirstName: r.guardian_first_name,
    guardianLastName: r.guardian_last_name,
    guardianEmail: r.guardian_email,
    guardianPhone: r.guardian_phone,
    status: r.status,
    adminNotes: r.admin_notes,
    consentDataCollection: r.consent_data_collection ?? null,
    consentEmailComms: r.consent_email_comms ?? null,
    consentEligibility: r.consent_eligibility ?? null,
    consentAt: r.consent_at ?? null,
    consentIp: r.consent_ip ?? null,
    bibNumber: r.bib_number ?? null,
    isCheckedIn: r.is_checked_in ?? false,
    checkedInAt: r.checked_in_at ?? null,
    offerSentAt: r.offer_sent_at ?? null,
    offerExpiresAt: r.offer_expires_at ?? null,
    offerResponse: r.offer_response ?? null,
    offerRespondedAt: r.offer_responded_at ?? null,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  };
}

function mapRepTryout(r: any): RepTryout {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    isAnonymous: r.is_anonymous ?? true,
    scoresLockedAt: r.scores_locked_at ?? null,
    scoresLockedBy: r.scores_locked_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRepTryoutSession(r: any): RepTryoutSession {
  return {
    id: r.id,
    tryoutId: r.tryout_id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at ?? null,
    location: r.location ?? null,
    locationAddress: r.location_address ?? null,
    fieldNumber: r.field_number ?? null,
    label: r.label ?? null,
    status: r.status ?? 'scheduled',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTryoutRegistrations(programYearId: string): Promise<RepTryoutRegistration[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutRegistration);
}

export async function getRepTryoutRegistration(regId: string): Promise<RepTryoutRegistration | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .select('*')
    .eq('id', regId)
    .single();
  if (error) return null;
  return mapRepTryoutRegistration(data);
}

export async function createRepTryoutRegistration(fields: {
  programYearId: string;
  teamId: string;
  orgId: string;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth?: string | null;
  playerNotes?: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone?: string | null;
  // Consent capture (Phase 1.1). consentAt/consentIp are stamped server-side by the caller.
  consentDataCollection?: boolean | null;
  consentEmailComms?: boolean | null;
  consentEligibility?: boolean | null;
  consentAt?: string | null;
  consentIp?: string | null;
}): Promise<RepTryoutRegistration> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .insert({
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      player_first_name: fields.playerFirstName,
      player_last_name: fields.playerLastName,
      player_date_of_birth: fields.playerDateOfBirth ?? null,
      player_notes: fields.playerNotes ?? null,
      guardian_first_name: fields.guardianFirstName,
      guardian_last_name: fields.guardianLastName,
      guardian_email: fields.guardianEmail,
      guardian_phone: fields.guardianPhone ?? null,
      consent_data_collection: fields.consentDataCollection ?? null,
      consent_email_comms: fields.consentEmailComms ?? null,
      consent_eligibility: fields.consentEligibility ?? null,
      consent_at: fields.consentAt ?? null,
      consent_ip: fields.consentIp ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutRegistration(data);
}

export async function updateRepTryoutRegistrationStatus(
  regId: string,
  status: RepTryoutRegistrationStatus,
  adminNotes?: string | null,
): Promise<RepTryoutRegistration> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .update(patch)
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutRegistration(data);
}

/** Optional roster fields set at accept time (identity/guardian are carried from the registration). */
export interface TryoutAcceptRosterFields {
  playerNumber?: string | null;
  primaryPosition?: string | null;
  jerseySize?: string | null;
}

/** Optional dues schedule attached at accept time. Amounts are dollars; records what's owed (no charge). */
export interface TryoutAcceptDues {
  totalAmount: number;
  notes?: string | null;
  installments: Array<{ installmentNumber?: number; amount: number; dueDate: string }>;
}

/** Typed accept failures the routes translate to 404/409/400 (rather than a bare 500). */
export class TryoutAcceptError extends Error {
  code: 'not_found' | 'not_offered' | 'dues_invalid';
  constructor(code: 'not_found' | 'not_offered' | 'dues_invalid', message: string) {
    super(message);
    this.name = 'TryoutAcceptError';
    this.code = code;
  }
}

/**
 * Accept an OFFERED tryout registration onto the roster — atomically. Delegates the multi-table write
 * (roster insert + status='accepted' + optional dues schedule/installments) to the mig-169 RPC so a
 * mid-way failure rolls back cleanly instead of half-landing a player. Caller-agnostic: the admin
 * route, the coach route, and 2B.5's token accept all reuse it (auth is enforced by the caller).
 *
 * With no opts the behaviour matches the pre-2B.4 admin accept exactly (roster + status, no dues) —
 * but now transactional and guarded against a double-accept race.
 */
// ── Tryout offer response loop (Phase 2B.5) ─────────────────────────────────
// Errors the public token route + coach routes translate to 404/409/410.
export class TryoutOfferError extends Error {
  code: 'not_found' | 'not_offered' | 'expired' | 'already_responded';
  constructor(code: 'not_found' | 'not_offered' | 'expired' | 'already_responded', message: string) {
    super(message);
    this.name = 'TryoutOfferError';
    this.code = code;
  }
}

/** Default offer response window (D3: 7 days, adjustable per call). */
export const DEFAULT_OFFER_TTL_DAYS = 7;

/**
 * Mint a fresh no-login response token for an offered candidate and stamp the send + deadline.
 * Resets any prior response so a re-offer starts clean. Returns the RAW token (for the email URL only)
 * + the deadline. Caller is responsible for having set status='offered'.
 */
export async function extendTryoutOffer(
  regId: string,
  ttlDays: number = DEFAULT_OFFER_TTL_DAYS,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateOfferToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const { error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .update({
      offer_token_hash: hashOfferToken(token),
      offer_sent_at: now.toISOString(),
      offer_expires_at: expiresAt.toISOString(),
      offer_response: null,
      offer_responded_at: null,
      updated_at: now.toISOString(),
    })
    .eq('id', regId);
  if (error) throw error;
  return { token, expiresAt: expiresAt.toISOString() };
}

/** Clear all offer state — called on any transition AWAY from 'offered' so a stale link can't be used. */
export async function clearTryoutOffer(regId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .update({
      offer_token_hash: null,
      offer_sent_at: null,
      offer_expires_at: null,
      offer_response: null,
      offer_responded_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', regId);
  if (error) throw error;
}

/** Resolve a registration by its live offer token (hash lookup). Null if no match. */
export async function getRepTryoutRegistrationByOfferToken(
  token: string,
): Promise<RepTryoutRegistration | null> {
  // Tokens are base64url(32 bytes) = exactly 43 chars; reject anything else before hashing/DB (parity
  // with the evaluator token resolver).
  if (!token || token.length !== 43) return null;
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .select('*')
    .eq('offer_token_hash', hashOfferToken(token))
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTryoutRegistration(data) : null;
}

/**
 * Record the guardian's self-serve Accept/Decline via the token page. Single-use + deadline guarded.
 * Does NOT change `status` (D1: the coach still finalizes) — only writes offer_response/offer_responded_at.
 * Returns the updated registration so the caller can notify the coach.
 */
export async function recordTryoutOfferResponse(
  token: string,
  response: 'accepted' | 'declined',
): Promise<RepTryoutRegistration> {
  const reg = await getRepTryoutRegistrationByOfferToken(token);
  if (!reg) throw new TryoutOfferError('not_found', 'This response link is no longer valid.');
  if (reg.status !== 'offered') throw new TryoutOfferError('not_offered', 'This offer is no longer open.');
  if (reg.offerRespondedAt) throw new TryoutOfferError('already_responded', 'This offer has already been answered.');
  if (reg.offerExpiresAt && new Date(reg.offerExpiresAt).getTime() < Date.now()) {
    throw new TryoutOfferError('expired', 'This offer has expired. Please contact the coaching staff.');
  }

  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .update({
      offer_response: response,
      offer_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reg.id)
    .eq('offer_token_hash', hashOfferToken(token)) // re-assert under the same token (belt-and-suspenders)
    .is('offer_responded_at', null)                 // atomic single-use guard
    .select()
    .single();
  if (error) {
    // PGRST116 = zero rows matched → another request already answered (lost the single-use race).
    // Any other error is a real DB/infra failure: rethrow so withObservability captures it as a 500.
    if ((error as { code?: string }).code === 'PGRST116') {
      throw new TryoutOfferError('already_responded', 'This offer has already been answered.');
    }
    throw error;
  }
  return mapRepTryoutRegistration(data);
}

/** User IDs of coaches assigned to a rep team — the audience for tryout coach notifications. */
export async function getRepTeamCoachUserIds(teamId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('user_id')
    .eq('team_id', teamId);
  if (error) throw error;
  return (data ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
}

export async function acceptTryoutAndAddToRoster(
  regId: string,
  opts?: { roster?: TryoutAcceptRosterFields; dues?: TryoutAcceptDues | null },
): Promise<{ registration: RepTryoutRegistration; player: RepRosterPlayer }> {
  const pRoster = opts?.roster
    ? {
        playerNumber: opts.roster.playerNumber ?? null,
        primaryPosition: opts.roster.primaryPosition ?? null,
        jerseySize: opts.roster.jerseySize ?? null,
      }
    : null;

  const pDues = opts?.dues
    ? {
        totalAmount: opts.dues.totalAmount,
        notes: opts.dues.notes ?? null,
        installments: opts.dues.installments.map((i, idx) => ({
          installmentNumber: i.installmentNumber ?? idx + 1,
          amount: i.amount,
          dueDate: i.dueDate,
        })),
      }
    : null;

  const { data, error } = await supabaseAdmin.rpc('accept_tryout_and_create_dues', {
    p_reg_id: regId,
    p_roster: pRoster,
    p_dues: pDues,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('tryout_accept_reg_not_found')) throw new TryoutAcceptError('not_found', 'Tryout registration not found');
    if (msg.includes('tryout_accept_not_offered')) throw new TryoutAcceptError('not_offered', 'This applicant is no longer awaiting acceptance.');
    if (msg.includes('tryout_accept_dues_invalid')) throw new TryoutAcceptError('dues_invalid', 'The fee schedule is invalid — installments must sum to the total.');
    throw error;
  }

  const playerId = (data as { playerId?: string } | null)?.playerId;
  const [registration, player] = await Promise.all([
    getRepTryoutRegistration(regId),
    playerId ? getRepRosterPlayer(playerId) : Promise.resolve(null),
  ]);
  if (!registration || !player) throw new Error('Accept committed but reloading the record failed');
  return { registration, player };
}

/** Candidate day-of check-in / bib assignment (Phase 2A). */
export async function updateRepTryoutCheckin(
  regId: string,
  fields: { isCheckedIn?: boolean; bibNumber?: string | null },
): Promise<RepTryoutRegistration> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.isCheckedIn !== undefined) {
    patch.is_checked_in = fields.isCheckedIn;
    patch.checked_in_at = fields.isCheckedIn ? new Date().toISOString() : null;
  }
  if (fields.bibNumber !== undefined) patch.bib_number = fields.bibNumber;
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .update(patch)
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutRegistration(data);
}

// ── Tryout workspace + sessions (Phase 2A) ──────────────────────────────────

export async function getRepTryout(programYearId: string): Promise<RepTryout | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryouts')
    .select('*')
    .eq('program_year_id', programYearId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTryout(data) : null;
}

/** Lazily create the tryout workspace for a program year (1:1). Idempotent: returns the existing
 *  row if one already exists (handles the unique-constraint race). */
export async function getOrCreateRepTryout(fields: {
  programYearId: string;
  teamId: string;
  orgId: string;
}): Promise<RepTryout> {
  const existing = await getRepTryout(fields.programYearId);
  if (existing) return existing;
  const { data, error } = await supabaseAdmin
    .from('rep_tryouts')
    .insert({
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
    })
    .select()
    .single();
  if (error) {
    // Unique-violation race: another request created it first — return that row.
    const again = await getRepTryout(fields.programYearId);
    if (again) return again;
    throw error;
  }
  return mapRepTryout(data);
}

export async function updateRepTryout(
  tryoutId: string,
  fields: { isAnonymous?: boolean; scoresLockedAt?: string | null; scoresLockedBy?: string | null },
): Promise<RepTryout> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.isAnonymous !== undefined) patch.is_anonymous = fields.isAnonymous;
  if (fields.scoresLockedAt !== undefined) patch.scores_locked_at = fields.scoresLockedAt;
  if (fields.scoresLockedBy !== undefined) patch.scores_locked_by = fields.scoresLockedBy;
  const { data, error } = await supabaseAdmin
    .from('rep_tryouts')
    .update(patch)
    .eq('id', tryoutId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTryout(data);
}

export async function getRepTryoutSessions(tryoutId: string): Promise<RepTryoutSession[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .select('*')
    .eq('tryout_id', tryoutId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutSession);
}

/** Scheduled (non-cancelled) tryout sessions for a team — the calendar PROJECTION source the coach
 *  schedule view unions in (no rep_team_events row is ever created for a tryout). */
export async function getRepTryoutSessionsForTeam(teamId: string): Promise<RepTryoutSession[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'scheduled')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutSession);
}

export async function getRepTryoutSessionById(sessionId: string): Promise<RepTryoutSession | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTryoutSession(data) : null;
}

export async function createRepTryoutSession(fields: {
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  locationAddress?: string | null;
  fieldNumber?: string | null;
  label?: string | null;
}): Promise<RepTryoutSession> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .insert({
      tryout_id: fields.tryoutId,
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      starts_at: fields.startsAt,
      ends_at: fields.endsAt ?? null,
      location: fields.location ?? null,
      location_address: fields.locationAddress ?? null,
      field_number: fields.fieldNumber ?? null,
      label: fields.label ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutSession(data);
}

export async function updateRepTryoutSession(
  sessionId: string,
  fields: {
    startsAt?: string;
    endsAt?: string | null;
    location?: string | null;
    locationAddress?: string | null;
    fieldNumber?: string | null;
    label?: string | null;
    status?: 'scheduled' | 'cancelled';
  },
): Promise<RepTryoutSession> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.startsAt !== undefined) patch.starts_at = fields.startsAt;
  if (fields.endsAt !== undefined) patch.ends_at = fields.endsAt;
  if (fields.location !== undefined) patch.location = fields.location;
  if (fields.locationAddress !== undefined) patch.location_address = fields.locationAddress;
  if (fields.fieldNumber !== undefined) patch.field_number = fields.fieldNumber;
  if (fields.label !== undefined) patch.label = fields.label;
  if (fields.status !== undefined) patch.status = fields.status;
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutSession(data);
}

export async function deleteRepTryoutSession(sessionId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

const bibValue = (b: string | null): number => (b ? parseInt(b, 10) || 0 : 0);

/** Day-of check-in candidate list (Phase 2A): active candidates (not declined/withdrawn) for a
 *  program year, with sequential bib numbers auto-assigned to any that don't have one yet (stable
 *  once assigned), sorted by bib. */
export async function getRepTryoutCheckinList(programYearId: string): Promise<RepTryoutRegistration[]> {
  const all = await getRepTryoutRegistrations(programYearId);
  let active = all.filter(r => r.status !== 'declined' && r.status !== 'withdrawn');

  const hasBib = (r: RepTryoutRegistration) => r.bibNumber != null && r.bibNumber !== '';
  let next = active.reduce((m, r) => Math.max(m, bibValue(r.bibNumber)), 0) + 1;
  const missing = active.filter(r => !hasBib(r)).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  let conflict = false;
  for (const r of missing) {
    try {
      await updateRepTryoutCheckin(r.id, { bibNumber: String(next) });
      r.bibNumber = String(next);
      next++;
    } catch {
      // A concurrent load already took this bib (unique index, mig 166) — leave this candidate for
      // the next load rather than 500. Rare (one coach/one device is the norm).
      conflict = true;
    }
  }
  if (conflict) {
    active = (await getRepTryoutRegistrations(programYearId))
      .filter(r => r.status !== 'declined' && r.status !== 'withdrawn');
  }

  return active.sort((a, b) => bibValue(a.bibNumber) - bibValue(b.bibNumber));
}

/** Read-only candidate list (active, bib-sorted) — NO bib auto-assignment. Used by the no-account
 *  evaluator token boundary so a link-holder can never trigger a write. Bib assignment stays in the
 *  coach-authenticated check-in flow (`getRepTryoutCheckinList`). */
export async function getRepTryoutCheckinListReadOnly(programYearId: string): Promise<RepTryoutRegistration[]> {
  const all = await getRepTryoutRegistrations(programYearId);
  return all
    .filter(r => r.status !== 'declined' && r.status !== 'withdrawn')
    .sort((a, b) => bibValue(a.bibNumber) - bibValue(b.bibNumber));
}

function mapRepTryoutRubric(r: any): RepTryoutRubric {
  return {
    id: r.id,
    tryoutId: r.tryout_id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    name: r.name ?? null,
    scaleMax: r.scale_max ?? 5,
    categories: Array.isArray(r.categories) ? r.categories : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTryoutRubric(tryoutId: string): Promise<RepTryoutRubric | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_rubrics')
    .select('*')
    .eq('tryout_id', tryoutId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTryoutRubric(data) : null;
}

/** Create or update the tryout's single scorecard (1 per tryout — upsert on tryout_id). */
export async function upsertRepTryoutRubric(fields: {
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  name?: string | null;
  scaleMax: number;
  categories: RepTryoutRubricCategory[];
}): Promise<RepTryoutRubric> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_rubrics')
    .upsert({
      tryout_id: fields.tryoutId,
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      name: fields.name ?? null,
      scale_max: fields.scaleMax,
      categories: fields.categories,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tryout_id' })
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutRubric(data);
}

// Tryout Evaluator Scoring (Phase 2B.2) — no-account co-coach links + their scores.

function mapRepTryoutEvaluatorSession(r: any): RepTryoutEvaluatorSession {
  return {
    id: r.id,
    tryoutId: r.tryout_id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    evaluatorName: r.evaluator_name ?? null,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at ?? null,
    createdAt: r.created_at,
  };
}

/** Mint a no-account evaluator scoring link. Caller supplies the pre-hashed token + expiry. */
export async function createRepTryoutEvaluatorSession(fields: {
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  evaluatorName?: string | null;
  tokenHash: string;
  expiresAt: string;
}): Promise<RepTryoutEvaluatorSession> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_evaluator_sessions')
    .insert({
      tryout_id: fields.tryoutId,
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      evaluator_name: fields.evaluatorName ?? null,
      token_hash: fields.tokenHash,
      expires_at: fields.expiresAt,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutEvaluatorSession(data);
}

/** All evaluator links for a tryout (head-coach management view), newest first. */
export async function getRepTryoutEvaluatorSessions(tryoutId: string): Promise<RepTryoutEvaluatorSession[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_evaluator_sessions')
    .select('*')
    .eq('tryout_id', tryoutId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutEvaluatorSession);
}

/** Resolve an evaluator session by its token hash — the no-account scoring page's only key. */
export async function getRepTryoutEvaluatorSessionByTokenHash(tokenHash: string): Promise<RepTryoutEvaluatorSession | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_evaluator_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTryoutEvaluatorSession(data) : null;
}

/** Revoke a link — a non-null revoked_at blocks all further score writes. Caller verifies ownership. */
export async function revokeRepTryoutEvaluatorSession(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_tryout_evaluator_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

function mapRepTryoutScore(r: any): RepTryoutScore {
  return {
    id: r.id,
    evaluatorSessionId: r.evaluator_session_id,
    registrationId: r.registration_id,
    tryoutId: r.tryout_id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    categoryKey: r.category_key,
    score: r.score,
    note: r.note ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Record (or overwrite) one evaluator's score for one candidate on one rubric category. */
export async function upsertRepTryoutScore(fields: {
  evaluatorSessionId: string;
  registrationId: string;
  tryoutId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  categoryKey: string;
  score: number;
  note?: string | null;
}): Promise<RepTryoutScore> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_scores')
    .upsert({
      evaluator_session_id: fields.evaluatorSessionId,
      registration_id: fields.registrationId,
      tryout_id: fields.tryoutId,
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      category_key: fields.categoryKey,
      score: fields.score,
      note: fields.note ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'evaluator_session_id,registration_id,category_key' })
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutScore(data);
}

/** Every score for a tryout — the head-coach dashboard aggregates these. */
export async function getRepTryoutScores(tryoutId: string): Promise<RepTryoutScore[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_scores')
    .select('*')
    .eq('tryout_id', tryoutId);
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutScore);
}

/** Scores written by one evaluator session — rehydrates their scoring page. */
export async function getRepTryoutScoresForEvaluator(evaluatorSessionId: string): Promise<RepTryoutScore[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_scores')
    .select('*')
    .eq('evaluator_session_id', evaluatorSessionId);
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutScore);
}

// Roster Players

function mapRepRosterPlayer(r: any): RepRosterPlayer {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    tryoutRegistrationId: r.tryout_registration_id,
    playerFirstName: r.player_first_name,
    playerLastName: r.player_last_name,
    playerDateOfBirth: r.player_date_of_birth,
    playerNumber: r.player_number,
    primaryPosition: r.primary_position ?? null,
    secondaryPosition: r.secondary_position ?? null,
    status: r.status,
    source: r.source,
    guardianFirstName: r.guardian_first_name,
    guardianLastName: r.guardian_last_name,
    guardianEmail: r.guardian_email,
    guardianPhone: r.guardian_phone,
    notes: r.notes,
    adminNotes: r.admin_notes,
    medicalNotes: r.medical_notes ?? null,
    emergencyContactName: r.emergency_contact_name ?? null,
    emergencyContactPhone: r.emergency_contact_phone ?? null,
    bats: r.bats ?? null,
    throws: r.throws ?? null,
    jerseySize: r.jersey_size ?? null,
    lineupProfile: (r.lineup_profile ?? null) as LineupProfile | null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepRosterPlayers(programYearId: string): Promise<RepRosterPlayer[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('display_order', { ascending: true })
    .order('player_last_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRepRosterPlayer);
}

export async function getRepRosterPlayer(playerId: string): Promise<RepRosterPlayer | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('*')
    .eq('id', playerId)
    .single();
  if (error) return null;
  return mapRepRosterPlayer(data);
}

export async function createRepRosterPlayer(fields: {
  programYearId: string;
  teamId: string;
  orgId: string;
  source?: 'tryout' | 'admin_manual';
  tryoutRegistrationId?: string | null;
  playerFirstName: string;
  playerLastName: string | null;
  playerDateOfBirth?: string | null;
  playerNumber?: string | null;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  medicalNotes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bats?: string | null;
  throws?: string | null;
  jerseySize?: string | null;
  lineupProfile?: LineupProfile | null;
  sourceBasicPlayerId?: string | null;
}): Promise<RepRosterPlayer> {
  // Append new players at the end of the manual roster order (parity with the Basic roster — a coach
  // can drag-reorder afterward). mig 142 added rep_roster_players.display_order; sequential creates
  // (manual add, upgrade migration, season rollover) each append, preserving source order.
  const { data: top, error: topError } = await supabaseAdmin
    .from('rep_roster_players')
    .select('display_order')
    .eq('program_year_id', fields.programYearId)
    .eq('team_id', fields.teamId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topError) throw topError; // fail loud rather than silently appending at position 0
  const nextDisplayOrder = ((top?.display_order as number | null | undefined) ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .insert({
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      source: fields.source ?? 'admin_manual',
      tryout_registration_id: fields.tryoutRegistrationId ?? null,
      player_first_name: fields.playerFirstName,
      player_last_name: fields.playerLastName,
      player_date_of_birth: fields.playerDateOfBirth ?? null,
      player_number: fields.playerNumber ?? null,
      primary_position: fields.primaryPosition ?? null,
      secondary_position: fields.secondaryPosition ?? null,
      guardian_first_name: fields.guardianFirstName ?? null,
      guardian_last_name: fields.guardianLastName ?? null,
      guardian_email: fields.guardianEmail ?? null,
      guardian_phone: fields.guardianPhone ?? null,
      notes: fields.notes ?? null,
      admin_notes: fields.adminNotes ?? null,
      medical_notes: fields.medicalNotes ?? null,
      emergency_contact_name: fields.emergencyContactName ?? null,
      emergency_contact_phone: fields.emergencyContactPhone ?? null,
      bats: fields.bats ?? null,
      throws: fields.throws ?? null,
      jersey_size: fields.jerseySize ?? null,
      lineup_profile: fields.lineupProfile ?? null,
      display_order: nextDisplayOrder,
      source_basic_player_id: fields.sourceBasicPlayerId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepRosterPlayer(data);
}

export async function updateRepRosterPlayer(playerId: string, fields: {
  playerFirstName?: string;
  playerLastName?: string | null;
  playerDateOfBirth?: string | null;
  playerNumber?: string | null;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
  status?: RepRosterStatus;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  medicalNotes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bats?: string | null;
  throws?: string | null;
  jerseySize?: string | null;
  lineupProfile?: LineupProfile | null;
}): Promise<RepRosterPlayer> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.playerFirstName !== undefined) patch.player_first_name = fields.playerFirstName;
  if (fields.playerLastName !== undefined) patch.player_last_name = fields.playerLastName;
  if (fields.playerDateOfBirth !== undefined) patch.player_date_of_birth = fields.playerDateOfBirth;
  if (fields.playerNumber !== undefined) patch.player_number = fields.playerNumber;
  if (fields.primaryPosition !== undefined) patch.primary_position = fields.primaryPosition;
  if (fields.secondaryPosition !== undefined) patch.secondary_position = fields.secondaryPosition;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.guardianFirstName !== undefined) patch.guardian_first_name = fields.guardianFirstName;
  if (fields.guardianLastName !== undefined) patch.guardian_last_name = fields.guardianLastName;
  if (fields.guardianEmail !== undefined) patch.guardian_email = fields.guardianEmail;
  if (fields.guardianPhone !== undefined) patch.guardian_phone = fields.guardianPhone;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (fields.adminNotes !== undefined) patch.admin_notes = fields.adminNotes;
  if (fields.medicalNotes !== undefined) patch.medical_notes = fields.medicalNotes;
  if (fields.emergencyContactName !== undefined) patch.emergency_contact_name = fields.emergencyContactName;
  if (fields.emergencyContactPhone !== undefined) patch.emergency_contact_phone = fields.emergencyContactPhone;
  if (fields.bats !== undefined) patch.bats = fields.bats;
  if (fields.throws !== undefined) patch.throws = fields.throws;
  if (fields.jerseySize !== undefined) patch.jersey_size = fields.jerseySize;
  if (fields.lineupProfile !== undefined) patch.lineup_profile = fields.lineupProfile;
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .update(patch)
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
  return mapRepRosterPlayer(data);
}

export async function deleteRepRosterPlayer(playerId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_roster_players').delete().eq('id', playerId);
  if (error) throw error;
}

// ── Player profile roll-ups (Wave B) ──────────────────────────────────────────

export interface RepPlayerAttendanceSummary {
  total: number;      // sessions with attendance recorded for this player
  attending: number;
  absent: number;
  late: number;
  unknown: number;
  recent: { eventId: string; name: string; eventType: string; startsAt: string; status: string }[];
}

/** Season attendance for ONE player: status counts + the 10 most-recent sessions.
 *  Counts only non-cancelled events the coach actually marked. */
export async function getRepPlayerAttendanceSummary(
  playerId: string, programYearId: string,
): Promise<RepPlayerAttendanceSummary> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_event_attendance')
    .select('status, rep_team_events!inner(id, name, event_type, starts_at, status)')
    .eq('player_id', playerId)
    .eq('program_year_id', programYearId)
    .eq('rep_team_events.status', 'scheduled');
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const summary: RepPlayerAttendanceSummary = { total: 0, attending: 0, absent: 0, late: 0, unknown: 0, recent: [] };
  for (const r of rows) {
    summary.total++;
    if (r.status === 'attending') summary.attending++;
    else if (r.status === 'absent') summary.absent++;
    else if (r.status === 'late') summary.late++;
    else summary.unknown++;
  }
  summary.recent = rows
    .filter(r => r.rep_team_events)
    .sort((a, b) => String(b.rep_team_events.starts_at).localeCompare(String(a.rep_team_events.starts_at)))
    .slice(0, 10)
    .map(r => ({
      eventId: r.rep_team_events.id,
      name: r.rep_team_events.name,
      eventType: r.rep_team_events.event_type,
      startsAt: r.rep_team_events.starts_at,
      status: r.status,
    }));
  return summary;
}

export interface RepPlayerDuesSummary {
  hasSchedule: boolean;
  totalAssessed: number;
  totalPaid: number;
  totalCredits: number;
  balance: number;        // assessed − paid − credits (can be negative if over-credited)
  overdue: boolean;
  nextDueDate: string | null;
  installmentCount: number;
  paidInstallmentCount: number;
}

/** Dues summary for ONE player this season. Mirrors the team dues route's balance math. */
export async function getRepPlayerDuesSummary(
  playerId: string, programYearId: string,
): Promise<RepPlayerDuesSummary> {
  const schedule = await getRepPlayerDuesSchedule(playerId, programYearId);
  const installments = schedule ? await getRepPlayerDuesInstallments(schedule.id) : [];
  const { data: creditRows, error } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('amount')
    .eq('player_id', playerId)
    .eq('program_year_id', programYearId);
  if (error) throw error;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalAssessed = schedule?.totalAmount ?? 0;
  const totalPaid = installments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
  const totalCredits = (creditRows ?? []).reduce((s, c: any) => s + Number(c.amount), 0);
  const today = new Date().toISOString().slice(0, 10);
  return {
    hasSchedule: !!schedule,
    totalAssessed: round2(totalAssessed),
    totalPaid: round2(totalPaid),
    totalCredits: round2(totalCredits),
    balance: round2(totalAssessed - totalPaid - totalCredits),
    overdue: installments.some(i => !i.paidAt && i.dueDate < today),
    nextDueDate: installments
      .filter(i => !i.paidAt && i.dueDate >= today)
      .map(i => i.dueDate)
      .sort((a, b) => a.localeCompare(b))[0] ?? null,
    installmentCount: installments.length,
    paidInstallmentCount: installments.filter(i => i.paidAt).length,
  };
}

// Team Events

function mapRepTeamEvent(r: any): RepTeamEvent {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    eventType: r.event_type,
    name: r.name,
    description: r.description ?? null,
    startsAt: r.starts_at,
    endsAt: r.ends_at ?? null,
    location: r.location ?? null,
    locationAddress: r.location_address ?? null,
    arrivalTime: r.arrival_time ?? null,
    fieldNumber: r.field_number ?? null,
    uniform: r.uniform ?? null,
    resources: Array.isArray(r.resources) ? r.resources : [],
    opponent: r.opponent ?? null,
    homeAway: r.home_away ?? null,
    teamScore: r.team_score ?? null,
    opponentScore: r.opponent_score ?? null,
    result: r.result ?? null,
    parentEventId: r.parent_event_id ?? null,
    isRecurring: r.is_recurring ?? false,
    recurrenceRule: r.recurrence_rule ?? null,
    recurrenceParentId: r.recurrence_parent_id ?? null,
    status: r.status ?? 'scheduled',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamEvents(
  programYearId: string,
  opts?: { from?: string; to?: string; type?: RepEventType },
): Promise<RepTeamEvent[]> {
  let q = supabaseAdmin
    .from('rep_team_events')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('starts_at', { ascending: true });
  if (opts?.from) q = q.gte('starts_at', opts.from);
  if (opts?.to)   q = q.lte('starts_at', opts.to);
  if (opts?.type) q = q.eq('event_type', opts.type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRepTeamEvent);
}

export async function getRepTeamEventById(eventId: string): Promise<RepTeamEvent | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTeamEvent(data) : null;
}

export interface CreateRepTeamEventFields {
  /** Optional explicit row id — used to make a recurring series' first row the real anchor that
   *  its later occurrences reference (so "this & future / all" operations resolve correctly). */
  id?: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  eventType: RepEventType;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  locationAddress?: string | null;
  arrivalTime?: string | null;
  fieldNumber?: string | null;
  uniform?: string | null;
  resources?: RepEventResource[];
  opponent?: string | null;
  homeAway?: 'home' | 'away' | 'neutral' | null;
  parentEventId?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: Record<string, unknown> | null;
  recurrenceParentId?: string | null;
  status?: 'scheduled' | 'cancelled';
  sourceBasicEventId?: string | null;
}

export async function createRepTeamEvent(fields: CreateRepTeamEventFields): Promise<RepTeamEvent> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .insert({
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      event_type: fields.eventType,
      name: fields.name,
      description: fields.description ?? null,
      starts_at: fields.startsAt,
      ends_at: fields.endsAt ?? null,
      location: fields.location ?? null,
      location_address: fields.locationAddress ?? null,
      arrival_time: fields.arrivalTime ?? null,
      field_number: fields.fieldNumber ?? null,
      uniform: fields.uniform ?? null,
      resources: fields.resources ?? null,
      opponent: fields.opponent ?? null,
      home_away: fields.homeAway ?? null,
      parent_event_id: fields.parentEventId ?? null,
      is_recurring: fields.isRecurring ?? false,
      recurrence_rule: fields.recurrenceRule ?? null,
      recurrence_parent_id: fields.recurrenceParentId ?? null,
      status: fields.status ?? 'scheduled',
      source_basic_event_id: fields.sourceBasicEventId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamEvent(data);
}

export async function createRepTeamEvents(rows: CreateRepTeamEventFields[]): Promise<RepTeamEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .insert(rows.map(f => ({
      ...(f.id ? { id: f.id } : {}),
      program_year_id: f.programYearId,
      team_id: f.teamId,
      org_id: f.orgId,
      event_type: f.eventType,
      name: f.name,
      description: f.description ?? null,
      starts_at: f.startsAt,
      ends_at: f.endsAt ?? null,
      location: f.location ?? null,
      location_address: f.locationAddress ?? null,
      arrival_time: f.arrivalTime ?? null,
      field_number: f.fieldNumber ?? null,
      uniform: f.uniform ?? null,
      resources: f.resources ?? null,
      opponent: f.opponent ?? null,
      home_away: f.homeAway ?? null,
      parent_event_id: f.parentEventId ?? null,
      is_recurring: f.isRecurring ?? false,
      recurrence_rule: f.recurrenceRule ?? null,
      recurrence_parent_id: f.recurrenceParentId ?? null,
      status: f.status ?? 'scheduled',
      source_basic_event_id: f.sourceBasicEventId ?? null,
    })))
    .select();
  if (error) throw error;
  return (data ?? []).map(mapRepTeamEvent);
}

export async function updateRepTeamEvent(eventId: string, fields: {
  name?: string;
  description?: string | null;
  eventType?: RepEventType;
  startsAt?: string;
  endsAt?: string | null;
  location?: string | null;
  locationAddress?: string | null;
  arrivalTime?: string | null;
  fieldNumber?: string | null;
  uniform?: string | null;
  resources?: RepEventResource[];
  opponent?: string | null;
  homeAway?: 'home' | 'away' | 'neutral' | null;
  teamScore?: number | null;
  opponentScore?: number | null;
  result?: 'win' | 'loss' | 'tie' | null;
  status?: 'scheduled' | 'cancelled';
}): Promise<RepTeamEvent> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined)        patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.eventType !== undefined)   patch.event_type = fields.eventType;
  if (fields.startsAt !== undefined)    patch.starts_at = fields.startsAt;
  if (fields.endsAt !== undefined)      patch.ends_at = fields.endsAt;
  if (fields.location !== undefined)    patch.location = fields.location;
  if (fields.locationAddress !== undefined) patch.location_address = fields.locationAddress;
  if (fields.arrivalTime !== undefined) patch.arrival_time = fields.arrivalTime;
  if (fields.fieldNumber !== undefined) patch.field_number = fields.fieldNumber;
  if (fields.uniform !== undefined)     patch.uniform = fields.uniform;
  if (fields.resources !== undefined)   patch.resources = fields.resources;
  if (fields.opponent !== undefined)    patch.opponent = fields.opponent;
  if (fields.homeAway !== undefined)    patch.home_away = fields.homeAway;
  if (fields.teamScore !== undefined)     patch.team_score = fields.teamScore;
  if (fields.opponentScore !== undefined) patch.opponent_score = fields.opponentScore;
  if (fields.result !== undefined)      patch.result = fields.result;
  if (fields.status !== undefined)      patch.status = fields.status;
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamEvent(data);
}

// Bulk-edit a recurring series. scope 'all' = every occurrence; 'remaining' = this one + later
// (starts_at >= fromStartsAt). Non-temporal fields apply directly; a new start/end clock time is
// applied to each occurrence while PRESERVING that occurrence's own date (the series keeps its
// per-week dates, only the time-of-day shifts). Occurrence dates are never bulk-changed. Resolves
// occurrences as {anchor row id} ∪ {rows whose recurrence_parent_id = anchor} so a corrected series
// is fully covered. Returns the number of occurrences updated.
export async function updateRepTeamEventSeries(
  anchorId: string,
  scope: 'all' | 'remaining',
  fromStartsAt: string | null,
  fields: {
    name?: string;
    description?: string | null;
    location?: string | null;
    locationAddress?: string | null;
    fieldNumber?: string | null;
    uniform?: string | null;
    resources?: RepEventResource[];
    opponent?: string | null;
    homeAway?: 'home' | 'away' | 'neutral' | null;
    arrivalTime?: string | null;
    startTime?: string | null; // 'HH:mm' — applied to each occurrence's own date
    endTime?: string | null;   // 'HH:mm' — applied only when provided (empty leaves ends untouched)
  },
): Promise<number> {
  let q = supabaseAdmin
    .from('rep_team_events')
    .select('id, starts_at')
    .or(`id.eq.${anchorId},recurrence_parent_id.eq.${anchorId}`);
  if (scope === 'remaining' && fromStartsAt) q = q.gte('starts_at', fromStartsAt);
  const { data: rows, error } = await q;
  if (error) throw error;

  const base: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined)            base.name = fields.name;
  if (fields.description !== undefined)     base.description = fields.description;
  if (fields.location !== undefined)        base.location = fields.location;
  if (fields.locationAddress !== undefined) base.location_address = fields.locationAddress;
  if (fields.fieldNumber !== undefined)     base.field_number = fields.fieldNumber;
  if (fields.uniform !== undefined)         base.uniform = fields.uniform;
  if (fields.resources !== undefined)       base.resources = fields.resources;
  if (fields.opponent !== undefined)        base.opponent = fields.opponent;
  if (fields.homeAway !== undefined)        base.home_away = fields.homeAway;
  if (fields.arrivalTime !== undefined)     base.arrival_time = fields.arrivalTime;

  for (const row of rows ?? []) {
    const patch: Record<string, unknown> = { ...base };
    const date = (row.starts_at as string).slice(0, 10);
    if (fields.startTime) patch.starts_at = `${date}T${fields.startTime}:00`;
    if (fields.endTime)   patch.ends_at = `${date}T${fields.endTime}:00`;
    const { error: uErr } = await supabaseAdmin.from('rep_team_events').update(patch).eq('id', row.id);
    if (uErr) throw uErr;
  }
  return (rows ?? []).length;
}

export async function updateRepTeamEventsByRecurrenceParent(
  recurrenceParentId: string,
  fromStartsAt: string,
  fields: { location?: string | null; endsAt?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.location !== undefined) patch.location = fields.location;
  if (fields.endsAt !== undefined)   patch.ends_at = fields.endsAt;
  const { error } = await supabaseAdmin
    .from('rep_team_events')
    .update(patch)
    .eq('recurrence_parent_id', recurrenceParentId)
    .gte('starts_at', fromStartsAt);
  if (error) throw error;
}

export async function deleteRepTeamEvent(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_team_events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function deleteRepTeamEventsByRecurrenceParent(
  recurrenceParentId: string,
  fromStartsAt?: string,
): Promise<void> {
  let q = supabaseAdmin
    .from('rep_team_events')
    .delete()
    .eq('recurrence_parent_id', recurrenceParentId);
  if (fromStartsAt) q = q.gte('starts_at', fromStartsAt);
  const { error } = await q;
  if (error) throw error;
}

// Team Event Attendance

function mapRepTeamEventAttendance(r: any): RepTeamEventAttendance {
  return {
    id: r.id,
    eventId: r.event_id,
    playerId: r.player_id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    status: r.status,
    note: r.note ?? null,
    updatedBy: r.updated_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamEventAttendance(eventId: string): Promise<RepTeamEventAttendance[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_event_attendance')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data ?? []).map(mapRepTeamEventAttendance);
}

export async function upsertRepTeamEventAttendance(rows: {
  eventId: string;
  playerId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  status: RepAttendanceStatus;
  note?: string | null;
  updatedBy?: string | null;
}[]): Promise<RepTeamEventAttendance[]> {
  if (rows.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('rep_team_event_attendance')
    .upsert(
      rows.map(row => ({
        event_id: row.eventId,
        player_id: row.playerId,
        program_year_id: row.programYearId,
        team_id: row.teamId,
        org_id: row.orgId,
        status: row.status,
        note: row.note?.trim() || null,
        updated_by: row.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'event_id,player_id' },
    )
    .select();
  if (error) throw error;
  return (data ?? []).map(mapRepTeamEventAttendance);
}

// Team Lineups

function mapRepTeamLineup(r: any): RepTeamLineup {
  return {
    id: r.id,
    eventId: r.event_id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    lineupMode: r.lineup_mode,
    inningCount: r.inning_count,
    notes: r.notes ?? null,
    rulesOverride: (r.rules_override ?? null) as LineupRulesOverride | null,
    updatedBy: r.updated_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRepTeamLineupEntry(r: any): RepTeamLineupEntry {
  return {
    id: r.id,
    lineupId: r.lineup_id,
    playerId: r.player_id,
    battingOrder: r.batting_order ?? null,
    starter: r.starter ?? true,
    inningPositions: (r.inning_positions ?? {}) as Record<string, string>,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamLineupForEvent(eventId: string): Promise<RepTeamLineup | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_lineups')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTeamLineup(data) : null;
}

export async function getRepTeamLineupEntries(lineupId: string): Promise<RepTeamLineupEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_lineup_entries')
    .select('*')
    .eq('lineup_id', lineupId)
    .order('batting_order', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(mapRepTeamLineupEntry);
}

export async function upsertRepTeamLineup(fields: {
  eventId: string;
  programYearId: string;
  teamId: string;
  orgId: string;
  lineupMode: RepLineupMode;
  inningCount: number;
  notes?: string | null;
  rulesOverride?: LineupRulesOverride | null;
  updatedBy?: string | null;
}): Promise<RepTeamLineup> {
  const payload: Record<string, unknown> = {
    event_id: fields.eventId,
    program_year_id: fields.programYearId,
    team_id: fields.teamId,
    org_id: fields.orgId,
    lineup_mode: fields.lineupMode,
    inning_count: fields.inningCount,
    notes: fields.notes?.trim() || null,
    updated_by: fields.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };
  // Only touch rules_override when the caller provides it, so a plain grid save preserves the
  // per-game cap override rather than clearing it (upsert SETs only the columns in the payload).
  if (fields.rulesOverride !== undefined) payload.rules_override = fields.rulesOverride;
  const { data, error } = await supabaseAdmin
    .from('rep_team_lineups')
    .upsert(payload, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamLineup(data);
}

export async function replaceRepTeamLineupEntries(
  lineupId: string,
  entries: {
    playerId: string;
    battingOrder?: number | null;
    starter?: boolean;
    inningPositions?: Record<string, string>;
    notes?: string | null;
  }[],
): Promise<RepTeamLineupEntry[]> {
  const { error: deleteError } = await supabaseAdmin
    .from('rep_team_lineup_entries')
    .delete()
    .eq('lineup_id', lineupId);
  if (deleteError) throw deleteError;

  if (entries.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('rep_team_lineup_entries')
    .insert(entries.map(entry => ({
      lineup_id: lineupId,
      player_id: entry.playerId,
      batting_order: entry.battingOrder ?? null,
      starter: entry.starter ?? true,
      inning_positions: entry.inningPositions ?? {},
      notes: entry.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })))
    .select();
  if (error) throw error;
  return (data ?? []).map(mapRepTeamLineupEntry);
}

// ── Rep team lineup TEMPLATES (mig 159) ───────────────────────────────────────
// Named, reusable "base start" lineups (Phase 4). Single table; `entries` is a jsonb
// snapshot keyed by player_id (remapped to the current roster on load — see Finding #29).

/** Coerce the stored/sent jsonb into clean template entries (defensive on read AND write). */
function normalizeTemplateEntries(raw: unknown): RepTeamLineupTemplateEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RepTeamLineupTemplateEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const playerId = typeof o.playerId === 'string' ? o.playerId : '';
    if (!playerId) continue;
    const battingOrder = typeof o.battingOrder === 'number' && Number.isFinite(o.battingOrder)
      ? o.battingOrder : null;
    const starter = o.starter !== false;
    const ipRaw = o.inningPositions && typeof o.inningPositions === 'object' && !Array.isArray(o.inningPositions)
      ? o.inningPositions as Record<string, unknown> : {};
    const inningPositions: Record<string, string> = {};
    for (const [k, v] of Object.entries(ipRaw)) if (typeof v === 'string' && v) inningPositions[k] = v;
    out.push({ playerId, battingOrder, starter, inningPositions });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRepTeamLineupTemplate(r: any): RepTeamLineupTemplate {
  return {
    id: r.id,
    orgId: r.org_id,
    teamId: r.team_id,
    programYearId: r.program_year_id,
    name: r.name,
    lineupMode: r.lineup_mode,
    inningCount: r.inning_count,
    entries: normalizeTemplateEntries(r.entries),
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamLineupTemplates(
  teamId: string,
  programYearId: string,
): Promise<RepTeamLineupTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_lineup_templates')
    .select('*')
    .eq('team_id', teamId)
    .eq('program_year_id', programYearId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRepTeamLineupTemplate);
}

export async function createRepTeamLineupTemplate(fields: {
  orgId: string;
  teamId: string;
  programYearId: string;
  name: string;
  lineupMode: RepLineupMode;
  inningCount: number;
  entries: RepTeamLineupTemplateEntry[];
  createdBy?: string | null;
}): Promise<RepTeamLineupTemplate> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_lineup_templates')
    .insert({
      org_id: fields.orgId,
      team_id: fields.teamId,
      program_year_id: fields.programYearId,
      name: fields.name.trim(),
      lineup_mode: fields.lineupMode,
      inning_count: fields.inningCount,
      entries: normalizeTemplateEntries(fields.entries),
      created_by: fields.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamLineupTemplate(data);
}

/** Scoped delete (team_id guards against cross-team deletes even if RLS is bypassed). */
export async function deleteRepTeamLineupTemplate(id: string, teamId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_lineup_templates')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId);
  if (error) throw error;
}

// Document Templates

function mapRepDocumentTemplate(r: any): RepDocumentTemplate {
  return {
    id: r.id,
    orgId: r.org_id,
    teamId: r.team_id,
    name: r.name,
    documentType: r.document_type,
    storagePath: r.storage_path,
    fileName: r.file_name,
    fileSize: r.file_size,
    isActive: r.is_active,
    publishedBy: r.published_by,
    createdAt: r.created_at,
  };
}

export async function getRepDocumentTemplateById(id: string): Promise<RepDocumentTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_document_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return mapRepDocumentTemplate(data);
}

// When teamId is provided: returns org-wide (team_id IS NULL) + team-specific templates.
// When omitted: returns all templates for the org (admin view).
export async function getRepDocumentTemplates(
  orgId: string,
  teamId?: string | null,
): Promise<RepDocumentTemplate[]> {
  let query = supabaseAdmin
    .from('rep_document_templates')
    .select('*')
    .eq('org_id', orgId);
  if (teamId !== undefined && teamId !== null) {
    query = query.or(`team_id.is.null,team_id.eq.${teamId}`);
  }
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data ?? []).map(mapRepDocumentTemplate);
}

export async function createRepDocumentTemplate(fields: {
  orgId: string;
  teamId?: string | null;
  name: string;
  documentType: RepDocumentType;
  storagePath: string;
  fileName: string;
  fileSize: number;
  publishedBy?: string | null;
}): Promise<RepDocumentTemplate> {
  const { data, error } = await supabaseAdmin
    .from('rep_document_templates')
    .insert({
      org_id: fields.orgId,
      team_id: fields.teamId ?? null,
      name: fields.name,
      document_type: fields.documentType,
      storage_path: fields.storagePath,
      file_name: fields.fileName,
      file_size: fields.fileSize,
      published_by: fields.publishedBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepDocumentTemplate(data);
}

export async function updateRepDocumentTemplate(
  templateId: string,
  fields: { isActive?: boolean },
): Promise<RepDocumentTemplate> {
  const patch: Record<string, unknown> = {};
  if (fields.isActive !== undefined) patch.is_active = fields.isActive;
  const { data, error } = await supabaseAdmin
    .from('rep_document_templates')
    .update(patch)
    .eq('id', templateId)
    .select()
    .single();
  if (error) throw error;
  return mapRepDocumentTemplate(data);
}

export async function deleteRepDocumentTemplate(templateId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_document_templates').delete().eq('id', templateId);
  if (error) throw error;
}

// Player Documents

function mapRepPlayerDocument(r: any): RepPlayerDocument {
  return {
    id: r.id,
    playerId: r.player_id,
    teamId: r.team_id,
    orgId: r.org_id,
    documentType: r.document_type,
    storagePath: r.storage_path,
    fileName: r.file_name,
    fileSize: r.file_size,
    templateId: r.template_id,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

export async function getRepPlayerDocumentById(id: string): Promise<RepPlayerDocument | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return mapRepPlayerDocument(data);
}

export async function getRepPlayerDocuments(playerId: string): Promise<RepPlayerDocument[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_documents')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDocument);
}

export async function createRepPlayerDocument(fields: {
  playerId: string;
  teamId: string;
  orgId: string;
  documentType: RepDocumentType;
  storagePath: string;
  fileName: string;
  fileSize: number;
  templateId?: string | null;
  uploadedBy?: string | null;
}): Promise<RepPlayerDocument> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_documents')
    .insert({
      player_id: fields.playerId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      document_type: fields.documentType,
      storage_path: fields.storagePath,
      file_name: fields.fileName,
      file_size: fields.fileSize,
      template_id: fields.templateId ?? null,
      uploaded_by: fields.uploadedBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDocument(data);
}

export async function deleteRepPlayerDocument(docId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_player_documents').delete().eq('id', docId);
  if (error) throw error;
}

// Cost Allocations

function mapRepCostAllocation(r: any): RepCostAllocation {
  return {
    id: r.id,
    orgId: r.org_id,
    sourceEntryId: r.source_entry_id ?? null,
    description: r.description,
    totalAmount: Number(r.total_amount),
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
  };
}

function mapRepAllocationSplit(r: any): RepAllocationSplit {
  return {
    id: r.id,
    allocationId: r.allocation_id,
    teamId: r.team_id,
    programYearId: r.program_year_id,
    orgId: r.org_id,
    amount: Number(r.amount),
    splitMethod: r.split_method,
    splitValue: Number(r.split_value),
    paymentSchedule: r.payment_schedule,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

function mapRepAllocationInstallment(r: any): RepAllocationInstallment {
  return {
    id: r.id,
    splitId: r.split_id,
    installmentNumber: r.installment_number,
    amount: Number(r.amount),
    dueDate: r.due_date,
    paidAt: r.paid_at ?? null,
    paidBy: r.paid_by ?? null,
    accountingEntryId: r.accounting_entry_id ?? null,
    reminderSentAt: r.reminder_sent_at ?? null,
    createdAt: r.created_at,
  };
}

export async function getRepCostAllocations(orgId: string): Promise<RepCostAllocation[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepCostAllocation);
}

export async function getRepCostAllocationDetail(
  allocationId: string,
  orgId: string,
): Promise<{
  allocation: RepCostAllocation;
  splits: Array<RepAllocationSplit & { installments: RepAllocationInstallment[] }>;
} | null> {
  const { data: alloc, error: ae } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('*')
    .eq('id', allocationId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (ae) throw ae;
  if (!alloc) return null;

  const { data: splits, error: se } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select('*')
    .eq('allocation_id', allocationId)
    .order('created_at');
  if (se) throw se;

  const splitIds = (splits ?? []).map((s: any) => s.id);
  let installments: any[] = [];
  if (splitIds.length > 0) {
    const { data: inst, error: ie } = await supabaseAdmin
      .from('rep_allocation_installments')
      .select('*')
      .in('split_id', splitIds)
      .order('installment_number');
    if (ie) throw ie;
    installments = inst ?? [];
  }

  const mappedSplits = (splits ?? []).map((s: any) => ({
    ...mapRepAllocationSplit(s),
    installments: installments
      .filter((i: any) => i.split_id === s.id)
      .map(mapRepAllocationInstallment),
  }));

  return { allocation: mapRepCostAllocation(alloc), splits: mappedSplits };
}

export async function createRepCostAllocationWithSplits(fields: {
  orgId: string;
  description: string;
  totalAmount: number;
  sourceEntryId?: string | null;
  createdBy: string;
  splits: Array<{
    teamId: string;
    programYearId: string;
    amount: number;
    splitMethod: 'percentage' | 'sessions' | 'fixed';
    splitValue: number;
    paymentSchedule: 'standard' | 'custom';
    notes?: string | null;
    installments: Array<{ installmentNumber: number; amount: number; dueDate: string }>;
  }>;
}): Promise<{
  allocation: RepCostAllocation;
  splits: Array<RepAllocationSplit & { installments: RepAllocationInstallment[] }>;
}> {
  const { data: alloc, error: ae } = await supabaseAdmin
    .from('rep_cost_allocations')
    .insert({
      org_id: fields.orgId,
      description: fields.description,
      total_amount: fields.totalAmount,
      source_entry_id: fields.sourceEntryId ?? null,
      created_by: fields.createdBy,
    })
    .select()
    .single();
  if (ae) throw ae;

  const resultSplits: Array<RepAllocationSplit & { installments: RepAllocationInstallment[] }> = [];

  for (const split of fields.splits) {
    const { data: splitRow, error: se } = await supabaseAdmin
      .from('rep_allocation_splits')
      .insert({
        allocation_id: alloc.id,
        team_id: split.teamId,
        program_year_id: split.programYearId,
        org_id: fields.orgId,
        amount: split.amount,
        split_method: split.splitMethod,
        split_value: split.splitValue,
        payment_schedule: split.paymentSchedule,
        notes: split.notes ?? null,
      })
      .select()
      .single();
    if (se) throw se;

    const instRows: RepAllocationInstallment[] = [];
    for (const inst of split.installments) {
      const { data: instRow, error: ie } = await supabaseAdmin
        .from('rep_allocation_installments')
        .insert({
          split_id: splitRow.id,
          installment_number: inst.installmentNumber,
          amount: inst.amount,
          due_date: inst.dueDate,
          org_id: fields.orgId,
          team_id: split.teamId,
        })
        .select()
        .single();
      if (ie) throw ie;
      instRows.push(mapRepAllocationInstallment(instRow));
    }

    resultSplits.push({ ...mapRepAllocationSplit(splitRow), installments: instRows });
  }

  return { allocation: mapRepCostAllocation(alloc), splits: resultSplits };
}

export async function updateRepCostAllocationDescription(
  allocationId: string,
  orgId: string,
  description: string,
): Promise<RepCostAllocation> {
  const { data, error } = await supabaseAdmin
    .from('rep_cost_allocations')
    .update({ description })
    .eq('id', allocationId)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) throw error;
  return mapRepCostAllocation(data);
}

export async function markRepAllocationInstallmentPaid(
  installmentId: string,
  paidBy: string,
  accountingEntryId: string | null,
): Promise<RepAllocationInstallment> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .update({
      paid_at: new Date().toISOString(),
      paid_by: paidBy,
      accounting_entry_id: accountingEntryId,
    })
    .eq('id', installmentId)
    .select()
    .single();
  if (error) throw error;
  return mapRepAllocationInstallment(data);
}

export async function getRepAllocationInstallment(
  installmentId: string,
): Promise<RepAllocationInstallment | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .select('*')
    .eq('id', installmentId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepAllocationInstallment(data) : null;
}

export async function getRepAllocationSplit(
  splitId: string,
): Promise<RepAllocationSplit | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select('*')
    .eq('id', splitId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepAllocationSplit(data) : null;
}

// Player Dues Schedules

function mapRepPlayerDuesSchedule(r: any): RepPlayerDuesSchedule {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    playerId: r.player_id,
    teamId: r.team_id,
    orgId: r.org_id,
    totalAmount: Number(r.total_amount),
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepPlayerDuesSchedules(programYearId: string): Promise<RepPlayerDuesSchedule[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDuesSchedule);
}

export async function getRepPlayerDuesSchedule(
  playerId: string,
  programYearId: string,
): Promise<RepPlayerDuesSchedule | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('*')
    .eq('player_id', playerId)
    .eq('program_year_id', programYearId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepPlayerDuesSchedule(data) : null;
}

export async function createRepPlayerDuesSchedule(fields: {
  programYearId: string;
  playerId: string;
  teamId: string;
  orgId: string;
  totalAmount: number;
  notes?: string | null;
}): Promise<RepPlayerDuesSchedule> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .insert({
      program_year_id: fields.programYearId,
      player_id: fields.playerId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      total_amount: fields.totalAmount,
      notes: fields.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesSchedule(data);
}

export async function updateRepPlayerDuesSchedule(scheduleId: string, fields: {
  totalAmount?: number;
  notes?: string | null;
}): Promise<RepPlayerDuesSchedule> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.totalAmount !== undefined) patch.total_amount = fields.totalAmount;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .update(patch)
    .eq('id', scheduleId)
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesSchedule(data);
}

// Player Dues Installments

function mapRepPlayerDuesInstallment(r: any): RepPlayerDuesInstallment {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    playerId: r.player_id,
    installmentNumber: r.installment_number,
    dueDate: r.due_date,
    amount: Number(r.amount),
    paidAt: r.paid_at ?? null,
    reminderSentAt: r.reminder_sent_at ?? null,
    reminder30SentAt: r.reminder_30_sent_at ?? null,
    reminder7SentAt: r.reminder_7_sent_at ?? null,
    accountingEntryId: r.accounting_entry_id ?? null,
    createdAt: r.created_at,
  };
}

export async function getRepPlayerDuesInstallments(scheduleId: string): Promise<RepPlayerDuesInstallment[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('installment_number');
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDuesInstallment);
}

export async function markRepPlayerDuesInstallmentPaid(
  installmentId: string,
  accountingEntryId: string | null,
): Promise<RepPlayerDuesInstallment> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .update({ paid_at: new Date().toISOString(), accounting_entry_id: accountingEntryId })
    .eq('id', installmentId)
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesInstallment(data);
}

// Team Expenses

function mapRepTeamExpense(r: any): RepTeamExpense {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    expenseType: r.expense_type,
    description: r.description,
    category: r.category ?? null,
    amount: Number(r.amount),
    expensePaidAt: r.expense_paid_at ?? null,
    depositAmount: r.deposit_amount != null ? Number(r.deposit_amount) : null,
    depositDueDate: r.deposit_due_date ?? null,
    depositPaidAt: r.deposit_paid_at ?? null,
    balanceAmount: r.balance_amount != null ? Number(r.balance_amount) : null,
    balanceDueDate: r.balance_due_date ?? null,
    balancePaidAt: r.balance_paid_at ?? null,
    eventId: r.event_id ?? null,
    notes: r.notes ?? null,
    paymentMethod: r.payment_method ?? null,
    payeeId: r.payee_id ?? null,
    payeePayer: r.payee_payer ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamExpenses(programYearId: string): Promise<RepTeamExpense[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepTeamExpense);
}

export async function getRepTeamExpense(expenseId: string): Promise<RepTeamExpense | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('*')
    .eq('id', expenseId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepTeamExpense(data) : null;
}

export async function createRepTeamExpense(fields: {
  programYearId: string;
  teamId: string;
  orgId: string;
  expenseType: 'expense' | 'tournament_payable';
  description: string;
  category?: string | null;
  amount: number;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  balanceAmount?: number | null;
  balanceDueDate?: string | null;
  eventId?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  payeeId?: string | null;
  payeePayer?: string | null;
  createdBy?: string | null;
}): Promise<RepTeamExpense> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .insert({
      program_year_id:  fields.programYearId,
      team_id:          fields.teamId,
      org_id:           fields.orgId,
      expense_type:     fields.expenseType,
      description:      fields.description,
      category:         fields.category ?? null,
      amount:           fields.amount,
      deposit_amount:   fields.depositAmount ?? null,
      deposit_due_date: fields.depositDueDate ?? null,
      balance_amount:   fields.balanceAmount ?? null,
      balance_due_date: fields.balanceDueDate ?? null,
      event_id:         fields.eventId ?? null,
      notes:            fields.notes ?? null,
      payment_method:   fields.paymentMethod ?? null,
      payee_id:         fields.payeeId ?? null,
      payee_payer:      fields.payeePayer ?? null,
      created_by:       fields.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamExpense(data);
}

export async function updateRepTeamExpense(expenseId: string, fields: {
  description?: string;
  category?: string | null;
  notes?: string | null;
  expensePaidAt?: string | null;
  depositPaidAt?: string | null;
  balancePaidAt?: string | null;
}): Promise<RepTeamExpense> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.category !== undefined) patch.category = fields.category;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (fields.expensePaidAt !== undefined) patch.expense_paid_at = fields.expensePaidAt;
  if (fields.depositPaidAt !== undefined) patch.deposit_paid_at = fields.depositPaidAt;
  if (fields.balancePaidAt !== undefined) patch.balance_paid_at = fields.balancePaidAt;
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .update(patch)
    .eq('id', expenseId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamExpense(data);
}

export async function deleteRepTeamExpense(expenseId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_team_expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

// ── Org Payees ────────────────────────────────────────────────────────────────

function mapOrgPayee(r: any): OrgPayee {
  return {
    id:        r.id,
    orgId:     r.org_id,
    teamId:    r.team_id ?? null,
    name:      r.name,
    notes:     r.notes ?? null,
    isActive:  r.is_active,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
  };
}

export async function searchOrgPayees(orgId: string, q: string, teamId?: string | null): Promise<OrgPayee[]> {
  // Returns org-wide payees + (if teamId provided) that team's scoped payees
  let query = supabaseAdmin
    .from('org_payees')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('team_id', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
    .limit(30);

  if (teamId) {
    query = query.or(`team_id.is.null,team_id.eq.${teamId}`);
  } else {
    query = query.is('team_id', null);
  }

  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapOrgPayee);
}

export async function createOrgPayee(fields: {
  orgId: string;
  name: string;
  teamId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<OrgPayee> {
  const { data, error } = await supabaseAdmin
    .from('org_payees')
    .insert({
      org_id:     fields.orgId,
      team_id:    fields.teamId ?? null,
      name:       fields.name.trim(),
      notes:      fields.notes ?? null,
      created_by: fields.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapOrgPayee(data);
}

// ── Rep Dues: bulk replace installments ──────────────────────────────────────

export async function replaceRepDuesInstallments(
  scheduleId: string,
  playerId: string,
  installments: Array<{ installmentNumber: number; amount: number; dueDate: string }>,
  orgId: string,
  teamId: string,
): Promise<RepPlayerDuesInstallment[]> {
  const { error: delError } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .delete()
    .eq('schedule_id', scheduleId);
  if (delError) throw delError;

  if (!installments.length) return [];

  const rows = installments.map(i => ({
    schedule_id: scheduleId,
    player_id: playerId,
    installment_number: i.installmentNumber,
    amount: i.amount,
    due_date: i.dueDate,
    org_id: orgId,
    team_id: teamId,
  }));

  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDuesInstallment);
}

// ── Rep Dues: upsert schedule + replace installments ─────────────────────────

export async function upsertRepPlayerDuesSchedule(fields: {
  programYearId: string;
  playerId: string;
  teamId: string;
  orgId: string;
  totalAmount: number;
  notes: string | null;
  installments: Array<{ installmentNumber: number; amount: number; dueDate: string }>;
}): Promise<{ schedule: RepPlayerDuesSchedule; installments: RepPlayerDuesInstallment[] }> {
  const existing = await getRepPlayerDuesSchedule(fields.playerId, fields.programYearId);

  let schedule: RepPlayerDuesSchedule;
  if (existing) {
    schedule = await updateRepPlayerDuesSchedule(existing.id, {
      totalAmount: fields.totalAmount,
      notes: fields.notes,
    });
  } else {
    schedule = await createRepPlayerDuesSchedule({
      programYearId: fields.programYearId,
      playerId: fields.playerId,
      teamId: fields.teamId,
      orgId: fields.orgId,
      totalAmount: fields.totalAmount,
      notes: fields.notes,
    });
  }

  const newInstallments = await replaceRepDuesInstallments(schedule.id, fields.playerId, fields.installments, fields.orgId, fields.teamId);
  return { schedule, installments: newInstallments };
}

// ── Rep Allocations: splits for a team ───────────────────────────────────────

export interface RepAllocationSplitWithInstallments {
  id: string;
  allocationId: string;
  allocationDescription: string;
  teamId: string;
  programYearId: string;
  amount: number;
  splitMethod: string;
  splitValue: number;
  paymentSchedule: string;
  notes: string | null;
  installments: RepAllocationInstallment[];
}

export async function getRepAllocationSplitsForTeam(
  teamId: string,
): Promise<RepAllocationSplitWithInstallments[]> {
  const { data: splitData, error: splitError } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at');
  if (splitError) throw splitError;
  const splits = splitData ?? [];

  const { data: allocData, error: allocError } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('id, description');
  if (allocError) throw allocError;
  const allocMap: Record<string, string> = {};
  for (const a of allocData ?? []) allocMap[a.id] = a.description;

  const result: RepAllocationSplitWithInstallments[] = [];
  for (const s of splits) {
    const { data: instData, error: instError } = await supabaseAdmin
      .from('rep_allocation_installments')
      .select('*')
      .eq('split_id', s.id)
      .order('installment_number');
    if (instError) throw instError;
    result.push({
      id: s.id,
      allocationId: s.allocation_id,
      allocationDescription: allocMap[s.allocation_id] ?? '',
      teamId: s.team_id,
      programYearId: s.program_year_id,
      amount: Number(s.amount),
      splitMethod: s.split_method,
      splitValue: Number(s.split_value),
      paymentSchedule: s.payment_schedule,
      notes: s.notes ?? null,
      installments: (instData ?? []).map(mapRepAllocationInstallment),
    });
  }
  return result;
}

// ── 6M: Due reminder helpers ──────────────────────────────────────────────────

import type {
  RepDueReminderCandidate,
  RepAllocationReminderCandidate,
  RepPastProgramYear,
  RepTeamHistoryYear,
  PlatformUser,
} from './types';

export async function getDueReminderCandidates(
  teamId: string,
  daysAhead: number,
  window?: 30 | 7,
): Promise<RepDueReminderCandidate[]> {
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return [];

  const { data: schedules, error: sErr } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id, total_amount')
    .eq('program_year_id', programYear.id);
  if (sErr) throw sErr;
  if (!schedules?.length) return [];

  const scheduleIds = schedules.map((s: any) => s.id);

  const { data: allInst, error: iErr } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .select('*')
    .in('schedule_id', scheduleIds);
  if (iErr) throw iErr;
  const allInstallments: any[] = allInst ?? [];

  // Total installment count per schedule (for "N of M" display)
  const totalBySchedule: Record<string, number> = {};
  for (const i of allInstallments) {
    totalBySchedule[i.schedule_id] = (totalBySchedule[i.schedule_id] ?? 0) + 1;
  }

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const candidates = allInstallments.filter(i => {
    if (i.paid_at) return false;
    if (i.due_date < todayStr || i.due_date > cutoffStr) return false;
    // Check window-specific sent column, fall back to legacy reminder_sent_at
    if (window === 30) {
      if (i.reminder_30_sent_at && new Date(i.reminder_30_sent_at) >= sevenDaysAgo) return false;
    } else if (window === 7) {
      if (i.reminder_7_sent_at && new Date(i.reminder_7_sent_at) >= sevenDaysAgo) return false;
    } else {
      if (i.reminder_sent_at && new Date(i.reminder_sent_at) >= sevenDaysAgo) return false;
    }
    return true;
  });

  if (!candidates.length) return [];

  const playerIds = [...new Set(candidates.map((c: any) => c.player_id))];
  const { data: players, error: pErr } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email')
    .in('id', playerIds);
  if (pErr) throw pErr;
  const playerMap = new Map((players ?? []).map((p: any) => [p.id, p]));

  const team = await getRepTeam(teamId);

  return candidates.map((i: any) => {
    const p = playerMap.get(i.player_id);
    return {
      installmentId: i.id,
      scheduleId: i.schedule_id,
      playerId: i.player_id,
      playerFirstName: p?.player_first_name ?? '',
      playerLastName: p?.player_last_name ?? '',
      guardianFirstName: p?.guardian_first_name ?? null,
      guardianLastName: p?.guardian_last_name ?? null,
      guardianEmail: p?.guardian_email ?? null,
      teamId,
      teamName: team?.name ?? '',
      installmentNumber: i.installment_number,
      totalInstallments: totalBySchedule[i.schedule_id] ?? 1,
      amount: Number(i.amount),
      dueDate: i.due_date,
    };
  });
}

export async function markInstallmentsReminderSent(installmentIds: string[]): Promise<void> {
  if (!installmentIds.length) return;
  const { error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .update({ reminder_sent_at: new Date().toISOString() })
    .in('id', installmentIds);
  if (error) throw error;
}

export async function markInstallments30ReminderSent(installmentIds: string[]): Promise<void> {
  if (!installmentIds.length) return;
  const { error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .update({ reminder_30_sent_at: new Date().toISOString() })
    .in('id', installmentIds);
  if (error) throw error;
}

export async function markInstallments7ReminderSent(installmentIds: string[]): Promise<void> {
  if (!installmentIds.length) return;
  const { error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .update({ reminder_7_sent_at: new Date().toISOString() })
    .in('id', installmentIds);
  if (error) throw error;
}

export async function setAutoRemindersEnabled(programYearId: string, enabled: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_program_years')
    .update({ auto_reminders_enabled: enabled })
    .eq('id', programYearId);
  if (error) throw error;
}

export async function getAllocationReminderCandidates(
  orgId: string,
  daysAhead: number,
): Promise<RepAllocationReminderCandidate[]> {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Load all active splits for the org
  const { data: splits, error: sErr } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select('id, allocation_id, team_id')
    .eq('org_id', orgId);
  if (sErr) throw sErr;
  if (!splits?.length) return [];

  const splitIds = splits.map((s: any) => s.id);
  const splitMap = new Map(splits.map((s: any) => [s.id, s]));

  // Load allocation descriptions
  const allocationIds = [...new Set(splits.map((s: any) => s.allocation_id))];
  const { data: allocations, error: aErr } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('id, description')
    .in('id', allocationIds);
  if (aErr) throw aErr;
  const allocMap = new Map((allocations ?? []).map((a: any) => [a.id, a]));

  // Load unpaid installments due in window
  const { data: installments, error: iErr } = await supabaseAdmin
    .from('rep_allocation_installments')
    .select('*')
    .in('split_id', splitIds)
    .is('paid_at', null)
    .gte('due_date', todayStr)
    .lte('due_date', cutoffStr);
  if (iErr) throw iErr;
  if (!installments?.length) return [];

  // Total installments per split
  const { data: allInstCount, error: cErr } = await supabaseAdmin
    .from('rep_allocation_installments')
    .select('split_id')
    .in('split_id', splitIds);
  if (cErr) throw cErr;
  const totalBySplit: Record<string, number> = {};
  for (const r of allInstCount ?? []) {
    totalBySplit[r.split_id] = (totalBySplit[r.split_id] ?? 0) + 1;
  }

  // Load team names
  const teamIds = [...new Set(splits.map((s: any) => s.team_id))];
  const { data: teams, error: tErr } = await supabaseAdmin
    .from('rep_teams')
    .select('id, name')
    .in('id', teamIds);
  if (tErr) throw tErr;
  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t]));

  return installments
    .filter((i: any) => {
      if (i.reminder_sent_at && new Date(i.reminder_sent_at) >= sevenDaysAgo) return false;
      return true;
    })
    .map((i: any) => {
      const split = splitMap.get(i.split_id);
      const alloc = allocMap.get(split?.allocation_id);
      const team = teamMap.get(split?.team_id);
      return {
        installmentId: i.id,
        splitId: i.split_id,
        teamId: split?.team_id ?? '',
        teamName: team?.name ?? '',
        allocationDescription: alloc?.description ?? '',
        installmentNumber: i.installment_number,
        totalInstallments: totalBySplit[i.split_id] ?? 1,
        amount: Number(i.amount),
        dueDate: i.due_date,
      };
    });
}

export async function markAllocationReminderSent(installmentIds: string[]): Promise<void> {
  if (!installmentIds.length) return;
  const { error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .update({ reminder_sent_at: new Date().toISOString() })
    .in('id', installmentIds);
  if (error) throw error;
}

// ── 6N: Past program year helpers ─────────────────────────────────────────────

export async function getRepPastProgramYears(orgId: string, scopeTeamIds?: string[]): Promise<RepPastProgramYear[]> {
  let yearsQuery = supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('org_id', orgId)
    .in('status', ['completed', 'archived'])
    .order('year', { ascending: false });
  if (scopeTeamIds && scopeTeamIds.length > 0) yearsQuery = yearsQuery.in('team_id', scopeTeamIds);
  const { data: years, error: yErr } = await yearsQuery;
  if (yErr) throw yErr;
  if (!years?.length) return [];

  const teamIds = [...new Set(years.map((y: any) => y.team_id))];
  const { data: teams, error: tErr } = await supabaseAdmin
    .from('rep_teams')
    .select('id, name, color, division')
    .in('id', teamIds);
  if (tErr) throw tErr;
  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t]));

  const yearIds = years.map((y: any) => y.id);
  const { data: rosterCounts, error: rErr } = await supabaseAdmin
    .from('rep_roster_players')
    .select('program_year_id')
    .in('program_year_id', yearIds);
  if (rErr) throw rErr;
  const countMap: Record<string, number> = {};
  for (const r of rosterCounts ?? []) {
    countMap[r.program_year_id] = (countMap[r.program_year_id] ?? 0) + 1;
  }

  return years.map((y: any) => {
    const t = teamMap.get(y.team_id);
    return {
      id: y.id,
      teamId: y.team_id,
      teamName: t?.name ?? '',
      teamColor: t?.color ?? null,
      teamDivision: t?.division ?? null,
      orgId: y.org_id,
      name: y.name,
      year: y.year,
      status: y.status,
      rosterCount: countMap[y.id] ?? 0,
      createdAt: y.created_at,
      updatedAt: y.updated_at,
    };
  });
}

export async function getRepTeamHistory(teamId: string): Promise<RepTeamHistoryYear[]> {
  const team = await getRepTeam(teamId);
  if (!team) return [];

  const { data: years, error: yErr } = await supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('team_id', teamId)
    .in('status', ['completed', 'archived'])
    .order('year', { ascending: false });
  if (yErr) throw yErr;
  if (!years?.length) return [];

  const yearIds = years.map((y: any) => y.id);

  const [rosterRes, eventRes, tryoutRes] = await Promise.all([
    supabaseAdmin.from('rep_roster_players').select('program_year_id').in('program_year_id', yearIds),
    supabaseAdmin
      .from('rep_team_events')
      .select('program_year_id, result')
      .in('program_year_id', yearIds)
      .in('event_type', ['league_game', 'scrimmage', 'external_tournament'])
      .not('result', 'is', null),
    supabaseAdmin
      .from('rep_tryout_registrations')
      .select('program_year_id, status')
      .in('program_year_id', yearIds),
  ]);
  if (rosterRes.error) throw rosterRes.error;
  if (eventRes.error) throw eventRes.error;
  if (tryoutRes.error) throw tryoutRes.error;

  const rosterCount: Record<string, number> = {};
  for (const r of rosterRes.data ?? []) {
    rosterCount[r.program_year_id] = (rosterCount[r.program_year_id] ?? 0) + 1;
  }

  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const ties: Record<string, number> = {};
  for (const e of eventRes.data ?? []) {
    if (e.result === 'win') wins[e.program_year_id] = (wins[e.program_year_id] ?? 0) + 1;
    else if (e.result === 'loss') losses[e.program_year_id] = (losses[e.program_year_id] ?? 0) + 1;
    else if (e.result === 'tie') ties[e.program_year_id] = (ties[e.program_year_id] ?? 0) + 1;
  }

  const tryoutTotal: Record<string, number> = {};
  const tryoutAccepted: Record<string, number> = {};
  for (const t of tryoutRes.data ?? []) {
    tryoutTotal[t.program_year_id] = (tryoutTotal[t.program_year_id] ?? 0) + 1;
    if (t.status === 'accepted') {
      tryoutAccepted[t.program_year_id] = (tryoutAccepted[t.program_year_id] ?? 0) + 1;
    }
  }

  return years.map((y: any) => ({
    id: y.id,
    teamId: y.team_id,
    teamName: team.name,
    teamColor: team.color ?? null,
    teamDivision: team.division ?? null,
    orgId: y.org_id,
    name: y.name,
    year: y.year,
    status: y.status,
    rosterCount: rosterCount[y.id] ?? 0,
    wins: wins[y.id] ?? 0,
    losses: losses[y.id] ?? 0,
    ties: ties[y.id] ?? 0,
    tryoutTotal: tryoutTotal[y.id] ?? 0,
    tryoutAccepted: tryoutAccepted[y.id] ?? 0,
    createdAt: y.created_at,
    updatedAt: y.updated_at,
  }));
}

// ── Platform users ────────────────────────────────────────────────────────────

function mapPlatformUser(r: any): PlatformUser {
  return {
    id:          r.id,
    email:       r.email,
    displayName: r.display_name ?? null,
    role:        r.role,
    isActive:    r.is_active,
    invitedBy:   r.invited_by ?? null,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  };
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  const { data, error } = await supabaseAdmin
    .from('platform_users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[getPlatformUsers]', error);
    return [];
  }
  return (data ?? []).map(mapPlatformUser);
}

export async function getPlatformUserByEmail(email: string): Promise<PlatformUser | null> {
  const { data, error } = await supabaseAdmin
    .from('platform_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? mapPlatformUser(data) : null;
}

export async function createPlatformUser(fields: {
  email: string;
  displayName?: string | null;
  invitedBy?: string | null;
  role?: string;
}): Promise<PlatformUser> {
  const { data, error } = await supabaseAdmin
    .from('platform_users')
    .insert({
      email:        fields.email.toLowerCase(),
      display_name: fields.displayName ?? null,
      role:         fields.role ?? 'support',
      invited_by:   fields.invitedBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPlatformUser(data);
}

export async function updatePlatformUser(id: string, fields: {
  displayName?: string | null;
  isActive?: boolean;
  role?: string;
}): Promise<PlatformUser> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.isActive    !== undefined) patch.is_active    = fields.isActive;
  if (fields.role        !== undefined) patch.role         = fields.role;
  const { data, error } = await supabaseAdmin
    .from('platform_users')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapPlatformUser(data);
}

export async function deletePlatformUser(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('platform_users').delete().eq('id', id);
  if (error) throw error;
}
