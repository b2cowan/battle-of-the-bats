/**
 * backfill-rep-team-links.mjs  (WI-2C.5, Tournament Seam P2)
 *
 * One-time, best-effort backfill for `rep_team_tournament_registrations` (mig 196): links
 * existing tournament registrations (`teams` rows) to the rep team of the SAME org they
 * belong to, so paid-portal coaches are recognized on public tournament pages without
 * waiting for an admin to link each one by hand.
 *
 * HUMAN-CONFIRMED, NEVER auto-links blindly:
 *   • Default = REPORT ONLY (no writes). Prints candidate matches grouped by confidence.
 *   • --apply writes links ONLY for HIGH-confidence matches: an unlinked accepted
 *     registration whose normalized name EXACTLY equals exactly ONE non-archived rep team
 *     in its org. Ambiguous (multiple exact) and fuzzy (partial) matches are ALWAYS
 *     reported for manual linking via the admin "Link to rep team" control — never applied.
 *   • Written links use link_source='backfill', linked_by_user_id=null.
 *
 * This is a manual operator tool — NOT a migration step, nothing runs it automatically.
 * Idempotent: skips registrations that already have a link.
 *
 * Usage:
 *   node scripts/backfill-rep-team-links.mjs                       # dev, report only
 *   node scripts/backfill-rep-team-links.mjs --org milton-bats     # scope to one org slug
 *   node scripts/backfill-rep-team-links.mjs --apply               # write HIGH-confidence links
 *   node scripts/backfill-rep-team-links.mjs --env .env.production.local --apply   # prod
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the chosen env file.
 * (The rep_team_tournament_registrations table must exist in the target env first.)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const apply = process.argv.includes('--apply');
const orgSlug = argValue('--org', null);
const envPath = argValue('--env', '.env.local');
dotenv.config({ path: envPath });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !serviceKey) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${envPath}`);
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const norm = s => (s ?? '').trim().toLowerCase();

async function main() {
  console.log(`\n🔗 Rep-team link backfill — ${apply ? 'APPLY (writing HIGH-confidence links)' : 'REPORT ONLY (no writes)'}`);
  console.log(`   env: ${envPath}${orgSlug ? ` · org: ${orgSlug}` : ' · all orgs with rep teams'}\n`);

  // Orgs to process: those with at least one non-archived rep team (optionally one slug).
  let repQ = supabase.from('rep_teams').select('id, name, sport, division, org_id, is_archived').eq('is_archived', false);
  const { data: allRepTeams, error: repErr } = await repQ;
  if (repErr) throw repErr;

  let orgIdFilter = null;
  if (orgSlug) {
    const { data: org, error: orgErr } = await supabase.from('organizations').select('id, slug').eq('slug', orgSlug).maybeSingle();
    if (orgErr) throw orgErr;
    if (!org) { console.error(`No org with slug "${orgSlug}".`); process.exit(1); }
    orgIdFilter = org.id;
  }

  const repTeams = (allRepTeams ?? []).filter(t => !orgIdFilter || t.org_id === orgIdFilter);
  const repByOrg = new Map();
  for (const t of repTeams) {
    if (!repByOrg.has(t.org_id)) repByOrg.set(t.org_id, []);
    repByOrg.get(t.org_id).push(t);
  }
  if (repByOrg.size === 0) { console.log('No rep teams found for the given scope — nothing to backfill.'); return; }

  let high = 0, ambiguous = 0, fuzzy = 0, written = 0, alreadyLinked = 0;

  for (const [orgId, teams] of repByOrg) {
    // Tournaments in this org → their accepted registrations.
    const { data: tournaments, error: tErr } = await supabase.from('tournaments').select('id, name').eq('org_id', orgId);
    if (tErr) throw tErr;
    const tournamentIds = (tournaments ?? []).map(t => t.id);
    if (tournamentIds.length === 0) continue;
    const tournamentName = new Map((tournaments ?? []).map(t => [t.id, t.name]));

    const { data: regs, error: rErr } = await supabase
      .from('teams')
      .select('id, name, division_id, tournament_id, status')
      .in('tournament_id', tournamentIds)
      .eq('status', 'accepted');
    if (rErr) throw rErr;
    if (!regs || regs.length === 0) continue;

    // Registrations already linked (skip) — scoped by this org's link rows.
    const { data: existing, error: eErr } = await supabase
      .from('rep_team_tournament_registrations')
      .select('tournament_team_id')
      .eq('org_id', orgId);
    if (eErr) throw eErr;
    const linked = new Set((existing ?? []).map(l => l.tournament_team_id));

    // Division names (context for the human to eyeball a match).
    const divisionIds = [...new Set(regs.map(r => r.division_id).filter(Boolean))];
    const divisionName = new Map();
    if (divisionIds.length) {
      const { data: divs } = await supabase.from('divisions').select('id, name').in('id', divisionIds);
      for (const d of divs ?? []) divisionName.set(d.id, d.name);
    }

    const repByName = new Map();
    for (const t of teams) {
      const key = norm(t.name);
      if (!repByName.has(key)) repByName.set(key, []);
      repByName.get(key).push(t);
    }

    for (const reg of regs) {
      if (linked.has(reg.id)) { alreadyLinked++; continue; }
      const regName = norm(reg.name);
      if (!regName) continue; // a blank/whitespace-only name can't be confidently matched
      const divLabel = reg.division_id ? (divisionName.get(reg.division_id) ?? '—') : '—';
      const ctx = `"${reg.name}" [${divLabel}] · ${tournamentName.get(reg.tournament_id) ?? '?'}`;

      const exact = repByName.get(regName) ?? [];
      if (exact.length === 1) {
        high++;
        console.log(`  ✅ HIGH   ${ctx}  →  rep "${exact[0].name}" [${exact[0].division ?? '—'} · ${exact[0].sport ?? '—'}]`);
        if (apply) {
          const { error: insErr } = await supabase
            .from('rep_team_tournament_registrations')
            .upsert({
              tournament_team_id: reg.id, rep_team_id: exact[0].id, org_id: orgId,
              linked_by_user_id: null, link_source: 'backfill',
            }, { onConflict: 'tournament_team_id' });
          if (insErr) console.log(`      ⚠ write failed: ${insErr.message}`);
          else written++;
        }
        continue;
      }
      if (exact.length > 1) {
        ambiguous++;
        console.log(`  ❓ AMBIG  ${ctx}  →  ${exact.length} rep teams named "${reg.name}" — link manually.`);
        continue;
      }
      // Fuzzy: partial containment either direction (report only, never applied).
      const partial = teams.filter(t => {
        const rn = norm(t.name);
        return rn && regName && (rn.includes(regName) || regName.includes(rn));
      });
      if (partial.length) {
        fuzzy++;
        console.log(`  ~  FUZZY  ${ctx}  →  maybe ${partial.map(t => `"${t.name}"`).join(', ')} — link manually.`);
      }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`  HIGH (exact, single):  ${high}${apply ? `  → written: ${written}` : '  (run with --apply to write)'}`);
  console.log(`  AMBIGUOUS (multi):     ${ambiguous}  (manual link)`);
  console.log(`  FUZZY (partial):       ${fuzzy}  (manual link)`);
  console.log(`  Already linked:        ${alreadyLinked}  (skipped)`);
  if (!apply && high > 0) console.log(`\n  Re-run with --apply to write the ${high} HIGH-confidence link(s).`);
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
