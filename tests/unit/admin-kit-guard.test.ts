import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ADMIN KIT'S PALETTE RULES (Admin Design Continuity, Phase 1 — slice 1, 2026-09-25)
 *
 *   1. R2 — A PUBLIC PREVIEW INSIDE THE ADMIN IS THE PUBLIC PAGE. The `[data-public-preview]` island
 *      in `app/globals.css` puts back every token the warm block and R1 change, by reference to a
 *      `:root` snapshot. A token remapped there and not restored here would leak the account theme
 *      (or the platform colours) into a picture of a public page — silently, on one preview, the
 *      day someone adds a remap. So the three lists are read from the stylesheet and compared.
 *   2. TOKENS ONLY IN THE KIT — enforced by `scripts/check-public-tokens.mjs` (`checkAdminKit`), not here.
 *   3. F1 — the org's public card style stops at the admin shell, at zero added specificity.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const css = readSource('app/globals.css');

/** The declaration body of the FIRST top-level rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|\\n)${esc}\\s*\\{`).exec(css);
  assert.ok(m, `globals.css has no \`${selector} {\` block — the guard reads it`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  for (; i < css.length && depth > 0; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
  return css.slice(start, i - 1);
}
const declared = (body: string): string[] =>
  [...body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]);

/** Every `:root {}` block's declarations, joined — the snapshots live in one of them. */
const rootDecls = (() => {
  const out: string[] = [];
  const re = /(^|\n):root\s*\{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    for (; i < css.length && depth > 0; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
    out.push(css.slice(from, i - 1));
  }
  return out.join('\n');
})();

describe('R2 — the public-preview island restores what the kit changes', () => {
  const warm = declared(block('html[data-user-theme="warm"] [data-coach-warm-enabled]')).filter(t => !t.startsWith('--home-'));
  const r1 = declared(block('[data-admin-kit]'));
  const island = block('[data-admin-kit] [data-public-preview]');

  it('the blocks it compares exist and are not empty', () => {
    assert.ok(warm.length > 80, `the warm block yielded ${warm.length} tokens — the parser is reading the wrong block`);
    assert.ok(r1.includes('--primary') && r1.includes('--border'), 'R1 must put back the org-colour tokens');
  });

  it('every token the warm block or R1 changes is restored in the island, from its :root snapshot', () => {
    const missing: string[] = [];
    for (const token of new Set([...warm, ...r1])) {
      const name = token.slice(2);
      if (!new RegExp(`${token}\\s*:\\s*var\\(--pv-${name}\\)`).test(island)) missing.push(`${token} is not restored in the island`);
      if (!new RegExp(`--pv-${name}\\s*:\\s*var\\(${token}\\)`).test(rootDecls)) missing.push(`--pv-${name} has no :root snapshot`);
    }
    assert.deepEqual(missing, [], 'a remap with no restore leaks the account theme into a preview of a public page');
  });

  it('the island is keyed under the admin kit, so it is inert with the switch off', () => {
    assert.match(css, /\n\[data-admin-kit\] \[data-public-preview\]\s*\{/);
    assert.doesNotMatch(css, /\n\[data-public-preview\]\s*\{/, 'an unscoped island would change previews with the switch off');
  });

  it('every warm CLASS rule in globals.css stops at the island (tokens are not the whole skin)', () => {
    // The navy "Register" in the tournament preview turned lime under the switch until this held.
    const selectors = [...css.matchAll(/\nhtml\[data-user-theme="warm"\] \[data-coach-warm-enabled\] ([^{\n]+?)\s*[{,]/g)].map(m => m[1]);
    assert.ok(selectors.length >= 10, `found ${selectors.length} warm class rules`);
    const open = selectors.filter(sel => !sel.includes(':where(:not([data-public-preview] *))'));
    assert.deepEqual(open, [], 'a warm class rule without the exclusion restyles a preview of a public page');
  });

  it('the three previews wear the island', () => {
    assert.match(readSource('app/[orgSlug]/admin/AdminChrome.tsx'), /data-public-preview/, 'the tournament preview shell');
    assert.match(readSource('app/[orgSlug]/admin/tournaments/branding/page.tsx'), /data-public-preview/, 'the Public Site theme preview');
    assert.match(readSource('components/admin/TournamentCreationPreview.tsx'), /data-public-preview/, 'the new-tournament live preview');
  });
});

describe('F1 — the org card style stops at the admin shell', () => {
  it('every card-style variant excludes admin cards at zero specificity (and keeps public previews)', () => {
    const variants = [...css.matchAll(/\n\[data-card-style="(glass|outlined|flat)"\] \.card[^{]*\{/g)].map(m => m[0]);
    assert.ok(variants.length >= 5, `found ${variants.length} card-style variant rules`);
    for (const v of variants) {
      assert.match(v, /\.card:where\(:not\(\[data-admin-kit\] \.card\), \[data-public-preview\] \.card\)/, `${v.trim()} reaches admin cards`);
    }
  });
});

// ⚠ "TOKENS ONLY IN THE KIT" (rule 2 in the header) lives in ONE place: `scripts/check-public-tokens.mjs`
// (`checkAdminKit`, strict, run by verify:changed with every other colour rule). A second copy here
// would be two homes for one rule — the drift this repo keeps paying for.
