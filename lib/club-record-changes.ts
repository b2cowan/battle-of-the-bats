/**
 * The support console's writes to a club record — ONE rule per kind of change (Support console Stage 2, owner rulings
 * A6 + R4, 2026-10-25). The record's one pencil (`PATCH …/orgs/[id]/record`), Put it back (`POST …/orgs/[id]/put-back`)
 * and the older single-purpose routes all call these, so a name, a web name or a section is written, and audited, one way.
 * The plan and its limits go through `lib/operator-plan-change.ts`, the one plan-change rule (bulk fix 2026-10-24).
 *
 * ⚖ EVERY CHANGE KEEPS ITS REASON, from Stage 2 on, in `new_value` the way plan changes always have (the audit log's own
 * reason column is Stage 3). A Put it back entry also names the entry it undoes (`put_back_of`), which is how the Story
 * marks the old entry "Put back at …" without ever editing it.
 */
import { supabaseAdmin } from './supabase-admin';
import { writePlatformAuditLog } from './platform-audit';
import { CLUB_SECTIONS } from './platform-labels';

// The four add-on sections and their names live with the console's other words (client-safe), re-exported here.
export { CLUB_SECTIONS, sectionLabel } from './platform-labels';
const SECTION_KEYS = new Set(CLUB_SECTIONS.map(s => s.key));

export type ChangeResult = { ok: true } | { ok: false; status: number; error: string };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A club's name and/or web name. One audit entry per changed field, each with the shared reason. */
export async function applyClubIdentity(opts: {
  orgId: string;
  name?: string;
  slug?: string;
  reason: string;
  actorEmail: string;
  extra?: Record<string, unknown>;
}): Promise<ChangeResult> {
  const { data: current, error: readError } = await supabaseAdmin
    .from('organizations')
    .select('name, slug')
    .eq('id', opts.orgId)
    .single<{ name: string; slug: string }>();
  if (readError || !current) return { ok: false, status: 404, error: 'This club was not found.' };

  const name = opts.name === undefined ? current.name : opts.name.trim();
  const slug = opts.slug === undefined ? current.slug : opts.slug.trim().toLowerCase();
  if (!name) return { ok: false, status: 400, error: 'A club needs a name.' };
  if (!slug || !SLUG.test(slug)) {
    return { ok: false, status: 400, error: 'A web name uses lowercase letters, numbers and single hyphens only.' };
  }
  if (name === current.name && slug === current.slug) return { ok: true };

  if (slug !== current.slug) {
    const { count, error } = await supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .neq('id', opts.orgId);
    if (error) return { ok: false, status: 500, error: 'The web name could not be checked.' };
    if ((count ?? 0) > 0) return { ok: false, status: 409, error: 'Another club already has that web name.' };
  }

  const { error } = await supabaseAdmin.from('organizations').update({ name, slug }).eq('id', opts.orgId);
  if (error) return { ok: false, status: 500, error: 'The name could not be saved.' };

  if (current.name !== name) {
    await writePlatformAuditLog(opts.actorEmail, opts.orgId, 'update_org_identity', 'name', current.name, {
      value: name, reason: opts.reason, ...opts.extra,
    });
  }
  if (current.slug !== slug) {
    await writePlatformAuditLog(opts.actorEmail, opts.orgId, 'update_org_identity', 'slug', current.slug, {
      value: slug, reason: opts.reason, ...opts.extra,
    });
  }
  return { ok: true };
}

const sameSections = (a: string[], b: string[]) => a.length === b.length && a.every(k => b.includes(k));

/**
 * A club's add-on sections: the whole list (`enabledAddons`), or one section turned on or off (`toggle`, Put it back).
 * Keys outside the four are refused. The reason (and a Put it back's `put_back_of`) is kept in `new_value` as
 * `{ value, reason }` — older entries hold the bare list.
 *
 * ⚖ NEVER OVER SOMEONE ELSE'S CHANGE. The list is written only if it is still the one just read (a compare-and-set), so
 * two saves at the same moment cannot quietly undo each other; and a caller that knows what its screen showed passes
 * `expected`, so a whole-list save from a stale screen is refused rather than reverting a change made since.
 */
export async function applyClubSections(opts: {
  orgId: string;
  enabledAddons?: string[];
  toggle?: { section: string; on: boolean };
  expected?: string[];
  reason: string;
  actorEmail: string;
  extra?: Record<string, unknown>;
}): Promise<ChangeResult> {
  const { data: current, error: readError } = await supabaseAdmin
    .from('organizations')
    .select('enabled_addons')
    .eq('id', opts.orgId)
    .single<{ enabled_addons: string[] | null }>();
  if (readError || !current) return { ok: false, status: 404, error: 'This club was not found.' };
  const before = current.enabled_addons ?? [];
  const stale = { ok: false as const, status: 409, error: 'Someone else changed this club’s sections just now. Reload to see them, then try again.' };
  if (opts.expected && !sameSections(opts.expected, before.filter(k => SECTION_KEYS.has(k)))) return stale;

  const notASection = { ok: false as const, status: 400, error: 'That is not a section a club can have.' };
  let next: string[];
  if (opts.toggle) {
    if (!SECTION_KEYS.has(opts.toggle.section)) return notASection;
    const set = new Set(before);
    if (opts.toggle.on) set.add(opts.toggle.section); else set.delete(opts.toggle.section);
    next = [...set];
  } else {
    next = [...new Set(opts.enabledAddons ?? [])];
    if (next.some(key => !SECTION_KEYS.has(key))) return notASection;
  }
  if (sameSections(before, next)) return { ok: true };

  let write = supabaseAdmin.from('organizations').update({ enabled_addons: next }).eq('id', opts.orgId);
  // enabled_addons is jsonb: the filter is the exact list just read, as JSON (order included — it is the same list).
  write = current.enabled_addons === null ? write.is('enabled_addons', null) : write.eq('enabled_addons', JSON.stringify(before));
  const { data: written, error } = await write.select('id');
  if (error) return { ok: false, status: 500, error: 'The sections could not be saved.' };
  if (!written || written.length === 0) return stale;

  await writePlatformAuditLog(opts.actorEmail, opts.orgId, 'update_addons', 'enabled_addons', before, {
    value: next, reason: opts.reason, ...opts.extra,
  });
  return { ok: true };
}

/** End a running override now. The reason (and a Put it back's `put_back_of`) is kept with the revoke entry. */
export async function endClubOverride(opts: {
  orgId: string;
  overrideId: string;
  reason: string | null;
  actorEmail: string;
  extra?: Record<string, unknown>;
}): Promise<ChangeResult & { override?: { id: string; revoked_at: string; revoked_by: string } }> {
  // Only a row that is still live: a wrong id, another club's row or an already-ended one is a no-op, reported as such.
  const { data: updated, error } = await supabaseAdmin
    .from('org_overrides')
    .update({ revoked_at: new Date().toISOString(), revoked_by: opts.actorEmail })
    .eq('id', opts.overrideId)
    .eq('org_id', opts.orgId)
    .is('revoked_at', null)
    .select('id, revoked_at, revoked_by');
  if (error) return { ok: false, status: 500, error: 'The override could not be ended.' };
  if (!updated || updated.length === 0) return { ok: false, status: 404, error: 'That override has already ended.' };

  await writePlatformAuditLog(opts.actorEmail, opts.orgId, 'revoke_override', 'id', opts.overrideId,
    opts.reason ? { reason: opts.reason, ...opts.extra } : null);
  return { ok: true, override: updated[0] as { id: string; revoked_at: string; revoked_by: string } };
}
