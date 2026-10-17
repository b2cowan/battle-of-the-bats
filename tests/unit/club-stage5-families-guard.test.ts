import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode } from './_source-code.ts';
import {
  defaultKeeper, firstNamesAgree, proposalHolding, proposeDuplicates, sameChild,
  type DuplicateChildIn, type DuplicatePersonIn,
} from '../../lib/families-duplicates.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 5b — FAMILIES, THE SCREENS (hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P1–P3; build prompt
 * docs/projects/active/CLUB_TIER_STAGE5B_BUILD_PROMPT.md). Two halves:
 *   1. THE DUPLICATE RULE (Ask 7), exercised directly: first names agree (an initial matches its name), a shared child
 *      is the same child (name + birth date where both known, else the same team and season), the edited-email proposal
 *      joins, three or more are ONE proposal, the keeper's default is the side with children then the newer, and a
 *      merge request naming an unproposed pair finds no proposal (the route refuses it).
 *   2. THE SCREENS' SHAPE, read from source: two tabs and a rail row with no pages; the Show control is the pick-one
 *      dropdown with `lead` and no row of pills; the family opens in KitDialog with `address` and `steps` and no `edit`;
 *      the record renders no footnote paragraphs; Duplicates posts the keeper the reviewer chose; the merge route runs
 *      the rule again and refuses an unproposed pair.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const child = (name: string, context: string, birthDate: string | null = null): DuplicateChildIn => ({ name, context, birthDate, where: context });
const person = (id: string, first: string | null, last: string | null, over: Partial<DuplicatePersonIn> = {}): DuplicatePersonIn => ({
  id, firstName: first, lastName: last, name: `${first ?? ''} ${last ?? ''}`.trim() || `${id}@example.com`,
  email: `${id}@example.com`, phone: null, createdAt: '2026-08-01T00:00:00Z', addressCount: 1, optedOut: false, children: [], ...over,
});
const none = new Set<string>();

describe('The duplicate rule (Ask 7) — one home, lib/families-duplicates.ts', () => {
  it('first names must agree: the same name, or an initial that matches it; an empty name agrees with nothing', () => {
    assert.equal(firstNamesAgree('Dana', 'dana'), true);
    assert.equal(firstNamesAgree('D.', 'Dana'), true);
    assert.equal(firstNamesAgree('Dana', 'D'), true);
    assert.equal(firstNamesAgree('Dana', 'Sam'), false);
    assert.equal(firstNamesAgree('D.', 'Sam'), false);
    assert.equal(firstNamesAgree(null, 'Dana'), false);
    assert.equal(firstNamesAgree('', ''), false);
  });

  it('a shared child is the same child: birth dates decide where both carry one, else the team and season', () => {
    assert.equal(sameChild(child('Caleb Hughes', 'rep:t1:s1'), child('Caleb Hughes', 'rep:t1:s1')), true);
    assert.equal(sameChild(child('Caleb Hughes', 'rep:t1:s1'), child('Caleb Hughes', 'rep:t2:s1')), false, 'one name on two teams is two children');
    assert.equal(sameChild(child('Caleb Hughes', 'rep:t1:s1', '2014-02-03'), child('Caleb Hughes', 'league:x', '2014-02-03')), true, 'one birth date across a roster and a registration');
    assert.equal(sameChild(child('Caleb Hughes', 'rep:t1:s1', '2014-02-03'), child('Caleb Hughes', 'rep:t1:s1', '2015-02-03')), false, 'two birth dates are two children');
    assert.equal(sameChild(child('Caleb Hughes', 'rep:t1:s1'), child('Riley Hughes', 'rep:t1:s1')), false);
  });

  it('UAT Rep Club\'s seed shape: seven "Caleb Hughes" guardians on seven teams propose NOTHING', () => {
    const people = Array.from({ length: 7 }, (_, i) => person(`p${i}`, ['Jordan', 'Alex', 'Sam', 'Casey', 'Morgan', 'Taylor', 'Drew'][i], 'Hughes', {
      children: [child('Caleb Hughes', `rep:team${i}:s1`)],
    }));
    assert.equal(proposeDuplicates({ people, rejected: none, moves: [] }).length, 0);
  });

  it('proposes same surname + agreeing first names + a phone or the same child', () => {
    const people = [
      person('a', 'Dana', 'Cole', { phone: '555-0101', children: [child('Peyton Cole', 'rep:t1:s1')] }),
      person('b', 'D.', 'Cole', { phone: '(555) 0101' }),
      person('c', 'Sam', 'Cole', { phone: '555-0101' }),
    ];
    const out = proposeDuplicates({ people, rejected: none, moves: [] });
    assert.equal(out.length, 1, 'Sam Cole shares the phone but not the first name');
    assert.deepEqual(out[0].sides.map(s => s.personId).sort(), ['a', 'b']);
    assert.deepEqual(out[0].reasons, ['phone']);
    assert.equal(out[0].keep, 'a', 'the side with children keeps by default');
  });

  it('the keeper default: the side with children, then the newer — never the database order', () => {
    assert.equal(defaultKeeper([person('x', 'A', 'B', { createdAt: '2026-01-01' }), person('y', 'A', 'B', { createdAt: '2026-02-01' })]), 'y');
    assert.equal(defaultKeeper([
      person('x', 'A', 'B', { createdAt: '2026-01-01', children: [child('K B', 'rep:t:s')] }),
      person('y', 'A', 'B', { createdAt: '2026-02-01' }),
    ]), 'x');
  });

  it('three or more that match are ONE proposal; "not the same person" is remembered', () => {
    const people = ['a', 'b', 'c'].map(id => person(id, 'Lee', 'Aoki', { phone: '555-0199' }));
    const out = proposeDuplicates({ people, rejected: none, moves: [] });
    assert.equal(out.length, 1);
    assert.equal(out[0].sides.length, 3);
    const rejected = new Set(['a|b']);
    const split = proposeDuplicates({ people, rejected, moves: [] });
    assert.ok(split.every(p => p.sides.length === 2), 'a group holding a rejected pair is shown as its pairs');
    assert.ok(!split.some(p => p.sides.some(s => s.personId === 'a') && p.sides.some(s => s.personId === 'b')), 'the rejected pair never returns');
  });

  it('an edited email (5a, E02) is proposed whatever the names say, the child\'s new record keeping', () => {
    const people = [
      person('old', 'Val', 'Whitehall', { createdAt: '2026-09-01' }),
      person('new', 'Val', 'Whitehall', { createdAt: '2026-10-12', children: [child('Tatum Whitehall', 'rep:t1:s1')] }),
    ];
    const out = proposeDuplicates({ people, rejected: none, moves: [{ fromPersonId: 'old', toPersonId: 'new', at: '2026-10-12T10:00:00Z', sentence: 'An email changed on Tatum’s roster row, Oct 12, 2026' }] });
    assert.equal(out.length, 1);
    assert.ok(out[0].reasons.includes('email_changed'));
    assert.equal(out[0].emailChanged, 'An email changed on Tatum’s roster row, Oct 12, 2026');
    assert.equal(out[0].keep, 'new');
    assert.equal(out[0].sides.find(s => s.personId === 'old')?.emptiedAt, '2026-10-12T10:00:00Z');
  });

  it('a merge naming an unproposed pair finds no proposal (the route answers 409)', () => {
    const people = [person('a', 'Dana', 'Cole', { phone: '555-0101' }), person('b', 'Dana', 'Cole', { phone: '555-0101' }), person('z', 'Zed', 'Other')];
    const out = proposeDuplicates({ people, rejected: none, moves: [] });
    assert.ok(proposalHolding(out, ['a', 'b']));
    assert.equal(proposalHolding(out, ['a', 'z']), null);
    assert.equal(proposalHolding(out, ['a']), null, 'a merge needs two records');
    assert.equal(proposalHolding(out, ['a', 'a']), null, 'never a record into itself');
  });

  it('a request naming PART of a group is refused — only the whole card stands (/review 2026-10-17)', () => {
    const people = [
      person('a', 'Dana', 'Cole', { phone: '555-0101' }),
      person('b', 'D.', 'Cole', { phone: '555-0101' }),
      person('c', 'Dane', 'Cole', { phone: '555-0101' }),
    ];
    const out = proposeDuplicates({ people, rejected: none, moves: [] });
    assert.equal(out.length, 1);
    assert.equal(out[0].sides.length, 3, 'D. matches both, so the three are one card');
    assert.equal(proposalHolding(out, ['a', 'c']), null, 'Dana and Dane never matched each other');
    assert.ok(proposalHolding(out, ['a', 'b', 'c']));
  });
});

describe('The screens (Stage 5b) — read from source', () => {
  const book = readCode('components/admin/kit/club/families/FamiliesBook.tsx');
  const record = readCode('components/admin/kit/club/families/FamilyRecordWindow.tsx');
  const dups = readCode('components/admin/kit/club/families/DuplicatesTab.tsx');

  it('Families has two tabs behind a server gate, and its rail row no pages', () => {
    const nav = readCode('lib/admin-kit-nav.ts');
    assert.match(nav, /case 'families':[\s\S]{0,600}?pages: \[\]/);
    assert.match(readCode('components/admin/kit/club/families/FamiliesFrame.tsx'), /<HubTabBar tabs=\{tabs\}/);
    const layout = readCode('app/[orgSlug]/admin/families/layout.tsx');
    assert.match(layout, /canOpenFamilies\(ctx, ctx\.org\)/, 'the gate is decided on the server');
    // The page's gate and every route's ask one rule.
    assert.match(readCode('lib/families-access.ts'), /canOpenModule\(member, org, 'module_families'\) && !member\.repGroupIds/);
    assert.match(readCode('lib/families-auth.ts'), /canOpenModule\(ctx, ctx\.org, 'module_families'\)/);
    assert.ok(!existsSync('app/[orgSlug]/admin/families/families.module.css'), 'the old look is retired');
  });

  it('the Show control is the pick-one dropdown with `lead`, and no row of pills renders', () => {
    assert.match(book, /<SingleSelectDropdown[^>]*\blead\b/);
    assert.doesNotMatch(book, /styles\.chip|chipOn|className=\{`\$\{styles\.chip/, 'no chip row');
    assert.doesNotMatch(book, /href=\{`\$\{base\}\/duplicates`\}/, 'Duplicates is a tab, not a chip that leaves the page');
  });

  it('a family opens in KitDialog with `address` and `steps` — and no `edit` (it reads: Ask 15)', () => {
    assert.match(record, /address: address\(personId\)/);
    assert.match(record, /steps,/);
    assert.match(record, /<KitDialog/);
    assert.doesNotMatch(record, /\bedit=\{/);
    assert.match(book, /<FamilyRecordWindow/);
  });

  it('the record renders no footnote paragraphs (Ask 6 — the explanations live in Help)', () => {
    assert.doesNotMatch(record, /panelFoot|One switch, org-wide|House league keeps no forms|forms are rep-only/);
  });

  it('Duplicates posts the keeper the reviewer chose', () => {
    assert.match(dups, /keepers\[p\.id\] \?\? p\.keep/);
    assert.match(dups, /action: 'merge', keepId: keep, mergeIds:/);
    assert.match(dups, /type="radio"/);
  });

  it('the merge route runs the rule again and refuses an unproposed pair', () => {
    const route = readCode('app/api/admin/families/duplicates/route.ts');
    assert.match(route, /proposalHolding\(await buildDuplicatePairs\(ctx\.org\.id\), asked\)/);
    assert.match(route, /code: 'not_proposed'[\s\S]{0,40}status: 409/);
    const proposalCheck = route.indexOf('proposalHolding(');
    assert.ok(proposalCheck > 0 && proposalCheck < route.indexOf('mergePeople('), 'the check comes before any merge');
  });

  it('Ask the coaches: colleague mail, never the family door; the log claimed before any email; counts only', () => {
    const ask = readCode('lib/families-coach-ask.ts');
    assert.doesNotMatch(ask, /sendFamilyEmail/);
    assert.match(ask, /rpc\('family_coach_ask_claim'/);
    assert.ok(ask.indexOf("rpc('family_coach_ask_claim'") < ask.indexOf('sendEmail('), 'the claim comes before any email');
    assert.match(ask, /eventType: 'club_guardians_asked'/);
    assert.doesNotMatch(ask.slice(ask.indexOf(".from('family_coach_asks').update(")), /players:|childName|children:/, 'the log keeps counts, never names');
  });
});
