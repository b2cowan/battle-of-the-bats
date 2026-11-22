/**
 * THE PUBLIC SECURITY PAGE'S WORDS — their one home (Board Ready §0c, the public Security page, S3; built 2026-11-21).
 *
 * Copied from the security brief v0.4 (`docs/agents/legal/drafts/SECURITY_BRIEF.md`, `/legal`-reviewed, `/marketing` page-copy
 * pass) and the ruled drawing's page generator (`docs/projects/active/BOARD_READY_SECURITY_PAGE_DRAWINGS.html` v2), never retyped.
 * Since S3 the draft keeps only its records ("Revise when", "Never add", the furniture and the held lines' conditions) and points
 * here: a change of wording is a `/legal` pass, then one edit here. Every sentence maps to a row of
 * `docs/agents/legal/MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md`; the diagram's labels are its rows 1–10.
 *
 * `**…**` marks the words a sentence opens on in bold (the page's renderer reads it); nothing else is markup.
 *
 * ⚠ THE "AS OF" DATE moves only when every line of this page has been re-read against production at a promote (S4 for the first,
 * then `/release`'s check, S5). A build never moves it — an edit that does not re-read every line leaves it where it is.
 */

/** The date the page was last re-read against what the product does (`YYYY-MM-DD`; shown with the long month). */
export const SECURITY_AS_OF = '2026-11-21';
export const securityAsOfLine = (dateText: string): string => `This page describes how FieldLogicHQ works as of ${dateText}.`;

/** The furniture (brief v0.4, "The page's furniture"). */
export const SECURITY_META_TITLE = "Security and your club's information";
export const SECURITY_META_DESCRIPTION =
  "Where your club's information is stored (the United States, Ohio), who can see it, and the checks we run ourselves. We never sell it or use it to advertise.";
export const SECURITY_EYEBROW = 'Security';
/** The footer's link, first in its legal row. */
export const SECURITY_LINK = 'Security';
/** "Questions a board asks" answer 3's second link. */
export const SECURITY_BOARD_LINK = 'See how we protect it';

export const SECURITY_TITLE = "How FieldLogicHQ protects your club's information";
export const SECURITY_LEAD =
  "Two questions come first: does our information leak, and is it sold? This page answers both. It says exactly where your club's information is kept, who can see it, and which checks we run ourselves.";

/** The eleven sections, in the page's order; the contents list shows the headings verbatim, unnumbered. */
export const SECURITY_SECTIONS = [
  ['short', 'The short answer'],
  ['never', "What's never on a public page"],
  ['lives', 'Where your information lives'],
  ['handles', 'Who handles it'],
  ['roles', 'Who can see what'],
  ['protect', 'How it is protected'],
  ['backups', 'Backups, and if something goes wrong'],
  ['yours', 'Your information stays yours'],
  ['checks', 'The checks we run ourselves'],
  ['questions', 'Questions'],
  ['readmore', 'Read more'],
] as const;
export type SecuritySectionKey = (typeof SECURITY_SECTIONS)[number][0];

/** The short answer: one card, three rows. */
export const SECURITY_SHORT_ANSWER = [
  "**We never sell your club's information, use it to advertise, or share it with advertisers.** We don't use advertising trackers, third-party analytics or an outside error-monitoring service, and your club's information is never given to an AI service.",
  '**It is stored in the United States (Ohio)**, with our database host, Supabase, on Amazon Web Services.',
  '**Your people see only what their role allows**, and our server checks that on every request.',
] as const;

export const SECURITY_NEVER_PUBLIC =
  "FieldLogicHQ never shows a player's name, date of birth or roster on a public page. Your club decides what it publishes: schedules, standings, team names, and the names of coaches who choose to show theirs. A link we email to a family shows only that family's own sign-up.";

/**
 * The diagram's labels, each as review rows 1–10 checked it (a " · " in the row is a new group here). The diagram component lays
 * these out in two forms; only line breaks differ, and `tests/unit/security-page.test.ts` holds both forms to these word for word.
 */
export const SECURITY_DIAGRAM_LABELS = {
  people: ['Board, coaches, families', 'a phone or a computer', 'two-step sign-in for every account'],
  app: ['FieldLogicHQ app', 'Amazon Web Services', 'Ohio, United States'],
  database: ['Database, sign-in, files', 'Supabase on AWS', 'Ohio, United States'],
  encrypted: ['encrypted'],
  checked: ['checked'],
  direct: ['sign-in and live score updates'],
  underApp: ['Every request: signed in, second step where on, belongs to this club, allowed for this role'],
  underDatabase: ['Encrypted at rest by the host', 'Database backed up daily, kept 7 days', 'Player documents open by 1-hour links'],
  emailArrow: ['sends email'],
  email: ['Email delivery', 'Resend, United States', 'Receives: names, addresses, the message itself'],
  paymentsArrow: ['hands off checkout'],
  payments: ['Payments', 'Stripe', "Card numbers are typed on Stripe's own page and never reach us"],
  alertsArrow: ['sends an alert'],
  alerts: ['Phone alerts', "the browser's own push service", 'Receives: a device address, and the alert, sealed for that device'],
} as const;
export type SecurityDiagramKey = keyof typeof SECURITY_DIAGRAM_LABELS;

/** The diagram's accessible description (both forms), word for word. */
export const SECURITY_DIAGRAM_ALT =
  "Where a club's information lives. People sign in from a phone or computer and connect over an encrypted link to the FieldLogicHQ app, run on Amazon Web Services in Ohio. The app checks every request before it reads the database, sign-in and file storage, run by Supabase on Amazon Web Services in Ohio. From the app, email goes out through Resend, payments are handed off to Stripe's own page, and phone alerts go through the browser's push service, sealed for the receiving device.";
/** The caption under the panel (visible text; review row 10). */
export const SECURITY_DIAGRAM_CAPTION =
  "Where a club's information lives and who it passes through. Nothing goes to advertisers or analytics companies, and your club's information is never given to an AI service. Families can't pay online through FieldLogicHQ yet.";

/** "Who handles it": the shipped legal table (labelled cards below 640px). */
export const SECURITY_HANDLES_COLUMNS = ['Company', 'What it does for us', 'What it receives', 'Where', 'Its certifications'] as const;
export const SECURITY_HANDLES_ROWS = [
  ['Supabase', 'Our database, sign-in and file storage', 'Everything your club keeps in FieldLogicHQ', 'United States (Ohio)', 'SOC 2 Type 2, ISO 27001'],
  ['Amazon Web Services', 'Runs our website and its server', 'Every page and form passes through it', 'United States (Ohio)', 'SOC 2, ISO 27001, for the hosting service we use'],
  ['Resend', 'Sends every email FieldLogicHQ sends', 'The name and address of each person emailed, and the message', 'United States', 'SOC 2 Type 2'],
  ['Stripe', 'Card payments', "The payer's details and what is being paid for. Card numbers go to Stripe, never to us", 'Canada, the United States and other countries', 'PCI Service Provider Level 1, SOC 2 Type 2'],
  ['ImprovMX and Google (Gmail)', 'Deliver email that people send to our own addresses', 'Only what people write to us', 'France (until delivered), the United States', 'None stated'],
] as const;
export const SECURITY_CERT_NOTE =
  "These are each company's own certifications, as each states them, not ours. FieldLogicHQ has no certification or independent audit of its own.";

/**
 * ⏸ HELD until the Data Terms AND the list of companies both publish (W2, W9): then they sit under the "not ours" sentence, before
 * the cross-border paragraph, and the linked words open those two pages (hrefs from `resolveLegalLinks()`, never typed).
 */
export const SECURITY_HELD_W2 = {
  before: 'Six companies help us run FieldLogicHQ. ',
  link: 'Our public list',
  after: ' names each one, what it receives, where, and links its own security pages.',
} as const;
export const SECURITY_HELD_W9 = {
  before: "Before a new company starts handling your club's information, we email your club's owners at least 30 days ahead. ",
  link: 'The Data Terms',
  after: ' say what happens if one must be replaced urgently.',
} as const;

export const SECURITY_CROSS_BORDER =
  "Canadian privacy law lets an organization use service providers outside Canada. We stay responsible for your information while they handle it, and each company that stores or sends your club's information is bound by data-processing terms with us. While information is in the United States, that country's courts and authorities can sometimes obtain it.";

export const SECURITY_ROLES_INTRO =
  "Each person at your club gets a role. These are the defaults, and your club's owner can widen or narrow each person's access.";
/** "Who can see what": two columns at every width (TABLE_EXCEPTION_REGISTER K-32). */
export const SECURITY_ROLES_COLUMNS = ['Role', 'Can open'] as const;
export const SECURITY_ROLES_ROWS = [
  ['Owner', "Everything, including billing and the club's settings"],
  ['Admin', 'Every program on your plan, except billing, settings and the Families area unless the owner grants it'],
  ['Treasurer', "The club's books and its member list"],
  ['League admin', 'The house league and the member list'],
  ['League registrar', 'The house league'],
  ['Staff', 'Game-day help: schedule updates, scores, check-in and announcements'],
  ['Volunteer', 'Scores and check-in, as a scorekeeper or at the gate'],
  ['Coach', 'Their own team in the Coaches Portal, and nothing club-wide'],
] as const;
export const SECURITY_CLUB_SEES =
  "**What the club sees of a team.** The club sees each of its teams' roster, schedule, results and cash on hand. A coach's lineups and private notes stay with the coach.";
export const SECURITY_OUR_STAFF =
  "**Our own staff.** Our support staff can open your club's records only to help when you ask, investigate a problem, or keep the service running. Our support tools log each club, person, sent email, feedback or early-access lead record our staff open, and keep a permanent record of every change they make. We have no way to sign in as one of your people.";

export const SECURITY_PROTECT = [
  '**Signing in.** Passwords are kept by our sign-in service, Supabase, only in scrambled form. FieldLogicHQ never sees or stores them. Two-step sign-in is available to everyone, and your club can require it for its board and coaches; FieldLogicHQ staff always use it.',
  '**Checked on our server.** On every request our server checks who the person is, that they belong to your club, and what their role allows. This is enforced on our server, not in the browser.',
  '**Encryption.** Information is encrypted in transit, and our database host encrypts everything it stores (AES-256).',
  '**Player documents** are stored privately and open only through links that expire after one hour.',
  "**Card numbers and bank details never reach us.** When you pay for FieldLogicHQ, you pay on Stripe's own page. Stripe states it is certified PCI Service Provider Level 1. Families can't pay online through FieldLogicHQ yet; when your club turns that on, they will pay on Stripe's page into your club's own Stripe account.",
  '**Phone alerts** are sealed so that only the receiving device can read them.',
] as const;

export const SECURITY_BACKUPS = [
  '**Our database is backed up daily, and each backup is kept 7 days.** We rehearsed a restore from a backup on November 18, 2026.',
  "**Uploaded files are not in those backups.** Player documents, logos and rules files are kept separately, with the same host in the same place, and we keep no backup copy of them. A file that is deleted or replaced can't be brought back, so keep your own copy of any document you can't do without. It also means a deleted file doesn't linger in a backup of ours.",
] as const;
/** The breach line today (version A). */
export const SECURITY_BREACH =
  "**If something goes wrong** with your club's information, we follow a written breach procedure: we contain it, tell your club's owners straight away with what we know, help you tell your families, and fix what caused it.";
/** ⏸ HELD (W8): replaces the breach line once the Data Terms and the list publish. */
export const SECURITY_BREACH_HELD =
  "**If something goes wrong** with your club's information, we follow a written breach procedure: we contain it, tell your club's owners straight away, and within 72 hours of confirming it touches your information, with what we know, help you tell your families, and fix what caused it.";

export const SECURITY_YOURS_DOWNLOAD =
  'You can download your records from the lists that offer it, such as members, registrations, payments and your books, in Excel, CSV or PDF.';
/** The page condition: shown only when `fullCopyOffered()` says so (the rule answer 4 on the club pages follows). */
export const SECURITY_YOURS_FULL_COPY =
  "Your club's owner can ask us for a full copy of your club's information, and we will put it together for you.";
/** ⏸ HELD (Data Terms §11): replaces the full-copy line once the Data Terms and the list publish. */
export const SECURITY_YOURS_FULL_COPY_HELD =
  "Your club's owner can ask us in writing for a full copy of your club's information, and we will put it together for you within 30 days.";
export const SECURITY_YOURS_DELETE = "Your club's owner can ask us to delete your club's information.";
export const SECURITY_YOURS_CONTRACT = 'There is no long contract. A cancelled plan ends at its renewal date, and nothing more is charged.';

export const SECURITY_CHECKS_INTRO = 'We have not commissioned an independent penetration test. These are the checks we run ourselves:';
export const SECURITY_CHECKS = [
  "**Reviews of who can see and change what in every club**: two in October 2026 and one on November 10, 2026. The November review found nothing that lets one club see another club's people. Its serious and medium findings are fixed in the live product.",
  '**A rehearsed restore** from backup, on November 18, 2026.',
] as const;

/** "Questions": the address is the link and its visible text. */
export const SECURITY_QUESTIONS_LEAD = 'Write to our privacy contact: ';
