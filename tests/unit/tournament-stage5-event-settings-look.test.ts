/**
 * EVENT SETTINGS IN THE KIT'S LOOK (Tournament admin redesign Stage 5 addendum, A71–A77, owner 2026-10-12: "agree with
 * your recommendations"; findings F108–F114, sheet LRhCUNmjGNsHGUcWH6XBCS). What the build must keep true:
 *   - A71  every card in the Fees card's look: the public-site screen's stylesheet and the global form classes are gone
 *          from the page; the card titles are sentence case, 16px on the kit's card;
 *   - A72  every on/off setting is ONE switch row (SwitchRows — no ON / OFF button pairs, no Enabled / Disabled); the
 *          one-value choices are dropdowns; the format reads as its value once the event leaves Draft;
 *   - A73  the tie-breakers on the reorder standard, with Remove in the handle's menu (opt-in; the other lists as they
 *          were) and Coin Toss holding its place;
 *   - A74  the questions live in their card; the old page is a redirect to it; the Teams page and the help open it;
 *   - A75  the web address left Event settings: Settings & access's fourth door on the tournament plans only, one name
 *          "Web address" on both sides;
 *   - A76  the stragglers' labels in the kit's sentence case;
 *   - the "are you sure" boxes are the kit's asking window.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { EVENT_SETTINGS_WORDS as W } from '../../lib/event-settings-words.ts';
import { WEB_ADDRESS_WORDS as WA } from '../../lib/web-address-words.ts';
import { QUESTION_WORDS } from '../../lib/tournament-settings-words.ts';
import { getWebAddressHref } from '../../lib/billing-urls.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const EVENT = 'app/[orgSlug]/admin/tournaments/settings/event';
const page = code(`${EVENT}/page.tsx`);

describe('A71 · the look: every card like Fees & payments', () => {
  it('the public-site screen\'s stylesheet and the global form classes left the page', () => {
    assert.doesNotMatch(page, /branding\.module\.css/);
    assert.doesNotMatch(page, /className="form-(?:label|input|select|textarea|group|row)/);
    assert.doesNotMatch(page, /form-row-2|styles\.(?:subSectionLabel|segmentButton|descriptionText|inheritNote|urlPreview|cardDivider|warningBanner)/);
    assert.doesNotMatch(page, /KIT_INK|<em>/, 'no inline kit ink, no italics');
  });
  it('the seven cards keep their order and their deep links, titled in sentence case', () => {
    const order = [...page.matchAll(/<CollapsibleCard title=\{W\.cards\.(\w+)\} sectionId="([\w-]+)"/g)].map(m => `${m[1]}:${m[2]}`);
    assert.deepEqual(order, ['overview:overview', 'questions:questions', 'roster:roster', 'fees:fees', 'contact:contact', 'coachEmails:coach-emails', 'schedule:schedule']);
    assert.deepEqual(Object.values(W.cards), ['Tournament overview', 'Registration questions', 'Roster requirements', 'Fees & payments', 'Contact', 'Coach emails', 'Schedule rules']);
  });
  it('the kit\'s card title is the house\'s 16px heading (P2: the shared card, Event settings and Public site alike)', () => {
    const css = read('components/admin/CollapsibleCard.module.css');
    assert.match(css, /:global\(\[data-admin-kit\]\) \.title \{\n\s+font-family: var\(--font-sans, system-ui, sans-serif\);\n\s+font-size: var\(--type-heading\);/, 'the body face, as every heading is (D1, owner 2026-10-19)');
  });
  it('the turnover example ends on the clock\'s own period (F114: "a.m..")', () => {
    assert.match(page, /no earlier than \{formatTime\(minutesToTime\(8 \* 60 \+ gameDurationMinutes \+ bufferMinutes\)\)\}\n/);
  });
});

describe('A72 · the controls: switch rows and dropdowns', () => {
  it('every on/off setting is one switch row — 16, the Fees card\'s included — and no ON / OFF pair is left', () => {
    assert.equal((page.match(/<SwitchRow\b/g) ?? []).length, 11, 'eleven written out and the six coach emails as one mapped row: 16 in all');
    assert.match(page, /\]\)\.map\(\(\[label, desc, value, setValue\]\) => \(\n\s+<SwitchRow key=\{label\}[^\n]*dim=\{coachEmailPauseAll\}/);
    assert.doesNotMatch(page, /role="radiogroup"|role="radio"|segmentedControl|\[\[true, 'On'\]|'Enabled'|'Disabled'/);
    assert.doesNotMatch(page, /role="switch"/, 'the switch is SwitchRows\', never a second one on this page');
    assert.match(page, /name="Post-event results"\n\s+caption=\{W\.postEventLine\}/);
    assert.match(W.postEventLine, /^When on, /);
  });
  it('the dimmed coach emails say why, and keep their values', () => {
    assert.match(page, /\{coachEmailPauseAll && <p className=\{es\.warn\}>\{W\.coachEmailsOff\}<\/p>\}/);
    const rows = read('components/admin/tournament/SwitchRows.tsx');
    assert.match(rows, /dim\?: boolean;/);
    assert.match(rows, /disabled\?: boolean;/);
  });
  it('Player names is the switch list\'s own fixed row, and the list reads the card\'s padding rather than copying it', () => {
    assert.match(page, /<SwitchFixedRow\n\s+name="Player names"[\s\S]{0,200}word="Always"/);
    const css = read(`${EVENT}/event-settings.module.css`);
    assert.match(css, /margin: 0 calc\(-1 \* var\(--card-body-inline, 1\.25rem\)\) 0\.35rem;\n\s+--switch-row-inline: var\(--card-body-inline, 1\.25rem\);/);
    assert.doesNotMatch(css, /fixedRow|afterSwitch|p\.groupLine|label\.last|p\.choiceLine/, 'no hand-copied row, no rule that outranks another sheet');
    assert.match(read('components/admin/CollapsibleCard.module.css'), /\.body \{\n\s+--card-body-inline: 1\.25rem;/);
  });
  it('a choice of one value is a dropdown with its sentence under it', () => {
    for (const id of ['fee-model', 'instructions-where', 'contact-member', 'alert-routing', 'game-timing', 'tie-breaker-scope', 'score-finalization', 'tournament-format']) {
      assert.match(page, new RegExp(`<select\\s+id="${id}"`), id);
    }
  });
  it('Tournament format reads as its value with a lock once the event leaves Draft, a dropdown before', () => {
    assert.match(page, /\{formatLocked \? \(\n\s+<div className=\{ck\.field\}>[\s\S]{0,200}<Lock size=\{14\} aria-hidden \/> \{tournamentFormatLabel\(tournamentFormat\)\}/);
  });
  it('the "are you sure" boxes and the failure are the kit\'s asking window — no FeedbackModal', () => {
    assert.doesNotMatch(page, /FeedbackModal/);
    assert.equal((page.match(/<KitDialog\n\s+kind="question"/g) ?? []).length, 3, 'the format\'s, the public link\'s, a failure');
  });
});

describe('A73 · the tie-breakers on the reorder standard', () => {
  const editor = code('components/admin/TieBreakerEditor.tsx');
  const part = code('components/admin/tournament/ReorderList.tsx');
  it('the list is ReorderList, numbered, with Remove in the handle\'s menu and Coin Toss holding its place', () => {
    assert.match(editor, /<ReorderList[\s\S]{0,400}onRemove=\{disabled \? undefined : remove\}[\s\S]{0,100}fixed=\{hasCoin \? COIN_HOLDS : undefined\}/);
    assert.match(editor, /<ReorderRow key=\{b\} id=\{b\} number>/);
    assert.doesNotMatch(editor, /aria-label=\{`Remove|<X\b|useSensor\(|DndContext/, 'the ×, the drag-only grip and a second copy of the gesture went');
  });
  it('Remove is an opt-in — the menu offers it only when the list asks', () => {
    assert.match(part, /\{onRemove && \(\n\s+<button type="button" className=\{`\$\{styles\.menuItem\} \$\{styles\.menuRemove\}`\}/);
  });
  it('a row that holds its place never drags, and no move lands on or crosses it', () => {
    assert.match(part, /useSortable\(\{ id, disabled: ctx\.disabled \|\| holds \}\)/);
    assert.match(part, /for \(let i = lo; i <= hi; i\+\+\) if \(fixedSet\.has\(ids\[i\]\)\) return false;/);
    assert.match(part, /if \(canMove\(from, to\)\) onMove\(from, to\);/);
    assert.match(part, /disabled=\{!canMove\(idx, idx - 1\) \|\| disabled\}/);
  });
  it('a division\'s form gets the same list, its menu over the full-screen window', () => {
    assert.match(code('app/[orgSlug]/admin/tournaments/divisions/DivisionRecord.tsx'), /<TieBreakerEditor[\s\S]{0,400}overWindow\n/);
  });
});

describe('A74 · the questions live in their card', () => {
  it('the card lists them on the reorder standard and opens a question over Event settings', () => {
    const card = code(`${EVENT}/RegistrationQuestions.tsx`);
    assert.match(page, /<RegistrationQuestionsList key=\{questions\.apiBase\} q=\{questions\} orgQuery=\{orgQuery\} \/>/);
    assert.match(card, /<ReorderList ids=\{fields\.map\(f => f\.id\)\}/);
    assert.match(card, /<QuestionRecord\n/);
    assert.doesNotMatch(page, /Manage questions|registration-fields`/);
  });
  it('the summary says what the card holds', () => {
    assert.equal(QUESTION_WORDS.summary(0), 'No questions yet');
    assert.equal(QUESTION_WORDS.summary(1), '1 question');
    assert.equal(QUESTION_WORDS.summary(3), '3 questions');
  });
  it('the page\'s one pill says the order\'s save too', () => {
    assert.match(page, /saving=\{saveStatus === 'saving' \|\| questions\.order\.saving\}/);
  });
  it('the old address redirects to the card, carrying the event (P3)', () => {
    const route = code('app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx');
    assert.match(route, /redirect\(`\/\$\{encodeURIComponent\(orgSlug\)\}\/admin\/tournaments\/settings\/event\?section=questions\$\{event\}`\)/);
    assert.doesNotMatch(route, /'use client'|from=/);
  });
  it('the Teams page\'s Tools door and the help open the card', () => {
    assert.match(code('app/[orgSlug]/admin/tournaments/registrations/page.tsx'), /admin\/tournaments\/settings\/event\?section=questions`/);
    assert.match(read('lib/help-content/tournaments.tsx'), /href: '\.\.\/tournaments\/settings\/event\?section=questions'/);
    assert.doesNotMatch(read('lib/help-content/tournaments.tsx'), /href: '\.\.\/tournaments\/settings\/registration-fields'/);
  });
});

describe('A75 · the web address: Settings & access\'s fourth door, one name', () => {
  it('the address field left Event settings; the owner reads where it is changed', () => {
    assert.doesNotMatch(page, /org-settings|orgSlugInput|Organization Address|Update Address/);
    assert.match(page, /\{WA\.publicUrlLead\(currentOrg\?\.slug \?\? ''\)\} <Link href=\{webAddressHref\}/);
  });
  it('a tournament plan links to Settings & access; League and Club to the organization\'s Settings', () => {
    assert.equal(getWebAddressHref('x', 'tournament'), '/x/admin/tournaments/settings');
    assert.equal(getWebAddressHref('x', 'tournament_plus'), '/x/admin/tournaments/settings');
    assert.equal(getWebAddressHref('x', 'league'), '/x/admin/org/settings');
    assert.equal(getWebAddressHref('x', 'club'), '/x/admin/org/settings');
  });
  it('Settings & access shows the door on the tournament plans only — owner opens it, anyone else reads Owner only', () => {
    const hub = code('app/[orgSlug]/admin/tournaments/settings/page.tsx');
    assert.match(hub, /\.\.\.\(isTournamentTier\(currentOrg\?\.planId\) \? \[\{\n\s+onOpen: \(\) => setAddressOpen\(true\),\n\s+icon: Globe,\n\s+title: WA\.name,/);
    assert.match(hub, /meta: isOwner \? WA\.doorAction : WA\.ownerOnly,\n\s+enabled: isOwner,/);
    assert.match(hub, /\{addressOpen && isOwner && currentOrg && \(/);
  });
  it('its window asks once more, naming both addresses, and the server is unchanged', () => {
    const win = code('app/[orgSlug]/admin/tournaments/settings/WebAddressWindow.tsx');
    assert.match(win, /fetch\(`\/api\/admin\/org-settings\?orgSlug=\$\{encodeURIComponent\(current\)\}`, \{\n\s+method: 'PATCH'/);
    assert.match(win, /kind="question"\n\s+title=\{W\.askTitle\}/);
    assert.equal(WA.askBody('a', 'b'), 'Every link that uses fieldlogichq.ca/a stops working as soon as you change it. Nothing redirects to fieldlogichq.ca/b.');
  });
  it('one name on both sides: "Web address" — never "URL slug" or "Organization address" on a screen', () => {
    assert.equal(WA.name, 'Web address');
    const club = code('components/admin/kit/club/SettingsKit.tsx');
    assert.match(club, /htmlFor="settings-slug">\{WA\.name\}/);
    assert.doesNotMatch(club, />URL slug<|Changing your slug/);
  });
});

describe('A76 · the stragglers', () => {
  it('the Teams page\'s team forms and the bracket editor wear the kit\'s label', () => {
    const teams = code('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
    assert.doesNotMatch(teams, /className="form-label"/);
    for (const l of ['Team name', 'Payment status', 'Coach', 'Email']) assert.match(teams, new RegExp(`<label className=\\{ck\\.label\\} htmlFor="[\\w-]+">${l}`), l);
    assert.doesNotMatch(code('app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx'), /className="form-label">Teams in first round/);
  });
});
