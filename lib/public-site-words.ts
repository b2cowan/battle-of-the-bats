/**
 * lib/public-site-words.ts — EVERY WORD ON THE PUBLIC-SITE EDITOR (Club Tier Stage 4c-1; written by /marketing
 * 2026-10-21 and approved by the owner — docs/projects/active/CLUB_TIER_STAGE4C1_COPY.md, which this mirrors). One home,
 * so the editor and its windows never spell a thing twice. The section rows' state lines live with their rule
 * (lib/club-site-sections.ts), the refusals with theirs (lib/site-field-checks.ts, lib/public-site-patch.ts), the
 * notice's clock with its (lib/club-notice.ts).
 */

export const PUBLIC_SITE_WORDS = {
  title: 'Public site',
  online: 'Online',
  offline: 'Offline',
  familiesSeeItAt: 'Families see it at',
  copyLink: 'Copy link',
  copied: 'Copied',
  open: 'Open',
  onOwner: 'It is on.',
  turnOff: 'Turn it off in Settings',
  onAdmin: 'It is on. The owner turns it on and off in Settings.',
  offLead: "Your site is off, so families can't see it.",
  turnOn: 'Turn it on in Settings',
  offAdmin: 'The owner turns it on and off in Settings.',
  saveFailed: "Couldn't save your changes. Try again.",
  loading: 'Loading the public site…',
  loadFailed: "Couldn't load the public site.",
  noAccessTitle: 'Access restricted',
  noAccess: "You don't have access to the public site. Ask your organization's owner.",
  readOnly: 'Only an owner or admin can change the public site.',

  // Home page
  homePage: 'Home page',
  homeLead: 'What families see on your home page, in this order. Open now always comes first and shows only while something is open.',
  alwaysFirst: 'Always first',
  /** Open now's locked row, said aloud (copy table B), and its shorter line on a phone (drawings ~L1541). */
  openNowLocked: 'Open now always comes first',
  openNowPhoneSub: 'Open tryouts and sign-ups',
  reorderFailed: "Couldn't save the new order. Try again.",

  // About the club
  aboutCard: 'About the club',
  tagline: 'Tagline',
  taglinePlaceholder: 'Rep baseball, ages 9 to 16',
  taglineHint: (n: number, max: number) => `One line under your name. ${n} / ${max}`,
  about: 'About',
  aboutPlaceholder: 'Who you are, who plays, and when your season runs.',
  aboutHint: (n: number, max: number) => `${n} / ${max}`,
  questionsGoTo: "Families' questions go to",
  questionsGoToPlaceholder: 'info@yourclub.ca',
  questionsGoToHint: 'Shown in your footer and on every team and tryout page.',

  // Social links
  social: 'Social links',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  website: 'Website',

  // Look
  look: 'Look',
  lookLeadOwner: 'Your logo, colours and font are set in Organization › Settings. This is how families see them.',
  lookLeadAdmin: 'The owner sets your logo, colours and font in Organization › Settings. This is how families see them.',
  changeInSettings: 'Change in Settings',
  ownerChanges: 'The owner changes these in Settings.',

  // Club notice
  notice: 'Club notice',
  noticeLead: 'One line at the top of every public page, such as a field closure. It ends by itself.',
  noticeField: 'Notice',
  noticePlaceholder: 'All diamonds are closed tonight',
  detailField: 'More detail',
  detailPlaceholder: 'Rain. Every game and practice tonight is cancelled.',
  ends: 'Ends',
  // Owner 2026-10-21: the words the banner uses ("ends tonight", "ends tomorrow night") — "Tomorrow at midnight" read
  // as tonight.
  endsTonight: 'Tonight',
  endsTomorrow: 'Tomorrow night',
  endsPick: 'Pick a date and time',
  endsDate: 'Date',
  endsTime: 'Time',
  postNotice: 'Post notice',
  updateNotice: 'Update notice',
  endNow: 'End now',
  showingNow: 'Showing now',
  posting: 'Posting…',
  posted: 'Notice posted. Families see it now.',
  updated: 'Notice updated.',
  ended: 'Notice ended.',
  postFailed: "Couldn't post the notice. Try again.",
  endFailed: "Couldn't end the notice. Try again.",
  noticeEmpty: 'Write the notice line first.',
  pastTime: "Pick a time that hasn't passed yet.",

  // Lists
  contacts: 'Who to contact',
  contactsLead: 'Up to twelve. Families see them on your About page.',
  addContact: 'Add a contact',
  editContact: 'Edit contact',
  role: 'Role or name',
  rolePlaceholder: 'Registration',
  email: 'Email',
  emailPlaceholder: 'registrar@yourclub.ca',
  removeContact: 'Remove contact',
  contactSaved: 'Contact saved.',
  contactRemoved: 'Contact removed.',

  documents: 'Documents and policies',
  documentsLead: 'Links to what you already publish. Families open them from your About page.',
  addDocument: 'Add a document',
  editDocument: 'Edit document',
  heading: 'Heading',
  docTitle: 'Title',
  docTitlePlaceholder: 'Parent code of conduct',
  link: 'Link',
  linkPlaceholder: 'https://yourclub.ca/conduct.pdf',
  removeDocument: 'Remove document',
  documentSaved: 'Document saved.',
  documentRemoved: 'Document removed.',

  questions: 'Questions families ask',
  questionsLead: 'Short answers to what you get asked every spring. Up to ten.',
  addQuestion: 'Add a question',
  editQuestion: 'Edit question',
  question: 'Question',
  questionPlaceholder: 'When do tryouts start?',
  answer: 'Answer',
  answerPlaceholder: 'Tryouts run Sep 7–9. Dates are on the Tryouts page.',
  removeQuestion: 'Remove question',
  questionSaved: 'Question saved.',
  questionRemoved: 'Question removed.',

  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  keepIt: 'Keep it',
  remove: 'Remove',
  removeAsk: (name: string) => `Remove ${name}?`,
  removeBody: 'Families will no longer see it.',
  removeFailed: "Couldn't remove it. Nothing was changed.",
  edit: (name: string) => `Edit ${name}`,
  /** A list row missing a field: "Add the role or name first." (said by the window and by the route). */
  missing: (label: string) => `Add the ${label.toLowerCase()} first.`,
  /** A list at its cap: "You have twelve contacts. Remove one to add another." */
  listFull: (max: number, noun: 'contacts' | 'documents' | 'questions') =>
    `You have ${({ 10: 'ten', 12: 'twelve', 30: 'thirty' } as Record<number, string>)[max] ?? max} ${noun}. Remove one to add another.`,
  noticeTooLong: (max: number) => `The notice can be up to ${max} characters.`,
  detailTooLong: (max: number) => `The detail can be up to ${max} characters.`,
} as const;
