/**
 * THE SCREEN'S WORDS: the Web address row on Public site (Club Tier Stage 4e, frames a-h). Source:
 * docs/projects/active/CLUB_TIER_STAGE4E_COPY.md; keep the two in step. (The server's own sentences, the refusals, are
 * `lib/own-address-words.ts`.) A sentence that holds an address is a function, so none is ever built by hand on a screen.
 * Typographic apostrophes, per the house. Pure, so a plain Node test reads it.
 */
export const OWN_ADDRESS_WORDS = {
  rowTitle: 'Web address',
  // The door (frame a)
  familiesFindLabel: 'Families find your site at',
  changeLastPart: 'Change the last part in Settings.',
  settingsLink: 'Settings',
  doorTitle: 'Your own address',
  doorBody: 'If your club owns an address like www.lakeshorelynx.ca, families can find this site there instead. It costs nothing extra. You will need the sign-in for the place you bought it, such as GoDaddy or Namecheap.',
  useIt: 'Use your own address',
  adminDoor: 'The owner can connect the club’s own address, like www.lakeshorelynx.ca.',
  // Typing (frame b)
  fieldLabel: 'Your own address',
  fieldPrefix: 'www.',
  placeholder: 'lakeshorelynx.ca',
  placeholderOther: 'teams.lakeshorelynx.ca',
  fieldHint: 'Type the rest of your address. We show you how to send people who leave off www.',
  fieldHintOther: 'Type the whole name, like teams.lakeshorelynx.ca. Use this when your club keeps its own website at www.',
  otherLink: 'Use a name other than www',
  backToWww: 'Use www instead',
  replaceWarn: 'If a website already lives at this address, this site replaces it once you add the records.',
  replaceWarnOther: 'If something already uses this name, this site replaces it once you add the records.',
  cancel: 'Cancel',
  next: 'Next',
  loadingRecords: 'Loading your two records…',
  // Held by another service (frame g2)
  heldTitle: 'Another website service still has this address.',
  heldBody: (address: string) =>
    `${address} is still set up with a service you used before, such as an old website builder. Remove it from that service’s domain settings, then press Try again. Nothing has changed on your site.`,
  tryAgain: 'Try again',
  // The records (frames c, d)
  recordsLead: (bare: string) =>
    `Add these two records where you bought ${bare}. Sign in there and look for a setting called DNS, DNS records or Manage DNS.`,
  padlockTitle: 'Padlock check',
  siteTitle: 'Your site',
  typeLabel: 'Type',
  nameLabel: 'Name',
  valueLabel: 'Value',
  copy: 'Copy',
  copied: 'Copied',
  copyName: (n: 1 | 2) => `Copy record ${n} name`,
  copyValue: (n: 1 | 2) => `Copy record ${n} value`,
  whyPadlock: 'Lets the certificate issuer confirm the address is yours, so your site has its padlock. Keep it for good: the padlock renews only while this record is there.',
  whySite: (name: string) => `Sends visitors to your site. If ${name} already has a record (your old website), delete that one first.`,
  wholeNameHint: (full: string, bare: string) =>
    `Some places want the whole name, like ${full}. If yours adds ${bare} by itself, type only the part shown.`,
  chipNotSeen: 'Not seen yet',
  chipFound: 'Found',
  chipPointsElsewhere: 'Points elsewhere',
  chipMissing: 'Missing',
  sees: (name: string, what: string, expected: string) =>
    `We see ${name} → ${what}. Change it to ${expected}, or delete it and add the record above.`,
  copyMessage: 'Copy both as a message',
  copyMessageFor: (bare: string) => `For whoever looks after ${bare}.`,
  messageCopied: 'Message copied',
  // The forwarding box (www only)
  forwardTitle: (bare: string) => `And ${bare} on its own?`,
  forwardBody: (full: string) =>
    `Set it to forward to https://${full}, where you bought it. It is usually called Forwarding or Redirect, and it is free at most places.`,
  forwardHowTo: 'How to:',
  forwardPlaces: ['GoDaddy', 'Namecheap', 'Hover', 'Other places'] as readonly string[],
  forwardAlias: 'If the place offers an ALIAS or ANAME record, the help article shows that route instead.',
  emailUnaffected: (bare: string) => `Your email at ${bare} is not affected. Change nothing else there.`,
  // Checking
  checkingTitle: 'Checking for your records',
  checkingStart: 'We look again every 15 minutes and email you when your site is live. Often that is minutes after both records are in. It can take up to two days. You can leave this page.',
  checkingRecord2Old: 'Record 1 is in. Record 2 still sends people to your old website.',
  checkingRunning: 'We look again every 15 minutes and email you when your site is live.',
  checkingAdmin: 'We look again every 15 minutes.',
  stillWaitingTitle: 'Still waiting after a day',
  stillWaitingBody: (until: string) =>
    `Record 1 is in. Record 2 is not yet. Check that it is saved exactly as shown. We keep looking until ${until}.`,
  lookupFailed: 'We couldn’t look just now. Try again in a minute.',
  lastChecked: (time: string) => `Last checked ${time}`,
  neverChecked: 'Not checked yet',
  checkNow: 'Check now',
  checkingNow: 'Checking…',
  cancelStart: 'Cancel and start over',
  ownerConnects: 'The owner connects and removes the address.',
  // Connected (frame e)
  connectedChip: 'Connected',
  oldAddressLabel: 'The old address',
  oldAddressForwards: (old: string) => `${old} forwards here`,
  bareForwards: 'Forwards to www',
  bareNotForwarding: 'Not forwarding yet',
  bareHow: 'How',
  bareUnknown: 'Not checked yet',
  padlockLabel: 'Padlock',
  padlockRenews: (date: string | null) => (date ? `Renews by itself before ${date}` : 'Renews by itself'),
  keepRecords: (bare: string) =>
    `Keep both records where you bought ${bare} for as long as you use this address. We keep checking both, and we will write to you if one goes missing.`,
  showRecords: 'Show the two records',
  hideRecords: 'Hide the two records',
  stopDoor: 'Stop using your own address',
  // Warnings (frames f, g1, g3)
  padlockGoneTitle: 'The padlock check record is gone.',
  padlockGoneBody: (bare: string, date: string | null, noticed: string, owner: string) =>
    `Your site still works today, but its padlock cannot renew without it. Put record 1 back where you bought ${bare}${date ? ` before ${date}` : ' soon'}, or visitors will see a security warning instead of your site. We noticed on ${noticed} and emailed ${owner}. This clears by itself once the record is back.`,
  checkEveryDay: (time: string) => `We check every day. Last checked ${time}`,
  checkEveryHour: (time: string) => `We check every hour. Last checked ${time}`,
  gaveUpTitle: 'We stopped checking after two days.',
  gaveUpBody: (which: 'record2' | 'record1' | 'both' | 'elsewhere', bare: string) => {
    const check = `Check it is saved exactly as shown where you bought ${bare}, then press Try again. The records stay the same.`;
    if (which === 'both') return `Neither record was found. Check they are saved exactly as shown where you bought ${bare}, then press Try again. The records stay the same.`;
    if (which === 'record1') return `Record 2 was found. Record 1 never was. ${check}`;
    if (which === 'elsewhere') return 'Record 2 still sends people to your old website. Change it to sites.fieldlogichq.ca, then press Try again. The records stay the same.';
    return `Record 1 was found. Record 2 never was. ${check}`;
  },
  useDifferent: 'Use a different address',
  notWorkingTitle: (address: string) => `${address} is not reaching your site.`,
  notWorkingBody: (bare: string, old: string, owner: string, time: string | null) =>
    `Record 2 was changed or removed where you bought ${bare}. Anyone who uses that address sees an error until it is back. Until then, every link we hand out uses ${old}, which works. We emailed ${owner}${time ? ` when we noticed, ${time}` : ''}; this clears by itself once record 2 is back.`,
  // Chips on the closed row
  chipWaiting: 'Waiting',
  chipNeedsAttention: 'Needs attention',
  chipNotConnected: 'Not connected',
  chipNotWorking: 'Not working',
  // Stop (frame h)
  stopTitle: (address: string) => `Stop using ${address}?`,
  stopBody: (address: string, old: string) =>
    `Your site goes back to ${old} at once, and links and posters with ${address} stop working. For up to two years, browsers that visited it will open ${address} only with a padlock, so whatever you put there next needs one too.`,
  keepIt: 'Keep it',
  stopIt: 'Stop using it',
  stopping: 'Stopping…',
  stoppedNotice: (old: string, bare: string) =>
    `Your site is back at ${old}. You can delete the two records where you bought ${bare}.`,
  // Screen-reader announcements after Check now
  announceFound: (n: 1 | 2) => `Record ${n} found.`,
  announceNotSeen: (n: 1 | 2) => `Record ${n} not seen yet.`,
  announcePointsElsewhere: (n: 1 | 2) => `Record ${n} points elsewhere.`,
  loadFailed: 'We couldn’t load your web address. Nothing was changed.',
  actionFailed: 'That didn’t work. Nothing was changed. Try again in a minute.',
};
