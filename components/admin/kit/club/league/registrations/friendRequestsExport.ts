/**
 * THE FRIEND REQUESTS VIEW'S OWN FILE (Board Ready Stage 1 Part 2; drawing tab 7): the registrar's old spreadsheet, one
 * row per request. CHILDREN'S NAMES ONLY: no parent's name (the typed parent's name is a matching aid and stays on the
 * screen) and no contact detail (A13's drawn-in proposal; /legal). Excel and CSV, behind the seat that opens Registrations
 * and the League Plus export gate, as the registrations export is. Typed text comes from an anonymous form, so every CSV
 * cell is written so a spreadsheet can't read it as a formula (lib/export/formula-safe.ts); an Excel cell is stored as
 * text and never runs (/review 2026-11-11: the apostrophe would show there).
 */
import { downloadXLSX, generateCSV, downloadCSVBlob, buildFilename } from '@/lib/export';
import { formulaSafe } from '@/lib/export/formula-safe';
import { playerName } from '@/lib/house-league-registrations';
import { showFriendCode } from '@/lib/league-friend-code';
import { requestLines, FRIEND_QUEUE_WORDS as W, type QueueRow } from '@/lib/league-friend-queue';

const HEAD = [W.fileCols.player, W.fileCols.division, W.fileCols.team, W.fileCols.asked, W.fileCols.code, W.fileCols.matched,
  W.fileCols.mark, W.fileCols.state, W.fileCols.inDraft, W.fileCols.reason, W.fileCols.decidedBy];

function lines(rows: readonly QueueRow[], divisionName: (id: string | null) => string | null, teamName: (id: string | null) => string | null, forCsv: boolean): string[][] {
  return requestLines(rows).map(({ q, row, asker, match, confirmed }) => {
    const typed = q.code ? '' : [q.typedFirst, q.typedLast].filter(Boolean).join(' ');
    // A mark belongs to the request it describes: Code match only on the line whose family entered a code.
    const marks = [...row.marks].filter(m => m !== 'code' || !!q.code).map(m => W.mark[m]).join(', ');
    const state = confirmed ? W.fileState.confirmed : W.fileState[q.state === 'to_confirm' ? 'toConfirm' : q.state];
    const team = teamName(asker.teamId);
    const honoured = confirmed && !!asker.teamId && !!match?.teamId && match.teamId === asker.teamId;
    const inDraft = !asker.teamId ? '' : honoured ? W.honoured : W.notHonoured;
    const reason = q.state === 'not_signed_up' ? W.notSignedUpWord
      : q.state === 'cant_honour' ? W.cantHonourWord(q.reason, q.note)
        : honoured && team ? `Both on ${team}` : '';
    const cells = [
      playerName(asker), divisionName(asker.divisionId) ?? '', team ?? '', typed, q.code ? showFriendCode(q.code) : '',
      match && (confirmed || q.matchedRegistrationId) ? playerName(match) : '',
      marks, state, inDraft, reason, q.decidedBy ?? '',
    ];
    // An Excel cell is written as text and never runs; a CSV opened in Excel can, so its cells are made formula-safe.
    return forCsv ? cells.map(v => String(formulaSafe(v))) : cells;
  });
}

export async function exportFriendsXlsx(p: {
  rows: readonly QueueRow[]; orgSlug: string | undefined;
  divisionName: (id: string | null) => string | null; teamName: (id: string | null) => string | null;
}) {
  if (!p.rows.length) return;
  await downloadXLSX(buildFilename({ org: p.orgSlug, dataset: 'friend-requests' }, 'xlsx'), HEAD, lines(p.rows, p.divisionName, p.teamName, false), 'Friend requests');
}

export function exportFriendsCsv(p: {
  rows: readonly QueueRow[]; orgSlug: string | undefined;
  divisionName: (id: string | null) => string | null; teamName: (id: string | null) => string | null;
}) {
  if (!p.rows.length) return;
  downloadCSVBlob(buildFilename({ org: p.orgSlug, dataset: 'friend-requests' }, 'csv'), generateCSV(HEAD, lines(p.rows, p.divisionName, p.teamName, true)));
}
