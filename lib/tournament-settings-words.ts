/**
 * RULES & RESOURCES, REGISTRATION QUESTIONS AND NOTIFICATIONS, IN WORDS — one home (Tournament admin redesign Stage 5,
 * E6; hub v45, ruled as drawn 2026-10-10; the words are /marketing's, `.probe/s5b/words-final.md` §8).
 *
 *   - One save model: a record reads first, its pencil edits all of it, which saves itself; Delete or Archive ends it;
 *     adding one asks. No browser alert or confirm anywhere: a mistake under its field, a failure in the pill, a question
 *     in the product's window.
 *   - Order is the portal's reorder standard (owner 2026-10-12, superseding A54's Tools → Reorder mode): each row's
 *     handle drags (hold it on a phone), and a tap on it offers Move up · Move down · Cancel (ReorderList).
 *   - Notifications keep today's ten event names (the words list's "today's").
 *
 * Pure, so a plain Node unit test reads it.
 */
import { andList } from './tournament-board-words.ts';
import type { TournamentRegistrationFieldType } from './types.ts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ── Reorder: the portal's standard (ReorderList; /marketing 2026-10-12) ───────────────────────────────────────────
// No Reorder mode, no Done, no arrow pair, no hint line: the handle drags, a tap on it opens the menu. The menu closes
// on a move, so its last word is Cancel (the lineup builder's, D8).
export const ORDER_WORDS = {
  /** The handle's name: "Hotel block, 2 of 5. Drag to move, or press for options." */
  handle: (name: string, place: string) => `${name}, ${place}. Drag to move, or press for options.`,
  options: (name: string) => `Options for ${name}`,
  position: (place: number, of: number) => `${place} of ${of}`,
  moveUp: 'Move up',
  moveDown: 'Move down',
  cancel: 'Cancel',
  saveFailed: 'Couldn’t save the order',
} as const;

// ── Rules & resources ─────────────────────────────────────────────────────────────────────────────────────────────
/** The public page's section icons (`components/public/RulesContent`), named for the organizer. */
export const RULE_ICONS = [
  { value: 'Shield', label: 'Shield' },
  { value: 'BookOpen', label: 'Book' },
  { value: 'AlertCircle', label: 'Warning' },
  { value: 'CheckCircle', label: 'Tick' },
  { value: 'Info', label: 'Information' },
  { value: 'HelpCircle', label: 'Question mark' },
] as const;

export const RULES_WORDS = {
  title: 'Rules & resources',
  rules: 'Rules',
  rulesCaption: 'As families read them on the public site',
  addSection: 'Add a section',
  addSectionAction: 'Add section',
  adding: 'Adding…',
  noRules: 'No rules yet. Add a section, or start from a sample.',
  sample: 'Start from a sample',
  sampleCaption: 'Common sections to copy and change',
  resources: 'Resources & downloads',
  addResource: 'Add a link or file',
  noResources: 'No links or files yet.',
  tools: 'Tools',
  rulesLayout: 'Rules on the public site',
  oneColumn: 'One column',
  twoColumns: 'Two columns',
  resourcesLayout: 'Resources on the public site',
  aList: 'A list',
  layoutFailed: 'Couldn’t save the layout',
  loadFailed: 'The rules didn’t load.',
  // The section's record
  sectionTitle: 'Section title',
  icon: 'Icon',
  appliesTo: 'Applies to',
  everyDivision: 'Every division',
  someDivisions: 'Only some divisions',
  pickDivisions: 'Tick at least one division, or choose Every division.',
  points: 'Points',
  addPoint: 'Add a point',
  pointLabel: (n: number) => `Point ${n}`,
  removePoint: (n: number) => `Remove point ${n}`,
  noPoints: 'No points yet',
  deleteSection: 'Delete this section',
  edit: (name: string) => `Edit ${name}`,
  titleHeld: 'Give the section a title to save it.',
  divisionsHeld: 'Tick at least one division to save it.',
  saveFailed: 'Couldn’t save',
  addFailed: 'Couldn’t add it. Try again.',
  cancel: 'Cancel',
  sectionNoun: 'section',
  // A link or a file
  whatIsIt: 'What is it',
  aLink: 'A link',
  aFile: 'A file',
  name: 'Name',
  address: 'Web address',
  addressHint: 'The page or file it opens, starting https://',
  file: 'File',
  chooseFile: 'Choose a file',
  chosen: (name: string) => `Chosen: ${name}`,
  fileStays: 'To change the file, delete this one and add the new file.',
  open: 'Open it',
  nameHeld: 'Give it a name to save it.',
  addressHeld: 'Give it a web address to save it.',
  uploadFailed: 'Couldn’t upload the file. Try again.',
  addLink: 'Add link',
  addFile: 'Add file',
  deleteResource: 'Delete this link or file',
  resourceNoun: 'link or file',
  // Samples
  samplesTitle: 'Start from a sample',
  samplesIdentity: 'Common sections to copy and change. Your own rules stay as they are.',
  sampleSections: 'Rule sections',
  sampleResources: 'Links',
  sampleResourcesNote: 'A sample link has no address yet: open it after adding to give it one.',
  add: 'Add',
  added: 'Added',
} as const;

/** "3 points · every division" / "4 points · U11 Girls and U13 Boys". */
export function sectionCaption(points: number, divisionNames: readonly string[] | null): string {
  const count = points === 0 ? RULES_WORDS.noPoints : plural(points, 'point', 'points');
  const where = !divisionNames || divisionNames.length === 0 ? 'every division' : andList(divisionNames);
  return `${count} · ${where}`;
}

/** "A file" / "A link · example.com" (a sample with no address yet: "A link · no address yet"). */
export function resourceCaption(url: string, isFile: boolean): string {
  if (isFile) return RULES_WORDS.aFile;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'https://') return `${RULES_WORDS.aLink} · no address yet`;
  try {
    return `${RULES_WORDS.aLink} · ${new URL(trimmed).hostname.replace(/^www\./, '')}`;
  } catch {
    return RULES_WORDS.aLink;
  }
}

export function deleteSectionQuestion(title: string, points: number): { title: string; body: string; action: string } {
  return {
    title: `Delete ${title}?`,
    body: `${points === 0 ? 'It has no points yet.' : `Its ${plural(points, 'point goes', 'points go')} with it.`} Families stop seeing it on the public site.`,
    action: 'Delete section',
  };
}

export function deleteResourceQuestion(label: string, isFile: boolean): { title: string; body: string; action: string } {
  return {
    title: `Delete ${label}?`,
    body: `It comes off the public Rules page.${isFile ? ' The file is deleted too.' : ''}`,
    action: 'Delete',
  };
}

// ── Registration questions ────────────────────────────────────────────────────────────────────────────────────────
export const QUESTION_TYPES: ReadonlyArray<{ value: TournamentRegistrationFieldType; label: string; caption: string }> = [
  { value: 'short_text', label: 'Short text', caption: 'Short text' },
  { value: 'long_text', label: 'Long text', caption: 'Long text' },
  { value: 'dropdown', label: 'Dropdown', caption: 'A dropdown' },
  { value: 'checkbox', label: 'Checkbox', caption: 'A checkbox' },
  { value: 'file', label: 'File upload', caption: 'A file upload' },
];

export const QUESTION_WORDS = {
  title: 'Registration questions',
  lede: 'Asked on every team’s registration form, in this order.',
  add: 'Add a question',
  adding: 'Adding…',
  addAction: 'Add question',
  none: 'No questions yet.',
  noneLine: 'Every registration already collects team name, coach, email, and division. Add a question to ask for more.',
  tools: 'Tools',
  question: 'Question',
  type: 'Type',
  choices: 'Choices',
  choicesHint: 'One per line.',
  required: 'Required',
  requiredHint: 'A team can’t send its registration without answering it.',
  yes: 'Yes',
  no: 'No',
  archive: 'Archive this question',
  edit: (name: string) => `Edit ${name}`,
  noun: 'question',
  questionHeld: 'Write the question to save it.',
  choicesHeld: 'Give the dropdown at least one choice to save it.',
  saveFailed: 'Couldn’t save',
  addFailed: 'Couldn’t add it. Try again.',
  archiveFailed: 'Couldn’t archive it. Nothing was changed.',
  cancel: 'Cancel',
  loadFailed: 'The questions didn’t load.',
} as const;

/** "A dropdown · 3 choices · required" / "A checkbox · optional". */
export function questionCaption(type: TournamentRegistrationFieldType, choices: number, required: boolean): string {
  const t = QUESTION_TYPES.find(q => q.value === type)?.caption ?? 'Short text';
  return [t, type === 'dropdown' ? plural(choices, 'choice', 'choices') : null, required ? 'required' : 'optional']
    .filter(Boolean).join(' · ');
}

/** Archive asks in the product's window (today's sentence, kept). */
export function archiveQuestion(label: string): { title: string; body: string; action: string } {
  return {
    title: `Archive “${label}”?`,
    body: 'Answers teams already gave stay with their registrations.',
    action: 'Archive',
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────────────────────────────────────────
export const NOTIFY_WORDS = {
  title: 'Tournament notifications',
  mute: 'Mute everything from this tournament',
  muteCaption: 'You’ll still get emails your account settings ask for',
  tellMeWhen: 'Tell me when',
  mentions: '@mentions always reach you, even with chat messages turned off.',
  manage: 'Manage what you receive everywhere',
  noTournament: 'No tournament selected.',
  loadFailed: 'Your notification settings didn’t load.',
  saveFailed: 'Couldn’t save',
} as const;

// ── Public site (E7, A53; the words list §9 and the settled ⚠ 3: "Preview" / "Online", never "Live") ──────────────────
export const PUBLIC_SITE_WORDS = {
  title: 'Public site',
  previewEyebrow: 'Preview',
  onlineEyebrow: 'Online',
  offlineEyebrow: 'Offline',
  door: 'See your public site',
  previewLine: 'Your preview, as families will see it once you activate',
  onlineLine: 'Opens in a new tab',
  offlineLine: 'Its public site is offline. This opens your preview, in a new tab.',
  pages: 'Pages',
  pagesLine: 'Which pages families see on this tournament’s public site.',
  coachNames: 'Show coaches’ names',
  coachNamesLine: 'On Teams and team pages',
  logo: 'Logo',
  appIcon: 'App icon',
  theme: 'Theme',
  heroBanner: 'Hero banner',
  font: 'Font',
  cardStyle: 'Card style',
  none: 'None',
  uploaded: 'Uploaded',
  uploading: 'Uploading…',
  uploadLogo: 'Upload logo',
  replaceLogo: 'Replace logo',
  uploadBanner: 'Upload banner',
  replaceBanner: 'Replace banner',
  remove: 'Remove',
  logoHint: 'JPG, PNG, or WebP · max 2 MB. Falls back to the organization’s logo when not set.',
  bannerHint: 'JPG, PNG, or WebP · max 4 MB. Recommended 16:5 ratio.',
  bannerLine: 'A full-width image at the top of this tournament’s public page. Falls back to the organization’s banner when not set.',
  uploadFailed: 'Couldn’t upload it. Nothing was changed.',
  removeFailed: 'Couldn’t remove it. Nothing was changed.',
  hexCode: 'Hex code',
  hexHeld: 'A hex code is # and six digits or letters, like #1E3A8A.',
  primary: 'Primary',
  accent: 'Accent',
  custom: 'Custom colours',
  background: 'Background',
  dark: 'Dark',
  light: 'Light',
  lowContrast: 'Low contrast: text may be hard to read.',
  themeLine: 'The colours and background of this tournament’s public site.',
  inheritTheme: 'When not set, this tournament uses the organization’s colours.',
  inheritFont: 'When not set, this tournament uses the organization’s font.',
  inheritCard: 'When not set, this tournament uses the organization’s card style.',
  saveFailed: 'Couldn’t save',
  loadFailed: 'The public site’s settings didn’t load.',
  noAccess: 'You don’t have access to manage this tournament’s public site.',
  noTournament: 'Select a tournament from the sidebar to manage its public site.',
} as const;

/** "Forest Green · light" / "Custom colours · dark". */
export const themeSummary = (presetName: string | null, mode: 'dark' | 'light') =>
  `${presetName ?? PUBLIC_SITE_WORDS.custom} · ${mode}`;

/** The app icon's summary: "The logo on white" / "The logo, its colour matched" / "No logo yet". */
export function appIconSummary(hasLogo: boolean, bg: 'auto' | 'white' | 'dark' | 'brand' | 'custom'): string {
  if (!hasLogo) return 'No logo yet';
  return bg === 'auto' ? 'The logo, its colour matched'
    : bg === 'white' ? 'The logo on white'
      : bg === 'dark' ? 'The logo on dark'
        : bg === 'brand' ? 'The logo on the brand colour'
          : 'The logo on a custom colour';
}

/** A hex code typed beside a colour picker: "#1e3a8a" from "1E3A8A" or "#1E3A8A"; null when it isn't one. */
export function parseHex(typed: string): string | null {
  const t = typed.trim().replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(t) ? `#${t.toLowerCase()}` : null;
}
