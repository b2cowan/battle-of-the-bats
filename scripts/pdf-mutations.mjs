/**
 * DELIBERATE DEFECTS — the proof that the rendered check can actually go red.
 *
 * ⚠⚠ A TEST THAT CANNOT FAIL IS NOT COVERAGE. This is the discipline that has caught something
 * on every single export pass. §106 ran nineteen mutations by hand: ONE exposed an assertion
 * that passed with the defect reinstated (it was off by a single millimetre) and ANOTHER
 * exposed a real coverage gap nobody had noticed. Neither would have been found by running the
 * suite and watching it go green.
 *
 * ⚠ AND THIS PHASE'S DELIVERABLE IS A CHECK, so "it passes" proves nothing at all — the proof
 * of done is "it fails when it should". Each entry below reinstates a defect one of the six
 * export passes actually fixed, or breaks a promise the gate claims to hold, and
 * `check-pdf-documents.mjs --mutate` asserts the gate notices. A gate nobody has seen red is a
 * gate nobody should trust.
 *
 * Each mutation edits ONE source string and is reverted immediately, pass or fail. `find` must
 * match exactly once in spirit — when the product moves under it, the run says STALE, which is
 * a prompt to update the mutation rather than a licence to ignore it.
 *
 * `only` narrows the re-run to the document(s) the defect should show up on, which keeps the
 * proof fast and — more importantly — makes it say WHICH rule caught it rather than drowning
 * the answer in every other document that also happened to break.
 */
export const MUTATIONS = [
  {
    name: 'the page total is read DURING layout again (§79 — a 9-page report footed "Page 1 of 1")',
    file: 'lib/export/pdf.ts',
    find: '  const pageCount: number = doc.internal.getNumberOfPages();',
    replace: '  const pageCount: number = 1;',
    only: 'tournament-registrations',
    expects: 'page-total',
  },
  {
    name: 'only the first page gets a footer (a continuation page loses the club\'s line)',
    file: 'lib/export/pdf.ts',
    find: '  for (let i = 1; i <= pageCount; i++) {\n    doc.setPage(i);\n    doc.setFont(\'helvetica\', \'normal\');',
    replace: '  for (let i = 1; i <= 1; i++) {\n    doc.setPage(i);\n    doc.setFont(\'helvetica\', \'normal\');',
    only: 'tournament-registrations',
    expects: 'unfooted-page',
  },
  {
    /**
     * ⚠ THE SECOND VERSION OF THIS MUTATION, AND THE FIRST ONE IS THE LESSON. It moved the run
     * sheet's floor from 18mm to 2mm above the page edge — and the gate stayed GREEN, because
     * with these fixtures the lowest line still cleared the footer by 18.6mm. A fixture that
     * cannot produce the bad state proves nothing about the rule that would catch it (§101).
     *
     * So this breaks the paging decision itself, which is what §99 actually was: the run sheet
     * kept drawing past the floor because what it MEASURED and what it DREW disagreed.
     */
    name: 'the run sheet stops paging and prints across its own footer again (§99)',
    file: 'lib/export/pdf.ts',
    find: '  function ensureRoom(needed: number): void {\n    if (y + needed > maxY) newPage();\n  }',
    replace: '  function ensureRoom(needed: number): void {\n    void needed;\n  }',
    only: 'coach-practice-run-sheet',
    expects: 'over-footer',
  },
  {
    /**
     * TWO edits, because this defect only exists as a combination: a report has to actually LOSE
     * a column, AND the honest admission has to be missing. Either alone is caught by a
     * different rule — which is the point. It proves the gate still notices a column that
     * vanished quietly, the case `apologises` by definition cannot see.
     */
    name: 'a column is dropped SILENTLY — it stops fitting AND the honest admission is deleted',
    edits: [
      {
        file: 'lib/export/pdf.ts',
        find: 'export const MARGIN = 14;',
        replace: 'export const MARGIN = 42;',
      },
      {
        file: 'lib/export/pdf.ts',
        find: '    doc.text(lines, MARGIN, yy);\n    return yy + lines.length * 3.4 + 2;',
        replace: '    void lines;\n    return yy;',
      },
    ],
    only: 'tournament-results',
    expects: 'missing-heading',
  },
  {
    /**
     * ⚠ THE DECLARATION THAT COST A FALSE FINDING. Four coach money panels are declared
     * spreadsheet-only in `pdf-documents.mjs` so the import-graph discovery stops demanding a
     * fixture for a document they do not offer. This proves the declaration is CHECKED: the
     * moment one of them offers a PDF row, the gate must demand the fixture.
     */
    name: 'a spreadsheet-only money screen quietly gains a PDF row',
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/panel.tsx',
    find: "formats={['xlsx', 'csv']}",
    replace: "formats={['xlsx', 'csv', 'pdf']}",
    expects: 'coverage',
  },
  {
    name: 'the margins swell until fixed-column reports stop fitting',
    file: 'lib/export/pdf.ts',
    find: 'export const MARGIN = 14;',
    replace: 'export const MARGIN = 42;',
    only: 'tournament-results',
    expects: 'apologises',
  },
  {
    name: 'the lineup poster draws off the left edge of the paper',
    file: 'lib/export/pdf.ts',
    find: '  const M = POSTER_MARGIN;',
    replace: '  const M = -40;',
    only: 'coach-lineup-poster',
    expects: 'off-paper',
  },
  {
    name: 'a NEW document is added to the export layer and nobody fixtures it',
    file: 'lib/export/pdf.ts',
    find: 'export async function downloadBattingOrderCard(',
    replace: 'export async function downloadSeasonAwardsCertificate(_f: string): Promise<void> {}\nexport async function downloadBattingOrderCard(',
    expects: 'coverage',
  },
  {
    name: 'a NEW screen learns to print and nobody fixtures it',
    file: 'components/admin/ExportMenu.tsx',
    find: "import styles from './ExportMenu.module.css';",
    replace: "import styles from './ExportMenu.module.css';\nimport { downloadPDF } from '@/lib/export';\nvoid downloadPDF;",
    expects: 'coverage',
  },
  {
    name: 'the family statements start numbering pages against the whole file, not the household',
    file: 'lib/export/pdf.ts',
    find: '        doc.text(`Page ${p - start + 1} of ${end - start + 1}`, pageWidth - MARGIN, footerY, { align: \'right\' });',
    replace: '        doc.text(`Page ${p} of ${p}`, pageWidth - MARGIN, footerY, { align: \'right\' });',
    only: 'coach-family-statements',
    expects: 'page-total',
  },
];
