/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE PAGE PER CHILD — the words and the pure rules of the club's child page, the household's one line per child and
 * the coach's "With the {team} {years}" line (Club Tier Stage 14 S5; drawings tab 5 + tab 8; owner 2026-11-05 "agree as
 * recommended" on the S5 Part 0 calls A–H).
 *
 * The child page is the one place every season of a child meets (rep teams and house league together). It READS: the
 * seasons with each season's own fees (read from that season's book, never recomputed), the papers per TEAM (the same rule
 * and count as the coach's Family tab, the Rep Teams board and the Families book — never pooled across teams, S5 call D),
 * the health values and the once-a-season check, and the parents. It has no add-player door (Ask 8) and, until S6, no
 * "Split records" (S5 call B — a button that does nothing would be a small lie).
 *
 * ⚠ PURE (no database). Client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { fmt } from './coach-money-summary';
import { pluralize, possessive } from './utils';
import { theSeason } from './season-roll-path';
import type { DocumentStateRow, SeasonDocument } from './document-state';
import { DOCUMENT_TYPE_LABEL, VALIDITY_LABEL } from './document-state';
import type { RepDocumentType } from './types';
import { formatStoredDate } from './timezone';

// ── The seasons table ──────────────────────────────────────────────────────────────────────────

export type ChildSeasonStatus = 'active' | 'inactive' | 'finished' | 'in_review' | 'waitlisted' | 'withdrawn';

export const SEASON_STATUS_LABEL: Record<ChildSeasonStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  finished: 'Finished',
  in_review: 'In review',
  waitlisted: 'Waitlisted',
  withdrawn: 'Withdrawn',
};
export const SEASON_STATUS_TONE: Record<ChildSeasonStatus, 'good' | 'warn' | 'neutral'> = {
  active: 'good',
  inactive: 'neutral',
  finished: 'neutral',
  in_review: 'warn',
  waitlisted: 'neutral',
  withdrawn: 'neutral',
};

/** A rep entry's standing on its season: a closed season is Finished whatever the entry said. */
export function repSeasonStatus(entryStatus: string, seasonLive: boolean): ChildSeasonStatus {
  if (!seasonLive) return 'finished';
  return entryStatus === 'active' ? 'active' : 'inactive';
}

/** A house-league sign-up's standing: an accepted child on a finished season is Finished; the rest say what they are. */
export function leagueSeasonStatus(regStatus: string, seasonFinished: boolean): ChildSeasonStatus {
  if (regStatus === 'withdrawn') return 'withdrawn';
  if (regStatus === 'waitlisted') return seasonFinished ? 'finished' : 'waitlisted';
  if (regStatus === 'pending_review') return seasonFinished ? 'finished' : 'in_review';
  return seasonFinished ? 'finished' : 'active';
}

/** A season's fees, in cents, as that season's book shows them. */
export interface SeasonFees { duesCents: number; paidCents: number; balanceCents: number }

/** "Paid in full" · "$1,450.00 · $725.00 paid" · "No dues" — a rep season's figure in one cell. */
export function repFeesLine(f: SeasonFees | null): string {
  if (!f || (f.duesCents === 0 && f.paidCents === 0)) return 'No dues';
  if (f.duesCents > 0 && f.balanceCents <= 0) return 'Paid in full';
  return `${fmt(f.duesCents / 100)} · ${fmt(f.paidCents / 100)} paid`;
}

/** A house-league sign-up's fee: "No fee" when the season sets none; nothing owed until the child is accepted. */
export function leagueFeesLine(f: { feeCents: number | null; paidCents: number; balanceCents: number }, status: ChildSeasonStatus): string {
  if (f.feeCents == null || f.feeCents === 0) return 'No fee';
  if (status === 'in_review' || status === 'waitlisted') return 'Not owed yet';
  if (f.paidCents >= f.feeCents) return 'Paid in full';
  // The book owes nothing on a sign-up that is not active (withdrawn; or waitlisted/in review on a season that has since
  // finished): say what was received, never a "$X · $Y paid" that reads as money still owing.
  if (f.balanceCents === 0) return f.paidCents > 0 ? `${fmt(f.paidCents / 100)} paid` : status === 'withdrawn' ? 'Nothing paid' : 'Nothing owed';
  return `${fmt(f.feeCents / 100)} · ${fmt(f.paidCents / 100)} paid`;
}

export interface ChildSeasonRow {
  key: string;
  kind: 'rep' | 'league';
  /** The season's own name ("2027 Season", "Summer 2025") — a club's season name is data. */
  seasonName: string;
  /** The year a season sorts by (a rep season's year; a house-league season's start year). */
  year: number;
  /** The team (rep) or "U10 Rookie · Blue Jays" (house league). */
  where: string;
  number: string | null;
  status: ChildSeasonStatus;
  fees: string;
  /** A live season (rep draft/active; house league not finished). */
  live: boolean;
}

/** Newest first; within a year a live season first, then rep before house league, then by name. */
export function sortSeasonRows<T extends Pick<ChildSeasonRow, 'year' | 'live' | 'kind' | 'seasonName' | 'where'>>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => b.year - a.year
    || Number(b.live) - Number(a.live)
    || (a.kind === b.kind ? 0 : a.kind === 'rep' ? -1 : 1)
    || a.seasonName.localeCompare(b.seasonName)
    || a.where.localeCompare(b.where));
}

/** The title's identity chip: where the child plays now ("Lynx 12U AAA · 2027", "House league · Summer 2027"), or null. */
export function currentChip(rows: readonly ChildSeasonRow[]): string | null {
  const now = sortSeasonRows(rows).find(r => r.live && (r.status === 'active' || r.status === 'in_review' || r.status === 'waitlisted'));
  if (!now) return null;
  return now.kind === 'rep' ? `${now.where} · ${now.year}` : `House league · ${now.seasonName}`;
}

/** The phone's row line under "2027 Season · Lynx 12U AAA": "#7 · $725.00 of $1,450.00 paid" style, from the cell. */
export function seasonRowPhoneLine(r: ChildSeasonRow): string {
  return [r.number ? `#${r.number}` : null, r.kind === 'league' ? r.where : null, r.fees].filter(Boolean).join(' · ');
}
export function seasonRowPhoneTitle(r: ChildSeasonRow): string {
  return `${r.seasonName} · ${r.kind === 'rep' ? r.where : 'House league'}`;
}

// ── "With the {team} {years}" (the coach's player page — own team only, Ask 9; S5 call E) ─────────

/** "2026 · 2027"; a run of three or more years reads "2022–2025" ("2022–2025 · 2027"). */
export function yearsLine(years: readonly number[]): string {
  const ys = [...new Set(years)].filter(y => Number.isFinite(y) && y > 0).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < ys.length;) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    if (j - i >= 2) parts.push(`${ys[i]}–${ys[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(ys[k]));
    i = j + 1;
  }
  return parts.join(' · ');
}

/** Shown only for a child with two or more seasons on this team — on a first season it would repeat the page's team. */
export function withTeamLine(teamName: string, years: readonly number[]): string | null {
  if (new Set(years).size < 2) return null;
  const name = teamName.trim().replace(/^the\s+/i, '');
  return `With the ${name} ${yearsLine(years)}`;
}

// ── The household's one line per child (tab 8) ──────────────────────────────────────────────────

/** "3 seasons · 2 documents to sign" — each half only when it says something. */
export function householdChildSub(seasons: number, toSign: number): string | null {
  const parts = [
    seasons > 1 ? pluralize(seasons, 'season') : null,
    toSign > 0 ? `${pluralize(toSign, 'document')} to sign` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// ── Documents (per team, never pooled — S5 call D) ──────────────────────────────────────────────

export interface ChildDocumentRow {
  documentType: RepDocumentType;
  label: string;
  /** "Signed each season" / "Good until replaced", or null on a team with no working season (history only). */
  validity: string | null;
  /** The coach's rule for the row (null = history only). Counts and sentences read this, never the chip's words. */
  state: 'on_file' | 'needs_signing' | null;
  /** "Needs signing" / "On file", or null (history only). */
  chip: string | null;
  tone: 'good' | 'warn' | null;
  /**
   * LAST SIGNED (owner 2026-11-05, drawing https://claude.ai/artifact/58oV67ka48y4yCFPqWneya, "proceed as recommended"):
   * the newest copy — "2026 Season", a house-league summer ("Summer 2025" over "House league"), or, for a
   * good-until-replaced document, its date. Null when nothing was ever signed (the cell's dash). This season's own copy
   * counts (A1): an on-file row reads "2027 Season", never a dash that could read as never signed.
   */
  last: { text: string; houseLeague: boolean; isDate: boolean } | null;
  /** EVERY copy, newest first by date, rep and house league in one list — the window behind "+N earlier" (N = length − 1).
   *  A replaced good-until-replaced copy is here too (A4). */
  copies: DocumentCopy[];
}

/** One signed copy: a team's upload, or a waiver accepted at a house-league sign-up. */
export interface DocumentCopy {
  /** "2026 Season" / "Summer 2025". */
  seasonName: string;
  houseLeague: boolean;
  /** The stored timestamp: when the copy was recorded on the team, or when the sign-up accepted the waiver. */
  at: string;
}

/** A house-league sign-up that accepted the waiver. */
export interface LeagueWaiver {
  seasonName: string;
  acceptedAt: string;
}

/** A stored timestamp as a sort key; one that will not parse sorts last rather than scrambling the order (NaN). */
const sortKey = (at: string) => Date.parse(at) || 0;

/** Newest first by date; the house-league waivers sort IN, never appended after the team's copies (the old History bug). */
export function documentCopies(documents: readonly SeasonDocument[], leagueWaivers: readonly LeagueWaiver[] = []): DocumentCopy[] {
  const copies: DocumentCopy[] = [
    ...documents.map(d => ({ seasonName: d.seasonName, houseLeague: false, at: d.createdAt })),
    ...leagueWaivers.map(w => ({ seasonName: w.seasonName, houseLeague: true, at: w.acceptedAt })),
  ];
  return copies.sort((a, b) => sortKey(b.at) - sortKey(a.at));
}

/** A copy's name: its season, or — when the season's record is missing (the reader gives '') — its date, never a blank. */
export function copyName(c: DocumentCopy): string {
  return c.seasonName || formatStoredDate(c.at);
}

/** The row's one value: the season's name, or the date for a document that stays good until it is replaced. */
function lastSigned(copies: readonly DocumentCopy[], byDate: boolean): ChildDocumentRow['last'] {
  const c = copies[0];
  if (!c) return null;
  const isDate = byDate || !c.seasonName;
  return { text: isDate ? formatStoredDate(c.at) : c.seasonName, houseLeague: c.houseLeague, isDate };
}

/** The rows for one team: the working season's state per type (the coach's rows) and each type's last signed copy. */
export function documentRows(p: {
  state: readonly DocumentStateRow[];
  documents: readonly SeasonDocument[];
  /** House-league sign-ups that accepted the waiver — copies of the Waiver row. */
  leagueWaivers?: readonly LeagueWaiver[];
}): ChildDocumentRow[] {
  return p.state.map(s => {
    const copies = documentCopies(
      p.documents.filter(d => d.documentType === s.documentType),
      s.documentType === 'waiver' ? p.leagueWaivers : [],
    );
    return {
      documentType: s.documentType, label: s.label, validity: VALIDITY_LABEL[s.validity],
      state: s.state, chip: s.chip, tone: s.state === 'on_file' ? 'good' : 'warn',
      last: lastSigned(copies, s.validity === 'good_until_replaced'), copies,
    };
  });
}

/** A team with no working season: what was signed, with no state — each type's last copy by season. */
export function historyOnlyRows(documents: readonly SeasonDocument[], leagueWaivers: readonly LeagueWaiver[] = []): ChildDocumentRow[] {
  const order: RepDocumentType[] = ['waiver', 'code_of_conduct', 'medical_consent', 'other'];
  return order.flatMap(t => {
    const copies = documentCopies(documents.filter(d => d.documentType === t), t === 'waiver' ? leagueWaivers : []);
    return copies.length
      ? [{ documentType: t, label: DOCUMENT_TYPE_LABEL[t], validity: null, state: null, chip: null, tone: null, last: lastSigned(copies, false), copies }]
      : [];
  });
}

/** The phone's one sentence: "Waiver and code of conduct need signing for 2027. Medical consent on file." */
export function documentsSentence(rows: readonly ChildDocumentRow[], seasonYear: number | null): string {
  const need = rows.filter(r => r.state === 'needs_signing').map(r => r.label);
  const have = rows.filter(r => r.state === 'on_file').map(r => r.label);
  const list = (xs: string[]) => xs.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1)))
    .reduce((s, x, i, a) => (i === 0 ? x : i === a.length - 1 ? `${s} and ${x}` : `${s}, ${x}`), '');
  const parts: string[] = [];
  if (need.length) parts.push(`${list(need)} ${need.length === 1 ? 'needs' : 'need'} signing${seasonYear ? ` for ${seasonYear}` : ''}.`);
  if (have.length) parts.push(`${list(have)} on file.`);
  if (!parts.length) return rows.length ? 'Signed copies from earlier seasons.' : 'No documents on file.';
  return parts.join(' ');
}

// ── Words ─────────────────────────────────────────────────────────────────────────────────────

export const CHILD_PAGE_WORDS = {
  families: 'Families',
  seasons: 'Seasons',
  documents: 'Documents',
  health: 'Health and emergency',
  parents: 'Parents',
  colSeason: 'Season',
  colWhere: 'Team or division',
  colNumber: '#',
  colStatus: 'Status',
  colFees: 'Fees',
  colDocument: 'Document',
  colFor: (year: number) => `For ${year}`,
  colLastSigned: 'Last signed',
  houseLeague: 'House league',
  /** "+3 earlier" — opens every copy. */
  earlier: (n: number) => `+${n} earlier`,
  earlierLabel: (doc: string, n: number) => `${doc}: ${pluralize(n, 'earlier copy', 'earlier copies')}`,
  /** The window: "Waiver" under "Avery Park · S5 Lynx". */
  copiesEyebrow: (child: string, where: string) => `${child} · ${where}`,
  copiesCount: (n: number) => `${pluralize(n, 'signed copy', 'signed copies')}, newest first.`,
  colDate: 'Date',
  colHow: 'How',
  howUploaded: 'Uploaded',
  howSignUp: 'Accepted at sign-up',
  /** The child with no rep team: "House league: Summer 2029 waiver accepted at sign-up." */
  leagueOnlyWaiver: (seasonName: string) => `${seasonName} waiver accepted at sign-up.`,
  waiver: 'Waiver',
  born: (dob: string) => `Born ${formatStoredDate(dob)}`,
  medicalNote: 'Medical note',
  emergencyContact: 'Emergency contact',
  nothingOnFile: 'Nothing on file',
  noSeasons: 'No seasons on record.',
  noDocuments: 'No documents on file. A coach uploads them on the player’s Family & paperwork tab.',
  noParents: 'No parent on file. The coach adds one on the roster.',
  typedOnly: 'Typed on the roster · not in the Families book yet',
  openFamily: (name: string) => `Open ${possessive(name)} family`,
  teamDocs: (team: string, seasonName: string | null) => (seasonName ? `${team} · ${seasonName}` : `${team} · earlier seasons`),
  confirm: 'Confirm',
  confirming: 'Confirming…',
  confirmed: (seasonName: string) => `Confirmed for ${theSeason(seasonName)}.`,
  confirmFailed: 'Could not confirm. Try again.',
  loadFailed: 'We couldn’t load this child.',
  notFound: 'This child isn’t in your club’s records.',
  loading: 'Loading this child…',
  /** The household line's door and the roster's name link (screen-reader name). */
  openChild: (name: string) => `Open ${possessive(name)} page`,
  toSign: (n: number) => `${n} to sign`,
} as const;

/** The club's health Confirm: nothing to confirm when no live entry asks (409's words). */
export const HEALTH_NOTHING_TO_CONFIRM = 'There is nothing to confirm for this season.';