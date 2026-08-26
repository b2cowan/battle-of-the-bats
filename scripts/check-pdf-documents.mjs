/**
 * THE RENDERED CHECK — generate every document this product prints, read the finished files
 * back, and say which promise broke on which document.
 *
 * ⚠ WHY THIS EXISTS. Nothing in this repo has ever rendered a PDF in a check. `verify:changed`
 * is fifteen checks long and every one of them reads SOURCE TEXT or DATABASE STATE; the one
 * rendered gate, `check:layout`, needs a dev server and looks at screens, not paper. So every
 * defect the six export passes fixed — a squashed crest, a shredded column heading, a report
 * quietly apologising that a column did not fit, a footer that lied about the page count, a run
 * sheet printed across its own footer — survived every gate and was found by a person
 * generating the file and looking at it.
 *
 * ══ WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT ═════════════════════════════════
 *
 * `tests/unit/pdf-export-contract.test.ts` already holds 119 tests that assert on drawn output
 * — every text run, its position, its font — through recording fakes, in under a second, with
 * no browser and no dependency. Between them they already cover EVERY invariant on the Phase 3
 * brief's list: the aspect-fit crest, the identity band on continuation pages, the section
 * heading marked "(continued)", the no-shred heading floor, the footer floor on the run sheet,
 * and the page-total stamping loop.
 *
 * So this check re-asserts none of that. It asserts the three things those fakes are
 * STRUCTURALLY incapable of seeing (owner ruling, decision 1, 2026-08-26):
 *
 *   1. REAL TEXT METRICS. The fake measures 2mm per character. That is not an upper bound and
 *      not a lower bound — it is an average, so it can be wrong in both directions, and §106
 *      found a name it said would not fit that production rendered comfortably.
 *   2. REAL PAGINATION. The autoTable fake performs no layout at all: it records the options it
 *      was handed and invents where it finished. Every page count in that suite is a fiction.
 *   3. THE FINISHED BYTES. What a customer downloads, through the resolver and the settings
 *      layering, rather than the builder in isolation.
 *
 * ══ HOW IT READS THE FILES ═══════════════════════════════════════════════════════════════
 *
 * pdf.js, in PLAIN NODE. The §106 harness ran it inside Chromium and the browser launch was
 * the entire expense — 13.7s for the corpus. Measured here without one: 0.4s. No Playwright,
 * no browser, one dependency.
 *
 * ══ WHEN IT RUNS ═════════════════════════════════════════════════════════════════════════
 *
 * TRIGGERED, NEVER SCHEDULED (owner ruling, 2026-08-26). The pre-commit hook runs it only when
 * a commit stages export code or its fixtures — exactly the way the two guardrails already on
 * that hook read the staged list and skip entirely otherwise — and the release checklist runs
 * one full sweep before documents can reach a customer. It is NOT in `verify:changed`.
 *
 * ⚠ The trigger watches the SHARED ENGINE, not just individual documents. Format changes come
 * from explicit requests; the defects six passes fixed mostly did not. §86's missing identity
 * band hit EVERY long report and §106's stretched crest happened because a crest pipeline was
 * added product-wide and one document was never rewired. Nobody requested either.
 *
 * ══ USAGE ════════════════════════════════════════════════════════════════════════════════
 *   node scripts/check-pdf-documents.mjs             render, read back, assert
 *   node scripts/check-pdf-documents.mjs --list      the document inventory and its coverage
 *   node scripts/check-pdf-documents.mjs --keep=DIR  also write the PDFs somewhere to look at
 *   node scripts/check-pdf-documents.mjs --only=a,b  just these document ids (SKIPS the coverage check)
 *   node scripts/check-pdf-documents.mjs --mutate    PROVE IT GOES RED (see pdf-mutations.mjs)
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverEntryPoints, discoverScreens } from './lib/pdf-surface-discovery.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MM = 72 / 25.4;

const argv = process.argv.slice(2);
const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const has = (name) => argv.includes(`--${name}`);
const KEEP = flag('keep');
const ONLY = flag('only')?.split(',').map((s) => s.trim()).filter(Boolean);

/* ── The promises a rendered file can be held to ─────────────────────────────────────────
 *
 * ⚠ These are what GOOD MEANS, never what a document happens to do today. A committed page
 * count would lock in whatever a document does now — INCLUDING its defects — and would go red
 * for the most ordinary reason in the world: somebody added a column, or a fixture gained a
 * row. That is the gate that gets muted within a month, which is worse than no gate.        */

/** The engine's own drop-and-say-so line. Fixed-column reports must never print it. */
const DROP_NOTICE = 'didn’t fit this page';
/** The runs that ARE the footer, so body content can be told apart from it. */
const FOOTER_RUN = /^Page \d+ of \d+$|^Exported:|Generated by FieldLogicHQ/;
const PAGE_TOTAL = /^Page (\d+) of (\d+)$/;
/**
 * How much clear air a body line must leave above the footer, in mm.
 *
 * ⚠ MEASURED, NOT GUESSED — and the §106 lesson is that one millimetre is enough to make an
 * assertion pass with the defect reinstated. Across the whole corpus the TIGHTEST real
 * clearance today is 10.5mm (the lineup poster, whose footer sits at 5mm rather than the
 * table engine's 8mm). 3mm therefore has ~7mm of headroom against a false alarm while still
 * catching anything that has started to print into the footer band, which is what the run
 * sheet did before §99.
 */
const FOOTER_CLEARANCE_MM = 3;

/**
 * ⚠⚠ THE THREE PATTERNS ABOVE ARE THE PRODUCT'S OWN WORDS, RETYPED — AND A COPY-EDIT COULD
 * SILENTLY BLIND THIS ENTIRE GATE. If someone rewords the apology line to "ran out of room on
 * this page", `DROP_NOTICE` matches nothing and rule R2 — the one thing built specifically to
 * catch a fixed-column report quietly dropping a column — goes dark with no signal at all. The
 * footer patterns fail the opposite way: a legitimate footer copy-edit floods every page of
 * every document with `unfooted-page`, loudly, for entirely the wrong reason.
 *
 * The textbook fix is to export these from `lib/export/pdf.ts` and import them, the way the
 * fixture file already imports the product's column definitions and builders. That is the right
 * answer and it is recommended — but it edits a file another session currently holds
 * uncommitted work in, and interleaving there has already cost this session real damage today.
 *
 * So instead: a CANARY. Read the renderer source and assert the product still says what this
 * file thinks it says. Duplication remains, but it can no longer rot in silence — and the
 * failure names the exact fix rather than leaving someone to work out why a rule stopped firing.
 */
function productStringsStillMatch() {
  const out = [];
  const src = readFileSync(path.join(ROOT, 'lib/export/pdf.ts'), 'utf8');
  const expect = [
    [DROP_NOTICE, 'the drop-and-say-so notice (rule: apologises)'],
    ['Generated by FieldLogicHQ', 'the footer branding line (rule: unfooted-page)'],
    ['`Exported: ${', 'the footer date stamp (rule: unfooted-page)'],
    ['`Page ${i} of ${pageCount}`', 'the page stamp (rule: page-total)'],
    ['`Page ${p - start + 1} of ${end - start + 1}`', 'the per-household page stamp (rule: page-total)'],
  ];
  for (const [needle, what] of expect) {
    if (!src.includes(needle)) {
      out.push({
        doc: 'lib/export/pdf.ts', rule: 'gate-blinded',
        detail: `${what} no longer reads "${needle}". This check matches on that text, so the rule above it is now looking for something the product never prints. Update the pattern in scripts/check-pdf-documents.mjs in the same change as the wording.`,
      });
    }
  }
  return out;
}

/**
 * THE TRIGGER — does anything in this commit put paper at risk?
 *
 * ⚠ IT WATCHES THE SHARED ENGINE, NOT JUST INDIVIDUAL DOCUMENTS, and that is the part that is
 * easy to get wrong. Format changes come from explicit requests; the defects six passes fixed
 * mostly did not. §86's missing identity band hit EVERY long report, and §106's stretched crest
 * happened because a crest pipeline was added product-wide and one document was never rewired.
 * Nobody requested either. So the engine, the assemblers that feed it, and this check's own
 * fixtures all arm the trigger.
 *
 * ⚠ AND A SCREEN ARMS IT TOO, because "somebody added a column" is the headline case this whole
 * phase exists for. Running the full import-graph discovery to decide would cost 1.7s on every
 * commit; reading the staged file for an export import costs nothing. A screen that mentions
 * none of these cannot reach a renderer directly, and the release sweep is the backstop.
 *
 * ⚠ ACCEPTED GAP, DELIBERATELY: a change ELSEWHERE that alters what a document RECEIVES — an
 * upstream data-shape change, say — touches no file here and trips nothing. That is the release
 * sweep's job. Do not add a cadence to close it.
 */
const ENGINE_PATHS = /^(lib\/export\/|lib\/coach-money-exports\.ts|lib\/coach-dues-statement\.ts|lib\/playoff-bracket\.ts|scripts\/pdf-documents\.mjs|scripts\/pdf-mutations\.mjs|scripts\/check-pdf-documents\.mjs|scripts\/lib\/pdf-)/;

/**
 * What in a screen's text says "this one might print".
 *
 * ⚠ THE ENTRY-POINT NAMES ARE DERIVED, NOT LISTED. Hand-listing them was a second hand-kept
 * list hiding behind the first: a new renderer would have to be remembered HERE as well as in
 * the discovery, and forgetting the second one fails silently. `discoverEntryPoints` reads only
 * the renderer modules themselves (a handful of small files, single-digit milliseconds), which
 * is cheap enough for a pre-commit hook — unlike the full import-graph walk.
 */
function screenHint(entryPoints) {
  const names = entryPoints.map((e) => e.name).join('|');
  return new RegExp(`@/lib/export|coach-money-exports|MoneyExportButton|downloadMoneyExport|${names}`);
}

function stagedTouchesPaper(files) {
  const screens = files.map((f) => f.replace(/\\/g, '/'));
  // The cheap half first: a path match needs no file reads at all.
  const enginePath = screens.find((rel) => ENGINE_PATHS.test(rel));
  if (enginePath) return enginePath;

  const candidates = screens.filter((rel) => /^(app|components)\/.*\.tsx?$/.test(rel));
  if (candidates.length === 0) return null;
  const hint = screenHint(discoverEntryPoints(ROOT));
  for (const rel of candidates) {
    try {
      if (hint.test(readFileSync(path.join(ROOT, rel), 'utf8'))) return rel;
    } catch { /* deleted in this commit — nothing to render */ }
  }
  return null;
}

async function main() {
  if (has('mutate')) return runMutations();

  const stagedAt = argv.indexOf('--staged');
  if (stagedAt !== -1) {
    const reason = stagedTouchesPaper(argv.slice(stagedAt + 1));
    if (!reason) return; // costs nothing on every commit that cannot change a document
    console.log(`\nPDF documents · ${reason} is staged — rendering the document set.`);
  }

  const { buildDocuments, COACH_DOCUMENTS, NO_PDF_SCREENS, PLUMBING_SCREENS } = await import('./pdf-documents.mjs');
  const { documents, looks } = await buildDocuments();

  if (has('list')) return printInventory(documents);

  const failures = [];
  const notes = [];

  /* ── 1 · COVERAGE: does the gate know about everything that can print? ────────────────
   * ⚠ Skipped under --only, which narrows the run to named documents. Coverage is a
   * whole-product question, so answering it there is both meaningless and the most expensive
   * thing in the run — the import-graph walk. The mutation suite passes --only for seven of its
   * ten defects and threw the answer away each time. */
  if (ONLY) {
    // Never let a narrowed run read like a full one.
    console.log(`  (--only=${ONLY.join(",")}: coverage of new documents and screens NOT checked)`);
  } else {
    coverageFailures(documents, NO_PDF_SCREENS, PLUMBING_SCREENS).forEach((f) => failures.push(f));
  }

  /* ── 1b · Is the gate still looking for words the product actually prints? ──────────── */
  productStringsStillMatch().forEach((f) => failures.push(f));

  /* ── 2 · RENDER: capture the real bytes ────────────────────────────────────────────── */
  const wanted = ONLY ? documents.filter((d) => ONLY.includes(d.id)) : documents;
  const rendered = await renderAll(wanted, looks, COACH_DOCUMENTS);

  /**
   * ⚠ A GREEN CHECK OVER AN EMPTY CORPUS REPORTS COVERAGE IT DOES NOT HAVE. A rendered sweep
   * whose corpus failed to build is the same failure wearing a green tick, so this is a hard
   * stop rather than a quiet zero.
   */
  if (rendered.files.length === 0) {
    console.error('\n✗ The corpus is EMPTY — nothing rendered. That is a failure, not a pass.');
    /* ⚠ SAY WHY. renderAll already recorded exactly which document threw and with what message,
     * and the first version returned one line above the place those were consumed — throwing
     * away the only diagnosis that exists, in the very case (`--only` on the renderer you are
     * debugging) where it is the whole reason you ran the check. */
    for (const e of rendered.errors) console.error(`    · [${e.rule}] ${e.doc}: ${e.detail}`);
    if (rendered.errors.length === 0) console.error('    (no document even attempted to render — check --only spelling)');
    console.error('');
    process.exitCode = 1;
    return;
  }
  rendered.errors.forEach((e) => failures.push(e));

  /* ── 3 · READ BACK and assert ──────────────────────────────────────────────────────── */
  const pdfjs = await import(pathToFileURL(path.join(ROOT, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
  let pages = 0;
  for (const file of rendered.files) {
    const read = await readDocument(pdfjs, file.bytes);
    pages += read.pageCount;
    assertDocument(file, read, failures, notes);
  }

  report({ documents: wanted, rendered, pages, failures, notes });
}

/* ═══ Coverage ════════════════════════════════════════════════════════════════════════ */

/**
 * A gate only guards what it knows about, and a hand-kept list is guaranteed to fall behind —
 * `check:layout` already works that way, so a screen nobody registered is simply unguarded and
 * A GREEN TICK LOOKS IDENTICAL EITHER WAY. So the list is read out of the code instead.
 */
function coverageFailures(documents, noPdfScreens, plumbingScreens) {
  const out = [];
  const claimedEntries = new Set(documents.map((d) => d.entry));
  const claimedScreens = new Set(documents.flatMap((d) => d.screens));
  const declaredNoPdf = new Map(noPdfScreens.map((s) => [s.file, s]));
  const declaredPlumbing = new Set(plumbingScreens.map((s) => s.file));

  // Computed once and handed to the screen walk, which would otherwise re-derive it.
  const entryPoints = discoverEntryPoints(ROOT);
  for (const { name, module } of entryPoints) {
    if (!claimedEntries.has(name)) {
      out.push({
        doc: module, rule: 'coverage',
        detail: `${name}() renders a document and NO fixture claims it. A new document needs an entry in scripts/pdf-documents.mjs before it can ship.`,
      });
    }
  }

  /**
   * ⚠⚠ A SCREEN THAT CAN REACH A RENDERER IS NOT THE SAME AS A SCREEN THAT PRINTS, AND
   * CONFLATING THEM PRODUCED A FALSE FINDING THAT REACHED THE OWNER (2026-08-26).
   *
   * The shared coach money dialog accepts `'pdf'`, so the import graph marks all six money
   * panels PDF-capable. But each panel decides which formats it OFFERS, and four of them pass
   * `formats={['xlsx', 'csv']}` — no PDF row exists in their dialog. Fixtured anyway, the gate
   * dutifully reported that three of them "lose columns on paper": a defect in documents nobody
   * can produce.
   *
   * So a screen may declare itself spreadsheet-only — and the declaration is READ BACK OUT OF
   * ITS OWN SOURCE. If one gains a PDF row, this fails and demands a fixture, which is the
   * whole point of it being a declaration rather than a place to put things.
   */
  for (const { file, via } of discoverScreens(ROOT, entryPoints)) {
    if (claimedScreens.has(file) || declaredPlumbing.has(file)) continue;
    const declared = declaredNoPdf.get(file);
    if (declared) {
      if (offersPdf(file)) {
        out.push({
          doc: file, rule: 'coverage',
          detail: `declared spreadsheet-only in scripts/pdf-documents.mjs, but it now offers a PDF. Either fixture the document it prints, or remove the declaration. Its stated reason was: ${declared.reason}`,
        });
      }
      continue;
    }
    out.push({
      doc: file, rule: 'coverage',
      detail: `this screen can produce a PDF (it reaches the renderers via ${via}) and no fixture stands for it. Add it to a document's \`screens\`, or — if it offers no PDF row — to NO_PDF_SCREENS, in scripts/pdf-documents.mjs.`,
    });
  }
  return out;
}

/**
 * Does this screen's own file-type dialog offer a PDF? Read from its `formats` list.
 *
 * ⚠ IT FAILS SAFE, and that direction is the whole point. This is what proves a screen declared
 * spreadsheet-only really is one. The first version matched an inline array and returned FALSE
 * for anything else — so the moment two sibling panels hoisted a shared `formats={FORMATS}`
 * constant (a small, likely refactor: six coach money panels already share one export button),
 * a newly printable document would slip past the declaration and never be fixtured. Anything
 * this cannot read as a literal is now treated as "might print", which costs a demand for a
 * fixture rather than a silent hole.
 */
function offersPdf(file) {
  let src;
  try { src = readFileSync(path.join(ROOT, file), 'utf8'); } catch { return false; }
  const uses = [...src.matchAll(/formats=\{([\s\S]{0,200}?)\}/g)].map((m) => m[1].trim());
  if (uses.length === 0) return false;
  return uses.some((expr) => {
    if (/^\[[\s\S]*\]$/.test(expr)) return /['"]pdf['"]/.test(expr); // an inline list: read it
    return true; // a constant, a call, a ternary — cannot be read, so assume it may print
  });
}

/* ═══ Render ══════════════════════════════════════════════════════════════════════════ */

/**
 * Run every document through its real renderer in every identity state, capturing the bytes
 * jsPDF would have handed the browser.
 */
async function renderAll(documents, looks, coachDocs) {
  const { default: jsPDF } = await import('jspdf');
  const files = [];
  const errors = [];
  let capture = null;
  // The renderers end by calling save(); intercept it rather than touching the product.
  jsPDF.API.save = function save(filename) {
    if (capture) capture.push({ filename, bytes: Buffer.from(this.output('arraybuffer')) });
    return this;
  };

  /* jspdf-autotable narrates its own layout decisions to the console ("Of the table content,
   * 188 units width could not fit page"). That is the SAME event this check reports properly,
   * with the document's name and the columns it lost — so letting it through would bury the
   * findings under a duplicate nobody can act on. Captured rather than discarded: anything
   * unexpected still surfaces below. */
  const quiet = console.warn;
  const chatter = [];
  console.warn = (...a) => chatter.push(a.join(' '));
  const originalLog = console.log;
  console.log = (...a) => chatter.push(a.join(' '));

  /* ⚠ THE RESTORE IS IN A `finally`. Only the render call itself was wrapped before, so a throw
   * in the surrounding loop bookkeeping would have escaped with console still swapped — and a
   * swapped console swallows every later message, including the ones explaining what went
   * wrong. */
  try {
    for (const d of documents) {
      const states = coachDocs.has(d.id) ? looks.coach : looks.admin;
      /* An edge case may carry OVERRIDES, because it is sometimes a different promise. The
       * contacts sheet with the club's guardian switch turned off genuinely has three fewer
       * columns, and holding it to the full heading list produced six false alarms on a document
       * doing exactly the right thing. */
      const jobs = [['', d.render, null], ...d.edgeCases.map(([n, fn, over]) => [n, fn, over ?? null])];
      for (const [edge, fn, over] of jobs) {
        const shape = over ? { ...d, ...over } : d;
        for (const [look, settings] of states) {
          const id = [d.id, edge, look].filter(Boolean).join('--');
          capture = [];
          let threw = false;
          try {
            await fn(`${id}.pdf`, settings);
          } catch (err) {
            threw = true;
            errors.push({ doc: id, rule: 'render', detail: `threw while rendering — ${err.message}` });
          } finally {
            /* Drain whatever landed BEFORE deciding the outcome: a renderer that saved a file
             * and then threw has produced real bytes, and discarding them would hide a document
             * from every assertion below. */
            for (const c of capture ?? []) files.push({ id, doc: shape, edge, look, bytes: c.bytes });
            if (!threw && (capture ?? []).length === 0) {
              errors.push({ doc: id, rule: 'render', detail: 'produced no file at all.' });
            }
            capture = null;
          }
        }
      }
    }
  } finally {
    console.warn = quiet;
    console.log = originalLog;
  }
  // Anything the engine said that ISN'T the fit notice it already reported properly.
  const FIT_CHATTER = /could not fit page/;
  const unexpected = [...new Set(chatter.filter((c) => c.trim() && !FIT_CHATTER.test(c)))];
  for (const u of unexpected) errors.push({ doc: '(render)', rule: 'engine-warning', detail: u });

  if (KEEP) {
    mkdirSync(KEEP, { recursive: true });
    for (const f of files) writeFileSync(path.join(KEEP, `${f.id}.pdf`), f.bytes);
  }
  return { files, errors };
}

/* ═══ Read back ═══════════════════════════════════════════════════════════════════════ */

/** Every drawn run on every page, with the geometry the renderer actually produced. */
async function readDocument(pdfjs, bytes) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true,
    // Silence, so the only thing this check ever prints is what it found. Without the font
    // directory pdf.js warns once per document and buries the findings in its own noise.
    verbosity: 0,
    standardFontDataUrl: pathToFileURL(path.join(ROOT, 'node_modules/pdfjs-dist/standard_fonts/')).href,
  }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const [, , width, height] = page.view;
    const items = (await page.getTextContent()).items
      .filter((t) => t.str.trim())
      .map((t) => ({ str: t.str, x: t.transform[4], y: t.transform[5], w: t.width, h: t.height }));
    pages.push({ width, height, items });
  }
  const pageCount = doc.numPages;
  await doc.destroy();
  return { pageCount, pages };
}

/* ═══ Assert ══════════════════════════════════════════════════════════════════════════ */

function assertDocument(file, read, failures, notes) {
  const fail = (rule, detail) => failures.push({ doc: file.id, rule, detail });
  const text = read.pages.flatMap((p) => p.items.map((t) => t.str));
  /**
   * Each page's runs joined into one string, whitespace collapsed.
   *
   * ⚠ ANY PHRASE THIS FILE LOOKS FOR MUST BE MATCHED AGAINST THIS, NOT AGAINST INDIVIDUAL RUNS.
   * The engine draws wrapped text one run PER LINE, so a sentence that wraps is several runs and
   * a per-run `includes` can miss it. R2 originally matched per-run; 40 deliberately-constructed
   * shapes failed to make it miss, so this fixes a class of doubt rather than a proven bug — but
   * it costs nothing, and the rule it protects is the one this whole phase exists to add.
   */
  const pageText = read.pages.map((p) => p.items.map((t) => t.str).join(' ').replace(/\s+/g, ' '));

  /* R1 · A document that drew nothing is not a passing document. */
  if (read.pageCount === 0 || text.length === 0) {
    fail('empty', 'rendered with no pages or no text — a fixture that draws nothing proves nothing.');
    return;
  }

  /* R2 · A fixed-column report FITS BY CONSTRUCTION. The drop-and-say-so line is reserved for
   *      customer-shaped tables — rubric categories, months, tag names. Seeing it on a report
   *      whose heading list is a literal in the code means a column stopped fitting, and this
   *      is the ONLY thing that can see it: the fake's 2mm-per-character model does not know. */
  const noticePage = pageText.find((t) => t.includes(DROP_NOTICE));
  const notice = noticePage ?? text.find((t) => t.includes(DROP_NOTICE));
  if (noticePage && file.doc.columns === 'fixed') {
    // The names sit between the title and the notice; take the tail so a joined page still names them.
    const before = noticePage.split(DROP_NOTICE)[0].trim();
    const dropped = before.slice(Math.max(0, before.length - 120)).trim() || '(unnamed)';
    fail('apologises', `a fixed-column report is telling the reader a column did not fit: …${dropped}`);
  }
  if (!notice && file.doc.columns === 'customer') {
    // Not a failure — a customer-shaped table that happens to fit is the good day. Recorded so
    // "customer" is never used as a blanket excuse for a document that always drops.
    notes.push(`${file.id}: customer-shaped and fitted every column`);
  }

  /* R3 · Every heading the builder kept is actually ON THE PAPER, whole.
   *
   * ⚠ A HEADING MAY WRAP AT A SPACE; it may not shred mid-word. "Slot / Pool" really is drawn
   * as two runs, "Slot /" then "Pool", and that is the contract working — so the match is
   * whitespace-flexible across the runs of a page rather than run-by-run. Getting this wrong
   * the first time produced 29 false alarms on documents that were perfectly correct.
   *
   * ⚠ AND IT ASSERTS ON HEADINGS ONLY, NEVER CELLS. Cells DO break mid-word in a narrow column
   * ("chen.family@e" / "xample.ca") — a real, pre-existing defect whose cause is the shared
   * column-floor rule, deliberately out of this phase's scope. Asserting on it here would make
   * the gate red on work nobody has agreed to do.
   *
   * ⚠ KNOWN LIMIT, not reachable today: `pageText` joins EVERY run on the page, so a heading
   * that is one common word could be "found" in an unrelated free-text cell that happens to
   * contain it. No fixture's data collides (checked against every value `cellFor` can produce).
   * Tightening the match to the header row risks the 29 false alarms above, so this is recorded
   * rather than guessed at — if a document ever gains a free-text column that echoes a heading,
   * fix it then, with that document in front of you. */
  for (const heading of file.doc.headings ?? []) {
    if (!heading.trim()) continue;
    const loose = new RegExp(heading.trim().split(/\s+/).map(escapeRe).join('\\s*'));
    if (!pageText.some((t) => loose.test(t))) {
      fail('missing-heading', `the column heading "${heading}" was kept by the fit contract but is not on the finished page.`);
    }
  }

  /* R4 · Nothing is drawn onto the footer, or off the paper. */
  read.pages.forEach((page, i) => {
    const footer = page.items.filter((t) => FOOTER_RUN.test(t.str.trim()));
    const body = page.items.filter((t) => !FOOTER_RUN.test(t.str.trim()));
    for (const t of body) {
      /* ⚠ y IS THE BASELINE, NOT THE BOTTOM OF THE INK. Descenders (g, y, p, j, q) hang below
       * it by roughly a quarter of the em, so a run whose baseline sits just inside the page
       * can still print its tails off the paper. `t.h` from pdf.js is about one full em, so a
       * quarter of it is the right allowance — and this gate's own history says a single
       * millimetre is enough to let an assertion pass with the defect reinstated. */
      const descender = (t.h || 0) * 0.25;
      if (t.x < -0.5 || t.x + t.w > page.width + 0.5
        || t.y - descender < -0.5 || t.y + t.h > page.height + 0.5) {
        fail('off-paper', `page ${i + 1} draws "${clip(t.str)}" outside the paper.`);
        break;
      }
    }
    if (footer.length === 0) {
      fail('unfooted-page', `page ${i + 1} carries no footer — a page that lost the club's line is a page a reader cannot place.`);
      return;
    }
    const footY = Math.max(...footer.map((t) => t.y));
    const intruder = body.find((t) => t.y < footY + FOOTER_CLEARANCE_MM * MM);
    if (intruder) {
      fail('over-footer', `page ${i + 1} prints "${clip(intruder.str)}" into the footer band (${((intruder.y - footY) / MM).toFixed(1)}mm above the footer line, floor is ${FOOTER_CLEARANCE_MM}mm).`);
    }
  });

  /* R5 · The page total is TRUE — against the file's real page count, which is precisely what
   *      a recording fake cannot know, because it fabricates the count it is asked about. */
  const stamps = read.pages.map((p, i) => ({
    page: i + 1,
    runs: p.items.map((t) => t.str.trim()).filter((s) => PAGE_TOTAL.test(s)),
  }));
  /* ⚠ A ONE-SHEET DOCUMENT DOES NOT NUMBER ITSELF, and demanding it does is how a gate starts
   *   crying wolf. The bracket, the lineup poster and the batting-order card are single sheets
   *   an umpire holds — none of them stamps a page number, and "Page 1 of 1" on a card would
   *   be noise. They declare `pageTotals: 'none'`, WHICH STILL HAS TEETH: the moment such a
   *   document grows past one page it fails, because a multi-page handout with no numbering is
   *   one a reader cannot put back in order. */
  if (file.doc.pageTotals === 'none') {
    if (read.pageCount > 1) {
      fail('page-total', `this document declares itself a single sheet but rendered ${read.pageCount} pages with no page numbering.`);
    }
    return;
  }
  if (file.doc.pageTotals === 'section') {
    /* ⚠ The family statements number their pages PER HOUSEHOLD by design — a family gets
     *   "Page 1 of 1" even inside a print run of twelve. Asserting the file's total here would
     *   cry wolf on every run, and the §106 harness's answer (accept one expected red line)
     *   risks a REAL footer failure hiding behind it. So the rule is turned into one that can
     *   still fail: each stamp must be internally sane, and the sections must ACCOUNT FOR
     *   EVERY PAGE — no more and no fewer. */
    let seen = 0;
    let expected = 0;
    for (const s of stamps) {
      if (s.runs.length === 0) { fail('page-total', `page ${s.page} carries no "Page X of Y" at all.`); return; }
      const [, x, y] = s.runs[0].match(PAGE_TOTAL);
      const [nx, ny] = [Number(x), Number(y)];
      if (nx > ny) { fail('page-total', `page ${s.page} says "${s.runs[0]}" — page X cannot exceed the total.`); return; }
      if (nx === 1) { expected += ny; seen = 0; }
      seen += 1;
      if (seen !== nx) { fail('page-total', `page ${s.page} says "${s.runs[0]}" but is page ${seen} of its section.`); return; }
    }
    if (expected !== read.pageCount) {
      fail('page-total', `the sections claim ${expected} pages between them but the file has ${read.pageCount}.`);
    }
    return;
  }
  for (const s of stamps) {
    if (s.runs.length === 0) {
      fail('page-total', `page ${s.page} of ${read.pageCount} carries no "Page X of Y".`);
      continue;
    }
    const want = `Page ${s.page} of ${read.pageCount}`;
    if (!s.runs.includes(want)) {
      fail('page-total', `page ${s.page} says "${s.runs[0]}" — the file has ${read.pageCount} pages, so it should say "${want}".`);
    }
  }
}

const clip = (s) => (s.length > 44 ? `${s.slice(0, 44)}…` : s);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The most useful line of a crashed child's output — the error, not the version banner. */
const firstLine = (text) => text.split('\n').map((l) => l.trim())
  .find((l) => /Error|error TS|throw/.test(l)) ?? 'the checker crashed';

/*
 * ⚠ THERE IS DELIBERATELY NO "KNOWN FINDINGS" HATCH HERE, AND THAT IS A DECISION MADE THE HARD
 * WAY. This file briefly carried one: a per-document list of named, argued defects that had been
 * reported but not fixed, printed on every run so they stayed visible rather than comfortable.
 * It was built to hold the gate's FIRST finding — three coach money documents "losing columns on
 * paper" — and that finding turned out not to be real: those screens export xlsx/csv only and
 * print nothing at all.
 *
 * With its one occupant gone the mechanism had zero users, and a place to park a finding with
 * nothing parked in it is an invitation rather than a tool. A genuinely deferred defect can have
 * it back — WITH its occupant, argued, in the same change. Until then the rule is simpler and
 * much harder to abuse: every failure this gate reports breaks the build.
 */

/* ═══ Mutation proof ══════════════════════════════════════════════════════════════════ */

/**
 * ⚠⚠ A TEST THAT CANNOT FAIL IS NOT COVERAGE, and this is the discipline that has caught
 * something on every single pass. §106 ran nineteen deliberate mutations: one exposed an
 * assertion that passed with the defect reinstated (off by one millimetre) and another exposed
 * a real coverage gap nobody had noticed.
 *
 * ⚠ This phase's deliverable IS a check, so the proof of done is not "it passes" — it is "it
 * fails when it should". Each mutation reinstates a defect one of the six passes fixed, and the
 * run asserts the gate goes red on it. A gate nobody has seen red is a gate nobody should trust.
 */
/**
 * Edits currently sitting on disk, newest last, so ANY exit path can undo them.
 *
 * ⚠ THIS IS THE MOST DANGEROUS CODE IN THE CHECK. It writes deliberate defects into real
 * product source. Three ways it could previously have left them there permanently, all found by
 * adversarial review and all fixed below: a snapshot held for the whole run and written back
 * over a concurrent edit; an apply loop outside the try, so a throw mid-apply skipped the
 * restore entirely; and no signal handler, so Ctrl+C during a multi-minute run walked away
 * leaving broken source behind.
 */
const inFlight = [];

/**
 * Undo one edit — SURGICALLY, by putting the original text back where the defect was, on
 * whatever the file says RIGHT NOW.
 *
 * ⚠ WHY NOT JUST WRITE THE SNAPSHOT BACK. Because this working copy is shared. A whole-file
 * restore reverts the file to how it looked before this run started, which silently destroys
 * anything another session saved in the meantime — the exact harm that cost a ledger section
 * earlier today. Reversing only the text this tool wrote leaves every other change intact.
 *
 * The snapshot survives as a fallback for the case where the defect text is gone (someone
 * rewrote that region while it was mutated), and that fallback SHOUTS, because it is the one
 * path that can still lose work.
 */
function undoEdit(rec) {
  const abs = path.join(ROOT, rec.file);
  const now = readFileSync(abs, 'utf8');
  if (now.includes(rec.replace)) {
    writeFileSync(abs, now.replace(rec.replace, rec.find));
    return 'undone';
  }
  if (now === rec.snapshot) return 'already clean';
  console.error(`\n⚠⚠ ${rec.file}: the deliberate defect is no longer in the file, and the file is not what it was.`);
  console.error('   Something else wrote to it mid-run. Falling back to the pre-mutation snapshot,');
  console.error('   which may discard that change. Check `git diff` on this file before doing anything else.');
  writeFileSync(abs, rec.snapshot);
  return 'SNAPSHOT FALLBACK — check git diff';
}

/** Undo everything still on disk, newest first. Safe to call twice. */
function undoAll() {
  while (inFlight.length) {
    const rec = inFlight.pop();
    try { undoEdit(rec); } catch (err) {
      console.error(`\n⚠⚠ COULD NOT RESTORE ${rec.file}: ${err.message}`);
      console.error('   The file may still hold a deliberate defect. Run `git diff` on it NOW.');
    }
  }
}

async function runMutations() {
  const { MUTATIONS } = await import('./pdf-mutations.mjs');
  /** A mutation is one or more edits — some defects only show up as a COMBINATION. */
  const editsOf = (m) => m.edits ?? [{ file: m.file, find: m.find, replace: m.replace }];

  /* ⚠ A KILLED PROCESS MUST NOT LEAVE BROKEN SOURCE BEHIND. Node does not unwind a `finally`
   * on SIGINT, and the run spends most of its wall-clock time with a defect on disk, so Ctrl+C
   * was overwhelmingly likely to land there. */
  const onSignal = (sig) => {
    if (inFlight.length) {
      console.error(`\n\n⚠ ${sig} — ${inFlight.length} deliberate defect(s) still on disk. Restoring before exit...`);
      undoAll();
      console.error('   restored.\n');
    }
    process.exit(130);
  };
  process.on('SIGINT', () => onSignal('interrupted'));
  process.on('SIGTERM', () => onSignal('terminated'));

  console.log(`\nMUTATION PROOF — reinstating ${MUTATIONS.length} defects the export passes fixed.\n`);
  const results = [];
  for (const m of MUTATIONS) {
    /* ⚠ SNAPSHOT FRESH, PER MUTATION. The first version snapshotted every target once, before
     * the run, and restored that. Eight of ten mutations edit the same file, so its snapshot
     * went stale by minutes — and any concurrent save in that window was silently reverted. */
    const prepared = editsOf(m).map((e) => {
      const snapshot = readFileSync(path.join(ROOT, e.file), 'utf8');
      /* ⚠ THIS REPO'S SOURCE IS CRLF. A multi-line `find` written with \n silently matches
       * nothing, and a mutation that never applied reports STALE — which reads exactly like a
       * gate that failed to notice a defect. Three of the first nine did this. */
      const eol = snapshot.includes('\r\n') ? '\r\n' : '\n';
      return { ...e, snapshot, find: e.find.replaceAll('\n', eol), replace: e.replace.replaceAll('\n', eol) };
    });
    const missing = prepared.find((e) => !e.snapshot.includes(e.find));
    if (missing) {
      results.push({ name: m.name, expects: m.expects, verdict: 'STALE', detail: `the code this mutation edits has moved (${missing.file}) — the mutation, not the product, needs updating.` });
      continue;
    }

    let verdict;
    let detail = '';
    try {
      /* ⚠ THE APPLY LIVES INSIDE THE TRY. It used to sit above it, so if a second edit threw —
       * a Windows file lock from a concurrent save is enough — the first edit was already on
       * disk and the `finally` was never entered to take it off again. */
      for (const e of prepared) {
        const now = readFileSync(path.join(ROOT, e.file), 'utf8');
        writeFileSync(path.join(ROOT, e.file), now.replace(e.find, e.replace));
        inFlight.push(e); // registered the instant it lands, so a signal can find it
      }
      const out = await runSelf(m.only ? [`--only=${m.only}`] : []);
      detail = out.rules.join(', ');
      /* ⚠ A NON-ZERO EXIT IS NOT PROOF. A mutation that made the checker CRASH also exits
       * non-zero, and reads as a confident catch. So the verdict demands the rule that was
       * supposed to notice: named, by name, in the output. */
      if (out.rules.includes(m.expects)) verdict = 'RED';
      else if (out.code !== 0) { verdict = 'WRONG RULE'; detail = detail || firstLine(out.text); }
      else verdict = 'GREEN — GAP';
    } finally {
      undoAll();
    }
    results.push({ name: m.name, verdict, detail, expects: m.expects });
  }

  let bad = 0;
  for (const r of results) {
    const ok = r.verdict === 'RED';
    if (!ok) bad += 1;
    console.log(`  ${ok ? '✔' : '✗'} ${r.verdict.padEnd(12)} ${r.name}`);
    console.log(`      expected [${r.expects}]${r.detail ? `, caught by: ${r.detail}` : ', caught by: nothing'}`);
    if (r.verdict === 'GREEN — GAP') console.log('      ⚠ THE GATE DID NOT SEE THIS DEFECT AT ALL. That is a coverage gap, not a passing run.');
    if (r.verdict === 'WRONG RULE') console.log('      ⚠ Something went red, but not the rule that should have. Check the checker, not the product.');
    if (r.verdict === 'STALE') console.log('      ⚠ The mutation never applied, so this proves NOTHING either way.');
  }
  console.log(`\n${MUTATIONS.length - bad}/${MUTATIONS.length} reinstated defects caught.\n`);
  process.exitCode = bad === 0 ? 0 : 1;
}

/**
 * Re-run this checker in a child process so a mutated module is actually re-imported.
 *
 * ⚠ `--import` TAKES A URL HERE, NOT A WINDOWS PATH. Handing it `C:\...\loader.mjs` makes the
 * child die on startup — which exits non-zero and therefore looks EXACTLY like the gate
 * catching the defect. The first run of this harness reported six confident greens that were
 * all crashes. That is the mutation discipline catching its own tooling, and it is why the
 * verdict below insists on the rule NAME rather than settling for a non-zero exit.
 */
function runSelf(args) {
  return new Promise((resolve) => {
    import('node:child_process').then(({ execFile }) => {
      execFile(
        process.execPath,
        [
          '--import', pathToFileURL(path.join(ROOT, 'scripts/lib/pdf-node-loader.mjs')).href,
          path.join(ROOT, 'scripts/check-pdf-documents.mjs'),
          ...args,
        ],
        /* ⚠ A TIMEOUT IS NOT OPTIONAL HERE. Without one, a mutation that sends the checker into
         * a loop leaves this promise pending forever — with a deliberate defect sitting in
         * product source and the only way out being a Ctrl+C. Five minutes is ~50× the real
         * runtime, so it can only fire on a genuine hang. */
        { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, timeout: 5 * 60 * 1000 },
        (err, stdout, stderr) => {
          const text = `${stdout}\n${stderr}`;
          const rules = [...new Set([...text.matchAll(/·\s+\[([a-z-]+)\]/g)].map((m) => m[1]))];
          resolve({ code: err ? (err.code ?? 1) : 0, text, rules });
        },
      );
    });
  });
}

/* ═══ Output ══════════════════════════════════════════════════════════════════════════ */

function printInventory(documents) {
  const screens = discoverScreens(ROOT);
  console.log(`\n${documents.length} documents, ${screens.length} screens that can print one.\n`);
  for (const d of documents) {
    const renders = (1 + d.edgeCases.length);
    console.log(`  ${d.id.padEnd(30)} ${d.columns.padEnd(9)} ${String(renders).padStart(2)} shape(s)  ${d.label}`);
    for (const s of d.screens) console.log(`      ${s}`);
  }
  console.log('');
}

function report({ documents, rendered, pages, failures, notes }) {
  console.log(`\nPDF documents · ${documents.length} documents → ${rendered.files.length} files, ${pages} pages read back`);
  if (KEEP) console.log(`  files kept in ${KEEP}`);

  if (failures.length === 0) {
    console.log(`\n✔ every document keeps its promises (${notes.length} customer-shaped table(s) fitted in full)\n`);
    return;
  }
  const byRule = new Map();
  for (const f of failures) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
  console.log('');
  for (const [rule, list] of byRule) {
    console.log(`  ${rule} — ${list.length}`);
    for (const f of list) console.log(`    · [${rule}] ${f.doc}: ${f.detail}`);
  }
  console.log(`\n✗ ${failures.length} problem(s) across ${new Set(failures.map((f) => f.doc)).size} document(s).\n`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\n✗ the rendered check could not run:', err?.stack ?? err, '\n');
  process.exitCode = 1;
});
