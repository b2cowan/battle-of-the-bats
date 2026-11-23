/**
 * THE CLUB'S SPONSORSHIPS — every word the place shows (Board Ready Stage 6, Part 1). Drawn in round 1 tabs 1, 2, 8 and
 * round 2 tabs 1 and 3 (owner rulings 2026-11-22); the words ask 15 ruled ("Sponsorships", "Deals", "Packages", "Sponsors",
 * "Setup", "Shows on") are the drawing's, verbatim. Lines the drawings did not draw are marked DRAFT for the /marketing
 * pass. One spelling everywhere: "e-transfer" in a sentence, "E-transfer" at the start of a label (round 2 ask 6). Never
 * "donation", "gift", "tax receipt", nor "advertising" for a banner or web placement (§9, the 2026-11-22 hint ruling).
 * Pure and client-safe.
 */
import type { SponsorPlaceKind } from './club-sponsorships';
import { money } from './online-payment-words';

export const SPONSORSHIPS_WORDS = {
  place: 'Sponsorships',
  loading: 'Loading sponsorships…',
  tabs: { deals: 'Deals', packages: 'Packages', sponsors: 'Sponsors', setup: 'Setup' },

  // ── Deals, before any package exists (round 1 tab 1) ──
  ready: {
    title: 'Get ready to sell sponsorships',
    done: (n: number) => `${n} of 3 done`,
    doneChip: 'Done',
    invoice: 'Your invoice details',
    invoiceCaption: 'Your club’s mailing address, how businesses pay you, and whether you charge GST/HST',
    firstPackage: 'Make your first package',
    firstPackageCaption: 'What a business gets, what it costs and how many you have',
    form: 'Your sponsorship form',
    formCaption: 'It already asks for the business’s details and logo. Add your own questions.',
    formCaptionPhone: 'Add your own questions',
    after: 'Once you have a package, this tab lists your deals.',
    already: (n: number) => `You already have ${n} ${n === 1 ? 'sponsor' : 'sponsors'} on your website`,
    alreadyBody: 'They keep showing as they are. They’re on the Sponsors tab.',
    alreadyBodyPhone: 'They keep showing as they are.',
    alreadyDoor: 'Sponsors',
  },
  // DRAFT: Deals once a package exists, before Part 2 builds offering a deal.
  noDeals: 'No deals yet. Once you offer one, it’s listed here.',

  // ── Packages (round 1 tab 2; "Full" grey, round 2 ask 5) ──
  packages: {
    add: 'Add a package',
    colPackage: 'Package',
    colFor: 'For',
    colPrice: 'Price',
    colTaken: 'Taken',
    taken: (taken: number, of: number | null) => (of == null ? `${taken} taken` : `${taken} of ${of}`),
    takenPhone: (taken: number, of: number | null) => (of == null ? `${taken} taken` : `${taken} of ${of} taken`),
    full: 'Full',
    archived: 'Archived',
    takenCounts: '“Taken” counts open offers too, so nothing is promised twice.',
    // DRAFT: no package yet (the drawing's checklist covers Deals; this tab's own empty line).
    empty: 'No packages yet. A package says what a business gets, what it costs and how many you have.',
    showArchived: (n: number) => `Show ${n} archived`,
    hideArchived: 'Hide archived',
  },
  pkg: {
    eyebrow: 'Packages',
    addTitle: 'Add a package',
    name: 'Name',
    price: 'Price',
    priceHint: 'Before GST/HST.',
    howMany: 'How many',
    howManyHint: 'Leave it empty for no limit.',
    noLimit: 'No limit',
    for: 'For',
    forHint: {
      club: 'Every deal is for the whole club.', // /marketing 2026-11-22
      division: 'Each deal picks which division.',
      team: 'Each deal picks which team.', // DRAFT
      tournament: 'Each deal picks which tournament.', // DRAFT
    } satisfies Record<SponsorPlaceKind, string>,
    showsUntil: 'Shows until',
    showsUntilHint: 'Each deal starts with this last day.',
    noShowsUntil: 'No last day',
    included: 'What’s included',
    logoSwitch: 'Your logo on our website',
    logoHint: {
      club: 'On your home page, from the day the deal is paid until its last day.', // DRAFT (the division line is drawn)
      division: 'On the division’s pages, from the day the deal is paid until its last day.',
      team: 'On your About page, from the day the deal is paid until its last day.', // DRAFT (owner 2026-11-22: About only)
      tournament: 'On the tournament’s pages, from the day the deal is paid until its last day.', // DRAFT
    } satisfies Record<SponsorPlaceKind, string>,
    logoRead: {
      club: 'Your logo on our website (the home page)',
      division: 'Your logo on our website (the division’s pages)',
      team: 'Your logo on our website (the About page)',
      tournament: 'Your logo on our website (the tournament’s pages)',
    } satisfies Record<SponsorPlaceKind, string>,
    // The row's grey line on Packages (round 1 tab 2: "Logo on the division’s pages · named division · field banner").
    logoCaption: {
      club: 'Logo on the home page',
      division: 'Logo on the division’s pages',
      team: 'Logo on the About page',
      tournament: 'Logo on the tournament’s page',
    } satisfies Record<SponsorPlaceKind, string>,
    addItem: 'Add an item',
    itemLabel: (n: number) => `Item ${n}`,
    removeItem: (text: string) => `Remove “${text}”`,
    itemPlaceholder: 'A field banner at the main diamond',
    includedHint: 'Listed on the offer, the invoice, and the delivery checklist.',
    document: 'Sponsorship document',
    documentHint: 'Optional. The business can open it from their link. A PDF up to 8 MB.',
    addDocument: 'Add a PDF',
    replace: 'Replace',
    removeDocument: 'Remove',
    cancel: 'Cancel',
    addButton: 'Add package',
    adding: 'Adding…',
    edit: 'Change this package',
    done: 'Done',
    priceRead: 'Before GST/HST',
    takenBy: 'Taken by',
    noneTaken: 'No deals for this package yet.', // DRAFT
    fullNudge: 'Both places are taken.',
    fullNudgeN: (n: number) => (n === 2 ? 'Both places are taken.' : `All ${n} places are taken.`),
    fullNudgeBody: (paid: number, offered: number) =>
      `${[paid ? `${paid} paid` : '', offered ? `${offered} offered` : ''].filter(Boolean).join(', ')}. To offer another, withdraw an offer or raise How many.`,
    archive: 'Archive this package',
    unarchive: 'Bring this package back',
    archiveAsk: (name: string) => `Archive ${name}?`,
    archiveBody: 'It leaves the list and can’t be offered. Deals made with it keep it as it was. You can bring it back.', // /marketing 2026-11-22
    archiveButton: 'Archive',
    errName: 'Give the package a name.',
    errPrice: 'Enter a price, like 1,000.00.',
    errHowMany: 'How many is a whole number from 1 to 999, or empty.',
    errItem: 'An item can’t be empty.',
    errItems: 'A package lists at most 20 items.',
    errPdf: 'The document must be a PDF up to 8 MB.',
  },

  // ── Sponsors (round 1 tab 8) ──
  sponsors: {
    search: 'Search sponsors',
    add: 'Add a sponsor',
    showing: 'Showing',
    notShowing: 'Not showing',
    dealChip: 'Deal',
    endedChip: 'Ended',
    noLogo: 'No logo',
    until: (day: string) => `until ${day}`,
    noLastDay: 'no last day',
    lastDayWas: (day: string) => `Last day was ${day}`,
    shownNowhere: 'Not showing anywhere yet', // /marketing 2026-11-22
    homeCount: (n: number) => `Showing ${n} of 20 places on your home page.`,
    empty: 'No sponsors yet. A business you add here shows where you choose, until its last day.', // DRAFT
    noMatch: 'No sponsor matches that search.', // DRAFT
    atCap: 'Your list holds 100 sponsors. Remove one to add another.', // DRAFT
  },
  sponsor: {
    eyebrow: 'Sponsors',
    addTitle: 'Add a sponsor',
    name: 'Name',
    namePlaceholder: 'Harbour Dental',
    logo: 'Logo',
    link: 'Link',
    linkPlaceholder: 'https://',
    showsOn: 'Shows on',
    lastDay: 'Last day',
    lastDayHint: 'Families see the sponsor through this day, then it leaves by itself.',
    noLastDay: 'No last day',
    showElsewhere: 'Show it somewhere else too',
    removePlace: 'Remove this place', // DRAFT
    fromDeal: (pkg: string, invoice: string | null) => `From the deal · ${pkg}${invoice ? `, invoice ${invoice}` : ''}. Change the place or the last day on the deal.`,
    // Until Part 2 names the deal's package and invoice in this line (`fromDeal`).
    fromDealShort: 'From a deal. Change the place or the last day on the deal.',
    dealDoor: 'Deal',
    noRemove: 'Remove isn’t offered while a deal shows this sponsor. Withdraw or end the deal first.',
    // Part 2 (DRAFT): a business with any deal, withdrawn ones too, stays (its offers and invoices are on record).
    noRemoveDeals: 'Remove isn’t offered for a business with a deal, even a withdrawn one. Its offers and invoices stay on record.',
    remove: 'Remove sponsor',
    removeAsk: (name: string) => `Remove ${name}?`,
    removeBody: 'They leave every page they show on. Their logo is deleted.', // DRAFT
    removeButton: 'Remove',
    addButton: 'Add sponsor',
    edit: 'Change this sponsor',
    errName: 'Give the sponsor a name.',
    errLink: 'A link starts with https://',
    errLastDay: 'Pick a last day, or leave it empty.',
    errTarget: 'Pick which one it shows on.',
    errTwice: 'This sponsor already shows there.',
    errHomeFull: 'Your home page shows 20 sponsors at most. Remove one, or give one a last day, first.', // /marketing 2026-11-22
    errCap: 'Your list holds 100 sponsors. Remove one to add another.', // DRAFT
    pickTarget: (kind: SponsorPlaceKind) => (kind === 'division' ? 'Pick a division' : kind === 'team' ? 'Pick a team' : 'Pick a tournament'), // DRAFT
  },

  // ── Setup ──
  setup: {
    // DRAFT: the Setup tab itself was not drawn; its two rows are the checklist's own words.
    invoice: 'Invoice details',
    invoiceCaption: 'Your club’s mailing address, how businesses pay you, and whether you charge GST/HST',
    form: 'Sponsorship form',
    formCaption: 'The business’s details and logo come first. Add your own questions.',
    formBack: 'Setup',
  },
  invoice: {
    eyebrow: 'Setup',
    title: 'Invoice details',
    edit: 'Change invoice details',
    done: 'Done',
    mailing: 'Mailing address',
    mailingSub: 'On every invoice and at the foot of every offer email',
    mailingPlaceholder: '200 Park Road, Riverdale ON K0A 1B0',
    gst: 'GST/HST',
    gstSub: 'Each deal has a “Charge HST” switch, off until you turn it on',
    registeredRead: (number: string) => `Registered · ${number}`,
    notRegistered: 'Not registered',
    registered: 'Registered for GST/HST',
    number: 'GST/HST number',
    numberPlaceholder: '81234 5678 RT0001',
    etransfer: 'By e-transfer to',
    etransferPlaceholder: 'treasurer@yourclub.ca',
    cheques: 'Cheques payable to',
    due: 'Payment due',
    dueRead: (days: number) => (days === 0 ? 'On receipt' : `${days} days after the invoice`),
    dueLabel: 'Days to pay',
    dueHint: 'Days after the invoice. 0 means on receipt.', // DRAFT
    contact: 'Contact for sponsors',
    contactName: 'Name',
    contactEmail: 'Email',
    notSet: 'Not set yet', // DRAFT
    taxHint: 'Whether GST/HST applies to a sponsorship depends on what the business gets and on your club. Ask your accountant.',
    numberHint: 'The number is checked for its form (9 digits, RT, 4 digits). Until a mailing address is set, offers can’t be sent.',
    lockLine: 'The owner, admins and the treasurer change these. They’re on every invoice and offer email. Use an address the club is happy to publish; a PO box works.',
    errNumber: 'A GST/HST number is 9 digits, RT and 4 digits, like 81234 5678 RT0001.',
    errNumberNeeded: 'Add your GST/HST number to say you’re registered.',
    errEmail: 'Enter an email address, like treasurer@yourclub.ca.',
    errMailing: 'A mailing address is up to 300 characters.',
    errDue: 'Days to pay is a whole number from 0 to 120.',
  },
  formScreen: {
    title: 'Sponsorship form',
    fixedTitle: 'Every business is asked',
    fixed: [
      'Business name, as it should appear (required)',
      'Contact name (required)',
      'Email (required)',
      'Address for the invoice (required)',
      'Phone',
      'Website',
      'Their logo (can come later)',
    ],
    fixedHint: 'These come first on the business’s page, and you can’t remove them.', // DRAFT
    lede: 'Businesses answer these after the details above, in this order.', // DRAFT
    noQuestionsLine: 'Every business is already asked for the details above. Add a question to ask for more.', // DRAFT
    refused: 'The sponsorship form isn’t open to you. The club’s owner can give you access.', // /marketing 2026-11-22
  },

  // ── The Payouts card's sponsorship row (round 2 tab 1) ──
  payouts: {
    registrationsLabel: 'Processing fee on registrations',
    sponsorshipsLabel: 'Processing fee on sponsorships',
    sponsorPays: 'The sponsor pays it',
    sponsorPaysHint: 'Added to what the sponsor pays by card, as its own line, with your GST/HST on it when the deal charges GST/HST. You receive the full invoice.',
    clubPays: 'The club pays it',
    clubPaysHint: 'The sponsor pays its invoice to the cent. The processing fee comes out of the payment and shows in your books as Payment processing. This is the default.',
    // /legal's re-check wording (owner ruled 2026-11-22, walk §560 call D1): the cost ceiling, and Québec's ban said plainly.
    capHint: 'Card networks limit what a business may add to a card payment: 2.4% in Canada, never more than the cost of accepting the card, and nothing at all in Québec. This fee can be more than that. Choosing it is your decision and your responsibility.',
    refundHint: 'If you refund a sponsor, neither part of the processing fee comes back to you. Refund the fee line yourself if you want the sponsor made whole.',
    cardOnlyHint: 'Only a card payment carries a fee. A cheque or e-transfer never does.',
    read: { sponsor: 'The sponsor pays it: it’s added to what the sponsor pays by card', club: 'The club pays it: it comes out of each payment' },
    // Round 2 ask 9: the same limit on the registration row, a hint only (wording not drawn; DRAFT for /marketing).
    // Wording /legal 2026-11-22 (the re-check of Part 1): the limit, the cost ceiling, and Québec's ban said plainly.
    registrationCapHint: 'Card networks limit what an organization may add to a card payment: 2.4% in Canada, never more than the cost of accepting the card, and nothing at all in Québec. This fee can be more than that. Choosing to pass it on is your decision and your responsibility.',
  },

  // ── The public site ──
  sponsoredBy: 'Sponsored by',
  // DRAFT: with one division there are no tabs to say which, so the line names it.
  sponsoredByNamed: (division: string) => `${division} · Sponsored by`,
  siteDoor: {
    caption: 'Kept in Sponsorships, with where each one shows',
    door: 'Sponsorships',
  },

  // ── Refusals ──
  // Review 2026-11-22: as Families, never given to a member limited to some teams (every sponsor and deal is the club's).
  limitedRow: 'Can’t be given to a member limited to some teams: every sponsor and deal belongs to the whole club.',
  limitedRefusal: 'Sponsorships can’t be given to a member limited to some teams, because every sponsor and deal belongs to the whole club. Remove the team limit first.',
  say: {
    noPlace: 'Sponsorships isn’t open to you. The club’s owner can give you access.',
    invoiceLocked: 'The owner, admins and the treasurer change the invoice details.',
    notFound: 'That isn’t here any more. The page has been refreshed.',
    failed: 'That didn’t go through. Try again.',
  },
} as const;

export { money as sponsorshipMoney };
