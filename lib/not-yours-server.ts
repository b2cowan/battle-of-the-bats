import 'server-only';
import { boardNames } from './member-names';
import { boardOwnerName } from './board-people';
import { memberHome } from './member-home';
import type { EntitlementOrg } from './module-entitlements';
import type { NotYoursPage } from './not-yours-words';
import type { OrgRole } from './types';
import type { NotYoursScreenProps } from '@/components/admin/kit/club/NotYoursScreen';

/**
 * The "not yours" screen's facts for a SERVER layout (Club Tier Stage 13a, A1): the owner by name (names only — the
 * board read never returns an email) and the person's own home. The layout renders `NotYoursScreen` in place of its
 * children — the same decision it made before, which used to be a silent redirect to the Overview. The page's data routes
 * still refuse on their own.
 */
export async function notYoursScreenProps(
  ctx: { org: EntitlementOrg & { id: string; slug: string }; role: OrgRole },
  page: NotYoursPage,
): Promise<NotYoursScreenProps> {
  const ownerName = boardOwnerName(await boardNames(ctx.org.id, ['owner']));
  return { page, ownerName, viewerRole: ctx.role, home: memberHome(ctx.org.slug, ctx.role, ctx.org, page) };
}
