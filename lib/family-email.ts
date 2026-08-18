import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { sendEmail, escapeHtml, type SendEmailResult } from './email';
import { buildGuardianUnsubscribeUrl } from './unsubscribe-token';
import { normalizeGuardianEmail } from './guardian-email';

/**
 * lib/family-email.ts — the ONE way to email a family.
 *
 * CASL compliance for family mail is two rules: never mail an address that opted out, and
 * always carry a working per-family unsubscribe with the sender identified. Before this
 * module those two rules lived inside each sender, which meant they held only for as long as
 * every future sender remembered them. Compliance that depends on remembering is compliance
 * that eventually lapses.
 *
 * So `sendFamilyEmail` is the choke point: it re-checks the suppression list itself and
 * appends the footer itself. A caller CANNOT mail an opted-out family through it, and a
 * caller that reaches for the raw `sendEmail` instead is now a visible mistake rather than an
 * indistinguishable one.
 *
 * Callers that need the suppression list up front (to tell a coach "2 families have
 * unsubscribed" before a send) fetch it once with `getFamilySuppressionList` and hand it
 * back in — the guard still runs, it just does not re-query per recipient.
 *
 * ⚠ WHO IS STILL OUTSIDE THIS DOOR, and why (audited 2026-08-18 — the count is the point, so
 * correct it here if you change one):
 *  - **Dues reminders (4 senders) and tryout offer/waitlist/release.** Deliberate. These are
 *    transactional — a family cannot mute a bill or an offer of a roster spot by unsubscribing
 *    from club announcements (owner ruling 2026-08-18). They identify their sender but skip
 *    the suppression check ON PURPOSE. Do not "fix" them by routing them through here.
 *  - **The free-tier coach's "Email families"** (`lib/basic-coach-announcements.ts`). NOT
 *    deliberate, and NOT fixable by routing it here: `basic_coach_teams` has no `org_id`, and
 *    both the suppression list and the unsubscribe token are keyed on an ORG. A free team has
 *    no org to key against. Closing it needs its own per-team opt-out record — an owner
 *    decision, not a re-route. Until then a paid coach's announcement honours an unsubscribe
 *    and the free-tier one does not, which is the inconsistency to weigh.
 */

/** PostgREST caps an unbounded read at 1000 rows and says nothing about it. Under-reading HERE
 *  means failing to suppress someone who opted out, so every read below is paged to exhaustion
 *  rather than trusted to be short. `.in()` lists are chunked too — that one is a URL-length
 *  limit, not a row limit, and it fails loudly, but chunking costs nothing. */
const IN_CHUNK = 200;
const PAGE_SIZE = 1000;

async function readAllPaged<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Split an id/address list into `.in()`-sized chunks. */
function chunked<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) out.push(items.slice(i, i + IN_CHUNK));
  return out;
}

/** Normalized addresses that have opted out of this org's family email — INCLUDING every other
 *  address belonging to a person who opted out under any one of them.
 *
 *  ⚠ THE EXPANSION IS THE WHOLE POINT (mig 251's recorded Phase-3 warning, closed here
 *  2026-08-18). Opt-outs are filed against an ADDRESS; people change addresses. A parent who
 *  unsubscribed years ago under `old@x` and registers today under `new@y` is the same person and
 *  has already answered. Expanding the set here — rather than asking each sender to look the
 *  person up — is what makes that structural: every caller of `sendFamilyEmail` gets
 *  through-the-person suppression without knowing the concept exists, including callers written
 *  after this comment. The previous design passed the person's addresses in per-call, which held
 *  only for the one door that remembered to do it.
 *
 *  Throws rather than returning empty on error — the send path must FAIL CLOSED. Refusing to
 *  send is a missed message; mailing someone who opted out is a compliance breach, and those
 *  are not the same size of mistake. (Deliberately the opposite posture from the
 *  notification-pause lookup, which fails open because a missed alert is the worse outcome
 *  there.) */
export async function getFamilySuppressionList(orgId: string): Promise<Set<string>> {
  // ⚠ EVERY paged read below is ORDERED, and the ordering column is UNIQUE within the org
  // (`family_email_optouts` is unique on (org_id, email); `org_person_emails` on
  // (org_id, email_normalized)). Page-by-page reads without a deterministic order are not
  // guaranteed to return each row exactly once — a row can shift between requests and be missed
  // by both pages. Here a missed row is an address we fail to suppress, which is the one outcome
  // this module exists to prevent. Paging without ordering is only half of paging.
  const optedOut = await readAllPaged<{ email: string }>((from, to) =>
    supabaseAdmin.from('family_email_optouts')
      .select('email').eq('org_id', orgId).order('email').range(from, to));
  const direct = optedOut.map(row => row.email);
  if (direct.length === 0) return new Set();

  // Which PEOPLE do those addresses belong to? An address nobody has been attached to simply
  // returns no person — it still suppresses itself, via `direct`.
  //
  // Chunks run in PARALLEL: they have no dependency on each other, and this function is also on
  // a page-load path (a coach opening the announcement composer reads the same list to show a
  // reach count), so serialising them would tax a screen, not just a send.
  const personRows = await Promise.all(chunked(direct).map(chunk =>
    readAllPaged<{ person_id: string }>((from, to) =>
      supabaseAdmin.from('org_person_emails')
        .select('person_id').eq('org_id', orgId).in('email_normalized', chunk)
        .order('email_normalized').range(from, to))));
  const personIds = [...new Set(personRows.flat().map(r => r.person_id))];
  if (personIds.length === 0) return new Set(direct);

  // ...and every address those people have ever used, current or former.
  const addressRows = await Promise.all(chunked(personIds).map(chunk =>
    readAllPaged<{ email_normalized: string }>((from, to) =>
      supabaseAdmin.from('org_person_emails')
        .select('email_normalized').eq('org_id', orgId).in('person_id', chunk)
        .order('email_normalized').range(from, to))));
  return new Set([...direct, ...addressRows.flat().map(r => r.email_normalized)]);
}

export interface FamilyEmailContent {
  /** Small uppercase kicker above the title — the team, so a family knows which one. */
  teamName: string;
  /** The organization, named in the footer. CASL requires the sender be identifiable, and
   *  the org is the sender a family recognizes; a team name alone is ambiguous in a club. */
  orgName: string | null;
  title: string;
  /** Plain text. Escaped and newline-converted here — callers never hand-build HTML. */
  body: string;
  /** Optional call to action, e.g. "See the full schedule →". */
  cta?: { href: string; label: string };
  /** Why this family is receiving it, completing "Sent by {org} because …". */
  reason: string;
}

/** The shared envelope. One home for the markup AND for the footer that carries sender
 *  identification plus the unsubscribe link. */
function familyEmailHtml(content: FamilyEmailContent, orgId: string, recipientEmail: string): string {
  const sender = content.orgName ? escapeHtml(content.orgName) : escapeHtml(content.teamName);
  const unsubscribeUrl = buildGuardianUnsubscribeUrl(orgId, recipientEmail);
  const cta = content.cta
    ? `<p style="margin:1.5rem 0 0;"><a href="${content.cta.href}" style="color:#D9F99D;font-weight:700;">${escapeHtml(content.cta.label)}</a></p>`
    : '';
  return `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2rem;border:1px solid rgba(96,165,250,0.25);">
  <div style="margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid rgba(96,165,250,0.18);">
    <span style="font-size:0.72rem;font-weight:900;color:#60A5FA;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(content.teamName)}</span>
  </div>
  <h2 style="margin:0 0 1rem;color:#fff;font-size:1.25rem;line-height:1.3;">${escapeHtml(content.title)}</h2>
  <div style="color:rgba(241,245,249,0.82);font-size:0.95rem;line-height:1.7;">${escapeHtml(content.body)}</div>
  ${cta}
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.45);font-size:0.78rem;line-height:1.5;">
    Sent by ${sender} because ${escapeHtml(content.reason)}.<br>
    <a href="${unsubscribeUrl}" style="color:rgba(241,245,249,0.6);">Unsubscribe from ${sender} emails</a>
  </p>
</div>`;
}

export type FamilySendResult = SendEmailResult | { status: 'suppressed' };

/**
 * Send one family email. The ONLY sanctioned way to mail a guardian or follower.
 *
 * Pass `suppressed` when the caller already loaded the list (a bulk send); omit it and this
 * fetches per recipient. Either way the guard runs — an opted-out address returns
 * `'suppressed'` without a send, so a caller cannot bypass the check by forgetting it.
 *
 * ⚠ SUPPRESSION THROUGH THE PERSON needs nothing from you (rewritten 2026-08-18). An opt-out
 * filed against a FORMER address silences the current one because
 * `getFamilySuppressionList` already expanded the set to every address of every opted-out
 * person — see its comment. This used to be a `personEmails` argument each caller had to
 * remember to pass, which meant it protected exactly the one door that did. There is now
 * nothing to remember and nothing to forget.
 */
export async function sendFamilyEmail(params: {
  orgId: string;
  to: string;
  subject: string;
  content: FamilyEmailContent;
  suppressed?: Set<string>;
}): Promise<FamilySendResult> {
  const to = normalizeGuardianEmail(params.to);
  if (!to) return { status: 'suppressed' };

  const suppressed = params.suppressed ?? (await getFamilySuppressionList(params.orgId));
  if (suppressed.has(to)) return { status: 'suppressed' };

  return sendEmail(to, params.subject, familyEmailHtml(params.content, params.orgId, to));
}
