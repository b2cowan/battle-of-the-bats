/**
 * The billing handler's messages to a CUSTOMER (a club's or portal's owners), behind one gate so a replay sends none (Plans &
 * pricing Stage 2 Part 5, owner ruling 1, 2026-11-08: "no customer message from a replay"; the owner's intent covers an in-app
 * notice as well as an email). A live delivery passes no replay input and every message goes exactly as before.
 *
 * Pure (the real senders are handed in), so `tests/unit/billing-event-replay.test.ts` proves both sides with spies, and its guard
 * proves `lib/billing-webhook-handler.ts` reaches the senders only through here. Owner alerts to our own inbox are not customer
 * messages and do not pass through it.
 */
export type RunOptions = {
  /** A staff replay of a stored event (`lib/billing-event-replay-run.ts`): no message reaches a customer. */
  replay?: boolean;
};

export type CustomerSenders<Email extends (...args: never[]) => Promise<unknown>, Notice extends (...args: never[]) => Promise<unknown>> = {
  email: Email;
  notify: Notice;
};

/** The senders a run may use: the real ones for a live delivery, silent ones for a replay. */
export function customerSenders<Email extends (...args: never[]) => Promise<unknown>, Notice extends (...args: never[]) => Promise<unknown>>(
  real: CustomerSenders<Email, Notice>,
  opts: RunOptions = {},
): CustomerSenders<Email, Notice> {
  if (!opts.replay) return real;
  const silent = (async () => undefined) as unknown;
  return { email: silent as Email, notify: silent as Notice };
}
