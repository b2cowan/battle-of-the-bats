import { supabaseAdmin } from './supabase-admin';
import { resetTwoStep, twoStepFactsFor } from './two-step-reset';
import { writeOrgAudit } from './org-audit';
import { twoStepRequirementsFor } from './two-step-requirements';
import { sendTwoStepEmail, twoStepResetEmail } from './two-step-emails';
import { clubResetDoorFor, type OrgFacts } from './two-step-club-reset';

/**
 * THE CLUB'S RESET, RUN (Board Ready · two-step sign-in, Part 3; drawings tab 6). Apart from the rule
 * (lib/two-step-club-reset.ts), which "Lost your phone?" reads too and so stays free of the server-only writers.
 */
export type ClubResetResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code?: string };

/**
 * The club resets one person's two-step (Members' Manage window, and the team staff page's person window for a coach).
 * The caller has checked who may manage people and that the target is in this club; this applies the door's own rule
 * AGAIN (a stale window must never reach a reset the rule now refuses), then the reset (lib/two-step-reset.ts: signed out
 * everywhere, every authenticator and backup code removed), then the club audit line and the person's email.
 *
 * `askFreshCode` is `requireFreshCode` (lib/two-step-fresh.ts): one of the five actions that ask for a code, called after
 * every check and before the first write. Passed in so this module stays free of the request.
 */
export async function clubResetTwoStep(args: {
  org: OrgFacts & { name: string };
  actor: { userId: string; role: string | null | undefined; name: string };
  target: { userId: string; role: string | null | undefined };
  askFreshCode: () => Promise<Response | null>;
}): Promise<ClubResetResult | Response> {
  const { org, actor, target } = args;
  const { data: got } = await supabaseAdmin.auth.admin.getUserById(target.userId);
  const email = got?.user?.email ?? null;
  const facts = await twoStepFactsFor(target.userId);
  const door = await clubResetDoorFor({ org, viewer: { userId: actor.userId, role: actor.role }, target: { userId: target.userId, email, role: target.role, on: facts.on } });
  if (door === 'none') return { ok: false, status: 403, error: 'You can’t reset this person’s two-step sign-in.', code: 'not_allowed' };
  if (door === 'support') return { ok: false, status: 403, error: 'Only FieldLogicHQ support can reset this one.', code: 'support_only' };
  if (door === 'own_first') return { ok: false, status: 409, error: 'Turn on two-step sign-in for your own account first.', code: 'own_two_step_off' };

  const stale = await args.askFreshCode();
  if (stale) return stale;

  const outcome = await resetTwoStep(target.userId);
  if (outcome === 'not_signed_out') return { ok: false, status: 502, error: 'We couldn’t reset it. Nothing changed. Try again.' };
  if (outcome === 'not_removed') return { ok: false, status: 502, error: 'We signed them out, but couldn’t finish the reset. Their two-step sign-in is still on. Try again.' };

  await writeOrgAudit(org.id, actor.userId, target.userId, 'two_step_reset', { role: target.role ?? null });

  if (email) {
    let required = false;
    try { required = (await twoStepRequirementsFor({ id: target.userId, email })).requiredNow; } catch { required = false; }
    await sendTwoStepEmail(email, twoStepResetEmail({ orgName: org.name, byName: actor.name, required }), 'two_step_reset', {
      orgId: org.id,
      askedBy: actor.userId,
    });
  }
  return { ok: true };
}
