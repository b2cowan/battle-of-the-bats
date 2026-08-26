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
  buildTablePDF, buildPracticeRunSheetDoc, buildLineupPosterDoc, buildBattingOrderCardDoc,
  abbreviateHeadings, DEFAULT_PDF_SETTINGS,
  type OrgPdfSettings, type PracticeSheetBlock, type PracticeSheetOptions,
  type LineupPosterOptions, type LineupPosterPlayer,
} from '../../lib/export/pdf';
import { buildBracketDoc } from '../../lib/export/bracket-pdf';
import type { Game, Team } from '../../lib/types';
import {
  checkinSheetHeadings, checkinTickColumn, CHECKIN_TICK_HEADING, CHECKIN_FORBIDDEN_HEADINGS,
} from '../../lib/export/tryout-checkin-columns';
import { applyTeamLook } from '../../lib/export/resolve-pdf-settings';
import { ROSTER_WALL_HEADERS, ROSTER_PRIVATE_HEADINGS, rosterContactHeaders } from '../../lib/export/roster-columns';

// ── Recording fakes ──────────────────────────────────────────────────────────

interface TextCall { str: string; page: number; y?: number }

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
  /** Plain rects, recorded for the Posters pass: the poster's blank-inning box, the blank
   *  bracket's write-in slots, and the blank bracket's division/date rules are all `rect`. */
  rects: { x: number; y: number; w: number; h: number }[] = [];
  setFillColor() {}
  rect(x: number, y: number, w: number, h: number, style?: string) {
    // Only OUTLINED rects are pen targets; a filled one is a header band or a zebra stripe.
    if (style !== 'F') this.rects.push({ x, y, w, h });
  }
  setFontSize(n: number) { this.fontSize = n; }
  fontSize = 10;
  setTextColor() {}
  setFont(_family: string, style?: string) { this.font = style === 'bold' ? 'bold' : 'normal'; }
  setDrawColor() {} setLineWidth() {} circle() {}
  /** Connector segments, recorded: the bracket's whole job is showing who plays whom next. */
  lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  line(x1: number, y1: number, x2: number, y2: number) { this.lines.push({ x1, y1, x2, y2 }); }
  /** The bracket dashes a losers-bracket connector; the table engine never calls this. */
  setLineDashPattern() {}
  roundedRect(x: number, y: number) { this.boxes.push({ x, y }); }
  addPage() { this.pages += 1; this.currentPage = this.pages; }
  setPage(n: number) { this.currentPage = n; this.setPageCalls.push(n); }
  text(str: string | string[], ..._rest: unknown[]) {
    // y is recorded so "nothing is drawn past the footer" is assertable — the run sheet does its
    // own paging, and an under-measured block silently prints across the footer band.
    const yy = typeof _rest[1] === 'number' ? (_rest[1] as number) : 0;
    (Array.isArray(str) ? str : [str]).forEach((line, i) =>
      this.texts.push({ str: line, page: this.currentPage, y: yy + i * 4.2 }));
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

/**
 * The same fake, but `splitTextToSize` really WRAPS at the requested width.
 *
 * ⚠⚠ WHY THIS EXISTS. `MockDoc` deliberately splits on newlines only, and for the table engine
 * that is right — a width-wrapping fake would break the fit-notice assertions into fragments and
 * the tests would be measuring the fake. But the DRAWN run sheet's whole behaviour is wrapping:
 * how tall a block is, whether it fits a page, whether a name is clipped. Against the
 * non-wrapping fake, the run-sheet regression tests below PASSED WITH THE BUG REINTRODUCED — they
 * proved nothing, which is the same failure as a privacy test asserting its own literal (QA §86).
 * Caught by reverting the fix and watching them stay green.
 */
class WrappingMockDoc extends MockDoc {
  splitTextToSize(str: string, width?: number) {
    const paras = String(str).split(/\n/);
    if (width === undefined) return paras;
    const out: string[] = [];
    for (const para of paras) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && this.getTextWidth(next) > width) { out.push(line); line = word; } else { line = next; }
      }
      out.push(line);
    }
    return out;
  }
}

/**
 * The wrapping fake, but text width also SCALES WITH FONT SIZE.
 *
 * ⚠⚠ WHY THIS EXISTS, and it is the same lesson a third time. `MockDoc.getTextWidth` is
 * 2mm per character regardless of size, which is fine for the table engine. But the Posters
 * pass's whole "shrink before you truncate" behaviour is a loop that lowers the size and
 * re-measures — against a size-blind fake that loop can never succeed, so every headline would
 * fall through to the wrap/ellipsis branch and the tests would be measuring the fake rather
 * than the rule. Verified by shrinking the size ladder to a single entry and watching the
 * shrink assertions go red.
 */
class SizingMockDoc extends WrappingMockDoc {
  getTextWidth(s: string) {
    return String(s).length * 2 * (this.fontSize / 10) * (this.font === 'bold' ? 1.15 : 1);
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

// ── Schedules pass (Phase 2, pass 5) ─────────────────────────────────────────

import { buildScheduleDocument, type ScheduleGame } from '../../lib/export/schedule-document';

const game = (over: Partial<ScheduleGame> = {}): ScheduleGame => ({
  date: '2026-07-31', time: '8:00 AM', division: 'U11 Rookie',
  homeTeam: 'Riverdale Royals', awayTeam: 'Harborview Hawks',
  location: 'Riverdale Memorial Park - Diamond 1', status: 'scheduled', ...over,
});

/** Every cell the document would print, flattened — for "does this word appear at all". */
const printedCells = (d: { groups: { rows: string[][] }[] }) => d.groups.flatMap(g => g.rows).flat();

describe('the schedule speaks the coach’s words, not the database’s', () => {
  it('never prints a stored status word on the paper', () => {
    const d = buildScheduleDocument([
      game({ status: 'completed' }), game({ time: '9:00 AM', status: 'cancelled' }),
    ]);
    const cells = printedCells(d);
    for (const stored of ['completed', 'scheduled', 'cancelled']) {
      assert.ok(!cells.includes(stored), `the stored word "${stored}" reached a customer's wall`);
    }
    assert.ok(cells.includes('Final'), 'a played game is Final — the word this screen’s filter uses');
  });

  it('sentence-cases a status it has never seen rather than printing it raw', () => {
    // A fourth enum member must not print lower case; it must not vanish either.
    const d = buildScheduleDocument([game({ status: 'postponed' }), game({ time: '9:00 AM' })]);
    assert.ok(printedCells(d).includes('Postponed'));
  });

  it('names the WEEKDAY in the day heading — the thing a wall reader navigates by', () => {
    const d = buildScheduleDocument([game()]);
    assert.match(d.groups[0].label, /^Friday, July 31\b/);
  });

  it('groups by day and counts each one, in the order the games arrive', () => {
    const d = buildScheduleDocument([
      game({ date: '2026-07-31' }), game({ date: '2026-07-31', time: '9:00 AM' }),
      game({ date: '2026-08-01' }),
    ]);
    assert.equal(d.groups.length, 2);
    assert.match(d.groups[0].label, /2 games/);
    assert.match(d.groups[1].label, /\b1 game\b/);
  });
});

describe('every column on the schedule earns its width', () => {
  it('drops the Status column entirely when nothing in it would speak', () => {
    const d = buildScheduleDocument([game(), game({ time: '9:00 AM' })]);
    assert.ok(!d.headers.includes('Status'),
      'a pre-weekend wall copy carried a column of blank cells');
    assert.equal(d.groups[0].rows[0].length, d.headers.length,
      'the rows must lose the column with the heading');
  });

  it('keeps the Status column when even one row has something to say', () => {
    const d = buildScheduleDocument([game(), game({ time: '9:00 AM', status: 'completed' })]);
    assert.ok(d.headers.includes('Status'));
  });

  it('says "all final" once in the heading instead of on every row', () => {
    const d = buildScheduleDocument([
      game({ status: 'completed' }), game({ time: '9:00 AM', status: 'completed' }),
    ]);
    assert.match(d.groups[0].label, /all final/);
    assert.ok(!d.headers.includes('Status'), 'the heading said it — the column is repetition');
  });

  it('never announces "all scheduled" — that is what a schedule means', () => {
    const d = buildScheduleDocument([game(), game({ time: '9:00 AM' })]);
    assert.ok(!/all scheduled/i.test(d.groups[0].label));
  });

  it('lifts a day’s single venue into its heading and leaves the field behind', () => {
    const d = buildScheduleDocument([
      game(), game({ time: '9:00 AM', location: 'Riverdale Memorial Park - Diamond 2' }),
    ]);
    assert.match(d.groups[0].label, /Riverdale Memorial Park/);
    assert.deepEqual(d.groups[0].rows.map(r => r[4]), ['Diamond 1', 'Diamond 2']);
  });

  it('keeps full locations when a day is played at more than one venue', () => {
    const d = buildScheduleDocument([
      game(), game({ time: '9:00 AM', location: 'Harborview Sportsplex - Diamond 4' }),
    ]);
    assert.ok(!/Riverdale Memorial Park/.test(d.groups[0].label));
    assert.deepEqual(d.groups[0].rows.map(r => r[4]),
      ['Riverdale Memorial Park - Diamond 1', 'Harborview Sportsplex - Diamond 4']);
  });

  it('does not lift a venue that has no field to leave behind', () => {
    // "The Dome" splits to nothing — lifting it printed the same name in the heading AND on
    // every row, doubling the repetition the rule exists to remove.
    const d = buildScheduleDocument([
      game({ location: 'The Dome' }), game({ time: '9:00 AM', location: 'The Dome' }),
    ]);
    assert.ok(!/The Dome/.test(d.groups[0].label));
    assert.deepEqual(d.groups[0].rows.map(r => r[4]), ['The Dome', 'The Dome']);
  });
});

describe('a cancelled game cannot be read as a live one', () => {
  it('gives up its clock, where the reader is already looking', () => {
    const d = buildScheduleDocument([game({ status: 'cancelled', time: '7:00 PM' })]);
    assert.equal(d.groups[0].rows[0][0], 'CANCELLED');
    assert.ok(!d.groups[0].rows[0].includes('7:00 PM'),
      'the clock column must not still read like a game about to start');
  });

  it('keeps the time it gave up, so the row still says when it was', () => {
    const d = buildScheduleDocument([game({ status: 'cancelled', time: '7:00 PM' })]);
    assert.ok(printedCells(d).includes('was 7:00 PM'));
  });

  it('says CANCELLED even on a day where every other game agrees on its status', () => {
    const d = buildScheduleDocument([
      game({ status: 'completed' }), game({ time: '9:00 AM', status: 'completed' }),
      game({ time: '7:00 PM', status: 'cancelled' }),
    ]);
    assert.ok(printedCells(d).includes('CANCELLED'));
  });

  it('does not say it twice when there was no time to give up', () => {
    const d = buildScheduleDocument([game({ status: 'cancelled', time: '' })]);
    assert.deepEqual(d.groups[0].rows[0].filter(c => /cancel/i.test(c)), ['CANCELLED']);
  });
});

describe('a game with no time yet says so', () => {
  it('prints "Time TBD" rather than an empty cell that reads like a fault', () => {
    const d = buildScheduleDocument([game({ time: '' })]);
    assert.equal(d.groups[0].rows[0][0], 'Time TBD');
  });
});

describe('a section that spills a page carries its name onto the next one', () => {
  const grouped = () => {
    const at = makeAutoTable();
    const doc: MockDoc = buildTablePDF(MockDoc, at, {
      title: 'Tournament Schedule', headers: ['Time', 'Home Team'], rows: [],
      settings: settings({ headerLine1: 'Riverdale Minor Ball' }),
      groups: [{ label: 'Friday, July 31', rows: [['8:00 AM', 'Royals']] }],
    });
    return { doc, opts: at.calls[0] };
  };

  it('re-prints the section heading, marked as a continuation', () => {
    const { doc, opts } = grouped();
    opts.didDrawPage({ pageNumber: 2 });
    assert.ok(doc.texts.some(t => t.str === 'Friday, July 31   (continued)'),
      'page 2 opened with a bare table — the reader could not tell what day it was');
  });

  it('does not re-print it on the page the section started on', () => {
    const { doc, opts } = grouped();
    const before = doc.texts.filter(t => t.str.includes('Friday, July 31')).length;
    opts.didDrawPage({ pageNumber: 1 });
    assert.equal(doc.texts.filter(t => t.str.includes('Friday, July 31')).length, before);
  });

  it('reserves the room the continued heading occupies, so it cannot land on the rows', () => {
    const { opts } = grouped();
    const flat = makeAutoTable();
    buildTablePDF(MockDoc, flat, {
      title: 'X', headers: ['A'], rows: [['1']],
      settings: settings({ headerLine1: 'Riverdale Minor Ball' }),
    });
    assert.equal(opts.margin.top, flat.calls[0].margin.top + 10,
      'a grouped continuation page must hold back exactly the heading it draws');
  });

  it('leaves an ungrouped report’s top margin alone', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'X', headers: ['A'], rows: [['1']], settings: settings({ headerLine1: 'Club' }),
    });
    assert.equal(at.calls[0].margin.top, 14 + 12 + 4);
  });
});

describe('one column grid for every section of a grouped document', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twoSections = (rows2: string[][]): any[] => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Tournament Schedule', headers: ['Time', 'Home Team'], rows: [],
      settings: settings({ headerLine1: 'Club' }),
      groups: [
        { label: 'Friday', rows: [['8:00 AM', 'Royals']] },
        { label: 'Saturday', rows: rows2 },
      ],
    });
    return at.calls;
  };

  it('sizes every section from ALL the rows, so the grid does not move down the page', () => {
    // Section 2's names are far longer. Both sections must still lay out identically.
    const calls = twoSections([['9:00 AM', 'Riverdale Ridge Thunderbirds']]);
    assert.deepEqual(calls[0].columnStyles, calls[1].columnStyles,
      'two sections of one document laid out on different grids');
    assert.ok(calls[0].columnStyles[0].cellWidth > 0, 'the grid is pinned, not merely floored');
  });

  it('fills the paper rather than ending two-thirds across it', () => {
    const calls = twoSections([['9:00 AM', 'Rapids']]);
    const total = (Object.values(calls[0].columnStyles) as { cellWidth: number }[])
      .reduce((a, c) => a + c.cellWidth, 0);
    assert.ok(Math.abs(total - (215.9 - 28)) < 0.01, 'the pinned grid must span the content width');
  });

  it('stands back when the columns already want more than the page', () => {
    // A table wider than its paper is autoTable's squeeze to do — pinning it to the no-shred
    // floor printed "Maplewoo / d Mustangs" down the tournament results and grew a page.
    const at = makeAutoTable();
    const wide = Array.from({ length: 12 }, (_, i) => `Column heading number ${i}`);
    buildTablePDF(MockDoc, at, {
      title: 'Results', headers: wide, rows: [], settings: settings({ headerLine1: 'Club' }),
      groups: [{ label: 'U11', rows: [wide.map(() => 'Maplewood Mustangs')] }],
    });
    const styles = Object.values(at.calls[0].columnStyles) as Record<string, number>[];
    assert.ok(styles.every(s => s.cellWidth === undefined),
      'an over-subscribed table must keep its floors, not a pinned width');
    assert.ok(styles.every(s => s.minCellWidth > 0));
  });

  it('leaves a section carrying its OWN headers on its own grid', () => {
    const at = makeAutoTable();
    buildTablePDF(MockDoc, at, {
      title: 'Development Summary', headers: ['A', 'B'], rows: [],
      settings: settings({ headerLine1: 'Club' }),
      groups: [
        { label: 'Shared', rows: [['1', '2']] },
        { label: 'Own', headers: ['X', 'Y', 'Z'], rows: [['1', '2', '3']] },
      ],
    });
    const own = Object.values(at.calls[1].columnStyles) as Record<string, number>[];
    assert.equal(own.length, 3);
    assert.ok(own.every(s => s.cellWidth === undefined),
      'a mixed-column section must not be pinned to another section’s grid');
  });
});

// ── Schedules pass — /review corrections (2026-08-25) ────────────────────────

describe('a game with no date yet still gets a heading a reader can use', () => {
  it('names the group "Date TBD" instead of opening with bare separator dots', () => {
    // Playoff games exist before anyone knows when they are played; the games API returns them
    // with a null date, which the screen coerces to ''. The heading used to build to
    // "   ·   2 games" — no day, leading dots — on a document whose job is weekday findability.
    const d = buildScheduleDocument([game({ date: '' }), game({ date: '', time: '9:00 AM' })]);
    assert.equal(d.groups.length, 1);
    assert.ok(!d.groups[0].label.startsWith(' '), 'the heading opened with the separator');
    assert.match(d.groups[0].label, /^Date TBD\b/);
    assert.match(d.groups[0].label, /2 games/);
  });

  it('keeps the dated days named, with the undated group alongside them', () => {
    const d = buildScheduleDocument([game({ date: '2026-07-31' }), game({ date: '' })]);
    assert.match(d.groups[0].label, /^Friday, July 31\b/);
    assert.match(d.groups[1].label, /^Date TBD\b/);
  });
});

describe('a state the filter row does not offer still prints the screen’s word', () => {
  // Switching all three status chips off passes every status through, so these DO reach paper.
  it('calls a submitted score "Pending review", not "Submitted"', () => {
    const d = buildScheduleDocument([game({ status: 'submitted' }), game({ time: '9:00 AM' })]);
    assert.ok(printedCells(d).includes('Pending review'));
    assert.ok(!printedCells(d).includes('Submitted'));
  });

  it('calls a forfeit "Forfeit"', () => {
    const d = buildScheduleDocument([game({ status: 'forfeit' }), game({ time: '9:00 AM' })]);
    assert.ok(printedCells(d).includes('Forfeit'));
  });

  it('still sentence-cases a state nobody has written yet', () => {
    const d = buildScheduleDocument([game({ status: 'abandoned' }), game({ time: '9:00 AM' })]);
    assert.ok(printedCells(d).includes('Abandoned'));
  });
});

// ── Posters, cards & brackets pass (2026-08-25) ──────────────────────────────
//
// Four documents that are GLANCED AT, not read: a poster taped in a dugout, a card handed to
// an umpire, a bracket pinned to a fence. Good here means big type, high contrast, one job.
//
// ⚠ The pass opened by disproving its own brief. The reported "bracket never draws its first
// connector" was an artifact of a hand-written fixture: production sets the advancing team's
// id but NEVER clears the "Winner QF1" note the connectors are drawn from, and the fixture had
// been written with that note omitted. Fed the shape the database actually holds, every
// connector draws. The bracket fixtures below therefore carry BOTH the team and its note.

const posterPlayer = (
  order: string, name: string, innings: Record<string, string> = {}, isSub = false,
): LineupPosterPlayer => ({ battingOrder: order, name, isSub, inningPositions: innings });

const NINE = Array.from({ length: 9 }, (_, i) =>
  posterPlayer(String(i + 1), `#${i + 2} Player ${i + 1}`, { '1': 'P', '2': 'C' }));

const posterOpts = (over: Partial<LineupPosterOptions> = {}): LineupPosterOptions => ({
  teamName: 'Riverdale Ridge U13 AA',
  opponent: 'Harborview Herons',
  homeAway: 'home',
  dateLabel: 'Sat, Aug 29, 2026 · 10:00 a.m.',
  eventName: 'Riverdale Summer Classic',
  inningCount: 7,
  players: NINE,
  legend: [{ code: 'P', label: 'Pitcher' }, { code: 'C', label: 'Catcher' }],
  settings: settings({
    headerLine1: 'Riverdale Ridge U13 AA',
    logoDataUrl: 'data:image/png;base64,AA',
    footerText: 'Riverdale Minor Ball',
    showDateStamp: true,
  }),
  ...over,
});

/** jsPDF-constructor stand-in: every `new` hands back the one recording doc. */
const inject = (doc: MockDoc) => class { constructor() { return doc; } };

describe('the poster and the card say whose paper they are', () => {
  // They took only an accent colour and a branding flag, so they were the ONLY documents in
  // the product printing no crest and no club name — while the lineups screen was already
  // resolving the full identity at export time and dropping it (owner decision 1).
  it('draws the resolved crest on the poster', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts());
    assert.equal(doc.images.length, 1, 'the poster drew no crest');
  });

  it('draws the resolved crest on the card', () => {
    const doc = new SizingMockDoc({ orientation: 'portrait' });
    buildBattingOrderCardDoc(inject(doc), posterOpts());
    assert.equal(doc.images.length, 1, 'the card drew no crest');
  });

  it('draws that crest ASPECT-FIT, never stretched to the slot', () => {
    // The square-crest bug the bracket had; proven here for the two documents that never had
    // a crest at all, so neither can acquire it later.
    for (const build of [buildLineupPosterDoc, buildBattingOrderCardDoc]) {
      const doc = new SizingMockDoc({ orientation: 'landscape' });
      build(inject(doc), posterOpts());
      const img = doc.images[0];
      assert.equal(img.w, img.h, 'a square crest was drawn non-square');
    }
  });

  it('names the club on both, and carries a real footer', () => {
    for (const build of [buildLineupPosterDoc, buildBattingOrderCardDoc]) {
      const doc = new SizingMockDoc({ orientation: 'landscape' });
      build(inject(doc), posterOpts());
      const drawn = doc.texts.map(t => t.str).join('\n');
      assert.ok(drawn.includes('Riverdale Ridge U13 AA'), 'no identity line');
      assert.ok(/Riverdale Minor Ball/.test(drawn), 'the footer lost the club line');
      assert.ok(/Exported: /.test(drawn), 'the footer lost the date stamp');
      assert.ok(/Generated by FieldLogicHQ/.test(drawn), 'the footer lost the branding line');
    }
  });

  it('leaves the crest slot alone when the org has no logo', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc),
      posterOpts({ settings: settings({ headerLine1: 'Riverdale Ridge U13 AA' }) }));
    assert.equal(doc.images.length, 0);
    assert.ok(doc.texts.some(t => t.str === 'Riverdale Ridge U13 AA'));
  });
});

describe('a name that does not fit shrinks — it is never silently cut', () => {
  // Truncation is the one behaviour that loses information without telling the reader. The
  // matchup used to be ellipsised to buy a fixed 60mm strip for a clock (owner decision 4).
  const LONG = 'Harborview Herons Athletic Association of Greater Riverdale County';

  it('never prints an ellipsis in the poster headline', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts({ opponent: LONG }));
    // A wrapped headline is several runs, and only the FIRST carries the team name — so the
    // whole page's text is rejoined before asking whether the opponent survived intact.
    const all = doc.texts.map(t => t.str).join(' ').replace(/\s+/g, ' ');
    assert.ok(!all.includes('…'), 'something on the poster was truncated');
    assert.ok(all.includes(LONG), 'the opponent lost its tail');
  });

  it('never prints an ellipsis in the card headline', () => {
    const doc = new SizingMockDoc({ orientation: 'portrait' });
    buildBattingOrderCardDoc(inject(doc), posterOpts({ opponent: LONG }));
    const head = doc.texts.filter(t => t.str.includes('Harborview')).map(t => t.str).join(' ');
    assert.ok(!head.includes('…'), `the headline was truncated: ${head}`);
  });

  it('keeps the ordinary matchup on ONE line — shrinking is a fallback, not the default', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts());
    assert.equal(doc.texts.filter(t => t.str.includes('Harborview')).length, 1,
      'a short matchup should not wrap');
  });

  it('shrinks a long player name rather than clipping it in the batter column', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts({
      players: [posterPlayer('1', '#10 Priya Balasubramanian', { '1': 'P' }), ...NINE.slice(1)],
    }));
    assert.ok(doc.texts.some(t => t.str === '#10 Priya Balasubramanian'),
      'the batter name was clipped instead of shrunk');
  });
});

describe('an unassigned inning is left empty — the ruled cell IS the box', () => {
  // ⚠⚠ THIS SUITE INVERTED ON 2026-08-26, and the reason matters more than the assertion.
  // A drawn box was added here first, borrowing the working-sheets rule ("a column somebody
  // fills in by hand gets a real drawn box"). The owner rejected it on sight: that rule was
  // written for the tryout check-in sheet, whose tick column had NO cell borders, and this
  // poster is a heavily ruled grid. A box inside a cell makes the writable area SMALLER than
  // the cell it sits in — it is in the way of the pen, which is the opposite of the intent.
  it('draws NO box in an unassigned inning', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts({
      inningCount: 2, players: [posterPlayer('1', '#2 A', { '1': 'P' })],
    }));
    assert.equal(doc.rects.length, 0,
      'a box was drawn inside a grid cell that is already a box');
  });

  it('draws no box where a position is assigned either', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts({
      inningCount: 2, players: [posterPlayer('1', '#2 A', { '1': 'P', '2': 'C' })],
    }));
    assert.equal(doc.rects.length, 0);
  });

  it('still marks a benched inning "BN" — a decision is not a blank', () => {
    // The distinction the blank cell has to carry: nothing written = not decided yet;
    // "BN" = decided, and the answer is that they sit.
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts({
      inningCount: 2, players: [posterPlayer('1', '#2 A', { '1': 'P', '2': 'Bench' })],
    }));
    assert.ok(doc.texts.some(t => t.str === 'BN'));
    assert.ok(!doc.texts.some(t => t.str === ''), 'an empty inning drew a text run');
  });

  it('does not promise a mark the page no longer carries', () => {
    // The original defect was a legend naming a box that was never drawn. Removing the box
    // brings that back unless the words move with it.
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts());
    const drawn = doc.texts.map(t => t.str);
    assert.ok(drawn.includes('Blank = fill in at the field'),
      'the instruction is not drawn as one whole line');
    assert.ok(!drawn.some(s => /box/i.test(s)),
      'the legend still names a box the poster does not draw');
    assert.ok(!drawn.some(s => s.trim() === 'at the field'),
      'the instruction shredded across the wrap again');
  });
});

describe('the poster and card use the page they were given', () => {
  // Both capped how tall a row could grow and then centred the result, so a NINE-player lineup
  // — the ordinary case — stopped two-thirds down and left a third of a dugout poster blank.
  const rowSpan = (doc: MockDoc, match: RegExp) => {
    const ys = doc.texts.filter(t => match.test(t.str)).map(t => t.y ?? 0).sort((a, b) => a - b);
    return ys.length > 1 ? ys[ys.length - 1] - ys[0] : 0;
  };

  // ⚠ Assert the ROW PITCH, not the total span. Written as `span > 8 * 18 - 1` the card's
  // version passed with the 18mm cap put back — 8 × 18 = 144 clears 143 — so it proved
  // nothing. Caught by the mutation run, which is the only reason it is written this way.
  const rowPitch = (doc: MockDoc, match: RegExp) => rowSpan(doc, match) / 8;

  it('spreads a nine-player poster past the old 13mm-per-row ceiling', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildLineupPosterDoc(inject(doc), posterOpts());
    assert.ok(rowPitch(doc, /^#\d+ Player/) > 13, 'the grid still stops short of the page');
  });

  it('spreads a nine-batter card past the old 18mm-per-row ceiling', () => {
    const doc = new SizingMockDoc({ orientation: 'portrait' });
    buildBattingOrderCardDoc(inject(doc), posterOpts());
    assert.ok(rowPitch(doc, /^#\d+ Player/) > 18, 'the order still stops short of the page');
  });
});

describe('the batting card is a card an umpire can use', () => {
  it('names the starting position for each batter', () => {
    const doc = new SizingMockDoc({ orientation: 'portrait' });
    buildBattingOrderCardDoc(inject(doc), posterOpts({
      players: [posterPlayer('1', '#2 A', { '1': 'SS' })],
    }));
    assert.ok(doc.texts.some(t => t.str === 'SS'), 'the card printed no position');
    assert.ok(doc.texts.some(t => t.str === 'POS'), 'the position column has no heading');
  });

  it('leaves the position blank rather than inventing one when inning 1 is unset', () => {
    const doc = new SizingMockDoc({ orientation: 'portrait' });
    buildBattingOrderCardDoc(inject(doc), posterOpts({
      players: [posterPlayer('1', '#2 A', { '2': 'SS' })],
    }));
    assert.ok(!doc.texts.some(t => t.str === 'SS'),
      'the card read a position from the wrong inning');
  });

  it('still lists the substitutes', () => {
    // Reported as missing; it was not. The brief's fixture simply had no subs in it.
    const doc = new SizingMockDoc({ orientation: 'portrait' });
    buildBattingOrderCardDoc(inject(doc), posterOpts({
      players: [...NINE, posterPlayer('', '#14 Ruby Ferreira', {}, true)],
    }));
    assert.ok(doc.texts.some(t => t.str === 'Subs'));
    assert.ok(doc.texts.some(t => t.str.includes('Ruby Ferreira')));
  });
});

// ── The bracket ─────────────────────────────────────────────────────────────

const bg = (
  code: string, over: Partial<Game> = {},
): Game => ({
  id: code, bracketCode: code, isPlayoff: true, status: 'scheduled',
  homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null,
  homePlaceholder: null, awayPlaceholder: null,
  ...over,
} as unknown as Game);

/** Four quarter-finals into two semis into a final — SHAPED AS THE DATABASE HOLDS IT: an
 *  advanced game carries the resolved team id AND the "Winner <code>" note it came from. */
const BRACKET: Game[] = [
  bg('QF1', { homeTeamId: 't1', awayTeamId: 't8', homeScore: 7, awayScore: 2, status: 'completed', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #8' }),
  bg('QF2', { homeTeamId: 't4', awayTeamId: 't5', homeScore: 4, awayScore: 5, status: 'completed', homePlaceholder: 'Seed #4', awayPlaceholder: 'Seed #5' }),
  bg('QF3', { homeTeamId: 't2', awayTeamId: 't7', homeScore: 6, awayScore: 3, status: 'completed', homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #7' }),
  bg('QF4', { homeTeamId: 't3', awayTeamId: 't6', homeScore: 1, awayScore: 8, status: 'completed', homePlaceholder: 'Seed #3', awayPlaceholder: 'Seed #6' }),
  bg('SF1', { homeTeamId: 't1', awayTeamId: 't5', homePlaceholder: 'Winner QF1', awayPlaceholder: 'Winner QF2' }),
  bg('SF2', { homeTeamId: 't2', awayTeamId: 't6', homePlaceholder: 'Winner QF3', awayPlaceholder: 'Winner QF4' }),
  bg('FIN', { homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' }),
];
const BRACKET_TEAMS = Array.from({ length: 8 }, (_, i) =>
  ({ id: `t${i + 1}`, name: `Team ${i + 1}` }) as unknown as Team);

const bracketSettings = settings({
  headerLine1: 'Riverdale Minor Ball', headerLine2: '2026 Season',
  logoDataUrl: 'data:image/png;base64,AA', footerText: 'Riverdale Minor Ball',
  showDateStamp: true, orientation: 'landscape',
});

describe('the bracket stops squashing the club crest', () => {
  it('draws a SQUARE crest square', () => {
    // ⚠ THE defect of this group. The bracket hand-rolled its own header and drew the logo into
    // a fixed 20 × 10 box, so every square or round club mark printed stretched to double width
    // — on the most public document in the product. It now goes through the ONE shared band.
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket', 'Riverdale Summer Classic 2026',
      BRACKET, BRACKET_TEAMS, bracketSettings, false);
    assert.equal(doc.images.length, 1, 'the bracket drew no crest');
    assert.equal(doc.images[0].w, doc.images[0].h,
      'the bracket stretched a square crest again');
  });

  it('prints the division as a TITLE, not as metadata under the club name', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket', 'Riverdale Summer Classic 2026',
      BRACKET, BRACKET_TEAMS, bracketSettings, false);
    // Its own run, not folded into a joined "title · subtitle · group" line.
    assert.ok(doc.texts.some(t => t.str === 'U13 — Playoff Bracket'),
      'the bracket still has no title block');
    assert.ok(doc.texts.some(t => t.str === 'Riverdale Summer Classic 2026'));
    assert.ok(doc.texts.some(t => t.str === 'Riverdale Minor Ball'), 'no identity line');
  });

  it('still footers, and still says so when there is nothing to draw', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U9 — Playoff Bracket', undefined, [], BRACKET_TEAMS,
      bracketSettings, false);
    assert.ok(doc.texts.some(t => t.str === 'No playoff bracket games to display.'));
    assert.ok(doc.texts.some(t => /Generated by FieldLogicHQ/.test(t.str)));
    assert.ok(doc.texts.some(t => t.str === 'U9 — Playoff Bracket'));
  });
});

describe('the blank bracket is something you can actually write on', () => {
  it('draws real boxes for every name and score slot', () => {
    // Two grey hairlines before this pass — on the purest fill-in-by-hand document we ship.
    // The working-sheets rule: a slot somebody fills in by hand gets a box to aim a pen at.
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket (Blank)', undefined,
      BRACKET, BRACKET_TEAMS, bracketSettings, true);
    // 7 games × 2 sides × (name + score) = 28 pen boxes, before the division/date rules.
    assert.ok(doc.rects.length >= 28,
      `the blank bracket drew ${doc.rects.length} pen boxes, expected at least 28`);
  });

  it('offers somewhere to hand-write which draw this is and when', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket (Blank)', undefined,
      BRACKET, BRACKET_TEAMS, bracketSettings, true);
    assert.ok(doc.texts.some(t => t.str === 'DIVISION'));
    assert.ok(doc.texts.some(t => t.str === 'DATE'));
  });

  it('prints no scores and no team names', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket (Blank)', undefined,
      BRACKET, BRACKET_TEAMS, bracketSettings, true);
    assert.ok(!doc.texts.some(t => /^Team \d$/.test(t.str)), 'a blank bracket named a team');
    assert.ok(!doc.texts.some(t => t.str === '7'), 'a blank bracket printed a score');
  });

  it('does NOT offer those write-in fields on a played bracket', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket', undefined,
      BRACKET, BRACKET_TEAMS, bracketSettings, false);
    assert.ok(!doc.texts.some(t => t.str === 'DIVISION'));
  });
});

describe('the bracket title makes room for whatever shares its row', () => {
  // /review, 2026-08-26: the title is drawn BEFORE the champion line and before the blank
  // sheet's DIVISION/DATE fields, and nothing occupied that space in blank mode until this
  // pass added the fields — so a long division name ran underneath them.
  const LONG_TITLE = 'U13 Boys Competitive Division — Championship Playoff Bracket, Gold Tier';

  it('clips a long title rather than running it under the blank sheet’s write-in fields', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), LONG_TITLE, undefined, BRACKET, BRACKET_TEAMS,
      bracketSettings, true);
    const drawn = doc.texts.find(t => t.str.startsWith('U13 Boys'))!;
    assert.ok(drawn.str.endsWith('…'), 'the long title was not clipped');
    // 279.4mm landscape − 2×14 margin − (46+46+14+8) reserved for DIVISION/DATE.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    assert.ok(doc.getTextWidth(drawn.str) <= 279.4 - 28 - 114,
      'the title still overruns the write-in fields');
  });

  it('clips a long title rather than running it under the champion line', () => {
    const done = BRACKET.map(g => g.bracketCode === 'FIN'
      ? { ...g, status: 'completed', homeTeamId: 't1', awayTeamId: 't2', homeScore: 6, awayScore: 5 }
      : g) as Game[];
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), LONG_TITLE, undefined, done, BRACKET_TEAMS,
      bracketSettings, false);
    assert.ok(doc.texts.some(t => /^Champion: /.test(t.str)), 'no champion line to collide with');
    assert.ok(doc.texts.find(t => t.str.startsWith('U13 Boys'))!.str.endsWith('…'),
      'the title was not clipped away from the champion line');
  });

  it('leaves a short title alone', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket', undefined, BRACKET, BRACKET_TEAMS,
      bracketSettings, true);
    assert.ok(doc.texts.some(t => t.str === 'U13 — Playoff Bracket'), 'a short title was clipped');
  });
});

describe('the bracket footer says the same three things every other document says', () => {
  // ⚠ COVERAGE GAP found by the mutation run, not by reading: the bracket kept its own fourth
  // copy of the footer assembly, and swapping it for a branding-only version stayed GREEN —
  // nothing asserted the club's own line or the date stamp ever reached this document.
  it('carries the club line, the date stamp and the branding', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket', undefined, BRACKET, BRACKET_TEAMS,
      bracketSettings, false);
    const footer = doc.texts.map(t => t.str).find(s => /Generated by FieldLogicHQ/.test(s)) ?? '';
    assert.ok(/Riverdale Minor Ball/.test(footer), 'the bracket footer lost the club line');
    assert.ok(/Exported: /.test(footer), 'the bracket footer lost the date stamp');
  });

  it('says nothing at all when the org has configured no footer', () => {
    const doc = new SizingMockDoc({ orientation: 'landscape' });
    buildBracketDoc(inject(doc), 'U13 — Playoff Bracket', undefined, BRACKET, BRACKET_TEAMS,
      settings({ showBranding: false, showDateStamp: false }), false);
    assert.ok(!doc.texts.some(t => /Generated by FieldLogicHQ|Exported: /.test(t.str)));
  });
});
