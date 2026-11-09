/**
 * /invitation-stop?i=<invitationId>&token=<token>
 *
 * Where "Don't send me invitations" on a rep coach's invitation email lands (Signed-in family accounts Stage 4a, Part 5.3; /legal
 * draft (c): the rep invitation is built to the commercial-message standard, with a way to refuse further invitations). A short
 * confirm page with ONE button. ⚠ THIS PAGE WRITES NOTHING: mail scanners prefetch links, so only the button's POST
 * (app/api/invitation-stop/route.ts) stops invitations. The signed token is verified before the page reads anything.
 *
 * No address rides in the link (Stage 2 ruling 2): it is signed on the invitation, and the page shows the address partly hidden.
 * Four states, as /second-parent-stop: confirm, done (also a repeat visit), a link we cannot use, our failure. No sign-in.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import SystemScreen, { SystemAction, type SystemIcon } from '@/components/shared/SystemScreen';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { FAMILY_INVITATION_WORDS } from '@/lib/family-invitation-words';
import { maskEmail } from '@/lib/family-invitation-rules';
import { verifyInviteStopToken } from '@/lib/unsubscribe-token';

interface Props {
  searchParams: Promise<{ i?: string | string[]; token?: string | string[]; error?: string | string[] }>;
}

const WORDS = FAMILY_INVITATION_WORDS.inviteStop;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

type View =
  | { state: 'confirm'; club: string; masked: string; i: string; token: string }
  | { state: 'done'; club: string; masked: string }
  | { state: 'invalid' }
  | { state: 'db' };

// Cached per request on primitives: the metadata and the page both ask, and the reads are paid once.
const viewOf = cache(async (i: string, token: string, failure: string): Promise<View> => {
  if (failure === 'db') return { state: 'db' };
  // The token is checked before anything is read: a link we did not sign touches nothing.
  if (!i || !token || !verifyInviteStopToken(i, token)) return { state: 'invalid' };

  const { data: inv, error } = await supabaseAdmin.from('family_invitations').select('org_id, email').eq('id', i).maybeSingle();
  if (error) return { state: 'db' };
  if (!inv) return { state: 'invalid' };
  const { org_id: orgId, email } = inv as { org_id: string; email: string };
  const [club, stop] = await Promise.all([
    supabaseAdmin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    supabaseAdmin.from('family_invite_stops').select('id').eq('org_id', orgId).eq('email', email).maybeSingle(),
  ]);
  if (club.error || stop.error) return { state: 'db' };
  if (!club.data?.name) return { state: 'invalid' };
  const masked = maskEmail(email);
  return stop.data ? { state: 'done', club: club.data.name, masked } : { state: 'confirm', club: club.data.name, masked, i, token };
});

const ICON: Record<View['state'], SystemIcon> = { confirm: 'mail', done: 'mail', invalid: 'broken', db: 'alert' };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // The tab title reads nothing either while the tier is off (the page body 404s below).
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const sp = await searchParams;
  const view = await viewOf(one(sp.i), one(sp.token), one(sp.error));
  const title = view.state === 'confirm' ? WORDS.title : view.state === 'done' ? WORDS.doneTitle : view.state === 'invalid' ? WORDS.invalidTitle : WORDS.dbTitle;
  return { title, robots: 'noindex' };
}

export default async function InvitationStopPage({ searchParams }: Props) {
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const sp = await searchParams;
  const view = await viewOf(one(sp.i), one(sp.token), one(sp.error));

  if (view.state === 'confirm') {
    return (
      <SystemScreen
        surface="warm"
        wide
        icon={ICON.confirm}
        title={WORDS.title}
        notes={[WORDS.note]}
        actions={
          <form method="post" action="/api/invitation-stop" style={{ display: 'contents' }}>
            <input type="hidden" name="i" value={view.i} />
            <input type="hidden" name="token" value={view.token} />
            <SystemAction kind="primary" submit>{WORDS.button}</SystemAction>
          </form>
        }
        legal="FieldLogicHQ · Canada"
      >
        {WORDS.body(view.club, view.masked)}
      </SystemScreen>
    );
  }
  if (view.state === 'done') {
    return (
      <SystemScreen surface="warm" wide icon={ICON.done} title={WORDS.doneTitle} legal="FieldLogicHQ · Canada">
        {WORDS.doneBody(view.club, view.masked)}
      </SystemScreen>
    );
  }
  if (view.state === 'db') {
    return <SystemScreen surface="warm" wide icon={ICON.db} title={WORDS.dbTitle} legal="FieldLogicHQ · Canada">{WORDS.dbBody}</SystemScreen>;
  }
  return <SystemScreen surface="warm" wide icon={ICON.invalid} title={WORDS.invalidTitle} legal="FieldLogicHQ · Canada">{WORDS.invalidBody}</SystemScreen>;
}
