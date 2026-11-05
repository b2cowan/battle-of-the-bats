import 'server-only';
/**
 * A CHILD'S PAPERS ON ONE TEAM, EVERY SEASON — the reads behind "Needs signing for {season}" / "On file" (Club Tier
 * Stage 14 S4; owner 2026-11-04, Ask 10 A and the S4 Part 0 calls).
 *
 * Documents stay on the season's roster entry they were signed on (S4 Part 0, recommendation 1): the entry's season is
 * "signed for which season" and its child is "whose". So the child's papers are the documents on that child's entries —
 * on the SAME team only (Ask 9: a coach reads their own team's seasons; the board and the Families book use the same scope
 * so the three never disagree). Call-ups are their own child, so a borrowed player's papers never reach the home roster.
 *
 * ⚖ The look-back's three answers (CLAUDE.md, "A year parameter is a DECISION"):
 *   1. RECORD READ FEEDING THE WORKING SEASON — an earlier season's signed copy decides whether this season still needs
 *      one, and can be downloaded. Nothing here writes; a past season's copy is never deleted from the live page.
 *   2. NO SUBTREE — a history row is a line with a download, never a door into the old season.
 *   3. EVERY ROW NAMES ITS SEASON ("Last signed for the 2025 Season").
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { type FormsHeld } from './forms-coverage';
import type { RepDocumentType } from './types';

/** For each CURRENT entry: the types on file on it, and on the same child's other entries on the same team. */
export async function readHeldForms(
  orgId: string,
  entries: readonly { id: string; child_id: string | null; team_id: string }[],
): Promise<Map<string, FormsHeld>> {
  const out = new Map<string, FormsHeld>();
  if (entries.length === 0) return out;
  const childIds = [...new Set(entries.map(e => e.child_id).filter((c): c is string => !!c))];
  const teamIds = [...new Set(entries.map(e => e.team_id))];
  // Every entry of these children on these teams (the current ones included) — the scope a document can answer from.
  // Paged (a reply stops at 1,000 rows) and chunked (a long id list rides in the URL).
  const siblings = await fetchAllIn<{ id: string; child_id: string; team_id: string }>(childIds, (chunk, from, to) =>
    supabaseAdmin.from('rep_roster_players').select('id, child_id, team_id')
      .eq('org_id', orgId).in('child_id', chunk).in('team_id', teamIds).neq('status', 'callup')
      .order('id').range(from, to));
  const entryIds = [...new Set([...entries.map(e => e.id), ...siblings.map(s => s.id)])];
  const docs = await fetchAllIn<{ id: string; player_id: string; document_type: string }>(entryIds, (chunk, from, to) =>
    supabaseAdmin.from('rep_player_documents').select('id, player_id, document_type')
      .eq('org_id', orgId).in('player_id', chunk).order('id').range(from, to));
  const typesByEntry = new Map<string, Set<string>>();
  for (const d of docs) {
    const set = typesByEntry.get(d.player_id) ?? new Set<string>();
    set.add(d.document_type);
    typesByEntry.set(d.player_id, set);
  }
  for (const e of entries) {
    const earlier = new Set<string>();
    if (e.child_id) {
      for (const s of siblings) {
        if (s.id === e.id || s.child_id !== e.child_id || s.team_id !== e.team_id) continue;
        for (const t of typesByEntry.get(s.id) ?? []) earlier.add(t);
      }
    }
    out.set(e.id, { thisSeason: typesByEntry.get(e.id) ?? new Set(), earlier });
  }
  return out;
}

export interface ChildTeamDocument {
  id: string;
  playerId: string;
  documentType: RepDocumentType;
  fileName: string;
  fileSize: number;
  templateId: string | null;
  uploadedBy: string | null;
  createdAt: string;
  seasonId: string;
  seasonName: string;
  seasonYear: number;
}

type ChildEntry = { id: string; childId: string | null; teamId: string; orgId: string; status?: string };

/**
 * The child's entries on this team (every season) — the one scope a history document can come from. A call-up entry is
 * its own child; an entry with no child (cannot happen after mig 435) reads itself only.
 */
function childEntriesOnTeam(entry: ChildEntry, columns: string) {
  const q = supabaseAdmin.from('rep_roster_players').select(columns).eq('org_id', entry.orgId).eq('team_id', entry.teamId);
  return entry.childId && entry.status !== 'callup'
    ? q.or(`id.eq.${entry.id},and(child_id.eq.${entry.childId},status.neq.callup)`)
    : q.eq('id', entry.id);
}

/**
 * The child's documents on this team, every season, newest first (the file itself never — `storage_path` is not read).
 */
export async function readChildTeamDocuments(entry: ChildEntry): Promise<ChildTeamDocument[]> {
  // The child's entries on this team, with the season each one is.
  const { data: rows, error: rowsError } = await childEntriesOnTeam(entry, 'id, program_year_id');
  if (rowsError) throw rowsError;
  const seasonOf = new Map(((rows ?? []) as unknown as { id: string; program_year_id: string }[]).map(r => [r.id, r.program_year_id]));
  if (seasonOf.size === 0) return [];
  const [docsRes, yearsRes] = await Promise.all([
    supabaseAdmin
      .from('rep_player_documents')
      .select('id, player_id, document_type, file_name, file_size, template_id, uploaded_by, created_at')
      .eq('org_id', entry.orgId)
      .eq('team_id', entry.teamId)
      .in('player_id', [...seasonOf.keys()])
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('rep_program_years')
      .select('id, name, year')
      .in('id', [...new Set(seasonOf.values())]),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (yearsRes.error) throw yearsRes.error;
  const years = new Map(((yearsRes.data ?? []) as { id: string; name: string; year: number }[]).map(y => [y.id, y]));
  return ((docsRes.data ?? []) as any[]).map(r => {
    const y = years.get(seasonOf.get(r.player_id) ?? '');
    return {
      id: r.id, playerId: r.player_id, documentType: r.document_type, fileName: r.file_name, fileSize: Number(r.file_size),
      templateId: r.template_id ?? null, uploadedBy: r.uploaded_by ?? null, createdAt: r.created_at,
      seasonId: y?.id ?? '', seasonName: y?.name ?? '', seasonYear: Number(y?.year ?? 0),
    };
  });
}

/** Whether a document sits on one of this child's entries on this team (a history download from the live page). */
export async function documentIsTheChilds(
  doc: { playerId: string; teamId: string; orgId: string },
  entry: ChildEntry,
): Promise<boolean> {
  if (doc.teamId !== entry.teamId || doc.orgId !== entry.orgId) return false;
  if (doc.playerId === entry.id) return true;
  if (!entry.childId || entry.status === 'callup') return false;
  const { data, error } = await childEntriesOnTeam(entry, 'id').eq('id', doc.playerId).maybeSingle();
  if (error) throw error;
  return !!data;
}

// ── The once-a-season health check ("Still right for the {season}?") ─────────────────────────────────────────────────

export interface HealthCheck {
  /** Ask: a returning child (an entry on an earlier season), something on file, nobody has confirmed or saved it this season. */
  ask: boolean;
  /** "Last checked for the 2026 Season." — the newest earlier entry on THIS team that was confirmed (Ask 9). */
  lastCheckedSeasonName: string | null;
  /** The working season the question names ("Still right for the 2027 Season?"). */
  seasonName: string;
}

function hasText(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export async function readHealthCheck(
  entry: {
    id: string; childId: string | null; teamId: string; orgId: string; status?: string;
    medicalNotes: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null;
    healthConfirmedAt: string | null;
  },
  season: { year: number; name: string },
): Promise<HealthCheck> {
  const none: HealthCheck = { ask: false, lastCheckedSeasonName: null, seasonName: season.name };
  if (entry.healthConfirmedAt || !entry.childId || entry.status === 'callup') return none;
  if (!hasText(entry.medicalNotes) && !hasText(entry.emergencyContactName) && !hasText(entry.emergencyContactPhone)) {
    return none;
  }
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, team_id, health_confirmed_at, rep_program_years!inner(name, year)')
    .eq('org_id', entry.orgId)
    .eq('child_id', entry.childId)
    .neq('id', entry.id)
    .neq('status', 'callup');
  if (error) throw error;
  const earlier = ((data ?? []) as any[])
    .map(r => ({ teamId: r.team_id as string, confirmedAt: r.health_confirmed_at as string | null,
                 name: String(r.rep_program_years?.name ?? ''), year: Number(r.rep_program_years?.year ?? 0) }))
    .filter(r => r.year < season.year)
    .sort((a, b) => b.year - a.year);
  if (earlier.length === 0) return none;
  const last = earlier.find(r => r.teamId === entry.teamId && r.confirmedAt) ?? null;
  return { ask: true, lastCheckedSeasonName: last?.name ?? null, seasonName: season.name };
}

// ── "With the {team} {years}" (the coach's player page, Club Tier Stage 14 S5) ────────────────────────────────────────

/**
 * The years this child played for THIS team (Ask 9: a coach reads their own team's seasons only — never another team's,
 * never the house league). The same scope as the papers above.
 * ⚖ The look-back's three answers: 1. a RECORD read (a line of years) on the working season's player page — it writes
 * nothing; 2. NO SUBTREE — the line opens nothing; 3. it NAMES its seasons (the years themselves).
 */
export async function readYearsWithTeam(entry: ChildEntry): Promise<number[]> {
  const { data, error } = await childEntriesOnTeam(entry, 'id, rep_program_years(year)');
  if (error) throw error;
  return ((data ?? []) as unknown as { rep_program_years: { year: number } | { year: number }[] | null }[])
    .map(r => Number((Array.isArray(r.rep_program_years) ? r.rep_program_years[0] : r.rep_program_years)?.year ?? 0))
    .filter(y => y > 0);
}
