/**
 * CLUB COMMUNICATIONS — THE WORDS (Stage 1). Every sentence the club's email to its coaches and its board says, and every
 * new sentence the Communications engine adds to family email (the reply choice, the club-inbox copy, the clock), in ONE
 * block so the Close's /marketing pass is one read.
 *
 * Spec: docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md, "Build-prompt checklist 2026-11-16" §2b and "Addendum 2026-11-17"
 * (the both-modes table). ⚖ The From, the sender line, the reply line, the reason lines, the removal line and the foot are
 * PINNED by the build guard (tests/unit/club-group-email-guard.test.ts): /marketing may reword the windows' words, never
 * reduce what a pinned line states. Never "notice", "formal notice" or "directors" for the board (legal §2b).
 *
 * Client-safe and pure: the windows (Session 3) and the guard test import this; the sender renders through it. It imports no
 * family module (legal §2a.4: colleague mail never wears the family envelope).
 */
import { warmEmailDocument } from './email-envelope-warm';
import { familySenderName, platformLineWords } from './email-club-identity';
import { roleWithArticle } from './board-people';
import { ROLE_LABEL } from './member-access';
import { possessive } from './utils';
import type { OrgRole } from './types';

export type ColleagueKind = 'coaches' | 'board';
/** R2: 'club' = replies to the club's public contact and the email names the club; 'sender' = to the sender. */
export type ReplyMode = 'club' | 'sender';
/** Why a person got it, from their OWN role (legal C8) — never from the group label. */
export type ColleagueBasis = 'rep_staff' | 'house_league' | 'picked' | 'board';

export const BOARD_SEATS = ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer'] as const satisfies readonly OrgRole[];
export type BoardSeat = (typeof BOARD_SEATS)[number];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ── The email itself (pinned) ─────────────────────────────────────────────────────────────────────────────────────────────

export const MAIL = {
  greeting: (first: string | null) => (first ? `Hi ${first},` : 'Hi,'),
  /** {Sender} ({Role}, {Club}) sent this. — or, in club mode, {Club} sent this. (C5: every colleague kind.) */
  senderLine: (mode: ReplyMode, club: string, sender: { name: string; role: OrgRole }) =>
    mode === 'club' ? `${club} sent this.` : `${sender.name} (${ROLE_LABEL[sender.role]}, ${club}) sent this.`,
  replyLine: (mode: ReplyMode, club: string, senderName: string) =>
    `Reply to this email to reach ${mode === 'club' ? club : senderName}.`,
  removalLine: (mode: ReplyMode, club: string, senderName: string) =>
    `Not right for you? Reply and tell ${mode === 'club' ? club : senderName}.`,
  reason: {
    rep_staff: (club: string) => `You get it because you're on ${possessive(club)} coaching staff.`,
    house_league: (club: string) => `You get it because you coach in ${possessive(club)} house league.`,
    picked: (mode: ReplyMode, club: string, senderName: string) =>
      mode === 'club' ? `You get it because ${club} picked you for this email.` : `You get it because ${senderName} picked you.`,
    /** Built ONLY from a seat in BOARD_SEATS: a role outside it throws (legal §2a.7, T3). */
    board: (club: string, role: string) => {
      if (!(BOARD_SEATS as readonly string[]).includes(role)) throw new Error(`not a board seat: ${role}`);
      return `You get it because you're on ${possessive(club)} board in FieldLogicHQ, as ${roleWithArticle(role)}.`;
    },
  },
  /** "Sent through FieldLogicHQ, the software {Club} uses." — plain text, no link (legal §2b). */
  foot: (club: string) => { const w = platformLineWords(club); return `${w.lead}FieldLogicHQ${w.tail}`; },
  from: (club: string) => familySenderName(club),
};

export interface ColleagueMailInput {
  club: string;
  mode: ReplyMode;
  sender: { name: string; role: OrgRole };
  recipient: { firstName: string | null; basis: ColleagueBasis; boardRole: string | null };
  subject: string;
  body: string;
}

/** The reason line for one recipient, from their own basis (C8). */
export function reasonLine(i: Pick<ColleagueMailInput, 'club' | 'mode' | 'sender' | 'recipient'>): string {
  const { club, mode, sender, recipient: r } = i;
  if (r.basis === 'board') return MAIL.reason.board(club, r.boardRole ?? '');
  if (r.basis === 'picked') return MAIL.reason.picked(mode, club, sender.name);
  return r.basis === 'rep_staff' ? MAIL.reason.rep_staff(club) : MAIL.reason.house_league(club);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The sender's own message, as paragraphs: blank lines split them, single line breaks are kept. Never scanned (legal). */
function bodyParagraphs(body: string): string[] {
  return body.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

/**
 * One colleague email, rendered: the plain warm card (no club band, no family footer, no unsubscribe). Structurally it
 * CANNOT carry a link: nothing here writes an anchor, and every word is escaped (legal §2a.3, T1).
 */
export function renderColleagueEmail(i: ColleagueMailInput): { subject: string; html: string; text: string; fromName: string } {
  const lines = [
    `${MAIL.senderLine(i.mode, i.club, i.sender)} ${MAIL.replyLine(i.mode, i.club, i.sender.name)}`,
    reasonLine(i),
    MAIL.removalLine(i.mode, i.club, i.sender.name),
  ];
  const foot = MAIL.foot(i.club);
  const paras = bodyParagraphs(i.body);
  const p = (t: string) => `<p style="margin:0 0 0.75rem;white-space:pre-line;">${esc(t)}</p>`;
  const small = (t: string) => `<p style="margin:0 0 0.35rem;font-size:0.85rem;">${esc(t)}</p>`;
  const html = warmEmailDocument(
    `${p(MAIL.greeting(i.recipient.firstName))}${paras.map(p).join('')}`
    + `<div style="margin-top:1.25rem;">${lines.map(small).join('')}${small(foot)}</div>`,
  );
  const text = [MAIL.greeting(i.recipient.firstName), ...paras, '', ...lines, foot].join('\n\n');
  return { subject: i.subject, html, text, fromName: MAIL.from(i.club) };
}

/** The club-inbox copy of a coach email (R4): a colleague copy to the club itself. Never the board (legal addendum 6a). */
export function renderInboxCopy(i: { club: string; mode: ReplyMode; senderName: string; groupLabel: string; reached: number; subject: string; body: string }): { subject: string; html: string } {
  const p = (t: string) => `<p style="margin:0 0 0.75rem;white-space:pre-line;">${esc(t)}</p>`;
  const lead = INBOX_COPY.coachLead(i.club, i.reached, i.groupLabel);
  const html = warmEmailDocument(
    `${p(lead)}${p(`${INBOX_COPY.subjectLabel}: ${i.subject}`)}${bodyParagraphs(i.body).map(p).join('')}`
    + `${p(MAIL.replyLine(i.mode, i.club, i.senderName))}<p style="margin:1rem 0 0;font-size:0.85rem;">${esc(MAIL.foot(i.club))}</p>`,
  );
  return { subject: INBOX_COPY.subject(i.subject), html };
}

export const INBOX_COPY = {
  subject: (s: string) => `Copy: ${s}`,
  subjectLabel: 'Subject',
  coachLead: (club: string, n: number, label: string) => `${club} emailed ${plural(n, 'coach', 'coaches')} (${label}). This is the copy for the club's inbox.`,
  familyLead: (club: string, n: number, label: string) => `${club} emailed ${plural(n, 'family', 'families')} (${label}). This is the copy for the club's inbox.`,
};

// ── Groups, lines and names ───────────────────────────────────────────────────────────────────────────────────────────────

export const GROUP = {
  coachesAll: 'All coaches',
  coachesAllSub: 'Rep team staff and house-league coaches, each person once',
  repStaff: 'Rep coaches',
  repStaffSub: "Head coaches, assistants and managers of every rep team that isn't archived",
  repEveryone: 'Everyone on the staff',
  repHeadOnly: 'Head coaches only',
  repHeadLabel: 'Rep coaches · head coaches',
  league: 'House-league coaches',
  leagueLabel: (season: string, division?: string | null) => division ? `House-league coaches · ${season} · ${division}` : `House-league coaches · ${season}`,
  everyDivision: 'Every division',
  picked: 'Coaches you pick',
  pickedSub: 'Tick the people',
  pickNote: "For this email only. The pick isn't saved.",
  pickedLabel: (n: number) => `${plural(n, 'coach', 'coaches')} you picked`,
  boardAll: 'Everyone on the board',
  boardAllSub: 'Everyone on Organization › The board: owner, admins, league admins, league registrars and treasurer. People with an account only.',
  boardPicked: 'Board members you pick',
  boardPickedSub: 'Pick from the people on Organization › The board',
  boardLabel: 'The board',
  boardPickedLabel: (n: number) => `${plural(n, 'board member', 'board members')} you picked`,
  noCoachesYet: 'No coaches yet',
};

export const LINES = {
  repTeam: (team: string, word: string) => `${team} · ${word}`,
  leagueTeam: (team: string, division: string | null) => division ? `House league · ${team}, ${division}` : `House league · ${team}`,
  invited: (team: string, word: string) => `${team} · ${word} (invitation not accepted)`,
  seat: (role: OrgRole) => ROLE_LABEL[role],
};

export const NAMELESS = {
  coach: 'A coach',
  boardMember: (role: OrgRole) => `A board member (${ROLE_LABEL[role].toLowerCase()})`,
};

// ── The windows (Session 3 renders them; the engine's responses carry the facts) ─────────────────────────────────────────

export const WINDOW = {
  coachStatement: (mode: ReplyMode, club: string, address: string) => mode === 'club'
    ? `Emails each coach you pick, one email each. Replies go to ${club} at ${address}.`
    : `Emails each coach you pick, one email each. Replies come to you at ${address}.`,
  coachStatementPhone: (mode: ReplyMode) => mode === 'club'
    ? 'Emails each coach you pick. Replies go to the club.' : 'Emails each coach you pick. Replies come to you.',
  boardStatement: (mode: ReplyMode, club: string, address: string) => mode === 'club'
    ? `Emails each board member you pick, from the club, one email each. Replies go to ${club} at ${address}.`
    : `Emails each board member you pick, from the club, one email each. Replies come to you at ${address}.`,
  familyStatementClub: "Sends one email to each family you choose, from the club, with the club's address to reply to. A family that opted out of club email is skipped.",
  replyClub: (club: string) => `Replies go to ${club}`,
  replyMe: 'Replies come to me',
  copyTick: (address: string) => `Send a copy to the club's inbox (${address})`,
  notToPromote: "Keep it to the club's own business. Don't use this to sell or promote anything, for you or for a sponsor.",
  /** The readers line, corrected per legal C7: it promises no names to a registrar. */
  readers: "The club's owner and admins can read this in Communications and see who it reached. League admins and registrars can read it too when it reaches house-league families or coaches.",
  boardReaders: "Everyone you send this to, and the club's owner and admins, can read it afterwards. Leave out a child's or a family's details unless everyone on the board should see them.",
  coachFoot: (n: number) => `${plural(n, 'coach gets', 'coaches get')} it.`,
  boardFoot: (n: number) => `${plural(n, 'board member gets', 'board members get')} it. You aren't counted.`,
  invitedCoaches: (m: number) => m === 1 ? "1 invited coach hasn't accepted yet and won't." : `${m} invited coaches haven't accepted yet and won't.`,
  invitedMembers: (m: number) => m === 1 ? "1 invited member hasn't accepted yet and won't." : `${m} invited members haven't accepted yet and won't.`,
  noAddressCoaches: (m: number) => m === 1 ? "1 coach has no email on file and won't get it." : `${m} coaches have no email on file and won't get it.`,
};

// ── Refusals and states (the routes' error words) ────────────────────────────────────────────────────────────────────────

export const SAY = {
  failed: "That couldn't be sent. Try again.",
  notOffered: "You can't email this group.",
  noPlace: "Group email isn't open to you here.",
  needName: 'Add your name to your account before you send this. Emails from the club say who sent them.',
  needSubject: 'Add a subject.',
  needMessage: 'Write a message.',
  tooLong: 'The subject can be up to 200 characters and the message up to 5,000.',
  pickCoaches: 'Tick at least one coach.',
  pickMembers: 'Tick at least one board member.',
  pickSeason: 'Choose a season.',
  seasonGone: "That season isn't under way any more, so its coaches can't be emailed from here. Nothing was sent.",
  nobodyCoaches: 'Nobody to send to. Pick a group with coaches.',
  nobodyBoard: 'Nobody else is on the board yet, so there is nobody to send this to.',
  noSenderAddress: "Your account has no email address a reply could reach, so this can't be sent.",
  noClubContact: "The club has no contact email on its public site, so replies can't go to the club. Choose Replies come to me, or add the address on the public site.",
  bothPaths: 'Families and coaches are emailed from their own windows. Send this to one group at a time.',
  justSent: 'This was just sent. Check Last sent before sending it again.',
  lostRight: 'You can no longer send this. Nothing was sent.',
  notDelivered: "It wasn't sent: the mail service didn't accept it for anyone. Try again in a few minutes.",
  /** The recount (coach ask 11): nothing is sent when anyone was added or taken off, even at the same total. */
  changed: (kind: ColleagueKind, now: number, before: number, changes: string | null) => {
    const who = kind === 'board' ? plural(now, 'board member', 'board members') : plural(now, 'coach', 'coaches');
    const lead = 'Who this reaches changed while you were writing.';
    const tail = 'Nothing was sent. Check it and send again.';
    if (!changes) return `${lead} It now goes to ${who}. See who gets it. ${tail}`;
    return now === before
      ? `${lead} It still goes to ${who}, but ${changes}. ${tail}`
      : `${lead} It now goes to ${who}: ${changes}. ${tail}`;
  },
  added: (name: string) => `${name} was added`,
  takenOff: (name: string) => `${name} was taken off`,
  notStopped: "This email isn't stopped, so there's nobody to send it to again.",
  wordsGone: "Its words were deleted 12 months after it was sent, so it can't be sent again.",
  namesGone: "Who it went to was deleted 24 months after it was sent, so it can't be sent to the same people again.",
  finishWho: (kind: ColleagueKind, sender: string | null) => kind === 'board'
    ? `${sender ?? 'The sender'}, the owner or an admin can send it to the ones it missed.`
    : `${sender ?? 'The sender'} or an admin can send it to the ones it missed.`,
  notFound: 'Not found',
};

// ── The record ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export const RECORD = {
  note: "Sent means the mail service accepted it. It can't tell whether it was read. People are named as they were when it went.",
  outsideRep: (n: number) => plural(n, 'rep coach', 'rep coaches'),
  outsideRepSub: 'Names are shown only to people who send to rep coaches',
  copySent: "A copy went to the club's inbox.",
  copyFailed: "A copy to the club's inbox didn't go.",
  copyListed: "The club's inbox was already on the list.",
  repliesWent: (to: string) => `Replies went to ${to}`,
  wordsCleared: 'The subject and message were deleted 12 months after it was sent.',
  namesCleared: 'Who it went to was deleted 24 months after it was sent.',
  sendAgain: 'Send again to these people',
};
