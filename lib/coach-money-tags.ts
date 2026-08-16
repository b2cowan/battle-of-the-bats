import type { RepTeamTag } from '@/lib/types';

/**
 * ONE money-tag vocabulary, one create door.
 *
 * A money tag is `rep_team_tags.kind = 'expense'` and it is deliberately the SAME library on both
 * sides of the ledger: an expense can carry "Winter dome" and so can the sponsor who paid for it
 * (mig 239). Three forms now offer "+ Create" against it — the expense/payable form, the new
 * fundraiser-or-sponsor form, and a record's own Settings sheet — and three hand-copies of the
 * same POST is how one of them ends up pointed at the wrong `kind` and quietly starts a second
 * vocabulary that looks like the first.
 *
 * Returns the tag, or the server's own words. The caller owns where an error is DRAWN (each of the
 * three forms surfaces it in a different place) and owns adding the tag to its loaded library —
 * this only performs the write.
 */
export async function createMoneyTag(
  orgSlug: string,
  teamId: string,
  name: string,
): Promise<{ tag: RepTeamTag } | { error: string }> {
  try {
    const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expense-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      return { error: (await res.json().catch(() => ({}))).error ?? 'Could not create tag' };
    }
    const { tag } = await res.json();
    return { tag: tag as RepTeamTag };
  } catch {
    return { error: 'Could not create tag' };
  }
}
