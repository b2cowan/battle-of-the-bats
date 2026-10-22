import 'server-only';
import { inParallel } from './supabase-paging';
import { loadHeadCoaches } from './club-team-board';
import { emailHtml } from './club-schedule-send';
import type { EmailWords } from './club-schedule-words';
import { sendEmail } from './email';
import { normalizeGuardianEmail } from './guardian-email';
import { FAMILY_EMAIL_WORDS as W } from './families-words';

/**
 * EMAIL FAMILIES' COPY TO THE HEAD COACHES (Club Tier Stage 7c; owner 2026-10-22, Put to the owner 5). ⚠ COLLEAGUE MAIL,
 * a file of its own on purpose: the family send (lib/families-email.ts) is a GUARDED sender in the family-email manifest
 * and may never call the raw transport, and this copy must never wear the family envelope (no family footer, no
 * unsubscribe — a coach copied is not a family on a list). It goes the way the club already reaches coaches (Ask the
 * coaches, the scheduler's send): house mail, replies to the sender, a few at a time.
 *
 *   · each head coach ONCE, however many of the audience's teams they coach;
 *   · never the sender;
 *   · never a head coach who is also a guardian the send reaches — they get the family copy only.
 */

interface CopiedCoach { userId: string; name: string | null; email: string }

/** The head coaches a copy goes to, for the teams the audience names. `familyAddresses`: every address the family send
 *  reaches (a coach who is one of them is a parent first). */
export async function headCoachesToCopy(orgId: string, teamIds: readonly string[], senderId: string, familyAddresses: ReadonlySet<string>): Promise<CopiedCoach[]> {
  if (teamIds.length === 0) return [];
  const heads = await loadHeadCoaches(orgId, teamIds);
  const byEmail = new Map<string, CopiedCoach>();
  for (const teamId of teamIds) {
    for (const p of heads.get(teamId)?.people ?? []) {
      const email = normalizeGuardianEmail(p.email);
      if (!email ||p.userId === senderId || familyAddresses.has(email) || byEmail.has(email)) continue;
      byEmail.set(email, { userId: p.userId, name: p.name, email });
    }
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/** The copy's words. */
export function coachCopyWords(o: { orgName: string; audience: string; families: number; subject: string; body: string; sender: string; coachName: string | null }): EmailWords {
  return {
    subject: W.coachSubject(o.subject),
    greeting: W.coachGreeting(o.coachName?.split(' ')[0] ?? null),
    paragraphs: [W.coachLead(o.orgName, o.audience, o.families), o.subject, ...o.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)],
    lists: [],
    link: null,
    outro: W.coachOutro(o.sender),
  };
}

/** Send the copies. Returns how many went. A transport that throws is one copy that didn't go, never an escaped error:
 *  the family send has already gone, and its log row must still be completed. */
export async function sendCoachCopies(coaches: readonly CopiedCoach[], words: (coach: CopiedCoach) => EmailWords, replyTo: string | null): Promise<number> {
  const results = await inParallel(coaches, 5, async c => {
    const w = words(c);
    try { return await sendEmail(c.email, w.subject, emailHtml(w), { replyTo }); }
    catch (e) { console.error('[families-email] a head coach copy threw:', e); return { status: 'provider_error' as const }; }
  });
  return results.filter(r => r.status === 'sent' || r.status === 'skipped').length;
}
