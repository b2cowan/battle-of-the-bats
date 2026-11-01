import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { escapeHtml } from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { systemMailFace, type ClubEmailOrg } from './club-email-context';
import { warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { accountNoticeFootnoteHtml } from './family-mail-footer';
import { leaguePayUrl } from './league-pay-link';
import { signupStillOwes } from './league-signup-link';
import { SIGNUP_LINK_WORDS as SW, childList } from './league-pay-words';
import { signupLinkClockRanOut } from './house-league-access';
import { registrationReference } from './utils';

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
  registered_at: string; link_version: number | null;
};

export async function sendSignupLinks(
  org: ClubEmailOrg & { slug: string },
  season: { id: string; name: string; slug: string },
  email: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select('id, signup_ref, player_first_name, guardian_first_name, registered_at, link_version')
    .eq('org_id', org.id).eq('season_id', season.id).eq('guardian_email', email)
    .order('registered_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return;

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

  const face = await systemMailFace(org);
  const first = rows[0].guardian_first_name?.trim();
  const M = SW.mail;
  const parts = [
    warmEmailHeading(escapeHtml(M.heading)),
    first ? warmEmailParagraph(escapeHtml(M.hi(first))) : '',
  ];
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
  parts.push(accountNoticeFootnoteHtml({ clubName: org.name, reason: M.because, replyLine: face?.replyLine ?? null }));

  const html = warmEmailDocument(parts.filter(Boolean).join('\n'), face?.club ?? null);
  // An ACCOUNT notice like the sign-up confirmation (the same transactional door and footnote): never on the unsubscribe
  // list, it names the club and says why it came. No stored template exists for the key, so this HTML is what is sent.
  await sendTransactionalEmail({
    key: 'league_signup_link',
    to: email,
    vars: { seasonName: season.name },
    defaultSubject: M.subject(season.name),
    defaultHtml: html,
    family: face ? { face, reason: M.because } : undefined,
  });
}

/** `leaguePayUrl` strips a trailing slash itself. */
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
