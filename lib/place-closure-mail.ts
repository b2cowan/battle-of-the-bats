import 'server-only';
import { sendEmail } from './email';
import { renderCoachClosureEmail, type CoachMailGame } from './place-closure-mail-words';
import type { RepReach } from './place-closure-window';
import type { OrgRole } from './types';

/**
 * THE REP COACH'S EMAIL, SENT (Club Website Stage 2, K10, K11). One email per marked team, to its head coach, or with no
 * head coach on file to its other coaches; nobody when it has none (the result says so). From "{Club} via FieldLogicHQ",
 * reply-to the admin who pressed (never the club's contact: the coach's question is for that person). The words are
 * `place-closure-mail-words.ts`'s, fixed. Never throws: a failed send is that team's `sent: false`.
 */

export interface CoachMailTeam {
  teamId: string;
  teamName: string;
  reach: RepReach;
  to: { name: string | null; email: string }[];
  /** One entry per GAME: a game marked by two closures of one press (D1) is listed once, with both marks. */
  games: (CoachMailGame & { markIds: string[] })[];
}

const firstName = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] || null;

export async function sendClosureCoachEmails(p: {
  org: { id: string; name: string };
  actor: { id: string; email: string | null; role: OrgRole; name?: string | null };
  kind: 'closed' | 'reopened';
  teams: readonly CoachMailTeam[];
}): Promise<{ teamId: string; sent: boolean; markIds: string[] }[]> {
  const out: { teamId: string; sent: boolean; markIds: string[] }[] = [];
  // ⚖ No address a reply could reach: the email's reply line would be false, so it is not sent (/legal 2B, as the group
  // email's `noSenderAddress`). The result says the team wasn't emailed, so the admin tells it.
  if (!p.actor.email) return p.teams.map(t => ({ teamId: t.teamId, sent: false, markIds: [] }));
  for (const t of p.teams) {
    if (!t.to.length || !t.games.length) { out.push({ teamId: t.teamId, sent: false, markIds: [] }); continue; }
    let any = false;
    for (const person of t.to) {
      try {
        const mail = renderCoachClosureEmail({
          kind: p.kind, club: p.org.name, sender: { name: p.actor.name ?? null, role: p.actor.role },
          recipient: { firstName: firstName(person.name), head: t.reach === 'head' }, team: t.teamName, games: t.games,
        });
        const r = await sendEmail(person.email, mail.subject, mail.html, {
          kind: 'place_closure_coach', orgId: p.org.id, replyTo: p.actor.email ?? null, fromName: mail.fromName, text: mail.text,
        });
        if (r.status === 'sent' || r.status === 'skipped') any = true;
      } catch {
        // Logged by the team only, never an address.
        console.error('[place-closure] a coach email was refused by the transport (team', t.teamId, ')');
      }
    }
    out.push({ teamId: t.teamId, sent: any, markIds: any ? t.games.flatMap(g => g.markIds) : [] });
  }
  return out;
}
