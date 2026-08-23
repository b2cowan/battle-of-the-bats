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
import { buildTablePDF, DEFAULT_PDF_SETTINGS, type OrgPdfSettings } from '../../lib/export/pdf';
import { applyTeamLook } from '../../lib/export/resolve-pdf-settings';

// ── Recording fakes ──────────────────────────────────────────────────────────

interface TextCall { str: string; page: number }

class MockDoc {
  orientation: 'portrait' | 'landscape';
  pages = 1;
  currentPage = 1;
  texts: TextCall[] = [];
  images: { x: number; y: number; w: number; h: number }[] = [];
  setPageCalls: number[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(opts: any) { this.orientation = opts.orientation; }
  internal = {
    pageSize: {
      getWidth: () => (this.orientation === 'landscape' ? 279.4 : 215.9),
      getHeight: () => (this.orientation === 'landscape' ? 215.9 : 279.4),
    },
    getNumberOfPages: () => this.pages,
  };
  setFillColor() {} rect() {} setFont() {} setFontSize() {} setTextColor() {}
  setDrawColor() {} setLineWidth() {} line() {}
  addPage() { this.pages += 1; this.currentPage = this.pages; }
  setPage(n: number) { this.currentPage = n; this.setPageCalls.push(n); }
  text(str: string | string[], ..._rest: unknown[]) {
    for (const s of Array.isArray(str) ? str : [str]) this.texts.push({ str: s, page: this.currentPage });
  }
  /** Deterministic: 2mm per character. */
  getTextWidth(s: string) { return String(s).length * 2; }
  splitTextToSize(str: string) { return [str]; }
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
      title: 'T', headers: ['Category', 'Amt'], rows: [['Extraordinarily-long-unbreakable-token', '7']],
      settings: settings(),
    });
    const cs = at.calls[0].columnStyles;
    assert.ok(cs[0].minCellWidth > cs[1].minCellWidth, 'the label column demands more than the numeric one');
    // One long unbreakable token is capped (14mm demand + 12mm padding + 1), not allowed to
    // eat the page — it wraps to a second line instead, which is legible.
    assert.equal(cs[0].minCellWidth, 27);
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
