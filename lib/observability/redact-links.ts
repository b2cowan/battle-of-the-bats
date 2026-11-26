/**
 * PRIVATE LINKS OUT OF STORED TEXT (Board Ready Stage 6 fixes, Part B-1; ruled 2026-11-25, Part 4b legal call 5).
 *
 * Several pages need no sign-in: the secret in their address is the whole key. An error report or a feedback note that keeps
 * such an address keeps the key, and the error groups have no end date. Every free-text value is put through this before it is
 * stored or logged (`redact.ts` → `captureError`, `/api/feedback`), so a stored address reads as its template
 * (`/lakeshore/sponsorship/[token]`) and every visitor to one page falls into one error group.
 *
 * ⚖ A NEW private link goes HERE, in the same change. `tests/unit/private-link-redaction.test.ts` fails the build when a page
 * or route with a secret-named segment, or a link built with a secret after `?`, isn't covered.
 *
 * No shape is anchored to the club's name: on a club's own web address the name is dropped from the path.
 */

/** A path separator, as typed or encoded any number of times (a private page nested in a sign-in link's `?next=`). */
const SEP = String.raw`(?:\/|%(?:25)*2F)`;
const path = (...parts: string[]) => parts.join(SEP) + SEP;
const ANY_SEGMENT = String.raw`(?:(?!%(?:25)*2F)[^\/\s?#&"'])+`;

/** What comes before the secret, per shape. */
const PATHS: ReadonlyArray<{ before: string; as: 'token' | 'slug' }> = [
  { before: path('sponsorship'), as: 'token' },                              // a business's deal page, and its API
  { before: path('pay') + `(?:(?:team|league)${SEP})?`, as: 'token' },        // a team's pay page, and the two pay APIs
  { before: path('league', ANY_SEGMENT, 'status'), as: 'token' },             // a family's sign-up page
  { before: path('family', 'claim'), as: 'token' },                           // a second adult's invitation, and its API
  { before: path('tryout-score'), as: 'token' },                              // a scorer with no account, and its API
  { before: path('calendar', 'coach'), as: 'token' },                         // the three calendar feeds
  { before: path('calendar', 'league-coach'), as: 'token' },
  { before: path('family', 'calendar'), as: 'token' },
  { before: path('pitch'), as: 'slug' },                                      // a private pitch deck: the address is the gate
];

/** Every secret above is longer than this; a shorter word at the same place is a page or a typo, not a key. A source file in a
 *  stack trace (`…/pitch/DeckViewer.tsx`) is left alone: its extension ENDS the run (a calendar token has dots, and one of
 *  its middle parts may spell `js`). */
const SECRET = String.raw`(?![A-Za-z0-9_.-]*\.(?:tsx?|jsx?|mjs|cjs|css|map|json)(?![A-Za-z0-9_.-]))[A-Za-z0-9_.-]{16,}`;

/** A shape starts a word: `/repay/…` and `some-pitch/…` are not `pay/` and `pitch/`. */
const STARTS = String.raw`(?:(?<![A-Za-z0-9_-])|(?<=%(?:25)*2F))`;

const PATH_RULES = PATHS.map(p => ({
  find: new RegExp(`${STARTS}(${p.before})(${SECRET})`, 'gi'),
  as: p.as,
}));

const SECRET_NAMES = ['token', 'pass', 'link', 'code', 'access_token', 'refresh_token'] as const; // invitations, stops, resets, sign-in returns
const ADDRESS_NAMES = ['email', 'guardian', 'sponsor'] as const;                                   // whose unsubscribe link it is
/** Names that carry a secret, or a person's address, after `?` or `#`. */
export const PRIVATE_QUERY_NAMES = [...SECRET_NAMES, ...ADDRESS_NAMES] as const;

const NAMES = PRIVATE_QUERY_NAMES.join('|');
/** `?token=abc`: the value runs to the next `&` or `#`, so an encoded address inside `link=` goes whole. */
const QUERY_PLAIN = new RegExp(`([?&#](?:${SECRET_NAMES.join('|')})=)[^&#\\s"'<>\\\\()\\[\\]]+`, 'gi');
/** An address keeps `'`, `(` and `)` through `encodeURIComponent`, so its value runs through them. */
const QUERY_ADDRESS = new RegExp(`([?&#](?:${ADDRESS_NAMES.join('|')})=)[^&#\\s"<>\\\\\\[\\]]+`, 'gi');
/** `%3Ftoken%3Dabc`: the same, one or more encodings deep. The value stops at the next encoded `&` or `#` too. */
const QUERY_ENCODED = new RegExp(
  `(%(?:25)*(?:3F|26|23)(?:${NAMES})%(?:25)*3D)(?:(?!%(?:25)*(?:26|23))[^&#\\s"'<>\\\\()\\[\\]])+`, 'gi',
);

/** The text with every private link's secret replaced. Safe to run twice. */
export function redactPrivateLinks(text: string): string {
  let out = text.replace(QUERY_PLAIN, '$1[redacted]').replace(QUERY_ADDRESS, '$1[redacted]').replace(QUERY_ENCODED, '$1[redacted]');
  for (const rule of PATH_RULES) {
    out = out.replace(rule.find, (_all, before: string, secret: string) =>
      `${before}[${rule.as}]${/\.ics$/i.test(secret) ? '.ics' : ''}`);
  }
  return out;
}
