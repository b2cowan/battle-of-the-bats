import { readEndedPreview } from '@/lib/preview-ended-server';
import { ENDED_WORDS } from '@/lib/preview-ended';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { planStepPath } from '@/lib/start-door';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSignedInUser } from '@/lib/two-step-session';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { readRealSeats } from '@/lib/org-membership-policy';
import { CLAIM_WORDS } from '@/lib/preview-claim';
import { holdsSeatIn, openClaimPass, readClaimDoor, type ClaimClub } from '@/lib/preview-claim-server';
import { claimVisitorIp, claimVisitorKeyFromIp } from '@/lib/preview-claim-pass';
import ClaimDoor, { type ClaimFrame } from './ClaimDoor';

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

/** Our own door page, never indexed (a preview is unlisted; its claim page names the prospect). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // A removed preview's claim page says it has ended (Session P4, /design): its tab and link preview say so too.
  let key = slug;
  try { key = decodeURIComponent(slug); } catch { /* a malformed address: the page itself is not found */ }
  const ended = await readEndedPreview(key);
  if (ended) return { title: { absolute: ENDED_WORDS.pageTitle(ended.name) }, robots: { index: false, follow: false } };
  return { title: `Claim ${slug}`, robots: { index: false, follow: false } };
}

/** The same visitor key the check route counts by, from the request's own headers. */
async function visitorKey(): Promise<string> {
  return claimVisitorKeyFromIp(claimVisitorIp(await headers()));
}

/**
 * /start/claim/{club} — "Claim it" on a preview club (Club Website Track P, Session P3; drawing tabs 6 and 8). Ours, not
 * the club's: Start a club's look, because from here the person is signing up with us. The frame it shows:
 *   - no preview by that address → not found
 *   - removed → "This preview has ended" · claimed → "{club} is claimed" (tab 6.7)
 *   - open, no good pass → the code page (resting after five wrong codes)
 *   - open, a good pass, signed out → Start a club's account step (tab 6.2), its email returning here with the pass
 *   - open, a good pass, signed in → the claim step (tab 6.3), or why this account can't claim
 * A forwarded link (tab 8) lands on the code page like anyone else: the code is on the card, never in an email.
 */
export default async function ClaimPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pass?: Param }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  const sp = await searchParams;
  const pass = first(sp.pass) ?? null;

  const door = await readClaimDoor(slug, await visitorKey());
  if (door.state === 'missing') notFound();

  const club: ClaimClub = door.club;
  let frame: ClaimFrame;
  if (door.state === 'removed') frame = { kind: 'ended', removedOn: door.removedOn };
  else if (door.state === 'claimed') {
    // Its new owner coming back (a lost answer, the email's link again) goes on to the plan step, never "already claimed".
    const supabase = await createClient();
    const user = await getSignedInUser(supabase);
    if (user && await holdsSeatIn(user.id, club.orgId)) redirect(planStepPath(club.slug, null));
    frame = { kind: 'claimed' };
  }
  else {
    const opened = await openClaimPass(slug, pass);
    if (!opened) frame = { kind: 'code', resting: door.state === 'resting', passGone: Boolean(pass) };
    else {
      const supabase = await createClient();
      const user = await getSignedInUser(supabase);
      const next = `/start/claim/${encodeURIComponent(slug)}?pass=${encodeURIComponent(pass!)}`;
      if (!user?.email) frame = { kind: 'account', next };
      else if (await isPlatformAdminEmail(user.email)) frame = { kind: 'refused', message: CLAIM_WORDS.err.staff, differentEmail: true, next };
      else {
        const seats = (await readRealSeats(user.id)).filter(s => s.organizationId !== club.orgId);
        if (seats.length > 0) {
          const { data: own } = await supabaseAdmin.from('organizations').select('name').eq('id', seats[0].organizationId).maybeSingle();
          const ownName = (own as { name: string } | null)?.name;
          frame = {
            kind: 'refused',
            message: ownName ? CLAIM_WORDS.err.otherClub(ownName, club.name) : CLAIM_WORDS.err.otherClubUnnamed(club.name),
            differentEmail: true,
            next,
          };
        } else {
          frame = { kind: 'claim', pass: pass! };
        }
      }
    }
  }

  return <ClaimDoor slug={slug} club={club} frame={frame} />;
}
