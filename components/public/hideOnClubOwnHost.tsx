'use client';
/**
 * A piece that needs a signed-in visitor, absent on a club's own web address (Club Tier Stage 4e, spike ruling 5).
 * Cookies are host-only, so everyone on `www.lakeshorelynx.ca` is signed out; Follow, alerts, My team and the sign-up banner
 * would each ask for a sign-in that cannot land there. They stay on the FieldLogicHQ copy of the page, where a signed-in visitor
 * is not forwarded away (lib/club-forward.ts), and the club bar carries one plain "Sign in" link back to it.
 *
 * Absent, not disabled: `hideOnClubOwnHost(Piece)` renders nothing at all on a club's own host and the piece unchanged on ours.
 * The test is the route against the address (lib/club-base.ts), identical on the server and in the browser, so it never
 * flashes or mismatches.
 */
import type { ComponentType } from 'react';
import { useClubBase } from '@/lib/use-public-pathname';

export function hideOnClubOwnHost<P extends object>(Piece: ComponentType<P>): ComponentType<P> {
  function Wrapped(props: P) {
    const own = useClubBase()?.ownHost === true;
    return own ? null : <Piece {...props} />;
  }
  Wrapped.displayName = `hideOnClubOwnHost(${Piece.displayName ?? Piece.name ?? 'Piece'})`;
  return Wrapped;
}
