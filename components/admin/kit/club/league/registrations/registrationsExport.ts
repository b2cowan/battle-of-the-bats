/**
 * THE REGISTRATIONS' FILES (Club Tier Stage 9b-2, Part 3): what the screen exported before, on the new money. The list on
 * screen is the list in the file — this tab, this search, this filter — and the Fee column says what the screen's Fee cell
 * says (it used to say Yes or No from a tick that no longer exists). The register on paper prints nothing private: no date
 * of birth, guardian name, email, phone or notes (a PDF is the copy that gets printed and left on a table).
 */
import {
  downloadXLSX, generateCSV, downloadCSVBlob, buildFilename, serializeRows, serializeHeaders,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type ExportColumnDef,
} from '@/lib/export';
import { endedKind, guardianName, playerName, type RegTab } from '@/lib/house-league-registrations';
import { REGS_WORDS } from '@/lib/house-league-money-words';
import type { LeagueRegistration } from '@/lib/types';

export interface ExportRow { reg: LeagueRegistration; division: string; fee: string }

const COLS: ExportColumnDef[] = [
  { label: 'First Name',     key: 'playerFirstName',   format: 'text' },
  { label: 'Last Name',      key: 'playerLastName',    format: 'text' },
  { label: 'Division',       key: 'division',          format: 'text' },
  { label: 'Date of Birth',  key: 'playerDateOfBirth', format: 'date', sensitive: true },
  { label: 'Guardian Name',  key: 'guardianName',      format: 'text', sensitive: true },
  { label: 'Guardian Email', key: 'guardianEmail',     format: 'text', sensitive: true },
  { label: 'Guardian Phone', key: 'guardianPhone',     format: 'text', sensitive: true },
  { label: 'Registered At',  key: 'registeredAt',      format: 'date' },
  { label: 'Status',         key: 'status',            format: 'text' },
  { label: 'Fee',            key: 'fee',               format: 'text' },
  { label: 'Jersey Pref',    key: 'jerseyPref',        format: 'text' },
  { label: 'Position Pref',  key: 'positionPref',      format: 'text' },
  { label: 'Player Notes',   key: 'playerNotes',       format: 'text', sensitive: true },
  { label: 'Admin Notes',    key: 'adminNotes',        format: 'text', sensitive: true },
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

function source(rows: readonly ExportRow[]) {
  return rows.map(({ reg: r, division, fee }) => ({
    playerFirstName: r.playerFirstName,
    playerLastName: r.playerLastName,
    division,
    playerDateOfBirth: r.playerDateOfBirth ?? '',
    guardianName: guardianName(r),
    guardianEmail: r.guardianEmail,
    guardianPhone: r.guardianPhone ?? '',
    registeredAt: r.registeredAt.slice(0, 10),
    status: statusWord(r),
    fee,
    jerseyPref: r.playerJerseyPref ?? '',
    positionPref: r.playerPositionPref ?? '',
    playerNotes: r.playerNotes ?? '',
    adminNotes: r.adminNotes ?? '',
  }));
}

export async function exportXlsx(rows: readonly ExportRow[], orgSlug: string | undefined, scope: RegTab, withContacts: boolean) {
  if (!rows.length) return;
  await downloadXLSX(
    buildFilename({ org: orgSlug, dataset: withContacts ? 'registrations-with-contacts' : 'registrations', scope }, 'xlsx'),
    serializeHeaders(COLS, withContacts), serializeRows(source(rows), COLS, withContacts), 'Registrations',
  );
}

export function exportCsv(rows: readonly ExportRow[], orgSlug: string | undefined, scope: RegTab) {
  downloadCSVBlob(
    buildFilename({ org: orgSlug, dataset: 'registrations', scope }, 'csv'),
    generateCSV(serializeHeaders(COLS), serializeRows(source(rows), COLS)),
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
  const pdfRow = ({ reg: r, fee }: ExportRow) => [playerName(r), r.registeredAt.slice(0, 10), statusWord(r), fee];
  const grouped = p.divisionOrder
    .map(d => ({ label: d.name, rows: p.rows.filter(r => r.reg.divisionId === d.id) }))
    .filter(g => g.rows.length > 0);
  const placed = new Set(p.divisionOrder.map(d => d.id));
  const unplaced = p.rows.filter(r => !r.reg.divisionId || !placed.has(r.reg.divisionId));
  if (unplaced.length > 0) grouped.push({ label: REGS_WORDS.noDivision, rows: unplaced });

  const q = p.query.trim();
  const tabLabel = REGS_WORDS.tab[p.tab].toLowerCase();
  const listLabel = q ? [tabLabel, `matching “${q}”`].join(', ') : tabLabel;
  const count = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`;

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
