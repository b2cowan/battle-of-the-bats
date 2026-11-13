/**
 * What sending ONE email to several owners came to (GST/HST 6.4 ruling Q4: claim the once-only stamp once, then send to each owner).
 * No server imports, so the plan-ending emails and the purchase email share one rule and the tests read it.
 *   · `sent` when any one went: the stamp stays (sending again would mail that owner twice);
 *   · `not_sent` only when every one definitely did not go (a definite refusal, or `skipped`: no mail service here): the stamp
 *     is given back for the next run;
 *   · else `unknown` (a send with no answer may still have gone): the stamp stays and a person is told in the log.
 */
export type OwnersSendOutcome = 'sent' | 'not_sent' | 'unknown';

/** What one send came back with (the fields the rule reads); null = no answer. */
export type SendResultLike = { status: string; refused?: boolean } | null;

export function ownersSendOutcome(
  results: ReadonlyArray<SendResultLike>,
  opts: { skippedIsSent?: boolean } = {},
): OwnersSendOutcome {
  // `skipped` = no mail service here (dev): nothing went. A caller that has always counted that as done says so.
  const sent = (r: SendResultLike) => r?.status === 'sent' || (opts.skippedIsSent === true && r?.status === 'skipped');
  if (results.some(sent)) return 'sent';
  if (results.every(r => r?.status === 'skipped' || (r?.status === 'provider_error' && r.refused === true))) return 'not_sent';
  return 'unknown';
}

/** Send to each owner in turn and say what it came to. A throw is read as "may have gone" (the request may have reached the
 *  mail service), never as "did not go". */
export async function sendToOwners<R extends { userId: string; email: string }>(
  recipients: ReadonlyArray<R>,
  send: (to: R) => Promise<SendResultLike | undefined>,
  opts: { skippedIsSent?: boolean } = {},
): Promise<OwnersSendOutcome> {
  const results: SendResultLike[] = [];
  for (const r of recipients) {
    try {
      results.push((await send(r)) ?? null);
    } catch {
      results.push(null);
    }
  }
  return ownersSendOutcome(results, opts);
}
