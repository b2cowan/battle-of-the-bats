/**
 * THE REGISTRATIONS' FILES (Club Tier Stage 9b-2, Part 3): what the screen exported before, on the new money. The list on
 * screen is the list in the file — this tab, this search, this filter — and the Fee column says what the screen's Fee cell
 * says (it used to say Yes or No from a tick that no longer exists). The register on paper prints nothing private: no date
 * of birth, guardian name, email, phone or notes (a PDF is the copy that gets printed and left on a table).
 *
 * Board Ready Stage 1 Part 2 (drawing tab 7): a season that takes friend requests adds two NAME-FREE columns, "Friend
 * Requests" (how many the family named) and "Friends Honoured" ("1 of 2", read from the teams as they stand), to the
 * Excel and the CSV alike. Friend NAMES never go in these files, least of all "Excel with contact details" (/legal): they
 * go only in the Friend requests view's own export. ⚠ Every CSV cell is written formula-safe: the names, notes and
 * preferences come from an anonymous public form, and a value that starts with "=" must never run when the CSV is opened
 * in Excel (lib/export/formula-safe.ts). The Excel file stores every value as text, which never runs, so it is left as
 * typed: an apostrophe there would show (a guardian phone "+1 519…"; /review 2026-11-11).
 *
 * Board Ready Stage 4 Part 3 (drawing tab 6 · C, ruling 13): Excel and CSV gain a column per sign-up question that isn't
 * about health, after the shipped columns, in the form's order (an archived question reads "{label} (no longer asked)");
 * a file answer reads "Attached", never the file. Health answers leave ONLY in "Excel with contact details and health
 * answers", read from the server when it is chosen (the list never holds them). The CSV's formula-safe pass covers every
 * answer column, as it does every other cell (/legal: anonymous text reaches the file).
 */
import {
  downloadXLSX, generateCSV, downloadCSVBlob, buildFilename, serializeRows, serializeHeaders,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type ExportColumnDef,
} from '@/lib/export';
import { orgDayKey } from '@/lib/timezone';
import { endedKind, guardianName, playerName, type RegTab } from '@/lib/house-league-registrations';
import { REGS_WORDS } from '@/lib/house-league-money-words';
import { formulaSafeRow } from '@/lib/export/formula-safe';
import { FRIEND_QUEUE_WORDS } from '@/lib/league-friend-queue';
import { pluralize } from '@/lib/utils';
import type { LeagueRegistration } from '@/lib/types';

export interface ExportRow {
  reg: LeagueRegistration; division: string; fee: string;
  /** Present only on a season that takes friend requests: the two name-free columns' values. */
  friends?: { requests: number; honoured: string };
  /** The sign-up form's answers in words, by question id ("Not asked", never blank). */
  answers?: Record<string, string>;
}

/** A sign-up question as a file's column: its heading, and whether it is a health question (the opt-in file only). */
export type AnswerCol = { id: string; label: string; health: boolean };

const COLS: ExportColumnDef[] = [
  { label: 'First Name',     key: 'playerFirstName',   format: 'text' },
  { label: 'Last Name',      key: 'playerLastName',    format: 'text' },
  { label: 'Division',       key: 'division',          format: 'text' },
  { label: 'Date of Birth',  key: 'playerDateOfBirth', format: 'date', sensitive: true },
  { label: 'Guardian Name',  key: 'guardianName',      format: 'text', sensitive: true },
  { label: 'Guardian Email', key: 'guardianEmail',     format: 'text', sensitive: true },
  // Signed-in family accounts Stage 3: beside the first address, private the same way (drawing tab 3).
  { label: 'Second Parent Email', key: 'guardianEmail2', format: 'text', sensitive: true },
  { label: 'Guardian Phone', key: 'guardianPhone',     format: 'text', sensitive: true },
  { label: 'Registered At',  key: 'registeredAt',      format: 'date' },
  { label: 'Status',         key: 'status',            format: 'text' },
  { label: 'Fee',            key: 'fee',               format: 'text' },
  { label: 'Jersey Pref',    key: 'jerseyPref',        format: 'text' },
  { label: 'Position Pref',  key: 'positionPref',      format: 'text' },
  { label: 'Player Notes',   key: 'playerNotes',       format: 'text', sensitive: true },
  { label: 'Admin Notes',    key: 'adminNotes',        format: 'text', sensitive: true },
];

const FRIEND_COLS: ExportColumnDef[] = [
  { label: FRIEND_QUEUE_WORDS.exportCols.requests, key: 'friendRequests', format: 'text' },
  { label: FRIEND_QUEUE_WORDS.exportCols.honoured, key: 'friendsHonoured', format: 'text' },
];

/** The file's columns: the two friend columns only when the season takes friend requests (at None, none). */
const colsFor = (rows: readonly ExportRow[], answerCols: readonly AnswerCol[] = []): ExportColumnDef[] => [
  ...(rows.some(r => r.friends) ? [...COLS, ...FRIEND_COLS] : COLS),
  // A health column is sensitive: it serializes only in the file that asked for health answers.
  ...answerCols.map(c => ({ label: c.label, key: `a:${c.id}`, format: 'text' as const, ...(c.health ? { sensitive: true } : {}) })),
];

const PDF_COLS: ExportColumnDef[] = [
  { label: 'Player',     key: 'player',       format: 'text' },
  { label: 'Registered', key: 'registeredAt', format: 'date' },
  { label: 'Status',     key: 'status',       format: 'text' },
  { label: 'Fee',        key: 'fee',          format: 'text' },
];

/** A registration's state in words, as a file reads it. */
function statusWord(r: LeagueRegistration): string {
  switch (r.status) {
    case 'pending_review': return REGS_WORDS.tab.review;
    case 'active': return REGS_WORDS.tab.active;
    case 'waitlisted': return REGS_WORDS.tab.waitlist;
    default: return ({ declined: 'Declined', withdrawn: 'Withdrawn', released: 'Spot released' } as const)[endedKind(r)];
  }
}

function source(rows: readonly ExportRow[], answerCols: readonly AnswerCol[] = []) {
  return rows.map(({ reg: r, division, fee, friends, answers }) => ({
    ...Object.fromEntries(answerCols.map(c => [`a:${c.id}`, answers?.[c.id] ?? ''])),
    playerFirstName: r.playerFirstName,
    playerLastName: r.playerLastName,
    division,
    playerDateOfBirth: r.playerDateOfBirth ?? '',
    guardianName: guardianName(r),
    guardianEmail: r.guardianEmail,
    guardianEmail2: r.guardianEmail2 ?? '',
    guardianPhone: r.guardianPhone ?? '',
    registeredAt: orgDayKey(r.registeredAt),
    status: statusWord(r),
    fee,
    jerseyPref: r.playerJerseyPref ?? '',
    positionPref: r.playerPositionPref ?? '',
    playerNotes: r.playerNotes ?? '',
    adminNotes: r.adminNotes ?? '',
    friendRequests: friends ? String(friends.requests) : '',
    friendsHonoured: friends?.honoured ?? '',
  }));
}

export async function exportXlsx(
  rows: readonly ExportRow[], orgSlug: string | undefined, scope: RegTab, withContacts: boolean,
  answerCols: readonly AnswerCol[] = [], withHealth = false,
) {
  if (!rows.length) return;
  // A health column never reaches a file that didn't ask for health answers, whatever the caller passed.
  const cols = colsFor(rows, answerCols.filter(c => withHealth || !c.health));
  const dataset = withHealth ? 'registrations-with-health-answers' : withContacts ? 'registrations-with-contacts' : 'registrations';
  await downloadXLSX(
    buildFilename({ org: orgSlug, dataset, scope }, 'xlsx'),
    serializeHeaders(cols, withContacts), serializeRows(source(rows, answerCols), cols, withContacts), 'Registrations',
  );
}

export function exportCsv(rows: readonly ExportRow[], orgSlug: string | undefined, scope: RegTab, answerCols: readonly AnswerCol[] = []) {
  const cols = colsFor(rows, answerCols.filter(c => !c.health));
  downloadCSVBlob(
    buildFilename({ org: orgSlug, dataset: 'registrations', scope }, 'csv'),
    generateCSV(serializeHeaders(cols), serializeRows(source(rows, answerCols), cols).map(formulaSafeRow)),
  );
}

/**
 * The register on paper: one section per division, each heading carrying its own count, because "how many in Mosquito" is
 * the question a registrar opens this list to answer. The subtitle names the season, the list and the count — and says so
 * when a search narrowed it, because a document that claims completeness while holding three rows out of fifty is the one
 * thing a register must never be.
 */
export async function exportPdf(p: {
  rows: readonly ExportRow[];
  divisionOrder: readonly { id: string; name: string }[];
  orgSlug: string | undefined;
  orgName: string | undefined;
  orgQuery: string;
  seasonName: string;
  tab: RegTab;
  query: string;
}) {
  if (!p.rows.length) return;
  const { orgQuery } = p;
  const settings = { ...DEFAULT_PDF_SETTINGS, ...((await fetchResolvedPdfSettings(`/api/admin/org/pdf-settings${orgQuery ? `${orgQuery}&resolve=1` : '?resolve=1'}`)) ?? {}) };
  const pdfRow = ({ reg: r, fee }: ExportRow) => [playerName(r), orgDayKey(r.registeredAt), statusWord(r), fee];
  const grouped = p.divisionOrder
    .map(d => ({ label: d.name, rows: p.rows.filter(r => r.reg.divisionId === d.id) }))
    .filter(g => g.rows.length > 0);
  const placed = new Set(p.divisionOrder.map(d => d.id));
  const unplaced = p.rows.filter(r => !r.reg.divisionId || !placed.has(r.reg.divisionId));
  if (unplaced.length > 0) grouped.push({ label: REGS_WORDS.noDivision, rows: unplaced });

  const q = p.query.trim();
  const tabLabel = REGS_WORDS.tab[p.tab].toLowerCase();
  const listLabel = q ? [tabLabel, `matching “${q}”`].join(', ') : tabLabel;
  const count = (n: number) => pluralize(n, 'player');

  await downloadPDF(
    buildFilename({ org: p.orgSlug, dataset: 'registrations', scope: p.tab }, 'pdf'),
    'Season Registrations',
    [p.seasonName, listLabel, count(p.rows.length)].filter(Boolean).join('  ·  '),
    serializeHeaders(PDF_COLS),
    grouped.flatMap(g => g.rows.map(pdfRow)),
    settings,
    {
      groups: grouped.map(g => ({ label: `${g.label} — ${count(g.rows.length)}`, rows: g.rows.map(pdfRow) })),
      identity: p.orgName,
    },
  );
}
