import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { noticeEndsAt, noticeIsShowing, noticeSmallLine } from '../../lib/club-notice.ts';
import { pastYearHint, pastYearsMentioned } from '../../lib/past-year-hint.ts';
import { checkEmail, checkLink, savedAsHint, looksPersonalEmail, badLinkMessage, BAD_EMAIL } from '../../lib/site-field-checks.ts';
import {
  normalizeSectionOrder,
  normalizeHiddenSections,
  clubHomeSectionsFor,
  isSectionShown,
  editorSectionRows,
  reorderedSections,
} from '../../lib/club-site-sections.ts';
import { cleanSiteList, parsePublicSitePatch } from '../../lib/public-site-patch.ts';
import { orgSectionsFor } from '../../lib/org-public-sections.ts';
import { clubAboutPageShows, documentBands } from '../../lib/club-about.ts';
import { colourWord, lookWords } from '../../lib/colour-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB RUNS ITS OWN SITE (Club Tier Stage 4c-1; drawings ruled 2026-10-19, Asks 6, 10, 16; owner gate 2026-10-21;
 * words CLUB_TIER_STAGE4C1_COPY.md). The pure rules behind the editor and the public pages: the club notice's clock,
 * the past-year hint, the email and link checks, and the home's section order and show/hide.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

// 2:40 p.m. Wednesday Oct 21, 2026, Toronto (EDT, UTC−4).
const POSTED = '2026-10-21T18:40:00.000Z';

describe('the club notice ends by itself, in the club zone', () => {
  it('"Tonight at midnight" is the midnight that closes the club\'s today', () => {
    assert.equal(noticeEndsAt({ kind: 'tonight' }, POSTED), '2026-10-22T04:00:00.000Z');
  });
  it('"Tomorrow at midnight" is the one after it', () => {
    assert.equal(noticeEndsAt({ kind: 'tomorrow' }, POSTED), '2026-10-23T04:00:00.000Z');
  });
  it('late at night, "tonight" is still the coming midnight (11:30 p.m. local is 03:30 UTC the next day)', () => {
    assert.equal(noticeEndsAt({ kind: 'tonight' }, '2026-10-22T03:30:00.000Z'), '2026-10-22T04:00:00.000Z');
  });
  it('across the autumn clock change, midnight moves from UTC−4 to UTC−5', () => {
    assert.equal(noticeEndsAt({ kind: 'tonight' }, '2026-10-31T20:00:00.000Z'), '2026-11-01T04:00:00.000Z');
    assert.equal(noticeEndsAt({ kind: 'tomorrow' }, '2026-10-31T20:00:00.000Z'), '2026-11-02T05:00:00.000Z');
  });
  it('a picked date and time is read in the club zone, and one already passed is refused', () => {
    assert.equal(noticeEndsAt({ kind: 'at', date: '2026-10-23', time: '18:00' }, POSTED), '2026-10-23T22:00:00.000Z');
    assert.equal(noticeEndsAt({ kind: 'at', date: '2026-10-21', time: '14:00' }, POSTED), null);
    assert.equal(noticeEndsAt({ kind: 'at', date: '2026-10-21', time: '14:40' }, POSTED), null, 'now itself is not ahead');
    assert.equal(noticeEndsAt({ kind: 'at', date: 'soon', time: '18:00' }, POSTED), null);
  });
  it('shows up to the minute it ends, and not at it', () => {
    const n = { postedAt: POSTED, endsAt: '2026-10-22T04:00:00.000Z', endedAt: null };
    assert.equal(noticeIsShowing(n, '2026-10-22T03:59:59.000Z'), true);
    assert.equal(noticeIsShowing(n, '2026-10-22T04:00:00.000Z'), false);
  });
  it('End now takes it down at once', () => {
    assert.equal(noticeIsShowing({ postedAt: POSTED, endsAt: '2026-10-22T04:00:00.000Z', endedAt: '2026-10-21T19:00:00.000Z' }, '2026-10-21T19:01:00.000Z'), false);
  });
  it('an expired notice never shows, though nothing wrote its end (its clock ends it)', () => {
    assert.equal(noticeIsShowing({ postedAt: '2026-10-20T15:00:00.000Z', endsAt: '2026-10-21T04:00:00.000Z', endedAt: null }, '2026-10-21T19:00:00.000Z'), false);
  });
});

describe('the line families read under the notice', () => {
  const now = '2026-10-21T19:00:00.000Z';
  it('posted today, ending at midnight: "ends tonight"', () => {
    assert.equal(noticeSmallLine({ postedAt: POSTED, endsAt: '2026-10-22T04:00:00.000Z' }, now), 'Posted 2:40 p.m. by the club · ends tonight');
  });
  it('a later time today, tomorrow night, tomorrow at a time, another day', () => {
    assert.equal(noticeSmallLine({ postedAt: POSTED, endsAt: '2026-10-21T22:00:00.000Z' }, now), 'Posted 2:40 p.m. by the club · ends 6:00 p.m.');
    assert.equal(noticeSmallLine({ postedAt: POSTED, endsAt: '2026-10-23T04:00:00.000Z' }, now), 'Posted 2:40 p.m. by the club · ends tomorrow night');
    assert.equal(noticeSmallLine({ postedAt: POSTED, endsAt: '2026-10-22T22:00:00.000Z' }, now), 'Posted 2:40 p.m. by the club · ends tomorrow at 6:00 p.m.');
    assert.equal(noticeSmallLine({ postedAt: POSTED, endsAt: '2026-10-23T22:00:00.000Z' }, now), 'Posted 2:40 p.m. by the club · ends Fri, Oct 23 at 6:00 p.m.');
    assert.equal(noticeSmallLine({ postedAt: POSTED, endsAt: '2026-10-24T04:00:00.000Z' }, now), 'Posted 2:40 p.m. by the club · ends Fri, Oct 23 at midnight');
  });
  it('posted on an earlier day names that day', () => {
    assert.equal(
      noticeSmallLine({ postedAt: '2026-10-20T18:40:00.000Z', endsAt: '2026-10-22T04:00:00.000Z' }, '2026-10-21T13:00:00.000Z'),
      'Posted Tue, Oct 20 at 2:40 p.m. by the club · ends tonight',
    );
  });
  it('the clock is the house clock: lowercase with periods', () => {
    const line = noticeSmallLine({ postedAt: '2026-10-21T13:05:00.000Z', endsAt: '2026-10-22T04:00:00.000Z' }, now);
    assert.match(line, /9:05 a\.m\./);
    assert.doesNotMatch(line, /AM|PM/);
  });
});

describe('the past-year hint: a hint, never a block', () => {
  it('names a past year and asks', () => {
    assert.equal(pastYearHint('Registration for the 2025 season opens in the spring', 2026), 'Mentions 2025 — still true?');
  });
  it('several years, oldest first, each once', () => {
    assert.equal(pastYearHint('2025 and 2024 champions; 2025 again', 2026), 'Mentions 2024 and 2025 — still true?');
    assert.equal(pastYearHint('2023, 2024, 2025', 2026), 'Mentions 2023, 2024 and 2025 — still true?');
  });
  it('this year and later years are not past', () => {
    assert.equal(pastYearHint('Tryouts for the 2026 and 2027 seasons', 2026), null);
  });
  it('a founding year stays true', () => {
    assert.deepEqual(pastYearsMentioned('A volunteer-run association since 1979. Founded in 1979, est. 2004.', 2026), []);
  });
  it('digits inside a longer number are not a year', () => {
    assert.deepEqual(pastYearsMentioned('Call 905-201-9988 or 12019 Main St', 2026), []);
  });
  it('blank text has no hint', () => {
    assert.equal(pastYearHint('', 2026), null);
    assert.equal(pastYearHint(null, 2026), null);
  });
});

describe('the email check refuses what a mailto: link could abuse', () => {
  it('a plain address passes, trimmed; blank is nothing', () => {
    assert.deepEqual(checkEmail('  info@lakeshorelynx.ca '), { ok: true, value: 'info@lakeshorelynx.ca' });
    assert.deepEqual(checkEmail(''), { ok: true, value: null });
  });
  it('not an address, or one carrying extra mailto: fields, is refused with the reason', () => {
    for (const bad of ['info', 'info@club', 'a b@club.ca', 'info@club.ca?cc=x@y.ca', 'info@club.ca&body=hi', '<info@club.ca>']) {
      assert.deepEqual(checkEmail(bad), { ok: false, error: BAD_EMAIL }, bad);
    }
  });
  it('a personal-looking address is nudged, never refused', () => {
    assert.equal(looksPersonalEmail('dana.w@gmail.com'), true);
    assert.equal(looksPersonalEmail('registrar@riverbendsoftball.ca'), false);
    assert.equal(checkEmail('dana.w@gmail.com').ok, true);
  });
});

describe('the link check: a refused link says why and is not saved (F05)', () => {
  it('completes a link typed without https:// and says what was saved', () => {
    assert.deepEqual(checkLink('instagram.com/lakeshorelynx', 'instagram'), { ok: true, value: 'https://instagram.com/lakeshorelynx' });
    assert.equal(savedAsHint('instagram.com/lakeshorelynx', 'https://instagram.com/lakeshorelynx'), 'Saved as https://instagram.com/lakeshorelynx');
    assert.equal(savedAsHint('https://x.com/club', 'https://x.com/club'), null);
  });
  it('http:// is saved as https://', () => {
    assert.deepEqual(checkLink('http://yourclub.ca/conduct.pdf'), { ok: true, value: 'https://yourclub.ca/conduct.pdf' });
  });
  it('a name, a script, or another scheme is refused, naming the network', () => {
    assert.deepEqual(checkLink('Lakeshore Lynx Baseball', 'facebook'), {
      ok: false, error: "That isn't a web address. Paste the link to your Facebook page, starting with https://",
    });
    assert.equal(checkLink('javascript:alert(1)').ok, false);
    assert.equal(checkLink('mailto:info@club.ca').ok, false);
    assert.equal(checkLink('https://nodot').ok, false);
    assert.equal(badLinkMessage(), "That isn't a web address. Paste the link, starting with https://");
  });
  it('blank is nothing, and an over-long link is refused', () => {
    assert.deepEqual(checkLink('  '), { ok: true, value: null });
    assert.equal(checkLink('https://club.ca/' + 'a'.repeat(600)).ok, false);
  });
});

describe('the home\'s sections: the club\'s order, its show/hide, and what the plan carries', () => {
  const allOn = { openNow: 1, teams: 8, league: true, tournaments: 2, about: true };
  const carriesAll = { teams: true, league: true, tournaments: true };

  it('a club that never touched the editor keeps today\'s ruled order', () => {
    assert.deepEqual(normalizeSectionOrder(undefined), ['teams', 'league', 'tournaments', 'about', 'archives']);
    assert.deepEqual(
      clubHomeSectionsFor(allOn, { order: undefined, hidden: undefined }, carriesAll),
      ['openNow', 'teams', 'league', 'tournaments', 'about'],
    );
  });
  it('an order is cleaned: unknown keys dropped, repeats once, missing ones appended in the default order', () => {
    assert.deepEqual(normalizeSectionOrder(['about', 'openNow', 'bogus', 'about', 'teams']), ['about', 'teams', 'league', 'tournaments', 'archives']);
    assert.deepEqual(normalizeHiddenSections(['archives', 'bogus', 'archives', 'openNow']), ['archives']);
  });
  it('Open now always comes first, whatever the order says', () => {
    assert.deepEqual(
      clubHomeSectionsFor(allOn, { order: ['about', 'tournaments', 'league', 'teams'], hidden: [] }, carriesAll),
      ['openNow', 'about', 'tournaments', 'league', 'teams'],
    );
  });
  it('a hidden section is gone from the home; Open now cannot be hidden', () => {
    assert.deepEqual(
      clubHomeSectionsFor(allOn, { order: undefined, hidden: ['tournaments', 'about'] }, carriesAll),
      ['openNow', 'teams', 'league'],
    );
  });
  it('a section with nothing to show stays off the home even when switched on', () => {
    assert.deepEqual(
      clubHomeSectionsFor({ openNow: 0, teams: 3, league: false, tournaments: 0, about: false }, { order: undefined, hidden: [] }, carriesAll),
      ['teams'],
    );
  });
  it('a section the club shows: carried by the plan and not hidden', () => {
    assert.equal(isSectionShown('tournaments', { order: undefined, hidden: [] }, carriesAll), true);
    assert.equal(isSectionShown('tournaments', { order: undefined, hidden: ['tournaments'] }, carriesAll), false);
    assert.equal(isSectionShown('archives', { order: undefined, hidden: [] }, { ...carriesAll, tournaments: false }), false);
    assert.equal(isSectionShown('about', { order: undefined, hidden: [] }, { teams: false, league: false, tournaments: false }), true);
  });

  it('a drag reorders the rows the editor showed; a section the plan lacks keeps its slot', () => {
    // League Plus club: no Teams row in the editor. The admin drags About above House league.
    assert.deepEqual(
      reorderedSections(undefined, ['about', 'league', 'tournaments', 'archives']),
      ['teams', 'about', 'league', 'tournaments', 'archives'],
    );
  });

  describe('the editor\'s rows', () => {
    const facts = { teams: 8, leagueSeason: '2027', tournaments: 2, archives: 1, about: true };
    it('Open now leads, locked; then the club\'s order', () => {
      const rows = editorSectionRows({ order: ['about', 'teams'], hidden: [] }, facts, carriesAll);
      assert.deepEqual(rows.map(r => r.key), ['openNow', 'about', 'teams', 'league', 'tournaments', 'archives']);
      assert.equal(rows[0].locked, true);
      assert.equal(rows.slice(1).every(r => !r.locked), true);
    });
    it('a section the PLAN does not carry is absent — no explanation', () => {
      const rows = editorSectionRows({ order: undefined, hidden: [] }, facts, { teams: false, league: true, tournaments: false });
      assert.deepEqual(rows.map(r => r.key), ['openNow', 'league', 'about']);
    });
    it('a section the club does not run YET keeps a live switch and says when it shows', () => {
      const rows = editorSectionRows({ order: undefined, hidden: [] }, { teams: 0, leagueSeason: null, tournaments: 0, archives: 0, about: false }, carriesAll);
      const by = Object.fromEntries(rows.map(r => [r.key, r]));
      assert.equal(by.league.sub, 'Shows once you publish a season');
      assert.equal(by.tournaments.sub, 'Shows once you host a tournament');
      assert.equal(by.archives.sub, 'Shows once you have an archived tournament');
      assert.equal(by.teams.sub, 'Shows once you add a team');
      assert.equal(by.league.locked, false, 'still switchable in advance');
    });
    it('each row says what it shows today', () => {
      const by = Object.fromEntries(editorSectionRows({ order: undefined, hidden: [] }, facts, carriesAll).map(r => [r.key, r]));
      assert.equal(by.openNow.sub, 'Open tryouts and an open house-league sign-up, while they are open');
      assert.equal(by.teams.sub, 'Your 8 teams in your groups, each with its tryout state');
      assert.equal(by.league.sub, 'Your 2027 sign-up and divisions');
      assert.equal(by.tournaments.sub, 'Your upcoming tournaments');
      assert.equal(by.archives.sub, 'A way to your archived tournaments');
      assert.equal(by.about.sub, 'Your about text, with a way to your About page');
    });
    it('one team is "Your 1 team"; a hidden section says so', () => {
      const by = Object.fromEntries(editorSectionRows({ order: undefined, hidden: ['teams'] }, { ...facts, teams: 1 }, carriesAll).map(r => [r.key, r]));
      assert.equal(by.teams.shown, false);
      assert.equal(by.teams.sub, 'Hidden from families');
      const one = Object.fromEntries(editorSectionRows({ order: undefined, hidden: [] }, { ...facts, teams: 1 }, carriesAll).map(r => [r.key, r]));
      assert.equal(one.teams.sub, 'Your 1 team in your groups, with its tryout state');
    });
  });
});

describe('the editor\'s save: each card sends only its fields, and a refused field is never saved', () => {
  const ids = (() => { let n = 0; return () => `id-${++n}`; })();

  it('only the fields sent become the patch', () => {
    const r = parsePublicSitePatch({ tagline: '  Every girl can play ' }, ids);
    assert.deepEqual(r, { ok: true, patch: { tagline: 'Every girl can play' } });
  });
  it('blank text and a blank address are cleared, not refused', () => {
    assert.deepEqual(parsePublicSitePatch({ description: '  ', contactEmail: '' }, ids), { ok: true, patch: { description: null, contactEmail: null } });
  });
  it('a bad email names its field and the reason; nothing else is saved', () => {
    assert.deepEqual(parsePublicSitePatch({ tagline: 'x', contactEmail: 'info@club' }, ids), {
      ok: false, field: 'contactEmail', error: "That doesn't look like an email address.",
    });
  });
  it('a social link is completed, or refused naming its network', () => {
    assert.deepEqual(parsePublicSitePatch({ socialInstagram: 'instagram.com/lynx' }, ids), { ok: true, patch: { socialInstagram: 'https://instagram.com/lynx' } });
    assert.deepEqual(parsePublicSitePatch({ socialFacebook: 'Lakeshore Lynx Baseball' }, ids), {
      ok: false, field: 'socialFacebook', error: "That isn't a web address. Paste the link to your Facebook page, starting with https://",
    });
  });
  it('the section order and hidden list are cleaned before they are stored', () => {
    assert.deepEqual(parsePublicSitePatch({ homeSectionOrder: ['about', 'x'], homeSectionsHidden: ['archives', 'openNow'] }, ids), {
      ok: true, patch: { homeSectionOrder: ['about', 'teams', 'league', 'tournaments', 'archives'], homeSectionsHidden: ['archives'] },
    });
  });
  it('a list keeps its ids, gives new rows one, and checks every row', () => {
    const r = parsePublicSitePatch({ contacts: [{ id: 'keep', role: 'Registration', email: 'registrar@club.ca' }, { role: ' Umpires ', email: 'umps@club.ca' }] }, () => 'new');
    assert.deepEqual(r, { ok: true, patch: { contacts: [
      { id: 'keep', role: 'Registration', email: 'registrar@club.ca' },
      { id: 'new', role: 'Umpires', email: 'umps@club.ca' },
    ] } });
    assert.deepEqual(parsePublicSitePatch({ contacts: [{ role: 'Registration', email: 'nope' }] }, ids), {
      ok: false, field: 'contacts', error: "That doesn't look like an email address.",
    });
    assert.deepEqual(parsePublicSitePatch({ documents: [{ heading: 'Safety', title: 'Concussion policy', url: 'javascript:x' }] }, ids), {
      ok: false, field: 'documents', error: "That isn't a web address. Paste the link, starting with https://",
    });
  });
  it('a list over its cap is refused with the count said', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ role: `R${i}`, email: `r${i}@club.ca` }));
    assert.deepEqual(parsePublicSitePatch({ contacts: many }, ids), {
      ok: false, field: 'contacts', error: 'You have twelve contacts. Remove one to add another.',
    });
    const q = Array.from({ length: 11 }, (_, i) => ({ question: `Q${i}?`, answer: 'A' }));
    assert.equal(parsePublicSitePatch({ questions: q }, ids).ok, false);
  });
  it('a row missing its words is refused', () => {
    assert.equal(parsePublicSitePatch({ documents: [{ heading: 'Safety', title: ' ', url: 'https://club.ca/a.pdf' }] }, ids).ok, false);
    assert.equal(parsePublicSitePatch({ questions: [{ question: 'When?', answer: '' }] }, ids).ok, false);
  });
  it('fields it does not know are ignored (the old show_* switches among them)', () => {
    assert.deepEqual(parsePublicSitePatch({ showArchivesLink: false, bogus: 1 }, ids), { ok: true, patch: {} });
  });
});

describe('the tab row follows the editor', () => {
  const all = { league: true, archives: true, teams: true, tryouts: true };
  it('Home first, then the club\'s order, Tryouts riding with Teams', () => {
    const order = normalizeSectionOrder(['archives', 'league', 'teams', 'tournaments', 'about']);
    assert.deepEqual(orgSectionsFor(all, order).map(s => s.key), ['', 'archives', 'league', 'teams', 'tryouts']);
  });
  it('the order only sorts: a hidden section arrives as not available, and a tab the order does not rank stays', () => {
    // A hidden House league (the availability step folds the club's switch in).
    assert.deepEqual(orgSectionsFor({ ...all, league: false }, normalizeSectionOrder(['archives'])).map(s => s.key), ['', 'archives', 'teams', 'tryouts']);
    // An order that ranks nothing the tab row has keeps the table's order — no tab disappears.
    assert.deepEqual(orgSectionsFor(all, ['about']).map(s => s.key), ['', 'teams', 'tryouts', 'league', 'archives']);
  });
  it('without an order the table\'s order stands (callers outside the club site)', () => {
    assert.deepEqual(orgSectionsFor(all).map(s => s.key), ['', 'teams', 'tryouts', 'league', 'archives']);
  });
});

describe('the About page and its door', () => {
  it('the door shows only when the page says more than the home\'s about text', () => {
    assert.equal(clubAboutPageShows(null), false);
    assert.equal(clubAboutPageShows({ contacts: [], documents: [], questions: [] }), false);
    assert.equal(clubAboutPageShows({ contacts: [{ id: '1', role: 'Registration', email: 'r@club.ca' }] }), true);
    assert.equal(clubAboutPageShows({ questions: [{ id: '1', question: 'When?', answer: 'Sep.' }] }), true);
  });
  it('documents fall under their headings, each heading once, in first-used order', () => {
    const d = (title: string, heading: string) => ({ id: title, title, heading, url: 'https://club.ca/' + title });
    const bands = documentBands([d('Parent', 'Codes of conduct'), d('Concussion', 'Safety'), d('Coach', 'codes of conduct '), d('Bylaws', 'The club')]);
    assert.deepEqual(bands.map(b => [b.heading, b.documents.map(x => x.title)]), [
      ['Codes of conduct', ['Parent', 'Coach']],
      ['Safety', ['Concussion']],
      ['The club', ['Bylaws']],
    ]);
  });
});

describe('the Look card says the colours in words', () => {
  it('names a colour plainly', () => {
    assert.equal(colourWord('#1F3A5F'), 'navy');
    assert.equal(colourWord('#E8B33A'), 'gold');
    assert.equal(colourWord('#9F1239'), 'maroon');
    assert.equal(colourWord('#166534'), 'dark green');
    assert.equal(colourWord('#E0457B'), 'pink');
    assert.equal(colourWord('#000000'), 'black');
    assert.equal(colourWord('#FFFFFF'), 'white');
    assert.equal(colourWord('#808080'), 'grey');
    assert.equal(colourWord('#8B2FC9'), 'purple');
  });
  it('the summary, the readability line, and the darkened colour', () => {
    const look = lookWords({ preset: 'custom', primary: '#1F3A5F', accent: '#E8B33A', font: null });
    assert.equal(look.summary, 'Navy and gold · Classic type');
    assert.equal(look.readable, 'White text on navy, navy links. Readable on every page.');
    assert.equal(look.darkened, null);
    // The drawings' pink fails 4.5 : 1 with both texts, so the platform darkens it (lib/club-colour-roles.ts).
    const pink = lookWords({ preset: 'custom', primary: '#E0457B', accent: null, font: 'inter' });
    assert.equal(pink.summary, 'Pink · Clean type');
    assert.equal(pink.darkened, 'We made your pink a little darker on text and buttons so families can read it.');
  });
  it('one colour said once when the accent is the same word', () => {
    assert.equal(lookWords({ preset: 'custom', primary: '#1F3A5F', accent: '#1E3A8A', font: 'dm-serif' }).summary, 'Navy · Serif type');
  });
});

describe('the /review fixes (2026-10-21)', () => {
  it('an address that would smuggle a second recipient through mailto: is refused', () => {
    assert.equal(checkEmail('reg%2Cvictim@evil.com').ok, false);
    assert.equal(checkEmail('reg%0Abcc@evil.com').ok, false);
  });
  it('a link with a login part or a backslash is refused — it would open somewhere other than it reads', () => {
    assert.equal(checkLink('https://www.facebook.com@evil.com/', 'facebook').ok, false);
    assert.equal(checkLink('https://user:pass@club.ca/').ok, false);
    assert.equal(checkLink('https://evil.com\\@facebook.com').ok, false);
    assert.equal(checkLink('https://club.ca/path?a=1#top').ok, true, 'an ordinary link still passes');
  });
  it('a stored list reaches a page only with the rows the route would accept', () => {
    const cleaned = cleanSiteList('documents', [
      { id: 'ok', heading: 'Safety', title: 'Concussion', url: 'https://club.ca/c.pdf' },
      { id: 'bad', heading: 'Safety', title: 'Data', url: 'data:text/html,hi' },
      { id: 'noheading', title: 'x', url: 'https://club.ca/x' },
      'not a row',
    ]);
    assert.deepEqual(cleaned.map(d => d.id), ['ok']);
    assert.deepEqual(cleanSiteList('contacts', 'nope'), []);
  });
  it('a row id is kept only when short and not a repeat', () => {
    const r = parsePublicSitePatch({ questions: [
      { id: 'same', question: 'A?', answer: 'a' },
      { id: 'same', question: 'B?', answer: 'b' },
      { id: 'x'.repeat(65), question: 'C?', answer: 'c' },
    ] }, (() => { let n = 0; return () => `new-${++n}`; })());
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.patch.questions?.map(q => q.id), ['same', 'new-1', 'new-2']);
  });
  it('the editor\'s House league row says the home\'s words when only past seasons are published', () => {
    const facts = { teams: 0, leagueSeason: null, leaguePast: true, tournaments: 0, archives: 0, about: false };
    const by = Object.fromEntries(editorSectionRows({ order: undefined, hidden: [] }, facts, { teams: false, league: true, tournaments: false }).map(r => [r.key, r]));
    assert.equal(by.league.sub, 'Past seasons and results');
  });
});
