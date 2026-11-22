/**
 * CLUB COMMUNICATIONS STAGE 1, SESSION 3 — THE WINDOWS (legal checklist T22 for the two colleague windows, the reply choice
 * R2–R4 in all three, New email's menu rules, Send again). The engine's rules are pinned by `club-group-email-guard.test.ts`
 * and the place's by `club-communications-place.test.ts`; this file pins what the SCREENS draw from them — read as code, with
 * comments stripped (`_source-code.ts`), so a guard cannot pass on prose.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { GROUP, MAIL, PLACE, RECORD, SAY, WINDOW } from '../../lib/club-group-email-words.ts';

const colleague = readCode('components/admin/kit/club/communications/EmailColleaguesWindow.tsx');
const family = readCode('components/admin/kit/club/families/EmailFamiliesWindow.tsx');
const screen = readCode('components/admin/kit/club/communications/CommunicationsScreen.tsx');
const record = readCode('components/admin/kit/club/communications/ColleagueRecord.tsx');
const reply = readCode('components/admin/kit/club/communications/ReplyParts.tsx');

describe('T22 · the colleague windows’ lines under the message box', () => {
  it('the coach window says who can read it, and what it is not for', () => {
    assert.match(colleague, /board \? CW\.boardReaders : CW\.readers/);
    assert.match(colleague, /CW\.notToPromote/);
  });
  it('the readers line promises a registrar no names (C7) and the board line says who reads it', () => {
    assert.doesNotMatch(WINDOW.readers, /names|who they|family’s details/i);
    assert.match(WINDOW.readers, /owner and admins can read this in Communications and see who it reached/);
    assert.match(WINDOW.boardReaders, /Everyone you send this to, and the club's owner and admins, can read it afterwards/);
    assert.match(WINDOW.boardReaders, /Leave out a child's or a family's details/);
    assert.match(WINDOW.notToPromote, /Don't use this to sell or promote anything/);
  });
  it('the board is never called notice, formal notice or directors, in any new sentence', () => {
    const all = JSON.stringify([GROUP, WINDOW, PLACE, RECORD]) + [WINDOW.boardStatement('club', 'C', 'a@b.c'), WINDOW.boardStatement('sender', 'C', 'a@b.c')].join(' ');
    assert.doesNotMatch(all, /\bnotice\b|formal notice|director/i);
  });
  it('the family window keeps its readers line', () => {
    assert.match(family, /<p className=\{ck\.hint\}>\{CW\.readers\}<\/p>/);
  });
});

describe('R2–R4 · the reply choice, the same in all three windows', () => {
  it('every window draws the one ReplyChoice and sends its fields', () => {
    assert.match(family, /<ReplyChoice idBase="email-families"/);
    assert.match(colleague, /<ReplyChoice idBase="email-colleagues"/);
    assert.equal((family.match(/\.\.\.reply\.fields|\.\.\.\(one \? \{\} : reply\.fields\)/g) ?? []).length, 2, 'the club door and the season door both carry it');
    assert.match(colleague, /\.\.\.reply\.fields/);
  });
  it('the inbox copy is offered on the family and coach windows and never on the board’s (legal addendum 6a)', () => {
    assert.match(colleague, /offerCopy=\{!board && options\.copy\}/);
    assert.match(family, /state=\{reply\} offerCopy \/>/);
  });
  it('the board opens on "Replies come to me" (owner 2026-11-20); the other two on the server’s default (the club when it has a contact)', () => {
    assert.match(colleague, /useReplyChoice\(options\?\.replies \?\? null, board \? 'sender' : undefined\)/);
    assert.match(family, /const replies = \(season \? sPreview\?\.replies : preview\?\.replies\) \?\? null;\s+const reply = useReplyChoice\(replies\)/);
    assert.match(reply, /picked \?\? openOn \?\? replies\?\.default \?\? 'sender'/);
  });
  it('a club with no public contact draws nothing and sends nothing extra: the server replies to the sender', () => {
    assert.match(reply, /fields: replies\?\.club \? \{ replyTo: mode/);
    assert.match(reply, /if \(!club\) return null;/);
  });
  it('a message to one family keeps its own rule: no switch, no fields (the one-family send ignores them)', () => {
    assert.match(family, /!one && replies &&/);
    assert.match(family, /\.\.\.\(one \? \{\} : reply\.fields\)/);
  });
  it('each window states where replies go in both modes (the addendum’s table)', () => {
    assert.equal(WINDOW.coachStatement('club', 'Harbourtown', 'hello@x.ca'), 'Emails each coach you pick, one email each. Replies go to Harbourtown at hello@x.ca.');
    assert.equal(WINDOW.coachStatement('sender', 'Harbourtown', 'me@x.ca'), 'Emails each coach you pick, one email each. Replies come to you at me@x.ca.');
    assert.equal(WINDOW.coachStatementPhone('club'), 'Emails each coach you pick. Replies go to the club.');
    assert.equal(WINDOW.boardStatement('club', 'Harbourtown', 'hello@x.ca'), 'Emails each board member you pick, from the club, one email each. Replies go to Harbourtown at hello@x.ca.');
    assert.equal(WINDOW.boardStatement('sender', 'Harbourtown', 'me@x.ca'), 'Emails each board member you pick, from the club, one email each. Replies come to you at me@x.ca.');
    assert.match(WINDOW.familyStatementClub, /with the club's address to reply to/);
    assert.match(WINDOW.familyStatementSeasonClub('Fall 2026'), /in Fall 2026, from the club, with the club's address to reply to/);
    assert.match(family, /reply\.mode === 'club' \? CW\.familyStatementClub : W\.statement/);
  });
  it('the switch and the tick are labelled by where replies go, as the table says', () => {
    assert.equal(WINDOW.replyClub('Harbourtown'), 'Replies go to Harbourtown');
    assert.equal(WINDOW.replyMe, 'Replies come to me');
    assert.equal(WINDOW.copyTick('hello@x.ca'), "Send a copy to the club's inbox (hello@x.ca)");
  });
  it('the sample email’s reply line follows the mode', () => {
    assert.match(family, /reply\.mode === 'club' && !one \? \(season \? sPreview\?\.replyLineClub : preview\?\.replyLineClub\)/);
    assert.equal(MAIL.replyLine('club', 'Harbourtown', 'Morgan'), 'Reply to this email to reach Harbourtown.');
  });
});

describe('New email · the create menu (asks 1, 2, 10; drawing tab 2)', () => {
  it('one lime create button with a plus, the words, and the shipped primary menu', () => {
    assert.match(screen, /<CoachToolbarMenu label=\{PLACE\.newEmail\} icon=\{<Plus size=\{15\} aria-hidden \/>\} variant="primary" drawerOnPhone drawerTitle=\{PLACE\.newEmail\}>/);
  });
  it('with one choice the button names it and opens it — no one-item menu (ask 10)', () => {
    assert.match(screen, /choices\.length === 1 \?[\s\S]*?\{choices\[0\]\.named\}/);
    assert.equal(PLACE.emailFamilies, 'Email families');
    assert.equal(PLACE.emailCoaches, 'Email coaches');
    assert.equal(PLACE.emailBoard, 'Email the board');
  });
  it('the three choices and their second lines', () => {
    assert.equal(PLACE.toFamilies, 'To families');
    assert.equal(PLACE.toCoaches, 'To coaches');
    assert.equal(PLACE.toBoard, 'To the board');
    assert.equal(PLACE.toCoachesSub, 'All coaches, or the ones you choose');
    assert.equal(PLACE.toCoachesSubLeague, 'House-league coaches');
    assert.equal(PLACE.toBoardSub, 'Everyone on the board, or the ones you choose');
  });
  it('a choice is offered only to a seat that may write to it; the board only when someone else is on it', () => {
    assert.match(screen, /seat\?\.coaches \? \[\{ key: 'coaches'/);
    assert.match(screen, /seat\?\.board && boardOffered === true \? \[\{ key: 'board'/);
    assert.match(screen, /offered\?: boolean/);
    assert.match(screen, /!!\(r\.ok && r\.data\.offered\)/);
  });
  it('a league seat’s families are its seasons under way, each named on the second line (ask 2)', () => {
    assert.match(screen, /seasons\.map\(s => \(\{ key: `season:\$\{s\.id\}`/);
  });
  it('the treasurer’s only choice is the board, and its empty list says so', () => {
    assert.match(screen, /const onlyBoard = !!seat\?\.board && !seat\.coaches && door === null/);
    assert.equal(PLACE.emptyBoardTitle, 'No board emails yet');
  });
});

describe('The coach and board windows draw what the server answers', () => {
  it('every read and send is the club’s own route (never the tournament announcements’)', () => {
    assert.match(colleague, /`\/api\/admin\/club-emails\?\$\{q\}`/);
    assert.doesNotMatch(colleague, /\/api\/admin\/communications/);
  });
  it('a send carries the PEOPLE the sender was shown, so the server can compare them (coach ask 11)', () => {
    assert.match(colleague, /expected: a\.people\.map\(p => \(\{ key: p\.key, name: p\.name \}\)\)/);
  });
  it('a changed recount takes the new people and keeps the lime for the new count; nothing is sent by itself', () => {
    assert.match(colleague, /code === 'changed'/);
    assert.match(colleague, /setAudience\(\{ key: whoKey, a: \{ \.\.\.a, count: r\.data\.count \?\? r\.data\.people\.length, people: r\.data\.people \}\}\)|setAudience\(\{ key: whoKey, a: \{ \.\.\.a, count:/);
  });
  it('a pick and a group that was not offered are never drawn: groups come from the server’s options', () => {
    assert.match(colleague, /g\.all && row\('all'/);
    assert.match(colleague, /g\.rep && row\('rep'/);
    assert.match(colleague, /seasons\.length > 0 && row\('league'/);
  });
  it('a sender with no name is held before Send (R1), and no address is ever drawn', () => {
    assert.match(colleague, /!options\.senderNamed \? SAY\.needName/);
    assert.doesNotMatch(colleague, /\.email\b/);
  });
  it('the foot’s words', () => {
    assert.equal(SAY.pickCoaches, 'Tick at least one coach.');
    assert.equal(SAY.nobodyCoaches, 'Nobody to send to. Pick a group with coaches.');
    assert.equal(WINDOW.coachFoot(9), '9 coaches get it.');
    assert.equal(WINDOW.coachFoot(1), '1 coach gets it.');
    assert.equal(WINDOW.boardFoot(4), "4 board members get it. You aren't counted.");
    assert.equal(WINDOW.invitedCoaches(1), "1 invited coach hasn't accepted yet and won't.");
    assert.equal(WINDOW.invitedMembers(1), "1 invited member hasn't accepted yet and won't.");
    assert.equal(WINDOW.counting, 'Counting who this reaches…');
  });
  it('the sample email is the server’s own rendering in a frame that runs nothing', () => {
    assert.match(colleague, /sandbox="allow-same-origin"/);
    assert.doesNotMatch(colleague, /allow-scripts/);
  });
  it('the tournament pointer line shows only while a tournament runs, and only on the coach window', () => {
    assert.match(colleague, /!board && options\.tournament/);
    assert.equal(WINDOW.tournamentPointer('Harbourtown Invitational 2026'), 'Coaches of the teams in Harbourtown Invitational 2026 are emailed from the tournament.');
  });
  it('the window’s eyebrow is the place’s, and the recount’s "just sent" takes the lime’s place', () => {
    assert.match(screen, /eyebrow=\{PLACE\.eyebrow\}/);
    assert.match(colleague, /code === 'just_sent'/);
  });
});

describe('Send again to these people (coach drawing tab 6; the board’s record)', () => {
  it('the record opens the window with the pick and the subject, and sends nothing', () => {
    assert.match(record, /\/again\?/);
    assert.match(record, /onSendAgain\(res\.data\.kind, \{ keys: res\.data\.keys, subject:/);
    assert.match(colleague, /useState\(again\?\.subject \?\? ''\)/);
    assert.match(colleague, /useState\(''\);\s*const \[audience/, 'the message opens empty');
    assert.match(screen, /setWriting\(\{ door: kind, again \}\)/);
  });
  it('the door is absent once who it went to was deleted, and for a seat that may not write to that group', () => {
    assert.match(record, /canSendAgain && !detail\.namesCleared/);
    assert.match(screen, /canSendAgain=\{open\.kind === 'board' \? !!seat\?\.board && !!boardOffered : !!seat\?\.coaches\}/);
  });
});

describe('Finishing a stopped email · what the record says when the finish gets no answer', () => {
  const record = readCode('components/admin/kit/club/communications/ColleagueRecord.tsx');
  it('a finish with no answer says it may still be sending, never "couldn’t load"', () => {
    assert.match(RECORD.finishUnsure, /may still be sending/);
    assert.doesNotMatch(RECORD.finishUnsure, /load/i);
    assert.match(record, /refusalText\(res\.data, RECORD\.finishUnsure\)/);
    assert.match(record, /catch \{\s*setError\(RECORD\.finishUnsure\)/);
  });
  it('closing an email nobody missed says it sent nothing, in one verb', () => {
    assert.match(RECORD.finishNoneHint, /Marking it finished sends nothing/);
    assert.equal(RECORD.finishedNone, 'Marked as finished. Nothing was sent.');
  });
});
