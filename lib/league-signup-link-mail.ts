import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { escapeHtml } from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { accountNoticeFootnoteHtml } from './family-mail-footer';
import { leaguePayUrl, payLinkSecret } from './league-pay-link';
import { signupStillOwes } from './league-signup-link';
import { SIGNUP_LINK_WORDS as SW, childList } from './league-pay-words';
import { signupLinkClockRanOut } from './house-league-access';
import { registrationReference } from './utils';
import { secondParentsOf, SECOND_PARENT_WORDS } from './league-second-parent';
import { withSecondParentStop } from './league-second-parent-footer';
import { went } from './league-second-parent-mail';

/**
 * "EMAIL ME MY LINK" — WHAT IS SENT (Signed-in family accounts Stage 1 Part 4; drawing tab 2 "the email it sends", tab 5).
 * Every sign-up in this season under the email typed whose link would OPEN (the one door's rules: a finished season's
 * closed link is never sent, a sign-up still owing is), at each sign-up's CURRENT link version — the same link the
 * family already holds, so "Your link has not changed" is true. ONE email to that address, one "Your sign-up" button per
 * sign-up, each named by first names when there is more than one. Nothing matched → nothing sent, and the caller
 * answers the same either way. Children are named by first name only (the email names no one the inbox doesn't own).
 */
type Row = {
  id: string; signup_ref: string | null; player_first_name: string; guardian_first_name: string | null;
  registered_at: string; link_version: number | null; guardian_email_2?: string | null;
};

export async function sendSignupLinks(
  org: ClubEmailOrg & { slug: string },
  season: { id: string; name: string; slug: string },
  email: string,
): Promise<void> {
  // Signed-in family accounts Stage 3: a second parent who types THEIR OWN address gets the links of the sign-ups that
  // carry it (each address only ever receives mail at itself, so this widens no one's reach). Two reads, never an `or`
  // string built from typed text. A second parent is greeted "Hi," (no name is asked).
  const cols = 'id, signup_ref, player_first_name, guardian_first_name, registered_at, link_version';
  const scope = () => supabaseAdmin.from('league_registrations').select(cols).eq('org_id', org.id).eq('season_id', season.id);
  const [asFirst, asSecond] = await Promise.all([scope().eq('guardian_email', email), scope().eq('guardian_email_2', email)]);
  if (asFirst.error) throw asFirst.error;
  if (asSecond.error) throw asSecond.error;
  const byId = new Map<string, Row>();
  for (const r of [...(asFirst.data ?? []), ...(asSecond.data ?? [])] as Row[]) byId.set(r.id, r);
  const rows = [...byId.values()].sort((a, b) => a.registered_at.localeCompare(b.registered_at));
  if (!rows.length) return;
  const asSecondParent = (asSecond.data ?? []).length > 0;

  // A sign-up is its reference (or, for an older registration with none, the one registration): the set the link opens.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.signup_ref ?? r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const { data: seasonRow } = await supabaseAdmin.from('league_seasons').select('status, finished_at').eq('id', season.id).maybeSingle();
  const clockRanOut = signupLinkClockRanOut(seasonRow as { status: string; finished_at: string | null } | null);

  // The one door's rule 3, asked the door's way: a finished season's link stays open only while something is owed (ask 1).
  const open = await Promise.all([...groups.values()].map(kids => !clockRanOut || signupStillOwes(kids[0].id, season.id)));
  const links: { children: string; url: string; reference: string }[] = [];
  [...groups].forEach(([key, kids], i) => {
    const anchor = kids[0];
    if (!open[i]) return;
    const url = leaguePayUrl(appUrl(), { orgSlug: org.slug, seasonSlug: season.slug, registrationId: anchor.id, version: Number(anchor.link_version ?? 0) });
    if (!url) return;
    links.push({
      children: childList(kids.map(k => k.player_first_name)),
      url,
      reference: anchor.signup_ref ?? registrationReference(key),
    });
  });
  if (!links.length) return;

  const M = SW.mail;
  const parts: string[] = [];
  if (links.length === 1) {
    parts.push(
      warmEmailParagraph(escapeHtml(M.body(links[0].children, season.name))),
      warmEmailButton(escapeHtml(M.button), escapeHtml(links[0].url)),
      warmEmailSmall(escapeHtml(M.notYou)),
      warmEmailSmall(escapeHtml(M.reference(links[0].reference))),
    );
  } else {
    parts.push(warmEmailParagraph(escapeHtml(M.bodyMany(season.name))));
    for (const l of links) {
      parts.push(
        warmEmailParagraph(`<strong>${escapeHtml(M.forChildren(l.children))}</strong>`),
        warmEmailButton(escapeHtml(M.button), escapeHtml(l.url)),
        warmEmailSmall(escapeHtml(M.reference(l.reference))),
      );
    }
    parts.push(warmEmailSmall(escapeHtml(M.notYou)));
  }
  await sendLinkNotice(org, {
    key: 'league_signup_link', to: email, seasonName: season.name, heading: M.heading, subject: M.subject(season.name),
    because: M.because, first: asSecondParent ? null : rows[0].guardian_first_name, secondParent: asSecondParent, parts,
  });
}

/**
 * "SEND A NEW LINK" — THE CLUB REPLACES A FAMILY'S LINK (Signed-in family accounts Stage 1 Part 6; drawing tab 4; asks 4
 * and 6). The sign-up's link version moves on for EVERY child on it in ONE update, so the old link stops at once for the
 * brothers and sisters too (a sibling's own placement link is the same version), and `link_replaced_at` writes each
 * child's history line. Then one email, to the address on the registration, carries the new link. All of a sign-up's
 * rows are made together and only this moves them, so they share one version; the next is one past the highest.
 * Refused, writing nothing, when there is no address or no link can be signed here (never a stopped link with no new one).
 */
export async function replaceSignupLink(
  org: ClubEmailOrg & { slug: string },
  season: { id: string; name: string; slug: string },
  registrationId: string,
): Promise<{ sentTo: string } | { error: 'no_email' | 'no_secret' | 'not_found' | 'send_failed' }> {
  if (!payLinkSecret()) return { error: 'no_secret' };
  const { data: anchor, error } = await supabaseAdmin.from('league_registrations')
    .select('id, signup_ref, guardian_email').eq('id', registrationId).eq('org_id', org.id).eq('season_id', season.id).maybeSingle();
  if (error) throw error;
  if (!anchor) return { error: 'not_found' };
  const email = (anchor.guardian_email as string | null)?.trim();
  if (!email) return { error: 'no_email' };

  // The door's set (`signupRowsFromAnchor`): the same reference AND family email, or the one registration.
  let q = supabaseAdmin.from('league_registrations').select('id, signup_ref, player_first_name, guardian_first_name, guardian_email_2, link_version')
    .eq('org_id', org.id).eq('season_id', season.id);
  q = anchor.signup_ref ? q.eq('signup_ref', anchor.signup_ref as string).eq('guardian_email', anchor.guardian_email as string) : q.eq('id', anchor.id as string);
  const { data: kidsData, error: kidsError } = await q.order('registered_at', { ascending: true });
  if (kidsError) throw kidsError;
  const kids = (kidsData ?? []) as Row[];
  if (!kids.length) return { error: 'not_found' };

  const version = Math.max(...kids.map(k => Number(k.link_version ?? 0))) + 1;
  const { error: upError } = await supabaseAdmin.from('league_registrations')
    .update({ link_version: version, link_replaced_at: new Date().toISOString() }).in('id', kids.map(k => k.id));
  if (upError) throw upError;

  const url = leaguePayUrl(appUrl(), { orgSlug: org.slug, seasonSlug: season.slug, registrationId, version })!;
  const M = SW.mail;
  const R = SW.replacedMail;
  // The old link is already stopped: a send that throws (a network error) is the same plain "couldn't send, try again"
  // as a refused one, never the route's generic 500 (/review). Pressing again mints the next version.
  const notice = {
    key: 'league_signup_link_replaced' as const, seasonName: season.name, heading: R.heading, subject: R.subject(season.name),
    because: R.because, parts: [
      warmEmailParagraph(escapeHtml(R.body(org.name, childList(kids.map(k => k.player_first_name)), season.name))),
      warmEmailButton(escapeHtml(M.button), escapeHtml(url)),
      warmEmailSmall(escapeHtml(M.reference((anchor.signup_ref as string | null) ?? registrationReference(registrationId)))),
    ],
  };
  const sent = await sendLinkNotice(org, { ...notice, to: email, first: kids[0].guardian_first_name }).catch(() => null);
  // Signed-in family accounts Stage 3 (ask 2): the second parent gets the new link too, its own message, greeted "Hi,".
  // Its failure is logged and never changes the answer (the first parent's send decides "sent" / "couldn't send").
  if (went(sent)) {
    for (const to of secondParentsOf(email, kids.map(k => ({ guardianEmail2: k.guardian_email_2 ?? null })))) {
      await sendLinkNotice(org, { ...notice, to, first: null, secondParent: true })
        .catch(e => console.error('[signup-link] second parent copy failed:', e instanceof Error ? e.message : String(e)));
    }
  }
  return !sent || sent.status === 'provider_error' ? { error: 'send_failed' } : { sentTo: email };
}

/**
 * Both emails are ACCOUNT notices like the sign-up confirmation (the same transactional door and footnote): never on the
 * unsubscribe list, they name the club and say why they came. Heading, "Hi", the caller's own lines, the footnote. No
 * stored template exists for either key, so this HTML is what is sent.
 */
async function sendLinkNotice(org: ClubEmailOrg, n: {
  key: 'league_signup_link' | 'league_signup_link_replaced'; to: string; seasonName: string; heading: string; subject: string;
  because: string; first: string | null; parts: string[];
  /** Signed-in family accounts Stage 3: the second parent's copy, greeted "Hi," (no name is asked). */
  secondParent?: boolean;
}) {
  const face = await systemMailFace(org);
  const first = n.first?.trim();
  const built = warmEmailDocument([
    warmEmailHeading(escapeHtml(n.heading)),
    n.secondParent ? warmEmailParagraph(escapeHtml(SECOND_PARENT_WORDS.greeting))
      : first ? warmEmailParagraph(escapeHtml(SW.mail.hi(first))) : '',
    ...n.parts,
    accountNoticeFootnoteHtml({ clubName: org.name, reason: n.because, replyLine: face?.replyLine ?? null }),
  ].filter(Boolean).join('\n'), face?.club ?? null);
  // The second parent's copy carries the Stop button (Stage 3b, Part 4); the first parent's gets nothing new (O5).
  const html = n.secondParent ? withSecondParentStop(built, org.id, n.to) : built;
  return sendTransactionalEmail({
    key: n.key,
    to: n.to,
    vars: { seasonName: n.seasonName },
    defaultSubject: n.subject,
    defaultHtml: html,
    family: face ? { face, reason: n.because } : undefined,
    // A customised template would drop the "Hi," and the Stop footer, as every other second-parent copy refuses (Stage 3b).
    builtInOnly: n.secondParent === true,
  });
}

/** `leaguePayUrl` strips a trailing slash itself. */
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
