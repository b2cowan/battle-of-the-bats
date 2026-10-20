import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, filesUnder, openingTags, parseProps, readCode, splitPhoneCss, stripComments, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE WINDOW · STAGE 2 — ONE BEHAVIOUR (owner rulings Q7–Q10, 2026-10-18, and the Stage 2 answers A–D,
 * 2026-10-19: A the ask is built into the one window and turned on in the coach windows, admin forms in a
 * last part; B a tap outside a form does nothing, typed or not; C the hand-built coach windows move in this
 * stage; D the two real questions become the small question). Plan: `docs/projects/active/ONE_WINDOW_PLAN.md`.
 *
 *   2a  `KitDialog` is the one window for both portals (its "admin only" convention ends here). The coach form
 *       shell (`QuestionShell`) is a thin wrapper over it. Closing with words typed asks in the window's foot;
 *       every way out shares one closer. One page-scroll lock. The save pill still rises over a coach window.
 *       Inside a coach window, fields are 36px on a computer and fields and foot buttons 44px on a phone.
 *   2b  Every coach window's buttons are the window's own foot (`footer` / `footerStart`, a submit naming its form
 *       with `form=`), never a `.modalFooter` in its body; the 2a shim and the no-op `scroll` prop are gone; a
 *       refused save's reason shows in the foot (`QuestionReason`); the phone's save pill rides the measured foot.
 *   2c  The hand-built coach windows with no Tab trap or phone Back move onto the shell, most dangerous first; the
 *       eight that never asked ask as they move (B3), the small cards that are not questions fill a phone (B5).
 *   2d  The rest of the hand-built coach windows (they had the floor already) move onto the shell: the money windows
 *       that asked in a second window ask in their own foot (B1), the read windows fill a phone, the practice page last.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const KIT = 'components/admin/kit/club/KitDialog.tsx';
const kitSource = readSource(KIT);
const kit = stripComments(kitSource);
const kitCss = readCode('components/admin/kit/club/KitDialog.module.css');
const shell = readCode('components/coaches/QuestionShell.tsx');
const coachesCss = readCode('app/[orgSlug]/coaches/coaches.module.css');
const zOf = (selector: string): number => {
  const z = /z-index:\s*(\d+)/.exec(cssRule(kitCss, selector))?.[1];
  assert.ok(z, `${selector} has no z-index in KitDialog.module.css`);
  return Number(z);
};

/** Every .tsx under components/ and app/, read ONCE for the whole file (three checks scan the tree). A file whose raw
 *  text lacks a marker cannot have it in its code either, so comments are stripped only where a check needs them. */
const TSX = [...filesUnder('components', '.tsx'), ...filesUnder('app', '.tsx')].map(file => ({ file, raw: readSource(file) }));
const codeOf = new Map<string, string>();
const tsxWith = (...markers: string[]) => TSX
  .filter(({ raw }) => markers.every(m => raw.includes(m)))
  .map(({ file, raw }) => {
    if (!codeOf.has(file)) codeOf.set(file, stripComments(raw));
    return { file, code: codeOf.get(file)! };
  })
  .filter(({ code }) => markers.every(m => code.includes(m)));

describe('2a · the one window is both portals\' window', () => {
  it('its "admin only" convention has ended, and it says so', () => {
    assert.doesNotMatch(kitSource, /Admin only: nothing outside the admin shell mounts it/);
    assert.match(kitSource, /ONE WINDOW FOR BOTH PORTALS/);
  });

  it('the coach form shell renders the one window, and draws no overlay of its own', () => {
    assert.match(shell, /import KitDialog, \{ DialogCancel, DialogReason \} from '@\/components\/admin\/kit\/club\/KitDialog';/);
    // A form by default; the coach "are you sure" is the same shell's `kind="question"` (2c, answer D).
    assert.match(shell, /kind = 'form',/);
    assert.match(shell, /<KitDialog\s+kind=\{kind\}/);
    assert.doesNotMatch(shell, /modalOverlay|useDialogFloor|useOverlayOpen|CoachModalHeader|RAISED_OVERLAY_Z/,
      'the overlay, the floor, the counter and the head are the one window\'s now');
    // It keeps the route guard armed while its form is hidden on another tab (the hub keeps panels mounted).
    assert.match(shell, /if \(!open\) return guard;/);
    // The coach rules for a window: no phone keyboard on open, the forms' own type, and the asks pass through.
    for (const prop of [/openOn="panel"/, /\n\s+ownType\n/, /dirty=\{isForm && dirty\}/, /raised=\{raised\}/, /size=\{!isForm \? undefined : widest \? 'wide' : wide \? 'medium' : undefined\}/,
      /footer=\{footer\}/, /footerStart=\{footerStart\}/]) {
      assert.match(shell, prop);
    }
  });
});

describe('2a · closing with words typed asks in the foot (Q7, answers A and B)', () => {
  it('a tap outside a form does nothing; outside a question it is the "no"', () => {
    assert.match(kit, /onPointerDown=\{e => \{\s*(\/\/[^\n]*\n\s*)?if \(kind === 'question' && e\.target === e\.currentTarget && !busy\) requestClose\(\);\s*\}\}/);
  });

  it('×, ←, Cancel and the floor\'s Escape and Back share the one closer', () => {
    assert.match(kit, /className=\{styles\.close\} onClick=\{requestClose\}/, '×');
    assert.match(kit, /className=\{styles\.back\} onClick=\{back \? back\.onBack : requestClose\}/, '← (a level goes up first)');
    assert.match(kit, /useDialogFloor\(true, panelRef, \{ onClose: requestClose,/, 'Escape and the phone\'s Back');
    assert.match(kit, /onClick=\{close\?\.requestClose\} disabled=\{close\?\.busy\}/, 'DialogCancel');
    assert.equal((kit.match(/\bonClose\(\)/g) ?? []).length, 1, 'only the closer itself calls onClose (Discard passes it)');
  });

  it('the closer: busy holds, the same way out again is Keep writing, typed asks, nothing typed closes', () => {
    const body = /const requestClose = \(\) => \{([\s\S]*?)\n\s*\};/.exec(kit)?.[1];
    assert.ok(body, 'KitDialog has a `const requestClose = () => { … };`');
    const order = ['if (busy) return;', 'if (asking) { keepWriting(); return; }', 'if (dirty) {', 'setAsking(true);', 'onClose();'];
    let at = -1;
    for (const step of order) {
      const i = body.indexOf(step);
      assert.ok(i > at, `requestClose: "${step}" in order`);
      at = i;
    }
  });

  it('the ask is the window\'s own foot, in the drawn words, never a second window', () => {
    const words = readCode('lib/window-words.ts');
    assert.match(words, /sentence: 'Close without saving\? What you typed won’t be kept\.'/);
    assert.match(words, /keep: 'Keep writing'/);
    assert.match(words, /discard: 'Discard'/);
    assert.match(kit, /import \{ WINDOW_ASK \} from '@\/lib\/window-words';/);
    assert.match(kit, /const footStart = asking \? <p className=\{styles\.ask\} role="alert">\{discardAsk \?\? WINDOW_ASK\.sentence\}<\/p> : footerStart;/);
    assert.match(kit, /\{\(hasFoot \|\| asking\) && \(/, 'a window whose buttons are in its body grows a foot while it asks');
    assert.doesNotMatch(kit, /alertdialog|useConfirm|FeedbackModal/);
  });

  it('the ask stands down when nothing is left to lose or a save starts, and never closes a window mid-write (/review)', () => {
    assert.match(kit, /if \(asking && \(busy \|\| !dirty\)\) setAsking\(false\);/);
    assert.match(kit, /onClick=\{keepWriting\} disabled=\{busy\}/);
    // Discard is the red-tinted danger button, Keep writing the quiet outline (owner 2026-10-19: two outlines went unnoticed).
    assert.match(kit, /className="btn btn-danger" onClick=\{onClose\} disabled=\{busy\}>\{WINDOW_ASK\.discard\}/);
    assert.match(kit, /className="btn btn-outline" onClick=\{keepWriting\} disabled=\{busy\}>\{WINDOW_ASK\.keep\}/);
  });

  it('a window nested inside another owns its keys: one Escape never reaches the window behind it (/review)', () => {
    const floor = readCode('components/coaches/useDialogFloor.ts');
    assert.match(floor, /const nearest = target\.closest\('\[role="dialog"\]\[aria-modal="true"\]'\);\s*if \(nearest && nearest !== panel && panel\.contains\(nearest\)\) return;/);
  });

  it('Message a family asks through it, in its own sentence, with no ask of its own', () => {
    const win = readCode('components/admin/kit/club/families/MessageFamilyWindow.tsx');
    assert.match(win, /dirty=\{typed\}/);
    assert.match(win, /discardAsk=\{W\.discardAsk\}/);
    assert.match(win, /<DialogCancel>\{W\.cancel\}<\/DialogCancel>/);
    assert.doesNotMatch(win, /setAsking|const \[asking/);
  });

  it('a shell window never passes a second-window guard as its closer', () => {
    const offenders: string[] = [];
    for (const { file, code: src } of tsxWith('<QuestionShell')) {
      const guarded = [...src.matchAll(/const (\w+) = useDiscardGuard\(/g)].map(m => m[1]);
      for (const tag of openingTags(src, 'QuestionShell', file)) {
        const onClose = parseProps(tag).get('onClose') ?? '';
        if (guarded.some(name => new RegExp(`\\b${name}\\b`).test(onClose))) offenders.push(file);
      }
    }
    assert.deepEqual(offenders, [], 'pass `dirty` to the shell instead');
  });

  it('call B2: the five shell windows that held typed words and never asked, ask (owner 2026-10-19)', () => {
    const T = 'app/[orgSlug]/coaches/teams/[teamId]';
    const asks: Array<[string, RegExp]> = [
      ['components/coaches/ClubReviewCard.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{typed\}/],
      [`${T}/accounting/PayeesWindow.tsx`, /title="New payee" dirty=\{!!name\.trim\(\)\}/],
      [`${T}/accounting/InstallmentScopeSheet.tsx`, /onClose=\{onClose\}\s*dirty=\{dirty\}/],
      ['components/coaches/SessionSheet.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{dirty\}/],
      ['app/[orgSlug]/coaches/link-org/page.tsx', /dirty=\{typed\.trim\(\) !== ''\}/],
    ];
    for (const [file, re] of asks) assert.match(readCode(file), re, file);
  });
});

describe('2a · one page lock, and the layers', () => {
  it('inside the coaches portal the one window locks the page through the portal\'s counter only', () => {
    assert.match(kit, /const inCoachPortal = useOverlayOpenIfAvailable\(true\);/);
    assert.match(kit, /if \(inCoachPortal\) return;\s*lockPageScroll\(\);\s*return unlockPageScroll;/);
    assert.match(readCode('lib/coaches-overlay.tsx'), /export function useOverlayOpenIfAvailable\(open: boolean\): boolean \{[\s\S]*?return ctx !== null;\s*\}/);
  });

  it('it says which portal it stands in, and what kind it is, for the coach rules below', () => {
    assert.match(kit, /data-kind=\{kind\}/);
    assert.match(kit, /data-coach-window=\{inCoachPortal \|\| undefined\}/);
    assert.match(kit, /data-asking=\{asking \|\| undefined\}/);
  });

  it('the save pill still rises over a coach window, at every width', () => {
    const form = zOf('.overlay');
    const raised = zOf('.overlayRaised');
    assert.equal(form, 400);
    // On a phone the coach window has its own §227 rule beside `.modalOverlay`'s, riding its measured foot (2b).
    const phone = /body:has\(\[data-kit-dialog\]\[data-coach-window\]\[data-kind="form"\]\) \.savePill \{\s*z-index: (\d+);/.exec(splitPhoneCss(coachesCss).phone);
    const wider = /@media \(min-width: 641px\) \{\s*body:has\(\[data-coach-window\]\) \.savePill \{ z-index: (\d+); \}/.exec(coachesCss);
    assert.ok(phone && Number(phone[1]) > raised, 'over a full-screen coach form on a phone');
    assert.ok(wider && Number(wider[1]) > raised, 'over any coach window above a phone (it stood at 200 there before)');
  });

  it('one order of layers: window 400 < raised room 401 < raised window 405 < question 410', () => {
    const room = Number(/export const RAISED_OVERLAY_Z = (\d+);/.exec(readCode('components/coaches/overlayLayers.ts'))?.[1]);
    const [form, raised, question] = ['.overlay', '.overlayRaised', '.overlayQuestion'].map(zOf);
    assert.ok(form < room && room < raised && raised < question, `${form} < ${room} < ${raised} < ${question}`);
  });

  it('a window reads left to right wherever it is mounted (a money cell is right-aligned and does not wrap)', () => {
    const panel = cssRule(kitCss, '.panel');
    assert.match(panel, /text-align: left;/);
    assert.match(panel, /white-space: normal;/);
  });
});

describe('2a · Q2 and Q10 inside a coach window', () => {
  const css = coachesCss;
  // The two-line dropdown (Give an award's "For", `.convWhatField`) is a one-line field here too, as a FLOOR (owner
  // 2026-10-19: it was 35px on a phone).
  it('its one-line fields are 36px on a computer', () => {
    // Keyed on the ELEMENT, as the phone rule is (owner 2026-10-20): a module's own copy of the field look (the tryout
    // windows, the budget line, the item picker) is still a field in a window. Real fields only — a read-only value drawn
    // as a field (`<span class="input">`) keeps its height (/review) — and a review table's cell keeps its compact size.
    assert.match(css, /@media \(min-width: 769px\) \{\s*\.windowBody input:not\(\[type="checkbox"\]\)[^{]*:not\(td \*\):not\(\[data-search-field\] \*\),\s*\.windowBody select:not\(td \*\) \{ height: 36px; \}\s*\.windowBody \.convWhatField \{ min-height: 36px; \}\s*\}/);
    assert.doesNotMatch(css, /\.windowBody :is\(input, select\):is\(\.input, \.select\)/, 'the class-keyed rule missed every module copy of the field');
    for (const css2 of ['TryoutDayCard', 'TryoutCheckIn', 'TryoutRubricCard']) {
      assert.doesNotMatch(readSource(`components/rep-teams/${css2}.module.css`), /\[data-coach-window\][^{]*height: 36px/, `${css2}: one rule, in the portal's window body`);
    }
  });
  it('on a phone, its one-line fields are 44px, and the window\'s own foot buttons are 44px', () => {
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.windowBody input:not\(\[type="checkbox"\]\)[^{]*\.windowBody select,\s*\.windowBody \.convWhatField \{ min-height: var\(--tap-min, 44px\); \}/);
    assert.match(kitCss, /@media \(max-width: 768px\) \{\s*\.foot button,\s*\.foot a,/);
  });
  it('a global .btn inside a coach window wears the portal\'s button face, as the admin\'s does', () => {
    const globals = readCode('app/globals.css');
    assert.match(globals, /\[data-admin-kit\] \.btn:where\(:not\(\[data-public-preview\] \*\)\),\s*\[data-coach-window\] \.btn \{\s*font-family: var\(--font-sans/);
  });
  it('the shell wraps its form in the coach window\'s body', () => {
    assert.match(shell, /<div className=\{coach\.windowBody\}>\{children\}<\/div>/);
  });
});

describe('2b · a coach window\'s buttons are the window\'s own foot', () => {
  /** Every `<QuestionShell …>…</QuestionShell>` in a file: the element from its opening tag to its close. */
  const shellElements = (code: string): string[] => {
    const out: string[] = [];
    for (let at = code.indexOf('<QuestionShell'); at >= 0; at = code.indexOf('<QuestionShell', at + 1)) {
      const end = code.indexOf('</QuestionShell>', at);
      out.push(code.slice(at, end < 0 ? undefined : end));
    }
    return out;
  };

  it('no shell window draws its own foot strip: its buttons are `footer`, a door or a sentence `footerStart`', () => {
    // ⚖ The 2a SHIM list emptied here (2026-10-19): 24 files, 34 windows. A `.modalFooter` elsewhere in the same file is
    // a hand-built window still to move (2c / 2d, the ALLOWED list below), not a shell window's foot.
    const offenders = tsxWith('<QuestionShell', 'modalFooter')
      .filter(({ code }) => shellElements(code).some(el => /modalFooter/.test(el)))
      .map(({ file }) => file);
    assert.deepEqual(offenders, [], 'a shell window puts its buttons in the window\'s foot (`footer`), never a .modalFooter');
    // The scanner sees one when it is there.
    assert.equal(shellElements('<QuestionShell open>\n<div className={styles.modalFooter}>x</div>\n</QuestionShell>').some(el => /modalFooter/.test(el)), true);
  });

  it('the shim is gone from the coach stylesheet', () => {
    assert.doesNotMatch(coachesCss, /\.windowBody \.modalFooter|\.windowBody > :has\(> \.modalFooter\)|\.windowBody :is\([^)]*\) \{ scroll-margin-bottom/);
    assert.doesNotMatch(coachesCss, /--kit-dialog-side/, 'the shim\'s side shadows read the window\'s padding');
  });

  it('a submit in the foot names its form, and the form carries that id', () => {
    let submits = 0;
    for (const { file, code } of tsxWith('<QuestionShell', 'type="submit"')) {
      for (const tag of openingTags(code, 'QuestionShell', file)) {
        for (const m of tag.matchAll(/<button\b[^>]*?type="submit"[^>]*?>/g)) {
          submits++;
          const form = /\sform="([\w-]+)"/.exec(m[0])?.[1];
          assert.ok(form, `${file}: a submit in a window's foot is outside its form — give it form="…"`);
          assert.match(code, new RegExp(`<form id="${form}"`), `${file}: no <form id="${form}">`);
        }
      }
    }
    assert.ok(submits >= 12, `only ${submits} submits found in shell feet — the scan has stopped reading them`);
  });

  it('the no-op `scroll` prop is gone, from the shell and from every caller', () => {
    assert.doesNotMatch(shell, /\bscroll\?: boolean/);
    const callers = tsxWith('<QuestionShell')
      .filter(({ file, code }) => openingTags(code, 'QuestionShell', file).some(tag => parseProps(tag).has('scroll')))
      .map(({ file }) => file);
    assert.deepEqual(callers, []);
  });

  it('a refused save\'s reason shows in the foot beside the button (KitDialog\'s slot), at any scroll — ONE line, both portals', () => {
    assert.match(shell, /export \{ DialogReason as QuestionReason \};/);
    assert.match(kit, /export function DialogReason\(/);
    assert.match(kit, /if \(!inPlace && reason\?\.slot\) return createPortal\(<p className=\{className\} role="alert">\{icon\}\{children\}<\/p>, reason\.slot\);/);
    assert.match(kit, /useLayoutEffect\(\(\) => \{ if \(text && !inPlace\) reveal\?\.\(\); \}, \[text, inPlace, reveal\]\);/, 'a reason written into a quiet slot is shown and announced');
    // The club money kit's refusal is the same line in its own type (/simplify 2026-10-19: it was a second copy).
    const money = readCode('components/admin/kit/club/money/MoneyKit.tsx');
    assert.match(money, /export function FormError\([^)]*\) \{\s*return \(\s*<DialogReason className=\{repKit\.formError\} inPlace=\{inPlace\}/);
    assert.doesNotMatch(money, /useContext\(KitReasonSlot\)|createPortal/);
  });

  it('on a phone the save pill rides the top coach window\'s measured foot (the ask and a reason make it taller)', () => {
    // The window reports its foot (any caller may ask); the coach shell keeps the stack and publishes the top one.
    assert.match(kit, /const watch = new ResizeObserver\(\(\[entry\]\) => onFootHeight\(/);
    assert.match(kit, /<div ref=\{setFootEl\} className=\{styles\.foot\}/);
    assert.doesNotMatch(kit, /--coach-window-foot/, 'the shared window knows nothing of the coach page\'s pill');
    assert.match(shell, /onFootHeight=\{isForm \? onFootHeight : undefined\}/);
    assert.match(shell, /if \(value === publishedFoot\) return;/, 'the root is restyled only when the height changes');
    assert.match(shell, /if \(openFeet\[openFeet\.length - 1\] === foot\.current\) publishFoot\(\);/, 'only the top window publishes');
    // Three marks in its `:has()`, the weight of the `.modalOverlay` rule (a class and two :not()s), and AFTER it — so a
    // coach window over a room still rides its own foot (/review 2026-10-19).
    const phone = splitPhoneCss(coachesCss).phone;
    const measured = phone.indexOf('body:has([data-kit-dialog][data-coach-window][data-kind="form"]) .savePill {');
    const overlay = phone.indexOf('body:has(.modalOverlay:not(.daySheetOverlay):not(.centeredOnMobile)) .savePill {');
    assert.ok(overlay >= 0 && measured > overlay, 'the measured rule comes after the room\'s, at the same weight');
    assert.match(coachesCss, /body:has\(\[data-kit-dialog\]\[data-coach-window\]\[data-kind="form"\]\) \.savePill \{\s*z-index: 410;\s*bottom: calc\(var\(--coach-window-foot,/);
    // A window with no foot publishes nothing: the pill keeps its resting height instead of covering the body (/review).
    assert.match(shell, /const value = top\?\.height \? `\$\{top\.height\}px` : '';/);
    // A change inside a window nested in another's body quiets only its own reason, not the outer one's (/review).
    assert.match(kit, /const ownChange = \(target: EventTarget\) => target instanceof Element && target\.closest\('\[data-kit-dialog\]'\) === panelRef\.current;/);
    assert.equal((kit.match(/if \(ownChange\(e\.target\)/g) ?? []).length, 3);
  });
});

describe('2c · the hand-built windows with no Tab trap or phone Back move onto the one window', () => {
  it('call B3: the hand-built windows that never asked, ask as they move (owner 2026-10-19)', () => {
    const asks: Array<[string, RegExp]> = [
      ['components/coaches/RosterBulkAddSheet.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{dirty\}/],
      ['components/coaches/GiveAwardModal.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{dirty\}/],
      ['components/coaches/StartNextSeasonModal.tsx', /<QuestionShell open onClose=\{summary \? onDone : onClose\} dirty=\{dirty\}/],
      // Part 3: a chosen file is the typed work.
      ['components/coaches/PlayerDocumentsSection.tsx', /<QuestionShell open=\{uploadOpen\} onClose=\{closeUpload\} dirty=\{uploadFile != null\} busy=\{uploading\}/],
    ];
    for (const [file, re] of asks) {
      const code = readCode(file);
      assert.match(code, re, file);
      assert.doesNotMatch(code, /modalOverlay|useOverlayOpen|CoachModalHeader|addEventListener\('keydown'/, `${file}: the one window owns the overlay, the floor and the head`);
    }
  });

  it('Choose an icon moved with Give an award, which it opens over (a window left on the old layer opens under it)', () => {
    const code = readCode('components/coaches/AwardIconPicker.tsx');
    assert.match(code, /<QuestionShell open onClose=\{onClose\} ariaLabel="Choose an icon" title="Choose an icon">/);
    assert.doesNotMatch(code, /modalOverlay|useOverlayOpen/);
    // The picker's windows open AFTER the award window, as siblings, so they stand over it at the same layer.
    assert.match(readCode('components/coaches/GiveAwardModal.tsx'), /<\/QuestionShell>\s*\{picker\.overlays\}/);
  });

  it('B5: Export is a form that fills a phone, closed by the window and never while a file is being built', () => {
    const code = readCode('components/coaches/CoachExportButton.tsx');
    assert.match(code, /<QuestionShell open onClose=\{onClose\} busy=\{busy !== null\} ariaLabel=\{`Export \$\{label\}`\} title=\{`Export \$\{label\}`\}>/);
    // Not a question: no `kind`, and no screen-own narrowing (the ladder's 520 on a computer).
    assert.doesNotMatch(code, /kind="question"|modalOverlay|centeredOnMobile|useOverlayOpen|addEventListener\('keydown'/);
    assert.doesNotMatch(readSource('components/coaches/CoachExportButton.module.css'), /\.dialog\s*\{/);
  });

  it('call B1: the windows that asked in a second window ask in their own foot, in the one sentence (part 4)', () => {
    const T = 'app/[orgSlug]/coaches/teams/[teamId]';
    const asks: Array<[string, RegExp]> = [
      [`${T}/roster/page.tsx`, /<QuestionShell open=\{addOpen\} onClose=\{closeAdd\} dirty=\{addDirty\} busy=\{adding\}/],
      [`${T}/accounting/budget/panel.tsx`, /<QuestionShell open=\{modalOpen && tabActive\} onClose=\{\(\) => setModalOpen\(false\)\} dirty=\{lineDirty\} busy=\{saving\} wide\b/],
      ['components/coaches/ScheduleImportSheet.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{dirty\} busy=\{busy\} widest\b/],
      ['components/coaches/BudgetImportSheet.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{dirty\} busy=\{busy\} widest\b/],
      ['components/coaches/BudgetStarterSheet.tsx', /<QuestionShell open onClose=\{onClose\} dirty=\{dirty\} busy=\{saving\}/],
    ];
    for (const [file, re] of asks) {
      const code = readCode(file);
      assert.match(code, re, file);
      assert.doesNotMatch(code, /useDiscardGuard|useOverlayOpen|CoachModalHeader|modalOverlay|modalFooter|confirm\(\{\s*title: 'Discard/, `${file}: the window asks; no second window`);
    }
    // Add a player keeps its route guard (a link, a reload) beside the window's own ask.
    assert.match(readCode(`${T}/roster/page.tsx`), /<UnsavedChangesGuard active=\{addDirty\} \/>/);
    // A month-grid link that arrives over a dirty budget line is dropped, never asked about in a second window.
    assert.match(readCode(`${T}/accounting/budget/panel.tsx`), /if \(lineDirtyNow\.current\) return;\s*setEditingLine\(line\);/);
  });

  it('answer D: Close the season and Delete a budget line are the one window\'s small centred question', () => {
    // The shell passes the kind through; a question carries none of a form's things (no ×, no ask, no pill foot).
    // (2d part 6: a level may be named, `backLabel` — the save-over question's "‹ Save to my drills".)
    assert.match(shell, /back=\{isForm && onBack \? \{ onBack, label: backLabel \} : undefined\}/);
    assert.match(shell, /dirty=\{isForm && dirty\}/);
    assert.match(shell, /onFootHeight=\{isForm \? onFootHeight : undefined\}/);
    assert.match(shell, /if \(!open \|\| !isForm\) return;/, 'a question never goes on the page pill\'s foot stack');
    const close = readCode('components/coaches/CloseSeasonModal.tsx');
    assert.match(close, /<QuestionShell kind="question" open onClose=\{onClose\} busy=\{submitting\}/);
    assert.doesNotMatch(close, /modalOverlay|useOverlayOpen|addEventListener\('keydown'|useRouter|router\.push/);
    // Its way to Money is a LINK that closes the window as it is clicked: a button that closed and then pushed had
    // its navigation cancelled by the window's Back step (useBackStep's header).
    assert.match(close, /<Link\s+href=\{`\/\$\{orgSlug\}\/coaches\/teams\/\$\{teamId\}\/accounting`\}[\s\S]*?onClose\(\); \}\}/);
    const budget = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx');
    assert.match(budget, /<QuestionShell kind="question" open onClose=\{closeDelete\} busy=\{deleting\}\s+ariaLabel="Delete Budget Line\?"/);
  });

  it('B9: the list pickers are forms that fill a phone, hold while they write, and never ask (part 5)', () => {
    const pickers: Array<[string, RegExp]> = [
      // One piece serves the drill, plan-template and circuit libraries; Done is the window's own closer.
      ['components/coaches/PastSeasonImport.tsx', /<QuestionShell\s+open=\{state\.open\}\s+onClose=\{state\.close\}[\s\S]*?busy=\{state\.importingKey !== null\}\s+footer=\{<QuestionCancel className=\{styles\.btnPrimary\}>Done<\/QuestionCancel>\}/],
      ['app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupTemplatesView.tsx', /<QuestionShell\s+open=\{!!applyTemplate\}\s+onClose=\{\(\) => setApplyTemplate\(null\)\}[\s\S]*?busy=\{!!applyBusyGameId\}\s*>/],
    ];
    for (const [file, re] of pickers) {
      const code = readCode(file);
      assert.match(code, re, file);
      // A picker writes on each tap: nothing typed, so no ask; not a question, so it fills a phone.
      assert.doesNotMatch(code, /\bdirty=\{|kind="question"/, `${file}: a list picker neither asks nor is a question`);
      assert.doesNotMatch(code, /modalOverlay|useOverlayOpen|CoachModalHeader|modalCloseBtn/, `${file}: the one window owns the overlay, the floor and the head`);
    }
  });

  it('the tryout windows: four forms ask in their own foot, and Which session is the small centred question (part 6)', () => {
    const R = 'components/rep-teams';
    const forms: Array<[string, RegExp]> = [
      [`${R}/TryoutDayCard.tsx`, /<QuestionShell open=\{modalOpen\} onClose=\{\(\) => setModalOpen\(false\)\} dirty=\{formDirty\} busy=\{saving\}/],
      // The minted link is a done-screen: it closes silently (the ask is the typed name's only).
      [`${R}/TryoutEvaluatorsCard.tsx`, /<QuestionShell open=\{open\} onClose=\{\(\) => setOpen\(false\)\} dirty=\{nameDirty\} busy=\{saving\}/],
      // The fields beside the helpers' preview: the ladder's widest; the running total is the foot's sentence.
      [`${R}/TryoutRubricCard.tsx`, /<QuestionShell open=\{open\} onClose=\{\(\) => setOpen\(false\)\} dirty=\{builderDirty\} busy=\{saving\} widest\s+ariaLabel="Evaluation scorecard"[\s\S]*?footerStart=\{footSummary\}/],
      [`${R}/TryoutCheckIn.tsx`, /<QuestionShell open=\{walkupOpen\} onClose=\{\(\) => setWalkupOpen\(false\)\} dirty=\{walkupDirty\} busy=\{savingWalkup\}/],
    ];
    for (const [file, re] of forms) {
      const code = readCode(file);
      assert.match(code, re, file);
      assert.doesNotMatch(code, /useDiscardGuard\(|useOverlayOpen|styles\.scrim|styles\.modal\b|modalActions/, `${file}: the window asks and owns its overlay; no second window, no hand-built card`);
    }
    assert.match(readCode(`${R}/TryoutEvaluatorsCard.tsx`), /const nameDirty = !freshLink && name\.trim\(\)\.length > 0;/);
    assert.match(readCode(`${R}/TryoutCheckIn.tsx`), /<QuestionShell kind="question" open=\{sessionChoices !== null\} onClose=\{\(\) => setSessionChoices\(null\)\}/);
    // The tryout stylesheets keep no window shape of their own: a `.scrim` card can no longer drift back unnoticed (the
    // still-to-move scan below keys on `.modalOverlay`; the tryouts built theirs from these).
    for (const css of ['TryoutDayCard', 'TryoutCheckIn', 'TryoutRubricCard']) {
      assert.doesNotMatch(readSource(`${R}/${css}.module.css`), /^\s*\.(scrim|modal|modalActions)\s*[{,:]/m, `${css}.module.css: a hand-built window shape is back`);
    }
    const scrims = tsxWith('scrim').filter(({ file }) => file.startsWith(`${R}/`)).filter(({ code }) => /className=\{[^}]*\.scrim\b/.test(code)).map(({ file }) => file);
    assert.deepEqual(scrims, [], 'a tryout window is QuestionShell: the one window with the coach rules');
  });

  it('B6 + B9: the read and manage windows — Categories & items asks only while a name is typed (part 7)', () => {
    const manager = readCode('components/coaches/BudgetItemManagerModal.tsx');
    // It holds while anything writes (a rename or a remove too, /review 2026-10-20), and its two screens are levels: the
    // fold starts at its top with the keyboard kept in the window.
    assert.match(manager, /<QuestionShell\s+open\s+onClose=\{onClose\}\s+onBack=\{onBack\}[\s\S]*?dirty=\{typing\}\s+busy=\{foldBusy \|\| addBusy \|\| busyId !== null\}\s+levelKey=\{folding \? 'fold' : 'list'\}/);
    assert.match(shell, /levelKey=\{levelKey\}/);
    // The ask is a NAME being typed (a new item, a new category while "New category" is chosen, a rename that differs from
    // a name still on the list) — never a tick, a filter or a search.
    assert.match(manager, /const typing = \(adding !== null && \(addName\.trim\(\) !== '' \|\| \(addCatId === NEW_CATEGORY && addNewCat\.trim\(\) !== ''\)\)\)\s*\|\| \(renamingId !== null && renamed\(/);
    assert.match(manager, /const renamed = \(draft: string, name: string \| undefined\) => name !== undefined && draft\.trim\(\) !== name;/);
    // Escape in a rename, or anywhere in the add form (its two fields and its category list), cancels that edit and
    // leaves the window open.
    assert.match(manager, /<input[\s\S]*?if \(e\.key === 'Escape'\) \{ claimEscape\(e\); onCancel\(\); \}/);
    assert.match(manager, /<div className=\{styles\.managerAddForm\} onKeyDown=\{e => \{ if \(e\.key === 'Escape'\) \{ claimEscape\(e\); setAdding\(null\); \} \}\}>/);
    // The fold screen is a level over the list; its door is the foot's door, Done the window's own closer.
    assert.match(manager, /onBack: leaveFold,/);
    assert.match(manager, /footerStart: ours\.length > 0 && theirs\.length > 0 \?/);
    assert.match(manager, /footer: <QuestionCancel className=\{styles\.btnGhost\}>Done<\/QuestionCancel>/);
    // Nothing typed in the two read windows: they never ask, and neither is a question (they fill a phone).
    const sample = readCode('components/coaches/SampleBudgetSheet.tsx');
    assert.match(sample, /<QuestionShell\s+open\s+onClose=\{onClose\}\s+ariaLabel="Sample season budget"[\s\S]*?footer=\{<QuestionCancel className=\{shared\.btnGhost\}>Close<\/QuestionCancel>\}/);
    const imports = readCode('components/coaches/MoneyImportMenu.tsx');
    assert.match(imports, /<QuestionShell open onClose=\{onClose\} ariaLabel="Recent imports" title="Recent imports">/);
    for (const [file, code] of [['BudgetItemManagerModal', manager], ['SampleBudgetSheet', sample], ['MoneyImportMenu', imports]] as const) {
      assert.doesNotMatch(code, /modalOverlay|useOverlayOpen|CoachModalHeader|modalFooter|kind="question"/, `${file}: the one window owns the overlay, the floor, the head and the foot`);
    }
    assert.doesNotMatch(sample + imports, /\bdirty=\{/, 'a read window has nothing typed to ask about');
  });
});

describe('2d · the rest of the hand-built coach windows move onto the one window', () => {
  it('call B1: Record money / Add a bill asks in its own foot, stays portaled, and keeps its route guard (part 1)', () => {
    const code = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx');
    // A save or a delete in flight holds every way out; with something typed, every way out asks in the foot.
    assert.match(code, /<QuestionShell\s+open\s+onClose=\{dismissForm\}\s+dirty=\{formDirty\}\s+busy=\{saving \|\| deleting\}/);
    // ⚠ Still PORTALED into the warm root: the hub's Record button opens it while this panel may be hidden under
    // another tab, and the coach palette hangs off `[data-coach-warm-enabled]` (never <body> while a shell exists).
    assert.match(code, /createPortal\(\s*<QuestionShell[\s\S]*?<\/QuestionShell>,\s*document\.querySelector\('\[data-coach-warm-enabled\]'\) \?\? document\.body,/);
    assert.doesNotMatch(code, /useDiscardGuard\(|useOverlayOpen|useDialogFloor|CoachModalHeader|modalOverlay|modalFooter/,
      'the window asks and owns its overlay, floor and head; no second window');
    // The route guard (a link, a reload) stays beside the window's own ask.
    assert.match(code, /<UnsavedChangesGuard\s+active=\{formOpen && formDirty\}\s+interceptClicks=\{formOpen && formDirty && tabActive\}/);
    // The two delete confirms stay docked in the foot: whole at its left, the window's buttons gone while one shows.
    assert.match(code, /footerStart=\{confirmDelete \? \(/);
    assert.match(code, /footer=\{confirmDelete \? undefined : \(\s*<>\s*<QuestionCancel className=\{styles\.btnGhost\} \/>/);
    assert.equal((code.match(/role="alertdialog" aria-label="Confirm delete"/g) ?? []).length, 2);
    // …and the one window's foot takes a docked confirm across its whole row (RoomShell's doors-slot promise).
    assert.match(kitCss, /\.footStart:has\(> \[role="alertdialog"\]\) \{ flex: 1 1 100%; margin-right: 0; \}/);
    assert.match(kitCss, /\.footStart > \[role="alertdialog"\] \{ flex: 1 1 100%; margin: 0; \}/);
  });

  it('B1 + B3: the club request asks in its own foot; the "installment sent" window asks as it moves (part 2)', () => {
    const code = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx');
    // Open only while its tab shows (the hub keeps the panel mounted, hidden); the filing write holds it too.
    assert.match(code, /<QuestionShell\s+open=\{tabActive\}\s+onClose=\{closeForm\}\s+dirty=\{formDirty\}\s+busy=\{busy \|\| filingBusy\}/);
    // The Withdraw confirm stays docked in the foot, whole, with the window's buttons gone while it shows.
    assert.match(code, /footerStart=\{confirmWithdraw && editing \? \(\s*<div className=\{styles\.dangerConfirm\} role="alertdialog" aria-label="Confirm withdraw">/);
    assert.match(code, /footer=\{confirmWithdraw && editing \? undefined : \(/);
    // "We've sent it" stands over the bill's room and asks when the day, how or the reference moved off what it opened with.
    assert.match(code, /const dirty = sentOn !== today \|\| method !== '' \|\| reference !== '';/);
    assert.match(code, /<QuestionShell open onClose=\{onCancel\} dirty=\{dirty\} busy=\{busy\}/);
    assert.doesNotMatch(code, /useDiscardGuard|useOverlayOpen|useDialogFloor|CoachModalHeader|modalOverlay|modalFooter/,
      'both windows ask and own their overlay, floor and head; no second window');
    assert.match(code, /<UnsavedChangesGuard\s+active=\{showForm && formDirty\}/);
  });

  it('B1: Set dues for all players asks in its own foot, its levels are Back steps, and its links close it (part 3)', () => {
    const code = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/GenerateInstallmentsModal.tsx');
    // Open only while the caller's tab shows; held while the run writes; 620 → the ladder's 640.
    assert.match(code, /<QuestionShell\s+open=\{tabActive\}\s+onClose=\{onClose\}\s+onBack=\{onBack\}\s+levelKey=\{level\}\s+dirty=\{dirty\}\s+busy=\{generating\}\s+wide\b/);
    // The preview and the replace question are levels: the phone's ← and Back go up one, never out.
    assert.match(code, /const onBack = level === 'replace' \? leaveReplace : level === 'preview' \? \(\) => invalidatePreview\(\) : undefined;/);
    // The route guard rides with the window (a link, a reload), one door for both callers.
    assert.match(code, /leaveGuard=\{\{ message: "You haven't saved what you entered on this form\. Leave without saving it\?", tabActive \}\}/);
    // ⚠ Every link out closes the window as it leaves: the hub keeps hidden tabs mounted.
    const links = openingTags(code, 'Link');
    assert.ok(links.length >= 4, `expected the window's links, found ${links.length}`);
    for (const tag of links) assert.match(tag, /onClick=\{onClose\}/, `a link that does not close the window: ${tag}`);
    assert.doesNotMatch(code, /useDiscardGuard\(|useOverlayOpen|useDialogFloor|CoachModalHeader|modalOverlay|modalFooter|UnsavedChangesGuard/,
      'the window asks and owns its overlay, floor, head and foot; the route guard is the shell\'s');
    assert.doesNotMatch(code, /maxWidth: 620/);
  });

  it('the dues windows: the settlement (800) asks only over an unsaved hold-back, Set refund is the question over it, Send due reminders a small form, the letter a read window (part 4)', () => {
    const code = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx');
    // B9: the settlement moves as an 800 form; owner call 2 (2026-10-20): it asks only over a hold-back typed and not saved.
    assert.match(code, /<QuestionShell\s+open=\{tabActive\}\s+onClose=\{\(\) => setRefundOpen\(false\)\}\s+dirty=\{holdBackDirty\}\s+busy=\{payAllBusy\}\s+widest\b/);
    assert.match(code, /const holdBackDirty = holdBackEditing && !!settlement\s+&& holdBackInput !== \(settlement\.pot\.holdBack > 0 \? String\(settlement\.pot\.holdBack\) : ''\);/);
    // B9: Set refund is the one window's small question, on the question layer over the settlement.
    assert.match(code, /<QuestionShell kind="question" open=\{tabActive\} onClose=\{\(\) => setChoiceFor\(null\)\} busy=\{choiceSaving\}/);
    // Owner call 3: Send due reminders? is a small form (its letter opens over it), and nothing is typed in it.
    assert.match(code, /<QuestionShell open=\{tabActive\} onClose=\{\(\) => setConfirmRemindersOpen\(false\)\} busy=\{sendingReminders\}\s+ariaLabel="Send due reminders\?"/);
    // The player drawer stays out (Q15) and is now the panel's ONLY hand-built window; owner call 1: a receipt being
    // corrected counts as typing there (it closed with the drawer, and with its own Cancel, with nothing asking).
    assert.equal((code.match(/className=\{styles\.modalOverlay\}/g) ?? []).length, 1, 'only the player drawer builds a .modalOverlay window');
    assert.match(code, /const drawerFormDirty = scheduleDirty \|\| creditDirty \|\| payDirty;/);
    assert.match(code, /onClick=\{\(\) => \{ void cancelPayCorrection\(\); \}\}/);
    assert.doesNotMatch(code, /settlementPanelRef|choicePanelRef|confirmRemindersPanelRef|modalSettlement|settlementScroll/);
    // The settlement's window shape left the stylesheet; its content rules key on its own body, its inert Pay on its button.
    assert.doesNotMatch(coachesCss, /\.modalSettlement\b|\.settlementScroll\b|\.settlementSubtitle\b/);
    // ⚠ Keyed on the window: two classes alone lose to the Warm lime (two attributes, a class and an element) — measured.
    assert.match(coachesCss, /\[data-coach-window\] \.btnPrimary\.settlementPay:disabled \{/);
    // The letter: a read window that fills a phone, never asks, 600 → 640.
    const letter = readCode('components/coaches/DuesReminderPreviewModal.tsx');
    assert.match(letter, /<QuestionShell open onClose=\{onClose\} wide ariaLabel=\{title\} title=\{title\}>/);
    assert.doesNotMatch(letter, /\bdirty=|kind="question"|modalOverlay|useDialogFloor|maxWidth: 600/);
  });

  it('B5 + B6: the read windows — the month grid\'s two (both portals) and Subscribe at a desk — fill a phone and never ask (part 5)', () => {
    // KitDialog itself, not the coach shell: the month grid renders in the CLUB admin's Budget vs. Actual too, and the
    // Subscribe part is built for the club and the family view. The coach shell's own props for a coach window.
    const grid = readCode('components/coaches/MoneyMonthGrid.tsx');
    const tags = openingTags(grid, 'KitDialog', 'MoneyMonthGrid');
    assert.equal(tags.length, 2, 'the cell window and the plan window');
    for (const tag of tags) {
      assert.match(tag, /kind="form"/);
      assert.match(tag, /openOn="panel"/);
      assert.match(tag, /\bownType\b/);
      assert.doesNotMatch(tag, /\bdirty=|\bsize=/, 'a read window: nothing typed, the ladder\'s 520');
    }
    // ⚠ Shown only while the caller's tab is on screen: the cell window's doors navigate WITHOUT closing it (kept),
    // and the coach hub keeps the panel mounted, hidden — open there, the one window would hold the bars and the page.
    assert.match(grid, /\{detail && tabActive && \(\s*<KitDialog/);
    assert.match(grid, /\{plan && tabActive && \(\s*<KitDialog/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx'), /<MoneyMonthGrid[\s\S]*?tabActive=\{tabActive\}/);
    assert.doesNotMatch(grid, /modalOverlay|centeredOnMobile|useDialogFloor|maxWidth: 460/);
    const cal = readCode('components/coaches/CalendarSubscribeWindow.tsx');
    // At a desk: the context is the window's eyebrow, focus goes home to the door that opened it (a menu item is gone).
    assert.match(cal, /<KitDialog kind="form" eyebrow=\{context\} title=\{title\} onClose=\{onClose\} busy=\{resetting\} opener=\{opener\}\s+openOn="panel" ownType>/);
    assert.match(kit, /useDialogFloor\(true, panelRef, \{[^}]*\bopener \}\);/, 'the window hands its opener to the floor');
    // The phone keeps its sheet (Sheet Frame governs sheets; answer D: "opens on a computer only").
    assert.match(cal, /<SheetFrame onClose=\{onClose\} opener=\{opener\}/);
    assert.doesNotMatch(cal, /modalOverlay|useDialogFloor|useOverlayOpen|function DeskWindow/);
    assert.doesNotMatch(readSource('components/coaches/CalendarSubscribeWindow.module.css'), /^\s*\.(window|head|context)\b[^{]*\{/m, 'the desk window\'s own shape is gone');
  });

  it('the practice page, last: the drill sheet asks (B4), the two saves ask off their pre-fill (B3), the pickers and Send never ask (part 6)', () => {
    const P = 'app/[orgSlug]/coaches/teams/[teamId]/practice';
    const drill = readCode('components/coaches/DrillSheet.tsx');
    // B4: a form that asks — each caller's own measure; a locked (club or retired) drill has nothing to lose.
    assert.match(drill, /<QuestionShell open onClose=\{onClose\} dirty=\{dirty && !locked\} busy=\{busy\} wide\b/);
    assert.match(readCode(`${P}/_DrillsView.tsx`), /dirty=\{editing\.touched\}/);
    assert.match(readCode(`${P}/_PracticePlanEditor.tsx`), /dirty=\{!snapshotEqual\(openNewDrill, emptyDrillDraft\(\)\)\}/, 'the docked "+ New drill" asks too (it had no flag)');
    // The rare-door ruling: Retire / Restore ENDS THE BODY; the foot is "what saving reaches" + Cancel · Save.
    assert.match(drill, /footerStart=\{saveNote && !locked \? <p className=\{styles\.formHint\}>\{saveNote\}<\/p> : undefined\}/);
    assert.ok(drill.indexOf('ppSheetLifecycle') > drill.indexOf('<TeachingFields'), 'Retire / Restore comes after the fields');
    // B3: the two saves ask only once something moved off the pre-fill.
    const editor = readCode(`${P}/_PracticePlanEditor.tsx`);
    const page = readCode(`${P}/[eventId]/page.tsx`);
    assert.match(editor, /const dirty = name\.trim\(\) !== defaultName\.trim\(\) \|\| tagPick !== null \|\| picked\.size > 0;/);
    assert.match(page, /const dirty = name\.trim\(\) !== defaultName\.trim\(\);/);
    assert.match(page, /<form id="save-as-template"/);
    assert.equal((page.match(/type="submit" form="save-as-template"/g) ?? []).length, 2, 'Save template and Replace… name their form');
    // B9: the list pickers and Send to staff never ask (a pick writes; Send holds choices, nothing typed).
    const send = readCode(`${P}/_PracticeSendSheet.tsx`);
    assert.match(send, /<QuestionShell open onClose=\{onClose\} busy=\{busy\} ariaLabel="Send to staff" title="Send to staff"/);
    assert.match(page, /<QuestionShell open onClose=\{\(\) => setCopyOpen\(false\)\} ariaLabel="Start this plan from" title="Start this plan from…">/);
    assert.match(editor, /<QuestionShell open onClose=\{onClose\} ariaLabel="Groups from another practice" title="Groups from another practice">/);
    assert.match(editor, /<QuestionShell open onClose=\{onClose\} ariaLabel=\{title\} title=\{title\}>/, 'the drill picker');
    assert.match(editor, /<QuestionShell open onClose=\{\(\) => setAttach\(null\)\} ariaLabel="Choose players" title="Choose players"/);
    for (const [file, code] of [['DrillSheet', drill], ['_PracticeSendSheet', send], ['page', page]] as const) {
      assert.doesNotMatch(code, /modalOverlay|useDialogFloor|useOverlayOpen|CoachModalHeader|useBackStep\(/, `${file}: the one window owns the overlay, the floor, the head and the Back step`);
    }
    // The editor keeps exactly its two sheets that stay out (the station modal, the block sheet) — and counts only them.
    assert.equal((editor.match(/className=\{styles\.modalOverlay\}/g) ?? []).length, 2, 'only the station and block sheets build a .modalOverlay window');
    assert.match(editor, /useOverlayOpen\(!!openStationRow \|\| !!openSetRow \|\| !!sheetBlock\);/);
  });
});

describe('2a · the windows still to move (each list only shrinks)', () => {

  it('no coach file builds a window from .modalOverlay outside the list, and every entry says why', () => {
    // ⚖ Q15 keeps rooms, records and sheets out; the rest move in 2c and 2d and come off as they go.
    const STAYS = 'stays out (Q15): a room, a record or a sheet';
    // ⚰ MOVES_2C emptied 2026-10-19 (One Window 2c part 7) and MOVES_2D 2026-10-20 (2d part 6, the practice page): every
    // hand-built coach window that moves is on the one window. Only Q15's rooms, records and sheets remain, and a file
    // that comes back here is not "still to move" — it is a regression.
    const ALLOWED = new Map<string, string>([
      ['components/coaches/RoomShell.tsx', STAYS],
      ['components/coaches/ScheduleEventSheet.tsx', STAYS],
      ['components/coaches/PracticeGroupsRoom.tsx', STAYS],
      ['components/coaches/DepthChartBoard.tsx', STAYS],
      ['components/coaches/CoachStaffSheet.tsx', STAYS],
      ['app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx', STAYS + ' (the day list)'],
      // Its settlement, Set refund and reminder confirm moved in 2d part 4; the player drawer is a record and stays.
      ['app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx', STAYS + ' (the player drawer)'],
      // Its pickers, Save to my … and the docked "+ New drill" moved in 2d part 6; the station and block sheets stay.
      ['app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx', STAYS + ' (its station and block sheets)'],
    ]);
    const builds = (src: string) => /className=\{[^}]*\.modalOverlay\b/.test(src) || /\.modalOverlay\}/.test(src);
    const found = tsxWith('modalOverlay')
      .filter(({ file }) => !/^(app\/\[orgSlug\]\/admin|app\/platform-admin|components\/admin)\//.test(file))
      .filter(({ code }) => builds(code))
      .map(({ file }) => file);
    assert.deepEqual(found.filter(f => !ALLOWED.has(f)), [], 'a new coach window is QuestionShell: the one window with the coach rules');
    assert.deepEqual([...ALLOWED.keys()].filter(f => !found.includes(f)), [], 'moved onto the one window: take it off ALLOWED');
  });
});
