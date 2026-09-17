/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE COACH KIT IS THE ONE HOME FOR A DASHBOARD CARD, A LIST TOOLBAR, A RAIL ROW AND THE PHONE
 * LINE** (owner rulings A–H, 2026-09-16; COACH_SHARED_STYLE_KIT_PLAN.md §8).
 *
 * Why a guard and not a comment: Skills & Goals' Overview was given Money's dashboard grammar by
 * copying the stylesheet — with a docblock saying "a shared kit is the right extraction if a third
 * Overview appears" — and it had drifted in three places three days later. A kit nothing can find
 * drifts by Christmas. This scan is the "no thirtieth branch" pattern of
 * `coach-history-endpoint-guard.test.ts`, one level down: a coach stylesheet OUTSIDE the kit that
 * declares one of the kit's shapes fails the build, so the next dashboard-shaped screen is built
 * from the kit or is a decision someone made on purpose (edit the allow-list in the same commit).
 *
 * THE RULES:
 *   1. No `*.module.css` under `app/[orgSlug]/coaches` or `components/coaches` (the kit's own file
 *      excepted) declares a top-level rule whose selector is one of the KIT SELECTORS below.
 *      `.card` alone is NOT on the list — twelve unrelated coach modules have a `.card` of their
 *      own (a live event card, a tryout snapshot…); the dashboard card's signature is `.eye` +
 *      `.big` beside it, and THOSE are the tell.
 *   2. The kit declares every selector it is the home for — the list is asserted against the kit
 *      file, so a rename inside the kit fails here rather than leaving the list guarding a ghost.
 *   3. The three retired phone-line pairs and the five retired toolbars stay retired by name.
 *
 * ⚠ SCOPE LIMIT: a source scan of declared selectors. It cannot see a value copied under a NEW
 * name (`.storyCard { …the same 8 lines… }`). The rendered layout gate is the second witness for
 * that; this guard only makes the known names un-redeclarable.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { readSource, stripComments } from './_source-code';

const ROOT = process.cwd();
const KIT_FILE = join('components', 'coaches', 'kit', 'CoachKit.module.css');
const SCAN_ROOTS = [join('app', '[orgSlug]', 'coaches'), join('components', 'coaches')];

/** The shapes the kit is the one home for. A top-level declaration of any of these outside the
 *  kit is a second copy. (Plain class names — `.eye`, not `.eyeRow`: the regex anchors on the
 *  whole simple selector.) */
const KIT_SELECTORS = [
  // the dashboard card's parts (`.eye` and `.big` are the SIGNATURE pair — see below)
  'eyeRow', 'footLink', 'railRow', 'railName', 'railStat', 'railChev', 'railDot', 'railStep',
  // the list toolbar — the three live recipes and the two dead ones, by their retired names
  'toolbar', 'toolbarActions', 'toolbarLede', 'toolbarView',
  'panelToolbar', 'panelToolbarActions', 'panelToolbarSticky', 'panelToolbarTabs',
  'listToolbar', 'listToolbarEnd', 'listToolbarFact', 'listToolbarFactPhoneDrop', 'listToolbarView',
  'insightsPanelToolbar', 'scheduleToolbar', 'scheduleToolbarActions',
  // the Overview tile family — the kit's door card now
  'snapshotCard', 'snapshotHead', 'snapshotHeadLabel', 'snapshotHeadArrow', 'snapshotValue', 'snapshotSub',
  'snapshotBar', 'snapshotBarTrack', 'snapshotBarFill', 'snapshotBarPct', 'snapshotFlag',
  // the retired phone-line pairs (the shared family lives in coaches.module.css, by design — see below)
  'phoneLine', 'desktopCell', 'devReportPhoneLine', 'devReportDesktopCell', 'devReportOneLine', 'devReportRowCell',
];

/** Declared in the kit, asserted present (rule 2). The toolbar and rail names the kit owns. */
const KIT_MUST_DECLARE = [
  'row3', 'row2', 'card', 'cardDoor', 'cardAlert', 'eyeRow', 'eye', 'eyeArrow',
  'chip', 'chipDanger', 'chipWarn', 'chipGood', 'big', 'bigGood', 'bigBad', 'bigMuted', 'bigWords', 'sub',
  'cardAccent', 'flag', 'flagOk', 'flagWarn', 'flagMute', 'bar', 'seg', 'segFill', 'segBad', 'segOver', 'legend', 'legendDot',
  'dotFill', 'dotOver', 'dotTrack', 'foot', 'footLink',
  'toolbar', 'toolbarSticky', 'toolbarLede', 'toolbarActions', 'toolbarView',
  'railCard', 'railCols', 'railGroup', 'railStep', 'railRow', 'railDot', 'railDotGood', 'railDotBlue',
  'railDotRust', 'railDotPlum', 'railDotOlive', 'railName', 'railNote', 'railStat', 'railStatDanger',
  'railStatWarn', 'railChev',
];

/** The phone-line family stays in `coaches.module.css` on purpose: it is part of `.tableAsCards`
 *  (the card reflow), which every list table composes from that file, and a rule in the kit could
 *  not compound with `.tableAsCards` across modules. The guard asserts it exists there, once. */
const SHARED_FAMILY_HOME = join('app', '[orgSlug]', 'coaches', 'coaches.module.css');
const SHARED_FAMILY = ['cardPhoneLine', 'cardDesktopCell', 'cardsOneLine', 'cardsOneLineLead'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.module.css')) out.push(full);
  }
  return out;
}

/** Top-level simple-class declarations: `.name {` or `.name,` at the start of a selector list,
 *  outside comments. Compound selectors (`.tableAsCards .cardPhoneLine`) and descendants are not
 *  declarations of `.cardPhoneLine` and are deliberately not matched. */
/** A repo-relative stylesheet read ONCE as code (`_source-code.ts`'s rule: a guard that reads
 *  prose proves the prose) — the phone-line test below reads the same 786KB stylesheet the scan
 *  already read. */
const sourceCache = new Map<string, string>();
function stripped(rel: string): string {
  let s = sourceCache.get(rel);
  if (s === undefined) {
    s = stripComments(readSource(rel));
    sourceCache.set(rel, s);
  }
  return s;
}
function declaredClasses(noComments: string): Set<string> {
  const out = new Set<string>();
  // A class that ENDS a selector — followed, after optional whitespace, by `{`, `,` or a pseudo —
  // whether it stands alone (`.eye {`) or is the last step of a compound (`.myCard .eye {`). The
  // second form is the trap the kit's docblock names: a caller reaching into a kit class from its
  // own stylesheet. A class that only qualifies a descendant (`.tableAsCards .cardPhoneLine` says
  // nothing about `.tableAsCards`) is not a declaration of it.
  const re = /\.([A-Za-z_][\w-]*)\s*[{,:]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments))) out.add(m[1]);
  return out;
}

describe('coach kit guard — the dashboard card, the list toolbar, the rail and the phone line have one home', () => {
  const kitDeclared = declaredClasses(stripped(KIT_FILE));

  it('the kit declares every selector it is the home for (a rename inside the kit fails here)', () => {
    const missing = KIT_MUST_DECLARE.filter(c => !kitDeclared.has(c));
    assert.deepEqual(missing, [], `CoachKit.module.css no longer declares: ${missing.join(', ')}`);
  });

  it('no coach stylesheet outside the kit declares a kit shape', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(join(ROOT, root))) {
        const rel = relative(ROOT, file).split(sep).join('/');
        if (rel === KIT_FILE.split(sep).join('/')) continue;
        const declared = declaredClasses(stripped(rel));
        for (const sel of KIT_SELECTORS) {
          if (declared.has(sel)) offenders.push(`${rel} declares .${sel}`);
        }
        /* The dashboard card's signature is the PAIR — an eyebrow with a figure under it. Either
           name alone is ordinary (`MetricDefinitionSheet` has a `.big` preview figure that is not
           a card); both together is a copied dashboard card. */
        if (declared.has('eye') && declared.has('big')) offenders.push(`${rel} declares .eye + .big (a dashboard card)`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `A kit shape is declared outside the kit — render the kit instead, or take the exception to the owner and edit KIT_SELECTORS in the same commit:\n  ${offenders.join('\n  ')}`,
    );
  });

  it('the shared phone-line family lives in coaches.module.css, once, beside .tableAsCards', () => {
    const css = stripped(SHARED_FAMILY_HOME);
    for (const cls of SHARED_FAMILY) {
      assert.ok(new RegExp(`\\.${cls}\\b`).test(css), `coaches.module.css no longer carries .${cls}`);
    }
  });
});
