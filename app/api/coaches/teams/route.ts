import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { createBasicCoachTeam } from '@/lib/basic-coach-teams';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import { basicCoachTeamWelcomeHtml, sendEmail, SITE_URL } from '@/lib/email';
import { withObservability } from '@/lib/observability';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function requireCoachUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;
  // FieldLogicHQ staff are NOT coaches — never let a platform-admin session create a
  // public-facing coach team (mirrors the guard on /api/coaches/basic-teams).
  if (await isPlatformAdminEmail(user.email)) return null;
  // The account's real name (post name-parity) — used as the team's primary_coach_name
  // fallback so a coach-created team is never nameless (a nameless team would later be
  // un-selectable in the tournament register form).
  const md = (user.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const name = cleanText(
    pick(md.full_name) || pick(md.display_name) || `${pick(md.first_name)} ${pick(md.last_name)}`.trim(),
    120,
  ) || null;
  return { id: user.id, email: user.email, name };
}

/**
 * Create a standalone (org-less) Basic coach team for the signed-in user — the
 * Phase-2 `/start/team` on-ramp. Separates workspace creation from auth: the user
 * is already signed in, so this never touches the auth layer (existing emails can't
 * error here). Returns the new team id so the client can route to its org-less home.
 */
export const POST = withObservability(async (req: NextRequest) => {
  try {
    const user = await requireCoachUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);

    const body = await req.json().catch(() => ({})) as {
      name?: unknown;
      primaryCoachName?: unknown;
      sport?: unknown;
      ageGroup?: unknown;
    };

    const name = cleanText(body.name, 120);
    if (!name) return json({ error: 'A team name is required.' }, 400);

    const primaryCoachName = cleanText(body.primaryCoachName, 120) || null;
    const sport = cleanText(body.sport, 80) || null;
    const ageGroup = cleanText(body.ageGroup, 80) || null;

    const id = await createBasicCoachTeam({
      userId: user.id,
      email: user.email,
      name,
      // Fall back to the coach's account name so the team always carries a contact name.
      primaryCoachName: primaryCoachName ?? user.name,
      sport,
      ageGroup,
    });

    try {
      await sendEmail(
        user.email,
        `Your team home is ready - ${name}`,
        basicCoachTeamWelcomeHtml({
          teamName: name,
          coachName: primaryCoachName ?? user.name,
          teamUrl: `${SITE_URL}${coachTeamPath(id)}`,
        }),
      );
    } catch (emailError) {
      console.error('[coaches teams POST] welcome email error:', emailError);
    }

    return json({ ok: true, id });
  } catch (error) {
    console.error('[coaches teams POST] error:', error);
    return json({ error: 'Could not create your team.' }, 500);
  }
}, { route: '/api/coaches/teams' });
