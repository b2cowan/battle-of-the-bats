/**
 * /unsubscribe/confirmed
 *
 * Where /unsubscribe sends a person: done, a link that does not work, or a failure on our side. Always paper (the first
 * look's warm ground, never a Dark island): people reach it from an email, very often signed out. Wears the system-screen
 * family (The public face, warm: S5). The route and what it does are unchanged.
 */

import type { Metadata } from 'next';
import SystemScreen, { type SystemIcon } from '@/components/shared/SystemScreen';

interface Props {
  searchParams: Promise<{ error?: string | string[] }>;
}

type State = 'done' | 'invalid' | 'db';

/** No `error` is done; `db` is our failure; anything else, including an empty or repeated value, is a link we cannot use. */
function stateOf(error: string | string[] | undefined): State {
  if (error === undefined) return 'done';
  return (Array.isArray(error) ? error[0] : error) === 'db' ? 'db' : 'invalid';
}

const REMOVE = 'we’ll remove you within 10 business days as required by CASL.';

const COPY: Record<State, { icon: SystemIcon; title: string; body: string }> = {
  done: { icon: 'mail', title: 'You’re unsubscribed', body: 'You won’t get these emails again.' },
  invalid: { icon: 'broken', title: 'We can’t use that link', body: `This unsubscribe link has expired or isn’t valid. Reply to any email you received and ${REMOVE}` },
  db: { icon: 'alert', title: 'That didn’t go through', body: `Something went wrong on our side, so you’re not unsubscribed yet. Open the link in your email again in a few minutes. If it still doesn’t work, reply to any email you received and ${REMOVE}` },
};

// The tab and history say what the page says: only the done state claims "Unsubscribed". (The root title template adds the brand.)
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const state = stateOf((await searchParams).error);
  return { title: state === 'done' ? 'Unsubscribed' : COPY[state].title, robots: 'noindex' };
}

export default async function UnsubscribeConfirmedPage({ searchParams }: Props) {
  const state = stateOf((await searchParams).error);
  const { icon, title, body } = COPY[state];

  return (
    <SystemScreen surface="warm" wide={state !== 'done'} icon={icon} title={title} legal="FieldLogicHQ · Canada">
      {body}
    </SystemScreen>
  );
}
