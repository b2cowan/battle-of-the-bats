/**
 * /second-parent-stop?org=<orgId>&email=<address>&token=<token>
 *
 * Where the "Stop these emails" button on a second parent's copy of a sign-up email lands (Signed-in family accounts Stage 3b;
 * owner calls O1–O5 ruled 2026-11-06). A short confirm page: it names the club and the address and has ONE button.
 * ⚠ THIS PAGE WRITES NOTHING. Mail scanners prefetch links, so the link opens this page and only the button's POST
 * (app/api/second-parent-stop/route.ts) stops an address. The signed token is verified before the page reads anything.
 *
 * Four states: confirm (the button), done (this address is stopped: also what a repeat visit shows, so a stop is idempotent
 * and a scanner or a second tap lands somewhere true), a link we cannot use, and our failure. No sign-in: the people who reach
 * it hold a link in their inbox. Always paper (the first look's warm ground), like /unsubscribe/confirmed, and the same
 * system-screen family. The words are SECOND_PARENT_WORDS.stop (one edit for /marketing).
 */

import type { Metadata } from 'next';
import SystemScreen, { SystemAction, type SystemIcon } from '@/components/shared/SystemScreen';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SECOND_PARENT_WORDS } from '@/lib/league-second-parent';
import { verifySecondParentStopToken } from '@/lib/unsubscribe-token';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { FAMILY_HOME_WORDS } from '@/lib/family-home-words';

interface Props {
  searchParams: Promise<{ org?: string | string[]; email?: string | string[]; token?: string | string[]; error?: string | string[] }>;
}

const WORDS = SECOND_PARENT_WORDS.stop;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

type View =
  /** `joined`: the children this address joined as the SECOND parent (Stage 4a, ruling 8): the stop ends that too, so /legal
   *  draft (d) says so before the one press. Empty for an address that never joined (and while the guardian tier is off). */
  | { state: 'confirm'; club: string; email: string; org: string; token: string; joined: string[] }
  | { state: 'done'; club: string; email: string }
  | { state: 'invalid' }
  | { state: 'db' };

async function viewOf(sp: Awaited<Props['searchParams']>): Promise<View> {
  if (one(sp.error) === 'db') return { state: 'db' };
  const org = one(sp.org);
  const email = one(sp.email).trim().toLowerCase();
  const token = one(sp.token);
  // The token is checked before anything is read: a link we did not sign touches nothing.
  if (!org || !email || !token || !verifySecondParentStopToken(org, email, token)) return { state: 'invalid' };

  const [club, stop] = await Promise.all([
    supabaseAdmin.from('organizations').select('name').eq('id', org).maybeSingle(),
    supabaseAdmin.from('second_parent_stops').select('id').eq('org_id', org).eq('email', email).maybeSingle(),
  ]);
  if (club.error || stop.error) return { state: 'db' };
  if (!club.data?.name) return { state: 'invalid' };
  return stop.data
    ? { state: 'done', club: club.data.name, email }
    : { state: 'confirm', club: club.data.name, email, org, token, joined: await joinedAsSecondParent(org, email) };
}

/** The first names of the children this address is connected to as the second parent in this club (never a first-parent
 *  connection: a stop never ends one, CASL flag d). A read only; the page still writes nothing. */
async function joinedAsSecondParent(org: string, email: string): Promise<string[]> {
  if (!GUARDIAN_TIER_ENABLED) return [];
  const { data, error } = await supabaseAdmin.from('family_links').select('child_id')
    .eq('org_id', org).eq('invited_email', email).eq('invited_as', 'second_parent').eq('status', 'verified');
  if (error || !data?.length) return [];
  const { data: kids } = await supabaseAdmin.from('org_children').select('first_name')
    .eq('org_id', org).in('id', [...new Set((data as { child_id: string }[]).map(r => r.child_id))]);
  return ((kids ?? []) as { first_name: string }[]).map(k => k.first_name).sort((a, b) => a.localeCompare(b));
}

const ICON: Record<View['state'], SystemIcon> = { confirm: 'mail', done: 'mail', invalid: 'broken', db: 'alert' };

// The tab and history say what the page says. (The root title template adds the brand.)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const view = await viewOf(await searchParams);
  const title = view.state === 'confirm' ? WORDS.title : view.state === 'done' ? WORDS.doneTitle : view.state === 'invalid' ? WORDS.invalidTitle : WORDS.dbTitle;
  return { title, robots: 'noindex' };
}

export default async function SecondParentStopPage({ searchParams }: Props) {
  const view = await viewOf(await searchParams);

  if (view.state === 'confirm') {
    return (
      <SystemScreen
        surface="warm"
        wide
        icon={ICON.confirm}
        title={WORDS.title}
        // Stage 4a (ruling 8, /legal draft (d)): first, for an address that joined as the second parent, what the stop also ends.
        notes={view.joined.length > 0 ? [FAMILY_HOME_WORDS.stopJoined(view.joined, view.club), WORDS.note] : [WORDS.note]}
        actions={
          // A plain form post: no script needed, and the page that answers is the page that reports what was written.
          <form method="post" action="/api/second-parent-stop" style={{ display: 'contents' }}>
            <input type="hidden" name="org" value={view.org} />
            <input type="hidden" name="email" value={view.email} />
            <input type="hidden" name="token" value={view.token} />
            <SystemAction kind="primary" submit>{WORDS.button}</SystemAction>
          </form>
        }
        legal="FieldLogicHQ · Canada"
      >
        {WORDS.body(view.club, view.email)}
      </SystemScreen>
    );
  }
  if (view.state === 'done') {
    return (
      <SystemScreen surface="warm" wide icon={ICON.done} title={WORDS.doneTitle} legal="FieldLogicHQ · Canada">
        {WORDS.doneBody(view.club, view.email)}
      </SystemScreen>
    );
  }
  if (view.state === 'db') {
    return <SystemScreen surface="warm" wide icon={ICON.db} title={WORDS.dbTitle} legal="FieldLogicHQ · Canada">{WORDS.dbBody}</SystemScreen>;
  }
  return <SystemScreen surface="warm" wide icon={ICON.invalid} title={WORDS.invalidTitle} legal="FieldLogicHQ · Canada">{WORDS.invalidBody}</SystemScreen>;
}
