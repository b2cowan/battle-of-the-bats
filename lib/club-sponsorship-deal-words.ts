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
    emails: (email: string) => `Emails ${email}`,
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
    hInvoice: (on: string) => `invoice issued ${day(on)}`, // the drawing's "emailed": the invoice email is Part 3
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
    madeNewLink: 'The new link is made. Nothing was emailed. Copy it and give it to them in person.',
    sentNewLink: (email: string) => `The new link is made and emailed to ${email}.`,
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
    errInvoicedChange: 'The amount and tax can’t change once the invoice is issued. Withdraw the deal and offer it again.', // /marketing 2026-11-22 (until Part 3's revised invoice)
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
    // The drawing's "was emailed Mar 3": the invoice email is Part 3, so Part 2 says "issued" (DRAFT until then).
    invoiced: (number: string, total: number, issued: string, due: string) =>
      `Invoice ${number} for ${money(total)} was issued ${day(issued)} and is due ${day(due)}. Record the cheque or e-transfer when it arrives.`,
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

  // ── The business's page (round 1 tab 4; round 2 tab 1's card-off pay block, owner call (b)) ──
  page: {
    eyebrow: 'Sponsorship',
    offeredTo: (name: string) => `Offered to ${name}`,
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
    addressHint: 'Shown on your invoice.', // DRAFT
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
    cardOffLine: 'Once you send, your invoice appears on this page with how to pay by cheque or e-transfer. You won’t be charged on this page.',
    // Owner 2026-11-23: the button sends the form; it pays nothing. How to pay comes with the invoice (the line under it).
    send: 'Send',
    sendChequeNote: 'Your invoice appears on the next page, with how to pay. Keep your link to come back to it.',
    sendChequeNotePhone: 'Your invoice appears on the next page.',
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
    issuedLine: (issued: string, due: string, email: string) => `Issued ${dayYear(issued)} · due ${dayYear(due)} · also sent to ${email}`,
    issuedLineNoEmail: (issued: string, due: string) => `Issued ${dayYear(issued)} · due ${dayYear(due)}`, // Part 2: the invoice email is Part 3
    howToPay: 'How to pay',
    byEtransfer: (to: string) => `By e-transfer to ${to}`,
    byCheque: (payable: string, address: string | null) => `By cheque payable to ${payable}${address ? `, mailed to ${address}` : ''}`,
    quote: (number: string) => `Please quote invoice ${number}.`,
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
} as const;

function lowerFirst(s: string): string {
  return s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}
