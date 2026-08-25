/**
 * PDF Export Quality Phase 1 — the export contract (lib/export/pdf.ts + resolve helpers).
 *
 * The load-bearing claims, in the order they burned a customer:
 *   1. **D1 — the header never falls back to the report title.** Every untouched org printed
 *      its title twice; the header now carries the layered identity (team name on team paper,
 *      org name on admin paper) or nothing.
 *   2. **D2 — shape is the report's property.** A declared orientation/density wins over the
 *      org-wide preference; an undeclared one honours it.
 *   3. **Fit contract — the one-character-per-line shred is impossible.** Columns below the
 *      legible floor are dropped whole, the document SAYS SO, dropOrder decides what yields
 *      first, and rows never split across page breaks.
 *   4. **D3 — "Page X of Y" is true on every page** (stamped after layout, not during).
 *   5. **Identity resolution order** — team field → club field → default; the team's NAME is
 *      not a setting and no club header line overrides it; plans without customization
 *      inherit the club look but never the team's own.
 *
 * The engine takes its jsPDF constructor + autoTable by injection, so these run against
 * recording fakes — no canvas, no real jsPDF.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTablePDF, buildPracticeRunSheetDoc, abbreviateHeadings, DEFAULT_PDF_SETTINGS,
  type OrgPdfSettings, type PracticeSheetBlock, type PracticeSheetOptions,
} from '../../lib/export/pdf';
import {
  checkinSheetHeadings, checkinTickColumn, CHECKIN_TICK_HEADING, CHECKIN_FORBIDDEN_HEADINGS,
} from '../../lib/export/tryout-checkin-columns';
import { applyTeamLook } from '../../lib/export/resolve-pdf-settings';
import { ROSTER_WALL_HEADERS, ROSTER_PRIVATE_HEADINGS, rosterContactHeaders } from '../../lib/export/roster-columns';

// ── Recording fakes ──────────────────────────────────────────────────────────

interface TextCall { str: string; page: number }

class MockDoc {
  orientation: 'portrait' | 'landscape';
  pages = 1;
  currentPage = 1;
  texts: TextCall[] = [];
  images: { x: number; y: number; w: number; h: number }[] = [];
  setPageCalls: number[] = [];
  /** Hand-marked pen boxes (Working-sheets pass) — the only roundedRect this engine draws. */
  boxes: { x: number; y: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(opts: any) { this.orientation = opts.orientation; }
  internal = {
    pageSize: {
      getWidth: () => (this.orientation === 'landscape' ? 279.4 : 215.9),
      getHeight: () => (this.orientation === 'landscape' ? 215.9 : 279.4),
    },
    getNumberOfPages: () => this.pages,
  };
  setFillColor() {} rect() {} setFontSize() {} setTextColor() {}
  setFont(_family: string, style?: string) { this.font = style === 'bold' ? 'bold' : 'normal'; }
  setDrawColor() {} setLineWidth() {} line() {} circle() {}
  roundedRect(x: number, y: number) { this.boxes.push({ x, y }); }
  addPage() { this.pages += 1; this.currentPage = this.pages; }
  setPage(n: number) { this.currentPage = n; this.setPageCalls.push(n); }
  text(str: string | string[], ..._rest: unknown[]) {
    for (const s of Array.isArray(str) ? str : [str]) this.texts.push({ str: s, page: this.currentPage });
  }
  font: 'normal' | 'bold' = 'normal';
  splitWidths: number[] = [];
  /**
   * Deterministic: 2mm per character, and BOLD IS WIDER — which is the whole point of the
   * heading-floor rule. Real helvetica bold runs ~12-15% wider than regular at the same size;
   * modelling that is what lets these tests catch a heading measured in the wrong face.
   */
  getTextWidth(s: string) { return String(s).length * 2 * (this.font === 'bold' ? 1.15 : 1); }
  /**
   * Splits on explicit newlines only. Deliberately NOT width-wrapping: the fake would then
   * break the fit notice across runs and the assertions below would be testing the fake.
   * The width path is covered by recording what width the caller measured against.
   */
  splitTextToSize(str: string, width?: number) {
    if (width !== undefined) this.splitWidths.push(width);
    return String(str).split(/\n/);
  }
  getImageProperties() { return { width: 100, height: 100 }; }
  addImage(_data: string, _fmt: string, x: number, y: number, w: number, h: number) {
    this.images.push({ x, y, w, h });
  }
}

/** autoTable fake: records every call's options; can grow the doc by `extraPages` per call. */
function makeAutoTable(extraPages = 0) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (doc: any, opts: any) => {
    calls.push(opts);
    for (let i = 0; i < extraPages; i++) doc.addPage();
    doc.lastAutoTable = { finalY: (opts.startY ?? 0) + 10 };
  };
  fn.calls = calls;
  return fn;
}

const settings = (over: Partial<OrgPdfSettings> = {}): OrgPdfSettings => ({ ...DEFAULT_PDF_SETTINGS, ...over });

const count = (doc: MockDoc, str: string) => doc.texts.filter(t => t.str === str).length;

// ── D1 — identity fallback ───────────────────────────────────────────────────

describe('D1: the header carries the identity, never the title', () => {
  it('falls back to the passed identity when headerLine1 is blank', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'Team Roster', headers: ['A'], rows: [['1']],
      settings: settings(), identity: 'Riverdale Ridge Hawks',
    });
    assert.equal(count(doc, 'Riverdale Ridge Hawks'), 1);
    assert.equal(count(doc, 'Team Roster'), 1, 'title printed once, in the title block only');
  });

  it('prefers a set headerLine1 over the identity', () => {
    const doc: MockDoc = buildTablePDF(MockDoc, makeAutoTable(), {
      title: 'Team Roster', headers: ['A'], rows: [['1']],
      settings: settings({ headerLine1: 'Riverdale Minor Ball' }), identity: 'Hawks',
    });
    assert.equal(count(doc, 'Riverdale Minor Ball'), 1);
    assert.equal(count(doc, 'Hawks'), 0);
  });

  it('NEVER prints the title as the header name — the doubled-title defect stays dead', () => {
    const doc: MockDoc = buildTablePDF(MockDoc, makeAutoTable(), {
      title: 'Tournament Results', headers: ['A'], rows: [['1']],
      settings: settings(), // no headerLine1, no identity
    });
    assert.equal(count(doc, 'Tournament Results'), 1);
  });
});

// ── D2 — declared shape ──────────────────────────────────────────────────────

describe('D2: shape is the report’s property', () => {
  it('a declared orientation beats the org preference', () => {
    const doc: MockDoc = buildTablePDF(MockDoc, makeAutoTable(), {
      title: 'T', headers: ['A'], rows: [['1']],
      settings: settings({ orientation: 'portrait' }),
      shape: { orientation: 'landscape' },
    });
    assert.equal(doc.orientation, 'landscape');
  });

  it('an undeclared orientation honours the org preference', () => {
    const doc: MockDoc = buildTablePDF(MockDoc, makeAutoTable(), {
      title: 'T', headers: ['A'], rows: [['1']],
      settings: settings({ orientation: 'landscape' }),
    });
    assert.equal(doc.orientation, 'landscape');
  });

  it('a declared density beats the org preference (font size follows)', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'T', headers: ['A'], rows: [['1']],
      settings: settings({ reportDensity: 'readable' }),
      shape: { density: 'compact' },
    });
    assert.equal(at.calls[0].styles.fontSize, 8);
  });
});

// ── Fit contract ─────────────────────────────────────────────────────────────

describe('fit contract: drop whole columns and say so — never shred', () => {
  // Mock text width is 2mm/char, portrait content is 187.9mm, readable padding 12mm/col:
  // each 'ColNN' column's measured floor is 23mm → 8 of these 13 columns fit.
  const manyHeaders = Array.from({ length: 13 }, (_, i) => `Col${i + 1}`);
  const row = manyHeaders.map((_, i) => `v${i}`);

  it('keeps only the columns whose floors fit the page, last columns yielding first', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'T', headers: manyHeaders, rows: [row], settings: settings(),
    });
    assert.equal(at.calls[0].head[0].length, 8);
    assert.deepEqual(at.calls[0].head[0].slice(-1), ['Col8']);
    assert.equal(at.calls[0].body[0].length, 8);
    const notice = doc.texts.find(t => t.str.includes('didn’t fit this page'));
    assert.ok(notice, 'the document admits what it left off');
    assert.ok(notice!.str.includes('Col12') && notice!.str.includes('Col13'));
  });

  it('ENFORCES each kept column’s floor on the layout — the no-shred teeth', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'T', headers: manyHeaders, rows: [row], settings: settings(),
    });
    const cs = at.calls[0].columnStyles;
    for (let i = 0; i < 8; i++) {
      assert.ok(cs[i].minCellWidth >= 8, `column ${i} carries an enforced minimum width`);
    }
  });

  it('honours a declared dropOrder before the default', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'T', headers: manyHeaders, rows: [row], settings: settings(),
      fit: { dropOrder: [0, 1] },
    });
    const kept = at.calls[0].head[0];
    assert.ok(!kept.includes('Col1') && !kept.includes('Col2'), 'the declared columns yield first');
    assert.ok(kept.includes('Col3') && kept.includes('Col10'), 'protected columns survive');
  });

  it('a table that fits is untouched and prints no notice', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'T', headers: ['A', 'B'], rows: [['1', '2']], settings: settings(),
    });
    assert.equal(at.calls[0].head[0].length, 2);
    assert.ok(!doc.texts.some(t => t.str.includes('didn’t fit')));
  });

  it('a wide-label column raises its own floor from its content, not a flat average', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      // Short headings on purpose: this test is about what the CELLS demand.
      title: 'T', headers: ['Note', 'Amt'], rows: [['Extraordinarily-long-unbreakable-token', '7']],
      settings: settings(),
    });
    const cs = at.calls[0].columnStyles;
    assert.ok(cs[0].minCellWidth > cs[1].minCellWidth, 'the label column demands more than the numeric one');
    // One long unbreakable CELL token is capped (14mm demand + 12mm padding + 1), not allowed
    // to eat the page — it wraps to a second line instead, which is legible.
    assert.equal(cs[0].minCellWidth, 27);
  });

  /* ── The heading rule (Phase 2 Registers pass) ────────────────────────────────
     Two bugs compounded here and shipped real paper reading "Divisio n" and
     "Composit e": headings were measured in the regular face while printing bold, and
     the cell cap then held them below even that. Both halves are pinned below. */

  it('measures a heading in the BOLD face it prints in, not the regular one', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'T', headers: ['Division', 'x'], rows: [['a', 'b']], settings: settings(),
    });
    // 'Division' is 8 chars: 16mm regular, 18.4mm bold in the fake. The floor must reserve
    // the bold width plus padding — reserving the regular width is what broke the heading.
    assert.equal(at.calls[0].columnStyles[0].minCellWidth, 8 * 2 * 1.15 + 12 + 1);
  });

  it('never caps a heading’s longest word — a heading may not be shredded', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      // 12 chars → 27.6mm bold, well past the 14mm cell cap.
      title: 'T', headers: ['Coachability', 'x'], rows: [['1', '2']], settings: settings(),
    });
    const floor = at.calls[0].columnStyles[0].minCellWidth;
    assert.equal(floor, 12 * 2 * 1.15 + 12 + 1);
    assert.ok(floor > 14 + 12 + 1, 'the cell cap does not apply to headings');
  });

  it('a heading too wide for the page costs a COLUMN, never a broken word', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'T',
      headers: Array.from({ length: 8 }, () => 'Coachability'),
      rows: [Array.from({ length: 8 }, () => '1')],
      settings: settings(),
    });
    const kept = at.calls[0].head[0].length;
    assert.ok(kept < 8, 'columns yield rather than headings shredding');
    for (let i = 0; i < kept; i++) {
      assert.equal(at.calls[0].columnStyles[i].minCellWidth, 12 * 2 * 1.15 + 12 + 1,
        'every kept heading still gets its whole word');
    }
    assert.ok(doc.texts.some(t => t.str.includes('didn’t fit this page')), 'and the document says so');
  });

  it('rows never split across page breaks', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'T', headers: ['A'], rows: [['1']], settings: settings(),
    });
    assert.equal(at.calls[0].rowPageBreak, 'avoid');
  });

  it('a group whose headers are all blank renders with no head row (the practice sheet’s "Tonight")', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Practice plan', headers: [], rows: [], settings: settings(),
      groups: [{ label: 'Tonight', headers: ['', ''], rows: [['Goal', 'Win']] }],
    });
    assert.equal(at.calls[0].head, undefined);
  });

  it('division-style groups share ONE fit: same columns in every group, the notice once', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'T', headers: manyHeaders, rows: [], settings: settings(),
      groups: [
        { label: 'U11', rows: [row] },
        { label: 'U13', rows: [row] },
        { label: 'U15', rows: [row] },
      ],
    });
    assert.equal(at.calls.length, 3);
    for (const call of at.calls) assert.deepEqual(call.head[0], at.calls[0].head[0]);
    const notices = doc.texts.filter(t => t.str.includes('didn’t fit this page'));
    assert.equal(notices.length, 1, 'the admission belongs to the document, not every division');
  });
});

// ── Subtitle: caller prose, so it wraps ──────────────────────────────────────

describe('the subtitle wraps to the page instead of running off it', () => {
  it('is measured against the content width before it is drawn', () => {
    const doc: MockDoc = buildTablePDF(MockDoc, makeAutoTable(), {
      title: 'T', subtitle: 'Champions — U11: Riverdale Royals · U13: Harborview Herons',
      headers: ['A'], rows: [['1']], settings: settings(),
    });
    // Portrait letter, 14mm margins.
    assert.ok(doc.splitWidths.includes(215.9 - 28), 'the subtitle is fitted to the content width');
  });

  it('prints a legend line of its own, and the table starts below it', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'T', subtitle: '2026 Season\nHitt = Hitting · Fiel = Fielding',
      headers: ['A'], rows: [['1']], settings: settings(),
    });
    assert.ok(doc.texts.some(t => t.str === '2026 Season'));
    assert.ok(doc.texts.some(t => t.str === 'Hitt = Hitting · Fiel = Fielding'));

    const oneLine = makeAutoTable();
    buildTablePDF(MockDoc, oneLine, {
      title: 'T', subtitle: '2026 Season', headers: ['A'], rows: [['1']], settings: settings(),
    });
    assert.ok(at.calls[0].startY > oneLine.calls[0].startY,
      'the extra line pushes the table down rather than being drawn over');
  });
});

// ── Abbreviated headings: the customer-shaped-table diet ─────────────────────

describe('abbreviateHeadings: shorten the customer’s columns, and say what they mean', () => {
  it('initials a multi-word name and truncates a single word', () => {
    const { codes } = abbreviateHeadings(['Game Sense', 'Base Running IQ', 'Coachability']);
    assert.deepEqual(codes, ['GS', 'BRI', 'Coac']);
  });

  it('leaves an already-short name alone, and out of the legend', () => {
    const { codes, legend } = abbreviateHeadings(['Bib', 'Hitting']);
    assert.deepEqual(codes, ['Bib', 'Hitt']);
    assert.equal(legend, 'Hitt = Hitting');
  });

  it('explains every name it shortened, in order', () => {
    const { legend } = abbreviateHeadings(['Composite', 'Evaluators', 'Game Sense']);
    assert.equal(legend, 'Comp = Composite  ·  Eval = Evaluators  ·  GS = Game Sense');
  });

  it('never gives two columns the same heading', () => {
    const { codes } = abbreviateHeadings(['Hitting', 'Hitting for power', 'Hitt']);
    assert.equal(new Set(codes).size, 3, 'a collision is numbered, not repeated');
    assert.deepEqual(codes, ['Hitt', 'HFP', 'Hitt2']);
  });

  it('returns no legend when nothing needed shortening', () => {
    assert.equal(abbreviateHeadings(['Bib', 'Run']).legend, '');
  });

  it('leaves blank headings blank — never numbers them, never legends them', () => {
    // Two blank columns used to come out as '' and '2', printing a bare "2" that reads as data
    // and a legend entry reading "2 = ".
    const { codes, legend } = abbreviateHeadings(['', '   ', 'Hitting']);
    assert.deepEqual(codes, ['', '', 'Hitt']);
    assert.equal(legend, 'Hitt = Hitting');
  });
});

// ── D3 — true page totals ────────────────────────────────────────────────────

describe('D3: "Page X of Y" is true on every page', () => {
  it('stamps the final total on each page after layout', () => {
    const at = makeAutoTable(2); // the table run creates 2 extra pages → 3 total
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'T', headers: ['A'], rows: [['1']], settings: settings(),
    });
    assert.equal(doc.pages, 3);
    for (let p = 1; p <= 3; p++) {
      const stamp = doc.texts.find(t => t.str === `Page ${p} of 3`);
      assert.ok(stamp, `page ${p} carries the true total`);
      assert.equal(stamp!.page, p, 'and it is stamped on its own page');
    }
    assert.ok(!doc.texts.some(t => /^Page 1 of 1$/.test(t.str)), 'the lying counter is gone');
  });
});

// ── D4 — aspect-fit logo ─────────────────────────────────────────────────────

describe('D4: the logo is drawn aspect-fit, never squashed', () => {
  it('a square crest renders square inside the 24×12 slot', () => {
    const doc: MockDoc = buildTablePDF(MockDoc, makeAutoTable(), {
      title: 'T', headers: ['A'], rows: [['1']],
      settings: settings({ logoDataUrl: 'data:image/png;base64,x' }),
    });
    assert.equal(doc.images.length, 1);
    assert.equal(doc.images[0].w, 12, 'width scaled to fit the 12mm height');
    assert.equal(doc.images[0].h, 12);
  });
});

// ── Identity resolution — the two layers ─────────────────────────────────────

describe('applyTeamLook: team field → club field → default; the name is not a setting', () => {
  const clubResolved = settings({
    headerLine1: 'Riverdale Minor Ball',
    headerLine2: '2026 Season',
    accentColor: '#1f4e33',
    logoDataUrl: 'club-logo',
    footerText: 'riverdaleminorball.ca',
  });

  it('an untouched team inherits the club look but carries its OWN name', () => {
    const s = applyTeamLook(clubResolved, 'Hawks U13', null, true);
    assert.equal(s.headerLine1, 'Hawks U13');
    assert.equal(s.headerLine2, undefined, 'a club subtitle describes club paper, not team paper');
    assert.equal(s.accentColor, '#1f4e33');
    assert.equal(s.logoDataUrl, 'club-logo');
    assert.equal(s.footerText, 'riverdaleminorball.ca');
  });

  it('a customized team wins field by field, inheriting the rest', () => {
    const s = applyTeamLook(clubResolved, 'Hawks U13', { accentColor: '#7a1f2b' }, true);
    assert.equal(s.accentColor, '#7a1f2b');
    assert.equal(s.logoDataUrl, 'club-logo', 'unset fields keep inheriting');
  });

  it('a plan without customization ignores the team look but still names the team', () => {
    const s = applyTeamLook(clubResolved, 'Hawks U13', { accentColor: '#7a1f2b', logoDataUrl: 'crest' }, false);
    assert.equal(s.accentColor, '#1f4e33');
    assert.equal(s.logoDataUrl, 'club-logo');
    assert.equal(s.headerLine1, 'Hawks U13');
  });
});

// ── Family dues statement (Phase 2 — Statements & handouts) ──────────────────

import { buildFamilyDuesStatementsDoc, type FamilyDuesStatementRender } from '../../lib/export/pdf';

function family(over: Partial<FamilyDuesStatementRender> & { receiptLabel: string }): FamilyDuesStatementRender {
  return {
    label: `the ${over.receiptLabel.replace(' family', '')}s`,
    childrenLine: 'Isla and Emmett',
    stats: { billed: '$2,900.00', received: '$1,700.00', credits: '$125.00', leftToSend: '$1,075.00' },
    next: ['The last payment falls due Oct 1, 2026.'],
    schedules: [{ label: 'Isla', rows: [['1 of 3', 'Jun 1, 2026', '$500.00', '$500.00', '-', '-', 'Paid May 28']] }],
    payments: [['May 28, 2026', 'Isla', '$500.00', 'E-Transfer', '']],
    credits: [],
    payouts: [],
    ...over,
  };
}

describe('family dues statements: one household per page, page counts per FAMILY', () => {
  it('every family starts on its own page and is footed "Page 1 of 1", never "of N families"', () => {
    const doc: MockDoc = buildFamilyDuesStatementsDoc(MockDoc, makeAutoTable(), {
      families: [family({ receiptLabel: 'Chen family' }), family({ receiptLabel: 'Marchand family' })],
      teamName: 'Riverdale Ridge U13 AA',
      seasonLabel: '2026 Season',
      preparedLabel: 'Aug 23, 2026',
      settings: settings(),
    });
    assert.equal(doc.pages, 2);
    const stamps = doc.texts.filter(t => /^Page \d+ of \d+$/.test(t.str));
    assert.equal(stamps.length, 2);
    for (const s of stamps) assert.equal(s.str, 'Page 1 of 1', 'each statement is its own document');
    assert.ok(!doc.texts.some(t => t.str === 'Page 1 of 2' || t.str === 'Page 2 of 2'),
      'the print run never numbers across households');
  });

  it('falls back to the team identity when headerLine1 is blank (D1), on every family', () => {
    const doc: MockDoc = buildFamilyDuesStatementsDoc(MockDoc, makeAutoTable(), {
      families: [family({ receiptLabel: 'Chen family' }), family({ receiptLabel: 'Marchand family' })],
      teamName: 'Riverdale Ridge U13 AA',
      preparedLabel: 'Aug 23, 2026',
      settings: settings(),
    });
    assert.equal(count(doc, 'Riverdale Ridge U13 AA'), 2);
  });

  it('draws the crest aspect-fit via the shared slot', () => {
    const doc: MockDoc = buildFamilyDuesStatementsDoc(MockDoc, makeAutoTable(), {
      families: [family({ receiptLabel: 'Chen family' })],
      teamName: 'T',
      preparedLabel: 'Aug 23, 2026',
      settings: settings({ logoDataUrl: 'data:image/png;base64,x' }),
    });
    assert.equal(doc.images.length, 1);
    assert.equal(doc.images[0].w, 12, 'square crest renders square in the 24×12 slot');
    assert.equal(doc.images[0].h, 12);
  });

  it('a table that overflows onto a new page names the household on that page', () => {
    // An autoTable fake that spills onto a fresh page and fires the didDrawPage hook the way
    // the real library does — once per page it drew on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spillingAutoTable = (doc: any, opts: any) => {
      opts.didDrawPage?.({});
      doc.addPage();
      opts.didDrawPage?.({});
      doc.lastAutoTable = { finalY: (opts.startY ?? 0) + 10 };
    };
    const doc: MockDoc = buildFamilyDuesStatementsDoc(MockDoc, spillingAutoTable, {
      // One table only, so the spill arithmetic below stays readable: pages 1 → 2.
      families: [family({ receiptLabel: 'Marchand family', payments: [] })],
      teamName: 'T',
      preparedLabel: 'Aug 23, 2026',
      settings: settings(),
    });
    const cont = doc.texts.find(t => t.str === 'Dues statement — Marchand family (continued)');
    assert.ok(cont, 'the continuation header names whose money the loose page describes');
    assert.equal(cont!.page, 2);
    // And the family's own footer range covers both pages.
    assert.ok(doc.texts.some(t => t.str === 'Page 1 of 2' && t.page === 1));
    assert.ok(doc.texts.some(t => t.str === 'Page 2 of 2' && t.page === 2));
  });

  it('sections that are empty are absent, not empty tables', () => {
    const at = makeAutoTable();
    buildFamilyDuesStatementsDoc(MockDoc, at, {
      families: [family({ receiptLabel: 'Chen family', credits: [], payouts: [] })],
      teamName: 'T',
      preparedLabel: 'Aug 23, 2026',
      settings: settings(),
    });
    assert.equal(at.calls.length, 2, 'schedule + payments only — no credits table, no payouts table');
  });
});

// ── Continuation pages carry the identity (Phase 2, Rosters pass) ────────────

describe('a page a table SPILLS onto still knows whose paper it is', () => {
  it('redraws the identity band on continuation pages, never on the first', () => {
    // The fake reports a table that ran onto two more pages.
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'Team Roster', headers: ['A'], rows: [['1']],
      settings: settings({ headerLine1: 'Riverdale Ridge Baseball Association' }),
    });
    const opts = at.calls[0];
    assert.equal(typeof opts.didDrawPage, 'function',
      'the table hands the engine a per-page hook — without it page 2 printed a bare table');

    // Page 1 is the page the table STARTED on: it already has a header, so the hook must not
    // draw a second one.
    const before = count(doc, 'Riverdale Ridge Baseball Association');
    opts.didDrawPage({ pageNumber: 1 });
    assert.equal(count(doc, 'Riverdale Ridge Baseball Association'), before,
     'page 1 must not get a doubled identity band');

    // Every page after it does.
    opts.didDrawPage({ pageNumber: 2 });
    opts.didDrawPage({ pageNumber: 3 });
    assert.equal(count(doc, 'Riverdale Ridge Baseball Association'), before + 2);
  });

  it('reserves room for the band it is about to draw, so it cannot land on the table', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Team Roster', headers: ['A'], rows: [['1']],
      settings: settings({ headerLine1: 'Club', headerLine2: '2026 Season' }),
    });
    const { top } = at.calls[0].margin;
    assert.ok(top > 14, 'a continuation page starts BELOW the top margin, not at it');
    // The band is the taller of the logo slot and the two name lines, plus the divider gap.
    assert.equal(top, 14 + 15 + 4);
  });

  it('a report with no identity at all still reserves the minimum', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Report', headers: ['A'], rows: [['1']], settings: settings(),
    });
    assert.equal(at.calls[0].margin.top, 14 + 4 + 4);
  });

  it('the reserved room grows for a crest, matching what the band actually draws', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Report', headers: ['A'], rows: [['1']],
      // One name line (12mm) is SHORTER than the logo slot (12mm) — a crest plus a second
      // line is the case that must reserve 15, not 12.
      settings: settings({ headerLine1: 'Club', logoDataUrl: 'data:image/png;base64,AAA' }),
    });
    assert.equal(at.calls[0].margin.top, 14 + 12 + 4);
  });
});

// ── The roster's two documents (Phase 2, Rosters pass) ───────────────────────

describe('the roster prints two documents, and only one of them is private', () => {
  // ⚠ THE PRODUCTION LISTS, imported — not a copy. A test that asserts its own literal
  // proves nothing: the page could go back to printing birthdates and it would still pass.
  const WALL = [...ROSTER_WALL_HEADERS];
  const CONTACTS = rosterContactHeaders(true);

  it('the wall copy carries nothing a passer-by should not read', () => {
    for (const forbidden of ROSTER_PRIVATE_HEADINGS) {
      assert.ok(!ROSTER_WALL_HEADERS.includes(forbidden as never),
        `${forbidden} must never appear on the copy a coach pins to a wall`);
    }
    // And the contacts sheet is the one that DOES carry them — otherwise this assertion could
    // be satisfied by a wall copy that is simply empty.
    for (const expected of ROSTER_PRIVATE_HEADINGS) {
      assert.ok(rosterContactHeaders(true).includes(expected),
        `${expected} belongs on the submission sheet`);
    }
  });

  it('the club’s guardian switch drops the guardian columns and KEEPS the date of birth', () => {
    const off = rosterContactHeaders(false);
    assert.ok(off.includes('Date of Birth'), 'DOB is the fact this document exists for');
    for (const gone of ['Guardian', 'Email', 'Phone']) assert.ok(!off.includes(gone));
  });

  it('the wall copy fits portrait without giving up a column', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Team Roster', headers: WALL,
      rows: Array.from({ length: 20 }, (_, i) => [
        String(i + 1), 'Nathaniel Whitfield-Desjardins', 'SS', '3B', 'Active',
      ]),
      settings: settings(), shape: { orientation: 'portrait' },
    });
    assert.equal(at.calls[0].head[0].length, WALL.length,
      'every column survives — the wall copy is a fixed-column report and must fit by construction');
  });

  it('the contacts sheet fits landscape at READABLE density with every column', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Team Roster — with contacts', headers: CONTACTS,
      rows: Array.from({ length: 20 }, (_, i) => [
        String(i + 1), 'Nathaniel Whitfield', '2013-01-10', 'SS',
        'Jordan Whitfield', 'whitfield.family@example.ca', '(555) 013-3324', 'Active',
      ]),
      settings: settings(), shape: { orientation: 'landscape' },
    });
    assert.equal(at.calls[0].head[0].length, CONTACTS.length,
      'no column yields — this is why Secondary is not on this sheet');
  });
});

// ── Working sheets (Phase 2, pass 4) ─────────────────────────────────────────

/**
 * Fire an autoTable call's `didDrawCell` hook once per cell of a fake grid and report which
 * cells actually drew a box. The hook draws through the doc it closed over, so this watches the
 * doc's own recorder rather than asserting on a stub.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function boxesDrawnBy(doc: MockDoc, opts: any, columns: number, bodyRows: number): { column: number; section: string }[] {
  const drawn: { column: number; section: string }[] = [];
  for (const section of ['head', 'body']) {
    for (let r = 0; r < (section === 'head' ? 1 : bodyRows); r++) {
      for (let c = 0; c < columns; c++) {
        const before = doc.boxes.length;
        opts.didDrawCell?.({
          section, column: { index: c },
          cell: { x: 10 + c * 20, y: 20 + r * 8, height: 8, width: 20 },
        });
        if (doc.boxes.length > before) drawn.push({ column: c, section });
      }
    }
  }
  return drawn;
}

describe('a hand-marked column prints a box to mark', () => {
  it('draws one box per BODY cell of the declared column, and nowhere else', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'Tryout check-in', headers: ['Bib', 'Player', 'Checked in', 'Notes'],
      rows: Array.from({ length: 5 }, (_, i) => [String(i + 1), 'Maya Chen', '', '']),
      settings: settings(), penColumns: [2],
    });
    const drawn = boxesDrawnBy(doc, at.calls[0], 4, 5);
    assert.equal(drawn.length, 5, 'one box per row');
    assert.ok(drawn.every(b => b.column === 2), 'only the declared column');
    assert.ok(drawn.every(b => b.section === 'body'), 'never in the heading row');
  });

  it('draws nothing at all when no column is declared — every other document is untouched', () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'Team Roster', headers: ['#', 'Player'], rows: [['1', 'Maya Chen']],
      settings: settings(),
    });
    assert.equal(boxesDrawnBy(doc, at.calls[0], 2, 1).length, 0);
  });

  it('a column dropped by the fit contract takes its box with it', () => {
    const at = makeAutoTable();
    // Ten wide customer-shaped headings on portrait: the fit contract must give some up.
    const headers = Array.from({ length: 10 }, (_, i) => `ExtremelyLongHeading${i}`);
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'Wide', headers, rows: [headers.map(() => 'x')],
      settings: settings(), shape: { orientation: 'portrait' }, penColumns: [9],
      fit: { dropOrder: [9, 8, 7] },
    });
    const kept: string[] = at.calls[0].head[0];
    assert.ok(!kept.includes(headers[9]), 'precondition: the pen column was the one dropped');
    assert.equal(boxesDrawnBy(doc, at.calls[0], kept.length, 1).length, 0,
      'no surviving column inherits the dropped column’s box');
  });
});

describe('the tryout check-in sheet', () => {
  // ⚠ THE PRODUCTION VALUES, imported. A promise checked against the test's own copy of a
  // column list proves nothing — production can regress freely and the test still passes.
  it('carries no contact details in either state', () => {
    for (const blind of [false, true]) {
      for (const forbidden of CHECKIN_FORBIDDEN_HEADINGS) {
        assert.ok(!checkinSheetHeadings(blind).includes(forbidden),
          `${forbidden} must never appear on the first paper a trying-out family sees`);
      }
    }
  });

  it('hides the player’s name in a blind tryout, and the bib carries the identity', () => {
    assert.ok(!checkinSheetHeadings(true).includes('Player'));
    assert.ok(checkinSheetHeadings(true).includes('Bib'));
    assert.ok(checkinSheetHeadings(false).includes('Player'));
  });

  it('the box lands on the column a volunteer marks, in either state', () => {
    for (const blind of [false, true]) {
      assert.equal(checkinSheetHeadings(blind)[checkinTickColumn(blind)], CHECKIN_TICK_HEADING);
    }
  });

  it('names that column rather than abbreviating it — which is what earns it its width', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Tryout check-in', headers: checkinSheetHeadings(false),
      rows: [['1', 'Maya Chen', '12', '', '']],
      settings: settings(), shape: { orientation: 'portrait' },
    });
    const styles = at.calls[0].columnStyles;
    const tick = checkinTickColumn(false);
    const notes = checkinSheetHeadings(false).indexOf('Notes');
    assert.ok(styles[tick].minCellWidth > styles[notes].minCellWidth,
      'the column somebody marks must not be narrower than the one nobody fills in');
  });
});

describe('the practice run sheet', () => {
  const RUN_SETTINGS = settings({ accentColor: '#2F6B3C' });
  const block = (over: Partial<PracticeSheetBlock> = {}): PracticeSheetBlock => ({
    time: '6:00–6:10', title: 'Warm-up', duration: '10 min',
    staff: 'Coach Dana', players: 'Everyone', notes: 'Bands first.', ...over,
  });
  const sheet = (over: Partial<PracticeSheetOptions> = {}): PracticeSheetOptions => ({
    teamName: 'Riverdale Ridge U13 AA', dateLabel: 'Tue, Aug 25, 2026',
    whereLabel: '6:00 PM · Riverdale Park', goal: 'Two-strike at-bats',
    practiceTypes: ['Hitting'], equipment: ['Tees'],
    blocks: [block()], focus: [], settings: RUN_SETTINGS, ...over,
  });

  it('is team paper: the team’s name, once, and never the document title as the name', () => {
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet());
    assert.equal(count(doc, 'Riverdale Ridge U13 AA'), 1);
    assert.equal(count(doc, 'Practice plan'), 1);
  });

  it('NEVER says the practice happened — planned, never done', () => {
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({
      focus: [{ player: 'Maya Chen', focusAreas: 'Backhand pickups' }],
      blocks: [block(), block({ time: '6:10–6:40', title: 'Circuit', rotation: {
        groupNames: ['Group A', 'Group B'],
        rounds: [{ round: 'Round 1', stations: ['Tee', 'Toss'] }],
        notes: ['1 round of 30 min.'],
        groups: [{ name: 'Group A', players: 'Maya' }, { name: 'Group B', players: 'Liam' }],
      } })],
    }));
    const printed = doc.texts.map(t => t.str.toLowerCase()).join(' | ');
    for (const word of ['done', 'completed', 'did it', 'attended', 'finished', 'actual']) {
      assert.ok(!printed.includes(word), `"${word}" must never appear on a sheet about what is PLANNED`);
    }
  });

  it('prints an UNFINISHED rotation’s statements instead of dropping it silently', () => {
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({
      blocks: [block({ rotation: {
        groupNames: [], rounds: [],
        notes: ['Add how often groups move to see the rotation.'],
        groups: [{ name: 'Group A', players: 'Maya, Liam' }],
      } })],
    }));
    const printed = doc.texts.map(t => t.str);
    assert.ok(printed.some(s => s.includes('Add how often groups move')),
      'a coach reading only the paper must learn the rotation is not set');
    assert.ok(printed.some(s => s.includes('Group A')), 'the groups the coach DID make still print');
  });

  it('turns the grid on its side rather than cutting a coach’s own group name', () => {
    const names = ['Thunderbolts', 'Renegades', 'Hurricanes', 'Wolfpack', 'Mustangs', 'Cyclones',
      'Titans', 'Rockets', 'Comets', 'Ospreys', 'Badgers', 'Falcons'];
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({
      blocks: [block({ rotation: {
        groupNames: names,
        rounds: [
          { round: 'Round 1', stations: names.map(() => 'Station 1') },
          { round: 'Round 2', stations: names.map(() => 'Station 2') },
        ],
        notes: [], groups: [],
      } })],
    }));
    const printed = doc.texts.map(t => t.str);
    for (const n of names) assert.ok(printed.includes(n), `${n} prints whole`);
    assert.ok(printed.includes('Group'), 'groups became the rows');
    assert.ok(!printed.includes('Round'), 'rounds became the columns, so "Round" is not the row head');
    // ⚠ Turned sideways, the round label IS the column heading, and the caller's label is a bare
    // ordinal — without the word the grid reads "Group | 1 | 2" and never says what the columns
    // are. Found by seeding a real practice and looking at the paper.
    assert.ok(printed.includes('Round 1') && printed.includes('Round 2'),
      'each column still says which round it is');
  });

  it('keeps the approved shape when the names DO fit — rounds down the side', () => {
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({
      blocks: [block({ rotation: {
        groupNames: ['A', 'B', 'C'],
        rounds: [{ round: 'Round 1', stations: ['Tee', 'Toss', 'BP'] }],
        notes: [], groups: [],
      } })],
    }));
    const printed = doc.texts.map(t => t.str);
    assert.ok(printed.includes('Round'), 'the row-label heading is Round — the approved orientation');
    assert.ok(!printed.includes('Group'));
  });

  it('every page names whose paper it is, and the page total is true', () => {
    const long = Array.from({ length: 14 },
      (_, i) => `Call the play out loud before every rep, point ${i + 1}.`).join('\n');
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({
      blocks: Array.from({ length: 12 }, (_, i) =>
        block({ time: `6:${String(i).padStart(2, '0')}`, title: `Block ${i}`, notes: long })),
    }));
    assert.ok(doc.pages > 1, 'precondition: this fixture spills');
    for (let p = 1; p <= doc.pages; p++) {
      const onPage = doc.texts.filter(t => t.page === p).map(t => t.str);
      assert.ok(onPage.some(s => s.includes('Riverdale Ridge U13 AA')),
        `page ${p} must say whose paper it is — the guarantee that was only ever true of page 1`);
      assert.ok(onPage.some(s => s === `Page ${p} of ${doc.pages}`),
        `page ${p} must carry a TRUE page total`);
    }
  });

  it('a block taller than a page flows, keeps every line, and says it continues', () => {
    const essay = Array.from({ length: 90 }, (_, i) => `Coaching point number ${i + 1}.`).join('\n');
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({
      blocks: [block({ title: 'Everything block', notes: essay })],
    }));
    const printed = doc.texts.map(t => t.str);
    for (let i = 1; i <= 90; i++) {
      assert.ok(printed.includes(`Coaching point number ${i}.`), `line ${i} survived the page break`);
    }
    assert.ok(printed.includes('Everything block (continued)'),
      'where it continues, it says so — a page picked up alone still names what it is');
  });

  it('leaves the focus section ABSENT, not redacted-looking, without the grant', () => {
    const doc: MockDoc = buildPracticeRunSheetDoc(MockDoc, sheet({ focus: [] }));
    const printed = doc.texts.map(t => t.str.toUpperCase());
    assert.ok(!printed.some(s => s.includes('WORKING ON')));
  });
});
