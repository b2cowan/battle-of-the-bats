import 'server-only';
import { orgHref } from './club-base';
import { isOwnHost } from './own-hosts';
import { requestHost } from './request-host';

/**
 * LINKS TO A CLUB'S OWN PAGES, FROM A SERVER COMPONENT (Club Tier Stage 4e, Part 4b): `href('/teams')` is
 * `/lakeshore-lynx/teams` on fieldlogichq.ca and `/teams` on the club's own address, so a visitor never leaves the address
 * they came in on. (A client component uses `useOrgHref` from lib/use-public-pathname.ts.)
 *
 * The answer comes from the plain `Host` header only (the one the edge verified, see lib/request-host.ts): a host that is not
 * ours is a club's own address, and the proxy only serves that host the one club it belongs to. No database read.
 *
 *   const href = await orgLinks(orgSlug);
 *   <Link href={href('/teams')}>Teams</Link>      // the club's home is href() or href('/')
 */
export async function orgLinks(orgSlug: string): Promise<(path?: string) => string> {
  const ownHost = await onClubOwnAddress();
  return (path = '') => orgHref({ slug: orgSlug, ownHost }, path);
}

/** The visitor is on a club's own web address (not ours): the `{ ownHost }` the club-link loaders take. */
export async function onClubOwnAddress(): Promise<boolean> {
  return !isOwnHost(await requestHost());
}
