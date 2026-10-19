import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { resolvePersonNamer } from './db';
import { fetchAll } from './supabase-paging';
import { writeOrgAudit } from './org-audit';
import { FAMILY_NOTE_WORDS as W, noteProblem } from './families-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A FAMILY'S NOTES (Club Tier Stage 5c, Part D — owner Ask 29, 2026-10-19; `family_notes`, mig 338).
 *
 * The coaches' player notes are the recipe (a dated, signed list), never the club's single unsigned boxes. Every route
 * sits behind `requireFamiliesAccess`, so:
 *   · anyone who can open Families reads and adds;
 *   · the AUTHOR edits (an edit autosaves; `edited_at` says when the words last changed);
 *   · the author or the OWNER deletes — the row goes, and an org audit line keeps who and when, NEVER the words.
 * A note belongs to the guardian record it was written on (no household before 5d). A merge carries it
 * (`families_merge_people`, mig 338). Never on a family's screen; the family file holds them and says so.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface FamilyNoteView {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
  editedAt: string | null;
  /** The reader wrote it — the pencil is theirs. */
  mine: boolean;
  /** The reader may delete it (its author, or the owner). */
  canDelete: boolean;
}

type Viewer = Pick<AuthContextWithRole, 'role' | 'user'>;

const canDelete = (viewer: Viewer, createdBy: string | null) => viewer.role === 'owner' || (!!createdBy && createdBy === viewer.user.id);

/** A note as stored — read here and by the family file (lib/families-export.ts). */
export const NOTE_COLUMNS = 'id, body, created_by, created_at, edited_at';
interface NoteRow { id: string; body: string; created_by: string | null; created_at: string; edited_at: string | null }

/** A stored note, worded for this reader. */
const toView = (r: NoteRow, author: string | null, viewer: Viewer): FamilyNoteView => ({
  id: r.id, body: r.body, author, createdAt: r.created_at, editedAt: r.edited_at ?? null,
  mine: !!r.created_by && r.created_by === viewer.user.id, canDelete: canDelete(viewer, r.created_by),
});

/** A family's notes, newest first, worded for this reader. */
export async function readNotes(orgId: string, personId: string, viewer: Viewer): Promise<FamilyNoteView[]> {
  const rows = await fetchAll<NoteRow>((from, to) => supabaseAdmin.from('family_notes').select(NOTE_COLUMNS)
    .eq('org_id', orgId).eq('person_id', personId).order('created_at', { ascending: false }).order('id').range(from, to));
  const nameOf = await resolvePersonNamer(orgId, [...new Set(rows.map(r => r.created_by).filter(Boolean))]);
  return rows.map(r => toView(r, r.created_by ? nameOf(r.created_by) : null, viewer));
}

/** The note's words, or why they cannot be saved (`noteProblem`, the windows' own rule). */
export function noteBody(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw : '';
  const problem = noteProblem(text);
  return problem ? { ok: false, error: problem } : { ok: true, body: text.trim() };
}

type Outcome =
  | { ok: true; note: FamilyNoteView }
  | { ok: true; saved: { body: string; editedAt: string } }
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Is this person this club's? (A foreign id reads as not found, as every Families read.) */
async function personIsOrgs(orgId: string, personId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('org_people').select('id').eq('org_id', orgId).eq('id', personId).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function oneNote(orgId: string, personId: string, noteId: string) {
  const { data, error } = await supabaseAdmin.from('family_notes').select('id, created_by')
    .eq('id', noteId).eq('org_id', orgId).eq('person_id', personId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createNote(ctx: AuthContextWithRole, personId: string, raw: unknown): Promise<Outcome> {
  const b = noteBody(raw);
  if (!b.ok) return { ok: false, status: 400, error: b.error };
  if (!(await personIsOrgs(ctx.org.id, personId))) return { ok: false, status: 404, error: 'Not found' };
  const { data, error } = await supabaseAdmin.from('family_notes')
    .insert({ org_id: ctx.org.id, person_id: personId, body: b.body, created_by: ctx.user.id })
    .select(NOTE_COLUMNS).single();
  if (error) throw error;
  const author = (await resolvePersonNamer(ctx.org.id, [ctx.user.id]))(ctx.user.id);
  return { ok: true, note: toView(data as NoteRow, author, ctx) };
}

export async function updateNote(ctx: AuthContextWithRole, personId: string, noteId: string, raw: unknown): Promise<Outcome> {
  const b = noteBody(raw);
  if (!b.ok) return { ok: false, status: 400, error: b.error };
  // An autosave: ONE write that only the author's own note on this family can take; a miss reads once, to say why.
  const { data, error } = await supabaseAdmin.from('family_notes').update({ body: b.body, edited_at: new Date().toISOString() })
    .eq('id', noteId).eq('org_id', ctx.org.id).eq('person_id', personId).eq('created_by', ctx.user.id)
    .select('body, edited_at').maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, saved: { body: data.body, editedAt: data.edited_at } };
  const note = await oneNote(ctx.org.id, personId, noteId);
  return note ? { ok: false, status: 403, error: W.notYours } : { ok: false, status: 404, error: W.gone };
}

export async function deleteNote(ctx: AuthContextWithRole, personId: string, noteId: string): Promise<Outcome> {
  const note = await oneNote(ctx.org.id, personId, noteId);
  if (!note) return { ok: false, status: 404, error: W.gone };
  if (!canDelete(ctx, note.created_by)) return { ok: false, status: 403, error: W.notAllowedDelete };
  const { error } = await supabaseAdmin.from('family_notes').delete().eq('id', noteId).eq('org_id', ctx.org.id);
  if (error) throw error;
  // Who and when (the audit row's actor and time) — NEVER the words.
  await writeOrgAudit(ctx.org.id, ctx.user.id, noteId, 'families_note_deleted', { personId, ownNote: note.created_by === ctx.user.id });
  return { ok: true };
}
