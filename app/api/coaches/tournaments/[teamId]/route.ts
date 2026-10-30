import { NextRequest, NextResponse } from 'next/server';
import { premiumInForceRefusalFor, requireCoachRegistrationAccess } from '@/lib/coach-team-guard';
import { resolveEventHeadCoachAccess } from '@/lib/coach-registration-access';
import {
  canEditEventHeadCoach,
  EVENT_HEAD_COACH_REFUSED,
  HEAD_COACH_EMAIL_INVALID,
  HEAD_COACH_NAME_REQUIRED,
} from '@/lib/coach-event-head-coach';
import { isValidEmail } from '@/lib/auth-errors';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * Coach-side head-coach + contact assignment API (free-tier Coaches Phase 5l).
 *
 *   PATCH → set/change the team's head-coach NAME (`teams.coach`) and an OPTIONAL coach contact
 *           email (`teams.coach_email`) for this tournament. Sibling of the 5j roster route
 *           (`./roster/route.ts`); same auth + error shape.
 *
 * The `[teamId]` path param is a tournament REGISTRATION id (`teams.id`), so auth goes through
 * `requireCoachRegistrationAccess` (explicit-link ownership; 403 for an unclaimed/foreign reg).
 *
 * Invariants:
 *   • `teams.coach` is NULLABLE in both envs (migration 202 dropped prod's NOT NULL; migration 204
 *     normalized the 17 legacy `''` rows to NULL). This route still REJECTS an empty submitted
 *     name with a 400 — but that is now a product rule, not a schema constraint: a coach editing
 *     their own team should not be able to blank the name. If absence ever needs storing here,
 *     write NULL — never `''`.
 *   • `teams.email` is the portal access/claim key and is NEVER touched here. The new contact email
 *     lives in the separate `teams.coach_email` (mig 124); coach-facing emails prefer
 *     `coach_email ?? email` (see `resolveCoachRecipient` in lib/email.ts). Clearing the contact
 *     email (empty/null) reverts routing to `teams.email`.
 */

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ teamId: string }> };

export const PATCH = withObservability(async (req: NextRequest, { params }: RouteCtx) => {
  try {
    const { teamId } = await params;
    const guard = await requireCoachRegistrationAccess(teamId);
    if (!guard.ok) return authError(guard.status);
    if (guard.via === 'membership' && guard.basicCoachTeamId) {
      const premium = await premiumInForceRefusalFor(guard.basicCoachTeamId);
      if (premium) return json({ error: premium }, 409);
    }
    // Stage 7d (Ask 10): opening the entry is not changing who the organizer writes to. The same rule
    // the record reads to draw the form or the line — so the page never offers what this refuses.
    if (!canEditEventHeadCoach(await resolveEventHeadCoachAccess(guard.user.id, teamId))) {
      return json({ error: EVENT_HEAD_COACH_REFUSED }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as { coach?: unknown; coachEmail?: unknown };
    const updates: { coach?: string; coach_email?: string | null } = {};

    // Head-coach NAME — only when provided. Empty/whitespace is rejected (never write null/''):
    // teams.coach drives admin displays + email greetings (a product rule; the column is nullable — see the header).
    if (body.coach !== undefined) {
      if (typeof body.coach !== 'string') return json({ error: 'Invalid head coach name.' }, 400);
      const name = body.coach.trim();
      if (!name) return json({ error: HEAD_COACH_NAME_REQUIRED }, 400);
      if (name.length > 120) return json({ error: 'Head coach name is too long.' }, 400);
      updates.coach = name;
    }

    // OPTIONAL contact email — only when the key is present (so PATCHing just the name leaves it
    // alone). Empty/null clears it (routing reverts to teams.email). teams.email is never touched.
    if ('coachEmail' in body) {
      const raw = body.coachEmail;
      if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) {
        updates.coach_email = null;
      } else if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase();
        if (!isValidEmail(normalized)) return json({ error: HEAD_COACH_EMAIL_INVALID }, 400);
        // FieldLogicHQ staff are never coaches — don't route coach emails to a staff inbox
        // (mirrors the register / add-teams contact guard; defensive, coach_email is recipient-only).
        if (await isPlatformAdminEmail(normalized)) {
          return json({ error: "That email belongs to FieldLogicHQ staff and can't be used as a coach contact." }, 400);
        }
        updates.coach_email = normalized;
      } else {
        return json({ error: 'Invalid coach contact email.' }, 400);
      }
    }

    if (Object.keys(updates).length === 0) return json({ ok: true });

    const { error } = await supabaseAdmin
      .from('teams')
      .update(updates)
      .eq('id', teamId);
    if (error) throw error;

    return json({ ok: true, coach: updates.coach, coachEmail: updates.coach_email });
  } catch (error) {
    console.error('[coaches head-coach PATCH] error:', error);
    return json({ error: 'Could not update the head coach.' }, 500);
  }
}, { route: '/api/coaches/tournaments/[teamId]' });
