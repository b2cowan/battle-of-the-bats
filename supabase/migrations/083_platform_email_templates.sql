-- 083_platform_email_templates.sql
-- Stores platform-wide email template overrides managed in Platform Admin.
-- When is_customised = FALSE, the app falls back to the hardcoded template in lib/email.ts.
-- When is_customised = TRUE, the stored subject / heading / body / cta_label are used
-- to build the email inside the resolveEmailTemplate() helper.

CREATE TABLE IF NOT EXISTS platform_email_templates (
  key             TEXT        PRIMARY KEY,
  label           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  heading         TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  cta_label       TEXT,
  cta_url_pattern TEXT,
  variables       JSONB       NOT NULL DEFAULT '[]',
  category        TEXT        NOT NULL DEFAULT 'system',
  is_customised   BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      TEXT
);

-- Seed with one row per platform-level email (not org broadcast or league broadcast,
-- those are org-controlled). The seeded values exactly mirror what lib/email.ts renders.

INSERT INTO platform_email_templates (key, label, description, subject, heading, body, cta_label, cta_url_pattern, variables, category) VALUES

-- ── Authentication ──────────────────────────────────────────────────────────────
('signup_verification', 'Email Verification', 'Sent when a new user signs up to verify their email address.',
  'Verify your email — FieldLogicHQ',
  'Verify Your Email',
  'Welcome to **FieldLogicHQ**. Confirm your email address to continue setting up **{{orgName}}**.',
  'Verify Email →',
  '{{verifyUrl}}',
  '["orgName","verifyUrl"]'::jsonb,
  'auth'),

('password_reset', 'Password Reset', 'Sent to a customer when they request a password reset.',
  'Reset your FieldLogicHQ password',
  'Reset Your Password',
  'We received a request to reset the password for your **FieldLogicHQ** account. Click the button below to set a new password. This link expires in 1 hour. If you didn''t request a password reset, you can safely ignore this email.',
  'Reset Password →',
  '{{resetLink}}',
  '["resetLink"]'::jsonb,
  'auth'),

-- ── Billing — Org subscriptions ────────────────────────────────────────────────
('trial_ending', 'Trial Ending Soon', 'Sent 3 days before a paid org plan trial expires.',
  'Your {{planLabel}} trial ends soon',
  'Your trial ends soon',
  'Your FieldLogicHQ **{{planLabel}}** trial for **{{orgName}}** ends on **{{trialEndDate}}**. Your payment method on file will be charged automatically when the trial expires. No action is needed if you''d like to continue. To update your payment method or review your plan before the trial ends, visit your billing settings.',
  'Manage Billing →',
  '{{billingUrl}}',
  '["orgName","planLabel","trialEndDate","billingUrl"]'::jsonb,
  'billing'),

('cancellation_confirmation', 'Subscription Cancelled', 'Sent when an org owner confirms subscription cancellation.',
  'Your {{orgName}} subscription has been cancelled',
  'Subscription cancelled',
  'Your **{{planLabel}}** subscription for **{{orgName}}** has been cancelled. Your organization is now inactive. Your account data is retained until **{{retentionUntil}}**. If you resubscribe before that date, everything will be restored.',
  'Resubscribe',
  '{{resubscribeUrl}}',
  '["orgName","planLabel","retentionUntil","resubscribeUrl"]'::jsonb,
  'billing'),

('plan_downgraded', 'Plan Downgraded', 'Sent when an org owner confirms a plan downgrade.',
  'Your {{orgName}} plan has been updated',
  'Plan updated',
  'Your **{{orgName}}** subscription has been changed from **{{fromPlanLabel}}** to **{{toPlanLabel}}**. Any tournaments that exceed the {{toPlanLabel}} limit have been archived and will be restored if you upgrade again before the retention date.',
  'Manage Billing →',
  '{{billingUrl}}',
  '["orgName","fromPlanLabel","toPlanLabel","billingUrl"]'::jsonb,
  'billing'),

('welcome_back', 'Welcome Back', 'Sent when a cancelled org resubscribes to any paid plan.',
  'Welcome back to FieldLogicHQ — {{orgName}}',
  'Welcome back!',
  'Your **{{planLabel}}** subscription for **{{orgName}}** is active again. Your account is ready to go.',
  'Go to Dashboard →',
  '{{dashboardUrl}}',
  '["orgName","planLabel","dashboardUrl"]'::jsonb,
  'billing'),

-- ── Billing — Team workspaces ───────────────────────────────────────────────────
('team_workspace_cancelled', 'Team Workspace Cancelled', 'Sent when a standalone Team workspace subscription is cancelled.',
  'Your {{workspaceName}} team workspace has been cancelled',
  'Team workspace cancelled',
  'Your **{{workspaceName}}** Team workspace subscription has been cancelled. The workspace is now inactive. Your team data is retained and can be restored by resubscribing.',
  'Resubscribe',
  '{{resubscribeUrl}}',
  '["workspaceName","resubscribeUrl"]'::jsonb,
  'billing'),

-- ── Tournament — Team registration ─────────────────────────────────────────────
('tournament_registration_confirmation', 'Registration Received', 'Sent to a coach when their team registration is submitted.',
  'Registration received — {{tournamentName}}',
  'Registration Received!',
  'Hi **{{coachName}}**. We''ve received your registration for **{{teamName}}** in the **{{ageGroupName}}** division for **{{tournamentName}}**. Your registration is currently pending review.',
  NULL, NULL,
  '["coachName","teamName","ageGroupName","tournamentName"]'::jsonb,
  'tournament'),

('tournament_registration_accepted', 'Registration Accepted', 'Sent when a tournament admin accepts a team registration.',
  '🎉 {{teamName}} has been accepted — {{tournamentName}}',
  'Team Accepted!',
  'Hi **{{coachName}}**. Great news! **{{teamName}}** has been accepted into the **{{ageGroupName}}** division for **{{tournamentName}}**. If payment is required, the tournament organizer will follow up with payment instructions.',
  'View Team Profile →',
  '{{profileUrl}}',
  '["coachName","teamName","ageGroupName","tournamentName","profileUrl"]'::jsonb,
  'tournament'),

('tournament_registration_waitlist', 'Added to Waitlist', 'Sent when a team is added to the waitlist for a full division.',
  'You''re on the waitlist — {{tournamentName}}',
  'You''re on the Waitlist',
  'Hi **{{coachName}}**. The **{{ageGroupName}}** division is currently full. **{{teamName}}** has been added to the waitlist and you will be notified by email if a spot becomes available.',
  NULL, NULL,
  '["coachName","teamName","ageGroupName","tournamentName"]'::jsonb,
  'tournament'),

('tournament_registration_rejected', 'Registration Declined', 'Sent when a tournament admin declines a team registration.',
  'Registration update — {{tournamentName}}',
  'Registration Update',
  'Hi **{{coachName}}**. Thank you for your interest in **{{tournamentName}}**. Unfortunately, we are unable to accommodate **{{teamName}}** in the **{{ageGroupName}}** division at this time. This may be due to division capacity or eligibility requirements.',
  NULL, NULL,
  '["coachName","teamName","ageGroupName","tournamentName"]'::jsonb,
  'tournament'),

('tournament_payment_recorded', 'Payment Recorded', 'Sent when a tournament admin marks a team payment as received.',
  'Payment recorded — {{tournamentName}}',
  'Payment Recorded',
  'Hi **{{coachName}}**. The tournament organizer has recorded payment for **{{teamName}}**. Your registration for the **{{ageGroupName}}** division of **{{tournamentName}}** is now marked paid. Stay tuned for schedule announcements!',
  NULL, NULL,
  '["coachName","teamName","ageGroupName","tournamentName"]'::jsonb,
  'tournament'),

('schedule_published', 'Schedule Published', 'Sent to all accepted coaches when a tournament schedule is published.',
  'Schedule is live — {{tournamentName}}',
  'Your Schedule is Live!',
  'Hi **{{coachName}}**. The schedule for **{{tournamentName}}** has been published. You can now view game times, dates, and locations on the public tournament page.',
  'View Schedule →',
  '{{scheduleUrl}}',
  '["coachName","tournamentName","scheduleUrl"]'::jsonb,
  'tournament'),

('tournament_results_finalized', 'Results Finalized', 'Sent to coaches when a tournament organizer publishes final results.',
  'Final results posted — {{tournamentName}}',
  'Final Results Are Posted',
  'Hi **{{coachName}}**. The organizer has finalized results for **{{tournamentName}}**. You can review standings, scores, and team information from the public tournament site.',
  'View Results →',
  '{{resultsUrl}}',
  '["coachName","tournamentName","resultsUrl"]'::jsonb,
  'tournament'),

-- ── Rep Teams ──────────────────────────────────────────────────────────────────
('tryout_application_received', 'Tryout Application Received', 'Sent to a guardian when a tryout application is submitted.',
  'Tryout application received — {{teamName}}',
  'Tryout Application Received',
  'Hi **{{guardianFirstName}}**. We''ve received **{{playerFirstName}} {{playerLastName}}**''s tryout application for the **{{teamName}}** **{{yearName}}** program. Our coaching staff will review all applications and be in touch. No further action is required at this time.',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","teamName","yearName"]'::jsonb,
  'rep_teams'),

('tryout_offer_extended', 'Tryout Offer Extended', 'Sent to a guardian when a coach extends a tryout offer.',
  'Offer extended — {{teamName}} {{yearName}}',
  'Offer Extended',
  'Hi **{{guardianFirstName}}**. We''re pleased to let you know that **{{playerFirstName}} {{playerLastName}}** has been extended an offer to join the **{{teamName}}** **{{yearName}}** program. Please contact the coaching staff to confirm whether **{{playerFirstName}}** will be accepting this offer.',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","teamName","yearName"]'::jsonb,
  'rep_teams'),

('tryout_offer_accepted', 'Roster Added — Welcome to the Team', 'Sent when a player is officially added to a rep team roster.',
  'Welcome to the team — {{teamName}} {{yearName}}',
  'Welcome to the Team!',
  'Hi **{{guardianFirstName}}**. **{{playerFirstName}} {{playerLastName}}** has been added to the **{{teamName}}** **{{yearName}}** roster. Welcome! Your coaching staff will be in touch with more details. We look forward to a great season!',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","teamName","yearName"]'::jsonb,
  'rep_teams'),

('tryout_declined', 'Tryout Not Successful', 'Sent when a tryout application is declined.',
  'Tryout update — {{teamName}} {{yearName}}',
  'Tryout Update',
  'Hi **{{guardianFirstName}}**. Thank you for registering **{{playerFirstName}} {{playerLastName}}** for the **{{teamName}}** **{{yearName}}** program. After reviewing all applications, we are unfortunately unable to extend an offer at this time. We appreciate **{{playerFirstName}}**''s interest and encourage them to try again in the future.',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","teamName","yearName"]'::jsonb,
  'rep_teams'),

-- ── House League ───────────────────────────────────────────────────────────────
('league_registration_pending', 'League Registration Received', 'Sent to a guardian when a house league registration is submitted.',
  'Registration received — {{seasonName}}',
  'Registration Received',
  'Hi **{{guardianFirstName}}**. We''ve received the registration for **{{playerFirstName}} {{playerLastName}}** in **{{seasonName}}**. A league administrator will review it shortly. Your registration status is currently pending review. You will receive another email once a decision has been made.',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","seasonName","divisionName"]'::jsonb,
  'house_league'),

('league_registration_approved', 'League Registration Approved', 'Sent when a league admin approves a registration.',
  '✅ Registration approved — {{seasonName}}',
  'Registration Approved!',
  'Hi **{{guardianFirstName}}**. Great news — **{{playerFirstName}} {{playerLastName}}**''s registration for **{{seasonName}}** has been approved. We look forward to seeing **{{playerFirstName}}** on the field!',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","seasonName","divisionName"]'::jsonb,
  'house_league'),

('league_registration_waitlisted', 'League Registration Waitlisted', 'Sent when a house league registration is placed on the waitlist.',
  'You''re on the waitlist — {{seasonName}}',
  'You''re on the Waitlist',
  'Hi **{{guardianFirstName}}**. **{{divisionName}}** is currently full. **{{playerFirstName}} {{playerLastName}}** has been added to the waitlist. You will be contacted if a spot becomes available.',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","seasonName","divisionName","waitlistPosition"]'::jsonb,
  'house_league'),

('league_registration_declined', 'League Registration Declined', 'Sent when a league admin declines a registration.',
  'Registration update — {{seasonName}}',
  'Registration Update',
  'Hi **{{guardianFirstName}}**. We''re sorry — **{{playerFirstName}} {{playerLastName}}**''s registration for **{{seasonName}}** — **{{divisionName}}** was not approved.',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","seasonName","divisionName"]'::jsonb,
  'house_league'),

('league_waitlist_promoted', 'League Waitlist Promoted', 'Sent when a player is moved off the waitlist and into the league.',
  '🎉 Off the waitlist — {{seasonName}}',
  'You''re Off the Waitlist!',
  'Hi **{{guardianFirstName}}**. **{{playerFirstName}} {{playerLastName}}** has been moved off the waitlist and is now registered for **{{divisionName}}**. Welcome! We look forward to seeing **{{playerFirstName}}** on the field!',
  NULL, NULL,
  '["guardianFirstName","playerFirstName","playerLastName","seasonName","divisionName"]'::jsonb,
  'house_league'),

-- ── System / retention ──────────────────────────────────────────────────────────
('billing_retention_warning', 'Retention Window Ending', 'Sent when an org''s data retention window is close to expiry.',
  'Your {{orgName}} data retention window is ending soon',
  'Retention window ending soon',
  'The retained data for **{{orgName}}** is scheduled to leave the restore window in about **{{daysUntilExpiry}} days**. Resubscribe or contact support before this date to restore access.',
  'Review Subscription',
  '{{retentionUrl}}',
  '["orgName","daysUntilExpiry","retentionUrl"]'::jsonb,
  'system')

ON CONFLICT (key) DO NOTHING;
