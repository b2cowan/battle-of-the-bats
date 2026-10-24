/**
 * THE WEB ADDRESS, IN WORDS — the workspace's address, the first part of every link (fieldlogichq.ca/<address>/…).
 * Tournament admin redesign Stage 5 addendum (A75, owner 2026-10-12; the words /marketing's, the same day). It left
 * Event settings — it was never one event's — for Settings & access's fourth door on Tournament and Tournament Plus;
 * League and Club keep it in the organization's Settings. ONE NAME on both sides, "Web address" (it was "Organization
 * address" on Event settings and "URL slug" in the club's Settings — one thing, two places, two names); the coaches
 * portal already called a club's address its "web address".
 *
 * Changing it breaks every link that uses the old one: nothing redirects (the server keeps no history of the old
 * address), which is why the asking window names both addresses rather than saying "this cannot be undone" — it can be
 * changed back; what is lost is every link sent in between.
 *
 * Pure, so a plain Node unit test reads it.
 */
export const WEB_ADDRESS_WORDS = {
  name: 'Web address',
  /** Settings & access's door, its sentence and its door words. */
  doorLine: (address: string) => `fieldlogichq.ca/${address} — the start of every link to your tournaments.`,
  doorAction: 'Change the address',
  ownerOnly: 'Owner only',
  /** The window: its identity line, the field, its hint. */
  identity: (orgName: string) => `${orgName} · only the owner can change it`,
  field: 'Address',
  hint: 'The start of every link to your tournaments.',
  invalid: 'Lowercase letters, numbers, and hyphens only.',
  warning: 'Changing your web address breaks every existing link to your tournaments — registration pages, coach emails, and bookmarks.',
  change: 'Change the address',
  cancel: 'Cancel',
  failed: 'Couldn’t change the address. Nothing was changed.',
  /** The server's 409 (it says "slug"; the screen says the one name). */
  taken: 'That address is already taken.',
  /** The asking window, once more before anything changes. */
  askTitle: 'Change your web address?',
  askBody: (from: string, to: string) =>
    `Every link that uses fieldlogichq.ca/${from} stops working as soon as you change it. Nothing redirects to fieldlogichq.ca/${to}.`,
  /** For the owner, under Event settings' Public URL: where the first part of the link is changed. */
  publicUrlLead: (address: string) => `The first part, ${address}, is your web address, shared by every tournament.`,
  /** Tournament and Tournament Plus: a link to Settings & access (a tournament tier never links into the org admin). */
  publicUrlTournament: 'Change it in Settings & access.',
  /** League and Club: the organization's Settings, where the address lives on those plans. */
  publicUrlClub: 'Change it in your organization’s Settings.',
  /**
   * While the club's own web address is handed out (Club Tier 4e, copy §9): Event settings' Public URL says the first part is
   * that address, and the place to change it is the Public site page. `address` has no protocol: `www.lakeshorelynx.ca`.
   */
  publicUrlLeadOwn: (address: string) => `The first part, ${address}, is your own address, shared by every tournament.`,
  publicUrlOwn: 'Change it on the Public site page.',
  /** The tournament Web address window, while the club's own address is handed out: its hint and its asking window's body. */
  hintOwn: (own: string) => `The last part of your FieldLogicHQ address. Links to ${own} keep working if you change it.`,
  askBodyOwn: (from: string, to: string, own: string) =>
    `Every link that uses fieldlogichq.ca/${from} stops working as soon as you change it. Links to ${own} keep working. Nothing redirects to fieldlogichq.ca/${to}.`,
  /** The club's Settings: the field's warning once it is changed (its field and hint are unchanged). */
  clubWarning: 'Changing your web address immediately breaks every existing link to your organization — your schedule, standings, registration form, team pages, and any links sent to coaches in past emails or posted publicly.',
  /** The club's Settings field hint (Club Tier 4e): unchanged until the club has its own web address handed out. */
  clubHint: 'Only lowercase letters, numbers, and hyphens. Changing it breaks existing links.',
  /** While the club's own address is handed out, its links do not depend on this field; only the FieldLogicHQ ones do. */
  clubHintOwn: (own: string, slug: string) =>
    `Only lowercase letters, numbers, and hyphens. Links to ${own} keep working if you change it. Links to fieldlogichq.ca/${slug} stop.`,
  clubWarningOwn: (own: string, slug: string) =>
    `Changing your web address immediately breaks every link that uses fieldlogichq.ca/${slug}. Links to ${own} keep working.`,
} as const;
