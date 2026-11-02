-- 425_a_cancel_that_waits_has_its_emails.sql
--
-- Plans end at the renewal date, Stage 1 Part C (gap review G6; plan docs/projects/active/PLAN_ENDS_AT_RENEWAL_PLAN.md):
-- the six emails of a cancel that waits for its date — "Your plan ends on {date}", the reminder seven days before, and
-- "Your plan will renew" after Keep {Plan} — each in a club version and a Coaches Portal (Premium) version.
--
-- DATA-ONLY: one row per template key in platform_email_templates, so each email is listed (and can be customised) on the
-- platform-admin Email templates page. No schema change — the once-only stamps these emails write
-- (ends_on_email_sent_at, reminder_email_sent_at, kept_email_sent_at) came with migration 424.
--
-- The app sends its own built-in words (lib/plan-ending-emails.ts) unless an operator customises a row (is_customised),
-- so these bodies are the starting point for a customisation, kept in the same words. ON CONFLICT DO NOTHING: a re-run,
-- or a row an operator already saved, is never overwritten.
--
-- ⚠ DATA-ONLY MIGRATIONS ARE INVISIBLE TO check:migrations — recorded in MANUAL_PROD_STEPS.json; prod is owed before
-- the promote that ships Part C (with migration 424).

insert into platform_email_templates (key, label, description, subject, heading, body, cta_label, cta_url_pattern, variables, category)
values
($k$plan_ends_on$k$, $k$Plan ends on a date$k$,
  $k$Sent when a plan is cancelled: an owner's cancel, an operator's (only when "Email the owner" is ticked), or a cancel in Stripe's billing portal. Once per waiting cancel.$k$,
  $k$Your {{planLabel}} plan ends on {{date}}$k$,
  $k$Your plan ends on {{date}}$k$,
  $k$You cancelled **{{planLabel}}** for **{{orgName}}**. Everything stays open until {{date}}, the end of the period you paid for. Nothing more is charged.

On {{date}}, {{orgName}} is suspended and its tournaments are archived. Your data is kept until **{{retentionUntil}}**, and everything comes back if you resubscribe before then.

Changed your mind? You can keep {{planLabel}} any time before {{date}}.$k$,
  $k$Keep {{planLabel}}$k$, $k${{keepUrl}}$k$,
  '["orgName","planLabel","date","retentionUntil","keepUrl","billingUrl"]'::jsonb, 'billing'),

($k$plan_ending_reminder$k$, $k$Plan ending reminder$k$,
  $k$Sent by the daily job seven days before a cancelled plan ends. Skipped when it was cancelled with under seven days left, or kept.$k$,
  $k$Your {{planLabel}} plan ends soon$k$,
  $k$Your {{planLabel}} plan ends on {{date}}$k$,
  $k$Your **{{planLabel}}** plan for **{{orgName}}** ends on {{date}}. Until then everything stays open.

On {{date}}, {{orgName}} is suspended and its tournaments are archived. Your data is kept until **{{retentionUntil}}**.$k$,
  $k$Keep {{planLabel}}$k$, $k${{keepUrl}}$k$,
  '["orgName","planLabel","date","retentionUntil","keepUrl","billingUrl"]'::jsonb, 'billing'),

($k$plan_kept$k$, $k$Plan kept$k$,
  $k$Sent when a cancelled plan is kept before its end date (Keep {Plan}, by the owner or by an operator when ticked, or Renew in Stripe's billing portal).$k$,
  $k${{planLabel}} will renew on {{date}}$k$,
  $k${{planLabel}} stays on$k$,
  $k$You kept **{{planLabel}}** for **{{orgName}}**. It renews on {{date}} at {{price}}. Nothing else changes.$k$,
  $k$Open Plan & billing$k$, $k${{billingUrl}}$k$,
  '["orgName","planLabel","date","price","renewsAs","billingUrl"]'::jsonb, 'billing'),

($k$team_workspace_ends_on$k$, $k$Coaches Portal Premium ends on a date$k$,
  $k$Sent when Premium is cancelled for a Coaches Portal, by the coach, an operator (only when ticked), or in Stripe's billing portal. Once per waiting cancel.$k$,
  $k$Premium for your {{orgName}} Coaches Portal ends on {{date}}$k$,
  $k$Premium ends on {{date}}$k$,
  $k$You cancelled Premium for your **{{orgName}}** Coaches Portal. Premium tools stay on until {{date}}, the end of the period you paid for. Nothing more is charged.

On {{date}}, Premium tools stop. Your team is kept until **{{retentionUntil}}**, and everything comes back if you resubscribe before then. Basic tournament records stay available.

Changed your mind? You can keep Premium any time before {{date}}.$k$,
  $k$Keep Premium$k$, $k${{keepUrl}}$k$,
  '["orgName","planLabel","date","retentionUntil","keepUrl","billingUrl"]'::jsonb, 'billing'),

($k$team_workspace_ending_reminder$k$, $k$Coaches Portal Premium ending reminder$k$,
  $k$Sent by the daily job seven days before Premium ends for a Coaches Portal. Skipped when it was cancelled with under seven days left, or kept.$k$,
  $k$Premium for your {{orgName}} Coaches Portal ends soon$k$,
  $k$Premium ends on {{date}}$k$,
  $k$Premium for your **{{orgName}}** Coaches Portal ends on {{date}}. Until then every Premium tool stays on.

On {{date}}, Premium tools stop. Your team is kept until **{{retentionUntil}}**. Basic tournament records stay available.$k$,
  $k$Keep Premium$k$, $k${{keepUrl}}$k$,
  '["orgName","planLabel","date","retentionUntil","keepUrl","billingUrl"]'::jsonb, 'billing'),

($k$team_workspace_kept$k$, $k$Coaches Portal Premium kept$k$,
  $k$Sent when Premium is kept for a Coaches Portal before its end date.$k$,
  $k$Premium for your {{orgName}} Coaches Portal will renew on {{date}}$k$,
  $k$Premium stays on$k$,
  $k$You kept Premium for your **{{orgName}}** Coaches Portal. It renews on {{date}} at {{price}}. Nothing else changes.$k$,
  $k$Open Plan & billing$k$, $k${{billingUrl}}$k$,
  '["orgName","planLabel","date","price","billingUrl"]'::jsonb, 'billing')
on conflict (key) do nothing;
