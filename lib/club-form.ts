/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SIGN-UP FORM — the model and its rules, as pure functions (Board Ready Stage 4; owner rulings 1–20,
 * 2026-11-20; drawing BOARD_READY_STAGE4_FORMS_DRAWINGS.html; plan BOARD_READY_PLAN.md §5 Stage 4).
 *
 * A form belongs to its OWNER (a house-league season now; a camp, a sponsorship package, a tryout later) and never says
 * "house league". Its SUBJECT KIND decides what the builder offers: a form about children (`child_signup`) has the two
 * "Asked" groups and the Health switch; a business's form (`business`, Stage 6) has neither (drawing tab 9).
 *
 *   questions   seven types, required (a file question never), help text, a set order, NO BRANCHING (ruled). Two groups
 *               (ruling 1): "For each child" (default) and "Once per sign-up". Type and group lock once answered.
 *   documents   a PDF or a typed text; the tick "I have read {doc}." or "I have read and agree to {doc}." (ruling 2); always
 *               required; versions keep their ticks (ruling 8). Documents and ticks are NEVER behind a plan gate.
 *
 * No I/O here: the page, the windows and the routes read the same rules, and `tests/unit/club-form.test.ts` pins them.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type FormOwnerTable = 'league_seasons' | 'organizations';
export type FormSubjectKind = 'child_signup' | 'business';

/**
 * WHAT A FORM'S EDITOR OFFERS, by who answers it (Board Ready Stage 6, ask 8). A season's sign-up asks about each child or
 * once per family, can mark health and can show on the draft board; the club's sponsorship form is answered by one
 * business, so it has none of the three ("no 'for each child' groups and no Health switch").
 */
export type FormShape = { perSubject: boolean; healthSwitch: boolean; boardSwitch: boolean };
export const SEASON_FORM_SHAPE: FormShape = { perSubject: true, healthSwitch: true, boardSwitch: true };
export const BUSINESS_FORM_SHAPE: FormShape = { perSubject: false, healthSwitch: false, boardSwitch: false };
export const formShape = (kind: FormSubjectKind): FormShape => (kind === 'business' ? BUSINESS_FORM_SHAPE : SEASON_FORM_SHAPE);

export type QuestionType = 'short_answer' | 'long_answer' | 'one_choice' | 'many_choices' | 'yes_no' | 'date' | 'file';
export const QUESTION_TYPE_VALUES: readonly QuestionType[] = [
  'short_answer', 'long_answer', 'one_choice', 'many_choices', 'yes_no', 'date', 'file',
];
/** "For each child" (per subject) or "Once per sign-up". */
export type QuestionAsked = 'per_subject' | 'once';

/** A choice keeps its id for life, so renaming it renames its answers and removing it keeps them (drawing tab 7). */
export type QuestionChoice = { id: string; label: string; offered: boolean };

export type FormQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  helpText: string | null;
  choices: QuestionChoice[];
  required: boolean;
  asked: QuestionAsked;
  health: boolean;
  onBoard: boolean;
  sortOrder: number;
  archivedAt: string | null;
  /** How many children (per child) or sign-ups (once) have answered — a count, never an answer. */
  answers: number;
};

export type DocumentSource = 'pdf' | 'text';
export type TickKind = 'read' | 'read_agree';

export type DocumentVersion = {
  id: string;
  versionNo: number;
  createdAt: string;
  /** Typed text, or null for a PDF. */
  bodyText: string | null;
  fileName: string | null;
  fileSize: number | null;
  /** What changed, as families read it beside a tick-again (null for version 1, and optional when ticks stand). */
  reason: string | null;
  /** For version 2 on: true = the ticks on the version before stand; false = families must tick again. */
  ticksStand: boolean | null;
  /** Version 1 made by the waiver move (today's waiver text, moved in). */
  movedIn: boolean;
  /** SHA-256 (hex) of the exact bytes or text: what every tick on this version saw. */
  fingerprint: string;
  /** Ticks on this version (one per child), and the families behind them (a count; never who). */
  ticks: number;
  families: number;
};

export type FormDocument = {
  id: string;
  name: string;
  source: DocumentSource;
  tickKind: TickKind;
  sortOrder: number;
  archivedAt: string | null;
  /** Newest first; the first is the current version. A document moved in with no text can have none. */
  versions: DocumentVersion[];
  /** Ticks recorded before documents had versions (the waiver move), shown apart from any version, and their families. */
  movedTicks: number;
  movedFamilies: number;
};

/** What the season's other screens say about its form: live questions, live documents (names, in order). */
export type FormFacts = {
  questions: number;
  documents: string[];
  /** The form printed by content (Start next season's "From {season}" mark clears when it changes). */
  print: string;
  /** It asks a health or a file question (any, archived too): the finish confirm says when those answers are removed. */
  removesOnClock?: boolean;
};

/** The longest a question, its help text, a choice and a document's name may be. */
export const FORM_LIMITS = {
  label: 200,
  help: 500,
  choice: 80,
  choices: 40,
  docName: 80,
  docText: 20000,
  reason: 300,
  /** A PDF a club uploads and a file a family attaches: 8 MB (ruling 9; the proxy buffers 10 MB). */
  fileBytes: 8 * 1024 * 1024,
} as const;

/** One choice: round buttons up to four, a dropdown from five, at every width (drawing tab 2). */
export const ROUND_BUTTONS_MAX = 4;

export const hasChoices = (t: QuestionType) => t === 'one_choice' || t === 'many_choices';

/** A file question can't be required (ruling 9: a failed upload never blocks a sign-up). */
export const canBeRequired = (t: QuestionType) => t !== 'file';

/** "Show on the draft board" is off by default and never for a health question (ruling 12). */
export const canShowOnBoard = (health: boolean) => !health;

/** The rules a question is saved under, whatever it was sent: no required file, no health question on the board. */
export function settledQuestion<T extends { type: QuestionType; required: boolean; health: boolean; onBoard: boolean }>(q: T): T {
  return { ...q, required: canBeRequired(q.type) && q.required, onBoard: canShowOnBoard(q.health) && q.onBoard };
}

/**
 * The words that suggest a question asks about health (ruling 5): the window offers the switch, never blocks. Whole-word
 * match, so "conditioning drills" doesn't trip "condition"; plurals and the common forms are listed.
 */
const HEALTH_WORDS = [
  'allergy', 'allergies', 'allergic', 'medical', 'medication', 'medications', 'medicine', 'asthma', 'asthmatic', 'epipen',
  'epi-pen', 'doctor', 'medical condition', 'medical conditions', 'health condition', 'injury', 'injuries', 'injured',
  'diabetes', 'diabetic', 'seizure', 'seizures', 'epilepsy', 'concussion', 'concussions', 'disability', 'disabilities',
  'diagnosis', 'diagnosed', 'health', 'inhaler', 'anaphylaxis', 'adhd', 'autism', 'heart', 'surgery', 'prescription',
  'physician', 'nurse',
  // /legal 2026-11-20: a missed health question is the costly side, so the list errs wide.
  'special needs', 'dietary', 'diet', 'mobility', 'mental', 'anxiety', 'vision', 'hearing', 'glasses', 'accommodation',
  'accommodations', 'wheelchair', 'therapy', 'therapist',
];
const HEALTH_RE = new RegExp(`\\b(${HEALTH_WORDS.map(w => w.replace(/[-]/g, '\\-').replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

/** True when the question's words look medical (the window asks "Does this ask about health?" while the switch is off). */
export function looksLikeHealth(label: string, helpText?: string | null): boolean {
  return HEALTH_RE.test(`${label} ${helpText ?? ''}`);
}

/** The text and file types carry the health-card line in the builder (/legal). */
export const asksForTyping = (t: QuestionType) => t === 'short_answer' || t === 'long_answer' || t === 'file';

/**
 * The choices box (one per line) read against the choices a question has, so a choice keeps its id (and its answers)
 * through an edit: a line with the same words keeps its choice; a new line in the place of a choice that left is its
 * rename (YM → Youth medium, its answers follow); any other new line is a new choice, and a choice no line keeps is no
 * longer offered (its answers stay as given). Duplicate lines count once.
 */
export function linesToChoices(text: string, offered: readonly Pick<QuestionChoice, 'id' | 'label'>[]): { id: string | null; label: string }[] {
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map(l => l.trim().slice(0, FORM_LIMITS.choice)).filter(l => {
    const k = l.toLowerCase();
    if (!l || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, FORM_LIMITS.choices);
  const byWords = new Map(offered.map(c => [c.label.trim().toLowerCase(), c.id]));
  const out: { id: string | null; label: string }[] = lines.map(l => ({ id: byWords.get(l.toLowerCase()) ?? null, label: l }));
  const used = new Set(out.map(c => c.id).filter(Boolean));
  out.forEach((c, i) => {
    const before = offered[i];
    if (c.id === null && before && !used.has(before.id)) { c.id = before.id; used.add(before.id); }
  });
  return out;
}

/**
 * A choices list saved from the record's form: the client sends {id?, label} per line, in order. A line that keeps an id
 * renames that choice (its answers follow); a line without one is new; an id left out stays, no longer offered.
 */
export function choicesFromEdit(
  sent: readonly { id?: string | null; label: string }[], existing: readonly QuestionChoice[], newId: () => string,
): QuestionChoice[] {
  const had = new Map(existing.map(c => [c.id, c]));
  const used = new Set<string>();
  const out: QuestionChoice[] = [];
  // A line without a known id that has a saved choice's exact words IS that choice (a window whose list was read before
  // its last save sends the same line again without an id; it must not mint a duplicate and retire the first).
  const byWords = (label: string) => existing.find(c => !used.has(c.id) && c.label.trim().toLowerCase() === label.toLowerCase())?.id;
  for (const s of sent.slice(0, FORM_LIMITS.choices)) {
    const label = String(s.label ?? '').trim().slice(0, FORM_LIMITS.choice);
    if (!label) continue;
    const id = s.id && had.has(s.id) && !used.has(s.id) ? s.id : byWords(label) ?? newId();
    used.add(id);
    out.push({ id, label, offered: true });
  }
  for (const c of existing) if (!used.has(c.id)) out.push({ ...c, offered: false });
  return out;
}

export const offeredChoices = (q: Pick<FormQuestion, 'choices'>) => q.choices.filter(c => c.offered);

/** What a question is saved as (the table's columns), read from a create or an edit. */
export type QuestionWrite = {
  question_type: QuestionType; label: string; help_text: string | null; choices: QuestionChoice[];
  required: boolean; asked: QuestionAsked; health: boolean; on_board: boolean;
};

/**
 * A question's create or edit, checked. `existing` is the saved question for an edit (null to create); a field the body
 * leaves out keeps its saved value. Refusals are the window's own sentences. Type and "Asked" lock once answered
 * (ruling 7); "Asked" is absent on a form with one kind of answerer (`perSubject` false, a sponsor's link).
 */
export function readQuestionInput(
  body: Record<string, unknown>, existing: FormQuestion | null, newId: () => string, opts: { perSubject: boolean; healthSwitch: boolean; boardSwitch?: boolean },
): { write: QuestionWrite } | { error: string } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : null);
  const label = 'label' in body ? str(body.label) : existing?.label ?? null;
  if (!label) return { error: 'Write the question to save it.' };
  if (label.length > FORM_LIMITS.label) return { error: `Keep the question under ${FORM_LIMITS.label} characters.` };
  const help = 'helpText' in body ? str(body.helpText) || null : existing?.helpText ?? null;
  if (help && help.length > FORM_LIMITS.help) return { error: `Keep the help text under ${FORM_LIMITS.help} characters.` };

  const type = ('type' in body ? body.type : existing?.type ?? 'short_answer') as QuestionType;
  if (!QUESTION_TYPE_VALUES.includes(type)) return { error: 'Choose a type.' };
  const asked = (opts.perSubject ? ('asked' in body ? body.asked : existing?.asked ?? 'per_subject') : 'once') as QuestionAsked;
  if (asked !== 'per_subject' && asked !== 'once') return { error: 'Choose who it asks about.' };
  if (existing && isAnswered(existing)) {
    if (type !== existing.type) return { error: 'People have answered it, so its type stays. To ask it differently, archive it and add a new question.' };
    if (asked !== existing.asked) return { error: 'People have answered it, so who it asks about stays. To ask it differently, archive it and add a new question.' };
  }

  let choices = existing?.choices ?? [];
  if ('choices' in body) {
    if (!Array.isArray(body.choices)) return { error: 'Invalid choices' };
    const sent = (body.choices as unknown[]).map(c => (typeof c === 'string' ? { label: c } : (c ?? {}) as { id?: string; label?: string }))
      .map(c => ({ id: typeof c.id === 'string' ? c.id : null, label: typeof c.label === 'string' ? c.label : '' }));
    choices = choicesFromEdit(sent, existing?.choices ?? [], newId);
  }
  if (hasChoices(type) && !choices.some(c => c.offered)) return { error: 'Give it at least one choice to save it.' };

  const health = opts.healthSwitch && ('health' in body ? body.health === true : existing?.health ?? false);
  // /legal 2026-11-20: Your sign-up hides a health answer's words by the question's mark as it is NOW, so the mark can't come
  // off once people have answered (their words would then show on a page opened from an emailed link). Turning it ON is always fine.
  if (existing && opts.healthSwitch && existing.health && !health && isAnswered(existing)) {
    return { error: 'People have answered it, so it stays marked as health. To ask it without that mark, archive it and add a new question.' };
  }
  const settled = settledQuestion({
    type,
    required: 'required' in body ? body.required === true : existing?.required ?? false,
    health,
    // A form with no draft board (the sponsorship form, `boardSwitch: false`) never shows an answer on one.
    onBoard: opts.boardSwitch !== false && ('onBoard' in body ? body.onBoard === true : existing?.onBoard ?? false),
  });
  return { write: {
    question_type: type, label, help_text: help, choices, required: settled.required, asked, health, on_board: settled.onBoard,
  } };
}

/**
 * The document's name inside a sentence: "the waiver", "the code of conduct". The first letter is lowered only when the
 * name reads as ordinary words (a name like "Riverdale Code of Conduct" or "AGM rules" keeps its capitals).
 */
export function docInSentence(name: string): string {
  // A trailing full stop would double ("the waiver.."); a name that brings its own determiner keeps it, lower-cased
  // ("Our code of conduct" → "our code of conduct", "The Waiver" → "the waiver"); every other name takes "the".
  const n = name.trim().replace(/[.!?;:,]+$/, '');
  const own = /^(the|our|this|a|an|my|your)\s+(.+)$/i.exec(n);
  const det = own ? own[1].toLowerCase() : 'the';
  const rest = own ? own[2] : n;
  const words = rest.split(/\s+/);
  const first = words[0] ?? '';
  const properish = /[A-Z]/.test(first.slice(1)) || words.slice(1).some(w => /^[A-Z]/.test(w));
  const body = properish ? rest : rest.charAt(0).toLowerCase() + rest.slice(1);
  return `${det} ${body}`;
}

/** The tick's exact sentence (ruling 2). It is kept on every tick as the words the family ticked. */
export function tickSentence(name: string, kind: TickKind): string {
  const doc = docInSentence(name);
  return kind === 'read_agree' ? `I have read and agree to ${doc}.` : `I have read ${doc}.`;
}

export const currentVersion = (d: Pick<FormDocument, 'versions'>): DocumentVersion | null => d.versions[0] ?? null;

/** A document families tick on the sign-up page: not archived and with a current version. */
export const isLiveDocument = (d: Pick<FormDocument, 'archivedAt' | 'versions'>) => !d.archivedAt && d.versions.length > 0;

/** A question families answer on the sign-up page. */
export const isLiveQuestion = (q: Pick<FormQuestion, 'archivedAt'>) => !q.archivedAt;

/** Type and "Asked" lock once anyone has answered (ruling 7). */
export const isAnswered = (q: Pick<FormQuestion, 'answers'>) => q.answers > 0;

/** A question is deleted only while nobody has answered it; after that it is archived. */
export const canDeleteQuestion = (q: Pick<FormQuestion, 'answers'>) => !isAnswered(q);

/** Anyone has ticked a document, on any version or before versions (the tick's words lock then). */
export const isTicked = (d: Pick<FormDocument, 'versions' | 'movedTicks'>) => d.movedTicks > 0 || d.versions.some(v => v.ticks > 0);
