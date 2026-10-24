/**
 * lib/email-family-template-sample.ts — the club a FAMILY template is shown wearing, where there is no real club to read:
 * the platform-admin template editor's live preview and its test-send (The public face, warm: S3b).
 *
 * Six template keys are family emails — the five house-league registration notices and the tryout receipt. They wear their
 * club's band and foot when sent (lib/platform-email-templates.ts `family`), so the editor shows them in the same card, on a
 * made-up club, and an operator sees what a family will. Pure: the editor is a client component.
 */
import { accountNoticeFootnoteHtml } from './family-mail-footer';
import { familyReplyPlan, type ClubEmailFacts } from './email-club-identity';

/** The made-up club. Colours are the Ocean preset's, spelled as a custom pair so no preset lookup is needed. */
export const SAMPLE_FAMILY_CLUB: ClubEmailFacts = {
  name: 'Riverdale Minor Ball',
  themePrimary: '#075985',
  themeAccent: '#38BDF8',
};

/** Each family template key, and the reason its footnote completes "Sent by {club} because …" with. */
const FAMILY_TEMPLATE_REASONS: Record<string, string> = {
  league_registration_approved: 'Alex was registered for Fall 2026',
  league_registration_pending: 'Alex was registered for Fall 2026',
  league_registration_waitlisted: 'Alex was registered for Fall 2026',
  league_waitlist_promoted: 'Alex was registered for Fall 2026',
  league_registration_declined: 'Alex was registered for Fall 2026',
  tryout_application_received: 'Alex applied for a tryout with 12U AAA 2026-27',
};

export function isFamilyTemplateKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(FAMILY_TEMPLATE_REASONS, key);
}

/** The club and the footnote a family template previews with; null for every other key. */
export function familyTemplateSample(key: string): { club: ClubEmailFacts; footerHtml: string } | null {
  if (!isFamilyTemplateKey(key)) return null;
  const reply = familyReplyPlan({ kind: 'system', clubName: SAMPLE_FAMILY_CLUB.name, clubContact: null });
  return {
    club: SAMPLE_FAMILY_CLUB,
    footerHtml: accountNoticeFootnoteHtml({ clubName: SAMPLE_FAMILY_CLUB.name, reason: FAMILY_TEMPLATE_REASONS[key], replyLine: reply.line }),
  };
}
