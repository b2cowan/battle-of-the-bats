import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  birthdaySportRows,
  cutoffRowSentence,
  cutoffAskTitle,
  cutoffAskBody,
  oneYearSentence,
  divisionBornState,
  type BirthdaySportRow,
} from '../../lib/birthday-cutoff.ts';
import { JAN_1, checkBornBody } from '../../lib/born-years.ts';
import { CLUB_LOOK_FIELDS } from '../../lib/public-site-builder.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const SEP_1 = { m: 9, d: 1 };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SETTINGS CARD "WHEN BIRTHDAYS COUNT FROM" and the house-league division checks (Club Tier Stage 4c-2 Part A; copy
 * CLUB_TIER_STAGE4C2_COPY.md B, C, K8). The rule itself is tested in club-stage4c2.test.ts; this file pins which sports
 * a club runs, what the card says under each, the ask-once window's sentences, the division window's held state, and who
 * may send the cut-off (the owner alone, ruled 2026-10-22).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const team = (name: string, sport: string | null, years: [number | null, number | null] | null, over: Partial<{ isArchived: boolean; status: string; createdAt: string }> = {}) => ({
  name,
  sport,
  isArchived: over.isArchived ?? false,
  seasons: [{ status: over.status ?? 'active', createdAt: over.createdAt ?? '2026-01-01', bornFromYear: years?.[0] ?? null, bornToYear: years?.[1] ?? null }],
});

describe('the sports a club runs', () => {
  it('lists a sport for a non-archived rep team or house-league season, compared through the sport id', () => {
    const rows = birthdaySportRows(
      [team('13U Softball', 'Softball', [2013, 2014]), team('11U Softball', 'softball', null), team('9U Ball', 'baseball', null)],
      [{ sport: 'SOFTBALL', status: 'active', divisions: [] }],
    );
    assert.deepEqual(rows.map(r => [r.id, r.label, r.repTeams, r.houseLeagueSeasons]), [
      ['softball', 'Softball', 2, 1],
      ['baseball', 'Baseball', 1, 0],
    ]);
  });

  it('leaves out a sport only an archived team or an archived season carries', () => {
    const rows = birthdaySportRows(
      [team('Old', 'hockey', null, { isArchived: true }), team('Live', 'softball', null)],
      [{ sport: 'baseball', status: 'archived', divisions: [] }],
    );
    assert.deepEqual(rows.map(r => r.id), ['softball']);
  });

  it('a blank sport is the legacy softball, an unknown one is other', () => {
    const rows = birthdaySportRows([team('A', null, null), team('B', 'curling', null)], []);
    assert.deepEqual(rows.map(r => r.id), ['softball', 'other']);
  });

  it('a team’s years are its LIVE season’s: the newest draft or active one, never a closed one', () => {
    const t = {
      name: '15U',
      sport: 'softball',
      isArchived: false,
      seasons: [
        { status: 'completed', createdAt: '2025-01-01', bornFromYear: 2010, bornToYear: 2011 },
        { status: 'active', createdAt: '2026-01-01', bornFromYear: 2011, bornToYear: 2012 },
      ],
    };
    const [row] = birthdaySportRows([t], []);
    assert.deepEqual(row.teams, [{ name: '15U', from: 2011, to: 2012 }]);
    const [closedOnly] = birthdaySportRows([{ ...t, seasons: [t.seasons[0]] }], []);
    assert.deepEqual(closedOnly.teams, [], 'a team with no live season carries no years');
  });

  it('counts a finished house-league season but only a live one’s divisions carry years', () => {
    const div = { name: 'U9', bornFromYear: 2017, bornToYear: 2018 };
    const [row] = birthdaySportRows([], [
      { sport: 'softball', status: 'active', divisions: [div, { name: 'None', bornFromYear: null, bornToYear: null }] },
      { sport: 'softball', status: 'completed', divisions: [{ ...div, name: 'Old U9' }] },
    ]);
    assert.equal(row.houseLeagueSeasons, 2);
    assert.deepEqual(row.divisions.map(d => d.name), ['U9']);
  });

  it('keeps teams in name order (numbers read as numbers)', () => {
    const [row] = birthdaySportRows([team('13U', 'softball', [2013, 2014]), team('9U', 'softball', [2016, 2017]), team('11U', 'softball', [2014, 2015])], []);
    assert.deepEqual(row.teams.map(t => t.name), ['9U', '11U', '13U']);
  });
});

const row = (over: Partial<BirthdaySportRow> = {}): BirthdaySportRow => ({
  id: 'softball', label: 'Softball', repTeams: 2, houseLeagueSeasons: 1, teams: [], divisions: [], ...over,
});

describe('what the card says under a sport (C4)', () => {
  it('counts with the right plurals and leaves a zero part out', () => {
    assert.equal(cutoffRowSentence(row({ repTeams: 1, houseLeagueSeasons: 0 }), JAN_1), '1 rep team. No birth years entered yet.');
    assert.equal(cutoffRowSentence(row({ repTeams: 9, houseLeagueSeasons: 0 }), JAN_1), '9 rep teams. No birth years entered yet.');
    assert.equal(cutoffRowSentence(row({ repTeams: 0, houseLeagueSeasons: 1 }), JAN_1), '1 house-league season. No birth years entered yet.');
    assert.equal(cutoffRowSentence(row({ repTeams: 2, houseLeagueSeasons: 3 }), JAN_1), '2 rep teams, 3 house-league seasons. No birth years entered yet.');
  });

  it('shows a real family line from the first team with years, counted with the saved date', () => {
    const teams = [{ name: '13U Softball', from: 2013, to: 2014 }, { name: '15U Softball', from: 2011, to: 2012 }];
    assert.equal(cutoffRowSentence(row({ teams }), JAN_1), '2 rep teams, 1 house-league season. Families see “Born 2013–2014”.');
    assert.equal(cutoffRowSentence(row({ teams }), SEP_1), '2 rep teams, 1 house-league season. Families see “Born Sep 1, 2013 – Aug 31, 2014”.');
  });

  it('skips a team the saved date cannot show and takes the next; with none showable it says only the counts', () => {
    const teams = [{ name: 'One year', from: 2013, to: 2013 }, { name: 'Range', from: 2012, to: 2014 }];
    assert.match(cutoffRowSentence(row({ teams }), SEP_1), /Families see “Born Sep 1, 2012 – Aug 31, 2014”/);
    assert.equal(cutoffRowSentence(row({ teams: [teams[0]] }), SEP_1), '2 rep teams, 1 house-league season.');
  });
});

describe('the ask-once window (C6, C7, C12(a))', () => {
  const teams = [{ name: '13U Softball', from: 2013, to: 2015 }];
  it('names the sport lower-case, and drops it for Other', () => {
    assert.equal(cutoffAskTitle(row(), SEP_1), 'Count softball birthdays from September 1?');
    assert.equal(cutoffAskTitle({ id: 'other', label: 'Other' }, SEP_1), 'Count birthdays from September 1?');
  });

  it('the body gives the example when a team can be shown, and nothing is sent', () => {
    assert.equal(
      cutoffAskBody(row({ teams }), SEP_1),
      'Every softball team and house-league division shows its birth years from September 1, on your site. 13U Softball will read “Born Sep 1, 2013 – Aug 31, 2015”. Nothing is sent to families.',
    );
    assert.equal(
      cutoffAskBody(row(), SEP_1),
      'Every softball team and house-league division shows its birth years from September 1, on your site. Nothing is sent to families.',
    );
    assert.match(cutoffAskBody({ ...row({ teams }), id: 'other', label: 'Other' }, SEP_1), /^Every team and house-league division shows/);
  });

  it('warns about a one-year place only when the new date is not January 1', () => {
    const one = row({ teams: [{ name: '13U Softball', from: 2013, to: 2013 }] });
    assert.equal(oneYearSentence(one, SEP_1), '13U Softball has one birth year and will show none from September 1 until you set it again.');
    assert.equal(oneYearSentence(one, JAN_1), null);
    assert.equal(oneYearSentence(row({ teams }), SEP_1), null, 'a range is fine');
  });

  it('counts teams and divisions together in the plural, and a mix says both', () => {
    const t = (n: string) => ({ name: n, from: 2013, to: 2013 });
    assert.equal(oneYearSentence(row({ teams: [t('A'), t('B')] }), SEP_1), '2 teams have one birth year and will show none from September 1 until you set them again.');
    assert.equal(oneYearSentence(row({ divisions: [t('U9'), t('U11')] }), SEP_1), '2 divisions have one birth year and will show none from September 1 until you set them again.');
    assert.equal(oneYearSentence(row({ teams: [t('A')], divisions: [t('U9'), t('U11')] }), SEP_1), '1 team and 2 divisions have one birth year and will show none from September 1 until you set them again.');
    assert.equal(oneYearSentence(row({ divisions: [t('U9')] }), SEP_1), 'U9 has one birth year and will show none from September 1 until you set it again.');
  });
});

describe('the division API’s check of a body (A15–A17)', () => {
  it('takes two years, one year or none', () => {
    assert.deepEqual(checkBornBody(2014, 2015, 2026), { ok: true, years: { from: 2014, to: 2015 } });
    assert.deepEqual(checkBornBody('2014', '', 2026), { ok: true, years: { from: 2014, to: null } });
    assert.deepEqual(checkBornBody(undefined, null, 2026), { ok: true, years: { from: null, to: null } });
    assert.deepEqual(checkBornBody(2013, 2013, 2026), { ok: true, years: { from: 2013, to: 2013 } }, 'one year is the same year twice on January 1');
  });

  it('holds a year that is not four digits, one after this year, and the earlier one second', () => {
    assert.deepEqual(checkBornBody('20', 2015, 2026), { ok: false, held: 'Use a four-digit year, like 2013, to save it.' });
    assert.deepEqual(checkBornBody(2014, { a: 1 }, 2026), { ok: false, held: 'Use a four-digit year, like 2013, to save it.' });
    assert.deepEqual(checkBornBody(2014, 2027, 2026), { ok: false, held: 'A birth year can’t be after 2026.' });
    assert.deepEqual(checkBornBody(2016, 2015, 2026), { ok: false, held: 'Put the earlier year first to save it.' });
  });
});

describe('the division window’s held state (B4, C12(b))', () => {
  it('a typed pair that fails is held and blocks the button', () => {
    const s = divisionBornState('2016', '2015', true, JAN_1, 2026);
    assert.equal(s.held, 'Put the earlier year first to save it.');
    assert.equal(s.blocks, true);
  });

  it('a typed pair off January 1 is checked on the dates, naming them', () => {
    const s = divisionBornState('2013', '2013', true, SEP_1, 2026);
    assert.equal(s.held, 'Aug 31, 2013 comes before Sep 1, 2013. Make the second year later to save it.');
    assert.equal(s.blocks, true);
  });

  it('a stored one-year pair left alone after a cut-off change shows the reason at rest and does not block', () => {
    const s = divisionBornState('2013', '2013', false, SEP_1, 2026);
    assert.equal(s.held, 'Families see no birth years for this division yet. From September 1, the second year has to be later than the first. Change it to show them.');
    assert.equal(s.blocks, false);
  });

  it('a pair that checks out has no reason; empty boxes are fine', () => {
    assert.deepEqual(divisionBornState('2014', '2015', true, JAN_1, 2026), { held: null, blocks: false, years: { from: 2014, to: 2015 } });
    assert.deepEqual(divisionBornState('', '', true, SEP_1, 2026), { held: null, blocks: false, years: { from: null, to: null } });
  });
});

describe('who may send when birthdays count from — the OWNER alone (ruled 2026-10-22; Stage 13 may revisit)', () => {
  it('it is not "the look": it stays out of the look fields an admin sends with the site editor', () => {
    assert.ok(!CLUB_LOOK_FIELDS.includes('birthdayCutoffs'));
  });

  it('it has no door through the org-settings route: not a field there, so the look editor never carries it', () => {
    const route = read('app/api/admin/org-settings/route.ts');
    assert.doesNotMatch(route, /birthdayCutoffs|birthday_cutoffs|cleanCutoffs/);
  });

  it('its own route saves it behind ONE owner gate, and refuses a date off the lists or a sport the club does not run, in the ruled words', () => {
    const route = read('app/api/admin/org-settings/birthday-cutoffs/route.ts');
    const patch = route.slice(route.indexOf('export const PATCH'));
    assert.ok(patch.includes("ctx.role !== 'owner') return forbidden()"), 'the PATCH is the owner’s alone');
    assert.ok(!patch.includes("'admin'"));
    assert.doesNotMatch(route, /clubLookEditor|cutoffEditor|isCutoffOnlyBody/, 'no owner-or-admin door for this field');
    assert.ok(patch.includes('cleanCutoffs({ [sport]: body?.cutoff })'), 'it takes ONE sport and validates it through the one rule');
    assert.ok(patch.includes('Pick a month and day from the lists.'));
    assert.ok(patch.includes("That isn't a sport your club runs."));
    assert.ok(patch.includes('.update({ birthday_cutoffs: next })'), 'it writes the stored map with that one sport merged in');
    assert.ok(patch.includes('const stored = ctx.org.birthdayCutoffs'), 'the merge starts from what is stored, not from the browser’s whole map');
    assert.ok(patch.includes('if (!appliesTo(ctx.org)) return forbidden()'), 'the same module check as the GET');
    assert.doesNotMatch(patch, /error\.message/, 'a database failure is a worded message, never the raw one');
    assert.ok(patch.includes("Couldn't save your changes. Try again."));
  });

  it('the card sends one sport at a time, locks its pickers while a save is in flight, and refreshes the org so Team details sees the date', () => {
    const card = read('components/admin/kit/club/BirthdayCutoffCard.tsx');
    assert.ok(card.includes('JSON.stringify(change)'));
    assert.doesNotMatch(card, /birthdayCutoffs: map/, 'no whole-map overwrite');
    assert.equal((card.match(/disabled=\{saving\}/g) ?? []).length, 3, 'month, day and Change');
    assert.ok(card.includes('void refresh()'));
  });

  it('the card’s own read and the card itself are the owner’s: an admin never sees it on Settings', () => {
    const route = read('app/api/admin/org-settings/birthday-cutoffs/route.ts');
    assert.ok(route.includes("ctx.role !== 'owner') return forbidden()"));
    assert.ok(!route.includes("ctx.role !== 'admin'"));
    assert.match(read('components/admin/kit/club/BirthdayCutoffCard.tsx'), /org-settings\/birthday-cutoffs\$\{orgQuery\}`, \{\s+method: 'PATCH'/, 'the card saves through its own route');
    const kit = read('components/admin/kit/club/SettingsKit.tsx');
    assert.ok(kit.includes('<BirthdayCutoffCard orgQuery={orgQuery} initial={cutoffData} />'));
    assert.ok(kit.includes('loadBirthdayCutoffs(orgQuery)'), 'the card’s read rides the page’s own load, so it appears with every other card');
    assert.doesNotMatch(kit, /userRole === 'admin' && <BirthdayCutoffCard/);
  });

  it('Team details shows "Change in Settings" to the owner only; an admin reads the cut-off sentence alone', () => {
    const page = read('app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx');
    const at = page.indexOf('>Change in Settings</Link>');
    assert.ok(at > 0);
    const before = page.slice(Math.max(0, at - 220), at);
    assert.ok(before.includes('{isOwner && ('), 'the link is the owner’s');
    assert.ok(page.includes("isOwner={userRole === 'owner'}"));
    assert.ok(!before.includes('canWrite'), 'an admin (canWrite) does not get the link');
  });
});

describe('one recipe for the birth-year boxes and one server check for a stored pair', () => {
  it('the division windows draw the shared BornYearsBoxes, not a second copy of the markup', () => {
    const w = read('app/[orgSlug]/admin/house-league/seasons/[seasonId]/DivisionBornYears.tsx');
    assert.match(w, /<BornYearsBoxes/);
    assert.doesNotMatch(w, /<input/);
  });

  it('the season PATCH and the division routes validate through checkBornBody, with the same words', async () => {
    const patch = read('lib/program-year-patch.ts');
    assert.ok(patch.includes('checkBornBody(rawFrom, rawTo, thisYear)'));
    assert.doesNotMatch(patch, /isFourDigit/, "no second copy of the year check");
    const { bornYearsFromBody } = await import('../../lib/program-year-patch.ts');
    const none = { from: null, to: null };
    for (const [body, held] of [
      [{ bornFromYear: '20', bornToYear: 2015 }, 'Use a four-digit year, like 2013, to save it.'],
      [{ bornFromYear: 2014, bornToYear: 2027 }, 'A birth year can’t be after 2026.'],
      [{ bornFromYear: 2016, bornToYear: 2015 }, 'Put the earlier year first to save it.'],
    ] as const) {
      assert.deepEqual(bornYearsFromBody(body, none, 2026), { error: held });
      const c = checkBornBody(body.bornFromYear, body.bornToYear, 2026);
      assert.deepEqual(c, { ok: false, held });
    }
  });
});

describe('the house-league division routes carry and check the pair', () => {
  it('Add division checks, then inserts the two columns', () => {
    const route = read('app/api/admin/house-league/seasons/[seasonId]/divisions/route.ts');
    assert.match(route, /checkBornBody\(body\.bornFromYear, body\.bornToYear/);
    assert.match(route, /bornColumns\(born\.years\)/);
  });

  it('Edit division changes the pair only when the window sent it', () => {
    const route = read('app/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]/route.ts');
    assert.match(route, /bornYearsFromBody\(body, stored\.born/, 'a side the window leaves out keeps the stored one');
    assert.match(route, /patch\.bornFromYear = born\.years\.from/);
  });
});
