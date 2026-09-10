/**
 * A DISMISSIBLE MENU INSIDE A DIALOG MUST CLAIM ESCAPE — enforced as a rule over the tree.
 *
 * The defect (owner, §134 walk, 2026-09-03): with the Files-under suggestion list open inside a
 * bill's room, Escape closed the ROOM. Three more in-dialog menus had the same hole, one of them
 * with no Escape handling at all.
 *
 * ⚠⚠ TWO FIXES FAILED BEFORE THIS ONE, AND THAT HISTORY IS THE POINT OF THIS FILE.
 *  1. `e.stopPropagation()` — what the picker already did. **Cannot work.** In the App Router React
 *     delegates from `document` and `useDialogFloor` listens on `document` too, so the two are
 *     SIBLING listeners on one node, and stopping propagation never stops a sibling.
 *  2. A `data-escape-owner` attribute checked with `closest()` — shipped, then reproduced in
 *     Chromium still failing. **It loses a race.** `keydown` is a DISCRETE event, so React 18
 *     flushes the menu's own `setOpen(false)` SYNCHRONOUSLY at the end of its dispatch: the
 *     attribute is already gone by the time the floor's listener runs.
 *
 * So the claim rides on the native event itself (`claimEscape` / `escapeClaimed`) — a moment, not a
 * state of a tree that has already moved on — and the attribute survives as the belt for the
 * opposite listener ordering. Full story: `components/coaches/escapeOwnership.ts`.
 *
 * This guard states both halves as rules, because the failure is silent, only reachable by keyboard
 * inside a stacked overlay, and has now been got wrong twice by people reasoning carefully.
 *
 * ⚠ THE RULE IS ABOUT A MENU THE COMPONENT OPENS AND CLOSES ITSELF. A native `<select>` is the
 * browser's business and is deliberately not covered — its Escape never reaches us.
 *
 * Same shape as `room-address-keys-guard.test.ts`: each scanner proves it can still see the
 * offence (a probe), so a green run is never a run that looked at nothing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const FLOOR = join(ROOT, 'components', 'coaches', 'useDialogFloor.ts');

/* ⚠ THE SCAN IS THE PORTAL SURFACES THE FLOOR SERVES, and deliberately not the whole tree: chat's
   mention menu lives in a full-page composer with no dialog floor above it, so a claim there would
   be inert ceremony. Widen these directories the day the floor is adopted somewhere new — an
   un-scanned surface is the same blind spot this guard exists to close. */
const SCAN_DIRS = [
  join(ROOT, 'app', '[orgSlug]', 'coaches'),
  join(ROOT, 'components', 'coaches'),
  join(ROOT, 'components', 'accounting'),
  /* Widened 2026-09-09, exactly as the note above says to: the dues drawer took the floor, and the
     first thing inside a floored dialog that dismisses itself on Escape turned out to be a help
     tooltip — which lives here, not under `coaches/`. Nothing here renders a listbox today; it is
     scanned so the conditional-marker rule below covers the marker `HelpTooltip` now carries. */
  join(ROOT, 'components', 'help'),
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const rel = (p: string) => p.slice(ROOT.length + 1).split('\\').join('/');

describe('escape ownership — a menu inside a dialog closes itself, not the record around it', () => {
  it('the dialog floor stands down for an Escape a menu has already answered', () => {
    const src = readFileSync(FLOOR, 'utf8');
    assert.ok(
      /escapeClaimed\(\s*event\s*\)/.test(src),
      'useDialogFloor no longer reads escapeClaimed(). This is the check that actually fires — '
      + 'without it, Escape inside an open menu closes the whole room again, and the '
      + '[data-escape-owner] fallback CANNOT cover for it (React has already re-rendered the '
      + 'attribute away by then). See components/coaches/escapeOwnership.ts.',
    );
    assert.ok(
      /closest\(\s*['"]\[data-escape-owner\]['"]\s*\)/.test(src),
      'useDialogFloor no longer checks [data-escape-owner] — the belt for the opposite listener '
      + 'ordering. Keep both checks; see components/coaches/escapeOwnership.ts.',
    );
    // Both must guard ESCAPE — not, say, have drifted onto the Tab branch, which would silently
    // un-trap focus instead of closing a room.
    const branch = src.slice(src.indexOf("event.key === 'Escape'"), src.indexOf("event.key === 'Escape'") + 700);
    assert.ok(
      branch.includes('escapeClaimed') && branch.includes('data-escape-owner'),
      'both ownership checks must sit in the Escape branch of useDialogFloor',
    );
  });

  /* ⚠ THE SHARED POPOVER HOOK IS THE THIRD PARTY TO THIS CONTRACT (2026-09-09). The two rules
     above are about a menu a component hand-rolls; `useDismissable` is the hook every ANCHORED
     popover dismisses through — a help tooltip, a toolbar menu, the status legend. None of them
     mattered while no floored dialog contained one, and the dues drawer's schedule editor is the
     first that does: its "What is an installment?" tooltip closes on Escape, and without the
     claim the drawer closes with it. The rule is stated here rather than in the hook because a
     hook cannot fail a build by forgetting something. */
  it('the shared dismissable hook claims Escape for the popovers it closes', () => {
    const src = readFileSync(join(ROOT, 'lib', 'overlay-hooks.ts'), 'utf8');
    const branch = src.slice(src.indexOf("e.key !== 'Escape'"));
    assert.ok(
      branch.includes('claimEscape('),
      'useDismissable no longer claims Escape. Every popover it closes lives inside something — '
      + 'and when that something is a dialog with a floor, the floor answers the same document '
      + 'event and tears the record down behind the popover. See components/coaches/escapeOwnership.ts.',
    );
    assert.ok(
      branch.indexOf('claimEscape(') < branch.indexOf('onEscapeRef.current'),
      'claimEscape() must run BEFORE the onEscape branch returns — a caller with custom Escape '
      + 'handling has still answered the key, and the floor beneath must still stand down.',
    );
  });

  it('every self-managed listbox claims Escape and marks its subtree', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const src = readFileSync(file, 'utf8');
        // A component that renders its OWN menu: an ARIA listbox it opens, not a native <select>.
        if (!/role="listbox"/.test(src)) continue;
        scanned += 1;
        if (!src.includes('claimEscape')) offenders.push(`${rel(file)} — never calls claimEscape()`);
        else if (!src.includes('data-escape-owner')) offenders.push(`${rel(file)} — no data-escape-owner marker`);
      }
    }
    assert.ok(scanned > 0, 'scanner found no listbox at all — it has stopped looking');
    assert.deepEqual(
      offenders, [],
      'These render a dismissible listbox inside a dialog but never claim Escape, so dismissing the '
      + "menu tears down the room or Question around it. In the menu's own onKeyDown, guard on the "
      + 'list being OPEN, call claimEscape(e), then close the list — and mark the wrapper '
      + 'data-escape-owner={open ? "" : undefined}. '
      + '⚠ e.stopPropagation() is NOT a substitute: the floor listens on the same node, and a '
      + 'sibling listener cannot be stopped that way.',
    );
  });

  it('probe — the scanner still recognises an unclaimed listbox', () => {
    const good = 'role="listbox"\nclaimEscape(e)\ndata-escape-owner={open ? \'\' : undefined}';
    const bare = 'role="listbox"\ne.stopPropagation()';
    assert.ok(/role="listbox"/.test(bare) && !bare.includes('claimEscape'));
    assert.ok(/role="listbox"/.test(good) && good.includes('claimEscape') && good.includes('data-escape-owner'));
  });

  it('ownership is conditional on the menu being open — a closed menu lets Escape through', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const src = readFileSync(file, 'utf8');
        if (!src.includes('data-escape-owner')) continue;
        // An unconditional marker would swallow Escape forever, so the record could never be
        // closed from a focused field — the opposite defect, and just as invisible.
        for (const m of src.matchAll(/data-escape-owner=\{([^}]*)\}/g)) {
          if (!m[1].includes('?')) offenders.push(`${rel(file)} — data-escape-owner={${m[1]}}`);
        }
      }
    }
    assert.deepEqual(
      offenders, [],
      'data-escape-owner must be conditional on the menu being open (open ? "" : undefined). '
      + 'An always-on marker swallows Escape even when there is no menu to dismiss, and the coach '
      + 'can never close the record from a focused field.',
    );
  });
});
