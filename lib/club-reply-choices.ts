import 'server-only';
import { familyReplyPlan, usableContactEmail } from './email-club-identity';
import type { ReplyChoices } from './club-group-email-words';

/**
 * CLUB COMMUNICATIONS — WHERE A WINDOW'S REPLIES CAN GO (Stage 1, Session 3; rulings R2–R4, 2026-11-17). The one answer the
 * three windows draw their reply switch and inbox tick from: the club's public contact (R2's default when it has one), the
 * sender's own address, and the choice a window opens on. Read live at every window open, never stored. A window shows the two
 * addresses as its statement does (the club published its own; the sender is shown their own); a record never keeps one.
 */
export function replyChoicesFrom(orgName: string, clubContact: string | null, userEmail: string | null | undefined): ReplyChoices {
  const me = usableContactEmail(userEmail);
  return {
    club: clubContact ? { name: orgName, address: clubContact } : null,
    me: me ? { address: me } : null,
    default: clubContact ? 'club' : 'sender',
  };
}

/** What a family window's preview carries about replies: the switch's two choices and the envelope's reply line in club mode (the sender's own line is the preview's `replyLine`). */
export function replyFacts(orgName: string, clubContact: string | null, userEmail: string | null | undefined): { replies: ReplyChoices; replyLineClub: string | null } {
  return {
    replies: replyChoicesFrom(orgName, clubContact, userEmail),
    replyLineClub: clubContact ? familyReplyPlan({ kind: 'system', clubName: orgName, clubContact }).line : null,
  };
}
