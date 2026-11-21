import { formatStoredDate } from './timezone';
import { joinWithAnd, possessive } from './utils';
import { orgClock } from './club-board-view';
import type { QuestionType } from './club-form';

/** Up to three answer columns on Registrations (ruling 11): the window, the list and the server read this one number. */
export const ANSWER_COLUMNS_MAX = 3;

/** A yes-or-no question's two filter rows; a cell's choice ids are the same two. */
export const YES_NO_CHOICES = [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] as const;

/**
 * The club's side of the sign-up form, in words (Board Ready Stage 4 Part 3; drawing tabs 6 and 8). Client-safe: the list,
 * the record window, the export and the board read the same shapes the server sends (`lib/club-form-staff.ts`).
 * Drawn words are drafts confirmed by one /marketing pass; one spelling everywhere (`npm run check:spelling`).
 */

/** One cell of the list, a filter row or an export. A cell is never blank (drawing tab 7: "Not asked", never a blank). */
export type AnswerCell =
  | { state: 'answered'; text: string; choiceIds: string[] }
  | { state: 'not_asked' }
  | { state: 'not_answered' }
  | { state: 'removed'; at: string };

export type GridQuestion = {
  id: string; label: string; type: QuestionType; health: boolean; archived: boolean;
  /** The choices a filter offers (one choice, many choices, yes or no); empty for text, date and file questions. */
  choices: { id: string; label: string }[];
};

export type RecordAnswer = {
  questionId: string; label: string; health: boolean; type: QuestionType;
  /** Asked once per sign-up: the sign-up's children, by first name (a brother's record shows the same answer). */
  once: string[] | null;
  cell: AnswerCell;
  /** A family's file still attached: opened through a one-hour download link. */
  file: { id: string; name: string; size: number } | null;
  /** A health answer the family changed or cleared after first giving it (/legal Part 2 (f)). */
  changedAt: string | null;
  archivedAt: string | null;
};

export type RecordDocument = {
  documentId: string; name: string; sentence: string;
  state: 'current' | 'stands' | 'again' | 'none';
  currentNo: number;
  tick: { versionNo: number | null; at: string; handedOverAt: string | null; moved: boolean; movedOn: string | null } | null;
};

export type RecordAnswers = { answers: RecordAnswer[]; archived: RecordAnswer[]; documents: RecordDocument[] };

export type BoardAnswer = { questionId: string; label: string; text: string; choiceIds: string[] };

/** "Feb 2, 2027, 7:14 p.m." — a stored instant in the club's zone; the clock only through `formatTime`. */
export function stampWords(iso: string): string {
  const clock = orgClock(iso);
  return clock ? `${formatStoredDate(iso)}, ${clock}` : formatStoredDate(iso);
}

/** An answer's value in words: a list cell, a record value, an export cell. A file reads "Attached", never the file. */
export function answerCellText(v: {
  type: QuestionType; text: string | null; bool: boolean | null; date: string | null; file: boolean;
  choices: { label: string | null; offered: boolean }[];
}): string {
  switch (v.type) {
    case 'one_choice':
    case 'many_choices':
      // A removed choice stays on the answers that chose it, marked (drawing tab 7).
      return v.choices.filter(c => c.label).map(c => (c.offered ? c.label! : `${c.label} (no longer offered)`)).join(', ');
    case 'yes_no': return v.bool == null ? '' : v.bool ? 'Yes' : 'No';
    case 'date': return v.date ? formatStoredDate(v.date) : '';
    case 'file': return v.file ? STAFF_FORM_WORDS.attached : '';
    default: return v.text ?? '';
  }
}

/** A cell as a list, a filter's reader or an export writes it. */
export function cellWords(cell: AnswerCell, type: QuestionType): string {
  switch (cell.state) {
    case 'answered': return cell.text || STAFF_FORM_WORDS.notAnswered;
    case 'not_asked': return STAFF_FORM_WORDS.notAsked;
    case 'not_answered': return STAFF_FORM_WORDS.notAnswered;
    case 'removed': return type === 'file' ? STAFF_FORM_WORDS.fileRemoved(cell.at) : STAFF_FORM_WORDS.removed(cell.at);
  }
}

export const STAFF_FORM_WORDS = {
  // The list (drawing tab 6 · A)
  notAsked: 'Not asked',
  notAnswered: 'Not answered',
  attached: 'Attached',
  tools: 'More tools',
  answerColumns: 'Answer columns…',
  answerColumnsTitle: 'Answer columns',
  answerColumnsHint: 'Show up to three answers as columns. Health questions are never a column.',
  answerColumnsFull: 'Three are showing. Untick one to choose another.',
  answerColumnsSaveFailed: 'Your columns weren’t saved. Try again.',
  documentsGroup: 'Documents',
  needsNewTick: 'Needs a new tick',
  noLongerAskedHeader: (label: string) => `${label} (no longer asked)`,

  // The record (drawing tab 6 · B, tab 8 · B)
  answersHead: 'Sign-up answers',
  documentsHead: 'Documents',
  noLongerAsked: 'No longer asked',
  answersLoading: 'Loading answers…',
  answersFailed: 'The answers didn’t load.',
  tryAgain: 'Try again',
  noQuestions: 'The sign-up form asks no questions of its own.',
  noDocuments: 'No documents to tick.',
  // Chips set their own capitals (RepKit .chip); the words are sentence case, one spelling with the Filter's row.
  health: 'Health',
  onceFor: (names: readonly string[]) => `For the whole sign-up (${joinWithAnd(names)})`,
  fileNote: 'The link lasts an hour. Each opening is recorded in the audit log.',
  fileOpening: 'Opening…',
  fileFailed: 'The file didn’t open. Try again.',
  fileOpenName: (name: string) => `${name}, downloads a copy`,
  removed: (at: string) => `Removed ${formatStoredDate(at)}`,
  fileRemoved: (at: string) => `File removed ${formatStoredDate(at)}`,
  // True for both clocks (/legal Part 3 F3): 90 days after the season is finished, or 120 after its last day if it never is.
  removedNote: 'Health answers are removed once a season is over.',
  fileRemovedNote: 'Family files are removed once a season is over.',
  changedByFamily: (at: string) => `Answer changed by the family ${formatStoredDate(at)}`,
  archivedLine: (at: string, child: string) => `Archived ${formatStoredDate(at)}. Kept because ${possessive(child)} family answered it.`,

  // Documents: a tick is never editable. The hand-over is a link opened, never "read" or "viewed" (/legal Part 2 (b)).
  tickLine(d: RecordDocument): string {
    const t = d.tick;
    if (!t) return `Not ticked yet · version ${d.currentNo} is current`;
    if (t.moved) {
      const held = t.movedOn ? `; text as the club held it on ${formatStoredDate(t.movedOn)}` : '';
      return `Ticked ${formatStoredDate(t.at)} · recorded before documents had versions${held}`;
    }
    const opened = t.handedOverAt ? ` · link opened ${stampWords(t.handedOverAt)}` : '';
    // A version is named only when the tick names one (never assumed: this is a consent record).
    const which = t.versionNo != null ? `version ${t.versionNo} ` : '';
    if (d.state === 'current') return t.versionNo != null ? `Version ${t.versionNo} · ticked ${stampWords(t.at)}${opened}` : `Ticked ${stampWords(t.at)}${opened}`;
    if (d.state === 'stands') return `Ticked ${which}on ${stampWords(t.at)} · the tick stands for version ${d.currentNo}`;
    return `Ticked ${which}on ${stampWords(t.at)} · version ${d.currentNo} is current`;
  },

  // The export (drawing tab 6 · C, ruling 13)
  healthExport: 'Excel with contact details and health answers',
  healthExportHint: 'Answers about children’s health. Keep it private.',
  healthExportFailed: 'The health answers didn’t load, so nothing was exported. Try again.',

  // A finished season's form page (tab 8; the finish confirm's own line is in lib/house-league-status-words.ts)
  questionRemovedCaption: (type: QuestionType, at: string) =>
    type === 'file' ? `files removed ${formatStoredDate(at)}` : `answers removed ${formatStoredDate(at)}`,
} as const;

/** The season's answers as the list, the filter and the exports read them (lib/club-form-staff.ts `readSeasonAnswerGrid`). */
export type SeasonAnswerGrid = {
  formId: string;
  /** The form asks a health question (the list never carries one; this only offers the opt-in export). */
  hasHealth: boolean;
  /** The form's questions the reader may see, in the form's order: live first, then archived (under "No longer asked"). */
  questions: GridQuestion[];
  /** Per registration, per question id. */
  cells: Record<string, Record<string, AnswerCell>>;
  /** Registrations with a document asking them for a new tick (drawing tab 6, Documents › Needs a new tick). */
  needsTick: string[];
};

/** What the Registrations list's read carries of the form (never a health answer): the grid and this person's columns. */
export type StaffFormGrid = SeasonAnswerGrid & { columns: string[] };

/** A cell in words, or "Not asked" for a registration the grid has no cell for. */
export const gridCellText = (g: SeasonAnswerGrid | null, regId: string, q: Pick<GridQuestion, 'id' | 'type'>): { text: string; dim: boolean } => {
  const cell = g?.cells[regId]?.[q.id];
  return cell ? { text: cellWords(cell, q.type), dim: cell.state !== 'answered' } : { text: STAFF_FORM_WORDS.notAsked, dim: true };
};
