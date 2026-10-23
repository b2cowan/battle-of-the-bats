/**
 * A CLUB'S OWN WEB ADDRESS, IN WORDS: the sentences a route answers with (Club Tier Stage 4e).
 * The full screen copy is `docs/projects/active/CLUB_TIER_STAGE4E_COPY.md`; this file holds what the SERVER says, so a
 * refusal reads the same wherever it is shown. §4b of that document is the source; keep the two in step.
 * Pure, so a plain Node test reads it.
 */
import type { ConnectRefusal } from './club-domain-service';

export const OWN_ADDRESS_REFUSALS: Record<ConnectRefusal, string> = {
  ours: 'That is FieldLogicHQ’s address. Type the address your club bought, like lakeshorelynx.ca.',
  not_a_domain: 'That is not a web address. It looks like lakeshorelynx.ca, with no spaces.',
  taken: 'Another club on FieldLogicHQ uses this address. If it is yours, write to us from Help and we will sort it out.',
  demo: 'The demo club can’t use its own address. Your club can, from this row.',
  needs_a_name: 'Add a name in front, like teams.lakeshorelynx.ca. The bare name can only forward.',
  already_connected: 'This club already has an address. Stop using it first, then connect a new one.',
  held_elsewhere:
    'Another website service still has this address. Remove it from that service’s domain settings, then press Try again. Nothing has changed on your site.',
  limit: 'We can’t add another address right now. Write to us from Help and we will sort it out.',
  failed: 'We couldn’t start the connection. Nothing was changed. Try again in a few minutes.',
};

export const OWN_ADDRESS_ROUTE_WORDS = {
  ownerOnly: 'Only the owner can connect an address.',
  none: 'This club has no address connected.',
  notRetryable: 'There is nothing to start again.',
  lookupFailed: 'We couldn’t look just now. Try again in a minute.',
  stopFailed: 'We couldn’t stop it just now. Nothing was changed. Try again in a few minutes.',
  retryFailed: 'We couldn’t start it again. Nothing was changed. Try again in a few minutes.',
  badRequest: 'Type your club’s address.',
} as const;

/** The HTTP status each refusal travels with. */
export const OWN_ADDRESS_REFUSAL_STATUS: Record<ConnectRefusal, number> = {
  ours: 400,
  not_a_domain: 400,
  needs_a_name: 400,
  demo: 403,
  taken: 409,
  already_connected: 409,
  held_elsewhere: 409,
  limit: 503,
  failed: 502,
};
