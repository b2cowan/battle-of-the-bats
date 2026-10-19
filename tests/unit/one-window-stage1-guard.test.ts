import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, filesUnder, openingTags, parseProps, readCode, readSource, splitPhoneCss, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE WINDOW · STAGE 1 — ONE LOOK (owner rulings Q1–Q16, 2026-10-18; the Stage 1 width audit's calls
 * S1–S5, the same day). Plan: `docs/projects/active/ONE_WINDOW_PLAN.md`.
 *
 *   Q1  Field labels are sentence case everywhere a field is labelled: one declaration
 *       (`components/shared/FieldLabel.module.css`) that every label class composes, and no Title Case
 *       label text in either portal (dropping the small capitals exposed it: "Season Name").
 *   Q2  The admin's fields are the portal's: the paper tone, 36px on a computer, 6px corners.
 *   Q3  Widths: 520 a form, 640 (`size="medium"`), 800 (`size="wide"`).
 *   Q5  The coaches portal's windows dim the page in the themed tone, not black.
 *   Q6  The admin's window has a tinted edge and no shadow.
 *   S1  The club kit's required star is in the label's ink (the 2026-08-25 ruling, finished).
 *   S4  A record window keeps today's width on every path: it passes a `size`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const FIELD_LABEL = 'components/shared/FieldLabel.module.css';
const kitDialogCss = readCode('components/admin/kit/club/KitDialog.module.css');
const clubKitCss = readCode('components/admin/kit/club/ClubKit.module.css');
const coachesCss = readCode('app/[orgSlug]/coaches/coaches.module.css');

/** The label's three declarations, for a selector that cannot compose (a child selector, `legend`, a global rule). */
function assertLabelRecipe(rule: string, where: string) {
  assert.match(rule, /font-size: var\(--type-support\);/, `${where}: the label's size`);
  assert.match(rule, /font-weight: 650;/, `${where}: the label's weight`);
  assert.match(rule, /color: var\(--text-secondary\);/, `${where}: the label's ink`);
  assert.doesNotMatch(rule, /text-transform: uppercase|letter-spacing: 0\./, `${where}: small capitals came back`);
}

describe('Q1 — one field label, sentence case, in both portals', () => {
  it('the shared label is the admin label and carries no text-transform or tracking', () => {
    const label = cssRule(readCode(FIELD_LABEL), '.fieldLabel');
    assertLabelRecipe(label, FIELD_LABEL);
    assert.doesNotMatch(label, /text-transform|letter-spacing/);
  });

  it('every label class that can compose it does, and restates nothing it owns', () => {
    const composers: Array<[file: string, selector: string]> = [
      ['components/admin/kit/club/ClubKit.module.css', '.label'],
      ['app/[orgSlug]/coaches/coaches.module.css', '.label'],
      ['app/[orgSlug]/admin/rep-teams/rep-teams.module.css', '.label'],
      ['app/[orgSlug]/admin/house-league/house-league.module.css', '.label'],
      ['app/[orgSlug]/admin/onboarding/onboarding.module.css', '.fieldLabel'],
      ['app/[orgSlug]/admin/tournaments/branding/branding.module.css', '.label'],
      ['app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.module.css', '.teamLabel'],
      ['components/coaches/DevelopmentHandoutPreview.module.css', '.nextStep'],
      ['app/[orgSlug]/admin/public-site/public-site.module.css', '.label'],
      // Composed from the source, never through `.label`: `composes` is not transitive under Turbopack.
      ['app/[orgSlug]/coaches/coaches.module.css', '.ppFieldLabel'],
    ];
    for (const [file, selector] of composers) {
      // A module may declare the class twice (layout in one rule, the label in the other): read the one that composes.
      const rules = [...readCode(file).matchAll(new RegExp(`(?:^|\\n)[ \\t]*\\${selector}\\s*\\{([^}]*)\\}`, 'g'))].map(m => m[1]);
      const rule = rules.find(body => body.includes('composes: fieldLabel'));
      assert.ok(rule, `${file} ${selector} composes the shared label`);
      assert.match(rule, /composes: fieldLabel from '(\.\.\/)+(components\/)?shared\/FieldLabel\.module\.css';/);
      assert.doesNotMatch(rule, /text-transform|letter-spacing|font-weight|color:/, `${file} ${selector} restates nothing the shared label owns`);
    }
    // A class that composes a label class composes a SECOND hop, which Turbopack drops (components/Footer.module.css).
    for (const [file] of composers) {
      assert.doesNotMatch(readCode(file), /composes: (label|fieldLabel|ppFieldLabel|teamLabel|nextStep);/, `${file}: a label composed through a local label class`);
    }
  });

  it('a selector that cannot compose restates the label, never small capitals', () => {
    assertLabelRecipe(cssRule(coachesCss, '.lineupControlLabel > span'), 'the lineup controls');
    assertLabelRecipe(cssRule(coachesCss, '.gdMomentTag > span'), 'the game-day moment');
    assertLabelRecipe(cssRule(readCode('components/coaches/DevelopmentHandoutPreview.module.css'), '.group legend'), 'the handout legend');
    assertLabelRecipe(cssRule(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css'), '.label'), 'the coach budget label');
    const globals = readCode('app/globals.css');
    const formLabel = cssRule(globals, '[data-admin-kit] .form-label:where(:not([data-public-preview] *))');
    assertLabelRecipe(formLabel, 'the admin form-label');
    assert.match(formLabel, /text-transform: none;/, 'the admin re-skin cancels the base rule\'s capitals');
  });

  it('no label in either portal is written in Title Case', () => {
    // A proper noun or an acronym may stand capitalized after the first word; a name after "/" or "—" starts again.
    const KEEP = new Set(['URL', 'PDF', 'ID', 'FAQ', 'CSV', 'PIN', 'GST', 'HST', 'QR', 'SMS', 'I', 'CAD', 'USD', 'HQ',
      'FieldLogicHQ', 'Stripe', 'Google', 'Apple', 'Interac', 'GameChanger', 'TeamSnap', 'Excel', 'Warm', 'Dark']);
    const label = /className=\{?[`"']?[^>]*?\b(?:\w+\.(?:label|fieldLabel|ppFieldLabel)|form-label)\b[^>]*>([^<{]+)/g;
    const titleCase: string[] = [];
    for (const root of ['app/[orgSlug]/admin', 'app/[orgSlug]/coaches', 'components/admin', 'components/coaches']) {
      for (const file of filesUnder(root, '.tsx')) {
        const code = readCode(file);
        for (const m of code.matchAll(label)) {
          const text = m[1].replace(/\s+/g, ' ').trim();
          for (const part of text.split(/[/—]/)) {
            const words = part.replace(/[*?:()’',.#&;]/g, ' ').split(' ').filter(Boolean);
            if (words.slice(1).some(w => /^[A-Z][a-z]/.test(w) && !KEEP.has(w))) titleCase.push(`${file}: "${text}"`);
          }
        }
      }
    }
    assert.deepEqual(titleCase, [], 'a field label is sentence case ("First name", not "First Name") — the capitals no longer hide it');
  });
});

describe('Q3 and Q6 — the admin window: the width ladder, a tinted edge, no shadow', () => {
  it('a form is 520 by default, 640 for `medium`, 800 for `wide`; a question stays 26rem', () => {
    assert.match(cssRule(kitDialogCss, '.form'), /max-width: 32\.5rem;/);
    assert.match(cssRule(kitDialogCss, '.form.medium'), /max-width: 40rem;/);
    assert.match(cssRule(kitDialogCss, '.form.wide'), /max-width: 50rem;/);
    assert.match(cssRule(kitDialogCss, '.question'), /max-width: 26rem;/);
    assert.match(readCode('components/admin/kit/club/KitDialog.tsx'), /size\?: 'medium' \| 'wide';/, 'one size prop, never two booleans');
  });

  it('the panel and the preview card beside it have the tinted edge and no shadow', () => {
    const panel = cssRule(kitDialogCss, '.panel');
    assert.doesNotMatch(panel, /box-shadow/, 'Q6: the dimmed page separates the card');
    assert.match(panel, /border: 1px solid rgba\(var\(--blueprint-blue-rgb\), 0\.3\);/);
    // The aside is drawn only at 1280 and wider: read THAT rule (the first `.aside` is its `display: none`).
    const wideOnly = kitDialogCss.slice(kitDialogCss.indexOf('@media (min-width: 1280px)'));
    const aside = cssRule(wideOnly, '.aside');
    assert.doesNotMatch(aside, /box-shadow/);
    assert.match(aside, /border: 1px solid rgba\(var\(--blueprint-blue-rgb\), 0\.3\);/);
    assert.match(aside, /padding: 1rem var\(--kit-dialog-side\) 1\.25rem;/);
    assert.match(cssRule(wideOnly, '.form.withAside'), /margin-right: calc\(300px \+ 4\.5rem \+ 2px\);/, 'the reserve is the gap + the part + the padding + the border');
  });

  it('24px inside on a computer, the 20px it had on a phone, through one variable', () => {
    assert.match(cssRule(kitDialogCss, '.overlay'), /--kit-dialog-side: 1\.5rem;/);
    assert.match(cssRule(splitPhoneCss(kitDialogCss).phone, '.overlay'), /--kit-dialog-side: 1\.25rem;/);
    for (const part of ['.head', '.body', '.foot', '.progress']) {
      assert.match(cssRule(kitDialogCss, part), /var\(--kit-dialog-side\)/, `${part} takes the window's side padding`);
    }
  });
});

describe('Q2 and S1 — the club kit field', () => {
  it('is the paper tone, 36px, 6px corners', () => {
    const field = cssRule(clubKitCss, '.input,\n.select,\n.textarea');
    assert.match(field, /background: var\(--white-05\);/);
    assert.match(field, /min-height: 36px;/);
    assert.match(field, /border-radius: 6px;/);
  });

  it('a one-line field is 36px exactly, so a date, a dropdown and a text box sit level in one row', () => {
    // A floor alone let each control size to its own insides: 39 for a dropdown, 40 for a text box, 42 for a date.
    assert.match(cssRule(clubKitCss, '.input,\n.select'), /height: 36px;/);
  });

  it('amended for the form table\'s raised grounds: a box on one is white, in Warm only (owner A2, 2026-10-18)', () => {
    // The paper-tone field on a paper row showed only as its outline. Dark keeps its wash, which already stands off.
    const formTableCss = readCode('components/shared/FormTable.module.css');
    for (const ground of ['groupRow', 'rowOpen', 'recordOpen', 'groupBand', 'boxGroup']) {
      assert.ok(formTableCss.includes(`:global(html[data-user-theme="warm"]) .${ground} :is(input:not([type="checkbox"]):not([type="radio"]), select, textarea)`),
        `a box on the .${ground} ground takes the card fill`);
    }
    assert.match(formTableCss, /textarea\) \{\s*background: var\(--home-card\);\s*\}/);
  });

  it('its required star sets no colour of its own: it is the label\'s ink, never the live red', () => {
    assert.doesNotMatch(cssRule(clubKitCss, '.required'), /color:/, 'red means something went wrong; a field is not wrong for being required (2026-08-25)');
  });
});

describe('Q5 — a coach window dims the page in the theme\'s own tone', () => {
  it('`.modalOverlay` reads the themed scrim, black only as the fallback for a missing theme', () => {
    assert.match(cssRule(coachesCss, '.modalOverlay'), /background: var\(--home-scrim, rgba\(0,0,0,0\.6\)\);/);
  });
});

/** The keys a `{...name}` can spread into a tag: its declared object type (`let foot: { footer?: ReactNode } = {}`)
 *  or, without one, the top-level keys of `const name = { … }`. Null if neither is in the file — then the guard cannot
 *  read the props, and says so. */
function spreadKeys(code: string, name: string): Set<string> | null {
  const typed = new RegExp(`(?:const|let)\\s+${name}\\s*:\\s*\\{([^}]*)\\}\\s*=`).exec(code);
  if (typed) return new Set([...typed[1].matchAll(/([A-Za-z_$][\w$]*)\??\s*:/g)].map(k => k[1]));
  const m = new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*\\{`).exec(code);
  if (!m) return null;
  const entries: string[] = [];
  let depth = 0;
  let from = m.index + m[0].length;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c) && depth > 0) depth--;
    else if ((c === ',' || c === '}') && depth === 0) {
      entries.push(code.slice(from, i));
      from = i + 1;
      if (c === '}') return new Set(entries.map(e => /^\s*([A-Za-z_$][\w$]*)/.exec(e)?.[1]).filter((k): k is string => !!k));
    }
  }
  return null;
}

describe('S4 — a record window keeps today\'s width on every path', () => {
  it('every KitDialog with `steps`, `record` or the read-first pencil (`edit`) passes a `size` — spread props included', () => {
    const offenders: string[] = [];
    let records = 0;
    for (const file of [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]) {
      const raw = readSource(file);
      if (!raw.includes('<KitDialog')) continue;
      const code = stripComments(raw);
      for (const tag of openingTags(code, 'KitDialog', file)) {
        const props = new Set(parseProps(tag).keys());
        // `{...shell}`: read the keys of the object it spreads (the Families record passes its shell this way).
        for (const spread of tag.matchAll(/\{\s*\.\.\.([A-Za-z_$][\w$]*)\s*\}/g)) {
          props.delete(spread[1]);
          const keys = spreadKeys(code, spread[1]);
          if (!keys) { offenders.push(`${file}: {...${spread[1]}} is not an object literal the guard can read`); continue; }
          keys.forEach(k => props.add(k));
        }
        if (!props.has('steps') && !props.has('record') && !props.has('edit')) continue;
        records++;
        if (!props.has('size')) offenders.push(file);
      }
    }
    assert.ok(records >= 15, `found only ${records} record windows — the scan has stopped seeing them`);
    assert.deepEqual(offenders, [], 'a record window with no size drops to the new 520 (call S4: one width, today\'s)');
  });
});
