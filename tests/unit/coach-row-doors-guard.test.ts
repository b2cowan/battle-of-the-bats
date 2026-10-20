import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

/**
 * ROW DOORS (owner 2026-10-20, from a phone screenshot of the tryout sessions: "I thought for things like these we moved
 * to a full bar single chevron that opens a modal that shows the edit pencil and garbage can?"). The house rule is
 * TABLE_AND_LIST_STANDARD §3.10's row-list door: a page list's row is ONE door, the chevron last, and its delete lives in
 * the window it opens. A census of the paid coaches portal found seven lists off the rule; three of them deleted on one
 * tap. Stage 1 (this file's first describe): the one-tap deletes. A row with nothing else to open keeps its remove on the
 * row — asked first, named, a fingertip under a finger — rather than growing a window that holds only a Delete.
 */
describe('Row doors · stage 1 — nothing deletes on one tap', () => {
  it('a tryout session row is one door to Edit session; Delete session is that window\'s, behind the confirm', () => {
    const code = readCode('components/rep-teams/TryoutDayCard.tsx');
    assert.doesNotMatch(code, /\bPencil\b|\bTrash2\b/, 'no pencil or bin on a session row');
    assert.match(code, /<button key=\{s\.id\} type="button" className=\{`\$\{styles\.sessionRow\} \$\{styles\.sessionDoor\}`\} onClick=\{\(\) => openEdit\(s\)\}>/);
    assert.match(code, /<ChevronRight size=\{16\} aria-hidden className=\{styles\.sessionChevron\} \/>/);
    assert.match(code, /footerStart=\{editingId && canWrite\s*\? <SheetRemoveButton label="Delete session"/);
    assert.match(code, /async function deleteSession\(id: string\) \{[\s\S]*?const ok = await confirm\(\{[\s\S]*?if \(!ok\) return;[\s\S]*?method: 'DELETE'/);
    assert.match(readSource('components/rep-teams/TryoutDayCard.module.css'), /\.sessionDoor \{[^}]*min-height: var\(--tap-min, 44px\)/);
  });

  it('a player\'s document asks before it is deleted, refuses visibly, and its two doors are named row buttons', () => {
    const code = readCode('components/coaches/PlayerDocumentsSection.tsx');
    assert.match(code, /async function handleDelete\(doc: DocRow\) \{[\s\S]*?const ok = await confirm\(\{[\s\S]*?if \(!ok\) return;[\s\S]*?if \(!res\.ok\) throw new Error\(\);/);
    assert.match(code, /className=\{styles\.rowIconBtn\}[\s\S]*?aria-label=\{`Download \$\{doc\.fileName\}`\}/);
    assert.match(code, /className=\{`\$\{styles\.rowIconBtn\} \$\{styles\.rowIconBtnDanger\}`\}[\s\S]*?aria-label=\{`Delete \$\{doc\.fileName\}`\}/);
  });

  it('a scouting observation asks before it is removed; its eraser is a fingertip under a finger', () => {
    const code = readCode('app/[orgSlug]/coaches/teams/[teamId]/history/opponents/[opponentKey]/page.tsx');
    assert.match(code, /async function removeObservation\(id: string\) \{\s*const ok = await confirm\(\{[\s\S]*?if \(!ok\) return;/);
    assert.match(readSource('app/[orgSlug]/coaches/coaches.module.css'), /@media \(pointer: coarse\) \{\s*\.scoutObsDelete \{ width: var\(--tap-min, 44px\); height: var\(--tap-min, 44px\); \}/);
  });

  it('a call-up\'s Remove already asked first (checked, unchanged)', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx'), /async function handleRemoveCallUp\(player: RepRosterPlayer\) \{[\s\S]*?const ok = await confirm\(\{/);
  });
});
