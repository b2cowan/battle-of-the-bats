import 'server-only';
import { sendEmail, paymentConfirmationHtml, coachEmailBlock, resolveCoachRecipient } from '@/lib/email';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { notify } from '@/lib/notify';
import { notifyTeamCoaches } from '@/lib/team-coach-notices';
import { TEAM_COACH_WORDS } from '@/lib/team-coach-notice-plan';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';

/**
 * A TEAM'S FEE IS NOW PAID IN FULL — the three things that follow it (the one place).
 *
 * The coach's confirmation email (unless the host switched it off), the host's own bell, and the coach's bell. Called when a
 * payment is what COMPLETES the fee (`PaymentOutcome.becamePaid`): the Teams window's Record and Mark paid, and the bulk and
 * check-in doors keep their own rules about which of the three they send. A part payment tells nobody, as before.
 * "Not tracked here" records no payment anywhere, the bell included (owner 2026-10-13).
 */
export async function announceTeamPaid(
  ctx: { org: { id: string; slug: string }; user: { id: string } },
  teamId: string,
  paidTotal: number | null,
): Promise<void> {
  const { data: team } = await supabaseAdmin
    .from('teams').select('id, name, coach, email, coach_email, division_id, tournament_id').eq('id', teamId).maybeSingle();
  if (!team) return;
  const { data: tournament } = await supabaseAdmin
    .from('tournaments').select('name, org_id, settings').eq('id', team.tournament_id).maybeSingle();
  const { data: division } = team.division_id
    ? await supabaseAdmin.from('divisions').select('name').eq('id', team.division_id).maybeSingle()
    : { data: null };
  const settings = tournament?.settings ?? null;

  if (tournamentTracksPayments(settings)) {
    await notifyTeamCoaches({
      registrationIds: [team.id],
      eventType: 'team_coach_payment_recorded',
      compose: c => TEAM_COACH_WORDS.paymentRecorded(c, paidTotal ?? undefined),
      excludeUserIds: [ctx.user.id],
    });
  }

  if (!coachEmailBlock(settings, 'payment', team)) {
    const fallback = tournament?.org_id ? (await getOrgOwnerEmail(tournament.org_id)) ?? null : null;
    const contactEmail = (await resolveTournamentContactEmail(team.tournament_id, fallback, 'coach')) ?? undefined;
    await sendEmail(resolveCoachRecipient(team), `Payment Recorded — ${team.name}`, paymentConfirmationHtml({
      teamName: team.name,
      coachName: team.coach,
      divisionName: division?.name ?? 'Division',
      tournamentName: tournament?.name ?? 'Tournament',
      teamId: team.id,
      coachEmail: team.email,
      contactEmail,
    }));
  }

  notify({
    orgId: ctx.org.id,
    tournamentId: team.tournament_id,
    eventType: 'payment_received',
    title: `Payment received: ${team.name}`,
    body: 'Team payment recorded as paid',
    link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${team.tournament_id}`,
    excludeUserIds: [ctx.user.id],
  }).catch(console.error);
}
