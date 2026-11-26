/**
 * SIGN OUT IS NEVER RED (owner 2026-11-26: "make it black everywhere") — the nav standard's N4.
 *
 * It reads as the rows around it, in every skin: signing out destroys nothing, and its place (last, under a separator)
 * already sets it apart. It had drifted both ways at once — red in a public menu and a phone sheet, ink in a warm
 * header menu where a generic row rule outranked the red — so this pins the source, not one screen.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource } from './_source-code.ts';

/** A selector that names a sign-out control: `.signOut`, `.inlineSignOut`, `.dropLogout`, `#x-logout`. */
const SIGN_OUT_SELECTOR = /sign-?out|log-?out/i;
/** The product's reds: the danger and live tokens, and the keyword. */
const RED = /--danger|--home-live|\bred\b/i;

/** Every `selector { body }` pair of a stylesheet, comments gone; an `@media` wrapper is skipped, its rules are not. */
function cssRules(css: string): { selector: string; body: string }[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }));
}

describe('N4 · Sign out is never red', () => {
  it('no stylesheet gives a sign-out control a red', () => {
    const sheets = [...filesUnder('app', '.css'), ...filesUnder('components', '.css')];
    const rules = sheets.flatMap(file => cssRules(readSource(file)).map(rule => ({ file, ...rule })));
    const signOut = rules.filter(rule => SIGN_OUT_SELECTOR.test(rule.selector));
    assert.ok(signOut.length > 0, 'the guard found no sign-out rules at all — it has lost its place');
    assert.deepEqual(signOut.filter(rule => RED.test(rule.body)).map(rule => `${rule.file}: ${rule.selector}`), []);
  });

  it('the account menu gives its Sign out row no colour, so it cannot differ from its neighbours', () => {
    const own = cssRules(readSource('components/shared/AccountMenu.module.css'))
      .filter(rule => /\.signOut\b/.test(rule.selector));
    assert.deepEqual(own.filter(rule => /(^|[;\s])color\s*:/.test(rule.body)).map(rule => rule.selector), []);
  });

  it('the More sheet’s Sign out wears the plain row class and nothing else', () => {
    assert.match(
      readCode('components/coaches/MoreSheetFoot.tsx'),
      /<button type="button" className=\{styles\.dropItem\} role="menuitem" id=\{`\$\{idPrefix\}-logout`\}/,
    );
  });
});
