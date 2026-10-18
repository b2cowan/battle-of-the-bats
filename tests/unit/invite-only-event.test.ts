/**
 * THE INVITE-ONLY EVENT (the free tournament tier, owner 2026-10-12; built 2026-10-16,
 * FREE_TOURNAMENT_TIER_REVIEW_PLAN.md §12). The free Tournament plan and a Premium coach's hosted event run invite-only
 * events: the host adds every team, and whole areas an invite-only event never uses are absent. No older event is
 * grandfathered (B1); an event carries what it already holds (R2, M10). One helper answers it; these are its cases:
 * free new · free with registration-era records · coach new · coach with records · Tournament Plus · a Founding Season
 * comp still on free (the lock line's second line) — and the gate keys the helper reads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventAreas, eventPayments, holdsRegistrationRecords, isWaitingStatus, runsInviteOnlyEvents, statusChangeAllowed,
  teamUpdateAllowed, volunteerShut,
} from '../../lib/invite-only-event';
import { scoreHeldForReview } from '../../lib/volunteer-jobs';
import { isPublicPageEnabled, withInviteOnlyPages, type PublicPageKey } from '../../lib/public-pages';
import { INVITE_COMPOSER_WORDS, emailDayWhen } from '../../lib/invite-only-words';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_MIN_PLAN, hasPlanFeature } from '../../lib/plan-features';
import { FOUNDING_SEASON_END_LABEL, foundingSeasonLockUntil } from '../../lib/plan-config';
import { CHAT_PAUSED } from '../../lib/chat-pause.ts';

const FREE_NEW = { fee_scope: 'free' };           // created invite-only: "Not tracked here"
const UNDECIDED = { fee_scope: null };            // a draft whose fee model was never chosen
const FEES_SET = { fee_scope: 'tournament' };     // fees set under a plan that tracked payments (R2)

describe('which plans run invite-only events', () => {
  it('the free Tournament plan and the Premium Coaches Portal; every paid organizer plan runs open events', () => {
    assert.equal(runsInviteOnlyEvents('tournament'), true);
    assert.equal(runsInviteOnlyEvents('team'), true);
    for (const plan of ['tournament_plus', 'league', 'club', 'club_large']) assert.equal(runsInviteOnlyEvents(plan), false, plan);
  });
  it('a missing or unknown plan reads as free (isFreePlan’s rule): invite-only', () => {
    assert.equal(runsInviteOnlyEvents(null), true);
    assert.equal(runsInviteOnlyEvents(undefined), true);
    assert.equal(runsInviteOnlyEvents('starter'), true);
  });
});

describe('the gate keys (/billing, 2026-10-16)', () => {
  it('open registration, payment tracking, check-in and volunteers are Tournament Plus', () => {
    for (const key of ['open_registration', 'payment_tracking', 'team_check_in', 'tournament_volunteers'] as const) {
      assert.equal(FEATURE_MIN_PLAN[key], 'tournament_plus', key);
    }
  });
  it('the registration tools leave free: Select many’s registration actions and the waitlist', () => {
    assert.equal(FEATURE_MIN_PLAN.bulk_registration_actions, 'tournament_plus');
    assert.equal(FEATURE_MIN_PLAN.waitlist_collection, 'tournament_plus');
  });
  it('a Premium coach keeps PDFs and nothing of the open event (R1)', () => {
    assert.equal(hasPlanFeature('team', 'pdf_exports'), true);
    assert.equal(hasPlanFeature('team', 'pdf_template_settings'), true);
    for (const key of ['open_registration', 'payment_tracking', 'team_check_in', 'tournament_volunteers', 'tournament_chat'] as const) {
      assert.equal(hasPlanFeature('team', key), false, key);
    }
  });
  it('the keys with nothing behind them are gone (review F14)', () => {
    for (const dead of ['online_tournament_payments', 'bulk_operational_workbook', 'schedule_xlsx_export',
      'results_xlsx_export', 'ical_export', 'live_score_refresh', 'fan_following', 'pwa_install']) {
      assert.equal(dead in FEATURE_MIN_PLAN, false, dead);
    }
  });
});

describe('free, a new event', () => {
  const areas = eventAreas('tournament', FREE_NEW);
  it('hides every area an invite-only event never uses', () => {
    assert.deepEqual(areas, {
      inviteOnly: true, payments: 'none', checkIn: false, volunteers: false, chat: false, summaryPage: false,
    });
    assert.equal(hasPlanFeature('tournament', 'waitlist_collection'), false);
  });
  it('an undecided fee model shows no payments either (activation fills it in as "Not tracked here")', () => {
    assert.equal(eventPayments('tournament', UNDECIDED), 'none');
    assert.equal(eventPayments('tournament', {}), 'none');
    assert.equal(eventPayments('tournament', null), 'none');
  });
  it('a team is added accepted; nothing joins the waitlist and no added team is declined', () => {
    assert.equal(statusChangeAllowed('tournament', 'accepted', 'rejected'), false);
    assert.equal(statusChangeAllowed('tournament', 'accepted', 'waitlist'), false);
    assert.equal(statusChangeAllowed('tournament', 'accepted', 'pending'), false);
  });
  it('holds no registration-era records', () => {
    assert.equal(holdsRegistrationRecords(FREE_NEW, ['accepted', 'accepted']), false);
    assert.equal(holdsRegistrationRecords(UNDECIDED, []), false);
  });
});

describe('free, an event that holds registration-era records (R2, M10)', () => {
  it('fees set under Tournament Plus: payments stay readable, never editable', () => {
    assert.equal(eventPayments('tournament', FEES_SET), 'read');
    assert.equal(eventAreas('tournament', FEES_SET).payments, 'read');
    assert.equal(holdsRegistrationRecords(FEES_SET, ['accepted']), true);
  });
  it('a team still waiting can be accepted or declined; nothing else moves', () => {
    for (const from of ['pending', 'waitlist']) {
      assert.equal(isWaitingStatus(from), true);
      assert.equal(statusChangeAllowed('tournament', from, 'accepted'), true, `${from} → accepted`);
      assert.equal(statusChangeAllowed('tournament', from, 'rejected'), true, `${from} → rejected`);
      assert.equal(statusChangeAllowed('tournament', from, 'waitlist'), false, `${from} → waitlist`);
    }
    assert.equal(statusChangeAllowed('tournament', 'rejected', 'accepted'), false);
  });
  it('a waiting or declined team is a registration-era record; an accepted one alone is not', () => {
    assert.equal(holdsRegistrationRecords(FREE_NEW, ['accepted', 'pending']), true);
    assert.equal(holdsRegistrationRecords(FREE_NEW, ['waitlist']), true);
    assert.equal(holdsRegistrationRecords(FREE_NEW, ['rejected']), true);
  });
  it('the areas stay hidden: the records are read in place, not reopened', () => {
    const areas = eventAreas('tournament', FEES_SET);
    assert.equal(areas.inviteOnly, true);
    assert.equal(areas.checkIn, false);
    assert.equal(areas.volunteers, false);
    assert.equal(areas.chat, false);
  });
});

describe('the server holds what the screens hide (B2)', () => {
  it('free: a team’s pool, notes and seed move; no payment or check-in field does', () => {
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { poolId: 'p1', adminNotes: 'x', seed: 2 }), true);
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { paymentStatus: 'paid' }), false);
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { total_paid: 100 }), false);
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { checkInStatus: 'checked_in' }), false);
  });
  it('free: a waiting team can be answered; an added team cannot be declined or waitlisted', () => {
    assert.equal(teamUpdateAllowed('tournament', 'pending', { status: 'accepted', waitlistPosition: null }), true);
    assert.equal(teamUpdateAllowed('tournament', 'waitlist', { status: 'rejected' }), true);
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { status: 'rejected' }), false);
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { status: 'waitlist' }), false);
    // Re-sending the status a team already has is not a change.
    assert.equal(teamUpdateAllowed('tournament', 'accepted', { status: 'accepted', poolId: 'p2' }), true);
  });
  it('a coach’s event is held the same way', () => {
    assert.equal(teamUpdateAllowed('team', 'accepted', { depositPaid: 50 }), false);
  });
  it('Tournament Plus writes everything, as today', () => {
    assert.equal(teamUpdateAllowed('tournament_plus', 'accepted', { paymentStatus: 'paid', checkInStatus: 'checked_in', status: 'rejected' }), true);
  });
});

describe('a Premium coach’s event follows free (R1)', () => {
  it('new: the same areas as free', () => {
    assert.deepEqual(eventAreas('team', FREE_NEW), eventAreas('tournament', FREE_NEW));
  });
  it('with records: the same read-only payments and waiting teams as free', () => {
    assert.equal(eventPayments('team', FEES_SET), 'read');
    assert.equal(statusChangeAllowed('team', 'pending', 'accepted'), true);
    assert.equal(statusChangeAllowed('team', 'accepted', 'rejected'), false);
  });
});

describe('Tournament Plus is unchanged', () => {
  it('every area shows, and payments follow the event’s own fee model as today', () => {
    assert.deepEqual(eventAreas('tournament_plus', FEES_SET), {
      // ⚖ No event has chat while it is paused (2026-10-18); the plan key keeps its value.
      inviteOnly: false, payments: 'edit', checkIn: true, volunteers: true, chat: !CHAT_PAUSED, summaryPage: true,
    });
    assert.equal(eventPayments('tournament_plus', FREE_NEW), 'none');
    assert.equal(eventPayments('tournament_plus', UNDECIDED), 'edit');
  });
  it('every status change is the host’s, as today', () => {
    assert.equal(statusChangeAllowed('tournament_plus', 'accepted', 'rejected'), true);
    assert.equal(statusChangeAllowed('tournament_plus', 'pending', 'waitlist'), true);
  });
  it('League and Club carry the open event too', () => {
    for (const plan of ['league', 'club', 'club_large']) assert.equal(eventAreas(plan, FEES_SET).inviteOnly, false, plan);
  });
});

describe('volunteers and Field scores (R7, M3)', () => {
  it('a volunteer on a plan without volunteers is shut out; the host, admins and staff are not', () => {
    for (const plan of ['tournament', 'team']) {
      assert.equal(volunteerShut(plan, 'official'), true, plan);
      for (const role of ['owner', 'admin', 'staff']) assert.equal(volunteerShut(plan, role), false, `${plan} ${role}`);
    }
    assert.equal(volunteerShut('tournament_plus', 'official'), false);
  });
  it('a score is held for review only from a volunteer or staff, only where the event asks — the host’s saves final', () => {
    assert.equal(scoreHeldForReview('owner', true), false);
    assert.equal(scoreHeldForReview('admin', true), false);
    assert.equal(scoreHeldForReview('staff', true), true);
    assert.equal(scoreHeldForReview('official', true), true);
    assert.equal(scoreHeldForReview('staff', false), false);
  });
  it('the scoring service and the screen read the one rule', () => {
    const service = readFileSync(join(import.meta.dirname, '..', '..', 'lib', 'tournament-scoring-service.ts'), 'utf8');
    assert.doesNotMatch(service, /role === 'official' \|\| input\.actor\.role === 'staff'/, 'no hand-rolled hold left in the service');
    assert.equal((service.match(/scoreHeldForReview\(/g) ?? []).length, 2, 'a score and a forfeit');
    const read = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'api', 'official', '[orgSlug]', 'score', 'get-score.ts'), 'utf8');
    assert.match(read, /scoreHeldForReview\(ctx\.role,/, 'the screen’s policy is this person’s, not only the event’s');
  });
});

describe('the public Registration page (R6)', () => {
  it('an invite-only event’s switch reads off, whatever the row stores', () => {
    const t = { publicHiddenPages: ['news'] as PublicPageKey[], settings: {} };
    assert.equal(isPublicPageEnabled(withInviteOnlyPages(t, true), 'register'), false);
    assert.equal(isPublicPageEnabled(withInviteOnlyPages(t, true), 'news'), false, 'the row’s own choices stand');
    assert.equal(isPublicPageEnabled(withInviteOnlyPages(t, false), 'register'), true, 'a paid event is unchanged');
  });
});

describe('Add team on an invite-only event (M8)', () => {
  it('the email is never required: its box starts ticked but hides until there is an email (owner, the walk 2026-10-16)', () => {
    const page = readFileSync(join(import.meta.dirname, '..', '..', 'app', '[orgSlug]', 'admin', 'tournaments', 'registrations', 'page.tsx'), 'utf8');
    assert.match(page, /const addNotifyShown = !areas\.inviteOnly \|\| Boolean\(addForm\.email\.trim\(\)\);/, 'one answer: is the box on screen');
    assert.match(page, /required=\{addNotifyShown && addForm\.notifyTeam\}/, 'a ticked, hidden box never makes the email required');
    assert.match(page, /\{addNotifyShown && \(/, 'the box is drawn by the same answer');
    assert.match(page, /notifyTeam: addForm\.notifyTeam && Boolean\(addForm\.email\.trim\(\)\)/, 'no email, no invitation sent');
  });
});

describe('the game-day board on an invite-only event (R5)', () => {
  it('"teams arrived" goes with check-in: the board gets no arrivals where the plan has no check-in (owner’s §320 walk, 2026-10-16)', () => {
    const page = readFileSync(join(import.meta.dirname, '..', '..', 'app', '[orgSlug]', 'admin', 'tournaments', 'dashboard', 'page.tsx'), 'utf8');
    assert.match(page, /const checkInShown = eventAreas\(currentOrg\?\.planId\)\.checkIn;/, 'the one rule decides it');
    assert.match(page, /arrived=\{checkInShown \? \{[^}]*\} : null\}/, 'no arrivals passed without check-in');
    const board = readFileSync(join(import.meta.dirname, '..', '..', 'app', '[orgSlug]', 'admin', 'tournaments', 'dashboard', 'GameDayBoard.tsx'), 'utf8');
    assert.match(board, /const arrivedShown = arrived !== null && arrived\.accepted > 0;/, 'the figure needs arrivals to read');
    assert.doesNotMatch(board, /\barrived\.accepted > 0 &&/, 'no bare read of the arrivals left');
    assert.equal(eventAreas('tournament').checkIn, false, 'free: no check-in');
    assert.equal(eventAreas('team').checkIn, false, 'a coach’s event: no check-in');
    assert.equal(eventAreas('tournament_plus').checkIn, true, 'Tournament Plus keeps "teams arrived"');
  });
});

describe('Event settings on an invite-only event (M5)', () => {
  it('no Coach emails card: nothing in it applies, so it is absent, never three lock lines (owner, the walk 2026-10-16)', () => {
    const page = readFileSync(join(import.meta.dirname, '..', '..', 'app', '[orgSlug]', 'admin', 'tournaments', 'settings', 'event', 'page.tsx'), 'utf8');
    assert.match(page, /\{!inviteOnly && \(\s*<CollapsibleCard title=\{W\.cards\.coachEmails\}/, 'the card is absent on an invite-only event');
    assert.doesNotMatch(page, /PlanLockLine/, 'no lock line left on Event settings');
  });
});

describe('the composer’s email day (M11)', () => {
  it('names the clock the next email may go, and "tomorrow" when the rolling day crosses midnight', () => {
    const later = new Date(Date.now() + 60_000).toISOString();
    const when = emailDayWhen(later);
    assert.match(when, /^\d{1,2}:\d{2} (a|p)\.m\.( tomorrow)?$/);
    assert.match(emailDayWhen(new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString()), / tomorrow$/);
  });
  it('the window’s lock lines start at its edge, and each is still the plan’s link (owner, the walk 2026-10-16)', () => {
    const composer = readFileSync(join(import.meta.dirname, '..', '..', 'app', '[orgSlug]', 'admin', 'tournaments', 'communication', 'MessageComposer.tsx'), 'utf8');
    const locks = composer.match(/<PlanLockLine[^>]*>/g) ?? [];
    assert.equal(locks.length, 3, 'Show under, choose teams, push to fans');
    // A link that opens the plan's panel OVER the window (PlanPanelHost), so the message stays.
    for (const l of locks) assert.match(l, /href=\{planHref\}/, l);
    // Neither stepped-in lock sits inside its choice's indented block: each follows the block's closing tag.
    assert.match(composer, /<\/div>\s*\{divisions\.length > 0 && !canTarget && <PlanLockLine/);
    assert.match(composer, /<\/div>\s*\{!canTarget && <PlanLockLine href=\{planHref\} plan=\{COMMS_LOCK_PLAN\}>\{COMMS_LOCK\.chooseTeams\}/);
  });
  it('the words say the limit with no "free plan" (the naming canon)', () => {
    for (const s of [INVITE_COMPOSER_WORDS.limit, INVITE_COMPOSER_WORDS.dayUsed('3:40 p.m.'), INVITE_COMPOSER_WORDS.tooMany(112)]) {
      assert.doesNotMatch(s, /free plan|free tier/i, s);
    }
  });
});

describe('a Founding Season comp still on free (R10, M9)', () => {
  it('its locks carry the date; nothing else does', () => {
    assert.equal(foundingSeasonLockUntil('tournament', true), FOUNDING_SEASON_END_LABEL);
    assert.equal(foundingSeasonLockUntil('tournament', false), null);
    // A comped coach has no path to Tournament Plus; an org already on Plus has nothing locked.
    assert.equal(foundingSeasonLockUntil('team', true), null);
    assert.equal(foundingSeasonLockUntil('tournament_plus', true), null);
  });
  it('the date is the last free day as the customer reads it', () => {
    assert.match(FOUNDING_SEASON_END_LABEL, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  });
});
