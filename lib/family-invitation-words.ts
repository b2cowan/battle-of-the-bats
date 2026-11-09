/**
 * The words of the Stage 4a invitation (Signed-in family accounts; plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md Stage 4). ONE home:
 * the routes and screens read them from here. DRAFT words for the /marketing pass in the Stage 4a closeout: change them here and
 * only here. (The consent and privacy words are /legal's and live in lib/family-guardian-consent.ts.)
 */
export const FAMILY_INVITATION_WORDS = {
  /** A rep coach's Send invitation, refused (Part 3.3). */
  rep: {
    invalidEmail: 'Enter a valid email address.',
    notOnTeam: 'That player is not on this team.',
    inviteStopped: 'That address has asked not to get invitations from this club.',
    adult: 'This player is 18 or older, so there’s no parent invitation for them.',
    alreadyConnected: 'That address is already connected to this player.',
    cap: 'This player already has two connected guardians. Remove one before inviting another.',
    cancelled: 'That invitation no longer works.',
  },
} as const;
