/**
 * /unsubscribe?org=<orgId>&token=<token>                      — org-level marketing opt-out
 * /unsubscribe?user=<userId>&token=<token>                    — per-person opt-out (coach campaigns)
 * /unsubscribe?org=<orgId>&guardian=<email>&token=<token>     — per-family opt-out ("Email families")
 * /unsubscribe?org=<orgId>&sponsor=<email>&token=<token>      — one club's sponsorship offers to one address (Board Ready Stage 6)
 * /unsubscribe?address=<email>&token=<token>                  — every FieldLogicHQ promotional email to one address (Track P P4)
 *
 * Where the unsubscribe link in an email lands (CASL). A short confirm page with ONE button.
 * ⚠ THIS PAGE WRITES NOTHING. Mail scanners prefetch links, so a plain visit must never opt anyone out (sweep 3, finding 7):
 * only the button's POST (app/api/unsubscribe/route.ts) writes, as /second-parent-stop and /invitation-stop do. The signed
 * token is verified before the page reads anything; a link we did not sign touches nothing. An address already opted out
 * is sent on to the "done" page, so a repeat visit (or a scanner) lands somewhere true. No sign-in: the signed token IS the
 * authorization. Links already in inboxes keep their shape, so every email ever sent still works.
 *
 * The three token families are non-interchangeable (distinct HMAC), and the branch order matters exactly as it did in the
 * old route: a user link, then a sponsor link and a guardian link (both carry `org` too), then the org link.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import SystemScreen, { SystemAction } from '@/components/shared/SystemScreen';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { UNSUBSCRIBE_WORDS as WORDS } from '@/lib/unsubscribe-words';
import { maskEmail } from '@/lib/family-invitation-rules';
import { verifyUnsubscribeToken, verifyUserUnsubscribeToken, verifyGuardianUnsubscribeToken, verifySponsorUnsubscribeToken, verifyAddressUnsubscribeToken } from '@/lib/unsubscribe-token';

interface Props {
  searchParams: Promise<{ org?: string | string[]; user?: string | string[]; guardian?: string | string[]; sponsor?: string | string[]; address?: string | string[]; token?: string | string[] }>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

type View =
  | { state: 'confirm'; sentence: string; fields: Record<string, string> }
  | { state: 'done' }
  | { state: 'invalid' }
  | { state: 'db' };

// Cached per request on primitives: the metadata and the page both ask, and the reads are paid once.
const viewOf = cache(async (orgId: string, userId: string, guardianRaw: string, sponsorRaw: string, addressRaw: string, token: string): Promise<View> => {
  const guardian = guardianRaw.trim().toLowerCase();
  const sponsor = sponsorRaw.trim().toLowerCase();
  const address = addressRaw.trim().toLowerCase();

  // An address, from the preview email (Track P Session P4, mig 547): first, as it carries no org. The confirm page shows the
  // address masked, because the email is meant to be forwarded (/legal finding 3): the reader sees which address it stops.
  if (address) {
    if (!token || !verifyAddressUnsubscribeToken(address, token)) return { state: 'invalid' };
    const { data, error } = await supabaseAdmin.from('email_address_stops').select('email').eq('email', address).maybeSingle();
    if (error) return { state: 'db' };
    return data ? { state: 'done' } : { state: 'confirm', sentence: WORDS.address(maskEmail(address)), fields: { address, token } };
  }

  if (userId) {
    if (!token || !verifyUserUnsubscribeToken(userId, token)) return { state: 'invalid' };
    const { data, error } = await supabaseAdmin.from('user_marketing_opt_outs').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) return { state: 'db' };
    return data ? { state: 'done' } : { state: 'confirm', sentence: WORDS.user, fields: { user: userId, token } };
  }

  // A club's sponsorship offers to one address (mig 526): before the guardian and org links, which it never is.
  if (sponsor) {
    if (!orgId || !token || !verifySponsorUnsubscribeToken(orgId, sponsor, token)) return { state: 'invalid' };
    const [club, stop] = await Promise.all([
      supabaseAdmin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      supabaseAdmin.from('club_sponsor_offer_stops').select('email').eq('org_id', orgId).eq('email', sponsor).maybeSingle(),
    ]);
    if (club.error || stop.error) return { state: 'db' };
    if (!club.data?.name) return { state: 'invalid' };
    return stop.data ? { state: 'done' } : { state: 'confirm', sentence: WORDS.sponsor(club.data.name, maskEmail(sponsor)), fields: { org: orgId, sponsor, token } };
  }

  if (guardian) {
    if (!orgId || !token || !verifyGuardianUnsubscribeToken(orgId, guardian, token)) return { state: 'invalid' };
    const [club, optout] = await Promise.all([
      supabaseAdmin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
      supabaseAdmin.from('family_email_optouts').select('email').eq('org_id', orgId).eq('email', guardian).maybeSingle(),
    ]);
    if (club.error || optout.error) return { state: 'db' };
    if (!club.data?.name) return { state: 'invalid' };
    return optout.data ? { state: 'done' } : { state: 'confirm', sentence: WORDS.guardian(club.data.name, maskEmail(guardian)), fields: { org: orgId, guardian, token } };
  }

  if (!orgId || !token || !verifyUnsubscribeToken(orgId, token)) return { state: 'invalid' };
  const { data, error } = await supabaseAdmin.from('organizations').select('name, email_marketing_opt_out').eq('id', orgId).maybeSingle();
  if (error) return { state: 'db' };
  if (!data?.name) return { state: 'invalid' };
  return data.email_marketing_opt_out === true ? { state: 'done' } : { state: 'confirm', sentence: WORDS.org(data.name), fields: { org: orgId, token } };
});

const viewOfParams = async (searchParams: Props['searchParams']) => {
  const sp = await searchParams;
  return viewOf(one(sp.org), one(sp.user), one(sp.guardian), one(sp.sponsor), one(sp.address), one(sp.token));
};

// The tab says what the page says. (The root title template adds the brand.)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const view = await viewOfParams(searchParams);
  return { title: view.state === 'confirm' ? WORDS.title : view.state === 'done' ? 'Unsubscribed' : 'We can’t use that link', robots: 'noindex' };
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const view = await viewOfParams(searchParams);

  // A link we cannot use, or our failure, and an address already opted out: the existing result page says each of them.
  if (view.state === 'invalid') redirect('/unsubscribe/confirmed?error=invalid');
  if (view.state === 'db') redirect('/unsubscribe/confirmed?error=db');
  if (view.state === 'done') redirect('/unsubscribe/confirmed');

  return (
    <SystemScreen
      surface="warm"
      wide
      icon="mail"
      title={WORDS.title}
      notes={[WORDS.note]}
      actions={
        // A plain form post: no script needed, and the page that answers is the page that reports what was written.
        <form method="post" action="/api/unsubscribe" style={{ display: 'contents' }}>
          {Object.entries(view.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <SystemAction kind="primary" submit>{WORDS.button}</SystemAction>
        </form>
      }
      legal="FieldLogicHQ · Canada"
    >
      {view.sentence}
    </SystemScreen>
  );
}
