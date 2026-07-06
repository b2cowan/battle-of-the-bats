import { NextResponse } from 'next/server';
import { findPendingInviteByEmail } from '@/lib/invite-reconciliation';
import { sendPendingInviteLink } from '@/lib/invite-links';
import { withObservability } from '@/lib/observability';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';

// Self-serve "email me my invitation link" from the sign-up screen. UNAUTHENTICATED — the
// invitee can't call the admin-only reinvite route. ALWAYS returns the same neutral response,
// so it can't be used to probe whether a given email has a pending invite (mirrors the
// forgot-password posture). Rate-limited like /api/auth/signup (unauth admin-API + email send).
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(60 * MINUTE, 6);      // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 40);  // spoofing-proof ceiling across all callers
const emailLimiter = new FixedWindowRateLimiter(60 * MINUTE, 3);   // per target email — caps inbox-spam of one invitee

const NEUTRAL = { ok: true } as const;

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();

  // Neutral on malformed input too — never leak validity distinctions.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(NEUTRAL);
  }

  const ip = clientIpFrom(req);
  // Per-email cap prevents rotating IPs from spamming one invitee's inbox; keep the response
  // neutral when throttled so it stays a non-oracle.
  if (!ipLimiter.take(ip) || !globalLimiter.take('global') || !emailLimiter.take(email)) {
    return NextResponse.json(NEUTRAL);
  }

  const invite = await findPendingInviteByEmail(email);
  if (invite && invite.orgSlug && invite.orgName) {
    // Best-effort — a send failure must not turn the neutral response into an oracle.
    await sendPendingInviteLink({
      memberId: invite.memberId,
      userId: invite.userId,
      role: invite.role,
      orgName: invite.orgName,
      orgSlug: invite.orgSlug,
    }).catch(() => {});
  }

  return NextResponse.json(NEUTRAL);
}, { route: '/api/auth/resend-invite' });
