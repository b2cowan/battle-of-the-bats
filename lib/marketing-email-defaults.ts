/**
 * lib/marketing-email-defaults.ts
 *
 * The CANONICAL default copy for the 10 founding-season marketing campaigns — the
 * "original" that "Reset to default" restores and that migration 179 seeded from.
 *
 * WHY IT LIVES IN CODE: the operator-editable copy lives in the DB (platform_email_templates),
 * but once an operator saves an override the original seed text is overwritten in that row.
 * To make "Reset to default" genuinely restore the original (not just clear a badge), the
 * default must be available at runtime — here. The DB row is the live/editable copy; this is
 * the immutable default. (Standard default+override model — no duplication of the SEND path,
 * which still reads the one DB row.)
 *
 * KEEP IN SYNC: migration 179's INSERT was generated from this exact data. If you change a
 * default here, regenerate the seed. Content is the block-markup understood by lib/email-markup.ts.
 */

export type MarketingEmailDefault = {
  label: string;
  description: string;
  subject: string;
  heading: string;
  variables: string[];
  body: string;
};

export const MARKETING_EMAIL_DEFAULTS: Record<string, MarketingEmailDefault> = {
  "founding_welcome": {
    label: "Founding — Welcome",
    description: "Sent to each new founding org owner at signup (transactional). Confirms free Tournament Plus.",
    subject: "Your founding season starts now — Tournament Plus is free through Dec 31",
    heading: "Your founding season starts now.",
    variables: ["firstName","orgName","setupUrl"],
    body: "Hi {{firstName}},\n\nYou're in. **{{orgName}}** is set up on FieldLogicHQ and running **Tournament Plus free through December 31, 2026** as a founding organization.\n\n::callout Tournament Plus ($39/month) gives you\n- Auto-scheduling across any number of fields and time slots\n- Single and double-elimination brackets\n- Team communications and announcements\n- Tournament archives — every past event preserved\n- Up to 3 active tournaments at once\n::end\n\nAll of it, **free until January 1, 2027**. No credit card required.\n\n::button Set up your first tournament → | {{setupUrl}}\n\nIf anything doesn't work the way you'd expect, reply to this email. We read everything.\n\n— The FieldLogicHQ team",
  },
  "founding_checkin": {
    label: "Founding — Season Check-in",
    description: "Sent ~60 days after signup. Celebrates activity so far and nudges another tournament.",
    subject: "How's your season going? Update from FieldLogicHQ",
    heading: "How's your season going?",
    variables: ["firstName","weeksPhrase","orgName","hasActivity","tournamentsPhrase","gamesPhrase","gameCount","setupUrl"],
    body: "Hi {{firstName}},\n\nIt's been **{{weeksPhrase}}** since **{{orgName}}** joined FieldLogicHQ.\n\n::if hasActivity\n::callout Season so far\nYou've run **{{tournamentsPhrase}}** — **{{gamesPhrase}} played**.\nThat's {{gameCount}} schedule exports and score entries you didn't have to do in a spreadsheet.\n::end\n::button Set up another tournament → | {{setupUrl}}\n::else\nYou haven't run your first tournament yet — which means you still have plenty of free Tournament Plus before January 1.\n\nIf you've got an upcoming event, now's the time to set it up:\n::button Set up a tournament → | {{setupUrl}}\n::end\n\nWe're also curious: what's working, and what isn't? Reply and tell us.\n\nYour founding season runs through December 31, 2026. Starting January 1, Tournament Plus is $39/month — or you can continue free on the Tournament plan (1 active tournament, manual scheduling).\n\n— The FieldLogicHQ team",
  },
  "founding_renewal": {
    label: "Founding — Renewal Notice",
    description: "Sent Nov 1. Explains what happens Jan 1 and how the org’s tournaments carry over.",
    subject: "Your founding season ends December 31 — here's what happens next",
    heading: "Your founding season ends December 31 — here's what happens next.",
    variables: ["firstName","orgName","hasHistory","hasActive","activePhrase","hasPast","pastPhrase","billingUrl","planCompareUrl"],
    body: "Hi {{firstName}},\n\nYour FieldLogicHQ founding season ends December 31, 2026.\n\nStarting January 1, Tournament Plus is $39/month. Here's what that means for **{{orgName}}**:\n\n::if hasHistory\n::callout.blue What happens to {{orgName}}\n::if hasActive\nYour **{{activePhrase}}**, all registered teams, scores, and archives carry over automatically — nothing changes except the billing.\n::end\n::if hasPast\nYour **{{pastPhrase}}** stay in your archives regardless of which plan you're on.\n::end\n::end\n::end\n\nTo continue on Tournament Plus starting January 1:\n::button Add a payment method — takes 2 minutes → | {{billingUrl}}\n\nIf $39/month isn't right for **{{orgName}}**, you can also continue free on the Tournament plan: 1 active tournament, manual scheduling, no cost.\n::link See plan comparison → | {{planCompareUrl}}\n\nQuestions? Reply to this email.\n\n— The FieldLogicHQ team",
  },
  "founding_final": {
    label: "Founding — Final Reminder",
    description: "Sent Dec 15. Two-weeks-left nudge to add a payment method.",
    subject: "2 weeks left in your founding season",
    heading: "2 weeks left in your founding season.",
    variables: ["firstName","hasCard","billingUrl"],
    body: "Hi {{firstName}},\n\nQuick reminder: your founding season ends in 16 days, on December 31.\n\n::if hasCard\nYou're all set — Tournament Plus continues at $39/month starting January 1. Nothing else to do.\n::else\nIf you'd like to continue with Tournament Plus starting January 1 ($39/month), add a payment method now:\n::button Add payment method → | {{billingUrl}}\n::end\n\nEither way, everything you've built on FieldLogicHQ stays with you.\n\n— The FieldLogicHQ team",
  },
  "spotlight_club": {
    label: "Spotlight — Club",
    description: "Sent Aug 1. Pitches Club ahead of the September season.",
    subject: "Before your September season starts — Club is free through December 31",
    heading: "Before your September season starts — Club is free through December 31.",
    variables: ["firstName","setupUrl","orgName"],
    body: "Hi {{firstName}},\n\nMost clubs are planning their September season right now.\nTryouts. Rep team rosters. League registrations. Budget prep.\n\nIf you're managing all of that across multiple tools — this is worth 15 minutes.\n\n::callout Club on FieldLogicHQ puts your entire organization in one place\n- Tournaments: same tools you're already using on your founding season\n- House League: registration, draft, schedule, standings, parent notifications — no manual emails\n- Rep Teams: tryouts, roster, lineups, and team budget — coaches run their own programs; your executive team gets the visibility\n- Accounting: org ledger, team invoicing, budget vs. actual\n::end\n\nYour executive team sees everything. Your coaches run their own teams.\nNobody is sending weekly update emails.\n\nClub is normally **from $219/month**, unlimited staff seats.\nAs a founding organization, **Club is free through December 31, 2026**.\n\nIf you're starting a September season, the time to set this up is now — not after you're three months in on the same old process.\n\n::button Start on Club — free through December 31 → | {{setupUrl}}\n\nQuestions about whether Club is right for **{{orgName}}**? Reply to this email.\n\n— The FieldLogicHQ team",
  },
  "spotlight_league": {
    label: "Spotlight — House League",
    description: "Sent Sep 1. Shows what running a house league looks like; pitches League Plus / Club.",
    subject: "What running a house league actually looks like on FieldLogicHQ",
    heading: "What running a house league actually looks like on FieldLogicHQ.",
    variables: ["firstName","orgName","setupUrl"],
    body: "Hi {{firstName}},\n\nYou're running tournaments. But if **{{orgName}}** also runs a house league season — or if that's where you're headed — here's what that looks like.\n\n::callout From opening registration to final standings\n- Parents register players online. You set division limits; waitlists fill automatically.\n- Draft day uses a live board — pick order, team builds, no spreadsheet.\n- The schedule generates itself. Parents get automated game notifications without you sending a single email.\n- Standings update the moment scores are entered.\n::end\n\nNo parallel spreadsheets. No manual notifications. One dashboard.\n\nAvailable on the League Plus plan (**$89/month**) and Club plan (**from $219/month**).\nBoth are **free through December 31, 2026** for founding organizations.\n\nIf you're planning a league season:\n::button Get set up on League Plus — free through December 31 → | {{setupUrl}}\n\n— The FieldLogicHQ team",
  },
  "spotlight_coaches_org": {
    label: "Spotlight — Coaches Portal (to orgs)",
    description: "Sent Oct 1 to org owners. Pitches the live, Founding-Season-free Premium Coaches Portal for the coaches on their teams.",
    subject: "For the coaches on your teams — a workspace that's actually theirs (free right now)",
    heading: "For the coaches on your teams — a workspace that's actually theirs.",
    variables: ["firstName","coachShareUrl","interestUrl"],
    body: "Hi {{firstName}},\n\nThe coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone's head.\n\n::callout The Premium Coaches Portal gives them one place for all of it\n- Full roster management with season history\n- Lineup builder — plan your starting lineup, export to PDF\n- Team budget and player dues tracking\n- Document management: consent forms, medical notes, eligibility files\n::end\n\nIt works whether or not a coach's team is registered in a tournament you run on FieldLogicHQ. A coach can sign up independently and manage their team year-round.\n\nIt's live now — and **free through the founding season: $0 until January 1, 2027**, then $29/month standalone (or included when your org is on Club). No credit card required to start.\n\nKnow a coach who'd use it? They can start free today:\n::link Send them this link → | {{coachShareUrl}}\n\nWant the details first?\n::button See the Coaches Portal → | {{interestUrl}}\n\n— The FieldLogicHQ team",
  },
  "spotlight_coaches_coach": {
    label: "Spotlight — Coaches Portal (to coaches)",
    description: "Sent Oct 1 to coach accounts. Pitches the live, Founding-Season-free standalone Premium Coaches Portal.",
    subject: "Your team's season workspace — free until January 1, 2027",
    heading: "Your team's season workspace — free right now.",
    variables: ["firstName","interestUrl"],
    body: "Hi {{firstName}},\n\nYou've been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, email, and memory.\n\n::callout The Premium Coaches Portal is built for exactly that\n- Your full roster, season over season\n- Lineups you can plan, save, and export to PDF\n- Team budget: dues in, expenses out, who owes what\n- Documents in one place — consent, medical, eligibility\n::end\n\nNo organization account required. Your team workspace, on your timeline — and it's **free through the founding season: $0 until January 1, 2027**, then $29/month. No credit card required to start.\n\n::button Start your free Coaches Portal → | {{interestUrl}}\n\n— The FieldLogicHQ team",
  },
  "spotlight_club_last": {
    label: "Spotlight — Club (last call)",
    description: "Sent Oct 15 to orgs not yet on Club. Final Club nudge.",
    subject: "Last reminder — Club is still free through December 31",
    heading: "Last reminder — Club is still free through December 31.",
    variables: ["firstName","orgName","setupUrl"],
    body: "Hi {{firstName}},\n\nA quick follow-up to our August note about Club.\n\nIf **{{orgName}}** is running a house league, rep teams, or both alongside your tournaments — Club is free through December 31, 2026 as part of your founding season.\n\nAfter the new year, it's **from $219/month**. Starting now, it costs nothing.\n\nThe longer you wait to set it up, the deeper into the season you go on separate systems.\n\n::button Start on Club — free through December 31 → | {{setupUrl}}\n\n— The FieldLogicHQ team",
  },
  "spotlight_full_picture": {
    label: "Spotlight — The Full Picture",
    description: "Sent Nov 15. Founding-season wrap-up: what’s live, what’s coming, share + add payment.",
    subject: "Where FieldLogicHQ is headed — a note from the founding season",
    heading: "Where FieldLogicHQ is headed — a note from the founding season.",
    variables: ["firstName","shareUrl","billingUrl"],
    body: "Hi {{firstName}},\n\nYou're one of the first organizations running on FieldLogicHQ. Here's a brief update on where things are headed.\n\n::callout What's live today\n- Tournament and Tournament Plus: free for your founding season through December 31\n- House League, Rep Teams, and Accounting: available on League and Club (also free through December 31 for founding organizations)\n- The Premium Coaches Portal — a full season workspace for one team — now live and free through the founding season ($0 until January 1, 2027, then $29/month)\n::end\n\n::callout.blue What's coming in 2027\n- Expanded public org site tools\n- More ways for families to follow their teams\n- And more, based on what this first season has taught us\n::end\n\nYou've helped us build this — by running real events on the platform and telling us what worked and what didn't.\n\nIf you know another tournament organizer, league admin, or coach who should be here:\n::link Share FieldLogicHQ → | {{shareUrl}}\n\nAnd if you haven't added a payment method yet:\n::button Continue after December 31 — takes 2 minutes → | {{billingUrl}}\n\nSee you in 2027.\n\n— The FieldLogicHQ team",
  },
};

/** The default copy for a marketing campaign key, or null if the key isn't a marketing campaign. */
export function getMarketingEmailDefault(key: string): MarketingEmailDefault | null {
  return MARKETING_EMAIL_DEFAULTS[key] ?? null;
}
