import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { leaguePayUrl } from './league-pay-link';
import { readSignupForm } from './club-form-server';
import { answersOpen, liveRow } from './club-form-family';
import { signupHasFormToDo, type TodoChild, type TodoTick } from './club-form-todo';
import { isFinishedLeagueSeason } from './house-league-access';
import { normalizeGuardianEmail } from './guardian-email';

/**
 * THE "YOUR SIGN-UP" BUTTON ON THE CLUB'S OWN "EMAIL FAMILIES" (Board Ready Stage 4 Part 3, owner call C4, 2026-11-20).
 *
 * A family whose sign-up still has something to do on the season's form (a document to tick, or a live question this
 * sign-up has not answered) gets the family's existing "Your sign-up" button on the email the club sent — the same
 * button and the same signed link as the sign-up confirmation and the money emails; no new kind of link, no new email.
 *
 *   · ONE BUTTON PER EMAIL. A household with several sign-ups gets the first (in the audience's child order) that has
 *     something to do. Every address of the household — the second parent's included — gets that same link, as the
 *     placement email's second-parent copy does.
 *   · IT FAILS TO NO BUTTON. A read that fails sends today's email (a missing button beats a missing message); the caller
 *     catches and logs. A missing secret means no link, so no button (`leaguePayUrl`).
 *   · IT READS WHICH QUESTIONS HAVE AN ANSWER, NEVER WHAT THE ANSWER SAYS. The selects below do not name an answer's value
 *     columns. Nothing it returns says why a family got the button.
 *   · BULK. A few reads for the whole send, in chunks: never one round trip per family (a select stops silently at 1,000
 *     rows, so every read pages — `fetchAllIn`).
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

/** One household of a send, as this needs it: its addresses and the sign-ups' children, in the audience's order. */
export interface FormLinkFamily { addresses: readonly string[]; regIds: readonly string[] }

type RegRow = { id: string; signup_ref: string | null; guardian_email: string | null; division_id: string | null; status: string; link_version: number | null };
const REG_COLS = 'id, signup_ref, guardian_email, division_id, status, link_version';

/** A sign-up is the registrations sharing a reference AND a family email (`signupRowsFromAnchor`), else the one row. */
const signupKeyOf = (r: RegRow) => (r.signup_ref ? `${r.signup_ref}|${(r.guardian_email ?? '').toLowerCase()}` : r.id);

/**
 * address → the family's "Your sign-up" link, for the households whose sign-up has something to do. An address that is
 * not in the map gets the email without the button.
 */
export async function formButtonLinks(input: {
  org: { id: string; slug: string };
  season: { id: string; slug: string; status: string };
  families: readonly FormLinkFamily[];
  /** The season's divisions whose teams are published; read here when the caller has not already. */
  teamsMade?: ReadonlySet<string>;
}): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const { org, season } = input;
  const finished = isFinishedLeagueSeason(season);
  const regIds = [...new Set(input.families.flatMap(f => f.regIds))];
  if (finished || regIds.length === 0) return links;

  // The season's form, if it has one (a season whose form was never opened asks nothing, so there is nothing to make).
  const formRow = await supabaseAdmin.from('club_forms').select('id').eq('owner_table', 'league_seasons').eq('owner_id', season.id).maybeSingle();
  if (formRow.error) throw formRow.error;
  const formId = (formRow.data as { id: string } | null)?.id;
  if (!formId) return links;
  const read = await readSignupForm(formId);
  if (read.view.questions.length === 0 && read.view.documents.length === 0) return links;

  // Every child of the sign-ups these families' children belong to.
  const regs = () => supabaseAdmin.from('league_registrations').select(REG_COLS).eq('season_id', season.id).eq('org_id', org.id);
  const anchors = await fetchAllIn<RegRow>(regIds, (chunk, from, to) => regs().in('id', chunk).order('id').range(from, to));
  const refs = [...new Set(anchors.map(a => a.signup_ref).filter((r): r is string => !!r))];
  const withRef = await fetchAllIn<RegRow>(refs, (chunk, from, to) => regs().in('signup_ref', chunk).order('id').range(from, to));
  const bySignup = new Map<string, RegRow[]>();
  const rowsById = new Map<string, RegRow>();
  for (const r of [...anchors, ...withRef]) {
    if (rowsById.has(r.id)) continue;
    rowsById.set(r.id, r);
    const key = signupKeyOf(r);
    bySignup.set(key, [...(bySignup.get(key) ?? []), r]);
  }
  const keys = [...new Set(anchors.map(signupKeyOf))];
  // Only the sign-ups the audience's children belong to are asked about; a sibling row outside the scope still counts in its sign-up.
  const members = keys.flatMap(k => bySignup.get(k) ?? []);
  const live = members.filter(liveRow);
  const liveIds = live.map(r => r.id);

  const teamsMade = input.teamsMade ?? await publishedDivisions(season.id);
  const hasQuestions = read.view.questions.length > 0;
  const hasDocuments = read.view.documents.length > 0;
  const [childAnswers, onceAnswers, ticks] = await Promise.all([
    hasQuestions ? fetchAllIn<{ question_id: string; subject_id: string }>(liveIds, (chunk, from, to) =>
      supabaseAdmin.from('club_form_answers').select('question_id, subject_id')
        .eq('form_id', formId).eq('subject_table', 'league_registrations').in('subject_id', chunk).is('removed_at', null)
        .order('id').range(from, to)) : [],
    // The sign-up's own answers, through its row by reference (the page's own read, for many references at once).
    hasQuestions && read.view.questions.some(q => q.asked === 'once')
      ? fetchAllIn<{ question_id: string; club_form_submissions: { ref: string } | { ref: string }[] | null }>(
        keys.map(k => bySignup.get(k)![0]).map(r => r.signup_ref ?? r.id), (chunk, from, to) =>
          supabaseAdmin.from('club_form_answers').select('question_id, club_form_submissions!inner(ref)')
            .eq('form_id', formId).is('subject_id', null).is('removed_at', null)
            .in('club_form_submissions.ref', chunk).order('id').range(from, to))
      : [],
    hasDocuments ? fetchAllIn<{ document_id: string; version_id: string | null; moved: boolean; subject_id: string }>(liveIds, (chunk, from, to) =>
      supabaseAdmin.from('club_form_ticks').select('document_id, version_id, moved, subject_id')
        .eq('form_id', formId).eq('subject_table', 'league_registrations').in('subject_id', chunk).order('id').range(from, to)) : [],
  ]);

  const answeredBy = new Map<string, Set<string>>();
  for (const a of childAnswers) answeredBy.set(a.subject_id, (answeredBy.get(a.subject_id) ?? new Set()).add(a.question_id));
  const onceBy = new Map<string, Set<string>>();
  for (const a of onceAnswers) {
    const sub = Array.isArray(a.club_form_submissions) ? a.club_form_submissions[0] : a.club_form_submissions;
    if (sub) onceBy.set(sub.ref, (onceBy.get(sub.ref) ?? new Set()).add(a.question_id));
  }
  const ticksBy = new Map<string, TodoTick[]>();
  for (const t of ticks) {
    ticksBy.set(t.subject_id, [...(ticksBy.get(t.subject_id) ?? []), { documentId: t.document_id, versionId: t.version_id, moved: t.moved, subjectId: t.subject_id }]);
  }

  const versions = read.versions.map(v => ({ id: v.id, versionNo: v.versionNo, ticksStand: v.ticksStand, documentId: v.documentId }));
  const todo = new Map<string, boolean>();
  for (const k of keys) {
    const rows = bySignup.get(k) ?? [];
    const first = rows[0];
    const children: TodoChild[] = rows.map(r => ({ id: r.id, live: liveRow(r), open: answersOpen({ division_id: r.division_id }, teamsMade, finished) }));
    todo.set(k, signupHasFormToDo({
      finished, questions: read.view.questions, documents: read.view.documents, versions, children,
      answered: answeredBy, onceAnswered: onceBy.get(first.signup_ref ?? first.id) ?? new Set(),
      ticks: rows.flatMap(r => ticksBy.get(r.id) ?? []),
    }));
  }

  for (const f of input.families) {
    // The household's first sign-up (the audience's child order) with something to do: one link, never two.
    const anchor = f.regIds.map(id => rowsById.get(id)).find(r => !!r && todo.get(signupKeyOf(r)));
    if (!anchor) continue;
    const url = leaguePayUrl(SITE_URL, { orgSlug: org.slug, seasonSlug: season.slug, registrationId: anchor.id, version: Number(anchor.link_version ?? 0) });
    if (!url) continue;
    for (const a of f.addresses) {
      const to = normalizeGuardianEmail(a);
      if (to && !links.has(to)) links.set(to, url);
    }
  }
  return links;
}

/** The same, failing to NO BUTTON: a read that threw is logged (its code only, never a row) and the email goes without. */
export async function formButtonLinksOrNone(input: Parameters<typeof formButtonLinks>[0]): Promise<Map<string, string>> {
  try {
    return await formButtonLinks(input);
  } catch (e) {
    console.error('[club-form-email-links] the sign-up buttons were not read (the emails go without them):', (e as { code?: string })?.code ?? (e instanceof Error ? e.message : 'no code'));
    return new Map();
  }
}

async function publishedDivisions(seasonId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from('league_divisions').select('id, teams_published_at').eq('season_id', seasonId);
  if (error) throw error;
  return new Set(((data ?? []) as { id: string; teams_published_at: string | null }[]).filter(d => d.teams_published_at).map(d => d.id));
}
