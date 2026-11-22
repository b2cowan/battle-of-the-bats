/**
 * THE CLUB'S SIGN-UP FORM — every word the FAMILY reads (Board Ready Stage 4 Part 2; drawing tabs 5 and 7). Drawn words
 * are drafts until the /marketing pass confirms them (ruling 19). The family side never says "form": "From {club}",
 * "Questions from {club}", "Documents and agreement". The health line is /legal's.
 */
import { docInSentence, type TickKind } from './club-form';
import { joinWithAnd, possessive } from './utils';

export const FAMILY_FORM_WORDS = {
  // ── The club's privacy link, at the foot of the form when the club has one (published Terms §4: "you can link your own
  //    privacy policy on your forms"). The fixed notice that once sat above the club's questions was removed on the
  //    owner's ask, 2026-11-21 (/legal `CLUB_FORM_NOTICE_REMOVAL.md`): telling families where data is stored is the club's
  //    notice to give, as Terms §4 says, and the default fields never carried one. ──
  privacyLink: (club: string) => `${possessive(club)} privacy policy`,
  fromClub: (club: string) => `From ${club}`,
  questionsFrom: (club: string) => `Questions from ${club}`,
  documentsTitle: 'Documents and agreement',

  // ── A question ──
  /** /legal: under a question marked health or medical. */
  healthLine: (club: string, who: string) => `Only answer what ${club} needs to keep ${who} safe.`,
  yes: 'Yes',
  no: 'No',
  choose: 'Choose one',
  /** An optional round-button question, back to unanswered. */
  choiceClear: 'Clear my answer',

  // ── A file question (tab 5's three moments) ──
  fileChoose: 'Choose a file',
  fileChoosePhone: 'Choose a file or take a photo',
  fileHint: 'A PDF or a photo, up to 8 MB.',
  fileRemove: 'Remove',
  fileCancel: 'Cancel',
  fileTryAgain: 'Try again',
  fileChooseAnother: 'Choose another',
  fileUploading: (name: string) => `Uploading ${name}`,
  fileTooBig: (size: string, photo: boolean) =>
    `This ${photo ? 'photo' : 'file'} is ${size}. The limit is 8 MB. Choose a smaller ${photo ? 'photo' : 'file'} or a PDF.`,
  fileWrongType: 'That file isn’t a PDF or a photo. Choose a PDF, or a JPEG, PNG or HEIC photo.',
  fileFailed: 'It didn’t upload. Check your connection and try again.',
  fileTooMany: (max: number) => `You can attach ${max} files to one child’s sign-up. Remove one to attach another.`,
  uploadingButton: 'Uploading…',

  // ── A document (tab 5) ──
  open: (name: string) => `Open ${docInSentence(name)}`,
  /** The Open button's name for a screen reader: what it is, how big, and that it leaves the page. */
  openName: (name: string, size: string) => `Open ${docInSentence(name)}, PDF, ${size}, opens in a new tab`,
  pdfMeta: (size: string) => `PDF · ${size}`,
  openFirst: 'Open it first to tick.',
  opened: 'Opened. You can now tick.',
  wontOpen: 'Won’t open?',
  downloadInstead: 'Download it instead',
  orContact: (club: string) => `or contact ${club}`,
  docMissing: (name: string, kind: TickKind, pdf: boolean) =>
    pdf ? `Open ${docInSentence(name)} and tick it to sign up.`
      : kind === 'read_agree' ? `Agree to ${docInSentence(name)} to sign up.` : `Tick that you have read ${docInSentence(name)} to sign up.`,
  docNotOpened: (name: string) => `Open ${docInSentence(name)} and tick it to sign up.`,

  // ── Pressing Sign up (tab 5: the count, the first named, focus to the box, "Go to it") ──
  errorsMissing: (n: number, first: string) => `${n === 1 ? '1 answer is' : `${n} answers are`} missing. The first is ${first}.`,
  errorsMixed: (n: number, first: string) => `${n === 1 ? '1 answer needs' : `${n} answers need`} a look. The first is ${first}.`,
  goToIt: 'Go to it',

  // ── A form that changed while the family filled it in (tab 5) ──
  changedQuestion: (club: string) => `${club} added a question while you were filling this in. Everything you typed is still here.`,
  changedDocuments: (club: string) => `${club} updated a document while you were filling this in. Read it and tick it again.`,
  changedOther: (club: string) => `${club} changed its questions while you were filling this in. Check them, then sign up again.`,

  // ── A reload (call C3: typed answers kept for the tab; health answers and files never) ──
  // /legal 2026-11-20: the child's free-text notes often hold an allergy, so they are never kept either.
  reloadLost: (health: boolean, files: boolean, notes = false) => {
    const what = [health && 'answers to health questions', notes && 'additional notes', files && 'attached files'].filter((x): x is string => !!x);
    const act = files ? (notes ? 'enter and attach' : health ? 'answer and attach' : 'attach') : health && !notes ? 'answer' : 'enter';
    const first = joinWithAnd(what);
    return `${first.charAt(0).toUpperCase()}${first.slice(1)} weren’t kept when the page reloaded. Please ${act} them again.`;
  },

  // ── Children ──
  removeAsk: (n: number, name: string, file: boolean) => `Remove Child ${n}? ${possessive(name)} answers${file ? ' and file' : ''} will be cleared.`,
  removeYes: 'Remove',
  removeKeep: 'Keep',
  /** F8: above the parent's section when no child on the page fits a division. */
  noChildFits: 'No child on this page fits a division this season, so there is nothing to sign up yet.',

  // ── The confirmation (F8: every child named, signed up or not) ──
  notSignedUp: (name: string) => `${name} wasn’t signed up.`,
  notSignedUpNoFit: (name: string) => `${name} wasn’t signed up: no division this season fits their age.`,
  notSignedUpFailed: (name: string) => `${name} wasn’t signed up: their answers didn’t save. Sign ${name} up again.`,
  notSignedUpFile: (name: string) => `${name} wasn’t signed up: an attached file was no longer there. Sign ${name} up again and attach it.`,
} as const;

/** Your sign-up's words (tab 7, ruling 20). */
export const YOUR_SIGNUP_FORM_WORDS = {
  // The re-tick block, first on the page while a document needs a new tick.
  retickTitle: (name: string, version: number) => `${name}, version ${version}`,
  retickWhy: (club: string, date: string, reason: string | null, children: number) =>
    `${club} updated it on ${date}${reason ? `: “${reason.trim().replace(/[.!?]+$/, '')}.”` : '.'} Read it and tick to confirm. ${children === 1 ? 'Your child’s place isn’t' : 'Your children’s places aren’t'} affected.`,
  retickNew: (club: string, date: string, children: number) =>
    `${club} added it on ${date}. Read it and tick to confirm. ${children === 1 ? 'Your child’s place isn’t' : 'Your children’s places aren’t'} affected.`,
  retickFor: (names: readonly string[]) => `For ${joinWithAnd([...names])}.`,
  saving: 'Saving…',
  saveFailed: 'It didn’t save. Try again.',
  ticked: (version: number, date: string) => `Ticked version ${version} on ${date}`,
  undo: 'Undo',
  undoFailed: 'Couldn’t undo it. The tick stays.',
  tickedQuiet: (name: string, version: number, date: string) => `You ticked ${docInSentence(name)}, version ${version}, on ${date}.`,

  // The folded answer rows.
  childAnswers: (name: string) => `${possessive(name)} answers`,
  onceAnswers: 'Questions for your sign-up',
  answeredLine: (answered: number, notYet: number, sample: string | null) =>
    [answered > 0 ? `${answered} answered` : null, notYet > 0 ? `${notYet} not answered yet` : sample].filter(Boolean).join(' · ') || 'Not answered yet',
  change: 'Change',
  save: 'Save',
  cancel: 'Cancel',
  saved: 'Saved.',
  notAnsweredYet: 'Not answered yet',
  healthKept: 'Answered. It isn’t shown here, to keep it private. Type a new answer to replace it.',
  healthClear: 'Clear my answer',
  fileClear: 'Remove the file',
  fileKept: (name: string | null) => (name ? `Attached: ${name}` : 'A file is attached.'),
  untilTeams: (club: string, contact: string | null) =>
    `You can change answers until the teams are made. After that, contact ${club}${contact ? `: ${contact}` : '.'}`,
  afterTeams: (club: string, contact: string | null) =>
    `The teams are made. To change an answer, contact ${club}${contact ? `: ${contact}` : '.'}`,
  questionGone: 'A question changed while you were editing. Reload the page and try again.',
} as const;
