/**
 * THE PUBLIC SECURITY PAGE (Board Ready §0c, S3; drawn and ruled 2026-11-21, S2 rulings 1–11). What this holds:
 *   · the diagram says exactly the checked labels (review rows 1–10) and the accessible description, in BOTH forms — only line
 *     breaks may differ between the forms and the record;
 *   · the page is "not found" while the legal pages are off, and has no "off" version;
 *   · version B's four held lines and four "Read more" links appear only once the Data Terms AND the list are both published;
 *   · the full-copy line and "Questions a board asks" answer 4 ask ONE predicate;
 *   · answer 3 says "date of birth" and links the page; the footer links it only while the legal pages are on (the
 *     legal-links surfaces guard holds the footer's order);
 *   · print stays scoped to this page.
 * The page code is the shipped TSX rendered by React (`_billing-test-loader.ts`); only the legal links are mocked.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import {
  SECURITY_BREACH, SECURITY_BREACH_HELD, SECURITY_DIAGRAM_ALT, SECURITY_DIAGRAM_CAPTION, SECURITY_DIAGRAM_LABELS,
  SECURITY_HELD_W2, SECURITY_HELD_W9, SECURITY_SECTIONS, SECURITY_YOURS_FULL_COPY, SECURITY_YOURS_FULL_COPY_HELD,
} from '../../lib/security-page-words.ts';
import { FULL_COPY_BY_HAND_CONFIRMED, fullCopyOffered } from '../../lib/full-copy-promise.ts';

const ORIGIN = 'https://www.fieldlogichq.ca';
const A = {
  termsHref: `${ORIGIN}/legal/terms`, privacyHref: `${ORIGIN}/legal/privacy`, termsVersion: '2026-11-17',
  dataTermsHref: null as string | null, subprocessorsHref: null as string | null, securityHref: `${ORIGIN}/security`,
};
const B = { ...A, dataTermsHref: `${ORIGIN}/legal/data-terms`, subprocessorsHref: `${ORIGIN}/legal/subprocessors` };

/** The checked labels, as review rows 1–10 of MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md state them (" · " between groups). */
const CHECKED: Record<keyof typeof SECURITY_DIAGRAM_LABELS, string> = {
  people: 'Board, coaches, families · a phone or a computer · two-step sign-in for every account',
  app: 'FieldLogicHQ app · Amazon Web Services · Ohio, United States',
  database: 'Database, sign-in, files · Supabase on AWS · Ohio, United States',
  encrypted: 'encrypted',
  checked: 'checked',
  direct: 'sign-in and live score updates',
  underApp: 'Every request: signed in, second step where on, belongs to this club, allowed for this role',
  underDatabase: 'Encrypted at rest by the host · Database backed up daily, kept 7 days · Player documents open by 1-hour links',
  emailArrow: 'sends email',
  email: 'Email delivery · Resend, United States · Receives: names, addresses, the message itself',
  paymentsArrow: 'hands off checkout',
  payments: "Payments · Stripe · Card numbers are typed on Stripe's own page and never reach us",
  alertsArrow: 'sends an alert',
  alerts: "Phone alerts · the browser's own push service · Receives: a device address, and the alert, sealed for that device",
};

const unescape = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** Visible text of rendered markup: tags dropped, entities read, whitespace folded. */
const textOf = (html: string) => unescape(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function loaderWith(links: typeof A | null) {
  return billingTestLoader({
    '@/lib/legal-links': { resolveLegalLinks: () => links },
    '@/lib/app-origin': { canonicalAppOrigin: () => ORIGIN },
  });
}

function renderPage(links: typeof A): string {
  const mod = loaderWith(links)('app/security/page.tsx') as { default: () => ReactElement };
  return renderToStaticMarkup(mod.default());
}

describe('the diagram says the checked labels, word for word, in both forms', () => {
  const mod = billingTestLoader()('components/legal/SecurityDiagram.tsx') as { default: () => ReactElement };
  const html = renderToStaticMarkup(createElement(mod.default));
  const forms = Object.fromEntries(['desktop', 'phone'].map(f => {
    const at = html.lastIndexOf('<svg', html.indexOf(`data-form="${f}"`));
    return [f, html.slice(at, html.indexOf('</svg>', at))];
  }));

  it('the words file holds the checked labels (a group per " · ")', () => {
    for (const [k, groups] of Object.entries(SECURITY_DIAGRAM_LABELS)) {
      assert.equal(groups.join(' · '), CHECKED[k as keyof typeof CHECKED], k);
    }
  });

  for (const form of ['desktop', 'phone'] as const) {
    it(`${form}: every group joins back up to its label, and nothing else is written on it`, () => {
      const svg = forms[form];
      assert.ok(svg.length > 0, `${form} form rendered`);
      const groups = [...svg.matchAll(/<g data-k="([^"]+)">([\s\S]*?)<\/g>/g)];
      assert.deepEqual(groups.map(g => g[1]).sort(), Object.keys(CHECKED).sort(), 'one group per label, every label once');
      for (const [, k, inner] of groups) {
        const lines = [...inner.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => unescape(m[1]));
        assert.equal(lines.join(' '), SECURITY_DIAGRAM_LABELS[k as keyof typeof SECURITY_DIAGRAM_LABELS].join(' '), `${form} · ${k}`);
      }
      assert.equal((svg.match(/<text/g) ?? []).length, groups.reduce((n, g) => n + (g[2].match(/<text/g) ?? []).length, 0),
        'no text outside a checked group');
    });

    it(`${form}: an image with the brief's accessible description`, () => {
      const open = forms[form].slice(0, forms[form].indexOf('>'));
      assert.match(open, /role="img"/);
      assert.equal(unescape(open.match(/aria-label="([^"]+)"/)![1]), SECURITY_DIAGRAM_ALT);
    });
  }

  it('the caption is visible text under the panel', () => {
    assert.ok(textOf(html.slice(html.indexOf('<figcaption'))).startsWith(SECURITY_DIAGRAM_CAPTION));
  });

  it('only one form is ever in the accessibility tree: the other is display:none, switched at 768px, desktop in print', () => {
    const css = readCode('components/legal/SecurityPage.module.css');
    assert.match(css, /\.dgPhone \{ display: none;/);
    assert.match(css, /@media \(max-width: 767px\) \{\s*\.dgDesktop \{ display: none; \}\s*\.dgPhone \{ display: block; \}/);
    assert.match(css, /@media print \{[\s\S]*\.root \.dgDesktop \{ display: block; \}\s*\.root \.dgPhone \{ display: none; \}/);
    // Inks are tokens, arrowheads included (check:tokens holds the rest of the file).
    assert.match(css, /\.dgHead \{ fill: var\(--home-dim\); \}/);
    assert.doesNotMatch(readCode('components/legal/SecurityDiagram.tsx'), /#[0-9a-f]{3,6}\b|fill="/i);
  });
});

describe('the page is live only with the legal pages', () => {
  it('"not found" while the legal pages are off, with no share card', () => {
    const mod = loaderWith(null)('app/security/page.tsx') as { default: () => ReactElement; generateMetadata: () => object };
    assert.throws(() => mod.default(), (e: { digest?: string }) => /NEXT_HTTP_ERROR_FALLBACK;404/.test(String(e.digest)));
    assert.deepEqual(mod.generateMetadata(), {});
  });

  it('on, it renders the head, the eleven sections and the contents list (unnumbered, verbatim)', () => {
    const html = renderPage(A);
    const text = textOf(html);
    assert.ok(text.includes("Security How FieldLogicHQ protects your club's information Two questions come first"));
    assert.ok(text.includes('This page describes how FieldLogicHQ works as of November 21, 2026.'));
    assert.equal((text.match(/as of November/g) ?? []).length, 1, 'the "as of" line sits once');
    const nav = html.slice(html.indexOf('<nav'));
    const rail = [...nav.matchAll(/<a [^>]*href="#([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert.deepEqual(rail.map(m => unescape(m[2])), SECURITY_SECTIONS.map(s => s[1]));
    for (const [, id] of rail) assert.match(html, new RegExp(`<h2 id="${id}">`), `the contents link #${id} has a heading`);
    assert.doesNotMatch(nav, /railNum/, 'unnumbered');
  });
});

describe('version A and version B', () => {
  const heldLines = [SECURITY_HELD_W2.link, SECURITY_HELD_W9.link, 'within 72 hours', 'within 30 days', 'Six companies'];

  it('A (Terms and Privacy only): no held line, today\'s breach line, the plain full-copy line only by the owner\'s confirmation, two links to read', () => {
    const text = textOf(renderPage(A));
    for (const s of heldLines) assert.ok(!text.includes(s), s);
    assert.ok(text.includes(textOf(SECURITY_BREACH.replace(/\*\*/g, ''))));
    assert.equal(text.includes(SECURITY_YOURS_FULL_COPY), FULL_COPY_BY_HAND_CONFIRMED, 'the plain line follows Ask 29');
    assert.equal(text.includes('full copy'), FULL_COPY_BY_HAND_CONFIRMED, 'and nothing else says "full copy"');
    assert.ok(text.includes('Read more Terms of Service (www.fieldlogichq.ca/legal/terms) Privacy Policy (www.fieldlogichq.ca/legal/privacy) Contents'));
  });

  it('the Data Terms alone: the plain full-copy line joins (the page condition), nothing held yet', () => {
    const text = textOf(renderPage({ ...A, dataTermsHref: B.dataTermsHref }));
    assert.ok(text.includes(SECURITY_YOURS_FULL_COPY));
    for (const s of heldLines) assert.ok(!text.includes(s), s);
    assert.ok(!text.includes('Data Terms ('), '"Read more" waits for both');
  });

  it('B (both published): the four held lines on together, four links, and W2/W9 link the two pages', () => {
    const html = renderPage(B);
    const text = textOf(html);
    assert.ok(text.includes(`${SECURITY_HELD_W2.before}${SECURITY_HELD_W2.link}${SECURITY_HELD_W2.after}`.replace(/\s+/g, ' ')));
    assert.ok(text.includes(textOf(SECURITY_BREACH_HELD.replace(/\*\*/g, ''))) && !text.includes('straight away with what we know'));
    assert.ok(text.includes(SECURITY_YOURS_FULL_COPY_HELD) && !text.includes(SECURITY_YOURS_FULL_COPY));
    assert.match(html, new RegExp(`<a href="${B.subprocessorsHref}">${SECURITY_HELD_W2.link}</a>`));
    assert.match(html, new RegExp(`<a href="${B.dataTermsHref}">${SECURITY_HELD_W9.link}</a>`));
    // W2 and W9 sit under the "not ours" sentence, before the cross-border paragraph.
    const at = (s: string) => text.indexOf(s);
    assert.ok(at('no certification or independent audit') < at('Six companies') && at('replaced urgently') < at('Canadian privacy law'));
    assert.ok(text.includes('Data Terms (www.fieldlogichq.ca/legal/data-terms) Companies that handle your information (www.fieldlogichq.ca/legal/subprocessors) Contents'));
  });

  it('every href on the page comes from the links it was handed (or the privacy contact, or a section)', () => {
    const hrefs = [...renderPage(B).matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const allowed = new Set([...Object.values(B), 'mailto:privacy@fieldlogichq.ca']);
    assert.deepEqual(hrefs.filter(h => !allowed.has(h) && !h.startsWith('#')), []);
    assert.doesNotMatch(readCode('components/legal/SecurityPage.tsx'), /['"`]\/legal\//, 'never a typed path');
  });
});

describe('one full-copy rule for the Security page and answer 4', () => {
  it('both ask fullCopyOffered(), and neither decides it by itself', () => {
    assert.match(readCode('components/legal/SecurityPage.tsx'), /fullCopyOffered\(links\)/);
    assert.match(readCode('components/marketing/BoardQuestions.tsx'), /\$\{fullCopyOffered\(legal\) \? ', or ask us for a full copy' : ''\}/);
    assert.doesNotMatch(readCode('components/marketing/BoardQuestions.tsx'), /legal\.dataTermsHref \?/);
  });

  it('answer 4 renders the clause exactly when the Security page renders its full-copy line', () => {
    for (const [links, offered] of [[A, FULL_COPY_BY_HAND_CONFIRMED], [{ ...A, dataTermsHref: B.dataTermsHref }, true], [B, true]] as const) {
      const mod = loaderWith(links)('components/marketing/BoardQuestions.tsx') as {
        boardQuestions: (o: { club: boolean }) => Array<{ q: string; a: unknown }> | null;
      };
      const answer4 = String(mod.boardQuestions({ club: true })!.find(q => q.q === 'What if we decide to stop?')!.a);
      assert.equal(answer4.endsWith('Excel, CSV or PDF, or ask us for a full copy.'), offered, JSON.stringify(links.dataTermsHref));
      assert.equal(/full copy/.test(textOf(renderPage(links))), offered);
    }
  });

  it('the owner\'s Ask 29 confirmation (2026-11-22) is one constant, and it offers the copy before the Data Terms publish', () => {
    assert.equal(FULL_COPY_BY_HAND_CONFIRMED, true);
    assert.equal(fullCopyOffered({ dataTermsHref: null }), true);
    assert.equal(fullCopyOffered({ dataTermsHref: B.dataTermsHref }), true);
  });
});

describe('"Questions a board asks" answer 3', () => {
  it('says "date of birth" and links the Privacy Policy, then the Security page, each on its own line', () => {
    const mod = loaderWith(A)('components/marketing/BoardQuestions.tsx') as {
      boardQuestions: (o: { club: boolean }) => Array<{ q: string; a: ReactElement | string }> | null;
    };
    const answer = mod.boardQuestions({ club: true })!.find(q => q.q === "What do you do with our families' information?")!;
    const html = renderToStaticMarkup(createElement('p', null, answer.a));
    assert.ok(textOf(html).includes("FieldLogicHQ never shows a player's name, date of birth or roster on a public page."));
    assert.ok(!/birth date/.test(textOf(html)));
    const links = [...html.matchAll(/<a href="([^"]+)" class="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[3], m[2]]);
    assert.deepEqual(links.map(l => [l[0], l[1]]), [[A.privacyHref, 'Read the Privacy Policy'], [A.securityHref, 'See how we protect it']]);
    for (const l of links) assert.match(l[2], /answerLink/, 'the same 44px line');
  });

  it('nothing renders while the legal pages are off', () => {
    const mod = loaderWith(null)('components/marketing/BoardQuestions.tsx') as { boardQuestions: (o: { club: boolean }) => unknown };
    assert.equal(mod.boardQuestions({ club: true }), null);
  });
});

describe('print is scoped to this page, and the page adds no button', () => {
  it('the rule that drops the bar and footer reaches only a document holding this page', () => {
    const css = readCode('components/legal/SecurityPage.module.css');
    assert.match(css, /@media print \{\s*:global\(body\):has\(\.root\) :global\(\*\):not\(:has\(\.root\)\):not\(\.root\):not\(\.root \*\)/);
    assert.equal((css.match(/@media print/g) ?? []).length, 1);
    assert.doesNotMatch(readCode('app/globals.css'), /security/i);
  });

  it('no button, no print control, no copy control', () => {
    const page = readCode('components/legal/SecurityPage.tsx') + readCode('components/legal/SecurityDiagram.tsx');
    assert.doesNotMatch(page, /<button|window\.print|clipboard/);
  });
});

describe('the "Never add" list stays off the page', () => {
  it('none of the ruled-out claims is in the words', () => {
    const text = textOf(renderPage(B)).toLowerCase();
    for (const s of ['canadian hosting', 'hosted in canada', 'built to last', 'every finding fixed', 'full restore',
      'your files are backed up', 'export everything', 'end-to-end', 'cannot be edited', 'penetration test of our own', '$']) {
      assert.ok(!text.includes(s), s);
    }
  });
});
