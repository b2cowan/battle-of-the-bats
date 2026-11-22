import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  DATA_TERMS_VERSIONS, LEGAL_DOCUMENTS, LEGAL_DOC_KEYS, SUBPROCESSOR_LIST_VERSIONS, isPublishedVersion, isVersionDate,
  legalPageLive, pageVersionInForce, publishedFilePath, type PublishedVersion,
} from '../../lib/legal-documents.ts';
import { LEGAL_OTHER_TITLES, legalSections, linkSectionReferences } from '../../lib/legal-sections.ts';
import { LEGAL_TITLES } from '../../lib/legal-words.ts';
import { filterMarkers } from './_legal-markers.ts';
import { filesUnder, readCode, readSource, sourceExists } from './_source-code.ts';

/**
 * THE DATA TERMS AND THE LIST OF COMPANIES (Board Ready 0a-5, built 2026-11-19; plan
 * `docs/projects/active/BOARD_READY_PLAN.md` §0a-5, brief `docs/agents/legal/DATA_TERMS_ACCEPTANCE_NOTE.md`).
 *
 * Two pages a person reads and never accepts. Both registries are empty until the Payments Terms day, so the checks against the
 * real files hold vacuously today; the fixture tests below prove each one fires. What the build guarantees:
 *   · a Data Terms version exists only at a Terms version date, and that Terms text names and links the Data Terms (T1) — so
 *     the Data Terms can never change without a Terms version;
 *   · the list cannot change without a new dated copy that adds exactly one dated row to "Changes to this list", leaving every
 *     earlier row as it was;
 *   · every company on the list in force is named in the Privacy Policy in force (what keeps the list from going live before the
 *     privacy version that names ImprovMX);
 *   · the acceptance record, and the doors, still know only the Terms and the Privacy Policy.
 */
const REPO = path.join(import.meta.dirname, '..', '..');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

// ── Pure readers of the texts (exported only to this file's fixtures) ─────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "November 19, 2026" → "2026-11-19" (the legal pages write the full month, no leading zero); anything else → null. */
function parseLongDate(text: string): string | null {
  const m = /^([A-Z][a-z]+) ([1-9]\d?), (\d{4})$/.exec(text.trim());
  const month = m ? MONTHS.indexOf(m[1]) + 1 : 0;
  if (!m || month === 0) return null;
  const ymd = `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return new Date(`${ymd}T00:00:00Z`).toISOString().slice(0, 10) === ymd ? ymd : null; // no "February 31"
}

/** A markdown link to each read-only page, by either address (the texts use the short form and the full one). */
const LINKS_TO = {
  'data-terms': /\]\((?:\/legal)?\/data-terms(?:\/\d{4}-\d{2}-\d{2})?\)/,
  subprocessors: /\]\((?:\/legal)?\/subprocessors\)/,
} as const;
/** T1: the Terms name the Data Terms IN the link's words ("Our [Data Terms for organizations](/data-terms) are part of …"). */
const NAMES_DATA_TERMS = /\[[^\]\n]*Data Terms[^\]\n]*\]\((?:\/legal)?\/data-terms\)/;

const cells = (row: string): string[] => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const tableRows = (block: string): string[] => block.split('\n').filter(l => l.trim().startsWith('|')).slice(2); // past header + rule

/** The body rows of the "Changes to this list" table, as written. */
function changeRows(markdown: string): string[] {
  const at = markdown.search(/^## Changes to this list\s*$/m);
  if (at < 0) return [];
  const rest = markdown.slice(at).split('\n').slice(1).join('\n');
  const end = rest.search(/^## /m);
  return tableRows(end < 0 ? rest : rest.slice(0, end)).map(r => r.trim());
}

/**
 * The bold names in the first column of the first table headed "Company" (the list's table and the Privacy Policy §6 table). A row
 * whose name is not bold comes back as `null`, so a check can refuse it rather than skip it.
 */
function companyCells(markdown: string): Array<string | null> {
  const lines = markdown.split('\n');
  const head = lines.findIndex(l => /^\|\s*Company\s*\|/.test(l));
  if (head < 0) return [];
  const out: Array<string | null> = [];
  for (const line of lines.slice(head + 2)) {
    if (!line.trim().startsWith('|')) break;
    out.push(/^\*\*(.+?)\*\*/.exec(cells(line)[0] ?? '')?.[1] ?? null);
  }
  return out;
}
const companyNames = (markdown: string): string[] => companyCells(markdown).filter((n): n is string => n !== null);

// ── The checks, over any set of texts ─────────────────────────────────────────────────────────────────────────────────────────

/** Each Data Terms version: a Terms version date whose text names the Data Terms and links them by the short address. */
function dataTermsProblems(versions: string[], termsVersions: string[], termsText: (v: string) => string): string[] {
  const out: string[] = [];
  for (const v of versions) {
    if (!termsVersions.includes(v)) { out.push(`Data Terms ${v} is not a Terms version date — the Data Terms change only with a new Terms version`); continue; }
    if (!NAMES_DATA_TERMS.test(termsText(v))) {
      out.push(`Terms ${v} does not name and link the Data Terms (T1: "Our [Data Terms for organizations](/data-terms) are part of these Terms")`);
    }
  }
  return out;
}

/**
 * The texts in force never link a page that is not live, and the Data Terms in force are named by the Terms in force — so the Terms
 * cannot publish T1–T4 ahead of the pages (the plan's same-day fallback is to publish WITHOUT them), and a later Terms version cannot
 * drop the Data Terms while their page stays up.
 */
function inForceProblems(
  texts: Array<{ name: string; text: string }>, live: Record<keyof typeof LINKS_TO, boolean>, termsText: string | null,
): string[] {
  const out: string[] = [];
  for (const { name, text } of texts) {
    for (const page of Object.keys(LINKS_TO) as Array<keyof typeof LINKS_TO>) {
      if (LINKS_TO[page].test(text) && !live[page]) out.push(`${name} links /${page}, which has no published text — publish its file the same day, or publish without the link`);
    }
  }
  if (live['data-terms'] && (termsText === null || !NAMES_DATA_TERMS.test(termsText))) {
    out.push('the Data Terms are in force but the Terms in force do not name and link them (T1) — the Data Terms are part of the Terms');
  }
  return out;
}

/** The list's company table: present, and every row's name in bold (a row the reader cannot name is a row no check can see). */
function companyTableProblems(name: string, text: string): string[] {
  const rows = companyCells(text);
  if (rows.length === 0) return [`${name} has no company table (a first column headed "Company", names in bold)`];
  return rows.some(n => n === null) ? [`${name} has a company row whose name is not in bold`] : [];
}

/** The list's copies, oldest first: each adds exactly one row, dated its own date, and changes no earlier row. */
function listProblems(copies: Array<{ version: string; text: string }>): string[] {
  const out: string[] = [];
  let before: string[] = [];
  for (const { version, text } of [...copies].sort((a, b) => a.version.localeCompare(b.version))) {
    const rows = changeRows(text);
    const added = rows.slice(before.length);
    if (rows.length !== before.length + 1 || before.some((r, i) => rows[i] !== r)) {
      out.push(`list ${version}: a change adds exactly one row to "Changes to this list" and leaves every earlier row as it was`);
    } else if (parseLongDate(cells(added[0])[0] ?? '') !== version) {
      out.push(`list ${version}: the new row's date must be this copy's date, written "${MONTHS[Number(version.slice(5, 7)) - 1]} ${Number(version.slice(8))}, ${version.slice(0, 4)}"`);
    } else if (!(cells(added[0])[1] ?? '').trim()) {
      out.push(`list ${version}: the new row must say what changed`);
    }
    before = rows;
  }
  return out;
}

/** Every company on the list is named in the Privacy Policy's own table. */
function companiesMissingFromPrivacy(listText: string, privacyText: string): string[] {
  const named = new Set(companyNames(privacyText));
  return companyNames(listText).filter(c => !named.has(c));
}

// ── The real registry ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const frozenChecks = (page: 'data-terms' | 'subprocessors', versions: PublishedVersion[]) => {
  it(`${page}: every version is a dated, frozen file with no owner note and no unfilled [bracket] fact`, () => {
    for (const p of versions) {
      assert.ok(isVersionDate(p.version), `${p.version} is not YYYY-MM-DD`);
      const file = publishedFilePath(page, p.version);
      assert.ok(sourceExists(file), `${file} is missing`);
      const text = readSource(file);
      assert.equal(sha(text), p.sha256, `${file} was edited — a published version is frozen; publish a new dated version instead`);
      assert.deepEqual(filterMarkers(text), [], `${file} carries an owner note`);
      assert.equal(/\[[^\]\n]+\](?!\()/.test(text), false, `${file} has a still-blank [bracket] fact`);
      assert.equal(/^# /m.test(text), false, `${file} carries its own title heading — the page draws the title`);
      const title = LEGAL_TITLES[page].toLowerCase();
      assert.equal(text.split('\n').some(l => /^#{2,3} /.test(l) && l.replace(/^#+\s*/, '').trim().toLowerCase() === title), false,
        `${file} repeats the page title as a heading — the frozen text starts after it (the draft's "## ${LEGAL_TITLES[page]}" is not copied)`);
    }
  });

  it(`${page}: every file in the versions folder is listed`, () => {
    const dir = path.join(REPO, 'lib', 'legal-documents', page);
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter(n => n.endsWith('.md'))) {
      assert.ok(isPublishedVersion(page, f.replace(/\.md$/, '')), `${page}/${f} is on disk but not listed in the registry`);
    }
  });
};

describe('the Data Terms: part of the Terms', () => {
  frozenChecks('data-terms', DATA_TERMS_VERSIONS);

  it('every version is a Terms version that names and links them', () => {
    const terms = LEGAL_DOCUMENTS.terms.published.map(p => p.version);
    assert.deepEqual(
      dataTermsProblems(DATA_TERMS_VERSIONS.map(p => p.version), terms, v => readSource(publishedFilePath('terms', v))), [],
    );
  });

});

describe('the texts in force and the pages they link', () => {
  it('no text in force links a page with no published text, and the Data Terms in force are named by the Terms in force', () => {
    const inForce = (page: 'terms' | 'privacy' | 'data-terms' | 'subprocessors') => {
      const v = pageVersionInForce(page);
      return v === null ? null : { name: `${page} ${v}`, text: readSource(publishedFilePath(page, v)) };
    };
    const texts = (['terms', 'privacy', 'data-terms', 'subprocessors'] as const).map(inForce).filter(t => t !== null);
    assert.deepEqual(inForceProblems(
      texts,
      { 'data-terms': pageVersionInForce('data-terms') !== null, subprocessors: pageVersionInForce('subprocessors') !== null },
      inForce('terms')?.text ?? null,
    ), []);
  });
});

describe('the list of the companies that handle your information', () => {
  frozenChecks('subprocessors', SUBPROCESSOR_LIST_VERSIONS);

  it('each copy adds exactly one dated row to "Changes to this list"', () => {
    assert.deepEqual(listProblems(SUBPROCESSOR_LIST_VERSIONS.map(p => ({
      version: p.version, text: readSource(publishedFilePath('subprocessors', p.version)),
    }))), []);
  });

  it('every company on the list in force is named in the Privacy Policy in force', () => {
    const v = pageVersionInForce('subprocessors');
    const privacy = LEGAL_DOCUMENTS.privacy.current;
    if (v === null) return;
    assert.ok(privacy, 'the list cannot publish before the Privacy Policy');
    const list = readSource(publishedFilePath('subprocessors', v));
    assert.deepEqual(companyTableProblems(`list ${v}`, list), []);
    assert.deepEqual(companiesMissingFromPrivacy(list, readSource(publishedFilePath('privacy', privacy))), [],
      'a company on the list that the Privacy Policy does not name — publish the privacy version that names it first, or with it');
  });
});

describe('neither page is accepted anywhere', () => {
  it('the doors record exactly two documents', () => {
    assert.deepEqual([...LEGAL_DOC_KEYS], ['terms', 'privacy']);
    assert.equal('data-terms' in LEGAL_DOCUMENTS || 'subprocessors' in LEGAL_DOCUMENTS, false);
  });

  it('nothing in the acceptance path names the Data Terms or the list', () => {
    const files = [
      'lib/legal-acceptance.ts', 'lib/legal-acceptance-rules.ts', 'app/api/legal/accept/route.ts',
      'scripts/lib/record-legal-acceptance.mjs', 'components/legal/LegalFootLinks.tsx',
    ];
    for (const f of files) assert.equal(/data-terms|subprocessors|DATA_TERMS|SUBPROCESSOR/i.test(readCode(f)), false, f);
    for (const f of [...filesUnder('app', '.ts'), ...filesUnder('lib', '.ts'), ...filesUnder('supabase', '.sql')]) {
      assert.equal(/data_terms_version|subprocessors?_version/.test(readSource(f)), false, `${f} records a version of a page nobody accepts`);
    }
  });

  it('with no text yet, both pages are dark even while the legal pages are published', () => {
    if (DATA_TERMS_VERSIONS.length === 0) assert.equal(legalPageLive('data-terms', {}), false);
    if (SUBPROCESSOR_LIST_VERSIONS.length === 0) assert.equal(legalPageLive('subprocessors', {}), false);
  });
});

// ── The checks fire (fixtures, not the registry) ──────────────────────────────────────────────────────────────────────────────

const T1 = 'Our [Data Terms for organizations](/data-terms) are part of these Terms.';
const listCopy = (rows: string[], companies = ['Supabase', 'ImprovMX']) => [
  '| Company | What it does for us |', '|---|---|', ...companies.map(c => `| **${c}** | Something |`), '',
  '## Changes to this list', '', 'We will email the owners.', '', '| Date | Change |', '|---|---|', ...rows, '',
].join('\n');

describe('the guards fire', () => {
  it('a Data Terms version at a date with no Terms version fails', () => {
    assert.equal(dataTermsProblems(['2027-03-01'], ['2027-01-01'], () => T1).length, 1);
  });

  it('a Data Terms version whose Terms do not name and link them fails', () => {
    assert.equal(dataTermsProblems(['2027-03-01'], ['2027-03-01'], () => 'No mention.').length, 1);
    assert.equal(dataTermsProblems(['2027-03-01'], ['2027-03-01'], () => 'Our Data Terms, unlinked.').length, 1);
    assert.deepEqual(dataTermsProblems(['2027-03-01'], ['2027-03-01'], () => T1), []);
  });

  it('the Data Terms in force is the newest at or before the Terms in force', () => {
    const savedDt = DATA_TERMS_VERSIONS.splice(0);
    const savedCurrent = LEGAL_DOCUMENTS.terms.current;
    try {
      DATA_TERMS_VERSIONS.push({ version: '2027-03-01', sha256: 'x' }, { version: '2027-09-01', sha256: 'y' });
      LEGAL_DOCUMENTS.terms.current = '2027-06-01';
      assert.equal(pageVersionInForce('data-terms'), '2027-03-01');
      LEGAL_DOCUMENTS.terms.current = '2027-09-01';
      assert.equal(pageVersionInForce('data-terms'), '2027-09-01');
      LEGAL_DOCUMENTS.terms.current = '2027-01-01';
      assert.equal(pageVersionInForce('data-terms'), null);
    } finally {
      DATA_TERMS_VERSIONS.splice(0, DATA_TERMS_VERSIONS.length, ...savedDt);
      LEGAL_DOCUMENTS.terms.current = savedCurrent;
    }
  });

  it('a first copy needs its one dated row', () => {
    assert.deepEqual(listProblems([{ version: '2027-03-01', text: listCopy(['| March 1, 2027 | First list published. |']) }]), []);
    assert.equal(listProblems([{ version: '2027-03-01', text: listCopy([]) }]).length, 1);
    assert.equal(listProblems([{ version: '2027-03-01', text: listCopy(['| [date published] | First list published. |']) }]).length, 1);
    assert.equal(listProblems([{ version: '2027-03-01', text: listCopy(['| 2027-03-01 | First list published. |']) }]).length, 1);
  });

  it('a text change without a new dated row fails; with one, it passes', () => {
    const first = { version: '2027-03-01', text: listCopy(['| March 1, 2027 | First list published. |']) };
    const r1 = '| March 1, 2027 | First list published. |';
    // The text changed (a company added) but the table did not.
    assert.equal(listProblems([first, { version: '2027-05-01', text: listCopy([r1], ['Supabase', 'ImprovMX', 'Acme']) }]).length, 1);
    // A new row, but dated another day.
    assert.equal(listProblems([first, { version: '2027-05-01', text: listCopy([r1, '| April 1, 2027 | Acme added. |']) }]).length, 1);
    // An earlier row rewritten.
    assert.equal(listProblems([first, { version: '2027-05-01', text: listCopy(['| March 1, 2027 | First list. |', '| May 1, 2027 | Acme. |']) }]).length, 1);
    // Two rows at once.
    assert.equal(listProblems([first, { version: '2027-05-01', text: listCopy([r1, '| May 1, 2027 | A. |', '| May 1, 2027 | B. |']) }]).length, 1);
    assert.deepEqual(listProblems([first, { version: '2027-05-01', text: listCopy([r1, '| May 1, 2027 | Acme added. |']) }]), []);
  });

  it('a company the Privacy Policy does not name fails (ImprovMX before the privacy version that names it)', () => {
    // The first published privacy version (never a hardcoded date: the version is renamed to its release day at the promote).
    const privacyToday = readSource(publishedFilePath('privacy', LEGAL_DOCUMENTS.privacy.published[0].version));
    assert.deepEqual(companiesMissingFromPrivacy(listCopy([], ['Supabase', 'Amazon Web Services (AWS)', 'ImprovMX']), privacyToday), ['ImprovMX']);
    assert.deepEqual(companiesMissingFromPrivacy(listCopy([], ['Supabase', 'Resend', 'Stripe']), privacyToday), []);
  });

  it('a text in force that links a dark page fails, by either address; the Data Terms in force need the Terms to name them', () => {
    const dark = { 'data-terms': false, subprocessors: false };
    assert.equal(inForceProblems([{ name: 'terms', text: T1 }], dark, T1).length, 1);
    assert.equal(inForceProblems([{ name: 'privacy', text: 'at [the list](/legal/subprocessors).' }], dark, null).length, 1);
    assert.deepEqual(inForceProblems([{ name: 'terms', text: T1 }], { 'data-terms': true, subprocessors: false }, T1), []);
    // A later Terms version that drops the Data Terms while their page stays up.
    assert.equal(inForceProblems([], { 'data-terms': true, subprocessors: false }, 'No mention.').length, 1);
    assert.equal(inForceProblems([], { 'data-terms': true, subprocessors: false }, 'Our Data Terms, and [here](/data-terms).').length, 1);
  });

  it('a company row whose name is not in bold fails, and so does a list with no company table', () => {
    assert.deepEqual(companyTableProblems('list', listCopy([])), []);
    assert.equal(companyTableProblems('list', listCopy([]).replace('| **ImprovMX** |', '| ImprovMX |')).length, 1);
    assert.equal(companyTableProblems('list', 'No table here.').length, 1);
  });

  it('a row date must be a real day written in full, with no leading zero; a row must say what changed', () => {
    assert.equal(parseLongDate('March 1, 2027'), '2027-03-01');
    for (const bad of ['March 01, 2027', 'February 31, 2027', 'march 1, 2027', 'Mar 1, 2027', '2027-03-01']) assert.equal(parseLongDate(bad), null, bad);
    assert.equal(listProblems([{ version: '2027-03-01', text: listCopy(['| March 1, 2027 |  |']) }]).length, 1);
  });

  it('the readers parse the approved draft as the publishing day will freeze it (until the draft is deleted that day)', () => {
    const draftPath = 'docs/agents/legal/drafts/SUBPROCESSOR_LIST.md';
    if (!sourceExists(draftPath)) return;
    const draft = readSource(draftPath);
    assert.deepEqual(companyTableProblems('draft', draft), []);
    assert.ok(companyNames(draft).includes('ImprovMX'));
    assert.equal(changeRows(draft).length, 1, 'the first copy carries exactly one change row');
  });
});

describe('the pages render as written (Board Ready 0a-5 review)', () => {
  const customerText = (draft: string) => {
    const t = readSource(draft);
    return t.slice(t.indexOf('\n---\n') + 5).split('\n').filter(l => !l.startsWith('>')).join('\n');
  };

  it('a "§N" naming the Data Terms or the Payments Terms on the Terms page is not linked to the Terms’ own section', () => {
    const draft = 'docs/agents/legal/drafts/TERMS_OF_SERVICE.md';
    if (!sourceExists(draft)) return;
    const text = customerText(draft);
    const out = linkSectionReferences(text, legalSections(text), LEGAL_OTHER_TITLES.terms);
    assert.equal(/(?:Data|Payments) Terms \(?\[§/.test(out), false);
  });

  it('on the Data Terms page, "Terms §4" stays plain and the Data Terms’ own "§6" links', () => {
    const draft = 'docs/agents/legal/drafts/DATA_TERMS_FOR_ORGANIZATIONS.md';
    if (!sourceExists(draft)) return;
    const text = customerText(draft);
    const out = linkSectionReferences(text, legalSections(text), LEGAL_OTHER_TITLES['data-terms']);
    assert.equal(/(?<!Data )Terms \(?\[§/.test(out), false, 'a reference to the Terms of Service linked to a Data Terms section');
    assert.match(out, /as in \[§6\]\(#section-6\)/);
    // "these Data Terms (§6)" is a reference to this page's own section.
    const own = 'x\n## 6. Companies\n\nAs these Data Terms (§6) say.';
    assert.match(linkSectionReferences(own, legalSections(own), LEGAL_OTHER_TITLES['data-terms']), /Data Terms \(\[§6\]/);
  });

  it('a dark page names itself nowhere: its "not found" answer carries no title', () => {
    assert.match(readCode('lib/legal-page-data.ts'), /if \(data === null\) return \{ robots: \{ index: false, follow: false \} \};/);
  });
});
