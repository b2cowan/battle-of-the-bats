import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, filesUnder, openingTags, parseProps, readCode, stripComments, readSource } from './_source-code.ts';

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
    assert.match(shell, /import KitDialog, \{ DialogCancel \} from '@\/components\/admin\/kit\/club\/KitDialog';/);
    assert.match(shell, /<KitDialog\s+kind="form"/);
    assert.doesNotMatch(shell, /modalOverlay|useDialogFloor|useOverlayOpen|CoachModalHeader|RAISED_OVERLAY_Z/,
      'the overlay, the floor, the counter and the head are the one window\'s now');
    // It keeps the route guard armed while its form is hidden on another tab (the hub keeps panels mounted).
    assert.match(shell, /if \(!open\) return guard;/);
    // The coach rules for a window: no phone keyboard on open, the forms' own type, and the asks pass through.
    for (const prop of [/openOn="panel"/, /\n\s+ownType\n/, /dirty=\{dirty\}/, /raised=\{raised\}/, /size=\{wide \? 'medium' : undefined\}/]) {
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
    assert.match(kit, /onClick=\{onClose\} disabled=\{busy\}>\{WINDOW_ASK\.discard\}/);
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
    // On a phone the coach window joins the §227 rule beside `.modalOverlay` (one measured offset, not two copies).
    const phone = /@media \(max-width: 640px\) \{\s*body:has\(\.modalOverlay:not\(\.daySheetOverlay\):not\(\.centeredOnMobile\)\) \.savePill,\s*body:has\(\[data-coach-window\]\[data-kind="form"\]\) \.savePill \{\s*z-index: (\d+);/.exec(coachesCss);
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
  it('its one-line fields are 36px on a computer', () => {
    // Real fields only — a read-only value drawn as a field (`<span class="input">`) keeps its height (/review).
    assert.match(css, /@media \(min-width: 769px\) \{\s*\.windowBody :is\(input, select\):is\(\.input, \.select\) \{ height: 36px; \}\s*\}/);
  });
  it('a field the keyboard reaches scrolls clear of the pinned foot strip, and a phone strip reaches the screen foot (/review)', () => {
    assert.match(css, /\.windowBody :is\(input, select, textarea, button, \[tabindex\]\) \{ scroll-margin-bottom: calc\(5rem \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
    assert.match(css, /bottom: calc\(-1rem - env\(safe-area-inset-bottom, 0px\)\);\s*margin-bottom: calc\(-1rem - env\(safe-area-inset-bottom, 0px\)\);\s*padding-bottom: calc\(0\.85rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
  });
  it('on a phone, its one-line fields and foot buttons are 44px', () => {
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.windowBody input:not\(\[type="checkbox"\]\)[^{]*\.windowBody select,\s*\.windowBody \.modalFooter :is\(button, a\) \{ min-height: var\(--tap-min, 44px\); \}/);
  });
  it('a global .btn inside a coach window wears the portal\'s button face, as the admin\'s does', () => {
    const globals = readCode('app/globals.css');
    assert.match(globals, /\[data-admin-kit\] \.btn:where\(:not\(\[data-public-preview\] \*\)\),\s*\[data-coach-window\] \.btn \{\s*font-family: var\(--font-sans/);
  });
  it('the shell wraps its form in the coach window\'s body', () => {
    assert.match(shell, /<div className=\{coach\.windowBody\}>\{children\}<\/div>/);
  });
});

describe('2a · the shim and the windows still to move (each list only shrinks)', () => {
  it('a shell window drawing its own foot strip is listed, until 2b moves its buttons into the window\'s foot', () => {
    // ⚖ 2b empties this list, and the `.windowBody .modalFooter` shim in coaches.module.css goes with it.
    const SHIM = new Set([
      'components/coaches/ClubReviewCard.tsx', 'components/coaches/ClubSlotParts.tsx', 'components/coaches/GoalSheet.tsx',
      'components/coaches/ManagePlacesSheet.tsx', 'components/coaches/MetricDefinitionSheet.tsx', 'components/coaches/PlaceSheet.tsx',
      'components/coaches/RecordObservationDialog.tsx', 'components/coaches/RecordResultSheet.tsx', 'components/coaches/ReviewGoalDialog.tsx',
      'components/coaches/ScheduleEventForm.tsx', 'components/coaches/SessionSheet.tsx', 'app/[orgSlug]/coaches/link-org/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/DriveRoom.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/panel.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/SponsorRoom.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/accounting/InstallmentScopeSheet.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/accounting/LedgerLineWindow.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/accounting/PayeesWindow.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/development/sessions/[sessionId]/page.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/history/development/panel.tsx',
      // Written by Club Tier Stage 5c while 2a was in flight (2026-10-19): in 2a the shell has no foot to offer yet.
      'components/coaches/ClubHandoffDoor.tsx',
    ]);
    const all = TSX.map(({ file }) => file);
    const found = tsxWith('<QuestionShell', 'modalFooter').map(({ file }) => file);
    assert.deepEqual(found.filter(f => !SHIM.has(f)), [], 'a new shell window puts its buttons in the window\'s foot, never a .modalFooter');
    // An entry whose file is not in the tree yet (another build's window, mid-flight) is not a stale entry.
    assert.deepEqual([...SHIM].filter(f => all.includes(f) && !found.includes(f)), [], 'moved to the foot: take it off SHIM');
  });

  it('no coach file builds a window from .modalOverlay outside the list, and every entry says why', () => {
    // ⚖ Q15 keeps rooms, records and sheets out; the rest move in 2c and 2d and come off as they go.
    const STAYS = 'stays out (Q15): a room, a record or a sheet';
    const MOVES_2C = 'moves in 2c (no Tab trap or phone Back today)';
    const MOVES_2D = 'moves in 2d';
    const ALLOWED = new Map<string, string>([
      ['components/coaches/RoomShell.tsx', STAYS],
      ['components/coaches/ScheduleEventSheet.tsx', STAYS],
      ['components/coaches/PracticeGroupsRoom.tsx', STAYS],
      ['components/coaches/DepthChartBoard.tsx', STAYS],
      ['components/coaches/CoachStaffSheet.tsx', STAYS],
      ['app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx', STAYS + ' (the day list)'],
      ['app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx', MOVES_2C + ' (Add player)'],
      ['app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx', MOVES_2C + ' (a budget line, Delete line?)'],
      ['app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupTemplatesView.tsx', MOVES_2C + ' (Apply to…)'],
      ['components/coaches/AwardIconPicker.tsx', MOVES_2C],
      ['components/coaches/BudgetImportSheet.tsx', MOVES_2C],
      ['components/coaches/BudgetItemManagerModal.tsx', MOVES_2C],
      ['components/coaches/BudgetStarterSheet.tsx', MOVES_2C],
      ['components/coaches/CloseSeasonModal.tsx', MOVES_2C],
      ['components/coaches/CoachExportButton.tsx', MOVES_2C],
      ['components/coaches/GiveAwardModal.tsx', MOVES_2C],
      ['components/coaches/MoneyImportMenu.tsx', MOVES_2C],
      ['components/coaches/PastSeasonImport.tsx', MOVES_2C],
      ['components/coaches/PlayerDocumentsSection.tsx', MOVES_2C],
      ['components/coaches/RosterBulkAddSheet.tsx', MOVES_2C],
      ['components/coaches/SampleBudgetSheet.tsx', MOVES_2C],
      ['components/coaches/ScheduleImportSheet.tsx', MOVES_2C],
      ['components/coaches/StartNextSeasonModal.tsx', MOVES_2C],
      ['app/[orgSlug]/coaches/teams/[teamId]/accounting/GenerateInstallmentsModal.tsx', MOVES_2D],
      ['app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx', MOVES_2D],
      ['app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx', MOVES_2D + ' (and the player drawer stays out)'],
      ['app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx', MOVES_2D + ' (Record money, portaled)'],
      ['app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx', MOVES_2D + ', the practice page last'],
      ['app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx', MOVES_2D + ', the practice page last (its station and block sheets stay out)'],
      ['app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticeSendSheet.tsx', MOVES_2D],
      ['components/coaches/CalendarSubscribeWindow.tsx', MOVES_2D],
      ['components/coaches/DrillSheet.tsx', MOVES_2D],
      ['components/coaches/DuesReminderPreviewModal.tsx', MOVES_2D],
      ['components/coaches/MoneyMonthGrid.tsx', MOVES_2D],
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
