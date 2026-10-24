import 'server-only';
import { cookies } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { clubHosts } from './club-host';
import { usesOwnAddress } from './club-domain';
import { isOwnHost } from './own-hosts';
import { isSupabaseAuthCookieName } from './sandbox-exit-rule';
import { requestHost } from './request-host';

/**
 * THE OLD ADDRESS FORWARDS TO THE CLUB'S OWN (Club Tier Stage 4e, ruling 4 and ask 7): a visitor who opens
 * `fieldlogichq.ca/lakeshore-lynx/teams` for a club that has its own address handed out is sent, permanently, to
 * `https://www.lakeshorelynx.ca/teams`, so posters and old links keep working and search moves over.
 *
 * ⚖ Everyone EXCEPT a signed-in visitor (ask 7): a signed-in family follows teams, gets alerts and sees My team on the
 * FieldLogicHQ copy, and none of that exists on the club's own host (cookies are host-only). They stay, with all their pieces.
 * "Signed in" here is the presence of a session cookie: a public page does no session read, and an expired cookie only means
 * the visitor stays on the old address, which still works.
 * ⚖ While the club's address is broken (`not_working`), `usesOwnAddress` is false, so nothing forwards: the old address is the
 * one that works, and a forward would send every old poster to an error.
 *
 * It is a page-level call, not the proxy's: www's public pages must not start paying for the proxy, and the page is the only
 * place that knows its own path. Call it first thing in a public club page, before anything is read for the page. A club
 * without its own address costs one in-memory lookup (the host cache is read at most every few minutes per server).
 *
 * `path` is the page's path WITHOUT the club's name (`'/teams/13u-aa'`, `''` for the club's home).
 */
export async function forwardToOwnAddress(orgSlug: string, path: string): Promise<void> {
  if (!isOwnHost(await requestHost())) return; // already on the club's own address
  const club = await clubHosts.forSlug(orgSlug);
  if (!club || club === 'unavailable' || !usesOwnAddress(club.status)) return;
  const jar = await cookies();
  if (jar.getAll().some(c => isSupabaseAuthCookieName(c.name))) return; // a signed-in visitor stays
  permanentRedirect(`https://${club.host}${path || '/'}`);
}
