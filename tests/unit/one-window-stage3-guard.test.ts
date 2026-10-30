import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE WINDOW · STAGE 3 (STEP 1) — ONE QUESTION (owner rulings Q11–Q13, 2026-10-18)
 * Plan: `docs/projects/active/ONE_WINDOW_PLAN.md`.
 *
 *   • `ConfirmProvider` renders the one question window (`KitDialog` `kind="question"`, `openOn="panel"`) inside
 *     `CoachesOverlayProvider`, so every coach `useConfirm()` question (~43 calls across 26 files) wears the one
 *     question window's 416px desktop / 350px phone card, shares the portal's single scroll-lock counter, and
 *     registers a single Back-button history step through `useDialogFloor`.
 *   • Coaches Portal direct mounts (`roster/page.tsx`, `roster/[playerId]/page.tsx`, `tryouts/page.tsx`) are off
 *     `FeedbackModal`: roster add outcomes show `PageNotice` (Q13: outcomes are not windows), and errors stay until
 *     read in `KitDialog` `kind="question"`.
 *   • Tournament Admin (`schedule/page.tsx`, `results/page.tsx`, `BracketEditor.tsx`) is off `FeedbackModal`:
 *     2-button confirms and 1-button refusals/errors render `KitDialog` `kind="question"`, and destructive answers
 *     (`Discard`, `Delete`, `Clear Bracket`) wear `.btn-danger` (Q11).
 *   • Browser `window.confirm` is gone across `app/`, `components/`, and `lib/` (`assistant-coaches/page.tsx` ×1,
 *     `shared-library/page.tsx` ×2 → `KitDialog` `kind="question"`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ALL_FILES = [
  ...filesUnder('app', '.tsx'),
  ...filesUnder('app', '.ts'),
  ...filesUnder('components', '.tsx'),
  ...filesUnder('components', '.ts'),
  ...filesUnder('lib', '.tsx'),
  ...filesUnder('lib', '.ts'),
];

describe('3 · ConfirmProvider renders the one question window inside CoachesOverlayProvider', () => {
  it('ConfirmProvider renders KitDialog kind="question" with openOn="panel" and no duplicate useBackStep', () => {
    const code = readCode('components/coaches/ConfirmProvider.tsx');
    assert.match(code, /import KitDialog from '@\/components\/shared\/KitDialog';/);
    assert.match(code, /<KitDialog\s+kind="question"\s+title=\{opts\.title \?\? 'Please confirm'\}\s+onClose=\{\(\) => settle\(false\)\}\s+openOn="panel"/);
    assert.match(code, /className=\{opts\.tone === 'danger' \? 'btn btn-danger' : 'btn btn-lime'\}/);
    assert.doesNotMatch(code, /FeedbackModal|useBackStep/, 'KitDialog owns the question window and the Back step via useDialogFloor');
  });

  it('CoachesLayout mounts ConfirmProvider inside CoachesOverlayProvider so inCoachPortal is true', () => {
    const layout = readCode('app/[orgSlug]/coaches/layout.tsx');
    const overlayOpen = layout.indexOf('<CoachesOverlayProvider>');
    const confirmOpen = layout.indexOf('<ConfirmProvider>');
    const confirmClose = layout.indexOf('</ConfirmProvider>');
    const overlayClose = layout.indexOf('</CoachesOverlayProvider>');
    assert.ok(
      overlayOpen >= 0 && confirmOpen > overlayOpen && confirmClose < overlayClose,
      'ConfirmProvider must sit inside CoachesOverlayProvider so KitDialog shares the portal scroll lock and sets data-coach-window',
    );
  });
});

describe('3 · Coaches Portal and Tournament Admin have zero FeedbackModal mounts', () => {
  it('no file in coaches, rep-teams components, or tournament admin imports or renders FeedbackModal', () => {
    const scoped = ALL_FILES.filter(f =>
      f.startsWith('app/[orgSlug]/coaches/')
      || f.startsWith('components/coaches/')
      || f.startsWith('components/rep-teams/')
      || f.startsWith('app/[orgSlug]/admin/tournaments/'),
    );
    const offenders = scoped.filter(f => {
      const raw = readSource(f);
      return raw.includes('FeedbackModal') && stripComments(raw).includes('FeedbackModal');
    });
    assert.deepEqual(offenders, [], 'Coaches and Tournament Admin use KitDialog kind="question" or non-blocking notices');
  });

  it('Roster page routes add-player outcomes to PageNotice and errors to KitDialog kind="question" (Q13)', () => {
    const roster = readCode('app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx');
    assert.match(roster, /import PageNotice, \{ useNotice \} from '@\/components\/shared\/PageNotice';/);
    assert.match(roster, /\{rosterNotice && <PageNotice notice=\{rosterNotice\} \/>\}/);
    assert.match(roster, /if \(type === 'success'\) setRosterNotice\(\{ tone: 'good', text: msg \}\);\s*else setErrorMsg\(msg\);/);
    assert.match(roster, /<KitDialog\s+kind="question"\s+title="Error"\s+onClose=\{\(\) => setErrorMsg\(''\)\}\s+openOn="panel"/);
  });

  it('Player detail and Tryouts pages render errors in KitDialog kind="question"', () => {
    const player = readCode('app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx');
    assert.match(player, /<KitDialog\s+kind="question"\s+title="Error"\s+onClose=\{\(\) => setFeedbackMsg\(''\)\}\s+openOn="panel"/);
    const tryouts = readCode('app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx');
    assert.match(tryouts, /<KitDialog\s+kind="question"\s+title="Something went wrong"\s+onClose=\{\(\) => setFeedbackMsg\(''\)\}\s+openOn="panel"/);
  });

  it('Tournament Schedule, Results, and BracketEditor render confirms and refusals in KitDialog kind="question"', () => {
    for (const file of [
      'app/[orgSlug]/admin/tournaments/schedule/page.tsx',
      'app/[orgSlug]/admin/tournaments/results/page.tsx',
      'app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx',
    ]) {
      const code = readCode(file);
      assert.match(code, /<KitDialog\s+kind="question"\s+title=\{feedback\.title\}/, file);
      assert.doesNotMatch(code, /FeedbackModal/, file);
    }
    const bracket = readCode('app/[orgSlug]/admin/tournaments/schedule/components/BracketEditor.tsx');
    assert.match(bracket, /title: 'Discard changes\?',\s*message: 'Your unsaved bracket edits will be lost\.',\s*type: 'danger'/, 'Discard wears the danger button (Q11)');
  });
});

describe('3 · Browser window.confirm is gone across the codebase (Q11)', () => {
  it('no file under app/, components/, or lib/ calls window.confirm', () => {
    const offenders = ALL_FILES.filter(f => {
      const raw = readSource(f);
      return raw.includes('window.confirm') && /\bwindow\.confirm\s*\(/.test(stripComments(raw));
    });
    assert.deepEqual(offenders, [], 'use KitDialog kind="question" (or useConfirm in coaches) instead of window.confirm');
  });

  it('Assistant coaches and Shared library ask through KitDialog kind="question"', () => {
    const staff = readCode('app/[orgSlug]/admin/rep-teams/assistant-coaches/page.tsx');
    assert.match(staff, /<KitDialog\s+kind="question"\s+title=\{`Remove \$\{removingAssistant\.displayName \|\| removingAssistant\.email \|\| 'this assistant'\}\?`\}/);
    const lib = readCode('app/[orgSlug]/admin/rep-teams/shared-library/page.tsx');
    assert.match(lib, /<KitDialog\s+kind="question"\s+title=\{`Delete shared tag “\$\{deletingTag\.name\}”\?`\}/);
    assert.match(lib, /<KitDialog\s+kind="question"\s+title=\{`Merge “\$\{mergingPair\.loser\.name\}” into “\$\{mergingPair\.winner\.name\}”\?`\}/);
  });
});

