/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SIGN-UP FORM, AS A FAMILY MEETS IT — pure rules shared by the sign-up page, Your sign-up and the routes
 * (Board Ready Stage 4 Part 2; drawing tabs 5 and 7; plan BOARD_READY_PLAN.md §5 Stage 4). No I/O: the server module
 * (`lib/club-form-server.ts`) reads the form; this file decides what an answer is and whether it is acceptable.
 *
 *   SignupFormView   what the page is drawn with: the live questions (offered choices only, never a count) and the live
 *                    documents at their current version, plus a STAMP of what a family must act on, so a form the club
 *                    changed while the family filled it in comes back instead of being saved half-matched.
 *   readAnswer       one answer, checked against its question's type (the page shows the same words the route sends).
 *   tickState        whether a sign-up's tick on a document stands, needs a new tick, or was never made (ruling 8).
 *
 * The family side never says "form" (ruling 19).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { FORM_LIMITS, type DocumentSource, type QuestionAsked, type QuestionType, type TickKind } from './club-form';
import { isCalendarDate } from './timezone';
import { isUuid } from './utils';
import { fileSizeWords } from './permit-words';

export type SignupQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  helpText: string | null;
  /** The choices still offered, in order. */
  choices: { id: string; label: string }[];
  required: boolean;
  asked: QuestionAsked;
  health: boolean;
};

export type SignupDocument = {
  id: string;
  name: string;
  tickKind: TickKind;
  /** The exact sentence ticked (kept on every tick). */
  sentence: string;
  source: DocumentSource;
  versionId: string;
  versionNo: number;
  /** Typed text, read in place; null for a PDF. */
  text: string | null;
  /** A PDF's size in bytes (its Open line); null for text. */
  fileSize: number | null;
  /** A PDF's file name as the club uploaded it (the consent ledger names it); null for text. */
  fileName: string | null;
};

export type SignupFormView = {
  questions: SignupQuestion[];
  documents: SignupDocument[];
  /** What a family acts on, printed: the questions (type, required, asked, offered choices) and each document's current
   *  version. Words and help text are left out on purpose: the club fixing a typo never sends a family back. */
  stamp: string;
};

/** At most five files on one child's sign-up (ruling 9), and five on the sign-up's own questions. */
export const FILES_PER_SIGNUP = 5;

/** What the page sends for one question. Only the field for the question's type is read. */
export type AnswerIn = { questionId: string; text?: string; choiceIds?: string[]; bool?: boolean | null; date?: string; fileId?: string };

/** An answer as saved (the database's columns, by name). */
export type AnswerOut = { questionId: string; text?: string; choiceIds?: string[]; bool?: boolean; date?: string; fileId?: string };

export const perChildQuestions = (v: Pick<SignupFormView, 'questions'>) => v.questions.filter(q => q.asked === 'per_subject');
export const onceQuestions = (v: Pick<SignupFormView, 'questions'>) => v.questions.filter(q => q.asked === 'once');

const textMax = (t: QuestionType) => (t === 'short_answer' ? 300 : 5000);

/** One choice uses round buttons up to four and a dropdown from five (drawing tab 2), at every width. */
export const usesDropdown = (q: Pick<SignupQuestion, 'type' | 'choices'>) => q.type === 'one_choice' && q.choices.length > 4;

/**
 * The noun a "Choose …" sentence can carry: a short label that isn't itself a question ("T-shirt size" → "a T-shirt
 * size"); null for a label written as a question, which is quoted instead.
 */
function asNoun(label: string): string | null {
  const l = label.trim();
  const words = l.split(/\s+/);
  // A plural ("Allergies", "Sizes") reads wrongly after "a"/"an": it is quoted instead, like a label written as a question.
  if (/[?.!:]$/.test(l) || words.length > 4 || /^(the|a|an|your|our)$/i.test(words[0]) || /[^s]s$/i.test(words[words.length - 1])) return null;
  // Lower-cased only when it reads as ordinary words: "T-shirt size", "AGM role" and "Jersey Name" keep their capitals.
  const first = words[0];
  const keep = /^[A-Z](?![a-z])/.test(first) || /[A-Z]/.test(first.slice(1)) || words.slice(1).some(w => /^[A-Z]/.test(w));
  const inner = keep ? l : first.charAt(0).toLowerCase() + l.slice(1);
  // "an" before a vowel sound: "an AGM role", "an extra"; "a uniform size", "a UK size" ("u" sounds like "you" there).
  return `${/^([aeio]|u(?!ni|se|k\b|s\b))/i.test(inner) ? 'an' : 'a'} ${inner}`;
}

/**
 * The words under a question the family left empty or got wrong, naming the child for a question asked about each child
 * (drawing tab 5: "Choose a T-shirt size for Leo."). `who` is the child's first name, or null for the sign-up's own.
 */
export function answerError(q: Pick<SignupQuestion, 'type' | 'label'>, who: string | null, kind: 'missing' | 'invalid'): string {
  const forWho = who ? ` for ${who}` : '';
  const quoted = `“${q.label.trim()}”`;
  if (kind === 'invalid') {
    if (q.type === 'date') return `Check the date for ${quoted}${forWho}.`;
    if (q.type === 'file') return `Choose the file again for ${quoted}${forWho}.`;
    return `Check the answer to ${quoted}${forWho}.`;
  }
  const noun = asNoun(q.label);
  switch (q.type) {
    case 'one_choice':
    case 'many_choices':
      return noun ? `Choose ${noun}${forWho}.` : `Answer ${quoted}${forWho}.`;
    case 'yes_no':
      return `Choose yes or no for ${quoted}${forWho}.`;
    case 'date':
      return `Enter a date for ${quoted}${forWho}.`;
    default:
      return `Answer ${quoted}${forWho}.`;
  }
}

/** The name the error box uses for a question ("T-shirt size for Leo", "“How did you hear about us?”"). */
export function answerName(q: Pick<SignupQuestion, 'label'>, who: string | null): string {
  const l = q.label.trim();
  const named = /[?.!:]$/.test(l) ? `“${l}”` : l;
  return who ? `${named} for ${who}` : named;
}

/**
 * One answer read against its question. `null` value = nothing given (blank text, no choice, no file). The route and the
 * page call it alike; `error` is 'invalid' for a value the question can't hold (a choice it doesn't offer, a bad date).
 */
export function readAnswer(q: SignupQuestion, raw: AnswerIn | undefined): { value: AnswerOut | null } | { error: 'invalid' } {
  if (!raw) return { value: null };
  const base = { questionId: q.id };
  switch (q.type) {
    case 'short_answer':
    case 'long_answer': {
      const t = typeof raw.text === 'string' ? raw.text.trim() : '';
      if (!t) return { value: null };
      return { value: { ...base, text: t.slice(0, textMax(q.type)) } };
    }
    case 'one_choice':
    case 'many_choices': {
      const offered = new Set(q.choices.map(c => c.id));
      const ids = Array.isArray(raw.choiceIds) ? [...new Set(raw.choiceIds.filter((x): x is string => typeof x === 'string'))] : [];
      if (ids.length === 0) return { value: null };
      if (ids.some(id => !offered.has(id)) || (q.type === 'one_choice' && ids.length > 1)) return { error: 'invalid' };
      // In the question's own order, so a list reads the same however it was ticked.
      return { value: { ...base, choiceIds: q.choices.map(c => c.id).filter(id => ids.includes(id)) } };
    }
    case 'yes_no':
      return typeof raw.bool === 'boolean' ? { value: { ...base, bool: raw.bool } } : { value: null };
    case 'date': {
      const d = typeof raw.date === 'string' ? raw.date.trim() : '';
      if (!d) return { value: null };
      return isCalendarDate(d) ? { value: { ...base, date: d } } : { error: 'invalid' };
    }
    case 'file': {
      const id = typeof raw.fileId === 'string' ? raw.fileId : '';
      if (!id) return { value: null };
      return isUuid(id) ? { value: { ...base, fileId: id } } : { error: 'invalid' };
    }
  }
}

/**
 * A set of answers to some questions, checked: each answer read, each required question answered (a file question is
 * never required, ruling 9). `key` names an error's place on the page; `who` names the child in its words.
 */
export function checkAnswers(
  questions: readonly SignupQuestion[], raw: readonly AnswerIn[] | undefined, who: string | null, key: (questionId: string) => string,
): { answers: AnswerOut[]; errors: Record<string, string>; missing: string[] } {
  const byId = new Map((raw ?? []).filter(a => a && typeof a.questionId === 'string').map(a => [a.questionId, a]));
  const answers: AnswerOut[] = [];
  const errors: Record<string, string> = {};
  const missing: string[] = [];
  for (const q of questions) {
    const r = readAnswer(q, byId.get(q.id));
    if ('error' in r) { errors[key(q.id)] = answerError(q, who, 'invalid'); continue; }
    if (r.value) answers.push(r.value);
    else if (q.required && q.type !== 'file') { errors[key(q.id)] = answerError(q, who, 'missing'); missing.push(key(q.id)); }
  }
  return { answers, errors, missing };
}

/** How many of a set of questions an answer list answers, and how many it doesn't (Your sign-up's folded row). */
export function answeredCount(questions: readonly Pick<SignupQuestion, 'id'>[], answered: ReadonlySet<string>): { answered: number; notYet: number } {
  const n = questions.filter(q => answered.has(q.id)).length;
  return { answered: n, notYet: questions.length - n };
}

/** A version of a document, as a tick reads it (newest first in every list here). */
export type VersionStep = { id: string; versionNo: number; ticksStand: boolean | null };

/**
 * A sign-up's tick on a document (ruling 8). `current`: ticked on the current version. `stands`: ticked on an earlier
 * version and every version since let ticks stand. `again`: a version since then asked families to tick again ("Needs a
 * new tick"). `none`: never ticked (a document added after the family signed up). A tick recorded before documents had
 * versions (the waiver move) counts as a tick on version 1 (plan, carried to Part 3).
 */
export function tickState(versions: readonly VersionStep[], ticks: readonly { versionId: string | null; moved: boolean }[]): 'current' | 'stands' | 'again' | 'none' {
  const current = versions[0];
  if (!current) return 'none';
  if (ticks.some(t => t.versionId === current.id)) return 'current';
  const noOf = new Map(versions.map(v => [v.id, v.versionNo]));
  const ticked = ticks.map(t => (t.moved ? 1 : t.versionId ? noOf.get(t.versionId) ?? 0 : 0)).filter(n => n > 0);
  if (ticked.length === 0) return 'none';
  const newest = Math.max(...ticked);
  return versions.some(v => v.versionNo > newest && v.ticksStand === false) ? 'again' : 'stands';
}

/** A document the family must act on from Your sign-up: a new tick asked for, or one added since they signed up. */
export const needsTick = (state: ReturnType<typeof tickState>) => state === 'again' || state === 'none';

/** The size of a file as a family reads it: "412 KB", "1.2 MB" — the product's one size line. */
export const sizeLine = fileSizeWords;

/** The answers a request sent for some questions: only well-formed entries, at most 100 (both form routes read it). */
export const answersIn = (v: unknown): AnswerIn[] =>
  (Array.isArray(v) ? v.filter((a): a is AnswerIn => !!a && typeof a === 'object' && typeof (a as AnswerIn).questionId === 'string').slice(0, 100) : []);

/**
 * The consent ledger's evidence (mig 252) for a sign-up's documents: each tick's sentence and what was read — a typed
 * text in full, a PDF by its file's name and version (its bytes are kept on the version; the fingerprint on each tick).
 */
export function signupConsentText(documents: readonly Pick<SignupDocument, 'sentence' | 'text' | 'fileName' | 'name' | 'versionNo'>[]): string | null {
  if (documents.length === 0) return null;
  return documents.map(d => [d.sentence, d.text ?? `The PDF “${d.fileName ?? d.name}”, version ${d.versionNo}.`].join('\n\n')).join('\n\n———\n\n');
}

/** A family's file, checked in the browser before it travels (the server checks the bytes again). */
export function fileRefusal(f: { size: number; type: string; name: string }): 'too_big' | 'type' | null {
  if (f.size > FORM_LIMITS.fileBytes) return 'too_big';
  const ext = f.name.toLowerCase().split('.').pop() ?? '';
  const okType = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(f.type);
  const okExt = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext);
  // Some phones send a HEIC photo with no type at all: the name decides then.
  return okType || (!f.type && okExt) ? null : 'type';
}

/** True for a file the family will read as "a photo" in the size line. */
export const isPhoto = (f: { type: string; name: string }) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif)$/i.test(f.name);
