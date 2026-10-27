/**
 * What kind of email a send is (Support console Stage 5, owner Q8 2026-10-26: a kind is required on every send call,
 * build-enforced by tests/unit/support-console-stage5-sender-guard.test.ts). The ONE home of the kinds and of the label
 * the console shows for each logged kind (owner G1 2026-10-26: approved as listed).
 *
 * Which kinds are logged (Q6, G2):
 *   account       an email about a person's FieldLogicHQ account: sign-up, sign-in, invites, access, plan and billing,
 *                 feedback. Logged.
 *   registration  a tournament's email to the address a team registered with. Logged (Q6 "registration emails appear on
 *                 the Emails tab").
 *   team          a team's or club's business sent to its coaches and staff (notifications, a club's asks, practice
 *                 plans). Not logged in Stage 5 (G2).
 *   family        a club's or team's email to its families. Never logged here: the club's own Families › Emails is that
 *                 record, and each email lands in exactly one log.
 *   inbox / alert / test   our own admin inbox, the error alert and a template test. Never logged.
 *
 * ⚠ A logged row keeps the LABEL, never the subject line: subjects carry club and team names, and family subjects a
 * child's (threat T13). A label is fixed words; it never takes a name.
 */

export type EmailClass = 'account' | 'registration' | 'team' | 'family' | 'inbox' | 'alert' | 'test';

type KindEntry = { readonly klass: EmailClass; readonly label: string; readonly story?: true };

export const EMAIL_KINDS = {
  // ── account: sign-up and sign-in ────────────────────────────────────────────
  password_reset:                       { klass: 'account', label: 'Password reset link', story: true },
  signup_verification:                  { klass: 'account', label: 'Email confirmation link', story: true },
  coach_access_reminder:                { klass: 'account', label: 'Team sign-in link', story: true },
  // ── account: invites ───────────────────────────────────────────────────────
  org_invite:                           { klass: 'account', label: 'Invitation to a club', story: true },
  staff_invite:                         { klass: 'account', label: "Invitation to a team's staff", story: true },
  club_coach_invite:                    { klass: 'account', label: 'Invitation to coach a club team', story: true },
  house_league_coach_invite:            { klass: 'account', label: 'Invitation to coach a house league team', story: true },
  team_invitation:                      { klass: 'account', label: 'Invitation to claim a tournament team', story: true },
  // ── account: access ────────────────────────────────────────────────────────
  org_member_added:                     { klass: 'account', label: 'Added to a club' },
  org_member_removed:                   { klass: 'account', label: 'Access removed' },
  org_member_suspended:                 { klass: 'account', label: 'Access suspended' },
  org_member_access_changed:            { klass: 'account', label: 'Access changed' },
  // ── account: plan and billing ──────────────────────────────────────────────
  basic_team_welcome:                   { klass: 'account', label: 'Team page ready' },
  team_workspace_welcome:               { klass: 'account', label: 'Coaches Portal welcome' },
  team_workspace_cancelled:             { klass: 'account', label: 'Coaches Portal cancelled' },
  cancellation_confirmation:            { klass: 'account', label: 'Subscription cancelled' },
  welcome_back:                         { klass: 'account', label: 'Welcome back' },
  trial_ending:                         { klass: 'account', label: 'Trial ending' },
  plan_downgraded:                      { klass: 'account', label: 'Plan downgraded' },
  billing_retention_warning:            { klass: 'account', label: 'Records retention notice' },
  org_closed:                           { klass: 'account', label: 'Account closed' },
  club_domain_notice:                   { klass: 'account', label: 'Web address update' },
  // ── account: feedback ──────────────────────────────────────────────────────
  feedback_receipt:                     { klass: 'account', label: 'Feedback received' },
  feedback_reply:                       { klass: 'account', label: 'Reply to their feedback', story: true },
  // ── registration: a tournament's email to a registered team ───────────────
  tournament_registration_confirmation: { klass: 'registration', label: 'Tournament registration received' },
  tournament_registration_waitlist:     { klass: 'registration', label: 'Tournament waitlist' },
  tournament_team_registered:           { klass: 'registration', label: 'Team registered for a tournament' },
  tournament_registration_accepted:     { klass: 'registration', label: 'Tournament registration accepted' },
  tournament_registration_rejected:     { klass: 'registration', label: 'Tournament registration not accepted' },
  tournament_payment_recorded:          { klass: 'registration', label: 'Tournament payment recorded' },
  tournament_payment_reminder:          { klass: 'registration', label: 'Tournament payment reminder' },
  schedule_published:                   { klass: 'registration', label: 'Tournament schedule published' },
  tournament_results_finalized:         { klass: 'registration', label: 'Tournament results posted' },
  tournament_announcement:              { klass: 'registration', label: 'Tournament announcement' },
  team_payment_receipt:                 { klass: 'registration', label: 'Team fee receipt' },
  team_payment_refund:                  { klass: 'registration', label: 'Team fee refund' },
  team_pay_link:                        { klass: 'registration', label: 'Team fee payment link' },
  // ── team: a team's or club's business to its coaches and staff (not logged, G2) ─
  registration_admin_alert:             { klass: 'team', label: 'New registration alert' },
  notification:                         { klass: 'team', label: 'App notification' },
  practice_plan_staff:                  { klass: 'team', label: 'Practice plan' },
  club_money_reminder_coach:            { klass: 'team', label: 'Club money reminder' },
  club_schedule_coach:                  { klass: 'team', label: 'Club schedule' },
  club_guardian_email_ask:              { klass: 'team', label: 'Guardian email request' },
  family_email_coach_copy:              { klass: 'team', label: 'Copy of a family email' },
  club_payment_handoff_coach:           { klass: 'team', label: 'Club payment hand-off' },
  // 12d-1: the club's own business to the one person who can answer it (the logged list is the owner's G1 37; unchanged).
  card_dispute_opened:                  { klass: 'team', label: 'Card dispute opened' },
  // ── family: never logged here ──────────────────────────────────────────────
  family_announcement:                  { klass: 'family', label: 'Team announcement' },
  family_game_update:                   { klass: 'family', label: 'Game update' },
  family_message:                       { klass: 'family', label: 'Message to a family' },
  family_club_email:                    { klass: 'family', label: 'Club email to families' },
  house_league_placement:               { klass: 'family', label: 'House league placement' },
  basic_coach_announcement:             { klass: 'family', label: 'Coach announcement' },
  dues_reminder:                        { klass: 'family', label: 'Dues reminder' },
  league_payment_receipt:               { klass: 'family', label: 'League payment receipt' },
  league_pay_link:                      { klass: 'family', label: 'League payment link' },
  league_payment_refund:                { klass: 'family', label: 'League refund' },
  league_bank_debit_started:            { klass: 'family', label: 'Bank debit started' },
  league_bank_debit_returned:           { klass: 'family', label: 'Bank debit returned' },
  league_bank_debit_reversed:           { klass: 'family', label: 'Bank debit reversed' },
  league_signup:                        { klass: 'family', label: 'League sign-up' },
  league_waitlist_promoted:             { klass: 'family', label: 'Waitlist spot opened' },
  league_registration_approved:         { klass: 'family', label: 'League registration accepted' },
  league_registration_waitlisted:       { klass: 'family', label: 'League waitlist' },
  league_spot_released:                 { klass: 'family', label: 'League spot released' },
  league_registration_declined:         { klass: 'family', label: 'League registration declined' },
  league_registration_withdrawn:        { klass: 'family', label: 'League registration withdrawn' },
  tryout_application_received:          { klass: 'family', label: 'Tryout application received' },
  // ── our own mail: never logged ─────────────────────────────────────────────
  feedback_received:                    { klass: 'inbox', label: 'New feedback' },
  org_deletion_request:                 { klass: 'inbox', label: 'Deletion request' },
  ops_alert:                            { klass: 'alert', label: 'Error alert' },
  template_test:                        { klass: 'test', label: 'Template test' },
} as const satisfies Record<string, KindEntry>;

export type EmailKind = keyof typeof EMAIL_KINDS;

type LoggedClass = 'account' | 'registration';
export type LoggedEmailKind = { [K in EmailKind]: (typeof EMAIL_KINDS)[K]['klass'] extends LoggedClass ? K : never }[EmailKind];
export type UnloggedEmailKind = Exclude<EmailKind, LoggedEmailKind>;

export function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_KINDS, value);
}

export function isLoggedKind(kind: EmailKind): kind is LoggedEmailKind {
  const klass = EMAIL_KINDS[kind].klass;
  return klass === 'account' || klass === 'registration';
}

/** The console's fixed label for a logged kind; an unknown stored value reads as a plain "Email" (never the raw key). */
export function emailKindLabel(kind: string): string {
  return isEmailKind(kind) ? EMAIL_KINDS[kind].label : 'Email';
}

/** Whether a kind earns a row on a person's Story (Q6: sign-up, sign-in, reset links, invites, our replies). */
export function isStoryKind(kind: string): boolean {
  return isEmailKind(kind) && (EMAIL_KINDS[kind] as KindEntry).story === true;
}

export const STORY_EMAIL_KINDS: readonly EmailKind[] = (Object.keys(EMAIL_KINDS) as EmailKind[]).filter(isStoryKind);

export const LOGGED_EMAIL_KINDS: readonly LoggedEmailKind[] =
  (Object.keys(EMAIL_KINDS) as EmailKind[]).filter(isLoggedKind);
