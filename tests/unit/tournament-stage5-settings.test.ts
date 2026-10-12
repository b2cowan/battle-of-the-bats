/**
 * RULES & RESOURCES, REGISTRATION QUESTIONS, NOTIFICATIONS, THE SETTINGS HUB (Tournament admin redesign Stage 5,
 * Part 6 — E6, A50, A54; F30, F31). What the build must keep true:
 *   - one save model: a record reads first, its pencil edits all of it, which saves itself; Delete or Archive ends it
 *     and asks in the product's window; adding asks;
 *   - no browser alert() or confirm(), no patched browser Back, no leave dialog, no per-section Save;
 *   - order is a rare job: Tools → Reorder is a mode of the same list (Move up / Move down), a desk also drags;
 *   - every rules write reports its failure (the data layer throws);
 *   - Notifications: 52px rows whose whole width is the switch, the floating pill, today's event names;
 *   - the settings hub gains its "?".
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  QUESTION_WORDS, RULES_WORDS, archiveQuestion, deleteResourceQuestion, deleteSectionQuestion, questionCaption,
  resourceCaption, sectionCaption,
} from '../../lib/tournament-settings-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const exists = (p: string) => existsSync(new URL(`../../${p}`, import.meta.url));

const RULES = 'app/[orgSlug]/admin/tournaments/rules';
// The questions' list and record moved into Event settings' card (Stage 5 addendum, A74, 2026-10-12); their old page
// is a redirect (tournament-stage5-event-settings-look.test.ts).
const QUESTIONS = 'app/[orgSlug]/admin/tournaments/settings/event';

describe('the words (E6)', () => {
  it('a section says its points and where it applies', () => {
    assert.equal(sectionCaption(3, null), '3 points · every division');
    assert.equal(sectionCaption(4, ['U11 Girls', 'U13 Boys']), '4 points · U11 Girls and U13 Boys');
    assert.equal(sectionCaption(1, ['U15 Open']), '1 point · U15 Open');
    assert.equal(sectionCaption(0, null), 'No points yet · every division');
  });
  it('a link says where it goes; a file says it is one; a sample says it has no address', () => {
    assert.equal(resourceCaption('https://www.example.com/rules.pdf', false), 'A link · example.com');
    assert.equal(resourceCaption('https://x.supabase.co/storage/v1/object/public/resources/a.pdf', true), 'A file');
    assert.equal(resourceCaption('#', false), 'A link · no address yet');
  });
  it('a question says its type, its choices and required or optional', () => {
    assert.equal(questionCaption('checkbox', 0, false), 'A checkbox · optional');
    assert.equal(questionCaption('dropdown', 3, true), 'A dropdown · 3 choices · required');
    assert.equal(questionCaption('long_text', 0, false), 'Long text · optional');
  });
  it('Archive keeps today\'s sentence; Delete says what goes', () => {
    assert.equal(archiveQuestion('Hotel block needed?').body, 'Answers teams already gave stay with their registrations.');
    assert.match(deleteSectionQuestion('Pitching', 4).body, /^Its 4 points go with it\./);
    assert.match(deleteResourceQuestion('Rulebook', true).body, /The file is deleted too\./);
    assert.equal(RULES_WORDS.noRules, 'No rules yet. Add a section, or start from a sample.');
    // The Reorder mode's note retired with the mode (owner 2026-10-12: the portal's reorder standard).
    assert.equal('reorderNote' in QUESTION_WORDS, false);
    assert.equal('reorderNote' in RULES_WORDS, false);
  });
});

describe('one save model, no browser boxes (A50)', () => {
  const rules = code(`${RULES}/RulesAdmin.tsx`);
  const section = code(`${RULES}/RuleSectionRecord.tsx`);
  const resource = code(`${RULES}/ResourceRecord.tsx`);
  const samples = code(`${RULES}/SamplesWindow.tsx`);
  const questions = code(`${QUESTIONS}/RegistrationQuestions.tsx`);
  const question = code(`${QUESTIONS}/QuestionRecord.tsx`);
  it('no alert() or confirm() anywhere on Rules or Registration questions', () => {
    for (const src of [rules, section, resource, samples, questions, question]) {
      assert.doesNotMatch(src, /\b(?:window\.)?(?:alert|confirm)\(/);
    }
  });
  it('the per-section Save, the dirty lock, the patched Back and the leave dialog are gone', () => {
    assert.doesNotMatch(rules, /pushState|beforeunload|activeDirtySectionId|Save Changes|Leave without saving/);
    assert.doesNotMatch(rules, /<style jsx/);
    assert.equal(exists(`${RULES}/SamplesDrawer.tsx`), false);
    assert.equal(exists(`${RULES}/rules-kit.module.css`), false);
  });
  it('each record reads first, edits whole with autosave, and ends with Delete or Archive that asks', () => {
    for (const src of [section, resource, question]) {
      assert.match(src, /useRecordAutosave\(/);
      assert.match(src, /edit=\{canWrite \? \{ editing, onToggle/);
      assert.match(src, /kind="question"/);
    }
    assert.match(section, /<RecordDelete/);
    assert.match(question, /<RecordAction icon=\{<Archive/);
  });
  it('the rules writes report their failure (lib/db throws)', () => {
    const db = code('lib/db.ts');
    assert.match(db, /export async function saveRuleSectionWhole\(/);
    assert.match(db, /export async function deleteRuleSection[\s\S]{0,200}if \(error\) throw error;/);
    assert.match(db, /export async function updateResource[\s\S]{0,500}if \(error\) throw error;/);
    assert.doesNotMatch(db, /export async function (?:saveRuleItem|updateRuleItem|deleteRuleItem)\(/);
  });
});

describe('order: the portal\'s reorder standard (owner 2026-10-12, superseding A54\'s Tools → Reorder mode)', () => {
  it('Rules\' sections, its links and files, a section\'s points and Registration questions all move by the one part', () => {
    for (const p of [`${RULES}/RulesAdmin.tsx`, `${RULES}/RuleSectionRecord.tsx`, `${QUESTIONS}/RegistrationQuestions.tsx`]) {
      const src = code(p);
      assert.match(src, /<ReorderList\b/);
      assert.match(src, /<ReorderRow\b/);
      assert.doesNotMatch(src, /MoveButtons|SortableRows|ORDER_WORDS\.(?:reorder|done)|setReordering|reorderNote/);
    }
    assert.equal((code(`${RULES}/RulesAdmin.tsx`).match(/<ReorderList\b/g) ?? []).length, 2, 'the sections and the links and files');
  });
  it('a section\'s points sit in a full-screen window on a phone: the menu sheet goes over it', () => {
    assert.match(code(`${RULES}/RuleSectionRecord.tsx`), /<ReorderList[\s\S]{0,300}overWindow/);
  });
  it('the kit row carries the handle beside its control, at every width', () => {
    const kit = code('components/admin/kit/club/RepKit.tsx');
    assert.match(kit, /\{grip && <span className=\{styles\.rowGrip\}>\{grip\}<\/span>\}/);
    assert.doesNotMatch(read('components/admin/kit/club/RepKit.module.css'), /\.rowGrip \{ display: none; \}/);
    assert.doesNotMatch(read(`${RULES}/rules.module.css`), /\.pointGrip \{ display: none; \}/);
  });
  it('each card carries its own Layout, absent while the card is empty — no shared Tools (owner, 2026-10-12)', () => {
    const src = code(`${RULES}/RulesAdmin.tsx`);
    assert.match(src, /const rulesLayoutMenu = layoutMenu\(W\.rulesLayout, <>\s*<CoachToolbarMenuItem[^\n]*chooseLayout\('rulesLayout', 'single'\)/);
    assert.match(src, /const resourcesLayoutMenu = layoutMenu\(W\.resourcesLayout, <>\s*<CoachToolbarMenuItem[^\n]*chooseLayout\('resourcesLayout', 'list'\)/);
    assert.match(src, /\{rules\.length > 0 && rulesLayoutMenu\}\{addButton\(W\.addSection/);
    assert.match(src, /\{resources\.length > 0 && resourcesLayoutMenu\}\{addButton\(W\.addResource/);
    assert.doesNotMatch(src, /W\.tools\b/);
  });
  it('each card has its own Start from a sample, and its window offers that card\'s kind only (owner, 2026-10-12)', () => {
    const src = code(`${RULES}/RulesAdmin.tsx`);
    assert.match(src, /onClick=\{\(\) => setSamplesFor\('sections'\)\} chevron\s+title=\{W\.sample\} caption=\{W\.sampleCaption\}/);
    assert.match(src, /onClick=\{\(\) => setSamplesFor\('links'\)\} chevron\s+title=\{W\.sample\} caption=\{W\.linkSampleCaption\}/);
    assert.match(src, /<SamplesWindow kind="sections" onAdd=\{addSampleSection\}/);
    assert.match(src, /<SamplesWindow kind="links" onAdd=\{addSampleResource\}/);
    const samples = code(`${RULES}/SamplesWindow.tsx`);
    assert.match(samples, /\{props\.kind === 'sections' \? \(/);
    assert.doesNotMatch(samples, /onAddSection|onAddResource/);
  });
});

describe('notifications and the hub (E6, F31)', () => {
  const page = code('app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx');
  it('each row is one switch its whole width (the shared switch rows), the pill says each save', () => {
    const rows = code('components/admin/tournament/SwitchRows.tsx');
    // One button per row; `dim` (Event settings' coach emails, Stage 5 addendum P1) only adds a class to it.
    assert.match(rows, /<button type="button" role="switch" aria-checked=\{on\} className=\{dim \? `\$\{styles\.row\} \$\{styles\.rowDim\}` : styles\.row\}/);
    assert.match(read('components/admin/tournament/SwitchRows.module.css'), /min-height: 52px;/);
    assert.match(page, /<SwitchRows>/);
    assert.match(page, /<SavePill /);
    assert.match(page, /NOTIFICATION_EVENT_LABELS\[et\]/);
  });
  it('the settings hub gains its "?" and keeps its three cards', () => {
    const hub = code('app/[orgSlug]/admin/tournaments/settings/page.tsx');
    assert.match(hub, /<HelpButton help=\{SETTINGS_HELP\}/);
    assert.match(hub, /title: 'Staff & access'/);
    assert.match(hub, /title: 'Notification preferences'/);
  });
});
