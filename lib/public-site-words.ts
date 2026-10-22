/**
 * lib/public-site-words.ts — EVERY WORD ON THE PUBLIC-SITE EDITOR (Club Tier Stage 4c-1; written by /marketing
 * 2026-10-21 and approved by the owner — docs/projects/active/CLUB_TIER_STAGE4C1_COPY.md, which this mirrors). One home,
 * so the editor and its windows never spell a thing twice. The section rows' state lines live with their rule
 * (lib/club-site-sections.ts), the refusals with theirs (lib/site-field-checks.ts, lib/public-site-patch.ts), the
 * notice's clock with its (lib/club-notice.ts).
 */

import { possessive } from './utils';

export const PUBLIC_SITE_WORDS = {
  title: 'Public site',
  online: 'Online',
  offline: 'Offline',
  familiesSeeItAt: 'Families see it at',
  copyLink: 'Copy link',
  copied: 'Copied',
  open: 'Open',
  saveFailed: "Couldn't save your changes. Try again.",

  // ── The builder (Public site builder, ruled 2026-10-21; drawing https://claude.ai/artifact/LSWvZmV9r1772Zt4etqcaM) ──
  // The five rows, in order (Look, Home page, About the club, Contacts and documents, Visibility).
  lists: 'Contacts and documents',
  visibility: 'Visibility',
  setupTitle: 'Set up your site',
  // Said only while the site is offline (a new club's site starts online): what families meet, in plain words.
  setupLeadOffline: (ready: number, of: number) => `${ready} of ${of} ready. Families can't see your site until you go live, and you can go live whenever you like.`,
  setupLeadOnline: (ready: number, of: number) => `${ready} of ${of} ready. Your site is online, so families see each change as you make it.`,
  setupLeadAdmin: "When it's ready, the owner puts it online.",
  goLive: 'Go live',
  goingLive: 'Going live…',
  rowReady: 'Ready',
  rowToDo: 'Not set up yet',
  /** The closed rows' one-line summaries. */
  homeSummary: (n: number, first: string | null) => first ? `${n} ${n === 1 ? 'section' : 'sections'} · ${first} first` : 'Every section is hidden',
  aboutSummary: (parts: string[]) => parts.join(' · '),
  aboutNoTagline: 'No tagline yet',
  aboutNoEmail: 'No email for questions yet',
  socialCount: (n: number) => `${n} social ${n === 1 ? 'link' : 'links'}`,
  listsSummary: (c: number, d: number, q: number) =>
    [c ? `${c} ${c === 1 ? 'contact' : 'contacts'}` : null, d ? `${d} ${d === 1 ? 'document' : 'documents'}` : null, q ? `${q} ${q === 1 ? 'question' : 'questions'}` : null]
      .filter(Boolean).join(' · ') || 'Optional · none yet',
  // `noun` is the directory's name in the switch's own label (club, league or organization), so the two read alike.
  visibilitySummary: (on: boolean, listed: boolean, noun = 'club') => on ? (listed ? `Online · listed in the ${noun} directory` : `Online · not in the ${noun} directory`) : 'Offline',
  lookSummaryBanner: 'banner photo',

  // The preview (A1, A2, A9)
  preview: 'Preview',
  previewComputer: 'Computer',
  previewPhone: 'Phone',
  previewOffline: 'Only you and your admins can see this. Your site is offline.',
  previewFoot: 'This is your home page as families see it. Click any part to change it.',
  previewLoading: 'Loading the preview…',
  previewEditIn: (row: string) => `Change in ${row}`,
  previewFrameTitle: 'Your home page, as families see it',

  // Look (moved in from Settings, A3, A4, A6)
  logo: 'Logo',
  uploadLogo: 'Upload a logo',
  replaceLogo: 'Replace logo',
  browseStock: 'Browse stock logos',
  removeImage: 'Remove',
  uploading: 'Uploading…',
  logoHint: 'JPG, PNG or WebP, up to 2 MB.',
  noLogo: 'No logo',
  colours: 'Colours',
  fromLogo: 'From your logo',
  ownColours: 'Your own colours',
  mainColour: 'Main colour',
  accentColour: 'Accent colour',
  type: 'Type',
  typeLooks: { classic: 'Classic', serif: 'Serif', clean: 'Clean' } as Record<'classic' | 'serif' | 'clean', string>,
  typeSample: 'Teams and tryouts',
  banner: 'Banner photo',
  uploadBanner: 'Upload a photo',
  replaceBanner: 'Replace photo',
  bannerHint: 'Shows across the top of your home page on a computer. Phones leave it out. A wide photo works best, about 16 by 5. JPG, PNG or WebP, up to 4 MB.',
  stockTitle: 'Choose a stock logo',
  useThisLogo: 'Use this logo',
  // "Use", as the server's own refusal says it (app/api/admin/org-logo-stock) — and never "unlock" (brand voice).
  stockLocked: (plan: string) => `Upgrade to ${plan} to use this icon.`,
  lookFailed: "Couldn't save the look. Try again.",

  // Visibility (moved in from Settings; the owner's alone, Option A)
  siteSwitch: 'Public site',
  // The switch's words as Settings said them (Club Tier Stage 4a, through /marketing 2026-10-20) — moved, not rewritten.
  siteOnHint: (club: string, url: string) => `${possessive(club)} public site at ${url} is online. Turning it off takes all of the club’s pages offline: home, teams, tryouts and their sign-up, league, archives and team calendars. Tournament pages stay up.`,
  siteOffHint: (club: string, url: string) => `${possessive(club)} public site at ${url} is offline. Families who open any of its pages see that the club’s site isn’t available. Tournament pages stay up.`,
  directorySwitch: (noun: string) => `Listed in the ${noun} directory`,
  directoryHint: (club: string) => `Families searching FieldLogicHQ’s directory can find ${club}. Your site stays online either way.`,
  directoryOffHint: 'When the public site is off, the directory switch is off too.',
  webAddress: 'Web address',
  changeAddress: 'Change it in Settings',
  visibilityAdmin: 'The owner turns the site on and off and changes its address.',
  yes: 'Yes.',
  no: 'No.',
  onlineWord: 'Online.',
  offlineWord: 'Offline.',
  offlineAsk: (club: string) => `Take ${possessive(club)} public site offline?`,
  offlineAskBody: 'Families who open your home, team, tryout, league or archive pages will see that the site isn’t available. Tryout sign-ups stop, and team calendars go empty. Tournament pages stay up. You can turn it back on at any time.',
  keepOnline: 'Keep it online',
  takeOffline: 'Take it offline',
  takingOffline: 'Taking it offline…',
  nowOnline: 'Your public site is online.',
  nowOffline: 'Your public site is offline.',
  nowListed: 'Listed in the directory.',
  nowUnlisted: 'No longer listed in the directory.',
  switchFailed: "That didn't save. Try again.",

  // The club notice's strip (A7)
  noticeNone: 'No notice showing.',
  postANotice: 'Post a notice',
  editNotice: 'Edit',
  editNoticeTitle: 'Edit the notice',
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
