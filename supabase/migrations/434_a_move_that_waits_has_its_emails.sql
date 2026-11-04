-- 434_a_move_that_waits_has_its_emails.sql
--
-- Plans end at the renewal date, Stage 2 Part C (owner rulings 2026-11-03 ruling 5 and 2026-11-04; plan
-- docs/projects/active/PLAN_ENDS_AT_RENEWAL_PLAN.md §4 item 2): the emails of a move to the free plan that waits for its
-- renewal date — "Your move to {plan} is scheduled for {date}" at the click and its reminder seven days before — and
-- `plan_downgraded`, which is now sent ON the date ("{Org} is now on {plan}"), not at the click.
--
-- DATA-ONLY: two new rows in platform_email_templates, so each email is listed (and can be customised) on the
-- platform-admin Email templates page; plus `plan_downgraded`'s description (always — it is the page's note of when the
-- email goes, and it was untrue) and its words (ONLY while an operator has not customised it). No schema change: the
-- once-only stamps these emails write (ends_on_email_sent_at, reminder_email_sent_at, ended_email_sent_at) came with
-- migration 424.
--
-- The app sends its own built-in words (lib/plan-ending-emails.ts) unless an operator customises a row (is_customised),
-- so these bodies are the starting point for a customisation, kept in the same words. ON CONFLICT DO NOTHING: a re-run,
-- or a row an operator already saved, is never overwritten. The update is re-runnable.
--
-- ⚠ DATA-ONLY MIGRATIONS ARE INVISIBLE TO check:migrations — recorded in MANUAL_PROD_STEPS.json; prod is owed before
-- the promote that ships Stage 2 Part C (after 424, 425 and 431).

insert into platform_email_templates (key, label, description, subject, heading, body, cta_label, cta_url_pattern, variables, category)
values
($k$plan_downgrade_scheduled$k$, $k$Move to the free plan scheduled$k$,
  $k$Sent when an owner moves a paid plan to the free plan and the move waits for the renewal date. Once per waiting move; the daily job sends it late if the first send failed.$k$,
  $k$Your move to {{targetPlanLabel}} is scheduled for {{date}}$k$,
  $k$Your move to {{targetPlanLabel}} is scheduled$k$,
  $k$You chose to move **{{orgName}}** from **{{planLabel}}** to **{{targetPlanLabel}}**. This takes effect on {{date}}, the end of the period you paid for. Until then you keep every {{planLabel}} tool. Nothing is credited.

On {{date}}, {{orgName}} moves to {{targetPlanLabel}}. You keep **{{keptTournaments}}**. Any other tournament is archived then and kept until **{{retentionUntil}}**, so it can come back if you upgrade before then.

Changed your mind? You can keep {{planLabel}} any time before {{date}}.$k$,
  $k$Keep {{planLabel}}$k$, $k${{keepUrl}}$k$,
  '["orgName","planLabel","targetPlanLabel","date","retentionUntil","keptTournaments","archivedTournaments","keepUrl","billingUrl"]'::jsonb, 'billing'),

($k$plan_downgrade_reminder$k$, $k$Move to the free plan reminder$k$,
  $k$Sent by the daily job seven days before a waiting move to the free plan. Skipped when the move was made with under seven days left, or kept.$k$,
  $k$Your move to {{targetPlanLabel}} is coming up$k$,
  $k$Your move to {{targetPlanLabel}} is on {{date}}$k$,
  $k$**{{orgName}}** moves from **{{planLabel}}** to **{{targetPlanLabel}}** on {{date}}. Until then everything stays open.

On {{date}}, you keep **{{keptTournaments}}**. Any other tournament is archived then and kept until **{{retentionUntil}}**.$k$,
  $k$Keep {{planLabel}}$k$, $k${{keepUrl}}$k$,
  '["orgName","planLabel","targetPlanLabel","date","retentionUntil","keptTournaments","archivedTournaments","keepUrl","billingUrl"]'::jsonb, 'billing')
on conflict (key) do nothing;

-- When it goes (always: the page's note was untrue — it went at the click; now it goes on the date).
update platform_email_templates
set description = $k$Sent on the date a move to the free plan happens: the renewal date of a paid plan, or at once when there is no paid period to wait for. Once per move.$k$,
    updated_at = now()
where key = 'plan_downgraded';

-- Its words, only while nobody has customised them (the app's own words are sent then anyway).
update platform_email_templates
set subject = $k${{orgName}} is now on {{toPlanLabel}}$k$,
    heading = $k$You’re now on {{toPlanLabel}}$k$,
    body = $k$**{{orgName}}** moved from **{{fromPlanLabel}}** to **{{toPlanLabel}}** on {{date}}, as you chose.

You kept **{{keptTournaments}}**. Any other tournament was archived and is kept until **{{retentionUntil}}**. Upgrade before then and it comes back.$k$,
    cta_label = $k$Open Plan & billing$k$,
    variables = '["orgName","fromPlanLabel","toPlanLabel","planLabel","targetPlanLabel","date","retentionUntil","keptTournaments","archivedTournaments","billingUrl"]'::jsonb,
    updated_at = now()
where key = 'plan_downgraded' and is_customised = false;
