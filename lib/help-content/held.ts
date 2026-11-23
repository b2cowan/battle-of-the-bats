import type { HelpPageContent } from './index';
import { resolveSectionId } from './index';
import { sponsorshipsOpen } from '../sponsorships-open';

/**
 * HELP FOR A HELD PLACE (owner 2026-11-22, lib/sponsorships-open.ts). The guide reads the same for everyone, so an article
 * about a place no customer can open is taken out of the content itself: the guide's menu, its search, and the "?" drawer
 * (which looks sections up through the registry) all lose it together. Flipping the switch brings it back untouched.
 * ⚠ The article's anchors (`#club-sponsorships`) stop resolving while it is held; the public-site article's one in-text
 * link to it is plain text until then.
 */
export const heldHelpSectionIds = (): readonly string[] => (sponsorshipsOpen() ? [] : ['club-sponsorships']);

export function withoutHeldHelp(content: HelpPageContent): HelpPageContent {
  const held = heldHelpSectionIds();
  if (held.length === 0) return content;
  // Ids are pinned BEFORE the cut: a section without its own id is named by its position, and removing one must not rename the rest.
  const pinned = content.sections.map((s, i) => ({ ...s, id: resolveSectionId(s, i) }));
  return { ...content, sections: pinned.filter(s => !held.includes(s.id)) };
}
