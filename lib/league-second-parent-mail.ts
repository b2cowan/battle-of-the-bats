import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { sendTransactionalEmail } from './platform-email-templates';
import { sendFamilyServiceBatch, type FamilyServiceMessage } from './family-email';
import type { UnloggedEmailKind } from './email-kinds';
import { fetchAllIn } from './supabase-paging';
import { onEveryRegistration, secondParentCopy, secondParentsOf } from './league-second-parent';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SECOND PARENT'S COPY OF EVERY EMAIL ABOUT THE SIGN-UP (Signed-in family accounts Stage 3, Part 4; asks 2 and 4).
 *
 *   Every sender of a house-league sign-up email sends the first parent's message EXACTLY as it did, then hands the same
 *   message here for the household's second address(es), read through `secondParentsOf` (the one recipient rule in
 *   lib/league-second-parent.ts). The second parent's copy:
 *     · is its own message, never a Cc;
 *     · greets "Hi," (no name is asked) — `secondParentCopy` swaps the builder's greeting;
 *     · is ALWAYS the built-in email: a customised template greets the first parent by name;
 *     · rides on the FIRST parent's send: it goes only when the first parent's copy went (sent, or skipped where no mail
 *       service is configured). So "Send again" after a first-parent failure reaches both, never a second copy twice.
 *       A household's "sent" means the FIRST parent was reached: the second copy follows after the row is recorded, and
 *       its own failure is logged only (no retry) — it never changes the first parent's send, the row's status, a
 *       count, or a stamp.
 *   The household is keyed on the first address everywhere; nothing here writes an outbox row or a count.
 *
 *   ⚠ NOT here, on purpose: receipts, refund notices and bank-debit mail follow whoever paid (ask 2). They never call this
 *   module — tests/unit/league-second-parent.test.ts holds that.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Each registration's second address, read once for a send (the outbox rows carry only the first address). */
export async function readSecondParents(registrationIds: readonly string[]): Promise<Map<string, string>> {
  // Chunked and paged: a season-wide send names thousands of registrations, and one long `.in()` would fail the read —
  // which the caller swallows, leaving every second parent silently unreached.
  const rows = await fetchAllIn<{ id: string; guardian_email_2: string | null }>(
    registrationIds.filter(Boolean),
    (chunk, from, to) => supabaseAdmin.from('league_registrations')
      .select('id, guardian_email_2').in('id', chunk).not('guardian_email_2', 'is', null).order('id').range(from, to),
  );
  const out = new Map<string, string>();
  for (const r of rows) if (r.guardian_email_2) out.set(r.id, r.guardian_email_2);
  return out;
}

type TransactionalOpts = Parameters<typeof sendTransactionalEmail>[0];

/**
 * One registration email to both parents: the first parent's send is the caller's, unchanged (its result and its throw
 * are the caller's, as before); then each second address gets the built-in copy, each in its own try.
 */
export async function sendTransactionalToBothParents(
  reg: { guardianEmail: string | null; guardianEmail2?: string | null },
  opts: TransactionalOpts,
): Promise<Awaited<ReturnType<typeof sendTransactionalEmail>>> {
  const first = await sendTransactionalEmail(opts);
  if (went(first)) await sendSecondParentTransactional(reg, opts);
  return first;
}

/** The first parent's copy went (or the mail service is not configured here): the second parent's copy may follow. */
export function went(result: { status: string } | null | undefined): boolean {
  return result?.status === 'sent' || result?.status === 'skipped';
}

/** Only the second parents' copies of a transactional email the caller already sent to the first parent. */
export async function sendSecondParentTransactional(
  reg: { guardianEmail: string | null; guardianEmail2?: string | null },
  opts: TransactionalOpts,
): Promise<void> {
  for (const to of secondParentsOf(reg.guardianEmail, [reg])) {
    try {
      await sendTransactionalEmail({
        ...opts, to, builtInOnly: true, defaultHtml: secondCopyHtml(opts.defaultHtml, opts.key),
        // A once-only key is per message: the second copy must never collide with the first parent's.
        ...(opts.idempotencyKey ? { idempotencyKey: `${opts.idempotencyKey}:second:${to}` } : {}),
      });
    } catch (e) {
      console.error(`[second-parent] ${opts.key} copy failed:`, e instanceof Error ? e.message : String(e));
    }
  }
}

/**
 * The second parent's copy of a built email. If the builder's greeting is not one `secondParentCopy` knows, the swap
 * changes nothing and the copy would greet the first parent by name — it still goes (the family is told), but loudly in
 * the log, so a new builder with a different greeting is found by a person rather than by a parent.
 */
function secondCopyHtml(html: string, label: string): string {
  const copy = secondParentCopy(html);
  if (copy === html) console.error(`[second-parent] ${label}: no greeting to swap — the copy names the first parent`);
  return copy;
}


/**
 * The outbox senders' half (placement, schedule, practice times, practice changes): the households whose first parent's
 * message was just handed to `sendFamilyServiceBatch`, each with its first address and its registrations, and that
 * batch's results in the same order. Only the households whose first copy went are followed. Their second parents'
 * copies go as their OWN batch after the first, so the first batch's index-aligned results — which mark each household's
 * row — are untouched. Never throws: a copy that cannot be read or sent is logged, and the send goes on.
 */
export async function sendSecondParentServiceCopies(params: {
  kind: UnloggedEmailKind;
  fromName: string | null;
  replyTo?: string | null;
  households: readonly { firstEmail: string | null; registrationIds: readonly string[]; message: FamilyServiceMessage }[];
  /** The first batch's results, index-aligned with `households`. */
  results: readonly { status: string }[];
}): Promise<{ household: number; to: string }[]> {
  try {
    const going = params.households.map((h, i) => ({ h, i })).filter(({ i }) => went(params.results[i]));
    if (going.length === 0) return [];
    const seconds = await readSecondParents(going.flatMap(({ h }) => h.registrationIds));
    if (seconds.size === 0) return [];
    const copies = going.flatMap(({ h, i }) =>
      onEveryRegistration(h.firstEmail, h.registrationIds.map(id => seconds.get(id) ?? null))
        .map(to => ({ household: i, message: { to, subject: h.message.subject, html: secondCopyHtml(h.message.html, params.kind) } })));
    if (copies.length === 0) return [];
    const results = await sendFamilyServiceBatch({
      kind: params.kind, messages: copies.map(c => c.message), fromName: params.fromName, replyTo: params.replyTo ?? null,
    });
    const failed = results.filter(r => !went(r)).length;
    if (failed) console.error(`[second-parent] ${params.kind}: ${failed} of ${copies.length} second-parent copies did not send`);
    // Which second parent each household reached (a caller that skips people this send already reached reads it).
    return copies.filter((_c, k) => results[k]?.status === 'sent').map(c => ({ household: c.household, to: c.message.to }));
  } catch (e) {
    console.error(`[second-parent] ${params.kind} copies failed:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}
