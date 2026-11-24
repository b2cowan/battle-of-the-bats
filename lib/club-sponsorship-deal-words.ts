/**
 * THE CLUB'S SPONSORSHIP DEALS — every word Part 2 shows (Board Ready Stage 6). Round 1 tabs 3 (Offering a deal + the
 * email), 4 (the business's page) and 5 (Deals and one deal); round 2 tab 1 (the pay block, card-off here: owner call (b));
 * the four Part 2 owner calls (2026-11-22). Drawn lines are VERBATIM; lines the drawings did not draw are marked DRAFT for
 * the /marketing pass. One spelling: "e-transfer" in a sentence, "E-transfer" at the start of a label (round 2 ask 6). Never
 * "donation", "gift", "tax receipt", nor "advertising" for a banner or web placement. Pure and client-safe.
 */
import { money } from './online-payment-words';
import { formatStoredDate } from './timezone';
import { joinWithAnd, possessive } from './utils';
import type { DealBand, OfferReason } from './club-sponsorship-deals';
import type { SponsorPlaceKind } from './club-sponsorships';

const day = (d: string) => formatStoredDate(d, { withYear: false });
const dayYear = (d: string) => formatStoredDate(d, { withYear: true });

/** "13% for an Ontario address" — the rate sentence follows the business's province (plan §5 hint ruling). */
const PROVINCE_NAMES: Record<string, string> = {
  AB: 'an Alberta', BC: 'a British Columbia', MB: 'a Manitoba', NB: 'a New Brunswick', NL: 'a Newfoundland and Labrador',
  NS: 'a Nova Scotia', NT: 'a Northwest Territories', NU: 'a Nunavut', ON: 'an Ontario', PE: 'a Prince Edward Island',
  QC: 'a Québec', SK: 'a Saskatchewan', YT: 'a Yukon',
};

export const DEAL_WORDS = {
  // ── Deals (round 1 tab 5) ──
  list: {
    offer: 'Offer a deal',
    search: 'Search businesses',
    colBusiness: 'Business',
    colPackage: 'Package',
    colShowsOn: 'Shows on',
    colAmount: 'Amount',
    colItems: 'Items done',
    band: {
      offered: 'Offered', form_received: 'Form received', invoiced: 'Invoiced', paid: 'Paid', delivered: 'Delivered',
      withdrawn: 'Withdrawn',
    } satisfies Record<DealBand, string>,
    figDeals: 'Deals',
    figPaid: 'Paid',
    figInvoiced: 'Invoiced, not paid',
    figWaiting: 'Waiting on the business',
    dealsCount: (n: number) => `${n} ${n === 1 ? 'deal' : 'deals'}`,
    foot: 'Amounts are before GST/HST. “Items done” counts the package’s items ticked on the deal. The Delivered group starts folded.',
    itemsDone: (done: number, of: number) => `${done} of ${of}`,
    itemsDonePhone: (done: number, of: number) => `${done} of ${of} done`,
    // Each row's grey line under the business (round 1 tab 5).
    sentNotOpened: (sent: string) => `Sent ${day(sent)} · not opened`,
    sentOpened: (sent: string, opened: string) => `Sent ${day(sent)} · opened ${day(opened)}`,
    linkOnly: (made: string) => `Link made ${day(made)}, not emailed`, // call (c) drawing
    linkOnlyOpened: (made: string, opened: string) => `Link made ${day(made)} · opened ${day(opened)}`, // DRAFT
    cardNotFinished: (at: string) => `${day(at)} · card payment not finished`,
    invoiceDue: (number: string, due: string) => `${number} · due ${day(due)}`,
    paidOn: (on: string, how: string) => `Paid ${day(on)} · ${how}`,
    withdrawnOn: (on: string) => `Withdrawn ${day(on)}`, // DRAFT
    empty: 'No deals for this year yet. Offer one to a business you’ve dealt with.', // /marketing 2026-11-22
    noMatch: 'No deal matches that search.', // DRAFT
    theClub: 'Your home page', // where a club-wide deal shows (was "The club", which a reader had to decode)
    phoneBarSub: (year: string) => `Deals · ${year}`,
  },

  // ── Offer a deal (round 1 tab 3; call (c) "Make the link only"; call (d) refusals) ──
  offer: {
    eyebrow: 'Deals',
    title: 'Offer a deal',
    business: 'Business',
    businessHint: (contact: string | null, email: string | null) => [contact, email].filter(Boolean).join(' · '),
    newBusiness: (typed: string) => `New business “${typed}”`,
    newBusinessHint: 'A name and an email. They fill in the rest.',
    noDealsYet: 'no deals yet',
    pastDeal: (year: string, pkg: string, state: string) => `${year} · ${pkg}, ${state}`,
    email: 'Email',
    emailHint: 'Where the offer and the invoice go.', // DRAFT (a business with no email on file)
    pkg: 'Package',
    left: (n: number) => `${n} left`,
    fullReason: 'Full: every place is paid, invoiced or offered.', // DRAFT (tab 2: "listed but can’t be picked, with its reason")
    showsOn: 'Shows on',
    // A club-wide package has nothing to pick: it always shows on the home page (`list.theClub`).
    showsOnClubHint: 'Set by the package.', // DRAFT
    taken: (name: string, state: string) => `Taken: ${name}${state ? `, ${state}` : ''}`,
    offeredTo: (name: string) => `Offered to ${name}`,
    takenHint: (names: string) => `${names} already ${names.includes(' and ') ? 'have' : 'has'} a sponsor.`,
    takenRule: 'A taken place can still be picked. It warns, and never blocks: some clubs sell two team sponsors.',
    amount: 'Amount',
    amountHint: 'The package price. Change it for this business.',
    showsUntil: 'Shows until',
    chargeTax: 'Charge HST',
    chargeTaxKind: (kind: 'GST' | 'HST') => `Charge ${kind}`,
    // The /accounting hint, ruled 2026-11-22 (plan §5): the rate sentence follows the province; static.
    taxHint: (rate: number, province: string | null) =>
      `${rate}% for ${province && PROVINCE_NAMES[province] ? `${PROVINCE_NAMES[province]} address` : 'the business’s address'}, added to the amount. A sponsorship that shows a name or logo is usually not charged tax. Turn this on only if your accountant says this deal is taxable.`,
    // DRAFT: the province isn't known until the business sends its address (a new business has none on file).
    taxHintNoAddress: 'The rate comes from the business’s address, added to the amount. A sponsorship that shows a name or logo is usually not charged tax. Turn this on only if your accountant says this deal is taxable.',
    taxHintPhone: (rate: number | null) => (rate == null ? 'Added to the amount' : `${rate}%, added to the amount`),
    theEmail: 'The email',
    reason: 'Why you can email them',
    reasonHint: 'Kept with the offer, with today’s date.',
    reasons: {
      paid_recently: 'They paid us in the last 2 years',
      asked_recently: 'They asked us about sponsoring (in the last 6 months)',
      gave_address: 'They gave us this address',
      published_address: 'They publish this address for business',
    } satisfies Record<OfferReason, string>,
    reasonPick: 'Pick a reason', // DRAFT
    // Owner call (e) + the drawing's tab 4 (approved 2026-11-23, 3A): the two reasons that run out ask When?.
    when: 'When?',
    whenHint: (reason: 'paid_recently' | 'asked_recently') =>
      reason === 'asked_recently' ? 'The day they asked. Kept with the offer.' : 'The day they last paid. Kept with the offer.', // DRAFT
    whenOld: (reason: OfferReason) =>
      `That’s more than ${reason === 'paid_recently' ? 'two years' : 'six months'} ago, so this reason no longer applies. Give them the link in person instead.`, // DRAFT
    errWhen: 'Pick the day.', // DRAFT
    errWhenFuture: 'Pick a day that has already come.', // DRAFT
    // The drawing's tab 3: a business that unsubscribed or was marked Do not offer again. DRAFT.
    barredEmail: 'If they asked you about sponsoring again, make the link and give it to them yourself.',
    rule: 'Send this only to a business that has paid you in the last two years, asked you about sponsoring in the last six months, gave you this address, or published it for business use and a sponsorship is relevant to what they do. Don’t send it to a business you have never dealt with. If you have spoken to them, give them the link in person instead.',
    note: 'A note from you',
    noteHint: 'Optional. It opens the email. Everything else is written for you.',
    cancel: 'Cancel',
    send: 'Send the offer',
    sending: 'Sending…',
    linkOnly: 'Make the link only', // call (c)
    making: 'Making…',
    needsAddress: 'Add your mailing address in Setup first',
    // /legal 2026-11-22 (Part 2 re-check, finding 1): the email must name a way to reach the club (SOR/2012-36). DRAFT.
    needsContact: 'Add a contact email in Setup first',
    // Call (d), drafted for /marketing (plan §5 Stage 6, ruled 2026-11-22).
    barUnsubscribed: (on: string) => `Unsubscribed from your sponsorship emails on ${dayYear(on)}. We won’t email them again.`,
    barFamily: (club: string) => `This address has asked ${club} not to email it. Give them the link in person instead.`,
    barDoNotOffer: (on: string) => `You marked them Do not offer again on ${dayYear(on)}.`,
    noSecret: 'Links can’t be made right now. Try again later.', // /marketing 2026-11-22
    errBusiness: 'Pick a business, or type a new one.',
    errNewName: 'A business name is up to 80 characters.',
    errEmail: 'Enter the business’s email, like frank@harbourdental.ca.',
    errPkg: 'Pick a package.',
    errTarget: 'Pick where it shows.',
    errAmount: 'Enter an amount, like 1,000.00.',
    errLastDay: 'Pick a last day, or leave it empty.',
    errReason: 'Pick why you can email them.',
    errNote: 'A note is up to 1,000 characters.',
    errArchived: 'That package is archived. Bring it back on Packages first.', // DRAFT
    // /legal 2026-11-22 (finding 4): one sentence per bar, and no door to a button that isn't built yet. DRAFT.
    errBarred: 'This business can’t be emailed an offer.',
    errBarredStop: 'You marked this business Do not offer again, so nothing is emailed.',
    errEmailFailed: 'The email didn’t go out, so nothing was offered. Try again.', // DRAFT
    madeLink: 'The link is made. Nothing was emailed.', // call (c) drawing
    sent: (email: string) => `Offer sent to ${email}.`, // DRAFT
  },

  // ── One deal (round 1 tab 5; Part 2 holds what Part 3 builds: Record a payment, the invoice PDF) ──
  deal: {
    back: 'Deals',
    edit: 'Change this deal', // DRAFT
    cardDeal: 'The deal',
    package: 'Package',
    showsOn: 'Shows on',
    showsOnSub: {
      club: (until: string | null) => `Your home page${until ? `, until ${dayYear(until)}` : ''}`,
      division: (until: string | null) => `Its schedule and standings pages${until ? `, until ${dayYear(until)}` : ''}`,
      team: (until: string | null) => `Your About page${until ? `, until ${dayYear(until)}` : ''}`,
      tournament: (until: string | null) => `The tournament’s pages${until ? `, until ${dayYear(until)}` : ''}`,
    } satisfies Record<SponsorPlaceKind, (until: string | null) => string>,
    targetGone: 'The division or team it was for has been removed', // DRAFT
    amount: 'Amount',
    chargeTax: 'Charge HST',
    taxYes: (kind: string, rate: number) => `Yes, ${rate}%${kind === 'GST' ? ' GST' : ''}`,
    taxNo: 'No',
    taxLater: 'Changing it now sends a revised invoice',
    invoice: 'Invoice',
    figInvoiced: 'Invoiced',
    figInclTax: (kind: string, tax: number) => `incl. ${kind} ${money(tax)}`,
    figPaid: 'Paid',
    figOwing: 'Still owing',
    figDue: (due: string) => `due ${day(due)}`,
    cardDelivery: 'Delivery',
    delivered: (done: number, of: number) => `${done} of ${of} delivered`,
    logoLine: 'Your logo on our website',
    logoHintUp: (where: string) => `Goes up on ${where} by itself when the deal is paid. Tick it to put it up now.`,
    logoWhere: {
      club: 'your home page', division: 'the division’s pages', team: 'your About page', tournament: 'the tournament’s pages',
    } satisfies Record<SponsorPlaceKind, string>,
    tickedBy: (name: string) => `Ticked by ${name}`,
    checklistClosed: 'The checklist opens once the deal is invoiced.', // DRAFT
    cardBusiness: 'The business',
    fromLink: (on: string) => `From their link, ${day(on)}`,
    notYet: 'They haven’t sent their details yet.', // DRAFT
    showsAs: 'Shows as',
    contact: 'Contact',
    invoiceTo: 'Invoice to',
    website: 'Website',
    answers: 'Their answers',
    notAnswered: 'Not answered',
    history: 'History',
    show: 'Show',
    hide: 'Hide',
    hOffered: (on: string, by: string) => `offered ${day(on)} by ${by}`,
    // The reason's own day, for the two that run out (the drawing's "(asked us Sep 2, 2026)"). DRAFT.
    hReasonOn: (reason: 'paid_recently' | 'asked_recently', on: string) => `(${reason === 'asked_recently' ? 'asked us' : 'paid us'} ${dayYear(on)})`,
    hRelinked: (on: string) => `new link made ${day(on)}, not emailed`, // DRAFT
    hLinkMade: (on: string, by: string) => `link made ${day(on)} by ${by}`, // DRAFT
    hOpened: (on: string) => `opened ${day(on)}`,
    hForm: (on: string) => `details and logo ${day(on)}`,
    hInvoice: (on: string) => `invoice issued ${day(on)}`, // the invoice shown on the link only (its email didn't go)
    hInvoiceEmailed: (on: string) => `invoice emailed ${day(on)}`, // round 1 tab 5's history, verbatim
    hRevised: (on: string) => `revised ${day(on)}`, // DRAFT
    hPaid: (on: string) => `paid in full ${day(on)}`, // DRAFT
    hWithdrawn: (on: string, by: string) => `withdrawn ${day(on)} by ${by}`, // DRAFT
    copy: 'Copy the link',
    copied: 'Copied',
    again: 'Send the link again (the old link stops working)',
    againShort: 'Send the link again',
    newLink: 'Make a new link (the old link stops working)', // call (c) drawing, for a link made only
    emailOffer: 'Email the offer', // call (c) drawing
    doNotOffer: 'Do not offer again',
    withdraw: 'Withdraw this deal',
    withdrawVoids: (number: string) => `Withdraw this deal (voids invoice ${number}, with your reason)`,
    withdrawAsk: (name: string) => `Withdraw ${possessive(name)} deal?`, // DRAFT
    withdrawBody: 'Their link stops showing the offer and the place is freed. Give the reason; it’s kept with the deal.', // DRAFT
    withdrawReason: 'Reason',
    withdrawButton: 'Withdraw',
    doNotOfferAsk: (email: string) => `Never offer ${email} a sponsorship again?`, // DRAFT
    doNotOfferBody: 'For a business that asked you to stop, by reply or by phone. Nobody at the club can undo it. Invoices and receipts for a deal they’ve agreed to still go.', // /marketing 2026-11-22
    doNotOfferButton: 'Do not offer again',
    stopped: (on: string) => `Not offered again since ${dayYear(on)}`, // DRAFT
    againAsk: 'Send the link again?', // DRAFT
    againBody: 'A new link goes to the business by email. The old link stops working.', // DRAFT
    againButton: 'Send the link again',
    newLinkAsk: 'Make a new link?', // DRAFT
    newLinkBody: 'The old link stops working. Nothing is emailed.', // DRAFT
    newLinkButton: 'Make a new link', // DRAFT
    // The notice at the top of the deal (PageNotice, good): /design's open point placed it there. DRAFT.
    // "Make a new link" opens the same window as Make the link only (owner 2026-11-23), copying the new link in the click.
    newLinkCopiedTitle: 'The new link is copied',
    newLinkCopied: (name: string) => `The old link no longer works. Paste the new one into a text or email to ${name}. Nothing was emailed.`,
    newLinkMadeTitle: 'The new link is made',
    newLinkMadeNotCopied: 'The old link no longer works. Your browser didn’t let us copy the new one. Press Copy the link, then give it to them in person. Nothing was emailed.',
    sentNewLink: (email: string) => `The new link is made and emailed to ${email}.`,
    // "Make the link only" copies the link in the same click (owner 2026-11-23); the deal it opens says so in a WINDOW the
    // club closes (owner 2026-11-23: a notice that fades went unseen). A browser that refused the copy gets the second pair,
    // and Copy the link is the window's button. DRAFT.
    linkCopiedTitle: 'The link is copied',
    linkCopied: (name: string) => `Paste it into a text or email to ${name}. Nothing was emailed.`,
    linkMadeTitle: 'The link is made',
    linkMadeNotCopied: 'Your browser didn’t let us copy it. Press Copy the link, then give it to them in person. Nothing was emailed.',
    linkWindowClose: 'Close',
    ranOut: 'The new link is made. Their reason to be emailed has run out, so nothing was emailed. Give it to them in person.',
    notEmailedNewLink: 'The new link is made. It couldn’t be emailed, so give it to them in person.',
    // Email the offer, on a deal made as a link only (the drawing's tab 2 record action). DRAFT.
    emailTitle: 'Email the offer',
    emailSent: (email: string) => `Offer emailed to ${email}.`,
    errEmailFailedKept: 'The email didn’t go out. The deal and its link are kept. Try again.',
    errAlreadyEmailed: 'This offer was already emailed. Use Send the link again.',
    errEmailClosed: 'This deal is past its offer, so there’s nothing to email.',
    errReason: 'Give a reason.', // DRAFT
    errPaid: 'A paid deal can’t be withdrawn.', // DRAFT
    // Part 3a: an invoiced deal's amount or tax changes as a revised invoice, while no payment stands on it. DRAFT.
    errPaidChange: 'A payment is recorded on this invoice, so its amount and tax can’t change. Void the payment first.',
    errPaidWithdraw: 'A payment is recorded on this deal. Void the payment first, then withdraw it.',
    revisedTitle: 'The revised invoice is emailed',
    revisedNotSentTitle: 'The invoice is revised',
    revisedSent: (email: string) => `The revised invoice is emailed to ${email}.`,
    revisedNotSent: 'The invoice is revised. It couldn’t be emailed, so it shows on their link.',
    // Record a payment (round 1 tab 7, the shipped ledger window cut down).
    record: 'Record a payment',
    recordTitle: 'Record a payment',
    recordEyebrow: (business: string, number: string) => `${business} · ${number}`,
    recordAmount: 'Amount received',
    recordOwing: (owing: number) => `Still owing ${money(owing)}`,
    recordDate: 'Date received',
    recordHow: 'How it was paid',
    recordRef: 'Reference',
    recordRefHint: 'Cheque or e-transfer number',
    recordNote: 'Note',
    recordFoot: 'Posts to the General ledger',
    recordButton: 'Record payment',
    recording: 'Recording…', // DRAFT
    voiding: 'Voiding…', // DRAFT
    errRecordAmount: (owing: number) => `Enter an amount up to ${money(owing)}.`, // DRAFT
    errRecordDate: 'Pick the day it arrived, no later than today.', // DRAFT
    errRecordHow: 'Pick how it was paid.', // DRAFT
    errNotOwing: 'Nothing is owing on this invoice now. The page has been refreshed.', // DRAFT
    // The club's books refuse a line dated in a closed fiscal year (mig 318). DRAFT.
    errYearClosed: 'That day is in a closed fiscal year. Pick a day in the open fiscal year.',
    errYearClosedVoid: 'This payment is in a closed fiscal year, so it can’t be voided here.',
    errAlreadyVoid: 'This payment is already voided. The page has been refreshed.',
    // The payments under the money band (undrawn: a part payment and a void need them; /design looks). DRAFT.
    payments: 'Payments',
    paymentLine: (on: string, how: string, amount: number) => `${day(on)} · ${how} · ${money(amount)}`,
    paymentVoided: (on: string, by: string, reason: string) => `Voided ${day(on)} by ${by}: ${reason}`,
    voidPayment: 'Void',
    voidAsk: (amount: number) => `Void the ${money(amount)} payment?`, // DRAFT
    voidBody: 'Its lines in the General ledger are marked void with your reason, and the amount is owing again.', // DRAFT
    voidReason: 'Reason',
    voidButton: 'Void payment',
    voidFailed: 'The payment couldn’t be voided.', // DRAFT
    invoicePdf: (number: string) => `${number} ↗`, // round 1 tab 5's "2027-014 ↗": opens the PDF
    receiptSent: (email: string) => `Paid in full. The receipt is emailed to ${email}.`, // DRAFT
    receiptNotSent: 'Paid in full. The receipt couldn’t be emailed, so it shows on their link.', // DRAFT
    recorded: 'Payment recorded.', // DRAFT
    // Owner 2026-11-23: the rate is the address's province, and a business on an untaxed deal may leave it blank. DRAFT.
    taxNeedsAddress: 'The business didn’t give an address, and the GST/HST rate comes from it. To charge tax, withdraw this deal and offer it again with tax on.',
    errLinkChanged: 'Someone just made a new link for this deal. Reload the page to see it.', // DRAFT
  },

  // ── The state callouts (round 1 tab 5's table, verbatim; ask 4) ──
  callout: {
    offeredOpened: (business: string, opened: string) => `Waiting for ${business}. They opened the link ${day(opened)}.`,
    offeredNotOpened: (business: string) => `Waiting for ${business}. They haven’t opened the link yet.`,
    linkOnly: 'The link was made, not emailed. Copy it and give it to them in person.', // call (c) drawing, approved 1A (DRAFT)
    waitingFor: (business: string) => `Waiting for ${business}`,
    formReceived: (business: string) => `${business} sent their details and started to pay by card, but didn’t finish.`,
    invoicedTitle: 'Waiting for payment',
    // Round 1 tab 5, verbatim: "was emailed Mar 3". "issued" stays for an invoice whose email didn't go (it shows on the link).
    invoiced: (number: string, total: number, issued: string, due: string, emailed: boolean) =>
      `Invoice ${number} for ${money(total)} was ${emailed ? 'emailed' : 'issued'} ${day(issued)} and is due ${day(due)}. Record the cheque or e-transfer when it arrives.`,
    invoicedPhone: (number: string, total: number, due: string) => `Invoice ${number}, ${money(total)}, due ${day(due)}.`,
    overdue: (due: string) => `Overdue since ${day(due)}.`,
    paid: (on: string, done: number, of: number) => `Paid ${day(on)}. ${done} of ${of} delivered. Tick each one as it happens.`,
    delivered: 'Paid and delivered. Nothing left to do.',
    withdrawn: (on: string, by: string, reason: string) => `Withdrawn ${day(on)} by ${by}: ${reason}`, // DRAFT
  },

  // ── The offer email (round 1 tab 3; /legal §1; round 2 ask 8: the club's address alone) ──
  email: {
    subject: (club: string, pkg: string) => `Sponsorship with ${club}: ${pkg}`,
    title: (pkg: string, place: string | null) => (place ? `${pkg}, ${place}` : pkg),
    price: (amount: number, tax: 'GST' | 'HST' | 'GST/HST' | null, until: string | null) =>
      `${money(amount)}${tax ? ` plus ${tax}` : ''}${until ? `, until ${dayYear(until)}` : ''}`,
    includes: (items: string[]) => (items.length ? `It includes ${joinWithAnd(items.map(lowerFirst))}.` : ''),
    linkLine: 'The link below has the full package. You can give us your details and logo there, and say how you’ll pay.',
    button: 'See the package',
    // The club's contact is always named (/legal finding 1): sending waits for one.
    questions: (contact: string | null, contactEmail: string) =>
      contact ? `Questions? Reply to this email, or contact ${contact} at ${contactEmail}.` : `Questions? Reply to this email, or write to ${contactEmail}.`,
    because: {
      paid_recently: (club: string) => `You get this because you sponsored or paid ${club} in the last two years.`,
      asked_recently: (club: string) => `You get this because you asked ${club} about sponsoring.`,
      gave_address: (club: string) => `You get this because you gave ${club} this address.`,
      published_address: () => `You get this because your business publishes this address.`,
    } satisfies Record<OfferReason, (club: string) => string>,
    sentBy: (club: string, address: string) => `Sent by ${club}, ${address}.`,
    unsubscribe: (club: string) => `Don’t want sponsorship offers from ${club}?`,
    unsubscribeLink: 'Unsubscribe',
  },

  // ── The invoice and receipt emails (Part 3a; owner call (2): a link, no attachment). All DRAFT for /marketing. ──
  invoiceEmail: {
    subject: (number: string, club: string) => `Invoice ${number} from ${club}`,
    subjectRevised: (number: string, club: string) => `Revised invoice ${number} from ${club}`,
    subjectPaid: (number: string, club: string) => `Paid in full: invoice ${number} from ${club}`,
    greeting: (name: string) => `Hello ${name},`,
    issuedLine: (club: string, number: string, total: number, due: string) =>
      `Thank you for sponsoring ${club}. Your invoice ${number} is for ${money(total)} and is due ${dayYear(due)}.`,
    revisedLine: (number: string, total: number, due: string) =>
      `Invoice ${number} has been revised and replaces the earlier version. The new total is ${money(total)}, due ${dayYear(due)}.`,
    paidLine: (club: string, total: number, number: string, on: string) =>
      `${club} has received ${money(total)} for invoice ${number}, paid in full ${dayYear(on)}. Thank you for sponsoring ${club}.`,
    buttonInvoice: 'See your invoice',
    buttonReceipt: 'See your receipt',
  },

  // ── The business's page (round 1 tab 4; round 2 tab 1's card-off pay block, owner call (b)) ──
  page: {
    eyebrow: 'Sponsorship',
    offeredTo: (name: string) => `Offered to ${name}`,
    packageTitle: 'Your package', // DRAFT: the package card's band, like the form's sections below it (owner 2026-11-23)
    plusTax: (kind: 'GST' | 'HST') => `plus ${kind}`,
    until: (d: string) => `until ${dayYear(d)}`,
    pdf: (size: string) => `The full package (${size})`,
    about: 'About your business',
    name: 'Business name, as it should appear',
    nameHint: 'On our website and your invoice.',
    contactName: 'Contact name',
    phone: 'Phone',
    email: 'Email',
    emailHint: 'How the club reaches you about your invoice.',
    // Owner 2026-11-23: it isn't a mailing address (the invoice goes by email). It sets the tax when there is any, and
    // prints on the invoice; required only when the deal charges GST/HST.
    address: 'Business address',
    addressHintTaxed: 'Needed for the GST/HST on your invoice.', // DRAFT
    street: 'Street',
    city: 'Town or city',
    province: 'Province',
    postal: 'Postal code',
    website: 'Website',
    websiteHint: 'People who tap your logo go here.',
    logo: 'Your logo',
    logoHint: 'JPG, PNG or WebP, up to 2 MB. Don’t have it handy? Send it later from this page.',
    logoPermission: (club: string) => `You confirm you may use this logo, and you allow ${club} to show it and your business name as this package says.`,
    logoAdd: 'Add your logo', // DRAFT
    logoReplace: 'Replace',
    logoRemove: 'Remove', // DRAFT
    logoUploading: 'Uploading…', // DRAFT
    logoFailed: 'The logo didn’t upload. Try again, or send it later from this page.', // DRAFT
    logoRefused: 'Your logo must be a JPG, PNG or WebP up to 2 MB.', // DRAFT
    logoLater: 'Send your logo any time from this page.', // DRAFT (after sending, no logo yet)
    logoSent: 'Your logo is with the club.', // DRAFT
    howYoullPay: 'How you’ll pay',
    yourInvoice: 'Your invoice',
    taxLine: (kind: 'GST' | 'HST', rate: number) => `${kind} ${rate}%`,
    // Round 1 tab 4 "Until card payment is on" — the card-off pay block (owner call (b): no card button until Part 3).
    // Part 2 emails no invoice (Part 3 does): until then the page itself shows it, so the words say that (/ux 2026-11-23, owner: apply).
    // Round 1 tab 4, verbatim, now that Part 3a emails the invoice (/legal: the pay block, the Email hint and the help change together).
    cardOffLine: (club: string) => `${club} will email your invoice with how to pay by cheque or e-transfer. You won’t be charged on this page.`,
    // Owner call 4 at walk §562 (2026-11-23): a club with no mailing address or no contact for sponsors can't email the
    // invoice, so the page promises only what it does — the invoice appears here once the business sends.
    cardOffLineNoEmail: 'Once you send, your invoice appears on this page, with how to pay by cheque or e-transfer. You won’t be charged on this page.', // /marketing 2026-11-23
    // Owner 2026-11-23: the button sends the form; it pays nothing. How to pay comes with the invoice (the line under it).
    send: 'Send',
    sendChequeNote: 'Your invoice comes by email, with how to pay.', // round 2 tab 1, verbatim
    sendChequeNotePhone: 'Your invoice comes by email.',
    sendChequeNoteNoEmail: 'Your invoice appears on this page, with how to pay.', // owner call 4, walk §562; /marketing 2026-11-23
    sendChequeNoteNoEmailPhone: 'Your invoice appears on this page.', // /marketing 2026-11-23
    sending: 'Sending…', // DRAFT
    change: 'Change', // Stage 4 ruling 20: a business that comes back sees its answers and Change
    save: 'Save changes', // DRAFT
    saved: 'Saved.', // DRAFT
    privacy: (club: string) => `${possessive(club)} privacy policy`,
    footQuestions: 'Questions about this sponsorship or your information?',
    copy: 'Copy',
    copied: 'Copied',
    // After sending a cheque or e-transfer (round 1 tab 4, screen D).
    thanksTitle: (name: string) => `Thank you, ${name}`,
    thanksSub: (club: string) => `${club} has your details and logo.`,
    thanksSubNoLogo: (club: string) => `${club} has your details.`, // DRAFT
    invoiceLine: (number: string, total: number) => `Invoice ${number} · ${money(total)}`,
    // The invoice card's facts, one per line: a label, then the day or address (owner, 2026-11-23; it was one long "Issued · due · also sent to" line).
    issuedLabel: 'Issued',
    dueLabel: 'Due',
    emailedToLabel: 'Emailed to', // only when the invoice really went to an address
    invoiceDay: (d: string) => dayYear(d),
    downloadInvoice: 'Download the invoice (PDF)', // round 1 tab 4, screen D
    downloadReceipt: 'Download your receipt (PDF)', // round 2 tab 1
    paidTitle: 'Paid, thank you', // the pay link's receipt card (round 2 tab 1)
    paidLine: (total: number, club: string) => `${money(total)} to ${club}`,
    paidOnLine: (on: string, number: string) => `Paid in full ${dayYear(on)} · invoice ${number}`, // DRAFT (a cheque has no card line)
    partPaid: (paid: number, owing: number) => `${money(paid)} received · ${money(owing)} still owing`, // DRAFT
    howToPay: 'How to pay',
    byEtransfer: (to: string) => `By e-transfer to ${to}`,
    byCheque: (payable: string, address: string | null) => `By cheque payable to ${payable}${address ? `, mailed to ${address}` : ''}`,
    quote: (number: string) => `Please quote invoice ${number}.`,
    // The page's "How to pay" list: a label, then what to do under it (owner, 2026-11-23). The email keeps the sentences above.
    payEtransfer: 'E-transfer',
    payCheque: 'Cheque',
    payChequePayable: (payable: string) => `Payable to ${payable}`,
    payChequeMailLabel: 'Mail to', // the address follows on its own lines (street / city and province / postal code)
    revisit: 'This page shows your invoice, and your receipt once you’ve paid, any time you open your link.',
    // A link that can't take a form (round 1 tab 4: "A withdrawn offer’s link says … with the contact").
    withdrawn: (club: string) => `This offer was withdrawn. Contact ${club}.`,
    // Owner call (f), 2026-11-22 (/legal's re-check): a link "Send the link again" replaced, while the offer is still open.
    replaced: (club: string) => `This link has been replaced. Look for the club’s newer email, or contact ${club}.`,
    goneTitle: 'Sponsorship', // DRAFT
    notFound: 'This link doesn’t work. Ask the club for a new one.', // DRAFT (a forged or mangled token)
    // The Stage 4 global error box's words are the family form's (FAMILY_FORM_WORDS); these are the fixed fields'.
    err: {
      name: 'Enter your business name as it should appear.',
      contactName: 'Enter a contact name.',
      email: 'Enter an email address, like frank@harbourdental.ca.',
      phone: 'A phone number is up to 40 characters.',
      website: 'A website starts with https://, like https://harbourdental.ca.',
      street: 'Enter the street address.',
      city: 'Enter the town or city.',
      province: 'Pick a province or territory.',
      postal: 'Enter the postal code.',
    },
    errClosed: 'This offer has changed. The page has been refreshed.', // DRAFT
    errPriceChanged: 'The price changed while you were filling this in. Check it, then send again.', // DRAFT
    errFailed: 'That didn’t go through. Try again.',
  },

  // ── Part 3b: paying by card, a payment's own window, and refunds to the card (round 2 tab 1; the card-refund drawing,
  //    RULED 2026-11-23, all seven as recommended). /marketing pass 2026-11-23; `doneBody` keeps its DRAFT (the 5 to 10 business days is an owner call). ──
  card: {
    // The business's page (round 2 tab 1's pay block): one button per way to pay, each with its total.
    sendCard: (total: number) => `Send and pay ${money(total)} by card`,
    sendCheque: 'Send and get my invoice', // owner 2026-11-24: no amount (it is the line above) and no "pay" (nothing is charged)
    feeNote: (fee: number, tax: number, kind: 'GST' | 'HST' | null) =>
      tax > 0 && kind ? `Includes a ${money(fee)} card processing fee and ${money(tax)} ${kind} on it.` : `Includes a ${money(fee)} card processing fee.`,
    // An invoice already issued: its link still lets them pay by card, at the invoice total (owner call (3)).
    payInvoice: (owing: number) => `Pay ${money(owing)} by card`,
    payInvoiceNote: 'Or pay by cheque or e-transfer, as below.',
    opening: 'Opening the secure payment page…',
    confirmingTitle: 'Confirming your payment…',
    confirmingBody: 'This takes a few seconds. Please keep this page open.',
    notFinishedTitle: 'Payment not finished',
    notFinishedBody: 'Nothing was charged. Pay again below, or choose a cheque or e-transfer.',
    // A card payment that was taken but could not be recorded on the deal (owner walk 2026-11-24: the page went back to the plain
    // form, as if nothing had been paid, and the business paid a second time). DRAFT until /marketing's pass.
    receivedTitle: 'We’ve received your payment',
    receivedBody: (club: string) => `Your card payment went through, but we couldn’t finish recording it. ${club} has been told and will confirm it with you. You don’t need to pay again.`,
    errReceived: 'Your card payment has already been received. You don’t need to pay again.',
    unrecordedTitle: 'Card payment not recorded',
    // The club's callout while one sits unrecorded (the money is in its Stripe account; the reason is the one the notice names).
    calloutUnrecorded: (business: string, amount: number, reason: string | null) =>
      `${business} paid ${money(amount)} by card, but it couldn’t be recorded on this deal. The money is in your Stripe account.${reason ? ` Why: ${reason}` : ''}`,
    errOff: 'Card payment isn’t available right now. Choose a cheque or e-transfer.',
    errOpen: 'The card page couldn’t open. Try again, or choose a cheque or e-transfer.',
    // The paid receipt's card line (round 2 tab 1: "Visa ••4242 · Mar 3, 2027, 2:14 p.m. · invoice 2027-014").
    paidWith: (card: string, when: string, number: string) => `${card} · ${when} · invoice ${number}`,
    feeRow: 'Processing fee',
    refundedRow: (on: string) => `Refunded ${dayYear(on)}`,
    refundedOnWay: 'Refund on its way to the card',
    creditNote: (number: string) => `Credit note ${number} (PDF)`,
    // DRAFT for /marketing: a credit note the business was sent for a refund that then did not reach the card (owner 2026-11-24: kept, marked cancelled).
    creditNoteCancelled: (number: string) => `Credit note ${number}, cancelled (PDF)`,
    creditNoteCancelledTitle: 'Credit note, cancelled',
    // A cancelled note's table rows say so too, so no line on it reads as a tax reduction that stands (/legal 2026-11-24).
    creditNoteCancelledRow: (line: string) => `Cancelled: ${line}`,
    creditNoteCancelledSub: (day: string) => `Cancelled ${day}`,
    creditNoteCancelledClosing: (number: string, amount: string) =>
      `This credit note is cancelled: the ${amount} refund did not reach the card, so invoice ${number} is not reduced by it. The number is kept on record and is not used again.`,

    // The club's deal page: a payment's line opens its own window (ask 1).
    lineSubCard: 'Recorded by itself when the card payment landed',
    lineSubRecorded: (by: string, on: string) => `Recorded by ${by}, ${day(on)}`,
    lineRefunded: (amount: number, on: string) => `Refunded ${money(amount)} ${day(on)}`,
    lineRefundPending: (amount: number) => `Refund of ${money(amount)} on its way`,
    lineOpen: (how: string) => `Open the payment: ${how}`,
    chipPending: 'Pending',
    chipRefunded: 'Refunded',
    chipPartlyRefunded: 'Partly refunded',
    // DRAFT for /marketing: a card payment the sponsor's bank took back (a dispute the club lost); nothing was refunded.
    chipTakenBack: 'Taken back',
    lineTakenBack: 'The sponsor’s bank took this payment back. The deal is owing again.',
    chipFailed: 'Refund didn’t reach the card', // the ONE wording (CARD_REFUND_WORDS.record.pill.failed)
    // The payment's window (520).
    windowTitle: (business: string) => `${possessive(business)} payment`,
    windowEyebrow: (number: string) => `Invoice ${number}`,
    amount: 'Amount',
    ofItTax: (kind: string, tax: number) => `Of it, ${kind} ${money(tax)}`,
    paid: 'Paid',
    paidAt: (d: string, time: string) => `${day(d)} at ${time}`,
    received: 'Received',
    paidWithLabel: 'Paid with',
    how: 'How',
    fee: 'Processing fee',
    feeClub: (fee: number) => `${money(fee)}, paid by the club`,
    feeSponsor: (charged: number, business: string) => `${money(charged)} with its tax, paid by ${business}`,
    feeBookClub: 'In the General ledger as Payment processing',
    feeBookSponsor: 'In the General ledger as income under Club sponsorship and as Payment processing',
    stripeRef: 'Stripe reference',
    recorded: 'Recorded',
    recordedByItself: 'By itself when the card payment landed',
    recordedBy: 'Recorded by',
    recordedByValue: (by: string, on: string) => `${by}, ${day(on)}`,
    note: 'Note',
    voided: 'Voided',
    refund: 'Refund',
    close: 'Close',
    // The refund window (the drawing's tab 2; the shipped words where they are the same: REFUND_WORDS).
    refundAsk: (business: string) => `Refund ${possessive(business)} payment?`,
    refundLeadClub: (paid: number, on: string, number: string, fee: number) =>
      `Paid ${money(paid)} on ${day(on)} (invoice ${number}). The ${money(fee)} processing fee the club paid on it stays a cost: a refund never returns it.`,
    refundLeadSponsor: (paid: number, on: string, number: string, sponsorship: number, fee: number, left: number) =>
      `Paid ${money(paid)} on ${day(on)} (invoice ${number}): the ${money(sponsorship)} sponsorship with its tax, and a ${money(fee)} processing fee with its tax. A refund never returns the fee, so up to ${money(left)} can go back.`,
    refundLeadAgain: (refunded: number, left: number) => `${money(refunded)} has already gone back. Up to ${money(left)} can go back now.`,
    allBack: (left: number) => `${money(left)} back`,
    // Where a refund goes is said once, above both choices: it is the same card either way.
    refundTarget: (card: string) => `Either way it goes back to the card, ${card}, and can take 5 to 10 business days to appear, depending on the card company.`,
    choiceAll: 'All of it',
    endsDeal: (place: string) => `This ends the deal. The logo comes down from ${place} and the place is free for another sponsor.`,
    endsDealClub: 'This ends the deal. The logo comes down from your website and the place is free for another sponsor.',
    partRest: (rest: number, tax: number, of: number, kind: string) =>
      tax > 0 ? `${money(rest)} stays paid. ${money(tax)} of the ${money(of)} is ${kind}.` : `${money(rest)} stays paid.`,
    reason: 'Reason',
    reasonHint: (business: string) => `${business} reads this in the refund email.`,
    footNoEmail: 'No email address on file. Tell them yourself.',
    buttonEnd: 'Refund, end the deal and email',
    buttonAll: (amount: number) => `Refund ${money(amount)} and email`,
    errAmount: (left: number) => `Enter an amount above $0 and up to ${money(left)}.`,
    errReason: 'Say why you’re refunding.',
    errVoidCard: 'A card payment is refunded, not voided. Open it and choose Refund.',
    errNothingLeft: 'Everything this payment can give back has already gone back. The page has been refreshed.',
    errDisputed: 'The sponsor disputed this payment with their card company, so it can’t be refunded here. Answer the dispute in Stripe.',
    errRefundOff: 'Refunds to the card aren’t available right now.',
    // After the press (said in a window the club closes: money went to a business).
    doneTitle: 'Refunded',
    doneBody: (amount: number, email: string | null) => `${money(amount)} is on its way to the card.${email ? ` We emailed ${email}.` : ''} It can take 5 to 10 business days to appear on their statement.`, // DRAFT
    doneEnded: 'The deal has ended and its place is free.',
    pendingBody: (amount: number) => `${money(amount)} is on its way to the card. The card company hasn’t confirmed it yet. It goes in the books when it does.`,
    failedBody: 'The card company refused the refund. Nothing was refunded and nothing changed.',
    // The "To the card" block in the payment's window (the shipped block's words: CARD_REFUND_WORDS.record).
    refundSplit: (pre: number, tax: number, kind: string) =>
      tax > 0 ? `${money(pre)} of the sponsorship and ${money(tax)} ${kind}. A refund never includes the processing fee.` : 'A refund never includes the processing fee.',
    reachedSub: 'It can take 5 to 10 business days to appear on the statement.',
    statusPending: (on: string, time: string) => `Stripe accepted it ${day(on)} at ${time} and is waiting on the card’s bank. It goes in the books when it reaches the card.`,
    whatFailed: (sent: string, back: string) => `Sent ${day(sent)}. The card’s bank sent it back ${day(back)}, for example because the card was closed. Its lines in the books are voided, so the money shows as still with the club. Send it another way, then record that in the Ledger.`,
    businessEmailed: 'Business emailed',
    emailedValue: (email: string, on: string) => `${email}, ${day(on)}`,
    notEmailed: 'Not emailed. Tell them yourself.',
    creditNoteLabel: 'Credit note',
    creditNoteValue: (number: string) => `${number} ↗`,
    // The money band's fourth figure (ask 4).
    figRefunded: 'Refunded',
    figRefundedSub: (amount: number, on: string) => `${money(amount)} to the card, ${day(on)}`,
    figRefundedSubPending: 'on its way to the card',
    // The deal after a full refund (the drawing's tab 3).
    calloutRefundedWithdrawn: (on: string, by: string, reason: string) => `Refunded in full and withdrawn ${day(on)} by ${by}: ${reason}`,
    hRefundedWhole: (on: string, by: string) => `refunded in full and withdrawn ${day(on)} by ${by}`,
    hRefunded: (amount: number, on: string, by: string) => `refunded ${money(amount)} ${day(on)} by ${by}`,
    listWithdrawnRefunded: (on: string) => `Withdrawn ${day(on)} · refunded`,
    logoCameDown: (on: string) => `Came down ${day(on)}, when the deal was refunded`,
    // Send the invoice (round 1 tab 5's Form received callout: "they pay by cheque or e-transfer instead").
    sendInvoice: 'Send the invoice',
    sendInvoiceAsk: (business: string) => `Send ${possessive(business)} invoice?`,
    sendInvoiceBody: 'The invoice is issued now, with its number, and emailed with how to pay by cheque or e-transfer. Their link still lets them pay by card.',
    sendInvoiceButton: 'Send the invoice',
    sentInvoice: (email: string) => `Invoice sent to ${email}.`,
    sentInvoiceNotEmailed: 'The invoice is issued. It couldn’t be emailed, so it shows on their link.',
    errCardTaken: 'They’ve already paid by card, and it couldn’t be recorded here. An invoice would bill them twice.',
    errCardPaying: 'They’re on the card page right now. Try again in a few minutes.',
    errNotFormReceived: 'This deal isn’t waiting for an invoice any more. The page has been refreshed.',
    // The refund email (the shipped refund email's subject and block).
    emailLead: (club: string, number: string) => `${club} refunded part of your sponsorship payment for invoice ${number}.`,
    emailLeadWhole: (club: string, number: string) => `${club} refunded your sponsorship payment for invoice ${number}, and the sponsorship has ended.`,
    emailCreditNote: (number: string) => `Your credit note ${number} is on your sponsorship page.`,
    emailButton: 'See your sponsorship',
    // DRAFT for /marketing: the correction when a refund the business was told about did not reach their card.
    emailCancelledSubject: (club: string) => `Correction: your refund from ${club}`,
    // `number` is null on an untaxed invoice (no credit note was given).
    emailCancelled: (club: string, amount: string, number: string | null) =>
      `The ${amount} refund ${club} sent you did not reach your card, so ${number ? `credit note ${number} is cancelled and ` : ''}your invoice is not reduced by it.`, // a statement of fact; the email's own contact line says who to ask (no promise made in the club's name)
    // Needs attention (the rail's notices, in the sponsorship's words).
    notRecordedTitle: 'A sponsor’s card payment isn’t on its deal',
    dashboardRefundTitle: 'A refund made in Stripe isn’t in your books',
    dashboardRefundBody: (amount: string, on: string) => `${amount} went back to a sponsor’s card from your Stripe dashboard on ${on}. Record it in the Ledger, and refund from the deal’s payment next time.`,
    theSponsor: 'The sponsor',
  },
} as const;

function lowerFirst(s: string): string {
  // A leading article ("A thank-you at the banquet") is a plain word too: the two-letter test below misses "A " because
  // the second character is a space. A name or an acronym ("HST", "UAT Rep Club") keeps its capital.
  return s && (/^[A-Z][a-z]/.test(s) || /^A\s/.test(s)) ? s[0].toLowerCase() + s.slice(1) : s;
}
