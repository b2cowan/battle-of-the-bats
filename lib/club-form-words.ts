/**
 * THE CLUB'S SIGN-UP FORM — every word the club's side says (Board Ready Stage 4 Part 1). Drawn words are drafts until
 * the /marketing pass confirms them (ruling 19): club side "Sign-up form", "Your questions", "Documents to read", groups
 * "For each child" / "Once per sign-up". The family side never says "form" (Part 2).
 */
import { docInSentence, tickSentence, type QuestionAsked, type QuestionType, type TickKind } from './club-form';
import { formatStoredDate } from './timezone';
import { joinWithAnd, pluralize, possessive } from './utils';

export const QUESTION_TYPE_WORDS: ReadonlyArray<{ value: QuestionType; label: string }> = [
  { value: 'short_answer', label: 'Short answer' },
  { value: 'long_answer', label: 'Long answer' },
  { value: 'one_choice', label: 'One choice' },
  { value: 'many_choices', label: 'Many choices' },
  { value: 'yes_no', label: 'Yes or no' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File upload' },
];
export const typeLabel = (t: QuestionType) => QUESTION_TYPE_WORDS.find(x => x.value === t)?.label ?? 'Short answer';

export const ASKED_WORDS: ReadonlyArray<{ value: QuestionAsked; label: string }> = [
  { value: 'per_subject', label: 'For each child' },
  { value: 'once', label: 'Once per sign-up' },
];
export const askedLabel = (a: QuestionAsked) => ASKED_WORDS.find(x => x.value === a)?.label ?? 'For each child';

export const FORM_WORDS = {
  // ── The Registration block's fact (drawing tab 1) ──
  fact: 'Sign-up form',
  door: 'Open the sign-up form',

  // ── The page ──
  title: 'Sign-up form',
  back: 'Overview',
  loadFailed: 'The sign-up form didn’t load.',
  loading: 'Loading the sign-up form…',
  lockLine: 'This season is finished. Its sign-up form is locked.',

  // ── Every sign-up asks (locked) ──
  fixedTitle: 'Every sign-up asks',
  fixedChip: 'Locked',
  fixedSum: 'Can’t be removed',
  fixedFoot: 'These place each child in a division and feed the draft, the fees and the emails. Your questions follow them.',
  fixedChild: 'For each child',
  fixedGuardian: 'The parent or guardian',
  fixedEnd: 'At the end',
  show: 'Show',
  hide: 'Hide',

  // ── Your questions ──
  questionsTitle: 'Your questions',
  lede: 'Families answer these after the details every sign-up asks for, in this order.',
  noQuestions: 'No questions yet.',
  noQuestionsLine: 'Every sign-up already asks for the details above. Add a question to ask for more.',
  noQuestionsLinePhone: 'Add a question to ask for more.',
  noQuestionsCopyLine: 'Every sign-up already asks for the details above. Add a question, or start from last season’s form.',
  addQuestion: 'Add a question',
  addQuestionAction: 'Add question',
  adding: 'Adding…',
  planLocked: 'Your own questions are available on League Plus and above.',
  seePlans: 'See plans',

  // ── Documents to read ──
  documentsTitle: 'Documents to read',
  addDocument: 'Add a document',
  addDocumentAction: 'Add document',
  noDocuments: 'No documents yet.',
  documentsFoot: 'Every document is required.',
  documentsEveryPlan: 'Documents and their ticks are on every plan.',

  // ── A question's window ──
  question: 'Question',
  helpText: 'Help text',
  helpHint: 'Shown under the question in smaller type.',
  type: 'Type',
  asked: 'Asked',
  choices: 'Choices',
  choicesHint: 'One per line. A choice you remove stays on the answers that chose it.',
  required: 'Required',
  requiredHint: 'A family can’t sign up without answering it.',
  requiredFile: 'A file question can’t be required, so a failed upload never stops a sign-up.',
  health: 'Health or medical',
  healthHint: 'It asks about health, medical needs or a disability.',
  board: 'Show on the draft board',
  boardHint: 'Not for a health question.',
  boardFact: 'Draft board',
  retiredChoices: (labels: readonly string[]) => `No longer offered: ${labels.join(' · ')}. Answers that chose ${labels.length === 1 ? 'it' : 'them'} stay as given.`,
  healthOn: 'Its answers stay out of list columns, the draft board and emails, and out of exports unless asked for. Ask only what a coach needs to keep a child safe.',
  healthAsk: 'Does this ask about health?',
  healthTurnOn: 'Turn on',
  healthCard: 'Don’t ask for a health card number or a photo of one.',
  lockedWhy: (n: number, asked: QuestionAsked) =>
    `${asked === 'once' ? pluralize(n, 'sign-up') : pluralize(n, 'child', 'children')} answered, so the type and who it asks about stay as they are. To ask it differently, archive it and add a new question.`,
  notAskedFoot: (n: number) => `${pluralize(n, 'sign-up')} so far will read “Not asked”.`,
  questionHeld: 'Write the question to save it.',
  choicesHeld: 'Give it at least one choice to save it.',
  yes: 'Yes',
  no: 'No',
  shown: 'Shown',
  notShown: 'Not shown',
  answers: 'Answers',
  answersNone: 'None yet',
  answersCount: (n: number, asked: QuestionAsked) => (asked === 'once' ? pluralize(n, 'sign-up') : pluralize(n, 'child', 'children')),
  archive: 'Archive this question',
  archiveNote: 'Answers already given stay on each registration and in the export, under “No longer asked”.',
  archiveAsk: (label: string) => ({
    title: `Archive “${label}”?`,
    body: 'It leaves the sign-up page. Answers already given stay on each registration and in the export, under “No longer asked”.',
    action: 'Archive',
  }),
  delete: 'Delete this question',
  deleteNote: 'Nobody has answered it yet, so it can be deleted.',
  deleteAsk: (label: string) => ({ title: `Delete “${label}”?`, body: 'It leaves the sign-up form for good.', action: 'Delete' }),
  keep: 'Keep it',
  cancel: 'Cancel',
  edit: (name: string) => `Edit ${name}`,
  noun: 'question',
  saveFailed: 'Couldn’t save',
  addFailed: 'Couldn’t add it. Nothing was changed.',
  archiveFailed: 'Couldn’t archive it. Nothing was changed.',
  deleteFailed: 'Couldn’t delete it. Nothing was changed.',
  orderFailed: 'The new order didn’t save.',

  // ── A document's windows (drawing tab 3) ──
  docName: 'Name',
  docNameHint: (name: string, kind: TickKind) => `Families see it in the tick: “${tickSentence(name || 'Document', kind)}”`,
  docSource: 'What families read',
  docSourcePdf: 'A PDF you upload',
  docSourceText: 'Text you type',
  docText: 'The text',
  docChoose: 'Choose a PDF',
  docChooseAnother: 'Choose another file',
  docPdfHint: 'A PDF up to 8 MB. Have a Word file? Choose File → Save as PDF.',
  docTick: 'The tick',
  docTickOther: (name: string, kind: TickKind) => `Or “${tickSentence(name || 'Document', kind === 'read' ? 'read_agree' : 'read')}”`,
  docPdfFoot: 'Families must open a PDF before they can tick it.',
  docHeldName: 'Name the document to save it.',
  docHeldFile: 'Choose the PDF families read.',
  docHeldText: 'Type the text families read.',
  docTooBig: 'That file is over 8 MB. Choose a smaller PDF.',
  docNotPdf: 'That file isn’t a PDF. Choose a PDF.',
  docTickLocked: 'Families have ticked it, so its tick stays as it is. To ask for a different tick, archive it and add a new document.',
  docFamiliesRead: 'Families read',
  docReadAll: 'Read it all',
  docReadLess: 'Show less',
  docOpen: 'Open',
  docVersions: 'Versions',
  docVersion: (n: number) => `Version ${n}`,
  docCurrent: 'Current',
  docReplace: 'Replace with a new version',
  docArchive: 'Archive this document',
  docKeepNote: 'A version with ticks is never deleted. An archived document leaves the sign-up page; its ticks stay on each registration.',
  docArchiveAsk: (name: string) => ({
    title: `Archive “${name}”?`,
    body: 'It leaves the sign-up page. Its ticks stay on each registration.',
    action: 'Archive',
  }),
  docArchiveFailed: 'Couldn’t archive it. Nothing was changed.',
  docNoun: 'document',
  docMovedTicks: (n: number) => `${pluralize(n, 'tick')} recorded before documents had versions`,
  docArchivedNoText: 'Archived. There was no waiver text to bring across, so there is no version to show. Ticks recorded earlier stay on each registration.',

  // Replace (drawing tab 3)
  replaceTitle: (name: string) => `Replace ${docInSentence(name)}`,
  replaceMeta: (from: number) => `Version ${from} → version ${from + 1}`,
  replaceWho: (from: number) => `Families who ticked version ${from}`,
  replaceStand: 'Their tick stands',
  replaceStandSub: (families: number, from: number) => `For a typo or a clearer copy. ${pluralize(families, 'family', 'families')} stay ticked on version ${from}.`,
  replaceAgain: 'They must tick again',
  replaceAgainSub: (families: number, to: number, pdf: boolean) =>
    `${pluralize(families, 'sign-up')} show “Needs a new tick” until the family ${pdf ? 'opens' : 'reads'} version ${to} and ticks it on their sign-up page. Their places aren’t affected, and nobody is emailed automatically.`,
  replaceReason: 'What changed',
  replaceReasonHint: 'Families see this beside the new tick.',
  replaceReasonHeld: 'Say what changed, so families know why they tick again.',
  replaceFoot: (from: number, ticks: number) => `Version ${from} and its ${pluralize(ticks, 'tick')} are kept.`,
  replaceAction: 'Replace',
  replacing: 'Replacing…',
  replaceFailed: 'Couldn’t replace it. Nothing was changed.',
  replaceSame: 'That’s the same as the current version.',

  // ── Copy (drawing tab 4) ──
  copyButton: (season: string) => `Copy ${possessive(season)} form`,
  copyTitle: (season: string) => `Copy ${possessive(season)} form?`,
  copyBody: (season: string, questions: number, documents: number) =>
    `Adds ${joinWithAnd([questions ? pluralize(questions, 'question') : '', documents ? pluralize(documents, 'document') : ''].filter(Boolean))} to this season’s form. Nothing families answered in ${season} is copied.`,
  copyAction: 'Copy the form',
  copying: 'Copying…',
  copyFailed: 'Couldn’t copy the form. Nothing was added.',
} as const;

/** The fixed fields (drawing tab 1's locked card). The friends line only while the season takes friend requests. */
export function fixedFields(friendMax: number, clubName: string, asksEmailConsent: boolean): { child: string[]; guardian: string[]; end: string[] } {
  return {
    child: [
      'First and last name', 'Date of birth', 'Division',
      ...(friendMax > 0 ? [`Friends to play with (up to ${friendMax})`] : []),
      'Jersey number, position and notes',
    ],
    guardian: ['First and last name', 'Email', 'Phone', 'Second parent’s email'],
    end: asksEmailConsent ? [`${clubName} may email me about future seasons and club news`] : [],
  };
}

/** "Every sign-up asks · 10 details". */
export const foldedLine = (n: number) => `${FORM_WORDS.fixedTitle} · ${pluralize(n, 'detail')}`;

/** The card summary: "5 questions" / "No questions yet". */
export const questionsSummary = (n: number) => (n === 0 ? 'No questions yet' : pluralize(n, 'question'));

/** The Registration block's fact value (drawing tab 1): "No questions of your own · 1 document to read". */
export function formFactLine(questions: number, documents: readonly string[]): { value: string; sub: string } {
  const q = questions === 0 ? 'No questions of your own' : pluralize(questions, 'question');
  const d = documents.length === 0 ? 'no documents' : `${pluralize(documents.length, 'document')} to read`;
  const names = documents.map(docInSentence);
  const sub = names.length
    ? `${joinWithAnd(names)}, and the details every sign-up asks for.`
    : 'The details every sign-up asks for.';
  return { value: `${q} · ${d}`, sub: sub.charAt(0).toUpperCase() + sub.slice(1) };
}

/** Start next season's line (drawing tab 4): "5 questions and 2 documents. No answers are copied." */
export function copyLineSub(questions: number, documents: number): string {
  const parts = [questions ? pluralize(questions, 'question') : '', documents ? pluralize(documents, 'document') : ''].filter(Boolean);
  return parts.length ? `${joinWithAnd(parts)}. No answers are copied.` : 'Nothing on it yet. No answers are copied.';
}

/**
 * A question row's caption (drawing tab 2): "One choice · 6 choices · required · 41 answers"; a file question counts files.
 * The phone keeps the type and the two marks only ("One choice · required", "Many choices · draft board").
 */
export function questionCaption(q: { type: QuestionType; choices: { offered: boolean }[]; helpText: string | null; required: boolean; onBoard: boolean; answers: number }, phone = false): string {
  const offered = q.choices.filter(c => c.offered).length;
  if (phone) return [typeLabel(q.type), q.required ? 'required' : null, q.onBoard ? 'draft board' : null].filter(Boolean).join(' · ');
  return [
    typeLabel(q.type),
    q.type === 'one_choice' || q.type === 'many_choices' ? pluralize(offered, 'choice') : null,
    q.helpText ? 'help text' : null,
    q.required ? 'required' : null,
    q.onBoard ? 'on the draft board' : null,
    q.answers > 0 ? (q.type === 'file' ? pluralize(q.answers, 'file') : pluralize(q.answers, 'answer')) : null,
  ].filter(Boolean).join(' · ');
}

/** A document row's caption: "Typed text · version 2 · “I have read and agree” · 41 ticks". */
export function documentCaption(d: { source: 'pdf' | 'text'; tickKind: TickKind; versions: { versionNo: number; ticks: number }[]; movedTicks: number }, phone = false): string {
  const kind = d.source === 'pdf' ? 'PDF' : 'Typed text';
  const ticks = d.versions.reduce((n, v) => n + v.ticks, 0) + d.movedTicks;
  const tickWords = ticks === 0 ? 'no ticks yet' : pluralize(ticks, 'tick');
  if (phone) return `${kind} · ${tickWords}`;
  const v = d.versions[0];
  return [
    kind,
    v ? `version ${v.versionNo}` : null,
    d.tickKind === 'read_agree' ? '“I have read and agree”' : '“I have read”',
    tickWords,
  ].filter(Boolean).join(' · ');
}

/** A version row's caption (drawing tab 3): "Since Feb 9, 2027 · 15 ticks · ticks on version 1 stand". */
export function versionCaption(
  v: { versionNo: number; createdAt: string; ticks: number; ticksStand: boolean | null; movedIn: boolean },
  until: string | null,
): string {
  const when = until ? `${formatStoredDate(v.createdAt)} to ${formatStoredDate(until)}` : `Since ${formatStoredDate(v.createdAt)}`;
  const before = v.versionNo - 1;
  return [
    when,
    v.ticks === 0 ? 'no ticks yet' : pluralize(v.ticks, 'tick'),
    v.ticksStand === true ? `ticks on version ${before} stand` : v.ticksStand === false ? `ticks on version ${before} don’t stand` : null,
    v.movedIn ? 'brought across from the season’s waiver' : null,
  ].filter(Boolean).join(' · ');
}

